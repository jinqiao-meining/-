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

function transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

function multiplyMatrices(a, b) {
  return a.map(row =>
    b[0].map((_, colIndex) =>
      row.reduce((sum, value, rowIndex) => sum + value * b[rowIndex][colIndex], 0)
    )
  );
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function invertMatrix(matrix) {
  const n = matrix.length;
  const augmented = matrix.map((row, rowIndex) => [
    ...row.map(value => Number(value)),
    ...Array.from({ length: n }, (_, colIndex) => (rowIndex === colIndex ? 1 : 0))
  ]);

  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) < 1e-10) {
      throw new Error("矩阵不可逆，可能存在完全共线性，请减少解释变量或检查变量设定。");
    }

    if (maxRow !== pivot) {
      [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];
    }

    const pivotValue = augmented[pivot][pivot];
    for (let col = 0; col < augmented[pivot].length; col += 1) {
      augmented[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let col = 0; col < augmented[row].length; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  return augmented.map(row => row.slice(n));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildInterpretation({ dependentVar, regressors, coefficients, sampleSize, rSquared }) {
  const lines = [
    `本次基础回归共纳入 ${sampleSize} 个有效样本，因变量为 ${dependentVar}。`,
    `模型包含的解释变量为：${regressors.join("、")}。`,
    `当前模型的 R² 为 ${rSquared}，可用于初步判断样本内拟合程度。`
  ];

  const slopeTerms = coefficients.filter(item => item.variable !== "Intercept");
  if (slopeTerms.length) {
    const lead = slopeTerms[0];
    const direction = lead.coefficient >= 0 ? "正向" : "负向";
    lines.push(`在其他变量保持不变的线性框架下，${lead.variable} 与 ${dependentVar} 呈${direction}关联，系数约为 ${lead.coefficient}。`);
  }

  lines.push("该结果仅作为第六版原型中的基础 OLS 演示，正式研究仍应进一步补充显著性检验、稳健标准误、固定效应或内生性处理。");
  return lines;
}

function runRegression(filePath, roles = null) {
  const ext = path.extname(filePath).toLowerCase();
  if (![".csv", ".xlsx", ".xls"].includes(ext)) {
    return {
      supported: false,
      message: "当前仅支持 CSV、XLSX、XLS 文件进行基础回归。"
    };
  }

  if (!roles?.dependentVar) {
    return {
      supported: false,
      message: "请先在变量角色设定中选择因变量。"
    };
  }

  const regressors = [...new Set([...(roles.independentVars || []), ...(roles.controlVars || [])].filter(Boolean))];
  if (!regressors.length) {
    return {
      supported: false,
      message: "请至少选择一个核心解释变量或控制变量后再运行回归。"
    };
  }

  const parsed = parseWorkbook(filePath);
  const usableRows = parsed.rows.filter(row =>
    [roles.dependentVar, ...regressors].every(column => isNumericValue(row[column]))
  );

  const minSample = regressors.length + 2;
  if (usableRows.length < minSample) {
    return {
      supported: false,
      message: `有效样本不足。当前仅有 ${usableRows.length} 行完整观测，至少需要 ${minSample} 行。`
    };
  }

  const y = usableRows.map(row => toNumber(row[roles.dependentVar]));
  const x = usableRows.map(row => [1, ...regressors.map(column => toNumber(row[column]))]);

  try {
    const xt = transpose(x);
    const xtx = multiplyMatrices(xt, x);
    const xtxInv = invertMatrix(xtx);
    const xty = multiplyMatrixVector(xt, y);
    const beta = multiplyMatrixVector(xtxInv, xty).map(value => Number(value.toFixed(6)));
    const fitted = x.map(row => row.reduce((sum, value, index) => sum + value * beta[index], 0));
    const yMean = mean(y);
    const sse = y.reduce((sum, value, index) => sum + (value - fitted[index]) ** 2, 0);
    const sst = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
    const rSquared = sst === 0 ? 1 : 1 - sse / sst;

    const coefficients = ["Intercept", ...regressors].map((variable, index) => ({
      variable,
      coefficient: beta[index]
    }));

    return {
      supported: true,
      sheetName: parsed.sheetName,
      dependentVar: roles.dependentVar,
      regressors,
      sampleSize: usableRows.length,
      rSquared: Number(rSquared.toFixed(4)),
      coefficients,
      chartSuggestion: {
        type: "bar",
        title: "回归系数示意图",
        labels: coefficients.filter(item => item.variable !== "Intercept").map(item => item.variable),
        values: coefficients.filter(item => item.variable !== "Intercept").map(item => item.coefficient)
      },
      interpretationDraft: buildInterpretation({
        dependentVar: roles.dependentVar,
        regressors,
        coefficients,
        sampleSize: usableRows.length,
        rSquared: Number(rSquared.toFixed(4))
      })
    };
  } catch (error) {
    return {
      supported: false,
      message: error.message || "回归计算失败，请检查变量设定。"
    };
  }
}

module.exports = {
  runRegression
};
