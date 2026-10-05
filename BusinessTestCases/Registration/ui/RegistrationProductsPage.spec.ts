import { test, expect, Page } from '@playwright/test';
import { goToProductsStep } from '../RegistrationHelper';
import { RegistrationProductsPage } from '../../pageElements/Registration/RegistrationProductsPage';

// ─────────────────────────────────────────────────────────────────────────────
// Products Step UI (step 3 of 4) — element/text presence only, per a live DOM
// extraction against dev.majdpay.com/business/auth/register. The app defaults
// to Arabic, so every text assertion here matches EN|AR rather than assuming
// English.
//
// The PoS device-request onboarding sub-flow (EMI-5783: expanding the PoS
// card, Devices & Delivery, Review, order-ready state) is a separate, deeper
// flow and lives in RegistrationProductsPoSSetup.spec.ts — this file only
// covers what's visible on arrival at the Products step itself.
//
// Reaches the Products step via goToProductsStep() (RegistrationHelper.ts),
// which cycles the shared, reused CITIZEN_ASSETS pool whenever a mobile
// resumes past Products (Contract) instead of landing on Products, and clicks
// through the real NAFATH panel's Verify button (after its ~20s redirect
// countdown expires — EMI-4895/EMI-4937) when that appears instead.
//
// This file and RegistrationProductsPoSSetup.spec.ts each pay the full
// goToProductsStep() climb independently in their own beforeAll rather than
// sharing one session — a deliberate trade-off, not an oversight. Persisting
// storageState from this file for the other to reuse would race against it:
// playwright.config.ts runs with fullyParallel: true across up to 5 workers,
// so there's no guarantee this file's beforeAll finishes (or even runs on the
// same worker) before the other file's beforeAll starts.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration - Products Step UI (Page Elements)', { tag: ['@registration', '@ui'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let products: RegistrationProductsPage;

    test.beforeAll(async ({ browser }) => {
        test.setTimeout(600_000);
        const context = await browser.newContext();
        page = await context.newPage();
        products = new RegistrationProductsPage(page);

        const reachedProducts = await goToProductsStep(page);
        if (!reachedProducts) {
            throw new Error(
                'Registration never reached the Products step after cycling the shared ' +
                'CITIZEN_ASSETS pool and completing the real NAFATH Verify step wherever ' +
                'it appeared — every asset resumed past Products (Contract) instead.'
            );
        }
    });

    test.afterAll(async () => { await page.close(); });

    // ── Header / Banner ───────────────────────────────────────────────────

    test('should display the MJD Pay logo', async () => {
        await expect(products.logoImage).toBeVisible();
    });

    test('should link the MJD Pay logo to the landing page', async () => {
        await expect(products.logoLink).toHaveAttribute('href', '/business/landing');
    });

    test('should display the EN language button', async () => {
        await expect(products.enButton).toBeVisible();
    });

    test('should display the Arabic language button', async () => {
        await expect(products.arabicButton).toBeVisible();
    });

    test('should display the theme toggle button', async () => {
        await expect(products.themeToggle).toBeVisible();
    });

    // ── Page headings ─────────────────────────────────────────────────────

    test('should display the "Setup" eyebrow text', { annotation: [{ type: 'testcase', description: "RP-06: Display the \"Setup\" eyebrow text" }] }, async () => {
        // Correction: an earlier version of this test asserted "Create Account"
        // (إنشاء حساب) here, reasoning .form-eyebrow was shared across every
        // step — that was a misdiagnosis. The real cause of that failure was
        // goToProductsStep landing back on Business Info instead of Products
        // (fixed separately: the productCards race + retry-loop bugs in
        // RegistrationHelper.ts). Now that the session genuinely reaches
        // Products, its eyebrow correctly and distinctly reads "إعداد" (Setup)
        // — Business Info/Financial/Verification show "Create Account", while
        // Products/Contract (the setup-your-account phase) show "Setup".
        await expect(products.formEyebrow).toContainText(/setup|إعداد/i);
    });

    test('should display the "Products" title', { annotation: [{ type: 'testcase', description: "RP-07: Display the \"Products\" title" }] }, async () => {
        await expect(products.formTitle).toContainText(/products|المنتجات/i);
    });

    test('should display the products-selection subtitle', { annotation: [{ type: 'testcase', description: "RP-08: Display the products-selection subtitle" }] }, async () => {
        await expect(products.formSubTitle).toContainText(/choose the products|اختر المنتجات/i);
    });

    // ── Outer progress bar ───────────────────────────────────────────────

    test('should display all four outer step labels: Business Info, NAFATH, Products, Contract', async () => {
        await expect(products.outerStepBar.filter({ hasText: /business info|بيانات النشاط/i })).toBeVisible();
        await expect(products.outerStepBar.filter({ hasText: /nafath|نَفاذ|نفاذ/i })).toBeVisible();
        await expect(products.outerStepBar.filter({ hasText: /products|المنتجات/i })).toBeVisible();
        await expect(products.outerStepBar.filter({ hasText: /contract|العقد/i })).toBeVisible();
    });

    test('should show "Products" as the active outer step', { annotation: [{ type: 'testcase', description: "RP-10: Show \"Products\" as the active outer step" }] }, async () => {
        await expect(products.activeStep.first()).toContainText(/products|المنتجات/i);
    });

    // ── Product cards ─────────────────────────────────────────────────────

    test('should display at least one product card', { annotation: [{ type: 'testcase', description: "RP-11: Display at least one product card" }] }, async () => {
        await expect(products.productCards.first()).toBeVisible();
    });

    test('should display the required Wallet card', { annotation: [{ type: 'testcase', description: "RP-12: Display the required Wallet card" }] }, async () => {
        await expect(products.walletCard()).toBeVisible();
    });

    test('should show a "Show more" link on the Wallet card', { annotation: [{ type: 'testcase', description: "RP-13: Show a \"Show more\" link on the Wallet card" }] }, async () => {
        const wallet = products.walletCard();
        await expect(products.showMoreLink(wallet)).toBeVisible();
    });

    test('should show a price/billing label on every visible product card', { annotation: [{ type: 'testcase', description: "RP-14: Show a price/billing label on every visible product card" }] }, async () => {
        const count = await products.productCards.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
            await expect(products.productCards.nth(i))
                .toContainText(/free|مجاني|ريال|sar|per_transaction|monthly|annual/i);
        }
    });

    // ── Footer ────────────────────────────────────────────────────────────

    test('should display the selection counter', { annotation: [{ type: 'testcase', description: "RP-15: Display the selection counter" }] }, async () => {
        await expect(products.selectedCounter).toBeVisible();
    });

    test('should show a non-zero count in the selection counter on arrival', { annotation: [{ type: 'testcase', description: "RP-16: Show a non-zero count in the selection counter on arrival" }] }, async () => {
        // Not hardcoding the exact "N Selected" text — RegistrationProductsFunctionality.spec.ts
        // confirms "1 Selected" live, but that's against a different environment/catalog than
        // this file's dev.majdpay.com target. A required, non-deselectable product (walletCard())
        // is always present per the page object's own docstring, so the counter should always
        // read at least 1 on arrival regardless of exact catalog contents.
        await expect(products.selectedCounter).toContainText(/[1-9]\d*/);
    });

    test('should display the Cancel button', async () => {
        await expect(products.cancelButton).toBeVisible();
    });

    test('should display the Continue button', { annotation: [{ type: 'testcase', description: "RP-18: Display the Continue button" }] }, async () => {
        await expect(products.continueButton).toBeVisible();
    });

    test('should have the Continue button enabled by default via the required product', { annotation: [{ type: 'testcase', description: "RP-19: Have the Continue button enabled by default via the required product" }] }, async () => {
        // Confirmed live in RegistrationProductsFunctionality.spec.ts: the mandatory
        // product is pre-selected and locked, so Continue starts enabled without any
        // interaction — this only re-asserts that basic arrival state, not the fuller
        // selection/deselection behavior already covered there.
        await expect(products.continueButton).toBeEnabled();
    });
});
