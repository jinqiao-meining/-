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

function normalCdf(value) {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * abs);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs);
  return 0.5 * (1 + sign * erf);
}

function pValueFromT(tStat) {
  const probability = 2 * (1 - normalCdf(Math.abs(tStat)));
  return Math.max(0, Math.min(1, probability));
}

function significanceStars(pValue) {
  if (pValue < 0.01) return "***";
  if (pValue < 0.05) return "**";
  if (pValue < 0.1) return "*";
  return "";
}

function winsorizeRows(rows, columns, tailProbability) {
  if (!tailProbability || tailProbability <= 0) {
    return {
      rows,
      notes: ["未进行缩尾处理。"]
    };
  }

  const thresholds = {};
  columns.forEach(column => {
    const values = rows
      .map(row => row[column])
      .filter(isNumericValue)
      .map(toNumber)
      .sort((a, b) => a - b);
    if (!values.length) return;
    thresholds[column] = {
      lower: percentile(values, tailProbability),
      upper: percentile(values, 1 - tailProbability)
    };
  });

  const processedRows = rows.map(row => {
    const nextRow = { ...row };
    columns.forEach(column => {
      if (!thresholds[column] || !isNumericValue(row[column])) return;
      const numericValue = toNumber(row[column]);
      nextRow[column] = Math.min(Math.max(numericValue, thresholds[column].lower), thresholds[column].upper);
    });
    return nextRow;
  });

  return {
    rows: processedRows,
    notes: [`已对 ${columns.join("、")} 执行双侧 ${tailProbability * 100}% 缩尾处理。`]
  };
}

function pickTopGroups(rows, groupVar) {
  const counts = new Map();
  rows.forEach(row => {
    const value = row[groupVar];
    if (value === null || value === undefined || value === "") return;
    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => label);
}

function buildInterpretation({ dependentVar, regressors, coefficients, sampleSize, rSquared, suiteResults, preprocessingNotes, subgroupResults }) {
  const lines = [
    `本次基础回归共纳入 ${sampleSize} 个有效样本，因变量为 ${dependentVar}。`,
    `模型包含的解释变量为：${regressors.join("、")}。`,
    `当前模型的 R² 为 ${rSquared}，可用于初步判断样本内拟合程度。`
  ];

  preprocessingNotes?.forEach(note => lines.push(note));

  const slopeTerms = coefficients.filter(item => item.variable !== "Intercept");
  if (slopeTerms.length) {
    const lead = slopeTerms[0];
    const direction = lead.coefficient >= 0 ? "正向" : "负向";
    const significance = lead.stars ? `，并在当前近似检验下呈现 ${lead.stars} 水平` : "";
    lines.push(`在其他变量保持不变的线性框架下，${lead.variable} 与 ${dependentVar} 呈${direction}关联，系数约为 ${lead.coefficient}${significance}。`);
  }

  if (suiteResults?.length > 1) {
    const baseline = suiteResults[0];
    const compare = suiteResults[1];
    const baseLead = baseline.coefficients.find(item => item.variable === regressors[0]);
    const compareLead = compare.coefficients.find(item => item.variable === regressors[0]);
    if (baseLead && compareLead) {
      lines.push(`在稳健性对照中，${regressors[0]} 的系数由 ${baseline.label} 下的 ${baseLead.coefficient} 变为 ${compare.label} 下的 ${compareLead.coefficient}，可用于初步比较控制变量纳入前后的变化。`);
    }
  }

  if (subgroupResults?.length) {
    const firstSubgroup = subgroupResults[0];
    const firstCoef = firstSubgroup.coefficients.find(item => item.variable === regressors[0]);
    if (firstCoef) {
      lines.push(`异质性比较中，${firstSubgroup.groupLabel} 组下 ${regressors[0]} 的系数约为 ${firstCoef.coefficient}，建议与其他组继续做机制解释。`);
    }
  }

  lines.push("该结果仍属于平台第八版中的基础 OLS 演示，正式研究建议继续补充稳健标准误、固定效应、内生性识别、异质性机制和更完整的稳健性检验。");
  return lines;
}

function runSpecification(rows, dependentVar, regressors, label) {
  const usableRows = rows.filter(row =>
    [dependentVar, ...regressors].every(column => isNumericValue(row[column]))
  );
  const minSample = regressors.length + 2;
  if (usableRows.length < minSample) {
    throw new Error(`规格“${label}”有效样本不足。当前仅有 ${usableRows.length} 行完整观测，至少需要 ${minSample} 行。`);
  }

  const y = usableRows.map(row => toNumber(row[dependentVar]));
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
    const degreesOfFreedom = usableRows.length - x[0].length;
    const sigmaSquared = degreesOfFreedom > 0 ? sse / degreesOfFreedom : 0;
    const varianceBeta = xtxInv.map(row => row.map(value => value * sigmaSquared));

    const coefficients = ["Intercept", ...regressors].map((variable, index) => ({
      variable,
      coefficient: beta[index],
      stdError: Number(Math.sqrt(Math.max(varianceBeta[index][index], 0)).toFixed(6)),
      tStat: 0,
      pValue: 1,
      stars: ""
    }));

    coefficients.forEach(item => {
      item.tStat = item.stdError ? Number((item.coefficient / item.stdError).toFixed(4)) : 0;
      item.pValue = Number(pValueFromT(item.tStat).toFixed(4));
      item.stars = significanceStars(item.pValue);
    });

    return {
      label,
      dependentVar,
      regressors,
      sampleSize: usableRows.length,
      degreesOfFreedom,
      rSquared: Number(rSquared.toFixed(4)),
      adjustedRSquared: degreesOfFreedom > 0 && usableRows.length > 1
        ? Number((1 - (1 - rSquared) * ((usableRows.length - 1) / degreesOfFreedom)).toFixed(4))
        : null,
      coefficients
    };
  } catch (error) {
    throw new Error(error.message || `规格“${label}”回归计算失败。`);
  }
}

function runRegression(filePath, roles = null, options = {}) {
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

  const coreRegressors = [...new Set([...(roles.independentVars || [])].filter(Boolean))];
  const controlRegressors = [...new Set([...(roles.controlVars || [])].filter(Boolean))];
  const regressors = [...new Set([...coreRegressors, ...controlRegressors])];
  if (!regressors.length) {
    return {
      supported: false,
      message: "请至少选择一个核心解释变量或控制变量后再运行回归。"
    };
  }

  const parsed = parseWorkbook(filePath);
  try {
    const winsorizeTail = Number(options.winsorizeTail || 0);
    const preprocessing = winsorizeRows(parsed.rows, [roles.dependentVar, ...regressors], winsorizeTail);
    const workingRows = preprocessing.rows;
    const preprocessingNotes = preprocessing.notes;

    const baseline = runSpecification(workingRows, roles.dependentVar, regressors, "基准规格");
    const suiteResults = [baseline];
    if (coreRegressors.length && controlRegressors.length) {
      suiteResults.push(runSpecification(workingRows, roles.dependentVar, coreRegressors, "不含控制变量"));
    }

    const subgroupResults = [];
    const subgroupEnabled = String(options.subgroupEnabled || "") === "true";
    if (subgroupEnabled && roles.groupVar) {
      const topGroups = pickTopGroups(workingRows, roles.groupVar);
      topGroups.forEach(groupLabel => {
        const subgroupRows = workingRows.filter(row => String(row[roles.groupVar]) === groupLabel);
        try {
          const result = runSpecification(subgroupRows, roles.dependentVar, regressors, `${roles.groupVar}=${groupLabel}`);
          subgroupResults.push({
            ...result,
            groupVar: roles.groupVar,
            groupLabel
          });
        } catch {
          // Skip subgroups without enough observations.
        }
      });
    }

    return {
      supported: true,
      sheetName: parsed.sheetName,
      dependentVar: roles.dependentVar,
      regressors,
      sampleSize: baseline.sampleSize,
      degreesOfFreedom: baseline.degreesOfFreedom,
      rSquared: baseline.rSquared,
      adjustedRSquared: baseline.adjustedRSquared,
      coefficients: baseline.coefficients,
      preprocessingNotes,
      suiteResults,
      subgroupResults,
      chartSuggestion: {
        type: "bar",
        title: "回归系数示意图",
        labels: baseline.coefficients.filter(item => item.variable !== "Intercept").map(item => item.variable),
        values: baseline.coefficients.filter(item => item.variable !== "Intercept").map(item => item.coefficient)
      },
      interpretationDraft: buildInterpretation({
        dependentVar: roles.dependentVar,
        regressors,
        coefficients: baseline.coefficients,
        sampleSize: baseline.sampleSize,
        rSquared: baseline.rSquared,
        suiteResults,
        preprocessingNotes,
        subgroupResults
      })
    };
  } catch (error) {
    return {
      supported: false,
      message: error.message || "回归计算失败，请检查变量设定。"
    };
  }
}

function buildRegressionTable(regression) {
  if (!regression?.supported) {
    return null;
  }

  const modelSpecs = regression.suiteResults?.length ? regression.suiteResults : [{
    label: "基准规格",
    sampleSize: regression.sampleSize,
    rSquared: regression.rSquared,
    adjustedRSquared: regression.adjustedRSquared,
    coefficients: regression.coefficients
  }];

  const variables = Array.from(new Set(
    modelSpecs.flatMap(spec => spec.coefficients.map(item => item.variable))
  ));

  const rows = [];
  variables.forEach(variable => {
    const coefficientRow = { variable, type: "coefficient" };
    const stdErrorRow = { variable: `${variable}_se`, type: "stdError" };
    modelSpecs.forEach(spec => {
      const term = spec.coefficients.find(item => item.variable === variable);
      coefficientRow[spec.label] = term ? `${term.coefficient}${term.stars || ""}` : "";
      stdErrorRow[spec.label] = term ? `(${term.stdError})` : "";
    });
    rows.push(coefficientRow, stdErrorRow);
  });

  const sampleRow = { variable: "N", type: "stat" };
  const r2Row = { variable: "R2", type: "stat" };
  const adjR2Row = { variable: "Adj_R2", type: "stat" };
  modelSpecs.forEach(spec => {
    sampleRow[spec.label] = spec.sampleSize;
    r2Row[spec.label] = spec.rSquared;
    adjR2Row[spec.label] = spec.adjustedRSquared ?? "";
  });
  rows.push(sampleRow, r2Row, adjR2Row);

  return {
    columns: ["variable", ...modelSpecs.map(spec => spec.label)],
    rows
  };
}

module.exports = {
  runRegression,
  buildRegressionTable
};
