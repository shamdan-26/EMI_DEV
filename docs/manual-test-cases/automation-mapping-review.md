# Manual test-case ↔ automation mapping — needs review

Auto-mapped by title similarity (0.60–0.79): too uncertain to annotate automatically. Confirm each, then add
`{ annotation: { type: 'testcase', description: '<ID>' } }` as the test's second argument.

| Feature | Spec | Line | Score | Candidate case | Test title | Case title |
|---|---|---|---|---|---|---|
| Login | LoginAPIFlow.spec.ts | 163 | 0.62 | LG-115 | API-03: should return 200 with valid credentials | POST /auth/signin succeeds with valid credentials |
| Login | LoginAPIFlow.spec.ts | 293 | 0.74 | LG-122 | API-N7: should return 401 with a wrong password | POST /auth/signin returns 401 on wrong password |
| Login | LoginAPIFlow.spec.ts | 306 | 0.71 | LG-123 | API-N8: should return 401 with an unrecognised tenant number | POST /auth/signin returns 401 on unrecognised tenant |
| Login | LoginAPIFlow.spec.ts | 319 | 0.78 | LG-124 | API-N9: should return 401 with an unrecognised username | POST /auth/signin returns 401 on unrecognised username |
| Login | LoginAPIFlow.spec.ts | 462 | 0.7 | LG-131 | API-FLOW-01: should complete the full pre-auth and sign-in chain successfully | Full pre-auth + sign-in chain succeeds end to end |
| Login | LoginFormValidation.spec.ts | 43 | 0.79 | LG-36 | should be disabled when company and mobile are filled but not password | Disabled with Company + Mobile, no Password |
| Login | LoginFormValidation.spec.ts | 49 | 0.79 | LG-37 | should be disabled when company and password are filled but not mobile | Disabled with Company + Password, no Mobile |
| Login | LoginFormValidation.spec.ts | 55 | 0.79 | LG-38 | should be disabled when mobile and password are filled but not company | Disabled with Mobile + Password, no Company |
| Login | LoginFormValidation.spec.ts | 101 | 0.62 | LG-44 | should keep Log In button disabled when mobile is too short (4 digits) | Mobile too short (4 digits) |
| Login | LoginFormValidation.spec.ts | 121 | 0.6 | LG-65 | should keep Log In button disabled when mobile does not start with 5 | Verify button disabled when OTP empty |
| Login | LoginFormValidation.spec.ts | 136 | 0.65 | LG-51 | should enable the Log In button with a valid 9-digit mobile starting with 5 | Valid 9-digit mobile starting with 5 enables button |
| Login | LoginFormValidation.spec.ts | 163 | 0.62 | LG-53 | should re-mask password when the toggle is clicked a second time | Show-password toggle re-masks on second click |
| Login | LoginHappyPath.spec.ts | 25 | 0.71 | LG-76 | should display the login form on page load | Login form present on load |
| Login | LoginHappyPath.spec.ts | 33 | 0.75 | LG-77 | should enable the Log In button once all fields are filled | Button enables once all fields are filled |
| Login | LoginHappyPath.spec.ts | 40 | 0.74 | LG-60 | should dismiss the validation card after all steps complete | Card dismisses after all steps complete |
| Login | LoginHappyPath.spec.ts | 47 | 0.64 | LG-79 | should redirect away from the login page after submitting valid credentials | Redirect away from login on valid login |
| Login | LoginHappyPath.spec.ts | 53 | 0.69 | LG-80 | should display the sidebar logo and brand name on the dashboard | Dashboard sidebar logo and brand shown |
| Login | LoginHappyPath.spec.ts | 61 | 0.68 | LG-81 | should display the sidebar navigation links on the dashboard | Dashboard sidebar navigation shown |
| Login | LoginHappyPath.spec.ts | 71 | 0.8 | LG-82 | should display the header profile and notifications icons on the dashboard | Header profile & notification icons shown |
| Login | LoginHappyPath.spec.ts | 79 | 0.76 | LG-83 | should display the wallet balance widget on the dashboard | Wallet balance widget shown |
| Login | LoginHappyPath.spec.ts | 86 | 0.78 | LG-84 | should display the last transactions widget on the dashboard | Last transactions widget shown |
| Login | LoginHappyPath.spec.ts | 93 | 0.75 | LG-85 | should display the last login timestamp on the dashboard | Last login timestamp shown |
| Login | LoginHappyPath.spec.ts | 102 | 0.76 | LG-86 | should log out successfully and return to the login page | Logout returns to login page |
| Login | LoginInvalidCredentials.spec.ts | 27 | 0.66 | LG-122 | should stay on the login page with a wrong password | POST /auth/signin returns 401 on wrong password |
| Login | LoginInvalidCredentials.spec.ts | 51 | 0.72 | LG-91 | should display an error toast after submitting wrong credentials | Error toast shown on wrong credentials |
| Login | LoginInvalidCredentials.spec.ts | 108 | 0.6 | LG-100 | should not expose AML or compliance details in the error message | AML/compliance detail not exposed |
| Login | LoginInvalidCredentials.spec.ts | 163 | 0.65 | LG-94 | should allow re-submitting the form immediately after a failed login attempt | Re-submitting after a failed attempt is allowed |
| Login | LoginInvalidCredentials.spec.ts | 171 | 0.73 | LG-95 | should preserve field values after a failed login attempt | Field values preserved after a failed attempt |
| Login | LoginNafathWathiqExpiry.spec.ts | 90 | 0.62 | LG-132 | NW-01: should return 409 when NAFATH document data has expired | Login blocked — NAFATH document expired |
| Login | LoginNafathWathiqExpiry.spec.ts | 123 | 0.62 | LG-133 | NW-02: should return 409 when WATHIQ document data has expired | Login blocked — WATHIQ document expired |
| Login | LoginNafathWathiqExpiry.spec.ts | 245 | 0.8 | LG-143 | NW-12: NAFATH expiry should deactivate the USER, not the individual business profile | NAFATH expiry deactivates the user, not the profile |
| Login | LoginNavigation.spec.ts | 26 | 0.61 | LG-27 | should navigate to the Forgot Password page when the link is clicked | Forgot Password link visible |
| Login | LoginNavigation.spec.ts | 73 | 0.75 | LG-79 | should redirect away from the login page when already logged in | Redirect away from login on valid login |
| Login | LoginOtpFlow.spec.ts | 73 | 0.74 | LG-67 | should enable Verify button when all OTP inputs are filled | Verify button enabled once all OTP digits filled |
| Login | LoginOtpFlow.spec.ts | 79 | 0.67 | LG-68 | should not accept non-numeric characters in OTP inputs | OTP input rejects non-numeric characters |
| Login | LoginOtpFlow.spec.ts | 91 | 0.72 | LG-70 | should have Click to resend button disabled while the countdown is active | Resend button disabled during countdown |
| Login | LoginOtpFlow.spec.ts | 96 | 0.78 | LG-71 | should enable resend button after countdown expires and clear inputs on click | Resend enabled after countdown expires and clears inputs |
| Login | LoginOtpFlow.spec.ts | 168 | 0.63 | LG-57 | should mark step 1 "Verifying your credentials" as complete with a checkmark | Step 1 marked complete with checkmark |
| Login | LoginOtpFlow.spec.ts | 179 | 0.67 | LG-58 | should mark step 2 "Preparing this device" as complete with a checkmark | Step 2 marked complete with checkmark |
| Login | LoginOtpFlow.spec.ts | 217 | 0.69 | LG-62 | should redirect to dashboard after the validation card dismisses (when OTP is disabled) | Redirect to dashboard when OTP is disabled |
| Login | LoginPage.spec.ts | 17 | 0.62 | LG-01 | should open the login URL | Login URL loads |
| Login | LoginPage.spec.ts | 25 | 0.71 | LG-03 | should display the login form container | Login form container visible |
| Login | LoginPage.spec.ts | 34 | 0.79 | LG-05 | should display the Welcome heading | Welcome heading |
| Login | LoginPage.spec.ts | 45 | 0.65 | LG-07 | should display the MJD Pay logo image | MJD Pay logo visible |
| Login | LoginPage.spec.ts | 49 | 0.67 | LG-08 | should display the MJD Pay logo as a clickable link | Logo is a clickable link |
| Login | LoginPage.spec.ts | 90 | 0.71 | LG-15 | should display the Company Number label | Company Number label visible |
| Login | LoginPage.spec.ts | 94 | 0.75 | LG-16 | should display the Company number input as visible and enabled | Company Number input enabled |
| Login | LoginPage.spec.ts | 99 | 0.7 | LG-17 | should display the Company number input with the correct placeholder | Company Number placeholder |
| Login | LoginPage.spec.ts | 110 | 0.65 | LG-19 | should clear the Company Number field when the clear button is clicked | Company Number clear button empties the field |
| Login | LoginPage.spec.ts | 118 | 0.7 | LG-20 | should display the Mobile Number label | Mobile Number label visible |
| Login | LoginPage.spec.ts | 126 | 0.6 | LG-22 | should display the country code (+966) | Country code shown |
| Login | LoginPage.spec.ts | 130 | 0.74 | LG-23 | should display the Mobile number input as visible and enabled | Mobile Number input enabled |
| Login | LoginPage.spec.ts | 137 | 0.67 | LG-35 | should display the Password label | Disabled with only Password filled |
| Login | LoginPage.spec.ts | 141 | 0.79 | LG-25 | should display the Password input masked by default | Password masked by default |
| Login | LoginPage.spec.ts | 146 | 0.7 | LG-26 | should display the Show password toggle button | Show-password toggle visible |
| Login | LoginPage.spec.ts | 152 | 0.71 | LG-27 | should display the Forgot Password link | Forgot Password link visible |
| Login | LoginPage.spec.ts | 168 | 0.68 | LG-30 | should display the "New to MJD PAY?" text | "New to MJD PAY?" text visible |
| Login | LoginPage.spec.ts | 172 | 0.6 | LG-31 | should display the Sign Up link | Sign Up link visible |
| Login | LoginSecurity.spec.ts | 87 | 0.67 | LG-105 | should lock the account after 3 consecutive failed login attempts | Account locks after repeated failed attempts |
| Login | LoginValidationPopup.spec.ts | 49 | 0.66 | LG-54 | should show the "Just a moment..." heading | "Just a moment..." heading appears on submit |
| Login | LoginValidationPopup.spec.ts | 54 | 0.6 | LG-55 | should show the popup subtitle text | Subtitle text shown |
| Login | LoginValidationPopup.spec.ts | 81 | 0.67 | LG-63 | should show the OTP dialog after the validation card completes (when OTP is enabled) | OTP dialog appears when OTP is enabled |
| Registration | RegistrationAPIFlow.spec.ts | 463 | 0.6 | API-05 | API-N3: POST /register/profile-registration-type without token should return 401 | Set the profile registration type |
| Registration | RegistrationContractPage.spec.ts | 51 | 1.0 | RVU-01 | should display the MJD Pay logo | Display the MJD Pay logo |
| Registration | RegistrationContractPage.spec.ts | 59 | 1.0 | RVU-03 | should display the EN language button | Display the EN language button |
| Registration | RegistrationContractPage.spec.ts | 67 | 1.0 | RVU-05 | should display the Switch theme button | Display the Switch theme button |
| Registration | RegistrationContractPage.spec.ts | 85 | 1.0 | RP-09 | should display all four outer step labels: Business Info, NAFATH, Products, Contract | Display all four outer step labels: Business Info, NAFATH, Products, Contract |
| Registration | RegistrationContractPage.spec.ts | 157 | 1.0 | RP-17 | should display the Cancel button | Display the Cancel button |
| Registration | RegistrationFinancialFunctionality.spec.ts | 43 | 1.0 | RF-46 | should accept numeric input for Monthly Expected Number Of Bills | Accept numeric input for Monthly Expected Number Of Bills |
| Registration | RegistrationFinancialFunctionality.spec.ts | 51 | 1.0 | RF-47 | should accept numeric input for Monthly Expected Sum Of Bills | Accept numeric input for Monthly Expected Sum Of Bills |
| Registration | RegistrationFinancialFunctionality.spec.ts | 59 | 1.0 | RF-48 | should accept numeric input for Expected Monthly Withdrawal | Accept numeric input for Expected Monthly Withdrawal |
| Registration | RegistrationFinancialFunctionality.spec.ts | 67 | 1.0 | RF-49 | should accept numeric input for Expected Monthly Deposit | Accept numeric input for Expected Monthly Deposit |
| Registration | RegistrationFinancialFunctionality.spec.ts | 136 | 1.0 | RF-58 | should not execute an XSS payload entered in the Monthly Expected Number field | Not execute an XSS payload entered in the Monthly Expected Number field |
| Registration | RegistrationFinancialFunctionality.spec.ts | 145 | 1.0 | RF-59 | should not execute an XSS payload entered in the Monthly Expected Sum field | Not execute an XSS payload entered in the Monthly Expected Sum field |
| Registration | RegistrationFinancialFunctionality.spec.ts | 200 | 1.0 | RF-65 | should open the Industries dropdown when clicked | Open the Industries dropdown when clicked |
| Registration | RegistrationFinancialFunctionality.spec.ts | 212 | 1.0 | RF-67 | should open the Annual Income dropdown when clicked | Open the Annual Income dropdown when clicked |
| Registration | RegistrationFinancialPage.spec.ts | 35 | 1.0 | RVU-01 | should display the MJD Pay logo | Display the MJD Pay logo |
| Registration | RegistrationFinancialPage.spec.ts | 39 | 1.0 | RVU-02 | should link the MJD Pay logo to the landing page | Link the MJD Pay logo to the landing page |
| Registration | RegistrationFinancialPage.spec.ts | 43 | 1.0 | RVU-03 | should display the EN language button | Display the EN language button |
| Registration | RegistrationFinancialPage.spec.ts | 47 | 1.0 | RVU-04 | should display the Arabic language button | Display the Arabic language button |
| Registration | RegistrationFinancialPage.spec.ts | 51 | 1.0 | RVU-05 | should display the Switch theme button | Display the Switch theme button |
| Registration | RegistrationFinancialPage.spec.ts | 94 | 1.0 | RF-12 | should show the correct placeholder for Monthly Expected Number Of Bills | Show the correct placeholder for Monthly Expected Number Of Bills |
| Registration | RegistrationFinancialPage.spec.ts | 109 | 1.0 | RF-15 | should show the correct placeholder for Monthly Expected Sum Of Bills | Show the correct placeholder for Monthly Expected Sum Of Bills |
| Registration | RegistrationFinancialPage.spec.ts | 195 | 1.0 | RVU-31 | should display the Back button | Display the Back button |
| Registration | RegistrationFinancialPage.spec.ts | 199 | 1.0 | RM-17 | should display the Next button | Display the Next button |
| Registration | RegistrationFinancialPage.spec.ts | 209 | 1.0 | RVU-71 | should display "Already have an account?" text | Display "Already have an account?" text |
| Registration | RegistrationFinancialPage.spec.ts | 213 | 1.0 | RVU-28 | should display the Log In link | Display the Log In link |
| Registration | RegistrationFinancialPage.spec.ts | 217 | 1.0 | RI-41 | should display "By continuing, you agree to our" text | Display "By continuing, you agree to our" text |
| Registration | RegistrationFinancialPage.spec.ts | 227 | 1.0 | RVU-72 | should display Terms & Conditions link | Display Terms & Conditions link |
| Registration | RegistrationFinancialPage.spec.ts | 231 | 1.0 | RVU-73 | should display Privacy Policy link | Display Privacy Policy link |
| Registration | RegistrationFinancialPage.spec.ts | 265 | 1.0 | RF-47 | should accept numeric input for Monthly Expected Sum Of Bills | Accept numeric input for Monthly Expected Sum Of Bills |
| Registration | RegistrationFinancialPage.spec.ts | 270 | 1.0 | RF-48 | should accept numeric input for Expected Monthly Withdrawal | Accept numeric input for Expected Monthly Withdrawal |
| Registration | RegistrationFinancialPage.spec.ts | 275 | 1.0 | RF-49 | should accept numeric input for Expected Monthly Deposit | Accept numeric input for Expected Monthly Deposit |
| Registration | RegistrationFinancialPage.spec.ts | 302 | 1.0 | RF-65 | should open the Industries dropdown when clicked | Open the Industries dropdown when clicked |
| Registration | RegistrationFinancialPage.spec.ts | 310 | 1.0 | RF-67 | should open the Annual Income dropdown when clicked | Open the Annual Income dropdown when clicked |
| Registration | RegistrationFinancialPage.spec.ts | 379 | 1.0 | RF-46 | should accept numeric input for Monthly Expected Number Of Bills | Accept numeric input for Monthly Expected Number Of Bills |
| Registration | RegistrationInfoFunctionality.spec.ts | 127 | 1.0 | RI-69 | should be empty on initial page load | Be empty on initial page load |
| Registration | RegistrationInfoFunctionality.spec.ts | 131 | 1.0 | RI-70 | should show the Clear button after a value is entered | Show the Clear button after a value is entered |
| Registration | RegistrationInfoFunctionality.spec.ts | 144 | 1.0 | RI-72 | should hide the Clear button after the field is emptied via Clear | Hide the Clear button after the field is emptied via Clear |
| Registration | RegistrationInfoFunctionality.spec.ts | 180 | 1.0 | RI-78 | should handle a 1000-character input without crashing | Handle a 1000-character input without crashing |
| Registration | RegistrationInfoFunctionality.spec.ts | 230 | 1.0 | RI-69 | should be empty on initial page load | Be empty on initial page load |
| Registration | RegistrationInfoFunctionality.spec.ts | 234 | 1.0 | RI-70 | should show the Clear button after a value is entered | Show the Clear button after a value is entered |
| Registration | RegistrationInfoFunctionality.spec.ts | 247 | 1.0 | RI-72 | should hide the Clear button after the field is emptied via Clear | Hide the Clear button after the field is emptied via Clear |
| Registration | RegistrationInfoFunctionality.spec.ts | 292 | 1.0 | RI-78 | should handle a 1000-character input without crashing | Handle a 1000-character input without crashing |
| Registration | RegistrationInfoPage.spec.ts | 52 | 0.87 | RVU-01 | should display the MJD Pay logo [ref_3] | Display the MJD Pay logo |
| Registration | RegistrationInfoPage.spec.ts | 56 | 0.91 | RVU-02 | should link the MJD Pay logo to the landing page [ref_2] | Link the MJD Pay logo to the landing page |
| Registration | RegistrationInfoPage.spec.ts | 64 | 0.9 | RVU-03 | should display the EN language button [ref_5] | Display the EN language button |
| Registration | RegistrationInfoPage.spec.ts | 68 | 0.91 | RVU-04 | should display the Arabic language button [ref_6] | Display the Arabic language button |
| Registration | RegistrationInfoPage.spec.ts | 72 | 0.9 | RP-05 | should display the theme toggle button [ref_7] | Display the theme toggle button |
| Registration | RegistrationInfoPage.spec.ts | 95 | 0.92 | RN-06 | should display the "Create Account" eyebrow text [ref_9] | Display the "Create Account" eyebrow text |
| Registration | RegistrationInfoPage.spec.ts | 118 | 0.91 | RN-09 | should display "Products" as the third outer step [ref_14] | Display "Products" as the third outer step |
| Registration | RegistrationInfoPage.spec.ts | 122 | 0.91 | RN-10 | should display "Contract" as the fourth outer step [ref_15] | Display "Contract" as the fourth outer step |
| Registration | RegistrationInfoPage.spec.ts | 149 | 0.77 | RI-17 | should display Tab 3 — Products [ref_22, ref_23] | Display Tab 3 — Products |
| Registration | RegistrationInfoPage.spec.ts | 153 | 0.77 | RI-18 | should display Tab 4 — Contract [ref_24, ref_25] | Display Tab 4 — Contract |
| Registration | RegistrationInfoPage.spec.ts | 264 | 0.84 | RM-17 | should display the Next button [ref_53] | Display the Next button |
| Registration | RegistrationInfoPage.spec.ts | 271 | 0.91 | RVU-71 | should display "Already have an account?" text [ref_54] | Display "Already have an account?" text |
| Registration | RegistrationInfoPage.spec.ts | 275 | 0.82 | RVU-28 | should display the Log In link [ref_55] | Display the Log In link |
| Registration | RegistrationInfoPage.spec.ts | 279 | 0.92 | RI-41 | should display "By continuing, you agree to our" text [ref_56] | Display "By continuing, you agree to our" text |
| Registration | RegistrationInfoPage.spec.ts | 285 | 0.91 | RVU-29 | should display Terms & Conditions reference [ref_57] | Display Terms & Conditions reference |
| Registration | RegistrationInfoPage.spec.ts | 289 | 0.9 | RVU-30 | should display Privacy Policy reference [ref_58] | Display Privacy Policy reference |
| Registration | RegistrationMobilePage.spec.ts | 28 | 1.0 | RVU-01 | should display the MJD Pay logo | Display the MJD Pay logo |
| Registration | RegistrationMobilePage.spec.ts | 43 | 1.0 | RVU-03 | should display the EN language button | Display the EN language button |
| Registration | RegistrationMobilePage.spec.ts | 51 | 1.0 | RVU-04 | should display the Arabic language button | Display the Arabic language button |
| Registration | RegistrationMobilePage.spec.ts | 61 | 1.0 | RP-05 | should display the theme toggle button | Display the theme toggle button |
| Registration | RegistrationMobilePage.spec.ts | 75 | 1.0 | RN-06 | should display the "Create Account" eyebrow text | Display the "Create Account" eyebrow text |
| Registration | RegistrationMobilePage.spec.ts | 99 | 1.0 | RM-17 | should display the Next button | Display the Next button |
| Registration | RegistrationMobilePage.spec.ts | 108 | 1.0 | RVU-71 | should display the "Already have an account?" text | Display "Already have an account?" text |
| Registration | RegistrationMobilePage.spec.ts | 113 | 1.0 | RVU-28 | should display the Log In link | Display the Log In link |
| Registration | RegistrationNafathPage.spec.ts | 130 | 1.0 | RVU-01 | should display the MJD Pay logo | Display the MJD Pay logo |
| Registration | RegistrationNafathPage.spec.ts | 134 | 1.0 | RVU-02 | should link the MJD Pay logo to the landing page | Link the MJD Pay logo to the landing page |
| Registration | RegistrationNafathPage.spec.ts | 138 | 1.0 | RVU-03 | should display the EN language button | Display the EN language button |
| Registration | RegistrationNafathPage.spec.ts | 142 | 1.0 | RVU-04 | should display the Arabic language button | Display the Arabic language button |
| Registration | RegistrationNafathPage.spec.ts | 146 | 1.0 | RP-05 | should display the theme toggle button | Display the theme toggle button |
| Registration | RegistrationNafathPage.spec.ts | 152 | 1.0 | RN-06 | should display the "Create Account" eyebrow text | Display the "Create Account" eyebrow text |
| Registration | RegistrationNafathPage.spec.ts | 170 | 1.0 | RN-09 | should display "Products" as the third outer step | Display "Products" as the third outer step |
| Registration | RegistrationNafathPage.spec.ts | 174 | 1.0 | RN-10 | should display "Contract" as the fourth outer step | Display "Contract" as the fourth outer step |
| Registration | RegistrationOtpPopup.spec.ts | 49 | 1.0 | RP-17 | should display the Cancel button | Display the Cancel button |
| Registration | RegistrationProductsPage.spec.ts | 56 | 1.0 | RVU-01 | should display the MJD Pay logo | Display the MJD Pay logo |
| Registration | RegistrationProductsPage.spec.ts | 60 | 1.0 | RVU-02 | should link the MJD Pay logo to the landing page | Link the MJD Pay logo to the landing page |
| Registration | RegistrationProductsPage.spec.ts | 64 | 1.0 | RVU-03 | should display the EN language button | Display the EN language button |
| Registration | RegistrationProductsPage.spec.ts | 68 | 1.0 | RVU-04 | should display the Arabic language button | Display the Arabic language button |
| Registration | RegistrationProductsPage.spec.ts | 72 | 1.0 | RP-05 | should display the theme toggle button | Display the theme toggle button |
| Registration | RegistrationProductsPage.spec.ts | 101 | 1.0 | RP-09 | should display all four outer step labels: Business Info, NAFATH, Products, Contract | Display all four outer step labels: Business Info, NAFATH, Products, Contract |
| Registration | RegistrationProductsPage.spec.ts | 151 | 1.0 | RP-17 | should display the Cancel button | Display the Cancel button |
| Registration | RegistrationVerificationPage.spec.ts | 43 | 1.0 | RVU-01 | should display the MJD Pay logo | Display the MJD Pay logo |
| Registration | RegistrationVerificationPage.spec.ts | 47 | 1.0 | RVU-02 | should link the MJD Pay logo to the landing page | Link the MJD Pay logo to the landing page |
| Registration | RegistrationVerificationPage.spec.ts | 51 | 1.0 | RVU-03 | should display the EN language button | Display the EN language button |
| Registration | RegistrationVerificationPage.spec.ts | 55 | 1.0 | RVU-04 | should display the Arabic language button | Display the Arabic language button |
| Registration | RegistrationVerificationPage.spec.ts | 59 | 1.0 | RVU-05 | should display the Switch theme button | Display the Switch theme button |
| Registration | RegistrationVerificationPage.spec.ts | 82 | 1.0 | RVU-34 | should display the IBAN field | Display the IBAN field |
| Registration | RegistrationVerificationPage.spec.ts | 86 | 1.0 | RVU-35 | should show the correct placeholder for IBAN | Show the correct placeholder for IBAN |
| Registration | RegistrationVerificationPage.spec.ts | 90 | 1.0 | RVU-36 | should display the IBAN hint "24 characters starting with SA" | Display the IBAN hint "24 characters starting with SA" |
| Registration | RegistrationVerificationPage.spec.ts | 100 | 1.0 | RVU-45 | should display the "Click to upload" prompt for IBAN proof | Display the "Click to upload" prompt for IBAN proof |
| Registration | RegistrationVerificationPage.spec.ts | 112 | 1.0 | RVU-43 | should display the accepted file types for IBAN proof (PDF, JPG) | Display the accepted file types for IBAN proof (PDF, JPG) |
| Registration | RegistrationVerificationPage.spec.ts | 116 | 1.0 | RVU-44 | should display the max file size for IBAN proof (5MB) | Display the max file size for IBAN proof (5MB) |
| Registration | RegistrationVerificationPage.spec.ts | 122 | 1.0 | RVU-46 | should display the VAT Number field | Display the VAT Number field |
| Registration | RegistrationVerificationPage.spec.ts | 126 | 1.0 | RVU-47 | should show the correct placeholder for VAT Number | Show the correct placeholder for VAT Number |
| Registration | RegistrationVerificationPage.spec.ts | 130 | 1.0 | RVU-48 | should display the VAT Number hint "From your VAT certificate" | Display the VAT Number hint "From your VAT certificate" |
| Registration | RegistrationVerificationPage.spec.ts | 150 | 1.0 | RVU-23 | should display the post-submit OTP/NAFATH verification notice | Display the post-submit OTP/NAFATH verification notice |
| Registration | RegistrationVerificationPage.spec.ts | 156 | 1.0 | RVU-31 | should display the Back button | Display the Back button |
| Registration | RegistrationVerificationPage.spec.ts | 160 | 1.0 | RVU-32 | should display the Sign Up button | Display the Sign Up button |
| Registration | RegistrationVerificationPage.spec.ts | 164 | 1.0 | RVU-33 | should keep Sign Up disabled when required fields are empty | Keep Sign Up disabled when required fields are empty |
| Registration | RegistrationVerificationPage.spec.ts | 170 | 1.0 | RVU-71 | should display "Already have an account?" text | Display "Already have an account?" text |
| Registration | RegistrationVerificationPage.spec.ts | 175 | 1.0 | RVU-28 | should display the Log In link | Display the Log In link |
| Registration | RegistrationVerificationPage.spec.ts | 179 | 1.0 | RVU-29 | should display Terms & Conditions reference | Display Terms & Conditions reference |
| Registration | RegistrationVerificationPage.spec.ts | 183 | 1.0 | RVU-30 | should display Privacy Policy reference | Display Privacy Policy reference |
| Registration | RegistrationVerificationUploads.spec.ts | 57 | 1.0 | RVU-31 | should display the Back button | Display the Back button |
| Registration | RegistrationVerificationUploads.spec.ts | 61 | 1.0 | RVU-32 | should display the Sign Up button | Display the Sign Up button |
| Registration | RegistrationVerificationUploads.spec.ts | 65 | 1.0 | RVU-33 | should keep Sign Up disabled when required fields are empty | Keep Sign Up disabled when required fields are empty |
| Registration | RegistrationVerificationUploads.spec.ts | 73 | 1.0 | RVU-34 | should display the IBAN field | Display the IBAN field |
| Registration | RegistrationVerificationUploads.spec.ts | 77 | 1.0 | RVU-35 | should show the correct placeholder for IBAN | Show the correct placeholder for IBAN |
| Registration | RegistrationVerificationUploads.spec.ts | 82 | 1.0 | RVU-36 | should display the IBAN hint "24 characters starting with SA" | Display the IBAN hint "24 characters starting with SA" |
| Registration | RegistrationVerificationUploads.spec.ts | 136 | 1.0 | RVU-43 | should display the accepted file types for IBAN proof (PDF, JPG) | Display the accepted file types for IBAN proof (PDF, JPG) |
| Registration | RegistrationVerificationUploads.spec.ts | 140 | 1.0 | RVU-44 | should display the max file size for IBAN proof (5MB) | Display the max file size for IBAN proof (5MB) |
| Registration | RegistrationVerificationUploads.spec.ts | 144 | 1.0 | RVU-45 | should display the "Click to upload" prompt for IBAN proof | Display the "Click to upload" prompt for IBAN proof |
| Registration | RegistrationVerificationUploads.spec.ts | 150 | 1.0 | RVU-46 | should display the VAT Number field | Display the VAT Number field |
| Registration | RegistrationVerificationUploads.spec.ts | 154 | 1.0 | RVU-47 | should show the correct placeholder for VAT Number | Show the correct placeholder for VAT Number |
| Registration | RegistrationVerificationUploads.spec.ts | 159 | 1.0 | RVU-48 | should display the VAT Number hint "From your VAT certificate" | Display the VAT Number hint "From your VAT certificate" |
| Registration | RegistrationVerificationUploads.spec.ts | 362 | 1.0 | RVU-69 | should display the post-submit NAFATH verification notice | Display the post-submit NAFATH verification notice |
| Registration | RegistrationVerificationUploads.spec.ts | 408 | 1.0 | RVU-71 | should display "Already have an account?" text | Display "Already have an account?" text |
| Registration | RegistrationVerificationUploads.spec.ts | 416 | 1.0 | RVU-72 | should display Terms & Conditions link | Display Terms & Conditions link |
| Registration | RegistrationVerificationUploads.spec.ts | 425 | 1.0 | RVU-73 | should display Privacy Policy link | Display Privacy Policy link |
| Topup | TopupFormUI.spec.ts | 184 | 0.61 | TUP-11 | Proceed becomes enabled once a payment method and an amount are set | Proceed disabled with no method selected |
| Topup | TopupFormUI.spec.ts | 225 | 0.61 | TUP-11 | Proceed is disabled on a fresh form | Proceed disabled with no method selected |
| Topup | TopupFormUI.spec.ts | 230 | 0.79 | TUP-11 | Proceed stays disabled with only a payment method selected | Proceed disabled with no method selected |
| Topup | TopupNegative.spec.ts | 71 | 0.69 | TUP-11 | Proceed stays disabled with a valid amount but no payment method selected | Proceed disabled with no method selected |
| Topup | TopupNegative.spec.ts | 77 | 0.6 | TUP-34 | cancelling on the Summary screen returns to the form with the balance unchanged | Pending payment leaves balance unchanged |
| Topup | TopupNegative.spec.ts | 196 | 0.72 | TU-05 | a Pending gateway result shows a pending result and leaves the balance unchanged | Pending gateway result leaves balance unchanged until resolved |
| Topup | TopupNegative.spec.ts | 245 | 0.6 | TU-05 | an "Error, too many tries" gateway result shows a failure result and leaves the balance unchanged | Pending gateway result leaves balance unchanged until resolved |
| Topup | TopupOtpFlow.spec.ts | 45 | 0.7 | TUP-27 | Verify stays disabled when OTP inputs are empty | Verify stays disabled until all digits are entered |
| Topup | TopupOtpFlow.spec.ts | 51 | 0.64 | TUP-27 | Verify stays disabled when OTP inputs are partially filled | Verify stays disabled until all digits are entered |
