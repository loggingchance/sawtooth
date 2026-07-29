(function () {
  "use strict";

  const STORAGE_DRAFT_KEY = "sawtooth.estimateDraft.v2";
  const STORAGE_SCENARIOS_KEY = "sawtooth.savedScenarios.v2";

  const defaults = {
    facilityName: "Sawtooth Mill",
    productLine: "grade_lumber",
    annualInput: 18000,
    recoveryRate: 62,
    unit: "MBF",
    sellingPrice: 540,
    rawMaterialCost: 245,
    processingCost: 118,
    freightCost: 36,
    overheadCost: 44,
    contingency: 4,
    marketAdjustment: 3,
    notes: ""
  };

  const emptyEstimate = {
    facilityName: "",
    productLine: "grade_lumber",
    annualInput: "",
    recoveryRate: "",
    unit: "MBF",
    sellingPrice: "",
    rawMaterialCost: "",
    processingCost: "",
    freightCost: "",
    overheadCost: "",
    contingency: "",
    marketAdjustment: "",
    notes: ""
  };

  const options = {
    productLine: {
      grade_lumber: { label: "Grade lumber", factor: 1 },
      pallet_stock: { label: "Pallet stock", factor: 0.82 },
      firewood: { label: "Firewood", factor: 0.58 },
      railroad_ties: { label: "Railroad ties", factor: 1.08 },
      pellets: { label: "Pellets", factor: 0.74 }
    },
    unit: {
      MBF: "MBF",
      cords: "cords",
      tons: "tons",
      pallets: "pallets",
      ties: "ties"
    }
  };

  const fieldRules = {
    facilityName: { type: "text", required: true, label: "Facility name" },
    productLine: { type: "choice", choices: Object.keys(options.productLine), label: "Product line" },
    annualInput: { type: "number", min: 1, max: 10000000, label: "Annual input volume" },
    recoveryRate: { type: "number", min: 1, max: 100, label: "Recovery or yield" },
    unit: { type: "choice", choices: Object.keys(options.unit), label: "Unit" },
    sellingPrice: { type: "number", min: 0, max: 100000, label: "Selling price" },
    rawMaterialCost: { type: "number", min: 0, max: 100000, label: "Wood/fiber cost" },
    processingCost: { type: "number", min: 0, max: 100000, label: "Processing cost" },
    freightCost: { type: "number", min: 0, max: 100000, label: "Freight cost" },
    overheadCost: { type: "number", min: 0, max: 100000, label: "Overhead cost" },
    contingency: { type: "number", min: 0, max: 35, label: "Risk reserve" },
    marketAdjustment: { type: "number", min: -50, max: 50, label: "Market adjustment" }
  };

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function roundVolume(value) {
    return Math.round((value + Number.EPSILON) * 10) / 10;
  }

  function currency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  function number(value) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 1
    }).format(value || 0);
  }

  function validateEstimate(input) {
    const errors = {};

    Object.entries(fieldRules).forEach(([key, rule]) => {
      const raw = input[key];
      if (rule.type === "text") {
        if (rule.required && !String(raw || "").trim()) {
          errors[key] = `${rule.label} is required.`;
        }
        return;
      }

      if (rule.type === "choice") {
        if (!rule.choices.includes(String(raw))) {
          errors[key] = `Choose a valid ${rule.label.toLowerCase()}.`;
        }
        return;
      }

      const value = Number(raw);
      if (raw === "" || raw === null || raw === undefined) {
        errors[key] = `${rule.label} is required.`;
      } else if (!Number.isFinite(value)) {
        errors[key] = `${rule.label} must be a number.`;
      } else if (value < rule.min || value > rule.max) {
        errors[key] = `${rule.label} must be between ${rule.min} and ${rule.max}.`;
      }
    });

    return { valid: Object.keys(errors).length === 0, errors };
  }

  function normalizeEstimate(input) {
    const numberValue = (key) => {
      const raw = input[key];
      return raw === "" || raw === null || raw === undefined ? "" : Number(raw);
    };

    return {
      facilityName: String(input.facilityName || "").trim(),
      productLine: String(input.productLine),
      annualInput: numberValue("annualInput"),
      recoveryRate: numberValue("recoveryRate"),
      unit: String(input.unit),
      sellingPrice: numberValue("sellingPrice"),
      rawMaterialCost: numberValue("rawMaterialCost"),
      processingCost: numberValue("processingCost"),
      freightCost: numberValue("freightCost"),
      overheadCost: numberValue("overheadCost"),
      contingency: numberValue("contingency"),
      marketAdjustment: numberValue("marketAdjustment"),
      notes: String(input.notes || "")
    };
  }

  function zeroResult(validation) {
    return {
      validation,
      saleableVolume: 0,
      adjustedPrice: 0,
      grossRevenue: 0,
      woodFiberCost: 0,
      conversionCost: 0,
      freightCost: 0,
      overheadCost: 0,
      riskReserve: 0,
      totalCost: 0,
      operatingMargin: 0,
      marginRate: 0,
      marginPerUnit: 0,
      breakEvenPrice: 0
    };
  }

  function calculateEstimate(input) {
    const estimate = normalizeEstimate(input);
    const validation = validateEstimate(estimate);

    if (!validation.valid) {
      return zeroResult(validation);
    }

    const productFactor = options.productLine[estimate.productLine].factor;
    const saleableVolume = roundVolume(estimate.annualInput * (estimate.recoveryRate / 100));
    const adjustedPrice = roundMoney(estimate.sellingPrice * productFactor * (1 + estimate.marketAdjustment / 100));
    const grossRevenue = roundMoney(saleableVolume * adjustedPrice);
    const woodFiberCost = roundMoney(estimate.annualInput * estimate.rawMaterialCost);
    const conversionCost = roundMoney(saleableVolume * estimate.processingCost);
    const freightCost = roundMoney(saleableVolume * estimate.freightCost);
    const overheadCost = roundMoney(saleableVolume * estimate.overheadCost);
    const operatingCost = roundMoney(woodFiberCost + conversionCost + freightCost + overheadCost);
    const riskReserve = roundMoney(operatingCost * (estimate.contingency / 100));
    const totalCost = roundMoney(operatingCost + riskReserve);
    const operatingMargin = roundMoney(grossRevenue - totalCost);
    const marginRate = grossRevenue === 0 ? 0 : roundMoney((operatingMargin / grossRevenue) * 100);
    const marginPerUnit = saleableVolume === 0 ? 0 : roundMoney(operatingMargin / saleableVolume);
    const breakEvenPrice = saleableVolume === 0 ? 0 : roundMoney(totalCost / saleableVolume);

    return {
      validation,
      saleableVolume,
      adjustedPrice,
      grossRevenue,
      woodFiberCost,
      conversionCost,
      freightCost,
      overheadCost,
      riskReserve,
      totalCost,
      operatingMargin,
      marginRate,
      marginPerUnit,
      breakEvenPrice
    };
  }

  function readStored(key, fallback) {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStored(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function removeStored(key) {
    window.localStorage.removeItem(key);
  }

  function setupApp(documentRef) {
    const doc = documentRef || document;
    const form = doc.getElementById("estimateForm");
    if (!form) return;

    const ids = Object.keys(defaults);
    const elements = Object.fromEntries(ids.map((id) => [id, doc.getElementById(id)]));
    const outputs = {
      operatingMargin: doc.getElementById("operatingMargin"),
      grossRevenue: doc.getElementById("grossRevenue"),
      totalCost: doc.getElementById("totalCost"),
      saleableVolume: doc.getElementById("saleableVolume"),
      adjustedPrice: doc.getElementById("adjustedPrice"),
      woodFiberCost: doc.getElementById("woodFiberCost"),
      conversionCost: doc.getElementById("conversionCost"),
      freightCost: doc.getElementById("freightCost"),
      overheadCost: doc.getElementById("overheadCost"),
      riskReserve: doc.getElementById("riskReserve"),
      marginRate: doc.getElementById("marginRate"),
      marginPerUnit: doc.getElementById("marginPerUnit"),
      breakEvenPrice: doc.getElementById("breakEvenPrice")
    };
    const validationSummary = doc.getElementById("validationSummary");
    const saveStatus = doc.getElementById("saveStatus");
    const scenarioList = doc.getElementById("scenarioList");
    const scenarioTemplate = doc.getElementById("scenarioTemplate");

    function collectInput() {
      return Object.fromEntries(ids.map((id) => [id, elements[id].value]));
    }

    function currentUnit(input) {
      return options.unit[input.unit] || "units";
    }

    function loadInput(values) {
      ids.forEach((id) => {
        elements[id].value = values[id] ?? "";
      });
      update();
    }

    function resetEstimate() {
      removeStored(STORAGE_DRAFT_KEY);
      loadInput(emptyEstimate);
      setStatus("Reset");
    }

    function setStatus(message) {
      saveStatus.textContent = message;
      window.clearTimeout(setStatus.timer);
      setStatus.timer = window.setTimeout(() => {
        saveStatus.textContent = "Ready";
      }, 1800);
    }

    function updateErrors(errors) {
      Object.keys(fieldRules).forEach((id) => {
        const target = doc.querySelector(`[data-error-for="${id}"]`);
        if (target) target.textContent = errors[id] || "";
      });
    }

    function update() {
      const input = collectInput();
      const unit = currentUnit(input);
      const result = calculateEstimate(input);
      updateErrors(result.validation.errors);
      validationSummary.textContent = result.validation.valid ? "Valid" : "Needs fixes";
      validationSummary.classList.toggle("valid", result.validation.valid);
      validationSummary.classList.toggle("invalid", !result.validation.valid);

      outputs.operatingMargin.textContent = currency(result.operatingMargin);
      outputs.grossRevenue.textContent = currency(result.grossRevenue);
      outputs.totalCost.textContent = currency(result.totalCost);
      outputs.saleableVolume.textContent = `${number(result.saleableVolume)} ${unit}`;
      outputs.adjustedPrice.textContent = `${currency(result.adjustedPrice)} / ${unit}`;
      outputs.woodFiberCost.textContent = currency(result.woodFiberCost);
      outputs.conversionCost.textContent = currency(result.conversionCost);
      outputs.freightCost.textContent = currency(result.freightCost);
      outputs.overheadCost.textContent = currency(result.overheadCost);
      outputs.riskReserve.textContent = currency(result.riskReserve);
      outputs.marginRate.textContent = `${number(result.marginRate)}%`;
      outputs.marginPerUnit.textContent = `${currency(result.marginPerUnit)} / ${unit}`;
      outputs.breakEvenPrice.textContent = `${currency(result.breakEvenPrice)} / ${unit}`;

      writeStored(STORAGE_DRAFT_KEY, input);
    }

    function renderScenarios() {
      const scenarios = readStored(STORAGE_SCENARIOS_KEY, []);
      scenarioList.innerHTML = "";

      if (!scenarios.length) {
        const empty = doc.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No saved facility runs yet.";
        scenarioList.appendChild(empty);
        return;
      }

      scenarios.forEach((scenario) => {
        const item = scenarioTemplate.content.firstElementChild.cloneNode(true);
        const loadButton = item.querySelector(".scenario-load");
        const deleteButton = item.querySelector(".scenario-delete");
        loadButton.innerHTML = `<strong>${scenario.facilityName}</strong><span>${scenario.productLabel} - ${currency(scenario.margin)} margin - ${scenario.savedAt}</span>`;
        loadButton.addEventListener("click", () => loadInput(scenario.input));
        deleteButton.addEventListener("click", () => {
          writeStored(
            STORAGE_SCENARIOS_KEY,
            scenarios.filter((entry) => entry.id !== scenario.id)
          );
          renderScenarios();
          setStatus("Deleted");
        });
        scenarioList.appendChild(item);
      });
    }

    form.addEventListener("input", update);
    doc.getElementById("saveDraft").addEventListener("click", () => {
      writeStored(STORAGE_DRAFT_KEY, collectInput());
      setStatus("Draft saved");
    });
    doc.getElementById("saveScenario").addEventListener("click", () => {
      const input = collectInput();
      const result = calculateEstimate(input);
      if (!result.validation.valid) {
        update();
        setStatus("Fix fields first");
        return;
      }
      const normalized = normalizeEstimate(input);
      const scenarios = readStored(STORAGE_SCENARIOS_KEY, []);
      scenarios.unshift({
        id: `${Date.now()}`,
        facilityName: normalized.facilityName,
        productLabel: options.productLine[normalized.productLine].label,
        margin: result.operatingMargin,
        input,
        savedAt: new Date().toLocaleDateString()
      });
      writeStored(STORAGE_SCENARIOS_KEY, scenarios.slice(0, 8));
      renderScenarios();
      setStatus("Scenario saved");
    });
    doc.getElementById("clearScenarios").addEventListener("click", () => {
      writeStored(STORAGE_SCENARIOS_KEY, []);
      renderScenarios();
      setStatus("Cleared");
    });
    doc.getElementById("loadSample").addEventListener("click", () => {
      loadInput(defaults);
      setStatus("Sample loaded");
    });
    doc.getElementById("resetEstimate").addEventListener("click", resetEstimate);
    doc.getElementById("printEstimate").addEventListener("click", () => window.print());

    loadInput(readStored(STORAGE_DRAFT_KEY, defaults));
    renderScenarios();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => setupApp(document));
  }

  if (typeof module !== "undefined") {
    module.exports = {
      STORAGE_DRAFT_KEY,
      STORAGE_SCENARIOS_KEY,
      defaults,
      emptyEstimate,
      options,
      validateEstimate,
      calculateEstimate,
      normalizeEstimate
    };
  }
})();
