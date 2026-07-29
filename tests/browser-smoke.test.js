const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

async function run() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : undefined);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const filePath = `file://${path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/")}`;

  await page.goto(filePath);
  await page.waitForSelector("#totalEstimate");

  assert.equal(await page.locator("#totalEstimate").innerText(), "$179,197");

  await page.click("#resetEstimate");
  await assertText(page, "#validationSummary", "Needs fixes");
  await assertText(page, "#totalEstimate", "$0");

  await page.click("#loadSample");
  await assertText(page, "#validationSummary", "Valid");
  await assertText(page, "#totalEstimate", "$179,197");

  await page.fill("#area", "49");
  await assertText(page, '[data-error-for="area"]', "Area must be between 50 and 250000.");
  await assertText(page, "#validationSummary", "Needs fixes");
  await assertText(page, "#totalEstimate", "$0");

  await page.fill("#area", "6400");
  await page.fill("#projectName", "Saved Browser Check");
  await page.click("#saveScenario");
  await assertText(page, "#saveStatus", "Scenario saved");
  await assertText(page, ".scenario-load strong", "Saved Browser Check");

  const savedCount = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("sawtooth.savedScenarios.v1"));
    return saved.length;
  });
  assert.equal(savedCount, 1);

  await page.setViewportSize({ width: 390, height: 860 });
  const shellColumns = await page.locator(".app-shell").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  assert.equal(shellColumns.split(" ").length, 1);

  await page.emulateMedia({ media: "print" });
  const savedDisplay = await page.locator(".saved-panel").evaluate((node) => getComputedStyle(node).display);
  assert.equal(savedDisplay, "none");

  await browser.close();
}

async function assertText(page, selector, expected) {
  const actual = await page.locator(selector).first().innerText();
  assert.equal(actual, expected);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
