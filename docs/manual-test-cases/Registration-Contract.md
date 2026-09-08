# Manual Test Cases — Registration — Contract Review Step

Context: the final step of registration. The applicant reviews the generated contract document, may download it as a PDF, must scroll to its end (auto-checking the agreement checkbox) or check it manually, then submits to complete registration.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Contract Review

Context: covers "Registration — Contract Review".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RC-01 | Display the MJD Pay logo | Load the Contract Review step | The MJD Pay logo is visible | P3 |
| RC-02 | Link the logo to the business landing page | Load the Contract Review step | Link the logo to the business landing page | P2 |
| RC-03 | Display the EN language button | Load the Contract Review step | The EN language button is visible | P2 |
| RC-04 | Display the Arabic (العربية) language button | Load the Contract Review step | The Arabic (العربية) language button is visible | P2 |
| RC-05 | Display the Switch theme button | Load the Contract Review step | The Switch theme button is visible | P2 |
| RC-06 | Display the "Final step" label | Load the Contract Review step | The "Final step" label is visible | P3 |
| RC-07 | Display the "Contract review" title | Load the Contract Review step | The "Contract review" title is visible | P3 |
| RC-08 | Display instruction text about reading and agreeing to complete registration | Load the Contract Review step | Instruction text about reading and agreeing to complete registration is visible | P3 |
| RC-09 | Display all four outer step labels: Business Info, NAFATH, Products, Contract | Load the Contract Review step | All four outer step labels: Business Info, NAFATH, Products, Contract is visible | P3 |
| RC-10 | Mark the Contract tab as the active step | Load the Contract Review step | Mark the Contract tab as the active step | P2 |
| RC-11 | Display the "Download PDF file" button | Load the Contract Review step | The "Download PDF file" button is visible | P2 |
| RC-12 | Display the contract document title | Load the Contract Review step | The contract document title is visible | P3 |
| RC-13 | Display the contract version field | Load the Contract Review step | The contract version field is visible | P2 |
| RC-14 | Display the registration date field showing today\ | Load the Contract Review step | The registration date field showing today\ is visible | P2 |
| RC-15 | Display a non-empty intro paragraph | Load the Contract Review step | A non-empty intro paragraph is visible | P2 |
| RC-16 | Display the involved company\ | Load the Contract Review step | The involved company\ is visible | P2 |
| RC-17 | Display at least one numbered contract section, each with visible non-empty heading text | Load the Contract Review step | At least one numbered contract section, each with visible non-empty heading text is visible | P3 |
| RC-18 | Display the "I have read and agree to the contract terms" checkbox, unchecked | Load the Contract Review step | The "I have read and agree to the contract terms" checkbox, unchecked is visible | P2 |
| RC-19 | Display the Cancel button | Load the Contract Review step | The Cancel button is visible | P2 |
| RC-20 | Display the Submit and finish button | Load the Contract Review step | The Submit and finish button is visible | P1 |

## B. Contract Review: Acknowledgement & Actions (Live)

Context: covers "Registration – Contract Review: Acknowledgement & Actions (Live)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RC-21 | Keep Submit disabled while the agreement checkbox is unchecked | While the agreement checkbox is unchecked | The primary action control stays disabled | P1 |
| RC-22 | Auto-check the agreement checkbox once the document is scrolled to its end | Load the Contract Review step | Auto-check the agreement checkbox once the document is scrolled to its end | P2 |
| RC-23 | Enable Submit once the agreement checkbox is checked | Set up the state: Submit once the agreement checkbox is checked | The control becomes enabled | P1 |
| RC-24 | Disable Submit again when the agreement checkbox is unchecked | The agreement checkbox is unchecked | The control becomes/stays disabled | P1 |
| RC-25 | Not advance past Contract when Submit is force-clicked while unchecked | Attempt the blocked transition: Submit is force-clicked while unchecked | The step does not advance | P1 |
| RC-26 | Trigger a PDF download when "Download PDF file" is clicked | "Download PDF file" is clicked | Trigger a PDF download | P2 |

## C. Contract Submission (Mocked)

Context: covers "Registration – Contract Submission (Mocked)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RC-27 | Surface an error and remain on Contract when submission fails | Submission fails | Surface an error and remain on Contract | P2 |
| RC-28 | Send only one request when Submit is clicked twice in quick succession | Submit is clicked twice in quick succession | Send only one request | P1 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Contract Review step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationContractPage.spec.ts` — page elements & layout
- `BusinessTestCases/Registration/functional/RegistrationContractFunctionality.spec.ts` — agreement checkbox behavior (Live section) and mocked submission error/double-submit handling

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationContractPage.ts`.
