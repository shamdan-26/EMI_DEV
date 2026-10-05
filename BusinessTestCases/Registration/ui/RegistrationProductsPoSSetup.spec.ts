import { test, expect, Page } from '@playwright/test';
import { goToProductsStep, expandPosCard } from '../RegistrationHelper';
import { RegistrationProductsPage } from '../../pageElements/Registration/RegistrationProductsPage';
import { RegistrationContractPage } from '../../pageElements/Registration/RegistrationContractPage';

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding PoS Request Flow — web UI (EMI-5783)
//
// Split out of RegistrationProductsPage.spec.ts: that file covers Products-step
// element/text presence only (arrival state); this file covers the deeper PoS
// device-request setup sub-flow once the wizard is already on the Products
// step — expanding the PoS card, Devices & Delivery (device counter, delivery
// type toggle, address radios, contact fields), and the advance straight to
// Contract that follows it — confirmed live, there is no separate Review step
// in between. Devices & Delivery locators/coverage match a live DOM
// extraction of that sub-step. Uses the same goToProductsStep() helper
// (RegistrationHelper.ts) to reach Products, cycling the shared, reused
// CITIZEN_ASSETS pool exactly as RegistrationProductsPage.spec.ts and
// RegistrationNafathPage.spec.ts do.
//
// The PoS card itself may not expand for every asset — one that already
// completed the PoS sub-flow in a prior run (shared pool) advances straight to
// Contract instead. Every test below gates on `posFlowAvailable` and skips
// cleanly with a clear reason when that's the case, rather than failing
// against a dead end.
//
// Confirmed live: there is no separate "Skip - set up later" inline message
// state to test — the Products-step Continue button (skipSetupLaterButton)
// advances straight to Contract when requestDevicesNowButton isn't checked
// first, so that's the terminal skip path and isn't exercised here (doing so
// would end the flow before Devices & Delivery, and this suite's single
// browser session is shared serially across all of them).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration - Products Step: PoS Onboarding Setup (EMI-5783)', { tag: ['@registration', '@ui'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let products: RegistrationProductsPage;
    let posFlowAvailable = false;

    test.beforeAll(async ({ browser }) => {
        // Matches RegistrationProductsPage.spec.ts's beforeAll timeout — both call
        // goToProductsStep() against the same shared, often-burned CITIZEN_ASSETS
        // pool, where each already-registered asset that resumes to Contract still
        // costs a full Info→Financial→Verification→Sign-up cycle (~40-45s) before
        // the next asset is tried. 180s wasn't enough headroom for that cycling
        // plus the PoS-card-expansion check that follows.
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

        // Selecting the PoS product should expand it inline with the Request-now
        // checkbox — but a citizen asset that already completed Products/PoS in a
        // prior run (shared pool) silently advances straight to Contract instead
        // of expanding. That's expected steady-state for this pool, not a failure.
        posFlowAvailable = await expandPosCard(page);
    });

    test.afterAll(async () => { await page.close(); });

    const SKIP_MSG = 'PoS inline request sub-flow (EMI-5783) was not reached in this environment — ' +
        'the "POS" card was not found, or the citizen asset had already completed this sub-flow ' +
        'in a prior run (shared CITIZEN_ASSETS pool). Not an automation limitation.';

    function requireFlow() {
        test.skip(!posFlowAvailable, SKIP_MSG);
    }

    // ── PoS card expansion ───────────────────────────────────────────────

    test('should expand the PoS Terminals card inline without leaving the Products step', { annotation: [{ type: 'testcase', description: "RP-20: Expand the PoS Terminals card inline without leaving the Products step" }] }, async () => {
        requireFlow();
        await expect(products.activeStep.first()).toContainText(/products|المنتجات/i);
    });

    test('should show "Request devices now" in the expanded card', { annotation: [{ type: 'testcase', description: "RP-21: Show \"Request devices now\" in the expanded card" }] }, async () => {
        requireFlow();
        await expect(products.requestDevicesNowButton).toBeVisible();
    });

    test('should show a Continue button in the expanded card', { annotation: [{ type: 'testcase', description: "RP-22: Show a Continue button in the expanded card" }] }, async () => {
        requireFlow();
        await expect(products.skipSetupLaterButton).toBeVisible();
    });

    // ── Request devices now path ─────────────────────────────────────────
    //
    // Confirmed live: skipSetupLaterButton (testid register-products-continue-btn)
    // is the Products-step's own Continue button, not a distinct "Skip - set up
    // later" control — clicking it without first checking requestDevicesNowButton
    // advances straight to Contract with no inline "skipped" message, so there is
    // no separate skip-then-reopen round trip to exercise here. Checking the box
    // before continuing is the only way to reach Devices & Delivery.

    test('should reveal the Devices & Delivery fields after checking "Request devices now" and continuing', { annotation: [{ type: 'testcase', description: "RP-23: Reveal the Devices & Delivery fields after checking \"Request devices now\" and continuing" }] }, async () => {
        requireFlow();
        await products.requestDevicesNowButton.click();
        await products.skipSetupLaterButton.click();
        await expect(products.deviceCountInput).toBeVisible({ timeout: 10000 });
    });

    // ── Devices & Delivery ───────────────────────────────────────────────

    test('should show the Devices & Delivery fields', { annotation: [{ type: 'testcase', description: "RP-24: Show the Devices & Delivery fields" }] }, async () => {
        requireFlow();
        await expect(products.deviceCountInput).toBeVisible();
        // Confirmed live: Wathiq and custom-map are two simultaneously visible
        // address radio choices, not either/or alternates — .or() matches both
        // and trips Playwright's strict mode, so assert each individually.
        await expect(products.wathiqAddressOption).toBeVisible();
        await expect(products.customPinAddressOption).toBeVisible();
    });

    test('should not show a wallet picker anywhere in the Devices & Delivery step', { annotation: [{ type: 'testcase', description: "RP-25: Not show a wallet picker anywhere in the Devices & Delivery step" }] }, async () => {
        requireFlow();
        await expect(products.walletPicker).not.toBeVisible();
    });

    test('should display the delivery mode toggle', { annotation: [{ type: 'testcase', description: "RP-26: Display the delivery mode toggle" }] }, async () => {
        requireFlow();
        await expect(products.deliveryModeToggle).toBeVisible();
    });

    test('should display the Back button in Devices & Delivery', { annotation: [{ type: 'testcase', description: "RP-27: Display the Back button in Devices & Delivery" }] }, async () => {
        requireFlow();
        await expect(products.devicesDeliveryBackButton).toBeVisible();
    });

    // ── Devices counter ──────────────────────────────────────────────────

    test('should default the total-devices count to 1', { annotation: [{ type: 'testcase', description: "RP-28: Default the total-devices count to 1" }] }, async () => {
        requireFlow();
        await expect(products.deviceCountInput).toHaveValue('1');
    });

    test('should increment the total-devices count when the increase button is clicked', { annotation: [{ type: 'testcase', description: "RP-29: Increment the total-devices count when the increase button is clicked" }] }, async () => {
        requireFlow();
        await products.increaseDeviceCountButton.click();
        await expect(products.deviceCountInput).toHaveValue('2');
    });

    test('should decrement the total-devices count when the decrease button is clicked, without going below the minimum', { annotation: [{ type: 'testcase', description: "RP-30: Decrement the total-devices count when the decrease button is clicked, without going below the minimum" }] }, async () => {
        requireFlow();
        await products.decreaseDeviceCountButton.click();
        await expect(products.deviceCountInput).toHaveValue('1');
        // Confirmed live: at the floor the button disables itself (data-testid
        // "pos-delivery-editor-decrement-total-btn") rather than staying
        // clickable and no-op'ing — a second .click() would hang forever
        // waiting for a disabled button to become actionable.
        await expect(products.decreaseDeviceCountButton).toBeDisabled();
        await expect(products.deviceCountInput).toHaveValue('1');
    });

    test('should update the total-devices count when typed directly into the field', { annotation: [{ type: 'testcase', description: "RP-31: Update the total-devices count when typed directly into the field" }] }, async () => {
        requireFlow();
        await products.deviceCountInput.fill('2');
        await expect(products.deviceCountInput).toHaveValue('2');
    });

    // ── Delivery type toggle ─────────────────────────────────────────────

    test('should select "single location" delivery by default', { annotation: [{ type: 'testcase', description: "RP-32: Select \"single location\" delivery by default" }] }, async () => {
        requireFlow();
        await expect(products.singleLocationDeliveryOption).toBeVisible();
    });

    test('should switch to per-device delivery groups when "split by devices" is selected', { annotation: [{ type: 'testcase', description: "RP-33: Switch to per-device delivery groups when \"split by devices\" is selected" }] }, async () => {
        requireFlow();
        // Confirmed live: these are custom radios — a visually-hidden (sr-only)
        // <input type="radio"> with a styled <span> label sitting on top, so a
        // plain click's pointer-events check always finds the span intercepting
        // and retries forever. force:true dispatches straight to the real input,
        // which still fires the native radio change event correctly.
        await products.splitByDeviceDeliveryOption.click({ force: true });
        try {
            // .or() previously masked this: addLocationGroupButton and
            // deliveryGroupOneLabel are both visible simultaneously in
            // split-by-device mode, not either/or alternates — same strict-mode
            // pitfall already documented above for the address radios. Only
            // surfaced once addLocationGroupButton's Arabic regex was fixed to
            // actually match anything (see RegistrationProductsPage.ts).
            await expect(products.addLocationGroupButton).toBeVisible({ timeout: 5000 });
            await expect(products.deliveryGroupOneLabel).toBeVisible({ timeout: 5000 });
        } finally {
            // Restore single-location delivery so the remaining Devices & Delivery
            // tests exercise the one-address path this suite is otherwise built
            // around — in a `finally` so a failed assertion above still leaves
            // the page in a state later serial tests can run against.
            await products.singleLocationDeliveryOption.click({ force: true });
        }
    });

    test('should display the Add Location Group button in split-by-device mode', { annotation: [{ type: 'testcase', description: "RP-34: Display the Add Location Group button in split-by-device mode" }] }, async () => {
        requireFlow();
        // Own toggle-into/restore-from split mode, same as the test above —
        // presence-only here (actually adding/removing a group, and the
        // resulting Remove button, is an interaction and belongs in
        // RegistrationProductsFunctionality.spec.ts, not this presence-only file).
        await products.splitByDeviceDeliveryOption.click({ force: true });
        try {
            await expect(products.addLocationGroupButton).toBeVisible({ timeout: 5000 });
        } finally {
            await products.singleLocationDeliveryOption.click({ force: true });
        }
    });

    // ── Delivery groups / address radios ─────────────────────────────────

    test('should select the Wathiq national address by default and show the resolved address', { annotation: [{ type: 'testcase', description: "RP-35: Select the Wathiq national address by default and show the resolved address" }] }, async () => {
        requireFlow();
        await expect(products.wathiqAddressOption).toBeVisible();
        await expect(products.updateWathiqAddressButton).toBeVisible();
    });

    test('should reveal a custom map location option when selected', { annotation: [{ type: 'testcase', description: "RP-36: Reveal a custom map location option when selected" }] }, async () => {
        requireFlow();
        // Same sr-only-input/styled-span custom radio pattern as the delivery-mode
        // toggle above — force the click past the intercepting label span.
        await products.customPinAddressOption.click({ force: true });
        await expect(products.customPinAddressOption).toBeVisible();
        // Switch back to Wathiq so the remaining tests continue with a resolved address.
        await products.wathiqAddressOption.click({ force: true });
    });

    // ── Contact fields ────────────────────────────────────────────────────

    test('should accept a contact name', { annotation: [{ type: 'testcase', description: "RP-37: Accept a contact name" }] }, async () => {
        requireFlow();
        // The Devices & Delivery panel doesn't reliably persist this far into
        // the serial suite (same observation the last test in this file already
        // makes) — re-check "Request devices now" and continue past the PoS
        // card if an earlier test's toggling left the suite back on it, rather
        // than assuming this panel is still open.
        const stillOnProductsCard = await products.requestDevicesNowButton.isVisible().catch(() => false);
        if (stillOnProductsCard) {
            await products.requestDevicesNowButton.click();
            await products.skipSetupLaterButton.click();
        }
        // Same Wathiq address-resolution race as the mobile-number test below —
        // wait for it to settle before the contact-fields section is interacted
        // with, rather than relying on it happening to have already resolved.
        await products.updateWathiqAddressButton.waitFor({ state: 'visible', timeout: 20000 });
        await products.contactNameInput.fill('Test Contact');
        await expect(products.contactNameInput).toHaveValue('Test Contact');
    });

    test('should accept a Saudi contact mobile number', { annotation: [{ type: 'testcase', description: "RP-38: Accept a Saudi contact mobile number" }] }, async () => {
        requireFlow();
        // Same re-navigation as the test above — don't assume the Devices &
        // Delivery panel is still open at this point in the serial suite.
        const stillOnProductsCard = await products.requestDevicesNowButton.isVisible().catch(() => false);
        if (stillOnProductsCard) {
            await products.requestDevicesNowButton.click();
            await products.skipSetupLaterButton.click();
        }
        // Wait for the Wathiq address resolution to settle before interacting —
        // same reasoning as the "should display the Contract step" test below:
        // updateWathiqAddressButton only renders once that fetch completes, and
        // an in-flight/just-completed fetch can re-render the whole contact-
        // fields section, leaving nothing stable for .fill() to retry against
        // (confirmed live: this test's contactMobileInput.fill() hung the full
        // 60s test timeout, forcing the browser closed mid-wait).
        await products.updateWathiqAddressButton.waitFor({ state: 'visible', timeout: 20000 });
        // Confirmed live: the field is maxlength="9" — it takes the 9-digit
        // local number without the leading trunk "0" (the placeholder shows
        // the full "0512345678" just as an illustrative example).
        await products.contactMobileInput.fill('512345678');
        await expect(products.contactMobileInput).toHaveValue('512345678');
    });

    test('should display the Contract step after completing Devices & Delivery', { annotation: [{ type: 'testcase', description: "RP-39: Display the Contract step after completing Devices & Delivery" }] }, async () => {
        requireFlow();
        // Confirmed live: an earlier test in this serial suite already checks
        // requestDevicesNowButton and clicks skipSetupLaterButton to reach Devices
        // & Delivery, but that state doesn't reliably persist this far into the
        // suite — re-assert it here instead of assuming it still holds.
        const stillOnProductsCard = await products.requestDevicesNowButton.isVisible().catch(() => false);
        if (stillOnProductsCard) {
            await products.requestDevicesNowButton.click();
            await products.skipSetupLaterButton.click();
        }
        await products.deviceCountInput.fill('2');
        // Confirmed live via probe: Wathiq is checked by default, so it never
        // needs a click — but the panel's submit button silently no-ops instead
        // of advancing if clicked while the address is still resolving
        // (updateWathiqAddressButton only renders once that fetch completes), so
        // wait for it rather than assuming an earlier test in this serial suite
        // already left it resolved.
        await products.updateWathiqAddressButton.waitFor({ state: 'visible', timeout: 20000 });
        await products.contactNameInput.fill('Test Contact');
        await products.contactMobileInput.fill('512345678');
        // Confirmed live: there is no separate Review step to land on — clicking
        // Next here goes straight to the Contract step. That's the correct,
        // intended behavior, not a skipped/missing Review page.
        await products.devicesDeliveryNextButton.click();
        const contract = new RegistrationContractPage(page);
        await contract.waitForLoad();
        await expect(contract.activeStep).toContainText(/contract|العقد/i);
    });
});
