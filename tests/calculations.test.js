const assert = require("node:assert/strict");
const { calculateEstimate, defaults, validateEstimate } = require("../app");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("calculates the default estimate totals", () => {
  const result = calculateEstimate(defaults);

  assert.equal(result.validation.valid, true);
  assert.equal(result.materials, 118400);
  assert.equal(result.labor, 32640);
  assert.equal(result.mobilization, 2500);
  assert.equal(result.subtotal, 153540);
  assert.equal(result.contingencyCost, 15354);
  assert.equal(result.tax, 10302.53);
  assert.equal(result.total, 179196.53);
  assert.equal(result.unitPrice, 28);
  assert.equal(result.duration, 12);
});

test("applies complexity and finish multipliers", () => {
  const result = calculateEstimate({
    ...defaults,
    area: 1000,
    baseRate: 20,
    complexity: "technical",
    finish: "premium",
    crewSize: 2,
    workDays: 3,
    laborRate: 50,
    contingency: 5,
    taxRate: 8,
    mobilization: 1000
  });

  assert.equal(result.materials, 28792);
  assert.equal(result.labor, 2400);
  assert.equal(result.subtotal, 32192);
  assert.equal(result.contingencyCost, 1609.6);
  assert.equal(result.tax, 2704.13);
  assert.equal(result.total, 36505.73);
  assert.equal(result.duration, 4);
});

test("rejects invalid numeric ranges and missing labels", () => {
  const validation = validateEstimate({
    ...defaults,
    projectName: "",
    area: 49,
    crewSize: 3.5,
    taxRate: 18
  });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.projectName, /required/);
  assert.match(validation.errors.area, /between 50 and 250000/);
  assert.match(validation.errors.crewSize, /whole number/);
  assert.match(validation.errors.taxRate, /between 0 and 15/);
});

test("invalid estimates return zeroed display-safe totals", () => {
  const result = calculateEstimate({ ...defaults, finish: "unknown" });

  assert.equal(result.validation.valid, false);
  assert.equal(result.total, 0);
  assert.equal(result.unitPrice, 0);
});
