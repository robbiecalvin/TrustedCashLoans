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
