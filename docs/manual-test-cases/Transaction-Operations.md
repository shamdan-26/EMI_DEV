# Manual Test Cases — Transaction Operations

Context: this document covers the remaining EMI-project transaction-related areas not addressed in
`B2B-Transactions.md`: **Money Request** (EMI-834 — a real wallet-holder-facing feature, epic
EMI-2203), **Reconciliation** (EMI-4537 core framework, Done, plus the Dynamic Reconciliation
Management System overhaul stories EMI-4538/4541/4542/4543/4549/4550/4551, To Do — epic EMI-2177),
**End-of-Day (EOD) Processing** (EMI-636, EMI-637, EMI-710, EMI-5258 — all Done — plus EMI-5920's
recon_id three-way matching, To Do, and regression bug EMI-5771), **Transaction Reversal** (EMI-2028 —
epic EMI-2208), **Transaction Adjustment** (EMI-2219 — epic EMI-2209), and **Transaction Ledger
Initiator Attribution** (EMI-5839 — BE task, status Testing as of 2026-08-02).

Money Request is a wallet-holder-facing feature with an actual UI (like W2W Transfer or QR Payment).
Reconciliation, EOD, Reversal, Adjustment, and Ledger Initiator Attribution are **Finance/Ops and
Admin Portal** functions — there is no Business Portal (merchant/biller) screen for any of them;
they're exercised via Admin Portal tooling, backend job/API triggers, or direct ledger inspection, not
the app under test in this repo. Cases below reflect that: sections B–F read as Finance/Ops
procedures, not "log in as a business user and click X."

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior,
**P3** = edge case / polish.

---

## A. Money Request (EMI-834)

Context: a wallet holder (**requester**) creates a Money Request to another wallet holder
(**requested**), who can **Accept** (pay), **Decline**, or scan a generated QR to open the payment
flow. Creating a request never reserves the requested party's balance — all normal P2P validations
(balance, limits, KYC, commission, VAT) run only when the requested party actually sends money.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| MR-FP-01 | Create a basic money request | Requester opens "Create Request," selects a requested profile, sets amount and optional note/TTL, taps Send | `MoneyRequest` is created with status `REQUESTED`; requested party is notified; requester sees it in "Requests Sent" | P1 |
| MR-FP-02 | Requested party accepts and pays successfully | Requested party opens the request, taps Pay, confirms after reviewing the fee breakdown | Request locks to `PROCESSING`; P2P validations pass; requester is credited, requested is debited (+ fees); status → `COMPLETED` with a transaction reference; both parties notified | P1 |
| MR-FP-03 | Pay via QR scan | Requester generates a QR for the request; requested party scans it, previews the request, taps Pay, confirms | QR validated (not expired/used); transfer executes as MR-FP-02; QR invalidated after use; status → `COMPLETED` | P1 |
| MR-NE-01 | Accept blocked by insufficient balance | Requested party has balance < amount + fees; taps Pay and confirms | Validation fails with `INSUFFICIENT_FUNDS`; status → `FAILED`; both notified with the reason; no ledger entries applied | P1 |
| MR-NE-02 | Accept blocked by sender transaction limit | Paying would exceed the requested party's per-tx/daily limit | Validation fails with `LIMIT_EXCEEDED`; status → `FAILED`; UI shows "Limit exceeded" with suggested actions | P2 |
| MR-NE-03 | Accept blocked by KYC/sanctions | Either party is flagged incomplete-KYC or sanctioned | Validation fails with `KYC_BLOCKED`/`SANCTIONS_BLOCKED`; status → `FAILED`; admin audit event created | P2 |
| MR-NE-04 | Expired or already-used QR rejected | Scan a QR past its TTL, or one already used | UI shows "Invalid or expired request"; no debit attempted | P1 |
| MR-EC-01 | Requester cancels before Accept | Requester taps Cancel while status is `REQUESTED` | Status → `CANCELLED`; requested party notified; Accept afterwards returns `REQUEST_CANCELLED` | P1 |
| MR-EC-02 | Request expires automatically at TTL | Create a request with a short TTL and let it elapse before any action | Status → `EXPIRED`; requested party sees expiry and cannot pay | P2 |
| MR-EC-03 | Payer with multiple wallets chooses which to debit | Requested party has 2 wallets, one with insufficient balance; selects the sufficient one when paying | System validates and completes the transfer from the chosen wallet | P2 |
| MR-EC-04 | High-precision / decimal amounts round correctly | Request an amount with decimals appropriate to the currency; pay it | Fee/rounding computed per currency rules; ledger entries balanced with no rounding loss | P3 |
| MR-CC-01 | Double-tap Pay does not double-charge (idempotency) | Requested party taps Pay twice in quick succession | Locking/idempotency ensures only one transaction is created; the second attempt returns an idempotent/duplicate response | P1 |
| MR-CC-02 | Two devices race to pay the same QR | Simulate two near-simultaneous Pay attempts on the same QR | Only the first is processed; the second returns `QR_ALREADY_USED` / `REQUEST_PROCESSING` with no debit | P2 |
| MR-CC-03 | Requester cancels while payment is processing | Requester taps Cancel at the same moment the requested party is mid-payment | Cancellation is prevented once status is `PROCESSING` (or returns a conflict); payment completes; requester is informed | P2 |
| MR-SEC-01 | Only the intended requested profile can act on a request | A different, unrelated profile attempts to Accept using the request's ID | Rejected with 403 Unauthorized; event logged | P1 |
| MR-SEC-02 | Tampered QR payload rejected | Modify a QR's amount/requester field and scan it | Signature validation fails; "Invalid QR"; no action taken | P2 |
| MR-SEC-03 | Request-ID enumeration is rate-limited | Attempt many rapid lookups of random request IDs | Rate limiting triggers (429); suspicious pattern logged/alerted | P3 |
| MR-SEC-04 | No sensitive data exposed in notifications/logs | Inspect request notifications and non-privileged logs | No PII beyond amount and requester name; full details access-audited | P2 |
| MR-INT-01 | Ledger and fee postings are correct | Complete a payment | Sender debited (amount + fees); requester credited (amount); commission/VAT wallets credited correctly; ledger balances reconcile | P1 |
| MR-INT-02 | Notifications delivered at every lifecycle step | Create → Accept → Complete a request | Push/in-app/email notifications sent to both parties at each step, with correct request ID and transaction reference | P2 |
| MR-INT-03 | Audit trail captures the full lifecycle | Inspect audit logs for a completed request | Entries for create, notify, accept, validation results, ledger IDs, and completion, all sharing a correlation ID | P2 |
| MR-UI-01 | Requests Sent / Received lists render correctly | Create several requests in different states, open both lists | Correct listing, status badges, timestamps; sortable/filterable by status | P2 |
| MR-UI-02 | Payment breakdown is accurate before confirming | Requested party opens the Pay screen | Amount requested, commission, VAT, and total to debit are shown and match backend calculation; Confirm disabled if insufficient funds | P1 |
| MR-UI-03 | QR modal shows expiry, one-time flag, and share/download | Requester generates a QR | QR image renders; Share and Download both work; expiry and "one-time use" flag are visible | P2 |
| MR-UI-04 | Error messages are actionable | Trigger an insufficient-funds failure | Message includes suggested next steps (top-up, choose another wallet, contact support) | P3 |
| MR-REC-01 | Partial failure during payment is compensated | Force a downstream failure after the sender is debited but before the requester is credited | A compensating reversal executes per policy; ledger remains consistent; status → `FAILED`; ops alerted | P2 |
| MR-REC-02 | Notification-service outage doesn't block the request | Create a request while the notification service is down | Request is still persisted; notification is queued/retried; UI shows a pending-notification state until delivery | P3 |

---

## B. Reconciliation (EMI-4537, epic EMI-2177)

Context: **Finance/Ops** procedure, no Business Portal UI. External reconciliation compares bank
records against the system; internal reconciliation compares the system ledger against wallet
balances. Reporting functions flag mismatches; system functions insert/rebuild data under strict
append-only, audit-logged rules.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RCN-01 | Missing bank transaction flagged | Import a bank statement containing a transaction absent from `transaction_log` | Mismatch report lists it as a missing TXN in the system | P1 |
| RCN-02 | Amount/status/date discrepancy flagged | Import a statement where a matched TXN's amount, status, or date differs from the system record | Mismatch report lists the discrepancy with both values | P1 |
| RCN-03 | Bank omnibus balance vs Control Wallet mismatch flagged | Compare an imported bank balance against the system Control Wallet | Mismatch report flags any difference | P1 |
| RCN-04 | Missing bank transaction auto-inserted with correct metadata | Run the external reconciliation system function on a batch with a missing TXN | New row inserted with `txn_code`, `batch_transaction_reference`, a PENDING/SUCCESS pair, plus `reconciliation_batch_id`/`source`/`inserted_by`/`timestamp` | P1 |
| RCN-05 | Auto-inserted transaction updates running_balance | After RCN-04's insert | Affected wallet's `running_balance` reflects the newly inserted transaction | P1 |
| RCN-06 | All external reconciliation actions logged | Run an external reconciliation cycle | Every action recorded in `reconciliation_runs` with `recon_id`, type, executed_by/at, totals, summary | P2 |
| RCN-07 | running_balance vs transaction_log mismatch triggers rebuild | Introduce a mismatch, run internal reconciliation reporting | Mismatch flagged; rebuild system function available/triggered | P1 |
| RCN-08 | Stale wallet-table balance flagged | A wallet's last `running_balance` record differs from its `wallets` table balance | Flagged in the internal reconciliation report | P1 |
| RCN-09 | Control wallet vs summed wallet balances mismatch flagged | Sum of all wallet balances ≠ control wallet balance | Flagged in the internal reconciliation report | P1 |
| RCN-10 | Manual rebuild via Admin UI succeeds | Admin triggers a running-balance rebuild for a `from_date`/`to_date` range | Job completes; `running_balance` matches `transaction_log` for that range; wallets updated | P1 |
| RCN-11 | Scheduled (nightly) rebuild succeeds | Let the nightly rebuild job run | Same outcome as RCN-10, unattended | P2 |
| RCN-12 | Old entries archived before rebuild | Trigger a rebuild over a range with existing running_balance rows | Existing rows moved to `running_balance_history` before new rows are written | P2 |
| RCN-13 | Wallets table updated with correct last-valid-TXN balance | After a rebuild | `wallets` table balance matches the last valid TXN per wallet | P1 |
| RCN-14 | Custom reconciliation rule configured and applied | Admin configures a matching rule (EMI-4541 Rules Engine) | New rule is applied on the next reconciliation run | P2 |
| RCN-15 | Two systems' records paired for matching | Admin links two systems for reconciliation (EMI-4542 Pair Management) | Pair is created and used by subsequent runs | P2 |
| RCN-16 | New reconciliation data source registered | Admin registers a new system (EMI-4543 Systems Management) | System appears as a selectable reconciliation source | P2 |
| RCN-17 | External fields mapped to unified schema | Admin maps a new source's fields (EMI-4549 System Types & Unified Schema) | Mapping is saved and used during ingestion | P2 |
| RCN-18 | Ingestion source configured | Admin configures a file/API ingestion source (EMI-4550) | Source is available for scheduled/manual ingestion | P2 |
| RCN-19 | Manual reconciliation run + report generation | Admin manually triggers a run and generates a report (EMI-4551) | Run completes; report reflects matched/discrepant totals | P1 |
| RCN-20 | Reconciliation report exportable | Open a generated report and export/download it | File downloads with report contents intact | P3 |

---

## C. End-of-Day (EOD) Processing (EMI-636, EMI-637, EMI-710, EMI-5258, EMI-5920, EMI-5771)

Context: **Finance/Ops** batch jobs run at day-close: internal wallet-balance validation, external
bank reconciliation with ANB, and (in the newer EMI-5920 design) three-way matching anchored on a
`recon_id` shared across the ledger, InterSoft's reconciliation callback, and the PoS omnibus bank
statement.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| EOD-01 | EOD internal reconciliation validates wallet balances | Run the EOD internal reconciliation job | Each wallet's balance is validated against its running balance; discrepancies flagged | P1 |
| EOD-02 | EOD external reconciliation with ANB | Run the EOD external reconciliation job against an ANB statement | Bank records reconciled against system transactions; discrepancies flagged | P1 |
| EOD-03 | EOD bank balance from ANB nets to zero | Pull the EOD bank balance from ANB and compare to the system Control Wallet | Control wallet + bank amount = zero (per EMI-710's AC verbatim) | P1 |
| EOD-04 | Incoming-transaction EOD job processes into Multi-Omnibus | Trigger the incoming-bank-transactions job | New transactions are processed and reflected correctly in the Multi-Omnibus module | P1 |
| EOD-05 | Regression: reserved funds released after a FAILED EOD bank statement (EMI-5771) | Create a bank transfer with the ANB payment mocked `PENDING`; confirm `reservedDebitBalance` holds the amount and `availableBalance` is reduced (`availableBalance + reservedDebitBalance = currentBalance`); mock ANB's `getPayment` status as `FAILED`; run the incoming-bank-transactions job | `reservedDebitBalance` is released back into `availableBalance` — must NOT stay stuck (this is the regression EMI-5771 fixed) | P1 |
| EOD-06 | Reserved funds stay held while EOD statement is still pending | Same setup as EOD-05 but leave `getPayment` status as `PENDING` | `reservedDebitBalance` remains reserved — not released, not finalized | P2 |
| EOD-07 | T01 — full match, all recon_ids reconcile | Callback + omnibus statement with every recon_id matching | 100% matched by recon_id; funded groups handed to instruction generation (EMI-5922) | P1 |
| EOD-08 | T02 — callback missing a held transaction | Callback omits a transaction we hold pending | E13 raised; that transaction → `DISPUTED` at day 3; rest of its recon_id group proceeds | P1 |
| EOD-09 | T03 — callback references an unknown transaction | Callback includes a transaction we never received | E14 raised; routed to Ops backfill with an audit note | P2 |
| EOD-10 | T04 — credited total mismatch within a group | Credited total differs from the recon_id group total by a small amount | E15 raised; only the affected transaction is excluded/DISPUTED; rest of the group still settles on recon_id | P1 |
| EOD-11 | T05 — statement credit references an unknown recon_id | Statement credit's reference isn't in the callback | E18 raised; credit parked as an exception; no amount-based fallback matching attempted | P1 |
| EOD-12 | T06 — recon_id in callback with no funding by cut-off | Callback recon_id has no matching omnibus credit by cut-off | E19 raised; group stays unfunded/Pending; alarm fires; no settlement instruction generated | P1 |
| EOD-13 | T07 — per-TID mismatch despite matching merchant total | One TID's total mismatches while the merchant-level total matches | Device-level flag raised on the affected TID's transactions | P2 |
| EOD-14 | T08 — held transaction is matched-but-held | A COMPLIANCE_HOLD transaction appears in both callback and funding | Classified "matched-but-held" — excluded from the releasable set; reported on the held-funds line until its case resolves | P1 |
| EOD-15 | T09 — duplicate recon_id on two statement credits | The same recon_id appears on two separate bank statement credits | First is matched; second is idempotently flagged as a duplicate exception, never double-settled | P2 |
| EOD-16 | Daily held-funds line reconciles | Inspect the daily recon report's held-funds line | `gross received = credited + held + in-transit`, matching safeguarding evidence | P2 |
| EOD-17 | Discrepancy queue ages and resolves within SLA | Inspect the discrepancy queue for open exceptions | Items show aging; resolution SLA is 3 business days; daily Ops report reflects current state | P2 |

---

## D. Transaction Reversal (EMI-2028, epic EMI-2208)

Context: **Financial Operations Manager** action via Admin Portal — manually reverses a transaction
of any type/state to correct exceptions while preserving traceability.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RV-01 | Reverse a Successful transaction | Admin reverses a Successful transaction | Funds move back from destination to source wallet; both balances updated correctly | P1 |
| RV-02 | Reverse a Pending transaction | Admin reverses a Pending transaction | Reserved amount is released; Available Balance restored | P1 |
| RV-03 | Reverse a Failed transaction | Admin reverses a Failed transaction | Any reserved amount is unreserved; funds restored to the wallet | P2 |
| RV-04 | Reverse an entire batch | Admin reverses a whole batch of transactions | Every transaction in the batch is reversed consistently | P1 |
| RV-05 | Reverse a single transaction within a batch | Admin reverses one transaction inside a larger batch | Only that transaction is reversed; the rest of the batch is untouched | P1 |
| RV-06 | A transaction/batch can only be reversed once | Attempt to reverse an already-reversed transaction or batch | Second attempt is rejected | P1 |
| RV-07 | Reversal reason is required and logged | Reverse a transaction, supplying a reason | Logged in the Reversal Reasons table with Transaction ID, Batch ID (if applicable), Reversal Type, and Reason | P2 |
| RV-08 | Ineligible transaction reversal blocked | Attempt to reverse a transaction not in Successful/Pending/Failed state | Blocked with: "Transaction is not eligible for reversal. Ensure it meets the criteria for reversal." | P1 |
| RV-09 | Reversal works for closed-loop transactions | Reverse a closed-loop transaction | Reversal completes correctly | P2 |
| RV-10 | Reversal works for open-loop transactions | Reverse an open-loop transaction | Reversal completes correctly | P2 |

---

## E. Transaction Adjustment (EMI-2219, epic EMI-2209)

Context: **Financial Operations Manager** action via Admin Portal — corrects a transaction for
exceptional cases using strict append-only logic (original never modified/deleted; every adjustment
inserts a `reversal_of` entry plus a new `adjustment_of` entry).

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| AD-01 | Adjustment is append-only | Admin adjusts a transaction | A `reversal_of` entry and a new `adjustment_of` entry are created; the original row is never modified or deleted | P1 |
| AD-02 | Adjust amount | Admin corrects a transaction's amount | Corrected transaction reflects the new amount; original preserved unchanged | P1 |
| AD-03 | Adjust external reference | Admin corrects `external_reference` | Corrected entry reflects the new reference | P2 |
| AD-04 | Adjust date | Admin corrects the transaction date | Corrected entry reflects the new date | P2 |
| AD-05 | Wallet direction cannot be flipped | Attempt to change source↔destination via an adjustment | Direction field is fixed/uneditable; adjustment cannot flip it | P1 |
| AD-06 | Adjustment reason required | Submit an adjustment without selecting a reason | Blocked until a reason from the predefined Reasons Table is selected | P2 |
| AD-07 | created_by / created_at recorded | Submit any adjustment | Both fields are stamped correctly on the new entries | P2 |
| AD-08 | Batch reference inherited | Submit an adjustment on a transaction that belongs to a batch | New entries carry the same `batch_transaction_reference` as the original | P2 |
| AD-09 | Multiple adjustments allowed | Adjust the same transaction more than once | Each adjustment is logged with its own `reversal_of`/`adjustment_of` pair; no limit on count | P2 |
| AD-10 | Batch Reference Number is read-only on the form | Open the adjustment form for a batched transaction | Batch Reference Number field is displayed but not editable | P3 |
| AD-11 | Pair-adjustment edge case replays reserve→available correctly | Adjust a transaction already Success/Failed | System performs, in order: reverse success entry (funds to reserve) → reverse pending entry (release reserve) → append new pending entry (corrected amount) → append new success entry (reserve → available) | P1 |
| AD-12 | Missing required field blocks submission | Submit the adjustment form missing a required field | Specific, field-level error message shown; submission blocked | P2 |
| AD-13 | API failure shows safe generic error | Force an API-level failure during adjustment submission | User sees: "An error occurred while processing your request. Please try again later." — no internal details leaked | P2 |
| AD-14 | Full audit trail per adjustment | Inspect the audit log after an adjustment | Entry includes admin username, timestamp, reason, affected original transaction(s), new corrected values, and the reversal entries | P1 |

---

## F. Transaction Ledger — Initiator Attribution (EMI-5839)

Context: **BE task** — the transaction ledger's `initiator` field must be populated for both pending
and successful ledger entries, sourced consistently across states. The ticket names only two flows:
per a comment thread on EMI-5839 (Amer Majed Abdalrazeq, 2026-07-16), the initiator for both **Bill
payment link** and **Wallet payment link** transactions is `"System, MjdPay Profile User"`. Acceptance
criterion 4 ("list any transaction flows where initiator cannot be populated") is an open discovery
item — the ticket does not enumerate the full set of ledger-writing flows, so full regression coverage
is blocked until engineering delivers that list. No Business Portal UI surface displays this field
(confirmed: `TransactionSummaryPage.ts`'s summary panel renders commission/VAT/total but nothing
initiator-related) — this is a ledger/DB-level attribute, inspected the same way as Reconciliation's
`transaction_log`/`running_balance` fields below.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LI-01 | Pending bill payment link ledger entry has initiator | Create a bill payment link; initiate payment; query the ledger entry while status = pending | Ledger entry exists with status `pending` and `initiator` = `"System, MjdPay Profile User"` | P1 |
| LI-02 | Successful bill payment link ledger entry has initiator | Allow LI-01's transaction to settle; query the ledger entry once status = successful | Ledger entry exists with status `successful` and `initiator` = `"System, MjdPay Profile User"` | P1 |
| LI-03 | Pending wallet payment link ledger entry has initiator | Create a wallet payment link; initiate payment; query the ledger entry while status = pending | Ledger entry exists with status `pending` and `initiator` = `"System, MjdPay Profile User"` | P1 |
| LI-04 | Successful wallet payment link ledger entry has initiator | Allow LI-03's transaction to settle; query the ledger entry once status = successful | Ledger entry exists with status `successful` and `initiator` = `"System, MjdPay Profile User"` | P1 |
| LI-05 | Initiator is consistent across pending → successful for the same transaction | Capture initiator at pending state, let the transaction settle, capture initiator at successful state, compare | Value is identical at both states — never overwritten, cleared, or re-sourced on transition | P1 |
| LI-06 | Initiator field is never null/blank for in-scope flows | Query a sample of recent bill/wallet payment link ledger entries across both states | No record has a null, empty, or placeholder `initiator` value | P2 |
| LI-07 | Initiator populated — or documented as unsupported — for ledger-writing flows beyond the two named | For every transaction flow that writes a ledger entry (not just bill/wallet payment link), execute a pending and successful transaction and inspect `initiator` | Either populated with a defined, documented value, or the flow appears on engineering's list of flows where initiator cannot be populated (AC 4) | P1 |
| LI-08 | Ledger behavior for failed/cancelled/expired transactions | Drive a bill or wallet payment link transaction to failed/cancelled/expired; query the ledger entry | Document actual behavior — current AC only defines pending and successful, so this is an uncovered gap, not a defined pass/fail | P3 |

---

## Automated coverage note

- **Money Request** — `BusinessTestCases/MoneyRequest/functional/MoneyRequestFlow.spec.ts` is
  **net-new**; no prior automation or page object existed for this screen (no `data-testid` coverage
  per `QA-DATA-TESTID-HANDOFF.md` §5 either), so `pageElements/MoneyRequest/MoneyRequestPage.ts` uses
  best-effort locators, same caveat as `CreateBillPage.ts` / `QRPaymentPage.ts`. Covers MR-FP-01/02/03,
  MR-NE-01, MR-EC-01, MR-UI-02/03 plus a Decline variant. MR-EC-02 (TTL expiry — needs a real wait),
  MR-SEC-01 (needs a third unrelated fixture account), and the remaining CC/INT/SEC/REC cases are not
  yet automated — they need dedicated test data/timing control the current fixture pool doesn't have.
- **Reconciliation / EOD / Reversal / Adjustment** — all four are Finance/Ops and Admin Portal
  functions with **no Business Portal UI surface**, so unlike every other suite in this repo they have
  no page objects. Modeled as `request`-fixture API suites (same pattern as
  `Login/api/LoginAPIFlow.spec.ts`), with every test `test.skip()`'d pending access to the
  Admin Portal / Castlemock mock-server / Ops tooling these jobs actually run against in UAT — kept in
  the suite rather than omitted, same rationale as `BankTransferCommission.spec.ts`:
  - `BusinessTestCases/Reconciliation/api/ReconciliationFlow.spec.ts` (RCN-01–20)
  - `BusinessTestCases/Reconciliation/api/EODFlow.spec.ts` (EOD-01–17)
  - `BusinessTestCases/TransactionOperations/api/TransactionReversal.spec.ts` (RV-01–10)
  - `BusinessTestCases/TransactionOperations/api/TransactionAdjustment.spec.ts` (AD-01–14)
  - `BusinessTestCases/TransactionLedger/api/TransactionLedgerInitiator.spec.ts` (LI-01–08, EMI-5839)

  Remove each file's `test.skip()` once the corresponding Admin Portal / Ops tooling access exists.
  EOD-05/EOD-06 in particular have a fully-specified repro (EMI-5771) ready to implement the moment
  Castlemock access is available. LI-07 specifically also needs engineering to deliver AC 4's flow
  list before it can be implemented as anything other than a skip — it isn't just a tooling-access
  gap.
