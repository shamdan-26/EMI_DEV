import { test, expect, Page } from '@playwright/test';
import {
    goToInfoStep, nextCitizenAsset, generateEmail, isAlreadyRegisteredMessage,
    fillFinancialForm, fillVerificationForm, markCitizenAssetUsed,
} from '../RegistrationHelper';
import { RegistrationNafathPage } from '../../pageElements/Registration/RegistrationNafathPage';
import { RegistrationInfoPage } from '../../pageElements/Registration/RegistrationInfoPage';
import { RegistrationFinancialPage } from '../../pageElements/Registration/RegistrationFinancialPage';
import { RegistrationVerificationPage } from '../../pageElements/Registration/RegistrationVerificationPage';
import { RegistrationProductsPage } from '../../pageElements/Registration/RegistrationProductsPage';

test.describe('Registration - NAFATH Step Page Elements', { tag: ['@registration', '@ui'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let nafathPage: RegistrationNafathPage;

    test.beforeAll(async ({ browser }) => {
        test.setTimeout(180_000);
        const context = await browser.newContext();
        page = await context.newPage();
        nafathPage = new RegistrationNafathPage(page);
        const infoPage = new RegistrationInfoPage(page);

        // Citizen assets (unlike resident assets) go through the real NAFATH
        // verification step instead of bypassing straight to the Financial tab.
        // CITIZEN_ASSETS is a shared, reused pool — an identity already registered
        // by a prior run is expected steady-state (see isAlreadyRegisteredMessage),
        // so cycle to the next asset rather than getting stuck on Business Info.
        const maxAttempts = 10;
        let advanced = false;
        let lastAsset = nextCitizenAsset();
        let lastPageText = '';

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const asset = attempt === 1 ? lastAsset : (lastAsset = nextCitizenAsset());
            await goToInfoStep(page, asset.mobile);

            await infoPage.merchantButton.click();
            await infoPage.crnInput.fill(asset.crn);
            await infoPage.idInput.fill(asset.nationalId);
            await infoPage.emailInput.fill(generateEmail());
            await infoPage.nextButton.click();
            await nafathPage.loadingButton.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});

            // Business Info is followed by an inline Financial sub-step (still under
            // outer step 1) — it must be filled and submitted too before the wizard
            // advances to the NAFATH outer step.
            const financialPage = new RegistrationFinancialPage(page);
            const financialLoaded = await financialPage.monthlyBillsInput
                .waitFor({ state: 'visible', timeout: 20000 })
                .then(() => true)
                .catch(() => false);

            if (financialLoaded) {
                await fillFinancialForm(page);
                await financialPage.next();
            }

            // Financial is followed by the Verification & Uploads sub-step (still
            // under outer step 1) — NAFATH only appears after it is filled and
            // Sign Up is clicked, not right after Financial (see goToProductsStep).
            const verificationPage = new RegistrationVerificationPage(page);
            const verificationLoaded = await verificationPage.ibanInput
                .waitFor({ state: 'visible', timeout: 20000 })
                .then(() => true)
                .catch(() => false);

            if (verificationLoaded) {
                await fillVerificationForm(page);
                await verificationPage.signUpButton.click();
                await nafathPage.loadingButton.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
            }

            // Race Nafath against Products: on ENV=dev, Nafath is bypassed and a
            // successful Sign Up lands straight on Products instead — that asset is
            // spent for this spec's purposes (see [[feedback_nafath_conventions]]),
            // so flag it and move to the next unused one rather than burning the
            // rest of maxAttempts re-discovering the same dead end.
            const products = new RegistrationProductsPage(page);
            // productCards, not formSubTitle (.form-sub-title) — that class is
            // shared by every wizard step's header, including Business Info's own
            // subtitle, which is still visible immediately after this Next click
            // before the app has settled on its actual destination. See the
            // RegistrationFinancialPage.spec.ts hook-timeout goToFinancialStep's
            // identical race caused for the full failure mode this avoids.
            const landedOn = await Promise.race([
                nafathPage.nafathHeading.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'nafath' as const),
                nafathPage.activeStep.filter({ hasText: /NAFATH|نَفاذ|نفاذ/i }).first()
                    .waitFor({ state: 'visible', timeout: 20000 }).then(() => 'nafath' as const),
                products.productCards.first().waitFor({ state: 'visible', timeout: 20000 }).then(() => 'products' as const),
            ]).catch(() => 'neither' as const);

            if (landedOn === 'nafath') {
                markCitizenAssetUsed(asset.mobile, 'nafath');
                advanced = true;
                break;
            }

            if (landedOn === 'products') {
                markCitizenAssetUsed(asset.mobile, 'products');
                if (attempt < maxAttempts) continue;
                break;
            }

            lastPageText = await page.evaluate(() => document.body.innerText).catch(() => '');
            if (isAlreadyRegisteredMessage(lastPageText)) {
                markCitizenAssetUsed(asset.mobile, 'already-registered');
                if (attempt < maxAttempts) continue;
            }
            break;
        }

        if (!advanced) {
            throw new Error(
                `Registration never reached the NAFATH step (neither the verification panel nor an ` +
                `active "NAFATH" outer step appeared) — either stuck on Business Info or NAFATH was ` +
                `bypassed straight to a later step.\n` +
                `Mobile=${lastAsset.mobile}, CRN=${lastAsset.crn}, ID=${lastAsset.nationalId}.\n` +
                `Current URL: ${page.url()}\n` +
                `Page text: ${lastPageText?.slice(0, 300)}`
            );
        }
    });

    test.afterAll(async () => { await page.close(); });

    // ── Header / Banner ───────────────────────────────────────────────────

    test('should display the MJD Pay logo', async () => {
        await expect(nafathPage.logoImage).toBeVisible();
    });

    test('should link the MJD Pay logo to the landing page', async () => {
        await expect(nafathPage.logoLink).toHaveAttribute('href', '/business/landing');
    });

    test('should display the EN language button', async () => {
        await expect(nafathPage.enButton).toBeVisible();
    });

    test('should display the Arabic language button', async () => {
        await expect(nafathPage.arabicButton).toBeVisible();
    });

    test('should display the theme toggle button', async () => {
        await expect(nafathPage.themeToggle).toBeVisible();
    });

    // ── Page headings ────────────────────────────────────────────────────

    test('should display the "Create Account" eyebrow text', async () => {
        await expect(nafathPage.formEyebrow).toContainText(/Create Account|إنشاء حساب/i);
    });

    // ── Outer progress bar ───────────────────────────────────────────────

    test('should display "Business Info" as the first outer step', { annotation: [{ type: 'testcase', description: "RN-07: Display \"Business Info\" as the first outer step" }] }, async () => {
        await expect(nafathPage.outerStepBar.nth(0)).toContainText(/Business Info|بيانات النشاط/i);
    });

    test('should display "NAFATH" as the active outer step', { annotation: [{ type: 'testcase', description: "RN-08: Display \"NAFATH\" as the active outer step" }] }, async () => {
        // Wait for the Info step's transition to finish landing on NAFATH before asserting,
        // rather than relying on the default assertion-retry window to cover the navigation.
        await nafathPage.activeStep.filter({ hasText: /NAFATH|نَفاذ|نفاذ/i }).first()
            .waitFor({ state: 'visible', timeout: 20000 });
        await expect(nafathPage.activeStep.first()).toContainText(/NAFATH|نَفاذ|نفاذ/i);
    });

    test('should display "Products" as the third outer step', async () => {
        await expect(nafathPage.outerStepBar.nth(2)).toContainText(/Products|المنتجات/i);
    });

    test('should display "Contract" as the fourth outer step', async () => {
        await expect(nafathPage.outerStepBar.nth(3)).toContainText(/Contract|العقد/i);
    });

    // ── Nafath verification panel ───────────────────────────────────────

    test('should display the "Verify with Nafath" heading', { annotation: [{ type: 'testcase', description: "RN-11: Display the \"Verify with Nafath\" heading" }] }, async () => {
        await expect(nafathPage.nafathHeading).toBeVisible();
    });

    test('should display the verification instruction text', { annotation: [{ type: 'testcase', description: "RN-12: Display the verification instruction text" }] }, async () => {
        await expect(nafathPage.instructionText).toBeVisible();
    });

    test('should display step 1 "Open Nafath app and sign in"', { annotation: [{ type: 'testcase', description: "RN-13: Display step 1 \"Open Nafath app and sign in\"" }] }, async () => {
        await expect(nafathPage.step1Text).toBeVisible();
    });

    test('should display step 2 "Select the number shown"', { annotation: [{ type: 'testcase', description: "RN-14: Display step 2 \"Select the number shown\"" }] }, async () => {
        await expect(nafathPage.step2Text).toBeVisible();
    });

    test('should display step 3 "Approve"', { annotation: [{ type: 'testcase', description: "RN-15: Display step 3 \"Approve\"" }] }, async () => {
        await expect(nafathPage.step3Text).toBeVisible();
    });

    test('should display the redirect note with a countdown timer', { annotation: [{ type: 'testcase', description: "RN-16: Display the redirect note with a countdown timer" }] }, async () => {
        await expect(nafathPage.redirectNote).toContainText(/return to this page/i);
        await expect(nafathPage.countdownTimer).toBeVisible();
    });

    // Per EMI-4895: Verify button must start disabled and only enable once the
    // redirect countdown expires (fixed to 20s in EMI-4937, previously 30s).
    test('should display the "Verify" button as initially disabled while the countdown is active [EMI-4895]', { annotation: [{ type: 'testcase', description: "RN-17: Display the \"Verify\" button as initially disabled while the countdown is active (EMI-4895)" }] }, async () => {
        await expect(nafathPage.verifyButton).toBeVisible();
        await expect(nafathPage.verifyButton).toBeDisabled();
    });

    // Per EMI-4895 acceptance criteria: "remove resend section".
    test('should not display a resend option in the Nafath panel [EMI-4895]', { annotation: [{ type: 'testcase', description: "RN-18: Not display a resend option in the Nafath panel (EMI-4895)" }] }, async () => {
        await expect(nafathPage.resendButton).toHaveCount(0);
    });
});
