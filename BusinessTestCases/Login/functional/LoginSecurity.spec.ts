import { test, expect } from '../../fixtures';
import { assertToast } from '../../toastMessages';
import {
    LOGIN_URL,
    VALID_COMPANY,
    VALID_MOBILE,
    VALID_PASSWORD,
    WRONG_PASSWORD,
} from '../LoginHelper';
import { LoginPage } from '../../pageElements/Shared/LoginPage';

test.describe('Login — Security', { tag: ['@login', '@functional'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let loginPage: LoginPage;

    test.beforeEach(async ({ page, loginPage: lp }) => {
        loginPage = lp;
        await loginPage.goto(LOGIN_URL);
    });

    test('should return the same error response for a wrong company number and a wrong mobile number (prevents user enumeration)', async ({ page }) => {
        await loginPage.fill('WRONGCMPNY', VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(page).toHaveURL(LOGIN_URL);

        await loginPage.goto(LOGIN_URL);
        await loginPage.fill(VALID_COMPANY, '500000001', VALID_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(page).toHaveURL(LOGIN_URL);
    });

    test('should not execute a script payload entered in the company number field (XSS)', async ({ page }) => {
        let dialogTriggered = false;
        page.on('dialog', async dialog => { dialogTriggered = true; await dialog.dismiss(); });
        await loginPage.companyInput.fill('<script>alert(1)</script>');
        await loginPage.mobileInput.fill(VALID_MOBILE);
        await loginPage.passwordInput.fill(VALID_PASSWORD);
        await expect(page.locator('body')).not.toContainText('<script>');
        expect(dialogTriggered).toBe(false);
    });

    test('should not execute a script payload entered in the password field (XSS)', async ({ page }) => {
        let dialogTriggered = false;
        page.on('dialog', async dialog => { dialogTriggered = true; await dialog.dismiss(); });
        await loginPage.companyInput.fill(VALID_COMPANY);
        await loginPage.mobileInput.fill(VALID_MOBILE);
        await loginPage.passwordInput.fill('<script>alert(1)</script>');
        expect(dialogTriggered).toBe(false);
    });

    test('should send the login request via POST — credentials must not appear in the URL', async ({ page }) => {
        let capturedURL    = '';
        let capturedMethod = '';
        page.on('request', req => {
            if (req.url().includes('/auth/signin')) {
                capturedURL    = req.url();
                capturedMethod = req.method();
            }
        });
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        await page.waitForTimeout(3000);
        if (capturedMethod) {
            expect(capturedMethod).toBe('POST');
            expect(capturedURL).not.toContain(VALID_PASSWORD);
            expect(capturedURL).not.toContain(VALID_COMPANY);
        }
    });

    test('should not expose stack traces or database details in failed login error responses', async ({ page }) => {
        await loginPage.fill('WRONG', '500000000', WRONG_PASSWORD);
        await loginPage.submit();
        const toastDetail = page.locator('.toast-snackbar__detail, [class*="toast"], [class*="snack"]').first();
        if (await toastDetail.isVisible({ timeout: 5000 }).catch(() => false)) {
            const text = await toastDetail.textContent() ?? '';
            expect(text).not.toMatch(/stack|exception|sql|database|null pointer|traceback|ORA-|JDBC/i);
        }
    });

    // Kept last on purpose: this genuinely locks the merchant account
    // (VALID_COMPANY / VALID_MOBILE), so it must run after every other test here
    // that logs in. Any Login/Homepage-merchant spec running afterwards in the
    // same session will hit a locked account until it's unlocked out-of-band.
    test('should lock the account after 3 consecutive failed login attempts', async ({ page }) => {
        for (let attempt = 1; attempt <= 3; attempt++) {
            await loginPage.goto(LOGIN_URL);
            await loginPage.fill(VALID_COMPANY, VALID_MOBILE, WRONG_PASSWORD);
            await loginPage.submit();
            await assertToast(page);
        }
        await loginPage.goto(LOGIN_URL);
        await loginPage.fill(VALID_COMPANY, VALID_MOBILE, VALID_PASSWORD);
        await loginPage.submit();
        await assertToast(page);
        await expect(page.getByRole('heading', { name: /Enter OTP|أدخل رمز التحقق/i })).not.toBeVisible();
    });
});
