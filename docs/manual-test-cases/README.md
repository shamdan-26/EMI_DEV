# Manual Test Cases

The manual side of EMI QA. Automation lives in `BusinessTestCases/`; this folder holds everything
executed by hand, plus the coverage analysis that says what is and is not covered.

## Start here

| File | What it is |
|---|---|
| **`EMI Manual Test Cases - BY FEATURE.xlsx`** | **The working suite.** 8,854 cases across 39 feature sheets — one sheet per feature, with Status dropdowns, colour coding and per-feature roll-ups. This is the file to execute from. |
| `Archive/Archived-Manual-Test-Cases.xlsx` | Retired cases and the review queue. Nothing is deleted — see its README sheet. |

Everything else below is a source that feeds the by-feature file.

## Per-epic suites

Written against live Jira acceptance criteria for stories that had no coverage anywhere.
Each follows the `PoS Transactions Test_Cases Release V6.6.0` template: Overview roll-up,
one sheet per story, Status dropdown, conditional colour coding.

| Folder | Cases | Covers |
|---|---|---|
| `PoS-Transactions-V6.6.0/` | 455 | EMI-5914 epic — all 12 stories plus 16 end-to-end business flows |
| `Balances-Wallet-Consistency-EMI-5944/` | 255 | EMI-5944 epic — prevention, detection and repair, plus E2E |
| `Task-Coverage-EMI/` | 250 | 49 Jira **Tasks** above EMI-5794 that had no coverage, in 13 feature clusters |
| `Payments-TTL-EMI-6031/` | 41 | EMI-6031 — draft expiry and ledger invalidation |
| `PoS-Device-Management-EMI-5824/` | 36 | EMI-5824 — directory, lifecycle, per-device sub-ledger |

`EMI Manual Test Cases - CONSOLIDATED.xlsx` is a flat view of just those 1,037 new cases.
Superseded by the by-feature file for day-to-day use; kept because it is the audit deliverable.

## Markdown sources

The `.md` files here are hand-maintained manual cases for the core flows — Login, Registration
(split across nine files), Forgot Password, Home Page, Bank Transfer, B2B Transactions,
Bill Items, Manage Accounts, Transaction Operations, PoS Products.

**The markdown is the source of truth.** `../../data/ManualTestCases.xlsx` is a rendering of it —
20 documents, 1,510 cases. After editing any `.md` file here, regenerate it:

```bash
npm run build:manual-testcases
```

`scripts/build-manual-testcases.mjs` reads every `## Section` heading and the test-case table
beneath it. A table is only picked up when its header row starts `| ID | Title |`, which keeps
reference tables (endpoint lists, ticket indexes) out of the output. Column order and presence
vary between documents — `ManageAccounts.md` has a `Jira` column and no `Steps` — so columns are
matched by name, not position. Add a new `.md` file and it is picked up automatically.

## Where the by-feature suite comes from

| Source | Cases | Notes |
|---|---|---|
| AIO (Jira) | 6,926 | The EMI AIO Tests repository, exported 08 Jul 2026 (`EMI-TC-1` … `EMI-TC-6926`) |
| Project docs | 891 | The markdown files in this folder |
| New (this audit) | 1,037 | Written for stories and tasks with no prior coverage |

Every row carries a `Source` column, so you can always tell which of the three a case came from.

## Two things to know before relying on it

- **Test Type on imported cases is auto-classified.** The 1,037 new cases were typed by hand.
  The 7,817 imported ones were classified from their title and expected result — a useful first
  pass, not a reviewed judgement. Re-check before using Test Type for reporting.
- **Nothing has been written back to Jira.** The Archive workbook is an extract. No case has been
  moved, edited or deleted in the AIO repository; doing that needs sign-off.

## Still open

Questions that need a person, not more test cases:

- **O43** — how a PoS refund settles at all. Until ANB and Product answer, EMI-5918 can only
  measure exposure; three cases are parked on it.
- **Payments TTL matrix** — Finance has not confirmed the proposed TTL and SLA values, and
  void-versus-refund per payment gateway is unresolved.
- **Commission rate: frozen at booking or resolved at pricing?** EMI-5921 is silent.
- **Review queue** — 1,291 cases from releases V3.4.0–V5.2.0 held for a product call on whether
  the feature still exists. See the Archive workbook.
- **~2,000 Done Tasks** below EMI-5794 have no task-level cases. Most are implementation splits
  of features already covered at feature level; the ~24 that are still open and uncovered are
  the batch worth doing next.

## Re-running the coverage analysis

If you redo the gap analysis against Jira, include `issuetype = Task`. A story-level query misses
EMI-5947, EMI-5948 and EMI-5949 — they sit under the EMI-5944 epic but are typed as Tasks, and
that is exactly how they went unnoticed the first time.
