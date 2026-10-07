# Automation Registry

This file serves as our central, living registry for all automated test suites and individual test cases currently written in the project.

<!-- AUTOMATION_REGISTRY_START -->

## 1. Authentication (Login)
**File Reference:**
`BusinessTestCases/Login/api/LoginAPIFlow.spec.ts`
`BusinessTestCases/Login/api/LoginNafathWathiqExpiry.spec.ts`
`BusinessTestCases/Login/functional/LoginFormValidation.spec.ts`
`BusinessTestCases/Login/functional/LoginInvalidCredentials.spec.ts`
`BusinessTestCases/Login/functional/LoginOtpFlow.spec.ts`
`BusinessTestCases/Login/functional/LoginHappyPath.spec.ts`
`BusinessTestCases/Login/functional/LoginNavigation.spec.ts`
`BusinessTestCases/Login/functional/LoginSecurity.spec.ts`
`BusinessTestCases/Login/ui/LoginPage.spec.ts`
`BusinessTestCases/Login/ui/LoginValidationPopup.spec.ts`

### `Login/api/LoginAPIFlow.spec.ts`
*(3-step pre-auth + sign-in chain: GET /devices/ip-address → POST /devices/uuid → POST /auth/signin → POST /auth/verify/otp)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| API-01: should return 200 | Positive | Asserts `GET /devices/ip-address` returns HTTP 200. |
| API-01a: response should contain an ipAddress field | Positive | Asserts the response body has a non-empty string `ipAddress` field. |
| API-01b: response should use JSON content-type | Positive | Asserts the `content-type` header matches `application/json`. |
| API-02: should return 200 with a UUID | Positive | Asserts `POST /devices/uuid` returns 200 with a body containing a `uuid` property. |
| API-02a: uuid should be a non-empty string in UUID format | Positive | Asserts `uuid` matches the standard UUID regex format. |
| API-02b: response should use JSON content-type | Positive | Asserts the content-type header is JSON. |
| API-N1: should return 400 when body is empty | Negative | Asserts an empty request body is rejected with 400/422. |
| API-N2: should return 400 when deviceId is missing | Negative | Asserts a missing `deviceId` field is rejected with 400/422. |
| API-03: should return 200 with valid credentials | Positive | Asserts sign-in with a valid username/password/tenant returns 200. |
| API-03a: response body should contain an accessToken object | Positive | Asserts `accessToken` carries `token`, `expirationDuration`, `profileId`, `username`, `userId`, and `tenantNumber`. |
| API-03b: accessToken.token should be a non-empty string | Positive | Asserts the token field is a non-empty string. |
| API-03c: accessToken.tenantNumber should match the submitted tenant | Positive | Asserts the returned `tenantNumber` equals the submitted value. |
| API-03d: accessToken.expirationDuration should be a positive number | Positive | Asserts `expirationDuration` is numeric and greater than 0. |
| API-03e: response should use JSON content-type | Positive | Asserts the content-type header is JSON. |
| API-N3: should return 400 when body is empty | Negative | Asserts an empty sign-in body is rejected with 400/422. |
| API-N4: should return 400 when username is missing | Negative | Asserts a missing `username` is rejected with 400/422. |
| API-N5: should return 400 when password is missing | Negative | Asserts a missing `password` is rejected with 400/422. |
| API-N6: should return 400 when tenantNumber is missing | Negative | Asserts a missing `tenantNumber` is rejected with 400/422. |
| API-N7: should return 401 with a wrong password | Negative | Asserts a wrong password returns 401. |
| API-N8: should return 401 with an unrecognised tenant number | Negative | Asserts an unknown `tenantNumber` returns 401. |
| API-N9: should return 401 with an unrecognised username | Negative | Asserts an unregistered username returns 401. |
| API-N10: should return 400 or 401 when mobile is sent without +966 country code | Negative | Asserts a mobile number missing the country code is rejected with 400/401. |
| API-S1: error response should not expose stack traces or database details | Negative | Asserts the error response body for wrong credentials doesn't match stack/exception/sql/ORA-/JDBC patterns. |
| API-S2: error status should be identical whether tenant or username is wrong (prevents enumeration) | Negative | Asserts a wrong-tenant attempt and a wrong-username attempt return the same HTTP status. |
| API-S3: GET to /auth/signin must not return 200 — credentials must not appear in URLs | Negative | Asserts a `GET` on the sign-in endpoint does not return 200. |
| API-04: should return 200 with valid OTP (dev env — OTP is 00000000) | Positive | Asserts OTP verification with the correct OTP and a bearer token returns 200/201 (skipped if sign-in produced no access token). |
| API-N11: should return 401 with an incorrect OTP | Negative | Asserts an incorrect OTP returns 401. |
| API-N12: should return 400 when OTP field is missing | Negative | Asserts a missing `otp` field returns 400/422. |
| API-N13: should return 401 when Authorization header is missing | Negative | Asserts a missing `Authorization` header returns 401. |
| API-FLOW-01: should complete the full pre-auth and sign-in chain successfully | Positive | Chains IP lookup → device UUID registration → sign-in, asserting each step succeeds and the final access token is non-empty. |

### `Login/api/LoginNafathWathiqExpiry.spec.ts`
*(EMI-5836 — login blocked when NAFATH/WATHIQ document or Redis-TTL data has expired, plus revalidation flows and deactivation scope. Ticket title says "Yaqeen"; the ticket text itself only ever discusses NAFATH and WATHIQ — flagged in the file header, not assumed to be a third system.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| NW-01: should return 409 when NAFATH document data has expired | Negative | Asserts `POST /auth/signin` returns 409 for a dedicated expired-NAFATH account. Skipped unless `NAFATH_EXPIRED_COMPANY`/`NAFATH_EXPIRED_MOBILE` are set. |
| NW-01a: 409 response body should carry error code NAFATH_DATA_EXPIRED | Negative | Asserts the response body contains `NAFATH_DATA_EXPIRED`. Same skip condition as NW-01. |
| NW-01b: error response should not expose stack traces or database details | Negative | Asserts the 409 body text doesn't match stack/exception/sql/ORA-/JDBC patterns. Same skip condition. |
| NW-02: should return 409 when WATHIQ document data has expired | Negative | Asserts 409 for a dedicated expired-WATHIQ account. Skipped unless `WATHIQ_EXPIRED_COMPANY`/`WATHIQ_EXPIRED_MOBILE` are set. |
| NW-02a: 409 response body should carry error code WATHIQ_DATA_EXPIRED | Negative | Asserts the response body contains `WATHIQ_DATA_EXPIRED`. Same skip condition as NW-02. |
| NW-02b: error response should not expose stack traces or database details | Negative | Asserts the 409 body text doesn't match stack/exception/sql/ORA-/JDBC patterns. Same skip condition. |
| NW-03: login should still succeed (200) for an account with no NAFATH/WATHIQ expiry | Positive | Regression check against the standard `VALID_COMPANY`/`VALID_MOBILE` account — always runs. |
| NW-04: should return 409 distinguishing TTL/cache expiry from document expiry | Negative | `test.skip(true, ...)` — pending a way to seed a NAFATH Redis-TTL-only-expired state; intended assertions documented inline. |
| NW-05: should not require the user to physically re-present ID — only NAFATH Generate Random + Get Status re-verification | Negative | `test.skip(true, ...)` — same pending reason as NW-04. |
| NW-06: login should succeed once the background TTL-monitoring job has refreshed WATHIQ data automatically | Positive | `test.skip(true, ...)` — pending WATHIQ TTL seeding/job-trigger access. |
| NW-07: login should be blocked with WATHIQ_DATA_EXPIRED if the TTL-refresh job discovers the CRN itself has since expired | Negative | `test.skip(true, ...)` — same pending reason as NW-06. |
| NW-08: successful re-verification should clear is_nafath_data_expired and allow login | Positive | `test.skip(true, ...)` — pending confirmed NAFATH renewal endpoint paths from the Emi Profile Service Swagger doc. |
| NW-09: a failed/abandoned re-verification should leave the account blocked with 409 NAFATH_DATA_EXPIRED | Negative | `test.skip(true, ...)` — same pending reason as NW-08. |
| NW-10: successful CRN refresh should clear is_wathiq_data_expired and allow login | Positive | `test.skip(true, ...)` — pending confirmed WATHIQ renewal endpoint paths from the same Swagger doc. |
| NW-11: a refresh attempt that still returns an expired CRN should leave the account blocked with 409 WATHIQ_DATA_EXPIRED | Negative | `test.skip(true, ...)` — same pending reason as NW-10. |
| NW-12: NAFATH expiry should deactivate the USER, not the individual business profile | Negative | `test.skip(true, ...)` — pending DB access to confirm which entity was deactivated; verifies the user- vs. profile-scope correction from the ticket's comment thread. |
| NW-13: WATHIQ expiry should deactivate the PROFILE, not the user | Negative | `test.skip(true, ...)` — same pending reason as NW-12. |

### `Login/functional/LoginFormValidation.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should be disabled when all fields are empty | Negative | Asserts the Log In button is disabled with an empty form. |
| should be disabled when only company number is filled | Negative | Asserts the Log In button stays disabled with only company number filled. |
| should be disabled when only mobile number is filled | Negative | Asserts the Log In button stays disabled with only mobile filled. |
| should be disabled when only password is filled | Negative | Asserts the Log In button stays disabled with only password filled. |
| should be disabled when company and mobile are filled but not password | Negative | Asserts the button stays disabled missing only the password. |
| should be disabled when company and password are filled but not mobile | Negative | Asserts the button stays disabled missing only the mobile number. |
| should be disabled when mobile and password are filled but not company | Negative | Asserts the button stays disabled missing only the company number. |
| should be enabled when all three fields are filled | Positive | Asserts the Log In button becomes enabled once all three fields are filled. |
| should be disabled again after clearing the company number field | Negative | Asserts the button re-disables after clearing company number post-fill. |
| should be disabled again after clearing the mobile number field | Negative | Asserts the button re-disables after clearing mobile number post-fill. |
| should be disabled again after clearing the password field | Negative | Asserts the button re-disables after clearing password post-fill. |
| should keep Log In button disabled when mobile is too short (4 digits) | Negative | Asserts the button stays disabled for a 4-digit mobile number. |
| should keep Log In button disabled when mobile is 8 digits (one short of minimum) | Negative | Asserts the button stays disabled for an 8-digit mobile number. |
| should keep Log In button disabled when mobile has a leading zero | Negative | Asserts the button stays disabled for a mobile number starting with 0. |
| should trim the mobile field to 9 digits when more than 9 are entered | Negative | Asserts entering 10 digits results in the field holding only the first 9. |
| should keep Log In button disabled when mobile does not start with 5 | Negative | Asserts the button stays disabled when the mobile number doesn't start with 5. |
| should not accept alphabetic characters in the mobile field | Negative | Asserts typed alphabetic characters leave the mobile field empty. |
| should not accept special characters in the mobile field | Negative | Asserts typed special characters leave the mobile field empty. |
| should enable the Log In button with a valid 9-digit mobile starting with 5 | Positive | Asserts the button is enabled for a valid 9-digit mobile number starting with 5. |
| should reveal password text when the show password toggle is clicked | Positive | Asserts the password input's `type` changes from `password` to `text` on toggle click. |
| should re-mask password when the toggle is clicked a second time | Positive | Asserts a second toggle click reverts the input's `type` back to `password`. |

### `Login/functional/LoginInvalidCredentials.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should stay on the login page with a wrong password | Negative | Asserts the URL remains the login URL after submitting a wrong password. |
| should stay on the login page with a wrong company number | Negative | Asserts the URL remains the login URL after submitting a wrong company number. |
| should stay on the login page with a wrong mobile number | Negative | Asserts the URL remains the login URL after submitting a wrong mobile number. |
| should stay on the login page when all three credentials are wrong | Negative | Asserts the URL remains the login URL when company, mobile, and password are all wrong. |
| should display an error toast after submitting wrong credentials | Negative | Asserts an error toast is displayed via `assertToast`. |
| should display an error when credentials are not registered | Negative | Asserts a toast error appears for an unregistered/randomly generated mobile number. |
| should not expose technical details in the not-registered error message | Negative | Asserts the toast detail text doesn't match stack/exception/sql/database/internal patterns. |
| should display an error and not show OTP for a locked account | Negative | Asserts a toast error appears and the OTP heading stays hidden after submit. *(Uses the standard `VALID_*` credentials rather than a dedicated locked-account fixture — no distinct locked test account exists in this environment.)* |
| should display an error and not show OTP for a deactivated account | Negative | Same pattern as above — asserts toast + hidden OTP heading, again using `VALID_*` credentials rather than a dedicated deactivated account. |
| should display a generic rejection for an AML-blocked account | Negative | Same pattern — asserts toast + hidden OTP heading, using `VALID_*` credentials rather than a dedicated AML-blocked account. |
| should not expose AML or compliance details in the error message | Negative | Asserts the toast detail text doesn't match aml/compliance/sanction/blacklist/suspicious/investigation or stack/sql/database/internal patterns. |
| should keep Log In button disabled when company number contains only whitespace | Negative | Asserts the button stays disabled when the company field holds only spaces. |
| *(skipped)* should keep Log In button disabled when password contains only whitespace | Negative | `test.skip`'d in code; intended to assert the button stays disabled when the password field holds only spaces. |
| should stay on the login page when correct company is paired with wrong mobile and wrong password | Negative | Asserts the URL stays on the login page for a correct company with wrong mobile/password. |
| should display an error toast and remain on the login page when the server returns a 500 | Negative | Mocks `/auth/signin` to return HTTP 500 and asserts a toast appears while the URL stays on the login page. |
| should allow re-submitting the form immediately after a failed login attempt | Negative | Asserts the Log In button remains visible and enabled for an immediate retry after a failed attempt. |
| should preserve field values after a failed login attempt | Negative | Asserts the company and mobile fields retain their entered values after a failed submit. |

### `Login/functional/LoginOtpFlow.spec.ts`
*(the "OTP Flow" describe's `beforeEach` hard-waits for the OTP dialog — a missing dialog fails the hook rather than skipping)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should display the OTP dialog after submitting valid credentials | Positive | Asserts the OTP heading is visible after a valid submit. |
| should have Verify button disabled when OTP inputs are empty | Negative | Asserts the Verify button is disabled with all OTP boxes empty. |
| should keep Verify button disabled when OTP inputs are partially filled | Negative | Asserts the Verify button stays disabled with only 2 of the OTP boxes filled. |
| should enable Verify button when all OTP inputs are filled | Positive | Asserts the Verify button becomes enabled once every OTP box is filled. |
| should not accept non-numeric characters in OTP inputs | Negative | Asserts typing a letter into an OTP box leaves it empty. |
| should auto-advance focus to the next input when a digit is entered | Positive | Asserts focus moves to the next OTP box after a digit is entered into the first. |
| should have Click to resend button disabled while the countdown is active | Negative | Asserts the resend button is disabled and the countdown timer is visible. |
| should enable resend button after countdown expires and clear inputs on click | Positive | Waits out the countdown, asserts the resend button becomes enabled, and clicking it clears the OTP inputs. |
| should close the OTP popup when Cancel is clicked | Positive | Asserts the OTP heading is no longer visible after clicking Cancel. |
| should return to the login form when Cancel is clicked | Positive | Asserts the "Log In" button is visible again after cancelling the OTP dialog. |
| should remain on the OTP popup after submitting a wrong OTP | Negative | Asserts the OTP heading stays visible after submitting an incorrect OTP. |
| should log in successfully and redirect when the correct OTP is entered | Positive | Fetches the real OTP from MongoDB and asserts the page navigates away from `/auth/login` after verification. |
| should NOT display the validation card when login fails with wrong password | Negative | Asserts the "Just a moment..." validation card never appears after a failed login. |
| should mark step 1 "Verifying your credentials" as complete with a checkmark | Positive | Polls: step 1 shows a checkmark/success icon, OR the card has already progressed past it (OTP dialog shown / off the login page). The step completes faster than a real credential check, so a bare "checkmark visible now" assert would race. |
| should mark step 2 "Preparing this device" as complete with a checkmark | Positive | Same tolerant poll as step 1, for step 2. |
| should show a spinner on step 3 "Securing your session" while it is in progress | Positive | Polls: step 3 shows any status icon (spinner or the checkmark it settles on), OR the card has already progressed past it. The card can finish before the spinner is catchable. |
| should redirect to dashboard after the validation card dismisses (when OTP is disabled) | Positive | Waits out the validation card non-fatally (it can flash faster than an assertion catches it), then asserts no OTP dialog is shown and the page has navigated away from `/auth/login`. Assumes OTP is disabled in the environment. |

### `Login/functional/LoginHappyPath.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should display the login form on page load | Positive | Asserts company/mobile/password inputs and the Log In button are visible, with the button disabled. |
| should enable the Log In button once all fields are filled | Positive | Asserts the button becomes enabled once all fields hold valid values. |
| should dismiss the validation card after all steps complete | Positive | Asserts the "Just a moment..." card disappears after the full submit. |
| should redirect away from the login page after submitting valid credentials | Positive | Asserts the URL no longer matches `/auth/login` after a successful login (handling OTP if it appears). |
| should display the sidebar logo and brand name on the dashboard | Positive | Asserts the dashboard logo and brand name render post-login. |
| should display the sidebar navigation links on the dashboard | Positive | Asserts the nav container plus Home/Transactions/Payments links are visible. |
| should display the header profile and notifications icons on the dashboard | Positive | Asserts the profile trigger and notifications icon are visible. |
| should display the wallet balance widget on the dashboard | Positive | Asserts the wallet balance (SAR) widget is visible. |
| should display the last transactions widget on the dashboard | Positive | Asserts the last-transactions container is visible. |
| should display the last login timestamp on the dashboard | Positive | Asserts the last-login text is visible. |
| should log out successfully and return to the login page | Positive | Asserts the URL matches `/auth/login` again after clicking logout. |

### `Login/functional/LoginNavigation.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should navigate to the Forgot Password page when the link is clicked | Positive | Asserts the URL matches `/forgot-password` after clicking the link. |
| should navigate to the Sign Up page when the link is clicked | Positive | Asserts the URL changes away from the login page after clicking Sign Up. |
| should navigate to a valid page when the logo link is clicked | Positive | Asserts the URL matches `majdpay.com` after clicking the logo link. |
| should change the theme when the toggle is clicked | Positive | Asserts the `<body>` element's class attribute changes after the theme toggle is clicked. |
| *(skipped)* should redirect away from the login page when already logged in | Positive | `test.skip`'d in code; uses a pre-authenticated storage state and would assert navigating to the login URL redirects away. |
| *(skipped)* should not display the Log In button when already logged in | Positive | `test.skip`'d in code; would assert the Log In button is hidden for an already-authenticated session. |

### `Login/functional/LoginSecurity.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should lock the account after 3 consecutive failed login attempts | Negative | Performs 3 failed attempts then asserts a toast and no OTP heading on a 4th attempt with the correct password; skipped unless `LOCKOUT_COMPANY`/`LOCKOUT_MOBILE` env vars are set. |
| should return the same error response for a wrong company number and a wrong mobile number (prevents user enumeration) | Negative | Asserts both a wrong-company attempt and a wrong-mobile attempt show a toast and stay on the login URL. |
| should not execute a script payload entered in the company number field (XSS) | Negative | Asserts a `<script>` payload typed into the company field doesn't render in the page or trigger a JS dialog. |
| should not execute a script payload entered in the password field (XSS) | Negative | Asserts a `<script>` payload typed into the password field doesn't trigger a JS dialog. |
| should send the login request via POST — credentials must not appear in the URL | Negative | Captures the `/auth/signin` request and asserts the method is `POST` and the URL doesn't contain the password or company number. |
| should not expose stack traces or database details in failed login error responses | Negative | Asserts the toast detail text (if shown) doesn't match stack/exception/sql/database/ORA-/JDBC patterns. |

### `Login/ui/LoginPage.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should open the login URL | Positive | Asserts the page URL equals the login URL. |
| should have the correct page title | Positive | Asserts the page title equals "EMI - Business". |
| should display the login form container | Positive | Asserts the form container is visible. |
| should display the Login eyebrow text | Positive | Asserts the eyebrow text equals "Login". |
| should display the Welcome heading | Positive | Asserts the heading text equals " Welcome to MJD Pay". |
| should display the tagline description | Positive | Asserts the tagline text is visible. |
| should display the MJD Pay logo image | Positive | Asserts the logo image is visible. |
| should display the MJD Pay logo as a clickable link | Positive | Asserts the logo link is visible. |
| should display the EN language button | Positive | Asserts the EN language button is visible. |
| should not have EN as the active language by default | Positive | Asserts `aria-pressed` on the EN button is not `true` by default (Arabic is the default). |
| should display the Arabic language button | Positive | Asserts the Arabic language button is visible. |
| should have Arabic as the active language by default | Positive | Asserts `aria-pressed="true"` on the Arabic button by default. |
| should activate the Arabic button when clicked | Positive | Asserts `aria-pressed="true"` on the Arabic button after clicking it. |
| should switch back to EN when EN button is clicked after Arabic | Positive | Asserts `aria-pressed="true"` on the EN button after switching to Arabic then back. |
| should display the theme toggle button | Positive | Asserts the theme toggle button is visible. |
| should display the Company Number label | Positive | Asserts the Company Number label is visible. |
| should display the Company number input as visible and enabled | Positive | Asserts the company input is visible and enabled. |
| should display the Company number input with the correct placeholder | Positive | Asserts the placeholder attribute equals "Eg. 153165659". |
| should display the clear button on the Company Number field when filled | Positive | Asserts the clear button appears once the company field has a value. |
| should clear the Company Number field when the clear button is clicked | Positive | Asserts the company field value is empty after clicking its clear button. |
| should display the Mobile Number label | Positive | Asserts the Mobile Number label is visible. |
| should display the country flag in the mobile number field | Positive | Asserts the country flag icon is visible. |
| should display the country code (+966) | Positive | Asserts the country code text contains "(+966)". |
| should display the Mobile number input as visible and enabled | Positive | Asserts the mobile input is visible and enabled. |
| should display the Password label | Positive | Asserts the Password label is visible. |
| should display the Password input masked by default | Positive | Asserts the password input's `type` attribute is `password` by default. |
| should display the Show password toggle button | Positive | Asserts the show-password toggle is visible. |
| should display the Forgot Password link | Positive | Asserts the Forgot Password link is visible. |
| should display the Log In button | Positive | Asserts the Log In button is visible. |
| should have the Log In button disabled on page load | Negative | Asserts the Log In button is disabled on initial page load. |
| should display the "New to MJD PAY?" text | Positive | Asserts the "New to MJD PAY?" text is visible. |
| should display the Sign Up link | Positive | Asserts the Sign Up link is visible. |

### `Login/ui/LoginValidationPopup.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should show the "Just a moment..." heading | Positive | Asserts the validation-card heading is visible after submit. |
| should show the popup subtitle text | Positive | Asserts the subtitle "We're preparing a secure session for this device." is visible. |
| should display all three validation steps | Positive | Asserts all three step labels (Verifying your credentials / Preparing this device / Securing your session) are visible. |
| should show step 1 "Verifying your credentials" | Positive | Asserts the step-1 label is visible. |
| should show step 2 "Preparing this device" | Positive | Asserts the step-2 label is visible. |
| should show step 3 "Securing your session" | Positive | Asserts the step-3 label is visible. |
| should show the OTP dialog after the validation card completes (when OTP is enabled) | Positive | Asserts the OTP heading, instruction text, first input, Verify button, and Cancel button are all visible once the card dismisses; skipped when OTP is disabled in the environment. |

## 2. Wallet-to-Wallet (W2W) Transfer
**File Reference:** `BusinessTestCases/W2WTransfer/functional/W2WTransferFunctionality.spec.ts`
*(Data-driven via `data/w2wTransferData.json` — test titles are built at runtime from each data row's `testName` plus an `amountType`/`crnType`/`amountValidation` suffix)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| W2W_Transfer_Valid_Whole_Amount_Updates_Balances \| Amount Type: Whole Number | Positive | Logs in as both merchant and biller, transfers a whole-number amount, and asserts the merchant's balance decreases and the biller's balance increases by that amount. |
| W2W_Transfer_Valid_Decimal_Amount_Updates_Balances \| Amount Type: Decimal Amount | Positive | Same merchant/biller balance-delta assertion for a decimal amount (50.50). |
| W2W_Transfer_Transaction_Appears_In_Transaction_Table | Positive | Completes a transfer, navigates to Transactions, and asserts the newest transaction resolves to a `SUCCESS` status (polling while it reads `pending`). |
| W2W_Transfer_InvalidCRN_NonExistent \| CRN Type: Non-Existent CRN | Negative | Asserts a "No recipient found" toast for a CRN that doesn't exist. |
| W2W_Transfer_InvalidCRN_IsSame_For_Sender_And_Receiver \| CRN Type: Self-Transfer CRN | Negative | Asserts the same "No recipient found" toast when the receiver CRN equals the sender's own CRN. |
| W2W_Transfer_InvalidCRN_Empty \| Validation Type: Empty CRN | Negative | Asserts the Check Recipient button stays disabled with an empty CRN field. |
| W2W_CRN_Validation_LessThan_10_Digits \| Validation Type: Less than 10 digits | Negative | Asserts the Check Recipient button stays disabled for a 9-digit CRN. |
| W2W_CRN_Validation_Valid_10_to_15_Digits \| Validation Type: Valid 10 to 15 digits | Positive | Asserts the Check Recipient button is enabled for a CRN in the valid 10–15 digit range. |
| W2W_CRN_Validation_HardLimit_16_Digits \| Validation Type: Exceeding 15 digits Hard Limit | Negative | Asserts a 16-digit CRN is truncated to 15 digits in the input (button ends up enabled at that truncated length). |
| W2W_CRN_Validation_Rejects_Alphabetic \| Validation Type: Alphabetic characters | Negative | Asserts alphabetic input leaves the CRN field empty and the button disabled. |
| W2W_CRN_Validation_Rejects_SpecialChars \| Validation Type: Special characters | Negative | Asserts special-character input leaves the field empty and the button disabled. |
| W2W_CRN_Validation_Rejects_Spaces \| Validation Type: Spaces in CRN | Negative | Asserts spaces are stripped from the CRN input (leaving a sub-10-digit value) and the button stays disabled. |
| W2W_AmountValidation_Negative_Amount \| Validation Type: Negative Amount | Negative | Asserts the leading negative sign is stripped from the amount input (resulting value "100") and Proceed ends up enabled. |
| W2W_AmountValidation_Zero_Amount \| Validation Type: Zero Amount | Negative | Asserts a zero amount clears the field and keeps Proceed disabled. |
| W2W_AmountValidation_Alphabetical_Characters \| Validation Type: Alphabetical Characters | Negative | Asserts alphabetic input clears the field and keeps Proceed disabled. |
| W2W_AmountValidation_Special_Characters \| Validation Type: Special Characters | Negative | Asserts special-character input clears the field and keeps Proceed disabled. |
| W2W_AmountValidation_Valid_Float_2_Decimals \| Validation Type: Valid Float 2 Decimals | Positive | Asserts a 2-decimal amount (10.55) is accepted as-is and Proceed is enabled. |
| W2W_AmountValidation_Valid_Float_1_Decimal \| Validation Type: Valid Float 1 Decimal | Positive | Asserts a 1-decimal amount (10.5) is accepted as-is and Proceed is enabled. |
| W2W_AmountValidation_Invalid_Float_3_Decimals \| Validation Type: Invalid Float 3 Decimals | Negative | Asserts a 3-decimal amount (10.555) is truncated to 2 decimals (10.55), with Proceed enabled at that truncated value. |
| W2W_AmountValidation_Clipboard_Paste \| Validation Type: Copy and Paste Amount Actions | Positive | Asserts a pasted valid amount (via clipboard + Ctrl/Cmd+V) is accepted and Proceed is enabled. |
| W2W_Transfer_Insufficient_Fund | Negative | Attempts a transfer for (current balance + 100) and asserts an insufficient-fund toast is displayed. |

### `W2WTransfer/functional/W2WTransferWalletLimits.spec.ts`
*(WT-WB01–08; every test is `test.skip`'d pending an Admin Portal "Manage Limits → Wallet Balance" automation helper — EMI-1653/EMI-195 — kept in the suite 1:1 with `docs/manual-test-cases/B2B-Transactions.md` section G so coverage isn't silently dropped)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| WT-WB01 — sender transfer within min-balance floor succeeds (Merchant, Low risk) | Positive | *(Skipped, EMI-1653/EMI-195.)* |
| WT-WB02 — sender transfer breaching min-balance floor is blocked (Merchant, Low risk) | Negative | *(Skipped, EMI-1653/EMI-195.)* |
| WT-WB03 — receiver credit within max-balance ceiling succeeds (Biller, Low risk) | Positive | *(Skipped, EMI-1653/EMI-195.)* |
| WT-WB04 — receiver credit breaching max-balance ceiling is blocked (Biller, Low risk) | Negative | *(Skipped, EMI-1653/EMI-195.)* |
| WT-WB05 — sender transfer within min-balance floor succeeds (Merchant, Medium risk) | Positive | *(Skipped, EMI-1653/EMI-195.)* |
| WT-WB06 — sender transfer breaching min-balance floor is blocked (Merchant, Medium risk) | Negative | *(Skipped, EMI-1653/EMI-195.)* |
| WT-WB07 — receiver credit within max-balance ceiling succeeds (Biller, Medium risk) | Positive | *(Skipped, EMI-1653/EMI-195.)* |
| WT-WB08 — receiver credit breaching max-balance ceiling is blocked (Biller, Medium risk) | Negative | *(Skipped, EMI-1653/EMI-195.)* |

### `W2WTransfer/functional/W2WTransferTransactionLimits.spec.ts`
*(WT-TL01–12; `test.skip`'d pending an Admin Portal "Manage Limits → Transaction" helper — EMI-87/EMI-1653/EMI-195)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| WT-TL01 — transfers within the daily amount limit succeed (Web) | Positive | *(Skipped, EMI-87/EMI-1653/EMI-195.)* |
| WT-TL02 — cumulative transfers exceeding the daily amount limit are blocked (Web) | Negative | *(Skipped.)* |
| WT-TL03 — transfers within the weekly amount limit succeed (Web) | Positive | *(Skipped.)* |
| WT-TL04 — cumulative transfers exceeding the weekly amount limit are blocked (Web) | Negative | *(Skipped.)* |
| WT-TL05 — transfers within the monthly amount limit succeed (App) | Positive | *(Skipped.)* |
| WT-TL06 — cumulative transfers exceeding the monthly amount limit are blocked (App) | Negative | *(Skipped.)* |
| WT-TL07 — transfers within the daily count limit succeed | Positive | *(Skipped.)* |
| WT-TL08 — transfer once the daily count limit is exceeded is blocked | Negative | *(Skipped.)* |
| WT-TL09 — transfers within the weekly count limit succeed | Positive | *(Skipped.)* |
| WT-TL10 — transfer once the weekly count limit is exceeded is blocked | Negative | *(Skipped.)* |
| WT-TL11 — transfers within the monthly count limit succeed | Positive | *(Skipped.)* |
| WT-TL12 — transfer once the monthly count limit is exceeded is blocked | Negative | *(Skipped.)* |

### `W2WTransfer/functional/W2WTransferCommission.spec.ts`
*(WT-CM01–18; `test.skip`'d pending an Admin Portal "Commission Management" helper — EMI-2031)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| WT-CM01 — default schema applies when no custom commission exists | Positive | *(Skipped, EMI-2031.)* |
| WT-CM02 — custom per-account schema overrides the default | Positive | *(Skipped.)* |
| WT-CM03 — fixed commission deducted on a standard transfer | Positive | *(Skipped.)* |
| WT-CM04 — fixed commission applied at minimum boundary | Positive | *(Skipped.)* |
| WT-CM05 — fixed commission applied at maximum boundary | Positive | *(Skipped.)* |
| WT-CM06 — fixed commission not applied below minimum | Negative | *(Skipped.)* |
| WT-CM07 — fixed commission not applied above maximum | Negative | *(Skipped.)* |
| WT-CM08 — percentage commission deducted on a standard transfer | Positive | *(Skipped.)* |
| WT-CM09 — percentage commission applied at minimum boundary | Positive | *(Skipped.)* |
| WT-CM10 — percentage commission applied at maximum boundary | Positive | *(Skipped.)* |
| WT-CM11 — percentage commission not applied below minimum | Negative | *(Skipped.)* |
| WT-CM12 — percentage commission not applied above maximum | Negative | *(Skipped.)* |
| WT-CM13 — commission added on sender side / deducted on receiver side | Positive | *(Skipped.)* |
| WT-CM14 — overlapping commission rules rejected | Negative | *(Skipped.)* |
| WT-CM15 — min amount cannot exceed max amount | Negative | *(Skipped.)* |
| WT-CM16 — transaction type cannot be edited on an existing commission | Negative | *(Skipped.)* |
| WT-CM17 — disabling a commission schema stops it applying | Positive | *(Skipped.)* |
| WT-CM18 — re-enabling a commission schema resumes applying it | Positive | *(Skipped.)* |

## 3. Bank Transfer
**File Reference:**
`BusinessTestCases/BankTransfer/functional/BankTransferCommission.spec.ts`
`BusinessTestCases/BankTransfer/functional/BankTransferEdgeCases.spec.ts`
`BusinessTestCases/BankTransfer/functional/BankTransferHappyPath.spec.ts`
`BusinessTestCases/BankTransfer/functional/BankTransferNegative.spec.ts`
`BusinessTestCases/BankTransfer/functional/BankTransferOtpRequirement.spec.ts`
`BusinessTestCases/BankTransfer/functional/BankTransferSession.spec.ts`
`BusinessTestCases/BankTransfer/functional/BankTransferSystemCashout.spec.ts`
`BusinessTestCases/BankTransfer/functional/BankTransferTransactionLimits.spec.ts`
`BusinessTestCases/BankTransfer/functional/BankTransferWalletLimits.spec.ts`
`BusinessTestCases/BankTransfer/security/BankTransferSecurity.spec.ts`
`BusinessTestCases/BankTransfer/ui/BankTransferAmountPage.spec.ts`
`BusinessTestCases/BankTransfer/ui/BankTransferConfirmationPage.spec.ts`
`BusinessTestCases/BankTransfer/ui/BankTransferOtpPage.spec.ts`
`BusinessTestCases/BankTransfer/ui/BankTransferLocalization.spec.ts`

*Requirements: EMI-180 (TC-2355–2403), EMI-2050 (TC-3119–3133 — Cashout redesign). Dev facts fixed with the product owner 2026-09-07: destination IBAN is bound at registration (no entry step, and the full number is never revealable — masked `SA##**####` only); amount decimals accepted up to 2 places; a 3rd wrong OTP shows a message and drops the user back to the Amount step (retry needs a fresh flow / idempotency key); wallet & transaction limits and the commission/VAT module are not configured on dev yet.*

### `BankTransfer/functional/BankTransferHappyPath.spec.ts`

**Full expected-result set for a successful cash-out (per EMI-TC-2355 / 2357 / 2358 / 3124):**
1. **Success message** shown to the Biller — *automated.*
2. **Biller wallet balance before vs. after** — decreases by exactly the transferred amount — *automated* (`getBalanceBeforeBankTransfer` → `checkBalanceAfterBankTransfer`).
3. **Admin wallet balance before vs. after** — increases by the same amount — *NOT automated;* needs Admin Portal access (same gap as the EMI-180 skips).
4. **Database / running-balance-entry** — `emi_transaction.bank_transactions` status 3→0, two `transaction_log` rows (pending + success), four `running_balance_entry` rows, and the Admin running-balance popup fields — *NOT automated;* no DB access from this suite.

Items 3–4 are tracked here as known coverage gaps so a "green" run is not mistaken for full verification of the money movement.

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should complete a standard transfer with a custom amount and debit the exact amount | Positive | Completes a 10.00 cashout through OTP; asserts the success modal and that the Biller wallet balance drops by exactly 10.00. (Admin-wallet credit + DB/running-balance rows — see items 3–4 above — not asserted.) |
| should complete a transfer using a randomly selected predefined amount | Positive | Same full flow using a randomly chosen preset chip; asserts the balance decreases by that preset amount. |
| should accept a valid amount with 2 decimal places and debit it correctly | Positive | Completes the flow with 15.75 and asserts the exact debit. |
| should accept a valid amount with 1 decimal place and debit it correctly | Positive | Completes the flow with 20.5 and asserts the exact debit. |
| should accept a pasted valid amount and enable Proceed | Positive | Asserts a pasted "50.00" populates the amount field and Proceed becomes enabled. |
| should reflect the entered amount and compute commission/VAT/total correctly on the Confirmation summary | Positive | Asserts the summary's Transaction Type/Bank/IBAN match source data, Original Amount equals the entered value, VAT ≈ commission × 15%, and Total ≈ Original − commission − VAT. |
| should auto-submit on a correct OTP, show a success confirmation, and debit the entered amount | Positive | Completes the flow with the fixed `VALID_OTP` and asserts the balance is debited by the entered amount. |

### `BankTransfer/functional/BankTransferNegative.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should reject a negative amount and keep Proceed disabled | Negative | Asserts a negative amount is not accepted and Proceed stays disabled. |
| should reject zero as a transfer amount | Negative | Asserts a zero amount is not accepted and Proceed stays disabled. |
| should reject alphabetic characters and special symbols in the amount field | Negative | Asserts alphabetic/special-character input is not accepted and Proceed stays disabled. |
| should reject or truncate an amount with 3 decimal places | Negative | Asserts a 3-decimal amount is rejected or truncated. |
| should reject a pasted invalid amount and keep Proceed disabled | Negative | Asserts pasting "abc" leaves the amount field empty and Proceed disabled. |
| should show the insufficient-funds toast and block the transfer when the amount exceeds the balance | Negative | Enters (balance + 10) and asserts an "insufficient funds" toast appears. |
| should reject a thousands-separated amount | Negative | Asserts "1,000" is not kept verbatim (the comma is a non-numeric character). |
| should reject scientific notation in the amount field | Negative | Asserts "1e5" is not kept verbatim (the "e" is a non-numeric character). |
| should error and return to the Amount step after three incorrect OTP attempts | Negative | **`test.fixme` — known defect.** Expected (EMI-TC-3125/3126): 3× wrong OTP → inline error, flow returns to the Amount step, balance unchanged. Actual on dev is a bug (behaviour pending QA description). |

### `BankTransfer/functional/BankTransferEdgeCases.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should override the selected preset amount when the field is edited afterward | Positive | Selects a preset chip, edits the amount field afterward, and asserts the manually entered value ("123") wins. |
| should fill up to 4 decimal places and lock manual entry when "Use full balance" is toggled on | Positive | Asserts the amount field becomes `readonly` and is auto-filled with the current wallet balance (up to 4 decimal places). |
| should re-enable manual entry when "Use full balance" is toggled back off | Positive | Toggles the control on then off; asserts the field is no longer `readonly`, accepts "12", and Proceed becomes enabled. |
| should re-disable Proceed when a selected preset amount is cleared | Negative | Selects a preset (Proceed enabled), clears the field, asserts the field is empty and Proceed is disabled again. |
| should switch the entered amount when a different preset chip is chosen | Positive | Clicks preset chip #1 then chip #2; asserts the amount input reflects each chip's value in turn. |

### `BankTransfer/functional/BankTransferSession.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should discard the transfer and leave the balance unchanged when the page is refreshed mid-flow | Negative | Reloads the page mid-flow and asserts the wallet balance is unchanged. |
| should return to the Amount step and leave the balance unchanged when Cancel is clicked on the Confirmation summary | Negative | Asserts clicking Cancel on the summary returns to the Amount step and the balance is unchanged. |
| should return home and leave the balance unchanged when Cancel is clicked at the OTP step | Negative | Asserts cancelling at the OTP step returns to the home page with the balance unchanged. |
| should carry the same masked IBAN and total from Confirmation through to the OTP step | Positive | Asserts the IBAN and total shown on the OTP recap match the values shown on the Confirmation summary. |

### `BankTransfer/functional/BankTransferCommission.spec.ts`
*(TC-2388–2397; every test is `test.skip`'d pending an Admin Portal "Commission Management" automation helper — EMI-180 — kept in the suite 1:1 with the source test-case export so coverage isn't silently dropped)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TC-2388 — deducts a fixed commission on a standard transfer | Positive | *(Skipped, EMI-180.)* Intended to assert an admin-configured fixed commission is reflected in the Confirmation summary and wallet deltas. |
| TC-2389 — deducts the fixed commission when the transfer equals the minimum value | Positive | *(Skipped, EMI-180.)* |
| TC-2390 — deducts the fixed commission when the transfer equals the maximum value | Positive | *(Skipped, EMI-180.)* |
| TC-2391 — does not deduct the fixed commission below the configured minimum value | Negative | *(Skipped, EMI-180.)* |
| TC-2392 — does not deduct the fixed commission above the configured maximum value | Negative | *(Skipped, EMI-180.)* |
| TC-2393 — deducts a percentage commission on a standard transfer | Positive | *(Skipped, EMI-180.)* Same as TC-2388 but for an admin-configured percentage commission. |
| TC-2394 — deducts the percentage commission when the transfer equals the minimum value | Positive | *(Skipped, EMI-180.)* |
| TC-2395 — deducts the percentage commission when the transfer equals the maximum value | Positive | *(Skipped, EMI-180.)* |
| TC-2396 — does not deduct the percentage commission below the configured minimum value | Negative | *(Skipped, EMI-180.)* |
| TC-2397 — does not deduct the percentage commission above the configured maximum value | Negative | *(Skipped, EMI-180.)* |

### `BankTransfer/functional/BankTransferOtpRequirement.spec.ts`
*(TC-2402–2403. The Admin Portal OTP toggle has no automation; TC-2402 runs against the dev default, TC-2403 self-skips until OTP is turned off in the environment.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TC-2402 — prompts for OTP when the admin has activated the transaction OTP requirement | Positive | Runs. After the Confirmation summary, asserts the OTP step gates the transfer — 6 OTP boxes visible, Verify button present — then cancels. |
| TC-2403 — skips OTP when the admin has deactivated the transaction OTP requirement | Positive | Runtime `test.skip` while OTP is still active on the env; when OTP is off it asserts the transfer completes straight from the summary (success modal, balance debited by the amount) with no OTP step. |

### `BankTransfer/functional/BankTransferTransactionLimits.spec.ts`
*(TC-2370–2387; `test.skip`'d pending an Admin Portal "Manage Limits → Transaction" automation helper — EMI-180)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TC-2370 — allows transfers within the hourly amount limit | Positive | *(Skipped, EMI-180.)* |
| TC-2371 — rejects a transfer below the configured hourly amount limit | Negative | *(Skipped, EMI-180.)* |
| TC-2372 — blocks a transfer that exceeds the hourly amount limit | Negative | *(Skipped, EMI-180.)* |
| TC-2373 — allows transfers within the daily amount limit | Positive | *(Skipped, EMI-180.)* |
| TC-2374 — blocks a transfer that exceeds the daily amount limit | Negative | *(Skipped, EMI-180.)* |
| TC-2375 — allows transfers within the monthly amount limit | Positive | *(Skipped, EMI-180.)* |
| TC-2376 — blocks a transfer that exceeds the monthly amount limit | Negative | *(Skipped, EMI-180.)* |
| TC-2377 — allows transfers within the yearly amount limit | Positive | *(Skipped, EMI-180.)* |
| TC-2378 — blocks a transfer that exceeds the yearly amount limit | Negative | *(Skipped, EMI-180.)* |
| TC-2379 — allows transfers within the hourly transaction-count limit | Positive | *(Skipped, EMI-180.)* |
| TC-2380 — rejects a transfer below the configured hourly count limit | Negative | *(Skipped, EMI-180.)* |
| TC-2381 — blocks a transfer once the hourly transaction-count limit is exceeded | Negative | *(Skipped, EMI-180.)* |
| TC-2382 — allows transfers within the daily transaction-count limit | Positive | *(Skipped, EMI-180.)* |
| TC-2383 — blocks a transfer once the daily transaction-count limit is exceeded | Negative | *(Skipped, EMI-180.)* |
| TC-2384 — allows transfers within the monthly transaction-count limit | Positive | *(Skipped, EMI-180.)* |
| TC-2385 — blocks a transfer once the monthly transaction-count limit is exceeded | Negative | *(Skipped, EMI-180.)* |
| TC-2386 — allows transfers within the yearly transaction-count limit | Positive | *(Skipped, EMI-180.)* |
| TC-2387 — blocks a transfer once the yearly transaction-count limit is exceeded | Negative | *(Skipped, EMI-180.)* |

### `BankTransfer/functional/BankTransferWalletLimits.spec.ts`
*(TC-2362–2369, TC-2398–2401; `test.skip`'d pending an Admin Portal "Manage Limits → Wallet Balance" automation helper — EMI-180)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TC-2362 — allows a transfer within the admin-configured wallet limit | Positive | *(Skipped, EMI-180.)* |
| TC-2363 — blocks a transfer that exceeds the admin-configured wallet limit | Negative | *(Skipped, EMI-180.)* |
| TC-2364 — allows a transfer within the wallet limit (second configured risk level) | Positive | *(Skipped, EMI-180.)* |
| TC-2365 — blocks a transfer exceeding the wallet limit (second configured risk level) | Negative | *(Skipped, EMI-180.)* |
| TC-2366 — allows a transfer within the wallet limit (third configured risk level) | Positive | *(Skipped, EMI-180.)* |
| TC-2367 — blocks a transfer exceeding the wallet limit (third configured risk level) | Negative | *(Skipped, EMI-180.)* |
| TC-2368 — allows a transfer within the wallet limit (fourth configured risk level) | Positive | *(Skipped, EMI-180.)* |
| TC-2369 — blocks a transfer exceeding the wallet limit (fourth configured risk level) | Negative | *(Skipped, EMI-180.)* |
| TC-2398 — allows a transfer within the wallet limit (repeat scenario) | Positive | *(Skipped, EMI-180.)* |
| TC-2399 — blocks a transfer exceeding the wallet limit (repeat scenario) | Negative | *(Skipped, EMI-180.)* |
| TC-2400 — allows a transfer within the wallet limit (repeat scenario) | Positive | *(Skipped, EMI-180.)* |
| TC-2401 — blocks a transfer exceeding the wallet limit (repeat scenario) | Negative | *(Skipped, EMI-180.)* |

### `BankTransfer/functional/BankTransferSystemCashout.spec.ts`
*(EMI-2050 TC-3127 / TC-3129–3133 — the Admin Portal "System Cash-Out" surface, not the Biller/Merchant flow. Every test is `test.skip`'d pending Admin Portal automation, kept 1:1 with the source export.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TC-3127 — user receives an SMS and email confirmation after a successful cash-out | Positive | *(Skipped.)* Intended to assert the shared test mailbox receives a confirmation email carrying amount, reference, and masked IBAN. |
| TC-3129 — the Admin cash-out page pre-fills the destination IBAN and makes it non-editable | Positive | *(Skipped.)* Intended to assert the system-wallet IBAN is pre-filled and the input is readonly/disabled. |
| TC-3130 — an invalid configured system IBAN blocks the cash-out with a clear error | Negative | *(Skipped.)* Intended to assert the "destination IBAN is invalid… update the configuration" error. |
| TC-3131 — the system cash-out executes only after explicit admin confirmation | Positive | *(Skipped.)* Intended to assert nothing moves until the confirmation step is completed. |
| TC-3132 — finance is emailed a confirmation after a successful system cash-out | Positive | *(Skipped.)* Intended to assert the configured finance contact receives an email with the transaction details. |
| TC-3133 — a system cash-out is logged with system wallet id, amount, IBAN, and status | Positive | *(Skipped.)* Intended to assert the log entry carries System Wallet ID, Amount, Destination IBAN, and Status ∈ {Pending, Successful, Failed}. |

### `BankTransfer/ui/BankTransferAmountPage.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should display the "Cashout" page title and its description | Positive | Asserts the page title reads "Cashout" and the subtitle matches "send funds to a saudi iban". |
| should display the Current Balance label and a numeric balance amount | Positive | Asserts the balance label and a numeric balance value are visible. |
| should display the wallet code next to the balance | Positive | Asserts the wallet-code text is visible next to the balance. |
| should display the Topup, QR, and wallet settings buttons on the balance card | Positive | Asserts the Topup, QR, and settings buttons are visible on the balance card. |
| should display the IBAN label alongside a masked IBAN, the bank name, and a verified checkmark | Positive | Asserts the IBAN value matches the masked format `SA##**####`, the bank name is non-empty, and a verified checkmark is visible. |
| should display the step-2 "Amount" section header and its description | Positive | Asserts the step badge reads "2", the section title reads "Amount", and the description matches "enter the amount to transfer". |
| should display the "Set Amount You Want Transfer" label and the currency icon in the input | Positive | Asserts the amount-field label and currency icon are visible. |
| should display the "0.00" placeholder in the amount input | Positive | Asserts the amount input's placeholder attribute equals "0.00". |
| should display the "Use full balance" toggle with its label | Positive | Asserts the toggle and its label are visible. |
| should keep Proceed disabled while the amount field is empty | Negative | Asserts Proceed is disabled while the amount field is empty. |
| should display the "Or select amount" label and all 5 preset amount chips | Positive | Asserts exactly 5 preset chips are rendered with the text 500/1000/2000/5000/10000. |
| should display the Proceed button with its label and arrow icon | Positive | Asserts the Proceed button is visible with its text and an arrow icon. |
| should always show the IBAN masked with no way for the user to reveal the full number | Negative | Asserts the IBAN renders masked `SA##**####`, no "view full IBAN" control exists (count 0), and the unmasked 22-digit number is absent from the page DOM. |
| should not let a preset above the available balance start a transfer | Negative | Selects the largest preset; asserts it is disabled or leaves Proceed disabled (or, if the balance can afford it, that Proceed becomes enabled). |

### `BankTransfer/ui/BankTransferConfirmationPage.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should display the Transaction Type, Bank, and IBAN rows | Positive | Asserts the Transaction Type, Bank, and IBAN summary rows are non-empty. |
| should display the Original Amount, commission, VAT, and Total rows | Positive | Asserts the Original Amount, commission, VAT, and Total summary values all parse as numbers (not NaN). |
| should display the Confirmation heading and subtitle | Positive | Asserts the page title reads "Confirmation" and the subtitle matches "send funds to a saudi iban". |
| should display the Cancel and Next buttons on the summary | Positive | Asserts the summary shows Cancel + Next only (no separate Back); Next is visible, enabled, and labelled "Next"/"التالي". |
| should show the summary IBAN in the masked SA** **** format | Positive | Asserts the summary's IBAN row value is masked (`SA##` + `**` + last 4). |

### `BankTransfer/ui/BankTransferOtpPage.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should display six OTP input boxes and a running countdown | Positive | Asserts exactly 6 OTP boxes render and the countdown value decreases over a 2-second wait. |
| should display the Confirmation heading, subtitle, resend link, and Verify button | Positive | Asserts the heading reads "Confirmation", the subtitle matches "a code has been sent to you", and the resend/Verify controls are visible. |
| should reset the countdown timer when the resend link is clicked | Positive | Waits for the resend link to become enabled, clicks it, and asserts the remaining countdown jumps back above its pre-resend value (poll ≤45s). |
| should keep the Verify button disabled until all six digits are entered | Negative | Fills only 5 of the 6 OTP boxes and asserts the Verify button stays disabled. |
| should distribute a pasted six-digit code across the six inputs | Positive | Pastes "123456" into the first box and asserts all six boxes together hold "123456". |
| should display the OTP recap IBAN and total | Positive | Asserts the OTP-step recap shows the masked IBAN (`SA##**####`) and a numeric total greater than 0. |

### `BankTransfer/ui/BankTransferLocalization.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should render the page in right-to-left direction | Positive | Asserts `<html>` carries `dir="rtl"` once the UI is switched to Arabic. |
| should accept an amount and enable Proceed via the language-agnostic testid locators | Positive | Asserts Proceed is disabled before input and becomes enabled after entering "10", using `data-testid` locators under the Arabic locale. |
| should display the Proceed button label in Arabic | Positive | Asserts the Proceed button text matches the Arabic string "متابعة". |
| should display the summary Next button label in Arabic after proceeding | Positive | Asserts the summary's Next button text matches "التالي". |
| should display the summary Cancel button label in Arabic and leave the balance unchanged | Positive | Asserts the summary Cancel button text matches "إلغاء" and clicking it leaves the wallet balance unchanged. |

### `BankTransfer/security/BankTransferSecurity.spec.ts`
*(Abuse / tamper coverage. Endpoints are not hardcoded — each replay test drives the real UI flow once, records the confirm / OTP-verify request, and replays it mutated via a session-sharing `APIRequestContext`. A test runtime-skips and logs the URLs it saw if the target request can't be found. Pre-OTP tests never submit a valid OTP so nothing is debited.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| should never render the OTP value in the page DOM | Security | Asserts the entered OTP is not present anywhere in `page.content()` at the OTP step. |
| should not leak the OTP value in any network response body during the flow | Security | Records all JSON/text response bodies through the OTP step and asserts none contains the OTP value. |
| should not resume a cash-out from a fresh page load mid-OTP (no deep-link into the OTP step) | Security | Re-navigates to the OTP-step URL from a clean load and asserts the OTP boxes are gone and the flow restarts at the Amount step / home. |
| should defeat a tampered amount replayed on the confirm request | Security | Replays the confirm request with the amount changed to 999999; asserts it is rejected (or the 2xx response does not reflect the tampered value) and the wallet balance is unchanged. |
| should reject or ignore a tampered destination IBAN on the confirm request | Security | Replays the confirm request with a swapped SA IBAN; asserts rejection or no effect — passes with a note if the payload carries no IBAN (server-bound, EMI-TC-3129). |
| should reject via the API amounts the client filter blocks (negative / >2dp / over-balance) | Security | POSTs "-10", "10.555", and (balance + 100000) to the captured confirm endpoint; asserts each is rejected server-side. |
| should reject the original confirm request after the 3-try OTP redirect | Security | Burns 3 wrong OTPs via the UI, then replays the original confirm request; asserts it is no longer honoured and the balance is unchanged. |
| should reject a replayed, already-consumed OTP verification | Security | *(Gated behind `RUN_BANKTRANSFER_SECURITY_DEBIT=true` — completes a real 10 SAR transfer.)* Replays the consumed OTP-verify request; asserts rejection and no second debit. |
| should deny the Cashout page to a user without the admin-configured permission | Security | *(Skipped — needs a test account whose roles/groups exclude cash-out.)* Intended to assert no access to the flow plus a permission validation message. |

## 4. Bill Payment
**File Reference:** `BusinessTestCases/PayBill/functional/PayBillFlow.spec.ts`
*(Data-driven via `approved received bill` variation)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| Verify successful payment submission popup | Positive | Asserts the dynamic popup rendering for bill payment. |
| Verify wallet balance decrease after bill payment | Positive | Enforces dynamic balance check: `NewBalance = OldBalance - BillAmount`. |
| Verify transaction record creation and success status in transactions table | Positive | Identifies correct ledger row creation verifying amount and final `SUCCESS` status. |
| Verify bill payment with insufficient funds error message | Negative | First uses Bank Transfer to drain account, then asserts 'Insufficient fund' toast. |

### `PayBill/functional/PayBillWalletLimits.spec.ts`
*(PB-WB01–08; `test.skip`'d pending an Admin Portal "Manage Limits → Wallet Balance" helper — EMI-1653/EMI-195 — kept 1:1 with `docs/manual-test-cases/B2B-Transactions.md` section J)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| PB-WB01 — payer bill payment within min-balance floor succeeds (Merchant, Low risk) | Positive | *(Skipped, EMI-1653/EMI-195.)* |
| PB-WB02 — payer bill payment breaching min-balance floor is blocked (Merchant, Low risk) | Negative | *(Skipped.)* |
| PB-WB03 — biller credit within max-balance ceiling succeeds (Biller, Low risk) | Positive | *(Skipped.)* |
| PB-WB04 — biller credit breaching max-balance ceiling is blocked (Biller, Low risk) | Negative | *(Skipped.)* |
| PB-WB05 — payer bill payment within min-balance floor succeeds (Merchant, Medium risk) | Positive | *(Skipped.)* |
| PB-WB06 — payer bill payment breaching min-balance floor is blocked (Merchant, Medium risk) | Negative | *(Skipped.)* |
| PB-WB07 — biller credit within max-balance ceiling succeeds (Biller, Medium risk) | Positive | *(Skipped.)* |
| PB-WB08 — biller credit breaching max-balance ceiling is blocked (Biller, Medium risk) | Negative | *(Skipped.)* |

### `PayBill/functional/PayBillTransactionLimits.spec.ts`
*(PB-TL01–12; `test.skip`'d pending an Admin Portal "Manage Limits → Transaction" helper — EMI-87/EMI-1653/EMI-195)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| PB-TL01 — bill payments within the daily amount limit succeed (Web) | Positive | *(Skipped, EMI-87/EMI-1653/EMI-195.)* |
| PB-TL02 — cumulative bill payments exceeding the daily amount limit are blocked (Web) | Negative | *(Skipped.)* |
| PB-TL03 — bill payments within the weekly amount limit succeed (Web) | Positive | *(Skipped.)* |
| PB-TL04 — cumulative bill payments exceeding the weekly amount limit are blocked (Web) | Negative | *(Skipped.)* |
| PB-TL05 — bill payments within the monthly amount limit succeed (App) | Positive | *(Skipped.)* |
| PB-TL06 — cumulative bill payments exceeding the monthly amount limit are blocked (App) | Negative | *(Skipped.)* |
| PB-TL07 — bill payments within the daily count limit succeed | Positive | *(Skipped.)* |
| PB-TL08 — bill payment once the daily count limit is exceeded is blocked | Negative | *(Skipped.)* |
| PB-TL09 — bill payments within the weekly count limit succeed | Positive | *(Skipped.)* |
| PB-TL10 — bill payment once the weekly count limit is exceeded is blocked | Negative | *(Skipped.)* |
| PB-TL11 — bill payments within the monthly count limit succeed | Positive | *(Skipped.)* |
| PB-TL12 — bill payment once the monthly count limit is exceeded is blocked | Negative | *(Skipped.)* |

### `PayBill/functional/PayBillCommission.spec.ts`
*(PB-CM01–18; `test.skip`'d pending an Admin Portal "Commission Management" helper — EMI-2031)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| PB-CM01 — default schema applies when no custom commission exists | Positive | *(Skipped, EMI-2031.)* |
| PB-CM02 — custom per-account schema overrides the default | Positive | *(Skipped.)* |
| PB-CM03 — fixed commission deducted on a standard bill payment | Positive | *(Skipped.)* |
| PB-CM04 — fixed commission applied at minimum boundary | Positive | *(Skipped.)* |
| PB-CM05 — fixed commission applied at maximum boundary | Positive | *(Skipped.)* |
| PB-CM06 — fixed commission not applied below minimum | Negative | *(Skipped.)* |
| PB-CM07 — fixed commission not applied above maximum | Negative | *(Skipped.)* |
| PB-CM08 — percentage commission deducted on a standard bill payment | Positive | *(Skipped.)* |
| PB-CM09 — percentage commission applied at minimum boundary | Positive | *(Skipped.)* |
| PB-CM10 — percentage commission applied at maximum boundary | Positive | *(Skipped.)* |
| PB-CM11 — percentage commission not applied below minimum | Negative | *(Skipped.)* |
| PB-CM12 — percentage commission not applied above maximum | Negative | *(Skipped.)* |
| PB-CM13 — commission added on payer side / deducted on biller side | Positive | *(Skipped.)* |
| PB-CM14 — overlapping commission rules rejected | Negative | *(Skipped.)* |
| PB-CM15 — min amount cannot exceed max amount | Negative | *(Skipped.)* |
| PB-CM16 — transaction type cannot be edited on an existing commission | Negative | *(Skipped.)* |
| PB-CM17 — disabling a commission schema stops it applying | Positive | *(Skipped.)* |
| PB-CM18 — re-enabling a commission schema resumes applying it | Positive | *(Skipped.)* |

## 5. Wallet Top-up
**File Reference:** `BusinessTestCases/Topup/functional/TopupFlow.spec.ts`

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| Topup_with_Enter_Amount_MADA | Positive | Completes MADA gateway interaction and confirms balance increment. |
| Topup_with_Enter_Amount_VISA | Positive | Completes VISA gateway interaction and confirms balance increment. |
| Topup_with_Enter_Amount_MASTER | Positive | Completes MASTER gateway interaction and confirms balance increment. |
| Topup_with_Select_Amount_VISA | Positive | Uses predefined amount, completes VISA gateway and confirms balance. |
| Topup_with_Valid_TwoDecimal_Amount_VISA | Positive | Completes topup with 2-decimal amount via VISA. |
| Topup_with_Invalid_Card_Data_PayNowDisabled | Negative | Asserts invalid card data disables "Pay Now" button in gateway. |
| Topup_Failed_User_Canceled\|From_The_HyperPay_Screen | Negative | Simulates user cancel (Code 2), asserts `FAILED` state in ledger. |
| Topup_Failed_Limit_Exceeded\|From_The_HyperPay_Screen | Negative | Simulates limit exceeded (Code 4), asserts `FAILED` state in ledger. |
| Topup_Failed_Too_Many_Tries\|From_The_HyperPay_Screen | Negative | Simulates too many tries (Code 5), asserts `FAILED` state in ledger. |
| Topup_Pending_Simulation\|From_The_HyperPay_Screen | Negative | Simulates pending (Code 3), asserts `PENDING` state in ledger. |
| Topup_verifyAmountField_PreventsInvalidInput | Negative | Asserts negative sign is stripped from amount input. |
| Topup_verifyAmountField_PreventsZeroAmount | Negative | Asserts zero amount clears field and disables proceed button. |
| Topup_verifyAmountField_PreventsInvalidChars | Negative | Asserts invalid chars clear field and disable proceed button. |
| Topup_AmountValidation_ValidFloat_2_Decimals | Positive | Asserts valid 2-decimal input is accepted. |
| Topup_AmountValidation_ValidFloat_1_Decimal | Positive | Asserts valid 1-decimal input is accepted. |
| Topup_AmountValidation_InvalidFloat_3_Decimals | Negative | Asserts 3-decimal input is truncated. |
| Topup_AmountValidation_CopyPaste_Valid | Positive | Asserts valid pasted amount is accepted. |
| Topup_AmountValidation_CopyPaste_Invalid | Negative | Asserts invalid pasted amount clears field and disables proceed button. |
| Topup_CancelTransaction_PageRefresh | Negative | Asserts page refresh cancels topup and leaves balance unchanged. |
| Topup_CancelTransaction_SummaryCancelButton | Negative | Asserts summary cancel button leaves balance unchanged. |

### `Topup/functional/TopupSadadFlow.spec.ts`
*(EMI-3564 "Top-up via SADAD bill" — Jira status "To Do" when authored; no `data-testid` coverage yet, see `pageElements/Topup/TopupSadadPage.ts` for the locator caveat. Default/parallel mode — bill generation has no shared ledger state across tests.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TU-09: should generate a SADAD top-up bill with reference, amount, and expiry | Positive | Asserts a bill reference, amount, and expiry date render after Sadad "Create Bill" succeeds. |
| TU-10: should offer download or copy-reference actions on a generated bill | Positive | Asserts a "Download PDF" or "Copy Reference" control is visible on a generated bill. |
| TU-11: "My Sadad Bills" should list previously generated bills with reference/amount/date/status | Positive | Asserts at least one row renders in the SADAD bills list after generating a bill. |
| TU-13: should show a user-friendly error when SADAD bill creation fails | Negative | Mocks the Sadad create-bill call to fail and asserts a clear error message is shown. |

### `Topup/functional/TopupWalletLimits.spec.ts`
*(TU-WB01–08; `test.skip`'d pending an Admin Portal "Manage Limits → Wallet Balance" helper — EMI-1653/EMI-195 — kept 1:1 with `docs/manual-test-cases/B2B-Transactions.md` section M. Only the max-balance ceiling applies — top-up has no in-platform sender to hit a min-balance floor.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TU-WB01 — top-up within max-balance ceiling succeeds (Merchant, Low risk) | Positive | *(Skipped, EMI-1653/EMI-195.)* |
| TU-WB02 — top-up breaching max-balance ceiling is blocked (Merchant, Low risk) | Negative | *(Skipped.)* |
| TU-WB03 — top-up within max-balance ceiling succeeds (Biller, Low risk) | Positive | *(Skipped.)* |
| TU-WB04 — top-up breaching max-balance ceiling is blocked (Biller, Low risk) | Negative | *(Skipped.)* |
| TU-WB05 — top-up within max-balance ceiling succeeds (Merchant, Medium risk) | Positive | *(Skipped.)* |
| TU-WB06 — top-up breaching max-balance ceiling is blocked (Merchant, Medium risk) | Negative | *(Skipped.)* |
| TU-WB07 — top-up within max-balance ceiling succeeds (Biller, Medium risk) | Positive | *(Skipped.)* |
| TU-WB08 — top-up breaching max-balance ceiling is blocked (Biller, Medium risk) | Negative | *(Skipped.)* |

### `Topup/functional/TopupTransactionLimits.spec.ts`
*(TU-TL01–12; `test.skip`'d pending an Admin Portal "Manage Limits → Transaction" helper — EMI-87/EMI-1653/EMI-195)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TU-TL01 — top-ups within the daily amount limit succeed (App) | Positive | *(Skipped, EMI-87/EMI-1653/EMI-195.)* |
| TU-TL02 — cumulative top-ups exceeding the daily amount limit are blocked (App) | Negative | *(Skipped.)* |
| TU-TL03 — top-ups within the weekly amount limit succeed | Positive | *(Skipped.)* |
| TU-TL04 — cumulative top-ups exceeding the weekly amount limit are blocked | Negative | *(Skipped.)* |
| TU-TL05 — top-ups within the monthly amount limit succeed | Positive | *(Skipped.)* |
| TU-TL06 — cumulative top-ups exceeding the monthly amount limit are blocked | Negative | *(Skipped.)* |
| TU-TL07 — top-ups within the daily count limit succeed | Positive | *(Skipped.)* |
| TU-TL08 — top-up once the daily count limit is exceeded is blocked | Negative | *(Skipped.)* |
| TU-TL09 — High-risk account with a 0 count limit cannot top up at all | Negative | *(Skipped.)* Per EMI-87's own example row (Risk=High, count=0). |
| TU-TL10 — top-ups within the monthly count limit succeed | Positive | *(Skipped.)* |
| TU-TL11 — top-up once the monthly count limit is exceeded is blocked | Negative | *(Skipped.)* |
| TU-TL12 — top-ups within the weekly count limit succeed | Positive | *(Skipped.)* |

### `Topup/functional/TopupCommission.spec.ts`
*(TU-CM01–18; `test.skip`'d pending an Admin Portal "Commission Management" helper — EMI-2031)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| TU-CM01 — default schema applies when no custom commission exists | Positive | *(Skipped, EMI-2031.)* |
| TU-CM02 — custom per-account schema overrides the default | Positive | *(Skipped.)* |
| TU-CM03 — fixed commission deducted on a standard top-up | Positive | *(Skipped.)* |
| TU-CM04 — fixed commission applied at minimum boundary | Positive | *(Skipped.)* |
| TU-CM05 — fixed commission applied at maximum boundary | Positive | *(Skipped.)* |
| TU-CM06 — fixed commission not applied below minimum | Negative | *(Skipped.)* |
| TU-CM07 — fixed commission not applied above maximum | Negative | *(Skipped.)* |
| TU-CM08 — percentage commission deducted on a standard top-up | Positive | *(Skipped.)* |
| TU-CM09 — percentage commission applied at minimum boundary | Positive | *(Skipped.)* |
| TU-CM10 — percentage commission applied at maximum boundary | Positive | *(Skipped.)* |
| TU-CM11 — percentage commission not applied below minimum | Negative | *(Skipped.)* |
| TU-CM12 — percentage commission not applied above maximum | Negative | *(Skipped.)* |
| TU-CM13 — credited amount is net of commission | Positive | *(Skipped.)* |
| TU-CM14 — overlapping commission rules rejected | Negative | *(Skipped.)* |
| TU-CM15 — min amount cannot exceed max amount | Negative | *(Skipped.)* |
| TU-CM16 — transaction type cannot be edited on an existing commission | Negative | *(Skipped.)* |
| TU-CM17 — disabling a commission schema stops it applying | Positive | *(Skipped.)* |
| TU-CM18 — re-enabling a commission schema resumes applying it | Positive | *(Skipped.)* |

## 6. Create Bill — Bill Management
**File Reference:** `BusinessTestCases/BillManagement/functional/CreateBillFlow.spec.ts`
*(EMI-183 Bill Management, EMI-242 Excel bulk upload, EMI-3020 Predefined Items. No prior automation existed for the Biller-side "Add Bill" screens and they have no `data-testid` coverage yet — see `pageElements/BillManagement/CreateBillPage.ts` for the locator caveat. Default/parallel mode — each test creates an independent bill with no shared ledger state.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| CB-01: should create a bill with only the required fields | Positive | Asserts a single-entry bill with Beneficiary/Bill Ref./Amount only reaches the confirmation summary. |
| CB-02: should compute the amount breakdown correctly with VAT and a fixed discount | Positive | Asserts the confirmation summary's total amount renders after applying a fixed discount + VAT. |
| CB-03: "No discount" should be the default and hide the discount amount field | Positive | Asserts the discount-value input is hidden by default. |
| CB-04: selecting Fixed discount should reveal the discount amount field | Positive | Asserts the discount-value input becomes visible after selecting "Fixed". |
| CB-05: a zero discount value should be rejected when a discount type is selected | Negative | Asserts a validation error appears when discount type is set but the value is 0. |
| CB-06: should add multiple items and reflect them in the confirmation summary | Positive | Asserts 2 added item rows render and the detailed bill reaches the confirmation summary. |
| CB-09: selecting a saved product should add it as a pre-filled line item | Positive | Asserts a product picked from "My Products" appears as an item row. |
| CB-08: leaving expiry empty should create a bill that never expires | Positive | Asserts a "no expiry / never expires" indicator after submitting a bill with no expiry date. |
| CB-27: submitting without a Bill Ref. or Amount should be blocked | Negative | Asserts Submit stays disabled or a required-field error appears with only Beneficiary filled. |
| CB-14: uploading a valid Excel file should create all bills in it | Positive | Asserts a bulk-upload success message renders for a valid template file. |
| CB-15: uploading a tampered Excel file should be rejected via checksum validation | Negative | Asserts an error message renders for a tampered template file. |
| CB-16: one invalid row in the batch should roll back the entire upload | Negative | Asserts an error renders and no success message appears when one row in the batch is invalid. |

## 7. Wallet Payment QR
**File Reference:** `BusinessTestCases/QRPayment/functional/QRPaymentFlow.spec.ts`
*(EMI-590 QR payment, EMI-3545 Dynamic QR, EMI-922 QR management. No prior automation existed for this screen — see `pageElements/QRPayment/QRPaymentPage.ts` / `QRPayment/QRPaymentHelper.ts` for the locator/mock caveat: real camera scans aren't drivable in Playwright, so "scanning" mocks the app's post-scan QR-decode API call.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| QR-02 / QR-04: scanning a Dynamic QR should populate and disable the amount field | Positive | Asserts the amount field is pre-filled with the QR's amount and disabled. |
| QR-03 / QR-04: scanning a Wallet QR should leave the amount field editable for manual entry | Positive | Asserts the amount field is enabled and accepts manual entry after a Wallet QR scan. |
| QR-08: a valid QR payment should complete via OTP and show a success confirmation | Positive | Completes a QR payment through OTP and asserts a success confirmation. |
| QR-12 / QR-13: scanning an expired or already-used QR should show "Invalid or Expired QR" | Negative | Asserts the expired/reused-QR error message renders. |
| QR-15: a QR with a tampered/invalid signature should be rejected with a generic error | Negative | Asserts a signature/invalid-QR error renders for a tampered payload. |
| QR-05: an amount exceeding the payer's balance should be rejected before OTP | Negative | Asserts an insufficient-funds indicator renders before OTP for an over-balance amount. |

### `QRPayment/functional/QRPaymentWalletLimits.spec.ts`
*(QR-WB01–08; `test.skip`'d pending an Admin Portal "Manage Limits → Wallet Balance" helper — EMI-1653/EMI-195 — kept 1:1 with `docs/manual-test-cases/B2B-Transactions.md` section P)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| QR-WB01 — payer QR payment within min-balance floor succeeds (Merchant, Low risk) | Positive | *(Skipped, EMI-1653/EMI-195.)* |
| QR-WB02 — payer QR payment breaching min-balance floor is blocked (Merchant, Low risk) | Negative | *(Skipped.)* |
| QR-WB03 — payee credit within max-balance ceiling succeeds (Biller, Low risk) | Positive | *(Skipped.)* |
| QR-WB04 — payee credit breaching max-balance ceiling is blocked (Biller, Low risk) | Negative | *(Skipped.)* |
| QR-WB05 — payer QR payment within min-balance floor succeeds (Merchant, Medium risk) | Positive | *(Skipped.)* |
| QR-WB06 — payer QR payment breaching min-balance floor is blocked (Merchant, Medium risk) | Negative | *(Skipped.)* |
| QR-WB07 — payee credit within max-balance ceiling succeeds (Biller, Medium risk) | Positive | *(Skipped.)* |
| QR-WB08 — payee credit breaching max-balance ceiling is blocked (Biller, Medium risk) | Negative | *(Skipped.)* |

### `QRPayment/functional/QRPaymentTransactionLimits.spec.ts`
*(QR-TL01–12; `test.skip`'d pending an Admin Portal "Manage Limits → Transaction" helper — EMI-87/EMI-1653/EMI-195)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| QR-TL01 — QR payments within the daily amount limit succeed (App) | Positive | *(Skipped, EMI-87/EMI-1653/EMI-195.)* |
| QR-TL02 — cumulative QR payments exceeding the daily amount limit are blocked (App) | Negative | *(Skipped.)* |
| QR-TL03 — QR payments within the weekly amount limit succeed | Positive | *(Skipped.)* |
| QR-TL04 — cumulative QR payments exceeding the weekly amount limit are blocked | Negative | *(Skipped.)* |
| QR-TL05 — QR payments within the monthly amount limit succeed (Web) | Positive | *(Skipped.)* |
| QR-TL06 — cumulative QR payments exceeding the monthly amount limit are blocked (Web) | Negative | *(Skipped.)* |
| QR-TL07 — QR payments within the daily count limit succeed | Positive | *(Skipped.)* |
| QR-TL08 — QR payment once the daily count limit is exceeded is blocked | Negative | *(Skipped.)* |
| QR-TL09 — QR payments within the weekly count limit succeed | Positive | *(Skipped.)* |
| QR-TL10 — QR payment once the weekly count limit is exceeded is blocked | Negative | *(Skipped.)* |
| QR-TL11 — QR payments within the monthly count limit succeed | Positive | *(Skipped.)* |
| QR-TL12 — QR payment once the monthly count limit is exceeded is blocked | Negative | *(Skipped.)* |

### `QRPayment/functional/QRPaymentCommission.spec.ts`
*(QR-CM01–18; `test.skip`'d pending an Admin Portal "Commission Management" helper — EMI-2031)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| QR-CM01 — default schema applies when no custom commission exists | Positive | *(Skipped, EMI-2031.)* |
| QR-CM02 — custom per-account schema overrides the default | Positive | *(Skipped.)* |
| QR-CM03 — fixed commission deducted on a standard QR payment | Positive | *(Skipped.)* |
| QR-CM04 — fixed commission applied at minimum boundary | Positive | *(Skipped.)* |
| QR-CM05 — fixed commission applied at maximum boundary | Positive | *(Skipped.)* |
| QR-CM06 — fixed commission not applied below minimum | Negative | *(Skipped.)* |
| QR-CM07 — fixed commission not applied above maximum | Negative | *(Skipped.)* |
| QR-CM08 — percentage commission deducted on a standard QR payment | Positive | *(Skipped.)* |
| QR-CM09 — percentage commission applied at minimum boundary | Positive | *(Skipped.)* |
| QR-CM10 — percentage commission applied at maximum boundary | Positive | *(Skipped.)* |
| QR-CM11 — percentage commission not applied below minimum | Negative | *(Skipped.)* |
| QR-CM12 — percentage commission not applied above maximum | Negative | *(Skipped.)* |
| QR-CM13 — commission added on payer side / deducted on payee side | Positive | *(Skipped.)* |
| QR-CM14 — overlapping commission rules rejected | Negative | *(Skipped.)* |
| QR-CM15 — min amount cannot exceed max amount | Negative | *(Skipped.)* |
| QR-CM16 — transaction type cannot be edited on an existing commission | Negative | *(Skipped.)* |
| QR-CM17 — disabling a commission schema stops it applying | Positive | *(Skipped.)* |
| QR-CM18 — re-enabling a commission schema resumes applying it | Positive | *(Skipped.)* |

## 8. Guest Flow — Payment Links
**File Reference:**
`BusinessTestCases/PaymentLinks/functional/PaymentLinkResolution.spec.ts`
`BusinessTestCases/PaymentLinks/functional/PaymentLinkPayerInfoRemoval.spec.ts`
`BusinessTestCases/PaymentLinks/functional/PaymentLinkBugs.spec.ts`
`BusinessTestCases/PaymentLinks/functional/GuestWalletPayment.spec.ts`
*(MOCK ONLY — Customer-app flow with no page object/testid coverage anywhere in this Business Portal repo; see `PaymentLinkHelper.ts` / `PaymentLinkPage.ts` for the caveat. The first three files (TC-PL-001–015) predate this registry entry and target an earlier ticket set — EMI-5463, EMI-5791–5794, EMI-5774/5775/5814. `GuestWalletPayment.spec.ts` is net-new, targeting the current guest-flow tickets: EMI-5424, EMI-5446, EMI-5523, EMI-5551, EMI-5640, EMI-5653, EMI-5860.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| GF-02: a guest with no session should resolve a valid wallet link and see a sanitized summary | Positive | Asserts the summary renders and no internal identifiers (profileId/walletId) leak into the page. |
| GF-03: a guest should resolve a valid bill link and see a sanitized bill summary | Positive | Asserts the bill summary and link-type label render. |
| GF-05: an expired guest link should show an invalid/expired message and never resolve a summary | Negative | Asserts the invalid-link error renders and the summary never appears. |
| GF-06: a disabled/already-paid bill link should be rejected before payment | Negative | Mocks a 409 "already paid" response and asserts a rejection message renders. |
| GF-07: scanning a valid wallet QR as a guest must NOT show "Payment link not found" (EMI-5551 regression) | Negative | Asserts the summary renders and the "link not found" text never appears. |
| GF-08 / GF-10: a guest wallet payment must complete without a generic "Payment Failed" or "invalid wallet code" error (EMI-5640/5860 regression) | Positive | Completes a mocked guest wallet payment and asserts neither failure banner appears, then a success state renders. |
| GF-10 (regression guard): "invalid wallet code" mock reproduces the known bug shape | Negative | Confirms the bug-shape mock does surface the failure text, validating the positive assertion above is meaningful. |
| GF-09: a location-permission prompt should not prevent the guest from completing payment (EMI-5653 regression) | Positive | Runs the flow in a context with no geolocation permission granted and asserts payment still completes. |
| GF-11: a guest should be able to complete payment on a valid bill link | Positive | Completes a mocked guest bill payment and asserts a success state renders. |
| GF-13: no internal/sensitive fields should appear in the guest payment summary | Negative | Asserts stack-trace/SQL/internal-ID text never appears on the summary screen. |
| GF-14: a guest JWT scoped to one link must be rejected when used against a different link's payment endpoint | Negative | Mocks a 401 Unauthorized response and asserts a failure/unauthorized state renders. |

## 9. Money Request
**File Reference:** `BusinessTestCases/MoneyRequest/functional/MoneyRequestFlow.spec.ts`
*(EMI-834, epic EMI-2203. No prior automation existed for this screen — no `data-testid` coverage yet, see `pageElements/MoneyRequest/MoneyRequestPage.ts` for the locator caveat. Test IDs mirror EMI-834's own TC-FP/NE/EC/SEC/UI test list 1:1.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| MR-FP-01: should create a money request and show it in Requests Sent as REQUESTED | Positive | Asserts the new request appears in Requests Sent with status REQUESTED. |
| MR-FP-02: the requested party should see the request and complete payment via Accept → Pay | Positive | Completes a two-account Accept→Pay flow through OTP and asserts a success state renders, after asserting the payment breakdown (amount/total) is visible. |
| declining a request should not move any funds and update status to DECLINED | Negative | Asserts the requester's copy of the request shows DECLINED after the payer declines. |
| MR-NE-01: accepting with an amount above balance should show Insufficient Funds | Negative | Asserts an insufficient-funds/limit-exceeded indicator renders; skipped if no pre-seeded over-balance request exists. |
| MR-EC-01: the requester can cancel a pending request before it is accepted | Positive | Asserts status becomes CANCELLED after the requester cancels. |
| MR-SEC-01: only the intended requested profile can act on a request | Negative | *(Skipped — needs a third unrelated fixture account not yet available.)* |
| MR-UI-03: generating a QR for a request should show the QR image, expiry, and one-time-use flag | Positive | Asserts the QR modal/image, expiry label, and one-time-use label are all visible. |

## 10. Reconciliation & End-of-Day (EOD) Processing
**File Reference:**
`BusinessTestCases/Reconciliation/api/ReconciliationFlow.spec.ts`
`BusinessTestCases/Reconciliation/api/EODFlow.spec.ts`
*(EMI-4537 core framework (Done) + DRMS overhaul EMI-4538/4541/4542/4543/4549/4550/4551 (To Do), epic EMI-2177; EOD tickets EMI-636/637/710/5258 (Done), EMI-5920 (To Do), regression EMI-5771. Finance/Ops + Admin Portal functions with no Business Portal UI — modeled as `request`-fixture API suites, every test `test.skip`'d pending Admin Portal / Castlemock / Ops tooling access, kept 1:1 with `docs/manual-test-cases/Transaction-Operations.md` sections B–C so coverage isn't silently dropped.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| RC-01–RC-06 (External Reconciliation) | Positive/Negative | *(Skipped, EMI-4537.)* Missing-TXN detection, discrepancy flagging, omnibus-vs-Control-Wallet mismatch, auto-insert with metadata, running_balance impact, reconciliation_runs logging. |
| RC-07–RC-13 (Internal Reconciliation) | Positive/Negative | *(Skipped, EMI-4537.)* running_balance mismatch detection, stale wallet-balance flagging, control-wallet-sum mismatch, manual/scheduled rebuild, history archiving, wallets-table update. |
| RC-14–RC-20 (DRMS) | Positive | *(Skipped, EMI-4538/4541/4542/4543/4549/4550/4551.)* Rules engine, pair management, systems management, schema mapping, ingestion config, run execution & report generation, report export. |
| EOD-01–EOD-04 (Internal/External/Balance/Incoming-TXN jobs) | Positive | *(Skipped, EMI-636/637/710/5258.)* |
| EOD-05: a transferred amount must be released back to the user after a FAILED EOD bank statement | Negative | *(Skipped, EMI-5771.)* Full Castlemock repro sequence documented inline, ready to implement once mock-server access exists. |
| EOD-06: a transferred amount stays reserved while the EOD bank statement is still pending | Positive | *(Skipped, EMI-5771.)* |
| EOD-07–EOD-15 (T01–T09, recon_id Three-Way Matching) | Positive/Negative | *(Skipped, EMI-5920.)* Full match, held/missing/unknown/duplicate recon_id exception classes E13/E14/E15/E18/E19, device-level (per-TID) mismatch, matched-but-held classification. |
| EOD-16 / EOD-17 (held-funds line, discrepancy queue aging) | Positive | *(Skipped, EMI-5920.)* |

## 11. Transaction Reversal & Adjustment
**File Reference:**
`BusinessTestCases/TransactionOperations/api/TransactionReversal.spec.ts`
`BusinessTestCases/TransactionOperations/api/TransactionAdjustment.spec.ts`
*(EMI-2028 Transaction Reversal (epic EMI-2208) and EMI-2219 Transaction Adjustment (epic EMI-2209) — Financial Operations Manager / Admin Portal functions with no Business Portal UI. Every test `test.skip`'d pending Admin Portal tooling access, kept 1:1 with `docs/manual-test-cases/Transaction-Operations.md` sections D–E.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| RV-01–RV-03 (reverse by state: Successful/Pending/Failed) | Positive | *(Skipped, EMI-2028.)* |
| RV-04 / RV-05 (batch vs single-in-batch reversal) | Positive | *(Skipped.)* |
| RV-06–RV-08 (idempotency, reason logging, ineligible-transaction error) | Negative | *(Skipped.)* RV-08 targets the exact AC error string. |
| RV-09 / RV-10 (closed-loop / open-loop coverage) | Positive | *(Skipped.)* |
| AD-01–AD-05 (append-only correction: amount/reference/date, direction lock) | Positive | *(Skipped, EMI-2219.)* |
| AD-06–AD-10, AD-14 (reason requirement, audit metadata, multi-adjustment, read-only batch ref, full audit trail) | Positive | *(Skipped.)* |
| AD-11: adjusting a settled transaction correctly replays the reserve→available flow | Positive | *(Skipped.)* Encodes EMI-2219's 4-step "Pair adjustment edge case" verbatim. |
| AD-12 / AD-13 (missing-field validation, safe generic API error) | Negative | *(Skipped.)* AD-13 targets the exact AC error string. |

## 12. Bill Beneficiary Management
**File Reference:** `BusinessTestCases/BeneficiaryManagement/functional/BeneficiaryManagementFlow.spec.ts`
*(EMI-185, epic EMI-2192. The homepage sidebar's "Manage Beneficiary" link already existed and was nav-smoke-tested in `Homepage/functional/HomepageSidebarNavigation.spec.ts`, but the add/list/filter/edit/delete screen itself had no prior page object or coverage — no `data-testid` coverage yet, see `pageElements/BeneficiaryManagement/BeneficiaryManagementPage.ts` for the locator caveat. Test IDs mirror `docs/manual-test-cases/B2B-Transactions.md` section S (BM-01..BM-14) 1:1.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| BM-01: should add a beneficiary with a valid alias and CRN, showing the resolved brand name | Positive | Asserts the CRN profile lookup resolves and shows a brand name, then a success toast after save. Skipped without `BENEFICIARY_KNOWN_CRN`. |
| BM-06: when OTP is required, a valid OTP completes the add-beneficiary flow | Positive | Handles an inline OTP step conditionally, then asserts success. Skipped without `BENEFICIARY_KNOWN_CRN`. |
| BM-02–BM-04 (alias min-length, max-length, special-character validation) | Negative | Asserts a field-level validation error blocks save for a 1-2 char alias, a 16+ char alias, and an alias containing symbols. |
| BM-05: looking up a CRN that does not exist blocks submission with an error | Negative | Asserts a lookup-failure error renders for an unknown CRN. |
| BM-07: the beneficiaries list displays Alias and CRN for each row | Positive | Asserts at least one list row is visible. |
| BM-08 / BM-09 (filter list by Alias / by CR) | Positive | Asserts the list still renders after applying each filter. BM-09 skipped without `BENEFICIARY_KNOWN_CRN`. |
| BM-10: filtering by Status narrows the list to matching rows | Positive | Selects the first status option and asserts the list still renders. |
| BM-11: deleting a beneficiary removes it from the list after confirmation | Positive | Asserts the row count decreases and a success toast appears after confirming delete. |
| BM-12: editing a beneficiary updates its alias in the list | Positive | Asserts the new alias text appears in the list after save. |
| BM-13: adding a beneficiary with an alias already in use is rejected | Negative | Asserts an "already exists" error toast renders. Skipped without `BENEFICIARY_KNOWN_CRN`. |
| BM-14: submitting without an Alias or CRN is blocked | Negative | Asserts save is disabled, or a required-field error renders on submit. |

## 13. Transaction Ledger — Initiator Attribution
**File Reference:** `BusinessTestCases/TransactionLedger/api/TransactionLedgerInitiator.spec.ts`
*(EMI-5839, status Testing. BE task requiring the transaction ledger's `initiator` field to be populated consistently for pending and successful ledger entries. Financial Operations / ledger-level concern with no Business Portal UI surface — confirmed against `pageElements/Transactions/TransactionSummaryPage.ts`, whose summary panel renders commission/VAT/total but nothing initiator-related. Every test `test.skip`'d pending ledger/DB or Admin Portal access, same rationale as `TransactionOperations/` and `Reconciliation/`, kept 1:1 with `docs/manual-test-cases/Transaction-Operations.md` section F.)*

| Exact Test Title (From Code) | Test Type | Target Assertions & Verification Points |
| :--- | :--- | :--- |
| LI-01 / LI-02 (bill payment link, pending / successful) | Positive | *(Skipped, EMI-5839.)* Ledger entry has `initiator` = `"System, MjdPay Profile User"` per the ticket's comment-thread clarification — not stated in the AC text itself. |
| LI-03 / LI-04 (wallet payment link, pending / successful) | Positive | *(Skipped.)* Same expected initiator value as LI-01/02. |
| LI-05: initiator is consistent between pending and successful states of the same transaction | Positive | *(Skipped.)* Directly covers AC "Initiator source is consistent across transaction states." |
| LI-06: initiator field is never null or blank across sampled in-scope transactions | Positive | *(Skipped.)* Data-quality sweep across bill/wallet payment link ledger entries. |
| LI-07: initiator populated — or documented as unsupported — for flows beyond the two named | Positive | *(Skipped — additionally blocked on AC 4's flow list, which the ticket does not yet provide.)* Not a fixed assertion until engineering enumerates ledger-writing flows; flagged back to the ticket rather than scope-assumed. |
| LI-08: ledger behavior for failed/cancelled/expired transactions is documented | Negative | *(Skipped — out of scope of the current AC, which only defines pending/successful.)* Kept to surface the gap rather than silently drop coverage. |

<!-- AUTOMATION_REGISTRY_END -->
