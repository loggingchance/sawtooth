# Sawtooth Static Prototype

Sawtooth is a flat-file web prototype for modeling production economics at primary wood products facilities. It is intended for lumber, pallet, firewood, railroad tie, pellet, and similar operations. It uses only HTML, CSS, and vanilla JavaScript, so it can run locally by opening `index.html` and can be hosted directly from GitHub Pages.

## Features

- Live calculations for saleable volume, adjusted selling price, gross revenue, wood/fiber cost, conversion cost, freight, overhead, risk reserve, total cost, operating margin, margin rate, unit margin, and break-even price.
- Client-side validation with clear field-level messages and display-safe totals when inputs are invalid.
- Local draft persistence and up to eight saved facility runs using `localStorage`.
- Polished final report preview with print/save-to-PDF styling.
- Standalone HTML report download for sharing or archiving.
- CSV export for spreadsheet review.
- Responsive layout for desktop, tablet, and mobile screens.
- Dependency-free calculation tests using Node.js.

## Files

- `index.html` - application markup.
- `styles.css` - responsive and print styles.
- `app.js` - calculation engine, validation, localStorage behavior, and UI wiring.
- `tests/calculations.test.js` - deterministic calculation and validation checks.
- `.github/workflows/pages.yml` - GitHub Pages deployment workflow.

## Run Locally

Open `index.html` in a browser. No build step is required.

For a lightweight local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Test

```bash
node tests/calculations.test.js
```

The tests cover production economics, product-line factors, validation errors, reset behavior, and invalid-result handling.

The browser smoke test covers localStorage scenarios, validation rendering, report preview/export controls, print media styles, and the mobile layout. It expects Playwright and a local Chromium-compatible browser:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/path/to/chrome" node tests/browser-smoke.test.js
```

## Deploy

The repository includes a GitHub Actions workflow that publishes the static files to GitHub Pages whenever changes are pushed to `main`.
