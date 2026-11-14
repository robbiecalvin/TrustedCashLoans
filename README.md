# Trusted Cash Loans

## GitHub Pages

The GitHub Actions workflow in `.github/workflows/pages.yml` builds and deploys the public site on pushes to `main`, or when run manually. In the repository's **Settings → Pages**, set the deployment source to **GitHub Actions**. Push these changes to `main` to publish them.

Public HTML uses relative links, so images, styles, scripts, and links work even when GitHub publishes directly from the main branch. The Actions build additionally configures static mode and uses the Pages base path reported by GitHub. The deployment workflow checks live HTML, CSS, scripts, and PNG images after publication. It publishes HTML, public assets, and dashboard/simulator scripts; it excludes the Node server, dependencies, Git metadata, and application data.

To build and validate locally with Node.js 18 or newer:

```sh
npm test
PAGES_BASE_PATH=/TrustedCashLoans npm run build:pages
```

The output is `_site/`. Serve it under `/TrustedCashLoans/` to simulate a repository Pages URL, or omit `PAGES_BASE_PATH` and serve it at `/` for a domain-root deployment. Do not open the files directly with `file://`.

Calculators, images, theme switching, dashboard, simulator, and downloadable loan estimates work on Pages. GitHub Pages cannot run Express APIs. Application intake and editor login therefore display an availability notice, and contact/partnership links open the visitor's email app. No application or contact form claims to submit information on Pages. Estimate downloads stay on the visitor's device; Pages does not send emails.

## Node server development

```sh
npm ci
npm start
```

The Express server uses port 3000 by default (`PORT` overrides it). Optional configuration: `EDITOR_USERNAME`, `EDITOR_PASSWORD`, `SESSION_SECRET`. Set these through the process environment; `.env` is not automatically loaded. Server-backed submissions write local files under `data/`. The estimate endpoint stores requests but does not have an email delivery integration.

`npm run generate:seo` regenerates tracked content and is not required to run or deploy the existing site.

## Guided application and Google Sheets

`/apply/` uses seven stages with conditional previous address (12 months or less), previous employment (less than 3 months), and outstanding-loan details. The last stage reviews answers before a truthful-information declaration, optional nine-digit SIN, and required credit-check consent. Answers are not saved in browser storage. The server validates all active fields and sends one row to Sheets; it does not also write the application to local JSON/CSV. Success appears only after Sheets confirms delivery.

To enable delivery on the Node server:

1. Create a dedicated Google Sheet with a blank tab named `Applications` (or set `GOOGLE_SHEETS_TAB`). Keep the tab dedicated to this application; the server creates and checks its header.
2. Enable Google Sheets API in a Google Cloud project and create a service account. Share the Sheet with that account's email as an Editor. Keep access restricted to the people handling applications.
3. Supply `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY` securely in the server's process environment. The private key accepts actual newlines or escaped `\n`. Never put it in browser JavaScript, a committed file, or chat. `.env` is not loaded automatically.
4. Allow server HTTPS requests to `oauth2.googleapis.com` and `sheets.googleapis.com`, then restart `npm start`.
5. Submit a test application containing synthetic data and confirm its row in the Sheet before accepting live applications. Remove the synthetic row afterward.

Google Sheets values are written in RAW mode so applicant text cannot become spreadsheet formulas. Each browser submission has a UUID; retries check column A before appending. Use a single Node server instance for this implementation; multiple instances need shared deduplication/locking before scaling. Restrict access to the Sheet because it contains personal and financial information, including optional SINs. Do not log application bodies.

The application cannot submit on GitHub Pages: Google credentials belong on a backend. Host the Node server over HTTPS to accept applications. Missing configuration returns 503; Google delivery failures return 502 and keep answers available for retry. Automated tests mock Google responses; live delivery requires the configured Sheet and service-account credentials.

## Application confirmation emails

After Google Sheets accepts an application, the Node backend sends a confirmation to the applicant's email through Resend. The message says: “We have received your application. We will get back to you within 24 hours to let you know whether we have found a lender for you based on the information you provided.” It includes the application reference and no financial details or SIN.

Configure `RESEND_API_KEY` securely and set `APPLICATION_EMAIL_FROM` to an address on a domain verified in your Resend account (for example, `Trusted Cash Loans <applications@your-verified-domain>`). Allow HTTPS to `api.resend.com`, then restart the Node server. Existing Google Sheets/backend configuration is still required. GitHub Pages cannot send these emails.

A `Confirmation email status` column is added to the known application header automatically, preserving existing answers. Status `sent` means the provider accepted the email, not guaranteed inbox delivery. Missing email configuration records `not_configured`; provider failure records `failed`. The API still confirms the application was received and the page explains when an email could not be confirmed. Do not ask the applicant to resubmit just because email failed.

Retries of the same application use the saved recipient and a stable Resend idempotency key. Confirmed sends are skipped. An uncertain send older than 23 hours is returned as `needs_review` rather than automatically sending again outside the provider's 24-hour idempotency window. There is no background email retry worker: operators must monitor failed/pending/unconfigured rows and follow up. Before going live, test an application to an inbox you control and verify both the Sheet status and actual email arrival. Tests use mocked provider responses; they do not send mail.
