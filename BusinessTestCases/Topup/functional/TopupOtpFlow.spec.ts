import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, reachOtpScreen, type TopupSession } from '../TopupHelper';

// OTP Flow — depth on the OTP screen's own input/button/countdown behavior,
// mirroring Login/functional/LoginOtpFlow.spec.ts's structure. Maps to
// docs/manual-test-cases/Topup.md section G (TUP-24, TUP-25, TUP-26, TUP-27,
// TUP-29) — all flagged there as "not yet documented"/gaps. TUP-22 (screen
// content) and TUP-28 (incorrect OTP rejected) are already covered by
// ui/TopupOtpUI.spec.ts and functional/TopupNegative.spec.ts respectively.
//
// Unlike Login's own OTP widget, Topup's auto-submits the moment its 6th
// digit is entered (see pageElements/Shared/OtpPage.ts's header comment on
// `verify()`) — there is no observable window where all 6 boxes are filled
// and Verify sits enabled-but-unclicked, so that specific Login-style case
// isn't mirrored here; every test below only ever fills 5 or fewer digits
// where that isn't what's being exercised.
//
// Split out from Happy Path / Negative / UI / Security / API — see
// TopupHelper.ts's shared setup (loginToTopup/gotoTopupScreen/reachOtpScreen).

test.describe('Topup – OTP Flow', () => {
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

    test('should display 6 OTP input boxes after confirming the Summary screen', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        await expect(otp.inputs).toHaveCount(6);
    });

    test('Verify stays disabled when OTP inputs are empty', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        await expect(otp.verifyButton).toBeDisabled();
    });

    test('Verify stays disabled when OTP inputs are partially filled', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        await otp.inputs.nth(0).fill('1');
        await otp.inputs.nth(1).fill('2');
        await expect(otp.verifyButton).toBeDisabled();
    });

    test('should not accept non-numeric characters in an OTP input', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        const input = otp.inputs.first();
        await input.pressSequentially('a');
        await expect(input).toHaveValue('');
    });

    test('should auto-advance focus to the next input when a digit is entered', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        await otp.inputs.nth(0).click();
        await otp.inputs.nth(0).press('1');
        await expect(otp.inputs.nth(1)).toBeFocused({ timeout: 3000 });
    });

    /** TUP-25 */
    test('resend stays disabled while the countdown is active', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        await expect(otp.resendButton).toBeDisabled();
        await expect(otp.countdownTimer).toBeVisible();
    });

    /**
     * TUP-24 — the manual doc only ever observed a single snapshot of the
     * countdown ("Code ends 00:51") and couldn't confirm it actually ticks
     * down in real time rather than being a static label. Two reads a few
     * seconds apart, strictly decreasing, is the minimal proof of that.
     */
    test('countdown timer actually counts down in real time', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        const first = await otp.getRemainingSeconds();
        expect(first).toBeGreaterThan(0);
        await session.page.waitForTimeout(3000);
        const second = await otp.getRemainingSeconds();
        expect(second).toBeLessThan(first);
    });

    /**
     * TUP-26. Doesn't assert that clicking Resend clears already-entered
     * digits — confirmed live 2026-09-27 that Topup's widget leaves them in
     * place (unlike Login's own OTP screen, which does clear them; there's
     * no claim either way in Topup.md itself, so this isn't treated as a
     * defect, just a confirmed difference not worth asserting on here).
     * What the doc does claim — "the timer restarts" — is what's checked
     * instead: the countdown jumping back up near its original starting
     * value, rather than continuing from 0.
     */
    test('resend enables after the countdown expires and restarts the timer', async () => {
        const { otp } = session;
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));
        const seconds = await otp.getRemainingSeconds() || 90;
        test.setTimeout((seconds + 30) * 1000);

        await expect(otp.resendButton).toBeEnabled({ timeout: (seconds + 5) * 1000 });
        await otp.resendButton.click();
        await expect
            .poll(() => otp.getRemainingSeconds(), {
                timeout: 10000,
                message: 'countdown never restarted after clicking Resend',
            })
            .toBeGreaterThan(seconds - 5);
    });

    /** TUP-29 */
    test('Cancel aborts the top-up, returns to the main form, and leaves the balance unchanged', async () => {
        const { topup, otp } = session;
        await topup.getBalanceBeforeTopup();
        await reachOtpScreen(session, 'visa', findTopupCase('VISA'));

        await otp.cancelButton.click();
        await expect(otp.inputs.first()).not.toBeVisible();
        await expect(topup.inputAmount).toBeVisible({ timeout: 15000 });
        await topup.checkBalanceRemainsUnchanged();
    });
});
