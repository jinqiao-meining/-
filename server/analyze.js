const path = require("path");
const XLSX = require("xlsx");

function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  return {
    sheetName: firstSheet,
    rows
  };
}

function isNumericValue(value) {
  if (value === null || value === "" || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return false;
    return !Number.isNaN(Number(normalized));
  }
  return false;
}

function toNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value).replace(/,/g, "").trim());
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function summarizeNumeric(values) {
  const clean = values.filter(isNumericValue).map(toNumber).sort((a, b) => a - b);
  if (!clean.length) return null;
  const sum = clean.reduce((acc, value) => acc + value, 0);
  const mean = sum / clean.length;
  const variance = clean.reduce((acc, value) => acc + (value - mean) ** 2, 0) / clean.length;
  return {
    count: clean.length,
    mean: Number(mean.toFixed(4)),
    median: Number(percentile(clean, 0.5).toFixed(4)),
    min: Number(clean[0].toFixed(4)),
    max: Number(clean[clean.length - 1].toFixed(4)),
    std: Number(Math.sqrt(variance).toFixed(4)),
    p25: Number(percentile(clean, 0.25).toFixed(4)),
    p75: Number(percentile(clean, 0.75).toFixed(4))
  };
}

function summarizeCategorical(values) {
  const counts = new Map();
  values
    .filter(value => value !== null && value !== "" && value !== undefined)
    .forEach(value => {
      const key = String(value);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));
}

function detectColumns(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map(name => {
    const values = rows.map(row => row[name]);
    const numericCount = values.filter(isNumericValue).length;
    const nonNullCount = values.filter(value => value !== null && value !== "" && value !== undefined).length;
    const uniqueCount = new Set(values.filter(value => value !== null && value !== "" && value !== undefined).map(value => String(value))).size;
    const ratio = nonNullCount ? numericCount / nonNullCount : 0;
    const inferredType = ratio > 0.8 ? "numeric" : uniqueCount <= 12 ? "categorical" : "text";
    return {
      name,
      inferredType,
      nonNullCount,
      missingCount: rows.length - nonNullCount,
      uniqueCount
    };
  });
}

function buildDescriptiveTable(rows, selectedColumns) {
  return selectedColumns.map(column => {
    const stats = summarizeNumeric(rows.map(row => row[column]));
    return {
      variable: column,
      ...stats
    };
  }).filter(item => item.count);
}

function buildInterpretation({ roles, descriptiveTable, chartSuggestions, rowCount }) {
  const dep = roles?.dependentVar || "因变量";
  const indep = (roles?.independentVars || []).join("、") || "核心解释变量";
  const controls = (roles?.controlVars || []).join("、");
  const lines = [
    `当前样本共 ${rowCount} 行，平台已生成基础描述统计。`,
    `建议将 ${dep} 作为核心结果变量，将 ${indep} 作为重点解释对象。`
  ];

  if (controls) {
    lines.push(`控制变量初步可考虑纳入：${controls}。`);
  }

  if (descriptiveTable.length) {
    const lead = descriptiveTable[0];
    lines.push(`从描述统计看，${lead.variable} 的均值为 ${lead.mean}，标准差为 ${lead.std}，说明变量存在一定离散性。`);
  }

  if (chartSuggestions.length) {
    lines.push(`建议优先查看“${chartSuggestions[0].title}”，用来判断样本结构和变量尺度是否合理。`);
  }

  lines.push("正式写作时，应结合变量定义、样本选择和识别策略，对这些统计结果进行经济学意义解释。");
  return lines;
}

function profileRows(rows, roles = null) {
  if (!rows.length) {
    return {
      rowCount: 0,
      columns: [],
      numericSummaries: [],
      categoricalSummaries: [],
      chartSuggestions: [],
      descriptiveTable: [],
      interpretationDraft: []
    };
  }

  const columns = detectColumns(rows);
  const numericSummaries = columns
    .filter(column => column.inferredType === "numeric")
    .slice(0, 8)
    .map(column => ({
      column: column.name,
      stats: summarizeNumeric(rows.map(row => row[column.name]))
    }))
    .filter(item => item.stats);

  const categoricalSummaries = columns
    .filter(column => column.inferredType === "categorical")
    .slice(0, 4)
    .map(column => ({
      column: column.name,
      topValues: summarizeCategorical(rows.map(row => row[column.name]))
    }));

  const chartSuggestions = [];
  if (numericSummaries.length) {
    chartSuggestions.push({
      type: "bar",
      title: `数值变量均值比较：${numericSummaries.slice(0, 5).map(item => item.column).join(" / ")}`,
      labels: numericSummaries.slice(0, 5).map(item => item.column),
      values: numericSummaries.slice(0, 5).map(item => item.stats.mean)
    });
  }

  if (categoricalSummaries.length) {
    const top = categoricalSummaries[0];
    chartSuggestions.push({
      type: "bar",
      title: `分类变量频数：${top.column}`,
      labels: top.topValues.map(item => item.label),
      values: top.topValues.map(item => item.count)
    });
  }

  let selectedColumns = numericSummaries.slice(0, 4).map(item => item.column);
  if (roles) {
    const roleColumns = [
      roles.dependentVar,
      ...(roles.independentVars || []),
      ...(roles.controlVars || [])
    ].filter(Boolean);
    const numericRoleColumns = roleColumns.filter(col => columns.find(item => item.name === col && item.inferredType === "numeric"));
    if (numericRoleColumns.length) {
      selectedColumns = [...new Set(numericRoleColumns)];
    }
  }

  const descriptiveTable = buildDescriptiveTable(rows, selectedColumns);

  return {
    rowCount: rows.length,
    columns,
    numericSummaries,
    categoricalSummaries,
    chartSuggestions,
    descriptiveTable,
    interpretationDraft: buildInterpretation({
      roles,
      descriptiveTable,
      chartSuggestions,
      rowCount: rows.length
    })
  };
}

function analyzeFile(filePath, roles = null) {
  const ext = path.extname(filePath).toLowerCase();
  if (![".csv", ".xlsx", ".xls"].includes(ext)) {
    return {
      supported: false,
      message: "当前仅支持 CSV、XLSX、XLS 文件自动分析。"
    };
  }

  const parsed = parseWorkbook(filePath);
  return {
    supported: true,
    sheetName: parsed.sheetName,
    ...profileRows(parsed.rows, roles)
  };
}

module.exports = {
  analyzeFile
};
