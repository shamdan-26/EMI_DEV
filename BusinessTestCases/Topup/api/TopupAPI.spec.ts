import { test, expect } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, type TopupSession } from '../TopupHelper';

// API / Contract — maps to docs/manual-test-cases/audit-additions.json
// (TU-API-01) plus two additional cases extending its coverage: an
// unauthenticated request and a failed OTP verification. Both are asserted
// as network-contract checks on real requests the app itself makes, not
// hand-crafted requests — the payload schemas (wallet/session references
// from `/api/v1/payments/summary/open`) were never captured, and guessing
// them would risk asserting against a shape that doesn't match reality.
//
// Split out from Happy Path / UI / Negative / Security — see
// TopupHelper.ts's shared setup (loginToTopup/gotoTopupScreen/findTopupCase).

const GATEWAY_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';

test.describe('Topup – API', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(150000);

    let session: TopupSession;

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser);
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    test.beforeEach(async () => {
        await gotoTopupScreen(session);
    });

    /**
     * TU-API-01 — POST /api/v1/payments returns 201 and initiates the OTP
     * for a valid card top-up. Asserted as a network-contract check on the
     * real request the app itself makes, rather than a hand-crafted request
     * from this test — the endpoint's full payload schema (wallet/session
     * references from the preceding `/api/v1/payments/summary/open` call)
     * was never captured, and guessing it would risk asserting against a
     * shape that doesn't match what the app actually sends. Stops once OTP
     * renders — this only needs to prove the initiation call's contract, not
     * a completed charge.
     */
    test('POST /api/v1/payments returns 201 and initiates the OTP for a valid card top-up', async () => {
        const { page, topup, otp } = session;
        const data = findTopupCase('VISA');
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount(data.amount);
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();

        const paymentsResponsePromise = page.waitForResponse(
            resp => resp.request().method() === 'POST' && resp.url().endsWith('/api/v1/payments'),
            { timeout: 15000 },
        );

        await topup.clickSummaryNextButton();
        const paymentsResponse = await paymentsResponsePromise;

        expect(paymentsResponse.status()).toBe(201);
        // Confirms the call actually initiated OTP, not just that it
        // returned 201 — the OTP screen renders right after.
        await expect(otp.inputs.first()).toBeVisible({ timeout: 15000 });

        await otp.cancelButton.click().catch(() => { /* best-effort cleanup — next test's beforeEach resets via HOME_URL anyway */ });
    });

    test('GET /api/v1/wallets/balance without an auth token is rejected', async ({ request }) => {
        const res = await request.get(`${GATEWAY_BASE}/api/v1/wallets/balance`);
        // Confirmed live 2026-09-22: this gateway returns 404 for an
        // unauthenticated request here, not 401/403 — the response's exact
        // schema isn't confirmed, so the assertion sticks to what matters:
        // no wallet data comes back on a 200.
        expect(res.status()).not.toBe(200);
    });

    /**
     * "194857" is the same non-zero wrong code the Negative suite uses —
     * confirmed live 2026-09-22 that an all-zeros code is accepted on dev
     * (see TopupNegative.spec.ts's own note), so a genuinely wrong code is
     * required to exercise this rejection path.
     */
    test('POST /api/v1/payments/verify with an incorrect OTP does not return 201', async () => {
        const { page, topup, otp } = session;
        const data = findTopupCase('VISA');
        await topup.selectPaymentMethod('visa');
        await topup.enterAmount(data.amount);
        await topup.clickProceedButton();
        await topup.waitForSummaryToSettle();
        await topup.clickSummaryNextButton();
        await expect(otp.inputs.first()).toBeVisible({ timeout: 15000 });

        const verifyResponsePromise = page.waitForResponse(
            resp => resp.request().method() === 'POST' && resp.url().endsWith('/api/v1/payments/verify'),
            { timeout: 15000 },
        );
        await otp.fillAndVerify('194857');
        const verifyResponse = await verifyResponsePromise;

        expect(verifyResponse.status()).not.toBe(201);
    });
});
