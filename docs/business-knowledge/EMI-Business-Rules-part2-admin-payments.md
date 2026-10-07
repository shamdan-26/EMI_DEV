# EMI Business Rules Reference — Admin/Back-Office + Payments Infrastructure

Companion to `EMI-Refined-User-Stories-part2-admin-payments.md` (the critique/findings doc for this same batch). That file says what's wrong or missing; **this file says what the business actually does** — the rules, workflows, thresholds, and definitions extracted from each story, distilled into reference form. Not a verbatim reproduction of Jira ACs.

Scope: 12 modules / 52 stories (project = EMI, Epic Link = module).

---

## Payments (`EMI-2184`)

**What it does:** The transactional core — how a transaction moves through the system, how balances are affected, how commissions/VAT apply, and several payment products built on top (split payments, escrow-style holds, manual ledger correction).

**The canonical lifecycle (EMI-1646, EMI-6031 — treat these two as authoritative):**
- Two layers, different authority: **Draft/Outbox** (mutable, non-authoritative, affects **no** balance bucket) and the **Ledger** (authoritative, balance-bearing, **append-only** — no row is ever updated in place).
- Draft states: `PENDING_CHECKS → PENDING_OTP (if required) → POSTED`. Any validation failure at `PENDING_CHECKS` → `FAILED`, no ledger entries created. An OTP that's never validated → `FAILED`, no ledger entries created.
- **Closed-loop** (pure wallet-to-wallet): OTP success (or no OTP required) moves the draft straight to `POSTED`.
- **Open-loop** (bank/PG/switch involved): after checks/OTP, the system calls the external provider; only a successful/accepted external response moves the draft to `POSTED`. A definitive external failure → `FAILED`, no ledger entries.
- Once `POSTED`, ledger entries are created with status `PENDING`: source `available` ↓ and `reserve_debit` ↑; destination (and commission/VAT wallets, if applicable) get `reserve_credit` ↑. Final outcome is `PENDING → SUCCESS` (settle) or `PENDING → FAILED` (release/reverse) — always as a **new appended entry**, never a mutation of the pending row.
- Every transaction gets a `txn_reference` and a `batch_transaction_reference` (the latter groups all legs of one transaction — principal, commission, VAT — together).
- The full lifecycle view (`INITIATED → PENDING_CHECKS → PENDING_OTP → POSTED → LEDGER_PENDING → SUCCESS/FAILED`) is queryable per transaction, combining both layers into one timeline, with admins seeing full internal metadata and users seeing a redacted subset.

**Payments TTL & Invalidation (EMI-6031)** — the clock that enforces the above doesn't leave things stuck:
- Draft TTL (default = the OTP validity window) governs everything before `POSTED`. On expiry the draft becomes `EXPIRED` (terminal, no replay possible) and releases 100% of the limit headroom it was holding — no money was ever moved, so there's nothing to unwind.
- Ledger TTL governs postings stuck in `LEDGER_PENDING`. On expiry the configured action fires: **auto-reverse** (append a compensating posting that unwinds the reserve exactly — principal, commission, and VAT legs together, never partially), **auto-fail**, or **escalate** (no posting created, parked in an Ops queue). **If the external rail's outcome is unknown, the action is always escalate — never auto-reverse** — reversing something the counterparty later confirms as settled creates a real financial loss.
- TTL/SLA/alert-threshold values are configured **per transaction type** by Finance, apply immediately without redeploy, and business-day TTLs resolve against a Saudi business calendar (Friday/Saturday weekend) so a Thursday transaction's clock doesn't quietly expire mid-weekend.
- Draft-promotion and TTL-expiry are mutually exclusive under concurrency — a transaction is never both promoted and expired.
- Proposed seed values (pending Finance confirmation): Cash-in via PG 30 min/auto-reverse; Cash-in via bank transfer 2 business days/escalate; Cashout 1 business day/auto-reverse; Bill payment 2 hours/auto-reverse; W2W and QR payment 5 minutes/auto-reverse; Reversals/Adjustments/Refunds escalate on their own SLAs.

**Transaction type taxonomy (EMI-1647):** every transaction carries a numeric type code describing source-wallet-type → destination-wallet-type, e.g. `101002` Merchant Bank Transfer (Merchant→Control, open-loop), `102003` Biller Bank Cashin (Control→Biller, open-loop), `103004` B2B Transfer (Business→Business, closed-loop), `106002`/`106003` Commission Credit, `107002`/`107003` Commission Debit, `109001`/`109002` Adjustment Credit/Debit (Control↔Any), `100001` Reverse Transaction (Any↔Any). Admins can enable/disable a type platform-wide or block it for a specific user (override, defaults stay intact for everyone else).

**Transaction Limitations (EMI-87)** — the gate every value-moving transaction passes through (this is the fullest, most rigorous story in the whole batch, treat it as the canonical limitations spec):
- The **exposure set** = all live drafts (not cancelled/expired) + all ledger transactions in `Pending` or `Success` for the wallet. Failed/Rejected/Reversed transactions and cancelled/expired drafts are excluded and release their headroom in full. A promoted draft is counted **exactly once** — never double-counted across draft and ledger.
- Three gates, evaluated in order, first breach wins:
  1. **Balance min/max** — evaluated against **projected `current`** (i.e. after simulating the requested transaction plus all live drafts) against the wallet's tier floor/ceiling.
  2. **Amount per period** — cumulative amount across the exposure set for every matching rule, plus the requested amount; equal to the cap passes, over it rejects.
  3. **Count per period** — same logic for transaction count; a rule with `count = 0` blocks that transaction type outright for that criteria set.
- Rules are keyed by Risk Level × Wallet Tier × Transaction Type × Platform × Period (Hourly/Daily/Weekly/Monthly/Yearly/Lifetime), calendar-aligned in Asia/Riyadh. A transaction is attributed to the period bucket of its **initiation timestamp**, not its settlement time.
- The check + draft write are atomic per wallet (a per-wallet lock), so two concurrent initiations that would jointly breach a limit can't both pass.
- Rejection messages tell the wallet holder which limit and period were hit, without exposing the internal rule ID.

**QATTAH — split payments (EMI-4148):** an organizer creates a shared-payment request against N participants, split evenly, by percentage, or by fixed amount (with any shortfall shown as a separate `UNALLOCATED` line the organizer must settle). Creating a QATTAH reserves nothing — each participant's payment goes through normal P2P validation only when *they* pay (commission/VAT charged to the payer). Already-`PAID` portions are frozen; only the `UNPAID` remainder is recalculated if the organizer changes the split later. The organizer can force-complete with partial collection, or cancel with two distinct options — "Cancel & Refund" (reverses all paid shares, requires the organizer to have sufficient balance to cover the refund) vs. plain "Cancel" (no refund, clearly disclaimed).

**Pay on Delivery (EMI-3559):** a buyer reserves (holds) funds against a seller pending physical delivery. The buyer can later **Release** (transfer to seller) or **Refund** (return to self); the seller can mark **Delivered**/**Cancelled** for record-keeping only — seller feedback never moves money. A TTL auto-returns funds to the buyer if neither action is taken. Both release and delivery-marking require an explicit, logged disclaimer acknowledgment (checkbox) stating MajdPay holds no liability once the action is confirmed — this is the platform's explicit protection against buyer/seller disputes.

**Manual Ledger Entry (EMI-3130):** lets a finance-ops admin append an exceptional transaction row directly (for correction/reconciliation), using the **same insert path** as automated transactions so manual entries are indistinguishable in structure from system-generated ones. `created_by`/`created_at` are always system-assigned, never editable, and the entry is immutable once appended (consistent with the append-only ledger rule above).

**Payment Metadata (EMI-3104):** a separate MongoDB store (one document per `batch_transaction_reference`) holds human-readable context the relational ledger doesn't carry — sender/receiver display names, platform (Android/Merchant Portal/etc.), bill number, top-up medium, shared-wallet borrower ID, free-text notes — plus a `reversed_txns` field (`null` / `"ALL"` / a list of specific `txn_code`s) that tracks reversal status against the immutable transaction log.

**Role-based transaction viewing (EMI-2998):** Admins see the full Transaction Log (all fields, including balance snapshots). Business users see a "clean" view derived from running-balance data — **available/reserve/current balance fields are explicitly excluded** from what a business role can see about their own transactions; amounts are colored green (credit) / red (debit) based on direction.

---

## Users (`EMI-2180`)

**What it does:** The access-control model (Groups/Roles/Privileges) and the user lifecycle (creation, verification, status) that sits on top of it.

**RBAC model (EMI-2315) — the canonical access-control design:**
- Three layers: **Privileges** (atomic, pre-defined, hardcoded per API/functionality — never tenant-creatable), **Roles** (a named, assignable set of Privileges), **Groups** (containers of Roles, typically mapped to a department). **Group ↔ Role is many-to-many** — a Role is never owned by a single Group.
- A **`SYSTEM` flag** exists on both Groups and Roles: `true` = platform default, hidden from and immutable to businesses/customers, settable only by platform admins (e.g. the seeded `BUSINESSES` group containing the `BUSINESS` role). `false` = tenant-visible and tenant-manageable.
- A user can hold multiple Roles across multiple Groups; **effective privileges = the union** of all assigned Roles' privileges. The same Role attached under two different Groups doesn't double the privileges.
- Everything is per-tenant isolated — Tenant A never sees or can select Tenant B's non-SYSTEM Groups/Roles.
- Missing privilege on a protected API → deny with 403.

**User creation & lifecycle (EMI-167):** every user/staff account — regardless of role (system admin, ops, merchant staff, biller staff, corporate user) — goes through the **same** mandatory verification chain: Yakeen (mobile ownership) → WS1 (sanctions screening) → Nafath (identity) → AML/risk assessment. Any failure blocks creation outright; no role is exempt. Status lifecycle: `PENDING_VERIFICATION → ACTIVE`, or `→ UNDER_REVIEW` (AML-flagged, cannot log in) `→ ACTIVE`/`REJECTED` (permanent, never reactivatable), or later `ACTIVE ↔ DEACTIVATED` (reversible suspension) `→ DELETED` (permanent, identity retained per regulatory retention). Access assignment at creation uses the EMI-2315 model directly: a two-layer checkbox selector (pick Groups, then pick specific Roles within each selected Group) — at least one Group with at least one Role is required to create a user.

**Legacy admin user management (EMI-197/176, both Done):** simpler model — first/last name, mobile, a single Role at creation; editable fields limited to name/status(/group); actions include change status, edit, delete, reset password (which triggers an SMS with the new username/password). Predates the EMI-2315/EMI-167 model above.

---

## Configuration (`EMI-2181`)

**What it does:** System-wide lookups and configurable thresholds that other modules read from.

- **OTP configuration (EMI-2041):** general settings (length, validity window, resend cooldown) can be overridden by transaction-specific rules keyed on amount threshold + transaction type + enabled/disabled status; a matching transaction-specific rule always wins over the general default.
- **Lookups (EMI-597):** the platform's controlled vocabularies — Wallet types (System: Master/Control/Collection→Commission/VAT/Dormant/Reserved; User: Parent/Child/Sub), Wallet tiers (Basic/Silver/Gold/Premium), Transaction categories, Platform types (Web/App), Periods (Daily/Weekly/Monthly/Yearly), Risk levels (High/Medium/Low), Account types (Business→Merchant/Biller, Customer) — each with an ID, code, bilingual name (EN/AR), and description. This is the shared reference data every limits/commission/RBAC rule above keys off of.
- **Transaction type configuration (EMI-196):** per transaction type, admin sets max/min amount and an enable/disable status with its own audit-visible code.

---

## CMS (`EMI-2182`)

**What it does:** Centralized, admin-only content management for everything the app shows that isn't transactional data.

- **FAQs:** categorized, searchable, admin CRUD; shown on the public landing page and in the logged-in app settings menu.
- **Message templates:** Email/SMS/Push templates with placeholders for dynamic content, previewable per channel (email layout, SMS character count, push format) before publishing — admin-only surface.
- **System error messages:** each has a unique tracking code and full localization; displayed dynamically wherever an error occurs, in the user's configured language.
- Only a Super-Admin-tier role can access or modify CMS content at all.

---

## Service providers (`EMI-2183`)

**What it does:** Governs how the platform caches and monitors calls to external identity/verification providers (Wathiq, Nafath, Yakeen, etc.) and other third-party service calls generally.

- **External Data TTL & Invalidation (EMI-3644):** every cached external record carries a freshness status — `fresh` (within TTL, last refresh OK), `stale` (TTL exceeded or invalidated but not yet refreshed), or `error` (refresh failed and retries exhausted). Consumers can force a synchronous revalidation (`?revalidate=true`, rate-limited); if the provider is unreachable, they get a `503` with the stale payload rather than nothing. Providers can push invalidation via authenticated webhook; admins can force invalidation manually (logged with actor + reason). Every cache write/refresh/invalidation is an append-only audit event.
- **Service provider call logging (EMI-676):** every call to an external system is logged with full request/response payload, timestamp, and outcome (success/failure/unknown); each provider has a configurable TTL that triggers an automated action when breached, and an admin dashboard surfaces per-provider volume/success/failure stats with alerting when a provider's failure rate crosses a threshold.

---

## Commissions (`EMI-2186`)

**What it does:** How platform fees are configured and applied per transaction.

- A commission rule is defined by transaction type + platform + min/max amount range + commission type (**Fixed amount** or **Percentage**) + value.
- **Default schema** applies platform-wide unless a **custom schema** exists for a specific business account (custom schemas can't overlap on the same criteria for the same account).
- Commission is **added to the sent amount on the sender side** and **deducted from the received amount on the receiver side** (today's one-way model; a future "2-way" option letting the sender pick which side absorbs the commission is explicitly noted as planned but not yet built).
- Commission can apply on the source account, the destination account, or both, depending on configuration; percentages must fall within 0–100%, and min ≤ max is validated at rule-creation time.
- All commission changes (create/edit/enable/disable) are logged for audit.

---

## Limitations (`EMI-2185`)

**What it does:** Non-transaction-engine limits — card-level JIT authorization controls and wallet balance floors/ceilings (the wallet-balance side of this overlaps with the amount/count gates already described under Payments → EMI-87).

**Card JIT authorization (EMI-4181):** real-time (≤300ms p95) approve/decline decisions for virtual-card transactions, evaluated against: per-transaction/daily/monthly/velocity caps, MCC allow/deny (default-deny list includes 7995 Gambling, 6211 Crypto, 7273 Dating, 7994 Video Games), country allow-list (SA-only in Phase 1), and a **Merchant CRN policy** that can run in Deny-mode (block specific merchants) or Allow-Only-mode (only listed merchants permitted, decline everyone else with `MERCHANT_NOT_ALLOWED`). An approval creates a temporary **hold**; a later clearing event finalizes it (possibly for a different amount than authorized — the difference is released back); a reversal/expiry releases the hold entirely. Mandatory 3DS for e-commerce; a hard 500ms timeout defaults to decline (`TIMEOUT_POLICY`); STIP (network-stand-in) transactions are capped separately and declined above that cap even if the product limit would otherwise allow it.

**Wallet balance limitation (EMI-659):** a simpler, older rule — min/max balance keyed by Risk Level × Wallet Type × optional specific Wallet Code (e.g. Low-risk Merchant wallets cap at 100, Medium-risk Merchant wallets cap at 20,000).

**Limitation taxonomy (EMI-1653, EMI-195):** the admin-facing shape of the limits described in EMI-87 — Risk Level × Transaction Category × Transaction Type × Platform × Period, each carrying its own min/max amount and min/max count, fully CRUD-able by admins with an audit trail of every change.

---

## Reports (`EMI-2189`)

**What it does:** Search/filter/export screens over bills and transactions for different roles.

- **Admin Reports (EMI-1132):** bill reports, transaction reports, and reconciliation reports (system data vs. external/bank statement, discrepancies highlighted); all exportable (CSV/PDF).
- **Bill reports (biller-side EMI-178, merchant-side EMI-169):** searchable by bill/reference number, status, date range; merchant-side explicitly restricts visibility to bills that are **approved and past their issue date** — a bill pending approval or not yet issued never appears in the merchant's report, matching the same visibility rule described under E-Bill in part 1.
- **Transaction Report (EMI-168):** searchable by type, internal reference, source/destination wallet, date range; shows amount before/after the transaction alongside the delta, for reconciliation-style review.

---

## Profiles (`EMI-2190`)

**What it does:** The identity/profile object underneath every account type, plus KYB approval workflow for business accounts and email verification.

**Profile Code (EMI-3978)** — the identity-scheme analog to the Wallet Code from part 1 (EMI-3637): format `<TYPE>-<PAYLOAD>-<CHK>` (10-char Crockford Base32 payload + 2-char ISO 7064 Mod 37,36 checksum), immutable once issued, designed specifically so profiles can be referenced in logs/support tickets/APIs **without exposing PII** (no raw DB IDs, no email/national ID in URLs). Legacy identifiers (username, email, old DB ID) remain resolvable through a history-mapping table during migration, but every response should return the profile_code as canonical. Masked in non-privileged contexts; lookups rate-limited to prevent enumeration; never used for authentication itself.

**Profile management (EMI-648) — the canonical status model:** `Pending` (awaiting manual KYB) → `Approved` (ready for commission setup + activation) → `Active`. Also: `Rejected` (terminal, can't activate), `Inactive` (temporarily no system access), `Dormant` (auto after 12 consecutive months of inactivity), `Blocked`/`Unblocked` (policy/security driven). Users can never change their own profile status — only admins can. Wallet-linking rules by profile type: System Wallets → Partner Bank Profile; User Wallets → Business or Customer Profile; System Users → System Profile; Integration Users → External Party Profile. If a profile is ever missing its associated wallet/admin-user record (a known failure mode), the backend attempts automatic recreation, with a manual admin trigger as fallback.

**Business account approval (EMI-2121):** Biller/Merchant accounts require both automatic KYB at registration and a **manual KYB review** before activation — admin reviews the registration data plus Wathq (CRN/company) and Nafath (authorized-person identity) results plus attached IBAN/VAT certificates, then approves or rejects. Only approved+activated business accounts can use wallet services. Admins can additionally Block/Unblock, Unlock (after failed-attempt lockout), or permanently Deactivate any account (Biller, Merchant, or Customer).

**Email verification (EMI-2117):** the verification link's signature is a hash over user ID + timestamp + OTP + client module (Biller/Merchant), expires in 24 hours. Only a *verified* email is ever used to send credentials, API keys, or notifications — an unverified email is flagged in the profile UI with a resend option. Changing email re-triggers the whole verification process for the new address; the old address stops receiving anything once the new one is (re-)verified.

**Test accounts (EMI-4225):** 5 default accounts exist with a **static OTP** value so app-store reviewers can get through OTP-gated flows without a live SMS. (Flagged separately as a live security exposure in the findings doc — the business rule itself, that reviewer accounts need an OTP bypass, is legitimate; the static code being documented in the open is the problem.)

---

## Passwords (`EMI-2191`)

**What it does:** Password lifecycle for all user types — first-login forced reset, forgot-password, and voluntary change — all OTP-gated.

- **First login:** a randomly generated password is issued at account creation; the user is forced to a reset screen before they can access anything else in the system, confirmed via OTP.
- **Forgot password:** username/email → OTP to registered mobile/email → OTP verified → new password entered → validated against the configured policy → confirmation notification sent.
- **Change password (any time):** old password entered and validated → OTP sent → OTP verified → new password saved, old one invalidated, confirmation sent.
- **Every one of the three flows requires OTP** — there's no password operation that skips it.
- Policy is admin-configurable: min/max length, complexity (uppercase/lowercase/digit/special character), optional expiration, and a **reuse ban on the last 3 passwords**. Legacy per-portal stories (EMI-182 and EMI-174, byte-identical duplicates) specify a fixed baseline: ≥8 characters, must include special char + number + uppercase, no spaces.
- A password change on the Business/Admin portal (EMI-200) forces an immediate logout — the user must log back in with the new password.

---

## Notifications (`EMI-2187`)

**What it does:** Multi-channel notification templating, delivery, and a per-customer notification history log.

- **Templates (EMI-4169):** admin-managed per event type (OTP/login/transaction) × channel (SMS/email/push/in-app) × locale, with placeholder substitution, versioning (old versions archived, not deleted), preview, and test-send before activation. A missing/disabled active template falls back to a default — never a silent no-send.
- **SMS coverage (EMI-645, Done):** OTPs, awareness/promotional campaigns, transaction confirmations, new-device login alerts, bill creation/due reminders, credential-change alerts, and account-status-change notices all go through the same SMS channel, each with its own required content shape (e.g. transaction SMS must include amount/date/status; new-device SMS must include device info).
- **Notification Hub (EMI-93):** every notification sent is logged and retrievable per customer (only *sent* ones are surfaced to the customer view, but everything is logged internally for audit), filterable by type and date range, grouped/bundled by date in the UI.

---

## Dashboard / Home (`EMI-2188`)

**What it does:** The landing screen for each persona (Customer, Biller/Merchant, Admin), each surfacing a different mix of balance, activity, and quick actions.

- **Common pattern across Customer Home / Biller Home / generic Home:** brand name, wallet balance (hidden for normal/non-admin users — only admins ever see the raw figure), last-login date/time, and a "My Last 10 Transactions" list with source/destination wallet, internal + external reference, type code, amount, and before/after balance snapshot per row.
- **Customer Home (EMI-2692)** adds quick-action buttons (Top-up, Payment, W2W transfer, Local transfer, International transfer) and a QR shortcut icon next to the balance.
- **Biller Dashboard (EMI-1797) / Biller Home (EMI-175)** are bill-centric: total bills, paid/unpaid/pending-approval/expired counts, bills paid this month, per-beneficiary bill totals, and a paid-vs-unpaid chart (web only) — plus reserved balance shown alongside available balance (both admin-only visibility).
- **Admin Dashboard (EMI-191)** is analytics-oriented: interactive/zoomable charts, configurable auto-refresh, admin-settable threshold alerts that visually flag when a metric crosses a line, export/share, and platform-wide totals (business account count, all-time and today's transaction counts, all-time and today's bill-payment totals) — gated by the RBAC privileges described under Users, so who sees what is itself a permission, not a given.
