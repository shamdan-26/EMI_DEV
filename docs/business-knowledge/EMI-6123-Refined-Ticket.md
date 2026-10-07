# EMI-6123 — BE: Implement Wallet Snapshot Validation Flow (Refined)

**Assignee:** Tuqa AlSawaeir &nbsp;|&nbsp; **Status:** DEV DONE &nbsp;|&nbsp; **Fix version:** V6.9.0
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) §1/§4/§5. This is `WalletSnapshotFacade`'s `verifyAbsoluteRederivation` / `resolveStatus` / `resolveFlags` / `buildWalletSnapshot` methods (named explicitly in this ticket's own comment).

Nothing here has been written back to Jira.

---

## 1. As-is (verbatim)

> **Summary** — Implement a method that orchestrates all Wallet Snapshot validations and calculations.
>
> **Acceptance criteria**
> - Continue when a Running Balance record exists and the Transaction Ledger computed value is available.
> - Continue when there is no Running Balance record and the computed Transaction Ledger value is zero.
> - Mark the snapshot as DRIFT when there is no Running Balance record but the Transaction Ledger has a non-zero computed value.
> - Execute the required balance validations and comparisons.
> - Set the Wallet Snapshot status based on the validation results.
>
> **Other information** — PR + Senior Engineer review.

**The one comment** (Nour Alkhdairat, 2026-09-23) names the exact methods: *"implement in `WalletSnapshotFacade`: `verifyAbsoluteRederivation`, `resolveStatus`, `resolveFlags`, `buildWalletSnapshot`."*

## 2. What this actually is

The decision layer that turns the raw computed numbers (EMI-6117/6118/6119/6121/6122) into a final `status` and `flags` set. `verifyAbsoluteRederivation` is very likely the source of EMI-6127's fourth verification `source` value, `ABSOLUTE_REDERIVATION` (named in EMI-6127's comment but never observed by EMI-6124's routine-run description) — this ticket may be exactly where that source actually gets used, resolving a question this doc's shared architecture note (§5) left open.

**The DRIFT question, resolved partially**: this ticket's own AC is the *only* place in the whole epic that names `DRIFT` explicitly, and it's stated as a clean third branch alongside "continue normally" and "continue with zero" — i.e. DRIFT reads as a genuine intended **outcome of this validation flow**, not a data-entry inconsistency across tickets. Whether it surfaces as `wallet_snapshots.status` or as a `flags` entry is still not confirmed (EMI-6114's WSD-04 gap), but its *existence* as a real business rule is no longer in doubt.

## 3. What QA can and cannot verify

**Verifiable via EMI-6127's read API**: for a wallet with no Running Balance record and a non-zero ledger computed value, confirm the resulting snapshot shows the DRIFT outcome (however it's represented). For a wallet with no Running Balance and a zero ledger value, confirm it proceeds cleanly to a normal status, not DRIFT.

**Not verifiable**: `verifyAbsoluteRederivation`'s own logic in isolation — its trigger condition and exact algorithm aren't described anywhere; only its probable connection to the `ABSOLUTE_REDERIVATION` verification source is inferred.

## 4. How it should be tested

1. Three-way branch coverage on the AC's own three conditions: (a) Running Balance exists + ledger value available → normal processing; (b) no Running Balance + zero ledger value → normal processing; (c) no Running Balance + non-zero ledger value → DRIFT. All three need distinct wallet fixtures.
2. Confirm `resolveFlags` output is consistent with the fixture used — e.g. a wallet that should be `CARRIED_FORWARD` or `MIGRATION_BASELINE` (both seen in EMI-6127's real response samples) actually gets that flag under the right precondition.
3. Confirm `resolveStatus`'s final output matches the full 6-status set from the architecture doc (plus DRIFT), and that this is the single place in the codebase that assigns `wallet_snapshots.status` — no other step in the pipeline should be independently setting it.

## 5. Refined acceptance criteria

- The three branch conditions in the AC are each independently verifiable via EMI-6127's read API against a known fixture.
- DRIFT is a real, confirmed business outcome of this exact ticket — its representation (status vs. flag) should be resolved via EMI-6114's schema doc, not re-litigated here.

## 6. Gaps

1. **`ABSOLUTE_REDERIVATION`'s trigger condition is still not confirmed** — this ticket's `verifyAbsoluteRederivation` method name is the strongest lead found in the whole epic, but no comment actually describes when it runs.
2. DRIFT's schema-level representation is still open (see EMI-6114 WSD-04) — this ticket confirms DRIFT is real business logic, not a documentation error, which narrows but doesn't close that gap.
3. Status is DEV DONE, not Testing.
