import { test, expect, Page } from '@playwright/test';
import { goToFinancialStep, goToFinancialStepWithDedicatedAsset, selectRandomOption } from '../RegistrationHelper';
import { RegistrationFinancialPage } from '../../pageElements/Registration/RegistrationFinancialPage';

// ─────────────────────────────────────────────────────────────────────────────
// Read-only assertions share a single registered session (one beforeAll) instead
// of each re-driving the full mobile->OTP->Business Info flow. None of these
// tests fill fields, click Next/Back, or otherwise mutate the Financial step,
// so a single arrival is safe to reuse across all of them. Anything that fills
// fields, opens a dropdown overlay, or navigates away stays in the stateful
// describe block below with its own fresh registration per test.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration – Financial & Business Step (Tab 2 of 3) — read-only', { tag: ['@registration', '@ui'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let page: Page;
    let financial: RegistrationFinancialPage;

    test.beforeAll(async ({ browser }) => {
        // Same reasoning as the stateful block's beforeEach — goToFinancialStep can
        // retry up to 10 times, each a full mobile->OTP->Business Info round trip.
        // 300s cut it close (confirmed: 10/10 attempts fit exactly once, no margin
        // left) — matching the stateful block's 600_000 for real headroom.
        test.setTimeout(600_000);
        const context = await browser.newContext();
        page = await context.newPage();
        await goToFinancialStep(page);
        financial = new RegistrationFinancialPage(page);
    });

    test.afterAll(async () => { await page.close(); });

    // ── Header ────────────────────────────────────────────────────────────────

    test('should display the MJD Pay logo', async () => {
        await expect(financial.logoImage).toBeVisible();
    });

    test('should link the MJD Pay logo to the landing page', async () => {
        await expect(financial.logoLink).toHaveAttribute('href', /\/business\/landing/);
    });

    test('should display the EN language button', async () => {
        await expect(financial.enButton).toBeVisible();
    });

    test('should display the Arabic language button', async () => {
        await expect(financial.arabicButton).toBeVisible();
    });

    test('should display the Switch theme button', async () => {
        await expect(financial.themeToggle).toBeVisible();
    });

    test('should show the Financial & Business step fields on arrival', { annotation: [{ type: 'testcase', description: "RF-06: Show the Financial & Business step fields on arrival" }] }, async () => {
        await expect(page.getByRole('textbox', { name: /monthly expected number|العدد الشهري المتوقع للفواتير/i })).toBeVisible();
        await expect(page.getByRole('textbox', { name: /monthly expected sum|إجمالي الفواتير الصادرة/i })).toBeVisible();
        await expect(page.getByRole('textbox', { name: /monthly withdrawal|السحب الشهري/i })).toBeVisible();
        await expect(page.getByRole('textbox', { name: /monthly deposit|الإيداع الشهري/i })).toBeVisible();
        await expect(page.locator('#mat-select-value-0.mat-mdc-select-value')).toBeVisible();
        await expect(page.locator('#mat-select-value-1.mat-mdc-select-value')).toBeVisible();
        await expect(page.getByRole('button', { name: /back|رجوع/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /next|التالي/i })).toBeVisible();
        await expect(page.locator('.mp-step.is-active .mp-step-meta .mp-step-num')).toContainText('1');
    });

    // ── Step indicator ────────────────────────────────────────────────────────

    test('should show the Financial & Business tab as active', { annotation: [{ type: 'testcase', description: "RF-07: Show the Financial & Business tab as active" }] }, async () => {
        await expect(page.locator('#register-form-title.form-title')).toContainText(/financial|البيانات المالية/i);
    });

    test('should mark the Financial & Business inner tab as active (is-active)', { annotation: [{ type: 'testcase', description: "RF-08: Mark the Financial & Business inner tab as active (is-active)" }] }, async () => {
        await expect(page.locator('.mp-stepbar .mp-step.is-active')).toBeVisible();
    });

    test('should display all four step indicators', { annotation: [{ type: 'testcase', description: "RF-09: Display all four step indicators" }] }, async () => {
        await expect(page.getByText(/business info|بيانات النشاط/i).first()).toBeVisible();
        await expect(page.getByText(/nafath|نَفاذ|نفاذ/i).first()).toBeVisible();
        await expect(page.getByText(/products|المنتجات/i).first()).toBeVisible();
        await expect(page.getByText(/contract|العقد/i).first()).toBeVisible();
    });

    // ── Monthly Expected Number of Bills ──────────────────────────────────────

    test('should display the Monthly Expected Number Of Bills label', { annotation: [{ type: 'testcase', description: "RF-10: Display the Monthly Expected Number Of Bills label" }] }, async () => {
        await expect(page.getByText(/monthly expected number of bills|العدد الشهري المتوقع للفواتير/i).first()).toBeVisible();
    });

    test('should display the Monthly Expected Number Of Bills field', { annotation: [{ type: 'testcase', description: "RF-11: Display the Monthly Expected Number Of Bills field" }] }, async () => {
        await expect(page.getByRole('textbox', { name: /monthly expected number|العدد الشهري المتوقع للفواتير/i })).toBeVisible();
    });

    test('should show the correct placeholder for Monthly Expected Number Of Bills', async () => {
        await expect(page.getByRole('textbox', { name: /monthly expected number|العدد الشهري المتوقع للفواتير/i }))
            .toHaveAttribute('placeholder', /2000/i);
    });

    // ── Monthly Expected Sum of Bills ─────────────────────────────────────────

    test('should display the Monthly Expected Sum Of Bills label', { annotation: [{ type: 'testcase', description: "RF-13: Display the Monthly Expected Sum Of Bills label" }] }, async () => {
        await expect(page.getByText(/monthly expected sum of bills|إجمالي الفواتير الصادرة/i).first()).toBeVisible();
    });

    test('should display the Monthly Expected Sum Of Bills field', { annotation: [{ type: 'testcase', description: "RF-14: Display the Monthly Expected Sum Of Bills field" }] }, async () => {
        await expect(page.getByRole('textbox', { name: /monthly expected sum|إجمالي الفواتير الصادرة/i })).toBeVisible();
    });

    test('should show the correct placeholder for Monthly Expected Sum Of Bills', async () => {
        await expect(page.getByRole('textbox', { name: /monthly expected sum|إجمالي الفواتير الصادرة/i }))
            .toHaveAttribute('placeholder', /2000/i);
    });

    // ── Expected Monthly Withdrawal ───────────────────────────────────────────

    test('should display the Expected Monthly Withdrawal label', { annotation: [{ type: 'testcase', description: "RF-16: Display the Expected Monthly Withdrawal label" }] }, async () => {
        await expect(page.getByText(/expected monthly withdrawal|السحب الشهري/i).first()).toBeVisible();
    });

    test('should display the Expected Monthly Withdrawal field', { annotation: [{ type: 'testcase', description: "RF-17: Display the Expected Monthly Withdrawal field" }] }, async () => {
        await expect(page.getByRole('textbox', { name: /monthly withdrawal|السحب الشهري/i })).toBeVisible();
    });

    test('should show the correct placeholder for Expected Monthly Withdrawal', { annotation: [{ type: 'testcase', description: "RF-18: Show the correct placeholder for Expected Monthly Withdrawal" }] }, async () => {
        await expect(page.getByRole('textbox', { name: /monthly withdrawal|السحب الشهري/i }))
            .toHaveAttribute('placeholder', /2000/i);
    });

    // ── Expected Monthly Deposit ──────────────────────────────────────────────

    test('should display the Expected Monthly Deposit label', { annotation: [{ type: 'testcase', description: "RF-19: Display the Expected Monthly Deposit label" }] }, async () => {
        await expect(page.getByText(/expected monthly deposit|الإيداع الشهري/i).first()).toBeVisible();
    });

    test('should display the Expected Monthly Deposit field', { annotation: [{ type: 'testcase', description: "RF-20: Display the Expected Monthly Deposit field" }] }, async () => {
        await expect(page.getByRole('textbox', { name: /monthly deposit|الإيداع الشهري/i })).toBeVisible();
    });

    test('should show the correct placeholder for Expected Monthly Deposit', { annotation: [{ type: 'testcase', description: "RF-21: Show the correct placeholder for Expected Monthly Deposit" }] }, async () => {
        await expect(page.getByRole('textbox', { name: /monthly deposit|الإيداع الشهري/i }))
            .toHaveAttribute('placeholder', /2000/i);
    });

    // ── Industries dropdown ───────────────────────────────────────────────────
    // Industries and Annual Income are the only two dropdowns present on arrival
    // (mat-select-value-0 and -1 respectively) — Banks does not render until the
    // internal sub-step "Next" (#btn_signup) is clicked, see the stateful
    // "should display the Banks dropdown label" test below.

    test('should display the Industries dropdown label', { annotation: [{ type: 'testcase', description: "RF-22: Display the Industries dropdown label" }] }, async () => {
        await expect(page.getByText(/industries|القطاعات/i).first()).toBeVisible();
    });

    test('should display the Industries dropdown', { annotation: [{ type: 'testcase', description: "RF-23: Display the Industries dropdown" }] }, async () => {
        await expect(page.locator('#mat-select-value-0.mat-mdc-select-value')).toBeVisible();
    });

    test('should show "Select Option" as the default for Industries', { annotation: [{ type: 'testcase', description: "RF-24: Show \"Select Option\" as the default for Industries" }] }, async () => {
        // Matches the diacritic-independent prefix "اختر خيار" rather than the full
        // word with its trailing tanween fatha — the app renders that mark as
        // alef-then-diacritic ("خياراً"), while a literal "اختر خيارًا" in the regex
        // encodes diacritic-then-alef, a different Unicode sequence for the same
        // "select an option" reading. Confirmed live: toContainText timed out
        // against the real rendered text ("اختر خياراً") because of that byte-level
        // mismatch, not a timing/rendering issue.
        await expect(page.locator('#mat-select-value-0 .mat-mdc-select-placeholder.mat-mdc-select-min-line.ng-star-inserted')).toContainText(/select option|اختر خيار/i);
    });

    // ── Annual Income dropdown ────────────────────────────────────────────────
    // Scoped via the mat-select's data-testid rather than the floating label's
    // "for" id — that id is an Angular-wide auto-increment counter
    // ("floating-dropdown-annualincomecode-N") that shifts whenever an unrelated
    // field earlier on the page is added/removed, which is exactly what broke
    // the previous hardcoded "-10" locator.

    test('should display the Annual Income dropdown label', { annotation: [{ type: 'testcase', description: "RF-25: Display the Annual Income dropdown label" }] }, async () => {
        await expect(
            page.locator('.floating-field-shell', { has: page.locator('[data-testid="register-annual-income"]') })
                .locator('label.floating-field-label')
        ).toContainText(/annual income|الدخل السنوي/i);
    });

    test('should display the Annual Income dropdown', { annotation: [{ type: 'testcase', description: "RF-26: Display the Annual Income dropdown" }] }, async () => {
        await expect(page.locator('[data-testid="register-annual-income"]')).toBeVisible();
    });

    test('should show "Select Option" as the default for Annual Income', { annotation: [{ type: 'testcase', description: "RF-27: Show \"Select Option\" as the default for Annual Income" }] }, async () => {
        // See the matching Industries test above for why this matches the
        // diacritic-independent prefix rather than the full word.
        await expect(page.locator('#mat-select-value-1 .mat-mdc-select-placeholder.mat-mdc-select-min-line.ng-star-inserted')).toContainText(/select option|اختر خيار/i);
    });

    // ── Navigation buttons ────────────────────────────────────────────────────

    test('should display the Back button', async () => {
        await expect(page.getByRole('button', { name: /back|رجوع/i })).toBeVisible();
    });

    test('should display the Next button', async () => {
        await expect(page.getByRole('button', { name: /next|التالي/i })).toBeVisible();
    });

    test('should keep Next disabled when required fields are empty', { annotation: [{ type: 'testcase', description: "RF-30: Keep Next disabled when required fields are empty" }] }, async () => {
        await expect(page.getByRole('button', { name: /next|التالي/i })).toBeDisabled();
    });

    // ── Footer ────────────────────────────────────────────────────────────────

    test('should display "Already have an account?" text', async () => {
        await expect(page.locator('#login-line.new-user span').filter({ visible: true }).first()).toBeVisible();
    });

    test('should display the Log In link', async () => {
        await expect(financial.loginLink).toContainText(/log.?in|تسجيل الدخول/i);
    });

    test('should display "By continuing, you agree to our" text', async () => {
        // .filter({ visible: true }) is required here — like the "Already have an
        // account?" test above, .first() alone can land on a hidden duplicate
        // (Angular CDK a11y live-announcer clone) instead of the rendered span.
        await expect(
            page.locator('#login-line span', { hasText: /By continuing, you agree to our|بالمتابعة، فإنك توافق على/i })
                .filter({ visible: true }).first()
        ).toBeVisible();
    });

    test('should display Terms & Conditions link', async () => {
        await expect(page.locator('span.text-primary.link').filter({ hasText: /terms & conditions|الشروط والأحكام/i }).filter({ visible: true }).first()).toBeVisible();
    });

    test('should display Privacy Policy link', async () => {
        await expect(page.locator('span.text-primary.link').filter({ hasText: /privacy policy|سياسة الخصوصية/i }).filter({ visible: true }).first()).toBeVisible();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stateful / mutating tests — each fills fields, opens a dropdown overlay, or
// navigates away from the Financial step, so each needs its own fresh
// registration to avoid interfering with the next test.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration – Financial & Business Step (Tab 2 of 3) — stateful', { tag: ['@registration', '@ui'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'ui' }] }, () => {
    // Serial, not parallel: each test's beforeEach drives a full mobile->OTP->
    // Business Info registration against a small shared resident-asset pool.
    // Running these across workers was tried and reverted — concurrent
    // registrations collide on the shared pool and the OTP/registration flow
    // in this environment can't reliably handle simultaneous attempts (13/40
    // tests failed with worker parallelism). Slow but correct beats fast and flaky.
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        // goToFinancialStep can retry up to 10 times (already-registered / already-
        // progressed assets), each attempt a full mobile -> OTP -> Business Info
        // round trip. test.setTimeout() covers the WHOLE test (this hook plus the
        // test body), not just the hook — a run that succeeds late (e.g. attempt
        // 5/10) can burn most of a too-small budget on retries alone, starving the
        // test body's own assertions and surfacing as a misleading "locator.fill:
        // Test timeout exceeded" on a perfectly valid locator (confirmed via a live
        // run: 4 stale attempts + 1 success ate ~290s of a 300s budget, leaving
        // .fill() almost nothing). Sized for a worst-case 10 attempts (~50s each
        // without the old IMAP wait) plus real headroom for the test body.
        test.setTimeout(600_000);
        await goToFinancialStep(page);
    });

    test('should accept numeric input for Monthly Expected Sum Of Bills', async ({ page }) => {
        await page.getByRole('textbox', { name: /monthly expected sum|إجمالي الفواتير الصادرة/i }).fill('50000');
        await expect(page.getByRole('textbox', { name: /monthly expected sum|إجمالي الفواتير الصادرة/i })).toHaveValue('50000');
    });

    test('should accept numeric input for Expected Monthly Withdrawal', async ({ page }) => {
        await page.getByRole('textbox', { name: /monthly withdrawal|السحب الشهري/i }).fill('10000');
        await expect(page.getByRole('textbox', { name: /monthly withdrawal|السحب الشهري/i })).toHaveValue('10000');
    });

    test('should accept numeric input for Expected Monthly Deposit', async ({ page }) => {
        await page.getByRole('textbox', { name: /monthly deposit|الإيداع الشهري/i }).fill('20000');
        await expect(page.getByRole('textbox', { name: /monthly deposit|الإيداع الشهري/i })).toHaveValue('20000');
    });

    test('should display the Banks dropdown label', { annotation: [{ type: 'testcase', description: "RF-39: Display the Banks dropdown label" }] }, async ({ page }) => {
        // Banks/Industries only render after Section 1 is completed and the
        // internal stepper "Next" (#btn_signup, class="mat-stepper-next ...") is
        // clicked — they are not present on arrival.

        await page.getByRole('textbox', { name: /monthly expected number|العدد الشهري المتوقع للفواتير/i }).fill('1500');
        await page.getByRole('textbox', { name: /monthly expected sum|إجمالي الفواتير الصادرة/i }).fill('50000');
        await page.getByRole('textbox', { name: /monthly withdrawal|السحب الشهري/i }).fill('10000');
        await page.getByRole('textbox', { name: /monthly deposit|الإيداع الشهري/i }).fill('20000');


        await expect(page.locator('.floating-field-label.ng-star-inserted', { hasText: /industries|القطاعات/i })).toBeVisible();
        await selectRandomOption(page, page.locator('#mat-select-value-0'));

        await expect(page.locator('.floating-field-label.ng-star-inserted', { hasText: /annual income|الدخل السنوي/i })).toBeVisible();
        await selectRandomOption(page, page.locator('#mat-select-value-1'));

        await page.locator('.mat-stepper-next').click();

        await expect(page.getByText(/banks|البنك/i).first()).toBeVisible();
    });

    test('should open the Industries dropdown when clicked', async ({ page }) => {
        // Industries is mat-select-value-0 on arrival — Banks and Annual Income are
        // mat-select-value-1 at different points (Annual Income pre-advance, Banks
        // post-advance), so index 0 is the only unambiguous one on arrival.
        await page.locator('#mat-select-value-0.mat-mdc-select-value').click();
        await expect(page.locator('mat-option').first()).toBeVisible({ timeout: 5000 });
    });

    test('should open the Annual Income dropdown when clicked', async ({ page }) => {
        await page.locator('#mat-select-value-1.mat-mdc-select-value').click();
        await expect(page.locator('mat-option').first()).toBeVisible({ timeout: 5000 });
    });

    test('should open the Banks dropdown when clicked', { annotation: [{ type: 'testcase', description: "RF-42: Open the Banks dropdown when clicked" }] }, async ({ page }) => {
        // Banks only renders after Section 1 is completed and the internal
        // stepper "Next" (#btn_signup) is clicked — same setup as "should display
        // the Banks dropdown label" above.
        await page.getByRole('textbox', { name: /monthly expected number|العدد الشهري المتوقع للفواتير/i }).fill('1500');
        await page.getByRole('textbox', { name: /monthly expected sum|إجمالي الفواتير الصادرة/i }).fill('50000');
        await page.getByRole('textbox', { name: /monthly withdrawal|السحب الشهري/i }).fill('10000');
        await page.getByRole('textbox', { name: /monthly deposit|الإيداع الشهري/i }).fill('20000');

        await selectRandomOption(page, page.locator('#mat-select-value-0'));
        await selectRandomOption(page, page.locator('#mat-select-value-1'));

        await page.locator('.mat-stepper-next').click();

        const financial = new RegistrationFinancialPage(page);
        await financial.banksDropdown.click();
        await expect(page.locator('mat-option').first()).toBeVisible({ timeout: 5000 });
    });

    test('should return to Business Info tab when Back is clicked', { annotation: [{ type: 'testcase', description: "RF-43: Return to Business Info tab when Back is clicked" }] }, async ({ page }) => {
        await page.getByRole('button', { name: /back|رجوع/i }).click();
        await expect(page.locator('.mp-step.is-active .mp-step-num')).toContainText('1', { timeout: 10000 });
    });

    test('should proceed to Verification & Uploads tab when Next is clicked with valid data', { annotation: [{ type: 'testcase', description: "RF-44: Proceed to Verification & Uploads tab when Next is clicked with valid data" }] }, async ({ page }) => {
        await page.getByRole('textbox', { name: /monthly expected number|العدد الشهري المتوقع للفواتير/i }).fill('1500');
        await page.getByRole('textbox', { name: /monthly expected sum|إجمالي الفواتير الصادرة/i }).fill('50000');
        await page.getByRole('textbox', { name: /monthly withdrawal|السحب الشهري/i }).fill('10000');
        await page.getByRole('textbox', { name: /monthly deposit|الإيداع الشهري/i }).fill('20000');

        await selectRandomOption(page, page.locator('#mat-select-value-0.mat-mdc-select-value'));
        await selectRandomOption(page, page.locator('#mat-select-value-1.mat-mdc-select-value'));

        await page.getByRole('button', { name: /next|التالي/i }).click();
        await expect(page.locator('#register-form-title.form-title'))
            .toContainText(/verification & documents|التحقق والمستندات/i, { timeout: 10000 });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// This test owns its own resident asset outright rather than sharing the
// stateful block's beforeEach (which draws via goToFinancialStep's implicit
// nextResidentAsset() round-robin + retry-cycling). goToFinancialStepWithDedicatedAsset
// draws from its own small reserved pool first, so this test starts out isolated
// from the rest of the suite's contention over the shared pool — but it now falls
// back to nextResidentAsset()'s general pool (DEDICATED_FALLBACK_THRESHOLD in
// RegistrationHelper.ts) once 5 dedicated-pool draws in a row turn out already
// progressed, trading a bit of that isolation for a bounded worst-case runtime.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration – Financial & Business Step (Tab 2 of 3) — dedicated asset', { tag: ['@registration', '@ui'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        // goToFinancialStepWithDedicatedAsset can still retry up to 20 times total
        // (each a full mobile->OTP->Business Info round trip, ~28s), so 600_000
        // stays as the safety-margin cap — but as of the DEDICATED_FALLBACK_THRESHOLD
        // fix it bails out of the reserved pool after 5 already-progressed hits and
        // switches to the much larger general pool, where a fresh draw is likely on
        // the first try. Hitting anywhere near the full 560s worst case should now be
        // rare rather than the expected steady-state it was before that fix.
        test.setTimeout(600_000);
        await goToFinancialStepWithDedicatedAsset(page);
    });

    test('should accept numeric input for Monthly Expected Number Of Bills', async ({ page }) => {
        await page.getByRole('textbox', { name: /monthly expected number|العدد الشهري المتوقع للفواتير/i }).fill('1500');
        await expect(page.getByRole('textbox', { name: /monthly expected number|العدد الشهري المتوقع للفواتير/i })).toHaveValue('1500');
    });
});
