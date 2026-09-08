# PaymentsTtl — expiry and invalidation of stalled payments (EMI-6031)

API-only. The job is backend/Ops tooling with no Business Portal surface, so
this folder has no page objects — same shape as `Reconciliation/`.

| File | Covers | Manual TCs |
|---|---|---|
| `api/DraftExpiry.spec.ts` | draft store: expiry, limit headroom, replay, calendar | TC-TTL-01..06, 16..25 |
| `api/LedgerInvalidation.spec.ts` | ledger store: compensating postings, escalation, precedence | TC-TTL-07..15, 30..41 |

Manual cases live in `docs/manual-test-cases/Payments-TTL-EMI-6031/` (41 cases).
Each test title carries its `TC-TTL-*` id.

```bash
npx playwright test BusinessTestCases/PaymentsTtl
```

## Why this story exists at all

**A Payments TTL job already runs in production and has never been specified.**
Its entire written record is defect traffic:

| Ticket | What it tells us |
|---|---|
| EMI-5139 | The job did not execute at all — Thursday's transactions were still untouched on Sunday |
| EMI-5165 | It wrote two rows per transaction into `transaction_failed_reasons` |
| EMI-4762 | "Check and fix Payments TTL on Production", with no statement of what correct behaviour is |

It is also absent from **EMI-719's job register**, so the thing running in
production is unmanaged, unschedulable from the admin panel and unmonitored.

## Two stores, one clock

The split into two spec files is deliberate — conflating the stores is the main
risk EMI-6031 was written to prevent.

| | Nature | What expiry means |
|---|---|---|
| **Draft** (payments outbox) | Mutable, non-authoritative, affects **no** balance bucket | Mark terminal so it can never be promoted; release limit headroom. Nothing moves. |
| **Ledger** | Authoritative, balance-bearing, **append-only** | **Append** a compensating posting that unwinds the pending movement, or park for Ops. |

Draft TTL governs `INITIATED`, `PENDING_CHECKS`, `PENDING_OTP`. Ledger TTL
governs `LEDGER_PENDING` only. `SUCCESS` and `FAILED` are never touched.

## Everything here is skipped, on purpose

EMI-6031 is **To Do** and no API reference exists, so all 28 tests report as
skips. Gated behind `TTL_IMPLEMENTED=true`, plus `TTL_OPS_TOKEN` /
`TTL_ADMIN_TOKEN` where needed. Paths in the helper are **inferred** from
acceptance criteria, not from a contract, and are all env-overridable — a 404
against one is not a product defect yet.

## The case that matters most

`TTL-LG-05`. When the rail has **not confirmed** an outcome, the action is
**escalate — regardless of what the type is configured to do**. `CASHOUT` is
configured `AUTO_REVERSE`, and the job must still escalate.

Reversing a transaction the counterparty later confirms as successful creates a
real financial loss. A test that lets the configured `AUTO_REVERSE` win here
would be actively harmful, so the assertion is written the other way round on
purpose.

## Two regression guards with history

- **`TTL-DR-03`** (EMI-2012) — an expired draft could be replayed, creating a
  second transaction from a dead draft.
- **`TTL-DR-09`** (EMI-5139) — a business-day TTL elapsed across the Saudi
  weekend. Friday and Saturday must not count. All scheduling and TTL arithmetic
  is `Asia/Riyadh` against the configured business calendar.

## Unconfirmed: the TTL & SLA matrix

`PROPOSED_TTL_MATRIX` in the helper is **our proposal, sent to Finance, not yet
returned** (Q1). These are business and compliance decisions — they determine
how long customer funds may sit in an intermediate state. Re-verify every row
once Finance responds; a mismatch before then is not a defect.

Also open: **Q2** — for PG cash-in, "auto reverse" assumes a voidable
authorisation. If the PG has already captured, expiry needs a *refund*, which is
a different operation with a different SLA. Unresolved per PG.
