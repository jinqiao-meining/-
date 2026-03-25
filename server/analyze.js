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

function summarizeNumeric(values) {
  const clean = values.filter(isNumericValue).map(toNumber).sort((a, b) => a - b);
  if (!clean.length) return null;
  const sum = clean.reduce((acc, value) => acc + value, 0);
  const mean = sum / clean.length;
  const median = clean[Math.floor(clean.length / 2)];
  const min = clean[0];
  const max = clean[clean.length - 1];
  const variance = clean.reduce((acc, value) => acc + (value - mean) ** 2, 0) / clean.length;
  return {
    count: clean.length,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    std: Number(Math.sqrt(variance).toFixed(4))
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

function profileRows(rows) {
  if (!rows.length) {
    return {
      rowCount: 0,
      columns: [],
      numericSummaries: [],
      categoricalSummaries: [],
      chartSuggestions: []
    };
  }

  const columns = Object.keys(rows[0]).map(name => {
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

  const numericSummaries = columns
    .filter(column => column.inferredType === "numeric")
    .slice(0, 6)
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
      title: `数值变量均值比较：${numericSummaries.map(item => item.column).join(" / ")}`,
      labels: numericSummaries.map(item => item.column),
      values: numericSummaries.map(item => item.stats.mean)
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

  return {
    rowCount: rows.length,
    columns,
    numericSummaries,
    categoricalSummaries,
    chartSuggestions
  };
}

function analyzeFile(filePath) {
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
    ...profileRows(parsed.rows)
  };
}

module.exports = {
  analyzeFile
};
