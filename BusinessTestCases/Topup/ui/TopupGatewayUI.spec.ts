import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, reachCardEntryPopup, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — our side of the payment-gateway hand-off (TUP-31, section H).
// Assertions check visibility/non-emptiness or bilingual patterns rather than
// guessed Arabic copy — the app renders Arabic by default on dev. Shared setup:
// see TopupHelper.ts (loginToTopup / gotoTopupScreen / findTopupCase).

test.describe('Topup – UI – Gateway hand-off', () => {
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

    /**
     * TUP-31 (docs/manual-test-cases/Topup.md section H) — our side of the
     * gateway hand-off: after Next the app opens its payment window for the
     * selected method. The third-party card form itself is not validated here.
     */
    for (const [method, caseKey] of [['visa', 'VISA'], ['mada', 'MADA'], ['master', 'MASTER']] as const) {
        test(`after Next, the app opens the gateway window for ${caseKey}`, async () => {
            const popup = await reachCardEntryPopup(session, method, findTopupCase(caseKey));

            const url = new URL(popup.url());
            expect(url.pathname).toMatch(/\/business\/hyperpay\/top-up$/);
            expect(url.searchParams.get('checkoutId')).toBeTruthy();
            expect(url.searchParams.get('paymentMethod')).toBe(caseKey);
        });
    }
});
