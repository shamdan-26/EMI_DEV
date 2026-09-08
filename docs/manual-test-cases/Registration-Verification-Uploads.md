# Manual Test Cases — Registration — Verification & Uploads Step (Tab 3 of 3)

Context: Tab 3 (final tab) of registration. The applicant provides an IBAN plus its proof document, a VAT number plus its certificate, and a bank, then clicks Sign Up to submit the registration for NAFATH/OTP verification.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Verification & Uploads Step (Tab 3 of 3) — read-only

Context: covers "Registration – Verification & Uploads Step (Tab 3 of 3) — read-only".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RVU-01 | Display the MJD Pay logo | Load the Verification & Uploads tab | The MJD Pay logo is visible | P3 |
| RVU-02 | Link the MJD Pay logo to the landing page | Load the Verification & Uploads tab | Link the MJD Pay logo to the landing page | P2 |
| RVU-03 | Display the EN language button | Load the Verification & Uploads tab | The EN language button is visible | P2 |
| RVU-04 | Display the Arabic language button | Load the Verification & Uploads tab | The Arabic language button is visible | P2 |
| RVU-05 | Display the Switch theme button | Load the Verification & Uploads tab | The Switch theme button is visible | P2 |
| RVU-06 | Show the Verification & Uploads step title | Load the Verification & Uploads tab | Show the Verification & Uploads step title | P2 |
| RVU-07 | Keep outer step 1 (Business Info) active while on Verification & Uploads | Load the Verification & Uploads tab | Keep outer step 1 (Business Info) active while on Verification & Uploads | P2 |
| RVU-08 | Display all four outer step indicators | Load the Verification & Uploads tab | All four outer step indicators is visible | P2 |
| RVU-09 | Display the IBAN field | Load the Verification & Uploads tab | The IBAN field is visible | P2 |
| RVU-10 | Show the correct placeholder for IBAN | Load the Verification & Uploads tab | Show the correct placeholder for IBAN | P2 |
| RVU-11 | Display the IBAN hint "24 characters starting with SA" | Load the Verification & Uploads tab | The IBAN hint "24 characters starting with SA" is visible | P3 |
| RVU-12 | Display the IBAN Proof upload label | Load the Verification & Uploads tab | The IBAN Proof upload label is visible | P3 |
| RVU-13 | Display the "Click to upload" prompt for IBAN proof | Load the Verification & Uploads tab | The "Click to upload" prompt for IBAN proof is visible | P2 |
| RVU-14 | Display the IBAN proof upload helper text | Load the Verification & Uploads tab | The IBAN proof upload helper text is visible | P3 |
| RVU-15 | Display the accepted file types for IBAN proof (PDF, JPG) | Load the Verification & Uploads tab | The accepted file types for IBAN proof (PDF, JPG) is visible | P2 |
| RVU-16 | Display the max file size for IBAN proof (5MB) | Load the Verification & Uploads tab | The max file size for IBAN proof (5MB) is visible | P2 |
| RVU-17 | Display the VAT Number field | Load the Verification & Uploads tab | The VAT Number field is visible | P2 |
| RVU-18 | Show the correct placeholder for VAT Number | Load the Verification & Uploads tab | Show the correct placeholder for VAT Number | P2 |
| RVU-19 | Display the VAT Number hint "From your VAT certificate" | Load the Verification & Uploads tab | The VAT Number hint "From your VAT certificate" is visible | P3 |
| RVU-20 | Display the VAT Certificate upload label | Load the Verification & Uploads tab | The VAT Certificate upload label is visible | P3 |
| RVU-21 | Display the "Click to upload" prompt for VAT certificate | Load the Verification & Uploads tab | The "Click to upload" prompt for VAT certificate is visible | P2 |
| RVU-22 | Display the VAT certificate upload helper text | Load the Verification & Uploads tab | The VAT certificate upload helper text is visible | P3 |
| RVU-23 | Display the post-submit OTP/NAFATH verification notice | Load the Verification & Uploads tab | The post-submit OTP/NAFATH verification notice is visible | P1 |
| RVU-24 | Display the Back button | Load the Verification & Uploads tab | The Back button is visible | P2 |
| RVU-25 | Display the Sign Up button | Load the Verification & Uploads tab | The Sign Up button is visible | P1 |
| RVU-26 | Keep Sign Up disabled when required fields are empty | Required fields are empty | The primary action control stays disabled | P1 |
| RVU-27 | Display "Already have an account?" text | Load the Verification & Uploads tab | "Already have an account?" text is visible | P3 |
| RVU-28 | Display the Log In link | Load the Verification & Uploads tab | The Log In link is visible | P3 |
| RVU-29 | Display Terms & Conditions reference | Load the Verification & Uploads tab | Terms & Conditions reference is visible | P2 |
| RVU-30 | Display Privacy Policy reference | Load the Verification & Uploads tab | Privacy Policy reference is visible | P2 |

## B. Verification & Uploads Step (Tab 3 of 3)

Context: covers "Registration – Verification & Uploads Step (Tab 3 of 3)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RVU-31 | Display the Back button | Load the Verification & Uploads tab | The Back button is visible | P2 |
| RVU-32 | Display the Sign Up button | Load the Verification & Uploads tab | The Sign Up button is visible | P1 |
| RVU-33 | Keep Sign Up disabled when required fields are empty | Required fields are empty | The primary action control stays disabled | P1 |
| RVU-34 | Display the IBAN field | Load the Verification & Uploads tab | The IBAN field is visible | P2 |
| RVU-35 | Show the correct placeholder for IBAN | Load the Verification & Uploads tab | Show the correct placeholder for IBAN | P2 |
| RVU-36 | Display the IBAN hint "24 characters starting with SA" | Load the Verification & Uploads tab | The IBAN hint "24 characters starting with SA" is visible | P3 |
| RVU-37 | Accept a valid IBAN | Enter a valid IBAN | The value is accepted and retained in the field | P2 |
| RVU-38 | Show a validation error for an IBAN that does not start with SA | Trigger the condition: an IBAN that does not start with SA | A validation error is shown | P2 |
| RVU-39 | Show a validation error for an IBAN shorter than 24 characters | Trigger the condition: an IBAN shorter than 24 characters | A validation error is shown | P2 |
| RVU-40 | Show a validation error for a well-formed IBAN that fails the checksum | Trigger the condition: a well-formed IBAN that fails the checksum | A validation error is shown | P2 |
| RVU-41 | Display the IBAN Proof upload area | Load the Verification & Uploads tab | The IBAN Proof upload area is visible | P2 |
| RVU-42 | Display the IBAN proof upload hint text | Load the Verification & Uploads tab | The IBAN proof upload hint text is visible | P3 |
| RVU-43 | Display the accepted file types for IBAN proof (PDF, JPG) | Load the Verification & Uploads tab | The accepted file types for IBAN proof (PDF, JPG) is visible | P2 |
| RVU-44 | Display the max file size for IBAN proof (5MB) | Load the Verification & Uploads tab | The max file size for IBAN proof (5MB) is visible | P2 |
| RVU-45 | Display the "Click to upload" prompt for IBAN proof | Load the Verification & Uploads tab | The "Click to upload" prompt for IBAN proof is visible | P2 |
| RVU-46 | Display the VAT Number field | Load the Verification & Uploads tab | The VAT Number field is visible | P2 |
| RVU-47 | Show the correct placeholder for VAT Number | Load the Verification & Uploads tab | Show the correct placeholder for VAT Number | P2 |
| RVU-48 | Display the VAT Number hint "From your VAT certificate" | Load the Verification & Uploads tab | The VAT Number hint "From your VAT certificate" is visible | P3 |
| RVU-49 | Accept a valid VAT Number | Enter a valid VAT Number | The value is accepted and retained in the field | P2 |
| RVU-50 | Show a validation error for a VAT Number shorter than 15 digits | Trigger the condition: a VAT Number shorter than 15 digits | A validation error is shown | P3 |
| RVU-51 | Not retain alphabetic characters in the VAT Number field | Enter alphabetic characters in the VAT Number field | The value is not retained in the field | P2 |
| RVU-52 | Show a validation error for a 15-digit VAT Number not starting with 2 or 3 | Trigger the condition: a 15-digit VAT Number not starting with 2 or 3 | A validation error is shown | P2 |
| RVU-53 | Not allow more than 15 digits in the VAT Number field | Attempt to enter more than 15 characters | Input is capped at 15 characters | P3 |
| RVU-54 | Display the VAT Certificate upload area | Load the Verification & Uploads tab | The VAT Certificate upload area is visible | P2 |
| RVU-55 | Display the accepted file type for VAT certificate (PDF) | Load the Verification & Uploads tab | The accepted file type for VAT certificate (PDF) is visible | P2 |
| RVU-56 | Not execute an XSS payload entered in the IBAN field | Enter a script/JS-URI payload in IBAN field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RVU-57 | Not execute an XSS payload entered in the VAT Number field | Enter a script/JS-URI payload in VAT Number field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RVU-58 | Treat a SQL injection pattern in the IBAN field as invalid | Enter a SQL-injection-shaped string in IBAN field and submit | The value is handled as inert text — rejected as invalid input, not executed against a database | P1 |

## C. File upload interactions

Context: covers "File upload interactions".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RVU-59 | Accept a valid PDF for IBAN proof upload | Enter a valid PDF for IBAN proof upload | The value is accepted and retained in the field | P2 |
| RVU-60 | Accept a valid PDF for VAT certificate upload | Enter a valid PDF for VAT certificate upload | The value is accepted and retained in the field | P2 |
| RVU-61 | Accept a non-PDF file type for VAT certificate upload (no client-side type restriction) | Enter a non-PDF file type for VAT certificate upload (no client-side type restriction) | The value is accepted and retained in the field | P2 |
| RVU-62 | Accept an English-named PDF for IBAN proof upload | Enter an English-named PDF for IBAN proof upload | The value is accepted and retained in the field | P2 |
| RVU-63 | Accept an Arabic-named PDF for IBAN proof upload | Enter an Arabic-named PDF for IBAN proof upload | The value is accepted and retained in the field | P2 |
| RVU-64 | Accept an English-named PDF for VAT certificate upload | Enter an English-named PDF for VAT certificate upload | The value is accepted and retained in the field | P2 |
| RVU-65 | Accept an Arabic-named PDF for VAT certificate upload | Enter an Arabic-named PDF for VAT certificate upload | The value is accepted and retained in the field | P2 |
| RVU-66 | Reject an unsupported file type for IBAN proof upload | Enter an unsupported file type for IBAN proof upload | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RVU-67 | Reject a file larger than 5MB for IBAN proof upload | Enter a file larger than 5MB for IBAN proof upload | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RVU-68 | Reject a file larger than 5MB for VAT certificate upload | Enter a file larger than 5MB for VAT certificate upload | The value is rejected (validation error, or the primary action stays disabled) | P2 |
| RVU-69 | Display the post-submit NAFATH verification notice | Load the Verification & Uploads tab | The post-submit NAFATH verification notice is visible | P1 |
| RVU-70 | Enable Sign Up when Bank, IBAN, VAT Number, and both proof uploads are filled | Bank, IBAN, VAT Number, and both proof uploads are filled | The control becomes enabled | P1 |
| RVU-71 | Display "Already have an account?" text | Load the Verification & Uploads tab | "Already have an account?" text is visible | P3 |
| RVU-72 | Display Terms & Conditions link | Load the Verification & Uploads tab | Terms & Conditions link is visible | P3 |
| RVU-73 | Display Privacy Policy link | Load the Verification & Uploads tab | Privacy Policy link is visible | P3 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Verification & Uploads step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationVerificationPage.spec.ts` — page elements (read-only)
- `BusinessTestCases/Registration/functional/RegistrationVerificationUploads.spec.ts` — IBAN/VAT field validation (format, checksum, length, XSS/SQLi) and file-upload interactions (type, size, filename encoding, accept/reject)

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationVerificationPage.ts`.
