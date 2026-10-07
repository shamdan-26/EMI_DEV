# EMI User Story Refinement — Part 2: Payments, Profiles, Limitations, Notifications, Service Providers, Dashboard/Home, Users, Passwords, Configuration, Commissions, Reports, CMS

**Scope:** 12 modules / 52 stories under the EMI Jira project, pulled live via `twg jira` on 2026-09-27. This is a continuation of `EMI-Refined-User-Stories.md` (Part 1, the 14 customer-facing modules) — same methodology, same bar. Modules = Epics (Epic Link/parent).

**How to read this doc:** each module has (1) its story list, (2) findings — gaps, contradictions, duplication, empty stubs, security/compliance flags, legacy-vs-current-template gaps, missing cross-references. Nothing here has been written back to Jira; this is a discussion draft.

---

## Cross-cutting findings (read this section first)

This batch surfaced the two most consequential findings of the whole refinement effort so far — both bigger than anything in Part 1.

### 1. The Payments epic contains its own gold-standard story — and three siblings that predate and contradict it
`EMI-87` (Transaction Limitations, Done) and `EMI-6031` (Payments TTL & Invalidation, To Do) and `EMI-1646` (Payment Workflow, Monitoring & Lifecycle, To Do) are exceptional: they correctly use EMI-602's canonical four-bucket balance model (`available` / `reserve_debit` / `reserve_credit` / `current`), define an explicit draft→ledger lifecycle (`INITIATED → PENDING_CHECKS → PENDING_OTP → POSTED → LEDGER_PENDING → SUCCESS/FAILED`), and state the append-only ledger rule precisely. These three are the best-written stories found in either pass and should be treated as the reference template.

But three siblings in the *same epic* (EMI-2184, Payments) describe the same core mechanism using an older, incompatible model:
- **`EMI-2369`** (Closed-loop) and **`EMI-2370`** (Open-loop) both use the three-bucket model (Available/Reserve/Current, no `reserve_credit`) and a different stage-name vocabulary (Initiation → Validation → Pending → Processing → Notification) for what is clearly the same lifecycle EMI-1646 formalizes.
- **`EMI-2032`** (Payment Logging & Balances Reflection) is worse than just stale — it's **actively contradicted** by the platform rule EMI-602 later established. EMI-2032 specifies using **Debezium to detect `INSERT, UPDATE, DELETE`** on the transaction log table via CDC. EMI-602's amendment states explicitly: *"A ledger entry is never updated... There is no CDC before-image to compare against, because there is no UPDATE... EMI-5949 was rewritten on this basis."* EMI-2032's entire detection mechanism (watching for UPDATEs) cannot work against an append-only table. This story needs to be rewritten or retired, not just refreshed.

**Suggested action:** treat EMI-87 / EMI-6031 / EMI-1646 as canonical, and either close EMI-2369/EMI-2370/EMI-2032 as superseded or rewrite them to defer entirely to the newer stories rather than re-deriving the mechanism.

### 2. Extremely heavy duplication in admin/back-office stories — more than anywhere in Part 1
This batch has the highest duplicate-story density found so far, almost all in the pattern "an old flat-AC story done years ago, never closed, sitting next to a newer or more rigorous rewrite":

| Old story | New/overlapping story | Overlap |
|---|---|---|
| `EMI-182` (Change Password, Done) | `EMI-174` (Change Password, Done) | **Byte-for-byte identical text.** Two separate Jira tickets with the same title and the same body. |
| `EMI-200` (Password management, Done) | `EMI-2060` (Password management, To Do) | Same title, same feature, EMI-2060 is the modern configurable-policy rewrite |
| `EMI-901` (Reset Password, Done) | `EMI-2060` (Password management, To Do) | EMI-901 is the minimal first-cut version of what EMI-2060 fully specifies |
| `EMI-197` (Admin User Management, Done) | `EMI-176` (Biller User Management, Done) | Same title pattern, same body almost verbatim (one lets admins edit "Group," the other doesn't) |
| `EMI-197`/`EMI-176` (single-role-per-user model) | `EMI-167` (User Management, **re-open**) + `EMI-2315` (Groups, Roles and Privileges) | EMI-167 explicitly says *"previously a user was assigned a single role or a single group at creation. This is replaced by..."* — it documents its own supersession of EMI-197/176, but neither of those was closed |
| `EMI-166` (Home, Done) | `EMI-2692` (Customer home, To Do) | Near-verbatim duplicate: identical bullet list (wallet balance, brand name, last login, "My Last 10 Transactions" with the same 10 columns), identical AC wording |
| `EMI-175` (Biller Home, Done) | `EMI-1797` (Biller Dashboard, To Do) | Same persona, overlapping metrics (bills paid/unpaid/total), not cross-referenced |
| `EMI-1653` (Admin Limitation management, To Do) | `EMI-195` (Limitation Management, **re-open**) | Same feature (transaction amount / count / wallet-balance limit config), different field names for the same columns |
| `EMI-659` (Wallet balance limitation, Done) | `EMI-87` (Transaction Limitations, Done, Gate 1) | EMI-659 is the standalone legacy version of exactly the balance-boundary check EMI-87's Gate 1 formalizes |
| `EMI-178` (Biller Bill Report, Done) | `EMI-169` (Bill Report, Done) | Same report, two personas (biller vs merchant view), ~90% identical search fields and columns |
| `EMI-1111`'s "Message Templates Management" section (CMS epic) | `EMI-4169` (Notification Templates (Multi-Channel), To Do, Notifications epic) | Two different epics each independently own "admin manages Email/SMS/Push templates with placeholders and preview" |

**Suggested action:** this volume of duplication (11 pairs/groups in just 12 modules) suggests a process gap rather than 11 independent oversights — worth raising as "we don't have a consistent way to close a story once its replacement ships" rather than fixing each pair one at a time.

### 3. Two more empty stub stories, plus one legacy story with an internal self-contradiction
- **`EMI-264`** (System configurations, Done) — the description is completely empty (Jira shows no body at all).
- **`EMI-3783`** (Payment CQRS, To Do) — "Acceptance criteria" heading with nothing under it.
- **`EMI-1111`**'s (CMS) own section 1, "T&C and Privacy Policy Management (Facilitated By: \*\*)" — the "Facilitated By" placeholder was never filled in and the section has no content, inside an otherwise-Done, otherwise-complete story.
- **`EMI-167`** (User Management, re-open) contradicts itself: it defines a rich six-state lifecycle table (`PENDING_VERIFICATION`, `UNDER_REVIEW`, `ACTIVE`, `DEACTIVATED`, `REJECTED`, `DELETED`) early in the story, then its own "Recommended Model" / "Final Recommendation" sections near the end say *"Use ONLY these two concepts"* (Deactivate, Delete) plus implicit Active — silently dropping `PENDING_VERIFICATION`, `UNDER_REVIEW`, and `REJECTED`. Since this story is under active rework (re-open status), this is exactly the kind of loose end worth resolving before it ships either way.

### 4. A hardcoded universal test-account OTP bypass, documented in a ticket
`EMI-4225` (Test accounts, To Do): *"5 test accounts to be created as default users... Accounts has a static OTP = 952829."* This is the same class of finding as the Card Issuance default-PIN issue from Part 1 — a shared, predictable, hardcoded bypass credential for OTP verification, needed for app-store review builds. Worth confirming this is strictly environment-gated (never reachable in production) and that the literal OTP value shouldn't be sitting in a Jira ticket that many people can read. If this is meant for production accounts used during store review, it's a live authentication bypass with a publicly-documented value.

### 5. Wallet-hierarchy transaction type table exists but nothing links to it
`EMI-1647` (Payment Management, To Do) contains the canonical transaction type code table (101 Bank Transfer, 102 Cash-In, 103 W2W, 104 Wallet Payment, 105 Bill Payment, 106/107 Commission Credit/Debit, 109 Adjustment, 110 Reversal — note **108 is skipped with no explanation**) and the detailed sub-type table (101002, 102003, etc. with source/destination wallet and open/closed loop). Every other story in this batch that talks about transaction types (EMI-2998, EMI-2032, EMI-1653, EMI-195, EMI-2031) does so in its own words rather than referencing this table, and none of them explain the gap at code 108.

---

## Module: Payments (`EMI-2184`)

| Key | Status | Title |
|---|---|---|
| EMI-6031 | To Do | Payments TTL & Invalidation |
| EMI-4148 | To Do | QATTAH (split payments) |
| EMI-3783 | To Do | Payment CQRS — **empty stub** |
| EMI-3559 | To Do | Pay on delivery |
| EMI-3130 | To Do | Manual Ledger Entry |
| EMI-3104 | To Do | Payment Metadata |
| EMI-2998 | To Do | Transactions viewing |
| EMI-2370 | To Do | Open-loop |
| EMI-2369 | To Do | Closed-loop |
| EMI-2032 | To Do | Payment Logging & Balances Reflection |
| EMI-1647 | To Do | Payment Management |
| EMI-1646 | To Do | Payment Workflow, Monitoring & Lifecycle |

**Findings:**
- See cross-cutting #1 (the EMI-87/EMI-6031/EMI-1646 vs EMI-2369/EMI-2370/EMI-2032 model mismatch — the most important finding in this document) and #5 (the unreferenced transaction-type table).
- `EMI-4148` (QATTAH, bill-splitting) is very well specified but has one internal inconsistency: its AC section defines order statuses as `COLLECTING / COMPLETED / CANCELLED / REFUNDED`, but every test case and the UX section instead say the order starts in `OPEN` status (e.g. TC-Q-01 "order status OPEN", TC-Q-07 "Order OPEN"). `COLLECTING` and `OPEN` appear to be the same state named two different ways in the same story.
- `EMI-3130` (Manual Ledger Entry) is a significant control gap sitting right next to EMI-87/EMI-6031's carefully-specified reserve/compensating-posting mechanics: it lets an admin insert **any** `status` (PENDING/SUCCESS/FAILED/etc.) directly into the ledger via a form, with only field-presence validation — no reference to the four-bucket model, no check that the inserted entry actually balances against a real reservation, and no mention of how this interacts with EMI-87's exposure-set aggregation or EMI-602's cross-wallet conservation invariant. An admin using this form incorrectly (or maliciously) could insert a `SUCCESS` entry that has no corresponding real fund movement, and nothing described here would catch it. Worth explicitly scoping this against EMI-602/EMI-87 before it's built, and adding a validation step that checks the manual entry against the same invariants the automated path enforces.
- `EMI-3104` (Payment Metadata) is well-aligned with standards (ISO 20022, OWASP) and is the only story in this module that explicitly gets referenced by name from another story (EMI-1646 links to it) — a good example of the cross-referencing this whole review keeps asking for elsewhere.
- `EMI-2998` (Transactions viewing) still uses the old three-bucket names ("Available Balance, Reserve Balance, Current Balance") to describe what fields are hidden from Business-role users — worth updating to the four-bucket vocabulary, especially since hiding `reserve_credit` specifically (not just "Reserve Balance" generically) may matter for what a Business user is and isn't allowed to see.

---

## Module: Profiles (`EMI-2190`)

| Key | Status | Title |
|---|---|---|
| EMI-4225 | To Do | Test accounts — **hardcoded OTP bypass, see cross-cutting #4** |
| EMI-3978 | To Do | Profile Code |
| EMI-2121 | To Do | Accounts management |
| EMI-2117 | To Do | Email Management |
| EMI-648 | Done | Profile management |

**Findings:**
- `EMI-3978` (Profile Code) mirrors `EMI-3637` (Wallet code, from Part 1's Wallets module) almost exactly — same `<TYPE>-<PAYLOAD>-<CHK>` format, same Crockford Base32 + ISO/IEC 7064 checksum rationale, same "industry precedent: Stripe/Revolut" framing. EMI-3978 explicitly references EMI-648 for the profile TYPE enum, which is good practice — but there's no equivalent cross-reference between EMI-3978 (profile identifiers) and EMI-3637 (wallet identifiers) even though they're clearly the same identifier-design decision applied twice. Worth checking these were designed together rather than independently, especially since Part 1 already flagged EMI-3637 contradicting EMI-2213 on whether the wallet code is independent of the vIBAN.
- `EMI-2121` (Accounts management) and `EMI-648` (Profile management, Done) substantially overlap: both cover admin block/unblock/approve/reject/deactivate actions on Biller/Merchant/Customer accounts. EMI-648 is the broader, more current one (it also covers Partner Bank, System, and External Party profiles, and has an explicit status enum: Pending/Approved/Rejected/Active/Inactive/Dormant/Blocked/Unblocked). This overlap is itself a symptom of the "Users" epic (EMI-2180) and "Profiles" epic (EMI-2190) covering much of the same ground — worth a taxonomy conversation about where account/profile lifecycle management is meant to live.
- `EMI-648`'s status enum lists both `Blocked` and `Unblocked` as distinct **statuses** rather than `Unblocked` being simply a transition back to `Active` — worth double-checking this is intentional (an `Unblocked` status distinct from `Active` would need its own semantics, e.g. "unblocked but still pending re-approval").

---

## Module: Limitations (`EMI-2185`)

| Key | Status | Title |
|---|---|---|
| EMI-4181 | To Do | Card Limits (Synced with Wallet Limits) |
| EMI-1653 | To Do | Admin Limitation management |
| EMI-659 | Done | Wallet balance limitation |
| EMI-195 | **re-open** | Limitation Management |
| EMI-87 | Done | Transaction Limitations — **canonical, gold-standard** |

**Findings:**
- `EMI-87` is the single best-written story found across both passes: a fully worked draft/ledger domain model, the exact four-bucket balance movement table for every ledger status × direction combination, three explicitly-ordered "Gates" (balance min/max, amount-per-period, count-per-period) with short-circuit semantics, 29 numbered test scenarios including concurrency races, and a Definition of Done with 16 checkable items. It correctly names its admin-config dependency: *"Rules are created, updated, activated, and deactivated through Limitation Management (EMI-195, EMI-256, EMI-257)."*
- That dependency is a live problem: `EMI-195` (the admin config UI EMI-87 depends on) is **re-open**, and its field set doesn't match EMI-87's criteria model. EMI-195's table columns are `Name / Account type / Limit period / Transaction type / Media / Wallet level / Max amount / Min amount`; EMI-87's criteria set is `Risk Level / Wallet Tier / Transaction Type / Platform / Period`. There's no `Risk Level` column in EMI-195 at all, "Account type" and "Wallet level" don't cleanly map to EMI-87's "Wallet Tier," and "Media" isn't in EMI-87's vocabulary (likely equivalent to "Platform," but not stated). Since EMI-195 is actively being reworked (hence re-open), this is the moment to align its fields with what EMI-87 actually needs to configure.
- `EMI-1653` (Admin Limitation management) is a near-duplicate of EMI-195 with yet another field naming: `Risk Level / Transaction Category / Transaction Type / Platform / Period / Minimum and Maximum Amounts` — closer to EMI-87's vocabulary than EMI-195 is, but still a second, independent description of the same admin screen.
- `EMI-659` (Wallet balance limitation, Done) is the narrower, legacy-only version of exactly what EMI-87's Gate 1 (wallet balance min/max) formalizes — same criteria (risk level, wallet type), same parameters (min/max balance), no four-bucket awareness.
- `EMI-4181` (Card Limits) is a separate, well-specified, modern JIT-authorization story (product-level limits, MCC/Country/Merchant-CRN policy, STIP guardrails) that doesn't reference EMI-87 at all despite both being about limit enforcement — worth checking whether card JIT authorization is supposed to go through the same Gates engine EMI-87 defines, or whether it's deliberately a separate enforcement path (which would itself be worth stating explicitly, since two independent limit engines is a reconciliation risk).

---

## Module: Notifications (`EMI-2187`)

| Key | Status | Title |
|---|---|---|
| EMI-4169 | To Do | Notification Templates (Multi-Channel) |
| EMI-645 | Done | SMS Notifications |
| EMI-93 | To Do | Notification HUB |

**Findings:**
- See cross-cutting #2's last row — `EMI-4169`'s template management (create/edit/version/preview/test-send templates for SMS/Email/Push with placeholders) overlaps with `EMI-1111`'s (CMS epic) "Message Templates Management" section almost feature-for-feature. Two epics, two stories, no cross-link.
- `EMI-645` (SMS Notifications, Done) is SMS-only and predates `EMI-4169`'s multi-channel design; `EMI-93` (Notification HUB) is about logging/retrieving sent notifications per customer, which is a different concern (history/audit) from EMI-4169 (authoring) and EMI-645 (delivery) — the three don't reference each other despite being obviously related layers of the same notification system (author template → send via channel → log for retrieval).

---

## Module: Service providers (`EMI-2183`)

| Key | Status | Title |
|---|---|---|
| EMI-3644 | To Do | External Data TTL & Invalidation |
| EMI-676 | Done | Service provider management |

**Findings:**
- `EMI-3644` (identity/verification provider cache TTL — Wathiq, Nafath, etc.) and `EMI-676` (Done, generic external-service-call logging with its own TTL concept) both define a **TTL** for external provider data but for different purposes (cache freshness vs. triggering an unspecified "appropriate action"). EMI-676's TTL is vague ("TTL value which, when met, triggers an appropriate action in the system" — never says what action), while EMI-3644 is fully specified (fresh/stale/error semantics, webhook invalidation, admin manual invalidation, retry/backoff). Worth checking whether EMI-3644 is meant to supersede/absorb EMI-676's TTL concept rather than the two coexisting as separate, vaguer and more-precise versions of the same idea.
- Also worth noting: `EMI-6031` (Payments TTL & Invalidation, Payments module) is the *third* independent "TTL and invalidation" story across this batch (the other two being EMI-3644 here and the implicit TTL in EMI-676). None of the three reference each other despite the strong naming/conceptual parallel — each defines its own TTL/expiry/invalidation vocabulary independently.

---

## Module: Dashboard / Home (`EMI-2188`)

| Key | Status | Title |
|---|---|---|
| EMI-2692 | To Do | Customer home |
| EMI-1797 | To Do | Biller Dashboard |
| EMI-191 | Done | Admin Dashboard |
| EMI-175 | Done | Biller Home |
| EMI-166 | Done | Home |

**Findings:**
- See cross-cutting #2 — `EMI-166` vs `EMI-2692` is a near-verbatim duplicate (identical structure and even identical sentences in the Acceptance Criteria), and `EMI-175` vs `EMI-1797` cover overlapping Biller-facing metrics without cross-referencing each other.
- `EMI-191` (Admin Dashboard, Done) is a different generation of story entirely — interactive charts, real-time updates, configurable threshold alerts, WCAG accessibility, export/sharing — none of which appears in the other four Home/Dashboard stories despite them sharing the same epic. If the intent is that all persona dashboards eventually get this bar, that's worth stating; if not, the epic mixes two very different design philosophies for "a dashboard" with no explanation.
- None of the five stories cross-reference `EMI-2998` (Transactions viewing, Payments module) even though all five embed their own "Last 10 Transactions" column list (Source Wallet, Destination Wallet, Internal/External Reference, Transaction Type Code, Amount, Amount before/after, Status, Date) that's a strict subset of what EMI-2998 already defines as the full Admin/Business transaction view. Four separate re-statements of the same column list.

---

## Module: Users (`EMI-2180`)

| Key | Status | Title |
|---|---|---|
| EMI-2315 | To Do | Groups, Roles and Privileges |
| EMI-197 | Done | Admin User Management |
| EMI-181 | Done | Biller User Profile |
| EMI-176 | Done | Biller User Management |
| EMI-167 | **re-open** | User Management |

**Findings:**
- `EMI-2315` (Groups, Roles and Privileges) is an excellent, rigorous RBAC redesign — many-to-many Group↔Role, union-of-privileges evaluation, a `SYSTEM` flag with platform-admin-only control, per-tenant isolation, 11 Given/When/Then ACs, and an explicit "Out of Scope" section. `EMI-167` (User Management, re-open) is the matching user-creation-flow story built directly on top of it, and is equally rigorous (Yakeen/WS1/Nafath/AML verification chain, multi-layer Group/Role selector UI).
- See cross-cutting #2 and #3 for EMI-197/EMI-176's duplication and EMI-167's internal status-lifecycle contradiction.
- `EMI-181` (Biller User Profile, Done) is extremely thin — three fields (first name, last name, email), no edit capability mentioned, no relationship stated to EMI-197/176's user list or EMI-2315/167's access model. It reads like a very early story that was never revisited once the RBAC model matured.
- `EMI-167` explicitly labels itself as superseding the "single role/single group" model — this is a case where the story text itself makes clear which older stories (EMI-197, EMI-176) should probably be closed or annotated as superseded, which is unusually helpful and worth following through on rather than leaving as a note only the story author would notice.

---

## Module: Passwords (`EMI-2191`)

| Key | Status | Title |
|---|---|---|
| EMI-2060 | To Do | Password management |
| EMI-901 | Done | Reset Password |
| EMI-200 | Done | Password management |
| EMI-182 | Done | Change Password |
| EMI-174 | Done | Change Password |

**Findings:**
- See cross-cutting #2 — this module is almost entirely duplicate pairs: EMI-182/EMI-174 are identical text under two keys; EMI-200/EMI-901 are two earlier cuts of what EMI-2060 now fully specifies (configurable length/complexity/expiry policy, last-3-password reuse block, OTP on every password operation, password-strength UI indicator).
- None of the four legacy stories (EMI-901, EMI-200, EMI-182, EMI-174) mention password history/reuse prevention, which EMI-2060 introduces as new scope ("new password must not match the previous passwords (last 3)") — worth confirming this is genuinely new policy and not something already enforced that the older stories simply never documented.
- This module would benefit most directly from a straightforward Jira cleanup pass: it's five stories that should probably be one (EMI-2060) plus a closed/superseded trail, with no new content needed — the refinement work here is administrative, not documentation.

---

## Module: Configuration (`EMI-2181`)

| Key | Status | Title |
|---|---|---|
| EMI-2041 | To Do | Configurable OTP Settings |
| EMI-597 | In Progress | Lookups |
| EMI-264 | Done | System configurations — **empty, see cross-cutting #3** |
| EMI-196 | In Progress | Configuration |

**Findings:**
- `EMI-2041` (Configurable OTP Settings) is solid and well-scoped (general vs. transaction-specific OTP config, override precedence, overlap validation). It doesn't reference `EMI-4225` (Test accounts) even though EMI-4225's static-OTP bypass is exactly the kind of thing an OTP-settings admin screen should probably expose or at least be aware of (e.g., as a visible, audited exception rather than a hardcoded value).
- `EMI-597` (Lookups, In Progress) defines the wallet type hierarchy (System: Master/Control/Collection[Commission/VAT/Dormant/Reserved]; User: Parent/Child/Sub) and wallet tiers (Basic/Silver/Gold/Premium) as reference data — this is foundational vocabulary that EMI-87 (Transaction Limitations), EMI-1647 (Payment Management), and the entire Wallets module from Part 1 all implicitly assume but never cite. In particular, EMI-87's "Wallet Tier" criterion (Basic and higher tiers) should point here for the authoritative tier list (Basic/Silver/Gold/Premium).
- `EMI-196` (Configuration, In Progress) is a much narrower legacy screen (per-transaction-type max/min amount and status only) that significantly overlaps with what `EMI-1653`/`EMI-195` (Limitations module) already cover for transaction amount limits — a third place configuring overlapping data.
- `EMI-264` — see cross-cutting #3, completely empty despite being marked Done.

---

## Module: Commissions (`EMI-2186`)

| Key | Status | Title |
|---|---|---|
| EMI-2031 | To Do | Commission management |

**Findings:**
- Single story, reasonably thorough (default vs. per-business custom schema, fixed/percentage commission types, min/max amount ranges, overlap validation). One internal tension worth surfacing: the story states plainly that *"Commission amounts should be added to the sent transaction amount on the sender side [and] deducted from the received transaction amount on the receiver side"* — i.e., commission is charged twice, once to each party — immediately followed by "Dual Commission Application" describing the same sender+receiver double-charge as a feature, and then a further "Enhanced Deduction Options" section describing an *optional* choice between "deduct from total" or "add to total" that reads as a different, single-sided model. It's not clear from the text whether dual-sided commission and the enable/disable deduction toggle are two independent configurable behaviors or the same behavior described twice with drifting terminology — worth a product conversation to pin down the actual commission-charging model before this is built, since it directly affects ledger postings and reconciliation (and should presumably reference EMI-1647's `106`/`107` Commission Credit/Debit transaction types once resolved).
- No cross-reference to `EMI-4133` (Commission Rules Engine), an epic-level placeholder identified in Part 1 as having zero Story-type children — EMI-2031 is very plausibly the real content that epic is meant to eventually hold, just filed under a different parent.

---

## Module: Reports (`EMI-2189`)

| Key | Status | Title |
|---|---|---|
| EMI-1132 | Done | Admin Reports |
| EMI-178 | Done | Biller Bill Report |
| EMI-169 | Done | Bill Report |
| EMI-168 | Done | Transaction Report |

**Findings:**
- See cross-cutting #2 — EMI-178 vs EMI-169 near-duplicate (biller-side vs. merchant-side bill report, ~90% identical search fields and table columns, both Done, neither cross-referencing the other).
- `EMI-1132` (Admin Reports, Done) is a higher-level umbrella (bill/transaction/reconciliation reports with export) that overlaps with EMI-178/EMI-169 (bill reports) and EMI-168 (transaction report) individually — again the pattern of a broad story and narrower persona-specific stories coexisting without a stated relationship.
- `EMI-168` (Transaction Report) uses the same 10-column transaction detail list (Source/Destination Wallet, Internal/External Reference, Transaction Type Code, Amount before/after, Amount, Status, Date) that also appears independently in all five Dashboard/Home stories and in EMI-2998 (Transactions viewing) — this exact column list now appears **six separate times** across two modules in this batch alone, with no shared reference. This is the single most-repeated piece of content found in either pass and a strong candidate for a shared "transaction row shape" reference story that everything else points to instead of restating.

---

## Module: CMS (`EMI-2182`)

| Key | Status | Title |
|---|---|---|
| EMI-1111 | Done | CMS |

**Findings:**
- See cross-cutting #2 (Message Templates section overlapping EMI-4169) and #3 (the empty "T&C and Privacy Policy Management" section).
- Otherwise solid: FAQs management, localized system error messages with per-error-code tracking and a live preview, and RBAC restricting CMS access to Super Admin. The error-message-localization feature here would be worth linking from every other story in this batch that mentions "clear error message" or "user-friendly error" (which is most of them) — right now each story invents its own error copy inline rather than pointing at this centralized, localized catalog.
- Recall from the original epic-list scoping: there are **two** epics named "CMS" in the full 81-epic list — `EMI-2182` (this one, which has EMI-1111) and `EMI-4144` (confirmed empty of Story-type children). This is very likely the same duplicate-epic pattern already suspected in Part 1's epic scoping — EMI-4144 is probably a newer, currently-unpopulated placeholder for CMS work that hasn't been filed yet, or a stray duplicate epic that should be merged into EMI-2182.

---

## Suggested next steps

1. **Resolve the Payments-epic model contradiction first** (cross-cutting #1) — EMI-2032 in particular describes a mechanism (Debezium UPDATE-detection) that the platform's own later ruling (EMI-602) says cannot work. This blocks trusting any of EMI-2369/2370/2032 as current.
2. **Run a dedicated "close or annotate superseded stories" pass** — cross-cutting #2 lists 11 duplicate pairs/groups in 12 modules, which is a much higher rate than Part 1's four. Given the volume, this is worth doing as a batch exercise (e.g., one afternoon going through the list above) rather than one Jira comment at a time.
3. **Reconcile EMI-195 (re-open) against EMI-87's actual criteria model** before EMI-195's rework ships — EMI-87 is Done and depends on EMI-195's fields; right now they don't match.
4. **Escalate the EMI-4225 static test-OTP** to whoever owns security sign-off, same track as the Part 1 Card Issuance/CVV findings.
5. **Consider a shared "transaction row" reference** — the 10-column transaction detail shape appears six times across this batch alone (cross-cutting note in the Reports section). A single canonical definition (perhaps EMI-2998, since it's the most complete) that other stories cite would remove a lot of drift risk.
6. Once ready, continue the pass with the remaining epics (System Integration, Core System, Reconciliation, Validations, Sessions, Devices, Verifications, Under Review, Partner bank, Reversal, Adjustment, Errors, Authentication, Archived, and the smaller/emerging modules) — other parts of this review are covering those in parallel.
