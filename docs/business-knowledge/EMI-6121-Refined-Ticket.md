# EMI-6121 — BE: Validate Ledger Computed Values Against Opening and Closing Balances (Refined)

**Assignee:** Tuqa AlSawaeir &nbsp;|&nbsp; **Status:** DEV DONE &nbsp;|&nbsp; **Fix version:** V6.9.0
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) §1/§5: this is the **incremental-ledger reconciliation** check (`source: INCREMENTAL_LEDGER`).

Nothing here has been written back to Jira. No comment. **Status note**: DEV DONE, not yet Testing.

---

## 1. As-is (verbatim)

> **Summary** — Implement a method to validate the computed values from the Transaction Ledger against the Wallet Snapshot opening and closing balances.
>
> **Acceptance criteria**
> - Compare the calculated values with the expected balance movement.
> - Determine whether the opening balance, closing balance, and computed ledger values are consistent.
>
> **Other information** — PR + Senior Engineer review.

## 2. What this actually is

EMI-6124's comment: *"for non-blocked wallets, an incremental-ledger reconciliation check (running-balance movement vs. transaction-log postings)"* — reads `TransactionLogClient`, which is **EMI-6120's own Ledger Balance Calculation API** (already fully covered by `TC-LedgerCalc-01..34` in this suite). This ticket is the consumer of that API inside the snapshot flow, comparing its output against the snapshot's own opening/closing/movement numbers.

**"Non-blocked wallets"** is new terminology not explained anywhere else in the epic — worth clarifying what makes a wallet "blocked" and therefore exempt from this check (Gap 1).

## 3. What QA can and cannot verify

**Verifiable**: for a wallet snapshot, `movementBalances` should equal EMI-6120's `TC-LedgerCalc` API's own computed `{reserveDebit, reserveCredit, current, available}` for the same wallet and the same date range as the snapshot's period. This is a direct, already-proven cross-check — EMI-6120's API and this ticket are documented as reading the exact same ledger source.

**Not verifiable**: what "blocked" means for a wallet, and therefore which wallets should be *exempt* from this check — without that definition, a wallet skipping this verification could either be correctly exempt or a bug silently skipping a check it should have run.

## 4. How it should be tested

1. Trigger a snapshot for a wallet with known transaction-ledger activity, then independently call EMI-6120's own API for the same wallet/date-range, and confirm the two movement figures agree exactly.
2. Confirm the `INCREMENTAL_LEDGER` verification entry (EMI-6127's `validationDetails`) shows `PASS` when they agree, and `FAIL` (or a `VARIANCE_PENDING`/`REPAIR_QUEUED` snapshot status per EMI-6123) when a deliberate mismatch is introduced.
3. Find and test at least one "blocked" wallet to confirm this check is genuinely skipped for it, once "blocked" is defined (Gap 1).

## 5. Refined acceptance criteria

- For every non-blocked wallet, the snapshot's `movementBalances` reconcile exactly against EMI-6120's Ledger Balance Calculation API output for the same wallet/period, recorded as an `INCREMENTAL_LEDGER` verification entry with the correct `PASS`/`FAIL` outcome.

## 6. Gaps

1. **"Non-blocked wallets" is undefined** — this is the single biggest open question for this ticket; find out what makes a wallet "blocked" before assuming this check runs universally.
2. **Status is DEV DONE, not Testing.**
3. No independent endpoint; verified only through EMI-6127's `validationDetails` plus a manual cross-call to EMI-6120's own API.
