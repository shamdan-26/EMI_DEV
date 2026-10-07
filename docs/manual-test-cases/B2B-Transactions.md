# Manual Test Cases — B2B Transactions

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

## A. Create Bill (Biller — EMI-183, EMI-242, EMI-3020)

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

## B. Pay Bill (Merchant/Customer — EMI-170)

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

## C. Wallet-to-Wallet Transfer (Business — EMI-4281)

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

## D. Top Up (EMI-171, EMI-3564)

Context: an admin/business user tops up their wallet via HyperPay (card), a manual VIBAN bank transfer,
or by generating and paying a SADAD bill.

### D.1 HyperPay (card) top-up

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

### D.2 VIBAN bank transfer top-up

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| TU-06 | Unique VIBAN displayed with instructions | Open the bank-transfer top-up option | User's unique VIBAN and manual-transfer instructions are shown | P2 | EMI-171 |
| TU-07 | Wallet credited once bank transaction is confirmed | Transfer funds to the VIBAN externally, wait for the scheduled bank-integration job to run | Wallet balance updates automatically once the bank confirms the transaction | P2 | EMI-171 |
| TU-08 | Processing-delay messaging shown | Open the VIBAN top-up screen | User is informed of potential delays based on bank processing time | P3 | EMI-171 |

### D.3 SADAD bill top-up

| ID | Title | Steps | Expected Result | Priority | Ticket |
|---|---|---|---|---|---|
| TU-09 | Generate a SADAD top-up bill | Open Top-Up → SADAD, enter an amount, submit | Sadad "Create Bill" API succeeds; a bill reference, amount, due date, and payment instructions are returned and displayed | P1 | EMI-3564 |
| TU-10 | Download/copy SADAD bill reference | View a created SADAD bill | "Download PDF" or "Copy Reference" option is available and works | P2 | EMI-3564 |
| TU-11 | "My Sadad Bills" list shows all created bills | Create ≥2 SADAD bills, open the list | Each entry shows reference number, amount, creation date, and status (Pending/Paid/Expired) | P2 | EMI-3564 |
| TU-12 | Wallet credited on SADAD payment confirmation | Pay a generated SADAD bill externally via Sadad, wait for callback/poll | Once status flips to Paid, wallet is credited the exact top-up amount and an in-app + email confirmation is sent | P1 | EMI-3564 |
| TU-13 | SADAD bill creation API error surfaced | Force the Sadad "Create Bill" call to fail | A user-friendly error message is shown; no bill/top-up recorded | P2 | EMI-3564 |
| TU-14 | Expired SADAD bill blocks top-up | Let a generated SADAD bill pass its due date unpaid | Bill is marked Expired; no top-up occurs if later paid | P2 | EMI-3564 |

---

## E. Wallet Payment QR (EMI-590, EMI-3545, EMI-922)

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

## F. Guest Flow (Payment Links / Guest Checkout — EMI-5424, EMI-5446, EMI-5523, EMI-5551, EMI-5640, EMI-5653, EMI-5860)

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

## G. Wallet-to-Wallet Transfer — Wallet Balance Limits (EMI-659, EMI-1653, EMI-195)

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

## H. Wallet-to-Wallet Transfer — Transaction Limits (EMI-87, EMI-1653, EMI-195)

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

## I. Wallet-to-Wallet Transfer — Commission (EMI-2031)

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

## J. Pay Bill — Wallet Balance Limits (EMI-659, EMI-1653, EMI-195)

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

## K. Pay Bill — Transaction Limits (EMI-87, EMI-1653, EMI-195)

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

## L. Pay Bill — Commission (EMI-2031)

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

## M. Top Up — Wallet Balance Limits (EMI-659, EMI-1653, EMI-195)

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

## N. Top Up — Transaction Limits (EMI-87, EMI-1653, EMI-195)

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

## O. Top Up — Commission (EMI-2031)

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

### Live single-tier schema validation (EMI-2031)

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

### Account-level commission validation (EMI-2031)

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

## P. Wallet Payment QR — Wallet Balance Limits (EMI-659, EMI-1653, EMI-195)

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

## Q. Wallet Payment QR — Transaction Limits (EMI-87, EMI-1653, EMI-195)

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

## R. Wallet Payment QR — Commission (EMI-2031)

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

## S. Bill Beneficiary Management (EMI-185, epic EMI-2192)

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

## Automated coverage note

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
