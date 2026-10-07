# EMI Business Rules Reference — Archived Epic (`EMI-2337`)

Companion to `EMI-Refined-User-Stories-part4-archived.md` (the audit of this epic for misfiled/lost scope). That file says what's wrong or where something should live; **this file extracts what the archived stories actually specify**, for the ones with real, distinct business content worth preserving. Stories that are simple duplicates of already-documented live work get a one-line pointer instead of a full extraction — no point re-describing the same rule twice.

Scope: all 31 stories under `EMI-2337`. 20 got a full extraction below; 11 are one-line "superseded/duplicate" notes.

---

## Reversal & Adjustment Engine (`EMI-2220`–`EMI-2230`, `EMI-1695`) — 11 stories, full extraction

The most substantial cluster in this epic: a complete, unshipped design for reversing and manually adjusting transactions. The live epics that should own this (Reversal `EMI-2208`, Adjustment `EMI-2209`) are effectively empty stubs — this cluster is the real spec.

**⚠️ Predates the canonical balance model.** This cluster's wallet-flow language (Available/Reserved, "unreserve amounts") is pre-`EMI-602`. Before reusing any of it, reconcile against `EMI-602`'s four-bucket model (`available`/`reserve_debit`/`reserve_credit`/`current`, append-only ledger, four-posting pair-adjustment unwind) documented in `EMI-Business-Rules-part1-core-modules.md` — the unwind mechanics described here (state-based reversal, no explicit append-only posting sequence) don't match it.

**Core reversal logic (`EMI-2220`):**
- Eligibility: the transaction must exist and be in state Successful, Pending, or Failed.
- Reversal effect depends on state: **Pending** → unreserve the amount, restore it to Available; **Successful** → move funds back from destination to source wallet, updating both balances; **Failed** → unreserve if anything was reserved, otherwise no-op.

**Batch and linked-wallet handling:**
- **Batch-level (`EMI-2221`)**: a user can reverse an entire batch or individual transactions within it; the system tracks per-transaction and per-batch reversal state to prevent double-reversal, and validates the batch exists with all its transactions eligible before proceeding.
- **Linked collection wallets (`EMI-2222`)**: when a transaction touched multiple wallets in sequence, the reversal must walk back in the **exact reverse order**: User Wallet ← Control Wallet ← Commission Wallet ← VAT Wallet. Each linked wallet's balance is updated at its step, not all at once.
- **Commission & VAT reversal (`EMI-2223`)**: a reversed commission doesn't go straight back to the source wallet — it must first move to a **Commission Debt Account**, and only from there back to the source. VAT reversal has its own correctness requirement tied to regulatory compliance (not just "subtract it back").

**Governance & audit (applies to both reversals and manual adjustments):**
- **Validation (`EMI-2228`)**: the one hard rule stated is that an adjustment must never be allowed to push a wallet into a negative balance — enforced server-side, with real-time feedback in the UI.
- **Multiple adjustments allowed (`EMI-2227`)**: for exceptional cases, the same transaction/wallet can be adjusted more than once (not a one-shot correction) — full adjustment history is tracked and shown.
- **Reason logging is mandatory and structured, not free-text-optional**: both reversals (`EMI-2224`) and adjustments (`EMI-2229`) require a dedicated log table capturing Transaction ID, Batch ID, Adjustment/Reversal Type, and Reason — captured via a UI prompt at the moment of the action, not after the fact.
- **Audit trail (`EMI-2225`, `EMI-2230`, `EMI-1695`)**: every reversal and adjustment logs who did it, when, the transaction ID, and the amount, in a searchable/filterable interface. `EMI-1695` (Comprehensive Transaction Auditing) frames this from a compliance-officer point of view: log all transaction states and user interactions with timestamps, user IDs, and transaction IDs, retrievable for regulatory audit and discrepancy investigation — this is the broader auditing umbrella the specific reversal/adjustment logs (`EMI-2224`/`EMI-2229`/`EMI-2230`) feed into.

---

## Beneficiary types not covered in the live epic

**International OTC beneficiary (`EMI-2742`) — full extraction, live 5th beneficiary type still missing.** This is a complete spec for the beneficiary type the live `EMI-2600` umbrella story leaves as a blank heading (per pass 1). Mechanically identical to the live OTC/Western Union flow already documented under Beneficiary Management and Cash-out in part 1 — beneficiary picker (alias + ID) → amount + purpose → balance/limit validation → OTP → Western Union API call with the beneficiary's details → reference number shown to the customer, with instructions for the receiver to claim funds at any Western Union location → an authenticated callback from Western Union on disbursal updates the transfer to "Completed" and is logged for audit. The only meaningful difference from the domestic OTC flow already documented is that this one is explicitly for **international** cash-pickup, so the beneficiary/country/currency fields differ accordingly (not detailed further in this story beyond "relevant information e.g. name and ID number").

**Beneficiary management with manual bank KYC (`EMI-709`) — full extraction, distinct legacy design.** Describes a two-type beneficiary model (internal MjdPay users found by phone number; external bank accounts) where **external bank beneficiaries go through manual KYC** — IBAN certificate upload, a manual verification phone call, and an *optional* government API check — with a visible pending/approved/rejected status, and only approved beneficiaries can receive transfers. This predates the live Local/International Bank Beneficiary stories (`EMI-2747`/`EMI-2748`, part 1), which instead validate IBANs automatically via real-time formatting rules and bank auto-detection, with no manual call step. Worth knowing this manual-KYC design existed even though the live flow moved to automated validation — if a merchant/high-risk-beneficiary case ever needs manual review again, this is the precedent.

---

## Registration variants

**Business registration (`EMI-2029`) — partial extraction; adds detail not in the live spec.** Same verification sequence family as the live `EMI-3782`/`EMI-122` (Tahaqaq → OTP → Wathiq → AML → Nafath → risk assessment → pending profile), but with two concrete details worth carrying forward that the live stories don't spell out:
- **Company Number format**: on activation, the system generates a unique Company Number as one random character followed by 4 digits.
- **Admin verification workflow**: a privileged admin reviews and approves/rejects the pending profile; if approved, a *separate* admin step (optional, can be skipped) creates a commission schema for the account; only after that does a third step activate the account and trigger wallet creation + credential delivery by SMS/email.

**ERP Registration (`EMI-600`) — full extraction, distinct onboarding path not documented elsewhere.** A separate registration path where a user's account is provisioned from **existing ERP system data** rather than the Yakeen/Wathiq/Nafath KYC sequence — the system pulls user info from the ERP database, still runs "required KYC and checks through our system," and lets the user set/reset a password as part of onboarding. This is a different mechanism from every other registration story in the project (all of which start from a fresh mobile-number-and-OTP flow) — worth confirming with the product owner whether this ERP-sourced path is still real or was an early alternative that got dropped in favor of the Yakeen-first flow.

**Continue Registration (`EMI-620`) — superseded, no distinct content.** Describes the same resume-from-last-step behavior already documented under `EMI-3782`'s "Resume Guardrails" in part 1 (pending request lookup, session persistence, resume from last incomplete step). No new rule beyond one UI detail: a "Continue Registration" entry point should exist on the login screen itself, not just inside the registration flow.

**Biller Registration (OLD) (`EMI-123`, Done) — superseded, no distinct content.** Title says it outright. Same flow as `EMI-2029`/`EMI-122`, same Company Number generation detail (reinforces that rule is real and shipped, not speculative).

---

## Admin back-office screens

**Merchant Management (`EMI-193`) / Biller Management (`EMI-192`, Done) — full extraction, likely misfiled (see findings doc — these probably belong under the empty `EMI-82`/`EMI-81` epics).** Near-identical admin CRUD pair, one per persona:
- List page with brand-name/mobile-number/status filters, showing name, brand, mobile, status, and a detail-view link.
- Detail page shows the full Wathiq and Nafath verification data, a downloadable signed contract PDF (sourced from the ERP system), and any commission schemas attached. Actions differ by state: **pending** → Approve/Reject; **approved** → manage commission schemas, Activate/Deactivate.
- Create page collects CRN, mobile/Iqama ID, mobile number, email, then runs OTP + a Nafath popup before creating the pending record.
- Commission list (per merchant/biller): rows of Transaction Type / Min Amount / Max Amount / Media / edit/delete; the add/edit popup lets an admin set a value type (percentage or fixed SAR) per row. This is the same schema shape as `EMI-90` below (see Commission schema section) — read them together.

**Check Bills (`EMI-184`, re-open) — full extraction.** Admin bill-approval screen: search by bill number, biller's own bill number, or date range; the results table only ever shows bills in "created" status; a "Check" action lets a privileged admin approve them. (Re-opened status means something regressed here post-ship — see the findings doc for the action item; this file only covers what it's supposed to do.)

**Biller Bank Transfer (`EMI-180`, In Progress) — duplicate, no distinct content.** Same cash-out-to-external-bank flow as the live `EMI-172` (Business Wallet Cash-out, part 1): masked IBAN, confirmation screen with amount/recipient/bank, OTP, and a non-instant settlement window communicated to the user. Notably this story is marked "In Progress" while sitting in the Archived epic — an epic-link anomaly, not a content difference.

**Biller Top-up (`EMI-179`) — duplicate, minor field detail only.** Same HyperPay top-up mechanics as the live Cash-in stories (part 1): amount capped at 7 digits with 2 decimals, SAR prefix, verification-code dialog with resend, then HyperPay card fields (Brand: Visa/Mastercard/Amex, Card Number, Expiry, CVV, Name on Card). No new business rule beyond confirming the supported card brand list.

**Transaction Report (`EMI-177`) — full extraction, possible overlap with the live Reports epic.** Search by transaction type, internal reference, source/destination wallet, and date range; the results table includes **Amount Before Transaction** and **Amount After Transaction** as explicit columns alongside Amount/Status/Date — a useful ledger-reporting detail not seen elsewhere in the project. Exportable to PDF and Excel, web-only.

**Account Statement (`EMI-198`) — full extraction, flags the superseded balance model.** Wallet-scoped statement (Wallet Number is a required filter — no data renders without it) with a date range, exportable to Excel/PDF, columns include Internal/External Reference, Amount, Date, Status, Type, and **Available Balance / Reserved Balance / Current Balance** — the pre-`EMI-602` three-bucket naming. If this screen is ever built or revived, its column set needs to be reconciled against the current four-bucket model (which bucket does "Reserved" map to — `reserve_debit`, `reserve_credit`, or both combined?).

**Admin Profile (`EMI-199`) / User Profile (`EMI-173`) — thin, likely superseded by the live Profiles epic (`EMI-2190`).** Both just display first name, last name, email (`EMI-199` adds mobile number and last-login timestamp). No business rule beyond "show these fields, consistently, for both admin and normal users."

---

## Login (Merchant/Biller variants)

**`EMI-125` (Merchant) / `EMI-124` (Biller) — one full extraction, one duplicate note.** Byte-for-byte identical structure under two persona-specific keys. Business rules: login by auto-generated Company Number + registered phone number + password; **first-ever login for a new account forces a password reset** (set new password, confirm) before proceeding; biometric (face/fingerprint) is offered as an alternative going forward; an OTP is still sent to the registered phone to complete login regardless of password/biometric path; successful login lands on the home page. The forced-password-reset-on-first-login rule isn't mentioned anywhere in the live Customer-focused login stories (`EMI-2599`/`EMI-4625`, part 1) or their Business/Auth-and-Login descendants (`EMI-126`, part 1; `EMI-4638`, part 6) — worth confirming whether Business/Biller accounts still get a forced first-login password reset today.

---

## Standalone business concepts (not represented anywhere else in the project)

**Referral Services (`EMI-164`, Done) — full extraction, genuinely new concept.** Admin-managed promo codes (create/read/update/delete, each with a code, referral amount, and expiration date); when a user applies a valid promo code, the system calculates a referral reward based on that user's **first transaction only** and credits it back to the user who holds/applied the promo code. All promo-code actions are logged for audit. This is a distinct mechanism from `EMI-91` (Cashback) below — the project doesn't say whether they're the same feature under two names or genuinely two different reward systems; worth clarifying since "Cashback" and "Referral" usually aren't the same thing.

**Cashback (`EMI-91`, Done) — thin, aspirational spec.** States the goal (let customers redeem a portion of what they paid on a purchase) and asks for a UI to track balance and redeem, but has no concrete rate, trigger condition, or funding-source rule — it reads as a placeholder that was marked Done without ever being fully specified. Nothing enforceable to extract beyond the intent.

**Admin commission management schema (`EMI-90`) — full extraction, fills a real gap.** This is the underlying commission-schema data model the live epics reference but never define (`EMI-2186` Commissions has 1 story that doesn't define this; `EMI-4133` Commission Rules Engine has zero stories). A commission rule is defined by: Transaction Type (source/destination wallet are implied by the type, not separately configured), Min Amount, Max Amount, Media (channel: mobile/web/etc.), Value Type (Fixed or Percentage), and the Commission Value itself. There's a **Default Commission Schema** that applies to any transaction type without a specific rule (defaults to a percentage). The one genuinely non-obvious rule: **if two schemas for the same user have overlapping min/max amount ranges, both apply and their commissions are summed** — overlap is explicitly allowed, not rejected or treated as a conflict. Customer wallets need their own separate schema definition (by customer ID / wallet type), not just the business-wallet schema described above.

---

## One-line notes — duplicates or superseded, no distinct content

- `EMI-620` (Continue Registration) — superseded by `EMI-3782`'s resume logic (part 1); see Registration section above for the one UI detail worth keeping.
- `EMI-123` (Biller Registration (OLD)) — superseded by `EMI-122`/`EMI-3782` (part 1); title says so explicitly.
- `EMI-180` (Biller Bank Transfer) — duplicate of `EMI-172` (part 1).
- `EMI-179` (Biller Top-up) — duplicate of the Cash-in HyperPay flow (part 1).
- `EMI-124` (Login, Biller) — duplicate of `EMI-125` (Login, Merchant), persona label swapped only.
- `EMI-199` (Admin Profile) / `EMI-173` (User Profile) — likely superseded by the live Profiles epic (`EMI-2190`, covered in part 2) — no rule here that isn't "display these fields."
