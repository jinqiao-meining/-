const projectKey = "economics-agent-workbench-project";
const fileKey = "economics-agent-workbench-files";
const logKey = "economics-agent-workbench-logs";

const methodTemplates = {
  did: {
    name: "DID / 事件研究",
    checklist: [
      "明确定义处理组、对照组、政策年份",
      "完成政策前趋势可比性检查",
      "输出平行趋势图与事件研究图",
      "补做安慰剂和伪时点检验"
    ]
  },
  fe: {
    name: "固定效应回归",
    checklist: [
      "明确个体与时间固定效应层级",
      "确认聚类标准误口径",
      "补做替代变量与样本修剪稳健性",
      "检查组内变化是否支撑识别"
    ]
  },
  iv: {
    name: "工具变量",
    checklist: [
      "说明工具变量的相关性来源",
      "提供外生性论证",
      "输出第一阶段与弱工具诊断",
      "解释 LATE 含义与适用范围"
    ]
  },
  rdd: {
    name: "断点回归",
    checklist: [
      "确认 cutoff 和 running variable",
      "输出断点图与密度检验",
      "比较不同带宽结果",
      "比较多项式设定稳健性"
    ]
  },
  forecast: {
    name: "预测 / 机器学习",
    checklist: [
      "明确预测目标而非因果解释",
      "划分训练、验证、测试集",
      "选择性能指标",
      "保留传统基准模型用于对比"
    ]
  }
};

function readStore(key, fallback) {
  const value = localStorage.getItem(key);
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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
      <p>${file.note}</p>
      <div class="data-meta">
        <span>${file.size}</span>
        <span>${file.type || "未知类型"}</span>
        <span>${file.time}</span>
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
      <h4>${log.text}</h4>
      <div class="log-meta">
        <span>${log.time}</span>
      </div>
    </article>
  `).join("");
}

function integrityReview(text) {
  const tips = [];
  const raw = text.trim();

  if (!raw) {
    return ["请先输入需要审阅的段落。"];
  }

  if (raw.length < 120) {
    tips.push("文本偏短，建议至少提供一个完整自然段再做审阅。");
  }

  const templateSignals = ["值得注意的是", "综上所述", "不难发现", "可以看出", "具有重要意义"];
  const hitTemplate = templateSignals.filter(item => raw.includes(item));
  if (hitTemplate.length) {
    tips.push(`检测到较模板化表达：${hitTemplate.join("、")}。建议改为更具体的作者判断。`);
  }

  if (!/[0-9％%]/.test(raw)) {
    tips.push("该段几乎没有数据、比例或系数信息，若属于结果解释段，建议补入具体证据。");
  }

  if (!/文献|研究|样本|变量|回归|估计|模型|机制/.test(raw)) {
    tips.push("该段缺少学术研究语境关键词，可能显得过于空泛，建议补入变量、样本或方法口径。");
  }

  if (!/因为|由于|因此|表明|说明|意味着/.test(raw)) {
    tips.push("逻辑连接词较少，建议补足因果链条或解释路径。");
  }

  tips.push("最终定稿前仍应人工核对引用来源、变量定义和论证是否与实证结果一致。");
  return tips;
}

function bindProjectForm() {
  const form = document.getElementById("project-form");
  const saved = readStore(projectKey, null);
  if (saved) {
    Object.entries(saved).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (input) {
        input.value = value;
      }
    });
    renderProjectSummary(saved);
    renderTemplates(saved.method);
  } else {
    renderProjectSummary(null);
    renderTemplates("did");
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const project = Object.fromEntries(new FormData(form).entries());
    writeStore(projectKey, project);
    renderProjectSummary(project);
    renderTemplates(project.method);
  });
}

function bindFileRegister() {
  const button = document.getElementById("register-files");
  const input = document.getElementById("data-files");
  const current = readStore(fileKey, []);
  renderFiles(current);

  button.addEventListener("click", () => {
    const files = Array.from(input.files || []);
    if (!files.length) {
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
  renderLogs(readStore(logKey, []));

  form.addEventListener("submit", event => {
    event.preventDefault();
    const text = form.elements.namedItem("logText").value.trim();
    if (!text) {
      return;
    }
    const next = [
      {
        text,
        time: new Date().toLocaleString("zh-CN")
      },
      ...readStore(logKey, [])
    ];
    writeStore(logKey, next);
    renderLogs(next);
    form.reset();
  });
}

function bindIntegrity() {
  const form = document.getElementById("integrity-form");
  const output = document.getElementById("integrity-output");

  form.addEventListener("submit", event => {
    event.preventDefault();
    const text = document.getElementById("integrity-text").value;
    const tips = integrityReview(text);
    output.innerHTML = `
      <strong>审阅提示</strong>
      <ul>${tips.map(item => `<li>${item}</li>`).join("")}</ul>
    `;
  });
}

bindProjectForm();
bindFileRegister();
bindLogs();
bindIntegrity();
