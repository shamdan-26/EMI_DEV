# EMI-6117 — BE: Fetch the Last Running Balance Record (Refined)

**Assignee:** Anas Al-Halawani &nbsp;|&nbsp; **Fix version:** V6.9.0 (target 2026-10-04)
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) §1: this is "resolve CLOSING balance from the ledger running-balance" via `RunningBalanceService`.

Nothing here has been written back to Jira. No comment on this ticket.

---

## 1. As-is (verbatim)

> **Summary** — Implement a method to retrieve the latest Running Balance record for a specific wallet.
>
> **Acceptance criteria**
> - Accept parameters: Wallet Code, From Date, and To Date.
> - Return the last Running Balance record available within the provided date range.
>
> **Other information** — PR + Senior Engineer review.

## 2. What this actually is

An internal method wrapping the existing Running Balance data (the same data this repo's Admin Portal already exposes at `/admin/main/running-balance`, explored in an earlier session — see that session's notes on the Admin Transaction Log/Running Balance screens). EMI-6124's architecture doc names this as the source for a wallet's **closing** balance in the snapshot flow — the "last Running Balance record" *within the cutoff's date range* becomes the snapshot's closing balance (EMI-6118 then extracts the four specific fields from it).

## 3. What QA can and cannot verify

**Verifiable indirectly**: the Admin Portal's own Running Balance screen (confirmed to exist and be navigable in an earlier session) shows the same underlying running-balance data this method reads. Cross-checking a wallet's snapshot `closingBalances` (EMI-6127) against that same wallet's latest Running Balance entry *as of the cutoff* on that screen (or via direct SQL against the running-balance table) is the practical black-box proxy.

**Not verifiable**: the exact query/index this method uses, or whether "last" is determined by a timestamp column, an auto-increment id, or something else — this needs source access, not a black-box test.

## 4. How it should be tested

1. For a wallet with multiple Running Balance entries spanning the cutoff date range, confirm the snapshot's `closingBalances` matches the entry with the latest timestamp *at or before* the cutoff — not the latest entry overall (which could be after the cutoff and wrongly included).
2. A wallet with **no** Running Balance record at all within the range — confirm this is exactly the "no Running Balance record" case EMI-6123's validation flow branches on (continue with a zero ledger value, or mark DRIFT if the ledger's computed value is non-zero).
3. From/To Date boundary — a Running Balance record dated exactly on the boundary should be included (inclusive), matching the same inclusive-boundary convention already established for EMI-6127's list filters.

## 5. Refined acceptance criteria

- Given a Wallet Code and a From/To Date range, returns the single Running Balance record with the latest effective date within that range (inclusive on both ends), or a clean "none found" signal EMI-6123 can branch on.

## 6. Gaps

1. No independent endpoint — same testability boundary as EMI-6116.
2. "Last" is not defined precisely enough by the AC alone (last by what ordering key?) — worth confirming with the implementer rather than assuming timestamp-ordering is correct.
3. No comment on this ticket at all.
