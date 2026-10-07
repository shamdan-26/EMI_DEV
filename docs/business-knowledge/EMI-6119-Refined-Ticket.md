# EMI-6119 — BE: Validate Current Balance (Refined)

**Assignee:** Tuqa AlSawaeir &nbsp;|&nbsp; **Status:** DEV DONE (not yet in Testing) &nbsp;|&nbsp; **Fix version:** V6.9.0
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) §1/§5: this is the **structural-invariants** verification (`source: STRUCTURAL_INVARIANTS`).

Nothing here has been written back to Jira. No comment on this ticket. **Status note**: this ticket is `DEV DONE`, not `Testing` like the rest of the epic — treat anything below as provisional until it actually reaches Testing, since the implementation may still change.

---

## 1. As-is (verbatim)

> **Summary** — Implement a validation method to verify the relationship between the wallet balances.
>
> **Acceptance criteria**
> - Validate that: Current Balance = Available Balance + Reserved Debit.
> - Return the validation result so it can be used as part of the Wallet Snapshot validation flow.
>
> **Other information** — PR + Senior Engineer review.

## 2. What this actually is

The exact rule EMI-6124's comment independently confirms: *"a structural-invariants check (`current == available + reserveDebit`)"* — one of the two verification checks recorded per wallet run (source `STRUCTURAL_INVARIANTS`, outcome `PASS`/`FAIL`/`PROVISIONAL_PASS`/`PROVISIONAL_FAIL`). Two independent tickets describing the identical formula is strong confirmation this AC shipped as written.

## 3. What QA can and cannot verify

**Verifiable via EMI-6127's detail endpoint**: for a fully-verified wallet, `validationDetails` should contain an entry with `source: STRUCTURAL_INVARIANTS` — this is the direct, named evidence this check ran and what it decided. Independently, the arithmetic itself (`current == available + reserveDebit`) can be re-checked against the snapshot's own `closingBalances` fields, since all three values are already exposed there.

**Not verifiable**: the `PROVISIONAL_PASS`/`PROVISIONAL_FAIL` distinction's exact trigger condition (the architecture doc says it fires "when the wallet's opening is still provisional," but the precise definition of "provisional opening" — a new wallet's first-ever snapshot, presumably — is inferred, not confirmed by either source comment).

## 4. How it should be tested

1. For a snapshot whose `closingBalances` satisfy `current == available + reserveDebit` exactly, confirm the `STRUCTURAL_INVARIANTS` verification entry shows `PASS`.
2. For a wallet with `provisionalOpening: true` (a new wallet's first snapshot, presumably), confirm the outcome is `PROVISIONAL_PASS`/`PROVISIONAL_FAIL` rather than a plain `PASS`/`FAIL` — this needs a genuinely new wallet's first cutoff run to observe.
3. Decimal precision edge case: confirm the equality check tolerates no rounding drift (e.g. `current` off by 0.01 from `available + reserveDebit` should `FAIL`, not silently pass due to floating-point comparison — tying back to EMI-6114's WSD-02 concern about decimal vs. float column types).

## 5. Refined acceptance criteria

- Every wallet snapshot's `STRUCTURAL_INVARIANTS` verification entry reflects the true equality (or inequality) of `current` vs. `available + reserveDebit` on that snapshot's own `closingBalances`, exactly, with a `PROVISIONAL_*` outcome specifically when the wallet's opening balance was itself provisional.

## 6. Gaps

1. **Status is DEV DONE, not Testing** — everything here should be re-confirmed once it actually reaches Testing status, since DEV DONE work can still change before QA sign-off.
2. "Provisional opening" isn't precisely defined by any comment across the epic — inferred as "the wallet's first-ever snapshot" but not confirmed.
3. No independent endpoint or comment; verified only through EMI-6127's `validationDetails`.
