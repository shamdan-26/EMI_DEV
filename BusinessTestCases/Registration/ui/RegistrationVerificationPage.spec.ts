import { test, expect, Page } from '@playwright/test';
import { goToVerificationStep } from '../RegistrationHelper';
import { RegistrationVerificationPage } from '../../pageElements/Registration/RegistrationVerificationPage';

// ─────────────────────────────────────────────────────────────────────────────
// Pure element/text presence coverage for the Verification & Uploads step (Tab
// 3 of 3). Field-level validation, upload accept/reject behavior, and XSS/SQLi
// handling already live in functional/RegistrationVerificationUploads.spec.ts —
// this file only confirms the panel and its contents render, mirroring the
// read-only pattern in ui/RegistrationFinancialPage.spec.ts. None of these
// tests fill fields, upload files, or navigate away, so a single shared
// arrival (one beforeAll) is safe and avoids re-driving the full mobile->OTP->
// Business Info->Financial round trip per test.
//
// Bank dropdown and Commercial Registration upload are defined on
// RegistrationVerificationPage but not exercised anywhere in the current
// functional spec — same as the archived RegistrationVerificationAndDocuments
// spec's warning that this step's inner structure has drifted from what its
// locators assume, they're left out here rather than asserted on unverified.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration – Verification & Uploads Step (Tab 3 of 3) — read-only', { tag: ['@registration', '@ui'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let verification: RegistrationVerificationPage;

    test.beforeAll(async ({ browser }) => {
        // goToVerificationStep wraps goToFinancialStep, which can retry up to 10
        // times (already-registered / already-progressed assets), each attempt a
        // full mobile->OTP->Business Info round trip — same reasoning as the
        // Financial step's ui spec's 600_000.
        test.setTimeout(600_000);
        const context = await browser.newContext();
        page = await context.newPage();
        await goToVerificationStep(page);
        verification = new RegistrationVerificationPage(page);
    });

    test.afterAll(async () => { await page.close(); });

    // ── Header ────────────────────────────────────────────────────────────────

    test('should display the MJD Pay logo', async () => {
        await expect(verification.logoImage).toBeVisible();
    });

    test('should link the MJD Pay logo to the landing page', async () => {
        await expect(verification.logoLink).toHaveAttribute('href', /\/business\/landing/);
    });

    test('should display the EN language button', async () => {
        await expect(verification.enButton).toBeVisible();
    });

    test('should display the Arabic language button', async () => {
        await expect(verification.arabicButton).toBeVisible();
    });

    test('should display the Switch theme button', async () => {
        await expect(verification.themeToggle).toBeVisible();
    });

    // ── Step indicator ────────────────────────────────────────────────────────

    test('should show the Verification & Uploads step title', { annotation: [{ type: 'testcase', description: "RVU-06: Show the Verification & Uploads step title" }] }, async () => {
        await expect(verification.formTitle).toContainText(/verification|uploads|التحقق|المستندات/i);
    });

    test('should keep outer step 1 (Business Info) active while on Verification & Uploads', { annotation: [{ type: 'testcase', description: "RVU-07: Keep outer step 1 (Business Info) active while on Verification & Uploads" }] }, async () => {
        await expect(page.locator('.mp-step.is-active .mp-step-meta .mp-step-num')).toContainText('1');
    });

    test('should display all four outer step indicators', { annotation: [{ type: 'testcase', description: "RVU-08: Display all four outer step indicators" }] }, async () => {
        await expect(page.getByText(/business info|بيانات النشاط/i).first()).toBeVisible();
        await expect(page.getByText(/nafath|نَفاذ|نفاذ/i).first()).toBeVisible();
        await expect(page.getByText(/products|المنتجات/i).first()).toBeVisible();
        await expect(page.getByText(/contract|العقد/i).first()).toBeVisible();
    });

    // ── IBAN field ────────────────────────────────────────────────────────────

    test('should display the IBAN field', async () => {
        await expect(verification.ibanInput).toBeVisible();
    });

    test('should show the correct placeholder for IBAN', async () => {
        await expect(verification.ibanInput).toHaveAttribute('placeholder', /SA0380000001234567891234/i);
    });

    test('should display the IBAN hint "24 characters starting with SA"', async () => {
        await expect(verification.ibanHint).toBeVisible();
    });

    // ── IBAN Proof upload ─────────────────────────────────────────────────────

    test('should display the IBAN Proof upload label', { annotation: [{ type: 'testcase', description: "RVU-12: Display the IBAN Proof upload label" }] }, async () => {
        await expect(verification.ibanProofLabel).toBeVisible();
    });

    test('should display the "Click to upload" prompt for IBAN proof', async () => {
        await expect(verification.ibanUploadPrompt).toBeVisible();
    });

    test('should display the IBAN proof upload helper text', { annotation: [{ type: 'testcase', description: "RVU-14: Display the IBAN proof upload helper text" }] }, async () => {
        // Confirmed live: the .file-size div combines all three hints (letter
        // type, accepted file types, max size) in one node, e.g.
        // "خطاب بنكي أو ترويسة كشف حساب · PDF، JPG · بحد أقصى 5 ميجابايت" — this
        // test only asserts the leading bank-letter/statement hint.
        await expect(page.locator('.file-size').first()).toContainText(/bank letter|statement (header|letterhead)|خطاب بنكي/i);
    });

    test('should display the accepted file types for IBAN proof (PDF, JPG)', async () => {
        await expect(page.getByText(/pdf.*jpg|jpg.*pdf/i).first()).toBeVisible();
    });

    test('should display the max file size for IBAN proof (5MB)', async () => {
        await expect(page.getByText(/5\s*(mb|ميجابايت)/i).first()).toBeVisible();
    });

    // ── VAT Number ────────────────────────────────────────────────────────────

    test('should display the VAT Number field', async () => {
        await expect(verification.vatInput).toBeVisible();
    });

    test('should show the correct placeholder for VAT Number', async () => {
        await expect(verification.vatInput).toHaveAttribute('placeholder', /300123456700003/i);
    });

    test('should display the VAT Number hint "From your VAT certificate"', async () => {
        await expect(verification.vatHint).toBeVisible();
    });

    // ── VAT Certificate upload ────────────────────────────────────────────────

    test('should display the VAT Certificate upload label', { annotation: [{ type: 'testcase', description: "RVU-20: Display the VAT Certificate upload label" }] }, async () => {
        await expect(verification.vatCertLabel).toBeVisible();
    });

    test('should display the "Click to upload" prompt for VAT certificate', { annotation: [{ type: 'testcase', description: "RVU-21: Display the \"Click to upload\" prompt for VAT certificate" }] }, async () => {
        await expect(verification.vatUploadPrompt).toBeVisible();
    });

    test('should display the VAT certificate upload helper text', { annotation: [{ type: 'testcase', description: "RVU-22: Display the VAT certificate upload helper text" }] }, async () => {
        await expect(verification.vatUploadHelperText).toBeVisible();
    });

    // ── NAFATH notice ─────────────────────────────────────────────────────────

    test('should display the post-submit OTP/NAFATH verification notice', async () => {
        await expect(verification.otpNafathNotice).toBeVisible();
    });

    // ── Navigation buttons ────────────────────────────────────────────────────

    test('should display the Back button', async () => {
        await expect(verification.backButton).toBeVisible();
    });

    test('should display the Sign Up button', async () => {
        await expect(verification.signUpButton).toBeVisible();
    });

    test('should keep Sign Up disabled when required fields are empty', async () => {
        await expect(verification.signUpButton).toBeDisabled();
    });

    // ── Footer ────────────────────────────────────────────────────────────────

    test('should display "Already have an account?" text', async () => {
        await expect(page.locator('#login-line.new-user span').filter({ visible: true }).first())
            .toContainText(/already have an account|لديك حساب بالفعل/i);
    });

    test('should display the Log In link', async () => {
        await expect(verification.loginLink).toContainText(/log.?in|تسجيل الدخول/i);
    });

    test('should display Terms & Conditions reference', async () => {
        await expect(verification.footer).toContainText(/terms & conditions|الشروط والأحكام/i);
    });

    test('should display Privacy Policy reference', async () => {
        await expect(verification.footer).toContainText(/privacy policy|سياسة الخصوصية/i);
    });
});
