import { test, expect } from '@playwright/test';
import {
    VALID_MOBILE,
    VALID_PASSWORD,
    VALID_COMPANY,
    NAFATH_EXPIRED_COMPANY,
    NAFATH_EXPIRED_MOBILE,
    NAFATH_EXPIRED_PASSWORD,
    WATHIQ_EXPIRED_COMPANY,
    WATHIQ_EXPIRED_MOBILE,
    WATHIQ_EXPIRED_PASSWORD,
} from '../LoginHelper';

// ─────────────────────────────────────────────────────────────────────────────
// Login – NAFATH / WATHIQ Data Expiry & Renewal (EMI-5836, "BE - Block login
// when Nafath or Yaqeen TTL /data has expired")
//
// NOTE on the ticket title: the summary says "Nafath or Yaqeen", but neither
// the ticket description nor any of its 4 comments mention "Yaqeen" anywhere —
// the actual scope described (and confirmed by the assignee's implementation
// comment) is NAFATH + WATHIQ. Test IDs below use NW- (Nafath/Wathiq) rather
// than assuming "Yaqeen" is a third, undocumented system. Flag this with the
// reporter/assignee if a real "Yaqeen" integration exists that isn't in the
// ticket text.
//
// Per the ticket + comment thread, this introduces two *independent* expiry
// concepts per provider, which this file keeps in separate describe blocks
// so they're never conflated:
//   1. Document expiry  — the actual CRN (WATHIQ) or National ID/Iqama
//      (NAFATH) has passed its real-world expiry date.
//   2. Redis TTL expiry — the *cached* copy of that data has expired, whether
//      or not the underlying document is still valid.
// Per the spec comment thread, WATHIQ TTL expiry is meant to self-heal via a
// background job (no user action required) — only NAFATH TTL expiry and
// either provider's document expiry are meant to actually block login.
//
// Confirmed from Anas Al-Halawani's 2026-07-26 comment on EMI-5836:
//   - POST /auth/signin returns HTTP 409 with error code NAFATH_DATA_EXPIRED
//     or WATHIQ_DATA_EXPIRED when the corresponding flag is set.
//   - Renewal APIs are documented under the "profile-data-renewal-controller"
//     tag in the Emi Profile Service Swagger
//     (https://gateway-dev.majdpay.com/webjars/swagger-ui/index.html?urls.primaryName=Emi%20Profile%20Service%20APIs#/profile-data-renewal-controller).
//
// NOT confirmed anywhere in the ticket or this repo (do not guess at these —
// confirm against the Swagger doc above before un-skipping the relevant
// tests): the exact renewal endpoint paths/payloads, and any QA-facing way to
// force a Redis-TTL-only expiry independently of document expiry. Tests that
// depend on either are left as test.skip(true, PENDING) with the intended
// assertions documented inline, following the same pattern already used in
// Reconciliation/api/*.spec.ts and TransactionOperations/api/*.spec.ts for
// coverage that's written but blocked on access/confirmation.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';

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
        'device-finger-print': 'test-fingerprint-hash-api-testing',
        'latitude':            '24.7136',
        'longitude':           '46.6753',
    };
}

async function signIn(request: import('@playwright/test').APIRequestContext, company: string, mobile: string, password: string = VALID_PASSWORD) {
    return request.post(`${API_BASE}/auth/signin`, {
        data: {
            username:     `+966${mobile}`,
            password,
            tenantNumber: company,
        },
        headers: commonHeaders(),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// NW-01–NW-08 — Document expiry blocks login (env-gated real accounts)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – NAFATH document (National ID/Iqama) expired', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    test('NW-01: should return 409 when NAFATH document data has expired', async ({ request }) => {
        test.skip(!NAFATH_EXPIRED_COMPANY || !NAFATH_EXPIRED_MOBILE, 'Set NAFATH_EXPIRED_COMPANY and NAFATH_EXPIRED_MOBILE env vars to run this test');

        const res = await signIn(request, NAFATH_EXPIRED_COMPANY, NAFATH_EXPIRED_MOBILE, NAFATH_EXPIRED_PASSWORD);

        expect(res.status()).toBe(409);
    });

    test('NW-01a: 409 response body should carry error code NAFATH_DATA_EXPIRED', async ({ request }) => {
        test.skip(!NAFATH_EXPIRED_COMPANY || !NAFATH_EXPIRED_MOBILE, 'Set NAFATH_EXPIRED_COMPANY and NAFATH_EXPIRED_MOBILE env vars to run this test');

        const res  = await signIn(request, NAFATH_EXPIRED_COMPANY, NAFATH_EXPIRED_MOBILE, NAFATH_EXPIRED_PASSWORD);
        const body = await res.json();

        // Adjust the property path once the real response shape is confirmed
        // against the Swagger doc — this assumes a top-level `errorCode`, the
        // same shape used for other auth error codes in this API family.
        expect(JSON.stringify(body)).toContain('NAFATH_DATA_EXPIRED');
    });

    test('NW-01b: error response should not expose stack traces or database details', async ({ request }) => {
        test.skip(!NAFATH_EXPIRED_COMPANY || !NAFATH_EXPIRED_MOBILE, 'Set NAFATH_EXPIRED_COMPANY and NAFATH_EXPIRED_MOBILE env vars to run this test');

        const res  = await signIn(request, NAFATH_EXPIRED_COMPANY, NAFATH_EXPIRED_MOBILE, NAFATH_EXPIRED_PASSWORD);
        const text = await res.text();

        expect(text).not.toMatch(/stack|exception|sql|null pointer|traceback|ORA-|JDBC/i);
    });
});

test.describe('Login – WATHIQ document (CRN) expired', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    test('NW-02: should return 409 when WATHIQ document data has expired', async ({ request }) => {
        test.skip(!WATHIQ_EXPIRED_COMPANY || !WATHIQ_EXPIRED_MOBILE, 'Set WATHIQ_EXPIRED_COMPANY and WATHIQ_EXPIRED_MOBILE env vars to run this test');

        const res = await signIn(request, WATHIQ_EXPIRED_COMPANY, WATHIQ_EXPIRED_MOBILE, WATHIQ_EXPIRED_PASSWORD);

        expect(res.status()).toBe(409);
    });

    test('NW-02a: 409 response body should carry error code WATHIQ_DATA_EXPIRED', async ({ request }) => {
        test.skip(!WATHIQ_EXPIRED_COMPANY || !WATHIQ_EXPIRED_MOBILE, 'Set WATHIQ_EXPIRED_COMPANY and WATHIQ_EXPIRED_MOBILE env vars to run this test');

        const res  = await signIn(request, WATHIQ_EXPIRED_COMPANY, WATHIQ_EXPIRED_MOBILE, WATHIQ_EXPIRED_PASSWORD);
        const body = await res.json();

        expect(JSON.stringify(body)).toContain('WATHIQ_DATA_EXPIRED');
    });

    test('NW-02b: error response should not expose stack traces or database details', async ({ request }) => {
        test.skip(!WATHIQ_EXPIRED_COMPANY || !WATHIQ_EXPIRED_MOBILE, 'Set WATHIQ_EXPIRED_COMPANY and WATHIQ_EXPIRED_MOBILE env vars to run this test');

        const res  = await signIn(request, WATHIQ_EXPIRED_COMPANY, WATHIQ_EXPIRED_MOBILE, WATHIQ_EXPIRED_PASSWORD);
        const text = await res.text();

        expect(text).not.toMatch(/stack|exception|sql|null pointer|traceback|ORA-|JDBC/i);
    });
});

test.describe('Login – regression: unaffected account still logs in normally', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    test('NW-03: login should still succeed (200) for an account with no NAFATH/WATHIQ expiry', async ({ request }) => {
        const res = await signIn(request, VALID_COMPANY, VALID_MOBILE);

        expect(res.status()).toBe(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// NW-04–NW-05 — Redis TTL (cache) expiry, independent of document expiry
// Pending: no QA-facing way to force a TTL-only-expired state without direct
// Redis access or a dedicated seeding endpoint — coordinate with BE (see
// EMI-5836 comments) before un-skipping.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – NAFATH Redis TTL expired (document still valid)', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    const PENDING = 'pending a way to seed a NAFATH Redis-TTL-only-expired state (no document expiry) — coordinate with BE, see EMI-5836';

    test('NW-04: should return 409 distinguishing TTL/cache expiry from document expiry', async ({ request }) => {
        test.skip(true, PENDING);
        // Per the spec comment thread: the error here must NOT be
        // NAFATH_DATA_EXPIRED (that's reserved for actual document expiry) —
        // expect a distinct code/message indicating cache-only expiry, and
        // confirm the account's National ID/Iqama itself has not expired.
    });

    test('NW-05: should not require the user to physically re-present ID — only NAFATH Generate Random + Get Status re-verification', async ({ request }) => {
        test.skip(true, PENDING);
    });
});

test.describe('Login – WATHIQ Redis TTL expired (auto-heal, should NOT block login)', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    const PENDING = 'pending a way to seed a WATHIQ Redis-TTL-only-expired state and trigger the TTL-monitoring job on demand — coordinate with BE, see EMI-5836';

    test('NW-06: login should succeed once the background TTL-monitoring job has refreshed WATHIQ data automatically', async ({ request }) => {
        test.skip(true, PENDING);
        // Per spec: "This process should be fully automated without requiring
        // any user interaction." If login is blocked here, that's either a bug
        // or a race between the job and the login attempt — worth clarifying
        // expected timing with the assignee before treating a failure as a defect.
    });

    test('NW-07: login should be blocked with WATHIQ_DATA_EXPIRED if the TTL-refresh job discovers the CRN itself has since expired', async ({ request }) => {
        test.skip(true, PENDING);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// NW-08–NW-11 — Revalidation APIs (profile-data-renewal-controller)
// Pending: exact endpoint paths/payloads are not in the ticket text or this
// repo — confirm against the Swagger doc linked in Anas Al-Halawani's
// 2026-07-26 comment before writing real requests here.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – NAFATH revalidation flow (Generate Random + Get Status)', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    const PENDING = 'pending confirmed endpoint paths from the Emi Profile Service Swagger (profile-data-renewal-controller) and a dedicated blocked test account — see EMI-5836';

    test('NW-08: successful re-verification should clear is_nafath_data_expired and allow login', async ({ request }) => {
        test.skip(true, PENDING);
        // Intended flow: call Generate Random -> complete verification -> poll
        // Get Status until verified -> retry POST /auth/signin -> expect 200.
    });

    test('NW-09: a failed/abandoned re-verification should leave the account blocked with 409 NAFATH_DATA_EXPIRED', async ({ request }) => {
        test.skip(true, PENDING);
    });
});

test.describe('Login – WATHIQ revalidation flow (refresh CRN)', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    const PENDING = 'pending confirmed endpoint paths from the Emi Profile Service Swagger (profile-data-renewal-controller) and a dedicated blocked test account — see EMI-5836';

    test('NW-10: successful CRN refresh should clear is_wathiq_data_expired and allow login', async ({ request }) => {
        test.skip(true, PENDING);
    });

    test('NW-11: a refresh attempt that still returns an expired CRN should leave the account blocked with 409 WATHIQ_DATA_EXPIRED', async ({ request }) => {
        test.skip(true, PENDING);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// NW-12–NW-13 — Deactivation scope (user-scoped NAFATH vs profile-scoped WATHIQ)
// Pending: requires backend/DB access to inspect user vs. profile state
// directly — not observable from the login API response alone.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – deactivation scope (per Amer Majed Abdalrazeq\'s 2026-07-16 comment)', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    const PENDING = 'pending DB access to confirm which entity (user vs. profile) was deactivated — not observable from the login API response alone, see EMI-5836';

    test('NW-12: NAFATH expiry should deactivate the USER, not the individual business profile', async ({ request }) => {
        test.skip(true, PENDING);
        // For a user linked to 2+ business profiles: expire NAFATH data for the
        // user, run the validation job, and confirm the USER record (not a
        // single profile) is deactivated — per the explicit correction in the
        // comment thread that NAFATH is user-scoped, not business-scoped.
    });

    test('NW-13: WATHIQ expiry should deactivate the PROFILE, not the user', { annotation: [{ type: 'testcase', description: "LG-144: WATHIQ expiry deactivates the profile, not the user" }] }, async ({ request }) => {
        test.skip(true, PENDING);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// NW-14–NW-16 — Arabic localisation of the expiry messages (EMI-5969)
//
// EMI-5969 ("Nafath and Wathiq Expiry message is not displayed in Arabic") is
// the localisation half of the EMI-5836 blocking behaviour asserted above: the
// 409 fires correctly, but its message came back in English regardless of the
// requested locale. Part of the wider EMI-5964 / EMI-6024 / EMI-6050 locale
// sweep — EMI-6024 specifically lists "Session" among the actions with a
// hard-coded locale, which is what this endpoint is.
//
// These need the same blocked fixture accounts as NW-01..NW-05 and skip
// identically when they are not configured.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login – NAFATH / WATHIQ expiry message localisation (EMI-5969)', { tag: ['@login', '@api'], annotation: [{ type: 'feature', description: 'Login' }, { type: 'layer', description: 'api' }] }, () => {
    test.describe.configure({ mode: 'serial' });

    const API_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';
    const NO_NAFATH_ACCOUNT = 'set NAFATH_EXPIRED_COMPANY / NAFATH_EXPIRED_MOBILE to a blocked fixture account';
    const NO_WATHIQ_ACCOUNT = 'set WATHIQ_EXPIRED_COMPANY / WATHIQ_EXPIRED_MOBILE to a blocked fixture account';

    /** Arabic script range — a translated message must actually contain Arabic. */
    const ARABIC_SCRIPT = /[؀-ۿ]/;

    function signinHeaders(locale: 'en_uk' | 'ar_sa'): Record<string, string> {
        return {
            'Content-Type':    'application/json',
            Accept:            '*/*',
            'Accept-Language': locale,
            locale,
            platform:          'web',
        };
    }

    test('NW-14: the NAFATH_DATA_EXPIRED message is returned in Arabic when ar_sa is requested', async ({ request }) => {
        test.skip(!NAFATH_EXPIRED_COMPANY || !NAFATH_EXPIRED_MOBILE, NO_NAFATH_ACCOUNT);

        const res = await request.post(`${API_BASE}/auth/signin`, {
            headers: signinHeaders('ar_sa'),
            data: {
                username:     `+966${NAFATH_EXPIRED_MOBILE}`,
                password:     NAFATH_EXPIRED_PASSWORD,
                tenantNumber: NAFATH_EXPIRED_COMPANY,
            },
        });

        expect(res.status(), 'the account is not blocked — NW-01 covers the blocking behaviour').toBe(409);

        const text = await res.text();
        expect(text, 'the NAFATH expiry message came back with no Arabic in it').toMatch(ARABIC_SCRIPT);
    });

    test('NW-15: the WATHIQ_DATA_EXPIRED message is returned in Arabic when ar_sa is requested', async ({ request }) => {
        test.skip(!WATHIQ_EXPIRED_COMPANY || !WATHIQ_EXPIRED_MOBILE, NO_WATHIQ_ACCOUNT);

        const res = await request.post(`${API_BASE}/auth/signin`, {
            headers: signinHeaders('ar_sa'),
            data: {
                username:     `+966${WATHIQ_EXPIRED_MOBILE}`,
                password:     WATHIQ_EXPIRED_PASSWORD,
                tenantNumber: WATHIQ_EXPIRED_COMPANY,
            },
        });

        expect(res.status(), 'the account is not blocked — NW-02 covers the blocking behaviour').toBe(409);

        const text = await res.text();
        expect(text, 'the WATHIQ expiry message came back with no Arabic in it').toMatch(ARABIC_SCRIPT);
    });

    test('NW-16: the en_uk and ar_sa responses differ, and the error CODE stays stable across both', async ({ request }) => {
        test.skip(!NAFATH_EXPIRED_COMPANY || !NAFATH_EXPIRED_MOBILE, NO_NAFATH_ACCOUNT);

        const credentials = {
            username:     `+966${NAFATH_EXPIRED_MOBILE}`,
            password:     NAFATH_EXPIRED_PASSWORD,
            tenantNumber: NAFATH_EXPIRED_COMPANY,
        };

        const english = await request.post(`${API_BASE}/auth/signin`, { headers: signinHeaders('en_uk'), data: credentials });
        const arabic  = await request.post(`${API_BASE}/auth/signin`, { headers: signinHeaders('ar_sa'), data: credentials });

        const englishText = await english.text();
        const arabicText  = await arabic.text();

        // EMI-5969: pre-fix the two were byte-identical because the message was
        // resolved in a hard-coded locale.
        expect(arabicText, 'the ar_sa response is identical to the en_uk one').not.toBe(englishText);
        // The machine-readable code must NOT be translated — only the prose.
        expect(englishText).toContain('NAFATH_DATA_EXPIRED');
        expect(arabicText).toContain('NAFATH_DATA_EXPIRED');
    });
});
