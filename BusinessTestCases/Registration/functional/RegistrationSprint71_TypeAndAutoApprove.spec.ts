import { test, expect, Page } from '@playwright/test';
import { goToInfoStep, goToVerificationStep, nextCitizenAsset, REGISTER_URL, fillVerificationForm, mockFixedMerchantMode, mockAutoApprovedRegistration } from '../RegistrationHelper';
import { RegistrationInfoPage } from '../../pageElements/Registration/RegistrationInfoPage';

// ─────────────────────────────────────────────────────────────────────────────
// Business Registration & Onboarding — MOCK ONLY, section 13 of the Sprint 71
// test-case doc (EMI-5748, EMI-5768, EMI-5777).
//
// TC-REG-003/004 ("Admin can still deactivate/suspend an auto-approved
// profile") are Admin Portal actions with no page objects or UI surface in
// this Business Portal repo (CLAUDE.md scopes this suite to uat.majdpay.com/
// business/...) and are intentionally not covered here rather than guessed.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Registration — Fixed Merchant Sign-Up Mode (TC-REG-005, TC-REG-006)', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let info: RegistrationInfoPage;

    test.beforeAll(async ({ browser }) => {
        test.setTimeout(60_000);
        const context = await browser.newContext();
        page = await context.newPage();
        info = new RegistrationInfoPage(page);

        await mockFixedMerchantMode(page, true);
        const asset = nextCitizenAsset();
        await goToInfoStep(page, asset.mobile);
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('TC-REG-005: should hide the "Sign Up As" profile-type selector and show a static "Signing up as Merchant" label', { annotation: [{ type: 'testcase', description: "RE-03: Hide the \"Sign Up As\" profile-type selector and show a static \"Signing up as Merchant\" label (TC-REG-005)" }] }, async () => {
        await expect(info.fixedMerchantLabel).toBeVisible({ timeout: 15000 });
        await expect(info.profileTypeGroup).not.toBeVisible();
    });

    test('TC-REG-006: should not allow the profile type to be changed in fixed-Merchant mode', { annotation: [{ type: 'testcase', description: "RE-04: Not allow the profile type to be changed in fixed-Merchant mode (TC-REG-006)" }] }, async () => {
        await expect(info.billerCard).not.toBeVisible();
        await expect(info.customerCard).not.toBeVisible();
        await expect(info.freelancerCard).not.toBeVisible();
    });
});

test.describe('Registration — Fixed Merchant mode disabled (control)', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    test('should show the normal profile-type selector when fixed-Merchant mode is off', { annotation: [{ type: 'testcase', description: "RE-05: Show the normal profile-type selector when fixed-Merchant mode is off" }] }, async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const info = new RegistrationInfoPage(page);

        await mockFixedMerchantMode(page, false);
        const asset = nextCitizenAsset();
        await goToInfoStep(page, asset.mobile);

        await expect(info.profileTypeGroup).toBeVisible({ timeout: 15000 });
        await page.close();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-approval / auto-activation / activation email — these are consequences
// of the final "Sign Up" submission, which sits behind the same NAFATH
// automation boundary documented in RegistrationE2EHappyPath.spec.ts and
// RegistrationPoSOnboarding.spec.ts ("cannot be completed from CI"). These
// tests follow that file's same feature-detection + graceful-skip pattern;
// the registration submission response itself is mocked so the assertions
// are deterministic on the rare environment where NAFATH auto-bypasses.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Registration — Auto-Approval, Auto-Activation & Activation Email (TC-REG-001, TC-REG-002, TC-REG-007)', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    let page: Page;
    let signUpReached = false;

    test.beforeAll(async ({ browser }) => {
        test.setTimeout(180_000);
        const context = await browser.newContext();
        page = await context.newPage();

        await mockAutoApprovedRegistration(page);
        await goToVerificationStep(page);

        // Confirmed live (RegistrationVerificationUploads.spec.ts): Sign Up only
        // enables once the Bank dropdown (when rendered) *and* both file
        // uploads are filled, not just IBAN + VAT text — filling only the text
        // fields left Sign Up permanently disabled here, so this beforeAll
        // never actually reached submission and TC-REG-001/002/007 always
        // silently skipped. fillVerificationForm() fills all of it.
        await fillVerificationForm(page);

        // Confirmed live: the app defaults to Arabic, so the button's
        // accessible name is "إنشاء حساب", not "Sign Up" — an English-only
        // regex here would never match it.
        const signUpBtn = page.getByRole('button', { name: /sign up|إنشاء حساب/i });
        signUpReached = await signUpBtn.isEnabled({ timeout: 10000 }).catch(() => false);
        if (signUpReached) await signUpBtn.click();
    });

    test.afterAll(async () => {
        await page.close();
    });

    const SKIP_MSG = 'Sign Up submission could not be reached/completed automatically in this environment (NAFATH boundary)';

    // NOTE: the text assertions below (approved/active/activation-email) are
    // English-only, and this app defaults to Arabic everywhere else in this
    // suite — the actual post-submission text is very likely Arabic too. Left
    // as-is rather than guessing a translation: this session repeatedly hit
    // wrong-guessed Arabic wording elsewhere (e.g. النَفاذ diacritics, "أدخل
    // رقم الهاتف" vs the real "أدخل رقم الجوال"), always fixed only once a
    // live snapshot confirmed the real text. Confirm live before trusting
    // these three assertions.

    test('TC-REG-001: should reflect automatic approval without a manual admin step', { annotation: [{ type: 'testcase', description: "RE-06: Reflect automatic approval without a manual admin step (TC-REG-001)" }] }, async () => {
        test.skip(!signUpReached, SKIP_MSG);
        await expect(page.getByText(/approved|active/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/pending review|awaiting approval/i)).not.toBeVisible();
    });

    test('TC-REG-002: should reflect the profile as immediately active for operations', { annotation: [{ type: 'testcase', description: "RE-07: Reflect the profile as immediately active for operations (TC-REG-002)" }] }, async () => {
        test.skip(!signUpReached, SKIP_MSG);
        await expect(page.getByText(/active/i).first()).toBeVisible({ timeout: 20000 });
    });

    test('TC-REG-007: should show confirmation that the activation email was sent', { annotation: [{ type: 'testcase', description: "RE-08: Show confirmation that the activation email was sent (TC-REG-007)" }] }, async () => {
        test.skip(!signUpReached, SKIP_MSG);
        await expect(page.getByText(/email.*sent|check your email|activation email/i).first()).toBeVisible({ timeout: 20000 });
    });
});
