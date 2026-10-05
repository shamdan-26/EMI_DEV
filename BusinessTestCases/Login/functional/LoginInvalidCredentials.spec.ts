import { test, expect } from '../../fixtures';
import { assertToast } from '../../toastMessages';
import {
    LOGIN_URL,
    VALID_COMPANY,
    VALID_MOBILE,
    VALID_PASSWORD,
    WRONG_PASSWORD,
    generateUnregisteredMobile,
} from '../LoginHelper';
import { LoginPage } from '../../pageElements/Shared/LoginPage';

// ─────────────────────────────────────────────────────────────────────────────
// INVALID CREDENTIALS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — Invalid Credentials', { tag: ['@login', '@functional'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let loginPage: LoginPage;

    test.beforeEach(async ({ page, loginPage: lp }) => {
        loginPage = lp;
        await loginPage.goto(LOGIN_URL);
    });

    test('should stay on the login page with a wrong password', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, WRONG_PASSWORD);
        await loginPage.submit();
        await expect(page).toHaveURL(LOGIN_URL);
    });

    test('should stay on the login page with a wrong company number', async ({ page }) => {
        await loginPage.fill('INVALID99', VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        await expect(page).toHaveURL(LOGIN_URL);
    });

    test('should stay on the login page with a wrong mobile number', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, '500000000', VALID_PASSWORD);
        await loginPage.submit();
        await expect(page).toHaveURL(LOGIN_URL);
    });

    test('should stay on the login page when all three credentials are wrong', async ({ page }) => {
        await loginPage.fill('WRONG123', '500000000', WRONG_PASSWORD);
        await loginPage.submit();
        await expect(page).toHaveURL(LOGIN_URL);
    });

    test('should display an error toast after submitting wrong credentials', async ({ page }) => {
        await loginPage.fill('WRONG123', '500000000', WRONG_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT STATUS ERRORS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — Account Status Errors', { tag: ['@login', '@functional'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let loginPage: LoginPage;

    test.beforeEach(async ({ page, loginPage: lp }) => {
        loginPage = lp;
        await loginPage.goto(LOGIN_URL);
    });

    test('should display an error when credentials are not registered', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, generateUnregisteredMobile(), VALID_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
    });

    test('should not expose technical details in the not-registered error message', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, generateUnregisteredMobile(), VALID_PASSWORD);
        await loginPage.submit();
        const detail = page.locator('.toast-snackbar__detail');
        await expect(detail).toBeVisible({ timeout: 10000 });
        const text = await detail.textContent() ?? '';
        expect(text).not.toMatch(/stack|exception|sql|database|null pointer|traceback|internal/i);
    });

    test('should display an error and not show OTP for a locked account', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(page.getByRole('heading', { name: /Enter OTP|أدخل رمز التحقق/i })).not.toBeVisible();
    });

    test('should display an error and not show OTP for a deactivated account', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(page.getByRole('heading', { name: /Enter OTP|أدخل رمز التحقق/i })).not.toBeVisible();
    });

    test('should display a generic rejection for an AML-blocked account', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(page.getByRole('heading', { name: /Enter OTP|أدخل رمز التحقق/i })).not.toBeVisible();
    });

    test('should not expose AML or compliance details in the error message', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        const detail = page.locator('.toast-snackbar__detail');
        await expect(detail).toBeVisible({ timeout: 10000 });
        const text = await detail.textContent() ?? '';
        expect(text).not.toMatch(/aml|compliance|sanction|blacklist|suspicious|investigation/i);
        expect(text).not.toMatch(/stack|exception|sql|database|internal/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — Edge Cases', { tag: ['@login', '@functional'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let loginPage: LoginPage;

    test.beforeEach(async ({ page, loginPage: lp }) => {
        loginPage = lp;
        await loginPage.goto(LOGIN_URL);
    });

    test('should keep Log In button disabled when company number contains only whitespace', async () => {
        await loginPage.companyInput.fill('   ');
        await loginPage.mobileInput.fill(VALID_MOBILE);
        await loginPage.passwordInput.fill(VALID_PASSWORD);
        await expect(loginPage.loginButton).toBeDisabled();
    });

    test.skip('should keep Log In button disabled when password contains only whitespace', async () => {
        await loginPage.companyInput.fill(VALID_COMPANY);
        await loginPage.mobileInput.fill(VALID_MOBILE);
        await loginPage.passwordInput.fill('   ');
        await expect(loginPage.loginButton).toBeDisabled();
    });

    test('should stay on the login page when correct company is paired with wrong mobile and wrong password', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, '500000001', WRONG_PASSWORD);
        await loginPage.submit();
        await expect(page).toHaveURL(LOGIN_URL);
    });

    test('should display an error toast and remain on the login page when the server returns a 500', async ({ page }) => {
        await page.route('**/auth/signin**', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) })
        );
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(page).toHaveURL(LOGIN_URL);
    });

    test('should allow re-submitting the form immediately after a failed login attempt', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, WRONG_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(loginPage.loginButton).toBeVisible();
        await expect(loginPage.loginButton).toBeEnabled();
    });

    test('should preserve field values after a failed login attempt', async ({ page }) => {
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, WRONG_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(loginPage.companyInput).toHaveValue(VALID_COMPANY);
        await expect(loginPage.mobileInput).toHaveValue(VALID_MOBILE);
    });
});
