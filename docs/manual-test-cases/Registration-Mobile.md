# Manual Test Cases — Registration — Mobile Number Step

Context: the first screen of Business-portal registration at `/business/auth/register`. The applicant enters a Saudi mobile number to receive an OTP and begin registration. Covers static page elements and mobile-field validation.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Page Elements

Context: covers "Registration - Mobile Number Page".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RM-01 | Open the Registration URL | Navigate to the Registration URL | The page loads successfully | P2 |
| RM-02 | Have the correct page title | Load the Mobile Number page | Page title is correct | P2 |
| RM-03 | Display the MJD Pay logo | Load the Mobile Number page | The MJD Pay logo is visible | P3 |
| RM-04 | Display the MJD Pay logo as a clickable link | Load the Mobile Number page | The MJD Pay logo as a clickable link is visible | P3 |
| RM-05 | Navigate to a valid page when the logo link is clicked | The logo link is clicked | Navigate to a valid page | P1 |
| RM-06 | Display the EN language button | Load the Mobile Number page | The EN language button is visible | P2 |
| RM-07 | Not have EN as the active language by default | Load the Mobile Number page | Not have EN as the active language by default | P2 |
| RM-08 | Display the Arabic language button | Load the Mobile Number page | The Arabic language button is visible | P2 |
| RM-09 | Have Arabic as the active language by default | Load the Mobile Number page | Have Arabic as the active language by default | P2 |
| RM-10 | Display the theme toggle button | Load the Mobile Number page | The theme toggle button is visible | P2 |
| RM-11 | Change the theme when the toggle is clicked | The toggle is clicked | Change the theme | P2 |
| RM-12 | Display the "Create Account" eyebrow text | Load the Mobile Number page | The "Create Account" eyebrow text is visible | P3 |
| RM-13 | Display the "Enter Phone Number" heading | Load the Mobile Number page | The "Enter Phone Number" heading is visible | P3 |
| RM-14 | Display the "Start your business registration" description | Load the Mobile Number page | The "Start your business registration" description is visible | P2 |
| RM-15 | Display the Mobile number input | Load the Mobile Number page | The Mobile number input is visible | P2 |
| RM-16 | Have the correct placeholder for Mobile number | Load the Mobile Number page | Placeholder for Mobile number is correct | P2 |
| RM-17 | Display the Next button | Load the Mobile Number page | The Next button is visible | P1 |
| RM-18 | Have Next button disabled when Mobile number is empty | Mobile number is empty | Have Next button disabled | P1 |
| RM-19 | Display the "Already have an account?" text | Load the Mobile Number page | The "Already have an account?" text is visible | P3 |
| RM-20 | Display the Log In link | Load the Mobile Number page | The Log In link is visible | P3 |

## B. Field Validation & Navigation

Context: covers "Registration - Mobile Number Functionality".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RM-21 | Navigate away from registration when the logo is clicked | The logo is clicked | Navigate away from registration | P1 |
| RM-22 | Switch to Arabic (RTL) when Arabic button is clicked | Arabic button is clicked | Switch to Arabic (RTL) | P2 |
| RM-23 | Accept input in the Mobile number field | Enter input in the Mobile number field | The value is accepted and retained in the field | P2 |
| RM-24 | Not accept alphabetic characters in the mobile field | Enter alphabetic characters in the mobile field | The value is rejected — not retained in the field | P2 |
| RM-25 | Not accept special characters in the mobile field | Enter special characters in the mobile field | The value is rejected — not retained in the field | P2 |
| RM-26 | Enable Next button when a valid KSA mobile number is filled | A valid KSA mobile number is filled | The control becomes enabled | P1 |
| RM-27 | Disable Next button again after clearing the Mobile number field | Set up the state: Next button again after clearing the Mobile number field | The control becomes/stays disabled | P1 |
| RM-28 | Reject a mobile number that does not start with 5 | Enter a mobile number that does not start with 5 | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RM-29 | Reject a mobile number shorter than 9 digits | Enter a mobile number shorter than 9 digits | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RM-30 | Not allow more than 9 digits in the Mobile number field | Attempt to enter more than 9 characters | Input is capped at 9 characters | P2 |
| RM-31 | Not execute an XSS payload entered in the Mobile number field | Enter a script/JS-URI payload in Mobile number field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RM-32 | Not accept a SQL injection pattern in the Mobile number field | Enter a SQL injection pattern in the Mobile number field | The value is rejected — not retained in the field | P1 |
| RM-33 | Navigate to the login page when Log In is clicked | Log In is clicked | Navigate to the login page | P1 |
| RM-34 | Open the registration page when Sign Up is clicked on the login page | Sign Up is clicked on the login page | Open the registration page | P1 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Mobile step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationMobilePage.spec.ts` — page elements & layout
- `BusinessTestCases/Registration/functional/RegistrationMobileFunctionality.spec.ts` — field validation, XSS/SQLi inertness, and navigation

Supporting helpers: `BusinessTestCases/Registration/RegistrationHelper.ts` and `BusinessTestCases/pageElements/Registration/RegistrationMobilePage.ts`.
