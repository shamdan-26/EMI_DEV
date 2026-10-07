# EMI User Story Refinement — Wallet Consistency, PoS, Dormant Wallets & Emerging Modules

**Scope:** 44 Story-type tickets across 13 epics under project EMI: Balances & Wallet Consistency (EMI-5944), PoS Transactions (EMI-5914), PoS (EMI-5823), Products (EMI-5722), Currencies (EMI-5433), Payment Links (EMI-5393), Platform Architecture & Core Infrastructure (EMI-5216), Dormant & Unclaimed Wallets (EMI-5217), Multi-Omnibus (EMI-5004), Fees (EMI-5006), Apps & Portals (EMI-4818), Auth and Login (EMI-4638), Authority matrix (EMI-4634). Pulled live via `twg jira` on 2026-09-27. This is part of a multi-part continuation of `docs/EMI-Refined-User-Stories.md` (the first pass, 14 core customer-facing modules) — read that file first for the overall methodology and the EMI-602 canonical balance model background this part depends on.

**How to read this doc:** same format as the first pass — per-module story table, then a Findings subsection. This batch's quality floor is far higher than the first pass's (no empty stubs; minimum description length ~2,200 characters vs. the 144-character stubs found in the first pass), so the findings here skew toward cross-story consistency and architecture-level contradictions rather than missing content. Coverage note: given the volume (44 stories, several exceeding 15,000 words each with open-item registers and defect logs), the six stories under EMI-5944 and the first four under EMI-5914 got a full line-by-line read; the remaining stories were read for structure, acceptance criteria, and cross-references rather than reproduced in full — flagged individually below where that's the case.

---

## Cross-cutting findings (read this section first)

### 1. The canonical balance model lives on an island — and a competing model already exists, in a re-opened story

The first pass flagged that `EMI-602`'s four-bucket balance model (`available` / `reserve_debit` / `reserve_credit` / `current`) wasn't referenced by the Wallets-module stories reviewed there. This batch lets us check the model's actual reach, and the news is worse than "not yet referenced" — it's actively contradicted:

- **EMI-5944 (Balances & Wallet Consistency) is exemplary.** All six of its stories (EMI-6148, EMI-5954, EMI-5951, EMI-5950, EMI-5946, EMI-5945) explicitly say some version of "this story does not restate or re-derive [the model] — see EMI-602," carry a table of resolved decisions (Q1 ledger append-only, Q2 the exact identity, Q3 the status×direction mapping, Q5 whether `available` may go negative — resolved 2026-08-03, no non-negativity constraint, tolerate and flag instead), and cross-reference each other by ticket number for every shared concept. This is the best-specified epic in either pass so far and should be the house style other epics are brought up to.
- **Every other epic in this batch that moves money never mentions EMI-602, `reserve_debit`, `reserve_credit`, or the four-bucket identity at all** — not PoS Transactions (EMI-5914, which writes ledger entries and credits merchant wallets), not PoS device sub-ledgers (EMI-5823), not Dormant & Unclaimed Wallets (EMI-5217, which transfers wallet balances to an aggregated account), not Multi-Omnibus (EMI-5004).
- **EMI-5005 (Cash-Out Orchestration, Multi-Omnibus Phase 1, status `re-open`) goes further than silence — it explicitly rejects the model.** Its own text: *"We use a source → destination wallet transfer model... No Dr/Cr terminology is used in the system. If the economic meaning is correct, the posting is correct."* It defines its own wallet taxonomy — `USER` / `CONTROL` / `CLEARING` / `EXPENSES` / `REVENUE` / `VAT` — with no mapping to EMI-602's four buckets per wallet, and no mapping either to the `Business` / `Collection` / `Control` / `Master` hierarchy from `EMI-2008` (System Integration epic, covered in the parent fork's batch). That's now **three mutually-unmapped wallet/ledger vocabularies** live in the same project. EMI-5005's `re-open` status means something already went wrong with this design once — worth finding out whether that history is related to which model was in play at the time.

**This is the single highest-value finding across both passes.** Before any more PoS, Multi-Omnibus, or Dormant-Wallet stories are refined, someone needs to decide: is EMI-602's four-bucket model meant to be universal (in which case EMI-5005, EMI-5914, EMI-5217 all need a reconciliation pass), or is it scoped specifically to customer/merchant wallets while omnibus/control-wallet accounting legitimately uses a different model (in which case that boundary needs to be stated explicitly, because right now it reads as an oversight, not a decision)?

### 2. Dormant Wallets doesn't say which balance bucket gets transferred

`EMI-5221` (Transfer unclaimed wallet balances to aggregated account after 24 months) says "System transfers eligible balance from wallet to aggregated account" without saying whether "eligible balance" is `available`, `current`, or excludes an open `reserve_credit`/`reserve_debit`. Given EMI-602's whole point is that these are not interchangeable — money mid-transfer isn't the holder's yet — a dormant wallet with an unsettled incoming payment at the 24-month mark is exactly the case this ambiguity will bite on. None of EMI-5217's 11 stories reference EMI-602 or use its vocabulary.

### 3. A rewritten duplicate of a first-pass story has landed in a different epic — and kept a likely-erroneous rule

`EMI-4637` (User Management and Login Authentication (KSA Mobile Only), under Auth and Login/EMI-4638) explicitly cites `EMI-126` — *Business Login*, reviewed in the first pass under the Login epic (EMI-2174) — as its reference story, and rewrites it into modern Given/When/Then AC. This is a good modernization instinct, but it means there are now **three business-login specifications** in the backlog (EMI-126 legacy, EMI-2599 Customer Login/PIN-based, EMI-4637 modernized-but-different-epic), and the rewrite **preserved without re-examination** the same odd rule the first pass flagged as likely copy-paste boilerplate: AC8 has the system "denying access" and showing "a generic compliance-related error message" for **AML/compliance rejections at login** — the same "AML gates login" pattern that doesn't obviously belong in an authentication flow (AML normally gates transactions or onboarding, not signing in). If this rule really is a template artifact, it has now propagated twice.

### 4. PoS Transactions and PoS are the most rigorously specified stories in the entire backlog — deliberately

EMI-5914's stories (EMI-5991, EMI-5989, EMI-5915, EMI-5916, EMI-5917, EMI-5918, EMI-5919, EMI-5920, EMI-5921, EMI-5922, EMI-5923, EMI-6018) and EMI-5823's (EMI-5824, EMI-5723, EMI-5719, EMI-5718) work from a shared, numbered **open-items register** (`docs/PoS/pos-open-items-register.md`, items O7–O52) and a shared **exception-code taxonomy** (E1–E34+), with cross-story "handover contracts" specifying exactly which fields one story hands to the next. EMI-5991 in particular is a model of how to document an external-system integration honestly: it states plainly which questions are still open (O32 auth mechanism undocumented, O36 delivery format unconfirmed, O43 how refunds ever settle if ANB's contract excludes them, O47 VAT derivation unexplained) and designs the story to be safe under every one of those unknowns (format adapters, assert-don't-filter, whole-file-rejection-not-partial-ingestion) rather than guessing and building on the guess. This is the reference standard — worth pointing future refinement work at these stories as the example, the way EMI-834 (Money request) served that role in the first pass.

The one gap worth flagging: **EMI-6018 (ZATCA e-invoicing for MJD Pay commission)** flags itself — correctly — as possibly mis-parented: *"This story may not belong under the PoS epic. Commission is charged on more than PoS settlement, so the obligation is platform-wide."* This is exactly the kind of self-aware flag that should trigger a re-parenting decision rather than being left as a comment inside the story.

### 5. Open business decisions are stated as such, not disguised as answered

`EMI-5225` (Enforce accounting treatment for aggregated dormant balances) explicitly says "Customer must receive full balance back **with/without recovery fees as company policy defines**" — an unresolved policy question flagged honestly rather than an arbitrary default silently chosen. Same pattern as EMI-6018's Z2–Z5 questions in the first-pass-adjacent finding above. This is good practice and worth preserving as a convention: mark an open business decision as open, don't guess at AC-writing time.

---

## Module: Balances & Wallet Consistency (`EMI-5944`)

| Key | Status | Title |
|---|---|---|
| EMI-6148 | To Do | BE - Gapless Per Wallet Sequence Numbers on running_balance |
| EMI-5954 | To Do | Wallet Daily Close (EOD Open/Close Snapshot & Rebuild Anchor) |
| EMI-5951 | To Do | Stuck Reserve Detection |
| EMI-5950 | To Do | Bucket Identity Validation & Variance Detection |
| EMI-5946 | To Do | Wallet Balance Recompute |
| EMI-5945 | To Do | Statement History Rebuild |

**Findings:** See cross-cutting #1. Internally this module is airtight — every story resolves its open questions on the record (the Q1/Q2/Q3/Q5 decision tables), distinguishes its repair mode from its siblings' (EMI-5946 is the routine, order-independent repair; EMI-5945 is break-glass, used only when per-entry statement rows are wrong, not just the balance endpoint — this split itself resolves a six-month-unanswered question, D1, from EMI-4087), and every story's Definition of Done references the specific test IDs that prove the tricky parts (e.g. EMI-5946's T11: "guards the most commonly misread rule" — `reserve_credit` excluded from `current`). Two minor notes:
- EMI-5951 (Stuck Reserve Detection) references four already-closed defects (EMI-2013, EMI-4591, EMI-5771, plus a QA trail note) as its "why this exists" — good practice, traceable motivation, nothing to fix.
- EMI-5954 (Daily Close) is the single largest and most load-bearing story in this module (its "watermark" concept depends on EMI-6148's gapless sequencing, and EMI-5946/5945 both anchor their repair logic on it) — it would be the highest-risk single point of failure if any one story in this epic slips.

---

## Module: PoS Transactions (`EMI-5914`)

| Key | Status | Title |
|---|---|---|
| EMI-6018 | To Do | ZATCA e-invoicing for MJD Pay commission charged to merchants |
| EMI-5991 | To Do | PTS Retrieval & Parsing - ANB PoS & E-commerce Settlement Report |
| EMI-5989 | To Do | Settlement Grouping, Gate 1 & the Aggregated Cash-In (Payment id) |
| EMI-5923 | To Do | PoS Compliance Gates & Held Funds |
| EMI-5922 | To Do | Omnibus Settlement Transfers - ACH & VIBAN (per settlement batch) |
| EMI-5921 | To Do | PoS Commission Configuration |
| EMI-5920 | To Do | Reconciliation & Three-Way Matching (Payment ID) |
| EMI-5919 | To Do | Void & Technical Reversal |
| EMI-5918 | To Do | PoS Refunds |
| EMI-5917 | To Do | Wallet Payment at Terminal |
| EMI-5916 | To Do | Wallet Crediting & Merchant Visibility |
| EMI-5915 | To Do | Transaction Callback Ingestion & Validation |

**Findings:** See cross-cutting #1 (no EMI-602 reference despite EMI-5916/5917 crediting wallets) and #4 (rigor, and EMI-6018's re-parenting flag). Additional notes from the full read of EMI-5991 and EMI-5915:
- EMI-5991 and EMI-5915 divide responsibility cleanly (EMI-5991 ends at "a validated row," never touches a ledger; EMI-5915 owns the reusable booking pipeline that both it and EMI-5989 invoke) — a good example of a shared-pipeline pattern that avoids the "two implementations drift apart" risk called out repeatedly in the EMI-5944 stories.
- EMI-5915's Gate 1 explicitly does **not** evaluate balance caps or turnover limits ("the entry about to be written is not balance-bearing... the limit is Gate 3's, in EMI-5916") — a deliberate, well-justified design choice, not an oversight, and it's tested for directly (T26, T27). Worth noting as a good example of a non-obvious business rule being defended with reasoning rather than just asserted.
- The refund gap is real and explicitly unresolved: EMI-5915 records that a refund/void captured at a terminal "will never appear in ANB's settlement report" and "nothing downstream will ever debit it," tracked as open item O43. This is flagged consistently across EMI-5991, EMI-5915, and EMI-5920 (as exposure metric E34) — consistent cross-referencing, but it means real money exposure is currently unclosed pending an answer from ANB.
- EMI-5921 (PoS Commission Configuration), EMI-5920, EMI-5922, and EMI-5923 were read for structure/AC but not to the same line-by-line depth as EMI-5991/5915/6018 above, given volume — no contradictions or gaps surfaced in that pass, but a deeper review is warranted before treating this note as a clean bill of health for those four.

---

## Module: PoS (`EMI-5823`)

| Key | Status | Title |
|---|---|---|
| EMI-5824 | To Do | PoS Device Management — Directory, Lifecycle & Per-Device Sub-Ledger |
| EMI-5723 | To Do | PoS Integration — Sister Company & TID Auto-Mapping |
| EMI-5719 | To Do | PoS Order Management — Lifecycle, Tracking & Fulfillment |
| EMI-5718 | To Do | Product Subscription Workflow — PoS |

**Findings:** EMI-5824 was read in detail — it maintains the same rigor as EMI-5914 (per-device sub-ledger, admin-vs-merchant permission split, explicit lifecycle states) and is the story EMI-5945 (Statement History Rebuild, first-pass-adjacent) names as a consumer of the entry sequence it preserves — another example of the good cross-referencing habit in this later cohort. EMI-5723, EMI-5719, and EMI-5718 were read for structure only, given volume; nothing alarming surfaced but they warrant their own pass before being called clean, particularly EMI-5719 (PoS Order Management) at ~75,000 characters — one of the largest single stories across both passes.

---

## Module: Multi-Omnibus (`EMI-5004`)

| Key | Status | Title |
|---|---|---|
| EMI-5009 | To Do | Closed-Loop Routing for Internal Transactions using Largest-Balance Segment |
| EMI-5008 | To Do | Cash-In / Top-Up Orchestration via HyperPay with Default Partner Bank Control |
| EMI-5005 | **re-open** | Cash-Out Orchestration (Multi-Omnibus, Phase 1) |

**Findings:** This is the module cross-cutting finding #1 comes from. EMI-5005 is the priority item here — its `re-open` status combined with its explicit rejection of Dr/Cr terminology and the four-bucket model makes it the single most important story to reconcile before further work. Its own "Phase-1 Invariants" (control wallets never go negative, cash-out principal always sourced from a user wallet unless treasury-funded, no automatic cross-clearing) are internally coherent and clearly written — the problem isn't the story's own logic, it's that the story doesn't acknowledge or reconcile with EMI-602 at all. EMI-5009 (Closed-Loop Routing) picks the "largest available balance" segment as its routing rule and uses the word "available" throughout, but without citing EMI-602's definition of that term — worth confirming it means the same thing here as it does in the canonical model. EMI-5008 (Cash-In/Top-Up Orchestration) was read for structure only; it shares EMI-5005's wallet taxonomy and non-Dr/Cr framing, consistent with the pattern, not an isolated incident.

---

## Module: Auth and Login (`EMI-4638`)

| Key | Status | Title |
|---|---|---|
| EMI-4637 | To Do | User Management and Login Authentication (KSA Mobile Only) |

**Findings:** See cross-cutting #3. This is a re-specification of EMI-126 (Business Login, first pass) into modern Given/When/Then format, sitting under a different epic than the original. Recommend: (a) decide whether EMI-4637 supersedes EMI-126 and close/annotate EMI-126 accordingly, or explicitly scope the two as different personas/portals; (b) confirm with the business whether "AML / compliance-related login rejections" (AC8) is a real requirement or inherited boilerplate — it appears in EMI-126, EMI-245 (Admin Login, first pass), and now EMI-4637, three times, always in an error-handling list, never elaborated on with an actual AML-at-login scenario anywhere in any of the three stories.

---

## Module: Authority matrix (`EMI-4634`)

| Key | Status | Title |
|---|---|---|
| EMI-4632 | To Do | Customizable Authority Matrix Per Account – Independent Groups, Rules & Privileges |

**Findings:** Read for structure only. This is the story the first pass speculated should be linked from EMI-3782/EMI-122's WATHIQ step ("retrieves authorized persons and company parties") — confirmed relevant: EMI-4632 is about per-account configurable Groups/Roles/Privileges for corporate accounts, which is exactly the authority structure a WATHIQ-verified business's "authorized persons" would need to map onto. No cross-reference exists in either direction (neither EMI-3782/EMI-122 mention EMI-4632, nor does EMI-4632 mention the registration flow that establishes who the authorized persons are in the first place). Worth linking explicitly.

---

## Modules read for structure only (no contradictions surfaced, not exhaustively verified)

Given the volume of this batch, the following were reviewed at the level of title, user story, and AC headings rather than full line-by-line detail. None raised an obvious red flag, but none should be treated as having received the same scrutiny as the modules above:

| Module (Epic) | Story | Note |
|---|---|---|
| Products (EMI-5722) | EMI-5656 Products Management | — |
| Currencies (EMI-5433) | EMI-5434 ISO 4217-Compliant Minor Unit Storage | Forward-looking migration story; every EMI-5944 story explicitly says it "aligns to the integer minor-unit model once EMI-5434 lands," so the two are consistent, not conflicting — EMI-5944 is written against today's decimal storage with a known future migration point. |
| Payment Links (EMI-5393) | EMI-5368 Payment Links & QR-Based Entry for Bills, Invoices, and Wallets | Likely overlaps with EMI-3545 (Dynamic QR) and EMI-590 (QR payment) from the first pass — same "amount QR" concept described a third time in a third epic. Worth the same consolidation recommendation as the first pass's QR finding. |
| Platform Architecture & Core Infrastructure (EMI-5216) | EMI-5367 Architecture Analysis & Implementation Alignment | — |
| Fees (EMI-5006) | EMI-5007 Bank-to-Bank Fee Matrix Management | — |
| Apps & Portals (EMI-4818) | EMI-4819 Super App/Portal | — |

---

## Suggested next steps

1. **Resolve the three-way wallet-model split first** (EMI-602 four-bucket vs. EMI-2008 hierarchy vs. EMI-5005's USER/CONTROL/CLEARING/EXPENSES/REVENUE/VAT model) — this blocks correctly refining EMI-5005, EMI-5008, EMI-5009, EMI-5217, and arguably all of EMI-5914/EMI-5823 since they write ledger entries without citing any of the three models explicitly.
2. **Investigate why EMI-5005 is re-opened** — if it's related to the ledger-model ambiguity above, that's the same fix; if it's unrelated, it still needs its own root-cause note (same convention as EMI-242 in the first pass).
3. **Decide EMI-4637 vs. EMI-126's relationship**, and settle whether "AML rejects login" is a real rule before it propagates a third time.
4. **Re-parent EMI-6018** (it already flags itself) and answer its Z2–Z5 questions with Finance/Tax before its AC is finalized.
5. **Cross-link EMI-4632 (Authority matrix) with the Registration flow** (EMI-3782/EMI-122's WATHIQ authorized-persons step) — same-concept, unlinked pattern seen elsewhere in both passes.
6. When continuing to the remaining epics, the modules flagged "read for structure only" above (EMI-5723, EMI-5719, EMI-5718, EMI-5656, EMI-5367, EMI-5007, EMI-4819) deserve a full pass before being called reviewed.
