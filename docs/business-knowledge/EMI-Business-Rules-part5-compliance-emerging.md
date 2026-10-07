# EMI Business Rules Reference — Compliance & Emerging Small Modules

Companion to `EMI-Refined-User-Stories-part5-compliance-emerging.md` (the critique/findings doc for this same batch). This file distills what the business actually specifies — not critique. Read the source ticket before automating against this.

Scope: 22 modules / 45 stories.

---

## Partner bank (`EMI-2207`)

**Multi-Omnibus Account Routing & Rebalancing (EMI-4935):** MajdPay holds wallets across several bank/partner omnibus accounts simultaneously; a wallet is never bound to one omnibus — omnibus accounts are liquidity pools, not ownership accounts. When a transaction needs external settlement, the system picks the *cheapest eligible* omnibus: same-bank destination preferred over interbank, then lowest fee, fastest settlement, sufficient balance, no operational/regulatory blocker. An omnibus below its configured minimum threshold is excluded from routing entirely. Balances drift over time and are periodically (schedule or threshold-triggered) rebalanced via internal treasury transfers — invisible to customers, fully audited with the selected omnibus and decision factors logged per transaction.

**Partner Bank Management with Fees & Cost Configuration (EMI-1978, re-opened):** Each partner bank is configured with its identity, its omnibus/control IBAN, and a full set of collection IBANs (Revenue, Expenses, Reserve, VAT, Dormant/Suspense). Creating a partner bank **automatically creates its Control Wallet and all Collection Wallets** (Revenue/Expenses/VAT/Dormant/Reserve), each with its own vIBAN, immediately usable as an omnibus. All bank-imposed fees (same-bank/interbank/cross-border transfer, settlement/batch/monthly service, failed/returned/chargeback) are configured per bank as fixed or percentage, and these fee values are what the routing engine in EMI-4935 uses to pick the cheapest omnibus. Deactivating a bank excludes it from new routing but keeps it for reconciliation/history; it can't be deleted while it has active transactions or unsettled balances, and can't be deactivated if it's the only active omnibus.

---

## BIN Sponsorship – JIT Debit-card style (`EMI-4194`)

This is a distinct card architecture from the pre-funded model (EMI-2604/EMI-3106) — under JIT, **funds never leave EMI until an actual spend occurs**; the card scheme calls EMI in real time on every transaction rather than debiting a pre-loaded balance.

- **Authorization Handling (EMI-4200):** on every card swipe, the BIN sponsor's processor calls EMI's `/authDecision` webhook with card/wallet/amount/merchant/MCC. EMI must respond **within ≤800ms** (sponsor auto-declines on timeout) after checking balance, limits, velocity, and AML/fraud. Approved → reserve the amount as a `PENDING` ledger entry and return `APPROVE`; declined → return a structured reason code (`INSUFFICIENT_FUNDS`, `SUSPENDED_CARD`, etc.). Every request/response is logged with latency and outcome; idempotent by correlation ID so a sponsor retry can't double-reserve.
- **Release and Refund Processing (EMI-4201):** follow-up events (clearing/settlement or reversal/expiry) resolve the `PENDING` reservation — settlement finalizes the debit (`SUCCESS`), reversal/expiry releases the hold back to the wallet (`RELEASED`), and an un-settled authorization auto-releases after a 7-day SLA. Partial settlement (settled amount < authorized amount) is supported — the difference is refunded.
- **Wallet Mapping Configuration (EMI-4199):** each card has a **static** wallet mapping set at issuance time, resolved instantly on every authorization to find which wallet to check. Not user-editable — only admins can remap (e.g. card replacement), and it's deleted automatically when a card is closed. If the mapped wallet is closed/suspended, every card mapped to it is automatically disabled.
- **Card Program Enablement (EMI-4195):** ties the above together — issuance (virtual/physical) via the BIN sponsor, JIT funding callback on every authorization, and full lifecycle audit (issue → activation → funding → clearing → reversal) retained ≥2 years per SAMA/PCI. TLS 1.2+ and HMAC signing required on every processor↔EMI call.

---

## Enhancements (`EMI-2194`)

`EMI-3643` (Analysis) is an empty stub — no distinct content. `EMI-237` (Technical Enhancement, In Progress) is a generic non-functional initiative (performance, code/DB/server optimization, async processing, logging, security hardening) with no feature-specific business rules to extract.

---

## Errors (`EMI-2211`)

- **Reversal error handling (EMI-2226):** reversals need eligibility validation and clear error messaging before processing — no further detail specified in this story (see the Adjustment/Reversal modules below for the actual rules).
- **Comprehensive Error Handling and Localization (EMI-2043):** the frontend must handle two API error shapes (single object or array of objects), display every `message` field returned (already localized server-side per the request's language parameter — the frontend never re-translates), and place field-level errors under the relevant input vs. global errors as a banner/toast. **HTTP 498 specifically means "invalid token"** and must trigger an automatic logout with "Your session has expired. Please log in again." and a redirect to login — this is a hard, cross-cutting rule referenced by Session management (EMI-2042) below. A missing/invalid `message` field falls back to a generic "An unexpected error occurred" message and is logged for debugging.

---

## Adjustment (`EMI-2209`)

**Transaction adjustment (EMI-2219)** — the most rigorously specified story in the project. Read it in full before building anything here; this is a distillation only.

- **Ledger correction is append-only, never an edit.** Adjusting a transaction appends a reversal record (`reversal_of`) and a corrected record (`adjustment_of`) under the *same* `batch_transaction_reference` — the original row is never touched. Wallet direction (source→destination) can never flip, even in a reversal.
- **Editable fields are an exact, closed list:** `sourceAmount` and `destinationAmount` (entered separately, not as one `amount`), `date`, `external_reference` (required for open-loop transactions, optional otherwise), and exactly three metadata fields — `platform`, `medium`, `hasCommision`. Nothing else.
- **Rejected outright:** adjusting a transaction that's already been reversed; adjusting an *original* transaction that's already been adjusted once. (Whether an adjustment-of-an-adjustment is allowed is still an open decision — do not build either behavior until confirmed.)
- **Adjustment does not trigger the commission service, the limits service, or any external party call** — it is purely a ledger insert + balance update. This means a transaction with commission legs does **not** get those legs recalculated automatically when the main amount is adjusted — see below.
- **Balance effect on an already-settled transaction (pair-adjustment unwind)** — the canonical mechanism, owned by EMI-602: four appended postings, in order — (1) reverse the success posting (settled funds return to `reserve_debit`), (2) reverse the pending posting (release the `reserve_debit` hold), (3) append a new pending posting (reserve the corrected amount), (4) append a new success posting (move the corrected amount out of `reserve_debit`). The identity `current = available + reserve_debit` must hold after **every one** of the four postings, not just at the end. On the source wallet the unwind moves `reserve_debit`; on every destination wallet (receiver, commission, VAT) the mirror unwind moves `reserve_credit`.
- **Multi-leg (commission/VAT) adjustments are manual, one leg at a time** — there is no batch adjustment (the API has a batch endpoint but no frontend, deliberately). When an operator opens a `hasCommision` transaction for adjustment, the UI must list the related commission/VAT postings under the same batch reference with direct "Adjust" links, because nothing recalculates them automatically. Between adjusting the main leg and finishing the fee legs, the cross-wallet invariant (`sender.reserve_debit == SUM(reserve_credit)` across receiver+commission+VAT) is legitimately broken — EMI-5950 treats this as "in-progress" inside a configurable grace window and "variance" beyond it. An operator who forgets a fee leg leaves the invariant permanently broken; the grace window only turns that into an alert, it doesn't prevent it.
- **Authorization:** requires a dedicated privilege, not available to every admin. Every adjustment records actor, timestamp, reason (currently free-text, not yet a dropdown — a reasons lookup is still owed), the original transaction, and both sets of appended postings.
- **A negative balance from an adjustment is written and flagged as an anomaly, not rejected or clamped** — consistent with EMI-602's "detect, don't enforce" position.

---

## Sessions (`EMI-2202`)

**Session management (EMI-2042):** only **one active session per user at a time** — logging in on a new device/tab immediately invalidates every prior session (flagged expired). Login issues an access token + a refresh token whose validity is always exactly **1 minute longer** than the access token's. An expired access token returns `401`; an expired refresh token forces re-login. **Any API call with an invalid token returns HTTP `498`** (not a standard code — a platform-specific "invalid token" signal), which per EMI-2043 triggers an automatic client-side logout with "Session expired. Please log in again." Tokens are invalidated on: expiry, a concurrent login elsewhere, or explicit logout. Admins can view a user's active sessions, force-logout a specific session, and configure token expiration durations.

---

## Reversal (`EMI-2208`)

**Transaction Reversal (EMI-2028):** manual reversal is allowed for any transaction type (closed-loop or open-loop) in any of three states, with different mechanics per state — **Pending**: un-reserve the amount (adjust Available Balance back); **Successful**: move funds back from destination to source and update both balances; **Failed**: un-reserve if anything was reserved. Reversal can target an entire batch or a single transaction within a batch, and **each transaction or batch can only be reversed once**. Every reversal is logged in a dedicated Reversal Reasons table (transaction ID, batch ID, reversal type, free-text reason). ⚠️ This story predates the EMI-602 four-bucket model and EMI-2219's pair-adjustment unwind mechanism — it describes a simpler single-step balance move that needs reconciling against the canonical model before being built.

---

## Under Review (`EMI-2206`)

**Under AML Review (EMI-1822):** if AML WS1 returns a match score below 100 during registration, the applicant is told their account is pending review and the case goes to a human reviewer in BenchMatrix, who either **Approve**s (system calls AML WS2 with a "proceed" response) or **Reject**s (WS2 called with "reject"). The applicant is notified of the outcome by SMS either way; an approved applicant can resume registration.

---

## Verifications (`EMI-2205`)

**Secure OTP Verification (EMI-1693):** OTPs for high-value transactions must be generated with a cryptographically strong random number generator, delivered by SMS, subject to a verification timeout, and the system must handle invalid attempts gracefully (no further detail specified — cross-reference the lockout/retry rules already defined more concretely in the Login module).

---

## Devices (`EMI-2201`)

**Device management (EMI-810, re-opened):** every request into the system must carry a device fingerprint (calculated from hardware/OS/browser attributes) and a geolocation (lat/lng) — **requests missing either are rejected outright** ("Geolocation data is required," "Device information is required"). Admins can see every device that has ever accessed the system (name, status, banned flag, fingerprint) and manually ban/unban one. AML scenarios can auto-ban a device, which updates its status and notifies the admin portal with the triggering AML scenario attached. An invalid/tampered fingerprint is rejected with "Invalid device fingerprint. Access denied." — framed explicitly as anti-replay/anti-tampering, not just bookkeeping.

---

## Jobs (`EMI-2199`)

**System Jobs Management (EMI-719)** defines five scheduled jobs, each admin-configurable (run time, enable/disable, name/description, with automatic rescheduling on a time change):
- **Inactivity (EOD):** deactivates any account with no transactions in the last **14 days**.
- **Dormant (EOD):** flags an account dormant after **12 months** of inactivity and **automatically sweeps all its funds into the system Dormant Wallet.**
- **Intraday (configurable interval):** pulls intraday statements from ANB Bank and updates pending transaction statuses — debit filter for outbound cash-out transfers, credit filter (`narr3`) for inbound VIBAN transfers.
- **Reconciliation (EOD), four checks:** (1) omnibus account balance vs. Control Wallet resolves to zero, (2) yesterday's (T-1) ANB bank statement vs. the system's transaction log, auto-logging anything in the bank statement but missing from the system, (3) each wallet's transaction log matches its running balance, (4) sum of all user + collection wallets equals the Control Wallet balance.
- **Reports (EOD):** generates transaction/bill/service-provider-call-count reports and ships them to an FTP server.

All jobs retry on failure, log every execution in detail, and alert admins on failure.

---

## Cryptography (`EMI-2195`)

**Integration of Biometric Feature (EMI-243, Done):** users can save login credentials for faster re-login (opt-in/out), and can use biometric auth (fingerprint/face) to **bypass OTP** on login and to gate sensitive actions (password change, fund transfer, transaction approval) as an *additional* factor on top of existing security, not a replacement for it. Cross-reference the Login module (EMI-4625) for the current, more precise version of exactly when biometric can and can't substitute for OTP.

---

## UI/UX (`EMI-2193`)

**UI/UX Enhancements (EMI-187, In Progress):** a general design initiative (navigation, color/typography, responsiveness, micro-interactions, accessibility, consistent iconography, loading-state polish) with no feature-specific business rule to extract — content lives in a linked Figma file, not in the ticket.

---

## Authentication (`EMI-2212`)

**User Authentication (EMI-89, Done):** the original, minimal authentication story — username/password login, email verification, strong password policy, encrypted credential storage. Superseded in practice by the much more detailed Login module stories (EMI-4625, EMI-2599, EMI-245, EMI-126) and Session management (EMI-2042) — kept here for lineage only.

---

## BIN Sponsorship – Pre-Funded Credit-card style (`EMI-3106`)

This epic documents the pre-funded card program end-to-end. **EMI-3137 is the reference implementation for how card-detail security should work** — every other card-detail story elsewhere in the backlog should match this pattern, not diverge from it.

- **Card details and info viewing (EMI-3137) — the correct pattern:** PAN/CVV are masked by default. Revealing them requires biometric (or PIN fallback) **every time** — the unmasked state is never persisted; navigating away, refreshing, or timing out re-masks and requires a fresh authenticate-and-fetch cycle. Each reveal makes a **live call to the bank API with a one-time token** — nothing sensitive is cached or stored client-side long-term.
- **Card balance retrieval (EMI-3645):** unlike PAN/CVV, balance is *not* auth-gated — it's fetched automatically once per card view using the existing session (no biometric/PIN prompt), shown with a last-updated timestamp, memory-cached for that session only (never persisted to local storage), and re-fetched on every reload/restart.
- **Card cancellation (EMI-3646):** a two-step flow — confirmation modal explaining consequences, then strong auth (biometric, falling back to PIN/2FA) — before the issuer cancellation API is called. On success: card → `CANCELLED`, all payment tokens revoked immediately, scheduled/recurring payments on that card paused and flagged for owner review. Idempotent via a request key; issuer 5xx errors retry with backoff, 4xx errors (e.g. "already cancelled") surface a clear message without retrying.
- **Card renewal and subscription fees (EMI-3136):** each card is Auto-Renew ON or OFF. If ON, a reminder fires 7 days before renewal (with the fee amount and an opt-out link); on the renewal date, if the wallet covers the fee it's charged and expiry extends a year; if not, the system retries daily for **3 attempts** before **suspending the card** and notifying the user. Manual renewal (when Auto-Renew is OFF) uses the same charge/extend logic on demand. Turning Auto-Renew off cancels pending reminders but never refunds fees already charged.
- **Card top-up (EMI-3135):** moves funds from wallet to card balance up to the wallet's available amount; failure leaves both balances untouched.
- **Card fees (EMI-3134):** a one-time issuance fee (if configured > 0) is debited at card creation and shows as a line item in transaction history; if the debit fails, the whole card request rolls back — no partially-issued card.
- **Card issuance (EMI-3133):** user picks from an admin-configured product catalog; if the product has a fee, the user sees and confirms a cost breakdown (issuance fee + commission + VAT) *before* the issuance API is called.
- **Card products (EMI-3132):** the product catalog (issuance fee, renewal fee, spend limits, etc.) is populated by admin bulk-upload (validated Excel) or manual add/remove — there is **no automated bank-API sync** for the catalog itself; every change is audited.
- **Card configuration and profile (EMI-2739):** the admin-side profile definition behind a product — title, provider (VISA/MADA/MasterCard only), a list of benefit labels, limits (balance/daily/weekly/monthly/yearly, online-usage toggle), which wallet type can request it (Customer/Merchant/Biller), one-time + recurring (monthly/yearly) fees, and an Active/Inactive status that controls whether customers can even see the card as requestable.

---

## FX Trading (`EMI-4136`)

**FX Management Suite (EMI-4180):** three linked admin capabilities. **Corridors** — admin defines which source/destination currency pairs are supported, each with its own max-amount and KYC-level rule; an unsupported corridor is blocked at initiation with a clear error, and the corridor list is exportable for regulators. **Exchange rates** — fetched live from an FX-as-a-service provider, shown to the user with spread/fees and an expiry (a stale quote forces a requote before booking); admin can also configure custom rate/fee overrides. **Currencies** — a master list (ISO code, decimal precision, restrictions) that admin can enable/disable dynamically; disabling one blocks new transfers in it immediately, mid-day if needed. Every quote, booking, and corridor check is logged with a correlation ID and provider reference for reconciliation and compliance export.

---

## SDK (`EMI-4176`)

Two distinct developer-facing capabilities, both still To Do:
- **E-Commerce Checkout Widget (EMI-4178):** an embeddable "Pay with MajdPay" widget for merchant sites/apps — handles auth internally, never exposes wallet credentials to the merchant, and calls back the merchant with a transaction reference on completion or cancellation.
- **Payment Gateway Integration SDK (EMI-4177):** a client SDK (JS/Java/Python) wrapping create-payment/capture/refund/webhook-verification, with idempotency built in for retry safety and a test harness to simulate gateway flows without hitting production.

---

## Open Banking (`EMI-4166`)

- **Account Balance Aggregation (EMI-4168):** a user links an external bank account via Open Banking consent (read-only, balance + metadata); the platform shows bank name, masked account number, balance, and last-refresh time, with manual or opt-in scheduled refresh. Revoking access stops updates immediately but keeps historical balance snapshots for audit. An expired OB token triggers a re-consent flow, not a silent failure.
- **Pay EBPP Bills from External Bank Accounts (EMI-4167):** lets a customer settle a SADAD/EBPP bill directly from a linked external bank account instead of the wallet — launches an OB consent flow scoped to the specific bill (amount + reference + payee), submits a debit instruction on consent, shows a provisional `SUBMITTED` status immediately, and finalizes to `PAID`/`FAILED` only once the bank/OB callback (or poll) confirms. A duplicate callback must not double-pay the bill (idempotency), and a missing callback eventually times out to `FAILED` with the customer notified.

---

## SADAD EBPP (`EMI-3555`)

- **Wallet Top-Up via SADAD (EMI-4162):** the *inverse* of paying a bill from the bank — here the customer generates a SADAD bill *for the purpose of topping up their wallet*, pays it through their own bank's EBPP channel, and the wallet is credited once SADAD/the bank confirms settlement via callback. Unpaid bills expire at TTL with no wallet impact; a reconciliation record maps SADAD bill → bank settlement → wallet credit for finance.
- **SADAD Bill Inquiry, One-Time Payment & Subscriptions (EMI-3556):** three capabilities layered on the SADAD rail — (1) look up any bill by reference or QR and see its details before paying, (2) pay a looked-up bill once from a chosen wallet with a fee/total preview and strong auth for risky amounts, (3) **subscribe** to a bill reference for automatic future payment with a configurable cadence (on-due or fixed monthly date), a payment wallet, and per-payment/monthly caps. A subscription that fails **repeatedly auto-pauses** and notifies the customer with next steps; changing the subscription's payment wallet only affects future runs, not history. All partner callbacks are authoritative for final status, and a stale bill (amount changed between inquiry and payment) forces a re-confirmation rather than silently paying the old amount.

---

## ACH (`EMI-4135`)

Four settlement-automation stories share one design pattern almost verbatim — configurable trigger rules (absolute threshold / percentage / schedule / rolling window), batching, idempotent retry-safe execution, and a downloadable reconciliation artifact mapping every internal line item to its partner settlement reference:

- **Payroll Disbursement to Wallet (EMI-4155):** employer uploads/enters a pay-run (gross, deductions, net per employee); a **mandatory dry-run** shows totals and flags missing/ineligible wallets *before* funds move; execution credits each employee wallet atomically per line, with per-line success/failure (missing wallet, KYC block) rather than an all-or-nothing batch; employees get an in-app notification + payslip.
- **Payroll Disbursement to Bank Account (EMI-4156):** the bank-payout twin of the above — same dry-run/approval/execution shape, but success/failure is driven by the bank/processor's callback rather than an instant wallet credit, and a partial rejection (e.g. bad IBAN) fails just that line while the rest settle.
- **ACH Omnibus Settlements (EMI-4157):** moves funds *between* omnibus accounts (not to end users) when a configured rule fires (threshold/schedule/percentage/time-window); reserves the source, transfers, and only finalizes balances after partner confirmation; a rule auto-pauses after N consecutive failures pending ops intervention.
- **External Third-Party Fees Settlement (EMI-4158):** periodically batches accrued third-party fees (card-network fees, partner charges) by configurable rule and pays them out to the fee-collecting party, with full line-item traceability (transaction ID, amount, fee type) per batch for accounting.
- **Payroll settlement to external accounts (EMI-4159):** the batch-file variant of payroll-to-bank, organized around employer-level settlement rules (funding threshold, scheduled payday, batch-size cutoff) rather than a single manual pay-run trigger.

Cross-cutting rule for all five: **every outbound settlement action must be idempotent and retry-safe — a duplicate message must never double-move funds**, and KYC/AML checks gate any settlement that moves regulated funds.

---

## Validations (`EMI-2200`)

Three stories define validation rules for three different domains, none of which reference each other despite overlapping intent:

- **QR Validation (EMI-3784):** a static QR (tied to one bill or one wallet) is regenerated only when the thing it identifies changes, and stays valid as long as that thing exists. A dynamic QR (type = Customer-Presented or Merchant-Presented, carries an amount + transaction-type + default 24h expiry) is regenerated on any field change and becomes invalid the moment it's used once or its expiry passes.
- **Bill Validation (EMI-3781):** field-level input rules for bill creation/update/checking/payment/deletion — reference number max 255 alphanumeric, amount max 7 digits + 2 decimals, discount amount must be ≤ bill amount (Fixed) or ≤100% (Percentage) and only shown/required if a discount type is selected, issue date ≥ today, expiry date > issue date. A bill can't be paid, updated past those date rules, or deleted once it's already paid.
- **Transactions Validation (EMI-1692):** the general pre-transaction gate — four checks run **in this exact order** before any transaction proceeds: (1) transaction type/service availability, (2) user eligibility (sufficient balance *and* stays above the required minimum after the debit; account must be Active, not Blocked/Dormant), (3) limitation checks (min/max amount, hourly/daily/monthly/yearly count *and* volume limits, min/max post-transaction wallet balance), (4) commission sufficiency (balance must cover amount **and** commission together). Every check has its own user-facing error message; a failure at any step halts immediately and every check's pass/fail/reason is logged for admin reconciliation.

---

## R&D (`EMI-3779`)

`EMI-3780` (Reconciliation Auto-Action) is an empty stub — no distinct content to extract. Its title suggests it belongs in the Reconciliation module rather than R&D.
