# Manual Test Cases — Registration — Products Step (incl. PoS Onboarding Setup)

Context: after NAFATH, the applicant selects which products to enroll in (a Wallet product is mandatory and pre-selected; POS Terminals and others are optional) before advancing to Contract. Selecting POS Terminals reveals an inline PoS Onboarding Setup flow (EMI-5783) — device count, delivery mode (single location vs. per-device split groups), and delivery contact/address — which is documented here alongside the base Products step since it never leaves this screen. `RegistrationPoSOnboarding.spec.ts` (TC-POS-026..028) covers the order-submission side of the same flow.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Products Step UI (Page Elements)

Context: covers "Registration - Products Step UI (Page Elements)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-01 | Display the MJD Pay logo | Load the Products step | The MJD Pay logo is visible | P3 |
| RP-02 | Link the MJD Pay logo to the landing page | Load the Products step | Link the MJD Pay logo to the landing page | P2 |
| RP-03 | Display the EN language button | Load the Products step | The EN language button is visible | P2 |
| RP-04 | Display the Arabic language button | Load the Products step | The Arabic language button is visible | P2 |
| RP-05 | Display the theme toggle button | Load the Products step | The theme toggle button is visible | P2 |
| RP-06 | Display the "Setup" eyebrow text | Load the Products step | The "Setup" eyebrow text is visible | P3 |
| RP-07 | Display the "Products" title | Load the Products step | The "Products" title is visible | P3 |
| RP-08 | Display the products-selection subtitle | Load the Products step | The products-selection subtitle is visible | P3 |
| RP-09 | Display all four outer step labels: Business Info, NAFATH, Products, Contract | Load the Products step | All four outer step labels: Business Info, NAFATH, Products, Contract is visible | P3 |
| RP-10 | Show "Products" as the active outer step | Load the Products step | Show "Products" as the active outer step | P2 |
| RP-11 | Display at least one product card | Load the Products step | At least one product card is visible | P2 |
| RP-12 | Display the required Wallet card | Load the Products step | The required Wallet card is visible | P2 |
| RP-13 | Show a "Show more" link on the Wallet card | Load the Products step | Show a "Show more" link on the Wallet card | P2 |
| RP-14 | Show a price/billing label on every visible product card | Load the Products step | Show a price/billing label on every visible product card | P2 |
| RP-15 | Display the selection counter | Load the Products step | The selection counter is visible | P2 |
| RP-16 | Show a non-zero count in the selection counter on arrival | Load the Products step | Show a non-zero count in the selection counter on arrival | P2 |
| RP-17 | Display the Cancel button | Load the Products step | The Cancel button is visible | P2 |
| RP-18 | Display the Continue button | Load the Products step | The Continue button is visible | P1 |
| RP-19 | Have the Continue button enabled by default via the required product | Load the Products step | Have the Continue button enabled by default via the required product | P1 |

## B. Products Step: PoS Onboarding Setup (EMI-5783)

Context: covers "Registration - Products Step: PoS Onboarding Setup (EMI-5783)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-20 | Expand the PoS Terminals card inline without leaving the Products step | Load the PoS Onboarding Setup panel | Expand the PoS Terminals card inline without leaving the Products step | P2 |
| RP-21 | Show "Request devices now" in the expanded card | Load the PoS Onboarding Setup panel | Show "Request devices now" in the expanded card | P2 |
| RP-22 | Show a Continue button in the expanded card | Load the PoS Onboarding Setup panel | Show a Continue button in the expanded card | P1 |
| RP-23 | Reveal the Devices & Delivery fields after checking "Request devices now" and continuing | Load the PoS Onboarding Setup panel | Reveal the Devices & Delivery fields after checking "Request devices now" and continuing | P2 |
| RP-24 | Show the Devices & Delivery fields | Load the PoS Onboarding Setup panel | Show the Devices & Delivery fields | P2 |
| RP-25 | Not show a wallet picker anywhere in the Devices & Delivery step | Load the PoS Onboarding Setup panel | Not show a wallet picker anywhere in the Devices & Delivery step | P2 |
| RP-26 | Display the delivery mode toggle | Load the PoS Onboarding Setup panel | The delivery mode toggle is visible | P2 |
| RP-27 | Display the Back button in Devices & Delivery | Load the PoS Onboarding Setup panel | The Back button in Devices & Delivery is visible | P2 |
| RP-28 | Default the total-devices count to 1 | Default the total-devices count to 1 | The counter/value updates as expected | P2 |
| RP-29 | Increment the total-devices count when the increase button is clicked | The increase button is clicked | Increment the total-devices count | P2 |
| RP-30 | Decrement the total-devices count when the decrease button is clicked, without going below the minimum | The decrease button is clicked, without going below the minimum | Decrement the total-devices count | P2 |
| RP-31 | Update the total-devices count when typed directly into the field | Typed directly into the field | Update the total-devices count | P2 |
| RP-32 | Select "single location" delivery by default | Select "single location" delivery by default | Selection state updates accordingly | P2 |
| RP-33 | Switch to per-device delivery groups when "split by devices" is selected | "split by devices" is selected | Switch to per-device delivery groups | P2 |
| RP-34 | Display the Add Location Group button in split-by-device mode | Load the PoS Onboarding Setup panel | The Add Location Group button in split-by-device mode is visible | P2 |
| RP-35 | Select the Wathiq national address by default and show the resolved address | Select the Wathiq national address by default and show the resolved address | Selection state updates accordingly | P2 |
| RP-36 | Reveal a custom map location option when selected | Selected | Reveal a custom map location option | P2 |
| RP-37 | Accept a contact name | Load the PoS Onboarding Setup panel | Accept a contact name | P2 |
| RP-38 | Accept a Saudi contact mobile number | Enter a Saudi contact mobile number | The value is accepted and retained in the field | P2 |
| RP-39 | Display the Contract step after completing Devices & Delivery | Load the PoS Onboarding Setup panel | The Contract step after completing Devices & Delivery is visible | P2 |

## C. Products Step

Context: covers "Registration - Products Step".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-40 | Mark "Products" as the active step after NAFATH completes | Load the Products step | Mark "Products" as the active step after NAFATH completes | P1 |
| RP-41 | Display a "View more" link on each product card | Load the Products step | A "View more" link on each product card is visible | P3 |
| RP-42 | Show the annual price on the POS Terminal card instead of Free | Load the Products step | Show the annual price on the POS Terminal card instead of Free | P2 |
| RP-43 | Show the mandatory product pre-selected and locked by default | Load the Products step | Show the mandatory product pre-selected and locked by default | P2 |
| RP-44 | Have the Continue button enabled by default via the mandatory product | Load the Products step | Have the Continue button enabled by default via the mandatory product | P1 |
| RP-45 | Display "1 Selected" by default with only the mandatory product selected | Load the Products step | "1 Selected" by default with only the mandatory product selected is visible | P2 |
| RP-46 | Select an optional product and show "2 Selected" when its card is clicked | Its card is clicked | Select an optional product and show "2 Selected" | P2 |
| RP-47 | Keep the Continue button enabled after selecting another product | Load the Products step | Keep the Continue button enabled after selecting another product | P1 |
| RP-48 | Update the counter to "3 Selected" when a second optional product is selected | A second optional product is selected | Update the counter to "3 Selected" | P2 |
| RP-49 | Allow selecting all six available products | Load the Products step | Allow selecting all six available products | P2 |
| RP-50 | Deselect a product and decrement the counter when its card is clicked again | Its card is clicked again | Deselect a product and decrement the counter | P2 |
| RP-51 | Keep the mandatory product selected once every optional product is deselected | Load the Products step | Keep the mandatory product selected once every optional product is deselected | P2 |
| RP-52 | Show "1 Selected" again once every optional product is deselected | Load the Products step | Show "1 Selected" again once every optional product is deselected | P2 |
| RP-53 | Keep the Cancel button enabled regardless of selection state | Load the Products step | Keep the Cancel button enabled regardless of selection state | P1 |
| RP-54 | Advance past the Products step when Continue is clicked with a product selected | Continue is clicked with a product selected | Advance past the Products step | P1 |

## D. Products Step: PoS Onboarding Setup (EMI-5783) - Devices & Delivery functional

Context: covers "Registration - Products Step: PoS Onboarding Setup (EMI-5783) - Devices & Delivery functional".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-55 | Have the Devices & Delivery Next button enabled by default, even before contact fields are filled | Load the Products step | Have the Devices & Delivery Next button enabled by default, even before contact fields are filled | P1 |
| RP-56 | Keep the Devices & Delivery Next button enabled once contact name and mobile are filled | Load the Products step | Keep the Devices & Delivery Next button enabled once contact name and mobile are filled | P1 |
| RP-57 | Add a second delivery group when Add Location Group is clicked in split-by-device mode | Add Location Group is clicked in split-by-device mode | Add a second delivery group | P2 |
| RP-58 | Remove a delivery group when Remove Location Group is clicked | Remove Location Group is clicked | Remove a delivery group | P2 |
| RP-59 | Return to the expanded PoS card when Back is clicked from Devices & Delivery | Back is clicked from Devices & Delivery | Return to the expanded PoS card | P2 |

## E. Products Step: PoS Onboarding Setup (EMI-5783) - skip request-now path

Context: covers "Registration - Products Step: PoS Onboarding Setup (EMI-5783) - skip request-now path".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-60 | Advance straight to Contract when Continue is clicked without checking "Request devices now" | Continue is clicked without checking "Request devices now" | Advance straight to Contract | P1 |

## F. Onboarding PoS Request Flow (TC-POS-026…028)

Context: covers "Registration — Onboarding PoS Request Flow (TC-POS-026…028)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-61 | Show a validation error for a zero device count (TC-POS-026) | Trigger the condition: a zero device count | A validation error is shown | P2 |
| RP-62 | Show a validation error when split-group quantities do not sum to the total (TC-POS-027) | Trigger the condition: split-group quantities do not sum to the total | A validation error is shown | P2 |
| RP-63 | Send only one PoS order request when Next is clicked twice in quick succession (TC-POS-028) | Next is clicked twice in quick succession | Send only one PoS order request | P2 |

## G. Onboarding PoS Request Flow: submission error handling

Context: covers "Registration — Onboarding PoS Request Flow: submission error handling".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RP-64 | Surface an error and stay on Devices & Delivery when the PoS order request fails | The PoS order request fails | Surface an error and stay on Devices & Delivery | P2 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for the Registration Products step and its PoS Onboarding Setup sub-flow. The corresponding automated specs are:

- `BusinessTestCases/Registration/ui/RegistrationProductsPage.spec.ts` — Products step page elements
- `BusinessTestCases/Registration/ui/RegistrationProductsPoSSetup.spec.ts` — PoS Onboarding Setup panel elements (EMI-5783)
- `BusinessTestCases/Registration/functional/RegistrationProductsFunctionality.spec.ts` — product selection/counter logic, and the PoS Devices & Delivery functional sub-flow
- `BusinessTestCases/Registration/functional/RegistrationPoSOnboarding.spec.ts` — PoS order-request submission (TC-POS-026..028)

Supporting helper: `BusinessTestCases/pageElements/Registration/RegistrationProductsPage.ts`.
