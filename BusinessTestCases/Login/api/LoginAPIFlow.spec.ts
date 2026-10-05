import { test, expect } from '@playwright/test';
import { VALID_MOBILE, VALID_PASSWORD as HELPER_VALID_PASSWORD, VALID_COMPANY, VALID_OTP, INVALID_OTP } from '../LoginHelper';

// ─────────────────────────────────────────────────────────────────────────────
// Login – API Flow
//
// Covers the 3-step pre-auth + sign-in chain:
//
//  Step 1 – Get client IP
//   1. GET  /devices/ip-address
//
//  Step 2 – Register device UUID
//   2. POST /devices/uuid
//
//  Step 3 – Sign in
//   3. POST /auth/signin    → returns accessToken (and may trigger OTP)
//   4. POST /auth/verify/otp → (skipped when OTP is disabled)
//
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';

const VALID_USERNAME = `+966${VALID_MOBILE}`;
const VALID_PASSWORD = HELPER_VALID_PASSWORD;
const VALID_TENANT   = VALID_COMPANY;

const DEVICE_ID          = '97775405aa6144fc2e034bebc258bdf2';
const DEVICE_FINGERPRINT = 'test-fingerprint-hash-api-testing';

function commonHeaders(): Record<string, string> {
    return {
        'Content-Type':        'application/json',
        'Accept':              '*/*',
        'Accept-Language':     'en_uk',
        'locale':              'en_uk',
        'platform':            'web',
        'platformType':        'web',
        'channel':             'ONLINE',
        'toster_ID':           `toster_ID_${Date.now()}`,
        'device-finger-print': DEVICE_FINGERPRINT,
        'latitude':            '24.7136',
        'longitude':           '46.6753',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// API 1 — GET /devices/ip-address
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – API 1: GET /devices/ip-address', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    test('API-01: should return 200', async ({ request }) => {
        const res = await request.get(`${API_BASE}/devices/ip-address`, {
            headers: commonHeaders(),
        });

        expect(res.status()).toBe(200);
    });

    test('API-01a: response should contain an ipAddress field', async ({ request }) => {
        const res  = await request.get(`${API_BASE}/devices/ip-address`, {
            headers: commonHeaders(),
        });
        const body = await res.json();

        expect(body).toHaveProperty('ipAddress');
        expect(typeof body.ipAddress).toBe('string');
        expect(body.ipAddress.length).toBeGreaterThan(0);
    });

    test('API-01b: response should use JSON content-type', async ({ request }) => {
        const res = await request.get(`${API_BASE}/devices/ip-address`, {
            headers: commonHeaders(),
        });

        expect(res.headers()['content-type']).toMatch(/application\/json/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// API 2 — POST /devices/uuid
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – API 2: POST /devices/uuid', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    const devicePayload = {
        ipAddress:        '0.0.0.0',
        platform:         'web',
        deviceId:         DEVICE_ID,
        applicationId:    DEVICE_ID,
        manufacturerName: 'Google',
        osName:           'Chrome',
        model:            '149.0',
        token:            '',
    };

    test('API-02: should return 200 with a UUID', async ({ request }) => {
        const res = await request.post(`${API_BASE}/devices/uuid`, {
            data:    devicePayload,
            headers: commonHeaders(),
        });

        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('uuid');
    });

    test('API-02a: uuid should be a non-empty string in UUID format', async ({ request }) => {
        const res  = await request.post(`${API_BASE}/devices/uuid`, {
            data:    devicePayload,
            headers: commonHeaders(),
        });
        const body = await res.json();

        expect(typeof body.uuid).toBe('string');
        expect(body.uuid).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
    });

    test('API-02b: response should use JSON content-type', async ({ request }) => {
        const res = await request.post(`${API_BASE}/devices/uuid`, {
            data:    devicePayload,
            headers: commonHeaders(),
        });

        expect(res.headers()['content-type']).toMatch(/application\/json/);
    });

    // ── Negative ──────────────────────────────────────────────────────────────

    test('API-N1: should return 400 when body is empty', async ({ request }) => {
        const res = await request.post(`${API_BASE}/devices/uuid`, {
            data:    {},
            headers: commonHeaders(),
        });

        expect([400, 422]).toContain(res.status());
    });

    test('API-N2: should return 400 when deviceId is missing', async ({ request }) => {
        const { deviceId: _, ...payload } = devicePayload as Record<string, unknown>;
        const res = await request.post(`${API_BASE}/devices/uuid`, {
            data:    payload,
            headers: commonHeaders(),
        });

        expect([400, 422]).toContain(res.status());
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// API 3 — POST /auth/signin
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – API 3: POST /auth/signin', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    // ── Happy path ────────────────────────────────────────────────────────────

    test('API-03: should return 200 with valid credentials', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });

        expect(res.status()).toBe(200);
    });

    test('API-03a: response body should contain an accessToken object', async ({ request }) => {
        const res  = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });
        const body = await res.json();

        expect(body).toHaveProperty('accessToken');
        expect(body.accessToken).toHaveProperty('token');
        expect(body.accessToken).toHaveProperty('expirationDuration');
        expect(body.accessToken).toHaveProperty('profileId');
        expect(body.accessToken).toHaveProperty('username');
        expect(body.accessToken).toHaveProperty('userId');
        expect(body.accessToken).toHaveProperty('tenantNumber');
    });

    test('API-03b: accessToken.token should be a non-empty string', async ({ request }) => {
        const res  = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });
        const body = await res.json();

        expect(typeof body.accessToken.token).toBe('string');
        expect(body.accessToken.token.length).toBeGreaterThan(0);
    });

    test('API-03c: accessToken.tenantNumber should match the submitted tenant', { annotation: [{ type: 'testcase', description: "LG-116: accessToken.tenantNumber matches submitted tenant" }] }, async ({ request }) => {
        const res  = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });
        const body = await res.json();

        expect(body.accessToken.tenantNumber).toBe(VALID_TENANT);
    });

    test('API-03d: accessToken.expirationDuration should be a positive number', { annotation: [{ type: 'testcase', description: "LG-117: accessToken.expirationDuration is a positive number" }] }, async ({ request }) => {
        const res  = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });
        const body = await res.json();

        expect(typeof body.accessToken.expirationDuration).toBe('number');
        expect(body.accessToken.expirationDuration).toBeGreaterThan(0);
    });

    test('API-03e: response should use JSON content-type', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });

        expect(res.headers()['content-type']).toMatch(/application\/json/);
    });

    // ── Missing fields ────────────────────────────────────────────────────────

    test('API-N3: should return 400 when body is empty', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data:    {},
            headers: commonHeaders(),
        });

        expect([400, 422]).toContain(res.status());
    });

    test('API-N4: should return 400 when username is missing', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: { password: VALID_PASSWORD, tenantNumber: VALID_TENANT },
            headers: commonHeaders(),
        });

        expect([400, 422]).toContain(res.status());
    });

    test('API-N5: should return 400 when password is missing', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: { username: VALID_USERNAME, tenantNumber: VALID_TENANT },
            headers: commonHeaders(),
        });

        expect([400, 422]).toContain(res.status());
    });

    test('API-N6: should return 400 when tenantNumber is missing', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: { username: VALID_USERNAME, password: VALID_PASSWORD },
            headers: commonHeaders(),
        });

        expect([400, 422]).toContain(res.status());
    });

    // ── Invalid credentials ───────────────────────────────────────────────────

    test('API-N7: should return 401 with a wrong password', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     'WrongPass@99',
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });

        expect(res.status()).toBe(401);
    });

    test('API-N8: should return 401 with an unrecognised tenant number', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: 'INVALID99',
            },
            headers: commonHeaders(),
        });

        expect(res.status()).toBe(401);
    });

    test('API-N9: should return 401 with an unrecognised username', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     '+966500000000',
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });

        expect(res.status()).toBe(401);
    });

    test('API-N10: should return 400 or 401 when mobile is sent without +966 country code', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     '500021788',
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });

        expect([400, 401]).toContain(res.status());
    });

    // ── Security ──────────────────────────────────────────────────────────────

    test('API-S1: error response should not expose stack traces or database details', async ({ request }) => {
        const res  = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     '+966500000000',
                password:     'WrongPass@99',
                tenantNumber: 'WRONG',
            },
            headers: commonHeaders(),
        });
        const text = await res.text();

        expect(text).not.toMatch(/stack|exception|sql|null pointer|traceback|ORA-|JDBC/i);
    });

    test('API-S2: error status should be identical whether tenant or username is wrong (prevents enumeration)', async ({ request }) => {
        const wrongTenant = await request.post(`${API_BASE}/auth/signin`, {
            data: { username: VALID_USERNAME, password: VALID_PASSWORD, tenantNumber: 'WRONG' },
            headers: commonHeaders(),
        });
        const wrongUser = await request.post(`${API_BASE}/auth/signin`, {
            data: { username: '+966500000001', password: VALID_PASSWORD, tenantNumber: VALID_TENANT },
            headers: commonHeaders(),
        });

        expect(wrongTenant.status()).toBe(wrongUser.status());
    });

    test('API-S3: GET to /auth/signin must not return 200 — credentials must not appear in URLs', async ({ request }) => {
        const res = await request.get(`${API_BASE}/auth/signin`);

        expect(res.status()).not.toBe(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// API 4 — POST /auth/verify/otp  (skipped when OTP is disabled)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – API 4: POST /auth/verify/otp', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    let accessToken = '';

    test.beforeAll(async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });
        if (res.ok()) {
            const body = await res.json();
            accessToken = body?.accessToken?.token ?? '';
        }
    });

    test('API-04: should return 200 with valid OTP (dev env — OTP is 00000000)', async ({ request }) => {
        test.skip(!accessToken, 'Sign-in did not return an accessToken — skipping OTP verification');

        const res = await request.post(`${API_BASE}/auth/verify/otp`, {
            data: { otp: VALID_OTP },
            headers: {
                ...commonHeaders(),
                Authorization: `Bearer ${accessToken}`,
            },
        });

        expect([200, 201]).toContain(res.status());
    });

    test('API-N11: should return 401 with an incorrect OTP', async ({ request }) => {
        test.skip(!accessToken, 'Sign-in did not return an accessToken — skipping OTP verification');

        const res = await request.post(`${API_BASE}/auth/verify/otp`, {
            data: { otp: INVALID_OTP },
            headers: {
                ...commonHeaders(),
                Authorization: `Bearer ${accessToken}`,
            },
        });

        expect(res.status()).toBe(401);
    });

    test('API-N12: should return 400 when OTP field is missing', async ({ request }) => {
        test.skip(!accessToken, 'Sign-in did not return an accessToken — skipping OTP verification');

        const res = await request.post(`${API_BASE}/auth/verify/otp`, {
            data: {},
            headers: {
                ...commonHeaders(),
                Authorization: `Bearer ${accessToken}`,
            },
        });

        expect([400, 422]).toContain(res.status());
    });

    test('API-N13: should return 401 when Authorization header is missing', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/verify/otp`, {
            data:    { otp: VALID_OTP },
            headers: commonHeaders(),
        });

        expect(res.status()).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// FULL FLOW — chain all 3 pre-auth steps + sign in
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – Full API Flow (IP → UUID → Sign In)', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test('API-FLOW-01: should complete the full pre-auth and sign-in chain successfully', async ({ request }) => {
        // Step 1 — get IP
        const ipRes  = await request.get(`${API_BASE}/devices/ip-address`, { headers: commonHeaders() });
        expect(ipRes.status()).toBe(200);
        const { ipAddress } = await ipRes.json();
        expect(typeof ipAddress).toBe('string');

        // Step 2 — register device UUID
        const uuidRes = await request.post(`${API_BASE}/devices/uuid`, {
            data: {
                ipAddress,
                platform:         'web',
                deviceId:         DEVICE_ID,
                applicationId:    DEVICE_ID,
                manufacturerName: 'Google',
                osName:           'Chrome',
                model:            '149.0',
                token:            '',
            },
            headers: commonHeaders(),
        });
        expect(uuidRes.status()).toBe(200);
        const { uuid } = await uuidRes.json();
        expect(uuid).toMatch(/^[0-9a-f-]{36}$/i);

        // Step 3 — sign in
        const signInRes = await request.post(`${API_BASE}/auth/signin`, {
            data: {
                username:     VALID_USERNAME,
                password:     VALID_PASSWORD,
                tenantNumber: VALID_TENANT,
            },
            headers: commonHeaders(),
        });
        expect(signInRes.status()).toBe(200);
        const body = await signInRes.json();
        expect(body.accessToken?.token?.length).toBeGreaterThan(0);
    });
});
