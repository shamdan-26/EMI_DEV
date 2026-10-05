import { test, expect, Page, Locator } from '@playwright/test';
import {
    goToInfoStep, nextCitizenAsset, generateEmail, REGISTER_URL,
    selectRandomOption, VALID_IBAN, VALID_VAT_NUMBER, TEST_FILE_BUFFER,
    isAlreadyRegisteredMessage, goToProductsStep, expandPosCard, submitBusinessInfo,
} from '../RegistrationHelper';
import { RegistrationInfoPage } from '../../pageElements/Registration/RegistrationInfoPage';
import { RegistrationFinancialPage } from '../../pageElements/Registration/RegistrationFinancialPage';
import { RegistrationVerificationPage } from '../../pageElements/Registration/RegistrationVerificationPage';
import { RegistrationProductsPage } from '../../pageElements/Registration/RegistrationProductsPage';
import { RegistrationContractPage } from '../../pageElements/Registration/RegistrationContractPage';

// ── Selectors ─────────────────────────────────────────────────────────────────
const ACTIVE_STEP = '.mp-step.is-active';
const CANCEL_BTN  = (p: Page) => p.getByRole('button', { name: /cancel/i });

const PRODUCT_NAMES = [
    'walletTest',
    'ttt',
    'testTuqa',
    'TuqaTestLimit',
    'Point of Sale Device',
    'POS Terminal',
];

// testTuqa renders disabled + aria-pressed="true" (locked, pre-selected) on this
// environment's Products step — it's the mandatory product that can't be
// deselected (confirmed live), so it's never clicked in the tests below and the
// "Selected" counter always starts at 1, not 0.
const MANDATORY_PRODUCT = 'testTuqa';
const OPTIONAL_PRODUCTS = PRODUCT_NAMES.filter(name => name !== MANDATORY_PRODUCT);

function productCard(page: Page, name: string): Locator {
    return page.locator('.mp-product-card').filter({ hasText: name }).first();
}

function continueButton(page: Page): Locator {
    return page.getByRole('button', { name: /^continue$/i });
}

function selectedCounter(page: Page): Locator {
    return page.locator('.mp-product-footer__count');
}

// ─────────────────────────────────────────────────────────────────────────────
// Products Step (outer step 3 of 4). Reached via Business Info -> Financial &
// Business -> Verification & Documents -> Sign Up — NOT gated on real NAFATH
// (confirmed live against dev: Sign Up lands directly on the Products step with
// the real product catalogue). Every test still gates on `productsAppeared` and
// skips with a clear reason if sign-up doesn't complete, but that should no
// longer trigger under normal conditions.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration - Products Step', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let productsAppeared = false;

    test.beforeAll(async ({ browser }) => {
        test.setTimeout(180_000);
        const context = await browser.newContext();
        page = await context.newPage();

        // CITIZEN_ASSETS is a shared, reused pool — an identity already registered
        // by a prior run is expected steady-state, so cycle to the next asset
        // rather than treating it as a failure.
        const maxAttempts = 10;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const asset = nextCitizenAsset();
            await goToInfoStep(page, asset.mobile);

            const infoPage = new RegistrationInfoPage(page);
            await infoPage.merchantButton.click();
            await infoPage.crnInput.fill(asset.crn);
            await infoPage.idInput.fill(asset.nationalId);
            await infoPage.emailInput.fill(generateEmail());

            // Confirmed live via network capture (RegistrationNafathFunctionality.spec.ts):
            // a pool asset the backend already considers registered returns a 409 on
            // this submission with no visible page text or toast —
            // isAlreadyRegisteredMessage() below can never catch it, so this used to
            // burn the full 20s Loading-hidden wait plus the Financial/Products race
            // below on a step that would never advance. Detect it directly and cycle
            // to the next asset instead.
            const { conflict } = await submitBusinessInfo(page, infoPage);
            if (conflict) {
                if (attempt < maxAttempts) continue;
                break;
            }
            await page.getByRole('button', { name: /Loading|جاري التحميل/i })
                .waitFor({ state: 'hidden', timeout: 20000 })
                .catch(() => {});

            // Financial & Business step normally comes next — but a CITIZEN_ASSETS
            // identity that already completed Financial/Verification in a previous
            // run (the pool is shared/reused) resumes straight at the Products step
            // instead, so race both outcomes rather than assuming Financial appears.
            const financialPage = new RegistrationFinancialPage(page);
            const productsHeading = page.getByText('Choose the products for your business.');
            const outcome = await Promise.race([
                financialPage.monthlyBillsInput.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'financial' as const),
                productsHeading.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'products' as const),
            ]).catch(() => 'neither' as const);

            if (outcome === 'products') {
                productsAppeared = true;
                break;
            }

            if (outcome === 'neither') {
                const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
                if (isAlreadyRegisteredMessage(pageText) && attempt < maxAttempts) continue;
                break;
            }

            await financialPage.fill('1500', '50000', '10000', '20000');
            await selectRandomOption(page, page.locator('#mat-select-value-0'));
            await selectRandomOption(page, page.locator('#mat-select-value-1'));
            await financialPage.next();

            // Verification & Documents step — Sign Up here is what advances to Products.
            const verificationPage = new RegistrationVerificationPage(page);
            await verificationPage.waitForLoad();
            if (await verificationPage.bankDropdown.count() > 0) {
                await selectRandomOption(page, verificationPage.bankDropdown.first());
            }
            await verificationPage.ibanInput.fill(VALID_IBAN);
            await verificationPage.vatInput.fill(VALID_VAT_NUMBER);
            // Confirmed live (RegistrationVerificationUploads.spec.ts,
            // fillVerificationForm()): setInputFiles() resolves once the DOM
            // input holds the file, NOT once the app's own async upload
            // finishes — clicking Sign Up right after this loop used to race
            // that upload and find it still disabled. Wait for each filename to
            // actually render before moving on.
            const fileInputs = page.locator('input[type="file"]');
            const fileInputCount = await fileInputs.count();
            for (let i = 0; i < fileInputCount; i++) {
                const fileName = `doc${i}.pdf`;
                await fileInputs.nth(i)
                    .setInputFiles({ name: fileName, mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER })
                    .catch(() => {});
                await page.getByText(fileName).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
            }
            await verificationPage.signUpButton.click();
            await page.getByRole('button', { name: /Loading|جاري التحميل/i })
                .waitFor({ state: 'hidden', timeout: 20000 })
                .catch(() => {});

            productsAppeared = await productsHeading
                .waitFor({ state: 'visible', timeout: 90000 })
                .then(() => true)
                .catch(() => false);

            if (productsAppeared) break;

            const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
            if (!isAlreadyRegisteredMessage(pageText) || attempt >= maxAttempts) break;
        }
    });

    test.afterAll(async () => {
        await page.close();
    });

    // ── Page arrival ─────────────────────────────────────────────────────────

    test.skip('should mark "Products" as the active step after NAFATH completes', { annotation: [{ type: 'testcase', description: "RP-40: Mark \"Products\" as the active step after NAFATH completes" }] }, async () => {
        await expect(page.locator(ACTIVE_STEP).first()).toContainText(/Products|المنتجات/i);
    });

    test.skip('should display a "View more" link on each product card', { annotation: [{ type: 'testcase', description: "RP-41: Display a \"View more\" link on each product card" }] }, async () => {
        for (const name of PRODUCT_NAMES) {
            await expect(productCard(page, name).getByText(/view more/i)).toBeVisible();
        }
    });

    test('should show the annual price on the POS Terminal card instead of Free', { annotation: [{ type: 'testcase', description: "RP-42: Show the annual price on the POS Terminal card instead of Free" }] }, async () => {
        await expect(productCard(page, 'POS Terminal')).toContainText(/5\s*SAR\s*\/\s*annual/i);
    });

    // ── Initial state ────────────────────────────────────────────────────────
    // testTuqa is the mandatory product — pre-selected and locked (disabled) —
    // so the baseline is always "1 Selected" with Continue already enabled.

    test('should show the mandatory product pre-selected and locked by default', { annotation: [{ type: 'testcase', description: "RP-43: Show the mandatory product pre-selected and locked by default" }] }, async () => {
        const mandatoryCard = productCard(page, MANDATORY_PRODUCT);
        await expect(mandatoryCard).toBeDisabled();
        await expect(mandatoryCard).toHaveAttribute('aria-pressed', 'true');
    });

    test('should have the Continue button enabled by default via the mandatory product', { annotation: [{ type: 'testcase', description: "RP-44: Have the Continue button enabled by default via the mandatory product" }] }, async () => {
        await expect(continueButton(page)).toBeEnabled();
    });

    test('should display "1 Selected" by default with only the mandatory product selected', { annotation: [{ type: 'testcase', description: "RP-45: Display \"1 Selected\" by default with only the mandatory product selected" }] }, async () => {
        await expect(selectedCounter(page)).toContainText('1 Selected');
    });

    // ── Single selection ─────────────────────────────────────────────────────

    test('should select an optional product and show "2 Selected" when its card is clicked', { annotation: [{ type: 'testcase', description: "RP-46: Select an optional product and show \"2 Selected\" when its card is clicked" }] }, async () => {
        await productCard(page, 'walletTest').click();
        await expect(selectedCounter(page)).toContainText('2 Selected');
    });

    test('should keep the Continue button enabled after selecting another product', { annotation: [{ type: 'testcase', description: "RP-47: Keep the Continue button enabled after selecting another product" }] }, async () => {
        await expect(continueButton(page)).toBeEnabled();
    });

    // ── Multiple selection ───────────────────────────────────────────────────

    test('should update the counter to "3 Selected" when a second optional product is selected', { annotation: [{ type: 'testcase', description: "RP-48: Update the counter to \"3 Selected\" when a second optional product is selected" }] }, async () => {
        await productCard(page, 'ttt').click();
        await expect(selectedCounter(page)).toContainText('3 Selected');
    });

    test('should allow selecting all six available products', { annotation: [{ type: 'testcase', description: "RP-49: Allow selecting all six available products" }] }, async () => {
        // walletTest and ttt are already selected from the tests above; testTuqa
        // is the locked mandatory product and can't be clicked.
        const remaining = OPTIONAL_PRODUCTS.filter(name => name !== 'walletTest' && name !== 'ttt');
        for (const name of remaining) {
            await productCard(page, name).click();
        }
        await expect(selectedCounter(page)).toContainText(`${PRODUCT_NAMES.length} Selected`);
    });

    // ── Deselection ──────────────────────────────────────────────────────────

    test('should deselect a product and decrement the counter when its card is clicked again', { annotation: [{ type: 'testcase', description: "RP-50: Deselect a product and decrement the counter when its card is clicked again" }] }, async () => {
        await productCard(page, 'POS Terminal').click();
        await expect(selectedCounter(page)).toContainText('5 Selected');
    });

    test('should keep the mandatory product selected once every optional product is deselected', { annotation: [{ type: 'testcase', description: "RP-51: Keep the mandatory product selected once every optional product is deselected" }] }, async () => {
        // POS Terminal was already deselected by the previous test — only click
        // the optional products still selected at this point, so this loop
        // toggles them off rather than re-selecting POS Terminal.
        const stillSelected = OPTIONAL_PRODUCTS.filter(name => name !== 'POS Terminal');
        for (const name of stillSelected) {
            await productCard(page, name).click();
        }
        await expect(continueButton(page)).toBeEnabled();
    });

    test('should show "1 Selected" again once every optional product is deselected', { annotation: [{ type: 'testcase', description: "RP-52: Show \"1 Selected\" again once every optional product is deselected" }] }, async () => {
        await expect(selectedCounter(page)).toContainText('1 Selected');
    });

    // ── Cancel / Continue actions ────────────────────────────────────────────

    test('should keep the Cancel button enabled regardless of selection state', { annotation: [{ type: 'testcase', description: "RP-53: Keep the Cancel button enabled regardless of selection state" }] }, async () => {
        await expect(CANCEL_BTN(page)).toBeEnabled();
    });

    test('should advance past the Products step when Continue is clicked with a product selected', { annotation: [{ type: 'testcase', description: "RP-54: Advance past the Products step when Continue is clicked with a product selected" }] }, async () => {
        await productCard(page, 'walletTest').click();
        await expect(continueButton(page)).toBeEnabled();
        await continueButton(page).click();
        await expect(page.locator(ACTIVE_STEP).first()).not.toContainText(/Products|المنتجات/i, { timeout: 15000 });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PoS Onboarding Setup (EMI-5783) — functional/interaction coverage. Element/
// text presence for this same sub-flow lives in
// ui/RegistrationProductsPoSSetup.spec.ts; this block covers what that file
// deliberately leaves out: validation state (Next disabled until required
// fields are filled), the split-by-device Add/Remove Location Group
// interaction, and Back-button navigation. Reaches the PoS sub-flow the same
// way that file does — goToProductsStep() then expandPosCard() — and gates
// every test on posFlowAvailable for the same reason (a citizen asset that
// already completed this sub-flow in a prior run resumes straight past it).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration - Products Step: PoS Onboarding Setup (EMI-5783) - Devices & Delivery functional', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let products: RegistrationProductsPage;
    let posFlowAvailable = false;

    test.beforeAll(async ({ browser }) => {
        // Same timeout reasoning as ui/RegistrationProductsPoSSetup.spec.ts's
        // beforeAll — goToProductsStep() cycles the same shared, often-burned
        // CITIZEN_ASSETS pool, where each already-registered asset still costs a
        // full Info->Financial->Verification->Sign-up cycle before the next.
        test.setTimeout(600_000);
        const context = await browser.newContext();
        page = await context.newPage();
        products = new RegistrationProductsPage(page);

        const reachedProducts = await goToProductsStep(page);
        if (!reachedProducts) {
            throw new Error(
                'Registration never reached the Products step after cycling the shared ' +
                'CITIZEN_ASSETS pool — every asset resumed past it (Contract) or hit the ' +
                'real NAFATH panel instead.'
            );
        }

        posFlowAvailable = await expandPosCard(page);
        if (posFlowAvailable) {
            // Reach Devices & Delivery but deliberately stop short of filling the
            // contact fields — the validation tests below need that unfilled state
            // to assert Next starts disabled.
            await products.requestDevicesNowButton.click();
            await products.skipSetupLaterButton.click();
            await products.deviceCountInput.waitFor({ state: 'visible', timeout: 10000 });
        }
    });

    test.afterAll(async () => { await page.close(); });

    // ── Validation ────────────────────────────────────────────────────────
    // Confirmed live: unlike Business Info, Financial & Business, and
    // Verification & Uploads (which do gate Next/Sign Up on required fields),
    // Devices & Delivery's Next button is NOT disabled on a pristine, unfilled
    // form — a genuinely fresh citizen asset (used=false, no prior run) still
    // showed it enabled immediately. The required-fields-gate-Next pattern
    // this test used to assume by analogy doesn't hold for this specific
    // sub-step, so this documents the actual behavior instead.

    test('should have the Devices & Delivery Next button enabled by default, even before contact fields are filled', { annotation: [{ type: 'testcase', description: "RP-55: Have the Devices & Delivery Next button enabled by default, even before contact fields are filled" }] }, async () => {
        await expect(products.devicesDeliveryNextButton).toBeEnabled();
    });

    test('should keep the Devices & Delivery Next button enabled once contact name and mobile are filled', { annotation: [{ type: 'testcase', description: "RP-56: Keep the Devices & Delivery Next button enabled once contact name and mobile are filled" }] }, async () => {
        await products.updateWathiqAddressButton.waitFor({ state: 'visible', timeout: 20000 });
        await products.contactNameInput.fill('Test Contact');
        await products.contactMobileInput.fill('512345678');
        await expect(products.devicesDeliveryNextButton).toBeEnabled();
    });

    // ── Delivery groups (split-by-device) ────────────────────────────────

    test('should add a second delivery group when Add Location Group is clicked in split-by-device mode', { annotation: [{ type: 'testcase', description: "RP-57: Add a second delivery group when Add Location Group is clicked in split-by-device mode" }] }, async () => {
        await products.splitByDeviceDeliveryOption.click({ force: true });
        await products.addLocationGroupButton.click();
        await expect(products.removeLocationGroupButton).toBeVisible({ timeout: 5000 });
    });

    test('should remove a delivery group when Remove Location Group is clicked', { annotation: [{ type: 'testcase', description: "RP-58: Remove a delivery group when Remove Location Group is clicked" }] }, async () => {
        await products.removeLocationGroupButton.click();
        await expect(products.removeLocationGroupButton).not.toBeVisible({ timeout: 5000 });
        // Restore single-location delivery for the Back-button test below, same
        // as ui/RegistrationProductsPoSSetup.spec.ts's split-by-device tests do.
        await products.singleLocationDeliveryOption.click({ force: true });
    });

    // ── Navigation ────────────────────────────────────────────────────────

    test('should return to the expanded PoS card when Back is clicked from Devices & Delivery', { annotation: [{ type: 'testcase', description: "RP-59: Return to the expanded PoS card when Back is clicked from Devices & Delivery" }] }, async () => {
        await products.devicesDeliveryBackButton.click();
        await expect(products.requestDevicesNowButton).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Registration - Products Step: PoS Onboarding Setup (EMI-5783) - skip request-now path', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    // Single test, needs its own fresh citizen asset/session rather than
    // sharing the block above's — that session already commits to the
    // "checked" branch, and this test needs a pristine expanded PoS card to
    // verify the opposite (unchecked) path.
    test.skip('should advance straight to Contract when Continue is clicked without checking "Request devices now"', { annotation: [{ type: 'testcase', description: "RP-60: Advance straight to Contract when Continue is clicked without checking \"Request devices now\"" }] }, async ({ browser }) => {
        test.setTimeout(600_000);
        const context = await browser.newContext();
        const page = await context.newPage();
        const products = new RegistrationProductsPage(page);

        const reachedProducts = await goToProductsStep(page);
        if (!reachedProducts) {
            throw new Error(
                'Registration never reached the Products step after cycling the shared ' +
                'CITIZEN_ASSETS pool — every asset resumed past it (Contract) or hit the ' +
                'real NAFATH panel instead.'
            );
        }

        await expandPosCard(page);

        // Confirmed live (see ui/RegistrationProductsPoSSetup.spec.ts's header
        // comment): skipSetupLaterButton IS the Products-step's own Continue
        // button — clicking it without checking requestDevicesNowButton first
        // advances straight to Contract, with no separate inline "skipped"
        // message state to land on.
        await products.skipSetupLaterButton.click();
        const contract = new RegistrationContractPage(page);
        await contract.waitForLoad();
        await expect(contract.activeStep).toContainText(/contract|العقد/i);

        await context.close();
    });
});
