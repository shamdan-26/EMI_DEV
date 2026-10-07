# EMI-6114 — BE: Design and Create Wallet Snapshot Database Schema (Refined)

**Type:** Task &nbsp;|&nbsp; **Status:** Testing &nbsp;|&nbsp; **Priority:** Medium
**Assignee:** Tuqa AlSawaeir &nbsp;|&nbsp; **Reporter:** Odey M. Khalaf
**Fix version:** Mjd Pay Release V6.9.0 (target 2026-10-04, not yet released)
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) for how this schema is used by the rest of the epic.

Nothing here has been written back to Jira. This is a refined draft for review — treat the live ticket as the source of truth until this is pasted in or the ticket is edited directly.

---

## 1. As-is: what the ticket says (verbatim)

> **Summary** — Design and create the database schema required for the Wallet Snapshot.
>
> **Acceptance criteria**
> - Define all required tables and relationships between the Wallet Snapshot and related entities.
> - Ensure the schema supports all required wallet balance fields and snapshot statuses.
>
> **Other information** — Submission of a pull request (PR). Code review by a Senior Engineer.

This ticket has no comment of its own. Everything below is reverse-engineered from two other tickets' comments in this epic (EMI-6127's tech notes, EMI-6124's engineering handoff) that both describe reading from and writing to the tables this ticket creates — treat this as strong secondary evidence, not a substitute for the actual DDL/migration.

---

## 2. What this actually is, in plain terms

Three tables, none of them independently exposed by their own API — everything about them is known only through what other tickets' endpoints read/write:

| Table | Written by | Read by |
|---|---|---|
| `wallet_snapshots` | `WalletSnapshotFacade.save()` (EMI-6124), one row per wallet per cutoff | EMI-6127's two GET endpoints |
| `wallet_snapshot_events` | `recordEvent()`/`recordResolved()` (EMI-6124), an append-only trail keyed by `runId` | EMI-6127's detail endpoint (`validationDetails`) |
| `wallet_snapshot_verifications` | `recordResolved()` (EMI-6124), attached to the resolved-status event | Same, nested inside `validationDetails[].verificationSteps` |

**Confirmed column-level shape** (from EMI-6127's live response samples and comment):

`wallet_snapshots`: `id`, `walletCode`, `grain` (e.g. `ACCOUNT`), `snapshotDate`, `cutoffTime`, `generation`, `openingBalances`/`movementBalances`/`closingBalances`/`discrepancies` (each a 4-field group: `reserveDebit`, `reserveCredit`, `current`, `available`), `status`, `reason`, `provisionalOpening`, `repairAttempts`, `sealedAt`, `sealedBy`, `supersedes`, `flags` (array, e.g. `CARRIED_FORWARD`, `MIGRATION_BASELINE`).

`wallet_snapshot_events`: correlated to a snapshot by `runId`, plus `status`, `actorType` (e.g. `SYSTEM`), `actor` (e.g. `system-scheduler`), `reason`, `repairRunId`, `occurredAt`, and a nullable reference into `wallet_snapshot_verifications`.

`wallet_snapshot_verifications`: `runId`, `source` (`INCREMENTAL_LEDGER` / `STRUCTURAL_INVARIANTS` / `ABSOLUTE_REDERIVATION` / `EXTERNAL_TIE_OUT`), `outcome` (`PASS` / `FAIL` / `PROVISIONAL_PASS` / `PROVISIONAL_FAIL`), `ranAt`. The entity's own field name is `verifications`; the API DTO calls the equivalent nested field `verificationSteps` — a naming mismatch EMI-6127 already flagged as a live defect (no MapStruct mapping between the two names).

**Confirmed relationship design, and it's a real finding, not a gap in this doc's knowledge**: EMI-6127's tech notes state plainly *"Snapshot/event correlation uses `run_id` rather than a foreign key; verification rows reference events through nullable `event_id`."* So the schema's own design choice is: `wallet_snapshots` ↔ `wallet_snapshot_events` is a **soft correlation by value** (`runId`), not a declared FK — only `wallet_snapshot_events` ↔ `wallet_snapshot_verifications` has an actual (nullable) FK. Whether "define all required tables and **relationships**" (this ticket's own AC) was meant to include a hard FK here, or whether the soft-correlation-by-`runId` design was intentional (e.g. to allow an event to reference a `runId` before its parent snapshot row is committed), is worth confirming with the ticket owner rather than assuming either answer.

---

## 3. What QA can and cannot verify here

**Not verifiable from this sandbox's network position**: the dev SQL Server (`10.243.128.24:1433`, confirmed via `support/sqlServerClient.ts` env config) is on the same internal subnet as EMI-6115's job-trigger host and is equally unreachable — a connection attempt from this session timed out. This blocks *every* direct schema-level check (actual column types/nullability/defaults, actual index/FK definitions, actual table names if they differ from the JSON-inferred names above).

**Verifiable indirectly, via EMI-6127's API** (already done, in that ticket's own refined doc): the *shape* of the data the schema holds, to the extent the API exposes it. This is necessarily incomplete — a column could exist in the schema and simply never be surfaced by either GET endpoint, and this doc would have no way to know.

**Verifiable by someone with actual DB or Admin-tooling access** (not this suite, today):
- The real table/column names, types, nullability, and defaults.
- Whether `supersedes` is a real self-referencing FK to a prior `wallet_snapshots.id`, as its pairing with `generation` implies but does not prove.
- Whether `flags` is a native array/JSON column or a separate child table.
- Any indexes needed for the query patterns EMI-6127's list endpoint uses (`walletCode` LIKE, date range, `status` exact match) — EMI-6127's own tech notes note the list query has **no explicit `ORDER BY`**, which is itself indirect evidence about how deliberately the query/index layer was designed.

---

## 4. How it should be tested (test strategy)

This is a schema ticket with no endpoint of its own — "testing" it directly means DB-level verification, not API-level:

1. **Table/column existence and types** — with DB access, confirm `wallet_snapshots`, `wallet_snapshot_events`, `wallet_snapshot_verifications` exist with (at minimum) every field this doc's §2 lists as confirmed via the API, and that each numeric balance field is a precision-safe decimal type, not a float (the same class of bug that would silently corrupt money elsewhere in this system).
2. **Status/enum completeness** — confirm the database's own status column (likely a `CHECK` constraint, a lookup table, or an application-level enum with no DB constraint at all) actually allows all six values this epic uses (`COMPUTED`, `VERIFIED`, `REPAIR_QUEUED`, `VARIANCE_PENDING`, `FAILED`, `SEALED`) — **and** ask whether `DRIFT` (named in EMI-6123's AC but absent from EMI-6124's status enum) is a seventh status value the schema needs to support, or a `flags` entry layered on top of one of the six. This is the same open question raised in the architecture doc §4 — resolving it here, at the schema level, is likely the right place to actually settle it.
3. **Relationship integrity** — confirm whether `wallet_snapshot_events.runId` linking to `wallet_snapshots` is enforced at the DB level (a check/trigger) or purely an application-level convention with no DB-level guarantee at all — the latter means a bug elsewhere in the code could write an orphaned event with no matching snapshot, and the DB would not stop it.
4. **Migration/versioning discipline** — confirm this schema shipped via the same migration-tooling convention the rest of the repo's dev database uses (Flyway/Liquibase or equivalent), so future changes are tracked, not applied ad hoc.
5. **Cross-reference against EMI-6127's two known defects** — the `current`/`available` swap and the `verificationSteps`/`verifications` name mismatch are both **mapper-layer** bugs (confirmed by EMI-6127's own tech notes), not schema bugs. Confirm that's actually true at the column level (i.e. the schema itself has correctly-named, correctly-mapped `available` and `current` columns, and the bug is purely in the Java mapping code) rather than assuming it without checking — if the schema itself conflated the two, that would change which ticket owns the fix.

---

## 5. Refined acceptance criteria

- `wallet_snapshots`, `wallet_snapshot_events`, and `wallet_snapshot_verifications` exist, with the column set in §2 confirmed present (not just inferred from an API response) and DB-level types appropriate for currency values (precision-safe decimals).
- The status column/mechanism permits at least the six values `COMPUTED`/`VERIFIED`/`REPAIR_QUEUED`/`VARIANCE_PENDING`/`FAILED`/`SEALED` — with `DRIFT` explicitly resolved as either a seventh value or a `flags` entry, not left ambiguous.
- The `wallet_snapshots` ↔ `wallet_snapshot_events` correlation-by-`runId` (rather than a declared FK) is a confirmed, intentional design decision, not an oversight — get this in writing from the ticket owner.
- *(Unverifiable by this suite today)*: actual column types, nullability, defaults, indexes, and whether `supersedes` is a real FK.

---

## 6. Gaps found while refining

1. **No comment on this ticket at all** — unlike EMI-6127 and EMI-6124, whoever built this schema left no QA-facing notes. Everything in this doc is inferred from two *other* tickets' comments describing how the schema is used, not from anyone describing the schema itself.
2. **This sandbox cannot reach the dev SQL Server** (`10.243.128.24:1433`) — same internal-network limitation as EMI-6115's job-trigger host. Every claim in this doc about the schema is therefore API-inferred, not independently confirmed at the DB level. Whoever has DB or DBeaver/SSMS access should run the actual `INFORMATION_SCHEMA` queries this doc's §4 describes and correct anything this doc got wrong from inference.
3. **`wallet_snapshots` ↔ `wallet_snapshot_events` has no declared foreign key**, per EMI-6127's own tech notes. Confirmed as the current state, not confirmed as *intentional* — see §2 and §5.
4. **`DRIFT` (EMI-6123's AC) does not appear in EMI-6124's documented status enum.** Either the enum list in EMI-6124's comment is incomplete, or `DRIFT` is represented some other way (a flag, a different field) — needs the schema owner to resolve, since this doc genuinely cannot tell from the outside.
5. **Whether `supersedes` is a real self-referencing foreign key is unconfirmed** — its pairing with `generation` strongly implies a versioning/re-run design (relevant to EMI-6115's WSJ-07 open question about re-trigger behavior), but this is inference, not a confirmed schema fact.
