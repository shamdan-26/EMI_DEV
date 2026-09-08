import { test, expect } from '@playwright/test';
import {
    API_BASE, POS_CALLBACK, POS_TRANSACTIONS, POS_LEDGER_WALLET_PATH,
    TERMINAL_ID, WALLET_REFERENCE, CALLBACK_TOKEN,
    REFUND_WINDOW_DAYS, REFUND_PARK_ESCALATION_HOURS,
    authHeaders, buildCallbackXml, callbackXmlHeaders,
    freshRrn, freshStan, isClientError, firstError, isSpringPage,
    getBusinessToken, hasPosAccess, walletLedgerTotal, findByRrn,
} from '../PosTransactionsHelper';

// ─────────────────────────────────────────────────────────────────────────────
// POS – Refunds (POS-REF-01..POS-REF-18) — EMI-5918
//
// Automates the "PoS Refunds" sheet of
// docs/manual-test-cases/PoS-Transactions-V6.6.0/
//   PoS Transactions Test_Cases Release V6.6.0 - MASTER.xlsx (TC-Refund-01..40).
// Each test title carries its TC-Refund id so the workbook and this suite stay
// traceable, the same convention as the TC-nnn files in this folder.
//
// ── Read this before a red run is treated as a bug ───────────────────────
// EMI-5918 is **To Do**. Nothing below is implemented yet, so this file is
// written the way Reconciliation/ and TransactionOperations/ are: the intended
// assertions are real and complete, and the whole suite is gated so a routine
// `npm run test:pos` reports skips rather than a wall of red. Flip
// POS_REFUNDS_IMPLEMENTED=true once the story ships and the assertions run as
// written. Do not soften them to get green — if one fails after that, it is
// telling you something.
//
// ── What this story is, in one line ──────────────────────────────────────
// A refund is captured, linked and counted, and NO MONEY MOVES. ANB's
// settlement report is settled-only and excludes refunds, so no batch forms and
// no wallet debit exists anywhere in the chain. Most tests below therefore
// prove an ABSENCE — balance unchanged, no batch member, nothing in the
// discrepancy queue — which is why they read state before and after rather than
// looking for a new record.
//
// ── The contradiction worth knowing about ────────────────────────────────
// An earlier suite (EMI5915_Test_Cases_v5) asserted the opposite on three
// points: that a refund reserves merchant funds, that an insufficient balance
// rejects it, and that an acquirer rejection releases a reserve. Current
// acceptance criteria say none of those happen. POS-REF-08 is the direct
// regression guard — it asserts the refund is CAPTURED on a zero-balance
// merchant, which the old suite expected to fail.
//
// ── Observability limits, stated up front ────────────────────────────────
// Several criteria assert on state this suite cannot see: settlement_expected
// on the stored row, the parked-refund queue, the E34 exposure total and the
// safeguarding report. There is no DB connection (dropped in 7e7b558) and no
// read API for any of them. Those cases use the closest black-box proxy where
// one exists and are `test.skip(true, ...)` where none does, with the intended
// assertion left in place — same convention as PosCallbackDefects.spec.ts.
//
// The callback endpoint needs POS_TRANSACTION_CALLBACK, which business sign-in
// does not grant, so POS_CALLBACK_TOKEN gates every capture case.
// ─────────────────────────────────────────────────────────────────────────────

const IMPLEMENTED = (process.env['POS_REFUNDS_IMPLEMENTED'] ?? '').toLowerCase() === 'true';
const NOT_BUILT = 'EMI-5918 is To Do — set POS_REFUNDS_IMPLEMENTED=true once refund capture ships';
const NO_CALLBACK_TOKEN = 'no POS_CALLBACK_TOKEN provided — the callback privilege cannot be minted by the suite';
const NO_EXPOSURE_API = 'asserts on the E34 exposure total, which has no read API — verify with Finance reporting';
const NO_PARK_API = 'asserts on the Ops parked-refund queue, which has no read API yet';
const NO_DB = 'asserts on stored column state; this suite has no DB connection — verify manually or expose a read API';

let readToken = '';
let canRead = false;

test.beforeAll(async ({ request }) => {
    readToken = await getBusinessToken(request);
    canRead = await hasPosAccess(request, readToken, POS_TRANSACTIONS);
});

/** Captures a settled purchase and returns its RRN, so a refund has an original. */
async function captureOriginal(request: import('@playwright/test').APIRequestContext, amount = '100.00'): Promise<string> {
    const rrn = freshRrn();
    await request.post(`${API_BASE}${POS_CALLBACK}`, {
        headers: callbackXmlHeaders(CALLBACK_TOKEN),
        data: buildCallbackXml({ rrn, stan: `STAN${freshStan()}`, amount, transactionType: 'PURCHASE' }),
    });
    return rrn;
}

// ═════════════════════════════════════════════════════════════════════════
// A. Capture — the refund is recorded through EMI-5915's single entry point
// ═════════════════════════════════════════════════════════════════════════

test.describe('POS refunds – Capture (POS-REF-01..04)', () => {
    test.describe.configure({ mode: 'serial' });

    test('POS-REF-01 (TC-Refund-01, TC-Refund-02): a refund is accepted on the shared callback endpoint', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);

        const originalRrn = await captureOriginal(request);
        const res = await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, amount: '100.00' }),
        });

        // No separate ingestion path exists — the refund uses the same URL,
        // headers and auth as a purchase. A 404 here would mean a second
        // endpoint was built, which the story explicitly forbids.
        expect(res.status(), 'refund rejected by the shared callback endpoint').toBeLessThan(300);
    });

    test('POS-REF-02 (TC-Refund-08): a refund missing its mandatory fields is rejected', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);

        // rrn and amount are both mandatory at capture. Capture completeness is
        // the critical property of this story: nothing downstream reconciles a
        // refund against a bank file, so there is no second source to repair a
        // bad capture from.
        const res = await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', rrn: '', amount: '' }),
        });

        expect(res.status()).not.toBe(500);
        expect(isClientError(res.status()), `expected a 4xx, got ${res.status()}`).toBe(true);
    });

    test('POS-REF-03 (TC-Refund-09): occurred_at precision is preserved in full', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);
        test.skip(!canRead, 'cannot read POS transactions back to compare the stored timestamp');

        const originalRrn = await captureOriginal(request);
        const rrn = freshRrn();
        await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, rrn }),
        });

        const stored = await findByRrn(request, readToken, rrn);
        expect(stored, 'refund not readable after capture').not.toBeNull();
        // The source sends seconds precision; a stored value truncated to the
        // day would still "look right" in a list view, so compare the raw value.
        const occurred = String(stored?.['transactionDate'] ?? '');
        expect(occurred, 'stored timestamp lost its time component').toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    test('POS-REF-04 (TC-Refund-04, TC-Refund-05): settlement_expected is false and immutable', async ({ request }) => {
        test.skip(true, NO_DB);
        // Intended: read settlement_expected on the stored refund, assert false,
        // then attempt to update it through every available path and assert each
        // is rejected. Derived at capture per EMI-5915 section H.
        expect(request).toBeTruthy();
    });
});

// ═════════════════════════════════════════════════════════════════════════
// B. Linkage and the cumulative cap
// ═════════════════════════════════════════════════════════════════════════

test.describe('POS refunds – Linkage (POS-REF-05..07)', () => {
    test.describe.configure({ mode: 'serial' });

    test('POS-REF-05 (TC-Refund-10, TC-Refund-12): the original is linked and flagged refunded', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);
        test.skip(!canRead, 'cannot read POS transactions back to inspect the linkage');

        const originalRrn = await captureOriginal(request, '100.00');
        await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, amount: '100.00' }),
        });

        const original = await findByRrn(request, readToken, originalRrn);
        expect(original, 'original sale not readable').not.toBeNull();
        const flag = String(original?.['refundStatus'] ?? original?.['processingStatus'] ?? '').toLowerCase();
        expect(flag, 'original was not flagged refunded').toContain('refund');
    });

    test('POS-REF-06 (TC-Refund-13, TC-Refund-14): cumulative refunds cannot exceed the original gross', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);

        const originalRrn = await captureOriginal(request, '100.00');
        const first = await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, amount: '40.00' }),
        });
        expect(first.status(), 'first partial refund rejected').toBeLessThan(300);

        // 40 + 70 > 100. Enforced by DB constraint, not application logic — this
        // is a data-integrity control that stops a corrupt feed inflating the
        // exposure figure, which is the only number this story produces.
        const second = await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, amount: '70.00' }),
        });
        expect(isClientError(second.status()), `cap breach accepted with ${second.status()}`).toBe(true);

        const error = firstError(await second.json().catch(() => null));
        expect(JSON.stringify(error)).not.toContain('Internal Server Error');
    });

    test('POS-REF-07 (TC-Refund-38): the cap holds under concurrent partial refunds', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);

        const originalRrn = await captureOriginal(request, '100.00');
        // Four concurrent 30.00 refunds against a 100.00 original: at most three
        // can be admitted. A race that admits all four is the defect this guards.
        const results = await Promise.all(
            Array.from({ length: 4 }, () => request.post(`${API_BASE}${POS_CALLBACK}`, {
                headers: callbackXmlHeaders(CALLBACK_TOKEN),
                data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, amount: '30.00' }),
            })),
        );

        const accepted = results.filter(r => r.status() < 300).length;
        expect(accepted, `${accepted} of 4 concurrent refunds admitted against a 100.00 original`).toBeLessThanOrEqual(3);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// C. Parking and the refund window
// ═════════════════════════════════════════════════════════════════════════

test.describe('POS refunds – Parking And Window (POS-REF-08..10)', () => {
    test.describe.configure({ mode: 'serial' });

    test('POS-REF-08 (TC-Refund-16): a refund arriving before its original is parked, not rejected', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);

        // Out-of-order arrival is normal, so this must NOT be a 4xx. The
        // distinction matters: rejecting loses the refund entirely, and nothing
        // downstream would ever replace it.
        const res = await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn: freshRrn() }),
        });

        expect(res.status(), 'an out-of-order refund was rejected instead of parked').toBeLessThan(400);
    });

    test('POS-REF-09 (TC-Refund-17, TC-Refund-18): a parked refund links on arrival and escalates at 48h', async ({ request }) => {
        test.skip(true, NO_PARK_API);
        // Intended: capture a refund whose original is absent, capture the
        // original, assert the parked refund resolves and the original is
        // flagged; then assert an unresolved one escalates after
        // REFUND_PARK_ESCALATION_HOURS and is never auto-rejected.
        expect(REFUND_PARK_ESCALATION_HOURS).toBe(48);
        expect(request).toBeTruthy();
    });

    test('POS-REF-10 (TC-Refund-20, TC-Refund-21): a refund outside the configured window is rejected', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);
        test.skip(true, 'needs an original older than the window; the suite cannot back-date a capture');
        // Intended: capture a refund against an original older than
        // REFUND_WINDOW_DAYS and assert a clear rejection plus an alarm.
        expect(REFUND_WINDOW_DAYS).toBe(180);
        expect(request).toBeTruthy();
    });
});

// ═════════════════════════════════════════════════════════════════════════
// D. No money moves — the defining property of this story
// ═════════════════════════════════════════════════════════════════════════

test.describe('POS refunds – No Money Moves (POS-REF-11..15)', () => {
    test.describe.configure({ mode: 'serial' });

    test('POS-REF-11 (TC-Refund-22): a refund on a zero or low balance merchant is captured, not rejected', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);

        // The regression guard for the retired TC-EMI-5918-03, which expected
        // INSUFFICIENT_BALANCE here. Current criteria say the opposite in their
        // own words: nothing is rejected for insufficient merchant balance,
        // because no balance is touched, so there is nothing to check.
        const originalRrn = await captureOriginal(request, '100.00');
        const res = await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, amount: '100.00' }),
        });

        expect(res.status(), 'refund rejected on balance grounds').toBeLessThan(300);
        const body = JSON.stringify(await res.json().catch(() => ({})));
        expect(body).not.toContain('INSUFFICIENT_BALANCE');
    });

    test('POS-REF-12 (TC-Refund-03, TC-Refund-23): capturing a refund moves no wallet balance', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);
        test.skip(!canRead, 'cannot read the wallet ledger to compare before and after');

        const before = await walletLedgerTotal(request, readToken, WALLET_REFERENCE);
        test.skip(before === null, 'wallet ledger unreadable — a vacuous pass would be worse than a skip');

        const originalRrn = await captureOriginal(request, '100.00');
        await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, amount: '100.00' }),
        });

        const after = await walletLedgerTotal(request, readToken, WALLET_REFERENCE);
        // The purchase may legitimately add a ledger entry; the refund must add
        // nothing. Any decrease at all is a debit, which no path may raise.
        expect(after, 'the refund moved the wallet balance').not.toBeLessThan(before as number);
    });

    test('POS-REF-13 (TC-Refund-24): no reserve, hold or balance guard is created', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);
        test.skip(!canRead, 'cannot read the wallet ledger to look for reserve entries');

        const originalRrn = await captureOriginal(request, '100.00');
        await request.post(`${API_BASE}${POS_CALLBACK}`, {
            headers: callbackXmlHeaders(CALLBACK_TOKEN),
            data: buildCallbackXml({ transactionType: 'REFUND', originalRrn, amount: '100.00' }),
        });

        const res = await request.get(`${API_BASE}${POS_LEDGER_WALLET_PATH(WALLET_REFERENCE)}?page=0&size=200`, {
            headers: authHeaders(readToken),
        });
        const body = await res.json().catch(() => null);
        test.skip(!isSpringPage(body), 'wallet ledger unreadable');

        // There is nothing to reserve against, because nothing will ever be
        // taken — so no RESERVE or SUSPENSE entry may appear for a refund.
        const reserves = (body as { content: Record<string, unknown>[] }).content
            .filter(r => /RESERVE|SUSPENSE|HOLD/i.test(String(r['entryType'] ?? '')));
        expect(reserves, 'a reserve or hold entry was created for a refund').toHaveLength(0);
    });

    test('POS-REF-14 (TC-Refund-26): we produce no card-scheme refund leg', async ({ request }) => {
        test.skip(true, 'asserts on outbound integration traffic, which this suite cannot observe');
        // Intended: capture a refund and assert no outbound scheme call is made.
        // The merchant refunds the customer through the terminal and the scheme;
        // we are not in that path.
        expect(request).toBeTruthy();
    });

    test('POS-REF-15 (TC-Refund-25): a refund is never netted into a settlement batch', async ({ request }) => {
        test.skip(true, 'settlement grouping (EMI-5989) is not built, so no batch exists to inspect');
        // Intended: run grouping for the date and assert the batch aggregate
        // reflects settled sales only, with no refund contribution.
        expect(request).toBeTruthy();
    });
});

// ═════════════════════════════════════════════════════════════════════════
// E. Idempotency and reconciliation isolation
// ═════════════════════════════════════════════════════════════════════════

test.describe('POS refunds – Idempotency And Isolation (POS-REF-16..18)', () => {
    test.describe.configure({ mode: 'serial' });

    test('POS-REF-16 (TC-Refund-28): a redelivered refund is absorbed and counted once', async ({ request }) => {
        test.skip(!IMPLEMENTED, NOT_BUILT);
        test.skip(!CALLBACK_TOKEN, NO_CALLBACK_TOKEN);
        test.skip(!canRead, 'cannot read POS transactions back to count stored refunds');

        const originalRrn = await captureOriginal(request, '100.00');
        const rrn = freshRrn();
        const stan = `STAN${freshStan()}`;
        const payload = buildCallbackXml({ transactionType: 'REFUND', originalRrn, rrn, stan, amount: '25.00' });

        await request.post(`${API_BASE}${POS_CALLBACK}`, { headers: callbackXmlHeaders(CALLBACK_TOKEN), data: payload });
        await request.post(`${API_BASE}${POS_CALLBACK}`, { headers: callbackXmlHeaders(CALLBACK_TOKEN), data: payload });

        const res = await request.get(`${API_BASE}${POS_TRANSACTIONS}?page=0&size=200`, { headers: authHeaders(readToken) });
        const body = await res.json().catch(() => null);
        test.skip(!isSpringPage(body), 'POS transaction list unreadable');

        const matches = (body as { content: Record<string, unknown>[] }).content.filter(r => r['rrn'] === rrn);
        // A redelivery that double-counts would inflate the exposure figure,
        // which is the only output this story produces.
        expect(matches, 'the redelivered refund was stored twice').toHaveLength(1);
    });

    test('POS-REF-17 (TC-Refund-06, TC-Refund-07): a refund never enters the settlement report or E13 set', async ({ request }) => {
        test.skip(true, 'reconciliation (EMI-5920) is not built, so there is no candidate set to inspect');
        // Intended: run reconciliation for the date and assert the refund is
        // absent from the E13 candidate set and the discrepancy queue. Its
        // absence from ANB's settled-only report is contractual, not an
        // exception, and must never be reported as money the bank failed to
        // settle.
        expect(request).toBeTruthy();
    });

    test('POS-REF-18 (TC-Refund-29, TC-Refund-32): the refund contributes to the E34 exposure total', async ({ request }) => {
        test.skip(true, NO_EXPOSURE_API);
        // Intended: capture refunds across several merchants, compute the day's
        // exposure, and assert each appears in the E34 total per merchant, per
        // wallet and in total — then that it shows on the safeguarding report as
        // a memo line OUTSIDE the reconciling total, with the reconciling line
        // still reconciling.
        expect(request).toBeTruthy();
    });
});
