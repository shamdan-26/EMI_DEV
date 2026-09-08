# Manual Test Cases — Registration — NAFATH Verification Step

Context: after Sign Up, the applicant is redirected to verify their identity via NAFATH (the Saudi national digital-identity app). This step cannot be automated end-to-end (NAFATH approval happens on the applicant's own device) — coverage here is limited to the redirect page's elements and countdown behavior (EMI-4895/EMI-4937).

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. NAFATH Step Page Elements

Context: covers "Registration - NAFATH Step Page Elements".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RN-01 | Display the MJD Pay logo | Load the NAFATH step | The MJD Pay logo is visible | P3 |
| RN-02 | Link the MJD Pay logo to the landing page | Load the NAFATH step | Link the MJD Pay logo to the landing page | P2 |
| RN-03 | Display the EN language button | Load the NAFATH step | The EN language button is visible | P2 |
| RN-04 | Display the Arabic language button | Load the NAFATH step | The Arabic language button is visible | P2 |
| RN-05 | Display the theme toggle button | Load the NAFATH step | The theme toggle button is visible | P2 |
| RN-06 | Display the "Create Account" eyebrow text | Load the NAFATH step | The "Create Account" eyebrow text is visible | P3 |
| RN-07 | Display "Business Info" as the first outer step | Load the NAFATH step | "Business Info" as the first outer step is visible | P2 |
| RN-08 | Display "NAFATH" as the active outer step | Load the NAFATH step | "NAFATH" as the active outer step is visible | P2 |
| RN-09 | Display "Products" as the third outer step | Load the NAFATH step | "Products" as the third outer step is visible | P2 |
| RN-10 | Display "Contract" as the fourth outer step | Load the NAFATH step | "Contract" as the fourth outer step is visible | P2 |
| RN-11 | Display the "Verify with Nafath" heading | Load the NAFATH step | The "Verify with Nafath" heading is visible | P3 |
| RN-12 | Display the verification instruction text | Load the NAFATH step | The verification instruction text is visible | P3 |
| RN-13 | Display step 1 "Open Nafath app and sign in" | Load the NAFATH step | Step 1 "Open Nafath app and sign in" is visible | P2 |
| RN-14 | Display step 2 "Select the number shown" | Load the NAFATH step | Step 2 "Select the number shown" is visible | P2 |
| RN-15 | Display step 3 "Approve" | Load the NAFATH step | Step 3 "Approve" is visible | P2 |
| RN-16 | Display the redirect note with a countdown timer | Load the NAFATH step | The redirect note with a countdown timer is visible | P2 |
| RN-17 | Display the "Verify" button as initially disabled while the countdown is active (EMI-4895) | Load the NAFATH step | The "Verify" button as initially disabled while the countdown is active is visible | P1 |
| RN-18 | Not display a resend option in the Nafath panel (EMI-4895) | Load the NAFATH step | A resend option in the Nafath panel is not shown | P2 |

## B. Nafath Verification

Context: covers "Registration - Nafath Verification".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RN-19 | Display the Nafath page after Sign Up | Load the NAFATH step | The Nafath page after Sign Up is visible | P1 |
| RN-20 | Display a countdown timer on the Nafath page | Load the NAFATH step | A countdown timer on the Nafath page is visible | P2 |
| RN-21 | Have the Verify button disabled while the redirect countdown is active (EMI-4895) | Load the NAFATH step | Have the Verify button disabled while the redirect countdown is active | P1 |
| RN-22 | Keep the Verify button disabled mid-countdown, not just on load (EMI-4895) | Mid-countdown, not just on load | The primary action control stays disabled | P1 |
| RN-23 | Enable the Verify button once the 20-second countdown expires (EMI-4937) | Set up the state: the Verify button once the 20-second countdown expires | The control becomes enabled | P1 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration NAFATH step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationNafathPage.spec.ts` — page elements & layout
- `BusinessTestCases/Registration/functional/RegistrationNafathFunctionality.spec.ts` — the redirect countdown and Verify-button enable timing (EMI-4895, EMI-4937)

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationNafathPage.ts`. NAFATH approval itself is out of scope — it requires the applicant's own NAFATH app.
