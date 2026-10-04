import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, completeCardPayment, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — what the user sees when the gateway returns "Pending" (simulator return
// code 3): an INLINE "Payment Pending Confirmation" result screen that replaces
// the form on the same URL — and NO toast (confirmed correct behaviour). The
// result component is shared with Success/Failed, so every check pins the title
// TEXT and the status icon class (`.is-pending`) — a bare `.mp-result-title`
// visibility check would pass on all three. One pending payment is made in
// beforeAll; a toast watcher runs across the whole flow.

const PENDING_TITLE = /الدفعة قيد التأكيد|payment pending confirmation/i;
const SUCCESS_TITLE = /دفعة ناجحة|successful payment/i;
const FAILED_TITLE  = /فشلت الدفعة|payment failed/i;

test.describe('Topup – Payment Pending UI', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(180000);

    let session: TopupSession;
    let toastAppeared = false;

    test.beforeAll(async ({ browser }) => {
        // test.setTimeout at describe level doesn't cover hooks, and this one makes a real payment.
        test.setTimeout(180000);
        session = await loginToTopup(browser, TOPUP_UI_ACCOUNT);
        await gotoTopupScreen(session);
        // The toast is transient and may show while the gateway popup is still
        // closing, i.e. before completeCardPayment returns — so start watching
        // for it BEFORE the payment, not after.
        const toast = session.page.getByTestId('toast-message')
            .or(session.page.locator('.toast-snackbar__detail, mat-snack-bar-container, [class*="toast"]')).first();
        const toastSeen = toast.waitFor({ state: 'visible', timeout: 150000 }).then(() => true, () => false);
        await completeCardPayment(session, 'visa', findTopupCase('VISA'), '3');
        await session.topup.resultTitle.waitFor({ state: 'visible', timeout: 30000 });
        // Give a toast that's about to appear a few seconds; don't wait on the full watch timeout.
        const seen = await Promise.race([toastSeen, session.page.waitForTimeout(5000).then(() => false)]);
        toastAppeared = seen;
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    // Confirmed correct behaviour: Pending is shown as an inline result screen,
    // not a toast — no toast may appear anywhere during the flow.
    test('a Pending gateway result does NOT show a toast', async () => {
        expect(toastAppeared, 'a toast appeared during the Pending flow').toBe(false);
    });

    test('the result title and description show the PENDING copy, not success or failure', async () => {
        const { topup } = session;
        await expect(topup.pageTitle).toHaveText(/شحن الرصيد|Top up/i);
        await expect(topup.resultTitle).toHaveText(PENDING_TITLE);
        await expect(topup.resultTitle).not.toHaveText(SUCCESS_TITLE);
        await expect(topup.resultTitle).not.toHaveText(FAILED_TITLE);
        await expect(topup.resultDescription).toHaveText(/قيد التأكيد|pending/i);
    });

    test('the pending (clock) status icon is shown, with the is-pending state', async () => {
        const { topup } = session;
        await expect(topup.resultIcon).toBeVisible();
        await expect(topup.resultIcon).toHaveClass(/is-pending/);
        await expect(topup.resultIcon).not.toHaveClass(/is-(success|failed)/);
    });

    test('the result renders inline in the centred result section', async () => {
        const { topup } = session;
        await expect(topup.resultContainer).toBeVisible();
        await expect(topup.resultContainer.locator('h2.mp-result-title')).toHaveText(PENDING_TITLE);
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
        await expect(topup.inputAmount).toBeHidden();
        await expect(topup.summaryRows).toHaveCount(0);
    });

    test('the sidebar and header are still present', async () => {
        const { shell } = session;
        await expect(shell.sidebar).toBeVisible();
        await expect(shell.profileAvatar).toBeVisible();
        await expect(shell.topupLink).toBeVisible();
    });

    // KNOWN BUG (accessibility): the aria-live="polite" region is empty on every
    // result screen, so the pending status is never announced. Un-skip once fixed.
    test.skip('the pending message is announced through the aria-live region', async () => {
        const { topup } = session;
        await expect(topup.resultLiveRegion.filter({ hasText: PENDING_TITLE })).toHaveCount(1);
    });

    // OK returns to the first Topup page (the empty form), like the other results.
    test('OK returns to the empty Topup form', async () => {
        const { page, topup } = session;
        await topup.clickResultOkButton();
        await expect(topup.resultTitle).toBeHidden({ timeout: 15000 });
        await expect(page).toHaveURL(/\/transfer\/top-up/);
        await expect(topup.inputAmount).toBeVisible();
        await expect(topup.inputAmount).toHaveValue('');
        await expect(topup.proceedButton).toBeDisabled();
    });
});
