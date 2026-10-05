import { test, expect, Page } from '@playwright/test';
import {
    goToInfoStep, nextCitizenAsset, generateEmail, isAlreadyRegisteredMessage,
    fillFinancialForm, fillVerificationForm, markCitizenAssetUsed, submitBusinessInfo,
} from '../RegistrationHelper';
import { RegistrationNafathPage } from '../../pageElements/Registration/RegistrationNafathPage';
import { RegistrationInfoPage } from '../../pageElements/Registration/RegistrationInfoPage';
import { RegistrationFinancialPage } from '../../pageElements/Registration/RegistrationFinancialPage';
import { RegistrationVerificationPage } from '../../pageElements/Registration/RegistrationVerificationPage';
import { RegistrationProductsPage } from '../../pageElements/Registration/RegistrationProductsPage';

test.describe('Registration - Nafath Verification', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let nafathPage: RegistrationNafathPage;

    test.beforeAll(async ({ browser }) => {
        // Confirmed live (ui/RegistrationNafathPage.spec.ts): NAFATH is NOT
        // reached right after submitting Business Info — this file used to
        // assume that and time out waiting for NAFATH text that was never
        // going to appear. The real chain is Business Info -> an inline
        // Financial sub-step -> an inline Verification & Uploads sub-step ->
        // Sign Up click -> only then NAFATH (or Products, if NAFATH is
        // bypassed for this asset/environment). Mirrors that file's proven
        // climb + CITIZEN_ASSETS cycling/marking rather than re-deriving it.
        test.setTimeout(180_000);
        const context = await browser.newContext();
        page = await context.newPage();
        nafathPage = new RegistrationNafathPage(page);
        const infoPage = new RegistrationInfoPage(page);

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

            // Confirmed live via network capture: a pool asset the backend
            // already considers registered returns a 409 on this submission
            // with no visible page text or toast — isAlreadyRegisteredMessage()
            // below can never catch it, so detect it directly and cycle to the
            // next asset the same way an already-registered page message does,
            // rather than waiting out every downstream timeout for a step that
            // will never load.
            const { conflict } = await submitBusinessInfo(page, infoPage);
            if (conflict) {
                markCitizenAssetUsed(asset.mobile, 'already-registered');
                if (attempt < maxAttempts) continue;
                break;
            }
            await nafathPage.loadingButton.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});

            const financialPage = new RegistrationFinancialPage(page);
            const financialLoaded = await financialPage.monthlyBillsInput
                .waitFor({ state: 'visible', timeout: 20000 })
                .then(() => true)
                .catch(() => false);
            if (financialLoaded) {
                await fillFinancialForm(page);
                await financialPage.next();
            }

            const verificationPage = new RegistrationVerificationPage(page);
            const verificationLoaded = await verificationPage.ibanInput
                .waitFor({ state: 'visible', timeout: 20000 })
                .then(() => true)
                .catch(() => false);
            if (verificationLoaded) {
                await fillVerificationForm(page);
                await verificationPage.signUpButton.click();
                // Confirmed live: on this environment's current backend latency,
                // the loading spinner can still be visible well past 20s after
                // Sign Up — the fully-valid, ready-to-submit form (bank, IBAN,
                // VAT, both file uploads all confirmed) was captured still
                // sitting on this exact step because the race below started
                // before the redirect actually landed anywhere. 40s matches the
                // slower round trip observed rather than the happier-path 20s
                // used earlier in this same hook (mobile/OTP/business-info,
                // which have shown no similar slowness).
                await nafathPage.loadingButton.waitFor({ state: 'hidden', timeout: 40000 }).catch(() => {});
            }

            const products = new RegistrationProductsPage(page);
            // Confirmed live: an asset that already advanced past Products in an
            // earlier run (local pool state can lag the real backend, same root
            // cause as the profile-registration-type 409 above) resumes straight
            // to Contract, skipping Products entirely — without a 'contract'
            // branch here, that outcome fell through to 'neither' and was
            // misreported as a dead end instead of cycled past. Mirrors
            // goToProductsStep()'s own landOnContractOk handling of the same case.
            const landedOn = await Promise.race([
                nafathPage.nafathHeading.waitFor({ state: 'visible', timeout: 40000 }).then(() => 'nafath' as const),
                nafathPage.activeStep.filter({ hasText: /NAFATH|نَفاذ|نفاذ/i }).first()
                    .waitFor({ state: 'visible', timeout: 40000 }).then(() => 'nafath' as const),
                products.productCards.first().waitFor({ state: 'visible', timeout: 40000 }).then(() => 'products' as const),
                nafathPage.activeStep.filter({ hasText: /Contract|العقد/i }).first()
                    .waitFor({ state: 'visible', timeout: 40000 }).then(() => 'contract' as const),
            ]).catch(() => 'neither' as const);

            if (landedOn === 'nafath') {
                markCitizenAssetUsed(asset.mobile, 'nafath');
                advanced = true;
                break;
            }

            if (landedOn === 'products' || landedOn === 'contract') {
                markCitizenAssetUsed(asset.mobile, landedOn);
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

    test.afterAll(async () => {
        await page.close();
    });

    // ── Page presence ─────────────────────────────────────────────────────────

    test('should display the Nafath page after Sign Up', { annotation: [{ type: 'testcase', description: "RN-19: Display the Nafath page after Sign Up" }] }, async () => {
        await expect(nafathPage.nafathHeading).toBeVisible();
    });

    // ── Timer ─────────────────────────────────────────────────────────────────

    test('should display a countdown timer on the Nafath page', { annotation: [{ type: 'testcase', description: "RN-20: Display a countdown timer on the Nafath page" }] }, async () => {
        await expect(nafathPage.countdownTimer).toBeVisible();
    });

    // ── Verify button ─────────────────────────────────────────────────────────
    // Per EMI-4895: the button starts disabled and only enables once the
    // redirect countdown expires. EMI-4937 fixed that duration to 20s (was 30s).

    test('should have the Verify button disabled while the redirect countdown is active [EMI-4895]', { annotation: [{ type: 'testcase', description: "RN-21: Have the Verify button disabled while the redirect countdown is active (EMI-4895)" }] }, async () => {
        await expect(nafathPage.verifyButton).toBeDisabled();
    });

    test('should keep the Verify button disabled mid-countdown, not just on load [EMI-4895]', { annotation: [{ type: 'testcase', description: "RN-22: Keep the Verify button disabled mid-countdown, not just on load (EMI-4895)" }] }, async () => {
        await page.waitForTimeout(3000);
        await expect(nafathPage.verifyButton).toBeDisabled();
    });

    test('should enable the Verify button once the 20-second countdown expires [EMI-4937]', { annotation: [{ type: 'testcase', description: "RN-23: Enable the Verify button once the 20-second countdown expires (EMI-4937)" }] }, async () => {
        await expect(nafathPage.verifyButton).toBeEnabled({ timeout: 25_000 });
    });
});
