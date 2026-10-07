# EMI User Story Refinement — Core Customer-Facing Modules

**Scope:** 14 modules / 54 stories under the EMI Jira project (project = EMI), pulled live via `twg jira` on 2026-09-27.
Modules = Epics (Epic Link/parent). This is pass 1 of the 81-epic backlog — the modules already covered by this test-automation repo (`Login/`, `Registration/`, `BankTransfer/`, `Topup/`, `W2WTransfer/`, `PayBill/`, `BillManagement/`, `BeneficiaryManagement/`, `MoneyRequest/`, `QRPayment/`, plus Wallets and Card management which don't have a repo folder yet).

**How to read this doc:** each module has (1) its story list, (2) findings — gaps, contradictions, duplication, or missing detail worth a product/eng conversation — and (3) for stories that were effectively empty or clearly out of step with the current bar, a refined rewrite. Nothing here has been written back to Jira; this is a discussion draft.

---

## Cross-cutting findings (read this section first)

These span multiple modules and are the highest-value things to resolve before doing a story-by-story pass.

### 1. The canonical balance model isn't referenced by the stories that depend on it
`EMI-602` (Wallet Running Balance, Done) was amended 2026-08-01 to a **four-bucket model** (`available` / `reserve_debit` / `reserve_credit` / `current`, with `reserve_credit` deliberately excluded from `current`) and explicitly says: *"This is the single definition — no other story may restate or re-derive it."* It's referenced by EMI-5944/5945/5946/5950 (outside this pass's scope).

None of the other Wallets-module stories in this pass — `EMI-4577` (Wallet Rules & Controls), `EMI-4150` (Auto-Withdrawal), `EMI-4153`/`EMI-4154` (Sub-Wallets), `EMI-2213` (Wallet creation), `EMI-2049`/`EMI-2050` (Top-up/Cash-out) — use this vocabulary. They all talk generically about "available balance" and a three-bucket idea (Available/Reserved/Current), which is the **superseded v1 model**. Since EMI-602 says no other story may re-derive the model, every story that touches balance should instead **link to EMI-602** and use its bucket names, or it will drift the moment reserve/settlement edge cases come up (partial disbursal, holds, threshold blocks — all things EMI-4577 and EMI-4150 describe in their own words already).

**Suggested action:** add "See EMI-602 for the canonical balance model" to EMI-4577, EMI-4150, EMI-4153, EMI-4154, EMI-2213, EMI-2049, EMI-2050, and re-check their AC wording for `reserve_credit`-shaped cases (e.g. Auto-Withdrawal's "insufficient balance for fees" check should say which bucket it's reading).

### 2. Wallet identifier model contradicts itself between two stories
- `EMI-3637` (Wallet code): the wallet code **replaces vIBAN** as the primary identifier; vIBAN is relegated to an "external account" field only, with a mapping table for history. Format is `<TYPE>-<PAYLOAD>-<CHK>`, independent of any bank-assigned vIBAN.
- `EMI-2213` (Wallet creation): "an internal wallet code **matching the vIBAN**."

These can't both be true. This is a foundational data-model decision (does the wallet code encode/derive from the vIBAN, or is it independent per EMI-3637's whole stated rationale of surviving a vIBAN reassignment?) and it affects reconciliation, external API contracts, and every story that displays or masks a wallet code. Worth resolving with whoever owns Core wallet engine (EMI-4131) before either ships.

### 3. Card Issuance / Card Details describe two real security problems
- `EMI-2605` (Card Issuance, **Done**): every issued card gets the **same hardcoded default PIN, "1234."** That's a predictable-credential issue on a live financial product — a default PIN should be random per card (or PIN-less until the customer sets one), not a shared literal.
- `EMI-2730` (Card Details, To Do): the backend is specified to return the **full, unmasked CVV** to the client on demand ("the backend validates access and responds with unmasked data"). Storing/returning CVV2 after authorization is a PCI DSS violation regardless of biometric gating on the client — the standard's answer to "should the app be able to fetch the CVV" is no, because CVV must not be retrievable post-issuance at all.

Both are worth flagging to the security/compliance owner directly — this is exactly the kind of thing SAMA CSF language elsewhere in this backlog (EMI-4625, EMI-3553) is trying to prevent, but it isn't being applied here.

### 4. Empty / stub stories
Two stories in scope have no content beyond a heading:
- `EMI-2743` (Summary page) — 144 characters total, just "Acceptance criteria" with nothing under it. Its title strongly suggests it's an earlier, unfinished pass at what `EMI-2744` (Transfer summery) now covers in full. Candidate for closing as superseded by EMI-2744 rather than leaving it open and empty.
- `EMI-4161` (Controlled Balance Spending (Issue Controlled Balances with Rules)) — also 144 characters, empty. Its title is near-identical to `EMI-3554` (Controlled balance spending), which **is** fully specified (sender attaches merchant/geo/time constraints to a P2P transfer). Looks like a duplicate ticket that never got filled in — candidate for closing as a duplicate of EMI-3554, unless there's a distinction ("issue" vs "spend") that only the reporter knows.

### 5. Legacy stories haven't been brought up to the current documentation bar
There's a visible generational gap. Newer stories (EMI-4625 Login OTP & Device Trusting, EMI-3782 Registration, EMI-4577 Wallet Rules, EMI-834 Money request, EMI-3553 Wallet sharing) carry Given/When/Then ACs, FE/BE flow sections, edge cases, security notes, and a Definition of Done. Older ones — mostly the `[Done]` stories that shipped before the template matured — are much thinner:
- `EMI-121` (Customer Registration), `EMI-245` (Admin Login), `EMI-126` (Business Login), `EMI-2599` (Customer Login), `EMI-2959` (Customer Logout): flat AC lists, no Given/When/Then, no edge cases beyond "3 failed attempts locks the account," no explicit lockout duration or unlock path (self-service vs admin-only isn't stated anywhere).
- `EMI-245`/`EMI-126` both list "Server errors or AML (Anti-Money Laundering) compliance issues" as a login error case — AML doesn't normally block a *login*; this reads like boilerplate copied from a registration-flow template and left in. Worth a business sanity-check: is there really an AML gate on login, or should this line be removed?
- `EMI-2599` (Customer Login, PIN + biometric) was never reconciled with `EMI-4625` (Login OTP & Device Trusting, OTP + biometric + SAMA single-device policy) even though both are "To Do" and describe what sounds like the same customer mobile login screen with two different mental models (PIN-first vs OTP-then-trust-device). One of these should supersede the other, or the doc should explain how PIN and OTP/biometric-trust coexist.

Since these are already `Done`/shipped in most cases, the ask isn't "rewrite the AC," it's "retrofit the current template's structure (AC as Given/When/Then, explicit lockout duration + unlock mechanism, edge cases) so the story is still useful as a regression reference," and reconcile EMI-2599 vs EMI-4625 before EMI-4625 ships.

### 6. Persona-split duplication is a deliberate pattern — but it's a maintenance risk
Several features are documented twice, once per persona, with ~90% identical content:
- Registration: `EMI-3782` (umbrella, all personas) + `EMI-122` (Business) + `EMI-121` (Customer, legacy format)
- Wallet-to-wallet transfer: `EMI-4281` (Business) + `EMI-529` (Customer, Done)
- Cash-in/Top-up: `EMI-171` (Cash-in, Done, admin-oriented wording) + `EMI-2049` (Wallets Top-up, To Do) — largely the same HyperPay/VIBAN flow restated
- Cash-out: `EMI-172` (Business Wallet Cash-out, Done, ANB-specific) + `EMI-2050` (Wallets cash-out, To Do, generic + admin/system-wallet variant)

This mirrors the Registration pattern already called out in `EMI-3782` itself ("Business = Biller or Merchant only... must not be conflated"), so it may be intentional per-persona documentation. The risk is drift: `EMI-3782`'s Step 3 verification sequence (Yakeen → WATHIQ → AML WS1 → Lean → NAFATH) already doesn't match `EMI-121`'s older sequence (Tahaqaq → OTP → AML → NAFATH → AML risk). If one is updated without the other, QA ends up automating against whichever was read first. **Suggested convention going forward:** one shared story per flow, with persona-specific deltas as sub-sections or linked stories — not full restatements.

### 7. Re-opened story needs a root-cause note
`EMI-242` (Adding Bills via Excel Files) is the only story in this pass with status `re-open`. Its AC is currently two vague lines ("Customers should be able to successfully upload Excel files" / "system should analyze and generate bills... without any issues") despite the story requirements mentioning checksum validation and all-or-nothing rollback on any row failing validation — none of which is reflected in testable AC. Given it was reopened (implying something broke after being marked resolved), this is the one story in the batch most worth turning into concrete Given/When/Then criteria, specifically around: checksum tamper detection, per-row validation failure → whole-batch rollback, and what "any issues" actually enumerates.

---

## Module: Registration (`EMI-2173`)

| Key | Status | Title |
|---|---|---|
| EMI-3782 | To Do | Registration (umbrella — all personas) |
| EMI-122 | Done | Business Registration |
| EMI-121 | Done | Customer Registration |

**Findings:**
- EMI-3782 is excellent — persona table, step-by-step KYC/KYB sequence (Yakeen → WATHIQ → AML WS1 → Lean → NAFATH → Products → Contract), resume/continuation guardrails, non-functional requirements, dependency table. Two real gaps inside it: the **"Definition of Done" section is empty** (both in EMI-3782 and its Business-persona twin EMI-122), and the **"Process Flow Diagram" is explicitly marked pending**. Both are cheap to close and both stories currently ship without them.
- EMI-121 (Customer Registration) predates this template entirely — see cross-cutting finding #5. Its verification sequence order differs from EMI-3782's (see #6). Since Customer registration skips WATHIQ/Lean per EMI-3782, EMI-121 should at minimum be re-derived from EMI-3782's Customer column rather than maintained as an independent flow description.
- None of the three reference EMI-4634 (Authority matrix) even though EMI-3782's WATHIQ step explicitly retrieves "authorized persons and company parties" — worth linking so authority/signatory rules aren't redefined ad hoc.

**Suggested refinement — EMI-3782 / EMI-122 Definition of Done (currently blank):**
> - Yakeen, WATHIQ, AML WS1, Lean, and NAFATH integrations are called in the documented order with individual timeout/fallback handling (per the Non-Functional Requirements section already in the story).
> - Admin Products and Contract tabs are live and show data matching what the applicant submitted.
> - Contract PDF is generated and emailed within 5 seconds of profile creation (per NFR).
> - Resume-from-last-step behavior verified for at least one interruption per verification stage (OTP, WATHIQ, AML Under Review, NAFATH).
> - AML rejection messages shown to the end user are confirmed generic (no screening detail leaked), per the Error Handling section.
> - Automated test coverage exists for T01–T28 (the Testing Scenarios table already in the story).

---

## Module: Login (`EMI-2174`)

| Key | Status | Title |
|---|---|---|
| EMI-4625 | To Do | Login OTP & Device Trusting with Strong Login |
| EMI-2959 | To Do | Customer Logout |
| EMI-2599 | To Do | Customer Login |
| EMI-245 | Done | Admin Login |
| EMI-126 | Done | Business Login |

**Findings:**
- EMI-4625 is the strongest story in this module: SAMA CSF mapped, Given/When/Then AC, single-device enforcement, risk-based OTP triggers, 10-year audit retention. It is the one story here that should be treated as the source of truth for what "logging in" means going forward.
- EMI-2599 (Customer Login) directly conflicts with it — see cross-cutting #5. Concretely: EMI-2599's UI is PIN-first with biometric as an equal alternative; EMI-4625 says OTP is mandatory on any username/password login and biometric is the *only* way to skip OTP on a trusted device, with no mention of a PIN path at all. Someone needs to decide whether "PIN" in EMI-2599 *is* the device-passcode path EMI-4625 describes, or a separate weaker credential that needs to be either removed or explicitly reconciled with SAMA MFA requirements.
- EMI-2959 (Logout) doesn't specify **what happens to other active sessions** on logout, which matters given EMI-4625's single-device policy — does logging out of Device A still allow Device B (which was already force-logged-out per the single-device rule) to do anything, or is this moot? Also missing: is there a session timeout / idle logout, separate from manual logout?
- EMI-245 and EMI-126 both list "AML compliance issues" as a login error case (see cross-cutting #5) — needs a business owner's sanity check.
- Account lockout ("3 failed attempts → temporarily locked; 3 temporary locks → deactivated") is stated identically in EMI-2599, EMI-245, and EMI-126, but none of the three specify: lockout **duration**, whether unlock is self-service (e.g. wait it out, or forgot-password reset) or requires admin/support intervention, or whether the count resets on a successful login.

**Suggested refinement — lockout AC (missing from all three login stories):**
> - **Given** a user has 2 consecutive failed login attempts, **when** they fail a 3rd time, **then** the account is temporarily locked for `<X minutes — needs a business-confirmed value>`, and a clear message states the lockout and remaining time.
> - **Given** an account has been temporarily locked 3 times, **when** the 3rd lockout is triggered, **then** the account is deactivated and the user is directed to `<support flow / forgot-password flow — needs confirmation>`, not left with no path forward.
> - A successful login resets the failed-attempt counter to zero.

---

## Module: Cash-in (`EMI-2175`)

| Key | Status | Title |
|---|---|---|
| EMI-3564 | To Do | Top-up via SADAD bill |
| EMI-171 | Done | Cash-in (HyperPay + VIBAN) |

**Findings:**
- Both are solid, Given/When/Then style stories. EMI-3564 (SADAD) and EMI-171 (HyperPay/VIBAN) are three independent top-up rails with no shared "top-up" umbrella story — compare to EMI-2049 (Wallets Top-up) in the Wallets module, which restates the HyperPay/VIBAN flow again. Three places describing overlapping top-up mechanics (EMI-171, EMI-2049, and implicitly EMI-3564) with no cross-links.
- EMI-3564's polling/webhook language ("System tracks bill status via Sadad callbacks or periodic polling") doesn't specify a reconciliation SLA or what happens if neither callback nor polling ever resolves — compare to EMI-2603 (Exchange network transfer) in the Cash-out module, which has an explicit "no callback within SLA → reconciliation mode → refund" pattern. SADAD top-up should probably follow the same pattern rather than leaving "stuck Pending forever" unaddressed.

---

## Module: Cash-out (`EMI-2176`)

| Key | Status | Title |
|---|---|---|
| EMI-4152 | To Do | Cross-Border Network Transfers (Thunes) |
| EMI-4151 | To Do | Wallet provider transfer (STC Pay) |
| EMI-4150 | To Do | Auto-Withdrawal |
| EMI-2744 | To Do | Transfer summery |
| EMI-2743 | To Do | Summary page — **empty, see cross-cutting #4** |
| EMI-2603 | To Do | Exchange network transfer (Western Union) |
| EMI-2602 | To Do | Customer International transfer |
| EMI-2601 | To Do | Customer Local transfer |
| EMI-172 | Done | Business Wallet Cash-out (ANB) |

**Findings:**
- This is the deepest, most mature module in the pass — EMI-4152, EMI-4151, EMI-4150, EMI-2603 all have full FE/BE flow, notification copy, security notes, and 10+ test cases each with a consistent reserve → partner callback → finalize/refund pattern. This is a good template to backport into thinner modules (Wallets, Card management).
- EMI-2744 (Transfer summery) is thorough but its markdown clearly shows a **broken edit history** — it trails off mid-sentence into "continue / **AM**" (line ~1664 in source) before resuming with "Sample Data (continued)." This reads like a co-authoring artifact that leaked into the published description. Worth a quick cleanup pass in Jira regardless of content accuracy.
- EMI-2601 (Local transfer) and EMI-2602 (International transfer) are both still in the older flat-AC format (no Given/When/Then, no FE/BE split) compared to EMI-2603/EMI-4152/EMi-4151 right next to them in the same epic. Same underlying pattern (beneficiary picker → amount → OTP → bank API → confirmation) — these three (EMI-2601, EMI-2602, EMI-2603) are near-identical in shape and could plausibly share one parameterized story (transfer type = Local/International/OTC) the way EMI-3782 does for registration personas, rather than three independent narratives that will drift.
- EMI-2743 — see cross-cutting #4, recommend closing as superseded by EMI-2744.
- None of Local/International/Exchange transfer stories (EMI-2601/2602/2603) specify a **daily/per-transaction limit value** — they all say "validated against... any predefined limits set by the organization" without stating what those limits are or pointing to the limits config story. Worth linking to EMI-4577-style limit config once that pattern exists for cash-out too.

---

## Module: E-Bill (`EMI-2178`)

| Key | Status | Title |
|---|---|---|
| EMI-3020 | Done | Predefined Items |
| EMI-242 | **re-open** | Adding Bills via Excel Files |
| EMI-183 | Done | Bill Management |

**Findings:**
- EMI-3020's AC header says "Add Products (Smart & Manual)" but only Manual Add is ever described — "Smart" add is never defined (OCR import? catalog sync?). Either the heading is stale copy or a sub-feature was cut and the heading wasn't updated.
- EMI-242 — see cross-cutting #7. This is the priority item in this module given its re-open status.
- EMI-183 (Bill Management) is comprehensive on view/filter/approve/edit, but the discount-type migration section ("add a new `None` option in addition to `Fixed` and `Percentage`") reads like a later addendum bolted onto an already-Done story — worth checking whether the "no 0 value allowed" rule for Fixed/Percentage discounts is actually enforced today, since it's easy to silently regress when a Done story gets amended in place rather than getting its own follow-up ticket.

---

## Module: Bill payment (`EMI-2179`)

| Key | Status | Title |
|---|---|---|
| EMI-170 | Done | Bill Payment |

**Findings:**
- Single story, fairly thin (flat AC list, no edge cases beyond "Approved-only, not-yet-due bills can't be paid"). No mention of partial payment, overpayment, or what happens if the same bill is paid twice in quick succession (idempotency) — contrast with EMI-834 (Money request) or EMI-2603 (Exchange transfer) in other modules, which both explicitly cover idempotency/double-click protection. Worth adding a duplicate-payment guard AC given this handles real money movement.

---

## Module: Beneficiary Management (`EMI-2192`)

| Key | Status | Title |
|---|---|---|
| EMI-2756 | To Do | Wallet to wallet beneficiary |
| EMI-2749 | To Do | OTC (Over-the-Counter) Beneficiary |
| EMI-2748 | To Do | International Bank Beneficiary |
| EMI-2747 | To Do | Local Bank Beneficiary |
| EMI-2746 | To Do | Beneficiary Selection & Adding |
| EMI-2600 | To Do | Customer beneficiaries — **effectively empty, see below** |
| EMI-185 | Done | Bill Beneficiary Management (admin/CRN) |

**Findings:**
- EMI-2756 and EMI-2746 are **near-duplicates** — both titled around "select/add a beneficiary via contacts or QR" with almost identical AC and test case tables. One should be closed as a duplicate of the other, or their scopes need to be explicitly split (e.g. 2756 = wallet-to-wallet specific, 2746 = generic contact/QR picker reused elsewhere) and cross-referenced.
- EMI-2600 (Customer beneficiaries) has **five numbered AC sub-headings with nothing under any of them** ("1. Wallet (Customer) Beneficiary:", "2. Bank Beneficiary:", etc. — all blank), while the Test Cases and Test Data sections below are filled in and clearly refer to content that was supposed to be under those headings. This looks like an umbrella story that was superseded by the fully-specified per-type stories (EMI-2746 through EMI-2749, EMI-2756) but never closed or annotated as such. Recommend closing as superseded, keeping only the delete-beneficiary AC (the one section that *is* filled in) if it isn't covered elsewhere.
- EMI-2748 (International Bank Beneficiary) lists **SWIFT code** as a mandatory field and has a dedicated test case for SWIFT format validation (TC-005), but the field list in its own Description section never mentions SWIFT at all (only Country, Full Name, IBAN/Account, Bank, Relation, Address, Currency, T&C). Concrete inconsistency between the description and the AC/test cases in the same story.
- EMI-185 (admin-side, CRN-based beneficiary management for billers) is disconnected from the five customer-facing stories above — reasonable, since it's a different persona/portal, but worth noting there's no cross-link explaining that these are two separate beneficiary systems (customer wallet beneficiaries vs. biller CRN beneficiaries) for anyone new reading the epic.

---

## Module: Wallet-to-Wallet Transfer (`EMI-2196`)

| Key | Status | Title |
|---|---|---|
| EMI-4281 | To Do | Business Wallet to Wallet Transfer |
| EMI-529 | Done | Customer Wallet to Wallet Transfer |

**Findings:**
- Persona-duplicate pair, see cross-cutting #6. Content is ~95% identical (CRN vs. beneficiary/phone selection is the only real difference). Low risk today since both are consistent with each other, but flag for the "one shared story + persona deltas" convention going forward.
- Neither specifies the **commission calculation** beyond "apply any applicable commission fees automatically" — no rate, no reference to a commission-rules story. Should link to EMI-4133 (Commission Rules Engine) once that's in scope.

---

## Module: Merchant payment (`EMI-2197`)

| Key | Status | Title |
|---|---|---|
| EMI-590 | Done | QR payment |

**Findings:**
- Covers both static "Amount QR" and "Wallet QR" scan flows in one story — reasonably complete for a Done story, but flat AC format (no Given/When/Then) and no idempotency/double-scan protection is mentioned, which matters for a merchant-payment flow specifically (same concern as EMI-170 Bill Payment above).
- No cross-reference to EMI-3545 (Dynamic QR, in the QRs module) even though "Dynamic QR" and "Amount QR" appear to be the same concept described independently in two different epics — worth confirming these are the same feature and consolidating the description into one place.

---

## Module: Wallets (`EMI-2198`) — largest module, 13 stories

| Key | Status | Title |
|---|---|---|
| EMI-4577 | To Do | Wallet Rules & Controls |
| EMI-4576 | To Do | Multi-Wallet Management |
| EMI-4161 | To Do | Controlled Balance Spending — **empty, see cross-cutting #4** |
| EMI-4154 | To Do | Sub-Wallet transfer (funding) |
| EMI-4153 | To Do | Sub-Wallets Management |
| EMI-3637 | To Do | Wallet code |
| EMI-3554 | To Do | Controlled balance spending |
| EMI-3553 | To Do | Wallet sharing |
| EMI-2213 | To Do | Wallet creation |
| EMI-2050 | To Do | Wallets cash-out |
| EMI-2049 | To Do | Wallets Top-up |
| EMI-2008 | To Do | System Wallet Hierarchy and Operations Implementation |
| EMI-602 | Done | Wallet Running Balance — **canonical balance model, amended** |

**Findings:**
- See cross-cutting #1 (balance model not referenced) and #2 (wallet code vs vIBAN contradiction) — both live entirely inside this module and should be resolved together, likely by whoever owns EMI-4131 (Core wallet engine, outside this pass's scope but clearly the natural owner).
- EMI-4577 (Wallet Rules & Controls) and EMI-3553 (Wallet sharing) both independently define **the same shape of rule set** (transaction types, channels, per-type limits, MCC controls, geofencing, KSA-only) — EMI-3553 essentially says "apply EMI-4577-style rules to a shared session" but doesn't cite it; they were clearly written by the same author around the same time but not linked. Should reference each other explicitly so a change to the rules schema doesn't get applied to one and not the other.
- EMI-3554 (Controlled balance spending, fully specified) and EMI-4161 (same title, empty) — see cross-cutting #4.
- EMI-2008 (System Wallet Hierarchy) is the architectural foundation everything else in this module implicitly assumes (Business/Collection/Control/Master wallets, inverted Control Wallet balance, cash-in/cash-out via local-transfer-to-Control-then-external-transfer) but none of EMI-4577, EMI-4153, EMI-4154, EMI-2213, EMI-2050, or EMI-2049 reference it. In particular, EMI-2213 (Wallet creation) requires "every user wallet must be associated with a control wallet," which only makes sense in light of EMI-2008's hierarchy — a reader who hits EMI-2213 first has no idea what a Control Wallet is.
- EMI-2050 (Wallets cash-out, To Do, generic) vs EMI-172 (Business Wallet Cash-out, Done, ANB-specific) — same duplication pattern as cross-cutting #6, plus EMI-2050 introduces a second concept (System Wallet Cashout to a company IBAN, admin-driven) that has no counterpart story elsewhere and isn't mentioned in EMI-2008 despite clearly being a Control/Master wallet operation.
- EMI-4153 (Sub-Wallets Management) states sub-wallets "inherit the KYC/profile of the parent wallet" and are "infinitely vertical" (sub-wallets of sub-wallets) — this recursive nesting isn't reflected in any AC or test case; every test scenario only goes one level deep (parent → sub-wallet). If infinite nesting is real scope, it needs its own test scenarios (e.g., closing a parent with active grandchild sub-wallets, limit inheritance across 3+ levels).

---

## Module: Money request (`EMI-2203`)

| Key | Status | Title |
|---|---|---|
| EMI-834 | Done | Money request |

**Findings:**
- This is the **best-specified story in the entire pass** — full FE/BE flow for both requester and payer, QR-based request-to-pay, explicit state machine (`REQUESTED → PROCESSING → COMPLETED/FAILED/CANCELLED/EXPIRED`), idempotency, smoke/regression/extended test prioritization. Worth using as the reference template when uplifting the legacy stories called out in cross-cutting #5.
- Only gap: multi-wallet selection at pay time (TC-EC-03) assumes the Multi-Wallet Management feature (EMI-4576, Wallets module) already exists — this story is Done while EMI-4576 is still To Do. Worth confirming TC-EC-03 is actually testable today or is written ahead of its dependency.

---

## Module: QRs (`EMI-2204`)

| Key | Status | Title |
|---|---|---|
| EMI-3545 | To Do | Dynamic QR |
| EMI-922 | Done | QR management |

**Findings:**
- EMI-922 (Done) is the foundational EMVCo-compliant QR generation/scan/encryption story but is quite thin (flat AC, no test cases, no FE/BE split) relative to everything built on top of it.
- EMI-3545 (Dynamic QR) appears to be the same concept as the "Amount QR" flow already described in EMI-590 (QR payment, Merchant payment module) — see that module's note. Two epics (QRs and Merchant payment) each own half of what looks like one feature.

---

## Module: Card management (`EMI-2604`)

| Key | Status | Title |
|---|---|---|
| EMI-2731 | To Do | Card Benefits |
| EMI-2730 | To Do | Card Details |
| EMI-2729 | To Do | Card Settings |
| EMI-2728 | To Do | Card Management Page (overview) |
| EMI-2605 | Done | Card Issuance |

**Findings:**
- See cross-cutting #3 — the default-PIN and CVV-exposure issues live here and are the priority items in this module, ahead of any documentation polish.
- This module is otherwise clean and consistently structured (Story/Description/AC/DoD per story, consistent `GET /cards/{id}/...` endpoint naming) — the best-organized *small* module in the pass, aside from the two security issues above.
- EMI-2729 (Card Settings) lists "Change PIN" as a settings action but doesn't say what the **new PIN's validation rules** are (length, can't reuse the default "1234," can't be sequential/repeated digits) — worth tightening once the EMI-2605 default-PIN issue is resolved, since the fix for one likely touches the other.
- EMI-2728 (Card Management Page) describes **five** buttons in its Description ("Below the card, show five buttons") but only lists four numbered ones (Lock, Add to Apple Wallet, Settings, Details) before jumping to 5 (Benefits) — actually five is correct, but the AC section only asserts "Settings," "Details," and "Benefits" are visible/tappable, silently dropping Lock and Add-to-Apple-Wallet from the acceptance criteria despite them being in the description and button list.

---

## Suggested next steps

1. **Resolve the two architecture contradictions first** (balance model reference gap, wallet code vs vIBAN) — these block writing correct AC for anything else in the Wallets module.
2. **Escalate the Card Issuance/Details security findings** (default PIN, CVV exposure) to whoever owns security/compliance sign-off before EMI-2730 or any Card module work ships.
3. **Close or annotate the four duplicate/empty tickets**: EMI-2743 (superseded by EMI-2744), EMI-4161 (duplicate of EMI-3554), EMI-2756/EMI-2746 (near-duplicate, pick one), EMI-2600 (superseded by EMI-2746/2747/2748/2749/2756).
4. **Root-cause EMI-242** (re-opened Excel bulk upload) and turn its two-line AC into testable Given/When/Then covering checksum tampering and all-or-nothing rollback.
5. **Reconcile EMI-2599 vs EMI-4625** (Customer Login: PIN-first vs OTP+trust-device) before either is built, since they describe what sounds like the same screen two different ways.
6. Once modules 2–81 (remaining epics) are ready to review, repeat this pass — flag if the same cross-cutting patterns (legacy vs. new template gap, persona duplication, empty stubs) recur elsewhere, since that would suggest a process fix (a story template/checklist) rather than one-off cleanup.
