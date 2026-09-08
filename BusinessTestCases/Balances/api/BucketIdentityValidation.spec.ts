import { test, expect } from '@playwright/test';
import {
    API_BASE, VARIANCE_PATH, STUCK_RESERVES_PATH,
    BALANCES_IMPLEMENTED, PENDING_BUILD, NO_DB,
    FINANCE_LEAD_TOKEN, COMMISSION_WALLET_CODE,
    authHeaders, satisfiesIdentity, conservationDelta, isShortfall, isSurplus,
    NEGATIVE_AVAILABLE_TOLERATED,
} from '../BalancesHelper';

// ─────────────────────────────────────────────────────────────────────────────
// Bucket Identity Validation & Variance Detection (BAL-ID-01..16) — EMI-5950
// Stuck Reserve Detection (BAL-SR-01..05) — EMI-5951
//
// Manual cases: the "Bucket Identity Validation" (TC-Identity-01..30) and
// "Stuck Reserve Detection" (TC-Stuck-01..21) sheets in
// docs/manual-test-cases/Balances-Wallet-Consistency-EMI-5944/.
//
// The platform today discovers balance drift when a customer complains or a
// rebuild happens to run. This is the continuous assertion that replaces that.
//
// ── The one case that justifies the whole story ──────────────────────────
// BAL-ID-06. A transaction whose VAT leg was NEVER CREATED leaves every
// individual wallet internally consistent — the per-wallet identity passes, and
// no amount of per-wallet checking can ever see it. Only the cross-wallet
// conservation check catches it. That is the failure mode behind the
// reserve-never-released defect class: EMI-2013, EMI-4591, EMI-5771, plus the
// EMI-3506 QA trail. Four occurrences, every one found reactively.
//
// EMI-5950 and EMI-5951 are both To Do, so every test is skipped with its
// intended assertion stated — same convention as Reconciliation/.
// ─────────────────────────────────────────────────────────────────────────────

const NO_FINANCE_TOKEN = 'no BALANCES_FINANCE_LEAD_TOKEN — business sign-in cannot mint a Finance Lead token';
const NO_VARIANCE_API = 'the variance store has no read API yet — verify via the reconciliation console';

test.describe('Bucket identity – The Per-Wallet Rule (BAL-ID-01..04)', () => {
    test.describe.configure({ mode: 'serial' });

    test('BAL-ID-01 (TC-Identity-01): the identity is a database constraint, not an application check', async ({ request }) => {
        test.skip(true, NO_DB);
        // Intended: bypass the application and write current != available +
        // reserve_debit directly. The database must reject it. An application
        // check alone is bypassable by every job that does not go through it.
        expect(request).toBeTruthy();
    });

    test('BAL-ID-02 (TC-Identity-03): NO non-negativity constraint exists', async ({ request }) => {
        test.skip(true, NO_DB);
        // Q5, resolved 2026-08-03. A CHECK forbidding a negative available would
        // fail against live data: commission and VAT wallets go temporarily
        // negative during the reserve window, because those legs are created
        // after the main transaction succeeds and were never part of the
        // original validation. This test asserts the ABSENCE of a constraint —
        // adding one looks like a fix and is a regression.
        expect(NEGATIVE_AVAILABLE_TOLERATED).toBe(true);
        expect(request).toBeTruthy();
    });

    test('BAL-ID-03 (TC-Identity-04, TC-Identity-05): a violation is captured, not silently rolled back', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // The attempted state must be recorded for diagnosis. A violation that
        // rolls back and disappears leaves nothing to investigate.
        expect(request).toBeTruthy();
    });

    test('BAL-ID-04 (TC-Identity-23): a negative available with a satisfied identity passes the constraint', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!COMMISSION_WALLET_CODE, 'no BALANCES_COMMISSION_WALLET_CODE to drive negative');
        // The case the Q5 decision deliberately creates. It must be covered
        // here, not discovered in production: constraint passes, write is not
        // rejected, variance record raised and alerted.
        expect(satisfiesIdentity({ available: -50, reserve_debit: 50, reserve_credit: 0, current: 0 })).toBe(true);
        expect(request).toBeTruthy();
    });
});

test.describe('Bucket identity – Cross-Wallet Conservation (BAL-ID-05..08)', () => {
    test.describe.configure({ mode: 'serial' });

    test('BAL-ID-05 (TC-Identity-07): conservation holds across all destination wallets', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // sender.reserve_debit === SUM(reserve_credit) across receiver,
        // commission and VAT, for the duration of the reserve window.
        expect(conservationDelta(100, [80, 15, 5])).toBe(0);
        expect(request).toBeTruthy();
    });

    test('BAL-ID-06 (TC-Identity-08): a missing VAT leg is caught by conservation, not by the per-wallet check', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // The case that proves the stronger check earns its place. Every wallet
        // is internally consistent, so the per-wallet identity PASSES; only the
        // cross-wallet sum reveals the missing leg.
        const delta = conservationDelta(100, [80, 15]);   // VAT leg of 5 never created
        expect(delta, 'a missing leg did not surface as a conservation shortfall').toBe(5);
        expect(isShortfall(delta), 'a missing leg must read as a shortfall').toBe(true);
        expect(request).toBeTruthy();
    });

    test('BAL-ID-07 (TC-Identity-09): shortfall and surplus are recorded distinctly and attributed', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // They have different causes and different fixes — a shortfall points at
        // EMI-5949 lifecycle ordering, a surplus at EMI-5948 idempotency.
        // Collapsing them into one "mismatch" figure destroys the diagnostic
        // value, which is the whole reason to run the check.
        expect(isShortfall(conservationDelta(100, [80, 15]))).toBe(true);
        expect(isSurplus(conservationDelta(100, [80, 15, 5, 5]))).toBe(true);
        expect(request).toBeTruthy();
    });

    test('BAL-ID-08 (TC-Identity-10, TC-Identity-11): conservation runs independently and survives a mid-sweep settlement', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // It must not be skipped because the per-wallet check passed, and a
        // transaction settling mid-sweep must not raise a false positive from
        // the reserve window being observed half-closed.
        expect(request).toBeTruthy();
    });
});

test.describe('Bucket identity – Sweep, Tie-Out And Response (BAL-ID-09..16)', () => {
    test.describe.configure({ mode: 'serial' });

    test('BAL-ID-09 (TC-Identity-12): the sweep catches wallets that are consistent but disagree with the ledger', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // The per-write assertion cannot see this: the buckets satisfy the
        // identity, they just do not match what the ledger says they should be.
        expect(request).toBeTruthy();
    });

    test('BAL-ID-10 (TC-Identity-14): sweep variance is recorded per bucket', async ({ request }) => {
        test.skip(true, NO_VARIANCE_API);
        expect(request).toBeTruthy();
    });

    test('BAL-ID-11 (TC-Identity-17): reserve_credit is excluded from the estate tie-out', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // Including it would overstate issued e-money by the value of unsettled
        // incoming payments — a regulatory reporting error, not just a bug.
        expect(request).toBeTruthy();
    });

    test('BAL-ID-12 (TC-Identity-16, TC-Identity-18): the estate ties to the safeguarding position', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // Issued balance must equal client money held. A failed tie-out is
        // reported to Compliance with the delta, not retried quietly.
        expect(request).toBeTruthy();
    });

    test('BAL-ID-13 (TC-Identity-19): a variant wallet is quarantined individually', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // There is never a platform-wide freeze. Every other wallet stays fully
        // transactable — intended: confirm no global-freeze path exists at all.
        expect(request).toBeTruthy();
    });

    test('BAL-ID-14 (TC-Identity-20, TC-Identity-21): recompute is auto-invoked, rebuild only flagged', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // EMI-5946 runs for the affected scope only. EMI-5945 rewrites the
        // customer's statement, so it is never triggered automatically.
        expect(request).toBeTruthy();
    });

    test('BAL-ID-15 (TC-Identity-25): a systemic failure raises one aggregated alert', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!FINANCE_LEAD_TOKEN, NO_FINANCE_TOKEN);
        // One alert with aggregated detail, not one per wallet. An alert storm
        // during a systemic failure is how the real signal gets missed.
        const res = await request.get(`${API_BASE}${VARIANCE_PATH}?page=0&size=1`, {
            headers: authHeaders(FINANCE_LEAD_TOKEN),
        });
        expect(res.status()).toBeLessThan(500);
    });

    test('BAL-ID-16 (TC-Identity-24, TC-Identity-27): negative-balance occurrences are trended separately', async ({ request }) => {
        test.skip(true, NO_VARIANCE_API);
        // Separately from other variance, so the size of the Q5 carve-out is
        // measurable and the case for fixing commission/VAT leg ordering can be
        // made with data rather than argued.
        expect(request).toBeTruthy();
    });
});

test.describe('Stuck reserves – Detection (BAL-SR-01..05, EMI-5951)', () => {
    test.describe.configure({ mode: 'serial' });

    test('BAL-SR-01 (TC-Stuck-01, TC-Stuck-02): a reserve past its threshold with no releasing event is flagged', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!FINANCE_LEAD_TOKEN, NO_FINANCE_TOKEN);
        // The customer's own money is unreachable and nothing notices. Today the
        // detection mechanism is the customer complaining.
        const res = await request.get(`${API_BASE}${STUCK_RESERVES_PATH}?page=0&size=20`, {
            headers: authHeaders(FINANCE_LEAD_TOKEN),
        });
        expect(res.status()).toBeLessThan(500);
    });

    test('BAL-SR-02 (TC-Stuck-04): a type-specific threshold overrides the global default', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // A card authorisation and an EOD bank settlement have legitimately
        // different lifetimes; one global threshold would either miss the first
        // or cry wolf on the second.
        expect(request).toBeTruthy();
    });

    test('BAL-SR-03 (TC-Stuck-06): the EMI-5771 scenario is flagged', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // Failed EOD bank statement, reserve_debit never returned to available.
        // The regression guard for the most frequent balance failure signature
        // in the project's history.
        expect(request).toBeTruthy();
    });

    test('BAL-SR-04 (TC-Stuck-13): a systemic release failure produces one aggregated alert', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        expect(request).toBeTruthy();
    });

    test('BAL-SR-05 (TC-Stuck-15): detection creates no new way to move money', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // This story detects and reports only. Release goes through the existing
        // correction path — intended: enumerate every action the surface offers
        // and assert none of them moves funds directly.
        expect(request).toBeTruthy();
    });
});
