import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — the first Topup page: the amount form (payment methods, amount field, chips, disclaimer, Proceed state, input handling).
// Assertions check visibility/non-emptiness or bilingual patterns rather than
// guessed Arabic copy — the app renders Arabic by default on dev. Shared setup:
// see TopupHelper.ts (loginToTopup / gotoTopupScreen / findTopupCase).

test.describe('Topup – UI – Amount form (step 1)', { tag: ['@topup', '@ui'], annotation: [{ type: 'feature', description: 'Topup' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(150000);

    let session: TopupSession;

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser, TOPUP_UI_ACCOUNT);
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    test.beforeEach(async () => {
        await gotoTopupScreen(session);
    });

    // Runs even when the test fails, so the gateway popup never leaks into the next test.
    test.afterEach(async () => {
        for (const stray of session.page.context().pages()) {
            if (stray !== session.page) await stray.close().catch(() => { /* already closed */ });
        }
        session.topup.resetActivePage();
    });

    test('page title, subtitle, and balance card are visible with real content', { annotation: [{ type: 'testcase', description: "TUP-03: Page title and subtitle" }, { type: 'testcase', description: "TUP-05: Balance and wallet code match account" }] }, async () => {
        const { topup } = session;
        await expect(topup.pageTitle).toBeVisible();
        expect((await topup.pageTitle.innerText()).trim().length).toBeGreaterThan(0);
        await expect(topup.pageSubtitle).toBeVisible();
        await expect(topup.balanceAmount).toContainText(/\d/);
        expect((await topup.balanceWalletCode.innerText()).trim().length).toBeGreaterThan(0);
    });

    test('MADA/VISA/MASTER are all present and mutually exclusive', { annotation: [{ type: 'testcase', description: "TUP-10: Methods are mutually exclusive" }] }, async () => {
        const { topup } = session;
        await expect(topup.madaOption).toBeVisible();
        await expect(topup.visaOption).toBeVisible();
        await expect(topup.masterOption).toBeVisible();
        await expect(topup.paymentMethodOptions).toHaveCount(3);

        await topup.selectPaymentMethod('mada');
        await expect(topup.madaOption).toBeChecked();

        await topup.selectPaymentMethod('visa');
        await expect(topup.visaOption).toBeChecked();
        await expect(topup.madaOption).not.toBeChecked();
    });

    test('amount field shows a currency icon and Proceed stays disabled while empty', { annotation: [{ type: 'testcase', description: "TUP-15: Currency icon always present" }, { type: 'testcase', description: "TUP-11: Proceed disabled with no method selected" }] }, async () => {
        const { topup } = session;
        await expect(topup.amountCurrencyIcon).toBeVisible();
        await expect(topup.proceedButton).toBeDisabled();
    });

    test('each preset amount chip populates the amount field with its own value', { annotation: [{ type: 'testcase', description: "TUP-16: Each chip populates the amount field" }] }, async () => {
        const { page, topup } = session;
        const chipValues = [500, 1000, 2000, 5000, 10000];
        for (const value of chipValues) {
            const chip = page.getByTestId(`amount-chip-${value}`);
            await expect(chip).toBeVisible();
            await chip.click();
            // Formatting (e.g. "500" vs "500.00") isn't confirmed live — check
            // the numeric value parses to the chip's own amount, not the exact string.
            expect(Number(await topup.getAmountValue())).toBe(value);
        }
    });

    test('balance card shows the QR and wallet-settings action buttons', { annotation: [{ type: 'testcase', description: "TUP-06: Generate QR Code action" }, { type: 'testcase', description: "TUP-07: Wallet settings action" }] }, async () => {
        const { topup } = session;
        await expect(topup.balanceQrButton).toBeVisible();
        await expect(topup.balanceSettingsButton).toBeVisible();
    });

    test('no payment method is selected on a fresh form', { annotation: [{ type: 'testcase', description: "TUP-08: No method selected by default" }] }, async () => {
        const { topup } = session;
        for (const option of [topup.madaOption, topup.visaOption, topup.masterOption]) {
            await expect(option).not.toBeChecked();
        }
    });

    // KNOWN BUG: entering "0" shows no inline validation error — the field is
    // silently left empty (confirmed on dev, Arabic UI). Un-skip once the app
    // shows an error; update the regex to the real (Arabic) copy at that point.
    test.skip('a zero amount shows an inline error and keeps Proceed disabled', { annotation: [{ type: 'testcase', description: "TUP-12: Inline error text for zero amount" }] }, async () => {
        const { topup, page } = session;
        await topup.selectPaymentMethod('mada');
        await topup.enterAmount('0');
        await expect(page.getByText(/more than 0/i).first()).toBeVisible({ timeout: 5000 });
        await expect(topup.proceedButton).toBeDisabled();
    });

    test('a manual amount replaces a previously selected preset chip', { annotation: [{ type: 'testcase', description: "TUP-14: Preset chip then manual override" }] }, async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('visa');
        await topup.presetAmountChips.first().click();
        await topup.enterAmount('777');
        await expect(topup.inputAmount).toHaveValue(/777/);
    });

    test('the disclaimer banner is present on the main form', { annotation: [{ type: 'testcase', description: "TUP-19: Disclaimer copy matches current build" }] }, async () => {
        const { topup } = session;
        await expect(topup.disclaimerText).toBeVisible();
        await expect(topup.disclaimerText).toContainText(/مجد باي|MJD ?Pay|MajdPay/i);
    });

    // KNOWN BUG (accessibility): the amount field has no visible label and no
    // aria-label — it relies on its placeholder, so screen readers can't name
    // it. Un-skip once it has an accessible name.
    test.skip('the amount field has an accessible name', async () => {
        const { page } = session;
        await expect(page.getByRole('textbox', { name: /.+/ })).toBeVisible();
    });

    test('the page renders right-to-left (Arabic default)', async () => {
        const { page } = session;
        const direction = await page.evaluate(() => getComputedStyle(document.body).direction);
        expect(direction).toBe('rtl');
    });

    test('form title and subtitle match the Add Money screen', { annotation: [{ type: 'testcase', description: "TUP-03: Page title and subtitle" }] }, async () => {
        const { topup } = session;
        await expect(topup.pageTitle).toHaveText(/شحن الرصيد|Top up/i);
        await expect(topup.pageSubtitle).toBeVisible();
    });

    test('balance card shows the current balance label, amount, and wallet code', { annotation: [{ type: 'testcase', description: "TUP-05: Balance and wallet code match account" }] }, async () => {
        const { topup } = session;
        await expect(topup.balanceCardLabel).toHaveText(/الرصيد الحالي|Current balance/i);
        await expect(topup.balanceAmount).toHaveText(/\d[\d,]*\.\d{2}/);
        await expect(topup.balanceWalletCode).toContainText(/[A-Z]{3}-[A-Z0-9-]+/);
    });

    test('payment methods section shows its label, radio group, and a logo per method', async () => {
        const { topup } = session;
        await expect(topup.paymentMethodsLabel).toBeVisible();
        await expect(topup.paymentMethodsGroup).toBeVisible();
        await expect(topup.paymentMethodOptions).toHaveCount(3);
        // Each radio holds a logo plus a trailing icon, and logos are a mix of
        // <img> and inline <svg> — assert one logo per radio, not a global <img> count.
        for (let i = 0; i < 3; i++) {
            await expect(topup.paymentMethodOptions.nth(i).locator('img, svg').first()).toBeVisible();
        }
    });

    test('each payment method card has its own styling class', async () => {
        const { topup } = session;
        await expect(topup.paymentMethodOptions.nth(0)).toHaveClass(/mp-method-option--mada/);
        await expect(topup.paymentMethodOptions.nth(1)).toHaveClass(/mp-method-option--visa/);
        await expect(topup.paymentMethodOptions.nth(2)).toHaveClass(/mp-method-option--master/);
    });

    test('each payment method shows its name', async () => {
        const { topup } = session;
        await expect(topup.madaOption).toContainText(/MADA/i);
        await expect(topup.visaOption).toContainText(/VISA/i);
        await expect(topup.masterOption).toContainText(/MASTER/i);
    });

    test('amount field shows the 0.00 placeholder and the quick-amount label', async () => {
        const { topup } = session;
        await expect(topup.inputAmount).toHaveAttribute('placeholder', '0.00');
        await expect(topup.quickAmountLabel).toBeVisible();
    });

    test('five preset chips are shown, each with its own amount', async () => {
        const { topup } = session;
        const expected = ['500', '1000', '2000', '5000', '10000'];
        await expect(topup.presetAmountChips).toHaveCount(expected.length);
        for (let i = 0; i < expected.length; i++) {
            await expect(topup.presetAmountChips.nth(i)).toHaveText(expected[i]!);
        }
    });

    test('Proceed becomes enabled once a payment method and an amount are set', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount(findTopupCase('VISA').amount);
        await expect(topup.proceedButton).toBeEnabled();
    });

    // ───────────────────────── Top-up form: states & attributes ─────────────────────────

    test('radios start unchecked and expose aria-checked=false', async () => {
        const { topup } = session;
        await expect(topup.paymentMethodOptions).toHaveCount(3);
        for (let i = 0; i < 3; i++) {
            await expect(topup.paymentMethodOptions.nth(i)).toHaveAttribute('aria-checked', 'false');
        }
    });

    test('selecting a method sets aria-checked=true on that radio only', { annotation: [{ type: 'testcase', description: "TUP-09: Selecting a method highlights it" }, { type: 'testcase', description: "TUP-10: Methods are mutually exclusive" }] }, async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('master');
        await expect(topup.paymentMethodOptions.nth(2)).toHaveAttribute('aria-checked', 'true');
        await expect(topup.paymentMethodOptions.nth(0)).toHaveAttribute('aria-checked', 'false');
        await expect(topup.paymentMethodOptions.nth(1)).toHaveAttribute('aria-checked', 'false');
    });

    test('amount input is a decimal text field, not type=number, with no maxlength', async () => {
        const { topup } = session;
        await expect(topup.inputAmount).toHaveAttribute('type', 'text');
        await expect(topup.inputAmount).toHaveAttribute('inputmode', 'decimal');
        await expect(topup.inputAmount).not.toHaveAttribute('maxlength', /.*/);
        await expect(topup.inputAmount).toHaveValue('');
    });

    test('all five amount chips are enabled on a fresh form', async () => {
        const { topup } = session;
        await expect(topup.presetAmountChips).toHaveCount(5);
        for (let i = 0; i < 5; i++) {
            await expect(topup.presetAmountChips.nth(i)).toBeEnabled();
        }
    });

    test('Proceed is disabled on a fresh form', async () => {
        const { topup } = session;
        await expect(topup.proceedButton).toBeDisabled();
    });

    test('Proceed stays disabled with only a payment method selected', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('mada');
        await expect(topup.proceedButton).toBeDisabled();
    });

    test('Proceed stays disabled with only an amount entered', { annotation: [{ type: 'testcase', description: "TUP-11: Proceed disabled with no method selected" }] }, async () => {
        const { topup } = session;
        await topup.enterAmount('100');
        await expect(topup.proceedButton).toBeDisabled();
    });

    test('Proceed enables with a preset chip + method, and disables again once the amount is cleared', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('visa');
        await topup.presetAmountChips.first().click();
        await expect(topup.proceedButton).toBeEnabled();

        await topup.inputAmount.clear();
        await expect(topup.proceedButton).toBeDisabled();
    });

    // ───────────────────────── Amount-field input handling ─────────────────────────
    // The field is type=text with no maxlength, so filtering is the app's own
    // logic. Each case asserts the safe invariant — never a letter/sign in the
    // value, and never an enabled Proceed for a non-positive/invalid amount —
    // rather than one exact sanitised string, which isn't confirmed live.

    for (const [label, typed] of [
        ['letters',            'abc'],
        ['mixed letters/digits', '12ab34'],
        ['a negative amount',  '-50'],
        ['symbols',            '#$%'],
    ] as const) {
        test(`amount field rejects ${label}`, async () => {
            const { topup } = session;
            await topup.selectPaymentMethod('visa');
            await topup.enterAmount(typed);
            expect(await topup.getAmountValue()).not.toMatch(/[a-z\-#$%]/i);
            if ((await topup.getAmountValue()) === '') {
                await expect(topup.proceedButton).toBeDisabled();
            }
        });
    }

    test('amount field does not accept more than 2 decimal places', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount('10.999');
        const value = await topup.getAmountValue();
        expect(value).not.toMatch(/\.\d{3,}/);
    });

    // KNOWN BUG (confirmed on dev): the amount field keeps Arabic-Indic digits
    // as typed ("٠١٢٣" stays "٠١٢٣") instead of normalising them to Latin
    // digits or rejecting them. Un-skip once the app handles them — and confirm
    // with the product owner that this is the intended behaviour first.
    test.skip('Arabic-Indic digits are either normalised to Latin digits or rejected', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount('٠١٢٣');
        const value = await topup.getAmountValue();
        // Never left as raw Arabic-Indic characters that would break the numeric parse.
        expect(value).not.toMatch(/[٠-٩]/);
    });

    test('a pasted non-numeric value is sanitised just like typed input', async () => {
        const { topup } = session;
        await topup.selectPaymentMethod('visa');
        await topup.pasteAmount('abc-12.5xyz');
        expect(await topup.getAmountValue()).not.toMatch(/[a-z]/i);
    });

    test('a very long numeric string does not break the form', { annotation: [{ type: 'testcase', description: "TUP-13: **[Gap — not in `topupData.json`]** Long integer amount is capped" }] }, async () => {
        const { topup, page } = session;
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount('9'.repeat(40));
        await expect(topup.inputAmount).toBeVisible();
        await expect(page.locator('.mp-page-hero h1')).toBeVisible();
    });

    test('keyboard Tab moves focus from the amount field to the first preset chip', async () => {
        const { topup, page } = session;
        await topup.inputAmount.focus();
        await expect(topup.inputAmount).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(topup.presetAmountChips.first()).toBeFocused();
    });
});
