import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, reachOtpScreen, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — the OTP step (TUP-22, docs/manual-test-cases/Topup.md section G).
// Assertions check visibility/non-emptiness or bilingual patterns rather than
// guessed Arabic copy — the app renders Arabic by default on dev. Shared setup:
// see TopupHelper.ts (loginToTopup / gotoTopupScreen / findTopupCase).

test.describe('Topup – UI – OTP screen', () => {
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

    /**
     * TUP-22 (docs/manual-test-cases/Topup.md section G) — six single-digit
     * OTP boxes plus Resend/Cancel controls. Doesn't assert exact copy for
     * the same reason as the rest of this file.
     */
    test('OTP screen shows 6 input boxes and Resend/Cancel controls', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));

        await expect(otp.inputs.first()).toBeVisible();
        await expect(otp.inputs).toHaveCount(6);
        await expect(otp.resendButton).toBeVisible();
        await expect(otp.cancelButton).toBeVisible();

        await otp.cancelButton.click().catch(() => { /* best-effort cleanup */ });
    });

    // Each test below sends a real OTP and skips itself when the top-up OTP is
    // switched off (see reachOtpScreen) — there is no OTP screen to test then.

    test('each OTP box accepts only a single digit', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));

        const first = otp.inputs.first();
        await first.pressSequentially('a');
        await expect(first).toHaveValue('');
        await first.pressSequentially('7');
        await expect(first).toHaveValue('7');
        await first.pressSequentially('9');
        await expect(first).toHaveValue(/^\d$/);

        await otp.cancelButton.click().catch(() => { /* best-effort cleanup */ });
    });

    test('typing digits moves focus to the next OTP box', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));

        await otp.inputs.first().pressSequentially('1');
        await expect(otp.inputs.nth(1)).toBeFocused();

        await otp.cancelButton.click().catch(() => { /* best-effort cleanup */ });
    });

    test('the Resend control is present and the boxes start empty', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));

        await expect(otp.resendButton).toBeVisible();
        for (let i = 0; i < 6; i++) {
            await expect(otp.inputs.nth(i)).toHaveValue('');
        }

        await otp.cancelButton.click().catch(() => { /* best-effort cleanup */ });
    });

    test('Cancel on the OTP screen closes it and returns to the Topup flow', async () => {
        const { page, topup, otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));

        await otp.cancelButton.click();
        await expect(otp.inputs.first()).toBeHidden({ timeout: 10000 });
        await expect(page).toHaveURL(/\/transfer\/top-up/);
        await expect(topup.pageTitle).toBeVisible();
    });
});
