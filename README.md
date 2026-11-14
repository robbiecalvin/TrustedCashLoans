# Trusted Cash Loans

## GitHub Pages

The GitHub Actions workflow in `.github/workflows/pages.yml` builds and deploys the public site on pushes to `main`, or when run manually. In the repository's **Settings → Pages**, set the deployment source to **GitHub Actions**. Push these changes to `main` to publish them.

The build uses the Pages base path reported by GitHub, so images, styles, scripts, and links work with either a repository URL or a custom domain. It publishes HTML, public assets, and dashboard/simulator scripts; it excludes the Node server, dependencies, Git metadata, and application data.

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
