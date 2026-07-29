# Sawtooth Static Prototype

Sawtooth is a flat-file web prototype for building, validating, saving, and printing project estimates. It uses only HTML, CSS, and vanilla JavaScript, so it can run locally by opening `index.html` and can be hosted directly from GitHub Pages.

## Features

- Live estimate calculations for materials, labor, mobilization, contingency, tax, total price, unit price, and estimated duration.
- Client-side validation with clear field-level messages and display-safe totals when inputs are invalid.
- Local draft persistence and up to eight saved scenarios using `localStorage`.
- Print-ready estimate view through the browser print dialog.
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

The tests cover calculation totals, multipliers, validation errors, and invalid-result handling.

The browser smoke test covers localStorage scenarios, validation rendering, print media styles, and the mobile layout. It expects Playwright and a local Chromium-compatible browser:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/path/to/chrome" node tests/browser-smoke.test.js
```

## Deploy

The repository includes a GitHub Actions workflow that publishes the static files to GitHub Pages whenever changes are pushed to `main`.
