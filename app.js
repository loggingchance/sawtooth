(function () {
  "use strict";

  const STORAGE_DRAFT_KEY = "sawtooth.estimateDraft.v1";
  const STORAGE_SCENARIOS_KEY = "sawtooth.savedScenarios.v1";

  const defaults = {
    projectName: "Sawtooth Ridge Concept",
    clientName: "Acme Development",
    area: 6400,
    baseRate: 18.5,
    complexity: "standard",
    finish: "durable",
    crewSize: 5,
    workDays: 12,
    laborRate: 68,
    contingency: 10,
    taxRate: 6.1,
    mobilization: 2500,
    notes: ""
  };

  const emptyEstimate = {
    projectName: "",
    clientName: "",
    area: "",
    baseRate: "",
    complexity: "standard",
    finish: "durable",
    crewSize: "",
    workDays: "",
    laborRate: "",
    contingency: "",
    taxRate: "",
    mobilization: "",
    notes: ""
  };

  const options = {
    complexity: {
      simple: 0.95,
      standard: 1,
      technical: 1.18,
      extreme: 1.35
    },
    finish: {
      essential: 0.9,
      durable: 1,
      premium: 1.22
    }
  };

  const fieldRules = {
    projectName: { type: "text", required: true, label: "Project name" },
    clientName: { type: "text", required: true, label: "Client" },
    area: { type: "number", min: 50, max: 250000, label: "Area" },
    baseRate: { type: "number", min: 1, max: 500, label: "Base rate" },
    complexity: { type: "choice", choices: Object.keys(options.complexity), label: "Complexity" },
    finish: { type: "choice", choices: Object.keys(options.finish), label: "Finish package" },
    crewSize: { type: "integer", min: 1, max: 24, label: "Crew size" },
    workDays: { type: "integer", min: 1, max: 180, label: "Work days" },
    laborRate: { type: "number", min: 15, max: 300, label: "Labor rate" },
    contingency: { type: "number", min: 0, max: 35, label: "Contingency" },
    taxRate: { type: "number", min: 0, max: 15, label: "Tax rate" },
    mobilization: { type: "number", min: 0, max: 100000, label: "Mobilization" }
  };

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function currency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
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
      } else if (rule.type === "integer" && !Number.isInteger(value)) {
        errors[key] = `${rule.label} must be a whole number.`;
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
      projectName: String(input.projectName || "").trim(),
      clientName: String(input.clientName || "").trim(),
      area: numberValue("area"),
      baseRate: numberValue("baseRate"),
      complexity: String(input.complexity),
      finish: String(input.finish),
      crewSize: numberValue("crewSize"),
      workDays: numberValue("workDays"),
      laborRate: numberValue("laborRate"),
      contingency: numberValue("contingency"),
      taxRate: numberValue("taxRate"),
      mobilization: numberValue("mobilization"),
      notes: String(input.notes || "")
    };
  }

  function calculateEstimate(input) {
    const estimate = normalizeEstimate(input);
    const validation = validateEstimate(estimate);

    if (!validation.valid) {
      return {
        validation,
        materials: 0,
        labor: 0,
        mobilization: 0,
        subtotal: 0,
        contingencyCost: 0,
        taxableSubtotal: 0,
        tax: 0,
        total: 0,
        unitPrice: 0,
        duration: 0
      };
    }

    const complexityFactor = options.complexity[estimate.complexity];
    const finishFactor = options.finish[estimate.finish];
    const materials = roundMoney(estimate.area * estimate.baseRate * complexityFactor * finishFactor);
    const labor = roundMoney(estimate.crewSize * estimate.workDays * 8 * estimate.laborRate);
    const mobilization = roundMoney(estimate.mobilization);
    const subtotal = roundMoney(materials + labor + mobilization);
    const contingencyCost = roundMoney(subtotal * (estimate.contingency / 100));
    const taxableSubtotal = roundMoney(subtotal + contingencyCost);
    const tax = roundMoney(taxableSubtotal * (estimate.taxRate / 100));
    const total = roundMoney(taxableSubtotal + tax);
    const unitPrice = roundMoney(total / estimate.area);
    const duration = Math.ceil(estimate.workDays * (complexityFactor > 1 ? complexityFactor : 1));

    return {
      validation,
      materials,
      labor,
      mobilization,
      subtotal,
      contingencyCost,
      taxableSubtotal,
      tax,
      total,
      unitPrice,
      duration
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
      totalEstimate: doc.getElementById("totalEstimate"),
      materialsCost: doc.getElementById("materialsCost"),
      laborCost: doc.getElementById("laborCost"),
      mobilizationCost: doc.getElementById("mobilizationCost"),
      subtotal: doc.getElementById("subtotal"),
      contingencyCost: doc.getElementById("contingencyCost"),
      taxCost: doc.getElementById("taxCost"),
      duration: doc.getElementById("duration"),
      unitPrice: doc.getElementById("unitPrice")
    };
    const validationSummary = doc.getElementById("validationSummary");
    const saveStatus = doc.getElementById("saveStatus");
    const scenarioList = doc.getElementById("scenarioList");
    const scenarioTemplate = doc.getElementById("scenarioTemplate");

    function collectInput() {
      return Object.fromEntries(ids.map((id) => [id, elements[id].value]));
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
      const result = calculateEstimate(input);
      updateErrors(result.validation.errors);
      validationSummary.textContent = result.validation.valid ? "Valid" : "Needs fixes";
      validationSummary.classList.toggle("valid", result.validation.valid);
      validationSummary.classList.toggle("invalid", !result.validation.valid);

      outputs.totalEstimate.textContent = currency(result.total);
      outputs.materialsCost.textContent = currency(result.materials);
      outputs.laborCost.textContent = currency(result.labor);
      outputs.mobilizationCost.textContent = currency(result.mobilization);
      outputs.subtotal.textContent = currency(result.subtotal);
      outputs.contingencyCost.textContent = currency(result.contingencyCost);
      outputs.taxCost.textContent = currency(result.tax);
      outputs.duration.textContent = `${result.duration} days`;
      outputs.unitPrice.textContent = `${currency(result.unitPrice)} / sq ft`;

      writeStored(STORAGE_DRAFT_KEY, input);
    }

    function renderScenarios() {
      const scenarios = readStored(STORAGE_SCENARIOS_KEY, []);
      scenarioList.innerHTML = "";

      if (!scenarios.length) {
        const empty = doc.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No saved estimates yet.";
        scenarioList.appendChild(empty);
        return;
      }

      scenarios.forEach((scenario) => {
        const item = scenarioTemplate.content.firstElementChild.cloneNode(true);
        const loadButton = item.querySelector(".scenario-load");
        const deleteButton = item.querySelector(".scenario-delete");
        loadButton.innerHTML = `<strong>${scenario.projectName}</strong><span>${scenario.clientName} - ${currency(scenario.total)} - ${scenario.savedAt}</span>`;
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
      const scenarios = readStored(STORAGE_SCENARIOS_KEY, []);
      scenarios.unshift({
        id: `${Date.now()}`,
        projectName: normalizeEstimate(input).projectName,
        clientName: normalizeEstimate(input).clientName,
        total: result.total,
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
