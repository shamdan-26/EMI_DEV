# EMI-6118 — BE: Create Method Retrieve Closing Balances (Refined)

**Assignee:** Anas Al-Halawani &nbsp;|&nbsp; **Fix version:** V6.9.0 (target 2026-10-04)
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) §1.

Nothing here has been written back to Jira. No comment on this ticket.

---

## 1. As-is (verbatim)

> **Summary** — Create an API to retrieve the closing balance from the last Running Balance record.
>
> **Acceptance criteria**
> - Retrieve Closing Available Balance.
> - Retrieve Closing Current Balance.
> - Retrieve Closing Reserved Credit.
> - Retrieve Closing Reserved Debit.
>
> **Other information** — PR + Senior Engineer review.

The ticket's summary says "API," but nothing in EMI-6124's architecture comment or this session's exploration found an independent REST route for it — it reads as an internal extraction step on top of EMI-6117's Running Balance record, not a new endpoint. Flag this word choice as a possible ticket-drafting inconsistency (as-written vs. as-shipped), same class of finding as EMI-6127's "provide the required actions for managing the snapshot" AC turning out not to be met.

## 2. What this actually is

The four-field extraction of `wallet_snapshots.closingBalances` (`reserveDebit`, `reserveCredit`, `current`, `available`) from whatever EMI-6117 returns. This is the exact 4-field shape already confirmed live via EMI-6127's response samples.

## 3. What QA can and cannot verify

**Verifiable**: EMI-6127's `closingBalances` is confirmed, per that ticket's own tech notes, to be the **one bucket group unaffected** by the current/available mapping defect — i.e. this is the one of the three bucket groups (opening/movement/closing) that already maps correctly end to end. That itself is a fact worth re-confirming here rather than only in EMI-6127's doc, since this ticket is the one that actually produces the closing values.

**Not verifiable independently of EMI-6117**: whether a bug here is actually in this extraction step or in EMI-6117's record selection — the two are tightly coupled and only separable with white-box/unit test access.

## 4. How it should be tested

1. Cross-check a real wallet's `closingBalances` (via EMI-6127) against its underlying Running Balance record's four fields directly (via SQL or the Admin Portal's Running Balance screen) — they should match exactly.
2. Confirm all four fields are populated (not just some), unlike the known opening/movement defect where `available` is left null.

## 5. Refined acceptance criteria

- `closingBalances.{reserveDebit,reserveCredit,current,available}` on a snapshot row exactly matches the four corresponding fields on the Running Balance record EMI-6117 selected for that wallet/cutoff.

## 6. Gaps

1. Ticket summary says "API" but no independent endpoint exists — worth a one-line correction request to the ticket owner.
2. No comment on this ticket; the "unaffected by the known defect" fact currently lives only in EMI-6127's doc, not here where it was actually produced.
