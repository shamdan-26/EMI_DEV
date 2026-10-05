import { test, expect, Page } from '@playwright/test';
import {
    VALID_EMAIL,
    goToFinancialStep,
    fillFinancialForm,
    selectRandomOption,
    REGISTER_URL,
} from '../RegistrationHelper';
import { RegistrationFinancialPage } from '../../pageElements/Registration/RegistrationFinancialPage';
import { RegistrationInfoPage } from '../../pageElements/Registration/RegistrationInfoPage';
import { RegistrationVerificationPage } from '../../pageElements/Registration/RegistrationVerificationPage';

test.describe('Registration - Financial & Business Functionality', { tag: ['@registration', '@functional'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(120_000);

    let page: Page;
    let financialPage: RegistrationFinancialPage;
    let infoPage: RegistrationInfoPage;

    test.beforeAll(async ({ browser }) => {
        // describe-level test.setTimeout only covers test bodies, not this hook —
        // beforeAll falls back to the global config timeout otherwise.
        // goToFinancialStep can retry up to 10 times against the shared resident
        // pool, each attempt a full mobile->OTP->Business Info round trip
        // (~30-60s). 120s was cut off mid-navigation on attempt 5/10 in a live
        // run — same class of budget-starvation bug fixed in
        // RegistrationFinancialPage.spec.ts; matching its 600_000.
        test.setTimeout(600_000);
        const context = await browser.newContext();
        page = await context.newPage();
        financialPage = new RegistrationFinancialPage(page);
        infoPage = new RegistrationInfoPage(page);
        await goToFinancialStep(page, { profileType: 'merchant', email: VALID_EMAIL });
    });

    test.afterAll(async () => {
        await page.close();
    });

    // ── Monthly Expected Number Of Bills ──────────────────────────────────────

    test('should accept numeric input for Monthly Expected Number Of Bills', async () => {
        const input = financialPage.monthlyBillsInput;
        await input.fill('1500');
        await expect(input).toHaveValue(/^\d+$/);
    });

    // ── Monthly Expected Sum Of Bills ─────────────────────────────────────────

    test('should accept numeric input for Monthly Expected Sum Of Bills', async () => {
        const input = financialPage.monthlyAmountInput;
        await input.fill('50000');
        await expect(input).toHaveValue('50000');
    });

    // ── Expected Monthly Withdrawal ───────────────────────────────────────────

    test('should accept numeric input for Expected Monthly Withdrawal', async () => {
        const input = financialPage.monthlyWithdrawalInput;
        await input.fill('10000');
        await expect(input).toHaveValue('10000');
    });

    // ── Expected Monthly Deposit ──────────────────────────────────────────────

    test('should accept numeric input for Expected Monthly Deposit', async () => {
        const input = financialPage.monthlyDepositInput;
        await input.fill('20000');
        await expect(input).toHaveValue('20000');
    });

    // ── Input validation – character filtering (all four fields) ─────────────

    test('should not accept alphabetic characters in the Monthly Expected Number field', { annotation: [{ type: 'testcase', description: "RF-50: Not accept alphabetic characters in the Monthly Expected Number field" }] }, async () => {
        const input = financialPage.monthlyBillsInput;
        await input.clear();
        await input.pressSequentially('abc');
        await expect(input).toHaveValue('');
    });

    test('should not accept special characters in the Monthly Expected Sum field', { annotation: [{ type: 'testcase', description: "RF-51: Not accept special characters in the Monthly Expected Sum field" }] }, async () => {
        const input = financialPage.monthlyAmountInput;
        await input.clear();
        await input.pressSequentially('!@#');
        await expect(input).toHaveValue('');
    });

    test('should not accept alphabetic characters in the Expected Monthly Withdrawal field', { annotation: [{ type: 'testcase', description: "RF-52: Not accept alphabetic characters in the Expected Monthly Withdrawal field" }] }, async () => {
        const input = financialPage.monthlyWithdrawalInput;
        await input.clear();
        await input.pressSequentially('xyz');
        await expect(input).toHaveValue('');
    });

    test('should not accept special characters in the Expected Monthly Deposit field', { annotation: [{ type: 'testcase', description: "RF-53: Not accept special characters in the Expected Monthly Deposit field" }] }, async () => {
        const input = financialPage.monthlyDepositInput;
        await input.clear();
        await input.pressSequentially('$%^');
        await expect(input).toHaveValue('');
    });

    // ── Boundary values ────────────────────────────────────────────────────────

    test('should not retain a negative number in the Monthly Expected Number field', { annotation: [{ type: 'testcase', description: "RF-54: Not retain a negative number in the Monthly Expected Number field" }] }, async () => {
        const input = financialPage.monthlyBillsInput;
        await input.clear();
        await input.pressSequentially('-500');
        const value = await input.inputValue();
        expect(/^-/.test(value)).toBe(false);
    });

    test('should not retain a decimal point in the Monthly Expected Sum field', { annotation: [{ type: 'testcase', description: "RF-55: Not retain a decimal point in the Monthly Expected Sum field" }] }, async () => {
        const input = financialPage.monthlyAmountInput;
        await input.clear();
        await input.pressSequentially('12.5');
        const value = await input.inputValue();
        expect(value).not.toContain('.');
    });

    test('should handle a very large value (15 digits) in the Expected Monthly Withdrawal field without crashing', { annotation: [{ type: 'testcase', description: "RF-56: Handle a very large value (15 digits) in the Expected Monthly Withdrawal field without crashing" }] }, async () => {
        const input = financialPage.monthlyWithdrawalInput;
        await input.clear();
        await input.fill('999999999999999');
        await expect(input).toBeVisible();
    });

    test('should treat a zero value in the Expected Monthly Deposit field as valid input', { annotation: [{ type: 'testcase', description: "RF-57: Treat a zero value in the Expected Monthly Deposit field as valid input" }] }, async () => {
        const input = financialPage.monthlyDepositInput;
        await input.fill('0');
        await expect(input).toHaveValue('0');
    });

    // ── Security ───────────────────────────────────────────────────────────────

    test('should not execute an XSS payload entered in the Monthly Expected Number field', async () => {
        let alertFired = false;
        page.once('dialog', dialog => { alertFired = true; dialog.dismiss(); });
        const input = financialPage.monthlyBillsInput;
        await input.fill('<script>alert("xss")</script>');
        await page.waitForTimeout(500);
        expect(alertFired).toBe(false);
    });

    test('should not execute an XSS payload entered in the Monthly Expected Sum field', async () => {
        let alertFired = false;
        page.once('dialog', dialog => { alertFired = true; dialog.dismiss(); });
        const input = financialPage.monthlyAmountInput;
        await input.fill('<img src=x onerror=alert(1)>');
        await page.waitForTimeout(500);
        expect(alertFired).toBe(false);
    });

    test('should not accept a SQL injection pattern in the Expected Monthly Withdrawal field', { annotation: [{ type: 'testcase', description: "RF-60: Not accept a SQL injection pattern in the Expected Monthly Withdrawal field" }] }, async () => {
        const input = financialPage.monthlyWithdrawalInput;
        await input.clear();
        await input.pressSequentially("1' OR '1'='1");
        const value = await input.inputValue();
        expect(/[^0-9]/.test(value)).toBe(false);
    });

    test('should not accept a SQL injection pattern in the Expected Monthly Deposit field', { annotation: [{ type: 'testcase', description: "RF-61: Not accept a SQL injection pattern in the Expected Monthly Deposit field" }] }, async () => {
        const input = financialPage.monthlyDepositInput;
        await input.clear();
        await input.pressSequentially("1; DROP TABLE users;--");
        const value = await input.inputValue();
        expect(/[^0-9]/.test(value)).toBe(false);
    });

    // Documented spec (EMI Validation confluence page): "Expected number of bills" and
    // "Expected sum of bills" must be > 0 and must not start with 0.
    test.skip('should keep Next disabled when Monthly Expected Number Of Bills is 0', { annotation: [{ type: 'testcase', description: "RF-62: Keep Next disabled when Monthly Expected Number Of Bills is 0" }] }, async () => {
        await fillFinancialForm(page);
        await financialPage.monthlyBillsInput.fill('0');
        await expect(financialPage.nextButton).toBeDisabled({ timeout: 5000 });
    });

    test.skip('should keep Next disabled when Monthly Expected Sum Of Bills has a leading zero', { annotation: [{ type: 'testcase', description: "RF-63: Keep Next disabled when Monthly Expected Sum Of Bills has a leading zero" }] }, async () => {
        await fillFinancialForm(page);
        await financialPage.monthlyAmountInput.fill('0500');
        await expect(financialPage.nextButton).toBeDisabled({ timeout: 5000 });
    });

    // Restore valid values before continuing with dropdown / navigation tests
    test('should restore valid values to all four fields after boundary/security probing', { annotation: [{ type: 'testcase', description: "RF-64: Restore valid values to all four fields after boundary/security probing" }] }, async () => {
        await financialPage.monthlyBillsInput.fill('1500');
        await financialPage.monthlyAmountInput.fill('50000');
        await financialPage.monthlyWithdrawalInput.fill('10000');
        await financialPage.monthlyDepositInput.fill('20000');
        await expect(financialPage.monthlyDepositInput).toHaveValue('20000');
    });

    // ── Industries dropdown ───────────────────────────────────────────────────
    // Only Industries (index 0) and Annual Income (index 1) render on this step
    // — see RegistrationHelper.ts goToVerificationStep(). There is no Banks select.
    // These use Angular Material's auto-generated #mat-select-value-N ids (same
    // locators RegistrationHelper.ts's own fillFinancialForm()/goToVerificationStep()
    // use) — language-agnostic since they aren't derived from visible text.

    test('should open the Industries dropdown when clicked', async () => {
        await selectRandomOption(page, page.locator('#mat-select-value-0'));
    });

    test('should reflect the selected industry in the Industries dropdown', { annotation: [{ type: 'testcase', description: "RF-66: Reflect the selected industry in the Industries dropdown" }] }, async () => {
        const dropdown = page.locator('#mat-select-value-0');
        const selected = await dropdown.textContent();
        expect(selected?.trim()).not.toMatch(/select option/i);
    });

    // ── Annual Income dropdown ────────────────────────────────────────────────

    test('should open the Annual Income dropdown when clicked', async () => {
        await selectRandomOption(page, page.locator('#mat-select-value-1'));
    });

    test('should reflect the selected income in the Annual Income dropdown', { annotation: [{ type: 'testcase', description: "RF-68: Reflect the selected income in the Annual Income dropdown" }] }, async () => {
        const dropdown = page.locator('#mat-select-value-1');
        const selected = await dropdown.textContent();
        expect(selected?.trim()).not.toMatch(/select option/i);
    });

    // ── Dropdown search filtering ─────────────────────────────────────────────
    // The mat-select panel embeds a search box (#floating-select-search-input)
    // inside a disabled placeholder option (id="floating-select-search-option",
    // aria-disabled="true" — see the exclusion filter in RegistrationHelper.ts's
    // selectRandomOption()). Angular re-enables pointer-events on the nested
    // input via CSS so a real user can still type there, but Playwright's
    // actionability check propagates the ancestor's aria-disabled and treats
    // the input as not enabled — hence { force: true } to bypass that check.

    test('should filter the Industries options when typing in the dropdown search field', { annotation: [{ type: 'testcase', description: "RF-69: Filter the Industries options when typing in the dropdown search field" }] }, async () => {
        await page.locator('#mat-select-value-0').click();
        const searchInput = page.locator('#floating-select-search-input');
        await expect(searchInput).toBeVisible({ timeout: 5000 });

        const options = page.locator('[role="option"]:visible:not([aria-disabled="true"]):not([disabled])');
        await expect(options.first()).toBeVisible({ timeout: 5000 });
        const fullText = (await options.first().textContent())?.trim() ?? '';
        const query = fullText.slice(0, 3);

        await searchInput.fill(query, { force: true });
        await expect(options.first()).toBeVisible({ timeout: 5000 });
        expect((await options.first().textContent())?.toLowerCase()).toContain(query.toLowerCase());

        await options.first().click();
    });

    test('should filter the Annual Income options when typing in the dropdown search field', { annotation: [{ type: 'testcase', description: "RF-70: Filter the Annual Income options when typing in the dropdown search field" }] }, async () => {
        await page.locator('#mat-select-value-1').click();
        const searchInput = page.locator('#floating-select-search-input');
        await expect(searchInput).toBeVisible({ timeout: 5000 });

        const options = page.locator('[role="option"]:visible:not([aria-disabled="true"]):not([disabled])');
        await expect(options.first()).toBeVisible({ timeout: 5000 });
        const fullText = (await options.first().textContent())?.trim() ?? '';
        const query = fullText.slice(0, 3);

        await searchInput.fill(query, { force: true });
        await expect(options.first()).toBeVisible({ timeout: 5000 });
        expect((await options.first().textContent())?.toLowerCase()).toContain(query.toLowerCase());

        await options.first().click();
    });

    // ── Next button state — partial completion ────────────────────────────────

    test('should keep Next disabled when only the numeric fields are filled and no dropdown is selected', { annotation: [{ type: 'testcase', description: "RF-71: Keep Next disabled when only the numeric fields are filled and no dropdown is selected" }] }, async ({ browser }) => {
        // This test draws its own identity via goToFinancialStep (default
        // credentials -> shared resident pool, up to 10 retry attempts) rather
        // than reusing the describe's shared page — same budget-starvation risk
        // as the beforeAll hook above, so it needs the same real headroom
        // instead of the describe-level 120_000 default.
        test.setTimeout(600_000);
        const context = await browser.newContext();
        const freshPage = await context.newPage();
        const freshFinancialPage = new RegistrationFinancialPage(freshPage);
        await goToFinancialStep(freshPage, { profileType: 'merchant' });
        await freshFinancialPage.monthlyBillsInput.fill('1500');
        await freshFinancialPage.monthlyAmountInput.fill('50000');
        await freshFinancialPage.monthlyWithdrawalInput.fill('10000');
        await freshFinancialPage.monthlyDepositInput.fill('20000');
        await expect(freshFinancialPage.nextButton).toBeDisabled();
        await context.close();
    });

    test('should enable Next when all required fields and dropdowns are filled', { annotation: [{ type: 'testcase', description: "RF-72: Enable Next when all required fields and dropdowns are filled" }] }, async () => {
        await fillFinancialForm(page);
        await expect(financialPage.nextButton).toBeEnabled({ timeout: 5000 });
    });

    // ── Back navigation ───────────────────────────────────────────────────────

    test('should return to the Business Info step when Back is clicked', { annotation: [{ type: 'testcase', description: "RF-73: Return to the Business Info step when Back is clicked" }] }, async () => {
        await financialPage.backButton.click();
        await expect(infoPage.emailInput).toBeVisible({ timeout: 10000 });
    });

    test('should preserve the email on Business Info step after navigating back', { annotation: [{ type: 'testcase', description: "RF-74: Preserve the email on Business Info step after navigating back" }] }, async () => {
        await expect(infoPage.emailInput).toHaveValue(VALID_EMAIL);
    });

    test('should allow re-advancing to Financial step after going back to Info step', { annotation: [{ type: 'testcase', description: "RF-75: Allow re-advancing to Financial step after going back to Info step" }] }, async () => {
        await expect(infoPage.nextButton).toBeEnabled({ timeout: 5000 });
        await infoPage.nextButton.click();
        await expect(financialPage.monthlyBillsInput).toBeVisible({ timeout: 10000 });
    });

    // ── Forward navigation to Verification ───────────────────────────────────

    test('should advance to Verification & Uploads step when Next is clicked with valid data', { annotation: [{ type: 'testcase', description: "RF-76: Advance to Verification & Uploads step when Next is clicked with valid data" }] }, async () => {
        await fillFinancialForm(page);
        await financialPage.nextButton.click();
        const verificationPage = new RegistrationVerificationPage(page);
        await expect(verificationPage.ibanInput).toBeVisible({ timeout: 10000 });
    });
});
