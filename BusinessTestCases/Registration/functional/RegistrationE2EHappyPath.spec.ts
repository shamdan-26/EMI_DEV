import { test, expect } from '@playwright/test';
import {
    goToVerificationStep,
    goToContractStep,
    selectRandomOption,
    getFullRegistrationDetailByMobileFromSql,
    getActivationNotificationFromMongo,
    VALID_IBAN,
    VALID_VAT_NUMBER,
    TEST_FILE_BUFFER,
} from '../RegistrationHelper';
import { RegistrationVerificationPage } from '../../pageElements/Registration/RegistrationVerificationPage';
import { RegistrationProductsPage } from '../../pageElements/Registration/RegistrationProductsPage';
import { RegistrationContractPage } from '../../pageElements/Registration/RegistrationContractPage';
import { AdminOtpConfigPage, createAdminContext } from '../../pageElements/Shared/AdminOtpConfigPage';
import { AdminBusinessAccountsPage } from '../../pageElements/UserManagement/AdminBusinessAccountsPage';
import { closeSqlPool } from '../../../support/sqlServerClient';
import { closeMongoClient } from '../../../support/mongoClient';

// ─────────────────────────────────────────────────────────────────────────────
// Full registration journey — one continuous run through every step reachable
// in automation: mobile entry → OTP → Business Info → Financial & Business →
// Verification & Uploads → Sign Up → NAFATH/Products → Contract.
//
// This complements the per-step ui/functional specs (which each jump straight
// to their step via helpers) by proving the whole chain works together in a
// single pass, and complements the API E2E flow (RegistrationAPIFlow.spec.ts)
// by proving the same journey through the real browser UI.
//
// Confirmed live (see RegistrationProductsFunctionality.spec.ts): Sign Up does
// not always land on the real NAFATH panel — in this environment it can land
// straight on Products instead, bypassing NAFATH entirely. The first test
// below races both outcomes rather than assuming NAFATH is the only one, so it
// only skips on a genuine dead end (neither panel appearing), not on the
// normal Products-bypass path.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration – Full E2E Happy Path (UI)', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.afterAll(async () => {
        await closeSqlPool();
        await closeMongoClient();
    });

    test('should complete Business Info, Financial & Business, and Verification & Uploads, then reach NAFATH or Products after Sign Up', { annotation: [{ type: 'testcase', description: "RE-01: Complete Business Info, Financial & Business, and Verification & Uploads, then reach NAFATH or Products after Sign Up" }] }, async ({ page, context }) => {
        test.setTimeout(180_000);

        // Mobile entry -> OTP -> Business Info -> Financial & Business -> Verification & Uploads
        await goToVerificationStep(page);
        const verification = new RegistrationVerificationPage(page);
        await expect(verification.ibanInput).toBeVisible({ timeout: 15000 });
        if (await verification.bankDropdown.count() > 0) {
            await selectRandomOption(page, verification.bankDropdown.first());
        }
        await verification.ibanInput.fill(VALID_IBAN);
        await verification.vatInput.fill(VALID_VAT_NUMBER);

        // Best-effort file uploads — selectors unverified against a live build (see
        // the same caveat in RegistrationVerificationUploads.spec.ts); Sign Up is
        // attempted regardless since existing coverage shows it enables from the
        // text fields alone.
        const ibanProofInput = page.locator('input[type="file"]').first();
        const vatCertInput   = page.locator('input[type="file"]').nth(1);
        if (await ibanProofInput.count() > 0) {
            await ibanProofInput.setInputFiles({ name: 'iban_proof.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER }).catch(() => {});
        }
        if (await vatCertInput.count() > 0) {
            await vatCertInput.setInputFiles({ name: 'vat_certificate.pdf', mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER }).catch(() => {});
        }

        await expect(verification.signUpButton).toBeEnabled({ timeout: 10000 });
        await verification.signUpButton.click();

        // Scoped to the Products step's own productCards element rather than
        // formSubTitle (.form-sub-title, shared by every wizard step's header —
        // see the RegistrationFinancialPage.spec.ts hook-timeout this pattern
        // caused in goToFinancialStep) or a raw page.getByText() text search
        // (ambiguous on this app: an Angular CDK a11y live-announcer duplicates
        // the same string elsewhere in the DOM, throwing a strict-mode violation
        // that Promise.race's .catch() below silently swallows as 'neither' even
        // when Products has clearly rendered).
        const products = new RegistrationProductsPage(page);
        const landedOn = await Promise.race([
            page.getByText(/nafath/i).first().waitFor({ state: 'visible', timeout: 30000 }).then(() => 'nafath' as const),
            products.productCards.first().waitFor({ state: 'visible', timeout: 30000 }).then(() => 'products' as const),
        ]).catch(() => 'neither' as const);

        expect(
            landedOn,
            'Neither NAFATH nor Products appeared after Sign Up — verify whether the IBAN proof / VAT certificate ' +
            'uploads are mandatory for submission to succeed in this environment before treating this as a regression.'
        ).not.toBe('neither');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Deepest automatable milestone: past NAFATH/Products and through to a
    // completed Contract submission. goToContractStep() (RegistrationHelper.ts)
    // drives the same chain as the test above via its own independent asset
    // cycling, including a real NAFATH panel when one is hit along the way
    // (its ~20s Verify countdown, EMI-4895/EMI-4937, is not a dead end — see
    // goToProductsStep's NAFATH handling). RegistrationContractFunctionality.spec.ts
    // covers the acknowledgement/submit interaction in isolation; this proves
    // it also works as the tail end of the full journey.
    // ─────────────────────────────────────────────────────────────────────────

    test('should reach Contract and complete submission after accepting the agreement', { annotation: [{ type: 'testcase', description: "RE-02: Reach Contract and complete submission after accepting the agreement" }] }, async ({ browser }) => {
        // Same worst-case math as RegistrationContractFunctionality.spec.ts's
        // beforeAll timeouts: goToContractStep can cycle up to 10 CITIZEN_ASSETS
        // attempts (~40-45s each) before this test's own body even starts, so
        // 300s isn't reliably enough headroom on top of the submission that follows.
        test.setTimeout(600_000);
        const context = await browser.newContext();
        const page = await context.newPage();

        const mobile = await goToContractStep(page);
        const contract = new RegistrationContractPage(page);

        await expect(contract.agreeCheckbox).toBeVisible({ timeout: 15000 });
        await contract.agreeCheckbox.check();
        await expect(contract.submitButton).toBeEnabled({ timeout: 10000 });
        await contract.submitButton.click();

        // Confirmed live 2026-09-27: this environment renders the post-submission
        // confirmation in Arabic — "تم استلام طلب التسجيل" ("Registration request
        // received") heading, "حسابك جاهز." ("Your account is ready.") body, and a
        // "سجل الدخول إلى حسابك" ("Log in to your account") button — not any of the
        // English guesses this previously matched on alone (which is why this test
        // read as failing/skippable before, despite registration actually
        // succeeding). Kept as a fallback in case an English-locale run ever hits
        // this same screen.
        const completed = await page.getByText(/تم استلام طلب التسجيل|حسابك جاهز|pending|review|success|thank you|congratulations/i).first()
            .waitFor({ state: 'visible', timeout: 30000 })
            .then(() => true)
            .catch(() => false);

        expect(
            completed,
            'No recognizable post-submission confirmation state appeared — verify the actual completion UI in ' +
            'this environment before treating this as a regression.'
        ).toBe(true);

        // DB-level proof, not just a UI confirmation screen: the account this
        // run's identity (`mobile`) produced is actually provisioned in
        // emi_profile, and carries the contract/product flags a completed
        // submission is supposed to set. Schema confirmed live 2026-09-27 —
        // see getFullRegistrationDetailByMobileFromSql's own header comment.
        // DB-level proof, not just a UI confirmation screen: the account this
        // run's identity (`mobile`) produced is actually provisioned in
        // emi_profile, and carries the contract/product flags a completed
        // submission is supposed to set. Schema confirmed live 2026-09-27 —
        // see getFullRegistrationDetailByMobileFromSql's own header comment.
        const detail = await getFullRegistrationDetailByMobileFromSql(mobile);
        expect(detail, `no emi_profile.profiles row exists for ${mobile} after a completed registration`).not.toBeNull();
        expect(detail!.is_active, 'the provisioned profile is Active').toBe(true);
        expect(detail!.is_approved, 'the provisioned profile is Approved').toBe(true);
        expect(detail!.is_contract_accepted, 'business_profile_registration_requests.is_contract_accepted').toBe(true);
        expect(detail!.is_product_assigned, 'business_profile_registration_requests.is_product_assigned').toBe(true);
        expect(detail!.crn, 'a CRN was recorded for this registration').not.toBeNull();

        // The app's own confirmation screen tells the user to check their
        // email for login credentials — this proves that notification was
        // actually dispatched (not just that the UI showed a success screen).
        // Doesn't assert `isSuccessfullySent` — confirmed live 2026-09-27 that
        // this dev environment's outbound SMTP can't reach smtp.gmail.com,
        // which is an infra fact independent of the registration flow itself
        // (see getActivationNotificationFromMongo's header comment). Logged
        // instead, so a real regression here is visible without making this
        // test flaky on infrastructure this suite can't fix.
        const notification = await getActivationNotificationFromMongo(detail!.profile_code);
        expect(notification, `no "User Activation" notification recorded for ${detail!.profile_code}`).not.toBeNull();
        expect(notification!.recipient).toBe(detail!.email);
        if (!notification!.isSuccessfullySent) {
            console.warn(
                `[RegistrationE2EHappyPath] Activation email for ${detail!.profile_code} was not delivered: ` +
                `${notification!.errorMessage ?? '(no errorMessage recorded)'}`,
            );
        }

        // Admin-side proof that the newly created account is actually
        // discoverable by the ops/support team, not just present in the DB.
        // Manage Users → Accounts → Business, filtered by Company Number
        // (RegistrationFullDetail.tenant_number) — NOT Mobile Number, whose
        // filter is confirmed broken on this screen (see
        // AdminBusinessAccountsPage.ts's header comment). A separate admin
        // browser context/session, since the admin SPA is a different app
        // from the merchant portal the rest of this test drives.
        expect(detail!.tenant_number, 'a Company Number (tenant_number) was assigned to the new account').toBeTruthy();
        const adminContext = await createAdminContext(browser);
        const adminPage = await adminContext.newPage();
        await new AdminOtpConfigPage(adminPage).login();
        const businessAccounts = new AdminBusinessAccountsPage(adminPage);
        await businessAccounts.gotoViaSidebar();
        await businessAccounts.expectAccountListed(detail!.tenant_number);
        await adminContext.close();

        await context.close();
    });
});
