import { test, expect, type Request } from '@playwright/test';
import { findTopupCase, loginToTopup, gotoTopupScreen, reachCardEntryPopup, reachOtpScreen, BASE_URL, type TopupSession } from '../TopupHelper';

// Security — maps to docs/manual-test-cases/Topup.md section H (TUP-35).
//
// Split out from Happy Path / UI / Negative / API — see TopupHelper.ts's
// shared setup (loginToTopup/gotoTopupScreen/findTopupCase/reachCardEntryPopup).

test.describe('Topup – Security', { tag: ['@topup', '@functional'], annotation: [{ type: 'feature', description: 'Topup' }, { type: 'layer', description: 'functional' }] }, () => {
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
     * TUP-35 — card number and CVV are captured by the gateway's own
     * PCI-compliant iframe (eu-test.oppwa.com), not a field MJD Pay's own
     * page could read. Reaches the card-entry popup but does not complete a
     * payment — this only needs the popup to exist, not a successful charge.
     */
    test('card number and CVV are hosted in the gateway\'s own PCI iframe, not MJD Pay\'s page', async () => {
        const { topup } = session;
        const method = 'visa';
        const data = findTopupCase('VISA');
        const popup = await reachCardEntryPopup(session, method, data);

        const cardNumberFrame = popup.locator('iframe[name="card.number"]');
        const cvvFrame = popup.locator('iframe[name="card.cvv"]');
        await expect(cardNumberFrame).toBeVisible({ timeout: 15000 });
        await expect(cvvFrame).toBeVisible({ timeout: 15000 });

        const cardNumberSrc = await cardNumberFrame.getAttribute('src');
        const cvvSrc = await cvvFrame.getAttribute('src');

        // Confirmed live 2026-09-20: both load from eu-test.oppwa.com
        // (HyperPay/OPPWA's PCI-compliant sandbox), a third-party origin
        // distinct from majdpay.com — MJD Pay's own page never has DOM
        // access to what's typed into a cross-origin iframe.
        expect(cardNumberSrc).toMatch(/^https:\/\/eu-test\.oppwa\.com\//);
        expect(cvvSrc).toMatch(/^https:\/\/eu-test\.oppwa\.com\//);
        expect(new URL(cardNumberSrc!).hostname).not.toMatch(/majdpay\.com$/);
        expect(new URL(cvvSrc!).hostname).not.toMatch(/majdpay\.com$/);

        await popup.close();
        topup.resetActivePage();
    });

    /**
     * TUP-04 (docs/manual-test-cases/Topup.md section A) — direct URL access
     * without a session redirects to login rather than rendering Topup
     * content. Uses a fresh, unauthenticated browser context rather than the
     * shared logged-in `session`, so it doesn't disturb the other tests'
     * session state.
     */
    test('direct URL access without an authenticated session redirects to login', { annotation: [{ type: 'testcase', description: "TUP-04: Direct URL requires auth" }] }, async ({ browser }) => {
        const freshContext = await browser.newContext();
        try {
            const freshPage = await freshContext.newPage();
            await freshPage.goto(`${BASE_URL}/business/main/transfer/top-up`);
            await freshPage.waitForURL(/\/auth\/login/, { timeout: 15000 });
            expect(freshPage.url()).toContain('/auth/login');
        } finally {
            await freshContext.close();
        }
    });

    /**
     * Card number and CVV never reach MJD Pay's own page in the first place
     * (TUP-35, above) because they live in a cross-origin iframe the page's
     * JS structurally cannot read — but this checks the specific place a
     * card number could otherwise leak: the main page's own browser storage,
     * where a bug could stash it regardless of the iframe boundary.
     */
    test('card number is never written to the main page\'s localStorage or sessionStorage', async () => {
        const { page, topup } = session;
        const data = findTopupCase('VISA');
        const popup = await reachCardEntryPopup(session, 'visa', data);
        await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);

        const storageDump = await page.evaluate(() => {
            const dump: Record<string, string | null> = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)!;
                dump[`local:${key}`] = localStorage.getItem(key);
            }
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i)!;
                dump[`session:${key}`] = sessionStorage.getItem(key);
            }
            return JSON.stringify(dump);
        });

        // Only the card number is checked — confirmed live 2026-09-22 that
        // checking the 3-digit CVV this way is a false-positive trap: the
        // app already stores large encrypted/base64 blobs of unrelated state
        // in localStorage, and a 3-character substring has a real chance of
        // coincidentally appearing inside one. The 16-digit card number has
        // no such risk.
        expect(storageDump).not.toContain(data.cardNumber);

        await popup.close();
        topup.resetActivePage();
    });

    /**
     * Confirmed live 2026-09-22: POST /api/v1/payments carries an
     * `idempotencyKey` header (a UUID, e.g.
     * "5093715f-015f-4a4e-b527-df33dcb1aa06"). Two independent
     * payment-initiation attempts must each get their own key rather than
     * reusing one from an earlier, abandoned attempt.
     *
     * Deliberately does NOT chain this off a wrong-OTP retry — confirmed
     * live that submitting a second wrong OTP on this screen hangs the page
     * for minutes rather than failing cleanly (reproduced twice, both times
     * on the second wrong attempt). Each attempt here is instead abandoned
     * cleanly via Cancel, the same safe path every other test in this file
     * already uses.
     */
    test('each fresh payment initiation gets its own idempotency key', async () => {
        const { page, otp } = session;
        const data = findTopupCase('VISA');

        async function initiateAndCaptureIdempotencyKey(): Promise<string> {
            let idempotencyKey = '';
            const handler = (req: Request) => {
                if (req.method() === 'POST' && req.url().endsWith('/api/v1/payments')) {
                    idempotencyKey = req.headers()['idempotencykey'] ?? '';
                }
            };
            page.on('request', handler);
            try {
                await reachOtpScreen(session, 'visa', data);
            } finally {
                page.off('request', handler);
            }
            return idempotencyKey;
        }

        const firstKey = await initiateAndCaptureIdempotencyKey();
        expect(firstKey, 'idempotencyKey header should be present on POST /api/v1/payments').not.toBe('');
        await otp.cancelButton.click().catch(() => { /* best-effort cleanup */ });

        await gotoTopupScreen(session);
        const secondKey = await initiateAndCaptureIdempotencyKey();
        expect(secondKey, 'idempotencyKey header should be present on POST /api/v1/payments').not.toBe('');
        await otp.cancelButton.click().catch(() => { /* best-effort cleanup */ });

        expect(secondKey, 'a fresh payment initiation must not reuse the previous attempt\'s idempotency key').not.toBe(firstKey);
    });
});
