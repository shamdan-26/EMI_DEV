# Manual Test Cases — Registration — Business Info Step (Tab 1 of 3)

Context: Tab 1 of the multi-step registration form. The applicant picks a profile type (Merchant; Freelancer is present but disabled/"Coming Soon"), enters the Commercial Registration Number (CRN / Unified Number) and National ID/Iqama, and an email address, then advances to the Financial & Business tab. Also covers the wizard chrome shared across all tabs (logo, language, theme, footer links, step indicator) as observed on this step, and the resume-registration behavior for a mobile number already partway through onboarding.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Header & Banner

Context: covers "Header & Banner [ref_1 – ref_7]".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-01 | Display the MJD Pay logo | Load the Business Info tab | The MJD Pay logo is visible | P3 |
| RI-02 | Link the MJD Pay logo to the landing page | Load the Business Info tab | Link the MJD Pay logo to the landing page | P2 |
| RI-03 | Display the Change Language group | Load the Business Info tab | The Change Language group is visible | P2 |
| RI-04 | Display the EN language button | Load the Business Info tab | The EN language button is visible | P2 |
| RI-05 | Display the Arabic language button | Load the Business Info tab | The Arabic language button is visible | P2 |
| RI-06 | Display the theme toggle button | Load the Business Info tab | The theme toggle button is visible | P2 |

## B. Main Content, Headings & Progress Bar

Context: covers "Main Content, Headings & Progress Bar [ref_8 – ref_15]".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-07 | Display the main page container | Load the Business Info tab | The main page container is visible | P2 |
| RI-08 | Display the "Create Account" eyebrow text | Load the Business Info tab | The "Create Account" eyebrow text is visible | P3 |
| RI-09 | Display the "Tell us about your business" heading | Load the Business Info tab | The "Tell us about your business" heading is visible | P3 |
| RI-10 | Display "1" as the active step number | Load the Business Info tab | "1" as the active step number is visible | P2 |
| RI-11 | Display "Business Info" as the active outer step | Load the Business Info tab | "Business Info" as the active outer step is visible | P2 |
| RI-12 | Display "NAFATH" as the second outer step | Load the Business Info tab | "NAFATH" as the second outer step is visible | P2 |
| RI-13 | Display "Products" as the third outer step | Load the Business Info tab | "Products" as the third outer step is visible | P2 |
| RI-14 | Display "Contract" as the fourth outer step | Load the Business Info tab | "Contract" as the fourth outer step is visible | P2 |

## C. Inner Tab Navigation

Context: covers "Inner Tab Navigation [ref_16 – ref_23]".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-15 | Display the step bar | Load the Business Info tab | The step bar is visible | P2 |
| RI-16 | Display Tab 1 — Business Info | Load the Business Info tab | Tab 1 — Business Info is visible | P2 |
| RI-17 | Display Tab 3 — Products | Load the Business Info tab | Tab 3 — Products is visible | P2 |
| RI-18 | Display Tab 4 — Contract | Load the Business Info tab | Tab 4 — Contract is visible | P2 |

## D. Element Visibility

Context: covers "Element Visibility".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-19 | Display the tab panel container | Load the Business Info tab | The tab panel container is visible | P2 |
| RI-20 | Display the Business Info form element | Load the Business Info tab | The Business Info form element is visible | P2 |
| RI-21 | Display the Profile Type label | Load the Business Info tab | The Profile Type label is visible | P3 |
| RI-22 | Display the Profile Type radiogroup | Load the Business Info tab | The Profile Type radiogroup is visible | P2 |
| RI-23 | Display exactly two Profile Type options | Load the Business Info tab | Exactly two Profile Type options is visible | P2 |
| RI-24 | Display the Merchant radio option | Load the Business Info tab | The Merchant radio option is visible | P2 |
| RI-25 | Display the Merchant label and description | Load the Business Info tab | The Merchant label and description is visible | P3 |
| RI-26 | Display the Freelancer radio option | Load the Business Info tab | The Freelancer radio option is visible | P2 |
| RI-27 | Display the Freelancer label and description | Load the Business Info tab | The Freelancer label and description is visible | P3 |
| RI-28 | Display the Unified Number label | Load the Business Info tab | The Unified Number label is visible | P3 |
| RI-29 | Display the Unified Number tooltip button | Load the Business Info tab | The Unified Number tooltip button is visible | P3 |
| RI-30 | Display the Unified Number input wrapper | Load the Business Info tab | The Unified Number input wrapper is visible | P2 |
| RI-31 | Display the Unified Number textbox with correct placeholder | Load the Business Info tab | The Unified Number textbox with correct placeholder is visible | P3 |
| RI-32 | Display the National ID/Iqama label | Load the Business Info tab | The National ID/Iqama label is visible | P3 |
| RI-33 | Display the National ID/Iqama tooltip button | Load the Business Info tab | The National ID/Iqama tooltip button is visible | P3 |
| RI-34 | Display the National ID/Iqama input wrapper | Load the Business Info tab | The National ID/Iqama input wrapper is visible | P2 |
| RI-35 | Display the National ID/Iqama textbox with correct placeholder | Load the Business Info tab | The National ID/Iqama textbox with correct placeholder is visible | P3 |
| RI-36 | Display the Email label | Load the Business Info tab | The Email label is visible | P3 |
| RI-37 | Display the Email textbox with correct placeholder | Load the Business Info tab | The Email textbox with correct placeholder is visible | P3 |
| RI-38 | Display the Next button | Load the Business Info tab | The Next button is visible | P1 |
| RI-39 | Display "Already have an account?" text | Load the Business Info tab | "Already have an account?" text is visible | P3 |
| RI-40 | Display the Log In link | Load the Business Info tab | The Log In link is visible | P3 |
| RI-41 | Display "By continuing, you agree to our" text | Load the Business Info tab | "By continuing, you agree to our" text is visible | P3 |
| RI-42 | Display Terms & Conditions reference | Load the Business Info tab | Terms & Conditions reference is visible | P2 |
| RI-43 | Display Privacy Policy reference | Load the Business Info tab | Privacy Policy reference is visible | P2 |

## E. Field Interactions

Context: covers "Field Interactions".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-44 | Allow selecting Merchant profile type | Load the Business Info tab | Allow selecting Merchant profile type | P2 |
| RI-45 | Not allow selecting Freelancer profile type — disabled as "Coming Soon" | Load the Business Info tab | Not allow selecting Freelancer profile type — disabled as "Coming Soon" | P1 |
| RI-46 | Accept input in the Unified Number field | Enter input in the Unified Number field | The value is accepted and retained in the field | P2 |
| RI-47 | Display the Clear button for Unified Number after entry | Load the Business Info tab | The Clear button for Unified Number after entry is visible | P2 |
| RI-48 | Accept input in the National ID/Iqama field | Enter input in the National ID/Iqama field | The value is accepted and retained in the field | P2 |
| RI-49 | Accept input in the Email field | Enter input in the Email field | The value is accepted and retained in the field | P2 |
| RI-50 | Have the Next button disabled when form is incomplete | Form is incomplete | Have the Next button disabled | P1 |
| RI-51 | Enable the Next button when all fields are filled with valid data | All fields are filled with valid data | The control becomes enabled | P1 |

## F. Profile Type Selection

Context: covers "Registration – Profile Type Selection".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-52 | Mark Merchant as aria-checked when selected | Selected | Mark Merchant as aria-checked | P2 |
| RI-53 | Not mark Freelancer as aria-checked when clicked (disabled) | Clicked (disabled) | Not mark Freelancer as aria-checked | P1 |
| RI-54 | Keep Merchant selected when the disabled Freelancer card is clicked | Freelancer card is clicked | The primary action control stays disabled | P1 |

## G. Unified Number (CRN) Field

Context: covers "Registration – Unified Number (CRN) Field".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-55 | Accept a valid CRN and retain the value | Enter a valid CRN and retain the value | The value is accepted and retained in the field | P2 |
| RI-56 | Be empty on initial page load | Load the Business Info tab | Be empty on initial page load | P2 |
| RI-57 | Show the Clear button after a value is entered | Load the Business Info tab | Show the Clear button after a value is entered | P2 |
| RI-58 | Clear the CRN field when the Clear button is clicked | The Clear button is clicked | Clear the CRN field | P2 |
| RI-59 | Hide the Clear button after the field is emptied via Clear | Load the Business Info tab | Hide the Clear button after the field is emptied via Clear | P2 |
| RI-60 | Not retain alphabetic characters in the CRN field | Enter alphabetic characters in the CRN field | The value is not retained in the field | P2 |
| RI-61 | Not retain special characters in the CRN field | Enter special characters in the CRN field | The value is not retained in the field | P2 |
| RI-62 | Keep Next disabled when CRN is cleared after full form fill | CRN is cleared after full form fill | The primary action control stays disabled | P1 |
| RI-63 | Not execute an XSS payload entered in the CRN field | Enter a script/JS-URI payload in CRN field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RI-64 | Handle a 1000-character input without crashing | Enter an oversized/edge-case value: a 1000-character input without crashing | The page handles it gracefully — no crash | P3 |
| RI-65 | Not allow more than 15 digits in the CRN field | Attempt to enter more than 15 characters | Input is capped at 15 characters | P3 |
| RI-66 | Keep Next disabled when CRN is shorter than the minimum 10 digits | CRN is shorter than the minimum 10 digits | The primary action control stays disabled | P1 |
| RI-67 | Enable Next when CRN is exactly 15 digits (maximum valid length) | CRN is exactly 15 digits (maximum valid length) | The control becomes enabled | P3 |

## H. National ID / Iqama Field

Context: covers "Registration – National ID / Iqama Field".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-68 | Accept a valid National ID and retain the value | Enter a valid National ID and retain the value | The value is accepted and retained in the field | P2 |
| RI-69 | Be empty on initial page load | Load the Business Info tab | Be empty on initial page load | P2 |
| RI-70 | Show the Clear button after a value is entered | Load the Business Info tab | Show the Clear button after a value is entered | P2 |
| RI-71 | Clear the National ID field when the Clear button is clicked | The Clear button is clicked | Clear the National ID field | P2 |
| RI-72 | Hide the Clear button after the field is emptied via Clear | Load the Business Info tab | Hide the Clear button after the field is emptied via Clear | P2 |
| RI-73 | Keep Next disabled when National ID is cleared after full form fill | National ID is cleared after full form fill | The primary action control stays disabled | P1 |
| RI-74 | Not retain alphabetic characters in the National ID field | Enter alphabetic characters in the National ID field | The value is not retained in the field | P2 |
| RI-75 | Not retain special characters in the National ID field | Enter special characters in the National ID field | The value is not retained in the field | P2 |
| RI-76 | Not execute an XSS payload entered in the National ID field | Enter a script/JS-URI payload in National ID field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RI-77 | Not execute a javascript: URI entered in the National ID field | Enter a script/JS-URI payload in National ID field and submit | No script executes; the raw payload never renders as page content (input is inert) | P1 |
| RI-78 | Handle a 1000-character input without crashing | Enter an oversized/edge-case value: a 1000-character input without crashing | The page handles it gracefully — no crash | P3 |
| RI-79 | Keep Next disabled when National ID starts with a digit other than 1 or 2 | National ID starts with a digit other than 1 or 2 | The primary action control stays disabled | P1 |
| RI-80 | Not allow more than 10 digits in the National ID field | Attempt to enter more than 10 characters | Input is capped at 10 characters | P2 |

## I. Email Field

Context: covers "Registration – Email Field".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-81 | Accept a standard email address | Enter a standard email address | The value is accepted and retained in the field | P2 |
| RI-82 | Accept an email with a plus-sign alias | Enter an email with a plus-sign alias | The value is accepted and retained in the field | P2 |
| RI-83 | Accept an email with a subdomain | Enter an email with a subdomain | The value is accepted and retained in the field | P2 |
| RI-84 | Accept an email with numeric local part | Enter an email with numeric local part | The value is accepted and retained in the field | P2 |
| RI-85 | Show error for email missing the @ symbol | Trigger the condition: email missing the @ symbol | A validation error is shown | P2 |
| RI-86 | Show error for email with no domain after @ | Trigger the condition: email with no domain after @ | A validation error is shown | P2 |
| RI-87 | Show error for a bare @ symbol | Trigger the condition: a bare @ symbol | A validation error is shown | P2 |
| RI-88 | Show error for email containing a space | Trigger the condition: email containing a space | A validation error is shown | P2 |
| RI-89 | Show error for email starting with a dot | Trigger the condition: email starting with a dot | A validation error is shown | P2 |
| RI-90 | Show error for email missing TLD (no dot after domain name) | Trigger the condition: email missing TLD (no dot after domain name) | A validation error is shown | P2 |
| RI-91 | Clear the email error when a valid email replaces an invalid one | Correct the invalid input so it becomes valid | The validation error clears | P2 |
| RI-92 | Keep Next disabled while an invalid email is entered | While an invalid email is entered | The primary action control stays disabled | P1 |
| RI-93 | Become disabled again after clearing the email from a complete form | Load the Business Info tab | Become disabled again after clearing the email from a complete form | P1 |
| RI-94 | Not execute XSS entered in the email field | Load the Business Info tab | Not execute XSS entered in the email field | P1 |
| RI-95 | Treat SQL injection pattern in email as invalid and show error | Enter a SQL-injection-shaped string and submit | The value is handled as inert text — rejected as invalid input, not executed against a database | P1 |
| RI-96 | Handle a very long email (500 chars) without crashing | Load the Business Info tab | Handle a very long email (500 chars) without crashing | P3 |

## J. Next Button Enable/Disable Logic

Context: covers "Registration – Next Button Enable/Disable Logic".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-97 | Be disabled when all fields are empty | All fields are empty | Be disabled | P1 |
| RI-98 | Be disabled when only Profile Type is selected | Only Profile Type is selected | Be disabled | P1 |
| RI-99 | Be disabled when only CRN is filled | Only CRN is filled | Be disabled | P1 |
| RI-100 | Be disabled when only National ID is filled | Only National ID is filled | Be disabled | P1 |
| RI-101 | Be disabled when only Email is filled | Only Email is filled | Be disabled | P1 |
| RI-102 | Be disabled with Profile Type + CRN only | Load the Business Info tab | Be disabled with Profile Type + CRN only | P1 |
| RI-103 | Be disabled with Profile Type + National ID only | Load the Business Info tab | Be disabled with Profile Type + National ID only | P1 |
| RI-104 | Be disabled with Profile Type + Email only | Load the Business Info tab | Be disabled with Profile Type + Email only | P1 |
| RI-105 | Be disabled with Profile Type + CRN + National ID (no email) | Load the Business Info tab | Be disabled with Profile Type + CRN + National ID (no email) | P1 |
| RI-106 | Be disabled with CRN + National ID + Email (no profile type) | Load the Business Info tab | Be disabled with CRN + National ID + Email (no profile type) | P1 |
| RI-107 | Be enabled when all fields are filled with Merchant profile | All fields are filled with Merchant profile | Be enabled | P1 |
| RI-108 | Be enabled when all fields are filled with Freelancer profile | All fields are filled with Freelancer profile | Be enabled | P1 |
| RI-109 | Become disabled again after clearing the CRN from a complete form | Load the Business Info tab | Become disabled again after clearing the CRN from a complete form | P1 |
| RI-110 | Become disabled again after clearing the National ID from a complete form | Load the Business Info tab | Become disabled again after clearing the National ID from a complete form | P1 |
| RI-111 | Not advance to Tab 2 when Next is force-clicked while disabled | Attempt the blocked transition: Next is force-clicked while disabled | The step does not advance | P1 |

## K. Tab 1 → Tab 2 Transition

Context: covers "Registration – Tab 1 → Tab 2 Transition".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-112 | Advance to Tab 2 with Freelancer profile | Load the Business Info tab | Advance to Tab 2 with Freelancer profile | P1 |
| RI-113 | Stay on the /register URL after advancing to Tab 2 | Load the Business Info tab | Stay on the /register URL after advancing to Tab 2 | P2 |
| RI-114 | Show the Monthly Expected Number of Bills field on Tab 2 | Load the Business Info tab | Show the Monthly Expected Number of Bills field on Tab 2 | P2 |
| RI-115 | Show the Next button on Tab 2 | Load the Business Info tab | Show the Next button on Tab 2 | P1 |
| RI-116 | Show the Back button on Tab 2 | Load the Business Info tab | Show the Back button on Tab 2 | P2 |
| RI-117 | Not reach Tab 2 when an unrecognised CRN / National ID pair is submitted | Attempt the blocked transition: not reach Tab 2 when an unrecognised CRN / National ID pair is submitted | The step does not advance | P1 |

## L. Back Navigation (Tab 2 → Tab 1)

Context: covers "Registration – Back Navigation (Tab 2 → Tab 1)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-118 | Keep Next enabled on Tab 1 after going Back | Load the Business Info tab | Keep Next enabled on Tab 1 after going Back | P1 |
| RI-119 | Successfully re-advance to Tab 2 after going Back and clicking Next | Load the Business Info tab | Successfully re-advance to Tab 2 after going Back and clicking Next | P1 |

## M. Step Indicator Progression

Context: covers "Registration – Step Indicator Progression".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-120 | Show "Business Info" as the active inner step on load | Load the Business Info tab | Show "Business Info" as the active inner step on load | P2 |
| RI-121 | Not show NAFATH as active while on Tab 1 | Load the Business Info tab | Not show NAFATH as active while on Tab 1 | P2 |

## N. Footer Navigation

Context: covers "Registration – Footer Navigation".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-122 | Navigate to the Login page when the "Log In" link is clicked | The "Log In" link is clicked | Navigate to the Login page | P1 |
| RI-123 | Terms & Conditions link be visible | Load the Business Info tab | Terms & Conditions link be visible | P2 |
| RI-124 | Privacy Policy link be visible | Load the Business Info tab | Privacy Policy link be visible | P2 |
| RI-125 | Terms & Conditions link be clickable without a JS error | Load the Business Info tab | Terms & Conditions link be clickable without a JS error | P2 |
| RI-126 | Privacy Policy link be clickable without a JS error | Load the Business Info tab | Privacy Policy link be clickable without a JS error | P2 |

## O. Language Toggle

Context: covers "Registration – Language Toggle".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-127 | Switch to Arabic when العربية is clicked | العربية is clicked | Switch to Arabic | P2 |
| RI-128 | Switch back to English when EN is clicked after Arabic | EN is clicked after Arabic | Switch back to English | P2 |
| RI-129 | Mark EN as not active after switching to Arabic | Load the Business Info tab | Mark EN as not active after switching to Arabic | P2 |

## P. Theme Toggle

Context: covers "Registration – Theme Toggle".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-130 | Change the body class when Switch theme is clicked | Switch theme is clicked | Change the body class | P2 |
| RI-131 | Return to the original theme class when toggled twice | Toggled twice | Return to the original theme class | P2 |

## Q. Tooltip Interactions

Context: covers "Registration – Tooltip Interactions".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-132 | Reveal a tooltip when the Unified Number info button is clicked | The Unified Number info button is clicked | Reveal a tooltip | P2 |
| RI-133 | Reveal a tooltip when the National ID info button is clicked | The National ID info button is clicked | Reveal a tooltip | P2 |
| RI-134 | Close the Unified Number tooltip when clicking away | Clicking away | Close the Unified Number tooltip | P2 |
| RI-135 | Display non-empty descriptive text inside the Unified Number tooltip | Load the Business Info tab | Non-empty descriptive text inside the Unified Number tooltip is visible | P3 |

## R. Continue/Resume Registration (EMI-5666, T03)

Context: covers "Registration – Continue/Resume Registration (EMI-5666, T03)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RI-136 | Require re-entering Registration Info, then skip straight to Products/Contract, when resuming a registration already past Financial & Business | Resuming a registration already past Financial & Business | Require re-entering Registration Info, then skip straight to Products/Contract, | P2 |
| RI-137 | Start a brand-new registration when the mobile is reused with a different CRN | The mobile is reused with a different CRN | Start a brand-new registration | P2 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Business Info step. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationInfoPage.spec.ts` — page elements & layout (the `[ref_NN]` markers in the automated titles trace each assertion to a captured DOM snapshot reference, omitted here)
- `BusinessTestCases/Registration/functional/RegistrationInfoFunctionality.spec.ts` — profile-type selection, CRN/National ID/Email field validation, Next-button enable logic, tab transitions, footer/language/theme chrome, tooltips, and resume-registration (EMI-5666)

Supporting helpers: `BusinessTestCases/Registration/RegistrationHelper.ts` (asset pools `CITIZEN_ASSETS`/`RESIDENT_ASSETS`, `goToInfoStep`) and `BusinessTestCases/pageElements/Registration/RegistrationInfoPage.ts`.
