import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, SUMMARY_LABEL, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — the Add Funds Summary step: rows, amounts, balance card, Cancel, reload and Back.
// Assertions check visibility/non-emptiness or bilingual patterns rather than
// guessed Arabic copy — the app renders Arabic by default on dev. Shared setup:
// see TopupHelper.ts (loginToTopup / gotoTopupScreen / findTopupCase).

test.describe('Topup – UI – Add Funds Summary (step 2)', { tag: ['@topup', '@ui'], annotation: [{ type: 'feature', description: 'Topup' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(150000);

    let session: TopupSession;

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser, TOPUP_UI_ACCOUNT);
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    test.beforeEach(async () => {
        await gotoTopupScreen(session);
    });

    // Runs even when the test fails, so the gateway popup never leaks into the next test.
    test.afterEach(async () => {
        for (const stray of session.page.context().pages()) {
            if (stray !== session.page) await stray.close().catch(() => { /* already closed */ });
        }
        session.topup.resetActivePage();
    });

    test('Summary screen shows Transaction Type, Payment Method, Original Amount, Commission, VAT, and Total rows', async () => {
        const { page, topup } = session;
        const data = findTopupCase('VISA');
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount(data.amount);
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();

        await expect(page.locator('.mp-sum-row')).toHaveCount(6);
        const original = await topup.getSummaryMoney(/^\s*(Original Amount|المبلغ الأصلي)\s*$/i);
        expect(original).toBe(Number(data.amount));

        await topup.clickSummaryCancelButton();
    });

    test('Summary shows its heading, balance card, all six rows, and Cancel/Next', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount(findTopupCase('VISA').amount);
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();

        await expect(topup.pageTitle).toHaveText(/ملخص إضافة الأموال|summary/i);
        await expect(topup.pageSubtitle).toBeVisible();
        await expect(topup.balanceAmount).toBeVisible();
        for (const label of Object.values(SUMMARY_LABEL)) {
            expect(await topup.getSummaryText(label)).not.toBe('');
        }
        await expect(topup.summaryCancelButton).toBeEnabled();
        await expect(topup.summaryNextButton).toBeEnabled();

        await topup.clickSummaryCancelButton();
        await expect(topup.inputAmount).toBeVisible();
    });

    // ───────────────────────── Add Funds Summary step ─────────────────────────
    // No ids/testids exist on the summary — rows are located by label text
    // (SUMMARY_LABEL) and amounts by `.money-amount`.

    async function reachSummary(method: 'mada' | 'visa' | 'master' = 'visa', amount = '50'): Promise<void> {
        const { topup } = session;
        await topup.selectPaymentMethod(method);
        await topup.enterAmount(amount);
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();
    }

    test('Summary subtitle is shown and the step stays on the same /transfer/top-up URL', async () => {
        const { topup, page } = session;
        await reachSummary();
        await expect(topup.pageSubtitle).toBeVisible();
        expect((await topup.pageSubtitle.innerText()).trim().length).toBeGreaterThan(0);
        await expect(page).toHaveURL(/\/transfer\/top-up/);
        await topup.clickSummaryCancelButton();
    });

    test('Summary keeps the balance card with QR and wallet-settings buttons', async () => {
        const { topup } = session;
        await reachSummary();
        await expect(topup.balanceCardLabel).toHaveText(/الرصيد الحالي|Current balance/i);
        await expect(topup.balanceAmount).toHaveText(/\d[\d,]*\.\d{2}/);
        await expect(topup.balanceWalletCode).toContainText(/[A-Z]{3}-[A-Z0-9-]+/);
        await expect(topup.balanceQrButton).toBeVisible();
        await expect(topup.balanceSettingsButton).toBeVisible();
        await topup.clickSummaryCancelButton();
    });

    test('Summary shows the transaction type and the selected payment method', async () => {
        const { topup } = session;
        await reachSummary('visa');
        expect((await topup.getSummaryText(SUMMARY_LABEL.txnType)).length).toBeGreaterThan(0);
        expect(await topup.getSummaryText(SUMMARY_LABEL.method)).toMatch(/visa|فيزا/i);
        await topup.clickSummaryCancelButton();
    });

    for (const [method, pattern] of [['mada', /mada|مدى/i], ['master', /master|ماستر/i]] as const) {
        test(`Summary Payment Method row reflects ${method.toUpperCase()}`, async () => {
            const { topup } = session;
            await reachSummary(method);
            expect(await topup.getSummaryText(SUMMARY_LABEL.method)).toMatch(pattern);
            await topup.clickSummaryCancelButton();
        });
    }

    test('Summary Original Amount equals the amount entered, and Commission/VAT are non-negative numbers', async () => {
        const { topup } = session;
        await reachSummary('visa', '50');
        expect(await topup.getSummaryMoney(SUMMARY_LABEL.original)).toBe(50);
        expect(await topup.getSummaryMoney(SUMMARY_LABEL.commission)).toBeGreaterThanOrEqual(0);
        expect(await topup.getSummaryMoney(SUMMARY_LABEL.vat)).toBeGreaterThanOrEqual(0);
        await topup.clickSummaryCancelButton();
    });

    test('Summary has exactly four .money-amount values (original, commission, VAT, total)', async () => {
        const { topup } = session;
        await reachSummary();
        await expect(topup.summaryMoneyAmounts).toHaveCount(4);
        await topup.clickSummaryCancelButton();
    });

    test('Summary Total is consistent with the fee and VAT shown', { annotation: [{ type: 'testcase', description: "TUP-17: Total row reads correctly" }] }, async () => {
        const { topup } = session;
        await reachSummary('visa', '1000');
        const original = await topup.getSummaryMoney(SUMMARY_LABEL.original);
        const fee      = await topup.getSummaryMoney(SUMMARY_LABEL.commission);
        const vat      = await topup.getSummaryMoney(SUMMARY_LABEL.vat);
        const total    = await topup.getSummaryMoney(SUMMARY_LABEL.total);
        // The formula is unconfirmed: "Total to receive" implies fees come OUT
        // of the amount, but the old label said "to be sent" (fees on top).
        // Accept either direction; reject anything else.
        const deducted = +(original - fee - vat).toFixed(2);
        const added    = +(original + fee + vat).toFixed(2);
        expect([deducted, added]).toContain(+total.toFixed(2));
        await topup.clickSummaryCancelButton();
    });

    // KNOWN BUG: the summary renders amounts without decimals ("50", "0")
    // while the balance card shows "0.00". Every amount should be 2dp.
    // Un-skip once the app formats summary amounts consistently.
    test.skip('Summary amounts are formatted with 2 decimals (0.00), matching the balance card', async () => {
        const { topup } = session;
        await reachSummary('visa', '50');
        await expect(topup.summaryMoneyAmounts).toHaveCount(4);
        for (let i = 0; i < 4; i++) {
            await expect(topup.summaryMoneyAmounts.nth(i)).toHaveText(/\d[\d,]*\.\d{2}/);
        }
        await topup.clickSummaryCancelButton();
    });

    // KNOWN BUG: the subtitle reads "راجع التفصيل قبل المتابعة إلى الدفع." —
    // "التفصيل" (singular) should be "التفاصيل" (details). Un-skip once fixed.
    test.skip('Summary subtitle uses the correct spelling "التفاصيل"', async () => {
        const { topup } = session;
        await reachSummary();
        await expect(topup.pageSubtitle).toContainText('التفاصيل');
        await expect(topup.pageSubtitle).not.toContainText('التفصيل');
        await topup.clickSummaryCancelButton();
    });

    // Cancel steps back to the previous step of the flow — the amount form.
    test('Summary action buttons: Cancel is secondary, Next is primary, both enabled', async () => {
        const { topup } = session;
        await reachSummary();
        await expect(topup.summaryCancelButton).toBeEnabled();
        await expect(topup.summaryCancelButton).toHaveClass(/btn-outline-primary/);
        await expect(topup.summaryNextButton).toBeEnabled();
        await expect(topup.summaryNextButton).toHaveClass(/btn-primary/);
        await topup.clickSummaryCancelButton();
    });

    test('Summary Cancel returns to the amount form', { annotation: [{ type: 'testcase', description: "TUP-20: Cancel returns without side effects" }] }, async () => {
        const { topup } = session;
        await reachSummary();
        await topup.clickSummaryCancelButton();
        await expect(topup.inputAmount).toBeVisible();
        await expect(topup.paymentMethodsGroup).toBeVisible();
        await expect(topup.summaryRows).toHaveCount(0);
    });

    test('Summary Cancel then re-Proceed shows the same amount again', { annotation: [{ type: 'testcase', description: "TUP-20: Cancel returns without side effects" }] }, async () => {
        const { topup } = session;
        await reachSummary('visa', '75');
        await topup.clickSummaryCancelButton();
        // Whether the form keeps or resets its values is unconfirmed — re-enter
        // so the check holds either way and only proves the flow is repeatable.
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount('75');
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();
        expect(await topup.getSummaryMoney(SUMMARY_LABEL.original)).toBe(75);
        await topup.clickSummaryCancelButton();
    });

    test('reloading on the Summary step does not break the page', async () => {
        const { topup, page } = session;
        await reachSummary();
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        // The step is not in the URL, so state is probably lost — accept the
        // form or the summary, but the page must render one of them.
        await expect(topup.pageTitle).toBeVisible({ timeout: 15000 });
        await expect(page).toHaveURL(/\/transfer\/top-up/);
    });

    // The Summary isn't a history entry of its own, so browser Back skips the
    // Topup steps entirely and returns to the homepage.
    test('browser Back from the Summary step returns to the homepage', async () => {
        const { page } = session;
        await reachSummary();
        await page.goBack();
        await expect(page).toHaveURL(/\/business\/main\/home/, { timeout: 15000 });
    });
});
