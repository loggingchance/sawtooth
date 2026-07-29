const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

async function run() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : undefined);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const filePath = `file://${path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/")}`;

  await page.goto(filePath);
  await page.waitForSelector("#operatingMargin");

  assert.equal(await page.locator("#operatingMargin").innerText(), "$759,910");

  await page.click("#resetEstimate");
  await assertText(page, "#validationSummary", "Needs fixes");
  await assertText(page, "#operatingMargin", "$0");

  await page.click("#loadSample");
  await assertText(page, "#validationSummary", "Valid");
  await assertText(page, "#operatingMargin", "$759,910");

  await page.fill("#annualInput", "0");
  await assertText(page, '[data-error-for="annualInput"]', "Annual input volume must be between 1 and 10000000.");
  await assertText(page, "#validationSummary", "Needs fixes");
  await assertText(page, "#operatingMargin", "$0");

  await page.fill("#annualInput", "240000");
  await page.fill("#facilityName", "Saved Browser Check");
  await page.click("#saveScenario");
  await assertText(page, "#saveStatus", "Scenario saved");
  await assertText(page, ".scenario-load strong", "Saved Browser Check");

  await page.fill("#notes", "Mixed hardwood pallet cant assumptions.");
  await page.click("#openReport");
  await assertText(page, "#reportFacility", "Saved Browser Check");
  await assertText(page, "#reportMargin", "$759,910");
  await assertText(page, "#reportBreakEven", "$11 / pallets");
  await assertText(page, "#reportNotes", "Mixed hardwood pallet cant assumptions.");
  assert.equal(await page.locator("body").evaluate((node) => node.classList.contains("report-open")), true);

  await page.emulateMedia({ media: "print" });
  const toolbarDisplay = await page.locator(".report-toolbar").evaluate((node) => getComputedStyle(node).display);
  assert.equal(toolbarDisplay, "none");
  await page.emulateMedia({ media: "screen" });

  const htmlDownload = page.waitForEvent("download");
  await page.click("#downloadHtml");
  assert.match((await htmlDownload).suggestedFilename(), /saved-browser-check-sawtooth-report\.html/);

  const csvDownload = page.waitForEvent("download");
  await page.click("#downloadCsv");
  assert.match((await csvDownload).suggestedFilename(), /saved-browser-check-sawtooth-report\.csv/);

  await page.click("#closeReport");
  assert.equal(await page.locator("#reportModal").evaluate((node) => node.hidden), true);

  const savedCount = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("sawtooth.savedScenarios.v2"));
    return saved.length;
  });
  assert.equal(savedCount, 1);

  await page.setViewportSize({ width: 390, height: 860 });
  const shellColumns = await page.locator(".app-shell").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  assert.equal(shellColumns.split(" ").length, 1);

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
