const assert = require("node:assert/strict");
const { calculateEstimate, defaults, emptyEstimate, validateEstimate } = require("../app");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("calculates the default facility economics", () => {
  const result = calculateEstimate(defaults);

  assert.equal(result.validation.valid, true);
  assert.equal(result.saleableVolume, 11160);
  assert.equal(result.adjustedPrice, 556.2);
  assert.equal(result.grossRevenue, 6207192);
  assert.equal(result.woodFiberCost, 4410000);
  assert.equal(result.conversionCost, 1316880);
  assert.equal(result.freightCost, 401760);
  assert.equal(result.overheadCost, 491040);
  assert.equal(result.riskReserve, 264787.2);
  assert.equal(result.totalCost, 6884467.2);
  assert.equal(result.operatingMargin, -677275.2);
  assert.equal(result.marginRate, -10.91);
  assert.equal(result.marginPerUnit, -60.69);
  assert.equal(result.breakEvenPrice, 616.89);
});

test("applies product and market factors", () => {
  const result = calculateEstimate({
    ...defaults,
    productLine: "railroad_ties",
    annualInput: 5000,
    recoveryRate: 55,
    sellingPrice: 920,
    rawMaterialCost: 210,
    processingCost: 160,
    freightCost: 45,
    overheadCost: 70,
    contingency: 6,
    marketAdjustment: -2
  });

  assert.equal(result.saleableVolume, 2750);
  assert.equal(result.adjustedPrice, 973.73);
  assert.equal(result.grossRevenue, 2677757.5);
  assert.equal(result.totalCost, 1914625);
  assert.equal(result.operatingMargin, 763132.5);
  assert.equal(result.marginRate, 28.5);
  assert.equal(result.breakEvenPrice, 696.23);
});

test("rejects invalid numeric ranges and missing facility names", () => {
  const validation = validateEstimate({
    ...defaults,
    facilityName: "",
    annualInput: 0,
    recoveryRate: 101,
    marketAdjustment: -55
  });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.facilityName, /required/);
  assert.match(validation.errors.annualInput, /between 1 and 10000000/);
  assert.match(validation.errors.recoveryRate, /between 1 and 100/);
  assert.match(validation.errors.marketAdjustment, /between -50 and 50/);
});

test("invalid estimates return zeroed display-safe totals", () => {
  const result = calculateEstimate({ ...defaults, productLine: "invalid_product" });

  assert.equal(result.validation.valid, false);
  assert.equal(result.operatingMargin, 0);
  assert.equal(result.marginPerUnit, 0);
});

test("empty reset state is invalid and display-safe", () => {
  const result = calculateEstimate(emptyEstimate);

  assert.equal(result.validation.valid, false);
  assert.equal(result.operatingMargin, 0);
  assert.equal(result.marginPerUnit, 0);
  assert.match(result.validation.errors.facilityName, /required/);
  assert.match(result.validation.errors.annualInput, /required/);
});
