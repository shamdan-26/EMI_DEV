# All Manual Test Cases

Consolidated from the per-feature documents in this folder (originals are unchanged). Generated 2026-10-03.

## Contents
- B2B-Transactions
- BankTransfer
- Bill-Items
- EMI-5782-5783-PoS-Products-Web
- EMI-5782-5783-PoS-Products
- ForgotPassword
- HomePage
- Login
- ManageAccounts
- Registration-API
- Registration-Contract
- Registration-E2E-and-Modes
- Registration-Financial
- Registration-Info
- Registration-Mobile
- Registration-Nafath
- Registration-OTP
- Registration-Products
- Registration-Verification-Uploads
- Topup
- Transaction-Operations

---

<!-- source: B2B-Transactions.md -->
## B2B-Transactions

## Manual Test Cases — B2B Transactions

Context: this document covers the Business-portal (Biller/Merchant) transaction flows sourced from
the EMI Jira project (`project = EMI`): **Create Bill** (EMI-183, EMI-242, EMI-3020 — Bill Management
epic EMI-2179/EMI-2178), **Pay Bill** (EMI-170 — Bill Payment epic), **Wallet-to-Wallet Transfer**
(EMI-4281 Business W2W, epic EMI-2196), **Top Up** (EMI-171 Cash-in, EMI-3564 SADAD top-up), **Wallet
Payment QR** (EMI-590 QR payment, EMI-3545 Dynamic QR, EMI-922 QR management — epic EMI-2204/EMI-2197),
and **Guest Flow** (EMI-5424, EMI-5446, EMI-5523, EMI-5551, EMI-5640, EMI-5653, EMI-5860 — public
payment-link / QR checkout without login). Ticket keys are noted per section/case so failures can be
traced back to source requirements.

Sections G–R apply the platform-wide **Limitation Management** (EMI-1653, EMI-195, EMI-87, EMI-659 —
epic EMI-2185) and **Commission Management** (EMI-2031 — epic EMI-2186) admin-configured rules to each
of the four money-movement flows (W2W Transfer, Pay Bill, Top Up, QR Payment), the same way
`BankTransfer.md`'s sections E/F do for Cashout. These rules are configured in the Admin Portal by
**Risk Level** × **Wallet Type/Tier** (Merchant, Biller) × **Transaction Type** × **Platform** (Web,
App) × **Period** (Daily, Weekly, Monthly), per EMI-87's and EMI-2031's acceptance criteria — every
case below requires that Admin Portal setup step first, same caveat `BankTransfer.md` documents for
EMI-180.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior,
**P3** = edge case / polish.

---

### A. Create Bill (Biller — EMI-183, EMI-242, EMI-3020)

Context: a Biller creates bills either manually (single or itemized/detailed entry) via the portal, or
in bulk via a protected Excel template. Bills can optionally reference a private "My Products" catalog
(EMI-3020) for faster itemized entry. Newly created/edited bills require approval before a Merchant can
pay them (see section B).

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| CB-01 | Single bill entry — required fields only | Biller opens "Add Bill" → Single Bill Entry, fills Beneficiary, Bill Ref., Amount, leaves Discount/VAT/Dates/Description empty, submits | Bill is created; discount shows "-"/0, VAT default checkbox state respected, no expiry = infinite | P1 | EMI-183 |
| CB-02 | Single bill entry — full fields with VAT and discount | Fill all optional fields: Fixed discount (non-zero), "Apply 15% VAT" checked, Issue/Expiry dates, Description | Bill Confirmation summary shows correct amount breakdown: Initial → Discount → Amount after discount → VAT → Total | P1 | EMI-183 |
| CB-03 | Discount type "None" is default and hides amount field | Open Add Bill form | Discount type defaults to "No discount"; discount amount field is hidden; discount excluded from API payload | P1 | EMI-183 |
| CB-04 | Selecting Fixed/Percentage discount reveals amount field | Change discount type from None to Fixed (or Percentage) | Discount amount field becomes visible and required; 0 is rejected as a value | P1 | EMI-183 |
| CB-05 | Zero discount value rejected when a discount type is selected | Select Fixed discount, enter 0 as the amount | Validation error — a non-zero value is required when a discount type is selected | P2 | EMI-183 |
| CB-06 | Detailed bill entry — add multiple items | Open Detailed Bill Entry, add ≥2 items with Name/Qty/Unit Price/Discount/VAT | Bill Items list reflects all items; Section 3 confirmation shows per-item and aggregate totals | P1 | EMI-183 |
| CB-07 | Detailed bill entry — item-level VAT/discount independent of master | Set different VAT/discount per item | Each item's amount breakdown (Initial/Discount/After discount/VAT/Total) is computed independently and summed correctly at bill level | P2 | EMI-183 |
| CB-08 | Optional expiry — bill never expires | Leave Expiry Date empty on creation | Bill is created with no expiry and remains payable indefinitely (never auto-flagged Expired) | P2 | EMI-183 |
| CB-09 | Add product from "My Products" to a detailed bill | On Section 2 (Bill Items), open the product multi-select and choose a saved product | Selected product is added as a line item with its saved Name/Price/VAT/Discount pre-filled | P1 | EMI-3020 |
| CB-10 | Product typeahead responsive at scale | With ~1,000 saved products, open the product selector and type a partial name | Matching results filter within ~1 second | P3 | EMI-3020 |
| CB-11 | Duplicate product name rejected | Add a new product using a name that already exists (case-insensitive) | Inline validation: "Product name already exists"; product not saved | P2 | EMI-3020 |
| CB-12 | Product VAT validation range | Enter VAT as -5 or 120 on a product | Inline error: "VAT must be a number between 0–100" | P2 | EMI-3020 |
| CB-13 | Soft-deleted product removed from dropdown, not from history | Delete a product already used on a past bill | Product disappears from the invoice item dropdown; historical bill still shows original item data | P2 | EMI-3020 |
| CB-14 | Bulk upload — valid Excel file | Upload a correctly filled, unmodified protected Excel template with N bill rows | All N bills are created; checksum validated; no tampering detected | P1 | EMI-242 |
| CB-15 | Bulk upload — tampered file rejected | Modify the protected Excel template outside allowed cells, then upload | Upload rejected — checksum mismatch detected, no bills created | P1 | EMI-242 |
| CB-16 | Bulk upload — one invalid row rolls back the whole batch | Upload a file where row 5 of 10 fails bill-creation validation | All 10 rows are rejected (atomic rollback); validation errors returned per failing row; zero bills created | P1 | EMI-242 |
| CB-17 | Bulk upload — file processing error surfaced clearly | Upload a corrupted/unreadable file | A user-friendly error is shown; no partial data is created | P2 | EMI-242 |
| CB-18 | View Bills list — Biller row/detail fields | Open "View Bills" as Biller | Row shows Bill Ref., Beneficiary brand name, Total Amount, Expiry Date, Status; detail view adds Bill type, Discount, VAT, amount breakdown, Bill Dates, QR image | P1 | EMI-183 |
| CB-19 | Unapproved / not-yet-issued bills hidden from Merchant | Create a bill with a future issue date or leave it unapproved | Bill is not visible in the Merchant's received-bills list until issue date is reached and it is approved | P1 | EMI-183 |
| CB-20 | Filter bills by reference/date/status | On View Bills, filter by Bill Reference, Date Range, and Status | List narrows to matching bills only; irrelevant bills excluded | P2 | EMI-183 |
| CB-21 | Approve/Reject a bill | Reviewer opens a Pending bill and selects Approve (or Reject) | Status updates in real time and persists to the DB; Merchant visibility follows the new status | P1 | EMI-183 |
| CB-22 | Editing an approved bill re-triggers approval | Edit the amount on an already-Approved bill | Bill flips back to Pending/unapproved and requires re-approval before it can be paid | P1 | EMI-183 |
| CB-23 | Edit restricted to unpaid bills only | Attempt to edit a bill already marked Paid | Edit is blocked/disabled for Paid bills | P1 | EMI-183 |
| CB-24 | Deleting all items shows confirmation dialog | On a detailed bill, delete the last remaining item | Confirmation dialog: "By continuing with deletion process, bill amount will become 0, are you sure you want to proceed?" | P2 | EMI-183 |
| CB-25 | Delete a bill | Biller deletes a bill they own | Bill is removed from the active list | P2 | EMI-183 |
| CB-26 | Audit trail records lifecycle events | Create, edit, view, and delete a bill in sequence | Audit log contains one entry per action with actor, timestamp, and description | P2 | EMI-183 |
| CB-27 | Bill Ref. uniqueness / required field enforcement | Attempt to submit a bill with an empty Bill Ref. or Amount | Form blocks submission with a required-field validation message | P1 | EMI-183 |

---

### B. Pay Bill (Merchant/Customer — EMI-170)

Context: a Merchant or Customer pays a bill issued to them. Only `Approved` bills that have reached
their issue date and are not already `Paid` are payable.

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| PB-01 | Approved, due bill is payable | Open Received Bills, select a bill with status Approved and issue date reached, pay it | Payment proceeds to summary/confirmation without blocking | P1 | EMI-170 |
| PB-02 | Pending/unapproved bill cannot be paid | Attempt to pay a bill that has not yet been approved | Pay action is blocked/unavailable for the bill | P1 | EMI-170 |
| PB-03 | Already-Paid bill cannot be paid again | Attempt to pay a bill already marked Paid | System rejects — bill is not processed a second time | P1 | EMI-170 |
| PB-04 | Not-yet-due bill blocked from payment | Attempt to pay a bill whose issue date is in the future | Payment is blocked until the issue date is reached | P2 | EMI-170 |
| PB-05 | Successful payment updates bill status | Pay an eligible bill to completion | Bill status updates to Paid; a payment confirmation is generated | P1 | EMI-170 |
| PB-06 | Wallet debited by exact bill amount | Note wallet balance before paying, pay a bill, check balance after | `NewBalance = OldBalance − BillAmount` exactly | P1 | EMI-170 |
| PB-07 | Successful transaction appears with SUCCESS status | Pay a bill, open Transactions | Newest transaction row shows the bill amount with a `SUCCESS` status (allow for a brief `Pending` → `Success` ledger-sync delay) | P1 | EMI-170 |
| PB-08 | Insufficient funds blocks payment | Drain wallet to below the bill amount, attempt payment | "Insufficient fund" toast is shown; bill status/due date unaffected; no debit occurs | P1 | EMI-170 |
| PB-09 | Failed payment allows retry without side effects | Force a payment failure (e.g. gateway error) | Clear error message shown; bill remains payable; due date/status unchanged; user can retry | P2 | EMI-170 |
| PB-10 | Bill detail shows full amount breakdown before paying | Open a bill's detail/summary before confirming payment | Initial amount, discount, VAT, and total are all visible and correctly summed | P2 | EMI-170 |
| PB-11 | "Pay another bill" from success screen | Complete a payment, tap "Pay another bill" on the success popup | User is returned to the Received Bills list, able to select another bill | P3 | EMI-170 |
| PB-12 | "Go to Home" from success screen | Complete a payment, tap "Go to Home" | User lands on the dashboard/home page | P3 | EMI-170 |

---

### C. Wallet-to-Wallet Transfer (Business — EMI-4281)

Context: a Business user transfers funds from their wallet to another wallet identified by CRN
(Corporate Registration Number) or by scanning the recipient's wallet QR.

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| WT-01 | Select recipient by CRN | Enter a valid CRN, tap Check Recipient | Recipient's business name resolves and displays (masked per KYB rules) | P1 | EMI-4281 |
| WT-02 | Select recipient by scanning wallet QR | Tap the QR-scan option in the CRN step, scan another wallet's QR | Recipient profile info is retrieved and populated the same as a manual CRN lookup | P1 | EMI-4281 |
| WT-03 | Amount cannot exceed available balance | Enter an amount greater than current balance | Validation error is shown; user cannot proceed to OTP | P1 | EMI-4281 |
| WT-04 | Min/max transfer limit enforced | Enter an amount outside the configured min/max transfer limit | Validation error shown; blocked before OTP | P2 | EMI-4281 |
| WT-05 | Purpose of Transfer is required and configurable | Attempt to proceed without selecting a purpose; then select one from the dropdown | Proceed is blocked without a purpose; dropdown options match what's configured in Admin | P1 | EMI-4281 |
| WT-06 | Notes field — 200 character optional limit | Enter free text over 200 characters in Notes | Input is capped at 200 characters; field remains optional (blank is valid) | P2 | EMI-4281 |
| WT-07 | Summary shows all required fields before submission | Reach the summary step | Amount, destination CRN, destination name (masked), source wallet + balance, purpose, and notes are all shown | P1 | EMI-4281 |
| WT-08 | Submission enforces wallet/account/transaction checks | Submit a transfer while a wallet/account limitation is active (e.g. suspended wallet) | Transfer is blocked with a relevant error before completing | P2 | EMI-4281 |
| WT-09 | OTP required to confirm transfer | Reach the OTP step after summary confirmation | OTP is sent to the registered mobile/email; transfer does not complete until verified | P1 | EMI-4281 |
| WT-10 | Incorrect OTP blocks the transfer with resend option | Enter a wrong OTP at confirmation | Error shown; "resend OTP" option available; transfer not processed | P1 | EMI-4281 |
| WT-11 | Successful transfer debits sender / credits receiver exactly | Complete a transfer of amount X | Sender balance decreases by exactly X; receiver balance increases by exactly X (± rounding tolerance) | P1 | EMI-4281 |
| WT-12 | Commission applied automatically where configured | Complete a transfer that falls under an active commission rule | Commission is deducted per rule; summary/ledger reflect it | P2 | EMI-4281 |
| WT-13 | SMS/notification sent to both parties | Complete a transfer | Both sender and receiver receive an SMS/notification with transfer details and updated balances | P2 | EMI-4281 |
| WT-14 | Transaction shows SUCCESS in transaction table | Complete a transfer, open Transactions | New row shows correct amount and `SUCCESS` status | P1 | EMI-4281 |
| WT-15 | Invalid/non-existent CRN rejected | Enter a CRN that doesn't exist, tap Check Recipient | "No recipient found" toast; cannot proceed | P1 | EMI-4281 |
| WT-16 | Self-transfer (own CRN) rejected | Enter the sender's own CRN as the recipient | "No recipient found" (or equivalent) toast; blocked | P2 | EMI-4281 |
| WT-17 | Insufficient funds blocks transfer with toast | Enter an amount greater than balance and proceed | Insufficient-fund toast shown; transfer blocked before OTP | P1 | EMI-4281 |
| WT-18 | CRN field rejects non-numeric/invalid input | Type letters or special characters into the CRN field | Field strips/rejects invalid characters; Check Recipient stays disabled | P2 | EMI-4281 |

---

### D. Top Up (EMI-171, EMI-3564)

Context: an admin/business user tops up their wallet via HyperPay (card), a manual VIBAN bank transfer,
or by generating and paying a SADAD bill.

#### D.1 HyperPay (card) top-up

Ledger detail (added per EMI-6120's balance-calculation rules — `emi_transaction.transaction_log` is
the same ledger table that automation already reads in `TopupHappyPath.spec.ts`, so this is the confirmed
live table, not a re-derivation): the top-up's destination wallet is an **account wallet** (Merchant/
Biller type, not `CONTROL`), and the top-up is that wallet's ledger record acting as the **destination**.
Per the "Account wallet as destination" rule, the buckets move as: `PENDING` → credit **Reserved Credit**
only (Available/Current untouched); `SUCCESS` → debit **Reserved Credit** back, credit **Available** and
**Current**; `FAILED` → debit **Reserved Credit** back to zero, Available/Current never touched. TU-03/04/05
below restate their expected results in these terms; TU-01/TU-02 are unaffected (no ledger row exists yet
at that step).

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| TU-01 | Enter amount and proceed to HyperPay UI | Enter a valid SAR amount, tap Proceed | If OTP required, OTP gate appears first; otherwise HyperPay's custom UI opens directly | P1 | EMI-171 |
| TU-02 | Amount format validation | Enter an amount with more than 7 digits or 2 decimal places | Input is rejected or truncated per the SAR prefix / 7-digit / 2-decimal rule | P2 | EMI-171 |
| TU-03 | Successful card payment updates wallet balance | Complete payment with MADA/VISA/MASTER test card | The `PENDING` ledger row's **Reserved Credit** is debited back and **Available** + **Current** are each credited by exactly the entered amount (EMI-6120 account-wallet-as-destination, `SUCCESS` row) — net effect: the customer-visible wallet balance increases by exactly the entered amount | P1 | EMI-171, EMI-6120 |
| TU-04 | Declined/failed payment shows clear error | Simulate a declined card on the gateway | User-friendly error message shown; transaction marked `FAILED`; per EMI-6120's rule the `FAILED` row debits **Reserved Credit** back to zero — Available/Current were never credited, so the customer-visible balance is unchanged throughout | P1 | EMI-171, EMI-6120 |
| TU-05 | Pending gateway result leaves balance unchanged until resolved | Simulate a pending gateway response | Transaction shows `PENDING`; per EMI-6120's rule the `PENDING` row only credits the internal **Reserved Credit** bucket, not Available/Current, so the customer-visible balance stays unchanged until the transaction resolves (`SUCCESS` releases the hold into Available/Current per TU-03; `FAILED` releases it with no balance change per TU-04) | P2 | EMI-171, EMI-6120 |

#### D.2 VIBAN bank transfer top-up

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| TU-06 | Unique VIBAN displayed with instructions | Open the bank-transfer top-up option | User's unique VIBAN and manual-transfer instructions are shown | P2 | EMI-171 |
| TU-07 | Wallet credited once bank transaction is confirmed | Transfer funds to the VIBAN externally, wait for the scheduled bank-integration job to run | Wallet balance updates automatically once the bank confirms the transaction | P2 | EMI-171 |
| TU-08 | Processing-delay messaging shown | Open the VIBAN top-up screen | User is informed of potential delays based on bank processing time | P3 | EMI-171 |

#### D.3 SADAD bill top-up

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| TU-09 | Generate a SADAD top-up bill | Open Top-Up → SADAD, enter an amount, submit | Sadad "Create Bill" API succeeds; a bill reference, amount, due date, and payment instructions are returned and displayed | P1 | EMI-3564 |
| TU-10 | Download/copy SADAD bill reference | View a created SADAD bill | "Download PDF" or "Copy Reference" option is available and works | P2 | EMI-3564 |
| TU-11 | "My Sadad Bills" list shows all created bills | Create ≥2 SADAD bills, open the list | Each entry shows reference number, amount, creation date, and status (Pending/Paid/Expired) | P2 | EMI-3564 |
| TU-12 | Wallet credited on SADAD payment confirmation | Pay a generated SADAD bill externally via Sadad, wait for callback/poll | Once status flips to Paid, wallet is credited the exact top-up amount and an in-app + email confirmation is sent | P1 | EMI-3564 |
| TU-13 | SADAD bill creation API error surfaced | Force the Sadad "Create Bill" call to fail | A user-friendly error message is shown; no bill/top-up recorded | P2 | EMI-3564 |
| TU-14 | Expired SADAD bill blocks top-up | Let a generated SADAD bill pass its due date unpaid | Bill is marked Expired; no top-up occurs if later paid | P2 | EMI-3564 |

---

### E. Wallet Payment QR (EMI-590, EMI-3545, EMI-922)

Context: a customer/merchant pays via QR in one of two modes — a **Dynamic/Amount QR** (fixed,
one-time-use amount baked into the code) or a **Wallet QR** (identifies a wallet only; payer enters
the amount manually). QR payloads must comply with EMVCo specs and be signed/encrypted server-side.

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| QR-01 | Payment entry opens full-screen scanner | Open "Scan QR" / "Pay via QR" | Camera opens full screen with the option to choose Dynamic QR or Wallet QR mode | P1 | EMI-590 |
| QR-02 | Scanning a Dynamic QR locks the amount | Select Dynamic QR mode, scan an amount-bearing QR | Amount field auto-populates with the QR's amount and becomes disabled/non-editable | P1 | EMI-590 |
| QR-03 | Scanning a Wallet QR leaves amount editable | Select Wallet QR mode, scan a wallet-only QR | Camera activates; after scan, amount field is editable for manual entry | P1 | EMI-590 |
| QR-04 | Post-scan screen shows masked recipient info | Complete either scan mode | New screen shows the recipient's masked name/wallet info and the correctly-behaving amount field | P1 | EMI-590 |
| QR-05 | Amount cannot exceed payer's balance | On a Wallet QR payment, manually enter an amount over the payer's balance | Validation error shown; cannot proceed | P1 | EMI-590 |
| QR-06 | OTP required to confirm QR payment | Confirm a valid QR payment amount | OTP sent to payer; payment only completes after correct verification | P1 | EMI-590 |
| QR-07 | Incorrect OTP allows resend | Submit a wrong OTP at QR payment confirmation | Error shown with a resend option; payment not processed | P2 | EMI-590 |
| QR-08 | Successful QR payment updates both balances | Complete a QR payment of amount X | Payer balance decreases by X (+ commission if applicable); payee balance increases by X; both notified | P1 | EMI-590 |
| QR-09 | Commission applied automatically above threshold | Complete a QR payment above the configured commission threshold | Commission is applied per rule and reflected in both parties' ledgers | P2 | EMI-590 |
| QR-10 | Merchant can generate their own Dynamic QR | Merchant opens Dynamic QR generation, enters amount/reference/expiry | A QR is generated encoding the fixed amount, unique reference, one-time-use flag, and TTL | P1 | EMI-3545 |
| QR-11 | Customer can generate a payment QR for a merchant to scan | Customer opens "generate payment QR", enters amount | Merchant scanning it sees the customer's wallet details and amount to collect | P2 | EMI-3545 |
| QR-12 | Dynamic QR is invalidated after successful use | Pay a Dynamic QR to completion, then re-scan the same QR | Second scan is rejected — "Invalid or Expired QR" | P1 | EMI-3545 |
| QR-13 | Expired Dynamic QR rejected | Scan a Dynamic QR after its TTL has passed | "Invalid or Expired QR" error shown; no payment attempted | P1 | EMI-3545 |
| QR-14 | Insufficient balance keeps QR valid until TTL | Attempt to pay a Dynamic QR with insufficient balance | "Insufficient Funds" error shown; QR remains valid/usable until its TTL expires | P2 | EMI-3545 |
| QR-15 | Tampered QR payload rejected | Present a QR whose payload has been altered (simulated) | Signature validation fails; payment blocked with a generic invalid-QR error | P2 | EMI-3545 / EMI-922 |
| QR-16 | Generated QR complies with EMVCo format | Generate any QR (bill, wallet, or amount type) | QR payload structure conforms to EMVCo QR specification for financial transactions | P2 | EMI-922 |
| QR-17 | QR scan correctly parses embedded data | Scan a QR generated by the system | Scanned data is accurately parsed and displayed (no corruption/truncation) | P2 | EMI-922 |

---

### F. Guest Flow (Payment Links / Guest Checkout — EMI-5424, EMI-5446, EMI-5523, EMI-5551, EMI-5640, EMI-5653, EMI-5860)

Context: an unauthenticated ("guest") user can pay a bill or a wallet by opening a public payment
link or scanning a QR generated by a logged-in user, without creating an account. The backend
resolves the link/QR token, validates it, and issues a short-lived guest JWT session scoped to
that single payment.

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| GF-01 | Logged-in user generates a guest wallet payment link | While logged in, open wallet QR / "generate guest link", copy the link | A shareable public link (and/or QR) is generated referencing the wallet and is copyable | P1 | EMI-5424 |
| GF-02 | Guest opens a valid wallet link in a fresh browser (no session) | Paste the guest link into a separate/incognito browser with no login | Link resolves; sanitized payment summary is shown (wallet name masked, open amount or fixed amount + fees) — no internal/sensitive data exposed | P1 | EMI-5424 / EMI-5860 |
| GF-03 | Guest opens a valid bill link in a fresh browser | Open a guest link pointing to an invoice/bill | Link resolves; sanitized bill summary shown (amount, fees, VAT) | P1 | EMI-5424 |
| GF-04 | Guest session (JWT) generated on resolution | Open any valid guest link | Backend issues a JWT bound to the link ID and reference type (INVOICE/BILL or WALLET); stateless, single-link scope, high-entropy non-enumerable token | P1 | EMI-5446 |
| GF-05 | Expired guest link rejected | Open a guest link/QR past its expiry | Clear "invalid or expired" message; no payment summary or JWT issued | P1 | EMI-5424 / EMI-5446 |
| GF-06 | Disabled/already-paid link rejected | Open a guest link whose underlying bill is already Paid, or whose link is disabled | Clear rejection message; guest cannot proceed to pay | P1 | EMI-5424 |
| GF-07 | Scanning a wallet QR as a guest succeeds (regression, EMI-5551) | As an unauthenticated user, scan a valid wallet QR | Payment link/summary resolves — must NOT show "Payment link not found" | P1 | EMI-5551 |
| GF-08 | Guest wallet payment does not fail with a generic error (regression, EMI-5640) | As a guest, scan a wallet QR and attempt payment | Payment proceeds normally — must NOT show a generic "Wallet Payment Failed" | P1 | EMI-5640 |
| GF-09 | Location-permission prompt does not block guest payment (regression, EMI-5653) | As a guest, scan a wallet QR that triggers a location-permission popup | Popup is clickable/dismissible; guest can proceed to complete payment | P2 | EMI-5653 |
| GF-10 | Guest wallet payment does not fail with "invalid wallet code" (regression, EMI-5860) | Logged-in user generates a guest wallet link, copies it, opens it in a separate browser, completes the payment steps | Payment completes successfully — must NOT show "Payment failed (invalid wallet code)" | P1 | EMI-5860 |
| GF-11 | Guest bill payment processes correctly | Open a valid guest bill link, submit payment with valid details | Payment is processed; bill status updates to Paid; guest sees a success confirmation | P1 | EMI-5523 |
| GF-12 | Guest payment blocked once the underlying reference becomes ineligible mid-session | Open a valid guest link, then have the bill get paid/cancelled by another channel before the guest confirms | Guest's payment attempt is rejected with a clear message rather than double-processing | P2 | EMI-5424 |
| GF-13 | No sensitive/internal data exposed to guest | Inspect the payment summary and any error responses returned to a guest session | Only sanitized fields are present — no internal IDs, stack traces, or other users' data | P1 | EMI-5446 |
| GF-14 | Guest JWT cannot be reused across different links | Obtain a guest JWT from link A, attempt to use it against link B's payment endpoint | Request is rejected — token is scoped to its originating link only | P2 | EMI-5446 |
| GF-15 | Rate limiting on public guest endpoints | Rapidly repeat guest link/QR resolution requests | Excessive requests are throttled/blocked rather than allowed unlimited retries | P3 | EMI-5446 |

---

### G. Wallet-to-Wallet Transfer — Wallet Balance Limits (EMI-659, EMI-1653, EMI-195)

Context: Admin Portal → Manage Limits → Wallet Balance caps a wallet's balance by Risk Level × Wallet
Type (Merchant, Biller). A transfer is blocked if it would push the **sender** below their configured
minimum, or push the **receiver** above their configured maximum.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WT-WB01 | Sender transfer within min-balance floor succeeds (Merchant, Low risk) | Admin sets a Low-risk Merchant min-balance floor and saves. Sender transfers an amount that leaves their balance above the floor | Transfer succeeds; sender's post-transfer balance stays above the configured minimum | P1 |
| WT-WB02 | Sender transfer breaching min-balance floor is blocked (Merchant, Low risk) | Same setup; sender transfers an amount that would drop their balance below the floor | Transfer is rejected before OTP with a clear message; sender balance unchanged | P1 |
| WT-WB03 | Receiver credit within max-balance ceiling succeeds (Biller, Low risk) | Admin sets a Low-risk Biller max-balance ceiling and saves. Sender transfers an amount that leaves the receiver's balance under the ceiling | Transfer succeeds; receiver's post-transfer balance stays under the configured maximum | P1 |
| WT-WB04 | Receiver credit breaching max-balance ceiling is blocked (Biller, Low risk) | Same setup; sender transfers an amount that would push the receiver's balance over the ceiling | Transfer is rejected with a clear message; neither wallet is debited/credited | P1 |
| WT-WB05 | Sender transfer within min-balance floor succeeds (Merchant, Medium risk) | Repeat WT-WB01 with the Medium-risk Merchant floor | Transfer succeeds as expected | P2 |
| WT-WB06 | Sender transfer breaching min-balance floor is blocked (Merchant, Medium risk) | Repeat WT-WB02 with the Medium-risk Merchant floor | Transfer is rejected | P2 |
| WT-WB07 | Receiver credit within max-balance ceiling succeeds (Biller, Medium risk) | Repeat WT-WB03 with the Medium-risk Biller ceiling | Transfer succeeds as expected | P2 |
| WT-WB08 | Receiver credit breaching max-balance ceiling is blocked (Biller, Medium risk) | Repeat WT-WB04 with the Medium-risk Biller ceiling | Transfer is rejected | P2 |

### H. Wallet-to-Wallet Transfer — Transaction Limits (EMI-87, EMI-1653, EMI-195)

Context: Admin Portal → Manage Limits → Transaction caps W2W transfers by Risk Level × Wallet Tier ×
Platform (Web/App) × Period (Daily/Weekly/Monthly), on both cumulative **amount** and **count** of
transfers.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WT-TL01 | Transfers within the daily amount limit succeed (Web) | Admin sets a daily cumulative-amount ceiling for W2W transfer on Web and saves. Sender makes transfers totalling under the ceiling | Each transfer completes normally | P1 |
| WT-TL02 | Cumulative transfers exceeding the daily amount limit are blocked (Web) | Same setup; sender's next transfer would push the day's total over the ceiling | That transfer is rejected with a clear limit-exceeded message | P1 |
| WT-TL03 | Transfers within the weekly amount limit succeed (Web) | Admin sets a weekly amount ceiling; sender transfers within it across the week | Each transfer completes normally | P2 |
| WT-TL04 | Cumulative transfers exceeding the weekly amount limit are blocked (Web) | Same setup; sender's transfer would exceed the weekly ceiling | Transfer is rejected | P2 |
| WT-TL05 | Transfers within the monthly amount limit succeed (App) | Admin sets a monthly amount ceiling for the App platform; sender transfers within it | Each transfer completes normally | P2 |
| WT-TL06 | Cumulative transfers exceeding the monthly amount limit are blocked (App) | Same setup; sender's transfer would exceed the monthly ceiling | Transfer is rejected | P1 |
| WT-TL07 | Transfers within the daily count limit succeed | Admin sets a daily transfer-count ceiling and saves. Sender makes transfers up to that count | Each transfer within the count succeeds | P2 |
| WT-TL08 | Transfer once the daily count limit is exceeded is blocked | Same setup; sender attempts one more transfer past the count ceiling | Transfer is rejected with a clear message | P1 |
| WT-TL09 | Transfers within the weekly count limit succeed | Admin sets a weekly count ceiling; sender transfers up to that count | Each transfer succeeds | P2 |
| WT-TL10 | Transfer once the weekly count limit is exceeded is blocked | Same setup; sender exceeds the weekly count | Transfer is rejected | P2 |
| WT-TL11 | Transfers within the monthly count limit succeed | Admin sets a monthly count ceiling; sender transfers up to that count | Each transfer succeeds | P2 |
| WT-TL12 | Transfer once the monthly count limit is exceeded is blocked | Same setup; sender exceeds the monthly count | Transfer is rejected | P2 |

### I. Wallet-to-Wallet Transfer — Commission (EMI-2031)

Context: Admin Portal → Commission Management configures a **Default** (platform-wide) or **Custom**
(per business account) commission schema for W2W transfer, by Platform, Min/Max amount, and Fixed or
Percentage type. Commission is added to the sender's debit and deducted from the receiver's credit.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WT-CM01 | Default schema applies when no custom commission exists | Ensure no custom commission is configured for the sender's business account; complete a transfer | The platform-wide default commission schema is applied | P2 |
| WT-CM02 | Custom per-account schema overrides the default | Admin configures a custom commission for the sender's specific business account; complete a transfer | The custom commission is applied instead of the default | P2 |
| WT-CM03 | Fixed commission deducted on a standard transfer | Admin configures a fixed-amount commission for W2W transfer; sender transfers within its applicable range | Commission summary reflects the fixed amount; sender's debit includes it, receiver's credit is net of it | P1 |
| WT-CM04 | Fixed commission applied at minimum boundary | Same setup; transfer an amount equal to the configured minimum | Fixed commission is deducted | P2 |
| WT-CM05 | Fixed commission applied at maximum boundary | Same setup; transfer an amount equal to the configured maximum | Fixed commission is deducted | P2 |
| WT-CM06 | Fixed commission not applied below minimum | Same setup; transfer an amount below the configured minimum | No commission is applied for that transfer | P2 |
| WT-CM07 | Fixed commission not applied above maximum | Same setup; transfer an amount above the configured maximum | No commission is applied for that transfer | P2 |
| WT-CM08 | Percentage commission deducted on a standard transfer | Admin configures a percentage commission; sender transfers within its range | Commission reflects the correct percentage of the transfer amount | P2 |
| WT-CM09 | Percentage commission applied at minimum boundary | Same setup; transfer equal to the configured minimum | Percentage commission is deducted | P2 |
| WT-CM10 | Percentage commission applied at maximum boundary | Same setup; transfer equal to the configured maximum | Percentage commission is deducted | P2 |
| WT-CM11 | Percentage commission not applied below minimum | Same setup; transfer below the configured minimum | No commission applied | P2 |
| WT-CM12 | Percentage commission not applied above maximum | Same setup; transfer above the configured maximum | No commission applied | P2 |
| WT-CM13 | Commission added on sender side / deducted on receiver side | Complete a transfer with an active commission | Sender's total debit = amount + commission; receiver's credit = amount − commission (per EMI-2031's dual-side rule) | P1 |
| WT-CM14 | Overlapping commission rules rejected | Admin attempts to create a second commission rule for the same transaction type/platform/amount range as an existing one | System rejects with a clear "overlapping rule" error | P2 |
| WT-CM15 | Min amount cannot exceed max amount | Admin attempts to save a commission rule with Min > Max | Validation blocks save with a clear error | P2 |
| WT-CM16 | Transaction type cannot be edited on an existing commission | Admin opens an existing commission rule and attempts to change its transaction type | Field is read-only/disabled for editing | P3 |
| WT-CM17 | Disabling a commission schema stops it applying | Admin disables an active custom commission schema; sender transfers | Transfer completes with no commission applied (falls back to default, if any) | P2 |
| WT-CM18 | Re-enabling a commission schema resumes applying it | Admin re-enables the schema from WT-CM17; sender transfers again | Commission is applied again as configured | P3 |

### J. Pay Bill — Wallet Balance Limits (EMI-659, EMI-1653, EMI-195)

Context: same Admin Portal wallet-balance mechanism as section G, applied to Bill Payment — the
**payer** (Merchant/Customer) must not drop below their minimum, and the **biller** being paid must
not exceed their maximum.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PB-WB01 | Payer bill payment within min-balance floor succeeds (Merchant, Low risk) | Admin sets a Low-risk Merchant min-balance floor. Payer pays a bill leaving their balance above the floor | Payment succeeds | P1 |
| PB-WB02 | Payer bill payment breaching min-balance floor is blocked (Merchant, Low risk) | Same setup; paying the bill would drop the payer below the floor | Payment is rejected before completion with a clear message | P1 |
| PB-WB03 | Biller credit within max-balance ceiling succeeds (Biller, Low risk) | Admin sets a Low-risk Biller max-balance ceiling. Payer pays a bill leaving the biller's balance under the ceiling | Payment succeeds | P1 |
| PB-WB04 | Biller credit breaching max-balance ceiling is blocked (Biller, Low risk) | Same setup; the payment would push the biller over the ceiling | Payment is rejected; bill remains unpaid/pending | P1 |
| PB-WB05 | Payer bill payment within min-balance floor succeeds (Merchant, Medium risk) | Repeat PB-WB01 with the Medium-risk Merchant floor | Payment succeeds | P2 |
| PB-WB06 | Payer bill payment breaching min-balance floor is blocked (Merchant, Medium risk) | Repeat PB-WB02 with the Medium-risk Merchant floor | Payment is rejected | P2 |
| PB-WB07 | Biller credit within max-balance ceiling succeeds (Biller, Medium risk) | Repeat PB-WB03 with the Medium-risk Biller ceiling | Payment succeeds | P2 |
| PB-WB08 | Biller credit breaching max-balance ceiling is blocked (Biller, Medium risk) | Repeat PB-WB04 with the Medium-risk Biller ceiling | Payment is rejected | P2 |

### K. Pay Bill — Transaction Limits (EMI-87, EMI-1653, EMI-195)

Context: same Admin Portal transaction-limit mechanism as section H, applied to Bill Payment by Risk
Level × Wallet Tier × Platform × Period. EMI-87's own example table explicitly names "Biller bill
payment" as a configured transaction type.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PB-TL01 | Bill payments within the daily amount limit succeed (Web) | Admin sets a daily cumulative-amount ceiling for bill payment on Web. Payer pays bills totalling under the ceiling | Each payment completes normally | P1 |
| PB-TL02 | Cumulative bill payments exceeding the daily amount limit are blocked (Web) | Same setup; the next payment would exceed the day's ceiling | That payment is rejected with a clear message | P1 |
| PB-TL03 | Bill payments within the weekly amount limit succeed (Web) | Admin sets a weekly amount ceiling; payer pays within it | Each payment completes normally | P2 |
| PB-TL04 | Cumulative bill payments exceeding the weekly amount limit are blocked (Web) | Same setup; payment would exceed the weekly ceiling | Payment is rejected | P2 |
| PB-TL05 | Bill payments within the monthly amount limit succeed (App) | Admin sets a monthly amount ceiling on App; payer pays within it | Each payment completes normally | P2 |
| PB-TL06 | Cumulative bill payments exceeding the monthly amount limit are blocked (App) | Same setup; payment would exceed the monthly ceiling | Payment is rejected | P1 |
| PB-TL07 | Bill payments within the daily count limit succeed | Admin sets a daily payment-count ceiling. Payer pays bills up to that count | Each payment within the count succeeds | P2 |
| PB-TL08 | Bill payment once the daily count limit is exceeded is blocked | Same setup; payer attempts one more payment past the count ceiling | Payment is rejected | P1 |
| PB-TL09 | Bill payments within the weekly count limit succeed | Admin sets a weekly count ceiling; payer pays up to that count | Each payment succeeds | P2 |
| PB-TL10 | Bill payment once the weekly count limit is exceeded is blocked | Same setup; payer exceeds the weekly count | Payment is rejected | P2 |
| PB-TL11 | Bill payments within the monthly count limit succeed | Admin sets a monthly count ceiling; payer pays up to that count | Each payment succeeds | P2 |
| PB-TL12 | Bill payment once the monthly count limit is exceeded is blocked | Same setup; payer exceeds the monthly count | Payment is rejected | P2 |

### L. Pay Bill — Commission (EMI-2031)

Context: same Admin Portal commission mechanism as section I, applied to Bill Payment. Commission is
added to the payer's debit and deducted from the biller's credit.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PB-CM01 | Default schema applies when no custom commission exists | Ensure no custom commission is configured for the payer's business account; pay a bill | Default commission schema applies | P2 |
| PB-CM02 | Custom per-account schema overrides the default | Admin configures a custom commission for the payer's account; pay a bill | Custom commission is applied instead of the default | P2 |
| PB-CM03 | Fixed commission deducted on a standard bill payment | Admin configures a fixed-amount commission for Bill Payment; payer pays a bill within its range | Commission summary reflects the fixed amount | P1 |
| PB-CM04 | Fixed commission applied at minimum boundary | Same setup; bill amount equals the configured minimum | Fixed commission is deducted | P2 |
| PB-CM05 | Fixed commission applied at maximum boundary | Same setup; bill amount equals the configured maximum | Fixed commission is deducted | P2 |
| PB-CM06 | Fixed commission not applied below minimum | Same setup; bill amount below the configured minimum | No commission applied | P2 |
| PB-CM07 | Fixed commission not applied above maximum | Same setup; bill amount above the configured maximum | No commission applied | P2 |
| PB-CM08 | Percentage commission deducted on a standard bill payment | Admin configures a percentage commission; payer pays within its range | Commission reflects the correct percentage | P2 |
| PB-CM09 | Percentage commission applied at minimum boundary | Same setup; bill amount equals the configured minimum | Percentage commission is deducted | P2 |
| PB-CM10 | Percentage commission applied at maximum boundary | Same setup; bill amount equals the configured maximum | Percentage commission is deducted | P2 |
| PB-CM11 | Percentage commission not applied below minimum | Same setup; bill amount below the configured minimum | No commission applied | P2 |
| PB-CM12 | Percentage commission not applied above maximum | Same setup; bill amount above the configured maximum | No commission applied | P2 |
| PB-CM13 | Commission added on payer side / deducted on biller side | Pay a bill with an active commission configured | Payer's total debit = bill amount + commission; biller's credit = bill amount − commission | P1 |
| PB-CM14 | Overlapping commission rules rejected | Admin attempts a second commission rule overlapping an existing one for Bill Payment | Rejected with a clear "overlapping rule" error | P2 |
| PB-CM15 | Min amount cannot exceed max amount | Admin attempts to save a rule with Min > Max | Validation blocks save | P2 |
| PB-CM16 | Transaction type cannot be edited on an existing commission | Admin attempts to change the transaction type on an existing Bill Payment commission rule | Field is read-only | P3 |
| PB-CM17 | Disabling a commission schema stops it applying | Admin disables the custom schema; payer pays a bill | No commission applied | P2 |
| PB-CM18 | Re-enabling a commission schema resumes applying it | Admin re-enables the schema; payer pays another bill | Commission applied again | P3 |

### M. Top Up — Wallet Balance Limits (EMI-659, EMI-1653, EMI-195)

Context: same Admin Portal wallet-balance mechanism as section G, applied to Top Up. Since top-up only
credits the user's own wallet (funds enter from outside the platform via HyperPay/VIBAN/SADAD), only
the **maximum** balance ceiling is relevant here — there's no sender wallet inside the platform to hit
a minimum floor.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TU-WB01 | Top-up within max-balance ceiling succeeds (Merchant, Low risk) | Admin sets a Low-risk Merchant max-balance ceiling. User tops up an amount that leaves their balance under the ceiling | Top-up succeeds; balance credited | P1 |
| TU-WB02 | Top-up breaching max-balance ceiling is blocked (Merchant, Low risk) | Same setup; the top-up would push the balance over the ceiling | Top-up is rejected before payment capture with a clear message | P1 |
| TU-WB03 | Top-up within max-balance ceiling succeeds (Biller, Low risk) | Admin sets a Low-risk Biller max-balance ceiling. User tops up within it | Top-up succeeds | P2 |
| TU-WB04 | Top-up breaching max-balance ceiling is blocked (Biller, Low risk) | Same setup; top-up would exceed the ceiling | Top-up is rejected | P2 |
| TU-WB05 | Top-up within max-balance ceiling succeeds (Merchant, Medium risk) | Repeat TU-WB01 with the Medium-risk Merchant ceiling | Top-up succeeds | P2 |
| TU-WB06 | Top-up breaching max-balance ceiling is blocked (Merchant, Medium risk) | Repeat TU-WB02 with the Medium-risk Merchant ceiling | Top-up is rejected | P2 |
| TU-WB07 | Top-up within max-balance ceiling succeeds (Biller, Medium risk) | Repeat TU-WB03 with the Medium-risk Biller ceiling | Top-up succeeds | P2 |
| TU-WB08 | Top-up breaching max-balance ceiling is blocked (Biller, Medium risk) | Repeat TU-WB04 with the Medium-risk Biller ceiling | Top-up is rejected | P2 |

### N. Top Up — Transaction Limits (EMI-87, EMI-1653, EMI-195)

Context: same Admin Portal mechanism as section H, applied to Top Up — EMI-87's own example table
explicitly names "Merchant top-up" as a configured transaction type, including a High-risk example
where the count limit is 0 (top-up disabled entirely for that risk tier).

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TU-TL01 | Top-ups within the daily amount limit succeed (App) | Admin sets a daily cumulative-amount ceiling for top-up on App. User tops up totalling under the ceiling | Each top-up completes normally | P1 |
| TU-TL02 | Cumulative top-ups exceeding the daily amount limit are blocked (App) | Same setup; next top-up would exceed the day's ceiling | That top-up is rejected with a clear message | P1 |
| TU-TL03 | Top-ups within the weekly amount limit succeed | Admin sets a weekly amount ceiling; user tops up within it | Each top-up completes normally | P2 |
| TU-TL04 | Cumulative top-ups exceeding the weekly amount limit are blocked | Same setup; top-up would exceed the weekly ceiling | Top-up is rejected | P2 |
| TU-TL05 | Top-ups within the monthly amount limit succeed | Admin sets a monthly amount ceiling; user tops up within it | Each top-up completes normally | P2 |
| TU-TL06 | Cumulative top-ups exceeding the monthly amount limit are blocked | Same setup; top-up would exceed the monthly ceiling | Top-up is rejected | P1 |
| TU-TL07 | Top-ups within the daily count limit succeed | Admin sets a daily top-up count ceiling. User tops up up to that count | Each top-up within the count succeeds | P2 |
| TU-TL08 | Top-up once the daily count limit is exceeded is blocked | Same setup; user attempts one more top-up past the count ceiling | Top-up is rejected | P1 |
| TU-TL09 | High-risk account with a 0 count limit cannot top up at all | Admin sets the top-up count limit to 0 for a High-risk tier (per EMI-87's own example) | Any top-up attempt is immediately blocked | P1 |
| TU-TL10 | Top-ups within the monthly count limit succeed | Admin sets a monthly count ceiling; user tops up up to that count | Each top-up succeeds | P2 |
| TU-TL11 | Top-up once the monthly count limit is exceeded is blocked | Same setup; user exceeds the monthly count | Top-up is rejected | P2 |
| TU-TL12 | Top-ups within the weekly count limit succeed | Admin sets a weekly count ceiling; user tops up up to that count | Each top-up succeeds | P2 |

### O. Top Up — Commission (EMI-2031)

Context: same Admin Portal commission mechanism as section I, applied to Top Up. Since top-up has no
in-platform counterparty, commission (if configured) is deducted from the credited amount rather than
split across sender/receiver.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TU-CM01 | Default schema applies when no custom commission exists | Ensure no custom commission for the user's account; top up | Default commission schema applies | P2 |
| TU-CM02 | Custom per-account schema takes priority over the default | Admin configures a custom top-up commission for the account; top up | Custom commission is applied for this account; the platform-wide default row is untouched and still Active, it's simply outranked for this one account | P2 |
| TU-CM03 | Fixed commission deducted on a standard top-up | Admin configures a fixed-amount commission for Top Up; user tops up within its range | Wallet is credited the top-up amount minus the fixed commission | P1 |
| TU-CM04 | Fixed commission applied at minimum boundary | Same setup; top-up amount equals the configured minimum | Fixed commission is deducted | P2 |
| TU-CM05 | Fixed commission applied at maximum boundary | Same setup; top-up amount equals the configured maximum | Fixed commission is deducted | P2 |
| TU-CM06 | Fixed commission not applied below minimum | Same setup; top-up amount below the configured minimum | No commission applied | P2 |
| TU-CM07 | Fixed commission not applied above maximum | Same setup; top-up amount above the configured maximum | No commission applied | P2 |
| TU-CM08 | Percentage commission deducted on a standard top-up | Admin configures a percentage commission; user tops up within its range | Commission reflects the correct percentage | P2 |
| TU-CM09 | Percentage commission applied at minimum boundary | Same setup; top-up amount equals the configured minimum | Percentage commission is deducted | P2 |
| TU-CM10 | Percentage commission applied at maximum boundary | Same setup; top-up amount equals the configured maximum | Percentage commission is deducted | P2 |
| TU-CM11 | Percentage commission not applied below minimum | Same setup; top-up amount below the configured minimum | No commission applied | P2 |
| TU-CM12 | Percentage commission not applied above maximum | Same setup; top-up amount above the configured maximum | No commission applied | P2 |
| TU-CM13 | Credited amount is net of commission | Top up with an active commission configured | Wallet balance increases by exactly (top-up amount − commission) | P1 |
| TU-CM14 | Overlapping commission rules rejected | Admin attempts a second overlapping commission rule for Top Up | Rejected with a clear error | P2 |
| TU-CM15 | Min amount cannot exceed max amount | Admin attempts to save a rule with Min > Max | Validation blocks save | P2 |
| TU-CM16 | Transaction type cannot be edited on an existing commission | Admin attempts to change the transaction type on an existing Top-Up commission rule | Field is read-only | P3 |
| TU-CM17 | Disabling a commission schema stops it applying | Admin disables the schema; user tops up | No commission applied | P2 |
| TU-CM18 | Re-enabling a commission schema resumes applying it | Admin re-enables the schema; user tops up again | Commission applied again | P3 |

#### Live single-tier schema validation (EMI-2031)

Context: the account's live Web default schema for Merchant Cashin configures a single active row
(one minimum–maximum range, percentage-or-fixed) rather than the three simultaneous tiers this
subsection originally described. TU-CM19–32 test that row generically — every boundary below is
whatever the admin portal currently configures for it (minimum/maximum/value/percentage-or-fixed),
not a fixed number, so the cases keep passing however the live range or value changes over time. A
case whose Expected Result says "verify against live behaviour" is an open question until confirmed
against a live run, not an assumed pass.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TU-CM19 | Commission applied at the tier's minimum boundary | Top up the live row's configured minimum amount | Commission is charged per the row's percentage-or-fixed configuration | P1 |
| TU-CM20 | Commission applied at the tier's maximum boundary | Same setup; top up the configured maximum amount | Commission is charged per the row's configuration | P1 |
| TU-CM21 | Commission applied mid-range within the tier | Same setup; top up an amount midway between the configured minimum and maximum | Commission is charged per the row's configuration (skip if the range is too narrow for a distinct midpoint) | P2 |
| TU-CM22 | Amount just below the tier minimum falls in an unconfigured gap | Same setup; top up one unit below the configured minimum (skip if the minimum is already the smallest positive amount) | Topup is rejected as below the minimum allowed amount, or the rule actually configured for this range applies — verify against live behaviour; flag as a config gap if neither | P1 |
| TU-CM23 | Amount just above the tier maximum falls in an unconfigured gap | Same setup; top up one unit above the configured maximum | Topup is rejected, or another applicable rule applies — verify against live behaviour; flag as a config gap if neither | P1 |
| TU-CM29 | Amount below the smallest valid amount (0 or negative) is rejected outright | Same setup; top up 0 | Rejected with a validation error; no commission is calculated or charged | P1 |
| TU-CM31 | Commission type flag matches the tier's configuration | Top up at the tier's minimum and maximum boundaries | Both boundaries reflect the same percentage-or-fixed flag: a percentage tier's commission scales proportionally with amount at both boundaries; a fixed tier's stays the identical absolute value at both — the two are never interchanged | P2 |
| TU-CM32 | Commission rule does not apply on platforms other than its configured one | Initiate a Web top-up at the amount matching a *different*, APP-scoped Merchant Cashin row's minimum boundary | The APP-scoped commission is not applied to the Web-initiated top-up | P2 |

#### Account-level commission validation (EMI-2031)

Context: same concept as the "Live single-tier schema validation" block above, but against a
per-account commission override (Admin Portal → Commission Management → Accounts Commission) instead
of the platform-wide Default Commission row — TU-CM02 above already proves the override takes
priority; the cases below prove its own boundaries/value/type are read correctly, the same way
TU-CM19/20/21/31 and TU-CM03/08 do for the Default row. IDs reuse the Tier-B/Tier-C slots freed up
when the 3-tier configuration below TU-CM23 was retired down to a single row, rather than extending
the range past TU-CM32.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TU-CM24 | Fixed-type account-level commission deducted on a standard top-up | Admin configures a fixed-amount account-level commission override; user tops up within its range | Wallet is credited the top-up amount minus the fixed commission | P2 |
| TU-CM25 | Percentage-type account-level commission deducted on a standard top-up | Admin configures a percentage account-level commission override; user tops up within its range | Commission reflects the correct percentage | P2 |
| TU-CM26 | Account-level commission applied at the tier's minimum boundary | Top up the override row's configured minimum amount | Commission is charged per the row's percentage-or-fixed configuration | P2 |
| TU-CM27 | Account-level commission applied at the tier's maximum boundary | Same setup; top up the configured maximum amount | Commission is charged per the row's configuration | P2 |
| TU-CM28 | Account-level commission applied mid-range within the tier | Same setup; top up an amount midway between the configured minimum and maximum | Commission is charged per the row's configuration (skip if the range is too narrow for a distinct midpoint) | P3 |
| TU-CM30 | Account-level commission type flag matches the tier's configuration | Top up at the override row's minimum and maximum boundaries | Both boundaries reflect the same percentage-or-fixed flag, the same way TU-CM31 proves it for the Default row | P2 |

Automated in `BusinessTestCases/Topup/functional/TopupCommission.spec.ts`'s "Account-level live
schema validation" block. TU-CM24 is `test.skip()` — forcing the override from percentage to fixed
hits the identical percentage→fixed edit-commission defect TU-CM03 already confirmed live
(2026-09-27) for the Default row; see that test's own note.

### P. Wallet Payment QR — Wallet Balance Limits (EMI-659, EMI-1653, EMI-195)

Context: same Admin Portal wallet-balance mechanism as section G, applied to QR payment — the
**payer** must not drop below their minimum, and the **payee** (merchant/wallet being paid) must not
exceed their maximum.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| QR-WB01 | Payer QR payment within min-balance floor succeeds (Merchant, Low risk) | Admin sets a Low-risk Merchant min-balance floor. Payer completes a QR payment leaving their balance above the floor | Payment succeeds | P1 |
| QR-WB02 | Payer QR payment breaching min-balance floor is blocked (Merchant, Low risk) | Same setup; the payment would drop the payer below the floor | Payment is rejected before OTP with a clear message | P1 |
| QR-WB03 | Payee credit within max-balance ceiling succeeds (Biller, Low risk) | Admin sets a Low-risk Biller max-balance ceiling. Payer's QR payment leaves the payee's balance under the ceiling | Payment succeeds | P1 |
| QR-WB04 | Payee credit breaching max-balance ceiling is blocked (Biller, Low risk) | Same setup; the payment would push the payee over the ceiling | Payment is rejected | P1 |
| QR-WB05 | Payer QR payment within min-balance floor succeeds (Merchant, Medium risk) | Repeat QR-WB01 with the Medium-risk Merchant floor | Payment succeeds | P2 |
| QR-WB06 | Payer QR payment breaching min-balance floor is blocked (Merchant, Medium risk) | Repeat QR-WB02 with the Medium-risk Merchant floor | Payment is rejected | P2 |
| QR-WB07 | Payee credit within max-balance ceiling succeeds (Biller, Medium risk) | Repeat QR-WB03 with the Medium-risk Biller ceiling | Payment succeeds | P2 |
| QR-WB08 | Payee credit breaching max-balance ceiling is blocked (Biller, Medium risk) | Repeat QR-WB04 with the Medium-risk Biller ceiling | Payment is rejected | P2 |

### Q. Wallet Payment QR — Transaction Limits (EMI-87, EMI-1653, EMI-195)

Context: same Admin Portal mechanism as section H, applied to QR payment (Merchant Payment transaction
type) by Risk Level × Wallet Tier × Platform × Period.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| QR-TL01 | QR payments within the daily amount limit succeed (App) | Admin sets a daily cumulative-amount ceiling for QR payment on App. Payer completes QR payments totalling under the ceiling | Each payment completes normally | P1 |
| QR-TL02 | Cumulative QR payments exceeding the daily amount limit are blocked (App) | Same setup; next payment would exceed the day's ceiling | That payment is rejected | P1 |
| QR-TL03 | QR payments within the weekly amount limit succeed | Admin sets a weekly amount ceiling; payer pays within it | Each payment completes normally | P2 |
| QR-TL04 | Cumulative QR payments exceeding the weekly amount limit are blocked | Same setup; payment would exceed the weekly ceiling | Payment is rejected | P2 |
| QR-TL05 | QR payments within the monthly amount limit succeed (Web) | Admin sets a monthly amount ceiling on Web; payer pays within it | Each payment completes normally | P2 |
| QR-TL06 | Cumulative QR payments exceeding the monthly amount limit are blocked (Web) | Same setup; payment would exceed the monthly ceiling | Payment is rejected | P1 |
| QR-TL07 | QR payments within the daily count limit succeed | Admin sets a daily QR-payment count ceiling. Payer pays up to that count | Each payment within the count succeeds | P2 |
| QR-TL08 | QR payment once the daily count limit is exceeded is blocked | Same setup; payer attempts one more payment past the count ceiling | Payment is rejected | P1 |
| QR-TL09 | QR payments within the weekly count limit succeed | Admin sets a weekly count ceiling; payer pays up to that count | Each payment succeeds | P2 |
| QR-TL10 | QR payment once the weekly count limit is exceeded is blocked | Same setup; payer exceeds the weekly count | Payment is rejected | P2 |
| QR-TL11 | QR payments within the monthly count limit succeed | Admin sets a monthly count ceiling; payer pays up to that count | Each payment succeeds | P2 |
| QR-TL12 | QR payment once the monthly count limit is exceeded is blocked | Same setup; payer exceeds the monthly count | Payment is rejected | P2 |

### R. Wallet Payment QR — Commission (EMI-2031)

Context: same Admin Portal commission mechanism as section I, applied to QR payment. Commission is
added to the payer's debit and deducted from the payee's credit, consistent with EMI-590's own AC
("applicable commission fees applied automatically").

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| QR-CM01 | Default schema applies when no custom commission exists | Ensure no custom commission for the payer's account; complete a QR payment | Default commission schema applies | P2 |
| QR-CM02 | Custom per-account schema overrides the default | Admin configures a custom QR-payment commission for the payer's account; complete a payment | Custom commission applied instead of default | P2 |
| QR-CM03 | Fixed commission deducted on a standard QR payment | Admin configures a fixed-amount commission for QR payment; payer pays within its range | Commission reflected in payer's debit and payee's net credit | P1 |
| QR-CM04 | Fixed commission applied at minimum boundary | Same setup; QR amount equals the configured minimum | Fixed commission is deducted | P2 |
| QR-CM05 | Fixed commission applied at maximum boundary | Same setup; QR amount equals the configured maximum | Fixed commission is deducted | P2 |
| QR-CM06 | Fixed commission not applied below minimum | Same setup; QR amount below the configured minimum | No commission applied | P2 |
| QR-CM07 | Fixed commission not applied above maximum | Same setup; QR amount above the configured maximum | No commission applied | P2 |
| QR-CM08 | Percentage commission deducted on a standard QR payment | Admin configures a percentage commission; payer pays within its range | Commission reflects the correct percentage | P2 |
| QR-CM09 | Percentage commission applied at minimum boundary | Same setup; QR amount equals the configured minimum | Percentage commission is deducted | P2 |
| QR-CM10 | Percentage commission applied at maximum boundary | Same setup; QR amount equals the configured maximum | Percentage commission is deducted | P2 |
| QR-CM11 | Percentage commission not applied below minimum | Same setup; QR amount below the configured minimum | No commission applied | P2 |
| QR-CM12 | Percentage commission not applied above maximum | Same setup; QR amount above the configured maximum | No commission applied | P2 |
| QR-CM13 | Commission added on payer side / deducted on payee side | Complete a QR payment with an active commission configured | Payer's total debit = amount + commission; payee's credit = amount − commission | P1 |
| QR-CM14 | Overlapping commission rules rejected | Admin attempts a second overlapping commission rule for QR payment | Rejected with a clear error | P2 |
| QR-CM15 | Min amount cannot exceed max amount | Admin attempts to save a rule with Min > Max | Validation blocks save | P2 |
| QR-CM16 | Transaction type cannot be edited on an existing commission | Admin attempts to change the transaction type on an existing QR-payment commission rule | Field is read-only | P3 |
| QR-CM17 | Disabling a commission schema stops it applying | Admin disables the schema; payer completes a QR payment | No commission applied | P2 |
| QR-CM18 | Re-enabling a commission schema resumes applying it | Admin re-enables the schema; payer completes another QR payment | Commission applied again | P3 |

---

### S. Bill Beneficiary Management (EMI-185, epic EMI-2192)

Context: a Business admin user maintains a reusable address book of billers — add (Alias + CRN, with
a profile lookup that resolves the CRN to a brand name before saving, then an OTP step if required),
view/filter (by Alias, CR, and Status), edit, and delete. Reached from the homepage sidebar's "Manage
Beneficiary" link (`HomepageSidebarPage.manageBeneficiarySidebarLink`), which already existed and was
nav-smoke-tested, but the destination screen itself had no coverage before this section. Per
EMI-185's own AC: "Alias — no special characters, minimum length 3, maximum length 15."

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| BM-01 | Add a beneficiary with a valid alias and CRN | Open "Add Beneficiary"; enter a valid unique alias and an existing CRN; trigger the lookup | Profile lookup resolves and displays the CRN's brand name before save | P1 |
| BM-02 | Alias below minimum length rejected | Enter a 1–2 character alias | Validation error shown; save blocked | P2 |
| BM-03 | Alias above maximum length rejected | Enter a 16+ character alias | Validation error shown; save blocked | P2 |
| BM-04 | Alias with special characters rejected | Enter an alias containing symbols (e.g. `#`, `!`, `$`) | Validation error shown; save blocked | P2 |
| BM-05 | CRN lookup for a non-existent CRN | Enter an alias and a CRN that does not exist in the system | Lookup fails with a clear error; save blocked | P1 |
| BM-06 | OTP required completes the add flow | Add a beneficiary where OTP verification is required; enter a valid OTP | Beneficiary is added after OTP verification succeeds | P2 |
| BM-07 | Beneficiaries list shows Alias and CRN | Open the Beneficiary Management screen with existing beneficiaries | Each row displays its Alias and CRN | P1 |
| BM-08 | Filter list by Alias | Enter a known alias (or partial) into the Alias filter | List narrows to matching row(s) only | P2 |
| BM-09 | Filter list by CR | Enter a known CRN into the CR filter | List narrows to matching row(s) only | P2 |
| BM-10 | Filter list by Status | Select a status from the Status filter dropdown | List narrows to beneficiaries matching that status | P3 |
| BM-11 | Delete a beneficiary | Select Delete on an existing beneficiary; confirm | Beneficiary is removed from the list; success message shown | P1 |
| BM-12 | Edit a beneficiary's alias | Select Edit on an existing beneficiary; change the alias; save | Updated alias is reflected in the list | P2 |
| BM-13 | Duplicate alias rejected | Attempt to add a beneficiary using an alias already in use | Save is rejected with a clear "already exists" error | P2 |
| BM-14 | Submitting without Alias or CRN blocked | Open "Add Beneficiary"; leave both fields empty; attempt to save | Save is blocked with a required-field error | P1 |

---

### Automated coverage note

- **Pay Bill** — `BusinessTestCases/PayBill/functional/PayBillFlow.spec.ts` covers PB-05, PB-06, PB-07,
  PB-08 end to end against a live "Approved" received bill. PB-01–PB-04, PB-09–PB-12 (bill eligibility
  gating, retry-after-failure, success-screen navigation) need dedicated multi-status bill fixtures and
  are not yet automated — track manually until that test data exists.
- **Wallet-to-Wallet Transfer** — `BusinessTestCases/W2WTransfer/functional/W2WTransferFunctionality.spec.ts`
  covers WT-01 (CRN lookup), WT-03, WT-05 (purpose selection), WT-07 (implicitly via balance checks),
  WT-09–WT-11, WT-14–WT-18. WT-02 (QR-scan recipient selection), WT-04 (min/max limit), WT-06 (notes
  200-char limit), WT-08 (account/wallet-limitation block), WT-10 (incorrect-OTP path), WT-12–WT-13
  (commission/notification) are not yet automated.
- **Top Up** — `BusinessTestCases/Topup/functional/TopupFlow.spec.ts` covers TU-01–TU-05 (HyperPay card
  flow) in full, including failed/pending gateway simulation. TU-06–TU-14 (VIBAN bank-transfer top-up,
  SADAD bill top-up) have no automation yet — VIBAN requires real bank-integration polling and SADAD
  is a "To Do" story not yet built in UAT; see `docs/Automation_Test_Cases.md` once added.
- **Wallet Payment QR** — no automation exists yet. `pageElements/Shared/HomepageQuickActionsPage.ts`
  only smoke-tests that the "Generate a wallet QR" quick action opens *something* (dialog or navigation)
  in `BusinessTestCases/Homepage/functional/HomepageQuickActions.spec.ts` — it does not exercise QR-01
  through QR-17. Per `QA-DATA-TESTID-HANDOFF.md` §5, this screen has no `data-testid` coverage yet;
  request testids from FE before hardening this into a full suite.
- **Create Bill** — no automation exists yet (no prior page object for Bill Management/Add Bill in this
  repo, same testid gap as above).
- **Guest Flow** — `BusinessTestCases/PaymentLinks/` already has a **mock-only** suite
  (`PaymentLinkResolution.spec.ts`, `PaymentLinkPayerInfoRemoval.spec.ts`, `PaymentLinkBugs.spec.ts`,
  TC-PL-001–015) built for a different, earlier set of tickets (EMI-5463, EMI-5791–5794, EMI-5774/75/814).
  It is not registered in `docs/Automation_Test_Cases.md` yet. GF-01–GF-15 above target the *current*
  guest-flow tickets (EMI-5424/5446/5523/5551/5640/5653/5860) and are net-new — see the automation PR
  for `GuestWalletPayment.spec.ts`.
- **Wallet Balance Limits / Transaction Limits / Commission (sections G–R)** — all 152 cases have
  1:1 `test.skip()` stubs, exactly mirroring `BankTransferWalletLimits.spec.ts` /
  `BankTransferTransactionLimits.spec.ts` / `BankTransferCommission.spec.ts`'s pattern, pending the
  same class of Admin Portal automation helper (EMI-1653/EMI-195/EMI-87 for limits, EMI-2031 for
  commission) that EMI-180 is for Bank Transfer:
  - `BusinessTestCases/W2WTransfer/functional/W2WTransferWalletLimits.spec.ts` (WT-WB01–08)
  - `BusinessTestCases/W2WTransfer/functional/W2WTransferTransactionLimits.spec.ts` (WT-TL01–12)
  - `BusinessTestCases/W2WTransfer/functional/W2WTransferCommission.spec.ts` (WT-CM01–18)
  - `BusinessTestCases/PayBill/functional/PayBillWalletLimits.spec.ts` (PB-WB01–08)
  - `BusinessTestCases/PayBill/functional/PayBillTransactionLimits.spec.ts` (PB-TL01–12)
  - `BusinessTestCases/PayBill/functional/PayBillCommission.spec.ts` (PB-CM01–18)
  - `BusinessTestCases/Topup/functional/TopupWalletLimits.spec.ts` (TU-WB01–08)
  - `BusinessTestCases/Topup/functional/TopupTransactionLimits.spec.ts` (TU-TL01–12)
  - `BusinessTestCases/Topup/functional/TopupCommission.spec.ts` — **deviates from the 1:1-stub
    pattern above.** TU-CM01–18 (the generic single-schema cases) carry no stub here; only
    TU-CM19–32 are implemented, against the account's *live* 3-tier Merchant Cashin Web schema
    (Tier A/B/C — see section O) rather than a synthetic per-test schema. The admin portal is
    opened exactly twice for the whole file (verify+snapshot in `beforeAll`, restore in
    `afterAll`) — no test edits the schema, so TU-CM01–18's old per-test
    `setTopupCommission(...)` pattern was removed rather than extended. TU-CM02 and TU-CM24–28/30
    (account-level override validation — see this section's own subsection above) are also
    implemented, against a per-account commission row rather than the platform-wide Default one;
    TU-CM24 is `test.skip()` for the same confirmed percentage→fixed edit defect as TU-CM03. See
    `TopupCommission.spec.ts` itself for which other individual cases remain `test.skip()`.
  - `BusinessTestCases/QRPayment/functional/QRPaymentWalletLimits.spec.ts` (QR-WB01–08)
  - `BusinessTestCases/QRPayment/functional/QRPaymentTransactionLimits.spec.ts` (QR-TL01–12)
  - `BusinessTestCases/QRPayment/functional/QRPaymentCommission.spec.ts` (QR-CM01–18)

  Remove each file's `test.skip()` once an Admin Portal automation helper exists for the corresponding
  Manage Limits / Commission Management screen.
- **Bill Beneficiary Management (section S)** — `BusinessTestCases/BeneficiaryManagement/functional/
  BeneficiaryManagementFlow.spec.ts` automates BM-02–BM-05, BM-07, BM-08, BM-10, BM-11, BM-12, BM-14
  directly. BM-01, BM-06, BM-09, BM-13 additionally `test.skip()` at runtime unless a
  `BENEFICIARY_KNOWN_CRN` env var is set to a real fixture CRN that resolves via the profile-lookup
  API (no such fixture account/CRN exists yet in this repo's data sets). Per
  `QA-DATA-TESTID-HANDOFF.md` §5, this screen has no `data-testid` coverage — see
  `BeneficiaryManagementPage.ts` for the locator caveat.

---

<!-- source: BankTransfer.md -->
## BankTransfer

## Manual Test Cases — Bank Transfer (Cashout)

Context: the Bank Transfer ("Cashout") flow lets a logged-in Business user send funds from their wallet to their registered Saudi IBAN. The flow is a three-step wizard — **Amount → Confirmation → OTP** — reached from the homepage Quick Actions "Cashout" card. The Confirmation step computes a commission and VAT (15% of commission) against the entered amount before showing a final total; the OTP step re-confirms the masked IBAN and total before submitting. Several business rules (wallet-balance limits, hourly/daily/monthly/yearly transaction limits, fixed/percentage commission tiers, and the Merchant OTP-requirement toggle) are configured in the Admin Portal (EMI-180) and are documented here as manual cases even though their Playwright counterparts are currently `test.skip()`-ed pending an Admin Portal automation helper.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Amount Entry

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| BT-01 | Cashout page title and subtitle | Open Cashout from the homepage Quick Actions card | Page heading reads "Cashout" and subtitle reads "Send funds to a Saudi IBAN" (or equivalent) | P3 |
| BT-02 | Current balance shown | Land on the Amount step | "Current Balance" label is shown with a numeric balance amount | P2 |
| BT-03 | Wallet code shown | Land on the Amount step | Wallet code is displayed alongside the balance | P3 |
| BT-04 | Balance card actions shown | Land on the Amount step | Topup, QR-code, and wallet-settings buttons are all visible on the balance card | P3 |
| BT-05 | IBAN card details shown | Land on the Amount step | IBAN label, a masked IBAN (format `SA##**####`), the bank name, and a verified checkmark are all displayed | P2 |
| BT-06 | Amount section header | Land on the Amount step | Section shows step badge "2", title "Amount", and a description to enter the amount to transfer | P3 |
| BT-07 | Amount field label and currency icon | Land on the Amount step | "Set Amount You Want Transfer" label and a currency icon are shown in/near the input | P3 |
| BT-08 | Amount field placeholder | Land on the Amount step, amount field empty | Field shows placeholder text "0.00" | P3 |
| BT-09 | "Use full balance" toggle shown | Land on the Amount step | Toggle control and its "Use full balance" label are visible | P3 |
| BT-10 | Proceed disabled while amount empty | Land on the Amount step, leave amount field empty | Proceed button is disabled | P1 |
| BT-11 | Preset amount chips shown | Land on the Amount step | "Or select amount" label is shown; exactly 5 preset chips are present reading 500, 1000, 2000, 5000, 10000 | P2 |
| BT-12 | Proceed button appearance | Land on the Amount step | Proceed button is visible, labeled "Proceed", with an arrow icon | P3 |
| BT-13 | Amount with 2 decimal places accepted | Enter an amount such as `15.75` | Value is accepted as-is; Proceed becomes enabled | P1 |
| BT-14 | Amount with 1 decimal place accepted | Enter an amount such as `20.5` | Value is accepted as-is; Proceed becomes enabled | P2 |
| BT-15 | Pasted valid amount accepted | Paste `50.00` into the amount field (e.g. via clipboard paste) | Field shows `50.00`; Proceed becomes enabled | P2 |
| BT-16 | Select a preset amount | Tap any preset chip at or below the current balance | Chip is selected; Proceed becomes enabled | P2 |
| BT-17 | Editing amount overrides preset selection | Select a preset chip, then type a different amount (e.g. `123`) into the field | Field now shows the manually typed value, overriding the preset | P2 |
| BT-18 | "Use full balance" fills and locks the field | Toggle "Use full balance" on | Field auto-fills with the current balance (up to 4 decimal places) and becomes read-only, blocking manual edits | P2 |

---

### B. Confirmation Summary & Commission Calculation

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| BT-19 | Original Amount matches entry | Enter an amount (e.g. `10`) and proceed to Confirmation | "Original Amount" row on the summary equals the amount entered | P1 |
| BT-20 | Transaction Type / Bank / IBAN rows correct | Proceed to Confirmation | "Transaction Type" reads "Cashout"; "Bank" and "IBAN" match the bank/IBAN shown on the Amount step's IBAN card | P1 |
| BT-21 | VAT computed as 15% of commission | Proceed to Confirmation and let the summary settle | "VAT" row equals commission × 15% | P1 |
| BT-22 | Total amount computed correctly | Proceed to Confirmation and let the summary settle | "Total amount to be sent" equals Original Amount − commission − VAT | P1 |
| BT-23 | Confirmation heading and subtitle | Proceed to Confirmation | Heading reads "Confirmation"; subtitle references sending funds to a Saudi IBAN | P3 |
| BT-24 | Fixed commission deducted (standard transfer) | Admin configures a fixed-amount commission tier; transfer an amount within its applicable range | Confirmation summary reflects the deducted fixed commission; biller/admin wallet deltas match | P2 |
| BT-25 | Fixed commission deducted at minimum boundary | Same admin setup; transfer an amount equal to the tier's configured minimum | Fixed commission is deducted | P2 |
| BT-26 | Fixed commission deducted at maximum boundary | Same admin setup; transfer an amount equal to the tier's configured maximum | Fixed commission is deducted | P2 |
| BT-27 | Fixed commission not deducted below minimum | Same admin setup; transfer an amount below the configured minimum | Fixed commission is not applied | P2 |
| BT-28 | Fixed commission not deducted above maximum | Same admin setup; transfer an amount above the configured maximum | Fixed commission is not applied | P2 |
| BT-29 | Percentage commission deducted (standard transfer) | Admin configures a percentage commission tier; transfer an amount within its range | Confirmation summary reflects the percentage-based commission | P2 |
| BT-30 | Percentage commission deducted at minimum boundary | Same admin setup; transfer an amount equal to the tier's configured minimum | Percentage commission is deducted | P2 |
| BT-31 | Percentage commission deducted at maximum boundary | Same admin setup; transfer an amount equal to the tier's configured maximum | Percentage commission is deducted | P2 |
| BT-32 | Percentage commission not deducted below minimum | Same admin setup; transfer an amount below the configured minimum | Percentage commission is not applied | P2 |
| BT-33 | Percentage commission not deducted above maximum | Same admin setup; transfer an amount above the configured maximum | Percentage commission is not applied | P2 |

---

### C. OTP Verification & Requirement

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| BT-34 | OTP boxes and countdown shown | Proceed through Amount → Confirmation → Next | Six OTP input boxes are displayed, along with a countdown timer that visibly ticks down | P2 |
| BT-35 | OTP step heading, resend, and Verify button | Reach the OTP step | Heading reads "Confirmation", subtitle references a code having been sent, a resend link and a Verify button are both visible | P3 |
| BT-36 | Masked IBAN and total carry over unchanged | Note the masked IBAN and Total shown on Confirmation, then proceed to OTP | OTP step's recap shows the identical masked IBAN and the same total (within rounding) as Confirmation | P1 |
| BT-37 | Correct OTP completes a standard transfer | Enter a custom amount (e.g. `10.00`), proceed to Confirmation and OTP, submit the correct OTP | Success modal appears; wallet balance is debited by exactly the entered amount | P1 |
| BT-38 | Correct OTP completes a preset-amount transfer | Select a preset amount within balance, complete Confirmation and OTP with the correct code | Success modal appears; balance is debited by exactly the preset amount selected | P1 |
| BT-39 | Correct OTP completes a 2-decimal transfer | Enter an amount like `15.75`, complete the flow with the correct OTP | Transfer succeeds; balance debited matches the entered amount exactly | P2 |
| BT-40 | Correct OTP completes a 1-decimal transfer | Enter an amount like `20.5`, complete the flow with the correct OTP | Transfer succeeds; balance debited matches the entered amount exactly | P2 |
| BT-41 | OTP prompted when Merchant OTP requirement is active | Admin: Configuration Settings → Transaction → activate OTP requirement. Merchant: transfer a valid amount and Proceed | OTP modal appears; transfer only processes after successful OTP verification | P2 |
| BT-42 | OTP skipped when Merchant OTP requirement is inactive | Admin: Configuration Settings → Transaction → deactivate OTP requirement. Merchant: transfer a valid amount and Proceed | Transfer processes immediately with no OTP modal shown | P2 |

---

### D. Session Handling & Cancellation

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| BT-43 | Refresh mid-flow discards the transfer | Enter an amount, proceed to Confirmation, then refresh the page | User is returned to a fresh Amount step; wallet balance is unchanged; no transfer is recorded | P1 |
| BT-44 | Cancel on Confirmation returns to Amount step | Enter an amount, proceed to Confirmation, let the summary settle, tap Cancel | User returns to the Amount step; balance remains unchanged | P1 |
| BT-45 | Cancel at OTP step returns home | Enter an amount, proceed through Confirmation to OTP, tap Cancel on the OTP modal, navigate home | User lands on the homepage; balance remains unchanged (no transfer occurred) | P1 |

---

### E. Wallet Balance Limits (Admin-configured, EMI-180)

Context: Admin Portal → Manage Limits → Wallet Balance lets an admin cap the wallet balance a Biller may hold/transfer per risk level. These cases require an Admin Portal setup step per risk level before execution.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| BT-46 | Transfer within wallet limit succeeds (risk level 1) | Admin sets a wallet-balance ceiling for a risk level and saves. Biller enters an amount under the ceiling and proceeds | Transfer succeeds; balance is debited, admin wallet credited, and the running-balance popup shows Wallet reference, Amount, Balance Before/After, Debit/Credit, and Created date | P1 |
| BT-47 | Transfer exceeding wallet limit is blocked (risk level 1) | Same admin setup as BT-46; Biller enters an amount over the ceiling and proceeds | Transfer is rejected before reaching OTP/summary, rather than silently succeeding | P1 |
| BT-48 | Transfer within wallet limit succeeds (risk level 2) | Repeat BT-46 with the second configured risk-level ceiling | Transfer succeeds as expected | P2 |
| BT-49 | Transfer exceeding wallet limit is blocked (risk level 2) | Repeat BT-47 with the second configured risk-level ceiling | Transfer is rejected | P2 |
| BT-50 | Transfer within wallet limit succeeds (risk level 3) | Repeat BT-46 with the third configured risk-level ceiling | Transfer succeeds as expected | P2 |
| BT-51 | Transfer exceeding wallet limit is blocked (risk level 3) | Repeat BT-47 with the third configured risk-level ceiling | Transfer is rejected | P2 |
| BT-52 | Transfer within wallet limit succeeds (risk level 4) | Repeat BT-46 with the fourth configured risk-level ceiling | Transfer succeeds as expected | P2 |
| BT-53 | Transfer exceeding wallet limit is blocked (risk level 4) | Repeat BT-47 with the fourth configured risk-level ceiling | Transfer is rejected | P2 |
| BT-54 | Transfer within wallet limit succeeds (repeat scenario A) | Repeat BT-46 as a regression pass | Transfer succeeds as expected | P3 |
| BT-55 | Transfer exceeding wallet limit is blocked (repeat scenario A) | Repeat BT-47 as a regression pass | Transfer is rejected | P3 |
| BT-56 | Transfer within wallet limit succeeds (repeat scenario B) | Repeat BT-46 as a second regression pass | Transfer succeeds as expected | P3 |
| BT-57 | Transfer exceeding wallet limit is blocked (repeat scenario B) | Repeat BT-47 as a second regression pass | Transfer is rejected | P3 |

---

### F. Transaction Limits — Hourly / Daily / Monthly / Yearly (Admin-configured, EMI-180)

Context: Admin Portal → Manage Limits → Transaction lets an admin cap cash-out activity both by cumulative amount and by transaction count, over hourly/daily/monthly/yearly windows.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| BT-58 | Transfer within hourly amount limit succeeds | Admin sets an hourly amount ceiling and saves. Biller transfers an amount within that ceiling | Standard success flow completes | P1 |
| BT-59 | Transfer below configured hourly amount limit is rejected | Same setup; Biller attempts a transfer amount outside the allowed hourly range on the low side | Validation message tells the Biller the amount falls outside the allowed range | P2 |
| BT-60 | Transfer exceeding hourly amount limit is blocked | Same setup; Biller attempts to transfer over the hourly ceiling | Validation message informs the Biller the hourly limit was exceeded; transfer blocked | P1 |
| BT-61 | Transfer within daily amount limit succeeds | Admin sets a daily amount ceiling; Biller transfers within it | Standard success flow completes | P2 |
| BT-62 | Transfer exceeding daily amount limit is blocked | Same setup; Biller transfers over the daily ceiling | Transfer is blocked with a clear message | P1 |
| BT-63 | Transfer within monthly amount limit succeeds | Admin sets a monthly amount ceiling; Biller transfers within it | Standard success flow completes | P2 |
| BT-64 | Transfer exceeding monthly amount limit is blocked | Same setup; Biller transfers over the monthly ceiling | Transfer is blocked with a clear message | P1 |
| BT-65 | Transfer within yearly amount limit succeeds | Admin sets a yearly amount ceiling; Biller transfers within it | Standard success flow completes | P2 |
| BT-66 | Transfer exceeding yearly amount limit is blocked | Same setup; Biller transfers over the yearly ceiling | Transfer is blocked with a clear message | P1 |
| BT-67 | Transfers within hourly transaction-count limit succeed | Admin sets an hourly transaction-count ceiling and saves. Biller makes transfers up to that count | Each transfer within the count succeeds | P2 |
| BT-68 | Transfer below configured hourly count limit shows Payment Failed | Same setup; force a transfer attempt outside the expected count range on the low side | "Payment Failed" message is displayed to the Biller | P2 |
| BT-69 | Transfer once hourly count limit is exceeded is blocked | Same setup; Biller exceeds the hourly transaction count | "Payment Failed" message is displayed; transfer blocked | P1 |
| BT-70 | Transfers within daily transaction-count limit succeed | Admin sets a daily count ceiling; Biller transfers up to that count | Each transfer succeeds | P2 |
| BT-71 | Transfer once daily count limit is exceeded is blocked | Same setup; Biller exceeds the daily count | Transfer blocked with a clear message | P1 |
| BT-72 | Transfers within monthly transaction-count limit succeed | Admin sets a monthly count ceiling; Biller transfers up to that count | Each transfer succeeds | P2 |
| BT-73 | Transfer once monthly count limit is exceeded is blocked | Same setup; Biller exceeds the monthly count | Transfer blocked with a clear message | P1 |
| BT-74 | Transfers within yearly transaction-count limit succeed | Admin sets a yearly count ceiling; Biller transfers up to that count | Each transfer succeeds | P2 |
| BT-75 | Transfer once yearly count limit is exceeded is blocked | Same setup; Biller exceeds the yearly count | Transfer blocked with a clear message | P1 |

---

### G. Negative & Edge Cases

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| BT-76 | Negative amount is rejected | Type `-10.00` into the amount field | Field does not accept the negative sign/value as entered; Proceed remains disabled if the field ends up empty/zero | P1 |
| BT-77 | Zero is rejected as a transfer amount | Type `0` into the amount field | Field rejects the value as a valid transfer amount; Proceed remains disabled | P1 |
| BT-78 | Alphabetic characters and symbols are rejected | Type `abc!@#` into the amount field | Field does not accept non-numeric characters; Proceed remains disabled | P1 |
| BT-79 | 3-decimal-place amount is rejected or truncated | Type `10.555` into the amount field | Field either rejects the third decimal or truncates to 2 decimal places — the raw 3-decimal string is never accepted verbatim | P2 |
| BT-80 | Pasted invalid amount is rejected | Paste `abc` into the amount field | Field remains empty; Proceed stays disabled | P2 |
| BT-81 | Insufficient funds blocks the transfer | Enter an amount greater than the current wallet balance and tap Proceed | An insufficient-funds toast/message is displayed; the transfer does not proceed | P1 |
| BT-82 | Incorrect OTP fails the transaction | Enter a valid amount, proceed to OTP, submit an incorrect code (e.g. `9999`), then cancel out | Transaction is not completed; the transactions list shows the attempt with status FAILED | P1 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for Bank Transfer. Corresponding automated specs (relative to repo root):

- `BusinessTestCases/BankTransfer/functional/BankTransferHappyPath.spec.ts` — end-to-end successful transfers, decimal handling, preset amounts, commission/VAT/total math (BT-13, BT-14, BT-19–BT-22, BT-37–BT-40)
- `BusinessTestCases/BankTransfer/functional/BankTransferNegative.spec.ts` — invalid-input rejection, insufficient funds, incorrect OTP (BT-76–BT-82)
- `BusinessTestCases/BankTransfer/functional/BankTransferEdgeCases.spec.ts` — preset-override-by-edit and full-balance precision/lock behavior (BT-17, BT-18)
- `BusinessTestCases/BankTransfer/functional/BankTransferSession.spec.ts` — refresh/cancel abandonment and cross-step IBAN/total persistence (BT-36, BT-43–BT-45)
- `BusinessTestCases/BankTransfer/functional/BankTransferWalletLimits.spec.ts` — wallet-balance limit enforcement (BT-46–BT-57); currently `test.skip()`-ed pending an Admin Portal "Manage Limits → Wallet Balance" automation helper (EMI-180) — execute manually until then
- `BusinessTestCases/BankTransfer/functional/BankTransferTransactionLimits.spec.ts` — hourly/daily/monthly/yearly amount- and count-based transaction limits (BT-58–BT-75); currently `test.skip()`-ed pending an Admin Portal "Manage Limits → Transaction" automation helper (EMI-180) — execute manually until then
- `BusinessTestCases/BankTransfer/functional/BankTransferCommission.spec.ts` — fixed and percentage commission tiers and min/max boundaries (BT-24–BT-33); currently `test.skip()`-ed pending an Admin Portal "Commission Management" automation helper (EMI-180) — execute manually until then
- `BusinessTestCases/BankTransfer/functional/BankTransferOtpRequirement.spec.ts` — Merchant OTP-requirement toggle (BT-41, BT-42); currently `test.skip()`-ed pending an Admin Portal "Configuration Settings → Transaction OTP toggle" automation helper (EMI-180) — execute manually until then
- `BusinessTestCases/BankTransfer/ui/BankTransferAmountPage.spec.ts` — Amount step element presence (BT-01–BT-12)
- `BusinessTestCases/BankTransfer/ui/BankTransferConfirmationPage.spec.ts` — Confirmation summary element presence (BT-20, BT-23)
- `BusinessTestCases/BankTransfer/ui/BankTransferOtpPage.spec.ts` — OTP step element presence (BT-34, BT-35)

---

<!-- source: Bill-Items.md -->
## Bill-Items

## Manual Test Cases — Detailed Bill Line Items

Context: a **Detailed Bill** is a bill whose amount is derived from one or more **line items** rather than typed directly. Each item has a name, quantity, unit price, an optional item-level discount (Fixed / Percentage / No Discount) and an optional VAT. Items can be typed manually or pulled in from a saved **product**. Creating a detailed bill is a multi-step wizard — **Bill Info → Add Items → Item Info (review) → Confirm** — and every item change fires a `POST /bills/calculate` call that recomputes the bill summary (discount, VAT, commission, grand total). Items can also be added, edited and deleted while **editing an existing bill**.

This file was built from the bill-item ticket history in Jira (project **EMI**, `digitalcash.atlassian.net`). It covers **web only** — the equivalent iOS and Android item tickets (EMI-4249, EMI-4250, EMI-3244/3245, EMI-1684/1685/1687/1688, EMI-3536/3537, EMI-3581, EMI-3584, EMI-4345, EMI-5037, …) are out of scope for this Playwright suite.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

Automation: `BusinessTestCases/BillManagement/functional/BillItems.spec.ts` (BI-01..BI-20) and `BusinessTestCases/BillManagement/ui/BillItems.spec.ts` (BI-U01..BI-U04), driven by `pageElements/BillManagement/BillItemsPage.ts`.

> **Locator caveat** — these screens are not in `QA-DATA-TESTID-HANDOFF.md` §4, so every locator in `BillItemsPage.ts` is a best-effort guess derived from the ticket wording, the same caveat that already applies to `CreateBillPage.ts` and `BillsListPage.ts`. Reconcile against the live DOM (or request `data-testid`s from FE) before using these for CI gating.

> **Open question — EMI-4121 (still `To Do`)** — the product currently applies an item discount to the **unit price** before multiplying by quantity: `total = (unitPrice − discount) × quantity`. EMI-4121 asks whether the KSA market instead expects the discount applied *after* the line total. BI-03 and BI-11 encode the current behaviour via `expectedItemTotal()` in `BillManagementHelper.ts`; if that inquiry resolves the other way, that one function plus these two cases are the only things that need updating.

---

### A. "A Detailed Bill Must Have Items"

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| BI-01 | Cannot create a detailed bill with zero items | Create Detailed Bill → add 2 items → delete both → Submit | Submit is blocked with a validation error, e.g. "At least one item is required to create a detailed bill." No bill is created | P1 | EMI-4069 |
| BI-02 | Cannot save an edited detailed bill with zero items | Bills → open an existing detailed bill → Edit → delete all items → Submit | Same validation error; the bill is not saved item-less | P1 | EMI-4179 |

---

### B. Item Calculation

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| BI-03 | Fixed item discount uses the unit-price formula | Add item: quantity `5`, unit price `10`, discount type Fixed, discount `10` | Item total is **0** — `(10 − 10) × 5`. (The bug showed `40`) | P1 | EMI-4123 |
| BI-04 | `/bills/calculate` returns a real net for FIXED items | Add item: quantity `2`, unit price `100`, Fixed discount `20`; inspect the `POST /bills/calculate` response | Every item with `discountTypeCode = FIXED` and a non-zero discount returns `netAmountAfterDiscount > 0` (here 160), never `0` | P1 | EMI-5030 |
| BI-05 | Editing an item does not 500 the calculate API | Add an item, then edit its discount | No `POST /bills/calculate` call returns a 5xx; the summary recalculates | P1 | EMI-4071 |
| BI-06 | More than two items all count toward the total | Add 3 items each unit price `10`, quantity `5`; go to Item Info | Grand total is **150** — the sum of all three items, not a subset | P1 | EMI-2952 |

---

### C. Discount Behaviour

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| BI-07 | Editing an item discount refreshes the total immediately | Add item (qty 2 × 100) → Item Info → note total → Back → edit the item's discount to Fixed 10 → Item Info | Total bill amount updates immediately. (The bug required navigating back and forward again) | P1 | EMI-3965 |
| BI-08 | Fixed discount larger than the item amount is flagged inline | Add item form: quantity `1`, unit price `100`, Fixed discount `150`, then blur the field | Validation message appears immediately under the item amount, before saving the item — matching single-bill behaviour. (The bug only surfaced it after moving forward to create the bill) | P2 | EMI-3961 |
| BI-09 | Bill-level Fixed discount cannot exceed the bill total | Add one item worth `50`; set the bill-level discount to Fixed `500`; Submit | Submit is rejected with a validation message; no confirmation summary appears | P2 | EMI-3323 |
| BI-10 | "No Discount" persists when reopening an item | Add an item with discount type "No Discount"; reopen it via the edit icon | Discount Type shows **"No Discount"**, not an empty field | P2 | EMI-3383 |
| BI-11 | Item-level and bill-level discount types can differ | Add an item (qty 2 × 100) with a **Percentage** 10% item discount; set a **Fixed** 20 bill-level discount; go to Item Info | Item total is 180; grand total is 160. No conflict, no incorrect or inconsistent calculation | P1 | EMI-5319 |

---

### D. VAT on Items

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| BI-12 | VAT is optional in the edit-item form | Add an item with VAT `15`; reopen it for edit; clear the VAT field and blur | No "VAT is required" message; the item can still be saved — VAT is optional on edit exactly as it is on add | P2 | EMI-3957 |

---

### E. Deleting Items

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| BI-13 | Deleting the last item asks for confirmation, then deletes | Add exactly one item; click its delete icon; confirm | Confirmation dialog appears ("This is the last item in the bill. Deleting it will also delete the bill. Do you want to proceed?"); confirming removes the item | P1 | EMI-1988, EMI-2590 |
| BI-14 | Cancelling the last-item dialog keeps the item | As BI-13 but cancel the dialog | No action is taken; the item remains in the bill | P2 | EMI-1988 |
| BI-15 | "Delete All" genuinely empties the list | Add 3 items; click "Delete All"; confirm if prompted | All rows disappear and the empty state shows. (The bug showed a success message while the rows stayed on screen) | P1 | EMI-2100 |
| BI-16 | Deleting an item updates the bill amount | Add items worth `100` and `60`; note the total; delete the `60` item | The delete succeeds without error and the total drops to **100** | P1 | EMI-3282 |
| BI-17 | Removing an item recalculates VAT and commission | Add two items with VAT; note VAT + commission on Item Info; go Back, remove one item, return | VAT and commission both decrease — they no longer include the removed item | P1 | EMI-2298 |

---

### F. Editing an Existing Bill's Items

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| BI-18 | New item added during edit calculates and preserves siblings | Bills → open a detailed bill → Edit → Add Item (qty 2 × 35) → Save | The new item's total shows **70** (not 0); all pre-existing items remain listed and the payment summary reflects the complete bill, not just the new item | P1 | EMI-3305 |
| BI-19 | Create a detailed bill mixing a product and a manual item | Create Detailed Bill → add a saved product as an item → add a manual item → Submit | The bill is created successfully with both entries | P1 | EMI-3118 |
| BI-20 | Update a detailed bill mixing a product and a manual item | Open an existing detailed bill → Edit → add a saved product and a manual item → Submit | The bill updates successfully with no error | P1 | EMI-3119, EMI-1679 |

---

### G. UI Presence Checks

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| BI-U01 | Item rows expose edit and delete icons | Add 2 items; advance to Step 3 "Item Info" | Every item row has both a delete and an edit icon, per Figma | P2 | EMI-3631 |
| BI-U02 | Item Info step has a Back button | Advance to Step 3 "Item Info" | A Back button is visible and returns to the "Add Items" step | P2 | EMI-3631 |
| BI-U03 | Item tables scroll vertically | Add 8 items; inspect the table in Step 2 "Add Items" and Step 3 "Item Info" | Both tables scroll vertically instead of overflowing the page, per Figma | P3 | EMI-3630 |
| BI-U04 | Discount Amount is displayed in summary and item details | Bills → "View More" on a detailed bill → check the overall summary → open an item's "View More" | Discount Amount is shown in **both** the overall bill summary and the individual bill item details | P2 | EMI-3270 |

---

### Not automated / out of scope

| Ticket | Why not automated here |
|---|---|
| EMI-4121 | Open **Inquiry**, not a defect — asks whether KSA applies item discount before or after the line total. Documented as a note above; blocks nothing today |
| EMI-4991 | Backend subtask ("Get Bill by ID must map bill items correctly"). Exercised indirectly by BI-18 / BI-02 (reopening a bill shows its items); a dedicated API assertion needs a bill-service token this suite does not yet hold |
| EMI-3060 | "Add item from a created product" is already covered by **CB-09** in `CreateBillFlow.spec.ts` |
| EMI-5809, EMI-5812, EMI-5863 | Already covered by **DBE-01, DBE-03, DBE-04** in `DetailedBillEditing.spec.ts` |
| iOS / Android item tickets | Different platform — no Playwright web equivalent |

---

<!-- source: EMI-5782-5783-PoS-Products-Web.md -->
## EMI-5782-5783-PoS-Products-Web

## Manual Test Cases — PoS Products (Web)

Web parity version of [EMI-5782-5783-PoS-Products.md](EMI-5782-5783-PoS-Products.md) — same scenarios and steps as the iOS cases, translated to the web business portal (click instead of tap, browser navigation instead of the iOS "More" menu / simulator gestures). Test IDs are prefixed `W` and map 1:1 to their iOS counterpart (e.g. `WPS-01` ↔ `PS-01`) for parity tracking.

**Status caveat:** EMI-5783 and EMI-5782 are filed as **FE - iOS**. As of this writing, neither the inline PoS expand/Skip/Request-now sub-flow (registration Products step) nor the Products/PoS management screens (Dashboard/Orders/Devices, Add Products) have been confirmed to exist on the web portal — the web Products step currently shows plain selectable product cards with no PoS-specific behavior, and `/products-management` (reached via the "Manage Products" sidebar link, which does exist today) has no verified PoS content. Treat every case below as **pending until the corresponding web feature ships**; run them as regression/acceptance checks once it does. Corresponding draft Playwright UI specs exist in [`RegistrationProductsPage.spec.ts`](../../BusinessTestCases/Registration/ui/RegistrationProductsPage.spec.ts) and [`ProductsManagementPage.spec.ts`](../../BusinessTestCases/products/ui/ProductsManagementPage.spec.ts) — they self-skip with a clear reason until the relevant elements appear.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### EMI-5783 (web) — Onboarding PoS Request Flow

Context: during web registration, on the Products step, selecting the PoS Terminals card is expected to expand inline and offer "Request devices now" or "Skip - set up later".

#### A. Products step — PoS card

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPS-01 | Wallet shown as required | Fill Business Info (بيانات النشاط التجاري — profile type, CRN, National ID, email) and continue to reach the registration Products step in a browser | Wallet is shown and cannot be deselected (required product) | P1 |
| WPS-02 | PoS Terminals shown as optional | Fill Business Info (بيانات النشاط التجاري) and continue to reach the Products step | PoS Terminals, Bill Payment, Payouts are shown as optional, deselectable | P2 |
| WPS-03 | Selecting PoS Terminals expands inline | Click the PoS Terminals card | The card expands in place on the same page; no full navigation/URL change occurs | P1 |
| WPS-04 | Expanded card shows both choices | Expand the PoS Terminals card | "Request devices now" and "Skip - set up later" are both visible | P1 |
| WPS-05 | Collapsing without choosing | Expand the card, then click it again without picking an option | Card collapses; selection state (Wallet/PoS enabled) is unaffected — confirm actual behavior matches design intent | P3 |

#### B. Skip path

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPS-06 | Skip keeps PoS enabled | Expand PoS card → click "Skip - set up later" | PoS remains selected/enabled on the Products step | P1 |
| WPS-07 | Skip shows setup-later message | Same as WPS-06 | An inline message communicates setup was skipped and can be done later | P2 |
| WPS-08 | "Actually, request now" reopens flow | After skipping, click "Actually, request now" | The Devices & Delivery sub-flow opens from the expanded card | P1 |

#### C. Request-now path — Devices & Delivery

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPS-09 | Devices & Delivery fields present | Click "Request devices now" | Number-of-devices input, delivery-mode toggle, and address selection are all visible | P1 |
| WPS-10 | Delivery mode toggle switches views | Toggle delivery mode | UI updates accordingly (e.g. single address vs. split delivery groups) | P1 |
| WPS-11 | Select National Wathiq address | Choose the National Wathiq address option | Address is populated/selected from Wathiq data | P1 |
| WPS-12 | Select Custom Pin address | Choose Custom Pin, click a location on the map widget | Custom coordinates are captured and reflected in the form | P1 |
| WPS-13 | Add a delivery/location group | With split delivery enabled, add a location group | A new group row appears, independently configurable | P2 |
| WPS-14 | Remove a delivery/location group | Remove a previously added group | Group is removed; remaining groups/totals adjust correctly | P2 |
| WPS-15 | Cannot proceed with missing required fields | Leave device count or address empty, try to continue | Continue/Next is disabled or a validation error is shown | P1 |
| WPS-16 | No wallet picker shown | Walk through the entire Devices & Delivery step | No wallet-selection UI appears anywhere in this sub-flow | P2 |
| WPS-17 | Zero devices blocked | Enter 0 for device count | Validation blocks proceeding | P2 |
| WPS-18 | Very large device count | Enter an unrealistically large device count (e.g. 99999) | Either a sane max is enforced with a clear message, or the value is otherwise handled without crashing | P3 |
| WPS-19 | Split quantities reconcile with total | With multiple delivery groups, assign per-group device counts | Sum of per-group quantities matches (or is validated against) the total device count | P2 |
| WPS-19b | Keyboard-only completion | Complete the entire Devices & Delivery step using only Tab/Enter, no mouse | All fields and controls are reachable and operable via keyboard | P3 |

#### D. Review step

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPS-20 | Review shows total device count | Complete Devices & Delivery, proceed to Review | Total device count matches what was entered | P1 |
| WPS-21 | Review shows delivery breakdown | Same as WPS-20, with multiple groups | Each group's device count and address/location are listed | P1 |
| WPS-22 | Address type correctly labeled | Review with a Wathiq group and a Custom Pin group | Each group is labeled with its correct address source | P2 |
| WPS-23 | Order-creation note shown | Reach Review | Text confirms the order will be created once onboarding is completed (not immediately) | P2 |
| WPS-24 | Back from Review edits prior step | Click Back from Review | Returns to Devices & Delivery with previously entered values intact | P1 |
| WPS-25 | Confirming returns to Products step | Confirm on Review | User lands back on the registration Products step | P1 |

#### E. Post-confirmation Products step state

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPS-26 | Inline order-ready state | Confirm a device order | Products step shows device count, delivery summary, Edit, and Remove inline on the PoS card | P1 |
| WPS-27 | Edit reopens with prior values | Click Edit on the order-ready state | Devices & Delivery / Review reopen pre-filled with the previous selections | P1 |
| WPS-28 | Remove clears the order | Click Remove on the order-ready state | Order state clears; card reverts to pre-order (or skipped) state | P1 |
| WPS-29 | Continue after confirming | Confirm a device order, then continue registration | Registration proceeds normally to the next step (NAFATH) | P1 |
| WPS-30 | Continue after skipping | Skip PoS setup, then continue registration | Registration proceeds normally without a device order | P1 |

#### F. Registration completion

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPS-31 | Order created on completion (confirmed path) | Confirm a device order, finish registration | Order appears under Manage Products > PoS > Orders after registration completes | P1 |
| WPS-32 | No order created (skipped path) | Skip PoS setup, finish registration | No order is created; a "request later" message/entry point is shown | P1 |
| WPS-33 | Double-submit prevention | Rapidly double-click the Review confirm button | Only one order is created; second click is a no-op or the button is disabled after first click | P1 |
| WPS-34 | Backend validation error surfaced | Force a validation error at confirm (e.g. invalid address payload) | Clear error message shown; user is not silently stuck or logged out | P2 |
| WPS-35 | Network loss mid-flow | Use DevTools/offline mode mid Devices & Delivery, attempt to proceed | Clear error/retry state; previously entered data is not lost | P2 |
| WPS-36 | Browser refresh mid-flow | Refresh the browser mid Devices & Delivery, then return | State is preserved (or the flow restarts cleanly per design — confirm intended behavior; note this replaces the iOS "app backgrounded" case) | P3 |

---

### EMI-5782 (web) — Products Navigation & In-App PoS Request Flow

Context: web equivalent of the iOS "More" menu restructuring. On web, the closest existing anchor is the **"Manage Products"** sidebar link (confirmed present today, navigates to a `/products-management` URL) — used here in place of the iOS "More > Products" entry point. The "Bills" sidebar link is already a separate, distinctly-named entry from "Manage Products" on web, so the literal "rename to Bill Items" acceptance criterion may not have a direct web analogue (see WPN-01/02 caveats) — the underlying goal (Bills and Products are separate, unambiguous entries) already appears satisfied by the current naming; confirm intent with the web team before treating WPN-01 as a defect if "Bills" is never renamed.

#### A. Navigation entry points

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPN-01 | Bills entry distinct from Products | Open the sidebar | "Bills" and "Manage Products" are separate, clearly distinguishable entries (web's existing equivalent of the iOS Bill Items/Products split) | P2 |
| WPN-02 | Bills still works | Click "Bills" in the sidebar | Opens the existing bill-related content (regression check, unaffected by the Products work) | P1 |
| WPN-03 | Manage Products entry exists | Open the sidebar | "Manage Products" link is visible and present | P1 |

#### B. Products list

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPN-04 | Only assigned products shown | Click "Manage Products" | List shows only products currently assigned to the user's profile, no My Products/All Products tabs | P1 |
| WPN-05 | Non-PoS products have no Manage action | View a non-PoS product in the list | No "Manage" action is shown | P2 |
| WPN-06 | PoS product shows Manage | View a product with type code POS | "Manage" action is visible | P1 |
| WPN-07 | Empty state | View Products with a profile that has no assigned products | A clear empty state is shown | P2 |
| WPN-08 | Loading state | Open Products with network throttled (DevTools) | A loading indicator is shown while the list fetches | P3 |

#### C. Manage → PoS management

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPN-09 | Manage opens PoS management | Click Manage on a PoS product | Opens PoS management scoped to that product | P1 |
| WPN-10 | Dashboard/Orders/Devices tabs visible | Inside PoS management | Dashboard, Orders, and Devices tabs are all present | P1 |
| WPN-11 | Transactions hidden this sprint | Inside PoS management | No Transactions tab is visible or reachable (including by direct URL) | P1 |
| WPN-12 | Dashboard loads | Open the Dashboard tab | Loads without error | P3 |

#### D. Orders tab

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPN-13 | Orders list populates | Open Orders tab | Orders load from `GET /api/v1/pos/orders/my-order` and display | P1 |
| WPN-14 | Order status shown | View an order | Status is visible | P1 |
| WPN-15 | Order timeline shown | Open an order's detail | Timeline/progress detail is visible | P2 |
| WPN-16 | Audit trail shown where available | Open an order's detail | Audit trail is visible when the backend provides it | P2 |
| WPN-17 | Empty orders state | View Orders with zero PoS orders | Clear empty state shown | P2 |
| WPN-18 | Orders fetch error + retry | Simulate an API failure on `my-order` (DevTools request blocking) | Error state shown with a retry affordance | P2 |

#### E. Devices tab

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPN-19 | Devices list populates | Open Devices tab | Devices load from `GET /api/v1/pos/devices/my` and display | P1 |
| WPN-20 | Device fields complete | View a device row | TID, source order, location, Main Wallet, activation date, and status are all shown | P1 |
| WPN-21 | Empty devices state | View Devices with zero mapped terminals | Clear empty state shown | P2 |

#### F. Request additional devices (from Orders)

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPN-22 | Request-devices action present | Open Orders tab | An action to create a new PoS order is available | P1 |
| WPN-23 | Reuses onboarding device flow | Trigger request-devices | Opens the same device count/delivery/review flow used in EMI-5783 (web) | P1 |
| WPN-24 | Wathiq address fetched first | Trigger request-devices | User's Wathiq national address is retrieved before the flow opens | P2 |
| WPN-25 | No wallet picker | Walk the flow | No wallet-selection UI; a read-only note states devices activate on Main Wallet | P2 |
| WPN-26 | Submit payload shape | Complete and submit a request | `POST /emi-profile/api/v1/products/orders/pos` is called with product code, delivery groups, group quantities, address source, coordinates | P1 |
| WPN-27 | NATIONAL_ADDRESS_WATHIQ path | Submit using the Wathiq address | Address source enum is `NATIONAL_ADDRESS_WATHIQ`; order succeeds | P1 |
| WPN-28 | CUSTOM_MAP_PIN path | Submit using a custom pinned address | Address source enum is `CUSTOM_MAP_PIN`; order succeeds | P1 |
| WPN-29 | Returns to Orders after submit | Submit a request | User lands back on PoS Orders; the new order is visible in the list | P1 |
| WPN-30 | Double-submit prevention | Rapidly double-click submit | Only one order is created | P1 |
| WPN-31 | Submit validation error surfaced | Force a validation error on submit | Clear error message; form state is not lost | P2 |

#### G. Add Products

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPN-32 | Add Products opens available list | Click Add Products | List loads from `GET /emi-profile/api/v1/products` | P1 |
| WPN-33 | Multi-select | Select more than one product | All selected products are visually marked as selected | P1 |
| WPN-34 | Deselect before submit | Select a product, then deselect it | It is removed from the pending selection | P2 |
| WPN-35 | Not-implemented error on submit | Select product(s), submit | A clear "not implemented" error is shown (add-products API doesn't exist yet) — no crash, no silent failure | P1 |
| WPN-36 | Recoverable after not-implemented error | Trigger WPN-35, then retry or cancel | User can retry the submit or back out cleanly; selections aren't corrupted | P2 |

#### H. Cross-cutting

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| WPN-37 | Server error + retry across views | Simulate API failures on Products list, Orders, and Devices in turn | Each surfaces an error state with retry | P2 |
| WPN-38 | Double-submission guarded everywhere | Rapidly double-click every submit-style action in this flow | No duplicate requests fire from any of them | P2 |
| WPN-39 | Responsive layout | Resize the browser to a narrow (tablet-width) viewport across Products, Orders, Devices, Add Products | Layouts remain usable, no overlapping/clipped content (web-only concern, no iOS equivalent) | P3 |

---

### Automated coverage note

Draft Playwright UI specs for both tickets exist at [`RegistrationProductsPage.spec.ts`](../../BusinessTestCases/Registration/ui/RegistrationProductsPage.spec.ts) (EMI-5783 web) and [`ProductsManagementPage.spec.ts`](../../BusinessTestCases/products/ui/ProductsManagementPage.spec.ts) (EMI-5782 web). They were authored directly from the ticket acceptance criteria without live DOM verification (see the status caveat above) and use feature-detection gates that skip with a clear reason when the underlying element isn't found — so they're safe to run today (they'll no-op) and should self-activate once the feature ships. Reconcile their selectors against the real implementation on first genuine run.

---

<!-- source: EMI-5782-5783-PoS-Products.md -->
## EMI-5782-5783-PoS-Products

## Manual Test Cases — PoS Products (iOS)

Source tickets: [EMI-5783](https://digitalcash.atlassian.net/browse/EMI-5783) (Onboarding PoS Request Flow) and [EMI-5782](https://digitalcash.atlassian.net/browse/EMI-5782) (Products Navigation & In-App PoS Request Flow).

Both tickets are tagged **FE - iOS** (native Business app). There is no automation harness for the iOS app in this repository, so these are manual/exploratory test cases for QA execution on device/simulator. Where a piece of the flow is also reachable on the web portal (the registration Products step), it has been automated separately in [`RegistrationProductsFunctionality.spec.ts`](../../BusinessTestCases/Registration/functional/RegistrationProductsFunctionality.spec.ts).

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### EMI-5783 — Onboarding PoS Request Flow

Context: during registration, on the Products step, selecting the PoS Terminals card expands inline and offers "Request devices now" or "Skip - set up later".

#### A. Products step — PoS card

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PS-01 | Wallet shown as required | Reach the onboarding Products step | Wallet is shown and cannot be deselected (required product) | P1 |
| PS-02 | PoS Terminals shown as optional | Reach the Products step | PoS Terminals, Bill Payment, Payouts are shown as optional, deselectable | P2 |
| PS-03 | Selecting PoS Terminals expands inline | Tap the PoS Terminals card | The card expands in place; the user is **not** navigated to a new screen | P1 |
| PS-04 | Expanded card shows both choices | Expand the PoS Terminals card | "Request devices now" and "Skip - set up later" are both visible | P1 |
| PS-05 | Collapsing without choosing | Expand the card, then tap it again without picking an option | Card collapses; selection state (Wallet/PoS enabled) is unaffected — confirm actual behavior matches design intent | P3 |

#### B. Skip path

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PS-06 | Skip keeps PoS enabled | Expand PoS card → tap "Skip - set up later" | PoS remains selected/enabled on the Products step | P1 |
| PS-07 | Skip shows setup-later message | Same as PS-06 | An inline message communicates setup was skipped and can be done later | P2 |
| PS-08 | "Actually, request now" reopens flow | After skipping, tap "Actually, request now" | The Devices & Delivery sub-flow opens from the expanded card | P1 |

#### C. Request-now path — Devices & Delivery

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PS-09 | Devices & Delivery fields present | Tap "Request devices now" | Number-of-devices input, delivery-mode toggle, and address selection are all visible | P1 |
| PS-10 | Delivery mode toggle switches views | Toggle delivery mode | UI updates accordingly (e.g. single address vs. split delivery groups) | P1 |
| PS-11 | Select National Wathiq address | Choose the National Wathiq address option | Address is populated/selected from Wathiq data | P1 |
| PS-12 | Select Custom Pin address | Choose Custom Pin, drop a pin on the map | Custom coordinates are captured and reflected in the form | P1 |
| PS-13 | Add a delivery/location group | With split delivery enabled, add a location group | A new group row appears, independently configurable | P2 |
| PS-14 | Remove a delivery/location group | Remove a previously added group | Group is removed; remaining groups/totals adjust correctly | P2 |
| PS-15 | Cannot proceed with missing required fields | Leave device count or address empty, try to continue | Continue/Next is disabled or a validation error is shown | P1 |
| PS-16 | No wallet picker shown | Walk through the entire Devices & Delivery step | No wallet-selection UI appears anywhere in this sub-flow | P2 |
| PS-17 | Zero devices blocked | Enter 0 for device count | Validation blocks proceeding | P2 |
| PS-18 | Very large device count | Enter an unrealistically large device count (e.g. 99999) | Either a sane max is enforced with a clear message, or the value is otherwise handled without crashing | P3 |
| PS-19 | Split quantities reconcile with total | With multiple delivery groups, assign per-group device counts | Sum of per-group quantities matches (or is validated against) the total device count | P2 |

#### D. Review step

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PS-20 | Review shows total device count | Complete Devices & Delivery, proceed to Review | Total device count matches what was entered | P1 |
| PS-21 | Review shows delivery breakdown | Same as PS-20, with multiple groups | Each group's device count and address/location are listed | P1 |
| PS-22 | Address type correctly labeled | Review with a Wathiq group and a Custom Pin group | Each group is labeled with its correct address source | P2 |
| PS-23 | Order-creation note shown | Reach Review | Text confirms the order will be created once onboarding is completed (not immediately) | P2 |
| PS-24 | Back from Review edits prior step | Tap Back from Review | Returns to Devices & Delivery with previously entered values intact | P1 |
| PS-25 | Confirming returns to Products step | Confirm on Review | User lands back on the onboarding Products step | P1 |

#### E. Post-confirmation Products step state

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PS-26 | Inline order-ready state | Confirm a device order | Products step shows device count, delivery summary, Edit, and Remove inline on the PoS card | P1 |
| PS-27 | Edit reopens with prior values | Tap Edit on the order-ready state | Devices & Delivery / Review reopen pre-filled with the previous selections | P1 |
| PS-28 | Remove clears the order | Tap Remove on the order-ready state | Order state clears; card reverts to pre-order (or skipped) state | P1 |
| PS-29 | Continue after confirming | Confirm a device order, then continue onboarding | Onboarding proceeds normally to the next step | P1 |
| PS-30 | Continue after skipping | Skip PoS setup, then continue onboarding | Onboarding proceeds normally without a device order | P1 |

#### F. Registration completion

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PS-31 | Order created on completion (confirmed path) | Confirm a device order, finish registration | Order appears under My Products > PoS > Orders after registration completes | P1 |
| PS-32 | No order created (skipped path) | Skip PoS setup, finish registration | No order is created; a "request later" message/entry point is shown | P1 |
| PS-33 | Double-submit prevention | Rapidly double-tap the Review confirm button | Only one order is created; second tap is a no-op or disabled | P1 |
| PS-34 | Backend validation error surfaced | Force a validation error at confirm (e.g. invalid address payload) | Clear error message shown; user is not silently stuck or logged out | P2 |
| PS-35 | Network loss mid-flow | Disable network mid Devices & Delivery, attempt to proceed | Clear error/retry state; previously entered data is not lost | P2 |
| PS-36 | App backgrounded mid-flow | Background the app mid Devices & Delivery, then resume | State is preserved (or the flow restarts cleanly per design — confirm intended behavior) | P3 |

---

### EMI-5782 — Products Navigation & In-App PoS Request Flow

Context: post-registration "More" menu restructuring — renames the old bill-related Products entry, adds a new Products section scoped to the user's assigned products, with PoS management (Dashboard/Orders/Devices) and an Add Products flow.

#### A. Navigation rename

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PN-01 | Old Products entry renamed | Open the More menu | The former "Products" (bill-related) entry now reads "Bill Items" | P1 |
| PN-02 | Bill Items still works | Tap "Bill Items" | Opens the same bill-related content as before the rename (regression check) | P1 |
| PN-03 | New Products entry exists | Open the More menu | A separate, new "Products" entry is present | P1 |

#### B. Products list

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PN-04 | Only assigned products shown | Open Products | List shows only products currently assigned to the user's profile, no My Products/All Products tabs | P1 |
| PN-05 | Non-PoS products have no Manage action | View a non-PoS product in the list | No "Manage" action is shown | P2 |
| PN-06 | PoS product shows Manage | View a product with type code POS | "Manage" action is visible | P1 |
| PN-07 | Empty state | View Products with a profile that has no assigned products | A clear empty state is shown | P2 |
| PN-08 | Loading state | Open Products with a throttled/slow connection | A loading indicator is shown while the list fetches | P3 |

#### C. Manage → PoS management

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PN-09 | Manage opens PoS management | Tap Manage on a PoS product | Opens PoS management scoped to that product | P1 |
| PN-10 | Dashboard/Orders/Devices tabs visible | Inside PoS management | Dashboard, Orders, and Devices tabs are all present | P1 |
| PN-11 | Transactions hidden this sprint | Inside PoS management | No Transactions tab is visible or reachable | P1 |
| PN-12 | Dashboard loads | Open the Dashboard tab | Loads without error | P3 |

#### D. Orders tab

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PN-13 | Orders list populates | Open Orders tab | Orders load from `GET /api/v1/pos/orders/my-order` and display | P1 |
| PN-14 | Order status shown | View an order | Status is visible | P1 |
| PN-15 | Order timeline shown | Open an order's detail | Timeline/progress detail is visible | P2 |
| PN-16 | Audit trail shown where available | Open an order's detail | Audit trail is visible when the backend provides it | P2 |
| PN-17 | Empty orders state | View Orders with zero PoS orders | Clear empty state shown | P2 |
| PN-18 | Orders fetch error + retry | Simulate an API failure on `my-order` | Error state shown with a retry affordance | P2 |

#### E. Devices tab

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PN-19 | Devices list populates | Open Devices tab | Devices load from `GET /api/v1/pos/devices/my` and display | P1 |
| PN-20 | Device fields complete | View a device row | TID, source order, location, Main Wallet, activation date, and status are all shown | P1 |
| PN-21 | Empty devices state | View Devices with zero mapped terminals | Clear empty state shown | P2 |

#### F. Request additional devices (from Orders)

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PN-22 | Request-devices action present | Open Orders tab | An action to create a new PoS order is available | P1 |
| PN-23 | Reuses onboarding device flow | Trigger request-devices | Opens the same device count/delivery/review flow used in EMI-5783 | P1 |
| PN-24 | Wathiq address fetched first | Trigger request-devices | User's Wathiq national address is retrieved before the flow opens | P2 |
| PN-25 | No wallet picker | Walk the flow | No wallet-selection UI; a read-only note states devices activate on Main Wallet | P2 |
| PN-26 | Submit payload shape | Complete and submit a request | `POST /emi-profile/api/v1/products/orders/pos` is called with product code, delivery groups, group quantities, address source, coordinates | P1 |
| PN-27 | NATIONAL_ADDRESS_WATHIQ path | Submit using the Wathiq address | Address source enum is `NATIONAL_ADDRESS_WATHIQ`; order succeeds | P1 |
| PN-28 | CUSTOM_MAP_PIN path | Submit using a custom pinned address | Address source enum is `CUSTOM_MAP_PIN`; order succeeds | P1 |
| PN-29 | Returns to Orders after submit | Submit a request | User lands back on PoS Orders; the new order is visible in the list | P1 |
| PN-30 | Double-submit prevention | Rapidly double-tap submit | Only one order is created | P1 |
| PN-31 | Submit validation error surfaced | Force a validation error on submit | Clear error message; form state is not lost | P2 |

#### G. Add Products

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PN-32 | Add Products opens available list | Tap Add Products | List loads from `GET /emi-profile/api/v1/products` | P1 |
| PN-33 | Multi-select | Select more than one product | All selected products are visually marked as selected | P1 |
| PN-34 | Deselect before submit | Select a product, then deselect it | It is removed from the pending selection | P2 |
| PN-35 | Not-implemented error on submit | Select product(s), submit | A clear "not implemented" error is shown (add-products API doesn't exist yet) — no crash, no silent failure | P1 |
| PN-36 | Recoverable after not-implemented error | Trigger PN-35, then retry or cancel | User can retry the submit or back out cleanly; selections aren't corrupted | P2 |

#### H. Cross-cutting

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PN-37 | Server error + retry across views | Simulate API failures on Products list, Orders, and Devices in turn | Each surfaces an error state with retry | P2 |
| PN-38 | Double-submission guarded everywhere | Rapidly double-tap every submit-style action in this flow | No duplicate requests fire from any of them | P2 |

---

### Automated coverage note

The registration **Products step on the web portal** already has Playwright coverage in `RegistrationProductsFunctionality.spec.ts`, including a case added specifically for the POS Terminal product's distinct "5 SAR / annual" pricing (relevant to EMI-5783's PoS Terminals context). The richer inline expand/Skip/Request-now/Devices & Delivery/Review sub-flow described in EMI-5783, and the entire More-menu restructuring in EMI-5782, are iOS-native UI with no equivalent currently reachable on web — hence manual coverage only, above.

---

<!-- source: ForgotPassword.md -->
## ForgotPassword

## Manual Test Cases — Forgot Password

Context: the Forgot Password flow lets a user re-identify themselves with their **Company number** and **Mobile number** (Step 1), verify an **OTP** sent for the change-password operation, then set a **new password** with confirmation (Step 2), landing back on the Login page on success.

This flow already has full Playwright automation in this repo. Most of it (Step 1 identity check, Step 2 password reset, and the OTP resend/verify cycle) is exercised against **mocked backend responses** — `mockOtpDisabled`, `mockForgetPasswordSuccess`, `mockForgetPasswordFailure`, and `mockAllPasswordsSuccess` stub `**/otp/otp-settings/**` and `**/auth/passwords/**` so the UI behavior can be verified deterministically without depending on a live backend or a real OTP delivery. A small number of tests (the OTP happy-path in `functional/ForgotPasswordOtpFunctionality.spec.ts`) instead call the real Step 1 API and fetch the live OTP from MongoDB, because mocking Step 1 with an empty `{}` response leaves the backend without a session/token to trigger a real OTP. The manual cases below are written the same way: most can be executed against a test/mocked environment, and are flagged where they specifically depend on a live OTP or live backend responses.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Step 1 — Identify Account: Page Elements & Layout

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-01 | Page loads at the Forgot Password URL | From Login, click "Forgot password" | URL is `/business/auth/forgot-password`; page title is "EMI - Business" | P1 |
| FP-02 | Branding, language switcher, and theme toggle are visible | Load the Forgot Password page | MJD Pay logo, EN button (active by default), Arabic button, and theme-toggle button are all visible | P2 |
| FP-03 | Back button returns to Login | Click the back button | User is navigated to the Login page | P1 |
| FP-04 | Logo click navigates away | Click the MJD Pay logo | User is no longer on the Forgot Password URL | P3 |
| FP-05 | Eyebrow and heading text shown | Load the page | "Forgot password" eyebrow and "Welcome to MJD Pay" heading are visible | P3 |
| FP-06 | Company number field displayed correctly | Load the page | Company number label and input are visible and enabled, with "Input here" placeholder | P1 |
| FP-07 | Mobile number field displayed correctly | Load the page | Mobile number label, Saudi flag icon, "(+966)" prefix, and input are visible/enabled, with "Input here" placeholder | P1 |
| FP-08 | Next button disabled with empty fields | Load the page without entering anything | Next button is visible but disabled | P1 |

### B. Step 1 — Happy Path

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-09 | Language toggle works both directions | Click Arabic, confirm it activates (RTL), then click EN | Arabic button becomes active on click; clicking EN afterward reactivates English | P3 |
| FP-10 | Company field accepts and retains valid input | Type a valid company number (e.g. `A2316`) | Field displays and retains the typed value | P2 |
| FP-11 | Mobile field accepts a valid 9-digit number | Type a valid mobile number (e.g. `500021788`) | Field displays and retains the typed value | P2 |
| FP-12 | Next enables once both fields are valid | Fill Company and Mobile with valid values | Next button becomes enabled | P1 |
| FP-13 | Valid submission proceeds to Step 2 | Submit valid Company + Mobile | User is navigated to the change-password step (URL contains `change-password`) | P1 |
| FP-14 | Step 2 fields appear, Step 1 fields hidden | Continue from FP-13 | New Password and Confirm Password fields become visible; Company and Mobile inputs are no longer visible | P1 |

### C. Step 1 — Mobile Number Format Validation

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-15 | Too-short mobile number blocked | Enter a company number, then a mobile shorter than 9 digits (e.g. `5123`) | Next button stays disabled | P2 |
| FP-16 | Leading-zero mobile number blocked | Enter a mobile number with a leading zero (e.g. `0500021788`) | Next button stays disabled | P2 |
| FP-17 | Alphabetic characters rejected | Type letters into the Mobile field | Field remains empty / rejects the letters | P2 |
| FP-18 | Special characters rejected | Type symbols (e.g. `!@#`) into the Mobile field | Field remains empty / rejects the symbols | P2 |
| FP-19 | Valid 9-digit mobile starting with 5 enables Next | Enter a valid mobile alongside a valid company | Next button becomes enabled | P1 |

### D. Step 1 — Negative Scenarios

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-20 | Next disabled unless both fields are filled | Try: both empty / only Company filled / only Mobile filled | Next button stays disabled in every case | P1 |
| FP-21 | Next disables again after clearing a field | Fill both fields, confirm Next is enabled, then clear either one | Next button becomes disabled again | P2 |
| FP-22 | Invalid credentials keep the user on Step 1 | Submit an unrecognized Company + Mobile combination | User remains on the Forgot Password page (does not advance) | P1 |
| FP-23 | Toast error shown for invalid credentials | Same as FP-22 | An error toast/snackbar notification appears | P1 |
| FP-24 | Field values preserved after a failed submission | Submit invalid credentials | Both the Company number and Mobile number values remain in their fields after the error | P2 |
| FP-25 | No progression to Step 2 or OTP on rejection | Submit invalid credentials | New Password field and OTP dialog are not shown | P1 |
| FP-26 | Page context remains visible after failure | Submit invalid credentials | "Welcome to MJD Pay" heading and "Forgot password" eyebrow remain visible | P3 |

### E. Step 1 — Edge Cases

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-27 | Whitespace-only company number blocked | Enter only spaces in Company number, a valid Mobile number | Next button stays disabled | P2 |
| FP-28 | Formatting characters stripped from Mobile field | Paste/type a mobile number with dashes and spaces (e.g. `500-318-143`) | The stored value has no dashes or spaces | P2 |
| FP-29 | Extremely long company number doesn't break the page | Enter a 200-character company number | Page remains functional (Next button still visible); user stays on the Forgot Password URL | P3 |
| FP-30 | Extremely long mobile number doesn't break the page | Enter a 50-digit mobile number | User stays on the Forgot Password URL without a crash | P3 |
| FP-31 | Theme persists through a language switch | Toggle dark theme, then switch language to Arabic | Dark theme remains applied after the language change | P3 |
| FP-32 | Double-click on Next doesn't double-submit | Fill valid Company/Mobile, rapidly double-click Next | Only one identity-check request is sent | P2 |
| FP-33 | Loading indicator shown while request is in flight | Submit valid Company/Mobile against a slow network | A loading spinner appears on/near the Next button until the response returns | P3 |

### F. Step 1 — Security

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-34 | Script payload does not execute | Enter `<script>alert(1)</script>` in Company number and/or Mobile number, submit | No JavaScript alert/dialog fires; input is treated as plain text | P1 |
| FP-35 | SQL-injection-style input handled safely | Enter `' OR '1'='1` as Company number, submit | Treated as an invalid credential; user stays on the page without a crash | P1 |
| FP-36 | Error detail doesn't leak internals | Submit invalid credentials | The error toast does not contain stack traces, SQL, database, or internal server error text | P1 |
| FP-37 | Change-password step not reachable by direct URL | Navigate directly to the change-password URL without completing Step 1 | The New Password form is not shown | P1 |
| FP-38 | Credentials sent in request body, not URL | Submit valid Company/Mobile and inspect the network request | Request is a POST; the URL does not contain the company number or mobile number | P1 |
| FP-39 | Generic error avoids user enumeration | Submit a wrong Company with a valid Mobile, and separately a valid Company with a wrong Mobile | Neither error message states specifically whether the company number or the mobile number was invalid | P2 |

### G. OTP Verification — Popup Elements

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-40 | OTP modal opens with heading and instructions | Reach the OTP step after submitting Step 2 | Modal dialog appears with an "Enter OTP" heading and instruction text mentioning the Change Password Process | P1 |
| FP-41 | Six empty OTP boxes, first one focused | Open the OTP modal | Exactly 6 digit-input boxes are shown, all empty, and the first is focused automatically | P1 |
| FP-42 | Countdown timer displayed | Open the OTP modal | A countdown timer is visible in `MM:SS` format | P2 |
| FP-43 | Resend option shown but disabled during countdown | Open the OTP modal | "Didn't Receive Code?" text and a "Click to resend" button are visible; resend is disabled while the countdown is active | P2 |
| FP-44 | Cancel/Confirm/Close controls present | Open the OTP modal | Cancel button and Close (×) button are enabled; Confirm button is visible but disabled while OTP is empty | P1 |

### H. OTP Verification — Functional Flow

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-45 | Confirm stays disabled until all digits entered | Fill only some of the 6 OTP boxes | Confirm button remains disabled | P1 |
| FP-46 | Non-numeric OTP characters rejected | Type a letter into an OTP box | The box does not accept the letter (remains empty) | P2 |
| FP-47 | Auto-advance between OTP boxes | Type a digit in the first OTP box | Focus automatically moves to the next box | P2 |
| FP-48 | Wrong OTP is rejected | Fill all 6 boxes with an incorrect code, click Confirm | Modal remains open and an error indicator is shown | P1 |
| FP-49 | Correct OTP resets the password (live OTP required) | Fill all 6 boxes with the OTP actually sent for this change-password request, click Confirm | Password reset succeeds, user is redirected to Login, and a success toast is shown | P1 |
| FP-50 | Resend clears inputs once countdown expires | Wait for the countdown to reach zero, click "Click to resend" | Resend button becomes enabled once the timer expires; previously entered OTP digits are cleared | P2 |
| FP-51 | Cancel returns to Step 2 without losing the form | Click Cancel on the OTP modal | Modal closes, user returns to the change-password page, and the Reset Password button is visible/enabled again for a retry | P2 |

### I. Step 2 — New Password: Page Elements & Layout

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-52 | Branding and controls carried over to Step 2 | Reach Step 2 | MJD Pay logo, EN/Arabic buttons, and theme toggle are all still visible | P3 |
| FP-53 | Step 2 heading, back button, and subtitle shown | Reach Step 2 | "Forgot Password" heading, a back button, and the subtitle "Create A New Password, Follow Password Regulation" are visible | P2 |
| FP-54 | New Password field displayed correctly | Reach Step 2 | New Password label/input are visible, masked by default (`type="password"`), with "Input Password" placeholder and a show-password eye icon | P1 |
| FP-55 | Confirm Password field displayed correctly | Reach Step 2 | Confirm Password label/input are visible, masked by default, with "Input Password" placeholder and a show-password eye icon | P1 |
| FP-56 | Reset Password button disabled when empty | Reach Step 2 without entering a password | Reset Password button is visible but disabled | P1 |

### J. Step 2 — Password Validation Rules

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-57 | Password rules checklist appears while typing | Start typing in New Password | A "Your password must contain:" checklist appears listing: at least 8 characters, lowercase, uppercase, numbers, special characters, and no spaces | P1 |
| FP-58 | Mismatch message shown | Enter different values in New Password and Confirm Password | "New password and Confirm password are not matched" message is displayed | P1 |
| FP-59 | Submit disabled when a password rule is unmet | In turn, try a password missing: uppercase / lowercase / a number / a special character / a length under 8 / containing spaces | Reset Password button stays disabled for each unmet rule | P1 |
| FP-60 | Submit re-enables after correcting a mismatch | Enter mismatched passwords, confirm button is disabled, then correct Confirm Password to match | Reset Password button becomes enabled | P2 |
| FP-61 | Submit disables after clearing either password field | Fill both fields validly (button enabled), then clear New Password, and separately clear Confirm Password | Reset Password button becomes disabled again in both cases | P2 |

### K. Step 2 — Back Navigation

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-62 | Back button returns to Step 1 | From Step 2, click the back button | Company and Mobile inputs reappear, New Password field is hidden, and the Next button is shown again | P2 |

### L. Step 2 — Show/Hide Password & Field Interactions

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-63 | Show/hide toggle for New Password | Fill New Password, click its eye icon to reveal, then click again to hide | Field switches to plain text on reveal and back to masked on hide | P2 |
| FP-64 | Show/hide toggle for Confirm Password | Fill Confirm Password, click its eye icon to reveal, then click again to hide | Field switches to plain text on reveal and back to masked on hide | P2 |
| FP-65 | Submit disabled with only one password field filled | Fill only New Password, and separately only Confirm Password | Reset Password button stays disabled in both cases | P2 |
| FP-66 | Submit enabled with valid matching passwords | Fill both fields with the same valid password | Reset Password button becomes enabled | P1 |

### M. Step 2 — Edge Cases

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-67 | Case-sensitive password comparison | Enter passwords that differ only by letter case (e.g. `Aa#1234567` vs `aA#1234567`) | Treated as a mismatch; mismatch message shown and submit disabled | P2 |
| FP-68 | Long but valid password accepted | Enter a long password that still satisfies all rules, matching in both fields | Reset Password button becomes enabled | P3 |
| FP-69 | Enter key submits a valid form | Fill both password fields validly, press Enter in Confirm Password | Form submits and the user proceeds toward Login | P3 |
| FP-70 | Loading state and duplicate-submit prevention | Submit a valid password reset against a slow network, observe button and repeat clicks | A loading spinner is shown on submit, and only one reset request is sent even under repeated interaction | P2 |

### N. Step 2 — Security

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-71 | New password sent in request body, not URL | Submit a valid password reset and inspect the network request | Request is a POST; the URL does not contain the plaintext password | P1 |
| FP-72 | Script payload does not execute | Enter `<script>alert(1)</script>` as both New Password and Confirm Password | No JavaScript alert/dialog fires | P1 |

### O. End-to-End Happy Path & Failure Handling

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-73 | Full flow completes and redirects to Login | Complete Step 1 with valid credentials, Step 2 with a valid matching password (OTP step passes/disabled) | User is redirected to the Login page | P1 |
| FP-74 | Mismatched passwords never reach Login | Enter mismatched passwords at Step 2 | Reset Password stays disabled; user is never redirected to Login | P1 |
| FP-75 | Backend failure on reset is surfaced clearly | Submit a valid password reset while the reset API returns a server error | User stays on the current page (not redirected to Login) and an error toast is shown | P1 |

### P. API-Level Validation (Backend Contract)

Context: these checks validate the two endpoints the Forgot Password UI calls under the hood — useful for API/exploratory testing with a tool such as Postman, independent of the UI.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FP-76 | Identity check succeeds for valid data | `POST /auth/passwords/forget` with a valid `companyNumber` and `mobileNumber` (E.164 format, e.g. `+9665...`) | Returns HTTP 200 with a JSON content-type response | P1 |
| FP-77 | Missing fields rejected | Call the same endpoint with `companyNumber` missing, then with `mobileNumber` missing, then with an empty body | Returns HTTP 400 in all three cases | P1 |
| FP-78 | Unrecognized identity rejected | Call the endpoint with an unknown company, then an unknown mobile, then both unknown | Returns HTTP 401 in all three cases | P1 |
| FP-79 | Mobile without country code rejected or unauthorized | Call the endpoint with a mobile number missing its `+966` country code | Returns HTTP 400 or 401 | P2 |
| FP-80 | Error responses don't leak internals | Call the endpoint with invalid credentials | Response body contains no stack traces, SQL, or database-error text | P1 |
| FP-81 | Consistent error status prevents enumeration | Call the endpoint with a wrong company (valid mobile), then a valid company (wrong mobile) | Both calls return the same HTTP status code | P2 |
| FP-82 | Endpoint only accepts POST | Call `GET /auth/passwords/forget` | Does not return HTTP 200 | P2 |
| FP-83 | OTP settings endpoint returns a valid config | `GET /otp/otp-settings/q?operationCode=FORGET_PASSWORD` | Returns HTTP 200 with `length` (positive number), `validityInSeconds` (positive number), `canResendOtpAfterInSeconds` (non-negative number), and `enabled` (boolean) | P2 |
| FP-84 | Unknown/omitted operation code rejected | Call the OTP settings endpoint with an invalid `operationCode`, and again with the parameter omitted entirely | Returns HTTP 400 or 404 for an unknown code, and HTTP 400 when the parameter is omitted | P2 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Forgot Password feature. The corresponding automated specs are:

- `BusinessTestCases/forgot-password/ForgotPasswordHelper.ts` — shared navigation/route-mocking helpers (`mockOtpDisabled`, `mockForgetPasswordSuccess`, `mockForgetPasswordFailure`, `mockAllPasswordsSuccess`, `gotoForgotPassword`, `gotoOtpModal`) used across the specs below
- `BusinessTestCases/forgot-password/ui/ForgotPassword.spec.ts` — Step 1 page elements & layout (sections A)
- `BusinessTestCases/forgot-password/ui/ForgotPasswordStep2.spec.ts` — Step 2 page elements & layout (section I)
- `BusinessTestCases/forgot-password/ui/ForgotPasswordOtpPage.spec.ts` — OTP modal UI elements (section G)
- `BusinessTestCases/forgot-password/functional/ForgotPasswordStep1.spec.ts` — Step 1 happy path, mobile validation, negative scenarios, edge cases, security (sections B–F)
- `BusinessTestCases/forgot-password/functional/ForgotPasswordStep2.spec.ts` — Step 2 password validation, back navigation, interactions, edge cases, security (sections J–N)
- `BusinessTestCases/forgot-password/functional/ForgotPasswordOtpFunctionality.spec.ts` — OTP verification functional flow, including the live-OTP happy path via MongoDB lookup (section H)
- `BusinessTestCases/forgot-password/functional/ForgotPasswordHappyPath.spec.ts` — full end-to-end flow and mocked failure handling (section O)
- `BusinessTestCases/forgot-password/api/ForgotPasswordAPIFlow.spec.ts` — API-level contract checks for `POST /auth/passwords/forget` and `GET /otp/otp-settings/q` (section P)
- `BusinessTestCases/pageElements/ForgotPasswordPage.ts` / `BusinessTestCases/pageElements/OtpPage.ts` — page objects backing all of the above

---

<!-- source: HomePage.md -->
## HomePage

## Manual Test Cases — HomePage (Post-Login Dashboard)

Context: the HomePage (`/business/main/home`) is the first screen a Business-portal user lands on after logging in. It combines a greeting/header, wallet balance card, quick actions, bills overview, sub-wallets panel, a last-transactions widget, notifications, a profile menu, and the app-wide sidebar navigation. This document covers the full dashboard experience for manual/exploratory execution — happy path, negative, edge-case, and security-relevant behavior — mirroring the existing Playwright automation under `BusinessTestCases/homepage/`.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Page identity — URL, title & greeting

Context: basic landing checks confirming the user reaches the right page with the right chrome after login.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-01 | Redirects to homepage after login | Log in with valid merchant credentials | User lands on `/business/main/home` | P1 |
| HP-02 | Correct browser tab title | Land on the homepage | Browser tab title reads "EMI - Business" | P3 |
| HP-03 | "Home" page heading shown | Land on the homepage | A "Home" page heading is visible | P2 |
| HP-04 | Time-based greeting shown | Land on the homepage | A greeting message (e.g. time-of-day based) is visible | P2 |
| HP-05 | Wallet status subtitle shown | Land on the homepage | A subtitle describing wallet status appears under the greeting | P3 |
| HP-06 | Last login date/time shown | Land on the homepage | The Last Login date and time are visible | P2 |

---

### B. Header / top bar

Context: the top bar hosts the profile trigger and notifications icon, visible on every homepage load.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-07 | Profile trigger visible | Land on the homepage | The profile trigger (avatar/name) is visible in the header | P2 |
| HP-08 | Notifications icon visible | Land on the homepage | The notifications icon is visible in the header | P2 |

---

### C. Notifications panel

Context: clicking the notifications icon opens an in-page panel; clicking again closes it.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-09 | Open notifications panel | Click the notifications icon | The notifications panel and its heading become visible | P2 |
| HP-10 | Close notifications panel on second click | With the panel open, click the notifications icon again | The panel/heading is no longer visible | P2 |

---

### D. Profile menu

Context: the profile trigger opens a dropdown with account-level actions, including logout.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-11 | Logout option present in profile menu | Open the profile menu | A "Logout" item is visible | P1 |
| HP-12 | Profile/settings option present | Open the profile menu | A profile or settings entry is visible alongside logout | P2 |

---

### E. Logo

Context: the MJD Pay logo sits in the sidebar and should always keep the user inside the app.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-13 | Logo visible in sidebar | Land on the homepage | The MJD Pay logo is visible in the sidebar | P3 |
| HP-14 | Logo click stays in-app | Click the sidebar logo | User remains on a URL within the app domain (e.g. redirected to/stays on the homepage) | P2 |

---

### F. Balance card

Context: the balance card shows the current wallet balance with a visibility toggle plus shortcuts to the wallet QR and wallet settings.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-15 | "Current Balance" label shown | Land on the homepage | The "Current Balance" label is visible | P3 |
| HP-16 | Wallet balance amount shown | Land on the homepage | The wallet balance (SAR) container is visible | P1 |
| HP-17 | Balance visibility toggle present | Land on the homepage | The balance visibility toggle button is visible | P2 |
| HP-18 | Hiding the balance changes the display | Click the balance visibility toggle | The displayed balance text changes (e.g. masked) from its original value | P1 |
| HP-19 | Un-hiding restores the balance | With the balance hidden, click the toggle again | The balance display is restored to its original value | P1 |
| HP-20 | Hidden balance does not leak numeric value | Toggle the balance to hidden | The balance container's text does not show the raw numeric amount (masked/obscured) | P1 |
| HP-21 | Wallet QR button present | Land on the homepage | The Wallet QR button is visible | P2 |
| HP-22 | Wallet QR opens QR view | Click the Wallet QR button | A QR dialog opens, or the user is navigated to the wallet-links page | P2 |
| HP-23 | Wallet Settings button present | Land on the homepage | The Wallet Settings button is visible | P2 |
| HP-24 | Wallet Settings navigates away | Click the Wallet Settings button | User is navigated away from the homepage to a wallet settings screen | P2 |

---

### G. Quick actions

Context: shortcut cards to the most common merchant tasks — Topup, Wallet Transfer, Cashout, Receive Payment.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-25 | Quick actions heading & subtitle shown | Land on the homepage | The "Quick actions" heading and its "Shortcuts to common tasks" subtitle are visible | P3 |
| HP-26 | Topup card visible | Land on the homepage | The Topup quick action card (with description) is visible | P2 |
| HP-27 | Wallet Transfer card visible | Land on the homepage | The Wallet Transfer quick action card (with description) is visible | P2 |
| HP-28 | Cashout card visible | Land on the homepage | The Cashout quick action card (with description) is visible | P2 |
| HP-29 | Receive Payment card visible | Land on the homepage | The Receive Payment quick action card (with description) is visible | P2 |
| HP-30 | Topup card navigates to Topup | Click the Topup quick action card | User is navigated to the Topup page | P1 |
| HP-31 | Wallet Transfer card opens flow | Click the Wallet Transfer quick action card | Either a transfer dialog opens, or the user is navigated to a transfer-related URL | P1 |
| HP-32 | Cashout card opens flow | Click the Cashout quick action card | Either a dialog opens, or the user is navigated to a cashout/transfer URL | P1 |
| HP-33 | Receive Payment card opens flow | Click the Receive Payment quick action card | Either a dialog opens, or the user is navigated away from the homepage | P1 |

---

### H. Bills overview

Context: a Paid/Unpaid summary with a Chart/Cards view toggle and a link to the full Bills page.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-34 | Bills overview heading shown | Land on the homepage | The Bills overview section heading is visible | P3 |
| HP-35 | Chart/Cards toggle buttons present | Land on the homepage | Both the Chart toggle and the Cards toggle are visible | P2 |
| HP-36 | Paid/Unpaid labels present | Land on the homepage | The "Paid" and "Unpaid" category labels are visible | P2 |
| HP-37 | View All link present | Land on the homepage | The Bills "View All" link is visible | P2 |
| HP-38 | Switching to Cards view | Click the Cards toggle | The view switches to Cards; user remains on the homepage | P2 |
| HP-39 | Switching back to Chart view | From Cards view, click the Chart toggle | The view switches back to Chart; user remains on the homepage | P2 |
| HP-40 | View All navigates to Bills | Click the Bills "View All" link | User is navigated to the Bills page | P1 |
| HP-41 | Zero paid bills shown as 0 | View Bills overview on an account with no paid bills | The Paid category shows a 0/empty value, not an error or stale data | P2 |
| HP-42 | Zero unpaid bills shown as 0 | View Bills overview on an account with no unpaid bills | The Unpaid category label/value is visible and consistent with no unpaid bills | P2 |

---

### I. Sub-wallets panel

Context: a panel summarizing the merchant's sub-wallets, with a management shortcut and an empty state when none exist.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-43 | Sub-wallets panel heading shown | Land on the homepage | The Sub-wallets panel heading is visible | P3 |
| HP-44 | Sub-wallets Manage link present | Land on the homepage | The Sub-wallets "Manage" link is visible | P2 |
| HP-45 | Empty sub-wallets message shown | Land on the homepage with an account that has no sub-wallets | A clear empty-state message is shown in the panel | P2 |
| HP-46 | Manage link navigates | Click the Sub-wallets "Manage" link | User is navigated to the sub-wallets management page | P1 |

---

### J. Last transactions widget

Context: a table of the account's most recent transactions (capped at 10 rows) with a link to the full Transactions page, and a distinct empty state for accounts with no history.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-47 | Transactions container visible | Land on the homepage with an account that has transaction history | The last-transactions container is visible | P1 |
| HP-48 | At most 10 rows shown | View the last-transactions table on an account with more than 10 transactions | No more than 10 rows are displayed | P2 |
| HP-49 | Column headers present | View the last-transactions table | Column headers referencing transaction/amount/date/status are visible | P2 |
| HP-50 | Total row count shown | View the last-transactions table | A total transaction count is displayed below the table | P2 |
| HP-51 | View All link present and navigates | Click the transactions "View All" link | User is navigated to `/business/main/transactions` | P1 |
| HP-52 | Empty-state title shown for new accounts | Land on the homepage with an account that has no transaction history | An empty-state title reading "No transactions yet" (or equivalent) is shown | P2 |
| HP-53 | Empty-state description shown | Same as HP-52 | A description mentioning that transactions will appear once money moves through the wallet is shown | P3 |
| HP-54 | No total count in empty state | Same as HP-52 | No transaction total count is shown alongside the empty state | P2 |
| HP-55 | No View All link in empty state | Same as HP-52 | No "View All" link is shown alongside the empty state | P2 |

---

### K. Sidebar navigation

Context: the app-wide left-hand navigation, reachable from every page, including expandable Transfer and Manage Accounts submenus and "Soon" (disabled) items.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-56 | Sidebar container visible | Land on the homepage | The sidebar navigation container is visible | P2 |
| HP-57 | Home link present and active | Land on the homepage | The Home link is visible and marked active (class or `aria-current="page"`) | P2 |
| HP-58 | Transactions link present | Land on the homepage | The Transactions link is visible in the sidebar | P2 |
| HP-59 | Topup link present | Land on the homepage | The Topup link is visible in the sidebar | P2 |
| HP-60 | Transfer item present | Land on the homepage | The Transfer item is visible in the sidebar | P2 |
| HP-61 | Bills link present | Land on the homepage | The Bills link is visible in the sidebar | P2 |
| HP-62 | Payment Links item present | Land on the homepage | The Payment Links item is visible in the sidebar | P2 |
| HP-63 | Sub-Wallets link present | Land on the homepage | The Sub-Wallets link is visible in the sidebar | P2 |
| HP-64 | SADAD item marked "Soon" | Land on the homepage | The SADAD sidebar item is visible and labeled "Soon" | P3 |
| HP-65 | Manage Accounts item present | Land on the homepage | The Manage Accounts item is visible in the sidebar | P2 |
| HP-66 | Manage Products link present | Land on the homepage | The Manage Products link is visible in the sidebar | P2 |
| HP-67 | Groups & Roles link present | Land on the homepage | The Groups & Roles link is visible in the sidebar | P2 |
| HP-68 | Card Management link present | Land on the homepage | The Card Management link is visible in the sidebar | P2 |
| HP-69 | Logged-in company name shown | Land on the homepage | The logged-in company/brand name is visible in the sidebar | P3 |
| HP-70 | Transactions link navigates | Click the Transactions sidebar link | User is navigated to `/business/main/transactions` | P1 |
| HP-71 | Home link returns from another page | From the Transactions page, click the Home link | User returns to `/business/main/home` | P1 |
| HP-72 | Topup sidebar link navigates | Click the Topup sidebar link | User is navigated to the Topup page | P1 |
| HP-73 | Transfer submenu expands to reveal Cashout | Click the Transfer item | The submenu expands and the Cashout sub-link becomes visible | P2 |
| HP-74 | Transfer submenu reveals Wallet Transfer | Click the Transfer item | The Wallet Transfer sub-link becomes visible | P2 |
| HP-75 | Transfer submenu shows International Transfer as "Soon" | Click the Transfer item | The International Transfer sub-link is visible and labeled "Soon" | P3 |
| HP-76 | "Soon" International Transfer link is inert | Click the International Transfer ("Soon") sub-link | User remains on the homepage; no navigation occurs | P2 |
| HP-77 | Bills sidebar link navigates | Click the Bills sidebar link | User is navigated to the Bills page | P1 |
| HP-78 | Payment Links sidebar link navigates | Click the Payment Links sidebar link | User is navigated to the Payment Links page | P2 |
| HP-79 | Sub-Wallets sidebar link navigates | Click the Sub-Wallets sidebar link | User is navigated to the Sub-Wallets page | P2 |
| HP-80 | "Soon" SADAD link is inert | Click the SADAD ("Soon") sidebar item | User remains on the homepage; no navigation occurs | P2 |
| HP-81 | Manage Accounts submenu expands | Click the Manage Accounts panel | The submenu (Manage Users / Manage Beneficiary) becomes visible | P2 |
| HP-82 | Manage Users sub-link navigates | Expand Manage Accounts, click Manage Users | User is navigated to the Users management page | P2 |
| HP-83 | Manage Beneficiary sub-link navigates | Expand Manage Accounts, click Manage Beneficiary | User is navigated to the Beneficiary management page | P2 |
| HP-84 | Manage Products link navigates | Click the Manage Products sidebar link | User is navigated to the Products management page | P2 |
| HP-85 | Groups & Roles link navigates | Click the Groups & Roles sidebar link | User is navigated to the Groups/Roles page | P2 |
| HP-86 | Card Management link navigates | Click the Card Management sidebar link | User is navigated to the Card Management page | P2 |

---

### L. Logout

Context: logging out goes through a confirmation dialog before the session is actually destroyed. These cases end the session — always execute them last within a test cycle for a given account.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-87 | Logout confirmation dialog appears | Open the profile menu and click "Logout" | A confirmation dialog with a proceed/confirm button appears | P1 |
| HP-88 | Confirming logout ends the session | Confirm logout from the dialog | User is redirected to the login page and can no longer reach the homepage without logging in again | P1 |

---

### M. Session persistence & unauthenticated access

Context: the homepage should survive a refresh while authenticated, and must never be reachable without a valid session.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-89 | Refresh keeps user on homepage | While logged in on the homepage, refresh the browser | User remains on `/business/main/home` | P1 |
| HP-90 | Unauthenticated access redirects to login | With no active session, navigate directly to the home URL | User is redirected to the login page | P1 |

---

### N. API failure & empty-data resilience

Context: the homepage aggregates several independent widget APIs (transactions, bills, sub-wallets, wallet balance). A failure in any one of them should degrade gracefully rather than break the page.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-91 | Transactions API failure doesn't crash the page | Simulate a 503 on the transactions endpoint, reload the homepage | User stays on the homepage; the last-transactions container is still visible (degrades gracefully) | P1 |
| HP-92 | Bills API failure doesn't crash the page | Simulate a 503 on the bills endpoint, reload the homepage | User stays on the homepage; the Bills overview heading is still visible | P1 |
| HP-93 | Sub-wallets API failure doesn't crash the page | Simulate a 503 on the sub-wallets endpoint, reload the homepage | User stays on the homepage; the Sub-wallets heading is still visible | P1 |
| HP-94 | Wallet balance API failure doesn't crash the page | Simulate a 503 on the wallet endpoint, reload the homepage | User stays on the homepage; the wallet balance container is still visible | P1 |
| HP-95 | Empty widget data doesn't break the page | Force transactions/bills endpoints to return empty payloads, reload the homepage | User stays on the homepage; the greeting text is still visible | P2 |
| HP-96 | Sidebar remains intact after a widget API failure | Simulate a failed widget API call, reload the homepage | All sidebar items (Home, Transactions, brand name) remain visible despite the failure | P2 |

---

### O. Security & edge cases

Context: checks that the homepage does not leak sensitive data through the URL, DOM, or console, and renders cleanly with no untranslated strings or unhandled errors.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| HP-97 | No credentials/tokens in the URL | Inspect the homepage URL | URL contains no password, token, secret, API key, or access-key substrings | P1 |
| HP-98 | No Bearer tokens rendered in page source | Inspect the rendered page HTML | No Bearer-token-like string appears in the HTML source | P1 |
| HP-99 | No sensitive query parameters | Inspect the homepage URL's query string | No parameter names reference token, auth, key, session, or password | P2 |
| HP-100 | No unhandled JS errors on load | Reload the homepage and monitor for uncaught exceptions | No critical unhandled JavaScript errors are raised (ignoring known-benign noise such as ResizeObserver/chunk-load warnings) | P2 |
| HP-101 | No raw i18n keys rendered | Inspect the visible page text | No raw untranslated translation keys (e.g. `some.key`) are shown to the user | P2 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the HomePage feature. The corresponding automated specs live under `BusinessTestCases/homepage/`:

**Functional:**
- `BusinessTestCases/homepage/functional/HomepageBalanceCard.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageBillsSection.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageLogo.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageLogout.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageNotifications.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageProfileMenu.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageQuickActions.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageSession.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageSubWallets.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageSidebarNavigation.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageTransactions.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageTransactionsEmptyState.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageNegative.spec.ts`
- `BusinessTestCases/homepage/functional/HomepageSecurity.spec.ts`

**UI (element/visibility assertions):**
- `BusinessTestCases/homepage/ui/HomepageBalanceCardPage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageBillsOverviewPage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageGreetingPage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageHeaderPage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageLogoPage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageQuickActionsPage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageSubWalletsPage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageUrlTitlePage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageSidebarNavigationPage.spec.ts`
- `BusinessTestCases/homepage/ui/HomepageTransactionsPage.spec.ts`

**Supporting helper:** `BusinessTestCases/homepage/HomePageHelper.ts` (login/session bootstrap, the two-account pool used to exercise both populated-transactions and empty-transactions states, and shared timing constants referenced throughout the specs above).

---

<!-- source: Login.md -->
## Login

## Manual Test Cases — Login

Context: the Login feature is the Business-portal sign-in flow at `/business/auth/login` (EMI/wallet web app). A user enters a Company Number, Mobile Number, and Password; on submit, a 3-step "Just a moment..." validation card runs (Verifying your credentials → Preparing this device → Securing your session), after which the user either lands on the Dashboard directly or is prompted for a one-time password (OTP), depending on whether OTP is enabled for the account/environment. Underneath the UI, sign-in is backed by a pre-auth device-registration chain (`GET /devices/ip-address` → `POST /devices/uuid`) followed by `POST /auth/signin` and, when applicable, `POST /auth/verify/otp`.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Page elements & layout

Context: static content and controls present on first load of the login page, before any interaction.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-01 | Login URL loads | Navigate to `/business/auth/login` | Page loads at the login URL | P1 |
| LG-02 | Page title correct | Load the login page | Browser tab title is "EMI - Business" | P3 |
| LG-03 | Login form container visible | Load the login page | The login form box is visible | P1 |
| LG-04 | "Login" eyebrow text | Load the login page | An eyebrow label reading "Login" is shown above the form | P3 |
| LG-05 | Welcome heading | Load the login page | Heading reads "Welcome to MJD Pay" | P3 |
| LG-06 | Tagline text visible | Load the login page | A tagline/description sentence is visible below the heading | P3 |
| LG-07 | MJD Pay logo visible | Load the login page | The MJD Pay logo image is visible | P2 |
| LG-08 | Logo is a clickable link | Load the login page | The logo is wrapped in a clickable link | P3 |
| LG-09 | EN language button visible and active by default | Load the login page | "EN" button is visible and marked active (pressed) | P2 |
| LG-10 | Arabic language button visible, inactive by default | Load the login page | "العربية" button is visible and not marked active | P2 |
| LG-11 | Switching to Arabic activates it | Click the "العربية" button | Arabic button becomes active | P2 |
| LG-12 | Switching back to EN | With Arabic active, click "EN" | EN button becomes active again | P2 |
| LG-13 | Theme toggle visible | Load the login page | A "Switch theme" button is visible | P3 |
| LG-14 | Theme toggle changes appearance | Click the theme toggle | Page's visual theme (light/dark) changes | P3 |
| LG-15 | Company Number label visible | Load the login page | "Company" field label is visible | P3 |
| LG-16 | Company Number input enabled | Load the login page | Company number input is visible and enabled | P1 |
| LG-17 | Company Number placeholder | Load the login page | Input shows placeholder text "Eg. 153165659" | P3 |
| LG-18 | Company Number clear button appears when filled | Type a value into Company Number | A clear ("x") button appears on the field | P3 |
| LG-19 | Company Number clear button empties the field | Fill Company Number, click its clear button | Field value is cleared | P3 |
| LG-20 | Mobile Number label visible | Load the login page | "Mobile" field label is visible | P3 |
| LG-21 | Country flag shown | Load the login page | A country flag icon is shown next to the mobile field | P3 |
| LG-22 | Country code shown | Load the login page | Country code "(+966)" is displayed next to the mobile field | P2 |
| LG-23 | Mobile Number input enabled | Load the login page | Mobile input is visible and enabled | P1 |
| LG-24 | Password label visible | Load the login page | "Password" field label is visible | P3 |
| LG-25 | Password masked by default | Load the login page | Password input type is masked (`password`) | P1 |
| LG-26 | Show-password toggle visible | Load the login page | A show/hide password toggle button is visible | P2 |
| LG-27 | Forgot Password link visible | Load the login page | "Forgot Password?" link is visible | P2 |
| LG-28 | Log In button visible | Load the login page | "Log In" button is visible | P1 |
| LG-29 | Log In button disabled on load | Load the login page with all fields empty | "Log In" button is disabled | P1 |
| LG-30 | "New to MJD PAY?" text visible | Load the login page | Prompt text "New to MJD PAY?" is visible | P3 |
| LG-31 | Sign Up link visible | Load the login page | "Sign Up" link is visible | P2 |

---

### B. Form validation & button state

Context: the "Log In" button's enabled/disabled state and field-level input constraints.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-32 | Disabled with all fields empty | Load the login page, submit nothing | "Log In" button is disabled | P1 |
| LG-33 | Disabled with only Company filled | Fill Company Number only | Button remains disabled | P2 |
| LG-34 | Disabled with only Mobile filled | Fill Mobile Number only | Button remains disabled | P2 |
| LG-35 | Disabled with only Password filled | Fill Password only | Button remains disabled | P2 |
| LG-36 | Disabled with Company + Mobile, no Password | Fill Company and Mobile, leave Password empty | Button remains disabled | P2 |
| LG-37 | Disabled with Company + Password, no Mobile | Fill Company and Password, leave Mobile empty | Button remains disabled | P2 |
| LG-38 | Disabled with Mobile + Password, no Company | Fill Mobile and Password, leave Company empty | Button remains disabled | P2 |
| LG-39 | Enabled when all three fields filled | Fill Company, Mobile, and Password with valid-looking values | Button becomes enabled | P1 |
| LG-40 | Disabled again after clearing Company | Fill all fields, then clear Company Number | Button becomes disabled again | P2 |
| LG-41 | Disabled again after clearing Mobile | Fill all fields, then clear Mobile Number | Button becomes disabled again | P2 |
| LG-42 | Disabled again after clearing Password | Fill all fields, then clear Password | Button becomes disabled again | P2 |
| LG-43 | Whitespace-only Company keeps button disabled | Enter only spaces into Company Number, fill Mobile and Password validly | Button remains disabled | P3 |
| LG-44 | Mobile too short (4 digits) | Fill Company/Password validly, enter a 4-digit mobile | Button remains disabled | P2 |
| LG-45 | Mobile one digit short (8 digits) | Enter an 8-digit mobile number | Button remains disabled | P2 |
| LG-46 | Mobile with leading zero rejected | Enter a mobile number with a leading `0` (10 digits total) | Button remains disabled | P2 |
| LG-47 | Mobile field truncates beyond 9 digits | Type a 10-digit mobile number | Field value is trimmed down to the first 9 digits | P2 |
| LG-48 | Mobile not starting with 5 rejected | Enter a valid-length mobile number starting with a digit other than 5 | Button remains disabled | P2 |
| LG-49 | Mobile field rejects letters | Type alphabetic characters into the Mobile field | Field stays empty / characters are not accepted | P2 |
| LG-50 | Mobile field rejects special characters | Type symbols (e.g. `!@#`) into the Mobile field | Field stays empty / characters are not accepted | P2 |
| LG-51 | Valid 9-digit mobile starting with 5 enables button | Enter a valid 9-digit mobile starting with 5, with other fields valid | Button becomes enabled | P1 |
| LG-52 | Show-password toggle reveals text | Enter a password, click the show-password toggle | Password field switches from masked to plain text | P2 |
| LG-53 | Show-password toggle re-masks on second click | With password revealed, click the toggle again | Password field re-masks | P2 |

---

### C. Validation card ("Just a moment...")

Context: after submitting valid-looking credentials, a modal card appears showing a 3-step progress sequence before OTP or dashboard redirect.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-54 | "Just a moment..." heading appears on submit | Fill valid credentials and submit | A "Just a moment..." card appears | P1 |
| LG-55 | Subtitle text shown | Submit valid credentials | Card shows subtitle "We're preparing a secure session for this device." | P3 |
| LG-56 | All three step labels shown | Submit valid credentials | Card lists "Verifying your credentials", "Preparing this device", and "Securing your session" | P2 |
| LG-57 | Step 1 marked complete with checkmark | Submit valid credentials, observe the card | "Verifying your credentials" shows a checkmark/success indicator once done | P3 |
| LG-58 | Step 2 marked complete with checkmark | Submit valid credentials, observe the card | "Preparing this device" shows a checkmark/success indicator once done | P3 |
| LG-59 | Step 3 shows a spinner while in progress | Submit valid credentials, observe the card | "Securing your session" shows a spinner/loading indicator while active | P3 |
| LG-60 | Card dismisses after all steps complete | Submit valid credentials, wait | The "Just a moment..." card disappears once all 3 steps finish | P1 |
| LG-61 | Card does NOT appear on wrong password | Submit with a wrong password | "Just a moment..." card never appears | P1 |
| LG-62 | Redirect to dashboard when OTP is disabled | Submit valid credentials in an environment/account where OTP is disabled | After the card dismisses, the OTP dialog does not appear and the user is redirected to a non-login URL | P1 |
| LG-63 | OTP dialog appears when OTP is enabled | Submit valid credentials in an environment/account where OTP is enabled | After the card dismisses, an "Enter OTP" dialog appears with heading, instructions, input(s), Verify and Cancel buttons | P1 |

---

### D. OTP verification

Context: when OTP is enabled for the account, a one-time password dialog appears after the validation card. OTP digits arrive via SMS (in dev environments the OTP is always `00000000`).

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-64 | OTP dialog displays after valid login | Submit valid credentials (OTP enabled) | OTP dialog with heading "Enter OTP" is shown | P1 |
| LG-65 | Verify button disabled when OTP empty | Open the OTP dialog, leave inputs empty | "Verify" button is disabled | P1 |
| LG-66 | Verify button disabled when OTP partially filled | Fill only some of the OTP digit inputs | "Verify" button remains disabled | P2 |
| LG-67 | Verify button enabled once all OTP digits filled | Fill every OTP digit input | "Verify" button becomes enabled | P1 |
| LG-68 | OTP input rejects non-numeric characters | Type a letter into an OTP digit input | Input does not accept the character; value stays empty | P2 |
| LG-69 | Focus auto-advances between OTP digits | Type a digit into the first OTP input | Focus automatically moves to the next input | P2 |
| LG-70 | Resend button disabled during countdown | Open the OTP dialog | "Click to resend" is disabled while a countdown timer is visible and running | P2 |
| LG-71 | Resend enabled after countdown expires and clears inputs | Wait for the countdown to reach zero, click Resend | Resend button becomes enabled; clicking it clears any entered OTP digits | P2 |
| LG-72 | Cancel closes the OTP dialog | Click "Cancel" on the OTP dialog | OTP dialog closes | P1 |
| LG-73 | Cancel returns to the login form | Click "Cancel" on the OTP dialog | User is returned to the login form with the "Log In" button visible | P1 |
| LG-74 | Wrong OTP keeps user on the OTP dialog | Enter an incorrect OTP (e.g. `11111111`), click Verify | Dialog remains open (does not redirect); an error is expected to surface | P1 |
| LG-75 | Correct OTP logs the user in | Enter the correct OTP (retrieved via SMS or, in dev, `00000000`), click Verify | User is redirected away from the login page to the dashboard | P1 |

---

### E. Happy path — successful login end to end

Context: full journey from empty login form through dashboard landing and logout, using a known-valid Company/Mobile/Password combination.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-76 | Login form present on load | Load the login page | Company, Mobile, Password inputs and a disabled "Log In" button are all visible | P1 |
| LG-77 | Button enables once all fields are filled | Fill Company, Mobile, Password with valid values | "Log In" button becomes enabled | P1 |
| LG-78 | Validation card dismisses on valid login | Submit valid credentials | "Just a moment..." card disappears within a reasonable time | P1 |
| LG-79 | Redirect away from login on valid login | Submit valid credentials, complete OTP if prompted | Browser URL is no longer the login/auth URL | P1 |
| LG-80 | Dashboard sidebar logo and brand shown | Complete login | Sidebar shows the app logo and brand name | P2 |
| LG-81 | Dashboard sidebar navigation shown | Complete login | Sidebar shows Home, Transactions, and Payments navigation links | P2 |
| LG-82 | Header profile & notification icons shown | Complete login | Header shows a profile menu trigger and a notifications icon | P2 |
| LG-83 | Wallet balance widget shown | Complete login | Dashboard shows a wallet balance (SAR) widget | P2 |
| LG-84 | Last transactions widget shown | Complete login | Dashboard shows a "last transactions" section/container | P2 |
| LG-85 | Last login timestamp shown | Complete login | Dashboard shows the last-login timestamp text | P3 |
| LG-86 | Logout returns to login page | Complete login, then log out via the profile menu | User is returned to the login page URL | P1 |

---

### F. Invalid credentials

Context: submitting mismatched or unregistered credentials must fail safely, without redirecting or leaking details.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-87 | Wrong password keeps user on login page | Submit a valid Company/Mobile with a wrong password | User remains on the login page URL | P1 |
| LG-88 | Wrong company number keeps user on login page | Submit an invalid Company Number with a valid Mobile/Password | User remains on the login page URL | P1 |
| LG-89 | Wrong mobile number keeps user on login page | Submit a valid Company/Password with an unregistered Mobile | User remains on the login page URL | P1 |
| LG-90 | All three fields wrong keeps user on login page | Submit an invalid Company, Mobile, and Password together | User remains on the login page URL | P1 |
| LG-91 | Error toast shown on wrong credentials | Submit any invalid credential combination | An error toast/snackbar appears | P1 |
| LG-92 | Unregistered mobile shows a generic error | Submit a valid Company/Password with a mobile number that isn't registered | An error toast appears | P1 |
| LG-93 | Not-registered error has no technical detail | Trigger the not-registered error (LG-92) | Toast detail text contains no stack trace, SQL, exception, or internal-system wording | P2 |
| LG-94 | Re-submitting after a failed attempt is allowed | Submit wrong credentials, observe the error, then resubmit | "Log In" button remains visible and enabled for another attempt | P2 |
| LG-95 | Field values preserved after a failed attempt | Submit wrong password, observe the error toast | Company and Mobile fields retain their previously entered values | P2 |
| LG-96 | Server 500 handled gracefully | Trigger a server error (500) on the sign-in call | An error toast is shown and the user remains on the login page (no crash, no blank screen) | P2 |

---

### G. Account status errors (locked / deactivated / AML)

Context: accounts in a restricted state must reject login with a generic message and must never proceed to the OTP step.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-97 | Locked account rejected without OTP | Submit valid credentials for a locked account | An error toast is shown; the "Enter OTP" dialog never appears | P1 |
| LG-98 | Deactivated account rejected without OTP | Submit valid credentials for a deactivated account | An error toast is shown; the "Enter OTP" dialog never appears | P1 |
| LG-99 | AML-blocked account shows a generic rejection | Submit valid credentials for an AML-restricted account | A generic error toast is shown; the "Enter OTP" dialog never appears | P1 |
| LG-100 | AML/compliance detail not exposed | Trigger the AML rejection (LG-99) | Toast text contains no "AML", "compliance", "sanction", "blacklist", "suspicious", "investigation", or technical/internal wording | P1 |

---

### H. Navigation & links

Context: links and controls on the login page that route elsewhere or affect page-level state.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-101 | Forgot Password link navigates correctly | Click "Forgot Password?" | Browser navigates to a forgot-password URL | P1 |
| LG-102 | Sign Up link navigates away from login | Click "Sign Up" | Browser navigates away from the login URL (to registration) | P1 |
| LG-103 | Logo link navigates to a valid page | Click the MJD Pay logo | Browser navigates to a valid page on the majdpay.com domain | P3 |
| LG-104 | Already-authenticated user is redirected away from login | With an active session, navigate directly to the login URL | User is redirected away from the login page (not shown the login form again) — verify current behavior, as this path is currently unconfirmed/disabled in automation | P2 |

---

### I. Security-relevant behavior

Context: cases guarding against enumeration, brute force, injection, and information disclosure.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-105 | Account locks after repeated failed attempts | Submit a wrong password for the same account 3 times in a row, then submit the correct password | The account is locked out; even the correct password now shows an error toast and no OTP dialog | P1 |
| LG-106 | Wrong company vs. wrong mobile give identical response | Submit (a) a wrong company with a valid mobile/password, then (b) a valid company with a wrong mobile/password | Both attempts produce the same generic error behavior — no signal reveals which field was wrong (anti-enumeration) | P1 |
| LG-107 | Script injection in Company field is inert | Type `<script>alert(1)</script>` into the Company Number field, fill remaining fields, submit | No JavaScript dialog/alert fires; the raw script tag never renders as page content | P1 |
| LG-108 | Script injection in Password field is inert | Type `<script>alert(1)</script>` into the Password field | No JavaScript dialog/alert fires | P1 |
| LG-109 | Login request uses POST, not URL parameters | Submit valid credentials while inspecting network traffic | The sign-in request is a POST; neither the username/company nor password appear anywhere in the request URL | P1 |
| LG-110 | Failed-login error has no internal details | Submit clearly invalid credentials (bad company, bad mobile, bad password) | Any error message shown contains no stack trace, SQL, database, or internal exception text | P1 |

---

### J. API contract (sign-in chain)

Context: the login UI is backed by three API calls in sequence — device IP lookup, device UUID registration, and sign-in (with optional OTP verification). These are useful for manual API-level exploration (e.g. via Postman) alongside UI testing.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-111 | GET /devices/ip-address succeeds | Call `GET /devices/ip-address` with standard headers | Returns 200 with JSON content-type and an `ipAddress` string field | P2 |
| LG-112 | POST /devices/uuid succeeds | Call `POST /devices/uuid` with a valid device payload (deviceId, platform, manufacturer, etc.) | Returns 200 with a `uuid` field in standard UUID format | P2 |
| LG-113 | POST /devices/uuid rejects empty body | Call `POST /devices/uuid` with an empty body | Returns 400/422 | P3 |
| LG-114 | POST /devices/uuid rejects missing deviceId | Call `POST /devices/uuid` omitting `deviceId` | Returns 400/422 | P3 |
| LG-115 | POST /auth/signin succeeds with valid credentials | Call `POST /auth/signin` with valid `username` (+966-prefixed mobile), `password`, `tenantNumber` | Returns 200 with an `accessToken` object containing `token`, `expirationDuration`, `profileId`, `username`, `userId`, `tenantNumber` | P1 |
| LG-116 | accessToken.tenantNumber matches submitted tenant | Inspect the sign-in response from LG-115 | `accessToken.tenantNumber` equals the submitted `tenantNumber` | P2 |
| LG-117 | accessToken.expirationDuration is a positive number | Inspect the sign-in response from LG-115 | `expirationDuration` is a positive numeric value | P3 |
| LG-118 | POST /auth/signin rejects empty body | Call `POST /auth/signin` with an empty body | Returns 400/422 | P2 |
| LG-119 | POST /auth/signin rejects missing username | Call `POST /auth/signin` omitting `username` | Returns 400/422 | P2 |
| LG-120 | POST /auth/signin rejects missing password | Call `POST /auth/signin` omitting `password` | Returns 400/422 | P2 |
| LG-121 | POST /auth/signin rejects missing tenantNumber | Call `POST /auth/signin` omitting `tenantNumber` | Returns 400/422 | P2 |
| LG-122 | POST /auth/signin returns 401 on wrong password | Call `POST /auth/signin` with a valid username/tenant and wrong password | Returns 401 | P1 |
| LG-123 | POST /auth/signin returns 401 on unrecognised tenant | Call `POST /auth/signin` with an unrecognised `tenantNumber` | Returns 401 | P1 |
| LG-124 | POST /auth/signin returns 401 on unrecognised username | Call `POST /auth/signin` with an unrecognised mobile/username | Returns 401 | P1 |
| LG-125 | POST /auth/signin rejects mobile without country code | Call `POST /auth/signin` with `username` missing the `+966` prefix | Returns 400 or 401 | P2 |
| LG-126 | GET /auth/signin is not a valid method | Call `GET /auth/signin` | Does not return 200 (method not allowed / not found) | P2 |
| LG-127 | POST /auth/verify/otp succeeds with correct OTP | After a valid sign-in, call `POST /auth/verify/otp` with the correct OTP and bearer token | Returns 200/201 | P1 |
| LG-128 | POST /auth/verify/otp rejects incorrect OTP | Call `POST /auth/verify/otp` with a wrong OTP and valid bearer token | Returns 401 | P1 |
| LG-129 | POST /auth/verify/otp rejects missing OTP field | Call `POST /auth/verify/otp` with an empty body and valid bearer token | Returns 400/422 | P2 |
| LG-130 | POST /auth/verify/otp rejects missing auth header | Call `POST /auth/verify/otp` with a valid OTP but no Authorization header | Returns 401 | P2 |
| LG-131 | Full pre-auth + sign-in chain succeeds end to end | Call IP lookup → device UUID registration → sign-in in sequence with valid data | Each step returns success and the final sign-in response contains a non-empty `accessToken.token` | P1 |

---

### K. NAFATH / WATHIQ data expiry & renewal (EMI-5836)

Context: EMI-5836 ("BE - Block login when Nafath or Yaqeen TTL /data has expired") blocks login when a customer's NAFATH (National ID/Iqama) or WATHIQ (CRN) data is stale. Two independent expiry types exist per provider — **document expiry** (the real-world ID/CRN has expired) and **Redis TTL expiry** (only the cached copy has expired) — and must not be conflated in error messaging. Note: the ticket title says "Yaqeen", but the ticket description and every comment on it refer only to NAFATH and WATHIQ — no "Yaqeen" system is described anywhere in the source ticket. Confirm with the reporter whether the title is a naming error before treating "Yaqeen" as in scope.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| LG-132 | Login blocked — NAFATH document expired | Attempt login for an account whose National ID/Iqama has expired | 409 returned with error code `NAFATH_DATA_EXPIRED`; login rejected | P1 |
| LG-133 | Login blocked — WATHIQ document expired | Attempt login for a profile whose CRN has expired | 409 returned with error code `WATHIQ_DATA_EXPIRED`; login rejected | P1 |
| LG-134 | Login blocked — NAFATH Redis TTL expired, document still valid | Attempt login where only the NAFATH cache TTL has expired | 409 returned with an error distinct from `NAFATH_DATA_EXPIRED`, indicating cache expiry not document expiry | P1 |
| LG-135 | WATHIQ Redis TTL expired — auto-heals, login should succeed | Attempt login after the WATHIQ TTL-monitoring job has silently refreshed the cache (CRN still valid) | Login succeeds (200); no user interaction required | P1 |
| LG-136 | WATHIQ Redis TTL expired — refresh reveals CRN actually expired | Attempt login where the TTL-refresh job discovers the CRN itself has expired | 409 `WATHIQ_DATA_EXPIRED` (document-expiry variant); profile deactivated | P2 |
| LG-137 | Both NAFATH and WATHIQ expired simultaneously | Attempt login for an account with both flags true | 409 returned; confirm which error code takes precedence — undocumented in the ticket, verify against the actual response | P2 |
| LG-138 | Unaffected account logs in normally (regression) | Attempt login for an account with neither flag set | Login succeeds (200), no change from pre-EMI-5836 behavior | P1 |
| LG-139 | NAFATH revalidation flow succeeds | From a blocked account, complete Generate Random + Get Status | `is_nafath_data_expired` reset; DB/Redis updated; login subsequently succeeds | P1 |
| LG-140 | NAFATH revalidation flow fails/abandoned | From a blocked account, fail or abandon re-verification | Flag remains true; login still rejected with 409 `NAFATH_DATA_EXPIRED` | P2 |
| LG-141 | WATHIQ revalidation flow succeeds | From a blocked profile, call the WATHIQ refresh API after renewing the CRN | `is_wathiq_data_expired` reset; DB/Redis updated; login subsequently succeeds | P1 |
| LG-142 | WATHIQ revalidation flow — CRN still expired | Call the WATHIQ refresh API without having renewed the CRN | Flag remains true; login still rejected with 409 `WATHIQ_DATA_EXPIRED` | P2 |
| LG-143 | NAFATH expiry deactivates the user, not the profile | Expire NAFATH data for a user linked to 2+ business profiles, run the validation job | The USER entity is deactivated; linked business profiles are unaffected (per Amer Majed Abdalrazeq's 2026-07-16 clarification) | P1 |
| LG-144 | WATHIQ expiry deactivates the profile, not the user | Expire WATHIQ CRN for a profile, run the validation job | The PROFILE is deactivated (business-scoped) | P2 |
| LG-145 | Error responses carry no internal detail | Trigger each of LG-132/133/134 | Response body/text contains no stack trace, SQL, or exception text | P1 |
| LG-146 | PR and code review sign-off completed | Check the linked PR for EMI-5836 | PR exists, is linked to the ticket, and has Senior Engineer approval — required by the ticket's own acceptance criteria | P3 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Login feature. The corresponding automated specs are:

- `BusinessTestCases/login/ui/LoginPage.spec.ts` — page elements & layout (Section A)
- `BusinessTestCases/login/functional/LoginFormValidation.spec.ts` — button state & field validation (Section B)
- `BusinessTestCases/login/ui/LoginValidationPopup.spec.ts` — validation card UI (Section C)
- `BusinessTestCases/login/functional/LoginOtpFlow.spec.ts` — validation card negative/detail cases and OTP verification (Sections C & D)
- `BusinessTestCases/login/functional/LoginHappyPath.spec.ts` — end-to-end successful login and dashboard landing (Section E)
- `BusinessTestCases/login/functional/LoginInvalidCredentials.spec.ts` — invalid credentials, account status errors, and edge cases (Sections F & G)
- `BusinessTestCases/login/functional/LoginNavigation.spec.ts` — navigation links and already-authenticated redirect (Section H)
- `BusinessTestCases/login/functional/LoginSecurity.spec.ts` — lockout, enumeration, XSS, POST-only, and error-detail checks (Section I)
- `BusinessTestCases/login/api/LoginAPIFlow.spec.ts` — device/sign-in/OTP API contract (Section J)
- `BusinessTestCases/login/api/LoginNafathWathiqExpiry.spec.ts` — NAFATH/WATHIQ document & TTL expiry, revalidation flows, and deactivation scope (Section K, EMI-5836). Document-expiry cases (LG-132, LG-133, LG-138) run against dedicated env-gated accounts (`NAFATH_EXPIRED_COMPANY/MOBILE`, `WATHIQ_EXPIRED_COMPANY/MOBILE` in `LoginHelper.ts`) and are skipped until those are provisioned in UAT. The remaining cases (TTL-only expiry, revalidation APIs, deactivation scope) are written as `test.skip(true, ...)` pending Redis-seeding access and confirmation of the renewal endpoint paths against the Emi Profile Service Swagger doc — see the file header for details.

Supporting helpers referenced by these specs: `BusinessTestCases/login/LoginHelper.ts` (test data, OTP retrieval via MongoDB, login helpers) and `BusinessTestCases/pageElements/LoginPage.ts` (the page object for all locators and actions used above).

---

<!-- source: ManageAccounts.md -->
## ManageAccounts

## Manual Test Cases — Manage Accounts (Manage Beneficiary + Manage Users)

Context: the Business Portal's **Manage Accounts** sidebar section holds two sub-modules —
**Manage Beneficiary** (add/approve/list the parties a merchant or biller can bill) and
**Manage Users** (staff users, plus the Access & Permissions groups and roles that gate what
those staff users can do). This document is the Jira → test-ID traceability map for both.

Every case below is automated in the repo; the automation ID column is the exact `test()` title
prefix used in the spec files, so `npx playwright test --grep "MUB-03"` runs a single case.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary
behavior, **P3** = edge case / polish.

> **Data caveat.** The whole Manage Accounts area mutates records that cannot be reverted from
> the Business Portal — a created staff user burns a National ID and a mobile number, an approved
> beneficiary cannot be un-approved. The automated suites are therefore **mock-driven**
> (`page.route()`), following the same decision already made for Sub-Wallets and Payment Links.
> The endpoints listed under "Confirmed endpoints" below are the ones lifted verbatim from ticket
> curl blocks and AC tables; the rest are inferred and must be reconciled on the first live run.

### Confirmed endpoints

| Endpoint | Source ticket |
|---|---|
| `GET /api/v1/beneficiary?page&size&statusCode` | EMI-5652 curl, EMI-3736 |
| `PUT /api/v1/beneficiary/approve` — `BILLER_APPROVE_BENEFICIARIES` | EMI-4436 AC table |
| `PUT /api/v1/beneficiary/reject` — `BILLER_REJECT_BENEFICIARIES` | EMI-4436 AC table |
| `POST /api/v1/beneficiary-otp` | EMI-5864 curl |
| `POST /api/v1/beneficiary-otp/resend` | EMI-5769 curl |
| `DELETE /emi-profile/api/v1/groups/{id}/unassign-users` | EMI-5234 curl |

Everything under `/api/v1/users`, `/api/v1/groups`, `/api/v1/roles` is **inferred** — no Manage
Users ticket attached a curl repro.

---

### A. Manage Beneficiary — core flow (pre-existing)

Covered by `BusinessTestCases/BeneficiaryManagement/functional/BeneficiaryManagementFlow.spec.ts`
(IDs `BM-01`..`BM-14`, mapped to `B2B-Transactions.md` section S). Not re-listed here.

### B. Manage Beneficiary — approval workflow

Spec: `BeneficiaryManagement/functional/BeneficiaryApproval.spec.ts`

| ID | Jira | Title | Expected Result | Priority |
|---|---|---|---|---|
| BA-01 | EMI-4435, EMI-4436 | Privileged staff approves a pending beneficiary | `PUT /beneficiary/approve` → 200, status becomes `APPROVED` | P1 |
| BA-02 | EMI-4435, EMI-4436 | Privileged staff rejects a pending beneficiary | `PUT /beneficiary/reject` → 200, status becomes `REJECTED` | P1 |
| BA-03 | EMI-4435 | Unprivileged staff is refused by the API, not only by a hidden button | Both endpoints → 403 `UNAUTHORIZED_EXCEPTION` | P1 |
| BA-03b | EMI-4436 | Details screen hides Approve/Reject without the privilege | Neither action rendered | P2 |
| BA-04 | EMI-4436 | Actions disappear once the beneficiary is approved | "do not show actions if user is approved" | P2 |
| BA-05 | EMI-4009 | Bill creation with an APPROVED beneficiary succeeds | 200 | P1 |
| BA-06 | EMI-4009, EMI-4905 | Bill creation with PENDING or REJECTED is rejected | 400 `BENEFICIARY_NOT_APPROVED` | P1 |
| BA-07 | EMI-4805, EMI-4905 | An APPROVED-only query never returns PENDING/REJECTED | Every row `APPROVED` | P1 |
| BA-08 | EMI-4805 | Clearing the filter does not silently resurface REJECTED rows as selectable | Rejected rows stay visibly flagged; the selection gate is BA-06 | P2 |

### C. Manage Beneficiary — bug regressions

Spec: `BeneficiaryManagement/functional/BeneficiaryManagementBugs.spec.ts`

| ID | Jira | Title | Expected Result | Priority |
|---|---|---|---|---|
| BMB-01 | EMI-3686 | Duplicate CRN shows "already added", not a success message | 400 `BENEFICIARY_ALREADY_EXISTS` | P1 |
| BMB-01b | EMI-4414 | A genuinely new beneficiary is not wrongly told it exists | 200, no "already exists" text | P1 |
| BMB-02 | EMI-4741, EMI-5448 | Add an individual by phone number | 200 | P1 |
| BMB-02b | EMI-4431, EMI-4432 | Contract attachment is optional on add-by-unified-number | 200 with `contract: null` | P2 |
| BMB-03 | EMI-5864 | Submitting the form triggers `POST /beneficiary-otp` | 200, OTP issued | P1 |
| BMB-03b | EMI-5692, EMI-5769, EMI-5800 | Resend OTP works | 200 — not 500, not 403 | P1 |
| BMB-04 | EMI-4812 | Status filter reaches the API and narrows the list | `statusCode` sent; rows match | P1 |
| BMB-05 | EMI-5652, EMI-5376, EMI-5128 | Every row carries a non-empty beneficiary identifier | `beneficiaryIdentifier` present | P1 |
| BMB-06 | EMI-5142 | The list shows the alias, not the company/brand name | Alias rendered | P2 |
| BMB-07 | EMI-5153, EMI-5073 | 413 on contract upload surfaces the real size limit | "exceeds the maximum allowed size (50MB)", never "Something Went Wrong!" | P2 |
| BMB-08 | EMI-4791 | Stored contract attachment is retrievable | 200 `application/pdf` | P2 |
| BMB-09 | EMI-5130 | A maker holding the view privilege sees admin beneficiaries | 200 with rows, not 403 | P1 |
| BMB-10 | EMI-4882 | Status action button and delete icon do not overlap | Bounding boxes disjoint | P3 |
| BMB-11 | EMI-5376, EMI-5142 | Details screen shows both identifier and alias | Both populated | P2 |

**Not automated (out of scope for the web suite):** EMI-5118 (OTP *email* delivery to the biller
mailbox — needs the IMAP fixture pointed at a biller inbox, not the shared test mailbox),
EMI-5317 (customer-app `/customer/beneficiary/local-bank`, not the Business Portal), EMI-3624 /
EMI-3625 / EMI-3664 (Select Beneficiary popup inside the Create Bill flow — belongs in
`BillManagement/`, not here), EMI-5107 (iOS Arabic rendering).

### D. Manage Users — core flow

Spec: `UserManagement/functional/ManageUsers.spec.ts`

| ID | Jira | Title | Expected Result | Priority |
|---|---|---|---|---|
| MU-01 | EMI-4742 | List renders Full Name, User Group, Mobile Number, Status | All four columns populated | P1 |
| MU-02 | — | Empty state instead of a broken table | Empty-state message, no error toast | P2 |
| MU-03 | EMI-4847 | Create form asks for National ID / Iqama, no first/last name | Name fields absent | P1 |
| MU-04 | EMI-4742 | Valid details create the user and it appears in the list | New row visible with all fields | P1 |
| MU-05 | — | Empty form is blocked with a required-field message | Submit disabled or field error | P2 |
| MU-06 | EMI-4847 | Nafath screen opens once the record is created | Nafath step visible | P1 |
| MU-07 | EMI-4844, EMI-4812 | Status filter works for each of the five live statuses | Rows match the selected status | P1 |
| MU-08 | — | Editing a user updates their group | Success message | P1 |
| MU-09 | EMI-4844 | Deactivating an active user | Status → `DEACTIVATED` | P1 |
| MU-10 | EMI-4844 | Reactivating a deactivated user | Status → `ACTIVE` | P1 |

User lifecycle per EMI-4844: `PENDING_VERIFICATION` → `UNDER_REVIEW` → `ACTIVE` → `DEACTIVATED`,
plus `REJECTED` and `DELETED`.

### E. Manage Users — bug regressions

Spec: `UserManagement/functional/UserManagementBugs.spec.ts`

| ID | Jira | Title | Expected Result | Priority |
|---|---|---|---|---|
| MUB-01 | EMI-4742 | New user appears in the list with all four columns filled | No blank row | P1 |
| MUB-02 | EMI-5000 | Full Name never renders "Undefined Undefined" | Real name shown | P1 |
| MUB-03 | EMI-4812, EMI-4683 | Status filter sends `statusCode` and narrows the list | Param sent; one matching row | P1 |
| MUB-04 | EMI-5285 | Manage Users list endpoint returns 200 | Table renders, no error | P1 |
| MUB-05 | EMI-5815 | Create-user endpoint returns 200 | User created | P1 |
| MUB-06 | EMI-5816 | Changing a user group returns 200 | Group updated | P1 |
| MUB-07 | EMI-5583, EMI-5584 | Groups render on the edit screen, without an empty flash | Options present; no stuck spinner | P2 |
| MUB-08 | EMI-4997 | A new user gets only explicitly assigned privileges | No `SUPER_ADMIN` inheritance | P1 |
| MUB-09 | EMI-5085, EMI-5078 | Activate/deactivate works when the privilege is granted | 200, no 403/405 | P1 |
| MUB-10 | EMI-5817 | Password reset completes without a Forbidden redirect | 200, no Forbidden page | P1 |
| MUB-11 | EMI-5092, EMI-5112 | Add User settles — never an endless spinner or bare "Something went wrong" | Success or a specific validation message | P2 |

**Not automated:** EMI-4907 (new users cannot log in — the ticket has no steps, actual, or
expected recorded; needs triage before a test can be written), EMI-5113 (iOS keyboard layout),
EMI-5155 / EMI-5179 (invalid unified number — that is Wallet Configuration → Merchant tab, a
different module).

### F. Access & Permissions — groups and roles

Spec: `UserManagement/functional/GroupsRolesPermissions.spec.ts`

| ID | Jira | Title | Expected Result | Priority |
|---|---|---|---|---|
| GR-01 | EMI-5583 | Groups tab lists name, description, assigned-user count | All groups rendered | P1 |
| GR-02 | — | Roles tab lists roles without a stuck loading state | Roles rendered | P1 |
| GR-03 | EMI-5210, EMI-5613 | Editing a role name and description saves | 200, success message (not 400, not 403) | P1 |
| GR-04 | EMI-5240 | An authorised admin deletes a non-system group | 200, no Forbidden | P1 |
| GR-05 | EMI-5897 | A group flagged `isSystem` offers no Edit/Delete | Actions absent | P2 |
| GR-06 | EMI-5234, EMI-5899 | Assigning an already-assigned user is rejected | 400 `USER_ALREADY_ASSIGNED` | P2 |
| GR-07 | EMI-5234 | Unassigning a user who is not in the group is rejected | 400 `USER_NOT_ASSIGNED` | P2 |
| GR-08 | SAL-4799 | The role's user count matches the users actually assigned | Count matches | P3 |

### G. Manage Users — UI presence

Spec: `UserManagement/ui/ManageUsersPage.spec.ts` — `MUU-01`..`MUU-05`. Element/text presence
only (table, Add New User button, the four column headers, the Status and Clear Filter controls,
the National ID / Mobile / Group inputs, Save and Cancel), per the repo's `functional/` vs `ui/`
split.

---

### Admin Portal cases — deliberately excluded

Several tickets in this area are **Admin Portal**, not the Business Portal this repo drives:
EMI-4683, EMI-4742, EMI-4997, EMI-5078, EMI-5285, EMI-5583, EMI-5584, EMI-5816, EMI-5817, plus
the whole SAL RBAC set (SAL-4761..SAL-4776, SAL-4789, SAL-4790, SAL-4799). Where the same API
also backs the Business Portal's Manage Users screen, the case is automated here against that
screen and the ticket is cited; where the behaviour is Admin-Portal-only, it is listed above under
"not automated" and stays a manual case pending Admin Portal tooling access — the same rationale
already used by `Reconciliation/` and `TransactionOperations/`.

---

<!-- source: Registration-API.md -->
## Registration-API

## Manual Test Cases — Registration API

Context: the API layer behind Business-portal Merchant registration (`emi-profile-service`, base URL `https://gateway-dev.majdpay.com`) — mobile OTP, identity establishment, file uploads, NAFATH initiation, product selection, contract acceptance, session refresh, and the public lookup endpoints the wizard's dropdowns depend on. Unlike the other Registration docs in this folder (which describe the UI wizard), these cases target the endpoints directly and are also runnable by hand via `postman/Registration-API-majdpay.postman_collection.json`.

IDs here match the existing Playwright test titles verbatim (`API-01` etc. already appear as literal prefixes inside `RegistrationAPIFlow.spec.ts` / `RegistrationSessionRefresh.spec.ts`), rather than a new numbering scheme, so all three artifacts — this doc, the Postman collection, and the automated spec — stay directly cross-referenceable.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Phone Entry

Context: sending and verifying the mobile OTP that starts a registration session.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-01 | Send mobile OTP for an unregistered number | `POST /emi-profile/api/v1/register/mobile/otp` with a fresh KSA mobile number | 200 OK. If `otpRequired` is `true`, a `requestId` is returned; if `false`, `sessionToken`/`refreshToken` objects are returned directly (EMI-5995/EMI-6059) | P1 |
| API-02 | Read the OTP settings for registration | `GET /otp/otp-settings/q?operationCode=REGISTRATION` (public, no token) | 200 OK with `length`, `validityInSeconds`, `canResendOtpAfterInSeconds` | P2 |
| API-03 | Verify the OTP | `POST /emi-profile/api/v1/register/verify/otp` with the mobile number and the correct OTP (dev/UAT accept a fixed `000000`) | 200 OK with a `sessionToken` object (`{token, expirationDuration}`) and a `refreshToken` object (EMI-5995/EMI-6059) | P1 |
| API-04 | Resend the mobile OTP | `POST /emi-profile/api/v1/register/mobile/otp/resend` for a mobile that already requested one | 200 OK with a fresh `requestId` and `otpRequired: true` | P2 |
| API-N1 | Reject an invalid mobile format | `POST /register/mobile/otp` with `mobileNumber: "123"` | 400 Bad Request | P2 |
| API-N2 | Reject a wrong OTP | `POST /register/verify/otp` with a deliberately wrong 6-digit code | 400 Bad Request with an `errorCode` in the body | P1 |
| API-N12 | Mobile OTP works without a session token (negative control) | `POST /register/mobile/otp` with no `Authorization` header at all | Not `401` — this OTP-stage endpoint must never start requiring auth (EMI-5751) | P1 |

### B. Business Info

Context: establishing the applicant's identity and submitting the registration form.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-05 | Set the profile registration type | `POST /register/profile-registration-type` with `profileType: MERCHANT`, `unifiedNumber` (CRN), `nationalId`, `email`, `Authorization: Bearer <sessionToken>` | 201 Created on a fresh identity. A `409` (or a 400 mentioning "already registered"/"duplicate") on an identity reused from a prior run is an expected outcome, not a defect | P1 |
| API-06 | Upload the IBAN proof file | `POST /file/attachment/upload?unifiedNumber={crn}&fileType=iban`, multipart `file` field | 200 OK with a `fileId` | P1 |
| API-07 | Upload the VAT certificate file | `POST /file/attachment/upload?unifiedNumber={crn}&fileType=vat`, multipart `file` field | 200 OK with a `fileId` | P1 |
| API-08 | Submit the full registration | `POST /register` with bank/industry/annual-income codes, IBAN, VAT number, and the two `fileId`s from API-06/07 | 200 OK (a `profileCode` is returned when the backend has assigned one) | P1 |
| API-N3 | Reject profile-registration-type with no token | `POST /register/profile-registration-type` with no `Authorization` header | 401 Unauthorized | P1 |
| API-N4 | Reject an invalid National ID | `POST /register/profile-registration-type` with a National ID that fails validation (e.g. wrong check digit) | 400 Bad Request with `errorCode` matching `INVALID-NATIONAL-ID` | P2 |
| API-N6 | Reject registration submission with no token | `POST /register` with no `Authorization` header | 401 Unauthorized | P1 |

### C. NAFATH

Context: initiating the NAFATH identity-verification redirect. NAFATH approval itself happens on the applicant's device and is out of scope for API testing.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-09 | Initiate NAFATH | `POST /register/uri/status` with `Authorization: Bearer <sessionToken>`, empty body | 200 OK with a `uri` field (the NAFATH redirect URL) | P1 |
| API-N7 | Reject NAFATH initiation with no token | `POST /register/uri/status` with no `Authorization` header | 401 Unauthorized | P1 |

### D. Products

Context: listing and assigning the products the merchant enrolls in.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-10 | List available products | `GET /products` with `Authorization: Bearer <sessionToken>` | 200 OK, a non-empty array of `{id, name, ...}` | P1 |
| API-11 | Assign selected products | `POST /register/products` with `productIds: [id]` | 200 OK | P1 |
| API-N5 | Reject the products list with no token | `GET /products` with no `Authorization` header | 401 Unauthorized | P1 |
| API-N8 | Reject product assignment with no token | `POST /register/products` with no `Authorization` header | 401 Unauthorized | P1 |

### E. Contract

Context: previewing, accepting, and downloading the registration contract.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-12 | Preview the contract | `GET /contracts/preview?profileCode={code}` with `Authorization: Bearer <sessionToken>` | 200 OK | P1 |
| API-13 | Accept the contract | `POST /register/contract/accept` with `productIds`, `contractAccepted: true` | 200 OK — completes registration (creates a "Pending Manual KYB" profile per EMI-122, not an active account) | P1 |
| API-14 | Download the contract PDF | `GET /contracts/generate-file?profileCode={code}` | 200 OK, a PDF file | P2 |
| API-15 | The just-registered account cannot sign in yet | `POST /auth/signin` with the newly registered mobile number and any password | Not `200` — no wallet, Company Number, or login credentials exist until an admin reviews and activates the account (EMI-122) | P1 |
| API-N9 | Reject contract preview with no token | `GET /contracts/preview?profileCode=TEST-0001` with no `Authorization` header | 401 Unauthorized | P1 |
| API-N10 | Reject contract PDF download with no token | `GET /contracts/generate-file?profileCode=TEST-0001` with no `Authorization` header | 401 Unauthorized | P1 |
| API-N11 | Reject contract acceptance with no token | `POST /register/contract/accept` with no `Authorization` header | 401 Unauthorized | P1 |

### F. Session Refresh (EMI-5995 / EMI-6059)

Context: refreshing the registration session token mid-flow without restarting registration. Most cases here need a live session and are env-gated (`REGISTRATION_SESSION_TOKEN` / `REGISTRATION_REFRESH_TOKEN`) because reaching one requires clearing NAFATH, which is not automatable on UAT.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RSR-01 | Mobile OTP response shape | `POST /register/mobile/otp` | Response has `sessionToken`/`refreshToken` keys present (populated only when `otpRequired: false`, otherwise `null`) | P2 |
| RSR-02 | Verify-OTP response shape | `POST /register/verify/otp` on a live session | Both `sessionToken` and `refreshToken` are populated `{token, expirationDuration}` objects (`expirationDuration` in **milliseconds**) | P1 |
| RSR-03 | A valid refresh issues a new session token | `POST /emi-profile/api/v1/register/session/refresh` with `Authorization: Bearer <sessionToken>` and a `refreshToken` **header** | 200 OK with a NEW `sessionToken.token`, different from the one sent in | P1 |
| RSR-03b | The refresh token must be a header, not a body field | Same request, but with `refreshToken` in the JSON body instead of the header | Not `200` — confirms the header-only contract (EMI-6059) | P2 |
| RSR-04 | An invalid refresh token is rejected | `POST /session/refresh` with a deliberately invalid `refreshToken` header | 4xx (400/401/403) | P2 |
| RSR-04b | Refreshing without an active registration session is rejected | `POST /session/refresh` with a valid `refreshToken` header but no `Authorization` | 4xx | P2 |
| RSR-05 | A refreshed session continues the same registration | Compare `GET /register/status` before and after a refresh | The registration step/state is unchanged — no restart | P1 |
| RSR-06 | Registration refresh tokens are isolated from login | `POST /auth/refresh` with a registration `refreshToken` | Not `200` — the two refresh-token families are not interchangeable | P2 |
| RSR-06b | A registration session token cannot authenticate a post-login API | `GET /transactions` with a registration `sessionToken` as the bearer token | Not `200` (401/403) | P2 |

### G. Lookups (public)

Context: the read-only reference-data endpoints the wizard's dropdowns populate. None require an `Authorization` header.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-L1 | List industries | `GET /emi-profile/api/v1/industries` | 200 OK, non-empty array | P2 |
| API-L2 | List banks | `GET /api/v1/lookup/banks` | 200 OK, non-empty array | P2 |
| API-L3 | List transfer purposes | `GET /api/v1/purpose-of-transfer` | 200 OK, array | P3 |
| API-L4 | List transaction types | `GET /api/v1/transaction-types` | 200 OK, array | P3 |
| API-L5 | List payment methods | `GET /api/v1/payment-method` | 200 OK, array | P3 |
| API-L6 | List annual income brackets | `GET /emi-profile/api/v1/annual-incomes` | 200 OK, non-empty array | P2 |
| API-L7 | List discount types | `GET /api/v1/discountTypes` | 200 OK, array | P3 |
| API-L8 | List profile registration type options | `GET /emi-profile/api/v1/register/profile-registration-type` | 200 OK, non-empty array | P2 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration API. The corresponding automated specs are:

- `BusinessTestCases/Registration/api/RegistrationAPIFlow.spec.ts` — the 22-endpoint happy-path chain (`API-01`..`API-15`), negative/auth checks (`API-N1`..`API-N12`), and the public lookup endpoints (`API-L1`..`API-L8`)
- `BusinessTestCases/Registration/api/RegistrationSessionRefresh.spec.ts` — the session-refresh mechanism (`RSR-01`..`RSR-07`), EMI-5995 (BE) / EMI-6059 (FE Web)

The same coverage is also runnable by hand or via Newman as `postman/Registration-API-majdpay.postman_collection.json` (see `postman/README.md`) — its 38 requests are grouped into the same eight sections as this doc (Phone Entry / Business Info / NAFATH / Products / Contract / Session Refresh / Lookups / Negative checks) and numbered in the same order as `RegistrationAPIFlow.spec.ts`'s endpoint list.

Supporting helper: `BusinessTestCases/Registration/RegistrationHelper.ts` (`DEV_OTP_ASSETS` pool, `getOtpFromDb`, `generateEmail`, `VALID_IBAN`/`VALID_VAT_NUMBER`, `TEST_FILE_BUFFER`).

---

<!-- source: Registration-Contract.md -->
## Registration-Contract

## Manual Test Cases — Registration — Contract Review Step

Context: the final step of registration. The applicant reviews the generated contract document, may download it as a PDF, must scroll to its end (auto-checking the agreement checkbox) or check it manually, then submits to complete registration.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Contract Review

Context: covers "Registration — Contract Review".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RC-01 | Display the MJD Pay logo | Load the Contract Review step | The MJD Pay logo is visible | P3 |
| RC-02 | Link the logo to the business landing page | Load the Contract Review step | Link the logo to the business landing page | P2 |
| RC-03 | Display the EN language button | Load the Contract Review step | The EN language button is visible | P2 |
| RC-04 | Display the Arabic (العربية) language button | Load the Contract Review step | The Arabic (العربية) language button is visible | P2 |
| RC-05 | Display the Switch theme button | Load the Contract Review step | The Switch theme button is visible | P2 |
| RC-06 | Display the "Final step" label | Load the Contract Review step | The "Final step" label is visible | P3 |
| RC-07 | Display the "Contract review" title | Load the Contract Review step | The "Contract review" title is visible | P3 |
| RC-08 | Display instruction text about reading and agreeing to complete registration | Load the Contract Review step | Instruction text about reading and agreeing to complete registration is visible | P3 |
| RC-09 | Display all four outer step labels: Business Info, NAFATH, Products, Contract | Load the Contract Review step | All four outer step labels: Business Info, NAFATH, Products, Contract is visible | P3 |
| RC-10 | Mark the Contract tab as the active step | Load the Contract Review step | Mark the Contract tab as the active step | P2 |
| RC-11 | Display the "Download PDF file" button | Load the Contract Review step | The "Download PDF file" button is visible | P2 |
| RC-12 | Display the contract document title | Load the Contract Review step | The contract document title is visible | P3 |
| RC-13 | Display the contract version field | Load the Contract Review step | The contract version field is visible | P2 |
| RC-14 | Display the registration date field showing today\ | Load the Contract Review step | The registration date field showing today\ is visible | P2 |
| RC-15 | Display a non-empty intro paragraph | Load the Contract Review step | A non-empty intro paragraph is visible | P2 |
| RC-16 | Display the involved company\ | Load the Contract Review step | The involved company\ is visible | P2 |
| RC-17 | Display at least one numbered contract section, each with visible non-empty heading text | Load the Contract Review step | At least one numbered contract section, each with visible non-empty heading text is visible | P3 |
| RC-18 | Display the "I have read and agree to the contract terms" checkbox, unchecked | Load the Contract Review step | The "I have read and agree to the contract terms" checkbox, unchecked is visible | P2 |
| RC-19 | Display the Cancel button | Load the Contract Review step | The Cancel button is visible | P2 |
| RC-20 | Display the Submit and finish button | Load the Contract Review step | The Submit and finish button is visible | P1 |

### B. Contract Review: Acknowledgement & Actions (Live)

Context: covers "Registration – Contract Review: Acknowledgement & Actions (Live)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RC-21 | Keep Submit disabled while the agreement checkbox is unchecked | While the agreement checkbox is unchecked | The primary action control stays disabled | P1 |
| RC-22 | Auto-check the agreement checkbox once the document is scrolled to its end | Load the Contract Review step | Auto-check the agreement checkbox once the document is scrolled to its end | P2 |
| RC-23 | Enable Submit once the agreement checkbox is checked | Set up the state: Submit once the agreement checkbox is checked | The control becomes enabled | P1 |
| RC-24 | Disable Submit again when the agreement checkbox is unchecked | The agreement checkbox is unchecked | The control becomes/stays disabled | P1 |
| RC-25 | Not advance past Contract when Submit is force-clicked while unchecked | Attempt the blocked transition: Submit is force-clicked while unchecked | The step does not advance | P1 |
| RC-26 | Trigger a PDF download when "Download PDF file" is clicked | "Download PDF file" is clicked | Trigger a PDF download | P2 |

### C. Contract Submission (Mocked)

Context: covers "Registration – Contract Submission (Mocked)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RC-27 | Surface an error and remain on Contract when submission fails | Submission fails | Surface an error and remain on Contract | P2 |
| RC-28 | Send only one request when Submit is clicked twice in quick succession | Submit is clicked twice in quick succession | Send only one request | P1 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Contract Review step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationContractPage.spec.ts` — page elements & layout
- `BusinessTestCases/Registration/functional/RegistrationContractFunctionality.spec.ts` — agreement checkbox behavior (Live section) and mocked submission error/double-submit handling

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationContractPage.ts`.

---

<!-- source: Registration-E2E-and-Modes.md -->
## Registration-E2E-and-Modes

## Manual Test Cases — Registration — End-to-End Flow & Sign-Up Modes

Context: cross-cutting cases that span the whole registration journey rather than one visual step — the full UI happy path from Mobile through NAFATH/Products/Contract, and configuration-driven sign-up modes: a fixed-Merchant-only mode that hides the profile-type selector (TC-REG-005/006), and auto-approval/auto-activation behavior (TC-REG-001/002/007).

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Full E2E Happy Path

Context: covers "Registration – Full E2E Happy Path (UI)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RE-01 | Complete Business Info, Financial & Business, and Verification & Uploads, then reach NAFATH or Products after Sign Up | Load the registration wizard | Complete Business Info, Financial & Business, and Verification & Uploads, then reach NAFATH or Products after Sign Up | P1 |
| RE-02 | Reach Contract and complete submission after accepting the agreement | Load the registration wizard | Reach Contract and complete submission after accepting the agreement | P1 |

### B. Fixed Merchant Sign-Up Mode (TC-REG-005, TC-REG-006)

Context: covers "Registration — Fixed Merchant Sign-Up Mode (TC-REG-005, TC-REG-006)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RE-03 | Hide the "Sign Up As" profile-type selector and show a static "Signing up as Merchant" label (TC-REG-005) | Load the registration wizard | Hide the "Sign Up As" profile-type selector and show a static "Signing up as Merchant" label | P1 |
| RE-04 | Not allow the profile type to be changed in fixed-Merchant mode (TC-REG-006) | Load the registration wizard | Not allow the profile type to be changed in fixed-Merchant mode | P2 |

### C. Fixed Merchant mode disabled (control)

Context: covers "Registration — Fixed Merchant mode disabled (control)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RE-05 | Show the normal profile-type selector when fixed-Merchant mode is off | Fixed-Merchant mode is off | Show the normal profile-type selector | P2 |

### D. Auto-Approval, Auto-Activation & Activation Email (TC-REG-001, TC-REG-002, TC-REG-007)

Context: covers "Registration — Auto-Approval, Auto-Activation & Activation Email (TC-REG-001, TC-REG-002, TC-REG-007)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RE-06 | Reflect automatic approval without a manual admin step (TC-REG-001) | Load the registration wizard | Reflect automatic approval without a manual admin step | P2 |
| RE-07 | Reflect the profile as immediately active for operations (TC-REG-002) | Load the registration wizard | Reflect the profile as immediately active for operations | P2 |
| RE-08 | Show confirmation that the activation email was sent (TC-REG-007) | Load the registration wizard | Show confirmation that the activation email was sent | P2 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for cross-cutting Registration flows. The corresponding automated specs are:

- `BusinessTestCases/Registration/functional/RegistrationE2EHappyPath.spec.ts` — the full UI journey through every step in one run
- `BusinessTestCases/Registration/functional/RegistrationSprint71_TypeAndAutoApprove.spec.ts` — fixed-Merchant sign-up mode and auto-approval/auto-activation/activation-email behavior

Every other Registration part (Mobile, OTP, Business Info, Financial, Verification & Uploads, NAFATH, Products, Contract) has its own dedicated manual-test-case doc in this folder; this file only covers what those individually do not.

---

<!-- source: Registration-Financial.md -->
## Registration-Financial

## Manual Test Cases — Registration — Financial & Business Step (Tab 2 of 3)

Context: Tab 2 of registration. The applicant enters four expected-volume figures (Monthly Expected Number/Sum Of Bills, Expected Monthly Withdrawal/Deposit) and selects an Industry and Annual Income bracket, then advances to Verification & Uploads.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Financial & Business Step (Tab 2 of 3) — read-only

Context: covers "Registration – Financial & Business Step (Tab 2 of 3) — read-only".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RF-01 | Display the MJD Pay logo | Load the Financial & Business tab | The MJD Pay logo is visible | P3 |
| RF-02 | Link the MJD Pay logo to the landing page | Load the Financial & Business tab | Link the MJD Pay logo to the landing page | P2 |
| RF-03 | Display the EN language button | Load the Financial & Business tab | The EN language button is visible | P2 |
| RF-04 | Display the Arabic language button | Load the Financial & Business tab | The Arabic language button is visible | P2 |
| RF-05 | Display the Switch theme button | Load the Financial & Business tab | The Switch theme button is visible | P2 |
| RF-06 | Show the Financial & Business step fields on arrival | Load the Financial & Business tab | Show the Financial & Business step fields on arrival | P2 |
| RF-07 | Show the Financial & Business tab as active | Load the Financial & Business tab | Show the Financial & Business tab as active | P2 |
| RF-08 | Mark the Financial & Business inner tab as active (is-active) | Load the Financial & Business tab | Mark the Financial & Business inner tab as active (is-active) | P2 |
| RF-09 | Display all four step indicators | Load the Financial & Business tab | All four step indicators is visible | P2 |
| RF-10 | Display the Monthly Expected Number Of Bills label | Load the Financial & Business tab | The Monthly Expected Number Of Bills label is visible | P3 |
| RF-11 | Display the Monthly Expected Number Of Bills field | Load the Financial & Business tab | The Monthly Expected Number Of Bills field is visible | P2 |
| RF-12 | Show the correct placeholder for Monthly Expected Number Of Bills | Load the Financial & Business tab | Show the correct placeholder for Monthly Expected Number Of Bills | P2 |
| RF-13 | Display the Monthly Expected Sum Of Bills label | Load the Financial & Business tab | The Monthly Expected Sum Of Bills label is visible | P3 |
| RF-14 | Display the Monthly Expected Sum Of Bills field | Load the Financial & Business tab | The Monthly Expected Sum Of Bills field is visible | P2 |
| RF-15 | Show the correct placeholder for Monthly Expected Sum Of Bills | Load the Financial & Business tab | Show the correct placeholder for Monthly Expected Sum Of Bills | P2 |
| RF-16 | Display the Expected Monthly Withdrawal label | Load the Financial & Business tab | The Expected Monthly Withdrawal label is visible | P3 |
| RF-17 | Display the Expected Monthly Withdrawal field | Load the Financial & Business tab | The Expected Monthly Withdrawal field is visible | P2 |
| RF-18 | Show the correct placeholder for Expected Monthly Withdrawal | Load the Financial & Business tab | Show the correct placeholder for Expected Monthly Withdrawal | P2 |
| RF-19 | Display the Expected Monthly Deposit label | Load the Financial & Business tab | The Expected Monthly Deposit label is visible | P3 |
| RF-20 | Display the Expected Monthly Deposit field | Load the Financial & Business tab | The Expected Monthly Deposit field is visible | P2 |
| RF-21 | Show the correct placeholder for Expected Monthly Deposit | Load the Financial & Business tab | Show the correct placeholder for Expected Monthly Deposit | P2 |
| RF-22 | Display the Industries dropdown label | Load the Financial & Business tab | The Industries dropdown label is visible | P3 |
| RF-23 | Display the Industries dropdown | Load the Financial & Business tab | The Industries dropdown is visible | P2 |
| RF-24 | Show "Select Option" as the default for Industries | Load the Financial & Business tab | Show "Select Option" as the default for Industries | P2 |
| RF-25 | Display the Annual Income dropdown label | Load the Financial & Business tab | The Annual Income dropdown label is visible | P3 |
| RF-26 | Display the Annual Income dropdown | Load the Financial & Business tab | The Annual Income dropdown is visible | P2 |
| RF-27 | Show "Select Option" as the default for Annual Income | Load the Financial & Business tab | Show "Select Option" as the default for Annual Income | P2 |
| RF-28 | Display the Back button | Load the Financial & Business tab | The Back button is visible | P2 |
| RF-29 | Display the Next button | Load the Financial & Business tab | The Next button is visible | P1 |
| RF-30 | Keep Next disabled when required fields are empty | Required fields are empty | The primary action control stays disabled | P1 |
| RF-31 | Display "Already have an account?" text | Load the Financial & Business tab | "Already have an account?" text is visible | P3 |
| RF-32 | Display the Log In link | Load the Financial & Business tab | The Log In link is visible | P3 |
| RF-33 | Display "By continuing, you agree to our" text | Load the Financial & Business tab | "By continuing, you agree to our" text is visible | P3 |
| RF-34 | Display Terms & Conditions link | Load the Financial & Business tab | Terms & Conditions link is visible | P3 |
| RF-35 | Display Privacy Policy link | Load the Financial & Business tab | Privacy Policy link is visible | P3 |

### B. Financial & Business Step (Tab 2 of 3) — stateful

Context: covers "Registration – Financial & Business Step (Tab 2 of 3) — stateful".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RF-36 | Accept numeric input for Monthly Expected Sum Of Bills | Enter numeric input for Monthly Expected Sum Of Bills | The value is accepted and retained in the field | P2 |
| RF-37 | Accept numeric input for Expected Monthly Withdrawal | Enter numeric input for Expected Monthly Withdrawal | The value is accepted and retained in the field | P2 |
| RF-38 | Accept numeric input for Expected Monthly Deposit | Enter numeric input for Expected Monthly Deposit | The value is accepted and retained in the field | P2 |
| RF-39 | Display the Banks dropdown label | Load the Financial & Business tab | The Banks dropdown label is visible | P3 |
| RF-40 | Open the Industries dropdown when clicked | Clicked | Open the Industries dropdown | P2 |
| RF-41 | Open the Annual Income dropdown when clicked | Clicked | Open the Annual Income dropdown | P2 |
| RF-42 | Open the Banks dropdown when clicked | Clicked | Open the Banks dropdown | P2 |
| RF-43 | Return to Business Info tab when Back is clicked | Back is clicked | Return to Business Info tab | P2 |
| RF-44 | Proceed to Verification & Uploads tab when Next is clicked with valid data | Next is clicked with valid data | Proceed to Verification & Uploads tab | P1 |

### C. Financial & Business Step (Tab 2 of 3) — dedicated asset

Context: covers "Registration – Financial & Business Step (Tab 2 of 3) — dedicated asset".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RF-45 | Accept numeric input for Monthly Expected Number Of Bills | Enter numeric input for Monthly Expected Number Of Bills | The value is accepted and retained in the field | P2 |

### D. Financial & Business Functionality

Context: covers "Registration - Financial & Business Functionality".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RF-46 | Accept numeric input for Monthly Expected Number Of Bills | Enter numeric input for Monthly Expected Number Of Bills | The value is accepted and retained in the field | P2 |
| RF-47 | Accept numeric input for Monthly Expected Sum Of Bills | Enter numeric input for Monthly Expected Sum Of Bills | The value is accepted and retained in the field | P2 |
| RF-48 | Accept numeric input for Expected Monthly Withdrawal | Enter numeric input for Expected Monthly Withdrawal | The value is accepted and retained in the field | P2 |
| RF-49 | Accept numeric input for Expected Monthly Deposit | Enter numeric input for Expected Monthly Deposit | The value is accepted and retained in the field | P2 |
| RF-50 | Not accept alphabetic characters in the Monthly Expected Number field | Enter alphabetic characters in the Monthly Expected Number field | The value is rejected — not retained in the field | P2 |
| RF-51 | Not accept special characters in the Monthly Expected Sum field | Enter special characters in the Monthly Expected Sum field | The value is rejected — not retained in the field | P2 |
| RF-52 | Not accept alphabetic characters in the Expected Monthly Withdrawal field | Enter alphabetic characters in the Expected Monthly Withdrawal field | The value is rejected — not retained in the field | P2 |
| RF-53 | Not accept special characters in the Expected Monthly Deposit field | Enter special characters in the Expected Monthly Deposit field | The value is rejected — not retained in the field | P2 |
| RF-54 | Not retain a negative number in the Monthly Expected Number field | Enter a negative number in the Monthly Expected Number field | The value is not retained in the field | P2 |
| RF-55 | Not retain a decimal point in the Monthly Expected Sum field | Enter a decimal point in the Monthly Expected Sum field | The value is not retained in the field | P2 |
| RF-56 | Handle a very large value (15 digits) in the Expected Monthly Withdrawal field without crashing | Enter an oversized/edge-case value: a very large value (15 digits) in the Expected Monthly Withdrawal field without crashing | The page handles it gracefully — no crash | P3 |
| RF-57 | Treat a zero value in the Expected Monthly Deposit field as valid input | Enter the edge-case value: a zero value in the Expected Monthly Deposit field | The value is accepted as valid | P2 |
| RF-58 | Not execute an XSS payload entered in the Monthly Expected Number field | Enter a script/JS-URI payload in Monthly Expected Number field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RF-59 | Not execute an XSS payload entered in the Monthly Expected Sum field | Enter a script/JS-URI payload in Monthly Expected Sum field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RF-60 | Not accept a SQL injection pattern in the Expected Monthly Withdrawal field | Enter a SQL injection pattern in the Expected Monthly Withdrawal field | The value is rejected — not retained in the field | P1 |
| RF-61 | Not accept a SQL injection pattern in the Expected Monthly Deposit field | Enter a SQL injection pattern in the Expected Monthly Deposit field | The value is rejected — not retained in the field | P1 |
| RF-62 | Keep Next disabled when Monthly Expected Number Of Bills is 0 | Monthly Expected Number Of Bills is 0 | The primary action control stays disabled | P1 |
| RF-63 | Keep Next disabled when Monthly Expected Sum Of Bills has a leading zero | Monthly Expected Sum Of Bills has a leading zero | The primary action control stays disabled | P1 |
| RF-64 | Restore valid values to all four fields after boundary/security probing | Load the Financial & Business tab | Restore valid values to all four fields after boundary/security probing | P2 |
| RF-65 | Open the Industries dropdown when clicked | Clicked | Open the Industries dropdown | P2 |
| RF-66 | Reflect the selected industry in the Industries dropdown | Load the Financial & Business tab | Reflect the selected industry in the Industries dropdown | P2 |
| RF-67 | Open the Annual Income dropdown when clicked | Clicked | Open the Annual Income dropdown | P2 |
| RF-68 | Reflect the selected income in the Annual Income dropdown | Load the Financial & Business tab | Reflect the selected income in the Annual Income dropdown | P2 |
| RF-69 | Filter the Industries options when typing in the dropdown search field | Typing in the dropdown search field | Filter the Industries options | P2 |
| RF-70 | Filter the Annual Income options when typing in the dropdown search field | Typing in the dropdown search field | Filter the Annual Income options | P2 |
| RF-71 | Keep Next disabled when only the numeric fields are filled and no dropdown is selected | Only the numeric fields are filled and no dropdown is selected | The primary action control stays disabled | P1 |
| RF-72 | Enable Next when all required fields and dropdowns are filled | All required fields and dropdowns are filled | The control becomes enabled | P1 |
| RF-73 | Return to the Business Info step when Back is clicked | Back is clicked | Return to the Business Info step | P2 |
| RF-74 | Preserve the email on Business Info step after navigating back | Load the Financial & Business tab | Preserve the email on Business Info step after navigating back | P2 |
| RF-75 | Allow re-advancing to Financial step after going back to Info step | Load the Financial & Business tab | Allow re-advancing to Financial step after going back to Info step | P2 |
| RF-76 | Advance to Verification & Uploads step when Next is clicked with valid data | Next is clicked with valid data | Advance to Verification & Uploads step | P1 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Financial & Business step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationFinancialPage.spec.ts` — page elements (read-only, stateful, and dedicated-asset sections)
- `BusinessTestCases/Registration/functional/RegistrationFinancialFunctionality.spec.ts` — numeric field validation (boundaries, XSS/SQLi, negative/decimal/zero handling), Industries/Annual Income dropdown search, Next-button logic, and Back navigation

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationFinancialPage.ts`.

---

<!-- source: Registration-Info.md -->
## Registration-Info

## Manual Test Cases — Registration — Business Info Step (Tab 1 of 3)

Context: Tab 1 of the multi-step registration form. The applicant picks a profile type (Merchant; Freelancer is present but disabled/"Coming Soon"), enters the Commercial Registration Number (CRN / Unified Number) and National ID/Iqama, and an email address, then advances to the Financial & Business tab. Also covers the wizard chrome shared across all tabs (logo, language, theme, footer links, step indicator) as observed on this step, and the resume-registration behavior for a mobile number already partway through onboarding.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Header & Banner

Context: covers "Header & Banner [ref_1 – ref_7]".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-01 | Display the MJD Pay logo | Load the Business Info tab | The MJD Pay logo is visible | P3 |
| RI-02 | Link the MJD Pay logo to the landing page | Load the Business Info tab | Link the MJD Pay logo to the landing page | P2 |
| RI-03 | Display the Change Language group | Load the Business Info tab | The Change Language group is visible | P2 |
| RI-04 | Display the EN language button | Load the Business Info tab | The EN language button is visible | P2 |
| RI-05 | Display the Arabic language button | Load the Business Info tab | The Arabic language button is visible | P2 |
| RI-06 | Display the theme toggle button | Load the Business Info tab | The theme toggle button is visible | P2 |

### B. Main Content, Headings & Progress Bar

Context: covers "Main Content, Headings & Progress Bar [ref_8 – ref_15]".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-07 | Display the main page container | Load the Business Info tab | The main page container is visible | P2 |
| RI-08 | Display the "Create Account" eyebrow text | Load the Business Info tab | The "Create Account" eyebrow text is visible | P3 |
| RI-09 | Display the "Tell us about your business" heading | Load the Business Info tab | The "Tell us about your business" heading is visible | P3 |
| RI-10 | Display "1" as the active step number | Load the Business Info tab | "1" as the active step number is visible | P2 |
| RI-11 | Display "Business Info" as the active outer step | Load the Business Info tab | "Business Info" as the active outer step is visible | P2 |
| RI-12 | Display "NAFATH" as the second outer step | Load the Business Info tab | "NAFATH" as the second outer step is visible | P2 |
| RI-13 | Display "Products" as the third outer step | Load the Business Info tab | "Products" as the third outer step is visible | P2 |
| RI-14 | Display "Contract" as the fourth outer step | Load the Business Info tab | "Contract" as the fourth outer step is visible | P2 |

### C. Inner Tab Navigation

Context: covers "Inner Tab Navigation [ref_16 – ref_23]".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-15 | Display the step bar | Load the Business Info tab | The step bar is visible | P2 |
| RI-16 | Display Tab 1 — Business Info | Load the Business Info tab | Tab 1 — Business Info is visible | P2 |
| RI-17 | Display Tab 3 — Products | Load the Business Info tab | Tab 3 — Products is visible | P2 |
| RI-18 | Display Tab 4 — Contract | Load the Business Info tab | Tab 4 — Contract is visible | P2 |

### D. Element Visibility

Context: covers "Element Visibility".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-19 | Display the tab panel container | Load the Business Info tab | The tab panel container is visible | P2 |
| RI-20 | Display the Business Info form element | Load the Business Info tab | The Business Info form element is visible | P2 |
| RI-21 | Display the Profile Type label | Load the Business Info tab | The Profile Type label is visible | P3 |
| RI-22 | Display the Profile Type radiogroup | Load the Business Info tab | The Profile Type radiogroup is visible | P2 |
| RI-23 | Display exactly two Profile Type options | Load the Business Info tab | Exactly two Profile Type options is visible | P2 |
| RI-24 | Display the Merchant radio option | Load the Business Info tab | The Merchant radio option is visible | P2 |
| RI-25 | Display the Merchant label and description | Load the Business Info tab | The Merchant label and description is visible | P3 |
| RI-26 | Display the Freelancer radio option | Load the Business Info tab | The Freelancer radio option is visible | P2 |
| RI-27 | Display the Freelancer label and description | Load the Business Info tab | The Freelancer label and description is visible | P3 |
| RI-28 | Display the Unified Number label | Load the Business Info tab | The Unified Number label is visible | P3 |
| RI-29 | Display the Unified Number tooltip button | Load the Business Info tab | The Unified Number tooltip button is visible | P3 |
| RI-30 | Display the Unified Number input wrapper | Load the Business Info tab | The Unified Number input wrapper is visible | P2 |
| RI-31 | Display the Unified Number textbox with correct placeholder | Load the Business Info tab | The Unified Number textbox with correct placeholder is visible | P3 |
| RI-32 | Display the National ID/Iqama label | Load the Business Info tab | The National ID/Iqama label is visible | P3 |
| RI-33 | Display the National ID/Iqama tooltip button | Load the Business Info tab | The National ID/Iqama tooltip button is visible | P3 |
| RI-34 | Display the National ID/Iqama input wrapper | Load the Business Info tab | The National ID/Iqama input wrapper is visible | P2 |
| RI-35 | Display the National ID/Iqama textbox with correct placeholder | Load the Business Info tab | The National ID/Iqama textbox with correct placeholder is visible | P3 |
| RI-36 | Display the Email label | Load the Business Info tab | The Email label is visible | P3 |
| RI-37 | Display the Email textbox with correct placeholder | Load the Business Info tab | The Email textbox with correct placeholder is visible | P3 |
| RI-38 | Display the Next button | Load the Business Info tab | The Next button is visible | P1 |
| RI-39 | Display "Already have an account?" text | Load the Business Info tab | "Already have an account?" text is visible | P3 |
| RI-40 | Display the Log In link | Load the Business Info tab | The Log In link is visible | P3 |
| RI-41 | Display "By continuing, you agree to our" text | Load the Business Info tab | "By continuing, you agree to our" text is visible | P3 |
| RI-42 | Display Terms & Conditions reference | Load the Business Info tab | Terms & Conditions reference is visible | P2 |
| RI-43 | Display Privacy Policy reference | Load the Business Info tab | Privacy Policy reference is visible | P2 |

### E. Field Interactions

Context: covers "Field Interactions".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-44 | Allow selecting Merchant profile type | Load the Business Info tab | Allow selecting Merchant profile type | P2 |
| RI-45 | Not allow selecting Freelancer profile type — disabled as "Coming Soon" | Load the Business Info tab | Not allow selecting Freelancer profile type — disabled as "Coming Soon" | P1 |
| RI-46 | Accept input in the Unified Number field | Enter input in the Unified Number field | The value is accepted and retained in the field | P2 |
| RI-47 | Display the Clear button for Unified Number after entry | Load the Business Info tab | The Clear button for Unified Number after entry is visible | P2 |
| RI-48 | Accept input in the National ID/Iqama field | Enter input in the National ID/Iqama field | The value is accepted and retained in the field | P2 |
| RI-49 | Accept input in the Email field | Enter input in the Email field | The value is accepted and retained in the field | P2 |
| RI-50 | Have the Next button disabled when form is incomplete | Form is incomplete | Have the Next button disabled | P1 |
| RI-51 | Enable the Next button when all fields are filled with valid data | All fields are filled with valid data | The control becomes enabled | P1 |

### F. Profile Type Selection

Context: covers "Registration – Profile Type Selection".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-52 | Mark Merchant as aria-checked when selected | Selected | Mark Merchant as aria-checked | P2 |
| RI-53 | Not mark Freelancer as aria-checked when clicked (disabled) | Clicked (disabled) | Not mark Freelancer as aria-checked | P1 |
| RI-54 | Keep Merchant selected when the disabled Freelancer card is clicked | Freelancer card is clicked | The primary action control stays disabled | P1 |

### G. Unified Number (CRN) Field

Context: covers "Registration – Unified Number (CRN) Field".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-55 | Accept a valid CRN and retain the value | Enter a valid CRN and retain the value | The value is accepted and retained in the field | P2 |
| RI-56 | Be empty on initial page load | Load the Business Info tab | Be empty on initial page load | P2 |
| RI-57 | Show the Clear button after a value is entered | Load the Business Info tab | Show the Clear button after a value is entered | P2 |
| RI-58 | Clear the CRN field when the Clear button is clicked | The Clear button is clicked | Clear the CRN field | P2 |
| RI-59 | Hide the Clear button after the field is emptied via Clear | Load the Business Info tab | Hide the Clear button after the field is emptied via Clear | P2 |
| RI-60 | Not retain alphabetic characters in the CRN field | Enter alphabetic characters in the CRN field | The value is not retained in the field | P2 |
| RI-61 | Not retain special characters in the CRN field | Enter special characters in the CRN field | The value is not retained in the field | P2 |
| RI-62 | Keep Next disabled when CRN is cleared after full form fill | CRN is cleared after full form fill | The primary action control stays disabled | P1 |
| RI-63 | Not execute an XSS payload entered in the CRN field | Enter a script/JS-URI payload in CRN field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RI-64 | Handle a 1000-character input without crashing | Enter an oversized/edge-case value: a 1000-character input without crashing | The page handles it gracefully — no crash | P3 |
| RI-65 | Not allow more than 15 digits in the CRN field | Attempt to enter more than 15 characters | Input is capped at 15 characters | P3 |
| RI-66 | Keep Next disabled when CRN is shorter than the minimum 10 digits | CRN is shorter than the minimum 10 digits | The primary action control stays disabled | P1 |
| RI-67 | Enable Next when CRN is exactly 15 digits (maximum valid length) | CRN is exactly 15 digits (maximum valid length) | The control becomes enabled | P3 |

### H. National ID / Iqama Field

Context: covers "Registration – National ID / Iqama Field".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-68 | Accept a valid National ID and retain the value | Enter a valid National ID and retain the value | The value is accepted and retained in the field | P2 |
| RI-69 | Be empty on initial page load | Load the Business Info tab | Be empty on initial page load | P2 |
| RI-70 | Show the Clear button after a value is entered | Load the Business Info tab | Show the Clear button after a value is entered | P2 |
| RI-71 | Clear the National ID field when the Clear button is clicked | The Clear button is clicked | Clear the National ID field | P2 |
| RI-72 | Hide the Clear button after the field is emptied via Clear | Load the Business Info tab | Hide the Clear button after the field is emptied via Clear | P2 |
| RI-73 | Keep Next disabled when National ID is cleared after full form fill | National ID is cleared after full form fill | The primary action control stays disabled | P1 |
| RI-74 | Not retain alphabetic characters in the National ID field | Enter alphabetic characters in the National ID field | The value is not retained in the field | P2 |
| RI-75 | Not retain special characters in the National ID field | Enter special characters in the National ID field | The value is not retained in the field | P2 |
| RI-76 | Not execute an XSS payload entered in the National ID field | Enter a script/JS-URI payload in National ID field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RI-77 | Not execute a javascript: URI entered in the National ID field | Enter a script/JS-URI payload in National ID field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RI-78 | Handle a 1000-character input without crashing | Enter an oversized/edge-case value: a 1000-character input without crashing | The page handles it gracefully — no crash | P3 |
| RI-79 | Keep Next disabled when National ID starts with a digit other than 1 or 2 | National ID starts with a digit other than 1 or 2 | The primary action control stays disabled | P1 |
| RI-80 | Not allow more than 10 digits in the National ID field | Attempt to enter more than 10 characters | Input is capped at 10 characters | P2 |

### I. Email Field

Context: covers "Registration – Email Field".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-81 | Accept a standard email address | Enter a standard email address | The value is accepted and retained in the field | P2 |
| RI-82 | Accept an email with a plus-sign alias | Enter an email with a plus-sign alias | The value is accepted and retained in the field | P2 |
| RI-83 | Accept an email with a subdomain | Enter an email with a subdomain | The value is accepted and retained in the field | P2 |
| RI-84 | Accept an email with numeric local part | Enter an email with numeric local part | The value is accepted and retained in the field | P2 |
| RI-85 | Show error for email missing the @ symbol | Trigger the condition: email missing the @ symbol | A validation error is shown | P2 |
| RI-86 | Show error for email with no domain after @ | Trigger the condition: email with no domain after @ | A validation error is shown | P2 |
| RI-87 | Show error for a bare @ symbol | Trigger the condition: a bare @ symbol | A validation error is shown | P2 |
| RI-88 | Show error for email containing a space | Trigger the condition: email containing a space | A validation error is shown | P2 |
| RI-89 | Show error for email starting with a dot | Trigger the condition: email starting with a dot | A validation error is shown | P2 |
| RI-90 | Show error for email missing TLD (no dot after domain name) | Trigger the condition: email missing TLD (no dot after domain name) | A validation error is shown | P2 |
| RI-91 | Clear the email error when a valid email replaces an invalid one | Correct the invalid input so it becomes valid | The validation error clears | P2 |
| RI-92 | Keep Next disabled while an invalid email is entered | While an invalid email is entered | The primary action control stays disabled | P1 |
| RI-93 | Become disabled again after clearing the email from a complete form | Load the Business Info tab | Become disabled again after clearing the email from a complete form | P1 |
| RI-94 | Not execute XSS entered in the email field | Load the Business Info tab | Not execute XSS entered in the email field | P1 |
| RI-95 | Treat SQL injection pattern in email as invalid and show error | Enter a SQL-injection-shaped string and submit | The value is handled as inert text — rejected as invalid input, not executed against a database | P1 |
| RI-96 | Handle a very long email (500 chars) without crashing | Load the Business Info tab | Handle a very long email (500 chars) without crashing | P3 |

### J. Next Button Enable/Disable Logic

Context: covers "Registration – Next Button Enable/Disable Logic".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-97 | Be disabled when all fields are empty | All fields are empty | Be disabled | P1 |
| RI-98 | Be disabled when only Profile Type is selected | Only Profile Type is selected | Be disabled | P1 |
| RI-99 | Be disabled when only CRN is filled | Only CRN is filled | Be disabled | P1 |
| RI-100 | Be disabled when only National ID is filled | Only National ID is filled | Be disabled | P1 |
| RI-101 | Be disabled when only Email is filled | Only Email is filled | Be disabled | P1 |
| RI-102 | Be disabled with Profile Type + CRN only | Load the Business Info tab | Be disabled with Profile Type + CRN only | P1 |
| RI-103 | Be disabled with Profile Type + National ID only | Load the Business Info tab | Be disabled with Profile Type + National ID only | P1 |
| RI-104 | Be disabled with Profile Type + Email only | Load the Business Info tab | Be disabled with Profile Type + Email only | P1 |
| RI-105 | Be disabled with Profile Type + CRN + National ID (no email) | Load the Business Info tab | Be disabled with Profile Type + CRN + National ID (no email) | P1 |
| RI-106 | Be disabled with CRN + National ID + Email (no profile type) | Load the Business Info tab | Be disabled with CRN + National ID + Email (no profile type) | P1 |
| RI-107 | Be enabled when all fields are filled with Merchant profile | All fields are filled with Merchant profile | Be enabled | P1 |
| RI-108 | Be enabled when all fields are filled with Freelancer profile | All fields are filled with Freelancer profile | Be enabled | P1 |
| RI-109 | Become disabled again after clearing the CRN from a complete form | Load the Business Info tab | Become disabled again after clearing the CRN from a complete form | P1 |
| RI-110 | Become disabled again after clearing the National ID from a complete form | Load the Business Info tab | Become disabled again after clearing the National ID from a complete form | P1 |
| RI-111 | Not advance to Tab 2 when Next is force-clicked while disabled | Attempt the blocked transition: Next is force-clicked while disabled | The step does not advance | P1 |

### K. Tab 1 → Tab 2 Transition

Context: covers "Registration – Tab 1 → Tab 2 Transition".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-112 | Advance to Tab 2 with Freelancer profile | Load the Business Info tab | Advance to Tab 2 with Freelancer profile | P1 |
| RI-113 | Stay on the /register URL after advancing to Tab 2 | Load the Business Info tab | Stay on the /register URL after advancing to Tab 2 | P2 |
| RI-114 | Show the Monthly Expected Number of Bills field on Tab 2 | Load the Business Info tab | Show the Monthly Expected Number of Bills field on Tab 2 | P2 |
| RI-115 | Show the Next button on Tab 2 | Load the Business Info tab | Show the Next button on Tab 2 | P1 |
| RI-116 | Show the Back button on Tab 2 | Load the Business Info tab | Show the Back button on Tab 2 | P2 |
| RI-117 | Not reach Tab 2 when an unrecognised CRN / National ID pair is submitted | Attempt the blocked transition: not reach Tab 2 when an unrecognised CRN / National ID pair is submitted | The step does not advance | P1 |

### L. Back Navigation (Tab 2 → Tab 1)

Context: covers "Registration – Back Navigation (Tab 2 → Tab 1)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-118 | Keep Next enabled on Tab 1 after going Back | Load the Business Info tab | Keep Next enabled on Tab 1 after going Back | P1 |
| RI-119 | Successfully re-advance to Tab 2 after going Back and clicking Next | Load the Business Info tab | Successfully re-advance to Tab 2 after going Back and clicking Next | P1 |

### M. Step Indicator Progression

Context: covers "Registration – Step Indicator Progression".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-120 | Show "Business Info" as the active inner step on load | Load the Business Info tab | Show "Business Info" as the active inner step on load | P2 |
| RI-121 | Not show NAFATH as active while on Tab 1 | Load the Business Info tab | Not show NAFATH as active while on Tab 1 | P2 |

### N. Footer Navigation

Context: covers "Registration – Footer Navigation".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-122 | Navigate to the Login page when the "Log In" link is clicked | The "Log In" link is clicked | Navigate to the Login page | P1 |
| RI-123 | Terms & Conditions link be visible | Load the Business Info tab | Terms & Conditions link be visible | P2 |
| RI-124 | Privacy Policy link be visible | Load the Business Info tab | Privacy Policy link be visible | P2 |
| RI-125 | Terms & Conditions link be clickable without a JS error | Load the Business Info tab | Terms & Conditions link be clickable without a JS error | P2 |
| RI-126 | Privacy Policy link be clickable without a JS error | Load the Business Info tab | Privacy Policy link be clickable without a JS error | P2 |

### O. Language Toggle

Context: covers "Registration – Language Toggle".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-127 | Switch to Arabic when العربية is clicked | العربية is clicked | Switch to Arabic | P2 |
| RI-128 | Switch back to English when EN is clicked after Arabic | EN is clicked after Arabic | Switch back to English | P2 |
| RI-129 | Mark EN as not active after switching to Arabic | Load the Business Info tab | Mark EN as not active after switching to Arabic | P2 |

### P. Theme Toggle

Context: covers "Registration – Theme Toggle".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-130 | Change the body class when Switch theme is clicked | Switch theme is clicked | Change the body class | P2 |
| RI-131 | Return to the original theme class when toggled twice | Toggled twice | Return to the original theme class | P2 |

### Q. Tooltip Interactions

Context: covers "Registration – Tooltip Interactions".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-132 | Reveal a tooltip when the Unified Number info button is clicked | The Unified Number info button is clicked | Reveal a tooltip | P2 |
| RI-133 | Reveal a tooltip when the National ID info button is clicked | The National ID info button is clicked | Reveal a tooltip | P2 |
| RI-134 | Close the Unified Number tooltip when clicking away | Clicking away | Close the Unified Number tooltip | P2 |
| RI-135 | Display non-empty descriptive text inside the Unified Number tooltip | Load the Business Info tab | Non-empty descriptive text inside the Unified Number tooltip is visible | P3 |

### R. Continue/Resume Registration (EMI-5666, T03)

Context: covers "Registration – Continue/Resume Registration (EMI-5666, T03)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-136 | Require re-entering Registration Info, then skip straight to Products/Contract, when resuming a registration already past Financial & Business | Resuming a registration already past Financial & Business | Require re-entering Registration Info, then skip straight to Products/Contract, | P2 |
| RI-137 | Start a brand-new registration when the mobile is reused with a different CRN | The mobile is reused with a different CRN | Start a brand-new registration | P2 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Business Info step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationInfoPage.spec.ts` — page elements & layout (the `[ref_NN]` markers in the automated titles trace each assertion to a captured DOM snapshot reference, omitted here)
- `BusinessTestCases/Registration/functional/RegistrationInfoFunctionality.spec.ts` — profile-type selection, CRN/National ID/Email field validation, Next-button enable logic, tab transitions, footer/language/theme chrome, tooltips, and resume-registration (EMI-5666)

Supporting helpers: `BusinessTestCases/Registration/RegistrationHelper.ts` (asset pools `CITIZEN_ASSETS`/`RESIDENT_ASSETS`, `goToInfoStep`) and `BusinessTestCases/pageElements/Registration/RegistrationInfoPage.ts`.

---

<!-- source: Registration-Mobile.md -->
## Registration-Mobile

## Manual Test Cases — Registration — Mobile Number Step

Context: the first screen of Business-portal registration at `/business/auth/register`. The applicant enters a Saudi mobile number to receive an OTP and begin registration. Covers static page elements and mobile-field validation.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Page Elements

Context: covers "Registration - Mobile Number Page".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RM-01 | Open the Registration URL | Navigate to the Registration URL | The page loads successfully | P2 |
| RM-02 | Have the correct page title | Load the Mobile Number page | Page title is correct | P2 |
| RM-03 | Display the MJD Pay logo | Load the Mobile Number page | The MJD Pay logo is visible | P3 |
| RM-04 | Display the MJD Pay logo as a clickable link | Load the Mobile Number page | The MJD Pay logo as a clickable link is visible | P3 |
| RM-05 | Navigate to a valid page when the logo link is clicked | The logo link is clicked | Navigate to a valid page | P1 |
| RM-06 | Display the EN language button | Load the Mobile Number page | The EN language button is visible | P2 |
| RM-07 | Not have EN as the active language by default | Load the Mobile Number page | Not have EN as the active language by default | P2 |
| RM-08 | Display the Arabic language button | Load the Mobile Number page | The Arabic language button is visible | P2 |
| RM-09 | Have Arabic as the active language by default | Load the Mobile Number page | Have Arabic as the active language by default | P2 |
| RM-10 | Display the theme toggle button | Load the Mobile Number page | The theme toggle button is visible | P2 |
| RM-11 | Change the theme when the toggle is clicked | The toggle is clicked | Change the theme | P2 |
| RM-12 | Display the "Create Account" eyebrow text | Load the Mobile Number page | The "Create Account" eyebrow text is visible | P3 |
| RM-13 | Display the "Enter Phone Number" heading | Load the Mobile Number page | The "Enter Phone Number" heading is visible | P3 |
| RM-14 | Display the "Start your business registration" description | Load the Mobile Number page | The "Start your business registration" description is visible | P2 |
| RM-15 | Display the Mobile number input | Load the Mobile Number page | The Mobile number input is visible | P2 |
| RM-16 | Have the correct placeholder for Mobile number | Load the Mobile Number page | Placeholder for Mobile number is correct | P2 |
| RM-17 | Display the Next button | Load the Mobile Number page | The Next button is visible | P1 |
| RM-18 | Have Next button disabled when Mobile number is empty | Mobile number is empty | Have Next button disabled | P1 |
| RM-19 | Display the "Already have an account?" text | Load the Mobile Number page | The "Already have an account?" text is visible | P3 |
| RM-20 | Display the Log In link | Load the Mobile Number page | The Log In link is visible | P3 |

### B. Field Validation & Navigation

Context: covers "Registration - Mobile Number Functionality".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RM-21 | Navigate away from registration when the logo is clicked | The logo is clicked | Navigate away from registration | P1 |
| RM-22 | Switch to Arabic (RTL) when Arabic button is clicked | Arabic button is clicked | Switch to Arabic (RTL) | P2 |
| RM-23 | Accept input in the Mobile number field | Enter input in the Mobile number field | The value is accepted and retained in the field | P2 |
| RM-24 | Not accept alphabetic characters in the mobile field | Enter alphabetic characters in the mobile field | The value is rejected — not retained in the field | P2 |
| RM-25 | Not accept special characters in the mobile field | Enter special characters in the mobile field | The value is rejected — not retained in the field | P2 |
| RM-26 | Enable Next button when a valid KSA mobile number is filled | A valid KSA mobile number is filled | The control becomes enabled | P1 |
| RM-27 | Disable Next button again after clearing the Mobile number field | Set up the state: Next button again after clearing the Mobile number field | The control becomes/stays disabled | P1 |
| RM-28 | Reject a mobile number that does not start with 5 | Enter a mobile number that does not start with 5 | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RM-29 | Reject a mobile number shorter than 9 digits | Enter a mobile number shorter than 9 digits | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RM-30 | Not allow more than 9 digits in the Mobile number field | Attempt to enter more than 9 characters | Input is capped at 9 characters | P2 |
| RM-31 | Not execute an XSS payload entered in the Mobile number field | Enter a script/JS-URI payload in Mobile number field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RM-32 | Not accept a SQL injection pattern in the Mobile number field | Enter a SQL injection pattern in the Mobile number field | The value is rejected — not retained in the field | P1 |
| RM-33 | Navigate to the login page when Log In is clicked | Log In is clicked | Navigate to the login page | P1 |
| RM-34 | Open the registration page when Sign Up is clicked on the login page | Sign Up is clicked on the login page | Open the registration page | P1 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Mobile step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationMobilePage.spec.ts` — page elements & layout
- `BusinessTestCases/Registration/functional/RegistrationMobileFunctionality.spec.ts` — field validation, XSS/SQLi inertness, and navigation

Supporting helpers: `BusinessTestCases/Registration/RegistrationHelper.ts` and `BusinessTestCases/pageElements/Registration/RegistrationMobilePage.ts`.

---

<!-- source: Registration-Nafath.md -->
## Registration-Nafath

## Manual Test Cases — Registration — NAFATH Verification Step

Context: after Sign Up, the applicant is redirected to verify their identity via NAFATH (the Saudi national digital-identity app). This step cannot be automated end-to-end (NAFATH approval happens on the applicant's own device) — coverage here is limited to the redirect page's elements and countdown behavior (EMI-4895/EMI-4937).

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. NAFATH Step Page Elements

Context: covers "Registration - NAFATH Step Page Elements".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RN-01 | Display the MJD Pay logo | Load the NAFATH step | The MJD Pay logo is visible | P3 |
| RN-02 | Link the MJD Pay logo to the landing page | Load the NAFATH step | Link the MJD Pay logo to the landing page | P2 |
| RN-03 | Display the EN language button | Load the NAFATH step | The EN language button is visible | P2 |
| RN-04 | Display the Arabic language button | Load the NAFATH step | The Arabic language button is visible | P2 |
| RN-05 | Display the theme toggle button | Load the NAFATH step | The theme toggle button is visible | P2 |
| RN-06 | Display the "Create Account" eyebrow text | Load the NAFATH step | The "Create Account" eyebrow text is visible | P3 |
| RN-07 | Display "Business Info" as the first outer step | Load the NAFATH step | "Business Info" as the first outer step is visible | P2 |
| RN-08 | Display "NAFATH" as the active outer step | Load the NAFATH step | "NAFATH" as the active outer step is visible | P2 |
| RN-09 | Display "Products" as the third outer step | Load the NAFATH step | "Products" as the third outer step is visible | P2 |
| RN-10 | Display "Contract" as the fourth outer step | Load the NAFATH step | "Contract" as the fourth outer step is visible | P2 |
| RN-11 | Display the "Verify with Nafath" heading | Load the NAFATH step | The "Verify with Nafath" heading is visible | P3 |
| RN-12 | Display the verification instruction text | Load the NAFATH step | The verification instruction text is visible | P3 |
| RN-13 | Display step 1 "Open Nafath app and sign in" | Load the NAFATH step | Step 1 "Open Nafath app and sign in" is visible | P2 |
| RN-14 | Display step 2 "Select the number shown" | Load the NAFATH step | Step 2 "Select the number shown" is visible | P2 |
| RN-15 | Display step 3 "Approve" | Load the NAFATH step | Step 3 "Approve" is visible | P2 |
| RN-16 | Display the redirect note with a countdown timer | Load the NAFATH step | The redirect note with a countdown timer is visible | P2 |
| RN-17 | Display the "Verify" button as initially disabled while the countdown is active (EMI-4895) | Load the NAFATH step | The "Verify" button as initially disabled while the countdown is active is visible | P1 |
| RN-18 | Not display a resend option in the Nafath panel (EMI-4895) | Load the NAFATH step | A resend option in the Nafath panel is not shown | P2 |

### B. Nafath Verification

Context: covers "Registration - Nafath Verification".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RN-19 | Display the Nafath page after Sign Up | Load the NAFATH step | The Nafath page after Sign Up is visible | P1 |
| RN-20 | Display a countdown timer on the Nafath page | Load the NAFATH step | A countdown timer on the Nafath page is visible | P2 |
| RN-21 | Have the Verify button disabled while the redirect countdown is active (EMI-4895) | Load the NAFATH step | Have the Verify button disabled while the redirect countdown is active | P1 |
| RN-22 | Keep the Verify button disabled mid-countdown, not just on load (EMI-4895) | Mid-countdown, not just on load | The primary action control stays disabled | P1 |
| RN-23 | Enable the Verify button once the 20-second countdown expires (EMI-4937) | Set up the state: the Verify button once the 20-second countdown expires | The control becomes enabled | P1 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration NAFATH step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationNafathPage.spec.ts` — page elements & layout
- `BusinessTestCases/Registration/functional/RegistrationNafathFunctionality.spec.ts` — the redirect countdown and Verify-button enable timing (EMI-4895, EMI-4937)

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationNafathPage.ts`. NAFATH approval itself is out of scope — it requires the applicant's own NAFATH app.

---

<!-- source: Registration-OTP.md -->
## Registration-OTP

## Manual Test Cases — Registration — Mobile OTP Popup

Context: after submitting a mobile number, a one-time-password popup may appear (skipped entirely when OTP is disabled for the environment). The applicant enters the OTP to advance to Business Info.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Page Elements

Context: covers "Registration - OTP Popup Page Elements".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RO-01 | Display the Enter OTP heading | Load the OTP popup | The Enter OTP heading is visible | P3 |
| RO-02 | Display the OTP instruction message | Load the OTP popup | The OTP instruction message is visible | P2 |
| RO-03 | Display OTP input boxes | Load the OTP popup | OTP input boxes is visible | P2 |
| RO-04 | Display the countdown timer | Load the OTP popup | The countdown timer is visible | P2 |
| RO-05 | Display the Cancel button | Load the OTP popup | The Cancel button is visible | P2 |
| RO-06 | Display the Verify button | Load the OTP popup | The Verify button is visible | P1 |
| RO-07 | Display the Click to resend button | Load the OTP popup | The Click to resend button is visible | P2 |

### B. Functionality

Context: covers "Registration - OTP Functionality".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RO-08 | Have Verify button disabled when OTP inputs are empty | OTP inputs are empty | Have Verify button disabled | P1 |
| RO-09 | Keep Verify disabled when fewer than all OTP digits are entered | Fewer than all OTP digits are entered | The primary action control stays disabled | P1 |
| RO-10 | Enable Verify button when all OTP inputs are filled | All OTP inputs are filled | The control becomes enabled | P1 |
| RO-11 | Not accept non-numeric characters in OTP inputs | Enter non-numeric characters in OTP inputs | The value is rejected — not retained in the field | P2 |
| RO-12 | Auto-advance focus to the next input when a digit is entered | A digit is entered | Auto-advance focus to the next input | P1 |
| RO-13 | Have Click to resend button disabled while countdown is active | Load the OTP popup | Have Click to resend button disabled while countdown is active | P1 |
| RO-14 | Enable resend button after countdown expires | Set up the state: resend button after countdown expires | The control becomes enabled | P1 |
| RO-15 | Remain on OTP popup after submitting wrong OTP | Load the OTP popup | Remain on OTP popup after submitting wrong OTP | P1 |
| RO-16 | Advance to the Business Info step after entering the correct OTP | Load the OTP popup | Advance to the Business Info step after entering the correct OTP | P1 |
| RO-17 | Close the OTP popup when Cancel is clicked | Cancel is clicked | Close the OTP popup | P2 |
| RO-18 | Return to the mobile number page when Cancel is clicked | Cancel is clicked | Return to the mobile number page | P2 |
| RO-19 | Pre-fill the mobile number when returning via Cancel | Returning via Cancel | Pre-fill the mobile number | P2 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration OTP popup. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationOtpPopup.spec.ts` — page elements (skips cleanly when OTP is disabled for the environment)
- `BusinessTestCases/Registration/functional/RegistrationOtpFunctionality.spec.ts` — input behavior, resend cooldown, wrong-OTP handling, Cancel flow

Supporting helper: `BusinessTestCases/Registration/RegistrationHelper.ts` (`fillOTP`, `getOtpFromDb`).

---

<!-- source: Registration-Products.md -->
## Registration-Products

## Manual Test Cases — Registration — Products Step (incl. PoS Onboarding Setup)

Context: after NAFATH, the applicant selects which products to enroll in (a Wallet product is mandatory and pre-selected; POS Terminals and others are optional) before advancing to Contract. Selecting POS Terminals reveals an inline PoS Onboarding Setup flow (EMI-5783) — device count, delivery mode (single location vs. per-device split groups), and delivery contact/address — which is documented here alongside the base Products step since it never leaves this screen. `RegistrationPoSOnboarding.spec.ts` (TC-POS-026..028) covers the order-submission side of the same flow.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Products Step UI (Page Elements)

Context: covers "Registration - Products Step UI (Page Elements)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-01 | Display the MJD Pay logo | Load the Products step | The MJD Pay logo is visible | P3 |
| RP-02 | Link the MJD Pay logo to the landing page | Load the Products step | Link the MJD Pay logo to the landing page | P2 |
| RP-03 | Display the EN language button | Load the Products step | The EN language button is visible | P2 |
| RP-04 | Display the Arabic language button | Load the Products step | The Arabic language button is visible | P2 |
| RP-05 | Display the theme toggle button | Load the Products step | The theme toggle button is visible | P2 |
| RP-06 | Display the "Setup" eyebrow text | Load the Products step | The "Setup" eyebrow text is visible | P3 |
| RP-07 | Display the "Products" title | Load the Products step | The "Products" title is visible | P3 |
| RP-08 | Display the products-selection subtitle | Load the Products step | The products-selection subtitle is visible | P3 |
| RP-09 | Display all four outer step labels: Business Info, NAFATH, Products, Contract | Load the Products step | All four outer step labels: Business Info, NAFATH, Products, Contract is visible | P3 |
| RP-10 | Show "Products" as the active outer step | Load the Products step | Show "Products" as the active outer step | P2 |
| RP-11 | Display at least one product card | Load the Products step | At least one product card is visible | P2 |
| RP-12 | Display the required Wallet card | Load the Products step | The required Wallet card is visible | P2 |
| RP-13 | Show a "Show more" link on the Wallet card | Load the Products step | Show a "Show more" link on the Wallet card | P2 |
| RP-14 | Show a price/billing label on every visible product card | Load the Products step | Show a price/billing label on every visible product card | P2 |
| RP-15 | Display the selection counter | Load the Products step | The selection counter is visible | P2 |
| RP-16 | Show a non-zero count in the selection counter on arrival | Load the Products step | Show a non-zero count in the selection counter on arrival | P2 |
| RP-17 | Display the Cancel button | Load the Products step | The Cancel button is visible | P2 |
| RP-18 | Display the Continue button | Load the Products step | The Continue button is visible | P1 |
| RP-19 | Have the Continue button enabled by default via the required product | Load the Products step | Have the Continue button enabled by default via the required product | P1 |

### B. Products Step: PoS Onboarding Setup (EMI-5783)

Context: covers "Registration - Products Step: PoS Onboarding Setup (EMI-5783)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-20 | Expand the PoS Terminals card inline without leaving the Products step | Load the PoS Onboarding Setup panel | Expand the PoS Terminals card inline without leaving the Products step | P2 |
| RP-21 | Show "Request devices now" in the expanded card | Load the PoS Onboarding Setup panel | Show "Request devices now" in the expanded card | P2 |
| RP-22 | Show a Continue button in the expanded card | Load the PoS Onboarding Setup panel | Show a Continue button in the expanded card | P1 |
| RP-23 | Reveal the Devices & Delivery fields after checking "Request devices now" and continuing | Load the PoS Onboarding Setup panel | Reveal the Devices & Delivery fields after checking "Request devices now" and continuing | P2 |
| RP-24 | Show the Devices & Delivery fields | Load the PoS Onboarding Setup panel | Show the Devices & Delivery fields | P2 |
| RP-25 | Not show a wallet picker anywhere in the Devices & Delivery step | Load the PoS Onboarding Setup panel | Not show a wallet picker anywhere in the Devices & Delivery step | P2 |
| RP-26 | Display the delivery mode toggle | Load the PoS Onboarding Setup panel | The delivery mode toggle is visible | P2 |
| RP-27 | Display the Back button in Devices & Delivery | Load the PoS Onboarding Setup panel | The Back button in Devices & Delivery is visible | P2 |
| RP-28 | Default the total-devices count to 1 | Default the total-devices count to 1 | The counter/value updates as expected | P2 |
| RP-29 | Increment the total-devices count when the increase button is clicked | The increase button is clicked | Increment the total-devices count | P2 |
| RP-30 | Decrement the total-devices count when the decrease button is clicked, without going below the minimum | The decrease button is clicked, without going below the minimum | Decrement the total-devices count | P2 |
| RP-31 | Update the total-devices count when typed directly into the field | Typed directly into the field | Update the total-devices count | P2 |
| RP-32 | Select "single location" delivery by default | Select "single location" delivery by default | Selection state updates accordingly | P2 |
| RP-33 | Switch to per-device delivery groups when "split by devices" is selected | "split by devices" is selected | Switch to per-device delivery groups | P2 |
| RP-34 | Display the Add Location Group button in split-by-device mode | Load the PoS Onboarding Setup panel | The Add Location Group button in split-by-device mode is visible | P2 |
| RP-35 | Select the Wathiq national address by default and show the resolved address | Select the Wathiq national address by default and show the resolved address | Selection state updates accordingly | P2 |
| RP-36 | Reveal a custom map location option when selected | Selected | Reveal a custom map location option | P2 |
| RP-37 | Accept a contact name | Load the PoS Onboarding Setup panel | Accept a contact name | P2 |
| RP-38 | Accept a Saudi contact mobile number | Enter a Saudi contact mobile number | The value is accepted and retained in the field | P2 |
| RP-39 | Display the Contract step after completing Devices & Delivery | Load the PoS Onboarding Setup panel | The Contract step after completing Devices & Delivery is visible | P2 |

### C. Products Step

Context: covers "Registration - Products Step".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-40 | Mark "Products" as the active step after NAFATH completes | Load the Products step | Mark "Products" as the active step after NAFATH completes | P1 |
| RP-41 | Display a "View more" link on each product card | Load the Products step | A "View more" link on each product card is visible | P3 |
| RP-42 | Show the annual price on the POS Terminal card instead of Free | Load the Products step | Show the annual price on the POS Terminal card instead of Free | P2 |
| RP-43 | Show the mandatory product pre-selected and locked by default | Load the Products step | Show the mandatory product pre-selected and locked by default | P2 |
| RP-44 | Have the Continue button enabled by default via the mandatory product | Load the Products step | Have the Continue button enabled by default via the mandatory product | P1 |
| RP-45 | Display "1 Selected" by default with only the mandatory product selected | Load the Products step | "1 Selected" by default with only the mandatory product selected is visible | P2 |
| RP-46 | Select an optional product and show "2 Selected" when its card is clicked | Its card is clicked | Select an optional product and show "2 Selected" | P2 |
| RP-47 | Keep the Continue button enabled after selecting another product | Load the Products step | Keep the Continue button enabled after selecting another product | P1 |
| RP-48 | Update the counter to "3 Selected" when a second optional product is selected | A second optional product is selected | Update the counter to "3 Selected" | P2 |
| RP-49 | Allow selecting all six available products | Load the Products step | Allow selecting all six available products | P2 |
| RP-50 | Deselect a product and decrement the counter when its card is clicked again | Its card is clicked again | Deselect a product and decrement the counter | P2 |
| RP-51 | Keep the mandatory product selected once every optional product is deselected | Load the Products step | Keep the mandatory product selected once every optional product is deselected | P2 |
| RP-52 | Show "1 Selected" again once every optional product is deselected | Load the Products step | Show "1 Selected" again once every optional product is deselected | P2 |
| RP-53 | Keep the Cancel button enabled regardless of selection state | Load the Products step | Keep the Cancel button enabled regardless of selection state | P1 |
| RP-54 | Advance past the Products step when Continue is clicked with a product selected | Continue is clicked with a product selected | Advance past the Products step | P1 |

### D. Products Step: PoS Onboarding Setup (EMI-5783) - Devices & Delivery functional

Context: covers "Registration - Products Step: PoS Onboarding Setup (EMI-5783) - Devices & Delivery functional".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-55 | Have the Devices & Delivery Next button enabled by default, even before contact fields are filled | Load the Products step | Have the Devices & Delivery Next button enabled by default, even before contact fields are filled | P1 |
| RP-56 | Keep the Devices & Delivery Next button enabled once contact name and mobile are filled | Load the Products step | Keep the Devices & Delivery Next button enabled once contact name and mobile are filled | P1 |
| RP-57 | Add a second delivery group when Add Location Group is clicked in split-by-device mode | Add Location Group is clicked in split-by-device mode | Add a second delivery group | P2 |
| RP-58 | Remove a delivery group when Remove Location Group is clicked | Remove Location Group is clicked | Remove a delivery group | P2 |
| RP-59 | Return to the expanded PoS card when Back is clicked from Devices & Delivery | Back is clicked from Devices & Delivery | Return to the expanded PoS card | P2 |

### E. Products Step: PoS Onboarding Setup (EMI-5783) - skip request-now path

Context: covers "Registration - Products Step: PoS Onboarding Setup (EMI-5783) - skip request-now path".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-60 | Advance straight to Contract when Continue is clicked without checking "Request devices now" | Continue is clicked without checking "Request devices now" | Advance straight to Contract | P1 |

### F. Onboarding PoS Request Flow (TC-POS-026…028)

Context: covers "Registration — Onboarding PoS Request Flow (TC-POS-026…028)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-61 | Show a validation error for a zero device count (TC-POS-026) | Trigger the condition: a zero device count | A validation error is shown | P2 |
| RP-62 | Show a validation error when split-group quantities do not sum to the total (TC-POS-027) | Trigger the condition: split-group quantities do not sum to the total | A validation error is shown | P2 |
| RP-63 | Send only one PoS order request when Next is clicked twice in quick succession (TC-POS-028) | Next is clicked twice in quick succession | Send only one PoS order request | P2 |

### G. Onboarding PoS Request Flow: submission error handling

Context: covers "Registration — Onboarding PoS Request Flow: submission error handling".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-64 | Surface an error and stay on Devices & Delivery when the PoS order request fails | The PoS order request fails | Surface an error and stay on Devices & Delivery | P2 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Products step and its PoS Onboarding Setup sub-flow. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationProductsPage.spec.ts` — Products step page elements
- `BusinessTestCases/Registration/ui/RegistrationProductsPoSSetup.spec.ts` — PoS Onboarding Setup panel elements (EMI-5783)
- `BusinessTestCases/Registration/functional/RegistrationProductsFunctionality.spec.ts` — product selection/counter logic, and the PoS Devices & Delivery functional sub-flow
- `BusinessTestCases/Registration/functional/RegistrationPoSOnboarding.spec.ts` — PoS order-request submission (TC-POS-026..028)

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationProductsPage.ts`.

---

<!-- source: Registration-Verification-Uploads.md -->
## Registration-Verification-Uploads

## Manual Test Cases — Registration — Verification & Uploads Step (Tab 3 of 3)

Context: Tab 3 (final tab) of registration. The applicant provides an IBAN plus its proof document, a VAT number plus its certificate, and a bank, then clicks Sign Up to submit the registration for NAFATH/OTP verification.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### A. Verification & Uploads Step (Tab 3 of 3) — read-only

Context: covers "Registration – Verification & Uploads Step (Tab 3 of 3) — read-only".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RVU-01 | Display the MJD Pay logo | Load the Verification & Uploads tab | The MJD Pay logo is visible | P3 |
| RVU-02 | Link the MJD Pay logo to the landing page | Load the Verification & Uploads tab | Link the MJD Pay logo to the landing page | P2 |
| RVU-03 | Display the EN language button | Load the Verification & Uploads tab | The EN language button is visible | P2 |
| RVU-04 | Display the Arabic language button | Load the Verification & Uploads tab | The Arabic language button is visible | P2 |
| RVU-05 | Display the Switch theme button | Load the Verification & Uploads tab | The Switch theme button is visible | P2 |
| RVU-06 | Show the Verification & Uploads step title | Load the Verification & Uploads tab | Show the Verification & Uploads step title | P2 |
| RVU-07 | Keep outer step 1 (Business Info) active while on Verification & Uploads | Load the Verification & Uploads tab | Keep outer step 1 (Business Info) active while on Verification & Uploads | P2 |
| RVU-08 | Display all four outer step indicators | Load the Verification & Uploads tab | All four outer step indicators is visible | P2 |
| RVU-09 | Display the IBAN field | Load the Verification & Uploads tab | The IBAN field is visible | P2 |
| RVU-10 | Show the correct placeholder for IBAN | Load the Verification & Uploads tab | Show the correct placeholder for IBAN | P2 |
| RVU-11 | Display the IBAN hint "24 characters starting with SA" | Load the Verification & Uploads tab | The IBAN hint "24 characters starting with SA" is visible | P3 |
| RVU-12 | Display the IBAN Proof upload label | Load the Verification & Uploads tab | The IBAN Proof upload label is visible | P3 |
| RVU-13 | Display the "Click to upload" prompt for IBAN proof | Load the Verification & Uploads tab | The "Click to upload" prompt for IBAN proof is visible | P2 |
| RVU-14 | Display the IBAN proof upload helper text | Load the Verification & Uploads tab | The IBAN proof upload helper text is visible | P3 |
| RVU-15 | Display the accepted file types for IBAN proof (PDF, JPG) | Load the Verification & Uploads tab | The accepted file types for IBAN proof (PDF, JPG) is visible | P2 |
| RVU-16 | Display the max file size for IBAN proof (5MB) | Load the Verification & Uploads tab | The max file size for IBAN proof (5MB) is visible | P2 |
| RVU-17 | Display the VAT Number field | Load the Verification & Uploads tab | The VAT Number field is visible | P2 |
| RVU-18 | Show the correct placeholder for VAT Number | Load the Verification & Uploads tab | Show the correct placeholder for VAT Number | P2 |
| RVU-19 | Display the VAT Number hint "From your VAT certificate" | Load the Verification & Uploads tab | The VAT Number hint "From your VAT certificate" is visible | P3 |
| RVU-20 | Display the VAT Certificate upload label | Load the Verification & Uploads tab | The VAT Certificate upload label is visible | P3 |
| RVU-21 | Display the "Click to upload" prompt for VAT certificate | Load the Verification & Uploads tab | The "Click to upload" prompt for VAT certificate is visible | P2 |
| RVU-22 | Display the VAT certificate upload helper text | Load the Verification & Uploads tab | The VAT certificate upload helper text is visible | P3 |
| RVU-23 | Display the post-submit OTP/NAFATH verification notice | Load the Verification & Uploads tab | The post-submit OTP/NAFATH verification notice is visible | P1 |
| RVU-24 | Display the Back button | Load the Verification & Uploads tab | The Back button is visible | P2 |
| RVU-25 | Display the Sign Up button | Load the Verification & Uploads tab | The Sign Up button is visible | P1 |
| RVU-26 | Keep Sign Up disabled when required fields are empty | Required fields are empty | The primary action control stays disabled | P1 |
| RVU-27 | Display "Already have an account?" text | Load the Verification & Uploads tab | "Already have an account?" text is visible | P3 |
| RVU-28 | Display the Log In link | Load the Verification & Uploads tab | The Log In link is visible | P3 |
| RVU-29 | Display Terms & Conditions reference | Load the Verification & Uploads tab | Terms & Conditions reference is visible | P2 |
| RVU-30 | Display Privacy Policy reference | Load the Verification & Uploads tab | Privacy Policy reference is visible | P2 |

### B. Verification & Uploads Step (Tab 3 of 3)

Context: covers "Registration – Verification & Uploads Step (Tab 3 of 3)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RVU-31 | Display the Back button | Load the Verification & Uploads tab | The Back button is visible | P2 |
| RVU-32 | Display the Sign Up button | Load the Verification & Uploads tab | The Sign Up button is visible | P1 |
| RVU-33 | Keep Sign Up disabled when required fields are empty | Required fields are empty | The primary action control stays disabled | P1 |
| RVU-34 | Display the IBAN field | Load the Verification & Uploads tab | The IBAN field is visible | P2 |
| RVU-35 | Show the correct placeholder for IBAN | Load the Verification & Uploads tab | Show the correct placeholder for IBAN | P2 |
| RVU-36 | Display the IBAN hint "24 characters starting with SA" | Load the Verification & Uploads tab | The IBAN hint "24 characters starting with SA" is visible | P3 |
| RVU-37 | Accept a valid IBAN | Enter a valid IBAN | The value is accepted and retained in the field | P2 |
| RVU-38 | Show a validation error for an IBAN that does not start with SA | Trigger the condition: an IBAN that does not start with SA | A validation error is shown | P2 |
| RVU-39 | Show a validation error for an IBAN shorter than 24 characters | Trigger the condition: an IBAN shorter than 24 characters | A validation error is shown | P2 |
| RVU-40 | Show a validation error for a well-formed IBAN that fails the checksum | Trigger the condition: a well-formed IBAN that fails the checksum | A validation error is shown | P2 |
| RVU-41 | Display the IBAN Proof upload area | Load the Verification & Uploads tab | The IBAN Proof upload area is visible | P2 |
| RVU-42 | Display the IBAN proof upload hint text | Load the Verification & Uploads tab | The IBAN proof upload hint text is visible | P3 |
| RVU-43 | Display the accepted file types for IBAN proof (PDF, JPG) | Load the Verification & Uploads tab | The accepted file types for IBAN proof (PDF, JPG) is visible | P2 |
| RVU-44 | Display the max file size for IBAN proof (5MB) | Load the Verification & Uploads tab | The max file size for IBAN proof (5MB) is visible | P2 |
| RVU-45 | Display the "Click to upload" prompt for IBAN proof | Load the Verification & Uploads tab | The "Click to upload" prompt for IBAN proof is visible | P2 |
| RVU-46 | Display the VAT Number field | Load the Verification & Uploads tab | The VAT Number field is visible | P2 |
| RVU-47 | Show the correct placeholder for VAT Number | Load the Verification & Uploads tab | Show the correct placeholder for VAT Number | P2 |
| RVU-48 | Display the VAT Number hint "From your VAT certificate" | Load the Verification & Uploads tab | The VAT Number hint "From your VAT certificate" is visible | P3 |
| RVU-49 | Accept a valid VAT Number | Enter a valid VAT Number | The value is accepted and retained in the field | P2 |
| RVU-50 | Show a validation error for a VAT Number shorter than 15 digits | Trigger the condition: a VAT Number shorter than 15 digits | A validation error is shown | P3 |
| RVU-51 | Not retain alphabetic characters in the VAT Number field | Enter alphabetic characters in the VAT Number field | The value is not retained in the field | P2 |
| RVU-52 | Show a validation error for a 15-digit VAT Number not starting with 2 or 3 | Trigger the condition: a 15-digit VAT Number not starting with 2 or 3 | A validation error is shown | P2 |
| RVU-53 | Not allow more than 15 digits in the VAT Number field | Attempt to enter more than 15 characters | Input is capped at 15 characters | P3 |
| RVU-54 | Display the VAT Certificate upload area | Load the Verification & Uploads tab | The VAT Certificate upload area is visible | P2 |
| RVU-55 | Display the accepted file type for VAT certificate (PDF) | Load the Verification & Uploads tab | The accepted file type for VAT certificate (PDF) is visible | P2 |
| RVU-56 | Not execute an XSS payload entered in the IBAN field | Enter a script/JS-URI payload in IBAN field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RVU-57 | Not execute an XSS payload entered in the VAT Number field | Enter a script/JS-URI payload in VAT Number field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RVU-58 | Treat a SQL injection pattern in the IBAN field as invalid | Enter a SQL-injection-shaped string in IBAN field and submit | The value is handled as inert text — rejected as invalid input, not executed against a database | P1 |

### C. File upload interactions

Context: covers "File upload interactions".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RVU-59 | Accept a valid PDF for IBAN proof upload | Enter a valid PDF for IBAN proof upload | The value is accepted and retained in the field | P2 |
| RVU-60 | Accept a valid PDF for VAT certificate upload | Enter a valid PDF for VAT certificate upload | The value is accepted and retained in the field | P2 |
| RVU-61 | Accept a non-PDF file type for VAT certificate upload (no client-side type restriction) | Enter a non-PDF file type for VAT certificate upload (no client-side type restriction) | The value is accepted and retained in the field | P2 |
| RVU-62 | Accept an English-named PDF for IBAN proof upload | Enter an English-named PDF for IBAN proof upload | The value is accepted and retained in the field | P2 |
| RVU-63 | Accept an Arabic-named PDF for IBAN proof upload | Enter an Arabic-named PDF for IBAN proof upload | The value is accepted and retained in the field | P2 |
| RVU-64 | Accept an English-named PDF for VAT certificate upload | Enter an English-named PDF for VAT certificate upload | The value is accepted and retained in the field | P2 |
| RVU-65 | Accept an Arabic-named PDF for VAT certificate upload | Enter an Arabic-named PDF for VAT certificate upload | The value is accepted and retained in the field | P2 |
| RVU-66 | Reject an unsupported file type for IBAN proof upload | Enter an unsupported file type for IBAN proof upload | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RVU-67 | Reject a file larger than 5MB for IBAN proof upload | Enter a file larger than 5MB for IBAN proof upload | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RVU-68 | Reject a file larger than 5MB for VAT certificate upload | Enter a file larger than 5MB for VAT certificate upload | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RVU-69 | Display the post-submit NAFATH verification notice | Load the Verification & Uploads tab | The post-submit NAFATH verification notice is visible | P1 |
| RVU-70 | Enable Sign Up when Bank, IBAN, VAT Number, and both proof uploads are filled | Bank, IBAN, VAT Number, and both proof uploads are filled | The control becomes enabled | P1 |
| RVU-71 | Display "Already have an account?" text | Load the Verification & Uploads tab | "Already have an account?" text is visible | P3 |
| RVU-72 | Display Terms & Conditions link | Load the Verification & Uploads tab | Terms & Conditions link is visible | P3 |
| RVU-73 | Display Privacy Policy link | Load the Verification & Uploads tab | Privacy Policy link is visible | P3 |

---

### Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Verification & Uploads step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationVerificationPage.spec.ts` — page elements (read-only)
- `BusinessTestCases/Registration/functional/RegistrationVerificationUploads.spec.ts` — IBAN/VAT field validation (format, checksum, length, XSS/SQLi) and file-upload interactions (type, size, filename encoding, accept/reject)

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationVerificationPage.ts`.

---

<!-- source: Topup.md -->
## Topup

## Manual Test Cases — Topup (Card Top-Up UI Detail)

Context: this document drills into the Topup screen (`/business/main/transfer/top-up`) at UI-element
granularity — mirroring the level of detail in `HomePage.md`/`BankTransfer.md` — and complements the
higher-level business-flow cases already in `B2B-Transactions.md` section D (`TU-01..TU-14`, HyperPay/
VIBAN/SADAD) and the Admin-Portal-gated business rules in sections M/N/O (`TU-WB##` wallet-balance
limits, `TU-TL##` transaction limits — still manual-only, pending Admin Portal automation; `TU-CM##`
commission is automated in `functional/TopupCommission.spec.ts`, see that file for which cases remain
`test.skip()`-ed). This doc uses its own `TUP-##` ID prefix so it never collides with the `TU-` range
already claimed there. It mirrors the existing automation under `BusinessTestCases/Topup/` (currently
`ui/TopupUI.spec.ts`, `api/TopupAPI.spec.ts`, `functional/Topup{HappyPath,Negative,Security,Navigation,
OtpFlow,Commission}.spec.ts` — VIBAN/SADAD top-up automation was archived and removed, not currently
maintained) and cross-links each section to that coverage instead of restating it.

Cases below were captured against the **dev** environment (`dev.majdpay.com`) via two independent live
manual walkthroughs on 2026-09-17, cross-checked against `BusinessTestCases/pageElements/Topup/TopupPage.ts`
and `QA-DATA-TESTID-HANDOFF.md` section 4.5.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

### Findings from these walkthroughs — worth investigating before treating this doc as final

- **[Confirmed] Disclaimer text mismatch.** The live dev page under the amount field reads
  *"Disclaimer: We at MJD Pay do not store any of your card information."* — but
  `TopupPage.ts`'s `disclaimerText` locator (and `ui/TopupPage.spec.ts`'s "should display the Hyper Pay
  disclaimer text" test) matches `/disclaimer:\s*top up is powered by hyper pay/i`. Either the copy
  changed after the locator was written (test may now be failing or matching a stale fallback) or dev
  is serving different copy than what automation targets against UAT/preprod. Confirm which environment
  is right and update whichever side is stale — see TUP-19.
- **[Confirmed] Summary total-row label mismatch.** The live dev Summary screen labels the final row
  **"Total Amount to be Received"**, but `TopupPage.waitForSummaryToSettle()` and
  `ui/TopupSummaryPage.spec.ts` both look up the row by the label **"Total amount to be sent"** (copied
  from the BankTransfer page object, where money flows out). If the locator is matching on a substring
  or fallback rather than this exact label, `getSummaryMoney('Total amount to be sent')` may be silently
  resolving to nothing / a stale element rather than actually reading the total — worth a targeted check
  rather than assuming the automation is currently passing for the right reason. See TUP-17.
- **[Confirmed] OTP is requested before card entry, not after.** The first walkthrough saw OTP
  requested immediately after confirming the Summary screen, before any card-details/HyperPay popup
  appeared (flow: Amount → Proceed → Summary → Confirm → OTP → [pop-up blocked before reaching card
  entry]). A second, independent walkthrough corroborates this structurally: its own screen inventory
  lists only three screens for the whole flow — Main Page → Top Up Summary → OTP Verification — followed
  by a distinct **"Post-verification redirect (main Topup page)"** state where the pop-up-blocked banner
  actually appears. There is no card-entry screen anywhere before OTP in either capture; the app only
  attempts to open the card-entry/3-D-Secure popup *after* OTP verification redirects back to the main
  page. `TopupFlow.spec.ts`'s full card-payment flow instead fills card details and clicks **Pay Now**
  first, then checks `if (await otp.isVisible())` **after** the gateway popup closes — that ordering
  looks backwards relative to what dev actually does. See TUP-23; if `TopupFlow.spec.ts` is passing
  today, it's worth confirming it isn't doing so against a stale/mocked step order.
- **[Confirmed] Summary's Confirm button triggers the OTP send itself.** Both walkthroughs agree the
  Summary screen's primary button shows a spinner and the label "Loading" while its request is in
  flight, and that request is what sends the OTP — reinforcing the finding above rather than a separate
  issue. See TUP-21.
- **[New] Commission/VAT read as 0 in both manual runs.** Neither walkthrough exercised an account with
  a live fee-bearing commission tier, so TUP-17's "equals Original Amount + Commission + VAT" claim is
  untested against a non-zero commission in this doc. The automated `TU-CM19..32` cases in
  `functional/TopupCommission.spec.ts` already cover this against the account's live tier — this is a
  gap in manual coverage specifically, not a defect.
- **[Guess]** The pop-up-blocked banner ("Please allow pop-ups to continue the payment.") suggests the
  card-entry/3-D-Secure step opens in a new browser window/tab (matching `TopupPage.ts`'s
  `clickSummaryNextAndCapturePopup`), so TUP-30/TUP-31 assume that; neither manual pass could verify the
  actual card-entry screen or a completed payment because pop-ups were blocked in both sessions.

---

### A. Entry points & page identity

Context: Topup is reachable from the sidebar "Topup" link and from the homepage "Add money via card"
quick action; both should land on an identical page. TUP-01/TUP-02 are automated in
`functional/TopupNavigation.spec.ts`; TUP-03 is covered at a basic level by `ui/TopupUI.spec.ts`.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-01 | Sidebar link opens Topup | Click "Topup" in the left sidebar | User lands on `/business/main/transfer/top-up`; sidebar highlights "Topup" as the active item | P2 |
| TUP-02 | Homepage quick action opens Topup | From the homepage, click the "Add money via card" quick-action card | User lands on the same Topup page as TUP-01 | P2 |
| TUP-03 | Page title and subtitle | Land on Topup via either entry point | Heading reads "Top up"; subtitle reads "Add funds to your business wallet using a card or wallet supported in Saudi Arabia." | P3 |
| TUP-04 | Direct URL requires auth | Log out, then navigate directly to `/business/main/transfer/top-up` | User is redirected to the login page; Topup content is not rendered | P1 |

---

### B. Balance card

Context: shared `mp-` balance component (also used on BankTransfer/HomePage). Basic presence already
covered by `ui/TopupPage.spec.ts` ("Current Balance label", "wallet code", "QR/settings buttons").

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-05 | Balance and wallet code match account | Open Topup for an account with a known balance/wallet code | Displayed "CURRENT BALANCE" value (e.g. 0.00) and "Wallet code" (e.g. MER-Q9EK4TTPGE-30) are account-specific, read-only, and match the account's actual records | P2 |
| TUP-06 | Generate QR Code action | Click the QR icon (`aria-label="generate QR Code"`) on the balance card | A wallet QR code is generated/displayed | P3 |
| TUP-07 | Wallet settings action | Click the gear icon (`aria-label="wallet settings"`) on the balance card | Wallet settings view/dialog opens | P3 |

---

### C. Payment methods

Context: MADA / VISA / MASTER render as single-select cards (`page.getByRole('radio')` per
`TopupPage.ts`). Presence and count already covered by `ui/TopupPage.spec.ts`.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-08 | No method selected by default | Land fresh on the Topup page | None of MADA/VISA/MASTER show the selected (checkmark) state | P3 |
| TUP-09 | Selecting a method highlights it | Click the VISA card | VISA shows a blue border and checkmark; single-select among MADA/VISA/MASTER | P2 |
| TUP-10 | Methods are mutually exclusive | Select MADA, then select VISA | MADA's checkmark clears; only VISA remains selected | P2 |
| TUP-11 | Proceed disabled with no method selected | Enter a valid amount (e.g. 500) but select no payment method | Proceed stays disabled | P1 |

---

### D. Amount field — format & validation

Context: `input#input_set_amount` / `getByTestId('amount-input')`. Interaction-level validation is
already data-driven in `functional/TopupFlow.spec.ts` via `data/topupData.json` — confirmed automated
cases include: `-10.00` → typed value normalizes to `10.00` (sign stripped, not rejected); `0` → rejected,
Proceed disabled; `abc!@#` → rejected, Proceed disabled; `10.55` / `10.5` accepted as typed; `10.555` →
truncated to `10.55` (max 2 decimals); clipboard-paste of `25.00` accepted, clipboard-paste of
`invalid_text` rejected. The rows below cover what that dataset does **not** currently exercise.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-12 | Inline error text for zero amount | Type `0` into the amount field | Field border turns red and an inline message "Amount should be more than 0" is shown | P2 |
| TUP-13 | **[Gap — not in `topupData.json`]** Long integer amount is capped | Type a 9-digit value, e.g. `999999999` | Observed on dev in both manual runs: field silently truncates to 7 digits (`9999999`) with **no** visible error/warning — confirm this 7-digit / ~9,999,999 ceiling is the intended business maximum, and whether a max-amount message should be shown instead of silent truncation | P2 |
| TUP-14 | Preset chip then manual override | Click the "500" chip, then manually edit the field to a different value | Field shows the manually typed value; no chip remains visually selected | P2 |
| TUP-15 | Currency icon always present | With the field empty and with a value entered | The currency icon prefix (`.mp-amount-currency`) is visible in both states | P3 |

---

### E. Preset amount chips

Context: `getByTestId('amount-chip-<value>')` for 500/1000/2000/5000/10000. Presence covered by
`ui/TopupPage.spec.ts` ("Or select amount" label + 5 chips).

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-16 | Each chip populates the amount field | Click 500, then 1000, then 2000, then 5000, then 10000 in turn | Amount field updates to match the clicked chip each time | P2 |

---

### F. Top Up Summary

Context: appears after Proceed — either **inline** (`topup-summary-cancel-btn` / `topup-summary-next-btn`)
or as a **modal** (`topup-summary-modal-cancel-btn` / `topup-summary-modal-next-btn`) per
`QA-DATA-TESTID-HANDOFF.md` §4.5. Row-level checks already covered by `ui/TopupSummaryPage.spec.ts`.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-17 | Total row reads correctly | Proceed to Summary with a valid method + amount | Final total row is labeled **"Total Amount to be Received"** on this build and equals Original Amount + Commission + VAT (both manual runs observed Commission/VAT as 0 — verify against a fee-bearing tier; see Findings and `functional/TopupCommission.spec.ts`'s `TU-CM19..32`) | P1 |
| TUP-18 | Inline vs. modal presentation | Reach the Summary step from both the sidebar entry point and the homepage quick-action entry point (and, if applicable, at a narrower viewport) | Confirm and document which conditions produce the inline panel vs. the modal variant — behavior is not yet documented anywhere in this repo | P3 |
| TUP-19 | Disclaimer copy matches current build | Read the disclaimer banner on the main Topup form | Confirm actual wording against `ui/TopupPage.spec.ts`'s expectation ("...powered by Hyper Pay") — dev currently shows different copy about not storing card information (see Findings) | P2 |
| TUP-20 | Cancel returns without side effects | On the Summary screen, click "Cancel" | User returns to the main Topup form; balance and transaction history are unchanged | P2 |
| TUP-21 | Confirm shows a loading state and triggers OTP send | On the Summary screen, click the primary Confirm/Proceed button | Button shows a spinner and the label "Loading" while the request is in flight; that request is what sends the OTP (see Findings) — user then lands on the OTP screen | P2 |

---

### G. OTP verification

Context: `topup-otp-cancel-btn` / `topup-otp-verify-btn` / `topup-otp-resend-btn`. Confirm against the
sequencing finding above before treating this section as fully accurate for every payment method.
TUP-24, TUP-25, TUP-27, and TUP-29 are automated in `functional/TopupOtpFlow.spec.ts`; TUP-26 is
automated there too, but for the timer restarting, not for clearing entered digits — confirmed live
2026-09-27 that Resend leaves already-typed digits in place, unlike Login's own OTP screen. TUP-22 is
covered by `ui/TopupUI.spec.ts`; TUP-28 by `functional/TopupNegative.spec.ts`.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-22 | OTP screen content | Reach the OTP step | Subtitle reads "A code has been sent to you, in order to continue with the top up process."; a mini summary is shown above 6 single-digit input boxes, keyed "MERCHANT TOP UP" / selected payment method and "TOTAL AMOUNT TO BE RECEIVED" / total — both mini-summary labels render all-caps, unlike the Summary screen's own title-case "Total Amount to be Received" (TUP-17); worth a copy-consistency check, not necessarily a defect | P2 |
| TUP-23 | OTP sequencing vs. gateway | Proceed through a full card top-up | Confirm and document at which point OTP is actually requested relative to the HyperPay/3-D-Secure card entry step for each payment method — both manual runs saw OTP requested *before* card entry, with the card-entry popup only attempted after the post-verification redirect back to the main page (see Findings) | P1 |
| TUP-24 | Countdown timer behavior | Land on the OTP screen and watch the "Code ends MM:SS" timer | Timer starts at roughly 60 seconds (observed live as "Code ends 00:51" moments after landing) and counts down in real time to 00:00 without resetting or freezing; confirm exact starting value and behavior once it reaches 00:00 | P2 |
| TUP-25 | Resend before expiry | Click "Click to resend" while the timer is still running | Confirmed live 2026-09-27: the button itself stays disabled while the countdown is running, so this can't actually be clicked before expiry — "blocked" by the disabled state, not a distinct clickable-but-rejected behavior | P3 |
| TUP-26 | Resend after expiry | Wait for the timer to reach 00:00, then click "Click to resend" | A new OTP is sent and the timer restarts; confirmed live 2026-09-27 that already-entered digits are NOT cleared (differs from Login's own OTP screen) | P2 |
| TUP-27 | Verify stays disabled until all digits are entered | Land on the OTP screen and enter fewer than 6 digits | "Verify" button remains disabled; confirmed live 2026-09-27 that this screen's widget auto-submits the instant the 6th digit lands (see `pageElements/Shared/OtpPage.ts`), so there's no observable "enabled but unclicked" state to separately confirm the way Login's own screen has | P2 |
| TUP-28 | Incorrect OTP rejected | Enter an incorrect 6-digit code and click "Verify" | A clear error is shown; user cannot proceed to payment | P1 |
| TUP-29 | Cancel aborts the top-up | On the OTP screen, click "Cancel" | Top-up is aborted; user returns to the main Topup page; no funds move | P2 |

---

### H. Payment gateway redirect & pop-up blocking

Context: card entry happens in a separate window (`context().waitForEvent('page')` in
`TopupPage.clickSummaryNextAndCapturePopup`) — a HyperPay iframe for VISA, a `card_*`-named 3-D-Secure
iframe for MADA/MASTER. Not reachable in either manual pass because the browser blocked the pop-up both
times.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-30 | Pop-up-blocked messaging | Complete OTP verification and let the app attempt to open the card-entry window with the browser's pop-up blocker enabled | User is redirected back to the main Topup page, where a banner reading "Please allow pop-ups to continue the payment." is shown at the bottom | P2 |
| TUP-31 | Gateway opens once pop-ups are allowed | Allow pop-ups for the site, then retry | A new window/tab opens showing card-entry fields (Card Number, Expiry, Card holder, CVV) and a "Pay Now" button | P1 |
| TUP-32 | Pay Now disabled until required fields are complete | Open the card-entry window and leave one field empty | "Pay Now" remains disabled; confirm exact enable condition | P2 |
| TUP-33 | Declined payment leaves balance unchanged | Complete a card payment using a gateway-simulator return code for "failed" | A "Payment failed" result is shown; balance is unchanged; the transaction appears as FAILED in Transactions | P1 |
| TUP-34 | Pending payment leaves balance unchanged | Complete a card payment using a gateway-simulator return code for "pending" | A "Payment pending confirmation" result is shown; balance is unchanged until resolved | P2 |
| TUP-35 | Card number and CVV are captured in the gateway's PCI iframe, not MJD Pay's own page | Open the card-entry gateway popup reached via TUP-31 and inspect the Card Number and CVV fields (DOM/frame structure, not just visually) | Card Number and CVV render inside separate PCI-compliant iframes hosted and served by the HyperPay/OPPWA gateway (confirmed live as `iframe[name="card.number"]` and `iframe[name="card.cvv"]` in `TopupPage.ts`), not as plain inputs on MJD Pay's own page; keystrokes typed into them never reach MJD Pay's own frame, DOM or network requests and cannot leak into app logs. Only Expiry and Card Holder are plain page-level fields, not iframes. | P1 |

---

### Cross-references

- Business-flow happy path (HyperPay / VIBAN / SADAD), amount-format rule statement: `B2B-Transactions.md` section D (`TU-01`–`TU-14`).
- Wallet-balance ceiling rules (Admin Portal-gated): `B2B-Transactions.md` section M (`TU-WB01`–`TU-WB08`).
- Transaction amount/count limit rules (Admin Portal-gated): `B2B-Transactions.md` section N (`TU-TL01`–`TU-TL12`).
- Commission rules (Admin Portal-gated) and the live-tier automated suite: `B2B-Transactions.md` section O (`TU-CM01`–`TU-CM18`), `functional/TopupCommission.spec.ts` (`TU-CM19`–`TU-CM32`).
- Automated coverage: `BusinessTestCases/Topup/ui/TopupUI.spec.ts`, `api/TopupAPI.spec.ts`, `functional/TopupHappyPath.spec.ts`, `functional/TopupNegative.spec.ts`, `functional/TopupSecurity.spec.ts`, `functional/TopupNavigation.spec.ts`, `functional/TopupOtpFlow.spec.ts`, `functional/TopupCommission.spec.ts` (a few individual `TU-CM` cases there remain `test.skip()`-ed — see that file). VIBAN/SADAD top-up and the wallet-balance/transaction-limit business rules (`TU-WB##`/`TU-TL##`) have no current automation — their earlier spec files were archived and removed as unmaintained.
- Locator reference: `QA-DATA-TESTID-HANDOFF.md` section 4.5; page object: `BusinessTestCases/pageElements/Topup/TopupPage.ts`.

---

<!-- source: Transaction-Operations.md -->
## Transaction-Operations

## Manual Test Cases — Transaction Operations

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

### A. Money Request (EMI-834)

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

### B. Reconciliation (EMI-4537, epic EMI-2177)

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

### C. End-of-Day (EOD) Processing (EMI-636, EMI-637, EMI-710, EMI-5258, EMI-5920, EMI-5771)

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

### D. Transaction Reversal (EMI-2028, epic EMI-2208)

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

### E. Transaction Adjustment (EMI-2219, epic EMI-2209)

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

### F. Transaction Ledger — Initiator Attribution (EMI-5839)

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

### Automated coverage note

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

