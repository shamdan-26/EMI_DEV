import { test, expect } from '../../fixtures';
import {
    LOGIN_URL,
    LOGIN_COMPANY,
    LOGIN_MOBILE,
    VALID_PASSWORD,
    getOtpFromDb,
} from '../LoginHelper';
import { LoginPage } from '../../pageElements/Shared/LoginPage';
import { OtpPage } from '../../pageElements/Shared/OtpPage';

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — Navigation', { tag: ['@login', '@functional'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let loginPage: LoginPage;

    test.beforeEach(async ({ page, loginPage: lp }) => {
        loginPage = lp;
        await loginPage.goto(LOGIN_URL);
    });

    test('should navigate to the Forgot Password page when the link is clicked', async ({ page }) => {
        await loginPage.forgotPasswordLink.click();
        await expect(page).toHaveURL(/forgot-password/);
    });

    test('should navigate to the Sign Up page when the link is clicked', async ({ page }) => {
        await loginPage.signUpLink.click();
        await expect(page).not.toHaveURL(LOGIN_URL);
    });

    test('should navigate to a valid page when the logo link is clicked', async ({ page }) => {
        await loginPage.logoLink.click();
        await expect(page).toHaveURL(/majdpay\.com/, { timeout: 10000 });
    });

    test('should change the theme when the toggle is clicked', async ({ page }) => {
        const body = page.locator('body');
        const before = await body.getAttribute('class');
        await loginPage.themeToggle.click();
        const after = await body.getAttribute('class');
        expect(after).not.toEqual(before);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ALREADY AUTHENTICATED
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — Already Authenticated', { tag: ['@login', '@functional'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    // Establish a real authenticated session first — these tests assert what
    // happens when an already-logged-in user hits the login URL, so the login
    // is the precondition, not something to assume from a global session.json
    // (which only exists when DEV_SETUP_* is set and its login succeeded).
    test.beforeEach(async ({ page, loginPage: lp }) => {
        const loginPage = lp;
        await loginPage.goto(LOGIN_URL);
        await loginPage.fillAndSubmit(LOGIN_COMPANY, LOGIN_MOBILE, VALID_PASSWORD);

        const otp = new OtpPage(page);
        if (await otp.isVisible()) {
            await otp.fillAndVerify(await getOtpFromDb(LOGIN_MOBILE));
        }
        await page.waitForURL(url => !url.pathname.includes('/auth/'), { timeout: 30000 });
    });

    test('should redirect away from the login page when already logged in', async ({ page }) => {
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await expect(page).not.toHaveURL(/auth\/login/, { timeout: 10000 });
    });

    test('should not display the Log In button when already logged in', async ({ page }) => {
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await expect(page.getByRole('button', { name: /Log In|تسجيل الدخول/ })).not.toBeVisible({ timeout: 10000 });
    });
});
