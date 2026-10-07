# Writing Test Cases

The standard for adding manual test cases to the EMI suite. Follow it and a rebuild will pick your
cases up, number them, classify them and prove they are not duplicates. Ignore it and the build
either drops them silently or the guards reject them.

Read `README.md` first for what the suite *is*. This file is only about how to add to it.

---

## 1. Decide where the case goes

There are four sources. Pick by what you are writing, not by what is convenient.

| You are writing | Put it in | Why |
|---|---|---|
| Cases for a core flow that already has a document — Login, Registration, Forgot Password, Home Page, Bank Transfer, B2B Transactions, Bill Items, Manage Accounts, Transaction Operations, PoS Products | The matching `.md` file in this folder | The markdown is the source of truth for those flows and is reviewed as prose |
| Cases for a story or task with no coverage anywhere | `audit-additions.json` | Survives a regeneration; a workbook does not |
| A journey that crosses module boundaries | `e2e-journeys.json` | Lands on its own **End-to-End Journeys** sheet so the E2E set can be run together |
| A whole epic, delivered as its own workbook | A new folder under `docs/manual-test-cases/` | Follows the per-epic template — see README |

**Never edit the generated workbook directly.** `EMI Manual Test Cases - B2B - BY FEATURE.xlsx` is
rebuilt from these sources every time; anything typed into it is lost on the next build.

---

## 2. The schema

### `audit-additions.json` and `e2e-journeys.json`

An array of objects. Every key below is required except `testType`, which defaults to `Integration`.

```json
{
  "feature": "Bank Transfer & Cash Out",
  "sub": "C. Commission",
  "tcid": "BTC-14",
  "title": "Custom commission schema overrides the platform default",
  "priority": "Critical",
  "preconditions": "Sender account has a Custom commission schema for Bank Transfer with a fixed 3.00 SAR fee. The platform Default for Bank Transfer is 1% with a 2.00 SAR minimum.",
  "steps": "1. Open Bank Transfer & Cash Out and create a transfer of 500.00 SAR.\n2. Read the commission shown on the confirmation screen.\n3. Confirm the transfer.\n4. Open Transaction Log and read the commission line on the posted transaction.",
  "expected": "1. The commission shown is 3.00 SAR — the Custom fixed amount, not the 5.00 SAR the Default percentage would give.\n2. The sender is debited 503.00 SAR: the transfer amount plus commission.\n3. The Transaction Log commission line reads 3.00 SAR and names the Custom schema.",
  "testType": "Functional"
}
```

- `feature` must match an existing sheet name exactly, or it creates a new sheet. Check the
  Overview sheet for the list of 39 before inventing one.
- A feature in `Customer App`, `Qattah` or `Cards` is routed to the **B2C** workbook automatically.
  Everything else goes to B2B.
- `\n` in `steps` and `expected` becomes a real line break in the cell. Use it.

### A markdown `.md` table

The build only reads a table whose header row starts `| ID | Title |`. Columns are matched by
name, so order does not matter and a document may omit one (`ManageAccounts.md` has no `Steps`).

```markdown
## B. Functionality

Context: covers "Registration - OTP Functionality".

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RO-16 | Advance to the Business Info step after entering the correct OTP | Load the OTP popup | The Business Info step is shown | P1 |
```

Markdown documents use the `P1` / `P2` / `P3` key; the build maps them to High / Medium / Low.

---

## 3. Field rules

### Source ID (`tcid`)

**Must be unique across the whole suite.** The build has a Duplicate IDs guard and the uniform
`EMI-B2B-nnnn` numbering is keyed on it — a collision silently gives two cases one identity.

Use the prefix family the module already uses (`RO-`, `RVU-`, `BTC-`, `E2E-`), and take the next
free number. Never reuse a retired id.

### Title

One line. Say what is being checked, not that you are checking it.

| Bad | Good |
|---|---|
| Verify commission | Commission is added to the sender's debit and deducted from the receiver's credit |
| Token Validation | A payment token expired for more than 24 hours is rejected with 410 |
| Test the OTP | Verify stays disabled until all OTP digits are entered |

"Token Validation" is a real title used eight times in Deep Payment for eight different scenarios.
That is the failure mode to avoid: a title that cannot tell you which case you are looking at.

### Preconditions

The state the system must already be in. Name the *data*, not just the screen — an account with a
specific balance, a bill in a specific status, a schema with specific values. If two cases differ
only in their data, that difference belongs here and must be visible.

### Steps

What the tester does, numbered, one action per line. For a cross-module journey, name the module
each step happens in:

```
1. Registration — complete the wizard for a new CRN through to Contract.
2. KYC - KYB - AML — confirm WS1 screening returned a clear result.
3. Login — sign in as the new business.
4. Wallet Configuration — read the four balance buckets.
```

Steps are also what decides the **Interface** column, so be literal. "Click Next" reads as a web
case; `POST /api/v1/register/verify/otp` reads as an API case.

### Expected Result

**Mandatory. A case with no expected result is not a test case.** The suite is at zero missing and
should stay there.

Number the expectations when there is more than one. Every line must be checkable — a tester
should be able to say yes or no without asking anyone what it means.

| Bad | Good |
|---|---|
| The system works correctly | 1. The transfer posts. 2. The sender's available balance falls by 503.00 SAR. 3. `reserve_debit` returns to 0.00. |
| An error is shown | The field shows "National ID must be 10 digits" and Next stays disabled |

**Ground every expectation in something documented** — an acceptance criterion, a `.md` source
file, a ticket, an existing case. If you cannot point at where the behaviour is defined, do not
assert it; write the case and flag the question instead. `Open Question` is a valid Test Type.

### Priority

`Critical` · `High` · `Medium` · `Low`. Leave it blank and the build derives one from the case
text — the rules and their hit counts are on the **Priority Rules** sheet. Set it yourself when
you know better than the rules.

Roughly: regulatory/AML, money movement and auth are Critical; negative paths on a business flow
and integration behaviour are High; reporting and observability Medium; cosmetic Low.

### Test Type

One of: `Functional` · `Negative` · `Edge / Boundary` · `Security` · `Integration` ·
`Performance / NFR` · `Usability` · `Compliance` · `Contract / API` · `Configuration` ·
`Localisation` · `Observability` · `Reporting` · `Cross-Platform` · `Architecture` · `Regression` ·
`Migration` · `Open Question`.

Anything else is treated as unknown and sorts last.

---

## 4. Five rules that keep the suite clean

These are written down because each one has already been got wrong.

**1. The same check on two different screens is two cases, not a duplicate.**
"Display the Cancel button" is a real, separate case on the OTP popup, the Products step and the
Contract step. A dedupe pass that ignored the screen would have deleted 33 live cases.

**2. Same steps plus different data is not a duplicate either.**
Twelve AIO cases share the step block "Navigate to the Business app / Click Sign up / Insert the
CRN…" but test a registered CRN, an invalid National ID, a valid VAT and nine other things. The
data lives in the preconditions. Merging them would delete eleven negative tests.

**3. Cases that differ only in what they assert should be merged.**
Sixty cases that each say "Load the Business Info tab" and check one element mean loading the tab
sixty times. Those belong in one checklist case — see `merged-cases.json`.

**A twin is identical on four fields** — title, expected result, steps and preconditions. Anything
less is a different test wearing the same words: `PB-CM04` and `WT-CM04` read identically and are
told apart only by their steps, and the Top Up limit cases share a title while differing in the tier
values in their preconditions. Neither pair may be merged.

**Identical preconditions is the test.** If two cases start from the same state and differ only in
what they look at, they are one sit-down. If they start from *different* data — the twelve cases in
rule 2 — they are separate tests no matter how alike the steps read.

Three things follow from that:

- The steps do not have to be a single line. Seven Continue Registration OTP cases carry the
  boilerplate "1. Insert the OTP / 2. Click on the verify button" and differ only in the assertion;
  they merge. What must not merge is a procedure whose *order* is the test — entering a wrong OTP
  and then a right one is a sequence, not a checklist item.
- The sub-area does not have to match. Next-button cases filed under the CRN, National ID and Email
  sections are all one button on one tab.
- **Absorb every twin.** AIO holds some cases twice under different tickets. Merging one twin and
  not the other leaves the other standing as a loose copy of a check, because the duplicate pass
  runs after the merge and no longer has a partner to collapse it against.

A merged case keeps every member's Jira references, so folding an AIO case into a checklist never
loses the ticket it traces to.

**4. A shared vague title is a naming problem, not a duplication problem.**
Fix the titles. Do not delete the cases.

**5. Nothing is written back to Jira.**
Retiring or merging a case here does not touch the AIO repository. If a change needs to reach
Jira, that is a separate, signed-off job.

---

## 5. What the build fills in — do not set these by hand

| Column | Where it comes from |
|---|---|
| **TC ID** (`EMI-B2B-nnnn`) | `tc-id-registry.json`, keyed on Source ID. Stable — a case keeps its number for life |
| **Interface** (API / Web) | Derived from the steps. The rules and hit counts are on the **Interface Rules** sheet |
| **Priority** | Derived only when you leave it blank |
| **Status** | Always starts `Not Tested` |
| **Automated / Automated By** | Matched from Playwright spec titles that contain the Source ID |
| **Channel** | B2B unless the feature is Customer App, Qattah or Cards |

---

## 6. Rebuild and check

If you edited a `.md` file, the markdown build must run first — the by-feature build reads its
output, not the markdown.

```bash
npm run build:manual-testcases && npm run build:manual-by-feature
```

Then confirm, in the rebuilt workbook:

- [ ] Your cases appear on the expected feature sheet, with an `EMI-B2B-nnnn` id
- [ ] The **Duplicate IDs** sheet is empty
- [ ] No case anywhere has a blank Expected Result
- [ ] The console `sources:` line went up by the number of cases you added
- [ ] The traceability count did not go **down** (it should be unchanged, or higher)
- [ ] The console printed no `WARNING:` lines

The console prints all of these on every run.

---

## 7. Where the guards live

All in `scripts/build-manual-by-feature.mjs`:

| Sheet | What it proves |
|---|---|
| Duplicate IDs | No two cases share a Source ID |
| *(console warnings)* | A merge left an AIO twin standing as a loose copy of a check, or buried a `Security` / `Compliance` case under a keeper of a different Test Type |
| Merged Cases | Which cases were folded into a checklist case, and which numbered check they became |
| Retired - Duplicates | Which cases were dropped as exact duplicates, and what covers them now |
| Backfilled Content | Which cases had empty fields filled from `expected-backfill.json` |
| Interface Rules · Priority Rules | How every case got its Interface and Priority |
| Traceability · Automation Orphans | Which manual cases have an automated test, and which specs point at nothing |
