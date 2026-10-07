# EMI User Story Refinement — Compliance, Emerging, and Small Modules

**Scope:** 45 stories across 22 small modules under the EMI Jira project, pulled live via `twg jira` on 2026-09-27. This is a continuation of `docs/EMI-Refined-User-Stories.md` (pass 1, 14 core customer-facing modules) — read that file first for the doc's conventions. This file covers: Partner bank, BIN Sponsorship (JIT), FX Trading, SDK, Open Banking, SADAD EBPP, ACH, Validations, R&D, BIN Sponsorship (Pre-Funded), Enhancements, Errors, Adjustment, Sessions, Reversal, Under Review, Verifications, Devices, Jobs, Cryptography, UI/UX, Authentication.

**How to read this doc:** each module has its story table and a "Findings" subsection — gaps, contradictions, duplication, empty stubs, legacy-vs-current-template gaps, security/compliance red flags, and cross-references to modules in other parts of this pass. Nothing here has been written back to Jira.

---

## Cross-cutting findings (read this section first)

### 1. At least three parallel, non-reconciled card-issuance architectures exist
This is the single highest-value finding in this batch. There are now **three independently-specified card programs** in the backlog with materially different security postures for the same core capability (view PAN/CVV, issue a card, charge fees):

- **`EMI-2604` (Card management, pass 1)** — simple model. `EMI-2605` (Done) hardcodes the same default PIN **"1234"** for every card. `EMI-2730` specifies returning the **full unmasked CVV** to the client on demand — a likely PCI DSS violation. Already flagged in pass 1.
- **`EMI-3106` (BIN Sponsorship – Pre-Funded, this batch)** — a full second card lifecycle: issuance (`EMI-3133`), fees (`EMI-3134`), top-up (`EMI-3135`), renewal (`EMI-3136`), details/PAN/CVV viewing (`EMI-3137`), balance retrieval (`EMI-3645`), cancellation (`EMI-3646`), products (`EMI-3132`), configuration (`EMI-2739`). Its CVV-reveal story (`EMI-3137`) is **materially more secure** than `EMI-2730`: one-time token per reveal, explicit "never persists the unmasked state," forced re-auth on navigation/refresh/timeout. No hardcoded PIN anywhere in this set.
- **`EMI-4194` (BIN Sponsorship – JIT Debit-card style, this batch)** — a third model: real-time authorization against a BIN sponsor (Marqeta/NymCard-style), with `EMI-4199` (wallet-to-card mapping), `EMI-4200` (auth decision, ≤800ms SLA), `EMI-4201` (release/refund), `EMI-4195` (program enablement). This is architecturally the most different of the three — funds never leave EMI until spend, vs. the other two which appear to pre-load/debit a card balance.

These cannot all be "the" card program. If `EMI-2604` is what's actually being built while `EMI-3106`/`EMI-4194` represent a later, better-designed replacement that hasn't shipped, the org risks building the insecure version. This needs a single owner decision on which architecture is current, with the other two explicitly archived or reconciled — not left as three live specs.

### 2. Stories are being filed under epics that don't match their content, obscuring the real dependency graph
Several stories in this batch are titled and scoped as belonging to a *different* module than the one they're filed under, which means anyone browsing by epic (the natural way to find "everything about X") will miss them:

- **`EMI-4935` (Multi-Omnibus Account Routing & Rebalancing)** is filed under `EMI-2207` **"Partner bank,"** not under the epic literally named **"Multi-Omnibus" (`EMI-5004`)**, which is covered in a different part of this pass. Whoever is working on Multi-Omnibus will not find this story by browsing its own epic.
- **`EMI-3780` (Reconciliation Auto-Action)** is filed under `EMI-3779` **"R&D"** — but "auto-reconciling" is core operational scope, not research, and belongs conceptually with `EMI-2177` "Reconciliation Management System" (covered elsewhere in this pass). It's also completely empty (see finding 4), so there's nothing to lose by re-filing it.
- **`EMI-719` (System Jobs Management)** lives under "Jobs" but its "Reconciliation Job" section fully describes EOD reconciliation logic (control wallet vs. omnibus balance checks, bank statement matching, internal wallet balance checks) that overlaps directly with whatever `EMI-2177` "Reconciliation Management System" specifies — worth checking they agree, since this is exactly the kind of duplicated canonical logic that drifted in pass 1 (EMI-602 balance model).
- **`EMI-243` (Integration of Biometric Feature for Users)** lives under **"Cryptography"** but is really a login/authentication UX story (bypasses OTP on biometric success) — arguably crypto-adjacent (secure key storage) but the epic placement makes it easy to miss when reviewing Login-module work.

### 3. Legacy vs. current template gap recurs here too, and this time the newest stories are the most rigorous
Pass 1 found older `[Done]` stories thinner than newer ones. This batch shows the same pattern even more sharply: the most recently-written stories in this batch (`EMI-4935`, `EMI-1978`, `EMI-4180` FX Suite, `EMI-4155`–`EMI-4159` ACH/payroll, `EMI-3556` SADAD subscriptions, and especially `EMI-2219` Transaction adjustment) are the **best-specified stories found anywhere in this project so far** — Given/When/Then AC, explicit error-code tables, idempotency, reconciliation artifacts, and (in `EMI-2219`'s case) an explicit "Refinement Note" documenting exactly the kind of contradiction-resolution this whole exercise is doing, plus a tracked table of **open business decisions with IDs (D1–D8)**. Meanwhile stories like `EMI-89` (User Authentication, Done), `EMI-1693` (Secure OTP Verification), `EMI-1822` (Under AML Review), and `EMI-2028` (Transaction Reversal) are one or two flat paragraphs. The gap is widening, not narrowing — worth treating as a backlog-wide backfill effort rather than one-off fixes.

### 4. Empty stub stories (a second occurrence of the pass-1 pattern)
Two more completely empty stories, each just a heading:
- **`EMI-3780`** (Reconciliation Auto-Action) — see finding 2.
- **`EMI-3643`** (Analysis, under "Enhancements") — no content at all.
`EMI-2743` and `EMI-4161` were the pass-1 instances of this same pattern; this is now a recurring habit (create the ticket, never fill it in) worth a process fix rather than continuing to patch case-by-case.

### 5. Three re-opened stories now, all worth root-causing together
Pass 1 found one re-opened story (`EMI-242`). This batch adds two more: **`EMI-1978`** (Partner Bank Management with Fees & Cost Configuration) and **`EMI-810`** (Device management). Three re-opens across ~150 stories reviewed so far is enough to ask whether there's a common root cause (a shared component, a shared team, a shared release) rather than treating each as an isolated regression.

### 6. `EMI-2219` (Transaction adjustment) is the strongest single story in the project and should be the template
Beyond being well-written, `EMI-2219` does something no other story in either pass does: it explicitly tracks **open, unresolved business decisions** (D1: can an adjustment be re-adjusted? D3: idempotency key undefined — a retry currently double-adjusts real money. D4: no maker-checker on a manual money-movement operation in a regulated EMI. D7: the audit trail this story depends on is known to have defects, and fixing them was explicitly descoped). These are not documentation gaps — they are live risk. D3 and D4 in particular (no idempotency key, no approval step, on a story whose entire purpose is correcting money that already moved) deserve escalation ahead of any UI or automation work on adjustments.

Also note: `EMI-2028` (Transaction Reversal, `EMI-2208`) describes reversal in the old three-bucket, single-posting mental model ("move funds back from destination to source") with no reference to `EMI-602`'s canonical four-bucket pair-adjustment unwind that `EMI-2219` explicitly builds on. Since a reversal is conceptually a special case of an adjustment, `EMI-2028` needs the same reconciliation against `EMI-602` that `EMI-2219` already got, or the two will be implemented inconsistently.

### 7. Session/device/logout mechanics are now specified in at least four places
`EMI-2042` (Session management, this batch), `EMI-810` (Device management, this batch), and pass 1's `EMI-4625` (Login OTP & Device Trusting) and `EMI-2959` (Customer Logout) all independently define overlapping pieces of the same session lifecycle (single active session enforcement, JWT access/refresh tokens, device fingerprinting, force-logout). None cross-reference each other. `EMI-810`'s blanket rule — **every request must include geolocation or be rejected** — is worth a business sanity check on its own: does a routine balance check really need lat/lng, or is this meant only for risk-sensitive transaction endpoints?

---

## Module: Partner bank (`EMI-2207`)

| Key | Status | Title |
|---|---|---|
| EMI-4935 | To Do | Multi-Omnibus Account Routing & Rebalancing |
| EMI-1978 | **re-open** | Partner Bank Management with Fees & Cost Configuration |

**Findings:**
- See cross-cutting #2 — `EMI-4935` reads as core Multi-Omnibus scope, not "Partner bank" scope.
- `EMI-4935` and `EMI-1978` are tightly coupled (routing needs the fee data `EMI-1978` configures — `EMI-1978`'s own AC-02 says as much: "sufficient data to evaluate least-cost routing") but neither references the other's key despite living in the same epic.
- `EMI-1978`'s "Automatic Wallet Creation" section (Control Wallet + Revenue/Expenses/VAT/Dormant/Reserve Collection Wallets, auto-created per partner bank) is the exact wallet hierarchy `EMI-2008` (System Wallet Hierarchy, pass 1) defines — again with no cross-reference. This is now the **second** independent restatement of `EMI-2008`'s hierarchy (the first being `EMI-2050`/`EMI-2049` in pass 1's Wallets module). `EMI-2008` should be the one place this is defined; everything else should link to it.
- `EMI-1978` re-opened — no note in the story about why. Worth pairing with the other two re-opens (cross-cutting #5) for a root-cause pass.

---

## Module: BIN Sponsorship – JIT Debit-card style (`EMI-4194`)

| Key | Status | Title |
|---|---|---|
| EMI-4201 | To Do | JIT Release and Refund Processing |
| EMI-4200 | To Do | JIT Authorization Handling |
| EMI-4199 | To Do | Wallet Mapping Configuration for JIT Funding |
| EMI-4195 | To Do | Card Program Enablement with Just-In-Time (JIT) Funding |

**Findings:**
- Internally consistent and well cross-referenced (each story correctly assumes the others). This is a complete, coherent third card architecture — see cross-cutting #1 for why that's the problem, not a compliment on its own.
- `EMI-4200`'s ≤800ms SLA and `EMI-4195`'s ≤2s SLA for what sounds like the same "respond to authorization" step are inconsistent — worth confirming which is authoritative (likely `EMI-4200`, since it's the more specific auth-handling story, but `EMI-4195` should then match it rather than restate a different number).
- Compliance & Audit section in `EMI-4195` requires JIT payload retention "≥ 2 years per SAMA & PCI DSS" — worth checking this doesn't conflict with the 10-year retention SAMA requirement stated elsewhere in the project (pass 1's `EMI-4625`, `EMI-3553`). If both are correct for their respective data types that's fine, but it should be explicit that "2 years" here is JIT-callback-specific, not a general SAMA minimum.

---

## Module: FX Trading (`EMI-4136`)

| Key | Status | Title |
|---|---|---|
| EMI-4180 | To Do | FX Management Suite (Corridors, Rates, Currencies) |

**Findings:**
- Single story, comprehensive (corridors, rate booking with TTL/requote, currency management, audit). No gaps of its own, but it's the natural cross-reference target for pass 1's Cash-out module (`EMI-2602` Customer International transfer, `EMI-4152` Cross-Border Network Transfers), which both handle FX rate display without pointing to a shared FX source — worth linking once both are being built.
- BE Flow step "3. Rate management & Customization:" is a truncated heading with no content underneath it (compare to steps 1, 2, 4, 5 which are all filled in) — minor but worth a one-line fix.

---

## Module: SDK (`EMI-4176`)

| Key | Status | Title |
|---|---|---|
| EMI-4178 | To Do | E-Commerce Checkout: Embeddable Widget |
| EMI-4177 | To Do | Payment Gateway Integration |

**Findings:**
- Both are thin relative to the rest of this batch (short AC lists, minimal test scenarios, no explicit error-code tables) — the epic itself is early-stage/skeleton compared to its neighbors.
- `EMI-4177`'s AC says "SDK covers: create payment, capture, refund, webhook verification" — no mention of what happens to a payment created via SDK relative to the OTP/strong-auth flows every other payment path in this project requires (pass 1's Money request, Merchant payment). Worth clarifying whether SDK-initiated payments skip customer-facing OTP (since there's no MajdPay UI in this flow) and what replaces it (e.g., merchant-side signature + webhook auth only).

---

## Module: Open Banking (`EMI-4166`)

| Key | Status | Title |
|---|---|---|
| EMI-4168 | To Do | Account Balance Aggregation |
| EMI-4167 | To Do | Pay EBPP Bills from External Bank Accounts |

**Findings:**
- Both well-specified, consistent with each other (both use the same OB-consent-then-callback pattern). `EMI-4167` correctly reuses `EMI-4168`'s consent flow conceptually but doesn't explicitly say "reuse the EMI-4168 consent" — if a user has already linked a bank via `EMI-4168`, does `EMI-4167` require a fresh consent flow, or reuse the existing token? Not addressed in either story.
- `EMI-4167` overlaps with pass 1's `EMI-3564` (Top-up via SADAD bill) and this batch's own `EMI-4162`/`EMI-3556` (SADAD EBPP module below) in the "pay a MajdPay-side obligation from an external bank" shape — four stories now describing variations of "pay via bank, wait for callback, credit/settle on confirmation" with no shared reference for the callback/reconciliation pattern they all repeat almost verbatim.

---

## Module: SADAD EBPP (`EMI-3555`)

| Key | Status | Title |
|---|---|---|
| EMI-4162 | To Do | Wallet Top-Up via SADAD (Upload Bill to EBPP for Wallet Recharge) |
| EMI-3556 | To Do | SADAD: Bill Inquiry, One-Time Payment & Subscriptions (Recurring) |

**Findings:**
- Both excellent, Given/When/Then-adjacent, thorough error/edge-case coverage.
- `EMI-4162` is functionally identical to pass 1's `EMI-3564` (Top-up via SADAD bill, Cash-in module) — same flow (generate bill → customer pays via bank → callback → wallet credited), same TTL/expiry pattern, near-identical AC. These read like two people wrote the same story independently. One should be closed as a duplicate of the other, or the split rationale (if any — e.g. one is EBPP-specific plumbing and one is the customer-facing top-up flow) should be stated explicitly in both.
- `EMI-3556`'s subscription/recurring-payment feature has no interaction with pass 1's Auto-Withdrawal story (`EMI-4150`, Cash-out module) despite both being "recurring automated money movement with caps, retries, and auto-pause-after-N-failures" patterns — not a conflict, just an opportunity to share the retry/backoff/escalation policy language instead of each defining its own.

---

## Module: ACH (`EMI-4135`)

| Key | Status | Title |
|---|---|---|
| EMI-4159 | To Do | Payroll Disbursement Settlements to External Bank Accounts |
| EMI-4158 | To Do | External Third-Party Fees Settlement (Fees Clearing) |
| EMI-4157 | To Do | ACH Omnibus Settlements (Cross-Omnibus Account Settlements) |
| EMI-4156 | To Do | Payroll Disbursement to Bank Account (Salary Credit) |
| EMI-4155 | To Do | Payroll Disbursement to Wallet |

**Findings:**
- The five stories share large verbatim blocks — "Requirements & Non-Technical Constraints" is word-for-word identical across `EMI-4155`/`4156`/`4157`/`4158`/`4159`, and `EMI-4155`/`EMI-4156` also share an identical "Payroll Considerations" and "Notifications / Example Copy" block. This is good consistency, but it's copy-pasted rather than referenced — a future change to the shared retry/idempotency/audit policy would need five manual edits with real risk of one being missed. Worth extracting into one "Settlement Conventions" reference the five stories link to instead.
- `EMI-4157` (ACH Omnibus Settlements) is the third place in this pass describing omnibus-to-omnibus fund movement, alongside `EMI-4935` (Multi-Omnibus Routing, this batch, filed under Partner bank — see finding 2) and the `EMI-5004` "Multi-Omnibus" epic covered elsewhere in this pass. Confirm these are describing different mechanisms (event-driven rebalancing vs. scheduled ACH settlement) rather than the same capability specified three times.
- `EMI-4155`/`EMI-4156` split wallet-payout vs. bank-payout payroll into two stories that otherwise share ~90% of their structure — same persona-duplication pattern flagged in pass 1 (cross-cutting #6 there), just for a payout-channel split instead of a persona split.

---

## Module: Validations (`EMI-2200`)

| Key | Status | Title |
|---|---|---|
| EMI-3784 | To Do | QR Validation |
| EMI-3781 | To Do | Bill Validation |
| EMI-1692 | To Do | Transactions Validation |

**Findings:**
- `EMI-1692` (Transactions Validation) is a strong, generic validation pipeline (availability → eligibility → limits → commission, in that order, with specific error messages per failure) that reads as the kind of canonical reference pass 1's Wallets module was missing for its balance/limits logic (`EMI-4577` Wallet Rules & Controls never references anything like this). Worth explicitly linking `EMI-1692` from `EMI-4577` and vice versa — they're clearly describing the same validation sequence at different levels of detail (generic pipeline here, wallet-specific rule configuration there) and should agree on ordering and error codes.
- `EMI-3781` (Bill Validation) is field-level and precise (exact length/type/character constraints per field) but doesn't reference pass 1's `EMI-183` (Bill Management) or `EMI-242` (Adding Bills via Excel Files, the re-opened one) even though it's validating the exact same bill-creation fields those stories describe. Given `EMI-242`'s re-open status and thin AC (pass 1 finding #7), `EMI-3781`'s field-level rules are exactly what's missing from `EMI-242` — this story should be the source `EMI-242`'s AC gets rewritten against.
- `EMI-3784` (QR Validation) doesn't reference pass 1's `EMI-3545` (Dynamic QR) or `EMI-922` (QR management) despite defining the exact validity rules (static = lifetime of the identified entity; dynamic = not used, not expired) those stories need but don't fully state.

---

## Module: R&D (`EMI-3779`)

| Key | Status | Title |
|---|---|---|
| EMI-3780 | To Do | Reconciliation Auto-Action — **empty, see cross-cutting #2 and #4** |

**Findings:** Nothing to review — the story is a blank heading. Recommend re-filing under `EMI-2177` (Reconciliation Management System) rather than leaving it under "R&D," and either filling it in or closing it if the reconciliation-automation idea has been superseded by `EMI-719`'s Reconciliation Job or by whatever `EMI-2177` itself specifies.

---

## Module: BIN Sponsorship – Pre-Funded Credit-card style (`EMI-3106`)

| Key | Status | Title |
|---|---|---|
| EMI-3646 | To Do | Card cancellation |
| EMI-3645 | To Do | Card balance retrieval |
| EMI-3137 | To Do | Card details and info viewing |
| EMI-3136 | To Do | Card renewal and subscription fees |
| EMI-3135 | To Do | Card top-up |
| EMI-3134 | To Do | Card fees |
| EMI-3133 | To Do | Card issuance |
| EMI-3132 | To Do | Card products |
| EMI-2739 | To Do | Card configuration and profile |

**Findings:**
- See cross-cutting #1 — this is the "second" of three competing card architectures, and the most security-conscious one (`EMI-3137`'s CVV-reveal design should be the template pass 1's `EMI-2730` gets rewritten against).
- `EMI-3134` (Card fees: charge issuance fee, roll back card request on insufficient funds) and `EMI-3133` (Card issuance: shows a fee/commission/VAT statement before confirming, then calls the issuance API) describe the **same fee-at-issuance event** from two angles with overlapping AC — likely should be one story, or `EMI-3134` should be explicitly scoped as "the ledger/rollback mechanics behind step 2 of EMI-3133" rather than a parallel independent flow.
- `EMI-3132` (Card products: Excel upload + manual admin add/remove of the product catalog — fees, limits) and `EMI-2739` (Card configuration and profile: admin UI form to create card profiles with title/provider/benefits/limits/fees/status) describe what looks like the same admin capability (define a purchasable card product) through two different mechanisms (bulk Excel vs. one-by-one form) with overlapping field lists. `EMI-3132` even says it supports manual add/remove *in addition to* Excel — worth confirming whether `EMI-2739` is meant to be that manual-add UI, or an independent, older spec for the same thing.
- `EMI-3133` has a garbled AC line ("an API returns a statement that needs to be displays beforethen confirmed that shows") — clearly a drafting artifact, worth a quick cleanup regardless of the duplication question above.

---

## Module: Enhancements (`EMI-2194`)

| Key | Status | Title |
|---|---|---|
| EMI-3643 | To Do | Analysis — **empty, see cross-cutting #4** |
| EMI-237 | **In Progress** | Technical Enhancement |

**Findings:**
- `EMI-3643` is an empty stub.
- `EMI-237` is a broad, non-testable performance/security "initiative" (8 bullet areas — code optimization, DB optimization, server scaling, front-end optimization, async processing, error handling, security patching) with AC like "Application performance is noticeably improved" — none of it is measurable as written. If this is tracked as a real in-progress story rather than an umbrella/epic-like tracking ticket, it needs concrete targets (e.g., specific response-time thresholds, specific queries optimized) or it can never actually be marked Done against its own AC.

---

## Module: Errors (`EMI-2211`)

| Key | Status | Title |
|---|---|---|
| EMI-2226 | To Do | Reversal error handling |
| EMI-2043 | To Do | Comprehensive Error Handling and Localization for Frontend Applications |

**Findings:**
- `EMI-2226` is a two-line stub ("Implement transaction eligibility and error messaging") that exists purely to cover error handling for `EMI-2028` (Transaction Reversal, `EMI-2208` epic below) — it would be clearer as a section inside `EMI-2028` than a separate ticket with almost no independent content.
- `EMI-2043` is solid and generic (handles both single-object and array API error shapes, defines the 498-invalid-token forced-logout behavior, field vs. global error placement) — this is exactly the kind of cross-cutting frontend contract that should be linked from every other story with an "Error Handling" section in both passes, most of which currently invent their own error-display conventions inline rather than pointing here.

---

## Module: Adjustment (`EMI-2209`)

| Key | Status | Title |
|---|---|---|
| EMI-2219 | To Do | Transaction adjustment |

**Findings:** See cross-cutting #6. This is the reference story for the whole project — best-documented, only story with a tracked open-decisions table, explicit dependency graph to `EMI-602`/`EMI-5945`/`EMI-5946`/`EMI-5949`/`EMI-5950`. Its open decisions D3 (no idempotency key on a manual money-adjustment endpoint) and D4 (no maker-checker approval on the same) are the most concrete, actionable compliance risks found in this entire pass — worth surfacing to whoever owns treasury/ops sign-off independently of the rest of this document.

---

## Module: Sessions (`EMI-2202`)

| Key | Status | Title |
|---|---|---|
| EMI-2042 | To Do | Session management |

**Findings:** See cross-cutting #7 for the overlap with `EMI-4625`/`EMI-2959`/`EMI-810`. On its own, `EMI-2042` is clear and testable (single active session, JWT access+refresh with refresh TTL = access TTL + 1 minute — this exact "+1 minute" rule also appears verbatim in pass 1's `EMI-2599`/`EMI-245`/`EMI-126`, so at least that detail is consistent across stories even without an explicit cross-reference).

---

## Module: Reversal (`EMI-2208`)

| Key | Status | Title |
|---|---|---|
| EMI-2028 | To Do | Transaction Reversal |

**Findings:** See cross-cutting #6 — needs reconciliation against `EMI-602`'s four-bucket model and `EMI-2219`'s pair-adjustment unwind pattern before it's built, since as written it describes a simpler single-step balance move that doesn't match the settled-transaction unwind sequence the rest of the ledger model now requires. Its error handling is a two-line reference to `EMI-2226` (see Errors module above) rather than inline detail.

---

## Module: Under Review (`EMI-2206`)

| Key | Status | Title |
|---|---|---|
| EMI-1822 | To Do | Under AML Review |

**Findings:** Thin (four bullet points) relative to pass 1's `EMI-3782` (Registration), which already describes the identical AML-WS1-score-below-100 → Under Review → BenchMatrix-reviewer-approve/reject flow in more detail as part of its own AC. `EMI-1822` should either be merged into `EMI-3782`'s scope or explicitly scoped as "the reviewer-facing side" if `EMI-3782` only covers the applicant-facing side — right now they overlap without either being the clear source of truth.

---

## Module: Verifications (`EMI-2205`)

| Key | Status | Title |
|---|---|---|
| EMI-1693 | To Do | Secure OTP Verification |

**Findings:** Very thin (four generic bullets: "OTPs are generated securely," "delivered via SMS," "timeout mechanism," "handles invalid attempts gracefully") compared to the OTP handling already fully specified in pass 1's `EMI-4625` (Login OTP & Device Trusting) and this project's many transaction-flow stories that each define their own OTP retry/lockout numbers. This story adds nothing beyond what's already better-specified elsewhere — candidate for closing as superseded, or for becoming the single place OTP retry/lockout/timeout values are defined once (since right now those numbers are scattered and occasionally inconsistent, e.g. pass 1 finding #5 on lockout duration never being specified anywhere).

---

## Module: Devices (`EMI-2201`)

| Key | Status | Title |
|---|---|---|
| EMI-810 | **re-open** | Device management |

**Findings:** See cross-cutting #5 and #7. The blanket "every request requires geolocation or is rejected" rule (§2) is broad enough to warrant a business check — it would mean a request to view your own balance fails outright with no location permission, which seems more aggressive than the risk-based approach pass 1's `EMI-4625` takes (location checked as one signal among several, not a hard gate on every call). Worth confirming whether §2 is meant to apply platform-wide or was intended to be scoped to transaction/risk-sensitive endpoints only.

---

## Module: Jobs (`EMI-2199`)

| Key | Status | Title |
|---|---|---|
| EMI-719 | To Do | System Jobs Management |

**Findings:** See cross-cutting #2 — its Reconciliation Job section needs to be checked against whatever `EMI-2177` (Reconciliation Management System) specifies elsewhere in this pass; right now they're two independent descriptions of what should be the same EOD process. Otherwise comprehensive (Inactivity/Dormant/Intraday/Reconciliation/Reports jobs, all admin-configurable with reschedule-on-change behavior).

---

## Module: Cryptography (`EMI-2195`)

| Key | Status | Title |
|---|---|---|
| EMI-243 | Done | Integration of Biometric Feature for Users |

**Findings:** See cross-cutting #2 and #3. Filed under "Cryptography" but is a login/authentication-UX story; its "biometric success bypasses OTP" rule is the earlier, simpler version of what `EMI-4625` (pass 1) now specifies with much more precision (trust only established after a prior OTP-verified login, single-device enforcement, risk-based re-challenge). Since `EMI-243` is Done and presumably already shipped, it's a candidate for the same "retrofit to current template + reconcile with the newer story" treatment as pass 1's legacy Login stories.

---

## Module: UI/UX (`EMI-2193`)

| Key | Status | Title |
|---|---|---|
| EMI-187 | **In Progress** | UI/UX Enhancements |

**Findings:** Same shape as `EMI-237` (Enhancements module) — a broad, non-testable initiative ("navigation should be intuitive," "typography should be optimized for readability") with a dangling "FIGMA Link:" field left empty. As written, this can't be verified against its own AC. If it's meant as an epic-level tracking ticket rather than a testable story, it should probably be re-typed as such rather than carrying `issuetype = Story`.

---

## Module: Authentication (`EMI-2212`)

| Key | Status | Title |
|---|---|---|
| EMI-89 | Done | User Authentication |

**Findings:** Extremely generic ("users should be able to register and log in using their unique credential information") — reads as the original seed/placeholder story for the entire auth system, since shipped and superseded many times over by the far more detailed Login/Registration stories in pass 1. Not worth refining on its own merits; worth confirming it's safe to mark as historical/superseded rather than live documentation anyone should reference.

---

## Suggested next steps

1. **Resolve the three-way card architecture conflict** (cross-cutting #1) before any further Card work ships — pick one of `EMI-2604`/`EMI-3106`/`EMI-4194` as the real spec, and use `EMI-3106`'s `EMI-3137` as the template for the CVV/PAN reveal flow regardless of which architecture wins, since it's the only one of the three that doesn't have a PCI DSS problem.
2. **Re-file the misfiled stories** (cross-cutting #2): `EMI-4935` into Multi-Omnibus, `EMI-3780` into Reconciliation.
3. **Escalate `EMI-2219`'s D3 and D4** (no idempotency key, no maker-checker on manual financial adjustments) independently — this is a live compliance/fraud risk on a story that's currently "To Do," not a documentation nit.
4. **Reconcile `EMI-2028` (Transaction Reversal) against `EMI-602`/`EMI-2219`'s canonical model** before building it, the same way `EMI-2219` itself already was.
5. **Consolidate the four independent "pay from external bank, wait for callback" stories** (`EMI-3564` pass 1, `EMI-4162`, `EMI-4167`, and the payment leg of `EMI-3556`) around one shared callback/reconciliation pattern instead of four near-identical restatements.
6. **Close or merge the thin/superseded stubs**: `EMI-3643` (empty), `EMI-1822` (merge into `EMI-3782`), `EMI-1693` (superseded by `EMI-4625` and per-flow OTP specs), `EMI-2226` (merge into `EMI-2028`), `EMI-89` (mark historical).
7. **Sanity-check `EMI-810`'s blanket geolocation-on-every-request rule** with product/security before it's built as written.
