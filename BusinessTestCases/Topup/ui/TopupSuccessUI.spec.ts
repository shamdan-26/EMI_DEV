import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, completeCardPayment, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — the Payment Success screen that follows a completed top-up. Reaching
// it takes a REAL card payment through the gateway (the same flow as
// functional/TopupHappyPath.spec.ts), so this file pays ONCE in beforeAll
// and every test reads the resulting screen; the destructive/leaving-the-
// screen checks (reload, OK) run last, in order, so they can't disturb the
// element checks before them. Copy is matched bilingually / by `.mp-result-*`
// class — the result screen has no ids or testids (confirmed).

test.describe('Topup – Payment Success UI', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(180000);

    let session: TopupSession;

    test.beforeAll(async ({ browser }) => {
        // test.setTimeout at describe level doesn't cover hooks, and this one makes a real payment.
        test.setTimeout(180000);
        session = await loginToTopup(browser, TOPUP_UI_ACCOUNT);
        await gotoTopupScreen(session);
        await completeCardPayment(session, 'visa', findTopupCase('VISA'));
        await session.topup.resultTitle.waitFor({ state: 'visible', timeout: 30000 });
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    test('heading, result title and description are shown', async () => {
        const { topup } = session;
        await expect(topup.pageTitle).toHaveText(/شحن الرصيد|Top up/i);
        await expect(topup.resultTitle).toHaveText(/دفعة ناجحة|successful payment/i);
        await expect(topup.resultDescription).toHaveText(/تمت معالجة دفعتك بنجاح|processed successfully/i);
    });

    test('a success icon is shown, with the is-success state', async () => {
        const { topup } = session;
        await expect(topup.resultIcon).toBeVisible();
        await expect(topup.resultContainer).toBeVisible();
        await expect(topup.resultIcon).toHaveClass(/is-success/);
        await expect(topup.resultIcon).not.toHaveClass(/is-(pending|failed)/);
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

    test('the balance card is not shown on the success screen', async () => {
        const { topup } = session;
        await expect(topup.balanceAmount).toBeHidden();
        await expect(topup.balanceQrButton).toBeHidden();
        await expect(topup.balanceSettingsButton).toBeHidden();
    });

    test('the payment form and summary are no longer shown', async () => {
        const { topup } = session;
        await expect(topup.inputAmount).toBeHidden();
        await expect(topup.proceedButton).toBeHidden();
        await expect(topup.summaryRows).toHaveCount(0);
    });

    test('the sidebar and header are still present', async () => {
        const { shell } = session;
        await expect(shell.sidebar).toBeVisible();
        await expect(shell.profileAvatar).toBeVisible();
        await expect(shell.topupLink).toBeVisible();
    });

    // KNOWN BUG: the success screen shows no transaction details — no amount,
    // reference/transaction ID, date, payment method or updated balance — so
    // the user can't confirm what they paid and QA can't trace it from here.
    // Un-skip once those details are added (and add locators for each).
    test.skip('the success screen shows the amount and a transaction reference', async () => {
        const { topup } = session;
        const data = findTopupCase('VISA');
        await expect(topup.page.getByText(new RegExp(data.amount))).toBeVisible();
        await expect(topup.page.getByText(/reference|مرجع|رقم العملية/i)).toBeVisible();
    });

    // KNOWN BUG: the page has an aria-live="polite" region but it is empty, so
    // the success message is never announced to screen readers. Un-skip once
    // the result message is rendered inside it.
    test.skip('the success message is announced through the aria-live region', async () => {
        const { topup } = session;
        await expect(topup.resultLiveRegion.filter({ hasText: /دفعة ناجحة|successful payment/i })).toHaveCount(1);
    });

    // Reload runs after every element check above — the step isn't in the URL,
    // so the outcome is unconfirmed. Assert only the safety property that
    // matters: reloading must never re-submit the payment, i.e. it never lands
    // on a fresh gateway popup, and the app still renders.
    test('reloading the success screen does not re-open the payment gateway', async () => {
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
    });

    // The result isn't a history entry of its own, so browser Back skips the
    // Topup steps and returns to the homepage (and must not re-submit anything).
    test('browser Back from the success screen returns to the homepage', async () => {
        const { page } = session;
        await gotoTopupScreen(session);
        await completeCardPayment(session, 'visa', findTopupCase('VISA'));
        await session.topup.resultTitle.waitFor({ state: 'visible', timeout: 30000 });

        await page.goBack();
        await expect(page).toHaveURL(/\/business\/main\/home/, { timeout: 15000 });
    });

    // OK is the last step: it returns to the first page of the Topup flow —
    // the empty amount form (no method selected, no amount).
    test('OK returns to the first Topup page with an empty form', async () => {
        const { page, topup } = session;
        await gotoTopupScreen(session);
        await completeCardPayment(session, 'visa', findTopupCase('VISA'));
        await topup.resultTitle.waitFor({ state: 'visible', timeout: 30000 });

        await topup.clickResultOkButton();
        await expect(topup.resultTitle).toBeHidden({ timeout: 15000 });
        await expect(page).toHaveURL(/\/transfer\/top-up/);
        await expect(topup.inputAmount).toBeVisible();
        await expect(topup.inputAmount).toHaveValue('');
        await expect(topup.paymentMethodOptions.first()).toHaveAttribute('aria-checked', 'false');
        await expect(topup.proceedButton).toBeDisabled();
    });
});
