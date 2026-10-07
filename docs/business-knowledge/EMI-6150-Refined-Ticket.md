# EMI-6150 — BE: Unify transaction status events on a single Debezium CDC topic (Refined)

**Type:** Task &nbsp;|&nbsp; **Status:** Testing &nbsp;|&nbsp; **Priority:** Medium
**Assignee:** Marah Shaheen &nbsp;|&nbsp; **Reporter:** Odey M. Khalaf
**Fix version:** Mjd Pay Release V6.8.0 (target 2026-09-20, **not yet released** as of this revision — see Gap 1)
**Dependency:** [EMI-6086 — DevOps: Update CDC Kafka Partitioning by Batch Transaction Reference](https://digitalcash.atlassian.net/browse/EMI-6086) — **status: Blocked** (see Gap 2, the most important finding in this doc)

Nothing here has been written back to Jira. This is a refined draft for review — treat the live ticket as the source of truth until this is pasted in or the ticket is edited directly.

---

## 1. As-is: what the ticket says (verbatim)

> **Summary** — All transaction statuses (PENDING, SUCCESS, FAILED and their `_REVERSED` versions) now go through a single topic, consumed from Debezium CDC on `dbo.transaction_log` instead of separate pending, success, failed, and completed topics.
>
> **Details & Changes**
> - Producers: Orchestrators, reversal, adjustment, and manual-entry flows publish to `transactions-processing-topic`; transaction-ledger persists what it receives there.
> - Consumers: wallet-service, transaction-query-log-service, and aml-integration-service consume the CDC topic `transactions-processing-topic.<db>.dbo.transaction_log` and route by status.
> - Removed flag: `reservedBalanceAffected` is removed from every service.
> - Duplicates: wallet-service skips events it has already processed instead of failing the batch.
>
> **Affected Repositories** — the section header says "(14)" but only 12 are actually listed (see Gap 3): `transaction-common`, `open-loop-orchestrator`, `close-loop-orchestrator`, `transaction-administration-service`, `wallet-service`, `transaction-ledger`, `transaction-query-log-service`, `aml-integration-service`, `reporting-service`, `erp-integration-service`, `tanfeeth-integration-service`, `anb-bank-integration-service`.
>
> **Dependencies**
> - The Debezium connector must emit `dbo.transaction_log` to `transactions-processing-topic.<db>.dbo.transaction_log` in every environment.
> - EMI-6086: CDC partitioning by batch reference.
> - Deploy `transaction-common` first.
>
> **Acceptance criteria**
> - A PENDING → SUCCESS transaction reserves the balance, then settles it in the wallet.
> - PENDING → FAILED releases the reserved balance.
> - Reversals and adjustments are applied exactly once.
> - Ledger, query-log, and AML each receive every status change.

**The one ticket comment** (Marah Shaheen, 2026-09-27) is a flat list of 13 GitLab MR links — one per affected repo (`aml-integration-service` is linked twice, `transaction-common`'s link count matches 12 unique repos against the 12 actually named). No QA notes, no request/response contracts, no topic-name confirmation per environment, no test data or staging instructions — unlike EMI-6120's QA-notes comment, this ticket hands QA nothing beyond "here are the MRs."

---

## 2. What this actually is, in plain terms

This is **not** a new feature with a new UI or a new REST endpoint. It's an internal event-plumbing refactor: four purpose-built Kafka topics (`pending`, `success`, `failed`, `completed` — the ticket doesn't name them, but that's the shape implied by "instead of separate ... topics") are replaced by **one Debezium CDC topic sourced directly from row changes on `dbo.transaction_log`**. Every service that used to subscribe to one or more of the four topics now subscribes to the one CDC topic and filters by the row's `status` column itself.

This is the standard **transactional outbox / CDC pattern**: instead of a producer explicitly publishing an event to a topic (and risking the DB write and the publish going out of sync if one succeeds and the other fails), the producer only writes to `dbo.transaction_log`. Debezium tails the SQL Server transaction log and emits a CDC event for every row insert/update, so the event stream is *guaranteed* to match what's actually committed to the database — there's no way for a status change to be persisted without an event firing, or for an event to fire without a matching persisted row.

**Why this matters to QA specifically — two direct ties to work already in this repo:**

1. **The removed `reservedBalanceAffected` flag is exactly the input EMI-6120's balance-impact rule table already replaces.** Before this change, a producer apparently told consumers via an explicit flag whether a given status change should touch the wallet's reserve buckets. After this change, `reservedBalanceAffected` no longer exists anywhere — every consumer (`wallet-service` above all) must derive the reserve impact **purely from status × direction × wallet-type**, the same 24-combination table documented in `EMI-6120-Refined-Ticket.md` §3 (itself canonical from EMI-602). In other words: EMI-6150 is the change that makes wallet-service's own reserve/settle/release logic solely responsible for getting that table right, with no producer-supplied shortcut left to fall back on. Any regression in that table would now show up as a *wallet-service* balance defect with no flag to blame it on.
2. **"wallet-service skips events it has already processed instead of failing the batch" reads as the shipped form of EMI-5944's consumer-idempotency prevention story (EMI-5947/5948/5949, see `BusinessTestCases/Balances/BalancesHelper.ts`'s epic map).** That epic is otherwise entirely "To Do" with no endpoints built — EMI-6150 may be the first piece of it to actually ship, just not tracked under that epic. Worth flagging to whoever owns EMI-5944/5947/5948 so the epic's status reflects it, and worth testing EMI-6150's dedup behavior with the same rigor EMI-5948 would have demanded (idempotent replay, not just "duplicates don't crash").

---

## 3. What QA can and cannot verify here

This ticket has no new UI and no new documented REST endpoint of its own — the "interface" under test is an **internal message bus and three consuming services**. That bounds what a black-box E2E/API suite (this repo) can actually observe:

**Verifiable black-box, by driving a real transaction and checking its *outcome*:**
- Wallet ledger buckets move correctly for PENDING→SUCCESS (reserve then settle) and PENDING→FAILED (reserve then release) — reusing the exact reserve/settle/release arithmetic already proven for the Topup flow in EMI-6120's `TU-API-02/03/04` (`postman/Topup-API-majdpay.postman_collection.json`, `BusinessTestCases/Topup/`).
- A reversal or adjustment moves the ledger **exactly once** — observable as exactly one matching `running_balance_entry` row set per leg, not two, for a given transaction/idempotency key.
- The transaction's terminal status in `dbo.transaction_log` matches what the driving API call asked for, and doesn't flip a second time on its own (a symptom of a duplicate CDC delivery not being skipped).
- Calling the same status-resolving action twice (e.g. `update-status` with the same identifiers) is a no-op on the ledger the second time — the closest black-box proxy for "wallet-service skips events it has already processed" that doesn't require replaying a raw CDC message.

**Not verifiable black-box, and not something this suite should claim to cover:**
- That the CDC topic is literally named `transactions-processing-topic.<db>.dbo.transaction_log`, or that the Debezium connector is configured correctly per environment — this needs infra/Kafka tooling access (topic listing, consumer group lag, a Kafka UI or `kafka-console-consumer`), not a Playwright test.
- That `transaction-query-log-service` and `aml-integration-service` received *every* status change, unless each exposes its own readable API/table for this environment — see Gap 4 below; `TransactionQueryLogService.generated.spec.ts` and `AmlIntegrationService.generated.spec.ts` are both currently scaffold-only (`test.skip`, gated behind `SERVICE_API_SCAFFOLD`), so today there is no curated, working read path into either service to confirm this AC.
- True duplicate-CDC-delivery dedup (forcing Debezium to redeliver the same row-change event) — that requires either a backend-provided replay tool or direct Kafka produce access, neither of which this suite has. The API-level "call it twice" proxy above is a reasonable substitute but is not the same test.
- Ordering guarantees under concurrent batches — this is precisely what the blocked EMI-6086 dependency (Gap 2) is supposed to provide, so it cannot be meaningfully tested yet regardless of tooling.

**Bottom line:** treat this suite's EMI-6150 coverage as **regression evidence that the visible, money-moving behavior didn't break** when four topics collapsed into one — not as verification of the CDC plumbing itself. The plumbing verification is the 12 linked MRs' own review/testing responsibility.

---

## 4. How it should be tested (test strategy)

Given the boundary in §3, the practical test strategy is a **black-box regression pass over every status transition and operation the new pipeline carries**, anchored on the same wallet-ledger observability already built for EMI-6120/Topup:

1. **Happy-path status transitions** (AC1, AC2) — drive a real Topup (or Bank Transfer, if a control-wallet leg is needed) through the app/API to `PENDING`, then resolve it to `SUCCESS` via `update-status`; separately, another to `FAILED`. Assert the ledger bucket deltas match EMI-6120 §3's rule table exactly for both transitions (reserve→settle for SUCCESS, reserve→release for FAILED). This is close to a straight re-run of `TU-API-02/03/04`, just relabeled as EMI-6150 regression evidence rather than EMI-6120 API contract evidence.
2. **Reversal / adjustment exactly-once** (AC3) — perform one reversal and one adjustment (via whatever entry point is actually reachable — see Gap 5, since `TransactionOperationsHelper.ts`'s specs are currently all `test.skip()` pending Admin Portal tooling) and assert exactly one ledger movement resulted, by counting matching ledger rows for that transaction/idempotency key rather than just checking the final balance (a doubled-then-reversed movement can net to the same final balance while still being wrong).
3. **Idempotent replay proxy** (the "duplicates" bullet, closest black-box stand-in for AC3+the removed-flag change) — call the same resolving action twice with identical identifiers and assert the second call changes nothing on the ledger. Document plainly that this is an API-level proxy, not a CDC-level dedup test (§3).
4. **Downstream fan-out** (AC4) — check whatever is actually reachable for `transaction-query-log-service` and `aml-integration-service` for this environment. If neither has a working read path yet (current state — see Gap 4), this AC is **not automatable today**; say so explicitly rather than writing a test that can't run, and flag it back to the dev/QA-notes thread the way EMI-6120's ticket eventually got one.
5. **Ignored-flag regression** — confirm nothing in the currently-passing suite (Topup, BankTransfer, PosTransactions) still assumes `reservedBalanceAffected` exists or behaves differently without it; a full regression run of the existing wallet-affecting suites is itself a test of this ticket, since removing a flag every service used to read is exactly the kind of change that breaks a caller nobody re-checked.
6. **Deployment-order/dependency sanity** (Dependencies bullet) — not a functional test, but worth a manual pre-flight: confirm `transaction-common` was actually deployed first in this environment, and confirm whether the blocked EMI-6086 partitioning work is required before ordering-sensitive scenarios (a same-wallet PENDING→SUCCESS immediately followed by a reversal) can be trusted. If EMI-6086 is still blocked, any test that depends on strict per-batch ordering should be treated as provisional, not a clean pass/fail.

This is deliberately the same evidence style already used for EMI-6120 (drive the real flow, verify via SQL/API, don't assume) — reusing `support/sqlServerClient.ts`, `BusinessTestCases/Topup/TopupHelper.ts`, and the `update-status` contract already confirmed live.

---

## 5. Refined acceptance criteria

- A `PENDING → SUCCESS` transition reserves the balance on entering `PENDING`, then settles it (debits Reserved, credits Current/Available per EMI-6120 §3's rule table) on reaching `SUCCESS` — verified via ledger deltas, not just a final-balance snapshot.
- A `PENDING → FAILED` transition releases the reserve fully (no residual reserve, no double-release) — same verification method.
- A reversal or adjustment produces **exactly one** ledger movement per leg per operation — verified by row count, not balance alone.
- Calling the same status-resolving action twice with the same identifiers is a no-op the second time (API-level idempotency proxy for the consumer-side dedup the ticket describes).
- *(Unverifiable by this suite today, tracked as a gap, not silently dropped)*: `transaction-query-log-service` and `aml-integration-service` each receive every status change.
- *(Unverifiable by this suite today)*: the CDC topic itself is correctly named/partitioned per environment, and `transaction-common` was deployed before the other 11 repos.

---

## 6. Gaps found while refining

1. **Fix version already past its target date, still unreleased.** `Mjd Pay Release V6.8.0` targeted 2026-09-20; today is 2026-09-28 and Jira still shows `released: false`. Worth confirming this ticket's DEV-environment state actually reflects the 12 merged MRs before testing against it, rather than assuming "Testing" status means DEV is current.
2. **The ticket's own stated dependency, EMI-6086 (CDC partitioning by batch reference), is status `Blocked`** — not Done, not even In Progress. EMI-6150 is nonetheless in `Testing`. This is the single most important open question in this ticket: either (a) EMI-6150 doesn't actually need EMI-6086 to be functionally correct for the ACs above and the "Dependencies" bullet is aspirational/future-proofing, or (b) ordering-sensitive scenarios (concurrent batches touching the same wallet) are not yet safe to rely on in this environment. Get an explicit answer before treating any ordering-sensitive test result as final.
3. **"Affected Repositories (14)" only lists 12.** Minor, but worth a one-line correction request — either two repos are missing from the list, or the header count is stale from an earlier draft.
4. **No confirmed read path into `transaction-query-log-service` or `aml-integration-service` for this environment.** Both are currently scaffold-only in this repo (`BusinessTestCases/ServiceApis/*.generated.spec.ts`, all `test.skip`). AC4 ("Ledger, query-log, and AML each receive every status change") cannot be automated, or even manually verified from outside the services, until one of: a real endpoint is documented (the same kind of QA-notes handoff EMI-6120 eventually got), direct DB table access is granted for their databases, or dev supplies log/dashboard evidence per test run.
5. **No confirmed reachable entry point for reversal/adjustment in this environment.** `TransactionOperationsHelper.ts` states there is "No Business Portal UI surface for either" and both `TransactionReversal.spec.ts`/`TransactionAdjustment.spec.ts` are `test.skip()` pending Admin Portal tooling access — the same blocker already known from that folder, now also blocking AC3 here. Confirm whether Admin Portal access has changed since those specs were written before assuming this AC is testable at all.
6. **No topic name, schema, or per-environment Debezium-connector confirmation was ever supplied**, unlike EMI-6120's QA-notes comment which gave a full contract. If a QA handoff comment is expected here the way it was for EMI-6120, it hasn't landed yet — worth explicitly asking for one rather than assuming "Testing" status means the environment and contract are already knowable.
