# EMI Business Knowledge — Index

A full pass over every Story-type ticket in the EMI Jira project (project = EMI), grouped by module (Epic Link/parent). ~264 stories reviewed across all 81 epics, in two layers:

- **Findings documents** (`EMI-Refined-User-Stories*.md`) — the critique layer: gaps, contradictions, duplicates, empty stubs, security red flags. Read these to decide what needs fixing.
- **Business-rules documents** (`EMI-Business-Rules*.md`) — the reference layer: what the business actually does, extracted per module/story as usable documentation, not critique. Read these to understand how a feature is supposed to work.

The two layers are paired 1:1 by suffix (`part2` ↔ `part2`, etc.) and cover the same epics. Nothing here has been written back to Jira — these are discussion/reference drafts distilled from the live tickets; treat Jira as the source of truth for exact wording and re-check before automating against a rule stated here.

## Findings documents (critique layer), in the order they were produced

| File | Scope | Stories |
|---|---|---|
| `EMI-Refined-User-Stories.md` | Pass 1 — the 14 modules this repo automates: Registration, Login, Cash-in, Cash-out, E-Bill, Bill payment, Beneficiary Management, W2W Transfer, Merchant payment, Wallets, Money request, QRs, Card management | 54 |
| `EMI-Refined-User-Stories-part2-admin-payments.md` | Payments, Users, Configuration, CMS, Service providers, Commissions, Limitations, Reports, Profiles, Passwords, Notifications, Dashboard/Home | 52 |
| `EMI-Refined-User-Stories-part3-system-core.md` | System Integration, Core System, Reconciliation Management System | 38 |
| `EMI-Refined-User-Stories-part4-archived.md` | The "Archived" epic — audited for misfiled/lost scope vs. correctly retired work | 31 |
| `EMI-Refined-User-Stories-part5-compliance-emerging.md` | Partner bank, BIN Sponsorship (both variants), FX Trading, SDK, Open Banking, SADAD EBPP, ACH, Validations, R&D, Enhancements, Errors, Adjustment, Sessions, Reversal, Under Review, Verifications, Devices, Jobs, Cryptography, UI/UX, Authentication | 45 |
| `EMI-Refined-User-Stories-part6-wallet-pos-emerging.md` | Balances & Wallet Consistency, PoS Transactions, PoS, Products, Currencies, Payment Links, Platform Architecture, Dormant & Unclaimed Wallets, Multi-Omnibus, Fees, Apps & Portals, Auth and Login, Authority matrix | 44 |

## Business-rules documents (reference layer) — same scope as the table above, one per part

| File | What it's the reference for |
|---|---|
| `EMI-Business-Rules-part1-core-modules.md` | The canonical wallet balance model (EMI-602, four buckets), the wallet hierarchy (EMI-2008), and the full Registration → Login → Cash-in/out → Beneficiary → Transfer → Wallets → Money request → QR → Card flow for the 14 core modules |
| `EMI-Business-Rules-part2-admin-payments.md` | Payment lifecycle (draft/outbox vs. append-only ledger), the transaction-limitations gate engine, the RBAC model (Groups↔Roles), card JIT authorization rules, profile status lifecycle |
| `EMI-Business-Rules-part3-system-core.md` | The fraud/FOCAL decision model, Lean/Wathiq/Nafath/Yakeen/AML integrations (purpose only, no credentials), FX booking, BIN sponsor funding models, the five-part reconciliation engine architecture |
| `EMI-Business-Rules-part4-archived.md` | The reversal/adjustment/audit engine design, the 5th (international OTC) beneficiary type, the commission schema definition — real business logic recovered from the archive |
| `EMI-Business-Rules-part5-compliance-emerging.md` | BIN Sponsorship (both card-funding models — one with correct CVV/token handling), Transaction Adjustment's decision log, ACH, FX Trading, SDK/Open Banking integration shape |
| `EMI-Business-Rules-part6-wallet-pos-emerging.md` | The PoS three-gate compliance framework, Dormant & Unclaimed Wallets rules, the Multi-Omnibus/Cash-Out Orchestration account taxonomy (a second ledger vocabulary, documented as-written) |

14 epics have no Story-type children at all (mostly the "emerging/future" placeholders — Core wallet engine, Commission Rules Engine, Card program manager, Payment Orchestrator, KYC/KYB, iPaaS, EBPP, Loyalty & Rewards Engine, Notification Center, DMS, a second CMS entry, Generic admin tools, Authentication & Verification, and the top-level Biller/Merchant/Customer Module epics EMI-81/82/83). That emptiness is itself a finding — see "Lost or misfiled scope" below.

---

## Master cross-cutting findings (deduplicated across all six files)

Ranked by what needs attention first.

### 🔴 Needs action now, independent of any documentation cleanup

1. **Real credentials are pasted directly into Jira ticket descriptions.** 8 stories under System Integration (EMI-5496, EMI-564, EMI-77, EMI-73, EMI-13, EMI-5, EMI-4, EMI-3) contain live API keys, client secrets, webhook secrets, and bearer tokens for HyperPay, Nafath, Wathiq, Yakeen, ANB Bank, Lean, the SMS gateway, and the ERP integration — staging *and* production. EMI-564 repeats the same token under both environments. Only EMI-5766 does this correctly (points to a restricted attachment, explicitly warns against pasting keys). **Treat every named credential as compromised and rotate it.** *(part3)*
2. **A universal test-account OTP bypass code is documented in a broadly-readable ticket.** EMI-4225 states the bypass code (`952829`) in plain text. If this code works outside the test environment it's a live backdoor; if it's test-only, the ticket still shouldn't state it in the open. *(part2)*
3. **Card issuance has a hardcoded, shared default PIN and returns unmasked CVV.** EMI-2605 (Done) issues every card with the same default PIN, "1234." EMI-2730 (To Do) specifies the backend returning the full, unmasked CVV to the client on request — a PCI DSS problem regardless of client-side biometric gating. *(pass 1)*
4. **A manual money-adjustment endpoint has no idempotency key and no maker-checker approval.** EMI-2219 (otherwise the best-written story in the whole project — it's the only one with a tracked, numbered open-decisions log) flags this itself in decisions D3/D4. This is a live financial-control gap, not a documentation gap. *(part5)*

### 🟠 Architectural decisions blocking correct spec work

5. **The balance/ledger model has fractured into at least four incompatible vocabularies across the project**, and this is the single most recurring finding across every pass:
   - **EMI-602** is the canonical model (four buckets: `available`/`reserve_debit`/`reserve_credit`/`current`, append-only ledger, explicit pair-adjustment unwind) and says outright that no other story may restate or re-derive it.
   - Most Wallets-module stories in pass 1 (EMI-4577, EMI-4150, EMI-4153/4154, EMI-2213, EMI-2049/2050) never adopt it — they use the generic, superseded three-bucket idea.
   - **EMI-5766** (Mozn Fraud, part3) independently invents its own `available/pending_credit/reserved` naming.
   - **EMI-3769** (TANFEETH — the SAMA regulatory-reporting integration, part3) specifies exposing "Available, Reserved, Current" — the *exact* model EMI-602 superseded. A regulator-facing endpoint may be built against the wrong model.
   - **EMI-5217** (Dormant & Unclaimed Wallets, part6) moves balances into an aggregated account without citing EMI-602 or its bucket names at all.
   - **EMI-5005** (Cash-Out Orchestration / Multi-Omnibus, re-opened, part6) and its siblings EMI-5007/EMI-5008/EMI-5009 explicitly reject the model — the epic's own text says "no Dr/Cr terminology is used" — and define a *third* wallet taxonomy (USER/CONTROL/CLEARING/EXPENSES/REVENUE/VAT) layered on top of EMI-2008's hierarchy from pass 1. **EMI-5008 then contradicts its own epic**: its worked pseudocode uses `Dr`/`Cr` labels directly, despite the explicit "no Dr/Cr" rule stated elsewhere in the same set of stories — this one needs a decision even within its own epic, before it's reconciled against EMI-602.
   - **EMI-2028** (Transaction Reversal, part5) still uses a pre-EMI-602 single-posting model and needs reconciling against EMI-602 and EMI-2219's four-bucket pair-adjustment unwind before it's built.
   - Only **EMI-5944** (Balances & Wallet Consistency, part6) applies EMI-602 correctly and disciplined — every one of its six stories cites EMI-602 explicitly.

   **This needs one owner and one decision, not six independent fixes.** Whoever owns EMI-602/EMI-2008 should be the arbiter for all of the above.

6. **Wallet identifier model contradicts itself.** EMI-3637 says the wallet code replaces vIBAN as the primary identifier (vIBAN becomes an external-only field); EMI-2213 says the wallet code must *match* the vIBAN. Can't both be true. *(pass 1)*

7. **Three competing card-issuance architectures exist with different security postures.** Pass 1's EMI-2604 (default PIN, unmasked CVV — see #3 above), part5's EMI-3106 (its EMI-3137 does it *correctly*: one-time token, no persisted unmask), and EMI-4194. One of these should be the real spec; the others should be closed or explicitly marked as superseded. *(pass 1 + part5)*

8. **The "rebuild running balance from the ledger" job is independently specified three times** (EMI-602, EMI-4537 [Done], EMI-4551 [To Do]) across two epics — real risk of two teams shipping two divergent implementations of the same recovery job. *(part3)*

9. **A mechanism that cannot work as written**: EMI-2032 relies on Debezium detecting row *updates* on the ledger table for CDC purposes, but EMI-602 declares that table append-only (no UPDATEs, ever). *(part2)*

### 🟡 Duplication — a process gap, not isolated oversights

10. **Persona-duplicate stories** (near-identical content under two tickets, one per persona) recur throughout: Registration (EMI-3782/EMI-122/EMI-121), Login (EMI-2599 vs EMI-4625 — these also *conflict*, not just duplicate, see #12), W2W Transfer (EMI-4281/EMI-529), Cash-in/Top-up (EMI-171/EMI-2049), Cash-out (EMI-172/EMI-2050). *(pass 1)*
11. **The admin/payments batch alone has 11 duplicate story pairs/groups across just 12 modules** — the highest density found anywhere — including EMI-182 and EMI-174 ("Change Password"), which are byte-for-byte identical text filed under two separate keys. This density suggests a process gap (no duplicate-check before filing) rather than one-off copy-paste. *(part2)*
12. **Login has been specified three separate times with no reconciliation**: EMI-2599 (PIN-first + biometric, pass 1), EMI-4625 (OTP-mandatory + device-trust, SAMA-mapped, pass 1), and EMI-4637 (part6) — an explicit rewrite of EMI-126 that carries forward the same unverified "AML blocks login" line flagged as likely boilerplate in pass 1, now propagated a second time.
13. Other duplicate pairs: EMI-5 / EMI-3247 ("Wathiq Integration," both Done, part3); EMI-2756 / EMI-2746 (near-identical beneficiary-picker stories, pass 1).
14. **The same 10-column "transaction row" shape is independently restated six times** across the admin/payments batch alone. *(part2)*

### 🟢 Lost or misfiled scope — archive and epic-link hygiene

15. **A fully-specified 11-story reversal/adjustment/audit engine (EMI-2220–2230, EMI-1695) sits archived** while the live epics that should own this (EMI-2208 Reversal, EMI-2209 Adjustment) each have exactly one empty-ish stub story. This is real, unshipped money-correctness logic that's currently undiscoverable by anyone browsing the live backlog. It predates EMI-602 and would need reconciling before reuse, but it should not be lost. *(part4)*
16. **EMI-2742 (International OTC beneficiary)** — the missing 5th beneficiary type that pass 1 flagged as a blank heading in the live EMI-2600 umbrella story — is fully specified, just stuck in the archive. *(part4)*
17. **EMI-90** (admin commission-management schema) is similarly archived in detail while the live Commissions epic (EMI-2186) has one story and Commission Rules Engine (EMI-4133) has zero. *(part4)*
18. **Two stories are archived but not actually retired**: EMI-180 (status: In Progress) and EMI-184 (status: re-open) — live/reopened work invisible to anyone browsing the active Cash-out/E-Bill epics because of a stale epic link. *(part4)*
19. **Epic-link hygiene elsewhere**: EMI-192/EMI-193 almost certainly belong under EMI-81/EMI-82 (Biller/Merchant Module, both otherwise empty) rather than wherever they're filed now (part4); EMI-4935 (Multi-Omnibus Routing) sits under "Partner bank" instead of "Multi-Omnibus" (part5); EMI-3780 (Reconciliation Auto-Action, itself an empty stub) sits under "R&D" instead of Reconciliation (part5); EMI-6018 (ZATCA e-invoicing) self-flags as likely mis-parented under PoS when commission is platform-wide (part6).

### Empty stub stories (4 total, no content beyond a heading)

EMI-2743 (pass 1), EMI-4161 (pass 1), EMI-3780 (part5), EMI-3643 (part5).

### Re-opened stories (4 total — the one status flag that means "this regressed after shipping")

EMI-242 (pass 1), EMI-195 (part2), EMI-1978 (part5), EMI-810 (part5). None of the four currently have AC specific enough to say what regressed or how to prevent it recurring.

### Reference-quality stories (use these as the template when uplifting weaker ones)

EMI-834 Money request (pass 1), EMI-2177 Reconciliation Management System (part3), EMI-5914/EMI-5823 PoS Transactions/PoS (part6), EMI-87/EMI-6031/EMI-1646 in the Payments epic (part2), EMI-2219 Transaction adjustment (part5 — best-written story in the project, but see finding #4 above).

---

## Suggested prioritization

1. **Rotate the exposed credentials** (finding #1) and pull the bypass-code ticket out of general visibility (#2) — these are live security exposures, today, independent of anything else in this doc set.
2. **Get a security/compliance owner to rule on card issuance** (#3, #7) before EMI-2730 or any Card module work ships.
3. **Get one owner to arbitrate the balance-model fracture** (#5) — this blocks correct spec work in Wallets, Dormant Wallets, Multi-Omnibus/Cash-Out Orchestration, Reversal, and the SAMA regulatory-reporting integration simultaneously.
4. **Resolve the wallet-identifier contradiction** (#6) and the **card-issuance architecture question** (#7) with the Core wallet engine owner.
5. **Un-archive and re-triage** the reversal/adjustment engine, the missing beneficiary type, and the commission schema (#15–17) — real work, currently invisible.
6. **Root-cause the four re-opened stories** (#242, #195, #1978, #810) and turn their AC into something that would have caught the regression.
7. **Introduce a lightweight duplicate-check step** before filing new stories, given the density in finding #11 — this looks systemic, not incidental.
