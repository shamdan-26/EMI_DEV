# Manual Test Cases — Registration — Financial & Business Step (Tab 2 of 3)

Context: Tab 2 of registration. The applicant enters four expected-volume figures (Monthly Expected Number/Sum Of Bills, Expected Monthly Withdrawal/Deposit) and selects an Industry and Annual Income bracket, then advances to Verification & Uploads.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Financial & Business Step (Tab 2 of 3) — read-only

Context: covers "Registration – Financial & Business Step (Tab 2 of 3) — read-only".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RF-01 | Display the MJD Pay logo | Load the Financial & Business tab | The MJD Pay logo is visible | P3 |
| RF-02 | Link the MJD Pay logo to the landing page | Load the Financial & Business tab | Link the MJD Pay logo to the landing page | P2 |
| RF-03 | Display the EN language button | Load the Financial & Business tab | The EN language button is visible | P2 |
| RF-04 | Display the Arabic language button | Load the Financial & Business tab | The Arabic language button is visible | P2 |
| RF-05 | Display the Switch theme button | Load the Financial & Business tab | The Switch theme button is visible | P2 |
| RF-06 | Show the Financial & Business step fields on arrival | Load the Financial & Business tab | Show the Financial & Business step fields on arrival | P2 |
| RF-07 | Show the Financial & Business tab as active | Load the Financial & Business tab | Show the Financial & Business tab as active | P2 |
| RF-08 | Mark the Financial & Business inner tab as active (is-active) | Load the Financial & Business tab | Mark the Financial & Business inner tab as active (is-active) | P2 |
| RF-09 | Display all four step indicators | Load the Financial & Business tab | All four step indicators is visible | P2 |
| RF-10 | Display the Monthly Expected Number Of Bills label | Load the Financial & Business tab | The Monthly Expected Number Of Bills label is visible | P3 |
| RF-11 | Display the Monthly Expected Number Of Bills field | Load the Financial & Business tab | The Monthly Expected Number Of Bills field is visible | P2 |
| RF-12 | Show the correct placeholder for Monthly Expected Number Of Bills | Load the Financial & Business tab | Show the correct placeholder for Monthly Expected Number Of Bills | P2 |
| RF-13 | Display the Monthly Expected Sum Of Bills label | Load the Financial & Business tab | The Monthly Expected Sum Of Bills label is visible | P3 |
| RF-14 | Display the Monthly Expected Sum Of Bills field | Load the Financial & Business tab | The Monthly Expected Sum Of Bills field is visible | P2 |
| RF-15 | Show the correct placeholder for Monthly Expected Sum Of Bills | Load the Financial & Business tab | Show the correct placeholder for Monthly Expected Sum Of Bills | P2 |
| RF-16 | Display the Expected Monthly Withdrawal label | Load the Financial & Business tab | The Expected Monthly Withdrawal label is visible | P3 |
| RF-17 | Display the Expected Monthly Withdrawal field | Load the Financial & Business tab | The Expected Monthly Withdrawal field is visible | P2 |
| RF-18 | Show the correct placeholder for Expected Monthly Withdrawal | Load the Financial & Business tab | Show the correct placeholder for Expected Monthly Withdrawal | P2 |
| RF-19 | Display the Expected Monthly Deposit label | Load the Financial & Business tab | The Expected Monthly Deposit label is visible | P3 |
| RF-20 | Display the Expected Monthly Deposit field | Load the Financial & Business tab | The Expected Monthly Deposit field is visible | P2 |
| RF-21 | Show the correct placeholder for Expected Monthly Deposit | Load the Financial & Business tab | Show the correct placeholder for Expected Monthly Deposit | P2 |
| RF-22 | Display the Industries dropdown label | Load the Financial & Business tab | The Industries dropdown label is visible | P3 |
| RF-23 | Display the Industries dropdown | Load the Financial & Business tab | The Industries dropdown is visible | P2 |
| RF-24 | Show "Select Option" as the default for Industries | Load the Financial & Business tab | Show "Select Option" as the default for Industries | P2 |
| RF-25 | Display the Annual Income dropdown label | Load the Financial & Business tab | The Annual Income dropdown label is visible | P3 |
| RF-26 | Display the Annual Income dropdown | Load the Financial & Business tab | The Annual Income dropdown is visible | P2 |
| RF-27 | Show "Select Option" as the default for Annual Income | Load the Financial & Business tab | Show "Select Option" as the default for Annual Income | P2 |
| RF-28 | Display the Back button | Load the Financial & Business tab | The Back button is visible | P2 |
| RF-29 | Display the Next button | Load the Financial & Business tab | The Next button is visible | P1 |
| RF-30 | Keep Next disabled when required fields are empty | Required fields are empty | The primary action control stays disabled | P1 |
| RF-31 | Display "Already have an account?" text | Load the Financial & Business tab | "Already have an account?" text is visible | P3 |
| RF-32 | Display the Log In link | Load the Financial & Business tab | The Log In link is visible | P3 |
| RF-33 | Display "By continuing, you agree to our" text | Load the Financial & Business tab | "By continuing, you agree to our" text is visible | P3 |
| RF-34 | Display Terms & Conditions link | Load the Financial & Business tab | Terms & Conditions link is visible | P3 |
| RF-35 | Display Privacy Policy link | Load the Financial & Business tab | Privacy Policy link is visible | P3 |

## B. Financial & Business Step (Tab 2 of 3) — stateful

Context: covers "Registration – Financial & Business Step (Tab 2 of 3) — stateful".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RF-36 | Accept numeric input for Monthly Expected Sum Of Bills | Enter numeric input for Monthly Expected Sum Of Bills | The value is accepted and retained in the field | P2 |
| RF-37 | Accept numeric input for Expected Monthly Withdrawal | Enter numeric input for Expected Monthly Withdrawal | The value is accepted and retained in the field | P2 |
| RF-38 | Accept numeric input for Expected Monthly Deposit | Enter numeric input for Expected Monthly Deposit | The value is accepted and retained in the field | P2 |
| RF-39 | Display the Banks dropdown label | Load the Financial & Business tab | The Banks dropdown label is visible | P3 |
| RF-40 | Open the Industries dropdown when clicked | Clicked | Open the Industries dropdown | P2 |
| RF-41 | Open the Annual Income dropdown when clicked | Clicked | Open the Annual Income dropdown | P2 |
| RF-42 | Open the Banks dropdown when clicked | Clicked | Open the Banks dropdown | P2 |
| RF-43 | Return to Business Info tab when Back is clicked | Back is clicked | Return to Business Info tab | P2 |
| RF-44 | Proceed to Verification & Uploads tab when Next is clicked with valid data | Next is clicked with valid data | Proceed to Verification & Uploads tab | P1 |

## C. Financial & Business Step (Tab 2 of 3) — dedicated asset

Context: covers "Registration – Financial & Business Step (Tab 2 of 3) — dedicated asset".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RF-45 | Accept numeric input for Monthly Expected Number Of Bills | Enter numeric input for Monthly Expected Number Of Bills | The value is accepted and retained in the field | P2 |

## D. Financial & Business Functionality

Context: covers "Registration - Financial & Business Functionality".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RF-46 | Accept numeric input for Monthly Expected Number Of Bills | Enter numeric input for Monthly Expected Number Of Bills | The value is accepted and retained in the field | P2 |
| RF-47 | Accept numeric input for Monthly Expected Sum Of Bills | Enter numeric input for Monthly Expected Sum Of Bills | The value is accepted and retained in the field | P2 |
| RF-48 | Accept numeric input for Expected Monthly Withdrawal | Enter numeric input for Expected Monthly Withdrawal | The value is accepted and retained in the field | P2 |
| RF-49 | Accept numeric input for Expected Monthly Deposit | Enter numeric input for Expected Monthly Deposit | The value is accepted and retained in the field | P2 |
| RF-50 | Not accept alphabetic characters in the Monthly Expected Number field | Enter alphabetic characters in the Monthly Expected Number field | The value is rejected — not retained in the field | P2 |
| RF-51 | Not accept special characters in the Monthly Expected Sum field | Enter special characters in the Monthly Expected Sum field | The value is rejected — not retained in the field | P2 |
| RF-52 | Not accept alphabetic characters in the Expected Monthly Withdrawal field | Enter alphabetic characters in the Expected Monthly Withdrawal field | The value is rejected — not retained in the field | P2 |
| RF-53 | Not accept special characters in the Expected Monthly Deposit field | Enter special characters in the Expected Monthly Deposit field | The value is rejected — not retained in the field | P2 |
| RF-54 | Not retain a negative number in the Monthly Expected Number field | Enter a negative number in the Monthly Expected Number field | The value is not retained in the field | P2 |
| RF-55 | Not retain a decimal point in the Monthly Expected Sum field | Enter a decimal point in the Monthly Expected Sum field | The value is not retained in the field | P2 |
| RF-56 | Handle a very large value (15 digits) in the Expected Monthly Withdrawal field without crashing | Enter an oversized/edge-case value: a very large value (15 digits) in the Expected Monthly Withdrawal field without crashing | The page handles it gracefully — no crash | P3 |
| RF-57 | Treat a zero value in the Expected Monthly Deposit field as valid input | Enter the edge-case value: a zero value in the Expected Monthly Deposit field | The value is accepted as valid | P2 |
| RF-58 | Not execute an XSS payload entered in the Monthly Expected Number field | Enter a script/JS-URI payload in Monthly Expected Number field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RF-59 | Not execute an XSS payload entered in the Monthly Expected Sum field | Enter a script/JS-URI payload in Monthly Expected Sum field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RF-60 | Not accept a SQL injection pattern in the Expected Monthly Withdrawal field | Enter a SQL injection pattern in the Expected Monthly Withdrawal field | The value is rejected — not retained in the field | P1 |
| RF-61 | Not accept a SQL injection pattern in the Expected Monthly Deposit field | Enter a SQL injection pattern in the Expected Monthly Deposit field | The value is rejected — not retained in the field | P1 |
| RF-62 | Keep Next disabled when Monthly Expected Number Of Bills is 0 | Monthly Expected Number Of Bills is 0 | The primary action control stays disabled | P1 |
| RF-63 | Keep Next disabled when Monthly Expected Sum Of Bills has a leading zero | Monthly Expected Sum Of Bills has a leading zero | The primary action control stays disabled | P1 |
| RF-64 | Restore valid values to all four fields after boundary/security probing | Load the Financial & Business tab | Restore valid values to all four fields after boundary/security probing | P2 |
| RF-65 | Open the Industries dropdown when clicked | Clicked | Open the Industries dropdown | P2 |
| RF-66 | Reflect the selected industry in the Industries dropdown | Load the Financial & Business tab | Reflect the selected industry in the Industries dropdown | P2 |
| RF-67 | Open the Annual Income dropdown when clicked | Clicked | Open the Annual Income dropdown | P2 |
| RF-68 | Reflect the selected income in the Annual Income dropdown | Load the Financial & Business tab | Reflect the selected income in the Annual Income dropdown | P2 |
| RF-69 | Filter the Industries options when typing in the dropdown search field | Typing in the dropdown search field | Filter the Industries options | P2 |
| RF-70 | Filter the Annual Income options when typing in the dropdown search field | Typing in the dropdown search field | Filter the Annual Income options | P2 |
| RF-71 | Keep Next disabled when only the numeric fields are filled and no dropdown is selected | Only the numeric fields are filled and no dropdown is selected | The primary action control stays disabled | P1 |
| RF-72 | Enable Next when all required fields and dropdowns are filled | All required fields and dropdowns are filled | The control becomes enabled | P1 |
| RF-73 | Return to the Business Info step when Back is clicked | Back is clicked | Return to the Business Info step | P2 |
| RF-74 | Preserve the email on Business Info step after navigating back | Load the Financial & Business tab | Preserve the email on Business Info step after navigating back | P2 |
| RF-75 | Allow re-advancing to Financial step after going back to Info step | Load the Financial & Business tab | Allow re-advancing to Financial step after going back to Info step | P2 |
| RF-76 | Advance to Verification & Uploads step when Next is clicked with valid data | Next is clicked with valid data | Advance to Verification & Uploads step | P1 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Financial & Business step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationFinancialPage.spec.ts` — page elements (read-only, stateful, and dedicated-asset sections)
- `BusinessTestCases/Registration/functional/RegistrationFinancialFunctionality.spec.ts` — numeric field validation (boundaries, XSS/SQLi, negative/decimal/zero handling), Industries/Annual Income dropdown search, Next-button logic, and Back navigation

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationFinancialPage.ts`.
