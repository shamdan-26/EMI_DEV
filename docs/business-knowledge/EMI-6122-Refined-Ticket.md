# EMI-6122 — BE: Calculate Balance Movement (Refined)

**Assignee:** Tuqa AlSawaeir &nbsp;|&nbsp; **Status:** DEV DONE &nbsp;|&nbsp; **Fix version:** V6.9.0
**Label:** Wallet-Snapshotting — see [`Wallet-Snapshot-Pipeline-Architecture.md`](Wallet-Snapshot-Pipeline-Architecture.md) §1.

Nothing here has been written back to Jira. No comment. **Status note**: DEV DONE, not yet Testing.

---

## 1. As-is (verbatim)

> **Summary** — Implement a method to calculate the movement for each balance.
>
> **Acceptance criteria**
> - Follow the calculation: Movement = Closing Balance − Opening Balance.
> - Return the calculated movement as a `BigDecimal`.
> - Apply the calculation for each required balance type.
>
> **Other information** — PR + Senior Engineer review.

## 2. What this actually is

The simplest, most mechanically checkable step in the whole pipeline: `movementBalances.{field} = closingBalances.{field} - openingBalances.{field}`, applied independently to each of the four buckets (`reserveDebit`, `reserveCredit`, `current`, `available`). `BigDecimal` in the AC is the correct type choice for money arithmetic — ties directly to EMI-6114's WSD-02 concern (decimal, not float, columns).

## 3. What QA can and cannot verify

**Fully verifiable, purely arithmetically, from a single snapshot row** — no need to trigger a new run or cross-reference another ticket's API. Given any snapshot's `openingBalances`, `movementBalances`, and `closingBalances` (all returned together by EMI-6127's endpoints), the identity `movement == closing - opening` is checkable per field with nothing more than the response body already in hand.

**Not verifiable**: rounding/scale behavior at the `BigDecimal` level (e.g. does it round half-up, half-even, truncate?) — the API only exposes the final numbers, not the intermediate arithmetic's rounding mode.

## 4. How it should be tested

1. For any snapshot (no special setup needed), confirm `movementBalances.{field} == closingBalances.{field} - openingBalances.{field}` for all four fields — this is the cheapest, highest-confidence automated check in the entire epic, since it needs no fresh trigger and no cross-ticket correlation.
2. **This check should be applied to the known-defective opening/movement mapping (EMI-6127's defect) with care**: since `openingBalances.available` is currently always null (the known defect), the movement-arithmetic check for `available` specifically cannot be validated today — document this dependency rather than reporting a false failure against the wrong root cause.
3. A negative movement (closing lower than opening, e.g. a net debit period) should compute correctly as a negative `BigDecimal`, not an unsigned/absolute value.

## 5. Refined acceptance criteria

- `movementBalances` exactly equals `closingBalances - openingBalances`, per field, for all four balance buckets, including correctly-signed negative movements — verifiable directly against any single snapshot's own response, once EMI-6127's opening-balance defect is fixed (today, only `reserveDebit`, `reserveCredit`, and `current` are checkable this way; `available` is blocked by that defect).

## 6. Gaps

1. **Blocked by EMI-6127's own known defect** for the `available` field specifically — this ticket's own correctness can't be fully confirmed until that mapper bug is fixed, since the input (`openingBalances.available`) is already wrong before this calculation even runs.
2. Rounding mode is unconfirmed.
3. Status is DEV DONE, not Testing.
