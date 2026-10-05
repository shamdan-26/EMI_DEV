import { test, expect, type Request } from '@playwright/test';
import {
    findTopupCase,
    loginToTopup,
    gotoTopupScreen,
    reachCardEntryPopup,
    reachOtpScreen,
    getLatestTopupTransactionLogFromSql,
    getTopupTransactionLogHistoryFromSql,
    decodeJwtProfileCode,
    type TopupSession,
} from '../TopupHelper';
import { closeSqlPool } from '../../../support/sqlServerClient';

// Negative — client-side validation and mid-flow rejection/cancellation. Maps
// to docs/manual-test-cases/B2B-Transactions.md section D (TU-02) and
// Topup.md section D/F/G (TUP-12, TUP-20, TUP-28).
//
// Split out from Happy Path / UI / Security / API — see TopupHelper.ts's
// shared setup (loginToTopup/gotoTopupScreen/findTopupCase).

test.describe('Topup – Negative', { tag: ['@topup', '@functional'], annotation: [{ type: 'feature', description: 'Topup' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(150000);

    let session: TopupSession;

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser);
    });

    test.afterAll(async () => {
        await session.page.close();
        await closeSqlPool();
    });

    test.beforeEach(async () => {
        await gotoTopupScreen(session);
    });

    test('zero amount is rejected and Proceed stays disabled', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('mada');
        await topup.assertInvalidAmountNotAccepted('0');
        await expect(topup.proceedButton).toBeDisabled();
    });

    test('non-numeric characters are rejected and Proceed stays disabled', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('mada');
        await topup.assertInvalidAmountNotAccepted('abc!@#');
        await expect(topup.proceedButton).toBeDisabled();
    });

    /**
     * TUP-13 (docs/manual-test-cases/Topup.md — flagged as a gap, not yet
     * automated) — a 9-digit amount silently truncates to 7 digits with no
     * visible error, observed live in two independent manual walkthroughs.
     * This confirms the truncation ceiling; it doesn't assert whether silent
     * truncation (vs. a visible max-amount message) is the intended design —
     * that's still an open product question, not something to assert on.
     */
    test('a 9-digit amount is truncated rather than accepted in full', { annotation: [{ type: 'testcase', description: "TUP-13: **[Gap — not in `topupData.json`]** Long integer amount is capped" }] }, async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('mada');
        await topup.enterAmount('999999999');
        const value = await topup.getAmountValue();
        expect(value.replace(/[^\d]/g, '').length).toBeLessThanOrEqual(7);
    });

    test('Proceed stays disabled with a valid amount but no payment method selected', async () => {
        const { topup } = session;
        await topup.enterAmount('500');
        await expect(topup.proceedButton).toBeDisabled();
    });

    test('cancelling on the Summary screen returns to the form with the balance unchanged', async () => {
        const { topup } = session;
        const data = findTopupCase('VISA');
        await topup.getBalanceBeforeTopup();
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount(data.amount);
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();

        await topup.clickSummaryCancelButton();
        await expect(topup.summaryNextButton).not.toBeVisible();
        await topup.checkBalanceRemainsUnchanged();
    });

    /**
     * "000000" is NOT a safe "wrong code" to use here — confirmed live
     * 2026-09-22 that it was ACCEPTED and opened the gateway popup, meaning
     * ENV=dev's documented OTP bypass (CLAUDE.md: "the OTP is always
     * 00000000" for login) applies to this 6-digit transaction OTP too, just
     * at its own digit count. A non-zero code avoids that fallback.
     *
     * A guessed `otp.errorMessage` assertion previously stalled this test
     * (confirmed live — the assertion correctly reported "element never
     * found" after its own 10s bound, but the page then went unresponsive
     * enough that even trace-fixture teardown timed out separately, alongside
     * an unrelated Angular NG0100 console error from `_SetAmountComponent`
     * right after the Summary→Next click). Rather than assert on error-UI
     * markup that isn't confirmed live for this screen, this checks the one
     * behavior that actually matters for a rejected OTP — the gateway popup
     * must not open — without depending on it.
     */
    test('an incorrect OTP is rejected and the flow does not advance to the gateway popup', async () => {
        const { page, otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        await otp.fillAndVerify('194857');

        const popup = await page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
        if (popup) await popup.close(); // shouldn't happen — don't leak state into the next test if it does
        expect(popup).toBeNull();
        // Still on the OTP screen, not silently advanced elsewhere.
        await expect(otp.inputs.first()).toBeVisible();
    });

    /**
     * TU-04 (docs/manual-test-cases/B2B-Transactions.md section D). The UAT
     * gateway simulator's return-code dropdown labels this option "User
     * canceled" (confirmed live 2026-09-22 — see TopupPage.ts's
     * selectGatewayReturnCode for the full option list), not literally a
     * bank decline, but the app's own result screen is the same generic
     * "Payment Failed" ("فشلت الدفعة") regardless of the simulated reason.
     *
     * EMI-6150 regression (see docs/business-knowledge/EMI-6150-Refined-Ticket.md
     * §4): this is the PENDING → FAILED half of "unify transaction status
     * events on a single Debezium CDC topic" — TopupHappyPath.spec.ts already
     * proves the PENDING → SUCCESS half at the same emi_transaction.transaction_log
     * level, this proves FAILED releases the reserve the same way, with no
     * duplicate terminal row (the black-box proxy for "applied exactly once" /
     * "wallet-service skips events it has already processed" — see that
     * section for why a literal CDC-replay test isn't possible from here).
     */
    test('a "User canceled" gateway result shows a failure result and leaves the balance unchanged', { annotation: [{ type: 'testcase', description: "TU-04: Declined/failed payment shows clear error" }] }, async () => {
        test.skip(true, 'VPN access to SQL Server/Mongo is currently unavailable — this test\'s DB assertions cannot run until that\'s restored.');
        const { page, topup } = session;
        const data = findTopupCase('VISA');

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

        await topup.getBalanceBeforeTopup();
        const popup = await reachCardEntryPopup(session, 'visa', data);

        await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);
        await topup.clickPayNowButton();
        await topup.selectGatewayReturnCode('2'); // 2 = User canceled
        if (await topup.isHyperpayScreenDisplayed()) {
            await topup.clickHyperpaySubmitButton();
        }

        await popup.waitForEvent('close', { timeout: 30000 }).catch(() => null);
        topup.resetActivePage();

        await topup.assertFailedPopup();
        await topup.clickResultOkButton();
        await topup.checkBalanceRemainsUnchanged();
        page.off('request', captureAuth);

        // SQL Server-level assertion — emi_transaction.transaction_log, same
        // table/columns TopupHappyPath.spec.ts confirmed live for the SUCCESS
        // case. A failed row carries a non-empty `reasons` array naming why
        // (TopupHelper.ts's own header comment on TopupTransactionLogSqlRow).
        expect(profileCode, 'no Authorization header was captured off POST /api/v1/payments').not.toBe('');
        const sqlLogTxn = await getLatestTopupTransactionLogFromSql(profileCode);
        expect(sqlLogTxn, `no transaction_log row found for initiator ${profileCode}`).not.toBeNull();
        expect(sqlLogTxn!.status).toBe('FAILED');
        expect(JSON.parse(sqlLogTxn!.reasons)).not.toEqual([]);

        // Full lifecycle, same append-only-log shape TopupHappyPath.spec.ts
        // checks for SUCCESS: earliest row PENDING (the reserve), latest row
        // the terminal FAILED (the release). The count of non-PENDING rows
        // must be exactly one — more than one would mean the terminal status
        // was applied twice, i.e. a duplicate CDC delivery wasn't skipped.
        if (idempotencyKey) {
            const history = await getTopupTransactionLogHistoryFromSql(idempotencyKey);
            expect(history.length, 'expected at least a PENDING row and a terminal row for this idempotency_key').toBeGreaterThanOrEqual(2);
            expect(history[0]!.status, 'the earliest row for this top-up should be PENDING').toBe('PENDING');
            expect(history[history.length - 1]!.status, 'the latest row for this top-up should be the terminal FAILED').toBe('FAILED');
            const terminalRows = history.filter(row => row.status !== 'PENDING');
            expect(terminalRows.length, 'the terminal status must be applied exactly once, not duplicated by a re-processed CDC event').toBe(1);
        }
    });

    test('a Pending gateway result shows a pending result and leaves the balance unchanged', async () => {
        const { topup } = session;
        const data = findTopupCase('VISA');
        await topup.getBalanceBeforeTopup();
        const popup = await reachCardEntryPopup(session, 'visa', data);

        await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);
        await topup.clickPayNowButton();
        await topup.selectGatewayReturnCode('3'); // 3 = Pending
        if (await topup.isHyperpayScreenDisplayed()) {
            await topup.clickHyperpaySubmitButton();
        }

        await popup.waitForEvent('close', { timeout: 30000 }).catch(() => null);
        topup.resetActivePage();

        await topup.assertPendingPopup();
        await topup.clickResultOkButton();
        await topup.checkBalanceRemainsUnchanged();
    });

    /**
     * Dropdown options 4 ("Error, limit exceeded") and 5 ("Error, too many
     * tries") weren't exercised anywhere before this. Confirmed live
     * 2026-09-22: both surface the same generic "Payment Failed"
     * ("فشلت الدفعة") result screen option 2 does — not a distinct message
     * per reason code.
     */
    test('an "Error, limit exceeded" gateway result shows a failure result and leaves the balance unchanged', async () => {
        const { topup } = session;
        const data = findTopupCase('VISA');
        await topup.getBalanceBeforeTopup();
        const popup = await reachCardEntryPopup(session, 'visa', data);

        await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);
        await topup.clickPayNowButton();
        await topup.selectGatewayReturnCode('4'); // 4 = Error, limit exceeded
        if (await topup.isHyperpayScreenDisplayed()) {
            await topup.clickHyperpaySubmitButton();
        }

        await popup.waitForEvent('close', { timeout: 30000 }).catch(() => null);
        topup.resetActivePage();

        await topup.assertFailedPopup();
        await topup.clickResultOkButton();
        await topup.checkBalanceRemainsUnchanged();
    });

    test('an "Error, too many tries" gateway result shows a failure result and leaves the balance unchanged', async () => {
        const { topup } = session;
        const data = findTopupCase('VISA');
        await topup.getBalanceBeforeTopup();
        const popup = await reachCardEntryPopup(session, 'visa', data);

        await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);
        await topup.clickPayNowButton();
        await topup.selectGatewayReturnCode('5'); // 5 = Error, too many tries
        if (await topup.isHyperpayScreenDisplayed()) {
            await topup.clickHyperpaySubmitButton();
        }

        await popup.waitForEvent('close', { timeout: 30000 }).catch(() => null);
        topup.resetActivePage();

        await topup.assertFailedPopup();
        await topup.clickResultOkButton();
        await topup.checkBalanceRemainsUnchanged();
    });

    /**
     * Explicit-Success coverage for the dropdown itself — Happy Path's own
     * tests never touch this selector at all (the simulator's default,
     * unselected state already behaves as success), so this is the one case
     * that proves selecting "1" (Success) explicitly still credits the
     * wallet, closing out full coverage of all 5 dropdown options.
     */
    test('an explicit "Success" gateway result credits the wallet with the exact amount', async () => {
        const { topup } = session;
        const data = findTopupCase('VISA');
        await topup.getBalanceBeforeTopup();
        const popup = await reachCardEntryPopup(session, 'visa', data);

        await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);
        await topup.clickPayNowButton();
        await topup.selectGatewayReturnCode('1'); // 1 = Success
        if (await topup.isHyperpayScreenDisplayed()) {
            await topup.clickHyperpaySubmitButton();
        }

        await popup.waitForEvent('close', { timeout: 30000 }).catch(() => null);
        topup.resetActivePage();

        await topup.clickResultOkButton();
        await topup.checkBalanceAfterTopup(data.amount);
    });
});
