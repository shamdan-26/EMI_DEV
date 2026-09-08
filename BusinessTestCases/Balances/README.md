# Balances — wallet consistency, repair and detection (epic EMI-5944)

API-only, like `Reconciliation/` and `TransactionOperations/`. There is no
Business Portal surface for any of it — these are Finance/Ops jobs and Admin
Portal tooling.

| File | Covers | Manual TCs |
|---|---|---|
| `api/WalletBalanceRecompute.spec.ts` | EMI-5946 — order-independent bucket repair | TC-Recompute-01..30 |
| `api/BucketIdentityValidation.spec.ts` | EMI-5950 identity & conservation, EMI-5951 stuck reserves | TC-Identity-01..30, TC-Stuck-01..21 |

Manual cases live in `docs/manual-test-cases/Balances-Wallet-Consistency-EMI-5944/`
(255 cases, 10 sheets). Each test title carries its `TC-*` id.

```bash
npx playwright test BusinessTestCases/Balances
```

## Everything here is skipped, on purpose

Every story in the epic is **To Do**. Nothing is built and no API reference
exists, so all 39 tests report as skips rather than red. Two gates:

- `BALANCES_IMPLEMENTED=true` — flip once the endpoints exist
- `BALANCES_FINANCE_LEAD_TOKEN` — business sign-in cannot mint one

Assertions are written in full. Flip the flag when the epic ships rather than
softening them to get green.

## Documented vs inferred — the distinction matters

`BalancesHelper.ts` splits its constants deliberately:

**Documented, safe to assert against.** The four-bucket model, the per-wallet
identity and the cross-wallet conservation rule are defined on **EMI-602**
(amended 2026-08-01), sourced from
`docs/Financial Engine/Transaction-Lifecycle-Contract.md`.

**Inferred, best-effort.** Every path and payload shape, taken from acceptance
criteria rather than a contract, all env-overridable. A 404 against one is not a
product defect until the real contract is published.

## Three rules that are easy to get backwards

Writing any of these the intuitive way produces a test that **passes against a
broken build**:

1. **`current = available + reserve_debit`.** `reserve_credit` is *excluded* —
   money arriving on an unsettled payment is not the holder's yet. The intuitive
   `available + reserve_credit − reserve_debit` is wrong, and the epic itself
   calls it the most commonly misread rule in the model.

2. **A negative `available` is tolerated.** Q5, resolved 2026-08-03: it is
   recorded as variance and alerted, never rejected and never clamped.
   Commission and VAT wallets go temporarily negative during the reserve window.
   `BAL-ID-02` asserts the *absence* of a non-negativity constraint — adding one
   looks like a fix and is a regression.

3. **Two repair modes, different questions.** Recompute (EMI-5946) answers "is
   the wallet's money right?" — order-independent, seconds, routine. Rebuild
   (EMI-5945) answers "is the customer's statement right?" — ordered, minutes to
   hours, break-glass. Conflating them stalled this work for six months.

## The case that justifies the epic

`BAL-ID-06`. A transaction whose VAT leg was **never created** leaves every
individual wallet internally consistent, so the per-wallet identity passes and
no amount of per-wallet checking can see it. Only the cross-wallet conservation
sum catches it.

That is the failure mode behind the reserve-never-released defect class —
EMI-2013, EMI-4591, EMI-5771, plus the EMI-3506 QA trail. Four occurrences,
every one found reactively, by a customer noticing.

A **shortfall** means a leg was never applied (points at EMI-5949 ordering); a
**surplus** means one was applied twice (points at EMI-5948 idempotency). They
are recorded distinctly — collapsing them into one "mismatch" figure destroys
the diagnostic value, which is the only reason to run the check.

## Not covered here

EMI-5945 statement rebuild, EMI-5954 daily close and EMI-5955 EMI_MISSING
resolution have manual cases in the workbook but no specs yet. EMI-5947/5948/
5949 are the prevention half of the epic and are consumer/infrastructure
concerns rather than API surfaces — they need a different test approach.
