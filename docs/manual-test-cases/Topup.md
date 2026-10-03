# Manual Test Cases — Topup (Card Top-Up UI Detail)

Context: this document drills into the Topup screen (`/business/main/transfer/top-up`) at UI-element
granularity — mirroring the level of detail in `HomePage.md`/`BankTransfer.md` — and complements the
higher-level business-flow cases already in `B2B-Transactions.md` section D (`TU-01..TU-14`, HyperPay/
VIBAN/SADAD) and the Admin-Portal-gated business rules in sections M/N/O (`TU-WB##` wallet-balance
limits, `TU-TL##` transaction limits — still manual-only, pending Admin Portal automation; `TU-CM##`
commission is automated in `functional/TopupCommission.spec.ts`, see that file for which cases remain
`test.skip()`-ed). This doc uses its own `TUP-##` ID prefix so it never collides with the `TU-` range
already claimed there. It mirrors the existing automation under `BusinessTestCases/Topup/` (currently
`ui/TopupUI.spec.ts`, `api/TopupAPI.spec.ts`, `functional/Topup{HappyPath,Negative,Security,Navigation,
OtpFlow,Commission}.spec.ts` — VIBAN/SADAD top-up automation was archived and removed, not currently
maintained) and cross-links each section to that coverage instead of restating it.

Cases below were captured against the **dev** environment (`dev.majdpay.com`) via two independent live
manual walkthroughs on 2026-09-17, cross-checked against `BusinessTestCases/pageElements/Topup/TopupPage.ts`
and `QA-DATA-TESTID-HANDOFF.md` section 4.5.

Priority key: **P1** = blocks the release / core happy path, **P2** = important secondary behavior, **P3** = edge case / polish.

---

## Findings from these walkthroughs — worth investigating before treating this doc as final

- **[Confirmed] Disclaimer text mismatch.** The live dev page under the amount field reads
  *"Disclaimer: We at MJD Pay do not store any of your card information."* — but
  `TopupPage.ts`'s `disclaimerText` locator (and `ui/TopupPage.spec.ts`'s "should display the Hyper Pay
  disclaimer text" test) matches `/disclaimer:\s*top up is powered by hyper pay/i`. Either the copy
  changed after the locator was written (test may now be failing or matching a stale fallback) or dev
  is serving different copy than what automation targets against UAT/preprod. Confirm which environment
  is right and update whichever side is stale — see TUP-19.
- **[Confirmed] Summary total-row label mismatch.** The live dev Summary screen labels the final row
  **"Total Amount to be Received"**, but `TopupPage.waitForSummaryToSettle()` and
  `ui/TopupSummaryPage.spec.ts` both look up the row by the label **"Total amount to be sent"** (copied
  from the BankTransfer page object, where money flows out). If the locator is matching on a substring
  or fallback rather than this exact label, `getSummaryMoney('Total amount to be sent')` may be silently
  resolving to nothing / a stale element rather than actually reading the total — worth a targeted check
  rather than assuming the automation is currently passing for the right reason. See TUP-17.
- **[Confirmed] OTP is requested before card entry, not after.** The first walkthrough saw OTP
  requested immediately after confirming the Summary screen, before any card-details/HyperPay popup
  appeared (flow: Amount → Proceed → Summary → Confirm → OTP → [pop-up blocked before reaching card
  entry]). A second, independent walkthrough corroborates this structurally: its own screen inventory
  lists only three screens for the whole flow — Main Page → Top Up Summary → OTP Verification — followed
  by a distinct **"Post-verification redirect (main Topup page)"** state where the pop-up-blocked banner
  actually appears. There is no card-entry screen anywhere before OTP in either capture; the app only
  attempts to open the card-entry/3-D-Secure popup *after* OTP verification redirects back to the main
  page. `TopupFlow.spec.ts`'s full card-payment flow instead fills card details and clicks **Pay Now**
  first, then checks `if (await otp.isVisible())` **after** the gateway popup closes — that ordering
  looks backwards relative to what dev actually does. See TUP-23; if `TopupFlow.spec.ts` is passing
  today, it's worth confirming it isn't doing so against a stale/mocked step order.
- **[Confirmed] Summary's Confirm button triggers the OTP send itself.** Both walkthroughs agree the
  Summary screen's primary button shows a spinner and the label "Loading" while its request is in
  flight, and that request is what sends the OTP — reinforcing the finding above rather than a separate
  issue. See TUP-21.
- **[New] Commission/VAT read as 0 in both manual runs.** Neither walkthrough exercised an account with
  a live fee-bearing commission tier, so TUP-17's "equals Original Amount + Commission + VAT" claim is
  untested against a non-zero commission in this doc. The automated `TU-CM19..32` cases in
  `functional/TopupCommission.spec.ts` already cover this against the account's live tier — this is a
  gap in manual coverage specifically, not a defect.
- **[Guess]** The pop-up-blocked banner ("Please allow pop-ups to continue the payment.") suggests the
  card-entry/3-D-Secure step opens in a new browser window/tab (matching `TopupPage.ts`'s
  `clickSummaryNextAndCapturePopup`), so TUP-30/TUP-31 assume that; neither manual pass could verify the
  actual card-entry screen or a completed payment because pop-ups were blocked in both sessions.

---

## A. Entry points & page identity

Context: Topup is reachable from the sidebar "Topup" link and from the homepage "Add money via card"
quick action; both should land on an identical page. TUP-01/TUP-02 are automated in
`functional/TopupNavigation.spec.ts`; TUP-03 is covered at a basic level by `ui/TopupUI.spec.ts`.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-01 | Sidebar link opens Topup | Click "Topup" in the left sidebar | User lands on `/business/main/transfer/top-up`; sidebar highlights "Topup" as the active item | P2 |
| TUP-02 | Homepage quick action opens Topup | From the homepage, click the "Add money via card" quick-action card | User lands on the same Topup page as TUP-01 | P2 |
| TUP-03 | Page title and subtitle | Land on Topup via either entry point | Heading reads "Top up"; subtitle reads "Add funds to your business wallet using a card or wallet supported in Saudi Arabia." | P3 |
| TUP-04 | Direct URL requires auth | Log out, then navigate directly to `/business/main/transfer/top-up` | User is redirected to the login page; Topup content is not rendered | P1 |

---

## B. Balance card

Context: shared `mp-` balance component (also used on BankTransfer/HomePage). Basic presence already
covered by `ui/TopupPage.spec.ts` ("Current Balance label", "wallet code", "QR/settings buttons").

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-05 | Balance and wallet code match account | Open Topup for an account with a known balance/wallet code | Displayed "CURRENT BALANCE" value (e.g. 0.00) and "Wallet code" (e.g. MER-Q9EK4TTPGE-30) are account-specific, read-only, and match the account's actual records | P2 |
| TUP-06 | Generate QR Code action | Click the QR icon (`aria-label="generate QR Code"`) on the balance card | A wallet QR code is generated/displayed | P3 |
| TUP-07 | Wallet settings action | Click the gear icon (`aria-label="wallet settings"`) on the balance card | Wallet settings view/dialog opens | P3 |

---

## C. Payment methods

Context: MADA / VISA / MASTER render as single-select cards (`page.getByRole('radio')` per
`TopupPage.ts`). Presence and count already covered by `ui/TopupPage.spec.ts`.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-08 | No method selected by default | Land fresh on the Topup page | None of MADA/VISA/MASTER show the selected (checkmark) state | P3 |
| TUP-09 | Selecting a method highlights it | Click the VISA card | VISA shows a blue border and checkmark; single-select among MADA/VISA/MASTER | P2 |
| TUP-10 | Methods are mutually exclusive | Select MADA, then select VISA | MADA's checkmark clears; only VISA remains selected | P2 |
| TUP-11 | Proceed disabled with no method selected | Enter a valid amount (e.g. 500) but select no payment method | Proceed stays disabled | P1 |

---

## D. Amount field — format & validation

Context: `input#input_set_amount` / `getByTestId('amount-input')`. Interaction-level validation is
already data-driven in `functional/TopupFlow.spec.ts` via `data/topupData.json` — confirmed automated
cases include: `-10.00` → typed value normalizes to `10.00` (sign stripped, not rejected); `0` → rejected,
Proceed disabled; `abc!@#` → rejected, Proceed disabled; `10.55` / `10.5` accepted as typed; `10.555` →
truncated to `10.55` (max 2 decimals); clipboard-paste of `25.00` accepted, clipboard-paste of
`invalid_text` rejected. The rows below cover what that dataset does **not** currently exercise.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-12 | Inline error text for zero amount | Type `0` into the amount field | Field border turns red and an inline message "Amount should be more than 0" is shown | P2 |
| TUP-13 | **[Gap — not in `topupData.json`]** Long integer amount is capped | Type a 9-digit value, e.g. `999999999` | Observed on dev in both manual runs: field silently truncates to 7 digits (`9999999`) with **no** visible error/warning — confirm this 7-digit / ~9,999,999 ceiling is the intended business maximum, and whether a max-amount message should be shown instead of silent truncation | P2 |
| TUP-14 | Preset chip then manual override | Click the "500" chip, then manually edit the field to a different value | Field shows the manually typed value; no chip remains visually selected | P2 |
| TUP-15 | Currency icon always present | With the field empty and with a value entered | The currency icon prefix (`.mp-amount-currency`) is visible in both states | P3 |

---

## E. Preset amount chips

Context: `getByTestId('amount-chip-<value>')` for 500/1000/2000/5000/10000. Presence covered by
`ui/TopupPage.spec.ts` ("Or select amount" label + 5 chips).

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-16 | Each chip populates the amount field | Click 500, then 1000, then 2000, then 5000, then 10000 in turn | Amount field updates to match the clicked chip each time | P2 |

---

## F. Top Up Summary

Context: appears after Proceed — either **inline** (`topup-summary-cancel-btn` / `topup-summary-next-btn`)
or as a **modal** (`topup-summary-modal-cancel-btn` / `topup-summary-modal-next-btn`) per
`QA-DATA-TESTID-HANDOFF.md` §4.5. Row-level checks already covered by `ui/TopupSummaryPage.spec.ts`.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-17 | Total row reads correctly | Proceed to Summary with a valid method + amount | Final total row is labeled **"Total Amount to be Received"** on this build and equals Original Amount + Commission + VAT (both manual runs observed Commission/VAT as 0 — verify against a fee-bearing tier; see Findings and `functional/TopupCommission.spec.ts`'s `TU-CM19..32`) | P1 |
| TUP-18 | Inline vs. modal presentation | Reach the Summary step from both the sidebar entry point and the homepage quick-action entry point (and, if applicable, at a narrower viewport) | Confirm and document which conditions produce the inline panel vs. the modal variant — behavior is not yet documented anywhere in this repo | P3 |
| TUP-19 | Disclaimer copy matches current build | Read the disclaimer banner on the main Topup form | Confirm actual wording against `ui/TopupPage.spec.ts`'s expectation ("...powered by Hyper Pay") — dev currently shows different copy about not storing card information (see Findings) | P2 |
| TUP-20 | Cancel returns without side effects | On the Summary screen, click "Cancel" | User returns to the main Topup form; balance and transaction history are unchanged | P2 |
| TUP-21 | Confirm shows a loading state and triggers OTP send | On the Summary screen, click the primary Confirm/Proceed button | Button shows a spinner and the label "Loading" while the request is in flight; that request is what sends the OTP (see Findings) — user then lands on the OTP screen | P2 |

---

## G. OTP verification

Context: `topup-otp-cancel-btn` / `topup-otp-verify-btn` / `topup-otp-resend-btn`. Confirm against the
sequencing finding above before treating this section as fully accurate for every payment method.
TUP-24, TUP-25, TUP-27, and TUP-29 are automated in `functional/TopupOtpFlow.spec.ts`; TUP-26 is
automated there too, but for the timer restarting, not for clearing entered digits — confirmed live
2026-09-27 that Resend leaves already-typed digits in place, unlike Login's own OTP screen. TUP-22 is
covered by `ui/TopupUI.spec.ts`; TUP-28 by `functional/TopupNegative.spec.ts`.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-22 | OTP screen content | Reach the OTP step | Subtitle reads "A code has been sent to you, in order to continue with the top up process."; a mini summary is shown above 6 single-digit input boxes, keyed "MERCHANT TOP UP" / selected payment method and "TOTAL AMOUNT TO BE RECEIVED" / total — both mini-summary labels render all-caps, unlike the Summary screen's own title-case "Total Amount to be Received" (TUP-17); worth a copy-consistency check, not necessarily a defect | P2 |
| TUP-23 | OTP sequencing vs. gateway | Proceed through a full card top-up | Confirm and document at which point OTP is actually requested relative to the HyperPay/3-D-Secure card entry step for each payment method — both manual runs saw OTP requested *before* card entry, with the card-entry popup only attempted after the post-verification redirect back to the main page (see Findings) | P1 |
| TUP-24 | Countdown timer behavior | Land on the OTP screen and watch the "Code ends MM:SS" timer | Timer starts at roughly 60 seconds (observed live as "Code ends 00:51" moments after landing) and counts down in real time to 00:00 without resetting or freezing; confirm exact starting value and behavior once it reaches 00:00 | P2 |
| TUP-25 | Resend before expiry | Click "Click to resend" while the timer is still running | Confirmed live 2026-09-27: the button itself stays disabled while the countdown is running, so this can't actually be clicked before expiry — "blocked" by the disabled state, not a distinct clickable-but-rejected behavior | P3 |
| TUP-26 | Resend after expiry | Wait for the timer to reach 00:00, then click "Click to resend" | A new OTP is sent and the timer restarts; confirmed live 2026-09-27 that already-entered digits are NOT cleared (differs from Login's own OTP screen) | P2 |
| TUP-27 | Verify stays disabled until all digits are entered | Land on the OTP screen and enter fewer than 6 digits | "Verify" button remains disabled; confirmed live 2026-09-27 that this screen's widget auto-submits the instant the 6th digit lands (see `pageElements/Shared/OtpPage.ts`), so there's no observable "enabled but unclicked" state to separately confirm the way Login's own screen has | P2 |
| TUP-28 | Incorrect OTP rejected | Enter an incorrect 6-digit code and click "Verify" | A clear error is shown; user cannot proceed to payment | P1 |
| TUP-29 | Cancel aborts the top-up | On the OTP screen, click "Cancel" | Top-up is aborted; user returns to the main Topup page; no funds move | P2 |

---

## H. Payment gateway redirect & pop-up blocking

Context: card entry happens in a separate window (`context().waitForEvent('page')` in
`TopupPage.clickSummaryNextAndCapturePopup`) — a HyperPay iframe for VISA, a `card_*`-named 3-D-Secure
iframe for MADA/MASTER. Not reachable in either manual pass because the browser blocked the pop-up both
times.

| ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TUP-30 | Pop-up-blocked messaging | Complete OTP verification and let the app attempt to open the card-entry window with the browser's pop-up blocker enabled | User is redirected back to the main Topup page, where a banner reading "Please allow pop-ups to continue the payment." is shown at the bottom | P2 |
| TUP-31 | Gateway opens once pop-ups are allowed | Allow pop-ups for the site, then retry | A new window/tab opens showing card-entry fields (Card Number, Expiry, Card holder, CVV) and a "Pay Now" button | P1 |
| TUP-32 | Pay Now disabled until required fields are complete | Open the card-entry window and leave one field empty | "Pay Now" remains disabled; confirm exact enable condition | P2 |
| TUP-33 | Declined payment leaves balance unchanged | Complete a card payment using a gateway-simulator return code for "failed" | A "Payment failed" result is shown; balance is unchanged; the transaction appears as FAILED in Transactions | P1 |
| TUP-34 | Pending payment leaves balance unchanged | Complete a card payment using a gateway-simulator return code for "pending" | A "Payment pending confirmation" result is shown; balance is unchanged until resolved | P2 |
| TUP-35 | Card number and CVV are captured in the gateway's PCI iframe, not MJD Pay's own page | Open the card-entry gateway popup reached via TUP-31 and inspect the Card Number and CVV fields (DOM/frame structure, not just visually) | Card Number and CVV render inside separate PCI-compliant iframes hosted and served by the HyperPay/OPPWA gateway (confirmed live as `iframe[name="card.number"]` and `iframe[name="card.cvv"]` in `TopupPage.ts`), not as plain inputs on MJD Pay's own page; keystrokes typed into them never reach MJD Pay's own frame, DOM or network requests and cannot leak into app logs. Only Expiry and Card Holder are plain page-level fields, not iframes. | P1 |

---

## Cross-references

- Business-flow happy path (HyperPay / VIBAN / SADAD), amount-format rule statement: `B2B-Transactions.md` section D (`TU-01`–`TU-14`).
- Wallet-balance ceiling rules (Admin Portal-gated): `B2B-Transactions.md` section M (`TU-WB01`–`TU-WB08`).
- Transaction amount/count limit rules (Admin Portal-gated): `B2B-Transactions.md` section N (`TU-TL01`–`TU-TL12`).
- Commission rules (Admin Portal-gated) and the live-tier automated suite: `B2B-Transactions.md` section O (`TU-CM01`–`TU-CM18`), `functional/TopupCommission.spec.ts` (`TU-CM19`–`TU-CM32`).
- Automated coverage: `BusinessTestCases/Topup/ui/TopupUI.spec.ts`, `api/TopupAPI.spec.ts`, `functional/TopupHappyPath.spec.ts`, `functional/TopupNegative.spec.ts`, `functional/TopupSecurity.spec.ts`, `functional/TopupNavigation.spec.ts`, `functional/TopupOtpFlow.spec.ts`, `functional/TopupCommission.spec.ts` (a few individual `TU-CM` cases there remain `test.skip()`-ed — see that file). VIBAN/SADAD top-up and the wallet-balance/transaction-limit business rules (`TU-WB##`/`TU-TL##`) have no current automation — their earlier spec files were archived and removed as unmaintained.
- Locator reference: `QA-DATA-TESTID-HANDOFF.md` section 4.5; page object: `BusinessTestCases/pageElements/Topup/TopupPage.ts`.
