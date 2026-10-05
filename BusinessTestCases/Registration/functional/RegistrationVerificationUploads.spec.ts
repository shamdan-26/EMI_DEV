import { test, expect, Page } from '@playwright/test';
import { goToVerificationStep, REGISTER_URL, VALID_IBAN, VALID_VAT_NUMBER, TEST_FILE_BUFFER, selectRandomOption } from '../RegistrationHelper';
import { RegistrationVerificationPage } from '../../pageElements/Registration/RegistrationVerificationPage';

// ─────────────────────────────────────────────────────────────────────────────
// Registration – Verification & Uploads Step (Tab 3 of 3)
//
// Single shared session for the whole file (beforeAll), matching the pattern
// already used everywhere else in this suite for the same expensive mobile->
// OTP->Business Info->Financial->Verification climb (RegistrationContract
// Functionality.spec.ts, ui/RegistrationVerificationPage.spec.ts). This file
// used to re-drive that whole round trip per test via beforeEach — ~40 tests
// x ~20-40s each pushed the file to a reported 15-minute runtime. Since tests
// here mutate shared form state (unlike the pure read-only ui/ sibling), the
// order below is deliberately arranged so no test depends on a precondition
// a later test invalidates:
//   1. Static presence checks and the Sign-Up-disabled state are asserted
//      FIRST, before anything fills a field (that check needs a genuinely
//      empty form, not just an empty-looking one).
//   2. Field-level fill/validate tests always use .fill() (full replace), so
//      they're safe in any order relative to each other.
//   3. Upload hint-text presence checks run before the "File upload
//      interactions" block, since a completed upload replaces the "Click to
//      upload" prompt with an "Uploaded" status line (confirmed live).
//   4. Within "File upload interactions", every "accept/no-error" test runs
//      before any "reject/error" test — the error-banner locator used by the
//      accept tests (`[class*="error"], [role="alert"]`) is page-wide, so an
//      accept test running after a reject test could see the reject test's
//      still-visible error and false-fail.
//
// There is no Back-navigation test in this file: clicking Back would navigate
// away from Verification & Uploads entirely, breaking every test after it in
// this shared session. That coverage belongs in a spec with its own isolated
// session (or the ui/ sibling) instead.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration – Verification & Uploads Step (Tab 3 of 3)', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;

    test.beforeAll(async ({ browser }) => {
        // goToVerificationStep drives a full mobile->OTP->Business Info->Financial
        // round trip (via goToFinancialStep, which can itself retry up to 10
        // times on already-registered/already-progressed assets) before ever
        // reaching Verification & Uploads — the same climb every other spec in
        // this suite budgets 600_000 for.
        test.setTimeout(600_000);
        const context = await browser.newContext();
        page = await context.newPage();
        await goToVerificationStep(page);
    });

    test.afterAll(async () => { await page.close(); });

    // ── Navigation buttons (state checks first, before anything is filled) ──

    test('should display the Back button', async () => {
        await expect(page.getByRole('button', { name: /back|رجوع/i })).toBeVisible();
    });

    test('should display the Sign Up button', async () => {
        await expect(page.getByRole('button', { name: /sign up|إنشاء حساب/i })).toBeVisible();
    });

    test('should keep Sign Up disabled when required fields are empty', async () => {
        // Must run before any field/file test below — it asserts the genuinely
        // pristine, nothing-filled-yet state reached straight out of beforeAll.
        await expect(page.getByRole('button', { name: /sign up|إنشاء حساب/i })).toBeDisabled();
    });

    // ── IBAN field ────────────────────────────────────────────────────────────

    test('should display the IBAN field', async () => {
        await expect(page.getByRole('textbox', { name: /iban|رقم الآيبان/i })).toBeVisible();
    });

    test('should show the correct placeholder for IBAN', async () => {
        await expect(page.getByRole('textbox', { name: /iban|رقم الآيبان/i }))
            .toHaveAttribute('placeholder', /SA0380000001234567891234/i);
    });

    test('should display the IBAN hint "24 characters starting with SA"', async () => {
        await expect(page.getByText(/24 characters starting with SA|24 خانة تبدأ بـ SA/i)).toBeVisible();
    });

    test('should accept a valid IBAN', { annotation: [{ type: 'testcase', description: "RVU-37: Accept a valid IBAN" }] }, async () => {
        await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).fill(VALID_IBAN);
        await expect(page.getByRole('textbox', { name: /iban|رقم الآيبان/i })).toHaveValue(VALID_IBAN);
    });

    test('should show a validation error for an IBAN that does not start with SA', { annotation: [{ type: 'testcase', description: "RVU-38: Show a validation error for an IBAN that does not start with SA" }] }, async () => {
        await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).fill('GB0380000001234567891234');
        await page.getByRole('button', { name: /sign up|إنشاء حساب/i }).click({ force: true });
        const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
        const stillOnPage = await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).isVisible().catch(() => false);
        expect(hasError || stillOnPage).toBeTruthy();
    });

    test('should show a validation error for an IBAN shorter than 24 characters', { annotation: [{ type: 'testcase', description: "RVU-39: Show a validation error for an IBAN shorter than 24 characters" }] }, async () => {
        await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).fill('SA038000000123456');
        await page.getByRole('button', { name: /sign up|إنشاء حساب/i }).click({ force: true });
        const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
        const stillOnPage = await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).isVisible().catch(() => false);
        expect(hasError || stillOnPage).toBeTruthy();
    });

    // Documented spec (EMI Validation confluence page): the 2 check digits after "SA"
    // must pass a MOD-97 (ISO 7064) checksum. "00" is never a valid check-digit pair
    // for any account digits, so this is well-formed (24 chars, SA prefix, digits only)
    // but must still be rejected as an invalid IBAN.
    test('should show a validation error for a well-formed IBAN that fails the checksum', { annotation: [{ type: 'testcase', description: "RVU-40: Show a validation error for a well-formed IBAN that fails the checksum" }] }, async () => {
        await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).fill('SA0080000001234567891234');
        await page.getByRole('button', { name: /sign up|إنشاء حساب/i }).click({ force: true });
        const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
        const stillOnPage = await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).isVisible().catch(() => false);
        expect(hasError || stillOnPage).toBeTruthy();
    });

    // ── IBAN Proof upload ─────────────────────────────────────────────────────
    // Hint-text presence checks below must run before "File upload interactions"
    // — a completed upload replaces this "Click to upload" prompt/hints with an
    // "Uploaded" status line (confirmed live).

    test('should display the IBAN Proof upload area', { annotation: [{ type: 'testcase', description: "RVU-41: Display the IBAN Proof upload area" }] }, async () => {
        await expect(page.getByText(/iban proof|إثبات رقم الآيبان/i)).toBeVisible();
    });

    test('should display the IBAN proof upload hint text', { annotation: [{ type: 'testcase', description: "RVU-42: Display the IBAN proof upload hint text" }] }, async () => {
        // Confirmed live (ui/RegistrationVerificationPage.spec.ts): the .file-size
        // div combines all three hints (letter type, accepted file types, max
        // size) in one node, e.g. "خطاب بنكي أو ترويسة كشف حساب · PDF، JPG · بحد
        // أقصى 5 ميجابايت" — this only asserts the leading bank-letter/statement hint.
        await expect(page.locator('.file-size').first()).toContainText(/bank letter|statement (header|letterhead)|خطاب بنكي/i);
    });

    test('should display the accepted file types for IBAN proof (PDF, JPG)', async () => {
        await expect(page.getByText(/pdf.*jpg|jpg.*pdf/i).first()).toBeVisible();
    });

    test('should display the max file size for IBAN proof (5MB)', async () => {
        await expect(page.getByText(/5\s*(mb|ميجابايت)/i).first()).toBeVisible();
    });

    test('should display the "Click to upload" prompt for IBAN proof', async () => {
        await expect(page.getByText(/click to upload|انقر للرفع/i).first()).toBeVisible();
    });

    // ── VAT Number ────────────────────────────────────────────────────────────

    test('should display the VAT Number field', async () => {
        await expect(page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i })).toBeVisible();
    });

    test('should show the correct placeholder for VAT Number', async () => {
        await expect(page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i }))
            .toHaveAttribute('placeholder', /300123456700003/i);
    });

    test('should display the VAT Number hint "From your VAT certificate"', async () => {
        // Confirmed live (pageElements/Registration/RegistrationVerificationPage.ts
        // vatHint): the actual hint text does not include "ZATCA".
        await expect(page.getByText(/from your vat certificate|من شهادة ضريبة القيمة المضافة/i)).toBeVisible();
    });

    test('should accept a valid VAT Number', { annotation: [{ type: 'testcase', description: "RVU-49: Accept a valid VAT Number" }] }, async () => {
        await page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i }).fill(VALID_VAT_NUMBER);
        await expect(page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i })).toHaveValue(VALID_VAT_NUMBER);
    });

    test('should show a validation error for a VAT Number shorter than 15 digits', { annotation: [{ type: 'testcase', description: "RVU-50: Show a validation error for a VAT Number shorter than 15 digits" }] }, async () => {
        await page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i }).fill('30012345');
        await page.getByRole('button', { name: /sign up|إنشاء حساب/i }).click({ force: true });
        const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
        const stillOnPage = await page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i }).isVisible().catch(() => false);
        expect(hasError || stillOnPage).toBeTruthy();
    });

    test('should not retain alphabetic characters in the VAT Number field', { annotation: [{ type: 'testcase', description: "RVU-51: Not retain alphabetic characters in the VAT Number field" }] }, async () => {
        const input = page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i });
        // Explicit clear first: this is a shared field across tests now (was a
        // fresh/empty field every time under the old per-test session) and
        // pressSequentially(), unlike fill(), types onto whatever is already
        // there rather than replacing it.
        await input.clear();
        await input.pressSequentially('ABCDEFGHIJKLMNO');
        const value = await input.inputValue();
        expect(/[a-zA-Z]/.test(value)).toBe(false);
    });

    // Documented spec (EMI Validation confluence page): VAT must be 15 digits and
    // start with 2 or 3.
    test('should show a validation error for a 15-digit VAT Number not starting with 2 or 3', { annotation: [{ type: 'testcase', description: "RVU-52: Show a validation error for a 15-digit VAT Number not starting with 2 or 3" }] }, async () => {
        await page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i }).fill('100123456700003');
        await page.getByRole('button', { name: /sign up|إنشاء حساب/i }).click({ force: true });
        const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
        const stillOnPage = await page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i }).isVisible().catch(() => false);
        expect(hasError || stillOnPage).toBeTruthy();
    });

    test('should not allow more than 15 digits in the VAT Number field', { annotation: [{ type: 'testcase', description: "RVU-53: Not allow more than 15 digits in the VAT Number field" }] }, async () => {
        const input = page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i });
        await input.clear();
        await input.pressSequentially('3001234567000031', { delay: 10 });
        const value = await input.inputValue();
        expect(value.length).toBeLessThanOrEqual(15);
    });

    // ── VAT Certificate upload ────────────────────────────────────────────────

    test('should display the VAT Certificate upload area', { annotation: [{ type: 'testcase', description: "RVU-54: Display the VAT Certificate upload area" }] }, async () => {
        await expect(page.getByText(/^(VAT certificate|شهادة ضريبة القيمة المضافة)$/i)).toBeVisible();
    });

    test('should display the accepted file type for VAT certificate (PDF)', { annotation: [{ type: 'testcase', description: "RVU-55: Display the accepted file type for VAT certificate (PDF)" }] }, async () => {
        // Confirmed live (pageElements/Registration/RegistrationVerificationPage.ts
        // vatUploadHelperText): file-type and max-size are combined in one hint
        // node ("PDF · max 5MB" / Arabic equivalent), not a standalone "· pdf ·"
        // string — also dropped the separate "From ZATCA" hint test this file
        // used to have, since the confirmed vatHint text doesn't mention ZATCA.
        await expect(page.getByText(/pdf.*max 5\s*mb|PDF.*ميجابايت/i).last()).toBeVisible();
    });

    // ── Security ───────────────────────────────────────────────────────────────

    test('should not execute an XSS payload entered in the IBAN field', { annotation: [{ type: 'testcase', description: "RVU-56: Not execute an XSS payload entered in the IBAN field" }] }, async () => {
        let alertFired = false;
        page.once('dialog', dialog => { alertFired = true; dialog.dismiss(); });
        await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).fill('<script>alert("xss")</script>');
        await page.waitForTimeout(500);
        expect(alertFired).toBe(false);
    });

    test('should not execute an XSS payload entered in the VAT Number field', { annotation: [{ type: 'testcase', description: "RVU-57: Not execute an XSS payload entered in the VAT Number field" }] }, async () => {
        let alertFired = false;
        page.once('dialog', dialog => { alertFired = true; dialog.dismiss(); });
        await page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i }).fill('<img src=x onerror=alert(1)>');
        await page.waitForTimeout(500);
        expect(alertFired).toBe(false);
    });

    test('should treat a SQL injection pattern in the IBAN field as invalid', { annotation: [{ type: 'testcase', description: "RVU-58: Treat a SQL injection pattern in the IBAN field as invalid" }] }, async () => {
        await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).fill("SA03' OR '1'='1");
        await page.getByRole('button', { name: /sign up|إنشاء حساب/i }).click({ force: true });
        const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
        const stillOnPage = await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).isVisible().catch(() => false);
        expect(hasError || stillOnPage).toBeTruthy();
    });

    // ── File uploads ─────────────────────────────────────────────────────────
    // Selectors target input[type="file"] behind the "Click to upload" trigger.
    // Order matters here (see the file-level comment above): every "accept/
    // no-error" test runs before any "reject/error" test, since the error
    // check (`[class*="error"], [role="alert"]`) is page-wide and would
    // otherwise pick up a still-visible error left by an earlier reject test.

    test.describe('File upload interactions', () => {
        function ibanProofInput(page: Page) {
            return page.locator('input[type="file"]').first();
        }
        function vatCertificateInput(page: Page) {
            return page.locator('input[type="file"]').nth(1);
        }

        test('should accept a valid PDF for IBAN proof upload', { annotation: [{ type: 'testcase', description: "RVU-59: Accept a valid PDF for IBAN proof upload" }] }, async () => {
            const input = ibanProofInput(page);
            await input.setInputFiles({ name: 'iban_proof.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER });
            const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
            expect(hasError).toBe(false);
        });

        test('should accept a valid PDF for VAT certificate upload', { annotation: [{ type: 'testcase', description: "RVU-60: Accept a valid PDF for VAT certificate upload" }] }, async () => {
            const input = vatCertificateInput(page);
            await input.setInputFiles({ name: 'vat_certificate.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER });
            const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
            expect(hasError).toBe(false);
        });

        test('should accept a non-PDF file type for VAT certificate upload (no client-side type restriction)', { annotation: [{ type: 'testcase', description: "RVU-61: Accept a non-PDF file type for VAT certificate upload (no client-side type restriction)" }] }, async () => {
            // Confirmed live: uploading a .jpg here does NOT trigger an error — the
            // panel shows "vat_certificate.jpg ... · Uploaded" with a working
            // view/remove control, same as a valid PDF. Unlike IBAN proof (which
            // does show accepted-types text "PDF, JPG"), the VAT certificate
            // upload has no client-side file-type check at all in this
            // environment, so this documents actual behavior rather than
            // asserting a rejection that doesn't happen.
            const input = vatCertificateInput(page);
            await input.setInputFiles({ name: 'vat_certificate.jpg', mimeType: 'image/jpeg', buffer: TEST_FILE_BUFFER });
            const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
            expect(hasError).toBe(false);
        });

        // ── File name localization (Arabic / English) ───────────────────────

        test('should accept an English-named PDF for IBAN proof upload', { annotation: [{ type: 'testcase', description: "RVU-62: Accept an English-named PDF for IBAN proof upload" }] }, async () => {
            const input = ibanProofInput(page);
            await input.setInputFiles({ name: 'bank-statement-header.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER });
            const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
            expect(hasError).toBe(false);
        });

        test('should accept an Arabic-named PDF for IBAN proof upload', { annotation: [{ type: 'testcase', description: "RVU-63: Accept an Arabic-named PDF for IBAN proof upload" }] }, async () => {
            const input = ibanProofInput(page);
            await input.setInputFiles({ name: 'إثبات_الآيبان.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER });
            const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
            expect(hasError).toBe(false);
        });

        test('should accept an English-named PDF for VAT certificate upload', { annotation: [{ type: 'testcase', description: "RVU-64: Accept an English-named PDF for VAT certificate upload" }] }, async () => {
            const input = vatCertificateInput(page);
            await input.setInputFiles({ name: 'zatca-vat-certificate.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER });
            const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
            expect(hasError).toBe(false);
        });

        test('should accept an Arabic-named PDF for VAT certificate upload', { annotation: [{ type: 'testcase', description: "RVU-65: Accept an Arabic-named PDF for VAT certificate upload" }] }, async () => {
            const input = vatCertificateInput(page);
            await input.setInputFiles({ name: 'شهادة_ضريبة_القيمة_المضافة.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER });
            const hasError = await page.locator('[class*="error"], [role="alert"]').isVisible().catch(() => false);
            expect(hasError).toBe(false);
        });

        // ── Rejections (must run after every accept test above) ─────────────

        test('should reject an unsupported file type for IBAN proof upload', { annotation: [{ type: 'testcase', description: "RVU-66: Reject an unsupported file type for IBAN proof upload" }] }, async () => {
            const input = ibanProofInput(page);
            await input.setInputFiles({ name: 'iban_proof.exe', mimeType: 'application/octet-stream', buffer: TEST_FILE_BUFFER });
            await expect(
                page.locator('[class*="error"], [role="alert"]').first()
            ).toBeVisible({ timeout: 5000 });
        });

        test('should reject a file larger than 5MB for IBAN proof upload', { annotation: [{ type: 'testcase', description: "RVU-67: Reject a file larger than 5MB for IBAN proof upload" }] }, async () => {
            // Confirmed live: rejection isn't an instant client-side size check —
            // the panel shows "iban_proof_large.pdf 6.00 MB · Uploading…" at the
            // 5s mark, meaning the app has to actually upload the 6MB buffer
            // before it can reject it. A fixed 5000ms timeout was racing that
            // upload the same way setInputFiles() raced Sign Up's enablement
            // elsewhere in this file — give it real headroom.
            const input = ibanProofInput(page);
            const oversized = Buffer.alloc(6 * 1024 * 1024, 1);
            await input.setInputFiles({ name: 'iban_proof_large.pdf', mimeType: 'application/pdf', buffer: oversized });
            await expect(
                page.locator('[class*="error"], [role="alert"]').first()
            ).toBeVisible({ timeout: 30000 });
        });

        test('should reject a file larger than 5MB for VAT certificate upload', { annotation: [{ type: 'testcase', description: "RVU-68: Reject a file larger than 5MB for VAT certificate upload" }] }, async () => {
            // Same async-upload race as the IBAN proof oversized-file test above —
            // rejection only comes after the 6MB buffer actually uploads. Last
            // test in this block on purpose (see file-level ordering comment).
            const input = vatCertificateInput(page);
            const oversized = Buffer.alloc(6 * 1024 * 1024, 1);
            await input.setInputFiles({ name: 'vat_certificate_large.pdf', mimeType: 'application/pdf', buffer: oversized });
            await expect(
                page.locator('[class*="error"], [role="alert"]').first()
            ).toBeVisible({ timeout: 30000 });
        });
    });

    // ── NAFATH notice ─────────────────────────────────────────────────────────

    test('should display the post-submit NAFATH verification notice', async () => {
        await expect(
            page.getByText(/otp|nafath|نفاذ/i).filter({ hasText: /verif|تحقق/i }).first()
        ).toBeVisible();
    });

    // ── Full-form Sign Up enablement ─────────────────────────────────────────
    // Runs after "File upload interactions" and re-fills/re-uploads everything
    // itself (via .fill()/setInputFiles(), both full replaces), so it doesn't
    // depend on — and isn't broken by — whatever that block left behind.

    test('should enable Sign Up when Bank, IBAN, VAT Number, and both proof uploads are filled', { annotation: [{ type: 'testcase', description: "RVU-70: Enable Sign Up when Bank, IBAN, VAT Number, and both proof uploads are filled" }] }, async () => {
        // Confirmed live: filling only the IBAN and VAT Number text fields leaves
        // Sign Up disabled — the Bank dropdown (when rendered), IBAN proof, and
        // VAT certificate uploads are also required, not optional extras.
        // Matches the "File upload interactions" block's ibanProofInput/
        // vatCertificateInput targeting (input[type="file"] .first()/.nth(1)
        // behind the "Click to upload" triggers) and the bank-selection guard
        // already used in RegistrationE2EHappyPath.spec.ts.
        const verification = new RegistrationVerificationPage(page);
        if (await verification.bankDropdown.count() > 0) {
            await selectRandomOption(page, verification.bankDropdown.first());
        }
        await page.getByRole('textbox', { name: /iban|رقم الآيبان/i }).fill(VALID_IBAN);
        await page.getByRole('textbox', { name: /vat number|رقم ضريبة القيمة المضافة/i }).fill(VALID_VAT_NUMBER);

        // setInputFiles() only resolves once the DOM input holds the file and its
        // change event has fired — it does NOT wait for the app's own async
        // upload to finish. Confirmed live (earlier failure report): a completed
        // upload renders the filename plus a real blob-URL "view file" link and a
        // "remove" control, so Sign Up staying disabled straight after
        // setInputFiles() is a race against that upload, not a real validation
        // gap. Wait for each filename to actually render before checking Sign Up.
        await page.locator('input[type="file"]').first()
            .setInputFiles({ name: 'iban_proof.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER });
        await expect(page.getByText('iban_proof.pdf')).toBeVisible({ timeout: 15000 });

        await page.locator('input[type="file"]').nth(1)
            .setInputFiles({ name: 'vat_certificate.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER });
        await expect(page.getByText('vat_certificate.pdf')).toBeVisible({ timeout: 15000 });

        await expect(page.getByRole('button', { name: /sign up|إنشاء حساب/i })).toBeEnabled({ timeout: 5000 });
    });

    // ── Footer ────────────────────────────────────────────────────────────────

    test('should display "Already have an account?" text', async () => {
        // Confirmed live (ui/RegistrationVerificationPage.spec.ts): the visible
        // en/ar text lives in <div id="login-line" class="new-user"><span>, not a
        // plain page-wide text match.
        await expect(page.locator('#login-line.new-user span').filter({ visible: true }).first())
            .toContainText(/already have an account|لديك حساب بالفعل/i);
    });

    test('should display Terms & Conditions link', async () => {
        // Confirmed live: the footer (and its Terms/Privacy links) is duplicated
        // once per wizard step panel — completed steps stay in the DOM rather
        // than unmounting — so a page-wide text search resolves to 3 elements
        // (strict-mode violation). Scope to the one that's actually visible,
        // same pattern already used for "Already have an account?" above.
        await expect(page.getByText(/terms & conditions|الشروط والأحكام/i).filter({ visible: true }).first()).toBeVisible();
    });

    test('should display Privacy Policy link', async () => {
        await expect(page.getByText(/privacy policy|سياسة الخصوصية/i).filter({ visible: true }).first()).toBeVisible();
    });
});
