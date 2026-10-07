# Connecting the test mailbox so tests can read OTP codes

This is the setup guide for `support/emailOtp.ts`, which reads one-time codes out
of the shared UAT/preprod test mailbox so login and registration tests can run
without a human opening Outlook.

**No code needs writing.** `fetchOtpFromEmail` is already built and already wired
into `Login/LoginHelper.ts` and `Registration/RegistrationHelper.ts`. The only
thing missing is three configuration values that have to come from an Entra ID
(Azure) administrator.

## What is missing right now

`.env.uat` and `.env.preprod` both have the mailbox filled in but these three
blank:

```
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
```

Until they are filled in, any test that needs a real OTP fails with:

> AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET env vars must be set to fetch OTP by email

`ENV=dev` is unaffected — the OTP there is always `00000000` and the mailbox is
skipped entirely.

## Why an admin has to be involved

Microsoft has switched off plain username-and-password access to mailboxes from
outside apps. There is no longer a way to put the mailbox password in `.env` and
have it work — and this mailbox has MFA enforced on top of that.

The replacement is an "app registration": a identity created once in Azure that
belongs to the automation itself rather than to a person. It gets its own secret,
and `emailOtp.ts` signs in as that app. Nothing breaks when someone changes their
password, and it behaves the same on your laptop and in CI.

Creating one requires Global Administrator or Application Administrator rights.
If that is not you, send this page to whoever has it.

---

## Part 1 — Azure portal (admin)

### 1. Create the app registration

1. <https://portal.azure.com> → search **Microsoft Entra ID**
2. **App registrations** → **New registration**
3. Name: `mjdpay-automation-otp-reader`
4. Supported account types: **Accounts in this organizational directory only**
5. Leave Redirect URI empty → **Register**

Copy these two values from the page that appears:

- **Application (client) ID** → becomes `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → becomes `AZURE_TENANT_ID`

### 2. Add the IMAP permission

This is the step that is easy to get wrong, because the permission is **not**
under Microsoft Graph.

1. In the app → **API permissions** → **Add a permission**
2. Go to the **APIs my organization uses** tab — *not* "Microsoft APIs"
3. Search for and select **Office 365 Exchange Online**
4. Choose **Application permissions** — *not* Delegated
5. Tick **IMAP.AccessAsApp** → **Add permissions**
6. Click **Grant admin consent for \<org\>** and confirm — the Status column must
   show a green tick

> If you find yourself adding `Mail.Read` under Microsoft Graph, that is the
> wrong permission for this project. Graph is a different API; `emailOtp.ts`
> connects over IMAP and requests the `https://outlook.office365.com/.default`
> scope, which only `IMAP.AccessAsApp` satisfies.

### 3. Create a client secret

1. **Certificates & secrets** → **New client secret**
2. Description `automation`, expiry per your policy (24 months is common)
3. Copy the **Value** column immediately — it is shown only once, and it is *not*
   the "Secret ID" beside it. This becomes `AZURE_CLIENT_SECRET`.

> Put the expiry date in a shared calendar. When the secret lapses, every
> OTP-dependent test starts failing at once and nothing in the codebase changed,
> which is a genuinely confusing morning for whoever is on shift.

### 4. Grant the app access to the mailbox (Exchange Online PowerShell)

Permission in Azure is not enough on its own — Exchange has to be told the app
exists and which mailbox it may open.

```powershell
Connect-ExchangeOnline

# Register the app in Exchange. ObjectId is the *enterprise application* object
# id, found under Entra ID -> Enterprise applications -> (this app) -> Overview.
New-ServicePrincipal -AppId "<Application (client) ID>" -ObjectId "<Enterprise app Object ID>" -DisplayName "MJDPay automation OTP reader"

# Grant it access to the test mailbox only.
Add-MailboxPermission -Identity "<the IMAP_USER mailbox>" -User "<Enterprise app Object ID>" -AccessRights FullAccess
```

Granting per-mailbox this way is what keeps the app from being able to open
every mailbox in the company. Please do not skip it. Changes can take up to
30 minutes to take effect.

Microsoft's own reference for this flow:
<https://learn.microsoft.com/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth>

---

## Part 2 — putting the values in (you)

Add the three values to **both** `.env.uat` and `.env.preprod`:

```
AZURE_TENANT_ID=<Directory (tenant) ID>
AZURE_CLIENT_ID=<Application (client) ID>
AZURE_CLIENT_SECRET=<the secret Value from step 3>
```

These files are gitignored. Never commit real secrets, and do not paste the
secret into chat, tickets, or Teams messages — send it through your password
manager or ask the admin to enter it directly.

## Part 3 — checking it works

Run a login test that needs a real OTP:

```bash
npx playwright test BusinessTestCases/Login/ --grep-invert "@dev"
```

If the mailbox link is working, the test gets past the OTP screen. If it is not,
`emailOtp.ts` raises one of the errors in the table below.

## When it goes wrong

| Error | What it means |
|---|---|
| `AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET env vars must be set` | The three values are still blank, or you ran without `cross-env ENV=uat` so the wrong `.env` loaded |
| `IMAP_HOST and IMAP_USER env vars must be set` | Wrong or missing env file for the environment you selected |
| `Azure AD token request failed (401)` | Wrong secret, or the Secret ID was copied instead of the Value |
| `Azure AD token request failed` mentioning expiry | The client secret expired — create a new one (step 3) |
| `IMAP OAuth2 login to ... failed` | Azure side succeeded but Exchange refused. Usually: permission added as Delegated instead of Application, added under Microsoft Graph instead of Office 365 Exchange Online, admin consent not granted, or step 4 never run |
| `AADSTS53003: blocked by Conditional Access` | A Conditional Access rule blocks this app. Only an admin can exclude the app registration from that policy |
| `No OTP email found for mobile <n> after 10 attempts` | Auth is fine and the mailbox opened — the email just did not arrive, or its body does not contain both the mobile number and `Use this OTP`. Check the mailbox by hand |

## Related

- `support/emailOtp.ts` — the implementation
- `CLAUDE.md` → "OTP handling" — how it fits into the wider suite
