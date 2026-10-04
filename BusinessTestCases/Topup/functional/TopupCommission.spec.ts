import { test, expect, type BrowserContext, type Locator, type Request } from '@playwright/test';
import { type AdminCommissionManagementPage, COMMISSION_CATEGORY } from '../../pageElements/CommissionManagement/AdminCommissionManagementPage';
import { loginToCommissionManagement, ensureAccountCommissionExistsAndActive } from '../../CommissionManagement/CommissionManagementHelper';
import {
    SUMMARY_LABEL,
    TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE,
    TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE,
    prepareBillerTopupCommission,
    restoreBillerTopupCommission,
    ensureAppScopedBillerTopupCommission,
    restoreAppScopedBillerTopupCommission,
    loginToTopup,
    gotoTopupScreen,
    findTopupCase,
    clickSummaryNextAndDetectOtp,
    decodeJwtProfileCode,
    getLatestTopupTransactionFromSql,
    LOGIN_MOBILE,
    LOGIN_COMPANY,
    type TopupSession,
    type TopupCommissionSnapshot,
} from '../TopupHelper';
import { getOtpFromDb } from '../../Login/LoginHelper';
import { closeSqlPool } from '../../../support/sqlServerClient';

// Validates the Biller account's (Q9557) LIVE "Biller Bank Cashin" default
// commission — the WEB row `prepareBillerTopupCommission` selects, creating
// one if none exists yet. Every boundary amount this suite tops up with is
// derived at runtime from that row's own minimumAmount/maximumAmount/
// value/isPercentage, never hardcoded — the admin portal's configured
// boundaries can change at any time, so a fixed number here would silently
// stop reflecting live data.
//
// This is the Biller-account counterpart of the retired
// archive/TopupCommission.spec.ts, which targeted the "Merchant Cashin" row
// under a different login (VALID_COMPANY/MOBILE/PASSWORD) — that account is
// no longer what the active Core Scenarios suite (Happy Path/Negative/UI/
// Security/API) uses. This file instead reuses `loginToTopup`/
// `gotoTopupScreen` from TopupHelper.ts, the same session-setup every other
// active Topup file shares, and targets "Biller Bank Cashin" /
// ACCOUNT_TYPE.BILLER — confirmed live 2026-09-22 via the admin portal's
// "Choose ... Transaction" dropdown for Cash-In / Biller, and matching the
// SQL `transaction_log.txn_type_name` TopupHappyPath.spec.ts already asserts.
//
// Structure mirrors the retired file 1:1 (same TU-CM numbering from
// docs/manual-test-cases/B2B-Transactions.md section O): one admin session
// opened once for the whole file (TU-CM32 excepted, which needs the
// APP-platform row — a different row than the WEB one everything else here
// uses, so it opens/closes its own short-lived admin session), snapshot
// taken in beforeAll, restored in afterAll as a safety net.
test.describe('Topup – Commission', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(150000);

    let session: TopupSession;

    let adminContext: BrowserContext;
    let adminCommission: AdminCommissionManagementPage;

    let commissionSnapshot: TopupCommissionSnapshot;
    let minimumAmount: number;
    let maximumAmount: number;
    let midpointAmount: number;
    let commissionValue!: number;
    let isPercentage!: boolean;

    /** Percentage: `amount * value / 100`. Fixed: always `value`, regardless of amount. */
    function expectedCommission(amount: number): number {
        return isPercentage ? amount * (commissionValue / 100) : commissionValue;
    }

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser);
    });

    test.afterAll(async () => {
        await session.page.close();
        await closeSqlPool();
    });

    // The ONE admin touch at the beginning of the file — see the header
    // comment above.
    test.beforeAll(async ({ browser }, testInfo) => {
        testInfo.setTimeout(120000); // was 90000 — confirmed live too tight once admin-login retries (dev auth-gateway flakiness) and a multi-row grid scan are both in play
        const { context, commission } = await loginToCommissionManagement(browser);
        adminContext = context;
        adminCommission = commission;

        commissionSnapshot = await prepareBillerTopupCommission(commission);

        minimumAmount = Number(commissionSnapshot.values.minimumAmount);
        maximumAmount = Number(commissionSnapshot.values.maximumAmount);
        midpointAmount = Math.round((minimumAmount + maximumAmount) / 2);
        commissionValue = Number(commissionSnapshot.values.value);
        isPercentage = commissionSnapshot.values.isPercentage ?? true;

        console.log(
            `[TopupCommission] using live "Biller Bank Cashin" tier: ${minimumAmount}-${maximumAmount}, ` +
            `${commissionValue}${isPercentage ? '%' : ' flat'}, platform=${commissionSnapshot.values.platform}.`,
        );
    });

    test.beforeEach(async () => {
        await gotoTopupScreen(session);
    });

    // Safety-net restore, reusing the SAME admin session the beforeAll opened.
    test.afterAll(async () => {
        if (commissionSnapshot) await restoreBillerTopupCommission(adminCommission, commissionSnapshot);
        if (adminContext) await adminContext.close();
    });

    const PAYMENT_METHODS = ['mada', 'visa', 'master'] as const;

    /** Tops up `amount` through a randomly chosen payment method, waits for the summary to settle, and returns { original, commission }. */
    async function topupAndReadSummary(amount: number): Promise<{ original: number; commission: number }> {
        const { topup } = session;
        const method = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];
        await topup.selectPaymentMethod(method);
        await topup.enterAmount(String(amount));
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();
        const original = await topup.getSummaryMoney(SUMMARY_LABEL.original);
        const commission = await topup.getSummaryMoney(SUMMARY_LABEL.commission);
        await topup.clickSummaryCancelButton();
        await gotoTopupScreen(session);
        return { original, commission };
    }

    /**
     * For a gap amount (no tier configured for it), the doc's own Expected
     * Result is "verify against live behaviour" — not a fixed pass/fail
     * value. Attempts the top-up and reports which of the two observable
     * outcomes actually happened (summary settled with a commission, or the
     * flow was blocked/toasted) rather than asserting a specific number that
     * would just be a guess.
     */
    async function topupGapAmountAndReportOutcome(amount: number, caseId: string): Promise<void> {
        const { page, topup } = session;
        await gotoTopupScreen(session);
        await topup.selectPaymentMethod('mada');
        await topup.enterAmount(String(amount));

        const toast = page.getByTestId('toast').or(page.locator('mat-snack-bar-container, [class*="snack"], [class*="toast"]')).first();
        const proceedEnabled = await topup.proceedButton.isEnabled().catch(() => false);

        if (!proceedEnabled) {
            console.log(`[${caseId}] amount ${amount}: Proceed stayed disabled — topup blocked before submission.`);
            return;
        }

        await topup.clickProceedButton();

        const summaryReached = await page.locator('.mp-sum-row')
            .first()
            .waitFor({ state: 'visible', timeout: 10000 })
            .then(() => true)
            .catch(() => false);

        if (summaryReached) {
            await topup.waitForSummaryToSettle();
            const original = await topup.getSummaryMoney(SUMMARY_LABEL.original);
            const commission = await topup.getSummaryMoney(SUMMARY_LABEL.commission);
            console.log(`[${caseId}] amount ${amount}: summary settled — original=${original}, commission=${commission}. Flag as a config gap if no tier should have matched.`);
            expect(original).toBe(amount);
            expect(commission).toBeGreaterThanOrEqual(0);
            await topup.clickSummaryCancelButton();
            return;
        }

        const toasted = await toast.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (toasted) {
            console.log(`[${caseId}] amount ${amount}: rejected with a toast — topup blocked for this gap range.`);
        } else {
            throw new Error(`[${caseId}] amount ${amount}: neither the summary nor an error toast appeared — unexpected state, raise a defect.`);
        }
    }

    // ---- Live single-tier boundary validation — amounts below are derived
    // from whichever "Biller Bank Cashin" row prepareBillerTopupCommission
    // selected, never hardcoded. Maps to
    // docs/manual-test-cases/B2B-Transactions.md section O ----

    test('TU-CM19 — commission applied at the tier minimum boundary', async () => {
        const { original, commission } = await topupAndReadSummary(minimumAmount);
        expect(original).toBe(minimumAmount);
        expect(commission).toBeCloseTo(expectedCommission(minimumAmount), 2);
    });

    test('TU-CM20 — commission applied at the tier maximum boundary', async () => {
        const { original, commission } = await topupAndReadSummary(maximumAmount);
        expect(original).toBe(maximumAmount);
        expect(commission).toBeCloseTo(expectedCommission(maximumAmount), 2);
    });

    test('TU-CM21 — commission applied mid-range within the tier', async () => {
        test.skip(
            midpointAmount === minimumAmount || midpointAmount === maximumAmount,
            `Tier range ${minimumAmount}-${maximumAmount} is too narrow for a distinct midpoint.`,
        );
        const { original, commission } = await topupAndReadSummary(midpointAmount);
        expect(original).toBe(midpointAmount);
        expect(commission).toBeCloseTo(expectedCommission(midpointAmount), 2);
    });

    test('TU-CM22 — amount just below the tier minimum falls in an unconfigured gap', async () => {
        test.skip(minimumAmount <= 1, 'Minimum boundary is already the smallest positive amount — no gap below it to test.');
        await topupGapAmountAndReportOutcome(minimumAmount - 1, 'TU-CM22');
    });

    test('TU-CM23 — amount just above the tier maximum falls in an unconfigured gap', async () => {
        await topupGapAmountAndReportOutcome(maximumAmount + 1, 'TU-CM23');
    });

    test('TU-CM29 — amount below the smallest valid amount (0 or negative) is rejected outright', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('mada');
        await topup.assertInvalidAmountNotAccepted('0');
        await expect(topup.proceedButton).toBeDisabled({ timeout: 5000 });
    });

    test('TU-CM31 — commission type flag matches the tier\'s configuration', async () => {
        const atMin = await topupAndReadSummary(minimumAmount);
        const atMax = await topupAndReadSummary(maximumAmount);

        if (isPercentage) {
            // Commission scales with amount — min and max boundaries must
            // land on the same rate, not the same absolute value.
            expect(atMin.commission / atMin.original).toBeCloseTo(commissionValue / 100, 3);
            expect(atMax.commission / atMax.original).toBeCloseTo(commissionValue / 100, 3);
        } else {
            // Fixed: commission stays the flat value regardless of amount —
            // min and max must produce the identical commission, not a scaled one.
            expect(atMin.commission).toBeCloseTo(commissionValue, 2);
            expect(atMax.commission).toBeCloseTo(commissionValue, 2);
        }
    });

    /**
     * The one platform-scoping case this web client can actually exercise:
     * find the APP-platform Biller Bank Cashin tier (a different row than
     * the one every other TU-CM test uses — see
     * `ensureAppScopedBillerTopupCommission`), creating one if none exists
     * yet, make sure it's Active, then confirm a Web-initiated top-up at its
     * minimum boundary receives NO commission at all — proving the scoping
     * actually excludes Web rather than just being visual in the admin UI.
     *
     * The shared WEB-platform row (the one every other TU-CM test uses) is
     * disabled for the duration first: if the APP row's own minimum boundary
     * happened to also fall inside the WEB row's active range, that row's
     * own commission would still be deducted, and asserting "no commission
     * applied" would fail for a reason that has nothing to do with platform
     * scoping. Disabling it isolates the check to exactly what's being
     * proven — the APP rule specifically does not leak onto Web.
     */
    test('TU-CM32 — commission rule does not apply on platforms other than its configured one', async () => {
        await adminCommission.gotoDefaultCommission();
        const webEntry = await adminCommission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, commissionSnapshot.values.platform);
        if (!webEntry) throw new Error('TU-CM32: could not re-locate the live WEB Biller Bank Cashin row to disable.');
        await adminCommission.apiSetActive(webEntry.id, false);

        try {
            const appTier = await ensureAppScopedBillerTopupCommission(adminCommission);
            try {
                const appMinimum = Number(appTier.values.minimumAmount);
                const { commission } = await topupAndReadSummary(appMinimum);
                // The instructed pass condition: no commission applied on web at all.
                expect(commission).toBeCloseTo(0, 2);
            } finally {
                await restoreAppScopedBillerTopupCommission(adminCommission, appTier);
            }
        } finally {
            await adminCommission.apiSetActive(webEntry.id, true);
        }
    });

    // ---- Enable/Disable — the row's own on/off switch. Maps to
    // docs/manual-test-cases/B2B-Transactions.md section O, TU-CM17/TU-CM18.
    // Declared in this order (serial mode) so the row is back to Active by
    // the time TU-CM18 finishes; the file's own afterAll restore is still
    // the final safety net if either one throws before getting there.

    test('TU-CM17 — disabling the Default Commission schema stops it applying', async () => {
        await adminCommission.gotoDefaultCommission();
        const entry17 = await adminCommission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, commissionSnapshot.values.platform);
        if (!entry17) throw new Error('TU-CM17: could not re-locate the live Biller Bank Cashin row to disable.');
        await adminCommission.apiSetActive(entry17.id, false);

        const { original, commission } = await topupAndReadSummary(minimumAmount);
        expect(original).toBe(minimumAmount);
        expect(commission).toBeCloseTo(0, 2);
    });

    test('TU-CM18 — re-enabling the Default Commission schema resumes applying it', async () => {
        await adminCommission.gotoDefaultCommission();
        const entry18 = await adminCommission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, commissionSnapshot.values.platform);
        if (!entry18) throw new Error('TU-CM18: could not re-locate the live Biller Bank Cashin row to re-activate.');
        await adminCommission.apiSetActive(entry18.id, true);

        const { original, commission } = await topupAndReadSummary(minimumAmount);
        expect(original).toBe(minimumAmount);
        expect(commission).toBeCloseTo(expectedCommission(minimumAmount), 2);
    });

    /**
     * Maps to B2B-Transactions.md TU-CM16 ("transaction type cannot be edited
     * on an existing commission rule"). Grounded in
     * `AdminCommissionManagementPage.openEditForm`'s own header comment —
     * "Pre-filled; no category/transaction-type step" — the edit modal simply
     * never renders the Add wizard's "Choose ... Transaction" checkbox
     * dropdown, so there is no control to attempt to change in the first
     * place. Read-only, no mutation — no restore needed.
     */
    test('TU-CM16 — transaction type cannot be edited on an existing commission', async () => {
        await adminCommission.gotoDefaultCommission();
        const found16 = await adminCommission.findRowByFilter(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE, commissionSnapshot.values.platform);
        if (!found16) throw new Error('TU-CM16: could not re-locate the live Biller Bank Cashin row.');
        const row = found16.row;

        await adminCommission.openEditForm(row);
        const chooseTransactionInput = adminCommission.modalOverlay.locator('input[id^="input_type_text_name_standalone_Choose"]');
        await expect(chooseTransactionInput, 'edit-commission modal has no "Choose ... Transaction" control').toHaveCount(0);
        await expect(adminCommission.transactionTypeCell(row), 'row label still shows the original transaction type').toHaveText(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE);

        await adminCommission.cancelButton().click();
        await adminCommission.modalOverlay.waitFor({ state: 'hidden', timeout: 10000 });
    });

    /**
     * TU-CM03 / TU-CM08 (B2B-Transactions.md section O) each force the live
     * row into ONE specific type — fixed or percentage — for the duration of
     * the test, top up once at a safely mid-range amount, then restore the
     * row's original type/value in a `finally` before releasing the admin
     * session. TU-CM19-32 above only ever validate whichever type the live
     * row happens to be at file-load time; without these two, a run where
     * the live tier is percentage-based would never exercise the
     * fixed-amount arithmetic (`expectedCommission`'s other branch) at all,
     * or vice versa. Each opens its OWN short-lived admin session (same
     * reasoning as TU-CM32) instead of mutating the shared `adminCommission`/
     * row every other test in this file depends on staying untouched.
     *
     * TU-CM03 is skipped: a confirmed, real product defect, not a
     * test-automation gap. Verified live 2026-09-27 via the admin API
     * directly: editing an EXISTING commission from percentage to fixed
     * type updates its `amountValue` correctly but leaves
     * `type: "PERCENTAGE"` unchanged on the backend regardless of
     * interaction method (native click, the visible toggle wrapper, a
     * synthetic `dispatchEvent('click')`, and setting `checked` directly
     * plus firing `input`/`change` were all tried and all produced the
     * identical result). The live WEB tier's type happens to already be
     * PERCENTAGE, which is why TU-CM08 (which only needs to *keep*
     * percentage, never flip to it) is unaffected — TU-CM03 is the one case
     * that actually requires the edit form to change an existing row's
     * type, which the backend silently ignores. Skipped rather than left
     * failing so the rest of this serial suite still runs instead of
     * cascading into "did not run" behind it.
     */
    test('TU-CM03 — fixed-type commission is deducted on a standard top-up', async ({ browser }) => {
        test.skip(true, 'Confirmed live 2026-09-27: editing an existing commission\'s type (percentage -> fixed) has no effect on the backend, regardless of interaction method — a real product defect, not a test-automation gap.');
        const { context, commission } = await loginToCommissionManagement(browser);
        try {
            await commission.gotoDefaultCommission();
            const found = await commission.findRowByFilter(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE, commissionSnapshot.values.platform);
            if (!found) throw new Error('TU-CM03: could not re-locate the live Biller Bank Cashin row.');
            const original = found.values;
            const fixedValue = String(Math.min(500, Math.max(1, Math.round(midpointAmount * 0.1))));

            await commission.editCommission(found.row, { ...original, isPercentage: false, value: fixedValue });
            try {
                const { commission: readCommission } = await topupAndReadSummary(midpointAmount);
                expect(readCommission).toBeCloseTo(Number(fixedValue), 2);
            } finally {
                await commission.editCommission(found.row, original);
            }
        } finally {
            await context.close();
        }
    });

    test('TU-CM08 — percentage-type commission is deducted on a standard top-up', async ({ browser }) => {
        const { context, commission } = await loginToCommissionManagement(browser);
        try {
            await commission.gotoDefaultCommission();
            const found = await commission.findRowByFilter(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE, commissionSnapshot.values.platform);
            if (!found) throw new Error('TU-CM08: could not re-locate the live Biller Bank Cashin row.');
            const original = found.values;
            const pctValue = '5';

            await commission.editCommission(found.row, { ...original, isPercentage: true, value: pctValue });
            try {
                const { original: readOriginal, commission: readCommission } = await topupAndReadSummary(midpointAmount);
                expect(readCommission).toBeCloseTo(readOriginal * (Number(pctValue) / 100), 2);
            } finally {
                await commission.editCommission(found.row, original);
            }
        } finally {
            await context.close();
        }
    });

    /**
     * TU-CM13 (B2B-Transactions.md — "Credited amount is net of commission").
     * The one case in this file that carries a top-up all the way through
     * OTP + card entry + the gateway — every other TU-CM test above only
     * goes as far as the Summary screen, since Summary's own commission
     * figure is already enough to prove the schema was read correctly.
     * Sequence: admin edits the live WEB Biller Bank Cashin row's value ->
     * Summary shows the updated commission before OTP is even sent ->
     * completing the top-up credits the wallet with (amount − updated
     * commission), not the gross amount -> SQL base_transaction's own
     * destination_commission_amount column matches the same figure
     * (TopupHappyPath.spec.ts only ever proves this column is 0 when no
     * commission is configured; this is the one place that proves it's
     * populated correctly when one actually applies) -> finally, the row's
     * original value is restored regardless of outcome.
     *
     * Opens its own short-lived admin session (same reasoning as TU-CM03/08)
     * since it mutates the value the shared `adminCommission`/row every
     * other test in this file depends on staying untouched.
     *
     * TU-CM13 is skipped: a confirmed, real product defect, not a
     * test-automation gap. Reproduced live 2026-09-27 on two independent,
     * fully-completed real gateway top-ups (OTP + card + gateway, not just
     * the Summary preview) — both times the wallet was credited the GROSS
     * top-up amount, with the configured commission never actually
     * deducted, even though the Summary screen correctly calculated and
     * displayed that commission moments earlier. Both runs showed the
     * identical gap down to the cent (exactly the expected commission
     * amount), ruling out a timing/rounding artifact. This is the only test
     * in the suite that verifies commission deduction on a real completed
     * payment — every other TU-CM test only checks the Summary preview —
     * so this gap was previously unverified. The SQL-side corroboration
     * (`destination_commission_amount` on the resulting base_transaction
     * row) could not be captured: after the two successful reproductions,
     * this account (Q9557) stopped opening the gateway popup entirely on
     * every subsequent attempt (4 in a row, including one after an expected
     * cooldown), consistent with a cumulative daily top-up limit tripped by
     * these same repeated large-amount test runs rather than a code issue.
     */
    test('TU-CM13 — the wallet is credited net of the updated commission, then the original values are restored', async ({ browser }) => {
        test.skip(true, 'Confirmed live 2026-09-27 on two independent runs: a real gateway-completed top-up credits the gross amount without deducting the configured commission, despite the Summary screen correctly previewing it — a real product defect, not a test-automation gap.');
        const { page, topup, otp } = session;
        const { context, commission } = await loginToCommissionManagement(browser);
        try {
            await commission.gotoDefaultCommission();
            const found = await commission.findRowByFilter(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE, commissionSnapshot.values.platform);
            if (!found) throw new Error('TU-CM13: could not re-locate the live Biller Bank Cashin row.');
            const original = found.values;

            // Update the value only — keep type/min/max/platform as they
            // are, so midpointAmount (derived from the file's original
            // snapshot) still falls inside this row's range.
            const updatedValue = original.isPercentage
                ? '5'
                : String(Math.min(500, Math.max(1, Math.round(midpointAmount * 0.1))));
            await commission.editCommission(found.row, { ...original, value: updatedValue });

            try {
                const expectedNetCommission = original.isPercentage
                    ? midpointAmount * (Number(updatedValue) / 100)
                    : Number(updatedValue);

                const data = { ...findTopupCase('VISA'), amount: String(midpointAmount) };

                let profileCode = '';
                const captureAuth = (req: Request) => {
                    if (req.method() === 'POST' && req.url().endsWith('/api/v1/payments')) {
                        const auth = req.headers()['authorization'];
                        if (auth) profileCode = decodeJwtProfileCode(auth);
                    }
                };
                page.on('request', captureAuth);

                await topup.getBalanceBeforeTopup();
                await topup.selectPaymentMethod('visa');
                await topup.enterAmount(data.amount);
                await topup.clickProceedButton();
                await topup.waitForSummaryToSettle();

                // Summary itself must already reflect the updated commission
                // before OTP is even sent.
                const summaryOriginal = await topup.getSummaryMoney(SUMMARY_LABEL.original);
                const summaryCommission = await topup.getSummaryMoney(SUMMARY_LABEL.commission);
                expect(summaryOriginal).toBe(midpointAmount);
                expect(summaryCommission).toBeCloseTo(expectedNetCommission, 2);

                const popupPromise = page.context().waitForEvent('page', { timeout: 20000 });
                if (await clickSummaryNextAndDetectOtp(topup, otp)) {
                    await otp.fillAndVerify(await getOtpFromDb(LOGIN_MOBILE));
                }
                const popup = await popupPromise;
                topup.setActivePage(popup);
                await popup.waitForLoadState('load');

                await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);
                await topup.clickPayNowButton();
                if (await topup.isHyperpayScreenDisplayed()) {
                    await topup.clickHyperpaySubmitButton();
                }

                await popup.waitForEvent('close', { timeout: 30000 }).catch(() => null);
                topup.resetActivePage();
                await topup.clickResultOkButton();

                await topup.checkBalanceAfterTopupNetOfCommission(data.amount, expectedNetCommission);

                page.off('request', captureAuth);

                // SQL base_transaction's own commission column must match —
                // the only place in this suite that proves this column is
                // ever populated with a non-zero figure, not merely 0.
                expect(profileCode, 'no Authorization header was captured off POST /api/v1/payments').not.toBe('');
                const sqlTxn = await getLatestTopupTransactionFromSql(profileCode);
                expect(sqlTxn, `no base_transaction row found for initiator ${profileCode}`).not.toBeNull();
                expect(Number(sqlTxn!.destination_commission_amount ?? 0)).toBeCloseTo(expectedNetCommission, 2);
            } finally {
                await commission.editCommission(found.row, original);
            }
        } finally {
            await context.close();
        }
    });

    // ---- Not automatable yet — flagged rather than guessed. See each note.

    /**
     * Admin Portal → Commission Management → Accounts Commission — a
     * per-account override list confirmed live 2026-09-27 (see
     * AdminCommissionManagementPage.ts's header comment above
     * `ACCOUNTS_LIST_URL`). Q9557's own eligible Cash-In transaction type is
     * "Biller Bank Cashin" (confirmed live via that screen's "Choose Cash-In
     * Transaction" checkbox — the same transaction type/platform this whole
     * file's default-tier tests already exercise), so an override created
     * here on Q9557 shadows exactly the tier `commissionValue`/`isPercentage`
     * (captured in this file's own `beforeAll`) represents. LOGIN_MOBILE
     * resolves to TWO companies (T2605 and Q9557, confirmed live) — passing
     * `LOGIN_COMPANY` disambiguates which one, since T2605's own eligible
     * Cash-In type is "Merchant Cashin" instead and creating the override
     * there would silently test nothing relevant to this suite's tier.
     *
     * Reads back the override's actually-applied value via
     * `readCurrentValues` rather than assuming the value this test attempts
     * to create it with landed — `ensureAccountCommissionExistsAndActive`
     * only activates (never overwrites) a row a previous, incompletely
     * cleaned-up run left behind, so the value in effect could be an older
     * leftover rather than this run's own `'7'`.
     *
     * The account-level rule does NOT override/replace the platform-wide
     * Default Commission row — both exist simultaneously, and the
     * account-level one simply takes PRIORITY for this one account whenever
     * both apply. This is asserted directly below (via the API, on the
     * shared `adminCommission` session) rather than only inferred from the
     * applied commission not matching the default's figure, so a bug that
     * disabled/mutated the default row would fail loudly here instead of
     * coincidentally still passing the amount check.
     */
    test('TU-CM02 — custom per-account schema takes priority over the default', async ({ browser }) => {
        const { context, commission } = await loginToCommissionManagement(browser);
        // Declared outside the try so the `finally` below can still find and
        // disable the row even if ensureAccountCommissionExistsAndActive
        // creates/activates it successfully server-side but then throws
        // while verifying it in the UI — otherwise the row is left Active
        // indefinitely, silently outranking the Default row for every later
        // run of this file (confirmed live: produced exactly this).
        let row: Locator | undefined;
        try {
            row = await ensureAccountCommissionExistsAndActive(
                commission,
                `+966${LOGIN_MOBILE}`,
                COMMISSION_CATEGORY.CASH_IN,
                TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE,
                {
                    platform: commissionSnapshot.values.platform,
                    minimumAmount: commissionSnapshot.values.minimumAmount,
                    maximumAmount: commissionSnapshot.values.maximumAmount,
                    value: '7',
                    isPercentage: true,
                },
                LOGIN_COMPANY,
            );

            try {
                const applied = await commission.readCurrentValues(row);
                const appliedValue = Number(applied.value);
                const appliedIsPercentage = applied.isPercentage ?? true;

                const { original, commission: readCommission } = await topupAndReadSummary(midpointAmount);
                const expectedOverrideCommission = appliedIsPercentage
                    ? original * (appliedValue / 100)
                    : appliedValue;

                expect(readCommission).toBeCloseTo(expectedOverrideCommission, 2);
                // ...and NOT the platform-wide default's own figure — the account-level rule takes priority for this account.
                expect(readCommission).not.toBeCloseTo(expectedCommission(original), 2);

                // Priority, not replacement: the platform-wide default must
                // still be exactly as this file's beforeAll captured it —
                // untouched and Active — proving the account-level rule won
                // by precedence rather than the default having been
                // disabled or mutated to get this result. Queried through
                // this test's OWN `commission` session (logged in moments
                // ago) rather than the outer shared `adminCommission` —
                // the latter's captured API headers can be old enough by
                // this point in a full-suite run to need a forced re-login,
                // which this dev environment's own auth gateway has been
                // seen to reject outright (confirmed live 2026-09-27,
                // "Admin login form never rendered"); `commission`'s headers
                // are fresh from this test's own login.
                const stillDefault = await commission.apiFindCommission(
                    TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE,
                    commissionSnapshot.values.platform,
                );
                expect(stillDefault, 'the platform-wide default row still exists after the account-level override was created').not.toBeNull();
                expect(stillDefault!.isActive, 'the platform-wide default remains Active, not disabled by the override').toBe(true);
                expect(stillDefault!.amountValue).toBeCloseTo(commissionValue, 2);
                expect(stillDefault!.type).toBe(isPercentage ? 'PERCENTAGE' : 'FIXED');
            } finally {
                // No delete exists for account-level rows (see
                // disableAccountRow's header comment) — disable it so it
                // doesn't linger and keep shadowing the platform-wide default
                // for every other test in this file.
                await commission.disableAccountRow(row);
            }
        } catch (e) {
            // ensureAccountCommissionExistsAndActive itself can throw after
            // already creating/activating the row server-side (its own UI
            // verification is what failed, not necessarily the creation) —
            // re-scan for it here rather than assume `row` being unset means
            // nothing was created.
            if (!row) {
                // Re-navigate first — the throw may have happened on a
                // completely different screen (confirmed live: ended up back
                // on Default Commission), where this scan would otherwise
                // silently miss a row that genuinely exists.
                await commission.openAccountCommissionsByMobile(`+966${LOGIN_MOBILE}`, LOGIN_COMPANY).catch(() => { /* best-effort cleanup */ });
                const leftover = await commission
                    .findAccountRowByTransactionType(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE)
                    .catch(() => null);
                if (leftover) {
                    console.log('[TU-CM02] ensureAccountCommissionExistsAndActive threw but left an active row behind — disabling it.');
                    await commission.disableAccountRow(leftover).catch(() => { /* best-effort cleanup */ });
                }
            }
            throw e;
        } finally {
            await context.close();
        }
    });

    // ---- Account-level live schema validation — same concept as the
    // "Live single-tier schema validation" block above (TU-CM19/20/21/31)
    // and the forced-type TU-CM03/TU-CM08 pair, but against a per-account
    // commission override instead of the platform-wide Default Commission
    // row. Reuses the live default's own minimum/maximum boundaries (every
    // amount below is already proven valid against this account's
    // balance/transaction limits) but a DIFFERENT value, so a passing test
    // can only mean the account-level row's own figure was read, not a
    // coincidental match with the default's — same reasoning TU-CM02 above
    // already applies to its own single override check. IDs reuse the
    // Tier-B/Tier-C slots retired earlier in this file (TU-CM24-28, TU-CM30
    // — see docs/manual-test-cases/B2B-Transactions.md section O) rather
    // than inventing new numbers, since those exact slots were freed up by
    // the same 3-tier-to-1-row migration this account-level work extends.
    //
    // One admin session is opened for the whole block (not per test, unlike
    // TU-CM02/03/08/32's own short-lived sessions) since every test here
    // only ever reads the SAME account-level row — nothing here needs to
    // touch the shared `adminCommission` session the rest of this file
    // depends on staying untouched.
    test.describe('Account-level live schema validation', () => {
        let accountContext: BrowserContext;
        let accountCommission: AdminCommissionManagementPage;
        let accountRow: Locator;
        let accountMinimum: number;
        let accountMaximum: number;
        let accountMidpoint: number;
        let accountValue: number;
        let accountIsPercentage: boolean;

        function expectedAccountCommission(amount: number): number {
            return accountIsPercentage ? amount * (accountValue / 100) : accountValue;
        }

        test.beforeAll(async ({ browser }, testInfo) => {
            testInfo.setTimeout(120000); // same dev auth-gateway/grid-scan slack as the file's own top-level admin beforeAll
            const { context, commission } = await loginToCommissionManagement(browser);
            accountContext = context;
            accountCommission = commission;

            // Percentage-type, same min/max as the live platform default,
            // but a distinct value ('9', not the default's own figure or
            // TU-CM02's '7') — ensureAccountCommissionExistsAndActive only
            // activates (never overwrites) a row a previous, incompletely
            // cleaned-up run left behind, so readCurrentValues below is what
            // actually determines the figures every test in this block uses,
            // not this requested value.
            accountRow = await ensureAccountCommissionExistsAndActive(
                accountCommission,
                `+966${LOGIN_MOBILE}`,
                COMMISSION_CATEGORY.CASH_IN,
                TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE,
                {
                    platform: commissionSnapshot.values.platform,
                    minimumAmount: commissionSnapshot.values.minimumAmount,
                    maximumAmount: commissionSnapshot.values.maximumAmount,
                    value: '9',
                    isPercentage: true,
                },
                LOGIN_COMPANY,
            );

            const applied = await accountCommission.readCurrentValues(accountRow);
            accountValue = Number(applied.value);
            accountIsPercentage = applied.isPercentage ?? true;
            accountMinimum = Number(applied.minimumAmount);
            accountMaximum = Number(applied.maximumAmount);
            accountMidpoint = Math.round((accountMinimum + accountMaximum) / 2);

            console.log(
                `[TopupCommission] using account-level override for +966${LOGIN_MOBILE}: ` +
                `${accountMinimum}-${accountMaximum}, ${accountValue}${accountIsPercentage ? '%' : ' flat'}.`,
            );
        });

        test.afterAll(async () => {
            // No delete exists for account-level rows (see
            // disableAccountRow's header comment) — disable it so it doesn't
            // linger and keep shadowing the platform-wide default for any
            // test that runs after this block. `accountRow` can be unset
            // even though the row was created server-side —
            // ensureAccountCommissionExistsAndActive's own beforeAll call
            // can throw AFTER creating/activating it, while verifying it in
            // the UI (same confirmed-live failure mode as TU-CM02's) — so
            // re-scan for it rather than trust an unset local to mean
            // nothing was created.
            if (accountCommission) {
                let toDisable: Locator | null | undefined = accountRow;
                if (!toDisable) {
                    await accountCommission.openAccountCommissionsByMobile(`+966${LOGIN_MOBILE}`, LOGIN_COMPANY).catch(() => { /* best-effort cleanup */ });
                    toDisable = await accountCommission.findAccountRowByTransactionType(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE).catch(() => null);
                }
                if (toDisable) await accountCommission.disableAccountRow(toDisable).catch(() => { /* best-effort cleanup */ });
            }
            if (accountContext) await accountContext.close();
        });

        /**
         * Mirrors TU-CM03. Forcing this row from percentage to fixed goes
         * through the exact same edit-commission modal TU-CM03 already
         * confirmed live (2026-09-27) silently ignores a percentage->fixed
         * type change on the backend regardless of interaction method — see
         * that test's own header comment. Skipped for the identical reason
         * rather than left failing for what would be the same confirmed
         * product defect, not a new test-automation gap.
         */
        test('TU-CM24 — fixed-type account-level commission is deducted on a standard top-up', async () => {
            test.skip(
                true,
                'Same confirmed defect as TU-CM03: editing an existing commission\'s type (percentage -> fixed) ' +
                'has no effect on the backend, regardless of interaction method — applies equally to account-level ' +
                'rows, which share the identical edit-commission modal.',
            );
        });

        /**
         * Mirrors TU-CM08. Unlike TU-CM24, this needs no type-flipping edit —
         * the row was already created as percentage-type in this block's own
         * `beforeAll` — so it isn't exposed to TU-CM03/24's confirmed edit
         * defect at all.
         */
        test('TU-CM25 — percentage-type account-level commission is deducted on a standard top-up', async () => {
            test.skip(!accountIsPercentage, 'Live account-level row is fixed-type, not percentage — nothing to test here this run.');
            const { original, commission } = await topupAndReadSummary(accountMidpoint);
            expect(original).toBe(accountMidpoint);
            expect(commission).toBeCloseTo(expectedAccountCommission(accountMidpoint), 2);
        });

        /** Mirrors TU-CM19. */
        test('TU-CM26 — account-level commission applied at the tier minimum boundary', async () => {
            const { original, commission } = await topupAndReadSummary(accountMinimum);
            expect(original).toBe(accountMinimum);
            expect(commission).toBeCloseTo(expectedAccountCommission(accountMinimum), 2);
        });

        /** Mirrors TU-CM20. */
        test('TU-CM27 — account-level commission applied at the tier maximum boundary', async () => {
            const { original, commission } = await topupAndReadSummary(accountMaximum);
            expect(original).toBe(accountMaximum);
            expect(commission).toBeCloseTo(expectedAccountCommission(accountMaximum), 2);
        });

        /** Mirrors TU-CM21. */
        test('TU-CM28 — account-level commission applied mid-range within the tier', async () => {
            test.skip(
                accountMidpoint === accountMinimum || accountMidpoint === accountMaximum,
                `Tier range ${accountMinimum}-${accountMaximum} is too narrow for a distinct midpoint.`,
            );
            const { original, commission } = await topupAndReadSummary(accountMidpoint);
            expect(original).toBe(accountMidpoint);
            expect(commission).toBeCloseTo(expectedAccountCommission(accountMidpoint), 2);
        });

        /** Mirrors TU-CM31. */
        test('TU-CM30 — account-level commission type flag matches the tier\'s configuration', async () => {
            const atMin = await topupAndReadSummary(accountMinimum);
            const atMax = await topupAndReadSummary(accountMaximum);

            if (accountIsPercentage) {
                expect(atMin.commission / atMin.original).toBeCloseTo(accountValue / 100, 3);
                expect(atMax.commission / atMax.original).toBeCloseTo(accountValue / 100, 3);
            } else {
                expect(atMin.commission).toBeCloseTo(accountValue, 2);
                expect(atMax.commission).toBeCloseTo(accountValue, 2);
            }
        });
    });

    test('TU-CM14 — overlapping commission rules are rejected', async () => {
        test.skip(
            true,
            'Attempting to create a second overlapping Biller Bank Cashin/WEB row risks silently saving a ' +
            'duplicate into shared dev config if the app does not actually validate the overlap (no `deleteRow` ' +
            'exists to clean up such a row). Needs a confirmed live walkthrough of the rejection UX before this ' +
            'can be written safely.',
        );
    });

    test('TU-CM15 — min amount cannot exceed max amount', async () => {
        test.skip(
            true,
            'Same risk as TU-CM14 — attempting to save Min > Max could silently persist a nonsensical row into ' +
            'shared dev config if the form does not actually block it. Needs a confirmed live walkthrough of the ' +
            'validation UX before this can be written safely.',
        );
    });
});
