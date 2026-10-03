import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, reachCardEntryPopup, type TopupSession } from '../TopupHelper';

// UI — element presence on the main Topup form and the Summary screen. Text
// assertions deliberately check visibility/non-emptiness rather than exact
// copy: the app renders Arabic by default on dev (the same reason several
// English-hardcoded locators broke in TopupPage.ts — see that file's own
// comments), and the real Arabic strings for these particular labels haven't
// been confirmed live — asserting a guessed translation would repeat that
// mistake. Maps to docs/manual-test-cases/Topup.md sections A-C/F
// (TUP-03, TUP-05, TUP-08-11, TUP-15-16, TUP-17).
//
// Split out from Happy Path / Negative / Security / API — see
// TopupHelper.ts's shared setup (loginToTopup/gotoTopupScreen/findTopupCase).

test.describe('Topup – UI', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(150000);

    let session: TopupSession;

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser);
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    test.beforeEach(async () => {
        await gotoTopupScreen(session);
    });

    test('page title, subtitle, and balance card are visible with real content', async () => {
        const { topup } = session;
        await expect(topup.pageTitle).toBeVisible();
        expect((await topup.pageTitle.innerText()).trim().length).toBeGreaterThan(0);
        await expect(topup.pageSubtitle).toBeVisible();
        await expect(topup.balanceAmount).toContainText(/\d/);
        expect((await topup.balanceWalletCode.innerText()).trim().length).toBeGreaterThan(0);
    });

    test('MADA/VISA/MASTER are all present and mutually exclusive', async () => {
        const { topup } = session;
        await expect(topup.madaOption).toBeVisible();
        await expect(topup.visaOption).toBeVisible();
        await expect(topup.masterOption).toBeVisible();
        await expect(topup.paymentMethodOptions).toHaveCount(3);

        await topup.selectPaymentMethod('mada');
        await expect(topup.madaOption).toBeChecked();

        await topup.selectPaymentMethod('visa');
        await expect(topup.visaOption).toBeChecked();
        await expect(topup.madaOption).not.toBeChecked();
    });

    test('amount field shows a currency icon and Proceed stays disabled while empty', async () => {
        const { topup } = session;
        await expect(topup.amountCurrencyIcon).toBeVisible();
        await expect(topup.proceedButton).toBeDisabled();
    });

    test('each preset amount chip populates the amount field with its own value', async () => {
        const { page, topup } = session;
        const chipValues = [500, 1000, 2000, 5000, 10000];
        for (const value of chipValues) {
            const chip = page.getByTestId(`amount-chip-${value}`);
            await expect(chip).toBeVisible();
            await chip.click();
            // Formatting (e.g. "500" vs "500.00") isn't confirmed live — check
            // the numeric value parses to the chip's own amount, not the exact string.
            expect(Number(await topup.getAmountValue())).toBe(value);
        }
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

    /**
     * TUP-22 (docs/manual-test-cases/Topup.md section G) — six single-digit
     * OTP boxes plus Resend/Cancel controls. Doesn't assert exact copy for
     * the same reason as the rest of this file.
     */
    test('OTP screen shows 6 input boxes and Resend/Cancel controls', async () => {
        const { topup, otp } = session;
        const data = findTopupCase('VISA');
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount(data.amount);
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();
        await topup.clickSummaryNextButton();

        await expect(otp.inputs.first()).toBeVisible({ timeout: 15000 });
        await expect(otp.inputs).toHaveCount(6);
        await expect(otp.resendButton).toBeVisible();
        await expect(otp.cancelButton).toBeVisible();

        await otp.cancelButton.click().catch(() => { /* best-effort cleanup */ });
    });

    /**
     * TUP-31 (docs/manual-test-cases/Topup.md section H) — Card Number,
     * Expiry, Card Holder, CVV, and Pay Now are all present in the
     * card-entry popup. Doesn't complete a payment — only needs the popup's
     * fields to render.
     */
    test('gateway popup shows Card Number, Expiry, Card Holder, CVV, and Pay Now', async () => {
        const { topup } = session;
        const data = findTopupCase('VISA');
        const popup = await reachCardEntryPopup(session, 'visa', data);

        await expect(topup.cardNumberInput).toBeVisible({ timeout: 15000 });
        await expect(topup.expiryDateInput).toBeVisible();
        await expect(topup.cardHolderInput).toBeVisible();
        await expect(topup.cvvInput).toBeVisible();
        await expect(topup.payNowButton).toBeVisible();

        await popup.close();
        topup.resetActivePage();
    });
});
