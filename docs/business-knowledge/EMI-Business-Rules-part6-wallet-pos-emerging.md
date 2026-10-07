# EMI Business Rules Reference — Balances, PoS, Dormant Wallets & Emerging Modules

Companion to `EMI-Refined-User-Stories-part6-wallet-pos-emerging.md` (the critique/findings doc for this same batch). That file says what's wrong, missing, or inconsistent — **this file says what the business actually specifies**: the rules, workflows, thresholds, and definitions extracted from each story, distilled into reference form. Not a verbatim reproduction of Jira ACs — read the source ticket before automating against this, especially for the PoS module, whose stories carry extensive open-item registers (`docs/PoS/pos-open-items-register.md`) that are not reproduced here.

Scope: 13 modules / 44 stories (project = EMI, Epic Link = module).

---

## Balances & Wallet Consistency (`EMI-5944`)

This module *is* the canonical balance model referenced everywhere else in the project (see `EMI-Business-Rules-part1-core-modules.md`'s Wallets section for the original EMI-602 four-bucket summary). Its six stories build the machinery that keeps that model provably correct in production. Every story here explicitly cites EMI-602 and refuses to re-derive the model — a discipline this module holds better than any other in the project.

**Gapless per-wallet sequence numbers (EMI-6148):** every `running_balance` row gets a per-wallet, per-grain sequence number (1, 2, 3… with no gaps, ever), allocated inside the same DB transaction and row lock as the balance write itself. A rolled-back write consumes no number. This is what turns "the daily close covered up to entry N" into a provable claim rather than an assumption — a scheduled job asserts the run from 1 to N is dense, and a genuine gap routes the wallet to Balance Repair rather than being silently invented. Account-grain and aggregate-grain sequences are independent and never interleaved.

**Wallet Daily Close (EMI-5954):** every wallet, at both the per-account level (sub-ledger) and an aggregated level (general ledger), gets a sealed opening/closing snapshot each day. Critically, **the close reads the last `running_balance` entry before the cutoff — it does not recalculate from the transaction log.** This is deliberate: recalculating would hide the exact failure the close exists to catch (a broken projection quietly producing the "right" number). Four independent verification sources run against the close (incremental ledger check, structural invariants, monthly full re-derivation, and external tie-out against the partner bank), and the sub-ledger closes must sum to the aggregate close. A day that fails to seal doesn't block the next day from running — the next day just becomes provisional (its opening is unverified) until the blocking day resolves. Simple failures (projection disagrees, ledger is sound) auto-repair; anything touching ledger integrity itself goes to a human (Finance Lead). **A sealed close is immutable by database trigger** — the only way to change one is to append a new generation and mark the old one superseded.

**Bucket identity validation (EMI-5950):** two invariants are continuously asserted against the ledger: (1) per-wallet, `current = available + reserve_debit` (enforced as a DB constraint); (2) cross-wallet, `sender.reserve_debit == SUM(reserve_credit)` across every receiving wallet on a transaction *including the commission and VAT wallets* — this second check is strictly stronger because it catches a leg that was never created at all, which the per-wallet check can't see (a missing row leaves every individual wallet internally consistent). **Negative `available` balances are tolerated, not rejected** — commission/VAT wallets legitimately go temporarily negative during the reserve window today, so the constraint records a negative as a tracked variance rather than blocking the write, until the underlying leg-ordering defect is fixed.

**Wallet Balance Recompute (EMI-5946):** the *routine* repair path for a wrong bucket total — recomputes all four buckets directly from `transaction_log` as a set aggregate (order-independent, completes in under a second per wallet), reading a stream of postings rather than one "current" row, since the ledger is append-only. Deliberately never reads `running_balance` (that would be reading the projection to fix the projection). Mutually exclusive with the rebuild below over the same wallet scope.

**Statement History Rebuild (EMI-5945):** the *break-glass* path — replays the actual `running_balance` entry sequence from `transaction_log`, used only when per-transaction before/after values (not just the endpoint) are wrong. Always archives before mutating (`running_balance_history`, immutable, never deleted), anchors from the last valid entry before the range, and replays entry-by-entry in a deterministic sort order. A zero-variance run is a `NO_OP` — no archive, no rewrite. Ownership of the arithmetic sits in the Wallet Service, one transaction per wallet, never in the reporting layer (this fixed a real defect where reports temporarily showed wrong balances).

**Stuck Reserve Detection (EMI-5951):** flags any `reserve_debit`/`reserve_credit` with no releasing event past a per-transaction-type configurable age — this is the single most frequent balance-failure signature in the project's history (four prior incidents cited). Detection and reporting only; resolution goes through the existing correction path (EMI-5946), not a new money-moving action.

---

## PoS Transactions (`EMI-5914`) — 12 stories, the most rigorously specified module in the project

This module is one coherent system: a card settles through ANB days after the sale, and the whole chain exists to turn "ANB says this settled" into exactly one balance-bearing credit to the right merchant, with compliance and limit checks placed at the one moment each is actually meaningful. A second rail — wallet payment at the terminal — is the deliberate exception to almost every rule below, because on that rail the check and the money movement are the same instant.

### The three-gate compliance framework (owned by EMI-5923, invoked throughout)

| Gate | When | Checks | Never checks |
|---|---|---|---|
| **Gate 1** | Before any ledger entry (EMI-5915), and once per batch on the aggregate (EMI-5989) | Wallet status, AML flag, sanctions/UBO, KYC/KYB validity, fraud score, dormancy | Balance cap, turnover limits |
| **Gate 2** | At ACH run build (EMI-5922), before release | Merchant eligibility re-evaluated + sanctions re-screen on list updates | Balance cap, turnover limits |
| **Gate 3** | At the intraday statement credit — the moment value actually lands (EMI-5916) | Wallet still eligible + balance-cap headroom + turnover limits against the position *right now* | Nothing — this is the only limit check anywhere in the chain |

**Why limits sit only at Gate 3, stated once because it's the load-bearing design decision of the whole module:** party-state checks (who the merchant is) are durable across the days between a sale and its settlement; a balance cap describes the wallet's position at the exact instant value is added, which for Gates 1 and 2 is up to a day away. Holding a merchant's takings on a *prediction* that a cap might be breached is a guess, not a control — and under a single nightly settlement cycle, a wrong guess costs the merchant a full day with no second chance. A Gate 3 hold is never treated as an ACH failure (the transfer executed correctly; the money is just not creditable yet) — it goes into a **suspense position**, reported as its own line, never mixed into the compliance-hold or discrepancy-queue figures. **The wallet-payment-at-terminal rail (EMI-5917) is the sole exception**: because the check and the movement are the same instant there, the full check set including limits runs synchronously before the customer is even prompted.

### The nightly chain, in order

1. **PTS Retrieval & Parsing (EMI-5991):** pulls ANB's settlement report once nightly (recommended 23:30 Asia/Riyadh, always configurable, never hardcoded), asserts — never filters — that every row reads `Approved` (ANB's contract is settled-only; a row that doesn't is a contract breach, not a row to skip), validates each row's arithmetic identity (`Net = Gross − sum of four deductions`), and hands validated rows to grouping. A 4-day look-back re-reads every date every night (correctness comes from idempotency, not from reading once) — this specifically catches rows that land at T+3 across a weekend. A file that fails to parse is rejected whole; there is no partial ingestion.
2. **Settlement Grouping & Gate 1 (EMI-5989):** groups validated rows into batches by `Payment id`, scoped by `Terminal ID + Card Type + Client ID` (a batch legitimately spans multiple card schemes and payment methods — those are never part of the scope). Runs Gate 1 once per batch on the aggregate. On pass, writes **exactly one aggregated CASH IN transaction per batch** — this is the first and only balance-bearing record in the whole chain; nothing before it moves money. A batch whose members disagree on any scope field is held as unpayable (no split is ever inferred); a previously-grouped batch that returns with different content is a frozen "immutability breach," escalated as a financial incident if an aggregate already exists.
3. **Omnibus Settlement Transfers (EMI-5922):** one ACH item per batch (not per merchant — a merchant with 100 terminals across 2 card types produces 200 items/approvals/credits *per day*, a grain decision the story is explicit must be actively chosen, not inherited). Commission and VAT are computed **here**, on the aggregate, never per card transaction and never conflated with ANB's own deductions (already netted inside `Net Settlement Amount`). Default release path is Finance maker-checker approval; full-auto exists behind config, off by default. The **intraday statement job** later reads the bank credit, matches it by reference (`Payment id` in the notes) — never by amount — and this is where Gate 3 fires: pass clears the pending to available, fail holds it in suspense. The handler must never create a new cash-in; it only clears the one that already exists.
4. **Reconciliation & Three-Way Matching (EMI-5920):** the nightly join across the ledger, ANB's settlement report, and the MT940 credit — anchored purely on `Payment id`, with amount and transaction count as two *independent* verification signals read together (amount right + count wrong = a membership defect; amount wrong + count right = a value defect — collapsing these into one "mismatch" destroys the diagnosis). Declines and refunds are excluded from the "missing settlement" exception candidate set *before* it's built, using the terminal's own outcome — otherwise the exception queue would fill with every declined card in the estate, every day.
5. **PoS Compliance Gates & Held Funds (EMI-5923):** owns the gate framework above, the `COMPLIANCE_HOLD` state (zero wallet entries, ever), and the daily held-funds identity: gross received = credited + compliance held (Gates 1/2) + limit suspense (Gate 3) + in-transit, to the smallest currency unit.
6. **Wallet Crediting & Merchant Visibility (EMI-5916):** owns everything the merchant actually sees. A sale at the terminal is shown under its device, explicitly **not** as a balance — the platform hasn't committed to anything yet and the sale can still be declined, held, or fail Gate 3. A pending cash-in is shown as "expected," never "guaranteed." One credit lands per settlement batch (so a multi-terminal merchant sees several credits a day, each traceable to its device). Limit-hold copy and compliance-hold copy are deliberately never shared: a limit hold tells the merchant the cap and the remedy (no tipping-off risk in a cap breach); a compliance hold stays neutral on every surface, with no review indicator anywhere.

### The three non-card exceptions

- **Void & Technical Reversal (EMI-5919):** a sale captured at a terminal writes one ledger record and nothing else (no pending, no wallet entry) — so there is nothing for a void to "undo." What a void actually does is flip `settlement_expected` to false so the cancelled sale is never chased as missing money. The interesting case is the reverse: a voided sale that *does* appear in ANB's settled-only report — a real financial exception (the merchant will be credited for something they cancelled), alarmed to Finance on first occurrence, with no automatic reversal path.
- **PoS Refunds (EMI-5918):** a refund at a terminal never appears in ANB's settlement report (which is settled-only), so **nothing in the current chain can ever debit the merchant for it.** This story builds capture, linkage to the original (capped so cumulative refunds can't exceed the original's gross), and a running exposure total — explicitly *not* a debit path, because that can't be designed until an open question with ANB (do refunds net at source, arrive as adjustments, or never reach us at all) is answered. The exposure trend is the business case for getting that question answered.
- **Wallet Payment at Terminal (EMI-5917):** the exception to nearly every rule above. Money moves internally and instantly, customer wallet to merchant wallet, on in-app PIN/biometric approval — so every check (including limits) runs synchronously *before* the customer is prompted, there is no pending state ever, and a failed check is a plain decline with nothing to unwind. A missing confirmation callback within 15 minutes auto-reverses everyone to their starting position.
- **Transaction Callback Ingestion (EMI-5915):** the single hardened entry point every terminal event (sale, void, refund, reversal) passes through — schema-validated, idempotent on the provider's transaction id (with `Terminal ID + RRN + date` as the cross-system join key, since ANB's settlement file carries neither a transaction id nor a STAN), and the place where `settlement_expected` is derived once and never recomputed downstream (so the settlement-matching story never has to guess what a terminal outcome implies).

### PoS Commission Configuration (`EMI-5921`)
Prices PoS settlement credits using the *existing* commission engine as a new `Platform = PoS` value on `TXN type + Platform` — deliberately not a second fee engine, so commercial rate changes never need a release.

### ZATCA e-invoicing of PoS commission (`EMI-6018`)
Charging a merchant commission + VAT is itself a taxable supply MJD Pay must invoice — a gap nothing else in the backlog covers. Commission is priced once per settlement batch (never per card transaction), so the invoice is one line per batch, reconciling exactly to the amount actually deducted (no re-derivation at invoice time). Explicitly separate from ANB's own deductions, which are the bank's supply to whoever their contracting party is, not MJD Pay's to invoice. Several regulatory questions (B2B vs. simplified invoice regime, invoicing cadence) are open pending Finance/Tax sign-off.

---

## PoS (`EMI-5823`) — device, order and product lifecycle around a terminal

**PoS Device Management (EMI-5824):** every mapped terminal (TID) gets its own device record with a status lifecycle (`Active ⇄ Suspended`, `Active ⇄ Blocked`, `Active → Replaced` with lineage preserved, `→ Terminated`) and a **per-device sub-ledger** — but that sub-ledger is explicitly a *read-model projection* over the wallet ledger (every wallet transaction carries the originating `tid` in its metadata), never a second source of truth, and never a place money moves from (per-device payout is deferred to a future phase). Admin sees every device across every business; a business sees only its own.

**PoS Order Management (EMI-5719):** this phase is entirely manual — there is no live integration with the terminal provider (InterSoft). An admin exports approved orders as Excel, Ops emails the provider outside the system, and once TIDs come back, the admin re-uploads the Excel or types them in manually. Orders are organized by **delivery group** (one device count + one address + one contact per group), and every delivery group gets a signed consent-of-delivery PDF attached by the admin once the order reaches "Sent to Provider" — viewable by the business read-only, never business-uploadable. A complete TID mapping activates the order (fee accrual begins); a partial mapping produces `Partially Active`.

**Product Subscription Workflow — PoS (EMI-5718):** the request-a-device flow feeding the order above. This phase hides the wallet picker entirely — every PoS device auto-maps to the account's **Main Wallet** (multi-wallet mapping is deferred), and the user instead configures delivery (one address for all devices, or split into quantity groups, each with its own address sourced from Wahiq's National Address registry or a custom map pin) plus a delivery contact per group.

**PoS Integration — Sister Company & TID Auto-Mapping (EMI-5723): explicitly deferred to a future phase.** This is the automated version of the manual order flow above (auto-provisioning devices via the sister company's integration and auto-mapping returned TIDs) — not built this phase; the manual Excel round-trip in EMI-5719 is the interim.

---

## Products (`EMI-5722`)

**Products Management (EMI-5656):** the admin-owned product catalog that Registration's Step 5 products list (EMI-3782, see pass 1) and the PoS subscription flow above both read from. Each product carries an independent fee structure (percentage / flat / hybrid, per-transaction or per-cycle) and up to four independent limit windows (hourly/daily/monthly/yearly, each with a count cap *and* an amount cap — all eight fields optional). Disabling a product only blocks new subscriptions; existing subscribers are unaffected. Fee changes are logged immutably and never retroactive to already-settled transactions.

---

## Currencies (`EMI-5433`)

**ISO 4217-compliant minor-unit storage (EMI-5434):** a foundational data-model change — the platform currently stores amounts as decimals with up to 6 decimal places; this story moves `transaction_log`, `running_balance`, and the wallet snapshot to store every amount as an **integer in the currency's minor unit** (SAR → halalas, i.e. `10.55 SAR` is stored as `1055`), driven by per-currency ISO 4217 metadata (SAR has 2 minor units, JOD has 3, JPY has 0). Posting validation rejects an amount with more precision than the currency allows (`10.555 SAR` is invalid). This is explicitly the representation the canonical balance model (EMI-602) and its rebuild/recompute machinery are meant to converge on.

---

## Payment Links (`EMI-5393`)

**Payment Links & QR-Based Entry (EMI-5368):** a payment link/QR is a thin access layer over two existing business objects — a bill/invoice (pay it) or a wallet (send/add funds to it) — and deliberately does not redefine either. A payer can act as a guest through a hosted public page, or sign in with MajdPay and get redirected into the matching in-app flow. The link/QR is just the entry mechanism; the underlying bill or wallet remains the single source of truth throughout.

---

## Platform Architecture & Core Infrastructure (`EMI-5216`)

**Architecture Analysis & Implementation Alignment (EMI-5367):** a process/governance story, not a product-behavior one — a formal architecture review and sign-off gate (service boundaries, Kafka event-flow design, security architecture, ADRs) that stakeholders must clear before implementation starts. No end-user-facing business rule to extract; its output (approved diagrams and ADRs) is a precondition for other stories in this module, not a business rule itself.

---

## Dormant & Unclaimed Wallets (`EMI-5217`) — 11 stories, one coherent lifecycle

A wallet moves through four states purely as a function of elapsed time since its last financial activity, and the policy is explicit that dormancy handling protects customer ownership rather than benefiting the company:

| Status | Trigger | What happens |
|---|---|---|
| **Active** | At least one financial transaction in the last 12 months | Normal operation |
| **Dormant** | 12 consecutive months with no transaction | First notification sent (email/SMS/in-app), stating the wallet is dormant and how to reactivate (any transaction or a data update) |
| **Unclaimed** | 24 months with no transaction *and* no response to the first notice | A second notice is sent warning that the balance will move to the aggregated account within 30 days; if still no response, the balance is transferred |
| **Abandoned** | 60 months with no activity | Wallet is marked abandoned; **funds remain payable to the customer indefinitely** — no automated write-off is ever permitted, and the aggregated account cannot be closed without prior SAMA approval |

**Business rules that hold across every stage:**
- Every threshold (12/24/60 months) must be admin-configurable and never hardcoded (EMI-5228 provides the config surface, with validation that Dormant < Unclaimed < Abandoned and a full versioned audit trail on every change).
- Funds moved to the aggregated account are a **precautionary transfer, not a forfeiture** — customer ownership is explicitly preserved, the funds are booked as a company liability (never usable for treasury, revenue, or operations), and the original wallet-to-aggregated-account ledger link stays fully traceable (EMI-5221, EMI-5225).
- A customer can reactivate at any time, subject to KYC/AML re-verification; on success, any balance sitting in the aggregated account is restored to the wallet (EMI-5223).
- Every notice, status transition, transfer, and reactivation is retained for a minimum of 5 years and must be searchable and exportable for a regulator (EMI-5226).
- Annual regulatory/internal-audit reports must break down wallet counts by status and total transferred vs. returned balances, reviewed by Compliance and Internal Audit before submission (EMI-5224).
- The classification engine itself runs on a schedule, computing "last financial activity" per wallet; manual override is disallowed except through an approved privileged workflow (EMI-5218).

**Note on the balance model:** none of these 11 stories reference the four-bucket model (`available`/`reserve_debit`/`reserve_credit`/`current`) documented under EMI-602 and applied meticulously in the Balances & Wallet Consistency module above — the transfer-to-aggregated-account mechanic is described purely in terms of "the balance," without saying which bucket. Given `reserve_credit` is deliberately excluded from `current`, and given that a dormant wallet could plausibly still hold an old, never-cleared reserve, this is a real gap in an otherwise very well-specified policy.

---

## Multi-Omnibus (`EMI-5004`)

This module runs on a **different ledger vocabulary from the rest of the project** — classic `source_wallet → destination_wallet` transfers between named conceptual accounts (USER, CONTROL, CLEARING, EXPENSES, REVENUE, VAT), rather than the four-bucket `available`/`reserve_debit`/`reserve_credit`/`current` model from EMI-602. It's worth reading these three stories together since they form one routing/liquidity picture across multiple partner-bank omnibus accounts ("Controls A/B/C…").

**Closed-Loop Routing (EMI-5009):** for a purely internal transaction (no bank rail touched), the platform picks whichever control segment holds the user's **largest available balance** as the funding source (deterministic priority-list tie-break on equal balances). If no single segment covers the amount, Phase 1 explicitly must decide whether to split across segments or reject — the story recommends split for consistency with cash-out. A merchant is credited in the *same* control used to debit the payer, by design, to keep the leg internally consistent (an alternative — crediting the merchant's own preferred control — was considered and rejected for Phase 1 as added routing complexity).

**Cash-In Orchestration via HyperPay (EMI-5008):** HyperPay settlement doesn't reliably tell the platform which physical omnibus account received the funds, so Phase 1 sidesteps the ambiguity with an **admin-configured single default control** for all HyperPay cash-ins — exactly one must be set platform-wide (or per tenant), and if none is configured, the cash-in is queued to an Ops task rather than posted to an assumed account. Idempotent on HyperPay's payment reference so a duplicate webhook can't double-credit.

**Cash-Out Orchestration (EMI-5005, re-opened):** given a user's balance is segmented across multiple controls and a cash-out target IBAN, the router picks the cheapest valid route — a single control if one covers the amount, otherwise a forced split across the fewest possible legs (largest-balance-first, then priority). Five Phase-1 invariants hold throughout: user wallets represent ownership; Clearing wallets represent platform liquidity and are touched *only* for fee settlement or an explicit feature-flagged treasury-funded flow; Control wallets (the omnibus accounts) must never go negative; cash-out principal always sources from a User wallet unless treasury-funded; and — critically — **no cross-clearing transfer between controls is ever posted automatically; rebalancing omnibus accounts across banks is a manual OPS action.** A treasury-funded cash-out (feature-flagged) first funds the user within the destination control from that control's Clearing wallet, tagged `TREASURY_FUND`, then executes the cash-out normally.

**Bank-to-Bank Fee Matrix (EMI-5007):** the fee lookup both routers above depend on — a default domestic inter-bank fee and default cross-border fee (categorized by destination country), each with optional per-destination-bank overrides, managed in bulk via a platform-generated template the admin fills externally and re-uploads for validation. Explicitly out of scope for v1: time-of-day pricing, volume-tiered pricing, FX spreads, and multi-currency fee models.

---

## Fees (`EMI-5006`)

Covered under Multi-Omnibus above — EMI-5007 (Bank-to-Bank Fee Matrix) is the sole story in this epic and is the shared fee-lookup service both cash-in and cash-out routing depend on.

---

## Apps & Portals (`EMI-4818`)

**Super App / Business Portal (EMI-4819):** one unified app serves both Merchants and Billers (there are no separate Merchant/Biller apps), with a completely separate Customer app for wallet holders. At signup a business chooses Merchant, Biller, or **both** — and choosing "both" creates **two entirely independent tenants** (separate profiles, separate onboarding review, separate approval, separate wallets, settlements, and limits) that share nothing operationally; approving one has zero bearing on the other. "Both" is purely an onboarding convenience — the system treats it exactly as if the user had registered twice. A user with multiple approved business profiles gets a profile switcher in-app; switching context changes the entire menu/dashboard/permission set with no data bleed between profiles.

---

## Auth and Login (`EMI-4638`)

**User Management and Login Authentication — KSA Mobile Only (EMI-4637):** an explicit rewrite of the Business Login story from pass 1 (EMI-126), for the Taswya admin/business portal specifically. Same company-number + mobile + password form, same OTP-then-token issuance pattern, same lockout rule (3 failed attempts → temporary lock, 3 temporary locks → deactivation), same SMS-on-first-device-login behavior — but with an explicit **KSA-only mobile number validation** requirement on both front-end and back-end (must match `+9665XXXXXXXX` / `05XXXXXXXX`, rejected inline otherwise). It also carries forward, unchanged and unexamined, the same "AML/compliance-related login rejections" error case flagged as likely-boilerplate in pass 1's Login findings — worth resolving once, since it's now been copied into a second story.

---

## Authority matrix (`EMI-4634`)

**Customizable Authority Matrix Per Account (EMI-4632):** extends the existing customer-level Groups/Roles/Privileges model down to the **account** level for corporate customers with multiple accounts (departments, subsidiaries, cost centers). Every authorization decision evaluates against `(user_id, account_id, privilege)` — the same user can be an Approver on Account A and a Viewer on Account B, and a privilege granted on one account never silently applies to another. Optionally, a customer-level default template can be *copied* into a new account at creation time — but once copied, it's fully account-owned; later changes never propagate back to the template or sideways to other accounts.
