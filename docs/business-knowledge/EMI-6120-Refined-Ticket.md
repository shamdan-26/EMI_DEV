# EMI-6120 — BE: Create Transaction Ledger Balance Calculation API (Refined)

**Type:** Task &nbsp;|&nbsp; **Status:** Testing &nbsp;|&nbsp; **Priority:** Medium &nbsp;|&nbsp; **Sprint:** EMI - Sprint 77
**Parent story:** [EMI-5954 — Wallet Daily Close (EOD Open/Close Snapshot & Rebuild Anchor)](https://digitalcash.atlassian.net/browse/EMI-5954)
**Assignee:** Marah Shaheen &nbsp;|&nbsp; **Reporter:** Odey M. Khalaf
**Fix version:** Mjd Pay Release V6.9.0 (2026-10-04) &nbsp;|&nbsp; **Label:** `Wallet-Snapshotting`
**Confluence:** [Balance Calculation Rules Based on the Transaction Ledger](https://digitalcash.atlassian.net/wiki/spaces/EEMIE/pages/929366017/Balance+Calculation+Rules+Based+on+the+Transaction+Ledger)

Nothing here has been written back to Jira. This is a refined draft for review — treat the live ticket as the source of truth until this is pasted in or the ticket is edited directly.

**Revision history:** first pass 2026-09-24 (spec-only, no shipped API). This revision (2026-09-28) folds in Marah Shaheen's full QA-notes comment posted the same day, which ships the real endpoint, request/response contract, error codes, and a "ready for testing on DEV" handoff. Section 1a and everything from Section 6 onward is new in this revision.

---

## 1. As-is: what the ticket said originally (2026-09-24)

**Description (verbatim, unchanged since creation):**
> **Summary** — Create a new API in the Transaction Ledger Service to calculate all wallet balances based on the Transaction Ledger records.
>
> **Acceptance criteria**
> - Accept parameters: Wallet Code, From Date, and To Date.
> - Return the computed values required for Wallet Snapshot validation.
>
> **Other information**
> - Submission of a pull request (PR).
> - Code review by a Senior Engineer.

That's the entire spec, and it's still the entire *description* today — the description field itself was never updated. Everything below (the real endpoint, its contract, and the test plan) exists only in a comment, not in the ticket's own description/AC fields. A tester who reads only the description/AC — the fields Jira actually renders as "the ticket" everywhere except the comment thread — still gets nothing to test against.

---

## 1a. Update (2026-09-28) — the API has shipped, and a full QA handoff was posted

Marah Shaheen posted a comment titled **"QA Notes — EMI-6120 Transaction Ledger Balance Calculation API"** and tagged Sondos Hamdan directly: *"EMI-6120 is ready for testing on DEV."* This is the first time the ticket states an actual endpoint, request/response shape, error codes, or a base URL.

**This resolves the single biggest blocker from the first pass of this review**: the API's `/v3/api-docs` couldn't be found on `gateway-dev.majdpay.com` (401 on every candidate service, with both a business and an admin JWT) because **the API isn't on that gateway at all**. The real base URL is a different host entirely:

> **`https://gateway-emidev.dg-cash.app`** — not `gateway-dev.majdpay.com`.

Repo: `core-wallet/transaction-ledger`, merged to `dev` via MR !39. No database, Kafka, or configuration changes shipped with it.

A Postman collection (`EMI-6120-postings-summary.postman_collection.json`, 7 requests with test scripts) is referenced as "attached to this ticket separately" — **as of this revision it is not yet actually attached** (the ticket's attachment list is empty). Don't wait on it; everything needed to build one is in the comment and reproduced below.

---

## 2. Why this API exists (business context, from the parent story)

EMI-5954 ("Wallet Daily Close") introduces a nightly sealed snapshot per wallet: at a configured cutoff, the platform *reads* the last `running_balance` entry and freezes it as the day's closing figure. That read is fast, but it's blind — if the projection feeding `running_balance` has drifted from the ledger, the close would seal a wrong number with full confidence, and nothing would ever say so.

EMI-6120 is the fix for that blind spot. It's an **independent recomputation engine**: given a wallet code and a date range, it walks the raw Transaction Ledger directly — not the `wallets` live-balance cache, not the `running_balance` projection — and derives what the four balance buckets *should* be. That independently-derived number is what the Daily Close's sealed value gets checked against. The QA-notes comment confirms this in its own words: *"The EOD wallet snapshot (EMI-5954) uses it to validate wallet balances."*

Specifically, per EMI-5954's four-source verification model, this API is the engine behind:

| Source | Cadence | Role of this API |
|---|---|---|
| **Source 1 — incremental ledger check** | Daily, every wallet, every level | Prior sealed closing + this day's ledger postings, recomputed via this API, checked against the recorded closing |
| **Source 3 — absolute re-derivation** | Monthly per wallet; weekly for control/collections; on demand; **mandatory** before any superseded or migration-baseline close seals | Full replay of a wallet's entire ledger history via this API, from its first posting |

**Bottom line for stakeholders:** this is a correctness-of-money control, not a reporting convenience. If it under- or over-counts a bucket, a real drift could seal as `VERIFIED` and nobody would know until Source 4 (the external bank tie-out) eventually disagrees — by which point it's an incident, not a caught variance. Note 4 below (from the developer's own comment) qualifies exactly how far that guarantee actually reaches.

---

## 3. The business rule — now confirmed from three independent sources

The Confluence page, the original ticket comment (2026-09-24), and the QA-notes comment's own restatement (2026-09-28, in compact sign-table form) all agree — cross-checked line by line during this revision, no contradictions found. Reproduced here in the original per-status-table form (see Section 6 for the QA comment's equivalent compact sign notation, which is the more efficient form for writing table-driven test data):

**Three factors determine the impact of every ledger record on the requested wallet:**
1. **Transaction status** — `PENDING`, `SUCCESS`, `FAILED`, `PENDING_REVERSED`, `SUCCESS_REVERSED`, `FAILED_REVERSED`
2. **Direction** — is the requested wallet the `source` or the `destination` of this record?
3. **Wallet type** — read from `source_wallet_code` / `destination_wallet_code`. Value `CONTROL` (any letter case — confirmed explicitly in the QA notes) = control wallet; any other value = account wallet.

**The amount applied is always `destination_amount`.** The QA notes flag this itself as Open Question #1 (Section 6) — it is a deliberate match to `wallet-service`'s own behavior, not an oversight, but it has a real consequence for cross-currency/fee-bearing transfers.

### Account wallet as source

| Status | Balance changes |
|---|---|
| `PENDING` | Debit **Available**; Credit **Reserved Debit** |
| `SUCCESS` | Debit **Reserved Debit**; Debit **Current** |
| `FAILED` | Credit **Available**; Debit **Reserved Debit** |
| `PENDING_REVERSED` | Credit **Available**; Debit **Reserved Debit** |
| `SUCCESS_REVERSED` | Credit **Reserved Debit**; Credit **Current** |
| `FAILED_REVERSED` | Debit **Available**; Credit **Reserved Debit** |

### Account wallet as destination

| Status | Balance changes |
|---|---|
| `PENDING` | Credit **Reserved Credit** |
| `SUCCESS` | Debit **Reserved Credit**; Credit **Available**; Credit **Current** |
| `FAILED` | Debit **Reserved Credit** |
| `PENDING_REVERSED` | Debit **Reserved Credit** |
| `SUCCESS_REVERSED` | Credit **Reserved Credit**; Debit **Available**; Debit **Current** |
| `FAILED_REVERSED` | Credit **Reserved Credit** |

### Control wallet as source

| Status | Balance changes |
|---|---|
| `PENDING` | Debit **Reserved Debit**; Debit **Current** |
| `SUCCESS` | Debit **Available**; Credit **Reserved Debit** |
| `FAILED` | Credit **Reserved Debit**; Credit **Current** |
| `PENDING_REVERSED` | Credit **Reserved Debit**; Credit **Current** |
| `SUCCESS_REVERSED` | Credit **Available**; Debit **Reserved Debit** |
| `FAILED_REVERSED` | Debit **Reserved Debit**; Debit **Current** |

### Control wallet as destination

| Status | Balance changes |
|---|---|
| `PENDING` | Credit **Available**; Debit **Reserved Credit** |
| `SUCCESS` | Credit **Reserved Credit**; Credit **Current** |
| `FAILED` | Debit **Available**; Credit **Reserved Credit** |
| `PENDING_REVERSED` | Debit **Available**; Credit **Reserved Credit** |
| `SUCCESS_REVERSED` | Debit **Reserved Credit**; Debit **Current** |
| `FAILED_REVERSED` | Credit **Available**; Debit **Reserved Credit** |

24 combinations total (6 statuses × 2 directions × 2 wallet types). **New in this revision:** the QA notes state explicitly which statuses are *ignored* entirely — `PROCESSED`, `INITIATED`, `PAID`, `CANCELED` never contribute to any bucket, regardless of role or wallet type. That's a fifth fact about the rule the original Confluence table never stated, because it only ever listed the six statuses that *do* count.

**Relationship to EMI-602:** this is the same four-bucket model (`Available` / `Current` / `Reserved Debit` / `Reserved Credit`) defined canonically in EMI-602. The QA notes add a new, important cross-reference here (see Section 6, Note 5): the account-wallet rules are credited to EMI-6120 itself, but the **control-wallet rules are said to mirror `wallet-service`'s `ControlWalletRepository`** — and the developer states they *did* diff both rule sets against the live `wallet-service` code (`AccountWalletRepository` / `ControlWalletRepository` and its handler wiring), finding exactly one discrepancy, which is itself a live defect in `wallet-service`, not in this API. Full detail in Section 6, Note 5 — it matters for QA because it means a real EOD snapshot mismatch is *expected* for the affected transaction type until wallet-service is fixed, not evidence this API is wrong.

---

## 4. The real API contract (confirmed, from the QA-notes comment)

### `GET /api/v1/transactions-log/postings-summary`

**Base URL (DEV gateway):** `https://gateway-emidev.dg-cash.app`

**Auth:**
- The service itself has **no privilege check**.
- Through the gateway (`/api/v1/transactions-log/**`), it needs `Authorization: Bearer <token>` and passes `TokenValidationFilter` and `DeviceFingerPrintValidationFilter` — the same two gateway filters already confirmed for the Topup flow (`postman/Topup-API-majdpay.postman_collection.json`'s `device-finger-print` header), so a business-account JWT plus a device fingerprint should work here too, once pointed at the correct host.
- **Service-to-service calls (port 9095) need no auth at all** — relevant if EMI-5954's own EOD job calls this internally rather than through the gateway.

**Query parameters**

| Param | Type | Required | Notes |
|---|---|---|---|
| `walletCode` | String | yes | Matched against `source_reference` / `destination_reference` — **not** `source_wallet_code`/`destination_wallet_code` (those columns hold the *type*, read separately — see Section 6, Note 6, a naming choice the developer themselves flags as confusing). |
| `fromTime` | Instant | no | **Exclusive**: `date > fromTime`. Omit for a wallet's very first snapshot to include its whole history from the start. |
| `toTime` | Instant | no | **Inclusive**: `date <= toTime`. Omit for no upper bound. |

Both bounds are independently optional — omitting both returns the wallet's entire ledger history. Instant formats accepted: ISO-8601 (`2026-09-23T21:00:00Z`; URL-encode a `+` offset as `%2B`), epoch millis (`1790204400000`), or RFC-1123.

**curl (daily window):**
```
curl --location 'https://gateway-emidev.dg-cash.app/api/v1/transactions-log/postings-summary?walletCode=WAL-100000123&fromTime=2026-09-22T21:00:00Z&toTime=2026-09-23T21:00:00Z' \
  --header 'Authorization: Bearer <token>' \
  --header 'device-finger-print: <device-finger-print>'
```

**Response 200** — flat JSON, one object, both directions already netted into the same four fields:
```json
{
  "reserveDebit": 40.000000,
  "reserveCredit": 75.000000,
  "current": 150.000000,
  "available": 110.000000
}
```
No rows in the window:
```json
{ "reserveDebit": 0, "reserveCredit": 0, "current": 0, "available": 0 }
```

**This directly closes what was previously flagged as Gap #2 / `TC-LedgerCalc-09`'s open question** — the response shape is no longer unknown. Two things worth building test assertions around specifically because they're easy to get wrong in an automated check:
- **Field names are camelCase and abbreviated** (`reserveDebit`, `reserveCredit`, `current`, `available`), not the Title Case bucket names ("Reserved Debit") used throughout the rule tables — a case/spelling mismatch here would silently break an assertion rather than fail loudly.
- **Decimal precision is inconsistent by design**: `0` (bare integer) when nothing matched in the window, but 6 decimal places otherwise. The QA notes explicitly say to **compare values numerically**, not as strings — a string-equality assertion between `"0"` and `"0.000000"` would be a self-inflicted false failure, not a real defect.

**Errors** — body is the standard `ErrorMessageDto` list:

| When | Code | HTTP |
|---|---|---|
| `walletCode` missing | `MISSING_REQUIRED_PARAMETER` | 400 |
| `walletCode` empty or only spaces | `REQUIRED_FIELD` | 400 |
| `fromTime` / `toTime` not parseable | `INVALID_FIELD_VALUE` | 400 |
| both sent and `fromTime >= toTime` (**equal is rejected too**, not just reversed) | `INVALID_DATE_RANGE` | 400 |

```json
[
  {
    "httpStatusCode": 400,
    "message": {
      "messageCode": "INVALID_DATE_RANGE",
      "messageType": "ERROR",
      "originalText": "The date range provided is invalid. Please provide a valid range.",
      "language": "English",
      "languageCode": "en_UK",
      "plainText": "The date range provided is invalid. Please provide a valid range."
    },
    "requestTime": null,
    "requestedUri": null
  }
]
```
The developer flags that this exact wording/status comes from `translation-service`'s local seed data (`cms/translation-service` V1.2, V1.25, V12.1) and **the deployed environment's seed data may differ** — assert on `messageCode`, not on `plainText`, for anything that needs to survive a translation-content change.

**This directly closes the original Gap #3** ("no stated error/edge-case behavior") — `TC-LedgerCalc-07`/`08`'s expected results ("a clear validation error") can now be tightened to the exact codes above.

---

## 5. Refined description & acceptance criteria (updated for this revision)

### Description

> **Summary**
> `GET /api/v1/transactions-log/postings-summary` (Transaction Ledger service, `core-wallet/transaction-ledger`, base URL `https://gateway-emidev.dg-cash.app` on DEV) independently recomputes a wallet's four balance buckets — `available`, `current`, `reserveDebit`, `reserveCredit` — directly from Transaction Ledger records over an optional `fromTime`/`toTime` window, keyed on `walletCode`. No dependency on the `wallets` live-position cache or the `running_balance` projection.
>
> This is the recomputation engine behind Wallet Daily Close (EMI-5954) verification Sources 1 and 3.
>
> **Business rules**
> Apply the balance-impact rules in Section 3 above. Statuses `PROCESSED`, `INITIATED`, `PAID`, `CANCELED` are ignored entirely. Wallet type is read from `source_wallet_code`/`destination_wallet_code` (`CONTROL`, any case, vs. account); `walletCode` itself is matched against `source_reference`/`destination_reference`. Amount is always `destination_amount`.

### Acceptance criteria (updated — items resolved by the QA-notes comment are marked)

- Accepts `walletCode` (required), `fromTime` (optional, exclusive), `toTime` (optional, inclusive). ~~Original AC said "Wallet Code, From Date, To Date" without stating optionality or inclusivity — now confirmed.~~
- Returns `{available, current, reserveDebit, reserveCredit}` as a flat JSON object, correct across all 24 status × direction × wallet-type combinations, with the four ignored statuses contributing nothing. **(Response shape — previously unknown, now confirmed.)**
- A wallet appearing as both source and destination within the range — including a **self-transfer, counted on both sides of the same row** (new, explicit in the QA notes' suggested test list) — has both roles' impacts applied.
- A wallet with no ledger activity in the range, or an unknown wallet code, returns `200` with all-zero buckets — **not a 4xx**. This is a correction to the previous revision's proposed AC, which (reasonably, absent the real contract) recommended rejecting an unknown wallet code with an error. The shipped behavior instead folds "unknown wallet" and "known wallet, no activity" into the same all-zero response; only a malformed/missing parameter or an invalid date range gets a 4xx (see the error table above).
- `fromTime > toTime` **or `fromTime == toTime`** is rejected with `400 INVALID_DATE_RANGE`. **(Previously just "an invalid range is rejected"; now the exact code and the equal-bound case are confirmed.)**
- Missing/blank `walletCode` and unparsable time values are rejected with the specific codes in the error table above, not a generic 400.
- Reversal statuses are exercised, and so are the four **ignored** statuses (new coverage need — a window containing only ignored-status rows must still return all-zeros, not an error).

### Other information

- PR merged (MR !39, `dev`) and, per the ticket, already reviewed enough to be handed to QA — confirm formal Senior Engineer sign-off is recorded if that's a release gate, separately from the QA pass.
- The response's exact numeric semantics (camelCase field names, `0` vs. 6-decimal formatting) should be called out explicitly in any automated assertion, per Section 4 above.

---

## 6. The developer's own Notes & Open Questions (reproduced — these are unresolved by design, not omissions)

These nine points are the developer's own words from the QA-notes comment, kept intact because they define what "correct" *doesn't* yet mean for this API, and because several of them directly bound how a test result should be interpreted:

1. **Amount on the source side.** The source side sums `destination_amount`, not `source_amount`. For cross-currency/FX transfers, or any row where the two differ (fees?), the source wallet's totals could be in the wrong currency or amount. Open question to the business: *is `source_amount` ever different from `destination_amount` in this ledger?* Dev's own note: this matches `wallet-service`, which applies `destinationAmount` to both wallets in every balance handler — so it's a deliberate parity choice, not an independent bug, but the underlying question is still open.
2. **Currency is ignored.** Rows are summed regardless of currency. Fine only if each wallet is single-currency, which is not enforced here.
3. **Timezone.** `Instant` becomes a `java.sql.Timestamp` compared against a zone-less `datetime2` column, using the **JVM default timezone** — no `hibernate.jdbc.time_zone` setting or TZ found in the repo or Dockerfile. If `date` is written in KSA local time (UTC+3) but a caller sends UTC instants, the window silently shifts by 3 hours. **Action for QA:** confirm how `date` is actually written and what timezone the pods run in, then specifically test windows that straddle midnight UTC and midnight KSA — this is the single highest-value edge case in the whole ticket, because a silent 3-hour shift would misfile transactions into the wrong day's snapshot without any error at all.
4. **This is a delta, not a balance.** The values are absolute balances only when `fromTime` is omitted, and even then only if the wallet started at zero with its complete history in `transaction_log`. Opening balances, migrated wallets, and out-of-ledger adjustments would not appear. The original ticket's own wording — "calculate all wallet balances" — should be checked against how EMI-5954 actually consumes this before anyone assumes "balance" means "absolute balance."
5. **Control-wallet rules are inherited, and one known mismatch exists.** Control-wallet rules mirror `wallet-service ControlWalletRepository`; account-wallet rules are original to EMI-6120. Both were diffed against the live `wallet-service` code. **One confirmed discrepancy: `wallet-service` swaps the `PENDING_REVERSED` and `SUCCESS_REVERSED` handlers when the destination is a control wallet** (`TransactionTypeConfiguration`). This API uses the *correct* rules — so **EOD snapshot validation will flag a mismatch for exactly those transactions until wallet-service's swap bug is fixed.** For QA: if a snapshot-validation test fails specifically on a `PENDING_REVERSED`/`SUCCESS_REVERSED` control-destination transaction, that is `wallet-service`'s bug surfacing correctly, not a defect in this API — don't misfile it as an EMI-6120 regression.
6. **Parameter name vs. column confusion.** `walletCode` matches the `*_reference` columns, while wallet *type* is read from the differently-named `*_wallet_code` columns. A caller could plausibly pass the wrong identifier given the name overlap.
7. **Untested against a real database.** The `fromTime`/`toTime` null-handling SQL (`(:from IS NULL OR t.date > :from)` / `(:to IS NULL OR t.date <= :to)`) has only been unit-tested against mocks. **Needs at least one real-SQL-Server test for each null path** — this is exactly the kind of thing that passes every mock test and then behaves differently against a real query planner/collation.
8. **Gateway fingerprint filter risk.** If EOD jobs are meant to call this service-to-service (port 9095, no auth), that's fine; if they instead go through the gateway, `DeviceFingerPrintValidationFilter` may block a server-side caller that has no device fingerprint to send.
9. **Error status mapping is environment-dependent.** The 400 statuses above come from `translation-service`'s local seed data; the deployed environment's data may differ. Assert on `messageCode`, not on the literal HTTP status pairing, until that's confirmed live.

---

## 7. The developer's own suggested test cases (from the QA-notes comment)

Reproduced in full since these are the acceptance bar the developer themselves proposed, cross-referenced below against what this repo's manual suite (`TC-LedgerCalc-01..09`) already covers vs. what's net-new:

**Positive**
- [x] *(TC-LedgerCalc-01..04)* Account/control wallet as source/destination: each of the 6 statuses.
- [ ] **New.** Lower-case `control` is still treated as a control wallet.
- [ ] **New.** PENDING → SUCCESS (source and destination, account and control): reserves net to 0.
- [ ] **New.** PENDING → FAILED: all zeros.
- [ ] **New.** Full reversal PENDING → SUCCESS → SUCCESS_REVERSED → PENDING_REVERSED: all zeros.
- [ ] **New.** The worked example in Section 4 returns exactly `40 / 75 / 150 / 110`.
- [ ] **New.** `fromTime` omitted: every row up to `toTime` included.
- [ ] **New.** `toTime` omitted: every row after `fromTime` included.
- [ ] **New.** Both omitted: the whole ledger history for the wallet.
- [x] *(TC-LedgerCalc-05, close cousin)* Self-transfer (same wallet as source and destination): the row is counted on **both** sides — TC-LedgerCalc-05 covers a wallet acting as source in one record and destination in another, which is the more common "dropped or doubled leg" risk; this is the stricter same-row variant and is still net-new.
- [ ] **New.** Epoch-millis and RFC-1123 timestamps give the same result as ISO-8601.

**Negative**
- [ ] **New, but supersedes `TC-LedgerCalc-07`/`08`'s generic wording.** `walletCode` missing → `400 MISSING_REQUIRED_PARAMETER`.
- [ ] **New.** `walletCode` empty/whitespace-only → `400 REQUIRED_FIELD`.
- [x→refine] `fromTime` after `toTime` → `400 INVALID_DATE_RANGE` (`TC-LedgerCalc-07` already covers "after"; needs its expected result tightened to the exact code).
- [ ] **New.** `fromTime` **equal to** `toTime` → also `400 INVALID_DATE_RANGE` — easy to miss since "equal" often gets treated as a valid zero-width range elsewhere.
- [ ] **New.** Malformed time (`2026-09-23`, `abc`, or an unencoded `+03:00` offset) → `400 INVALID_FIELD_VALUE`.
- [ ] **New.** Through the gateway with no Bearer token → rejected.

**Edge / boundary**
- [ ] **New.** Row with `date` exactly `= fromTime` → **excluded** (confirms the exclusive-lower-bound semantics).
- [ ] **New.** Row with `date` exactly `= toTime` → **included** (confirms the inclusive-upper-bound semantics).
- [ ] **New.** Rows just outside the window, including sub-millisecond differences → excluded.
- [ ] **New, flagged by the developer as needing confirmation, not just testing.** `fromTime=`/`toTime=` sent as an empty string: does it behave like the parameter being omitted? The ticket itself says "please confirm this is acceptable" — this is a design question as much as a test case.
- [x→refine] *(close cousin of `TC-LedgerCalc-06`)* Ignored-statuses-only window → all zeros. `TC-LedgerCalc-06` currently covers "no ledger records at all"; a window containing only `PROCESSED`/`INITIATED`/`PAID`/`CANCELED` rows is the same expected outcome by a different mechanism and is not yet a distinct case.
- [x] *(TC-LedgerCalc-06/08)* Unknown wallet, or a wallet with no rows → `200` with zeros — **note the correction from Section 5**: `TC-LedgerCalc-08`'s current expected result says an unknown wallet is *rejected*; per the shipped contract it is **not** rejected, it returns zeros identically to `TC-LedgerCalc-06`. This case needs its expected result corrected, not just extended.
- [ ] **New.** PENDING on day 1, SUCCESS on day 2: day 1 + day 2 as two separate calls equals one call covering both days.
- [ ] **New.** Consecutive windows `(a,b] + (b,c] = (a,c]`, with no double-counting and nothing dropped exactly at `b`.
- [ ] **New.** Large amounts and 6-decimal amounts render/compare correctly.

**Regression**
- [ ] **New.** Other `/api/v1/transactions-log/**` endpoints are unchanged.

**Important correction to carry into the manual suite:** `TC-LedgerCalc-08`'s current expected result ("An unknown Wallet Code is rejected with a clear error") **contradicts the shipped contract**, which returns `200` with all-zero buckets for an unknown wallet, identically to the zero-activity case. This needs fixing before anyone runs it, not just supplementing — as written it would fail against correct behavior.

---

## 8. Gaps found while refining — status as of this revision

1. ~~**Duplicate rule source.**~~ Still open — the rules exist in the Confluence page, the 2026-09-24 comment, *and* now a third restatement in the 2026-09-28 QA-notes comment (as a compact sign table). Three copies now, not two. None reference each other. Recommend the QA-notes comment's sign-table form become canonical for automated test-data generation (it's the most compact and the one closest to the actual response fields), while the Confluence page stays canonical for the prose rule.
2. ~~**No output schema in the ticket.**~~ **Resolved.** Confirmed in Section 4.
3. ~~**No stated error/edge-case behavior.**~~ **Resolved for errors** (exact codes in Section 4). **Partially reversed for "unknown wallet"** — the earlier proposed AC guessed rejection; the real behavior is `200` all-zero (Section 5, Section 7).
4. ~~**Silent aggregation ambiguity.**~~ **Resolved** — same-row self-transfer and cross-record dual-role are both explicitly called out in the developer's own suggested tests (Section 7).
5. **New — wrong gateway assumed in the previous revision.** The first pass of this review spent significant effort trying to find this API on `gateway-dev.majdpay.com` / `gateway-uat.majdpay.com` and concluded it was blocked behind an inaccessible auth layer. It was never on that gateway — `gateway-emidev.dg-cash.app` is a different host. Worth flagging to whoever maintains `BusinessTestCases/ServiceApis/README.md`'s swagger-ui inventory, since that doc's gateway list doesn't mention this host at all; either this service isn't in that inventory yet, or it's intentionally on a separate gateway for a reason worth documenting.
6. **New — timezone risk (Section 6, Note 3) is the highest-priority untested edge case.** Silent, wrong-by-3-hours results with no error are far worse for a correctness control than a loud failure. This should be the first thing exercised once real test access exists, ahead of the combinatorial status/role/type matrix.
7. **New — `TC-LedgerCalc-08` needs correcting, not extending**, per Section 7's note. Flagged separately here so it isn't lost among the many net-new suggested cases.
8. **New (2026-09-30) — `GET /api/v1/transactions-log/postings-summary` returns 404 on `gateway-emidev.dg-cash.app`, and this is now confirmed to be a real routing gap, not a connectivity or timeout issue.** Live checks this session: the gateway itself is healthy (`/devices/ip-address` → 200, `/v3/api-docs/swagger-config` → 200), and the exact documented sample request (`walletCode`, `fromTime`, `toTime`, no auth needed to get this far) returns the gateway's own generic 404 page — the same shape a genuinely-unrouted path returns elsewhere in this repo's exploration (see `docs/business-knowledge/EMI-6127-Refined-Ticket.md`'s gateway-404 checks for the same error envelope). More decisively: **every one of the 27 services registered in this gateway's own `/v3/api-docs/swagger-config` was checked, and none of their OpenAPI specs contain any `/api/v1/transactions-log/**` path** — there is no "Transaction Ledger" service in the registry at all (only `transaction-command-log-service` and `transaction-query-log-service`, neither of which expose it). Either this service was deployed after this environment's gateway last refreshed its swagger aggregation, `gateway-emidev.dg-cash.app` is genuinely not where the QA-notes comment's author actually tested it, or the service was since removed/renamed. This blocks `TC-LedgerCalc-01..34` from running at all today — confirm the correct current host/service registration with the ticket owner before re-attempting, rather than continuing to treat this as a transient network issue.
