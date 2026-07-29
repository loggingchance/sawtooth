(function () {
  "use strict";

  const STORAGE_DRAFT_KEY = "sawtooth.estimateDraft.v2";
  const STORAGE_SCENARIOS_KEY = "sawtooth.savedScenarios.v2";

  const defaults = {
    facilityName: "Cascade Pallet & Lumber",
    productLine: "pallet_stock",
    annualInput: 240000,
    recoveryRate: 78,
    unit: "pallets",
    sellingPrice: 18,
    rawMaterialCost: 4.2,
    processingCost: 3.1,
    freightCost: 1.2,
    overheadCost: 0.85,
    contingency: 3,
    marketAdjustment: 1,
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

  function filenameSafe(value) {
    return String(value || "sawtooth-report")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "sawtooth-report";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function buildReportData(input, preparedDate) {
    const normalized = normalizeEstimate(input);
    const result = calculateEstimate(normalized);
    const unit = options.unit[normalized.unit] || "units";
    const product = options.productLine[normalized.productLine]?.label || normalized.productLine;
    const date = preparedDate || new Date().toLocaleDateString();
    const notes = normalized.notes.trim() || "No notes entered.";

    return {
      normalized,
      result,
      unit,
      product,
      date,
      notes,
      facilityName: normalized.facilityName || "Facility operating report",
      subtitle: `${product} - ${number(normalized.annualInput)} input units - ${number(normalized.recoveryRate)}% recovery`,
      rows: [
        ["Gross revenue", currency(result.grossRevenue)],
        ["Wood/fiber cost", currency(result.woodFiberCost)],
        ["Conversion cost", currency(result.conversionCost)],
        ["Freight cost", currency(result.freightCost)],
        ["Overhead cost", currency(result.overheadCost)],
        ["Risk reserve", currency(result.riskReserve)],
        ["Total cost", currency(result.totalCost)],
        ["Operating margin", currency(result.operatingMargin)],
        ["Margin rate", `${number(result.marginRate)}%`],
        ["Margin per unit", `${currency(result.marginPerUnit)} / ${unit}`],
        ["Break-even price", `${currency(result.breakEvenPrice)} / ${unit}`]
      ],
      csvRows: [
        ["Facility", normalized.facilityName],
        ["Product line", product],
        ["Prepared", date],
        ["Annual input volume", normalized.annualInput],
        ["Recovery or yield", `${normalized.recoveryRate}%`],
        ["Output unit", unit],
        ["Selling price", normalized.sellingPrice],
        ["Wood/fiber cost", normalized.rawMaterialCost],
        ["Processing cost", normalized.processingCost],
        ["Freight cost", normalized.freightCost],
        ["Overhead cost", normalized.overheadCost],
        ["Risk reserve", `${normalized.contingency}%`],
        ["Market adjustment", `${normalized.marketAdjustment}%`],
        ["Saleable volume", result.saleableVolume],
        ["Adjusted price", result.adjustedPrice],
        ["Gross revenue", result.grossRevenue],
        ["Total cost", result.totalCost],
        ["Operating margin", result.operatingMargin],
        ["Margin rate", `${result.marginRate}%`],
        ["Margin per unit", result.marginPerUnit],
        ["Break-even price", result.breakEvenPrice],
        ["Notes", notes]
      ]
    };
  }

  function buildCsv(report) {
    return report.csvRows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
  }

  function buildStandaloneReportHtml(report) {
    const tableRows = report.rows
      .map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join("");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.facilityName)} - Sawtooth Report</title>
  <style>
    body { margin: 0; background: #eef2ee; color: #17201b; font-family: Arial, sans-serif; }
    main { max-width: 900px; margin: 32px auto; background: #fff; padding: 40px; border: 1px solid #d8ded7; }
    .brand { color: #12483e; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 8px 0 6px; font-size: 32px; }
    .meta { color: #5e6a63; margin: 0 0 28px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 24px 0; }
    .kpis div { border: 1px solid #d8ded7; padding: 14px; }
    .kpis span { display: block; color: #5e6a63; font-size: 12px; font-weight: 700; }
    .kpis strong { display: block; margin-top: 8px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #d8ded7; padding: 10px 0; text-align: left; }
    td { text-align: right; font-weight: 700; }
    .notes { white-space: pre-wrap; line-height: 1.5; border: 1px solid #d8ded7; padding: 14px; }
    footer { display: flex; justify-content: space-between; margin-top: 28px; color: #5e6a63; font-size: 12px; }
    @media print { body { background: #fff; } main { margin: 0; max-width: none; border: 0; } }
  </style>
</head>
<body>
  <main>
    <p class="brand">Sawtooth</p>
    <h1>${escapeHtml(report.facilityName)}</h1>
    <p class="meta">${escapeHtml(report.subtitle)} | Prepared ${escapeHtml(report.date)}</p>
    <section class="kpis">
      <div><span>Operating margin</span><strong>${escapeHtml(currency(report.result.operatingMargin))}</strong></div>
      <div><span>Margin rate</span><strong>${escapeHtml(number(report.result.marginRate))}%</strong></div>
      <div><span>Break-even price</span><strong>${escapeHtml(currency(report.result.breakEvenPrice))} / ${escapeHtml(report.unit)}</strong></div>
      <div><span>Saleable volume</span><strong>${escapeHtml(number(report.result.saleableVolume))} ${escapeHtml(report.unit)}</strong></div>
    </section>
    <h2>Revenue And Cost Summary</h2>
    <table><tbody>${tableRows}</tbody></table>
    <h2>Notes And Assumptions</h2>
    <p class="notes">${escapeHtml(report.notes)}</p>
    <footer><span>Lumbermen OS</span><span>Sawtooth static prototype</span></footer>
  </main>
</body>
</html>`;
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

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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
    const reportModal = doc.getElementById("reportModal");
    const reportFields = {
      facility: doc.getElementById("reportFacility"),
      subtitle: doc.getElementById("reportSubtitle"),
      date: doc.getElementById("reportDate"),
      margin: doc.getElementById("reportMargin"),
      marginRate: doc.getElementById("reportMarginRate"),
      breakEven: doc.getElementById("reportBreakEven"),
      volume: doc.getElementById("reportVolume"),
      product: doc.getElementById("reportProduct"),
      inputVolume: doc.getElementById("reportInputVolume"),
      recovery: doc.getElementById("reportRecovery"),
      price: doc.getElementById("reportPrice"),
      grossRevenue: doc.getElementById("reportGrossRevenue"),
      woodCost: doc.getElementById("reportWoodCost"),
      conversionCost: doc.getElementById("reportConversionCost"),
      freightCost: doc.getElementById("reportFreightCost"),
      overheadCost: doc.getElementById("reportOverheadCost"),
      riskReserve: doc.getElementById("reportRiskReserve"),
      totalCost: doc.getElementById("reportTotalCost"),
      notes: doc.getElementById("reportNotes")
    };

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

    function populateReport() {
      const input = collectInput();
      const report = buildReportData(input);
      if (!report.result.validation.valid) {
        update();
        setStatus("Fix fields first");
        return null;
      }

      reportFields.facility.textContent = report.facilityName;
      reportFields.subtitle.textContent = report.subtitle;
      reportFields.date.textContent = report.date;
      reportFields.margin.textContent = currency(report.result.operatingMargin);
      reportFields.marginRate.textContent = `${number(report.result.marginRate)}%`;
      reportFields.breakEven.textContent = `${currency(report.result.breakEvenPrice)} / ${report.unit}`;
      reportFields.volume.textContent = `${number(report.result.saleableVolume)} ${report.unit}`;
      reportFields.product.textContent = report.product;
      reportFields.inputVolume.textContent = `${number(report.normalized.annualInput)} input units`;
      reportFields.recovery.textContent = `${number(report.normalized.recoveryRate)}%`;
      reportFields.price.textContent = `${currency(report.result.adjustedPrice)} / ${report.unit}`;
      reportFields.grossRevenue.textContent = currency(report.result.grossRevenue);
      reportFields.woodCost.textContent = currency(report.result.woodFiberCost);
      reportFields.conversionCost.textContent = currency(report.result.conversionCost);
      reportFields.freightCost.textContent = currency(report.result.freightCost);
      reportFields.overheadCost.textContent = currency(report.result.overheadCost);
      reportFields.riskReserve.textContent = currency(report.result.riskReserve);
      reportFields.totalCost.textContent = currency(report.result.totalCost);
      reportFields.notes.textContent = report.notes;
      return report;
    }

    function openReport() {
      const report = populateReport();
      if (!report) return;
      reportModal.hidden = false;
      doc.body.classList.add("report-open");
      doc.getElementById("printReport").focus();
    }

    function closeReport() {
      reportModal.hidden = true;
      doc.body.classList.remove("report-open");
      doc.getElementById("openReport").focus();
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
    doc.getElementById("openReport").addEventListener("click", openReport);
    doc.getElementById("closeReport").addEventListener("click", closeReport);
    doc.getElementById("printReport").addEventListener("click", () => {
      if (populateReport()) window.print();
    });
    doc.getElementById("downloadHtml").addEventListener("click", () => {
      const report = populateReport();
      if (!report) return;
      downloadFile(`${filenameSafe(report.facilityName)}-sawtooth-report.html`, buildStandaloneReportHtml(report), "text/html");
    });
    doc.getElementById("downloadCsv").addEventListener("click", () => {
      const report = populateReport();
      if (!report) return;
      downloadFile(`${filenameSafe(report.facilityName)}-sawtooth-report.csv`, buildCsv(report), "text/csv");
    });
    reportModal.addEventListener("click", (event) => {
      if (event.target === reportModal) closeReport();
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !reportModal.hidden) closeReport();
    });

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
      normalizeEstimate,
      buildReportData,
      buildCsv,
      buildStandaloneReportHtml
    };
  }
})();
