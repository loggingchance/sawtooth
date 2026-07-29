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
  assert.equal(result.saleableVolume, 187200);
  assert.equal(result.adjustedPrice, 14.91);
  assert.equal(result.grossRevenue, 2791152);
  assert.equal(result.woodFiberCost, 1008000);
  assert.equal(result.conversionCost, 580320);
  assert.equal(result.freightCost, 224640);
  assert.equal(result.overheadCost, 159120);
  assert.equal(result.riskReserve, 59162.4);
  assert.equal(result.totalCost, 2031242.4);
  assert.equal(result.operatingMargin, 759909.6);
  assert.equal(result.marginRate, 27.23);
  assert.equal(result.marginPerUnit, 4.06);
  assert.equal(result.breakEvenPrice, 10.85);
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
