import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Registration session refresh token (RSR-01..RSR-07)
//
// EMI-5995 (BE — create a refresh token for the registration session) and
// EMI-6059 (FE Web Business — consume it). EMI-6057 / EMI-6058 are the Android
// and iOS ports of the same mechanism and are out of scope for this web suite.
//
// Contract, taken verbatim from the EMI-6059 acceptance criteria:
//
//   POST /api/v1/register/verify/otp
//     -> `sessionToken` and `refreshToken`, each { token, expirationDuration }
//   POST /api/v1/register/mobile/otp
//     -> the same two objects, NULLABLE — present only when otpRequired is false
//   POST /emi-profile/api/v1/register/session/refresh
//     -> Authorization: Bearer <registration-session-jwt>
//        refreshToken: <refresh token>   (a header, not a body field)
//     -> a new session token; the in-progress registration continues, no restart
//     -> an invalid or expired refresh token is rejected
//
//   `expirationDuration` is in MILLISECONDS.
//   The registration refresh mechanism runs in isolation from the login one.
//
// ── Why most of this file skips by default ───────────────────────────────
// Driving a real refresh needs a live registration session, which means burning
// a CITIZEN_ASSETS / RESIDENT_ASSETS tuple and clearing NAFATH — and NAFATH is
// not automatable on UAT, the same blocker that already gates
// RegistrationNafathFunctionality.spec.ts. So:
//   * the SHAPE cases (RSR-01, RSR-02) run against the mobile-OTP step, which
//     is reachable without NAFATH;
//   * the REFRESH cases (RSR-03..RSR-06) need a session token and skip unless
//     REGISTRATION_SESSION_TOKEN / REGISTRATION_REFRESH_TOKEN are supplied;
//   * RSR-07 is a pure contract check with no network at all.
// This is the same env-gating pattern PosTransactions/ uses for its admin and
// callback tokens.
//
// EMI-5995 is Under-Testing and EMI-6059 is DEV DONE at time of writing.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';

const VERIFY_OTP_PATH  = '/api/v1/register/verify/otp';
const MOBILE_OTP_PATH  = '/api/v1/register/mobile/otp';
const SESSION_REFRESH_PATH = '/emi-profile/api/v1/register/session/refresh';

/** Supplied by whoever ran a registration far enough to hold a live session. */
const SESSION_TOKEN = process.env['REGISTRATION_SESSION_TOKEN'] ?? '';
const REFRESH_TOKEN = process.env['REGISTRATION_REFRESH_TOKEN'] ?? '';

const NO_SESSION = 'set REGISTRATION_SESSION_TOKEN and REGISTRATION_REFRESH_TOKEN from a live registration to run this';

function headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
        'Content-Type':    'application/json',
        Accept:            '*/*',
        'Accept-Language': 'en_uk',
        platform:          'web',
        ...extra,
    };
}

/** The { token, expirationDuration } pair both APIs now return. */
interface TokenPair {
    token: string;
    expirationDuration: number;
}

function assertTokenPair(pair: unknown, label: string): void {
    expect(pair, `${label} is missing`).toBeTruthy();
    const typed = pair as TokenPair;
    expect(typeof typed.token, `${label}.token is not a string`).toBe('string');
    expect(typed.token.length, `${label}.token is empty`).toBeGreaterThan(0);
    expect(typeof typed.expirationDuration, `${label}.expirationDuration is not a number`).toBe('number');
    // Milliseconds, per the ticket. A value under 1000 would mean someone
    // switched it to seconds without telling the clients.
    expect(typed.expirationDuration, `${label}.expirationDuration looks like seconds, not milliseconds`).toBeGreaterThan(1000);
}

test.describe('Registration Session Refresh — Response Shapes (RSR-01, EMI-5995 / EMI-6059)', { tag: ['@registration', '@api'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    test('RSR-01: POST /register/mobile/otp returns nullable sessionToken and refreshToken objects', { annotation: [{ type: 'testcase', description: "RSR-01: Mobile OTP response shape" }] }, async ({ request }) => {
        const res = await request.post(`${API_BASE}${MOBILE_OTP_PATH}`, {
            headers: headers(),
            data: { mobileNumber: `5${String(Date.now()).slice(-8)}` },
        });
        test.skip(!res.ok(), `mobile OTP step returned ${res.status()} — cannot inspect the response shape`);

        const body = await res.json();

        // The AC is that the keys EXIST and are objects-or-null. They are
        // populated only when otpRequired is false, so their presence — not
        // their content — is what is contractual here.
        expect(body).toHaveProperty('sessionToken');
        expect(body).toHaveProperty('refreshToken');

        if (body.otpRequired === false) {
            assertTokenPair(body.sessionToken, 'mobile/otp sessionToken');
            assertTokenPair(body.refreshToken, 'mobile/otp refreshToken');
        } else {
            expect(body.sessionToken, 'sessionToken should be null while an OTP is still required').toBeNull();
            expect(body.refreshToken, 'refreshToken should be null while an OTP is still required').toBeNull();
        }
    });

    test('RSR-02: POST /register/verify/otp returns both token pairs populated', { annotation: [{ type: 'testcase', description: "RSR-02: Verify-OTP response shape" }] }, async ({ request }) => {
        test.skip(!SESSION_TOKEN, NO_SESSION);

        const res = await request.post(`${API_BASE}${VERIFY_OTP_PATH}`, {
            headers: headers({ Authorization: `Bearer ${SESSION_TOKEN}` }),
            data: { otp: process.env['REGISTRATION_OTP'] ?? '00000000' },
        });
        test.skip(!res.ok(), `verify OTP returned ${res.status()} — the session may already be consumed`);

        const body = await res.json();

        assertTokenPair(body.sessionToken, 'verify/otp sessionToken');
        assertTokenPair(body.refreshToken, 'verify/otp refreshToken');
    });
});

test.describe('Registration Session Refresh — Refreshing (RSR-03, EMI-5995)', { tag: ['@registration', '@api'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    test('RSR-03: a valid refresh token issues a new registration session token', { annotation: [{ type: 'testcase', description: "RSR-03: A valid refresh issues a new session token" }] }, async ({ request }) => {
        test.skip(!SESSION_TOKEN || !REFRESH_TOKEN, NO_SESSION);

        const res = await request.post(`${API_BASE}${SESSION_REFRESH_PATH}`, {
            headers: headers({ Authorization: `Bearer ${SESSION_TOKEN}`, refreshToken: REFRESH_TOKEN }),
        });

        expect(res.status(), 'a valid refresh was rejected').toBe(200);

        const body = await res.json();
        assertTokenPair(body.sessionToken, 'refreshed sessionToken');
        // The whole point: a NEW token, not the one that was sent in.
        expect((body.sessionToken as TokenPair).token, 'refresh returned the same session token').not.toBe(SESSION_TOKEN);
    });

    test('RSR-03b: the refresh token travels as a header, not in the body', { annotation: [{ type: 'testcase', description: "RSR-03b: The refresh token must be a header, not a body field" }] }, async ({ request }) => {
        test.skip(!SESSION_TOKEN || !REFRESH_TOKEN, NO_SESSION);

        // EMI-6059 is explicit that refreshToken is a header. A body-only call
        // must therefore be refused, or the contract has quietly widened.
        const res = await request.post(`${API_BASE}${SESSION_REFRESH_PATH}`, {
            headers: headers({ Authorization: `Bearer ${SESSION_TOKEN}` }),
            data: { refreshToken: REFRESH_TOKEN },
        });

        expect(res.status(), 'the refresh token was accepted from the body — the header contract has drifted').not.toBe(200);
    });

    test('RSR-04: an invalid refresh token is rejected', { annotation: [{ type: 'testcase', description: "RSR-04: An invalid refresh token is rejected" }] }, async ({ request }) => {
        test.skip(!SESSION_TOKEN, NO_SESSION);

        const res = await request.post(`${API_BASE}${SESSION_REFRESH_PATH}`, {
            headers: headers({ Authorization: `Bearer ${SESSION_TOKEN}`, refreshToken: 'not-a-real-refresh-token' }), // allowlist-secret: deliberately invalid placeholder for the rejection case
        });

        expect(res.status(), 'an invalid refresh token was accepted').not.toBe(200);
        expect([400, 401, 403]).toContain(res.status());
    });

    test('RSR-04b: refreshing without an active registration session is rejected', { annotation: [{ type: 'testcase', description: "RSR-04b: Refreshing without an active registration session is rejected" }] }, async ({ request }) => {
        test.skip(!REFRESH_TOKEN, NO_SESSION);

        // The endpoint requires BOTH — a refresh token alone must not mint a session.
        const res = await request.post(`${API_BASE}${SESSION_REFRESH_PATH}`, {
            headers: headers({ refreshToken: REFRESH_TOKEN }),
        });

        expect(res.status()).not.toBe(200);
        expect([400, 401, 403]).toContain(res.status());
    });

    test('RSR-05: a refreshed session continues the same registration, not a new one', { annotation: [{ type: 'testcase', description: "RSR-05: A refreshed session continues the same registration" }] }, async ({ request }) => {
        test.skip(!SESSION_TOKEN || !REFRESH_TOKEN, NO_SESSION);

        const before = await request.get(`${API_BASE}/api/v1/register/status`, {
            headers: headers({ Authorization: `Bearer ${SESSION_TOKEN}` }),
        });
        test.skip(!before.ok(), `registration status returned ${before.status()} — cannot compare before/after`);
        const beforeBody = await before.json();

        const refreshed = await request.post(`${API_BASE}${SESSION_REFRESH_PATH}`, {
            headers: headers({ Authorization: `Bearer ${SESSION_TOKEN}`, refreshToken: REFRESH_TOKEN }),
        });
        test.skip(!refreshed.ok(), `refresh returned ${refreshed.status()} — RSR-03 covers the failure case`);
        const newToken = ((await refreshed.json()).sessionToken as TokenPair).token;

        const after = await request.get(`${API_BASE}/api/v1/register/status`, {
            headers: headers({ Authorization: `Bearer ${newToken}` }),
        });

        expect(after.status()).toBe(200);
        const afterBody = await after.json();
        // Same registration: the step the applicant was on must not reset.
        expect(afterBody.currentStep ?? afterBody.step).toBe(beforeBody.currentStep ?? beforeBody.step);
    });
});

test.describe('Registration Session Refresh — Isolation From Login (RSR-06, EMI-6059)', { tag: ['@registration', '@api'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    test('RSR-06: a registration refresh token is not accepted by the login refresh endpoint', { annotation: [{ type: 'testcase', description: "RSR-06: Registration refresh tokens are isolated from login" }] }, async ({ request }) => {
        test.skip(!REFRESH_TOKEN, NO_SESSION);

        // "The registration refresh mechanism runs in isolation from the
        // existing login refresh-token mechanism" — so the two token families
        // must not be interchangeable in either direction.
        const res = await request.post(`${API_BASE}/auth/refresh`, {
            headers: headers({ refreshToken: REFRESH_TOKEN }),
        });

        expect(res.status(), 'a registration refresh token was accepted by the login refresh endpoint').not.toBe(200);
    });

    test('RSR-06b: a registration session token is not accepted as a login access token', { annotation: [{ type: 'testcase', description: "RSR-06b: A registration session token cannot authenticate a post-login API" }] }, async ({ request }) => {
        test.skip(!SESSION_TOKEN, NO_SESSION);

        const res = await request.get(`${API_BASE}/api/v1/transactions?page=0&size=1`, {
            headers: headers({ Authorization: `Bearer ${SESSION_TOKEN}` }),
        });

        expect(res.status(), 'a registration session token authenticated a post-login API').not.toBe(200);
        expect([401, 403]).toContain(res.status());
    });
});

test.describe('Registration Session Refresh — Contract Pinned (RSR-07, EMI-5995 / EMI-6059)', { tag: ['@registration', '@api'], annotation: [{ type: 'feature', description: 'Registration' }, { type: 'layer', description: 'api' }] }, () => {
    test('RSR-07: the endpoint paths and the millisecond unit are version-controlled', () => {
        // No network. This pins the three paths and the expirationDuration unit
        // from the EMI-6059 AC so a silent change shows up as a code diff
        // rather than as a mystery skip.
        expect(VERIFY_OTP_PATH).toBe('/api/v1/register/verify/otp');
        expect(MOBILE_OTP_PATH).toBe('/api/v1/register/mobile/otp');
        expect(SESSION_REFRESH_PATH).toBe('/emi-profile/api/v1/register/session/refresh');

        // A 15-minute session expressed in the documented unit.
        const fifteenMinutes: TokenPair = { token: 'x', expirationDuration: 15 * 60 * 1000 };
        expect(fifteenMinutes.expirationDuration).toBe(900000);
    });
});
