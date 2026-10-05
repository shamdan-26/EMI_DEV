import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, completeCardPayment, HOME_URL, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — the Payment Failed screen. Reached by three UAT gateway simulator
// results: "User canceled" (code 2, used for the main checks), "Error, limit
// exceeded" (4) and "Error, too many tries" (5). Success and failure share
// ONE component with the same classes (.mp-result-title / .mp-result-desc /
// .mp-btn-wide), so a bare visibility check on those would pass on both —
// every assertion here pins the title/description TEXT to the failure copy,
// and the success copy is asserted absent. Fails one payment in beforeAll.

const FAILED_TITLE  = /فشلت الدفعة|payment failed/i;
const SUCCESS_TITLE = /دفعة ناجحة|successful payment/i;

test.describe('Topup – Payment Failed UI', { tag: ['@topup', '@ui'], annotation: [{ type: 'feature', description: 'Topup' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(180000);

    let session: TopupSession;
    let balanceBefore = 0;

    test.beforeAll(async ({ browser }) => {
        // test.setTimeout at describe level doesn't cover hooks, and this one makes a real payment.
        test.setTimeout(180000);
        session = await loginToTopup(browser, TOPUP_UI_ACCOUNT);
        await gotoTopupScreen(session);
        balanceBefore = await session.topup.getBalanceBeforeTopup();
        await completeCardPayment(session, 'visa', findTopupCase('VISA'), '2');
        await session.topup.resultTitle.waitFor({ state: 'visible', timeout: 30000 });
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    test('result title and description show the FAILURE copy, not success', { annotation: [{ type: 'testcase', description: "TUP-33: Declined payment leaves balance unchanged" }] }, async () => {
        const { topup } = session;
        await expect(topup.pageTitle).toHaveText(/شحن الرصيد|Top up/i);
        await expect(topup.resultTitle).toHaveText(FAILED_TITLE);
        await expect(topup.resultTitle).not.toHaveText(SUCCESS_TITLE);
        await expect(topup.resultDescription).toHaveText(/غير ناجحة|unsuccessful/i);
        await expect(topup.resultDescription).not.toHaveText(/بنجاح|successfully/i);
    });

    test('a failure icon is shown, with the is-failed state', async () => {
        const { topup } = session;
        await expect(topup.resultIcon).toBeVisible();
        await expect(topup.resultContainer).toBeVisible();
        await expect(topup.resultIcon).toHaveClass(/is-failed/);
        await expect(topup.resultIcon).not.toHaveClass(/is-(pending|success)/);
    });

    test('the OK button is visible, enabled and primary', async () => {
        const { topup } = session;
        await expect(topup.resultOkButton).toBeVisible();
        await expect(topup.resultOkButton).toBeEnabled();
        await expect(topup.resultOkButton).toHaveClass(/btn-primary/);
        await expect(topup.resultOkButton).toHaveText(/موافق|ok/i);
    });

    test('the URL stays on /transfer/top-up', async () => {
        await expect(session.page).toHaveURL(/\/transfer\/top-up/);
    });

    test('the balance card, form and summary are not shown', async () => {
        const { topup } = session;
        await expect(topup.balanceAmount).toBeHidden();
        await expect(topup.balanceQrButton).toBeHidden();
        await expect(topup.inputAmount).toBeHidden();
        await expect(topup.summaryRows).toHaveCount(0);
    });

    test('the sidebar and header are still present', async () => {
        const { shell } = session;
        await expect(shell.sidebar).toBeVisible();
        await expect(shell.profileAvatar).toBeVisible();
    });

    // KNOWN BUG: no failure reason / error code, no Retry or "Try another
    // method" action, no reference ID and no support link — the user can't
    // tell why it failed or whether they were charged. Un-skip once added.
    test.skip('the failure screen explains the reason and offers a retry action', async () => {
        const { topup } = session;
        await expect(topup.page.getByRole('button', { name: /retry|try again|إعادة المحاولة/i })).toBeVisible();
        await expect(topup.page.getByText(/reference|مرجع|رقم العملية/i)).toBeVisible();
    });

    // KNOWN BUG: the aria-live="polite" region is empty, so the failure is
    // never announced to screen readers. Un-skip once the message is in it.
    test.skip('the failure message is announced through the aria-live region', async () => {
        const { topup } = session;
        await expect(topup.resultLiveRegion.filter({ hasText: FAILED_TITLE })).toHaveCount(1);
    });

    // KNOWN COPY ISSUE: "غير ناجحة" reads like a translation; "لم تتم عملية
    // الدفع" or "تعذر إتمام الدفع" is more natural. Un-skip once reworded.
    test.skip('the failure description uses natural Arabic copy', async () => {
        const { topup } = session;
        await expect(topup.resultDescription).toHaveText(/لم تتم عملية الدفع|تعذر إتمام الدفع/);
    });

    // Reloading must never turn the failure into a success or re-submit the payment.
    test('reloading the failure screen does not open a new gateway popup or show success', async () => {
        const { page, topup } = session;
        let extraWindows = 0;
        const onPage = () => { extraWindows++; };
        page.context().on('page', onPage);

        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await expect(topup.pageTitle).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        page.context().off('page', onPage);
        expect(extraWindows, 'reload must not trigger a new payment popup').toBe(0);
        // The reload drops the result screen (the app returns to the form), so
        // count matches rather than `.not.toHaveText` — that needs the element to exist.
        await expect(topup.resultTitle.filter({ hasText: SUCCESS_TITLE })).toHaveCount(0);
    });

    // Browser Back from a result returns to the homepage, same as the other steps.
    test('browser Back from the failure screen returns to the homepage', async () => {
        const { page, topup } = session;
        await gotoTopupScreen(session);
        await completeCardPayment(session, 'visa', findTopupCase('VISA'), '2');
        await topup.resultTitle.waitFor({ state: 'visible', timeout: 30000 });
        await expect(topup.resultTitle).toHaveText(FAILED_TITLE);

        await page.goBack();
        await expect(page).toHaveURL(/\/business\/main\/home/, { timeout: 15000 });
    });

    // The same failure screen is reached from every gateway result that isn't a
    // success or pending. The simulators differ by card scheme:
    //   VISA   (HyperPay):    2 = User canceled (beforeAll above), 4 = limit
    //                         exceeded, 5 = too many tries.
    //   MADA / MASTER (3-D Secure, "Select authentication outcome"):
    //                         X = Cancel, U = Technical error.
    // Each must land on the identical failure copy — not Pending or Success —
    // and OK must clear the screen.
    const visaErrors   = [['4', 'limit exceeded'], ['5', 'too many tries']] as const;
    const threeDsFails = [['X', 'user canceled'], ['U', 'technical error']] as const;
    for (const [method, caseKey, codes] of [
        ['visa',   'VISA',   visaErrors],
        ['mada',   'MADA',   threeDsFails],
        ['master', 'MASTER', [...threeDsFails, ['N', 'declined']]],
    ] as const) {
      for (const [code, label] of codes) {
        test(`a ${method.toUpperCase()} "${label}" result shows the same Payment Failed screen`, async () => {
            const { topup } = session;
            await gotoTopupScreen(session);
            await completeCardPayment(session, method, findTopupCase(caseKey), code);
            await topup.resultTitle.waitFor({ state: 'visible', timeout: 30000 });

            await expect(topup.resultTitle).toHaveText(FAILED_TITLE);
            await expect(topup.resultTitle).not.toHaveText(SUCCESS_TITLE);
            await expect(topup.resultDescription).toHaveText(/غير ناجحة|unsuccessful/i);

            await topup.clickResultOkButton();
            await expect(topup.resultTitle).toBeHidden({ timeout: 15000 });
        });
      }
    }

    // OK returns to the first page of the Topup flow (the empty form), and the
    // failed attempts must not have moved the wallet balance.
    test('OK returns to the empty Topup form and the balance is unchanged', async () => {
        const { page, topup } = session;
        await gotoTopupScreen(session);
        await completeCardPayment(session, 'visa', findTopupCase('VISA'), '2');
        await topup.resultTitle.waitFor({ state: 'visible', timeout: 30000 });
        await expect(topup.resultTitle).toHaveText(FAILED_TITLE);

        await topup.clickResultOkButton();
        await expect(topup.resultTitle).toBeHidden({ timeout: 15000 });
        await expect(page).toHaveURL(/\/transfer\/top-up/);
        await expect(topup.inputAmount).toBeVisible();
        await expect(topup.inputAmount).toHaveValue('');
        await expect(topup.proceedButton).toBeDisabled();

        await page.goto(HOME_URL);
        await gotoTopupScreen(session);
        expect(await topup.getBalanceBeforeTopup()).toBe(balanceBefore);
    });
});
