# EMI Business Rules Reference — Core Customer-Facing Modules

Companion to `EMI-Refined-User-Stories.md` (the critique/findings doc for this same batch). That file says what's wrong or missing; **this file says what the business actually does** — the rules, workflows, thresholds, and definitions extracted from each story, distilled into reference form. Not a verbatim reproduction of Jira ACs — read the source ticket for exact wording/edge cases before automating against this.

Scope: 14 modules / 54 stories (project = EMI, Epic Link = module).

---

## Registration (`EMI-2173`)

**What it does:** Onboards a new user as one of four account types — Biller, Merchant, Customer, or Freelancer (disabled, "Coming Soon") — through a shared, persona-branching KYC/KYB flow.

**Business rules:**
- Business = Biller or Merchant only. Customer is B2C and must never be conflated with Merchant anywhere (UI, API, docs).
- Flow: (1) mobile number + OTP → (2) short KYC/KYB form (Unified Number, National ID/Iqama, Email, Account Type) → (3) backend verification sequence → (4) Products list (Wallet pre-selected, cannot deselect) → (5) Contract (PDF, must accept checkbox).
- Verification sequence, run in order, persona-gated:
  1. **Yakeen (TAHAQAQ/Elm)** — all personas — validates mobile ownership + identity.
  2. **WATHIQ** — Business only — retrieves CRN, authorized persons, company parties; expired/inactive CRN → reject.
  3. **AML WS1 (Bench Matrix)** — all personas — full match → reject; score < 100 → "Under Review" (paused); clean → continue.
  4. **Lean** — Business only — verifies IBAN ownership + active account; failure → reject.
  5. **NAFATH** — all personas — identity verification; failure → pause with error.
  6. (Business path only, per EMI-122) **AML WS3** — final sanction screen on the whole registration, then ERP status → "Pending Manual KYB."
- Resume logic: returning user with the *same* identity resumes from the last incomplete step; different identifying info → brand-new registration request; finalizing a request invalidates other pending requests for the same identity. Session persists ≥ 72 hours.
- Contract PDF auto-emailed to the registered email on profile creation.
- Admin gets two new tabs per registration request: Products (plan/wallet status) and Contract (version, acceptance timestamp, signed PDF).
- AML rejections must show a generic message to the end user — never the actual screening reason.
- Older Customer-only flow (EMI-121, legacy) used a different verification order (Tahaqaq → OTP → AML → NAFATH → AML risk) and a 2-step form with monthly income, political-exposure checkboxes, and PIN setup — treat EMI-3782's persona-gated sequence as authoritative going forward.

**Integrations:** Notification Center (OTP SMS), Yakeen/Elm, WATHIQ, Bench Matrix (AML), Lean, NAFATH, ERP Core System, Email Service.

---

## Login (`EMI-2174`)

**What it does:** Authenticates Customer, Business, and Admin users, with the mobile customer flow layering OTP + automatic device-trust + biometric on top of SAMA's MFA requirements.

**Business rules (mobile customer login — EMI-4625, the authoritative model):**
- A device becomes **trusted automatically** the first time the user completes username/password **and** OTP — no "trust this device?" prompt.
- Once trusted, the user may log in again **without OTP only via biometric or device passcode/pattern.** Entering username/password on a trusted device still requires OTP — there is no way to skip OTP with a password alone.
- OTP is mandatory on: first login on any device, password-login on an already-trusted device, any risk-engine flag (device fingerprint change, location anomaly, VPN/proxy/TOR, high-frequency attempts), reactivation after logout, after trust is wiped, after password reset, and whenever biometric is disabled/fails.
- **Single-device policy**: logging in on a new device force-logs-out every other device (SAMA CSF 3.1 — no concurrent sessions).
- **Web portal login always requires OTP** — no trusted-device mode, no biometric, ever.
- Logout wipes device trust and biometrics completely; next login requires OTP again.
- Every login, OTP send/verify, trust event, and logout is logged with user ID, device ID, location, IP, action, timestamp — retained 10 years (SAMA CSF).
- Account lockout (Customer/Admin/Business, older stories): 3 consecutive failed attempts → temporary lock; 3 temporary locks → deactivation. (Lockout duration and unlock mechanism are not specified anywhere — needs a business-confirmed value.)
- Admin login uses username-or-+966-phone + password; Business login uses company number + mobile + password. Both then go through the same OTP-and-token issuance pattern as Customer.
- Successful login returns an access token (configurable TTL) + refresh token (TTL = access TTL + 1 minute) + the user's groups/roles/privileges. First-time device login triggers an SMS acknowledgment.

---

## Cash-in (`EMI-2175`)

**What it does:** Funds a wallet via three independent rails: HyperPay (card/wallet gateway), VIBAN (bank transfer to a dedicated virtual IBAN), and SADAD bill.

**Business rules:**
- **HyperPay**: user enters amount (SAR, up to 7 digits + 2 decimals, positive only) → OTP check (front-end gated) if required → HyperPay's own UI/SDK handles card entry (VISA/MADA/MasterCard) → on success, wallet credited automatically and confirmation shown; on failure, actionable error ("Insufficient funds," "Invalid card details").
- **VIBAN**: each user has a unique, permanently-linked Virtual IBAN. A scheduled job polls the bank integration (ANB) for incoming transactions and credits the wallet once the bank confirms — no real-time confirmation possible; delays are communicated up front.
- **SADAD bill top-up (EMI-3564)**: customer requests a top-up amount → system calls Sadad's Create Bill API → bill (reference, amount, due date, payment instructions) shown/downloadable → customer pays via Sadad outside the app → system tracks status via callback or polling → on "Paid," wallet is credited the exact amount and the customer gets in-app + email confirmation. Expired unpaid bills are marked "Expired" and can no longer be used to top up.

---

## Cash-out (`EMI-2176`)

**What it does:** Moves money out of a wallet via five distinct rails: local bank transfer, international bank transfer, OTC/cash-pickup (Western Union), cross-border network transfer (Thunes), wallet-provider transfer (STC Pay), plus Auto-Withdrawal automation and a shared Transfer Summary screen.

**Business rules common to all bank/partner-network transfers:**
- Flow: pick a saved beneficiary (or add one inline) → enter amount + purpose → review a live-updating summary (fees, FX if applicable) → accept T&Cs → OTP → send.
- **Partner-network transfers (Western Union, Thunes, STC Pay) reserve the sender's funds at instruction time and only finalize/refund based on the partner's callback** — the callback is the authoritative source of truth, never an assumption of success. If no callback arrives within an SLA window, the system moves to a reconciliation/poll state and eventually refunds if unresolved. Callbacks must be idempotent (a duplicate "completed" callback must not double-settle) and partial-disbursal callbacks are supported (finalize the paid portion, refund/hold the remainder).
- **Auto-Withdrawal**: user opts in, verifies a destination bank account, and configures a trigger — absolute balance threshold, percentage sweep, or scheduled sweep — plus min/max per-withdrawal, daily cap, and cooldown. Before every execution the system re-validates balance (amount + fees), KYC level, and limits; on repeated bank failures the config auto-pauses and requires the user to re-enable. All executions are idempotent (locked per config+wallet to prevent duplicate payouts on concurrent triggers).
- **Transfer Summary**: shows original amount, commission, VAT, total after deduction; for international transfers additionally shows receiver currency, a real-time-fetched exchange rate, and the converted total. B2B wallet transfers show a different field order (Amount → Commission → VAT → Total → masked name → CRN → purpose → notes).
- Local bank transfer: beneficiary IBAN must start with "SA," auto-validates as typed, auto-detects the bank and shows a "will process during working hours" disclaimer for non-partner banks.
- International bank transfer: no "SA" prefix requirement, no IBAN auto-validation; bank list and currency list are both admin-configured per destination country.
- Business Wallet Cash-out (legacy, ANB-specific): shows a masked IBAN, a confirmation screen with commission and final amount, submits to ANB, and a background job polls ANB for completion since real-time confirmation isn't available (1-2 business day SLA communicated to the user).

---

## E-Bill (`EMI-2178`)

**What it does:** Lets billers define reusable products/items, create bills (single or itemized, manual or bulk-via-Excel), and lets billers/merchants view, filter, approve/reject, edit, and audit bills.

**Business rules:**
- **Predefined Items**: each biller has a private product catalog (name + price required; description/VAT%/discount optional). VAT must be 0–100 or left null. No duplicate names (case-insensitive) per biller. Soft-delete keeps backend data but removes from the invoice picker. Supports up to 1,000 products with responsive typeahead.
- **Bulk bill upload via Excel**: the template file's checksum is validated to detect tampering; every row goes through the same validation as a manual bill; if **any** row fails, the **entire batch rolls back** — no partial imports.
- **Bill Management**: bills not yet at their issue date, or already approved, are hidden from merchants. Editing an approved/unpaid bill re-flags it for re-approval. Discount type has three states — Fixed, Percentage, None (None is default; hides the amount field and excludes discount from the API payload entirely; Fixed/Percentage require a non-zero value). Bills may have no expiry (infinite). Deleting the last item on a detailed bill (which would zero the bill) requires an explicit confirmation dialog.
- **Bill Payment**: only "Approved" and not-yet-due-expired bills can be paid; "Paid" bills can't be paid again; a failed payment doesn't change the bill's due date or status (safe to retry).
- Full audit trail required for bill creation, updates, views, and deletions (actor, timestamp, description).

---

## Bill payment (`EMI-2179`)

Covered above under E-Bill (EMI-170 is the single story here and describes the payment-eligibility rules already listed).

---

## Beneficiary Management (`EMI-2192`)

**What it does:** Lets a customer add and manage five distinct beneficiary types for use in transfers: wallet-to-wallet (via contacts/QR), local bank, international bank, OTC (cash pickup), and (per the archive review) international OTC.

**Business rules common to all types:**
- Every beneficiary type requires **OTP verification** before it becomes usable — the beneficiary record is saved first, then activated only after OTP success.
- Each type shows a clear empty-state prompt when the user has none saved yet, and supports search/filter by name or account identifier.
- **Wallet beneficiary**: contact-list picker (wallet logo = existing user, "Invite" button = not yet on the platform) or QR scan (differentiates merchant vs. customer QR by showing the right details); an "unsaved number" path lets the user transfer without saving a beneficiary at all.
- **Local bank beneficiary**: IBAN must start with "SA," is validated character-by-character as typed, and auto-detects + displays the bank logo; non-partner banks get a "processed during working hours" disclaimer.
- **International bank beneficiary**: country selected first, which drives an admin-configured bank list and an admin-configured allowed-currency list; no "SA" prefix rule; SWIFT code is required in practice (per the AC/test cases) even though it's missing from the story's own field list.
- **OTC beneficiary**: minimal fields (country, full name, ID, optional address, relation, preferred currency) plus two mandatory yes/no checkboxes (does the sender know the beneficiary's nationality / age) and an explicit "double-check these details" warning, since a wrong OTC beneficiary detail can block a cash pickup entirely.
- Deletion is always available and always confirmed before it takes effect.
- (Admin-side, separate system) **Bill Beneficiary Management**: admins add CRN-based beneficiaries for billers (alias + CRN, looked up against the CRN registry, optional OTP) — this is a distinct beneficiary system from the five customer-facing types above, scoped to billing relationships.

---

## Wallet-to-Wallet Transfer (`EMI-2196`)

**What it does:** Sends funds directly between two MajdPay wallets — one flow for Customer senders, a near-identical one for Business senders (CRN-based recipient instead of phone/beneficiary-based).

**Business rules:**
- Recipient selection: Customer picks a saved beneficiary or scans a QR; Business picks/searches by CRN or scans a QR.
- Transfer purpose is mandatory, chosen from an admin-configurable dropdown (Friends and Family, Travel, Investment, Personal, etc.); free-text notes are optional, capped at 200 characters.
- Before OTP, the system checks wallet limitations, wallet status, account status, and transaction limits — all four, every time.
- Summary screen (mandatory to view before confirming) shows: amount, destination phone/CRN, destination name masked (per KYC/KYB, not the saved beneficiary alias), source wallet + its balance, purpose, notes.
- On success: commission is deducted automatically, both parties get an SMS with transfer details, and both see updated balances.

---

## Merchant payment (`EMI-2197`)

**What it does:** Lets a customer pay a merchant by scanning one of two QR types.

**Business rules:**
- **Amount QR** (fixed amount encoded): scanning it pre-fills and **disables** the amount field — the customer cannot change what they pay.
- **Wallet QR** (identifies the wallet only): scanning it activates the camera and leaves the amount field editable — the customer types how much to pay.
- Both paths converge on the same screen: merchant/wallet info (name masked) → amount → balance validation → OTP → payment → commission applied automatically → both parties notified with updated balances.

---

## Wallets (`EMI-2198`) — largest module

**What it does:** Everything about the wallet object itself: creation, the balance model, multi-wallet and sub-wallet architecture, rules/limits/controls per wallet, wallet sharing, top-up/cash-out at the wallet level, and the system-level wallet hierarchy that backs reconciliation.

**Business rules:**
- **System Wallet Hierarchy (EMI-2008)** — the foundational model everything else in this module assumes: Business Wallets (merchants/billers) and Collection Wallets (VAT, Dormant, Commission Credit, Commission Debit — only VAT and Commission Credit can cash out directly) both sit under a **Control Wallet**, which must always be ≥ the sum of its children and is stored **inverted** (positive system balance = negative Control Wallet value) to reconcile against the physical omnibus bank account. All Control Wallets roll up into one **Master Wallet** for global reconciliation. Cash-in = external transfer to omnibus, then local transfer Control → target wallet. Cash-out = local transfer target → Control, then external transfer from omnibus.
- **Wallet Running Balance — canonical model (EMI-602, amended, supersedes its own original three-bucket version)**: four buckets — `available` (spendable now), `reserve_debit` (the holder's own money held for an outgoing payment in progress), `reserve_credit` (incoming money not yet settled — **not the holder's yet**, excluded from `current`), `current` (`= available + reserve_debit`, the real balance). Sending side moves `available → reserve_debit`; receiving side (including the commission and VAT wallets on the same transaction) gets `reserve_credit`. On settlement: sender's `reserve_debit` leaves for good; receiver's `reserve_credit` becomes real `available`. **Cross-wallet invariant**: `sender.reserve_debit == SUM(reserve_credit)` across receiver + commission + VAT wallets for the duration of the reserve window — this catches a missing leg that a per-wallet check can't see. **The ledger is append-only** — no row is ever updated; every correction (even on an already-settled transaction) is four new appended postings (reverse success → reverse pending → new pending → new success), never an edit. **No negative balances** is the target state but not yet enforced everywhere — commission/VAT wallets can go temporarily negative during the reserve window today, and this is tracked as a detected variance, not silently clamped or rejected.
- **Wallet creation (EMI-2213)**: every wallet is linked to one user profile, gets a unique vIBAN + wallet code, and must be associated with a Control Wallet before it can transact. Displays Available/Reserved/Current (pre-dates the EMI-602 four-bucket amendment — needs reconciling).
- **Wallet code (EMI-3637)**: format `<TYPE>-<PAYLOAD>-<CHK>` (TYPE = CUS/MER/BIL/COL/CON, 10-char Crockford Base32 payload, 2-char ISO 7064 Mod 37,36 checksum) — designed to be the primary identifier, independent of vIBAN, with vIBAN retained only for external-account purposes and a mapping table for history.
- **Multi-Wallet Management (EMI-4576)**: a user can hold N independent primary wallets (not sub-wallets), each with its own balance, ledger, limits, KYC-linking, and cards. Every confirmation screen must show which wallet is being used and offer "Change Wallet" before the user commits. Closing a wallet requires zero balance, no holds, no disputes, no active cards.
- **Sub-Wallets (EMI-4153/EMI-4154)**: nested under a parent wallet, inherit the parent's KYC/profile, each gets its own vIBAN (derived from the parent's account reference, with a routing/decoding table mapping vIBAN → sub-wallet), can be shared with other users (with its own permission tiers: viewer/spender/manager), can have their own linked cards (which inherit the sub-wallet's rules and auto-block if the sub-wallet is paused), and are funded via internal transfer, P2P, external top-up, or scheduled auto-fund — all funding respects the sub-wallet's own limits and can require approval if shared.
- **Wallet Rules & Controls (EMI-4577)**: per-wallet configuration across seven dimensions — allowed transaction types, allowed channels (POS/QR/App/Web/NFC/CNP/ATM/IVR), per-type amount and count limits (hourly/daily/monthly/yearly), min/max balance thresholds (transactions that would breach either are blocked, with the check happening at authorization time, not after settlement), merchant/MCC blacklist or whitelist, geofencing (circular or polygon), and KSA-only country restriction (current phase). Raising a threshold or enabling a risky control requires strong auth (PIN/biometric/OTP), and every change and every blocked attempt is logged and can trigger an owner notification.
- **Wallet Sharing (EMI-3553)**: an owner grants time-boxed, rule-limited spending access to their wallet balance to another user, without transferring ownership. Strictly KSA-only — every transaction re-validates the beneficiary's live location (GPS/device/IP, with VPN/proxy detection) and blocks if outside KSA or if location is unavailable. All spending posts to the **owner's** ledger tagged with the beneficiary's profile code. Owner can pause/resume/revoke at any time; beneficiary must accept via OTP before the share activates.
- **Controlled Balance Spending (EMI-3554)**: a sender attaches spend constraints (merchant category, geography, time window, expiry) to a specific P2P transfer; the recipient's wallet shows this as a separately-labeled "controlled balance" segment on top of their normal balance, and every spend attempt from that segment is checked against the attached constraints before it's allowed. Unused balance reverts to the sender automatically at expiry.
- **Wallets Top-up / Cash-out (EMI-2049/EMI-2050)**: restates the HyperPay/VIBAN top-up and IBAN cash-out mechanics already described under Cash-in/Cash-out, plus a **System Wallet Cashout** variant (admin-driven, to a pre-configured company IBAN, admin must confirm amount + destination before it proceeds).

---

## Money request (`EMI-2203`)

**What it does:** Lets a wallet holder request money from another wallet holder, either by sending a request the other party accepts/declines, or by generating a one-time QR the payer scans.

**Business rules:**
- Creating a request **does not** touch the payer's balance or run any validation — it's just a record. **All real P2P validation (balance, limits, KYC, fraud/sanctions) happens only at the moment the payer actually confirms payment**, whether via Accept or via QR scan.
- Commission and VAT on the resulting payment are charged to the **payer** (the requested party), never the requester.
- Request states: `REQUESTED → PROCESSING → COMPLETED / FAILED / DECLINED / CANCELLED / EXPIRED`. The requester can cancel while `REQUESTED`; a configurable TTL (default 7 days) auto-expires an unactioned request; once payment begins the request locks into `PROCESSING` so a concurrent cancel or a double-tap Pay can't create two payments.
- QR requests encode `request_id` + amount + requester name + expiry, are one-time-use by default, and are invalidated the moment they're successfully paid; a signature check rejects a tampered QR outright.
- If the payer has multiple wallets, they choose which one to debit at confirmation time.

---

## QRs (`EMI-2204`)

**What it does:** Generates and scans EMVCo-compliant QR codes for payments (the underlying mechanism behind the Amount/Wallet QR flows in Merchant payment).

**Business rules:**
- QR generation/scanning/encryption must follow EMVCo QR specifications for financial transactions; sensitive embedded data is encrypted, decryptable only with the appropriate key.
- **Dynamic QR (EMI-3545)**: a one-time, amount-specific code either party (payer or payee) can generate, tied to a unique reference — functionally the same "Amount QR" concept described independently in the Merchant payment module (EMI-590); the two descriptions haven't been consolidated.

---

## Card management (`EMI-2604`)

**What it does:** Card issuance, an overview page with four/five action buttons (Lock, Add to Apple Wallet, Settings, Details, Benefits), and the four sub-screens those buttons open.

**Business rules:**
- **Issuance**: user picks a card type (MADA/VISA), sees its benefits/limits, applies, verifies via OTP, and the card is issued immediately after OTP success — **no admin approval step**. ⚠️ As shipped, every card gets the same default PIN and the design allows the CVV to be fetched unmasked later — see the findings doc for why this needs fixing before relying on it as spec.
- **Details**: full PAN/expiry/CVV are masked by default; tapping to reveal requires Face ID (iOS) or Wallet PIN (Android/web) every time — data is never cached, so re-authentication is required on every view, not just the first.
- **Settings**: daily/monthly spend limits, PIN change (current → new → confirm → OTP), physical card request (mailing/pickup + OTP), and card cancellation (OTP-gated) — every mutating action in this screen is OTP-gated.
- **Benefits**: entirely admin-managed — perks (icon, title, ≤100-char description, "learn more" link) are fetched live and reflect back-office changes on next load with no app deploy required; shows a clear empty state and a retry-on-failure state.
- Locking a card (from the overview page) is itself OTP-gated and flips status to Locked immediately.
