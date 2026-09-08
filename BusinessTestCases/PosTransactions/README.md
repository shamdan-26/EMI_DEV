# PosTransactions — POS transactions, ledger, ACH transfers and terminal callback

Was an API-only feature folder. EMI-6011 (Business POS device transactions),
EMI-6013 (Admin POS device transactions) and EMI-6015 (Admin ACH Records)
shipped the first POS **web screens**, so this folder now also has a `ui/`
subfolder and a `pageElements/PosTransactions/` mirror. It follows the normal
POM + per-feature-folder convention — it is not an exception to it — but it is
no longer comparable to `Reconciliation/` and `TransactionOperations/`, which
remain genuinely API-only.

| File | Covers | Manual TCs |
|---|---|---|
| `api/PosBusinessTransactions.spec.ts` | `GET /api/v1/pos/transactions`, `.../terminals/{terminalId}` | TC-001..TC-025 |
| `api/PosBusinessLedger.spec.ts` | `GET /api/v1/pos/ledger/terminals/{id}`, `.../wallets/{ref}` | TC-026..TC-038 |
| `api/PosAdminTransactions.spec.ts` | `GET /api/v1/admin/pos/transactions`, `.../ledger` | TC-039..TC-049 |
| `api/PosAchTransfers.spec.ts` | ACH list, release, reject | TC-050..TC-077 |
| `api/PosTransactionCallback.spec.ts` | `POST /api/v1/pos/transactions/callback` | TC-078..TC-105 |
| `api/PosApiContractDefects.spec.ts` | EMI-60xx status/field defects on the same endpoints | — (EMI-6047..6055) |
| `api/PosCallbackDefects.spec.ts` | callback defects: reasons, PAN, malformed bodies, headers, idempotency, expiry | — (EMI-5978..5984, 6045, 6046) |
| `api/PosAchBatchSemantics.spec.ts` | mixed-batch release, reason length cap, beneficiary fields | — (EMI-6060, 6062, 6036, 6008) |
| `api/PosRefunds.spec.ts` | refund capture, linkage, cumulative cap, "no money moves" | TC-Refund-01..40 (EMI-5918) |
| `ui/PosDeviceTransactions.spec.ts` | Business + Admin POS device transaction screens | — (EMI-6011, 6013, 6053, 6037) |
| `ui/AchRecords.spec.ts` | Admin ACH Records screen | — (EMI-6015, 6063, 6064, 6065, 6036) |

The five `TC-nnn` files carry 121 tests, each titled with its manual-test id so
the suite and
`POS-API-Manual-Test-Cases.xlsx` stay traceable. The equivalent Postman
collection is in `postman/`. The three defect files and the two `ui/` files
have no manual-test ids — they are traceable by EMI ticket instead, since they
came from the Jira defect sweep rather than the original test plan.

`api/PosRefunds.spec.ts` is the odd one out: **EMI-5918 is To Do**, so all 18 of
its tests are gated behind `POS_REFUNDS_IMPLEMENTED=true` and report as skips
rather than red. The assertions are written in full — flip the flag once refund
capture ships, rather than softening them to get green. Its manual cases are the
"PoS Refunds" sheet of `docs/manual-test-cases/PoS-Transactions-V6.6.0/PoS
Transactions Test_Cases Release V6.6.0 - MASTER.xlsx`, not the POS-API workbook
the `TC-nnn` files trace to.

Its one behavioural trap is worth knowing: POS-REF-11 asserts a refund on a
zero-balance merchant is **captured, not rejected**. An earlier suite asserted
the opposite (`INSUFFICIENT_BALANCE`); current acceptance criteria say nothing is
rejected on balance grounds because no balance is touched. That case is the
regression guard, not a mistake.

```bash
npm run test:pos                 # the whole folder against dev
npx playwright test BusinessTestCases/PosTransactions/api/PosTransactionCallback.spec.ts
```

## Environment variables

None of these exist in `.env.*` yet. Every test that needs one skips with a
readable reason when it is absent, so the suite is safe to run half-configured.

| Variable | Needed for | Without it |
|---|---|---|
| `API_BASE_URL` | all | falls back to `https://gateway-dev.majdpay.com` regardless of `ENV` — the known gap that also affects Login/Registration/ForgotPassword API specs |
| `POS_DEVICE_FINGERPRINT` | all | uses the Login spec's placeholder, which the POS routes may not accept (see below) |
| `POS_ADMIN_TOKEN` | admin + ACH suites | those tests skip — the business sign-in flow cannot mint an admin token |
| `POS_CALLBACK_TOKEN` | callback suite | those tests skip |
| `POS_ADMIN_READONLY_TOKEN` | ACH privilege separation | those tests skip |
| `POS_NO_PRIVILEGE_TOKEN` | 403 checks | those tests skip |
| `POS_EXPIRED_TOKEN` | expired-token check | that test skips |
| `POS_MERCHANT_2_TOKEN`, `POS_OTHER_TERMINAL_ID`, `POS_OTHER_WALLET_REFERENCE` | cross-tenant security | those tests skip |
| `POS_TERMINAL_ID`, `POS_WALLET_REFERENCE`, `POS_MERCHANT_ID`, `POS_PROFILE_CODE` | test data | defaults to the API-reference examples |
| `POS_ACH_ALLOW_MUTATIONS`, `POS_ACH_AWAITING_BATCH_REF`, `POS_ACH_RELEASED_BATCH_REF` | ACH release/reject | those tests skip |
| `POS_UNRELATED_WALLET_CODE` | EMI-6052 cross-tenant wallet check | defaults to the wallet code in the EMI-6052 curl repro |

### Money-moving safety

`POST .../ach-transfers/release` sends a real payment instruction to the bank and
`.../reject` permanently kills a settlement batch. Every state-changing test is
gated behind **both** `POS_ACH_ALLOW_MUTATIONS=true` and an explicit
`POS_ACH_AWAITING_BATCH_REF`, so a routine `npm run test:pos` cannot pay or
cancel anything. Read-only cases (validation rejects, unknown refs, privilege
checks) run freely — they cannot change any transfer's state.

## Observed gateway behaviour vs. the API reference

Live probe of `gateway-dev.majdpay.com`, **2026-09-01**. These are unresolved —
raise them with the backend team before treating a red run as a broken suite.

| Request | Documented | Actually observed |
|---|---|---|
| `GET /api/v1/pos/transactions`, no headers | 401 | **404** |
| `GET /api/v1/pos/transactions`, headers but no token | 401 | **404** |
| `GET /api/v1/admin/pos/transactions`, no headers | 401 | 401 ✓ |
| `GET /api/v1/admin/pos/transactions`, headers but no token | 401 | **412 Precondition Failed** |
| Either path with a malformed `Authorization: Bearer junk` | 401 | **500 Internal Server Error** |

Three things follow:

1. **The business `/api/v1/pos/**` route looks unregistered on dev.** It answers
   404 where the admin route answers 401/412 — the admin route is clearly wired
   up, the business one is not. Until that is fixed, the business, ledger and
   callback suites cannot pass on dev no matter what credentials are supplied.

2. **A malformed token returns 500, not 401.** Worth raising on its own: rejecting
   bad credentials with a server error is a defect, and it means the negative
   auth tests fail for the wrong reason.

3. **412 suggests the device fingerprint is validated against the platform's
   secret key.** The placeholder `test-fingerprint-hash-api-testing` inherited
   from `Login/api/LoginAPIFlow.spec.ts` is accepted by the auth endpoints but
   probably not by the POS routes — a real provisioned fingerprint may be needed
   via `POS_DEVICE_FINGERPRINT`.

The auth assertions in these specs deliberately keep the **documented** status
codes. If the team decides 412/500 are intended, change the assertions then —
do not loosen them just to make the suite green.
