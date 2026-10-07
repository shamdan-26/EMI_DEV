# EMI Business Rules Reference — System Integration, Core System, Reconciliation

Companion to `EMI-Refined-User-Stories-part3-system-core.md` (the critique/findings doc for this same batch). That file says what's wrong or missing — including that several stories in System Integration paste real credentials into their Jira descriptions; **this file deliberately does not reproduce any credential, key, token, or secret value** even in redacted-looking form, only the business purpose of each integration.

Scope: 3 modules / 38 stories.

---

## System Integration (`EMI-2`)

**What it does:** The platform's external-integration layer — every third-party system EMI talks to, plus the fraud/AML decision model that sits on top of financial events.

**Fraud detection (Mozn FOCAL / EFM):**
- EMI's scope is the *integration* only — sending events, handling webhooks, calling customer/device endpoints, and acting on the returned decision. Rule tuning, blacklists/whitelists, and case management are the client's (compliance team's) responsibility, not engineering's.
- Every financial event returns one of three decisions: **APPROVE** (proceed), **REVIEW** (step-up auth or manual review), **REJECT** (block). Decisions are driven by a `total_score` and a per-rule `score_breakdown`.
- **Core principle: the fraud call gates a ledger position, not an API action.** A wallet carries `available` (spendable), `pending_credit` (incoming, not yet released), and `reserved`/`hold` (outgoing, earmarked, locked) — this pre-dates and does not use EMI-602's four-bucket vocabulary (see the findings doc for why that's a problem).
- **Outbound/irreversible flows (cash-out, bill payment, wallet-to-wallet)** are screened *before* execution: reserve the funds, call FOCAL, submit to the rail only on APPROVE. **Inbound flows (HyperPay top-up, VIBAN wire)** are screened *at confirmation*, since the money has already landed in the gateway/bank — credit to `pending_credit` and release only on APPROVE. The asymmetry exists because the risk being managed for inbound money is the downstream outflow of dirty funds, not the deposit itself.
- On REVIEW: outbound funds stay in `reserved` and are **not submitted** until step-up auth (3DS2/OTP/biometric) or manual review clears them; inbound funds stay in `pending_credit`, visible but not spendable, pending AML/source-of-funds review.
- On REJECT: outbound funds are released back to the sender (or frozen if blacklisting applies) and the transaction is declined; inbound funds are held, then refunded/reversed, with a SAR (suspicious activity report) raised.
- **Availability policy is fail-closed for outbound** — a timeout or missing decision never auto-approves irreversible value.
- Every FOCAL call is idempotency-keyed; every transaction's terminal status (COMPLETED/FAILED/CANCELLED) is reported back to FOCAL so its velocity/aggregation counters stay accurate — this is a call-more-than-once lifecycle, not a single decision request.
- A client-side Device Fingerprint SDK (iOS/Android/React Native) produces a device id included in event payloads, particularly funds transfers.

**IBAN verification (Lean Tech):**
- Onboarding: IBAN ownership + ACTIVE account status must both be true before registration can proceed — this is a mandatory blocking step, not optional.
- Withdrawal/cash-out: IBAN re-verification before execution is optional but recommended, gated by a feature flag, specifically to catch closed accounts, transferred ownership, or fraudulent/outdated IBANs before money is sent to the wrong place.
- Verification result rules: ownership=true AND status=ACTIVE → proceed; ownership=false → block; status≠ACTIVE → block; unsupported bank → block; temporary error → retry, then block if unresolved.
- Every verification attempt (result, account status, provider reference, correlation ID) is audit-logged regardless of outcome.

**Wallet-provider transfer (STC Pay and similar):**
- Outbound: user enters the partner's wallet identifier (phone/email/tokenized ID); EMI validates limits and debits the wallet before sending the instruction to the partner. Inbound credits require storing `partner_txn_id`, `partner_wallet_id`, and `batch_reference` for reconciliation.
- Partner timeout → retry up to 3 times, then auto-refund. Invalid partner ID is rejected immediately with no debit. Idempotency key prevents duplicate submission.

**Cross-border payment network (Thunes) and Exchange network (Western Union):**
- Sender selects a payout type (Bank, Wallet, or Cash Pickup) constrained by what the destination corridor actually supports; required beneficiary fields vary by payout type (IBAN for bank, mobile number for wallet, agent ID for cash).
- Corridor availability, KYC, and sanctions are all validated *before* the sender's wallet is debited.
- Failed or expired transactions are refunded automatically; every request/callback pair is logged with a `batch_reference`, `provider_txn_id`, and `idempotency_key` for compliance traceability.

**FX-as-a-Service (rate booking):** user sees rate + spread/fee + expiry before confirming; confirming books the conversion with the provider and posts ledger entries; an expired quote requires a fresh requote rather than reusing a stale rate.

**BIN Sponsor integration (card programs):** supports two funding models. **Pre-Funded** — each card has its own account, topped up from the wallet; the sponsor authorizes directly against that prefunded amount, and EMI reflects updates via callback or daily reconciliation file. **Just-In-Time (JIT)** — the sponsor routes every authorization to EMI in real time; EMI validates the wallet balance/limits/rules and returns approve/decline on the spot, meaning there's a single consolidated wallet balance rather than per-card prefunding. Daily settlement/clearing files are reconciled against the EMI ledger; mismatches are flagged for manual override via an Ops dashboard.

**CRM integration:** EMI is the source of onboarding/service-request events; CRM is the source of truth for customer-relationship data. Sync in both directions must be idempotent (duplicate messages don't create duplicate records) and every sync event is logged with IDs/timestamps/status for audit.

**TANFEETH (SAMA regulatory reporting):** exposes profile listing, profile detail, account statement, and current-balance endpoints so the platform can report financial/profile information to SAMA. ⚠️ As written this story asks for "Available, Reserved, and Current" balances — the three-bucket model EMI-602 superseded; a regulator-facing endpoint should almost certainly expose the canonical four-bucket model instead (see findings doc).

**Wathiq (business KYB / CR lookup):** retrieves full commercial-registration details (brand name, CR status, authorized parties) and national-address details (city, street, coordinates) by CRN, for business KYB validation during registration.

**Nafath (delegated identity):** authenticates a user via delegated Nafath credentials and retrieves full identity details (name, ID/Iqama, contact info). Every authentication attempt gets a random verification number + transaction ID for traceability, with retry/expiry handling.

**Yakeen/Tahaqaq (mobile-ownership verification):** confirms the mobile number belongs to the person identified by their Iqama/national ID, as a registration-time check before any other verification proceeds.

**AML (watchlist + risk scoring):** screens a registering entity against a sanctions watchlist during onboarding, and separately obtains a risk-assessment score used to determine how much additional transaction scrutiny that user gets going forward. Decisions/updates can also arrive asynchronously via a callback.

**ANB Bank (omnibus banking):** links omnibus accounts, supports cash-out via IBAN transfer with real-time wallet updates, supports cash-in via a per-user Virtual IBAN (with a defined mechanism for handling unmatched or delayed inbound transfers), performs daily reconciliation between ANB statements and internal logs, and exposes a real-time balance inquiry for the linked omnibus account.

**Virtual IBAN generation:** every wallet (and every sub-wallet) gets a deterministic, fixed-24-character virtual IBAN in the format `SAxx30100766xxxxxxxxxxxx` (SA country code, fixed bank code `30`, fixed product ID `100`, fixed company prefix `766`, then a per-account identifier). Check digits (positions 3–4) are calculated via the MOD 97 algorithm over the *entire* IBAN, so any change to the account-number block requires recalculating the check digits — a sub-wallet's IBAN gets its own check-digit pair, not a suffix appended to the parent's IBAN.

**ERP integration:** the ERP system receives new-customer onboarding events, customer status updates, every transaction, and every third-party service-provider (Yakeen/Wathiq/Unifonic, etc.) usage event that has an associated cost — this is what lets finance reconcile platform activity against billed third-party usage.

**External API key management (admin):** admins can search users, generate/regenerate a per-user API key (shown once in a copy-able popup), and activate/deactivate keys — this is the access-control layer for anything exposed to external parties (attachment upload service, system lookups service, etc.).

---

## Core System (`EMI-79`)

**What it does:** Cross-cutting platform infrastructure that every other module depends on implicitly: proxying, modularity, real-time messaging, logging, translation, service discovery, and the API gateway. None of these carry business rules in the domain sense — they're the plumbing everything else runs on.

- **Legacy proxy**: a routing layer that forwards requests to the older integration service, adjusting headers/parameters as needed, so newer code doesn't have to speak the legacy service's dialect directly.
- **Modularity / lazy loading**: the Angular frontend is split into independent feature modules loaded on demand, to keep initial load time down.
- **Kafka**: the backbone for real-time, asynchronous data flow between microservices (producers/consumers) — this is the same mechanism the wallet-balance rebuild jobs (EMI-4537/4551) publish through.
- **Authentication logging**: every login, failed attempt, and password-reset request is captured in structured, securely-stored logs with timestamp and user context — separate from (and a precursor to) the SAMA 10-year audit retention requirement described in the Login module.
- **Translation service**: a backend translation API for multilingual UI text.
- **Service discovery**: lets microservices find each other by name rather than hardcoded address.
- **API gateway**: the single secure entry point that brokers communication between internal services and external clients/systems.

---

## Reconciliation Management System (`EMI-2177`)

**What it does:** A configurable engine that compares data between any two systems (banks, payment gateways, internal ledger vs. itself) and reports or auto-corrects discrepancies. This is the best-specified epic across the whole project — treat its structure as the reference model for any future reconciliation-adjacent story.

**The five building blocks, and how they compose:**
1. **System Types & Unified Schema** — an admin defines a "System Type" (e.g. Financial System, Orders System) and a normalized field schema for it (field name, data type, required flag, optional regex). Every other module downstream reads this schema rather than defining its own.
2. **Systems Management** — admins register actual systems (ANB, HyperPay, SADAD, EMI itself, a partner) and assign each one or more System Types; assigning a type reveals that type's ingestion-method section, where the actual connection details (API pull, SFTP, webhook, DB connection, Kafka/RabbitMQ listener) get configured per system. Every change goes through a maker-checker approval flow with full version history.
3. **Reconciliation Rules Engine** — a Rule Set is created independently, tied to exactly one System Type, and defines the matching dimensions (which schema fields to compare), the operator per dimension (Equals, Range/Tolerance, Regex, Contains, etc. — the available operators are constrained by the field's data type), and two rule-level alert actions: one for **mismatches** and one for **missing records** (ReportOnly / ReportAndSendEmail / ReportAndAutoAdjust / ReportAndAutoAdd / NoAction). Alerts are centralized at the rule level, not per-dimension. Changing a Rule Set's System Type resets all its dimensions, since they're schema-bound.
4. **Pair Management** — a Pair says "reconcile System A against System B, for System Type X, using Rule Set Y, on this schedule, notify these people, alert if variance exceeds this SLA threshold." Both systems must support the chosen System Type, and the Rule Set must belong to that same System Type — both are validated before a pair can be saved. Pair Management is explicitly ingestion-agnostic: it only ever reads already-normalized data, regardless of how that data got ingested.
5. **Reconciliation Run Engine** — executes a configured pair: loads pair + rule set + schema, fetches normalized data for both systems, detects records missing from either side, evaluates every candidate match across all configured dimensions to produce a decision vector (per-dimension OK/MISMATCH), and classifies each transaction as Matched / Discrepancy / Exception. Every step is logged to a timestamped run-event timeline, and the final report has views for Summary, Matched, Unmatched-in-A, Unmatched-in-B, Discrepancies, Exceptions, and Rules Applied — exportable as CSV/XLSX/JSON. Runs must be idempotent (a given run can't be reprocessed; a re-run gets a new run ID) and are performance-targeted at 10M+ records per run, ≥10,000 comparisons/second.

**Internal reconciliation (ledger self-consistency, distinct from the cross-system engine above):**
- Four specific checks run against the platform's own ledger: running balance vs. reconstructed balance from the transaction log; running balance vs. the wallets summary table; the aggregate of all wallets vs. the Control Wallet (see EMI-2008's hierarchy); and a ledger continuity check for missing/skipped/duplicate transaction sequences.
- **Rebuild job**: given a `from_date`/`to_date`, archive the existing `running_balance` rows to `running_balance_history`, replay the transaction log append-only to recompute balances per wallet, update the `wallets` table, and write a summary (wallets processed, transactions replayed, variance found) to `reconciliation_runs`. Can be triggered nightly (automatic, partial), manually (Finance Lead only, via Admin UI), or via API.
- Everything here is explicitly modeled after append-only, SOX/ISO-8583-aligned reconciliation practice: RMS never overwrites or deletes a ledger row — every correction is a new, audited insertion.

**External reconciliation (bank/gateway vs. system, the "reporting vs. system functions" split):**
- **Reporting functions** only *detect*: missing transactions on either side, amount/status/date mismatches, and bank-omnibus-balance vs. Control-Wallet mismatches.
- **System functions** *correct*: auto-inserting a missing bank transaction into the transaction log (with full metadata: reconciliation batch ID, source, inserted-by, timestamp) so it then flows through the normal PENDING/SUCCESS ledger pattern and updates `running_balance` automatically.
- Every reconciliation action — detection or correction — is logged in `reconciliation_runs` / `reconciled_txns`, with full timestamp and actor attribution, exportable for auditors.
