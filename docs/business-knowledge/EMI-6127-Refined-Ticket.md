# EMI-6127 — BE: Create Wallet Snapshot Admin Page (Refined)

**Type:** Task &nbsp;|&nbsp; **Status:** Testing &nbsp;|&nbsp; **Priority:** Medium
**Assignee:** Tuqa AlSawaeir &nbsp;|&nbsp; **Reporter:** Odey M. Khalaf
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) for the full 13-ticket epic this belongs to (EMI-6114–6127); this ticket is the read side of that pipeline.

Nothing here has been written back to Jira. This is a refined draft for review — treat the live ticket as the source of truth until this is pasted in or the ticket is edited directly.

---

## 1. As-is: what the ticket says (verbatim)

> **Summary** — Create the Backend Admin APIs and services to support viewing and managing Wallet Snapshots in the Admin portal.
>
> **Acceptance criteria**
> - Display required snapshot information: Wallet Code, Snapshot Date / Cutoff Time, Opening Balances, Closing Balances, Balance Movements, Snapshot Status, and Reason.
> - Provide the required actions for managing the snapshot based on the defined business flow.
> - Support filtering and searching by relevant snapshot information (Wallet Code, Date / Cutoff Time, Snapshot Status).
> - Display snapshot validation details and any detected discrepancies.
>
> **Other information** — Submission of a pull request (PR). Code review by a Senior Engineer.

**The one ticket comment** (Tuqa AlSawaeir, 2026-09-28) is an unusually thorough QA technical-notes writeup — full request/response contracts for both endpoints, a verified-vs-unverified behavior breakdown, two concrete defects, and an 18-item suggested-test-case list. This is the same "developer hands QA a real contract" pattern EMI-6120 got and EMI-6150 did not; treat it as close to a QA handoff doc rather than an ordinary dev comment.

---

## 2. What this actually is, in plain terms

This ticket ships **two read-only Admin GET endpoints** on top of an **existing** wallet-snapshot subsystem — `wallet_snapshots`, `wallet_snapshot_events`, and `wallet_snapshot_verifications` already exist and are already populated by `WalletSnapshotJob`/`WalletSnapshotFacade`, the scheduled-plus-on-demand pipeline covered by EMI-6114–6126 (now fully documented in the shared architecture doc linked above — at the time this doc was first written, that pipeline was still an open question; it no longer is). No migration, no new entity, no new scheduler logic in *this* ticket specifically. The two endpoints are:

- `GET /api/v1/admin/wallet-snapshots` — a paged list, filterable by wallet code, date range, and status.
- `GET /api/v1/admin/wallet-snapshots/{id}` — one snapshot's full detail, including discrepancies and a validation-event history.

**This is materially narrower than the four bullet-point ACs imply.** The ticket's own AC #2 ("provide the required actions for managing the snapshot") is not delivered at all — there is no POST/PUT anywhere in this branch, only two GETs. If "managing" (e.g. re-running a snapshot, sealing it manually, resolving a variance) was meant to ship in EMI-6127, it hasn't; if it's intentionally deferred to a follow-up ticket, that should be stated explicitly rather than left as a silently-unmet AC.

A snapshot's `status` field (`COMPUTED → VERIFIED/VARIANCE_PENDING/REPAIR_QUEUED/FAILED → SEALED`) is a small state machine — each snapshot accumulates zero or more `wallet_snapshot_events` rows (one per state transition/validation attempt) that the detail endpoint surfaces as `validationDetails`, correlated by `runId` rather than a foreign key.

---

## 3. What QA can and cannot verify here

**Confirmed live in `dev` (2026-09-29):** both endpoints exist and are reachable at the gateway (`gateway-dev.majdpay.com`) — `GET /api/v1/admin/wallet-snapshots` and `GET /api/v1/admin/wallet-snapshots/101` both answer **401** unauthenticated (not 404), so the routes are deployed in this environment. An authenticated pass (with an `ADMIN_GET_WALLET_SNAPSHOTS`-scoped token) is still needed to confirm the response bodies match the sample contracts below — not yet done as of this revision.

**Verifiable black-box, once an admin token with the right privilege is available:**
- List endpoint: default pagination (`page=0`, `size=20`), every `status` filter value, inclusive `fromDate`/`toDate` bounds, wallet-code `LIKE` behavior (plain input vs. caller-supplied `%`).
- Detail endpoint: the `openingBalances`/`movementBalances`/`closingBalances`/`discrepancies` shape, `validationDetails` ordering (`occurredAt ASC`) and scoping (only events for the row's own `runId`), the "reason = latest non-null event reason" rule, the `404 WALLET_SNAPSHOT_NOT_FOUND` and `401 UNAUTHORIZED_EXCEPTION` cases.
- The two known defects below — both are black-box-observable without needing DB access, just a snapshot with non-trivial data.

**Not verifiable black-box, and not something this suite should claim to cover:**
- That the underlying snapshot generation pipeline (`WalletSnapshotJob`/`WalletSnapshotFacade`, EMI-6114–6126) computes the right numbers in the first place — this ticket only exposes what's already in the three tables, it doesn't compute it. See each of those tickets' own refined docs for what's testable about the computation itself.
- Snapshot management actions (AC #2) — none exist in this branch to test.
- Cutoff-time filtering (part of AC #3) — not implemented; only business-date (`fromDate`/`toDate`) filtering exists.
- Whether `ADMIN_GET_WALLET_SNAPSHOTS` is actually assigned to a real Admin Portal role/user in this environment — needs an Admin Portal RBAC check (Manage Users → Access & Permissions) before assuming any admin login can call these endpoints.

---

## 4. How it should be tested (test strategy)

Given the boundary in §3, this is pure **API contract testing** against two GET endpoints — no UI exists yet (this is a BE-only ticket; an Admin Portal *screen* for wallet snapshots, if planned, is not part of EMI-6127 and hasn't been seen in the Admin sidebar as of this revision). The practical approach:

1. **Auth/privilege gate first** — confirm both endpoints reject an unauthenticated call with `401` (already confirmed live, §3) and confirm the specific `UNAUTHORIZED_EXCEPTION` code/shape once a non-privileged admin token is available to test with. This is the cheapest, highest-value check and should run before anything else, the same way `TopupAPI.spec.ts` opens with a contract check before touching business logic.
2. **List endpoint filters, one at a time** — status (all six enum values), date bounds (inclusive edges: a snapshot dated exactly `fromDate`/`toDate` must appear), wallet-code exact-match vs. wildcard, and the documented pagination defaults (`page=0`, `size=20`). Also assert page ordering is *stable across repeated calls* rather than assuming any particular order — the ticket's tech notes flag there's no explicit `ORDER BY`, so "stable" (not "ascending by X") is the only honest assertion here.
3. **Detail endpoint's enriched fields** — this is where the branch's actual value is, per the tech notes. For a snapshot with a known `runId` and multiple events: assert `validationDetails` is ordered by `occurredAt` ascending, assert events from a *different* `runId` never leak in, assert `reason` equals the latest non-null event reason (and is `null` when every event reason is `null`), assert `discrepancies` matches the four snapshot variance columns.
4. **The two known defects, asserted as currently-failing/documented, not silently skipped:**
   - **Defect A — `current`/`available` swap.** For `openingBalances` and `movementBalances`, the mapper is documented as assigning the *available* balance into the `current` field and leaving `available` null. A test should assert this against a real DB row (via `support/sqlServerClient.ts`, the same pattern `TopupHelper.ts`'s SQL helpers use) so the assertion flips to the *correct* mapping automatically once fixed, rather than hardcoding today's buggy shape as "expected."
   - **Defect B — `verificationSteps` MapStruct mismatch.** The response DTO names the field `verificationSteps`; the entity names it `verifications`; there's no explicit mapping between them, so a clean-generated mapper leaves it `null`. A test should assert `validationDetails[].verificationSteps` is populated (not null) when the seeded event actually has verification data — this test is *expected to fail* today, which is the point: it's a regression tripwire for exactly this bug, not a smoke test.
5. **404 / not-found and boundary IDs** — a non-existent numeric `id`, and confirm the response code/shape matches `WALLET_SNAPSHOT_NOT_FOUND` (currently only proven by a *mocked* integration test per the tech notes, per Gap 2 below — a live confirmation is still owed).
6. **Explicitly flag as not automatable today, rather than silently omitted:** cutoff-time filtering (doesn't exist anywhere) and any "manage the snapshot" action *within this ticket* (the capability exists, but entirely under EMI-6115 — see `docs/business-knowledge/EMI-6115-Refined-Ticket.md`, not this one) — both are AC-level gaps for EMI-6127 specifically, not test-coverage gaps, and belong back on the ticket, not quietly absorbed into a smaller test plan.

This mirrors the same evidence style used for EMI-6120/EMI-6150 (drive the real endpoint, verify via SQL where the response can't be trusted on its own, don't assume) — reusing `support/sqlServerClient.ts` for defect A's DB cross-check and the existing `ServiceApis/` generated-scaffold conventions for the request plumbing.

---

## 5. Refined acceptance criteria

- `GET /api/v1/admin/wallet-snapshots` and `GET /api/v1/admin/wallet-snapshots/{id}` both require `ADMIN_GET_WALLET_SNAPSHOTS` and reject unauthenticated/under-privileged calls with `401`.
- The list endpoint returns wallet code, snapshot date, status, and the balance buckets for each row, filterable by wallet code (exact/`LIKE`), business-date range (inclusive), and status (all six enum values), with documented pagination defaults.
- The detail endpoint additionally returns `discrepancies` and an ordered `validationDetails` history scoped to the snapshot's own `runId`, with `reason` reflecting the latest non-null event reason.
- The detail endpoint returns `404 WALLET_SNAPSHOT_NOT_FOUND` for a non-existent id.
- *(Known defect, tracked not silently fixed by the test)*: `openingBalances`/`movementBalances` currently expose the available balance under `current` and leave `available` null.
- *(Known defect, tracked not silently fixed by the test)*: `validationDetails[].verificationSteps` is currently always null due to a MapStruct field-name mismatch (`verifications` vs. `verificationSteps`).
- *(Explicitly out of scope for this ticket, not a missed AC)*: cutoff-time filtering and any snapshot management/action endpoint — both are named in the ticket's original ACs but not implemented in this branch.

---

## 6. Gaps found while refining

1. **AC #2 ("provide the required actions for managing the snapshot") has no Admin Portal / EMI-6127 endpoint meeting it — but a "manage the snapshot" action does exist, just not where the ticket implies, and it belongs to EMI-6115, not this ticket.** `POST /api/v1/wallet-snapshot-jobs?cutoffTime=<ISO-8601 offset datetime>` (internal host, not the public gateway) is EMI-6115's on-demand job trigger — full contract now in `docs/business-knowledge/EMI-6115-Refined-Ticket.md`. **The lack of app-layer authentication is no longer a "held under further testing" hypothesis — it's confirmed by a second, independent source**: EMI-6124's own engineering-handoff comment states outright *"no `@RequiresSession` (or other auth annotation) on this controller — appears open/internal as written. Unverified — confirm with the team whether this is intentional before QA/prod use."* This suite's own live captures (zero headers, including no `Authorization`, still succeeding structurally) and the implementing team's own comment now agree independently — that's real signal, still not the same as a documented decision, so it remains worth escalating rather than treating as settled. AC #2 is still unmet *by EMI-6127 specifically*; the capability exists, just entirely in EMI-6115. See `postman/WalletSnapshotJob-API-majdpay.postman_collection.json` (a dedicated collection, not just a folder inside this ticket's own collection) for the full captured shape — every mutating request in it is clearly marked CAUTION and excluded from any automated run.
2. **No tests were added or changed by this branch.** The tech-notes comment itself says so, and lists 18 suggested test cases including the two known defects. Existing Surefire artifacts (44 passing `WalletSnapshotFacadeTest`, 2 passing `WalletSnapshotServiceTest`, but 8 `AdminWalletSnapshotControllerIntegrationTest` errors and 1 `WalletServiceApplicationTests` error) "may predate the current source and do not establish a successful current-branch build" per the same comment — build health for this specific branch is unconfirmed.
3. **Cutoff-time filtering (part of AC #3) is not implemented** — only business-date (`fromDate`/`toDate`) filtering exists. The ticket's summary and AC both explicitly say "Date / Cutoff Time."
4. **List endpoint has no explicit `ORDER BY`** — page ordering is not guaranteed to be stable or meaningful. Worth a one-line correction request: either add a deterministic sort (e.g. `snapshotDate DESC, walletCode ASC`) or document that pagination order is undefined.
5. **List response omits `discrepancies`/`validationDetails`** while the detail response includes them — reasonable for payload size, but not stated anywhere as an intentional design choice; worth confirming with the ticket owner rather than assuming.
6. **`repairRunId` is exposed on event metadata but never used to select/filter events** — its purpose in the current branch is unclear; worth a one-line clarification since it looks like it should matter for the `REPAIR_QUEUED` status path but currently doesn't affect any response.
7. **`WALLET_SNAPSHOT_NOT_FOUND`'s `404` is only proven by a mocked integration test.** Per the tech notes, "production status comes from shared translation/error-handler configuration" — a live confirmation in a real deployed environment is still owed.
8. **PR submission and senior-engineer review (the "Other information" bullet) cannot be verified from the local repository** — flagged in the tech notes itself, carried forward here rather than silently dropped.
