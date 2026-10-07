# EMI User Story Audit — Archived Epic (`EMI-2337`)

**Scope:** all 31 `Story`-type issues filed under the "Archived" epic, pulled live via `twg jira` on 2026-09-27.

**How to read this doc:** this epic is different from the others in this series. These stories were deliberately moved out of active scope, so the job here isn't to refine AC — it's to audit whether "archived" was the right call for each one. Every story is bucketed into one of four categories below. Only the last two categories (misfiled/active, and lost-but-valuable) get a "why this matters" writeup; the first two are confirmation notes, kept short on purpose.

| Key | Status | Title |
|---|---|---|
| EMI-2742 | To Do | International OTC beneficiary |
| EMI-2230 | To Do | Audit |
| EMI-2229 | To Do | Adjustment reasons logging |
| EMI-2228 | To Do | Validation handling |
| EMI-2227 | To Do | Infinite adjustments |
| EMI-2225 | To Do | Audting |
| EMI-2224 | To Do | Reversal reasons logging |
| EMI-2223 | To Do | Comm. Wallet and VAT reversal handling |
| EMI-2222 | To Do | Linked collection wallets reversal |
| EMI-2221 | To Do | Batch-level reversal |
| EMI-2220 | To Do | Transaction reversal |
| EMI-2029 | To Do | Business registration |
| EMI-1695 | To Do | Comprehensive Transaction Auditing |
| EMI-709 | To Do | Beneficiary management |
| EMI-620 | To Do | Continue Registration |
| EMI-600 | To Do | ERP Registration |
| EMI-199 | To Do | Admin Profile |
| EMI-198 | To Do | Account Statement |
| EMI-193 | To Do | Merchant Management |
| EMI-192 | **Done** | Biller Management |
| EMI-184 | **re-open** | Check Bills |
| EMI-180 | **In Progress** | Biller Bank Transfer |
| EMI-179 | To Do | Biller Top-up |
| EMI-177 | To Do | Transaction Report |
| EMI-173 | To Do | User Profile |
| EMI-164 | Done | Referral Services |
| EMI-125 | To Do | Login |
| EMI-124 | To Do | Login |
| EMI-123 | Done | Biller Registration (OLD) |
| EMI-91 | Done | Cashback |
| EMI-90 | To Do | Admin commission management |

---

## Category 1 — Correctly archived (superseded, safe to leave as-is)

- **EMI-123** (Biller Registration (OLD), Done) and **EMI-2029** (Business registration, To Do) — both are earlier drafts of the biller onboarding flow (Tahaqaq → OTP → Wathiq → AML → Nafath → risk assessment → pending profile → admin approval → wallet + Company Number). Superseded by the live Registration epic's `EMI-3782`/`EMI-122`, which run a more precise sequence (Yakeen → WATHIQ → AML WS1 → Lean → NAFATH) and add resume guardrails and admin Products/Contract tabs neither of these has. No action needed.
- **EMI-620** (Continue Registration) — its session-persistence/resume logic is already covered, more thoroughly, by `EMI-3782`'s "Resume Guardrails" section (72-hour session retention, invalidate-prior-pending-on-finalize). Superseded, no action needed.
- **EMI-709** (Beneficiary management) — describes a manual-KYC path for external bank beneficiaries (IBAN certificate upload + manual phone call to verify). Superseded by the live per-type beneficiary stories (`EMI-2747` Local Bank, `EMI-2748` International Bank), which use automated IBAN validation and bank auto-detection instead. One thing worth a beat of thought before fully writing this off: EMI-709 exists for the case where an IBAN **can't** be auto-validated — the live stories don't describe a manual fallback for that case. Low priority, but flag it if a partner bank ever fails auto-validation in production.
- **EMI-124** / **EMI-125** (both "Login," identical content, one worded for billers and one for merchants — a phone+password+OTP+biometric flow) — superseded by the live Login epic's `EMI-126` (Business Login, Done), which already covers this persona. No action needed.
- **EMI-179** (Biller Top-up via HyperPay) — superseded by the live Cash-in epic's `EMI-171` (Cash-in, Done), which already covers the admin/business persona doing a HyperPay top-up. No action needed.

## Category 2 — Possibly superseded, needs a cross-check against the live Admin/Payments batch (Fork 1's output, `EMI-Refined-User-Stories-part2-admin-payments.md`)

These describe features that plausibly live on in the current "Profiles" (`EMI-2190`) and "Reports" (`EMI-2189`) epics, but I don't have visibility into those stories from this fork — flagging for whoever reconciles the parts of this series.

- **EMI-199** (Admin Profile) and **EMI-173** (User Profile) — both are thin ("display first/last name, email, mobile, last login") and read like an early pass at whatever `EMI-2190` (Profiles) now covers.
- **EMI-198** (Account Statement) and **EMI-177** (Transaction Report) — both describe a transaction-listing screen with search filters and Excel/PDF export; overlap with each other even within the archive (see the note in Category 4 about EMI-192/193 duplication — this project has a recurring pattern of near-duplicate admin-screen stories). Likely superseded by `EMI-2189` (Reports), but worth confirming the "Available/Reserved/Current Balance" columns EMI-198 lists actually got carried forward given the canonical balance model changed since (see the first pass's finding on EMI-602 — these two archived stories still use the old three-bucket vocabulary).

## Category 3 — Ambiguous: no live counterpart found, may be genuinely dropped scope

- **EMI-600** (ERP Registration) — a distinct onboarding path where a user registers using existing ERP-system credentials rather than the normal KYC flow. Nothing in the live Registration epic (`EMI-3782`/`EMI-122`/`EMI-121`) mentions this. This might be intentionally dropped (ERP-based SSO onboarding scrapped), or it might be scope nobody remembered to either build or formally cancel. Worth a two-minute check with product: "did we ever decide not to do ERP-based registration, or did this just fall off the board?"
- **EMI-91** (Cashback, **Done**) and **EMI-164** (Referral Services, **Done**) — both are shipped, working features (per status). Neither has a live epic to attach to: `EMI-4141` (Loyalty & Rewards Engine, the epic that would logically own these) has zero Story-type children anywhere in the project. These aren't lost — they're built and presumably running — but they're **orphaned**: if anyone needs to file a follow-up story (a bug, an enhancement, a new promo-code rule), there's no live epic for it to go under, and a search for "loyalty" or "rewards" work will miss both. Recommend re-parenting both to `EMI-4141` rather than leaving them under "Archived," since "archived" reads as "retired," not "shipped and quietly homeless."

## Category 4 — HIGH PRIORITY: misfiled or actively-worked stories hiding in the archive

This is a process-hygiene problem, not a documentation one — these four stories should not be reachable by browsing "Archived," because people actively rely on epic membership to know what's live.

- **EMI-180** (Biller Bank Transfer) — status is **In Progress**. Someone is building this right now, under an epic whose entire purpose is "not active." This overlaps heavily with the live Cash-out epic's `EMI-172` (Business Wallet Cash-out, Done) — it may be a newer iteration of the same ANB bank-transfer cash-out flow. **Re-parent this to the live Cash-out epic (`EMI-2176`) immediately** — anyone filtering Cash-out work by epic today will not see it, including QA planning coverage.
- **EMI-184** (Check Bills) — status is **re-open**, meaning it shipped, broke, and was reopened. A reopened defect sitting in "Archived" is exactly the kind of item that gets forgotten because nobody looks there for open work. It overlaps with the live E-Bill epic's `EMI-183` (Bill Management, Done) — possibly a duplicate of the approve/reject flow already in EMI-183, or a distinct admin review-queue feature EMI-183 doesn't cover. Either way: **re-parent to E-Bill (`EMI-2178`) and get eyes on why it reopened**, independent of the archive question.
- **EMI-192** (Biller Management, **Done**) and **EMI-193** (Merchant Management, To Do) — a matched pair of comprehensive admin CRUD interfaces (list/filter/create/approve-reject/commission-schema management), one shipped, one not, both filed under "Archived." Meanwhile `EMI-81` (Biller Module) and `EMI-82` (Merchant Module) — the two epics whose names say exactly this — have **zero** Story-type children anywhere in the project. This is almost certainly a misfiled epic link: EMI-192/EMI-193 are very likely the actual content of EMI-81/EMI-82, filed under the wrong parent. **Recommend re-parenting EMI-192 → EMI-81 and EMI-193 → EMI-82** (or the reverse if the naming is swapped) rather than treating either as retired — EMI-192 is describing a feature that, per its Done status, is in production today.

## Category 5 — HIGH PRIORITY: lost scope, more complete than its live epic's stub

This is the most consequential category. In each case, the **live** epic that should own this feature has only a stub (0–1 stories), while a fully-specified version of the same feature sits here, archived and invisible.

### The Reversal/Adjustment/Audit cluster — 11 of the 31 stories in this epic
`EMI-2220` (Transaction reversal), `EMI-2221` (Batch-level reversal), `EMI-2222` (Linked collection wallets reversal), `EMI-2223` (Comm. Wallet and VAT reversal handling), `EMI-2224` (Reversal reasons logging), `EMI-2225` (Audting), `EMI-2227` (Infinite adjustments), `EMI-2228` (Validation handling), `EMI-2229` (Adjustment reasons logging), `EMI-2230` (Audit), plus the related standalone `EMI-1695` (Comprehensive Transaction Auditing).

Together these describe a coherent, well-thought-out reversal engine: eligibility rules per transaction state (Pending/Successful/Failed), a specific wallet-hierarchy reversal order (**User Wallet → Control Wallet → Commission Wallet → VAT Wallet**), no-negative-balance validation, batch-vs-individual-transaction reversal, mandatory reason logging, and a searchable audit trail — this is exactly the kind of financially-critical logic that shouldn't exist only in an archive. Compare this to the live epics: `EMI-2208` (Reversal) has **one** story, `EMI-2209` (Adjustment) has **one** story. The detailed spec is here; the live epic is a stub.

Two more things worth flagging about this cluster specifically:
- It predates the canonical four-bucket balance model from `EMI-602` (see the first pass) — it talks about "unreserve amounts" and "Available Balance" in v1 terms. If this cluster gets un-archived, it needs to be re-derived against `reserve_debit`/`reserve_credit` before it's usable, not copied verbatim.
- `EMI-1695`, `EMI-2225`, and `EMI-2230` are three separate "build an audit trail" stories, all archived, all overlapping each other in scope (general transaction auditing vs. adjustment-specific vs. reversal-specific). If this cluster is un-archived, these three should be merged into one, not three.

**Recommendation:** un-archive this cluster and re-parent it to `EMI-2208`/`EMI-2209`, after reconciling it against the current balance model. This is not "nice to have" documentation — it's the actual spec for how money gets put back when something goes wrong, and right now it's sitting somewhere nobody would think to look for it.

### EMI-2742 — International OTC beneficiary
Fully specified (beneficiary picker, purpose-of-transfer, amount validation, OTP, Western Union integration, callback handling, error handling, 9 test cases) — and it's the **missing fifth beneficiary type**. Recall from the first pass: the live umbrella story `EMI-2600` (Customer beneficiaries, in the Beneficiary Management epic `EMI-2192`) has five numbered AC headings — Wallet, Bank, International Bank, OTC, and **International OTC** — with all five left completely blank, while four of the five types got fully built out as their own live stories (`EMI-2756`, `EMI-2747`, `EMI-2748`, `EMI-2749`). The fifth type never got its own live story. It's here, in the archive, fully written. **Recommend promoting EMI-2742 into the live Beneficiary Management epic (`EMI-2192`) as a sibling of EMI-2747/2748/2749/2756** — this closes exactly the gap the first pass flagged as a blank section in EMI-2600.

### EMI-90 — Admin commission management
A detailed commission-schema data model: transaction type, source/destination wallet, min/max amount bands, media channel, fixed-vs-percentage value type, and an explicit rule that overlapping amount-band periods for the same user should **sum** rather than conflict. This same schema is referenced by both `EMI-192` and `EMI-193` above ("Manage commission schemas," "Commission List" tables with the identical field set), so it's internally load-bearing for at least two other archived stories. The live commission epics are stubs: `EMI-2186` (Commissions) has one story, and `EMI-4133` (Commission Rules Engine, which by name should own exactly this) has **zero**. Same pattern as the reversal cluster: the real spec is archived, the live epic is empty. **Recommend un-archiving alongside EMI-192/193 and re-parenting to `EMI-4133` or `EMI-2186`.**

---

## Suggested next steps

1. **Re-parent the four actively-relevant misfiled stories first** (EMI-180, EMI-184, EMI-192, EMI-193) — this is a five-minute Jira fix with real cost to leaving it (active/reopened work is invisible to anyone browsing by live epic).
2. **Get a product/eng decision on un-archiving the Reversal/Adjustment/Audit cluster and EMI-90** — this is the highest-effort item but also the highest-consequence one; both clusters describe money-movement correctness logic for a live financial product, currently undiscoverable.
3. **Promote EMI-2742** into the live Beneficiary Management epic — small, self-contained, directly closes a known gap from the first pass.
4. **Ask product about EMI-600** (ERP Registration) and confirm EMI-91/EMI-164 get re-parented to `EMI-4141` so shipped features have a home for future work.
5. **Cross-check Category 2** (EMI-199/173/198/177) against whichever fork covers Profiles/Reports, to confirm they're genuinely superseded rather than partially-lost like the items in Category 5.
