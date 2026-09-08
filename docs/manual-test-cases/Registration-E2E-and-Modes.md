# Manual Test Cases — Registration — End-to-End Flow & Sign-Up Modes

Context: cross-cutting cases that span the whole registration journey rather than one visual step — the full UI happy path from Mobile through NAFATH/Products/Contract, and configuration-driven sign-up modes: a fixed-Merchant-only mode that hides the profile-type selector (TC-REG-005/006), and auto-approval/auto-activation behavior (TC-REG-001/002/007).

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## A. Full E2E Happy Path

Context: covers "Registration – Full E2E Happy Path (UI)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RE-01 | Complete Business Info, Financial & Business, and Verification & Uploads, then reach NAFATH or Products after Sign Up | Load the registration wizard | Complete Business Info, Financial & Business, and Verification & Uploads, then reach NAFATH or Products after Sign Up | P1 |
| RE-02 | Reach Contract and complete submission after accepting the agreement | Load the registration wizard | Reach Contract and complete submission after accepting the agreement | P1 |

## B. Fixed Merchant Sign-Up Mode (TC-REG-005, TC-REG-006)

Context: covers "Registration — Fixed Merchant Sign-Up Mode (TC-REG-005, TC-REG-006)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RE-03 | Hide the "Sign Up As" profile-type selector and show a static "Signing up as Merchant" label (TC-REG-005) | Load the registration wizard | Hide the "Sign Up As" profile-type selector and show a static "Signing up as Merchant" label | P1 |
| RE-04 | Not allow the profile type to be changed in fixed-Merchant mode (TC-REG-006) | Load the registration wizard | Not allow the profile type to be changed in fixed-Merchant mode | P2 |

## C. Fixed Merchant mode disabled (control)

Context: covers "Registration — Fixed Merchant mode disabled (control)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RE-05 | Show the normal profile-type selector when fixed-Merchant mode is off | Fixed-Merchant mode is off | Show the normal profile-type selector | P2 |

## D. Auto-Approval, Auto-Activation & Activation Email (TC-REG-001, TC-REG-002, TC-REG-007)

Context: covers "Registration — Auto-Approval, Auto-Activation & Activation Email (TC-REG-001, TC-REG-002, TC-REG-007)".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RE-06 | Reflect automatic approval without a manual admin step (TC-REG-001) | Load the registration wizard | Reflect automatic approval without a manual admin step | P2 |
| RE-07 | Reflect the profile as immediately active for operations (TC-REG-002) | Load the registration wizard | Reflect the profile as immediately active for operations | P2 |
| RE-08 | Show confirmation that the activation email was sent (TC-REG-007) | Load the registration wizard | Show confirmation that the activation email was sent | P2 |

---

## Automated coverage note

This manual test suite mirrors the existing Playwright automation for cross-cutting Registration flows. The corresponding automated specs are:

- `BusinessTestCases/Registration/functional/RegistrationE2EHappyPath.spec.ts` — the full UI journey through every step in one run
- `BusinessTestCases/Registration/functional/RegistrationSprint71_TypeAndAutoApprove.spec.ts` — fixed-Merchant sign-up mode and auto-approval/auto-activation/activation-email behavior

Every other Registration part (Mobile, OTP, Business Info, Financial, Verification & Uploads, NAFATH, Products, Contract) has its own dedicated manual-test-case doc in this folder; this file only covers what those individually do not.
