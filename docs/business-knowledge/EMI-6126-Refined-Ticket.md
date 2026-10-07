# EMI-6126 — BE: Retrieve Opening Balance from Previous Wallet Snapshot (Refined)

**Assignee:** Anas Al-Halawani &nbsp;|&nbsp; **Status:** Testing &nbsp;|&nbsp; **Fix version:** V6.9.0
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) §1: "resolve OPENING balance from the wallet's last sealed snapshot."

Nothing here has been written back to Jira. No comment.

---

## 1. As-is (verbatim)

> **Summary** — Implement a method to retrieve the opening balance for a wallet from the last Wallet Balance Snapshot record.
>
> **Acceptance criteria**
> - Retrieve the latest available snapshot record before the current snapshot period.
> - Use the closing balance from the previous snapshot as the opening balance for the current snapshot.
> - Retrieve all required balance fields: Opening Available Balance, Opening Current Balance, Opening Reserved Credit, and Opening Reserved Debit.
> - Handle the case where no previous Wallet Snapshot record exists.
>
> **Other information** — PR + Senior Engineer review.

## 2. What this actually is

The direct counterpart to EMI-6117/6118 (which resolve the *closing* balance from Running Balance data) — this resolves the *opening* balance, but from a **prior `wallet_snapshots` row**, not from Running Balance data at all. This is the concrete mechanism behind the "roll forward" design: today's opening = yesterday's closing, read from this ticket's own table, not recomputed from scratch each time.

**This is also where "provisional opening" (referenced by EMI-6119's PROVISIONAL_PASS/FAIL) is decided**: AC #4, "handle the case where no previous Wallet Snapshot record exists," is very likely exactly what sets `provisionalOpening: true` on the very first snapshot a wallet ever gets (no prior row to roll forward from). This ticket's own AC, read carefully, resolves a question EMI-6119's doc could only guess at.

## 3. What QA can and cannot verify

**Verifiable via EMI-6127's read API**: for a wallet with an existing prior sealed snapshot, confirm the new snapshot's `openingBalances` exactly equals the prior snapshot's `closingBalances` (all four fields) — a direct row-to-row equality check needing two consecutive triggered runs (or one wallet with pre-existing history).

**Verifiable, ties directly to AC #4**: for a wallet's first-ever snapshot (no prior row), confirm `provisionalOpening: true` is set and the opening balances are a sensible default (zero, per the architecture doc's "or provisional-zero if none exists yet").

**Not verifiable**: what "last" means precisely when multiple prior generations exist for the same wallet (EMI-6114's `generation`/`supersedes` fields) — does this pick the highest `generation`, the most recent `sealedAt`, or something else? Undocumented.

## 4. How it should be tested

1. Two consecutive triggered runs (different cutoffs) for the same wallet — confirm run 2's `openingBalances` equals run 1's `closingBalances`, field for field.
2. A brand-new wallet's first-ever run — confirm `provisionalOpening: true` and zeroed opening balances, and that this correctly feeds EMI-6119's `PROVISIONAL_PASS`/`PROVISIONAL_FAIL` outcome rather than a plain `PASS`/`FAIL`.
3. A wallet with more than one prior generation for the same cutoff period (a re-triggered run, per EMI-6115's WSJ-07) — confirm this picks the correct ("latest") prior row, once "latest" is actually defined (Gap 1).

## 5. Refined acceptance criteria

- A wallet's `openingBalances` for a new snapshot exactly equals its own most recent prior sealed snapshot's `closingBalances`.
- A wallet with no prior snapshot gets `provisionalOpening: true` and a defined default (zero) opening balance, feeding EMI-6119's provisional verification path correctly.

## 6. Gaps

1. **"Last"/"latest available" is not defined when multiple generations exist for the same wallet** — directly relevant to EMI-6115's WSJ-07 (re-trigger behavior) and EMI-6114's WSD-06 (whether `supersedes` is a real FK). All three gaps are really the same open question seen from different tickets.
2. No comment on this ticket — its connection to `provisionalOpening` is this doc's own inference from reading the AC closely, not a confirmed fact from the implementer.
