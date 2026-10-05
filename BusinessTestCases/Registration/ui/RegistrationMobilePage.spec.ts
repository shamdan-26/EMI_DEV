import { test, expect } from '../../fixtures';
import { REGISTER_URL } from '../RegistrationHelper';
import { RegistrationMobilePage } from '../../pageElements/Registration/RegistrationMobilePage';

test.describe('Registration - Mobile Number Page', { tag: ['@registration', '@ui'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let regPage: RegistrationMobilePage;

    test.beforeEach(async ({ page, registrationMobile }) => {
        regPage = registrationMobile;
        await regPage.goto(REGISTER_URL);
        await regPage.mobileInput.clear();
    });

    // ── Page load ─────────────────────────────────────────────────────────────

    test('should open the Registration URL', { annotation: [{ type: 'testcase', description: "RM-01: Open the Registration URL" }] }, async ({ page }) => {
        await expect(page).toHaveURL(REGISTER_URL);
    });

    test('should have the correct page title', { annotation: [{ type: 'testcase', description: "RM-02: Have the correct page title" }] }, async ({ page }) => {
        await expect(page).toHaveTitle('EMI - Business');
    });

    // ── Logo ──────────────────────────────────────────────────────────────────

    test('should display the MJD Pay logo', async () => {
        await expect(regPage.logoImage).toBeVisible();
    });

    test('should display the MJD Pay logo as a clickable link', { annotation: [{ type: 'testcase', description: "RM-04: Display the MJD Pay logo as a clickable link" }] }, async () => {
        await expect(regPage.logoLink).toBeVisible();
    });

    test('should navigate to a valid page when the logo link is clicked', { annotation: [{ type: 'testcase', description: "RM-05: Navigate to a valid page when the logo link is clicked" }] }, async ({ page }) => {
        await regPage.logoLink.click();
        await expect(page).toHaveURL(/majdpay\.com/, { timeout: 10000 });
    });

    // ── Language switcher ─────────────────────────────────────────────────────

    test('should display the EN language button', async () => {
        await expect(regPage.enButton).toBeVisible();
    });

    test('should not have EN as the active language by default', { annotation: [{ type: 'testcase', description: "RM-07: Not have EN as the active language by default" }] }, async () => {
        await expect(regPage.enButton).not.toHaveAttribute('aria-pressed', 'true');
    });

    test('should display the Arabic language button', async () => {
        await expect(regPage.arabicButton).toBeVisible();
    });

    test('should have Arabic as the active language by default', { annotation: [{ type: 'testcase', description: "RM-09: Have Arabic as the active language by default" }] }, async () => {
        await expect(regPage.arabicButton).toHaveAttribute('aria-pressed', 'true');
    });

    // ── Theme toggle ──────────────────────────────────────────────────────────

    test('should display the theme toggle button', async () => {
        await expect(regPage.themeToggle).toBeVisible();
    });

    test('should change the theme when the toggle is clicked', { annotation: [{ type: 'testcase', description: "RM-11: Change the theme when the toggle is clicked" }] }, async ({ page }) => {
        const body = page.locator('body');
        const before = await body.getAttribute('class');
        await regPage.themeToggle.click();
        const after = await body.getAttribute('class');
        expect(after).not.toEqual(before);
    });

    // ── Page content ──────────────────────────────────────────────────────────

    test('should display the "Create Account" eyebrow text', async () => {
        await expect(regPage.createAccountEyebrow).toBeVisible();
    });

    test('should display the "Enter Phone Number" heading', { annotation: [{ type: 'testcase', description: "RM-13: Display the \"Enter Phone Number\" heading" }] }, async ({ page }) => {
        await expect(regPage.enterPhoneHeading).toBeVisible();
    });

    test('should display the "Start your business registration" description', { annotation: [{ type: 'testcase', description: "RM-14: Display the \"Start your business registration\" description" }] }, async () => {
        await expect(regPage.startRegistrationDescription).toBeVisible();
    });

    // ── Mobile number field ───────────────────────────────────────────────────

    test('should display the Mobile number input', { annotation: [{ type: 'testcase', description: "RM-15: Display the Mobile number input" }] }, async () => {
        await expect(regPage.mobileInput).toBeVisible();
    });

    test('should have the correct placeholder for Mobile number', { annotation: [{ type: 'testcase', description: "RM-16: Have the correct placeholder for Mobile number" }] }, async () => {
        await expect(regPage.mobileInput).toHaveAttribute('placeholder', 'مثال: 522284484');
    });

    // ── Next button ───────────────────────────────────────────────────────────

    test('should display the Next button', async () => {
        await expect(regPage.nextButton).toBeVisible();
    });

    test('should have Next button disabled when Mobile number is empty', { annotation: [{ type: 'testcase', description: "RM-18: Have Next button disabled when Mobile number is empty" }] }, async () => {
        await expect(regPage.nextButton).toBeDisabled();
    });

    // ── Log In link ───────────────────────────────────────────────────────────
    test('should display the "Already have an account?" text', async ({ page }) => {
        await page.pause();
        await expect(regPage.alreadyHaveAccountText).toBeVisible();
    });

    test('should display the Log In link', async () => {
        await expect(regPage.loginLink).toBeVisible();
        await expect(regPage.loginLink).toHaveText('تسجيل الدخول');
    });
});
