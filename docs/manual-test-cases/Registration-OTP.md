# Manual Test Cases — Registration — Mobile OTP Popup

Context: after submitting a mobile number, a one-time-password popup may appear (skipped entirely when OTP is disabled for the environment). The applicant enters the OTP to advance to Business Info.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Page Elements

Context: covers "Registration - OTP Popup Page Elements".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RO-01 | Display the Enter OTP heading | Load the OTP popup | The Enter OTP heading is visible | P3 |
| RO-02 | Display the OTP instruction message | Load the OTP popup | The OTP instruction message is visible | P2 |
| RO-03 | Display OTP input boxes | Load the OTP popup | OTP input boxes is visible | P2 |
| RO-04 | Display the countdown timer | Load the OTP popup | The countdown timer is visible | P2 |
| RO-05 | Display the Cancel button | Load the OTP popup | The Cancel button is visible | P2 |
| RO-06 | Display the Verify button | Load the OTP popup | The Verify button is visible | P1 |
| RO-07 | Display the Click to resend button | Load the OTP popup | The Click to resend button is visible | P2 |

## B. Functionality

Context: covers "Registration - OTP Functionality".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RO-08 | Have Verify button disabled when OTP inputs are empty | OTP inputs are empty | Have Verify button disabled | P1 |
| RO-09 | Keep Verify disabled when fewer than all OTP digits are entered | Fewer than all OTP digits are entered | The primary action control stays disabled | P1 |
| RO-10 | Enable Verify button when all OTP inputs are filled | All OTP inputs are filled | The control becomes enabled | P1 |
| RO-11 | Not accept non-numeric characters in OTP inputs | Enter non-numeric characters in OTP inputs | The value is rejected — not retained in the field | P2 |
| RO-12 | Auto-advance focus to the next input when a digit is entered | A digit is entered | Auto-advance focus to the next input | P1 |
| RO-13 | Have Click to resend button disabled while countdown is active | Load the OTP popup | Have Click to resend button disabled while countdown is active | P1 |
| RO-14 | Enable resend button after countdown expires | Set up the state: resend button after countdown expires | The control becomes enabled | P1 |
| RO-15 | Remain on OTP popup after submitting wrong OTP | Load the OTP popup | Remain on OTP popup after submitting wrong OTP | P1 |
| RO-16 | Advance to the Business Info step after entering the correct OTP | Load the OTP popup | Advance to the Business Info step after entering the correct OTP | P1 |
| RO-17 | Close the OTP popup when Cancel is clicked | Cancel is clicked | Close the OTP popup | P2 |
| RO-18 | Return to the mobile number page when Cancel is clicked | Cancel is clicked | Return to the mobile number page | P2 |
| RO-19 | Pre-fill the mobile number when returning via Cancel | Returning via Cancel | Pre-fill the mobile number | P2 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration OTP popup. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationOtpPopup.spec.ts` — page elements (skips cleanly when OTP is disabled for the environment)
- `BusinessTestCases/Registration/functional/RegistrationOtpFunctionality.spec.ts` — input behavior, resend cooldown, wrong-OTP handling, Cancel flow

Supporting helper: `BusinessTestCases/Registration/RegistrationHelper.ts` (`fillOTP`, `getOtpFromDb`).
