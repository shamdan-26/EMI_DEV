import { test, expect } from '../../fixtures';
import { LOGIN_URL } from '../LoginHelper';
import { LoginPage } from '../../pageElements/Shared/LoginPage';

test.describe('Login Page', { tag: ['@login', '@ui'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let loginPage: LoginPage;

    test.beforeEach(async ({ page, loginPage: lp }) => {
        loginPage = lp;
        await loginPage.goto(LOGIN_URL);
    });

    // ── URL & title ───────────────────────────────────────────────────────────

    test('should open the login URL', async ({ page }) => {
        await expect(page).toHaveURL(LOGIN_URL);
    });

    test('should have the correct page title', async ({ page }) => {
        await expect(page).toHaveTitle('EMI - Business');
    });

    test('should display the login form container', async () => {
        await expect(loginPage.formBox).toBeVisible();
    });

    test('should display the Login eyebrow text', { annotation: [{ type: 'testcase', description: "LG-04: \"Login\" eyebrow text" }] }, async () => {
        await loginPage.useEnglish(); // UAT defaults to Arabic; assert English copy explicitly
        await expect(loginPage.formEyebrow).toHaveText('Login');
    });

    test('should display the Welcome heading', async () => {
        await loginPage.useEnglish();
        await expect(loginPage.formTitle).toHaveText('Welcome to MJD Pay');
    });

    test('should display the tagline description', async () => {
        await expect(loginPage.taglineText).toBeVisible();
    });

    // ── Logo ──────────────────────────────────────────────────────────────────

    test('should display the MJD Pay logo image', async () => {
        await expect(loginPage.logoImage).toBeVisible();
    });

    test('should display the MJD Pay logo as a clickable link', async () => {
        await expect(loginPage.logoLink).toBeVisible();
    });

    // ── Language switcher ─────────────────────────────────────────────────────

    test('should display the EN language button', async () => {
        await expect(loginPage.enButton).toBeVisible();
    });

    test('should not have EN as the active language by default', async () => {
        await expect(loginPage.enButton).not.toHaveAttribute('aria-pressed', 'true');
    });

    test('should display the Arabic language button', async () => {
        await expect(loginPage.arabicButton).toBeVisible();
    });

    test('should have Arabic as the active language by default', async () => {
        await expect(loginPage.arabicButton).toHaveAttribute('aria-pressed', 'true');
    });

    test('should activate the Arabic button when clicked', async () => {
        await loginPage.arabicButton.click();
        await expect(loginPage.arabicButton).toHaveAttribute('aria-pressed', 'true');
    });

    test('should switch back to EN when EN button is clicked after Arabic', async () => {
        await loginPage.arabicButton.click();
        await loginPage.enButton.click();
        await expect(loginPage.enButton).toHaveAttribute('aria-pressed', 'true');
    });

    // ── Theme toggle ──────────────────────────────────────────────────────────

    test('should display the theme toggle button', async () => {
        await expect(loginPage.themeToggle).toBeVisible();
    });

    // ── Company number field ──────────────────────────────────────────────────

    test('should display the Company Number label', async () => {
        await expect(loginPage.companyLabel).toBeVisible();
    });

    test('should display the Company number input as visible and enabled', async () => {
        await expect(loginPage.companyInput).toBeVisible();
        await expect(loginPage.companyInput).toBeEnabled();
    });

    test('should display the Company number input with the correct placeholder', async () => {
        // Placeholder is "Eg. Z9246" (en) / "مثال: Z9246" (ar) — assert the locale-stable
        // example token rather than the product-tweakable prefix.
        await expect(loginPage.companyInput).toHaveAttribute('placeholder', /Z9246/);
    });

    test('should display the clear button on the Company Number field when filled', async () => {
        await loginPage.companyInput.fill('A2316');
        await expect(loginPage.companyClearButton).toBeVisible();
    });

    test('should clear the Company Number field when the clear button is clicked', async () => {
        await loginPage.companyInput.fill('A2316');
        await loginPage.companyClearButton.click();
        await expect(loginPage.companyInput).toHaveValue('');
    });

    // ── Mobile number field ───────────────────────────────────────────────────

    test('should display the Mobile Number label', async () => {
        await expect(loginPage.mobileLabel).toBeVisible();
    });

    test('should display the country flag in the mobile number field', async () => {
        await expect(loginPage.countryFlag).toBeVisible();
    });

    test('should display the country code (+966)', async () => {
        await expect(loginPage.countryCode).toContainText('(+966)');
    });

    test('should display the Mobile number input as visible and enabled', async () => {
        await expect(loginPage.mobileInput).toBeVisible();
        await expect(loginPage.mobileInput).toBeEnabled();
    });

    // ── Password field ────────────────────────────────────────────────────────

    test('should display the Password label', async () => {
        await expect(loginPage.passwordLabel).toBeVisible();
    });

    test('should display the Password input masked by default', async () => {
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('should display the Show password toggle button', async () => {
        await expect(loginPage.showPasswordToggle).toBeVisible();
    });

    // ── Forgot Password ───────────────────────────────────────────────────────

    test('should display the Forgot Password link', async () => {
        await expect(loginPage.forgotPasswordLink).toBeVisible();
    });

    // ── Log In button ─────────────────────────────────────────────────────────

    test('should display the Log In button', async () => {
        await expect(loginPage.loginButton).toBeVisible();
    });

    test('should have the Log In button disabled on page load', { annotation: [{ type: 'testcase', description: "LG-29: Log In button disabled on load" }] }, async () => {
        await expect(loginPage.loginButton).toBeDisabled();
    });

    // ── Sign Up ───────────────────────────────────────────────────────────────

    test('should display the "New to MJD PAY?" text', async () => {
        await expect(loginPage.newToMjdText).toBeVisible();
    });

    test('should display the Sign Up link', async () => {
        await expect(loginPage.signUpLink).toBeVisible();
    });
});
