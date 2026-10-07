# EMI-6115 — BE: Create and Prepare Wallet Snapshot Job (Refined)

**Type:** Task &nbsp;|&nbsp; **Status:** Testing &nbsp;|&nbsp; **Priority:** Medium
**Assignee:** Anas Al-Halawani &nbsp;|&nbsp; **Reporter:** Odey M. Khalaf
**Fix version:** Mjd Pay Release V6.9.0 (target 2026-10-04, not yet released)
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) for the full pipeline this ticket kicks off.

Nothing here has been written back to Jira. This is a refined draft for review — treat the live ticket as the source of truth until this is pasted in or the ticket is edited directly.

---

## 1. As-is: what the ticket says (verbatim)

> **Summary** — Create and configure the Wallet Snapshot job.
>
> **Acceptance criteria**
> - Prepare the job to trigger the Wallet Snapshot flow.
> - Ensure the job supports the required snapshot execution period.
>
> **Other information** — Submission of a pull request (PR). Code review by a Senior Engineer.

This ticket itself carries no comment. The actual contract was recovered from EMI-6124's engineering handoff comment (2026-09-28) and from this suite's own live captures while refining EMI-6127.

---

## 2. What this actually is, in plain terms

Two things ship under this AC, not one:

1. **`WalletSnapshotJob`** — a scheduled job. `wallet.snapshot.cutoff.time` (a cron expression) resolves the next cutoff instant; the job then waits an extra `wallet.snapshot.grace.period` minutes past that cutoff (so late-arriving postings for that instant have a chance to land) before calling `WalletSnapshotFacade.start(cutoff)`. This is the AC's "supports the required snapshot execution period" — the period is cron-driven, not a fixed interval.
2. **`POST /api/v1/wallet-snapshot-jobs?cutoffTime=...`** — an on-demand trigger for the same flow, added specifically so QA doesn't have to wait for the cron schedule. This is the AC's "trigger the Wallet Snapshot flow."

**Confirmed live** (2026-10, this session): `POST http://10.243.128.20:9094/api/v1/wallet-snapshot-jobs?cutoffTime=<ISO-8601 offset datetime>` — a private internal address, not the public gateway. Both live captures of this endpoint carried **zero headers**, not even `Authorization`, and the request still ran. EMI-6124's own comment independently states: *"no `@RequiresSession` (or other auth annotation) on this controller — appears open/internal as written. Unverified — confirm with the team whether this is intentional before QA/prod use."* Two independent sources agreeing is strong signal this is real, not a fluke of how it was captured — but it is still explicitly *unconfirmed as intentional*, not a settled fact.

**Confirmed contract** (from EMI-6124's comment): no request body; success is `200 OK` with an empty body; a missing/malformed `cutoffTime` fails Spring's default parameter binding (`400 Bad Request`, exact error shape unconfirmed — no local exception handler found in this service); failures *inside* per-wallet processing are caught, logged, and never surfaced to the caller — **the endpoint can return `200` even if every wallet in the run failed**. That last point is the single most important thing to test here: a green trigger call is not proof the run actually did anything.

---

## 3. What QA can and cannot verify here

**Verifiable black-box, from inside the internal network:**
- The endpoint exists and accepts a POST with a valid `cutoffTime` → `200`, empty body.
- A missing or malformed `cutoffTime` → `400`.
- After a successful trigger, wallet_snapshot rows for that cutoff become readable via EMI-6127's `GET /api/v1/admin/wallet-snapshots` (this is the only way to confirm the job actually *did* anything — the trigger response itself proves nothing about outcome).
- Whether the endpoint truly has no auth of any kind (confirm a call with a garbage/absent token still succeeds — not yet done from this session's position; see Gap 1).

**Not verifiable from this sandbox's network position (confirmed, not assumed):** the endpoint's host (`10.243.128.20:9094`) is unreachable — connection attempts timed out, the same internal-subnet limitation observed against the dev SQL Server while refining EMI-6114. Every claim above about the endpoint's *live* behavior is inherited from this suite's earlier, successful manual captures (run from inside the network), not from anything callable today from wherever this automation runs.

**Not verifiable by this suite at all:**
- The cron schedule and grace period actually firing on time — no config-inspection endpoint exists; would require waiting for a real scheduled run and comparing wall-clock time, impractical for automation.
- That a failed per-wallet run is actually logged anywhere QA can read — no log-access tooling in this repo.

---

## 4. How it should be tested (test strategy)

1. **Contract on the endpoint itself** (needs internal-network access QA has and this automated suite currently doesn't): valid `cutoffTime` → `200` empty body; missing `cutoffTime` → `400`; malformed `cutoffTime` (not a valid ISO-8601 offset datetime) → `400`, not a silent `200` that skips validation.
2. **Outcome verification, not just response-code verification** — trigger a run for a specific, deliberately-chosen `cutoffTime`, then read the result back via EMI-6127's `GET /api/v1/admin/wallet-snapshots?fromDate=...&toDate=...` (or the detail endpoint by id) and confirm rows actually appeared for that cutoff. A `200` from the trigger alone is not sufficient evidence per §3.
3. **Idempotency / re-trigger behavior** — call the endpoint twice with the *same* `cutoffTime`. Confirm whether this creates a second `generation` (EMI-6127's schema has a `generation` field and a `supersedes` field, suggesting re-runs are expected and versioned) rather than either erroring or silently duplicating unrelated rows. This is currently undocumented — treat the actual behavior as a finding, not an assumption.
4. **Failure isolation** — the ticket's own architecture explicitly catches and logs per-wallet failures without stopping the batch. If a way exists to force one wallet into a bad state (e.g. a wallet with inconsistent running-balance data), confirm the *rest* of the wallets in that run still produced valid snapshots. Not automatable without a controlled bad-wallet fixture; flag as a manual/exploratory case.
5. **Auth question** — explicitly send a request with a bogus `Authorization` header (not just omitting it) and confirm the response doesn't change. If it's truly unauthenticated, this proves it, rather than the current state of "two consistent-but-unexplained observations."
6. **Event/verification trail per run** — per the architecture doc, a fully-verified wallet should end with exactly 3 `wallet_snapshot_events` rows for its `runId` (`COMPUTED` → resolved-status → `SEALED`); a non-fully-verified one should end with exactly 2. This is indirectly checkable via EMI-6127's detail endpoint's `validationDetails` array length, once an admin token is available.

---

## 5. Refined acceptance criteria

- `POST /api/v1/wallet-snapshot-jobs?cutoffTime=<ISO-8601>` triggers one full pass of the snapshot pipeline for every wallet, returning `200` with an empty body immediately (fire-and-forget — the response does not wait for/report per-wallet outcomes).
- A missing or malformed `cutoffTime` is rejected with `400` before any wallet processing starts.
- A single wallet's processing failure is isolated — it does not prevent other wallets in the same run from completing.
- *(Unconfirmed as intentional, tracked as a gap not silently accepted)*: the endpoint carries no application-level authentication and is reachable to anyone with network access to the internal host.
- *(Not yet observed)*: the exact re-trigger/idempotency behavior for a repeated `cutoffTime`.

---

## 6. Gaps found while refining

1. **No confirmed authentication on a mutating, internal endpoint.** Flagged independently by this suite (empty-header captures still succeeded) and by the implementing engineer's own comment ("unverified — confirm with the team"). Two people independently noticing the same gap and neither closing it out is itself worth escalating, not just noting.
2. **Re-trigger/idempotency behavior for the same `cutoffTime` is undocumented.** The schema's own `generation`/`supersedes` fields (EMI-6114/EMI-6127) imply this was designed for, but the actual runtime behavior hasn't been observed.
3. **This sandbox's automation cannot reach the trigger endpoint at all** (internal network only) — everything in this doc about its live behavior is inherited from manual captures taken from inside the network during EMI-6127's refinement, not independently re-verified here. Any future automation needs to run from a position with real network access to `10.243.128.20:9094`.
4. **No confirmed error body shape for the `400` case** — "no local exception handler found in this service" per EMI-6124's comment, meaning the error response is whatever Spring's default is, not a designed contract. Worth confirming this matches what a caller should build error handling around.
5. **Cron schedule and grace period are unverified in this environment** — no config-inspection endpoint, no confirmed observation of an actual scheduled (non-manually-triggered) run.
