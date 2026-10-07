# EMI User Story Refinement — System Integration, Core System, Reconciliation Management System

**Scope:** 38 stories under 3 epics (EMI-2 System Integration, EMI-79 Core System, EMI-2177 Reconciliation Management System / RMS), pulled live via `twg jira` on 2026-09-27. This is part of the wider pass across the 67 EMI epics not covered by `EMI-Refined-User-Stories.md` (the original 14 core customer-facing modules).

**How to read this doc:** same convention as the original — per-module story table, then a Findings subsection (gaps, contradictions, duplication, security issues, stale formatting), refined rewrites where a story is too thin to be useful, and a top-level Cross-cutting findings section for anything that spans modules. **Read the first finding below before anything else in this document — it's a live security issue, not a documentation note.**

---

## Cross-cutting findings (read this section first)

### 1. 🔴 Plaintext credentials are pasted directly into Jira ticket descriptions — across at least 8 stories, all in EMI-2 (System Integration)

This is a live security exposure, not a documentation gap. The following tickets contain real-looking API keys, client secrets, webhook secrets, or bearer tokens typed directly into the ticket **description** (not an attachment, not a comment — the description body itself, which is visible to the entire EMI project):

- `EMI-5496` (Lean Tech - IBAN Verification) — staging Application ID, Client Secret, and Webhook secret in plaintext.
- `EMI-564` (ERP Integration) — a bearer/auth token under "Staging Credentials" **and the identical token repeated verbatim under "Production Credentials."** Either this is a real credential pasted twice, or someone copy-pasted staging into the production placeholder — either way it needs a human to confirm which environment it actually authenticates against before anyone trusts the "Production" label.
- `EMI-77` (SMS gateway Integration / Taqnyat) — `taqnyat.app.token` value in plaintext.
- `EMI-73` (Hyper Pay Integration) — **both staging and production** bearer tokens and Entity IDs (Visa/Mastercard, Mada, Apple Pay) for the live payment gateway.
- `EMI-13` (Nafath Integration) — staging **and** production App ID + App Key for the government identity API.
- `EMI-5` (Wathiq Integration) — production App Key for the CR-lookup government API.
- `EMI-4` (Tahaqaq Integration) — production App ID, App Key, Service Key, and Organization number for the Yakeen identity-verification API.
- `EMI-3` (ANB Bank Integration) — UAT Client ID and Client Secret for the bank integration, plus real-looking test account numbers.

`EMI-5766` (Mozn Fraud) is the one story in this epic that gets this right — it explicitly says *"Keys are sensitive — do not paste values into comments"* and keeps credentials in an attached archive instead. The other eight stories don't follow that rule.

**This needs to be treated as a credential-exposure incident, not a backlog cleanup item:**
1. Every credential named above should be treated as compromised and rotated, starting with the ones with no expiry shown (Nafath, Wathiq, Tahaqaq/Yakeen production keys) and the payment gateway (HyperPay production).
2. The plaintext values should be removed from the ticket descriptions (edit history in Jira may still retain them — check whether that needs separate handling).
3. Given this is a recurring pattern rather than one mistake, it's worth a one-line addition to whatever story template exists for integration work: *"Credentials go in the secrets manager / a restricted attachment, never in the ticket body."* EMI-5766 already models the right behavior — point authors at it.

I have deliberately not reproduced any of the actual secret values in this document.

### 2. A third independent definition of the wallet balance bucket model — none of the three reference each other
The original pass (`EMI-Refined-User-Stories.md`, cross-cutting finding #1) flagged that `EMI-602`'s canonical **four-bucket** model (`available` / `reserve_debit` / `reserve_credit` / `current`) wasn't referenced by other Wallets-module stories, which were still using an older **three-bucket** model (Available/Reserved/Current).

This batch finds a **third, independently-defined** balance model, with yet different field names, inside `EMI-5766` (Mozn Fraud / FOCAL integration): `available` / `pending_credit` / `reserved`. It maps conceptually to EMI-602's v2 model (`pending_credit` ≈ `reserve_credit`, `reserved` ≈ `reserve_debit`) but uses different names, has no `current` field, and does not cite EMI-602 at all — despite EMI-602 explicitly stating *"This is the single definition — no other story may restate or re-derive it."*

Making this worse: `EMI-3769` (TANFEETH — the story that exposes account data **to the SAMA regulator**) requires an endpoint that returns *"Current Balances (Available, Reserved and Current)"* — the **superseded v1 three-bucket model**, by name, in a regulatory-reporting integration. If EMI-602's v2 model is the one actually implemented, this regulator-facing endpoint is specified against the wrong/stale model. This is higher-stakes than the Wallets-module version of this finding, because it's a compliance-facing API, not an internal screen.

**Suggested action:** whoever owns EMI-602 needs to (a) update EMI-5766 and EMI-3769 to use the canonical field names or explicitly document the mapping, and (b) confirm EMI-3769's TANFEETH endpoint is being built against the current (v2) model before it ships to SAMA.

### 3. The "rebuild running balance from the transaction log" job is specified three times, in three different epics, without cross-reference
The exact same job — archive existing running-balance rows, find the last valid balance before a `from_date`, replay transactions via Kafka/Debezium to rebuild — appears near-verbatim in:
- `EMI-602` (Wallet Running Balance, Wallets module) — where it's explicitly marked *"Superseded by EMI-5945 (Statement History Rebuild) and EMI-5946 (Wallet Balance Recompute)."*
- `EMI-4537` (Reconciliation, **Done**, this module) — same trigger, same parameters (`from_date`, `to_date`, `triggered_by`), same four-step flow, no mention of EMI-5945/5946.
- `EMI-4551` (Reconciliation Run Execution & Report Generation, **To Do**, this module) — again describes rebuilding running balances as part of the reconciliation run engine.

Three tickets across two epics independently describing the same rebuild mechanism, one of which has already been told it's superseded by two other tickets that neither of the other two mentions. This is a real risk of two teams (Reconciliation vs. Wallets/Balances) building two different rebuild implementations that both write to `running_balance`. Needs one owner and one implementation, referenced from all four/five tickets (EMI-602, EMI-4537, EMI-4551, EMI-5945, EMI-5946).

### 4. Duplicate "Wathiq Integration" story
`EMI-5` (Wathiq Integration, Done) and `EMI-3247` (Wathiq integration, Done) are the same integration — both fetch CR/company data from Wathiq by CRN, both Done, both under EMI-2. `EMI-3247` is the more complete of the two (adds National Address retrieval, retry/error-handling detail). Worth confirming whether `EMI-5` was the original MVP and `EMI-3247` its follow-up enhancement (in which case link them and close `EMI-5`'s AC as absorbed), or whether these are genuinely two teams building the same integration independently.

### 5. `EMI-2177` (Reconciliation Management System) is internally excellent — the strongest-specified epic reviewed across both passes so far
Every story under this epic (`EMI-4551`, `EMI-4550`, `EMI-4549`, `EMI-4543`, `EMI-4542`, and presumably `EMI-4541`/`EMI-4540` which follow the same pattern) is Gherkin-style, cross-references its sibling stories by name (Pair Management explicitly says it depends on System Types & Unified Schema and Systems Management), states in/out of scope, and includes QA-ready test scenario tables. This is worth using as the reference template alongside `EMI-834` (Money request, from the original pass) when uplifting weaker modules. The one gap: none of these RMS stories cross-reference `EMI-602`'s canonical balance model even though `EMI-4537`/`EMI-4538` both talk about rebuilding `running_balance` and validating wallet balances — see finding #3 above.

### 6. `EMI-79` (Core System) is almost entirely legacy-template infra stories with non-testable AC
`EMI-105`, `EMI-94`, `EMI-92`, `EMI-88`, `EMI-86`, `EMI-85`, `EMI-84` (Proxying Service, Modularity/Lazy Loading, Kafka, Logging, Translation, Service Discovery, Gateway Integration) are all Done, all from an early documentation era, and all have AC like *"the system should allow for efficient data transportation"* or *"should significantly improve the application's performance"* — not testable, no numbers, no pass/fail criteria. These are foundational infra pieces most other epics implicitly depend on (every AML/Nafath/Wathiq story in EMI-2 presumably flows through the Gateway and Service Discovery described here), so it's reasonable that they were written loosely and shipped long ago. Not worth rewriting retroactively unless one of them is about to be touched — flagging for awareness rather than recommending immediate action, per the "legacy vs. current template" pattern already noted in the first pass.

---

## Module: System Integration (`EMI-2`) — 22 stories

| Key | Status | Title |
|---|---|---|
| EMI-5766 | To Do | Mozn Fraud (FOCAL integration) |
| EMI-5496 | To Do | Lean Tech - IBAN Verification |
| EMI-4175 | To Do | Wallet Providers Integration (Inbound/Outbound Transfers) |
| EMI-4174 | To Do | Cross-Border Payment Network Integration |
| EMI-4173 | To Do | FXaaS Integration (Rates & Booking) |
| EMI-4172 | To Do | Exchange Network Integration |
| EMI-4171 | To Do | BIN Sponsor Integration (Cards) |
| EMI-4170 | To Do | CRM Integration |
| EMI-3769 | To Do | TANFEETH (SAMA regulatory reporting) |
| EMI-3247 | Done | Wathiq integration |
| EMI-2888 | Done | Implement Virtual IBAN Generation for ANB Bank |
| EMI-570 | Done | Expose Attachment Services |
| EMI-567 | Done | Expose System Lookps |
| EMI-564 | To Do | ERP Integration |
| EMI-194 | Done | External Party (API key management UI) |
| EMI-77 | Done | SMS gateway Integration |
| EMI-73 | Done | Hyper Pay Integration |
| EMI-14 | Done | AML Integration |
| EMI-13 | Done | Nafath Integration |
| EMI-5 | Done | Wathiq Integration |
| EMI-4 | Done | Tahaqaq Integration |
| EMI-3 | Done | ANB Bank Integration |

**Findings:**
- See cross-cutting #1 (credential exposure — 8 of these 22 stories), #2 (FOCAL's independent balance model + TANFEETH's stale model reference), #4 (Wathiq duplicate).
- `EMI-5766` (Mozn Fraud) is the single best-specified story in this epic — full decision model (APPROVE/REVIEW/REJECT), a per-transaction-type playbook table (which balance bucket to hold, when to call FOCAL, key asymmetry between inbound/outbound screening timing), and a checklist-style AC. It should be the template other integration stories in this epic follow, both for rigor and for its correct handling of credentials (attachment, not inline).
- `EMI-2888` (Virtual IBAN Generation for ANB Bank, Done) and the VIBAN generation notes inside `EMI-3` (ANB Bank Integration, Done) both define the **same IBAN format** (`SAxx30100766xxxxxxxxxxxx`) with the same fixed segments — reasonable to keep as one is the "how" and the other the "integration," but they should explicitly reference each other. More importantly, this format is the vIBAN scheme that `EMI-3637` (Wallet code, in the Wallets module, original pass) explicitly says should be **replaced** by the new wallet-code scheme — three stories now touch the vIBAN format question (EMI-2888, EMI-3's notes, EMI-3637) without agreeing on whether vIBAN survives as the primary identifier or becomes a legacy external-only field. Same underlying contradiction as cross-cutting finding #2 in the original pass, just with more evidence now.
- `EMI-3769` (TANFEETH) is very thin for a regulatory-reporting story — four bullet points ("Expose get All profiles endpoint," etc.) with no AC beyond "expose the endpoint," no field-level spec, no auth/access-control statement for who at SAMA or internally can call it, and (per cross-cutting #2) references the wrong balance model. Given this feeds a regulator, it deserves the same rigor as EMI-5766 or EMI-4551, not four bullets and "refer to attached documents."
- `EMI-4171` (BIN Sponsor Integration) correctly distinguishes Pre-Funded vs. JIT funding models and is well-specified, but doesn't cross-reference `EMI-4134` (Card program manager, an epic with zero Story-type children found in this pass — see Suggested next steps) or the Card management stories from the original pass (`EMI-2605` Card Issuance, `EMI-2730` Card Details) even though BIN sponsor integration is clearly the backend for card issuance/authorization those stories assume exists.
- `EMI-4175`/`EMI-4174`/`EMI-4172` (Wallet Providers / Cross-Border / Exchange Network integrations) are three separate but structurally identical outbound-transfer stories (validate → debit/reserve → call partner → await callback → settle or refund), each targeting a different partner (STC Pay, Thunes, Western Union). This mirrors the Cash-out module pattern already flagged in the original pass (EMI-4152/EMI-4151/EMI-2603 in Cash-out look like the front-end/business-flow versions of these same three integrations). Worth confirming these four stories (two per partner — one integration-layer, one user-facing flow) are meant to be paired 1:1, and cross-referencing them explicitly so a change to the retry/refund policy is applied consistently across both layers.
- `EMI-194` (External Party, admin API-key management UI) has no rate-limiting or key-rotation-reminder AC despite `EMI-570`/`EMI-567` (Expose Attachment Services / Expose System Lookups) both requiring "secure access through API Key and ClientID" — the keys this story manages are presumably what gates access to those two. Worth an explicit link.

---

## Module: Core System (`EMI-79`) — 7 stories

| Key | Status | Title |
|---|---|---|
| EMI-105 | Done | Proxying Service for Legacy Integration |
| EMI-94 | Done | Modularity (Angular lazy loading) |
| EMI-92 | Done | Real-time Data Processing with Apache Kafka |
| EMI-88 | Done | Logging Implementation (auth events) |
| EMI-86 | Done | Translation for Multilingual Support |
| EMI-85 | Done | Service Discovery for Microservices |
| EMI-84 | Done | Integrate Gateway |

**Findings:** see cross-cutting #6 — all seven are legacy-template, non-testable infra stories. No individual story-level findings beyond that; flagging as a set rather than one by one, since the fix (if any is warranted) is the same for all seven and none of them show signs of an active bug or contradiction.

---

## Module: Reconciliation Management System (`EMI-2177`) — 9 stories

| Key | Status | Title |
|---|---|---|
| EMI-4551 | To Do | Reconciliation Run Execution & Report Generation |
| EMI-4550 | To Do | Ingestion Configuration & Data Mapping |
| EMI-4549 | To Do | System Types & Unified Schema Management |
| EMI-4543 | To Do | Systems Management |
| EMI-4542 | To Do | Pair Management (PM) |
| EMI-4541 | To Do | Reconciliation Rules Engine |
| EMI-4540 | To Do | Internal RMS |
| EMI-4538 | To Do | Dynamic Reconciliation Management System (DRMS) |
| EMI-4537 | Done | Reconciliation |

**Findings:**
- See cross-cutting #3 (rebuild-job triplication) and #5 (this epic is the strongest-specified in the whole review so far).
- `EMI-4538` (DRMS, To Do) reads as an **architecture overview** of the whole RMS product — it introduces the Rules Engine, Systems & Ingestion Management, Pair Management, External/Internal Reconciliation, and Cross-System Analysis as concepts, each of which then has its own dedicated story (EMI-4541, EMI-4550/4543, EMI-4542, EMI-4537, respectively). It's unclear whether EMI-4538 is meant to stay open as a living index/overview ticket or should be closed once its child concepts are each captured in their own story — right now it substantially restates content that lives in more detail elsewhere in the same epic. Worth clarifying its intended lifecycle (index ticket vs. its own deliverable) so it doesn't drift from the stories it describes.
- `EMI-4537` (Reconciliation, Done) and `EMI-4538` (DRMS, To Do) overlap heavily — both describe Reporting-vs-System function categorization, the same three integrity tables to protect (`transaction_log`/`data sources`, `running_balance`, `wallets`), and the same compliance references (Stripe, Temenos, SOX, ISO 8583). EMI-4538 reads like a broader/renamed re-scope of EMI-4537 (adding multi-entity reconciliation, not just bank) rather than a distinct feature — worth confirming EMI-4538 supersedes EMI-4537 rather than the two being maintained as parallel, overlapping specs.
- No story in this epic references `EMI-4133` (Commission Rules Engine) even though reconciliation pairs like "HyperPay ↔ ANB" and the mismatch-detection dimensions (amount, status, date) would need to account for commission/VAT postings to reconcile correctly — worth checking whether commission legs are in scope for RMS v1 or explicitly deferred.

---

## Suggested next steps

1. **Treat cross-cutting finding #1 (credential exposure) as urgent** — rotate the named credentials, strip them from the ticket descriptions, and add a one-line "secrets go in a vault/attachment, not the description" note to whatever template integration stories use going forward.
2. **Resolve the balance-model fragmentation once, centrally** (cross-cutting #2 + #3) — this is now the third and fourth independent restatement of wallet balance/rebuild logic found across two passes (EMI-602 v1→v2, EMI-5766's FOCAL model, EMI-4537/EMI-4538's rebuild job, EMI-3769's stale regulator-facing reference). One canonical doc, referenced everywhere, before more stories restate it a fifth time.
3. **Clarify EMI-4538 vs EMI-4537's relationship** and whether EMI-4538 is a living overview or a superseding respec.
4. **Confirm EMI-5 vs EMI-3247** (duplicate Wathiq integration) — likely just needs a "duplicates" link and one closed as absorbed.
5. Two epics originally assigned to this pass — `EMI-81` (Biller Module) and `EMI-82` (Merchant Module) and `EMI-83` (Customer Module) — turned out to have **zero** Story-type children when queried directly; noting this so whoever tracks epic coverage knows these top-level module epics are placeholders/containers rather than epics with their own stories (work under "Biller"/"Merchant"/"Customer" appears to live in the feature-specific epics instead, e.g. Cash-in, Cash-out, Wallets).
