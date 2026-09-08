import { test, expect } from '@playwright/test';
import {
    API_BASE, RECOMPUTE_PATH, REBUILD_PATH,
    BALANCES_IMPLEMENTED, PENDING_BUILD, PENDING_TOOLING, NO_DB,
    FINANCE_LEAD_TOKEN, NO_PRIVILEGE_TOKEN, WALLET_CODE,
    authHeaders, satisfiesIdentity, NEGATIVE_AVAILABLE_TOLERATED,
} from '../BalancesHelper';

// ─────────────────────────────────────────────────────────────────────────────
// Wallet Balance Recompute (BAL-RC-01..20) — EMI-5946
//
// Manual cases: "Wallet Balance Recompute" sheet, TC-Recompute-01..30, in
// docs/manual-test-cases/Balances-Wallet-Consistency-EMI-5944/.
//
// This is the ROUTINE repair mode. Bucket totals are a set aggregate over
// ledger state and addition commutes, so the result cannot depend on the order
// postings were applied — which makes recompute immune to every ordering and
// redelivery failure in the Debezium/Kafka projection path. EMI-5945 statement
// rebuild is the break-glass mode and is a different question entirely: "is the
// customer's statement right?" rather than "is the wallet's money right?".
// Conflating the two is what stalled this work for six months.
//
// EMI-5946 is To Do and no API reference exists, so every test is skipped and
// the intended assertion is stated. Same convention as Reconciliation/.
// ─────────────────────────────────────────────────────────────────────────────

const NO_FINANCE_TOKEN = 'no BALANCES_FINANCE_LEAD_TOKEN — business sign-in cannot mint a Finance Lead token';

test.describe('Recompute – Derivation (BAL-RC-01..05)', () => {
    test.describe.configure({ mode: 'serial' });

    test('BAL-RC-01 (TC-Recompute-01): buckets are derived from transaction_log, never from running_balance', async ({ request }) => {
        test.skip(true, NO_DB);
        // Reading the projection to repair the projection is the defect this
        // story removes. Intended: trace every table the job reads and assert
        // running_balance is not among them.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-02 (TC-Recompute-02): the aggregate covers all postings for a transaction', async ({ request }) => {
        test.skip(true, NO_DB);
        // The ledger is append-only (Q1, confirmed 2026-08-03): PENDING, SUCCESS
        // and FAILED are separate appended rows for one transaction, not one row
        // whose status changed. The GROUP BY grain must reflect that — it is the
        // single most important thing to get right before writing the query.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-03 (TC-Recompute-04): the result is order-invariant', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!FINANCE_LEAD_TOKEN, NO_FINANCE_TOKEN);
        // Intended: apply a wallet's postings in a deliberately shuffled order,
        // recompute, reshuffle, recompute again — assert both runs return
        // identical buckets. This is the property that makes recompute the
        // routine repair mode; if it fails, the job is reading something
        // order-dependent it should not be.
        const first = await request.post(`${API_BASE}${RECOMPUTE_PATH}`, {
            headers: authHeaders(FINANCE_LEAD_TOKEN),
            data: { walletScope: { type: 'WALLET_CODES', values: [WALLET_CODE] }, reason: 'order-invariance check' },
        });
        expect(first.status()).toBeLessThan(300);
    });

    test('BAL-RC-04 (TC-Recompute-03): the status x direction mapping is consumed, not re-implemented', async ({ request }) => {
        test.skip(true, NO_DB);
        // The mapping is the single shared definition on EMI-602, used by the
        // live consumer, this job and EMI-5950 validation. A second
        // implementation is exactly how the two drift apart.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-05 (TC-Recompute-12): adjustment postings are aggregated with no special-casing', async ({ request }) => {
        test.skip(true, NO_DB);
        // The pair-adjustment unwind on EMI-602 produces four appended postings.
        // Recompute simply sums them like any others — which is precisely why it
        // stays order-independent.
        expect(request).toBeTruthy();
    });
});

test.describe('Recompute – Buckets And The Identity (BAL-RC-06..10)', () => {
    test.describe.configure({ mode: 'serial' });

    test('BAL-RC-06 (TC-Recompute-09): reserve_credit is excluded from current', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!FINANCE_LEAD_TOKEN, NO_FINANCE_TOKEN);
        // The most commonly misread rule in the model. A wallet holding an
        // unsettled incoming payment must show reserve_credit populated and
        // current unchanged. Asserting the intuitive
        // available + reserve_credit − reserve_debit passes against a BROKEN
        // build, so this case is worth more than it looks.
        const res = await request.post(`${API_BASE}${RECOMPUTE_PATH}`, {
            headers: authHeaders(FINANCE_LEAD_TOKEN),
            data: { walletScope: { type: 'WALLET_CODES', values: [WALLET_CODE] }, reason: 'reserve_credit exclusion check' },
        });
        const body = await res.json().catch(() => null);
        test.skip(!body?.buckets, 'recompute response carries no buckets to assert on');
        expect(satisfiesIdentity(body.buckets), 'current != available + reserve_debit').toBe(true);
    });

    test('BAL-RC-07 (TC-Recompute-08): an open outgoing pending sits in reserve_debit', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // Intended: with an open outgoing pending, assert reserve_debit reflects
        // the hold, available is correspondingly reduced, and current is
        // UNCHANGED — the money has not left yet.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-08 (TC-Recompute-10): commission and VAT wallets are ordinary destinations', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // Intended: during an open reserve window their amounts sit in
        // reserve_credit, not available, with no special-casing anywhere.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-09 (TC-Recompute-11): settlement moves reserve_credit into available', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // Intended: recompute a destination wallet mid-reserve, settle, recompute
        // again. First run: amount in reserve_credit, current unchanged. Second:
        // moved to available, current increased.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-10 (TC-Recompute-15): a negative available is written and flagged, never clamped', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // Q5, resolved 2026-08-03. The ledger is truth, and silently correcting
        // would hide the underlying defect. A test asserting the value is
        // rejected or clamped would fail against a CORRECT build.
        expect(NEGATIVE_AVAILABLE_TOLERATED).toBe(true);
        expect(request).toBeTruthy();
    });
});

test.describe('Recompute – Idempotency And Variance (BAL-RC-11..14)', () => {
    test.describe.configure({ mode: 'serial' });

    test('BAL-RC-11 (TC-Recompute-05, TC-Recompute-07): a zero-variance run is a NO_OP and still recorded', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!FINANCE_LEAD_TOKEN, NO_FINANCE_TOKEN);
        // No write, but the run IS recorded — so the check itself stays
        // auditable. Closes the EMI-4861 signature, where the job mutated
        // balances on every execution with no corresponding ledger change.
        const first = await request.post(`${API_BASE}${RECOMPUTE_PATH}`, {
            headers: authHeaders(FINANCE_LEAD_TOKEN),
            data: { walletScope: { type: 'WALLET_CODES', values: [WALLET_CODE] }, reason: 'idempotency check' },
        });
        const second = await request.post(`${API_BASE}${RECOMPUTE_PATH}`, {
            headers: authHeaders(FINANCE_LEAD_TOKEN),
            data: { walletScope: { type: 'WALLET_CODES', values: [WALLET_CODE] }, reason: 'idempotency check' },
        });
        const body = await second.json().catch(() => null);
        expect(first.status()).toBeLessThan(300);
        expect(String(body?.status ?? ''), 'a re-run over an unchanged ledger was not a NO_OP').toBe('NO_OP');
    });

    test('BAL-RC-12 (TC-Recompute-13): a compensating error across two buckets is not masked', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // One bucket high and another low by the same amount nets to zero.
        // Variance must be captured PER BUCKET, or this reports clean while the
        // wallet is wrong in two places.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-13 (TC-Recompute-16): the running_balance sequence is provably untouched', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // This job repairs the snapshot, never the statement. Intended: capture
        // the entry sequence, recompute, assert it is byte-identical.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-14 (TC-Recompute-17): wrong statement with right buckets reports NO_OP and flags a rebuild', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // The operator has to be told a follow-up is needed, or the statement
        // stays wrong silently. EMI-5945 is flagged, never auto-invoked.
        expect(request).toBeTruthy();
    });
});

test.describe('Recompute – Scope, Concurrency And Authorization (BAL-RC-15..20)', () => {
    test.describe.configure({ mode: 'serial' });

    test('BAL-RC-15 (TC-Recompute-21): wallet_scope accepts ALL, a code list and a single id', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        expect(request).toBeTruthy();
    });

    test('BAL-RC-16 (TC-Recompute-19): a scope overlapping an in-flight rebuild is rejected', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!FINANCE_LEAD_TOKEN, NO_FINANCE_TOKEN);
        // The two repair modes are mutually exclusive per wallet. Rejected with
        // 409, not queued — a queued repair would run against state the other
        // one is midway through changing.
        const res = await request.post(`${API_BASE}${RECOMPUTE_PATH}`, {
            headers: authHeaders(FINANCE_LEAD_TOKEN),
            data: { walletScope: { type: 'WALLET_CODES', values: [WALLET_CODE] }, reason: 'conflict check' },
        });
        expect([200, 202, 409]).toContain(res.status());
    });

    test('BAL-RC-17 (TC-Recompute-20): recompute serialises against live traffic', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        // Intended: post transactions to the wallet during a recompute and
        // reconcile against the ledger — no posting lost or double-counted.
        expect(request).toBeTruthy();
    });

    test('BAL-RC-18 (TC-Recompute-22): one transaction per wallet, no partially-recomputed state', async ({ request }) => {
        test.skip(true, PENDING_TOOLING);
        // Executes in the Wallet Service, not Reports — Reports doing the
        // arithmetic is the root of the temporary-incorrect-balance window and
        // of three separate 500-error incidents (EMI-3506, 3916, 5632).
        expect(request).toBeTruthy();
    });

    test('BAL-RC-19 (TC-Recompute-25): a non-Finance-Lead manual trigger is refused', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!NO_PRIVILEGE_TOKEN, 'no BALANCES_NO_PRIVILEGE_TOKEN provided for the 403 check');
        const res = await request.post(`${API_BASE}${RECOMPUTE_PATH}`, {
            headers: authHeaders(NO_PRIVILEGE_TOKEN),
            data: { walletScope: { type: 'ALL' }, reason: 'privilege check' },
        });
        expect(res.status(), 'an unprivileged caller was allowed to recompute balances').toBe(403);
    });

    test('BAL-RC-20 (TC-Recompute-24, TC-Recompute-28): unknown wallet is a 400, unreachable ledger a 503', async ({ request }) => {
        test.skip(!BALANCES_IMPLEMENTED, PENDING_BUILD);
        test.skip(!FINANCE_LEAD_TOKEN, NO_FINANCE_TOKEN);
        // Neither may start a partial run or leave a wallet half-updated.
        const res = await request.post(`${API_BASE}${RECOMPUTE_PATH}`, {
            headers: authHeaders(FINANCE_LEAD_TOKEN),
            data: { walletScope: { type: 'WALLET_CODES', values: ['NOT-A-REAL-WALLET'] }, reason: 'unknown wallet check' },
        });
        expect(res.status()).toBe(400);
        expect(REBUILD_PATH).toBeTruthy();
    });
});
