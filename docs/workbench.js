const projectKey = "economics-agent-workbench-project";
const fileKey = "economics-agent-workbench-files";
const logKey = "economics-agent-workbench-logs";
const apiBase = window.location.origin.startsWith("http") ? window.location.origin : "http://localhost:3000";

const methodTemplates = {
  did: {
    name: "DID / 事件研究",
    checklist: [
      "明确处理组、对照组、政策年份和识别时点。",
      "完成政策前趋势可比性检查。",
      "输出平行趋势图、事件研究图和基准 DID 表。",
      "补做安慰剂、伪时点和样本替换稳健性。"
    ]
  },
  fe: {
    name: "固定效应回归",
    checklist: [
      "明确个体固定效应、时间固定效应和聚类标准误层级。",
      "检查核心解释变量的组内变化。",
      "补做替代变量、样本修剪和不同规格比较。",
      "输出基准回归与异质性结果。"
    ]
  },
  iv: {
    name: "工具变量",
    checklist: [
      "给出工具变量相关性来源和外生性论证。",
      "输出第一阶段、第二阶段和弱工具诊断。",
      "解释局部平均处理效应的适用范围。",
      "讨论排除限制的可信度。"
    ]
  },
  rdd: {
    name: "断点回归",
    checklist: [
      "确认 cutoff 和 running variable。",
      "输出断点图、密度检验和带宽敏感性比较。",
      "比较不同多项式设定。",
      "检查断点附近操纵风险。"
    ]
  },
  forecast: {
    name: "预测 / 机器学习",
    checklist: [
      "明确预测目标而非因果识别目标。",
      "划分训练集、验证集和测试集。",
      "确定性能指标和特征解释方法。",
      "保留传统计量模型作为对照。"
    ]
  }
};

let backendAvailable = false;
let currentUploads = [];
let currentChart = null;

function readStore(key, fallback) {
  const value = localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setBackendBadge() {
  const badge = document.getElementById("backend-status");
  if (!badge) return;
  badge.textContent = backendAvailable ? "已连接本地后端" : "未检测到后端，当前为浏览器本地模式";
  badge.style.background = backendAvailable ? "#e4f4eb" : "#fff7e6";
  badge.style.color = backendAvailable ? "#1d6645" : "#7a5a11";
}

function renderProjectSummary(project) {
  const root = document.getElementById("project-summary");
  if (!project || !project.title) {
    root.innerHTML = `
      <div class="summary-row">
        <strong>尚未保存项目</strong>
        <span style="color:var(--muted);">请先在左侧填写项目设置。</span>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="summary-row">
      <strong>项目题目</strong>
      <span>${project.title}</span>
    </div>
    <div class="summary-row">
      <strong>研究问题</strong>
      <span>${project.question || "未填写"}</span>
    </div>
    <div class="summary-row">
      <strong>样本范围</strong>
      <span>${project.sample || "未填写"}</span>
    </div>
    <div class="summary-row">
      <strong>方法与阶段</strong>
      <span>${methodTemplates[project.method]?.name || "未设置"} / ${project.stage || "未设置"}</span>
    </div>
  `;
}

function renderFiles(files) {
  currentUploads = files;
  const root = document.getElementById("data-list");
  if (!files.length) {
    root.innerHTML = `
      <article class="data-item">
        <h4>暂无文件登记</h4>
        <p>可先选择本地文件，再点击“登记文件”。</p>
      </article>
    `;
    return;
  }

  root.innerHTML = files.map(file => `
    <article class="data-item">
      <h4>${file.name}</h4>
      <p>${file.note || "已登记数据文件。"}</p>
      <div class="data-meta">
        <span>${file.size || `${((file.sizeBytes || 0) / 1024).toFixed(1)} KB`}</span>
        <span>${file.type || file.mimeType || "未知类型"}</span>
        <span>${file.time || file.createdAt || ""}</span>
      </div>
      <div class="panel-actions">
        ${file.url ? `<a class="button button--secondary" href="${file.url}" target="_blank" rel="noopener">打开文件</a>` : ""}
        ${file.id ? `<button class="button button--primary" type="button" onclick="analyzeUpload(${file.id})">分析此文件</button>` : ""}
      </div>
    </article>
  `).join("");
}

function renderTemplates(selectedMethod) {
  const root = document.getElementById("template-grid");
  root.innerHTML = Object.entries(methodTemplates).map(([key, config]) => `
    <article class="template-card ${selectedMethod === key ? "active" : ""}">
      <h4>${config.name}</h4>
      <ul>${config.checklist.map(item => `<li>${item}</li>`).join("")}</ul>
    </article>
  `).join("");
}

function renderLogs(logs) {
  const root = document.getElementById("log-list");
  if (!logs.length) {
    root.innerHTML = `
      <article class="log-item">
        <h4>暂无研究日志</h4>
        <p>建议从第一条“样本处理或方法判断”开始记录。</p>
      </article>
    `;
    return;
  }

  root.innerHTML = logs.map(log => `
    <article class="log-item">
      <h4>${log.text || log.content}</h4>
      <div class="log-meta">
        <span>${log.time || log.createdAt}</span>
      </div>
    </article>
  `).join("");
}

function renderIntegrity(tips, title = "审阅提示") {
  const output = document.getElementById("integrity-output");
  output.innerHTML = `
    <strong>${title}</strong>
    <ul>${tips.map(item => `<li>${item}</li>`).join("")}</ul>
  `;
}

function renderAnalysisResult(payload) {
  const root = document.getElementById("analysis-result");
  if (!payload || !payload.analysis) {
    root.innerHTML = `<strong>暂无分析结果</strong>`;
    return;
  }

  const { file, analysis } = payload;
  if (!analysis.supported) {
    root.innerHTML = `
      <strong>${file.name}</strong>
      <p style="margin:8px 0 0; color:var(--muted);">${analysis.message}</p>
    `;
    drawChart(null);
    return;
  }

  root.innerHTML = `
    <strong>${file.name}</strong>
    <div class="analysis-grid">
      <div class="analysis-card">
        <h4>数据概况</h4>
        <p>工作表：${analysis.sheetName} | 样本行数：${analysis.rowCount} | 字段数：${analysis.columns.length}</p>
      </div>
      <div class="analysis-card">
        <h4>字段识别</h4>
        <table class="analysis-table">
          <thead><tr><th>字段</th><th>类型</th><th>缺失</th><th>唯一值</th></tr></thead>
          <tbody>
            ${analysis.columns.slice(0, 8).map(col => `
              <tr>
                <td>${col.name}</td>
                <td>${col.inferredType}</td>
                <td>${col.missingCount}</td>
                <td>${col.uniqueCount}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="analysis-card">
        <h4>数值变量摘要</h4>
        ${analysis.numericSummaries.length ? `
          <table class="analysis-table">
            <thead><tr><th>变量</th><th>均值</th><th>标准差</th><th>最小值</th><th>最大值</th></tr></thead>
            <tbody>
              ${analysis.numericSummaries.map(item => `
                <tr>
                  <td>${item.column}</td>
                  <td>${item.stats.mean}</td>
                  <td>${item.stats.std}</td>
                  <td>${item.stats.min}</td>
                  <td>${item.stats.max}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        ` : `<p style="color:var(--muted);">未识别到可用于描述统计的数值变量。</p>`}
      </div>
      <div class="analysis-card">
        <h4>分类变量摘要</h4>
        ${analysis.categoricalSummaries.length ? analysis.categoricalSummaries.map(item => `
          <p><strong>${item.column}</strong>：${item.topValues.map(v => `${v.label}(${v.count})`).join("，")}</p>
        `).join("") : `<p style="color:var(--muted);">未识别到低类别数的分类变量。</p>`}
      </div>
    </div>
  `;

  drawChart(analysis.chartSuggestions?.[0] || null);
}

function drawChart(chartSuggestion) {
  const canvas = document.getElementById("analysis-chart");
  if (!canvas || !window.Chart) return;
  const ctx = canvas.getContext("2d");
  if (currentChart) currentChart.destroy();

  if (!chartSuggestion) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  currentChart = new Chart(ctx, {
    type: chartSuggestion.type || "bar",
    data: {
      labels: chartSuggestion.labels,
      datasets: [{
        label: chartSuggestion.title,
        data: chartSuggestion.values,
        backgroundColor: "#2d72ff",
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: chartSuggestion.title,
          color: "#14263b",
          font: { size: 16 }
        }
      },
      scales: {
        x: { ticks: { color: "#55677a" } },
        y: { ticks: { color: "#55677a" } }
      }
    }
  });
}

async function checkBackend() {
  try {
    const res = await fetch(`${apiBase}/api/health`);
    backendAvailable = res.ok;
  } catch {
    backendAvailable = false;
  }
  setBackendBadge();
}

async function loadInitialData() {
  const form = document.getElementById("project-form");
  if (backendAvailable) {
    try {
      const res = await fetch(`${apiBase}/api/project`);
      const data = await res.json();
      if (data.project) {
        Object.entries({
          title: data.project.title,
          question: data.project.question,
          sample: data.project.sample,
          dataShape: data.project.dataShape,
          method: data.project.method,
          stage: data.project.stage
        }).forEach(([key, value]) => {
          const input = form.elements.namedItem(key);
          if (input) input.value = value;
        });
        renderProjectSummary(data.project);
        renderFiles(data.uploads || []);
        renderLogs(data.logs || []);
        renderTemplates(data.project.method);
        return;
      }
    } catch {}
  }

  const saved = readStore(projectKey, null);
  if (saved) {
    Object.entries(saved).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (input) input.value = value;
    });
    renderProjectSummary(saved);
    renderTemplates(saved.method);
  } else {
    renderProjectSummary(null);
    renderTemplates("did");
  }
  renderFiles(readStore(fileKey, []));
  renderLogs(readStore(logKey, []));
}

function bindProjectForm() {
  const form = document.getElementById("project-form");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const project = Object.fromEntries(new FormData(form).entries());

    if (backendAvailable) {
      const res = await fetch(`${apiBase}/api/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project)
      });
      const data = await res.json();
      renderProjectSummary(data.project);
      renderTemplates(data.project.method);
      return;
    }

    writeStore(projectKey, project);
    renderProjectSummary(project);
    renderTemplates(project.method);
  });
}

function bindFileRegister() {
  const button = document.getElementById("register-files");
  const input = document.getElementById("data-files");

  button.addEventListener("click", async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    if (backendAvailable) {
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));
      const res = await fetch(`${apiBase}/api/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      const current = await fetch(`${apiBase}/api/project`).then(r => r.json());
      renderFiles(current.uploads || data.files || []);
      input.value = "";
      return;
    }

    const existing = readStore(fileKey, []);
    const next = [
      ...files.map(file => ({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.type || "本地数据文件",
        note: "已在浏览器本地登记，后续可接真实后端做版本化管理。",
        time: new Date().toLocaleString("zh-CN")
      })),
      ...existing
    ];
    writeStore(fileKey, next);
    renderFiles(next);
    input.value = "";
  });
}

function bindLogs() {
  const form = document.getElementById("log-form");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const text = form.elements.namedItem("logText").value.trim();
    if (!text) return;

    if (backendAvailable) {
      await fetch(`${apiBase}/api/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text })
      });
      const current = await fetch(`${apiBase}/api/project`).then(r => r.json());
      renderLogs(current.logs || []);
      form.reset();
      return;
    }

    const next = [
      { text, time: new Date().toLocaleString("zh-CN") },
      ...readStore(logKey, [])
    ];
    writeStore(logKey, next);
    renderLogs(next);
    form.reset();
  });
}

function bindIntegrity() {
  const form = document.getElementById("integrity-form");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const text = document.getElementById("integrity-text").value;

    if (backendAvailable) {
      const res = await fetch(`${apiBase}/api/integrity-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      renderIntegrity(data.tips || []);
      return;
    }

    const tips = ["当前未连接后端，建议启动本地服务以获得统一审阅结果。", "在未接后端模式下，平台仅保存浏览器本地数据。", "最终定稿前仍应人工核对引用来源、变量定义和论证是否一致。"];
    renderIntegrity(tips, "本地模式提示");
  });
}

async function analyzeUpload(uploadId) {
  if (!backendAvailable) {
    renderAnalysisResult({
      file: { name: "本地模式" },
      analysis: { supported: false, message: "请先启动本地后端，再使用自动分析功能。" }
    });
    return;
  }

  const res = await fetch(`${apiBase}/api/uploads/${uploadId}/analyze`);
  const data = await res.json();
  renderAnalysisResult(data);
}

function bindAnalysisButton() {
  const button = document.getElementById("analyze-latest");
  button.addEventListener("click", async () => {
    if (!currentUploads.length) {
      renderAnalysisResult({
        file: { name: "暂无文件" },
        analysis: { supported: false, message: "请先上传或登记一个 CSV/Excel 文件。" }
      });
      return;
    }
    const latest = currentUploads[0];
    if (!latest.id) {
      renderAnalysisResult({
        file: { name: latest.name || "本地文件" },
        analysis: { supported: false, message: "浏览器本地模式下暂不支持自动读表，请启动本地后端。" }
      });
      return;
    }
    await analyzeUpload(latest.id);
  });
}

window.analyzeUpload = analyzeUpload;

async function init() {
  await checkBackend();
  await loadInitialData();
  bindProjectForm();
  bindFileRegister();
  bindLogs();
  bindIntegrity();
  bindAnalysisButton();
}

init();
