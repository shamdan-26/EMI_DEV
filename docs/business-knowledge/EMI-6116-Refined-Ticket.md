# EMI-6116 — BE: Fetch All Account Wallet Codes with Pagination (Refined)

**Assignee:** Anas Al-Halawani &nbsp;|&nbsp; **Fix version:** V6.9.0 (target 2026-10-04)
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) §1: this is the "pages through ALL wallets" step of `WalletSnapshotFacade.start()`.

Nothing here has been written back to Jira.

---

## 1. As-is (verbatim)

> **Summary** — Implement a paginated method to retrieve all account wallet codes.
>
> **Acceptance criteria**
> - Support pagination parameters such as page number and page size.
> - Return the wallet codes for each page as a `List<String>`.
> - Ensure the implementation can retrieve all wallet codes efficiently without loading the complete dataset into memory.
>
> **Other information** — PR + Senior Engineer review.

The one comment on this ticket is just a PR link (GitLab, internal-only — `http://108.181.199.238:8999/...`, unreachable from outside the internal network, same as every other internal host in this epic).

## 2. What this actually is

An internal repository/service method — `wallet.snapshot.batch-size` (per the architecture doc) controls how many wallet codes this returns per page, feeding `WalletSnapshotFacade.start()`'s per-page, bounded-concurrency processing loop. **Not its own REST endpoint** — no route for it was found anywhere in this session's exploration of the gateway or the internal job host.

## 3. What QA can and cannot verify

**Not directly testable black-box** — there is no endpoint to call. The only observable proxy: after triggering a run (EMI-6115), **every** account wallet in the system should end up with a snapshot row for that cutoff (via EMI-6127's list endpoint, paged through fully). A wallet missing from the result set is the closest black-box signal that pagination silently dropped it (an off-by-one at a page boundary, a wallet lost between two pages under concurrent modification, etc.).

**Not verifiable at all by this suite**: the AC's own efficiency claim ("without loading the complete dataset into memory") — this needs a memory profiler on the actual service process, not a black-box test.

## 4. How it should be tested

1. Confirm the total wallet count reported by this method (if accessible via logs/DB) matches the total distinct `walletCode` values in `wallet_snapshots` for a single completed run — no wallet silently dropped.
2. Boundary case: a wallet count that is an exact multiple of `wallet.snapshot.batch-size`, and one page-size-plus-one over it — confirm the last page isn't empty or duplicated.
3. A wallet created *during* a run (mid-pagination) — confirm it's either cleanly included or cleanly excluded, not double-processed. Not practically constructible as an automated test without a way to pause mid-run.

## 5. Refined acceptance criteria

- Every account wallet existing at run start appears exactly once across all pages returned.
- Page size is configurable (`wallet.snapshot.batch-size`) and the last page correctly contains the remainder, including the zero-wallets-left and exactly-one-page-left edge cases.

## 6. Gaps

1. No independent endpoint — verified only as a side effect of a full pipeline run, via EMI-6127's read API, per §3.
2. No comment beyond a PR link; nothing about batch-size defaults or concurrency-safety-under-mutation was documented by the implementer.
