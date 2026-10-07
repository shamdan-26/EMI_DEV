# EMI-6124 — BE: Aggregate the Complete Wallet Snapshot Logic (Refined)

**Assignee:** Nour Alkhdairat &nbsp;|&nbsp; **Status:** Testing &nbsp;|&nbsp; **Fix version:** V6.9.0
**Label:** Wallet-Snapshotting — **this ticket's own comment is the primary source for [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md)**, the shared reference for the whole epic. Read that document first; this one only adds what's specific to this ticket's own AC.

Nothing here has been written back to Jira.

---

## 1. As-is (verbatim)

> **Summary** — Aggregate the complete Wallet Snapshot generation, calculation, and validation logic into a single service/process.
>
> **Acceptance criteria**
> - Integrate wallet code retrieval, opening balance retrieval, and closing balance retrieval.
> - Integrate Transaction Ledger balance calculation and balance movement calculation.
> - Integrate balance validations and snapshot status determination.
> - Ensure the complete flow is executed consistently for each wallet.
>
> **Other information** — PR + Senior Engineer review.

**This ticket has by far the richest comment thread in the epic** (7 comments, 2026-09-23 to 2026-09-28) — four PR links tracking iterative delivery, then a full engineering handoff from the same author explaining the shipped design, then confirmation the on-demand trigger endpoint (EMI-6115) exists, then a note routing the handoff to QA. This is the closest thing to a proper QA-notes comment anywhere in this 13-ticket epic, and it's what makes every other ticket's refined doc in this epic possible.

## 2. What this actually is

`WalletSnapshotFacade.start(cutoff)` — the literal aggregation the AC asks for. It is the composition root: EMI-6116 (wallet codes), EMI-6117/6118/6126 (opening/closing retrieval), EMI-6120/6121/6122 (ledger calc/reconciliation/movement), EMI-6119/6123 (validation/status) are all called from here, per wallet, per page, with bounded concurrency. See the architecture doc §1 for the full sequence — it is reproduced there verbatim from this ticket's own comment, not re-derived.

**This ticket's AC #4 ("execute the complete flow consistently for each wallet") is the resilience guarantee**: a single wallet's failure is caught and logged, and does not stop the rest of the run. This is the one AC in this ticket that is both stated explicitly and independently significant enough to deserve its own direct test (see EMI-6115's WSJ-08, since it's only observable by actually triggering a run).

## 3. What QA can and cannot verify

**Verifiable**: everything the sub-tickets (EMI-6116–6123, 6126) individually verify **is** this ticket's own correctness, by definition — EMI-6124 is the sum of its parts. A passing outcome across all of those sub-ticket checks, for a real triggered run, is direct evidence this aggregation ticket works. What's genuinely distinct to *this* ticket, beyond the sub-tickets' own scope, is composition (do all the rules hold **simultaneously**, from one run, not just individually) and cross-wallet consistency — both now covered by dedicated `WAG-xx` cases and a dedicated end-to-end Postman collection (`postman/WalletSnapshotAggregate-API-majdpay.postman_collection.json`), rather than left as "implicitly covered by the parts."

**Not verifiable**: the actual `wallet.snapshot.batch-size`/`wallet.snapshot.concurrency` tuning — whether the bounded concurrency is race-free under real load needs a load/concurrency test this repo has no tooling for today (tracked as `WAG-03`, an Open Question, not a fabricated skip()).

## 4. How it should be tested

1. **End-to-end (`WAG-01`)**: trigger a real run (EMI-6115) covering a mix of wallet states (normal, provisional-opening, no-running-balance-zero-ledger, no-running-balance-non-zero-ledger/DRIFT) and confirm every wallet ends with a correctly-composed snapshot reflecting all of EMI-6116–6123/6126's individual rules simultaneously — this is the one test that actually exercises "aggregate...into a single process" as written. Automated as `WalletSnapshotAggregate.spec.ts`'s `WAG-01`; manual/exploratory via the Postman collection's folders 1–2.
2. **Failure isolation** (AC #4): per EMI-6115's `WSJ-08`, confirm one deliberately-bad wallet doesn't blank out the rest of a run's results. **Deliberately not duplicated here** — it's a genuine twin of `WSJ-08` by this repo's own merge rule (same steps, same assertion), just attributable to two tickets at once.
3. **Consistency across wallets (`WAG-02`)**: for two wallets with structurally identical ledger histories (same amounts, same transaction types, different wallet codes), confirm their snapshots compute identically — "executed consistently for each wallet" as a literal, checkable claim. Automated as `WalletSnapshotAggregate.spec.ts`'s `WAG-02`; manual/exploratory via the Postman collection's folders 1 and 3.

## 5. Refined acceptance criteria

- A single triggered run correctly composes every sub-ticket's individual rule for every wallet, with no wallet's failure affecting any other wallet's outcome in the same run.

## 6. Gaps

1. **Concurrency/load behavior is entirely unverified** — no tooling in this repo for it.
2. This ticket's comment is the best-documented in the epic, but the underlying sub-tickets it composes (6117–6123, 6126) mostly have none — the aggregation is well-described, the parts less so.
