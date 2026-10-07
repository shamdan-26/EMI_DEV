# Wallet Snapshot Pipeline — Shared Architecture Reference

Canonical technical reference for the whole **Wallet-Snapshotting** epic (EMI-6114–EMI-6127, `wallet-service`). Sourced primarily from Nour Alkhdairat's 2026-09-28 QA-handoff comment on [EMI-6124](https://digitalcash.atlassian.net/browse/EMI-6124) — the only comment across the epic that documents the assembled flow rather than one isolated step — cross-checked against EMI-6127's own tech-notes comment (the two independently agree wherever they overlap). Every per-ticket refined doc in this epic (`EMI-6114-Refined-Ticket.md` .. `EMI-6127-Refined-Ticket.md`) links back here instead of repeating this.

Nothing here has been written back to Jira.

---

## 1. What ships, end to end

A scheduled job walks every wallet in the system and computes, reconciles, and persists a **Wallet Snapshot** for a given cutoff instant.

```
WalletSnapshotJob (scheduled, cron)
  └─ waits a grace period past the resolved cutoff
  └─ calls WalletSnapshotFacade.start(cutoff)
       └─ pages through ALL wallets (EMI-6116), batch-size per page, bounded concurrency
            └─ per wallet:
                 1. resolve OPENING balance from the wallet's last sealed snapshot (EMI-6126),
                    or provisional-zero if none exists yet
                 2. resolve CLOSING balance from the ledger running-balance / last Running
                    Balance record (EMI-6117 fetches it, EMI-6118 extracts the 4 closing fields)
                 3. compute MOVEMENT = closing − opening, per bucket (EMI-6122)
                 4. run validations (EMI-6123's WalletSnapshotFacade.verifyAbsoluteRederivation /
                    resolveStatus / resolveFlags / buildWalletSnapshot):
                    - structural-invariants check: current == available + reserveDebit (EMI-6119)
                    - incremental-ledger reconciliation: movement vs. transaction-log postings,
                      read via TransactionLogClient == EMI-6120's Ledger Balance Calculation API
                      (EMI-6121)
                 5. resolve a status: VERIFIED / SEALED / REPAIR_QUEUED / VARIANCE_PENDING / FAILED
                 6. save the snapshot row + its event trail (EMI-6124 aggregates 1-6)
  └─ exposes POST /api/v1/wallet-snapshot-jobs?cutoffTime=... so QA can trigger a run on
     demand instead of waiting for the cron schedule (EMI-6115)
  └─ the resulting data is readable via the Admin Portal's two GET endpoints (EMI-6127)
```

A single wallet's processing failure is caught and logged — **it does not stop the rest of the run**. This is a deliberate resilience choice worth testing directly (one bad wallet must not blank out the whole batch).

---

## 2. Configuration properties

| Property | Purpose |
|---|---|
| `wallet.snapshot.cutoff.time` | Cron expression resolving the next cutoff instant |
| `wallet.snapshot.grace.period` | Minutes the job waits past the resolved cutoff before firing, so late-arriving postings for that instant have a chance to land first |
| `wallet.snapshot.batch-size` | Wallets fetched per page when paging through all wallets (EMI-6116) |
| `wallet.snapshot.concurrency` | Thread pool size for bounded-concurrency per-page processing |

None of these were independently confirmed live (no config-inspection endpoint found) — treat as documented-but-unverified until a live run's timing/batching is observed.

---

## 3. The on-demand trigger endpoint (EMI-6115)

```
POST /api/v1/wallet-snapshot-jobs?cutoffTime=2026-09-27T13:49:29+03:00
```

- **Host**: `http://10.243.128.20:9094` in dev — an internal address, **not** the public gateway (`gateway-dev.majdpay.com`). Confirmed unreachable from an external/CI network position in this session (connection attempts to the same internal subnet, for the DB, also timed out — see EMI-6114's doc).
- **Auth**: the ticket's own engineering comment states plainly: *"no `@RequiresSession` (or other auth annotation) on this controller — appears open/internal as written. **Unverified — confirm with the team whether this is intentional before QA/prod use.**"* This independently confirms what this suite already observed empirically while refining EMI-6127 (both captured curls for this endpoint carried **zero** headers, not even `Authorization`, and it still ran). Two independent sources agreeing is strong signal, not proof of intent — still flag it, don't assume it's fine.
- **Params**: `cutoffTime` (required, ISO-8601 offset date-time, URL-encoded)
- **Body**: none
- **Success**: `200 OK`, empty body
- **Errors**: a missing/malformed `cutoffTime` fails Spring's default parameter binding → `400 Bad Request` (exact error body shape not confirmed — "no local exception handler found in this service" per the same comment). Failures *inside* per-wallet processing are swallowed and logged, never surfaced to the caller — the endpoint can return `200` even if every wallet in the run failed.

---

## 4. Status lifecycle

A snapshot resolves to exactly one of: `COMPUTED` → `VERIFIED` / `REPAIR_QUEUED` / `VARIANCE_PENDING` / `FAILED`, and `VERIFIED` snapshots that are also non-provisional further flip to `SEALED`. (EMI-6127's own comment additionally lists `COMPUTED` as a distinct listable status — the two sources agree on the terminal set.)

**DRIFT handling (from EMI-6123's AC, not yet cross-confirmed by the EMI-6124 comment's status enum)**: when there is no prior Running Balance record *and* the Transaction Ledger's computed value is non-zero, the snapshot is marked **DRIFT** — this doesn't appear in EMI-6124's five-value status list above, so treat `DRIFT` as either a `flags` entry rather than a top-level `status` value, or as a gap to ask the ticket owner to reconcile, before writing a test that asserts on it as a `status`.

## 5. Events & verifications recorded per wallet run

Every wallet run writes an **append-only event trail**, correlated by one `runId`, not just the final snapshot row:

1. A `COMPUTED` event is recorded as soon as opening/closing balances are resolved.
2. Two verification outcomes are captured against that `runId`:
   - a **structural-invariants** check (`current == available + reserveDebit`, EMI-6119) — source `STRUCTURAL_INVARIANTS` per EMI-6127's enum
   - for non-blocked wallets, an **incremental-ledger reconciliation** check (running-balance movement vs. transaction-log postings, EMI-6121) — source `INCREMENTAL_LEDGER`
   - each recorded as `PASS`/`FAIL`, or `PROVISIONAL_PASS`/`PROVISIONAL_FAIL` when the wallet's opening balance is itself still provisional
3. A second event is recorded for the wallet's **resolved status**, with both verification steps attached to it.
4. If the wallet resolves to `VERIFIED` **and** its opening is not provisional, a further `SEALED` event is recorded (no verification steps attached) and the snapshot's own status flips to `SEALED`.
5. **Result**: a fully-verified wallet ends a run with **3** events (`COMPUTED` → resolved-status → `SEALED`); a wallet that doesn't fully verify ends with **2** (`COMPUTED` → resolved-status). This is a concrete, checkable invariant for a test: count `wallet_snapshot_events` rows for a given `runId` and assert 2 or 3, never more, never 1.

EMI-6127's own comment separately names two more verification `source` values (`ABSOLUTE_REDERIVATION`, `EXTERNAL_TIE_OUT`) that aren't mentioned in EMI-6124's comment — these may be triggered on a different path (e.g. the Admin Portal's still-unbuilt "manage the snapshot" actions, EMI-6127 Gap 1) rather than the routine per-cutoff run described here. Don't assume routine runs exercise all four sources.

---

## 6. Affected tables (all writes are inserts)

| Table | Written by | What |
|---|---|---|
| `wallet_snapshots` | `WalletSnapshotFacade.save()` | One row per wallet per run — opening/closing/movement/variance buckets, resolved status, flags, generation |
| `wallet_snapshot_events` | `recordEvent()` / `recordResolved()` | `COMPUTED`, resolved-status, and (when fully verified) `SEALED` events per wallet run, keyed by `runId` |
| `wallet_snapshot_verifications` | `recordResolved()` | Structural and (when not blocked) reconciliation verification outcomes, attached to the resolved-status event |

**Read-only** (not written by this flow, only read as reconciliation sources): wallet running-balance data (via `RunningBalanceService`, EMI-6117) and transaction-log postings (via `TransactionLogClient`, EMI-6120).

All three tables' full column shapes are documented in `EMI-6127-Refined-Ticket.md` (reverse-engineered from its GET endpoints' response samples) and in `EMI-6114-Refined-Ticket.md` (the schema ticket itself).

---

## 7. What this means for testing every ticket in the epic

**None of EMI-6116 through EMI-6123 and EMI-6126 are independently exposed as their own REST endpoint or Admin UI action.** They are internal methods/steps inside `WalletSnapshotFacade` and its collaborators, composed together by EMI-6124's `start()` orchestration and triggered as a unit by EMI-6115's job/endpoint. This bounds what black-box testing (this repo's normal mode) can do for each:

- **Directly black-box testable today**: EMI-6115 (trigger a run), EMI-6127 (read the result). Both have a real HTTP contract.
- **Testable only as an outcome of a triggered run, read back through EMI-6127's GET endpoints or direct SQL** (not independently): EMI-6116 (did every wallet get a row?), EMI-6117/6118/6126 (are opening/closing correct?), EMI-6119/6121/6122 (do the balance-identity and movement numbers hold?), EMI-6123 (did status/flags resolve correctly, including the DRIFT case), EMI-6124 (did the whole run complete/isolate failures correctly).
- **Not testable at all by this suite today**: the actual cron schedule and grace-period timing (`wallet.snapshot.cutoff.time`, `wallet.snapshot.grace.period`) — no config-inspection endpoint exists to confirm these are honored, short of waiting for a real scheduled firing and comparing wall-clock time, which isn't practical for an automated suite.

Every per-ticket doc below states this plainly rather than pretending each internal step has its own testable seam.
