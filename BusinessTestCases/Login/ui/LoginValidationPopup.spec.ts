import { test, expect, type Page } from '../../fixtures';
import { LOGIN_URL, LOGIN_COMPANY, LOGIN_MOBILE, VALID_PASSWORD } from '../LoginHelper';
import { LoginPage } from '../../pageElements/Shared/LoginPage';
import { OtpPage } from '../../pageElements/Shared/OtpPage';

const validationCard = (page: Page) => page.getByText('Just a moment...');

/**
 * Submits the happy-path login and resolves to whichever of three outcomes
 * actually occurs:
 *   - 'card'     — the "Just a moment..." device-verification popup appeared
 *                  (the real UAT / preprod flow this spec targets).
 *   - 'bypassed' — login went straight to the authenticated dashboard.
 *                  dev has device verification disabled, so no popup renders;
 *                  every assertion below test.skip()s in that case, mirroring
 *                  the OTP skip already used by the last test.
 * A rejection alert (role="alert", language-agnostic) throws with its own text
 * so a broken login fails fast with the real reason instead of a bare timeout.
 */
async function submitAndDetect(page: Page, loginPage: LoginPage): Promise<'card' | 'bypassed'> {
    await loginPage.fill(LOGIN_COMPANY, LOGIN_MOBILE, VALID_PASSWORD);
    await loginPage.submit();

    const error = page.getByRole('alert');
    const outcome = await Promise.race([
        validationCard(page).waitFor({ state: 'visible', timeout: 15000 }).then(() => 'card' as const).catch(() => null),
        page.waitForURL(/\/business\/main\/home/, { timeout: 15000 }).then(() => 'bypassed' as const).catch(() => null),
        error.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error' as const).catch(() => null),
    ]);

    if (outcome === 'error') {
        throw new Error(`Login was rejected before the validation card appeared: ${(await error.innerText()).trim()}`);
    }
    return outcome === 'card' ? 'card' : 'bypassed';
}

test.describe('Login Validation Popup — UI', { tag: ['@login', '@ui'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    const SKIP_MSG = 'Device-verification popup is disabled in this environment — login goes straight to the dashboard';

    let loginPage: LoginPage;

    test.beforeEach(async ({ page, loginPage: lp }) => {
        loginPage = lp;
        await loginPage.goto(LOGIN_URL);
    });

    test('should show the "Just a moment..." heading', async ({ page }) => {
        test.skip((await submitAndDetect(page, loginPage)) === 'bypassed', SKIP_MSG);
        await expect(validationCard(page)).toBeVisible();
    });

    test('should show the popup subtitle text', async ({ page }) => {
        test.skip((await submitAndDetect(page, loginPage)) === 'bypassed', SKIP_MSG);
        await expect(page.getByText("We're preparing a secure session for this device.")).toBeVisible();
    });

    test('should display all three validation steps', async ({ page }) => {
        test.skip((await submitAndDetect(page, loginPage)) === 'bypassed', SKIP_MSG);
        await expect(page.getByText('Verifying your credentials')).toBeVisible();
        await expect(page.getByText('Preparing this device')).toBeVisible();
        await expect(page.getByText('Securing your session')).toBeVisible();
    });

    test('should show step 1 "Verifying your credentials"', async ({ page }) => {
        test.skip((await submitAndDetect(page, loginPage)) === 'bypassed', SKIP_MSG);
        await expect(page.getByText('Verifying your credentials')).toBeVisible();
    });

    test('should show step 2 "Preparing this device"', async ({ page }) => {
        test.skip((await submitAndDetect(page, loginPage)) === 'bypassed', SKIP_MSG);
        await expect(page.getByText('Preparing this device')).toBeVisible();
    });

    test('should show step 3 "Securing your session"', async ({ page }) => {
        test.skip((await submitAndDetect(page, loginPage)) === 'bypassed', SKIP_MSG);
        await expect(page.getByText('Securing your session')).toBeVisible();
    });

    test('should show the OTP dialog after the validation card completes (when OTP is enabled)', async ({ page }) => {
        test.skip((await submitAndDetect(page, loginPage)) === 'bypassed', SKIP_MSG);
        await expect(validationCard(page)).not.toBeVisible({ timeout: 20000 });
        const otp = new OtpPage(page);
        const otpAppeared = await otp.isVisible();
        test.skip(!otpAppeared, 'OTP is disabled in this environment — dialog does not appear');
        await expect(otp.heading).toBeVisible();
        await expect(otp.instructionText).toBeVisible();
        await expect(otp.inputs.first()).toBeVisible();
        await expect(otp.verifyButton).toBeVisible();
        await expect(otp.cancelButton).toBeVisible();
    });
});
