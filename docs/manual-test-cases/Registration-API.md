# Manual Test Cases — Registration API

Context: the API layer behind Business-portal Merchant registration (`emi-profile-service`, base URL `https://gateway-dev.majdpay.com`) — mobile OTP, identity establishment, file uploads, NAFATH initiation, product selection, contract acceptance, session refresh, and the public lookup endpoints the wizard's dropdowns depend on. Unlike the other Registration docs in this folder (which describe the UI wizard), these cases target the endpoints directly and are also runnable by hand via `postman/Registration-API-majdpay.postman_collection.json`.

IDs here match the existing Playwright test titles verbatim (`API-01` etc. already appear as literal prefixes inside `RegistrationAPIFlow.spec.ts` / `RegistrationSessionRefresh.spec.ts`), rather than a new numbering scheme, so all three artifacts — this doc, the Postman collection, and the automated spec — stay directly cross-referenceable.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Phone Entry

Context: sending and verifying the mobile OTP that starts a registration session.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-01 | Send mobile OTP for an unregistered number | `POST /emi-profile/api/v1/register/mobile/otp` with a fresh KSA mobile number | 200 OK. If `otpRequired` is `true`, a `requestId` is returned; if `false`, `sessionToken`/`refreshToken` objects are returned directly (EMI-5995/EMI-6059) | P1 |
| API-02 | Read the OTP settings for registration | `GET /otp/otp-settings/q?operationCode=REGISTRATION` (public, no token) | 200 OK with `length`, `validityInSeconds`, `canResendOtpAfterInSeconds` | P2 |
| API-03 | Verify the OTP | `POST /emi-profile/api/v1/register/verify/otp` with the mobile number and the correct OTP (dev/UAT accept a fixed `000000`) | 200 OK with a `sessionToken` object (`{token, expirationDuration}`) and a `refreshToken` object (EMI-5995/EMI-6059) | P1 |
| API-04 | Resend the mobile OTP | `POST /emi-profile/api/v1/register/mobile/otp/resend` for a mobile that already requested one | 200 OK with a fresh `requestId` and `otpRequired: true` | P2 |
| API-N1 | Reject an invalid mobile format | `POST /register/mobile/otp` with `mobileNumber: "123"` | 400 Bad Request | P2 |
| API-N2 | Reject a wrong OTP | `POST /register/verify/otp` with a deliberately wrong 6-digit code | 400 Bad Request with an `errorCode` in the body | P1 |
| API-N12 | Mobile OTP works without a session token (negative control) | `POST /register/mobile/otp` with no `Authorization` header at all | Not `401` — this OTP-stage endpoint must never start requiring auth (EMI-5751) | P1 |

## B. Business Info

Context: establishing the applicant's identity and submitting the registration form.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-05 | Set the profile registration type | `POST /register/profile-registration-type` with `profileType: MERCHANT`, `unifiedNumber` (CRN), `nationalId`, `email`, `Authorization: Bearer <sessionToken>` | 201 Created on a fresh identity. A `409` (or a 400 mentioning "already registered"/"duplicate") on an identity reused from a prior run is an expected outcome, not a defect | P1 |
| API-06 | Upload the IBAN proof file | `POST /file/attachment/upload?unifiedNumber={crn}&fileType=iban`, multipart `file` field | 200 OK with a `fileId` | P1 |
| API-07 | Upload the VAT certificate file | `POST /file/attachment/upload?unifiedNumber={crn}&fileType=vat`, multipart `file` field | 200 OK with a `fileId` | P1 |
| API-08 | Submit the full registration | `POST /register` with bank/industry/annual-income codes, IBAN, VAT number, and the two `fileId`s from API-06/07 | 200 OK (a `profileCode` is returned when the backend has assigned one) | P1 |
| API-N3 | Reject profile-registration-type with no token | `POST /register/profile-registration-type` with no `Authorization` header | 401 Unauthorized | P1 |
| API-N4 | Reject an invalid National ID | `POST /register/profile-registration-type` with a National ID that fails validation (e.g. wrong check digit) | 400 Bad Request with `errorCode` matching `INVALID-NATIONAL-ID` | P2 |
| API-N6 | Reject registration submission with no token | `POST /register` with no `Authorization` header | 401 Unauthorized | P1 |

## C. NAFATH

Context: initiating the NAFATH identity-verification redirect. NAFATH approval itself happens on the applicant's device and is out of scope for API testing.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-09 | Initiate NAFATH | `POST /register/uri/status` with `Authorization: Bearer <sessionToken>`, empty body | 200 OK with a `uri` field (the NAFATH redirect URL) | P1 |
| API-N7 | Reject NAFATH initiation with no token | `POST /register/uri/status` with no `Authorization` header | 401 Unauthorized | P1 |

## D. Products

Context: listing and assigning the products the merchant enrolls in.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-10 | List available products | `GET /products` with `Authorization: Bearer <sessionToken>` | 200 OK, a non-empty array of `{id, name, ...}` | P1 |
| API-11 | Assign selected products | `POST /register/products` with `productIds: [id]` | 200 OK | P1 |
| API-N5 | Reject the products list with no token | `GET /products` with no `Authorization` header | 401 Unauthorized | P1 |
| API-N8 | Reject product assignment with no token | `POST /register/products` with no `Authorization` header | 401 Unauthorized | P1 |

## E. Contract

Context: previewing, accepting, and downloading the registration contract.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-12 | Preview the contract | `GET /contracts/preview?profileCode={code}` with `Authorization: Bearer <sessionToken>` | 200 OK | P1 |
| API-13 | Accept the contract | `POST /register/contract/accept` with `productIds`, `contractAccepted: true` | 200 OK — completes registration (creates a "Pending Manual KYB" profile per EMI-122, not an active account) | P1 |
| API-14 | Download the contract PDF | `GET /contracts/generate-file?profileCode={code}` | 200 OK, a PDF file | P2 |
| API-15 | The just-registered account cannot sign in yet | `POST /auth/signin` with the newly registered mobile number and any password | Not `200` — no wallet, Company Number, or login credentials exist until an admin reviews and activates the account (EMI-122) | P1 |
| API-N9 | Reject contract preview with no token | `GET /contracts/preview?profileCode=TEST-0001` with no `Authorization` header | 401 Unauthorized | P1 |
| API-N10 | Reject contract PDF download with no token | `GET /contracts/generate-file?profileCode=TEST-0001` with no `Authorization` header | 401 Unauthorized | P1 |
| API-N11 | Reject contract acceptance with no token | `POST /register/contract/accept` with no `Authorization` header | 401 Unauthorized | P1 |

## F. Session Refresh (EMI-5995 / EMI-6059)

Context: refreshing the registration session token mid-flow without restarting registration. Most cases here need a live session and are env-gated (`REGISTRATION_SESSION_TOKEN` / `REGISTRATION_REFRESH_TOKEN`) because reaching one requires clearing NAFATH, which is not automatable on UAT.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RSR-01 | Mobile OTP response shape | `POST /register/mobile/otp` | Response has `sessionToken`/`refreshToken` keys present (populated only when `otpRequired: false`, otherwise `null`) | P2 |
| RSR-02 | Verify-OTP response shape | `POST /register/verify/otp` on a live session | Both `sessionToken` and `refreshToken` are populated `{token, expirationDuration}` objects (`expirationDuration` in **milliseconds**) | P1 |
| RSR-03 | A valid refresh issues a new session token | `POST /emi-profile/api/v1/register/session/refresh` with `Authorization: Bearer <sessionToken>` and a `refreshToken` **header** | 200 OK with a NEW `sessionToken.token`, different from the one sent in | P1 |
| RSR-03b | The refresh token must be a header, not a body field | Same request, but with `refreshToken` in the JSON body instead of the header | Not `200` — confirms the header-only contract (EMI-6059) | P2 |
| RSR-04 | An invalid refresh token is rejected | `POST /session/refresh` with a deliberately invalid `refreshToken` header | 4xx (400/401/403) | P2 |
| RSR-04b | Refreshing without an active registration session is rejected | `POST /session/refresh` with a valid `refreshToken` header but no `Authorization` | 4xx | P2 |
| RSR-05 | A refreshed session continues the same registration | Compare `GET /register/status` before and after a refresh | The registration step/state is unchanged — no restart | P1 |
| RSR-06 | Registration refresh tokens are isolated from login | `POST /auth/refresh` with a registration `refreshToken` | Not `200` — the two refresh-token families are not interchangeable | P2 |
| RSR-06b | A registration session token cannot authenticate a post-login API | `GET /transactions` with a registration `sessionToken` as the bearer token | Not `200` (401/403) | P2 |

## G. Lookups (public)

Context: the read-only reference-data endpoints the wizard's dropdowns populate. None require an `Authorization` header.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| API-L1 | List industries | `GET /emi-profile/api/v1/industries` | 200 OK, non-empty array | P2 |
| API-L2 | List banks | `GET /api/v1/lookup/banks` | 200 OK, non-empty array | P2 |
| API-L3 | List transfer purposes | `GET /api/v1/purpose-of-transfer` | 200 OK, array | P3 |
| API-L4 | List transaction types | `GET /api/v1/transaction-types` | 200 OK, array | P3 |
| API-L5 | List payment methods | `GET /api/v1/payment-method` | 200 OK, array | P3 |
| API-L6 | List annual income brackets | `GET /emi-profile/api/v1/annual-incomes` | 200 OK, non-empty array | P2 |
| API-L7 | List discount types | `GET /api/v1/discountTypes` | 200 OK, array | P3 |
| API-L8 | List profile registration type options | `GET /emi-profile/api/v1/register/profile-registration-type` | 200 OK, non-empty array | P2 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration API. The corresponding automated specs are:

- `BusinessTestCases/Registration/api/RegistrationAPIFlow.spec.ts` — the 22-endpoint happy-path chain (`API-01`..`API-15`), negative/auth checks (`API-N1`..`API-N12`), and the public lookup endpoints (`API-L1`..`API-L8`)
- `BusinessTestCases/Registration/api/RegistrationSessionRefresh.spec.ts` — the session-refresh mechanism (`RSR-01`..`RSR-07`), EMI-5995 (BE) / EMI-6059 (FE Web)

The same coverage is also runnable by hand or via Newman as `postman/Registration-API-majdpay.postman_collection.json` (see `postman/README.md`) — its 38 requests are grouped into the same eight sections as this doc (Phone Entry / Business Info / NAFATH / Products / Contract / Session Refresh / Lookups / Negative checks) and numbered in the same order as `RegistrationAPIFlow.spec.ts`'s endpoint list.

Supporting helper: `BusinessTestCases/Registration/RegistrationHelper.ts` (`DEV_OTP_ASSETS` pool, `getOtpFromDb`, `generateEmail`, `VALID_IBAN`/`VALID_VAT_NUMBER`, `TEST_FILE_BUFFER`).
