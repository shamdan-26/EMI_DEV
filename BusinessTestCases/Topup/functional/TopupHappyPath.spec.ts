import { test, expect, type Request } from '@playwright/test';
import { HomePage } from '../../pageElements/Shared/HomePage';
import { TransactionsPage } from '../../pageElements/Shared/TransactionsPage';
import {
    findTopupCase,
    loginToTopup,
    gotoTopupScreen,
    reachCardEntryPopup,
    getLatestTopupTransactionFromDb,
    getLatestTopupTransactionFromSql,
    getLatestTopupTransactionLogFromSql,
    getTopupTransactionLogHistoryFromSql,
    decodeJwtProfileCode,
    HOME_URL,
    type TopupSession,
} from '../TopupHelper';
import { closeMongoClient } from '../../../support/mongoClient';
import { closeSqlPool } from '../../../support/sqlServerClient';

// Functional — the full, end-to-end Topup happy path for each card method:
// enter an amount, pick a card method, complete OTP + the HyperPay/3-D-Secure
// gateway, and confirm the wallet balance increases by exactly the entered
// amount. Split out from the other Topup "Core Scenarios" files (UI,
// Negative, Security, API — see TopupHelper.ts's shared setup) so each
// testing type can be run/read/extended independently.
//
// TopupPage.ts's card-number/CVV/expiry/holder/Pay-Now locators were fixed
// alongside this suite (2026-09-20) — they hardcoded English placeholder/label
// text against a UI that renders Arabic by default on dev, so the
// frameLocator for the card-number/CVV PCI iframes never resolved at all. See
// that file's own comments for the confirmed live attributes.
//
// All three methods confirmed passing together, live on dev, 2026-09-20.

test.describe('Topup – Happy Path', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(150000);

    let session: TopupSession;

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser);
    });

    test.afterAll(async () => {
        await session.page.close();
        await closeMongoClient();
        await closeSqlPool();
    });

    test.beforeEach(async () => {
        await gotoTopupScreen(session);
    });

    /**
     * Shared happy-path body for every card method — the only differences
     * between them are which radio to select, whose card data to fill, and
     * which gateway submit path to route through after Pay Now: VISA goes
     * through the HyperPay `.wpwl-target` iframe, MADA/MASTER through the
     * 3-D-Secure "card_*" one (`clickCardSchemeSubmitButton`).
     */
    async function runTopupScenario(method: 'mada' | 'visa' | 'master'): Promise<void> {
        const { page, topup } = session;
        const data = findTopupCase(method.toUpperCase() as 'MADA' | 'VISA' | 'MASTER');
        const homePage = new HomePage(page);
        const scenarioStartedAt = Date.now();

        // Captured off the real POST /api/v1/payments request (same call the
        // idempotency-key test in TopupSecurity.spec.ts reads) so the DB
        // lookup below queries by this account's real profileCode rather
        // than a hardcoded value that could go stale.
        let profileCode = '';
        let idempotencyKey = '';
        const captureAuth = (req: Request) => {
            if (req.method() === 'POST' && req.url().endsWith('/api/v1/payments')) {
                const auth = req.headers()['authorization'];
                if (auth) profileCode = decodeJwtProfileCode(auth);
                idempotencyKey = req.headers()['idempotencykey'] ?? '';
            }
        };
        page.on('request', captureAuth);

        // Read the Home page's own balance widget before anything moves —
        // navigating there first matters: HomePage.currentBalance and
        // TopupPage.balanceAmount share the same `.mp-bal-amount` class, so
        // reading it while still on the Topup screen would just re-read
        // Topup's own widget, not a genuinely independent Home-page value.
        await page.goto(HOME_URL);
        await page.waitForLoadState('networkidle').catch(() => null);
        const homeBalanceBefore = await homePage.getWalletBalance();

        await gotoTopupScreen(session);
        await topup.getBalanceBeforeTopup();
        // Captured here (stable throughout the flow) to cross-check against
        // the DB's destination_wallet_code later — confirms the ledger
        // credited the exact wallet this screen shows, not just "a" wallet.
        // The widget's raw text also carries the "· رمز المحفظة" (Wallet
        // code) label ahead of the code itself — confirmed live 2026-09-22:
        // "· رمز المحفظة BIL-YA3SDXEXZX-09". The code is always the trailing
        // token; extract just that rather than the whole label+code string.
        const uiWalletCodeRaw = (await topup.balanceWalletCode.textContent())?.trim() ?? '';
        const uiWalletCode = uiWalletCodeRaw.split(/\s+/).pop() ?? '';
        const popup = await reachCardEntryPopup(session, method, data);

        await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);
        await topup.clickPayNowButton();
        if (method === 'mada' || method === 'master') {
            await topup.clickCardSchemeSubmitButton();
        } else if (await topup.isHyperpayScreenDisplayed()) {
            await topup.clickHyperpaySubmitButton();
        }

        await popup.waitForEvent('close', { timeout: 30000 }).catch(() => null);
        topup.resetActivePage();

        await topup.clickResultOkButton();
        await page.reload();
        await page.waitForLoadState('networkidle').catch(() => null);
        await topup.checkBalanceAfterTopup(data.amount);

        // Home page balance after — must independently reflect the same credit.
        await page.goto(HOME_URL);
        await page.waitForLoadState('networkidle').catch(() => null);
        const homeBalanceAfter = await homePage.getWalletBalance();
        const expectedHomeBalance = Math.round((homeBalanceBefore + Number(data.amount)) * 100) / 100;
        expect(Math.round(homeBalanceAfter * 100) / 100).toBe(expectedHomeBalance);

        // The completed top-up shows up as the last transaction, reachable
        // from the Home page's own sidebar nav. Compared as a number, not via
        // validateLastTransactionAndReturnStatus's strict string match —
        // confirmed live 2026-09-22 that this list renders "1,000" (no
        // decimals), not "1000.00" like data.amount, so an exact-string
        // comparison throws on a value that's actually correct.
        await homePage.clicTransactions_NavButton();
        await page.waitForLoadState('networkidle').catch(() => null);
        const transactionsPage = new TransactionsPage(page);
        await expect(transactionsPage.lastTransactionRow).toBeVisible({ timeout: 15000 });
        const lastAmountText = (await transactionsPage.lastTransactionAmount.textContent()) ?? '';
        const lastAmount = parseFloat(lastAmountText.replace(/[^\d.]/g, ''));
        expect(lastAmount).toBeCloseTo(Number(data.amount), 2);
        // Confirmed live 2026-09-22: the Home page's Transactions list
        // renders "نجاح" (Arabic "Success") for a completed top-up — a
        // fourth vocabulary distinct from both Mongo's "SUCCESS" and SQL
        // Server's "POSTED". Matched bilingually in case an English build
        // ever renders "success" instead.
        const homeStatus = (await transactionsPage.lastTransactionStatus.textContent())?.trim() ?? '';
        expect(homeStatus).toMatch(/^(success|نجاح)$/i);

        page.off('request', captureAuth);

        // DB-level assertion — the same record the app posted the wallet
        // credit from (transaction_query_log.transactionLog), independent of
        // anything the UI renders. See TopupHelper.ts for how the schema was
        // confirmed.
        expect(profileCode, 'no Authorization header was captured off POST /api/v1/payments').not.toBe('');
        const dbTxn = await getLatestTopupTransactionFromDb(profileCode);
        expect(dbTxn, `no transactionLog entry found for initiator ${profileCode}`).not.toBeNull();
        expect(dbTxn!.status).toBe('SUCCESS');
        expect(parseFloat(dbTxn!.destinationAmount)).toBeCloseTo(Number(data.amount), 2);
        expect(dbTxn!.destinationCurrency).toBe('SAR');

        // SQL Server-level assertion — emi_transaction.base_transaction, the
        // relational ledger row behind the same top-up, independent of both
        // the UI and the Mongo read-model above. Column set confirmed live
        // 2026-09-22 against real rows.
        const sqlTxn = await getLatestTopupTransactionFromSql(profileCode);
        expect(sqlTxn, `no base_transaction row found for initiator ${profileCode}`).not.toBeNull();

        // Date: the ledger row must have been created during THIS scenario's
        // own run, not a stale/earlier one the initiator filter happened to match.
        expect(new Date(sqlTxn!.created_at).getTime()).toBeGreaterThanOrEqual(scenarioStartedAt);
        // Type — redundant with the query's own WHERE clause, asserted
        // explicitly anyway per the full-field check requested.
        expect(sqlTxn!.type).toBe('PAYMENT_TRANSACTION');
        // Confirmed live 2026-09-22: SQL Server's own vocabulary for this is
        // "POSTED" (ledger posting state), distinct from both Mongo's
        // "SUCCESS" and the Home page's "نجاح" — see the status-consistency
        // log below, right after all three have been read.
        expect(sqlTxn!.status).toBe('POSTED');
        expect(Number(sqlTxn!.amount)).toBeCloseTo(Number(data.amount), 2);
        expect(sqlTxn!.destination_wallet_code).toBe(uiWalletCode);
        expect(sqlTxn!.destination_wallet_type).toBe('BILLER');
        expect(sqlTxn!.destination_profile_code).toBe(profileCode);
        // Commission/VAT: this account has neither configured — every
        // balance-delta check above already confirmed the full entered
        // amount lands with nothing deducted, so these are expected to be 0,
        // not merely present.
        expect(Number(sqlTxn!.destination_commission_amount ?? 0)).toBe(0);
        expect(Number(sqlTxn!.destination_vat_amount ?? 0)).toBe(0);
        // Cross-system consistency: the idempotencyKey header the app sent
        // must be the exact value persisted on the ledger row it produced.
        if (idempotencyKey) {
            expect(sqlTxn!.idempotency_key).toBe(idempotencyKey);
        }

        // SQL Server-level assertion — emi_transaction.transaction_log, a
        // near-identical schema twin of the Mongo read-model above (likely
        // the SQL source it's projected from) but with the SAME status
        // vocabulary as Mongo ("SUCCESS"), unlike base_transaction's
        // "POSTED". Schema confirmed live 2026-09-22 against real rows.
        const sqlLogTxn = await getLatestTopupTransactionLogFromSql(profileCode);
        expect(sqlLogTxn, `no transaction_log row found for initiator ${profileCode}`).not.toBeNull();
        expect(new Date(sqlLogTxn!.created_at).getTime()).toBeGreaterThanOrEqual(scenarioStartedAt);
        expect(sqlLogTxn!.status).toBe('SUCCESS');
        // A successful row's reasons array is empty — confirmed live: a
        // failed/pending row instead carries an explanatory code like
        // "HYPER-PAY-FAILURE" or "PENDING-CLIENT-PAYMENT" (see
        // TopupHelper.ts's own header comment for this table).
        expect(JSON.parse(sqlLogTxn!.reasons)).toEqual([]);
        expect(Number(sqlLogTxn!.destination_amount)).toBeCloseTo(Number(data.amount), 2);
        expect(sqlLogTxn!.destination_currency).toBe('SAR');
        // destination_wallet_code here holds the wallet TYPE ("BILLER"), not
        // the wallet code itself — destination_reference holds the actual
        // bank-linked code, prefixed with the receiving bank's SWIFT code
        // (e.g. "ARNBSARI-BIL-YA3SDXEXZX-09"), confirmed live to end with
        // the same code the UI/base_transaction both use.
        expect(sqlLogTxn!.destination_wallet_code).toBe('BILLER');
        expect(sqlLogTxn!.destination_reference.endsWith(uiWalletCode)).toBe(true);
        expect(sqlLogTxn!.txn_type_name).toBe('Biller Bank Cashin');
        expect(sqlLogTxn!.initiator).toBe(profileCode);
        if (idempotencyKey) {
            expect(sqlLogTxn!.idempotency_key).toBe(idempotencyKey);
        }

        // Full lifecycle — transaction_log is an append-only log, not a
        // mutated-in-place row: a single top-up must show up as (at least)
        // two rows sharing one idempotency_key, a PENDING one written when
        // the gateway call was initiated, then the terminal SUCCESS row
        // asserted above. Confirmed live 2026-09-22.
        //
        // Also the PENDING -> SUCCESS half of EMI-6150's "unify transaction
        // status events on a single Debezium CDC topic" (see
        // docs/business-knowledge/EMI-6150-Refined-Ticket.md §4) — this same
        // append-only lifecycle is the black-box evidence that reserve-then-
        // settle still works correctly now that every status change flows
        // through one CDC topic instead of four. See
        // TopupNegative.spec.ts's "User canceled" test for the PENDING ->
        // FAILED / release half, including the "applied exactly once"
        // terminal-row-count check this test doesn't itself assert.
        const history = await getTopupTransactionLogHistoryFromSql(sqlLogTxn!.idempotency_key);
        expect(history.length, 'expected at least a PENDING row and a terminal row for this idempotency_key').toBeGreaterThanOrEqual(2);
        expect(history[0]!.status, 'the earliest row for this top-up should be PENDING').toBe('PENDING');
        expect(history[history.length - 1]!.status, 'the latest row for this top-up should be the terminal SUCCESS').toBe('SUCCESS');
        // Chronological — each row's timestamp is no earlier than the one before it.
        for (let i = 1; i < history.length; i++) {
            expect(new Date(history[i]!.created_at).getTime()).toBeGreaterThanOrEqual(new Date(history[i - 1]!.created_at).getTime());
        }

        // Status consistency across all four systems — each already asserted
        // to its own confirmed-correct vocabulary above: Home "نجاح" (~145),
        // Mongo "SUCCESS" (~156), SQL Server base_transaction "POSTED"
        // (~177), SQL Server transaction_log "SUCCESS" (just above — the
        // same word Mongo uses, since transaction_log is Mongo's likely
        // source). Logged together here as the single place that proves
        // none of the four disagree with each other for this same top-up.
        console.log(`[STATUS] home="${homeStatus}" mongo="${dbTxn!.status}" sql.base_transaction="${sqlTxn!.status}" sql.transaction_log="${sqlLogTxn!.status}"`);
    }

    test('should top up with a VISA card and credit the wallet with the exact amount', async () => {
        test.skip(true, 'VPN access to SQL Server/Mongo is currently unavailable — this test\'s DB/Mongo assertions cannot run until that\'s restored.');
        await runTopupScenario('visa');
    });

    test('should top up with a MASTER card and credit the wallet with the exact amount', async () => {
        test.skip(true, 'VPN access to SQL Server/Mongo is currently unavailable — this test\'s DB/Mongo assertions cannot run until that\'s restored.');
        await runTopupScenario('master');
    });

    test('should top up with a MADA card and credit the wallet with the exact amount', async () => {
        test.skip(true, 'VPN access to SQL Server/Mongo is currently unavailable — this test\'s DB/Mongo assertions cannot run until that\'s restored.');
        await runTopupScenario('mada');
    });
});
