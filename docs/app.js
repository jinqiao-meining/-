const methodPlaybooks = {
  did: {
    label: "DID / 事件研究",
    checks: [
      "确认处理组、对照组与政策发生时间",
      "检查政策前趋势是否可比",
      "准备平行趋势图和事件研究图",
      "安排安慰剂检验与伪政策时点检验"
    ],
    outputs: [
      "描述统计表",
      "平行趋势图",
      "基准 DID 回归表",
      "事件研究系数图",
      "稳健性与异质性检验表"
    ]
  },
  fe: {
    label: "固定效应回归",
    checks: [
      "明确个体固定效应与时间固定效应",
      "检查聚类标准误的层级",
      "确认核心解释变量是否存在组内变化",
      "补充替代变量与样本修剪稳健性"
    ],
    outputs: [
      "变量定义表",
      "基准固定效应模型",
      "多规格比较表",
      "异质性分析结果",
      "系数可视化图"
    ]
  },
  iv: {
    label: "工具变量",
    checks: [
      "论证工具变量相关性与外生性",
      "输出第一阶段结果",
      "检查弱工具变量风险",
      "说明识别解释的局部平均处理效应含义"
    ],
    outputs: [
      "第一阶段回归表",
      "第二阶段回归表",
      "弱工具诊断",
      "工具变量识别说明卡"
    ]
  },
  rdd: {
    label: "断点回归",
    checks: [
      "确认 running variable 与 cutoff",
      "检查断点附近样本操纵风险",
      "比较不同带宽与多项式阶数",
      "输出断点图与密度检验"
    ],
    outputs: [
      "断点图",
      "密度检验图",
      "不同带宽结果表",
      "稳健性摘要"
    ]
  },
  forecast: {
    label: "预测 / 机器学习",
    checks: [
      "区分解释性研究和预测性研究",
      "划分训练集、验证集和测试集",
      "设置性能指标与解释方式",
      "保留基准计量模型用于对照"
    ],
    outputs: [
      "特征字典",
      "模型性能比较表",
      "特征重要性图",
      "预测误差解释说明"
    ]
  }
};

const shapeAdvice = {
  panel: [
    "优先检查个体和年份的唯一键是否完整。",
    "应先生成平衡面板与非平衡面板两种统计摘要。",
    "建议提前定义固定效应层级与聚类标准误层级。"
  ],
  cross: [
    "先检查样本代表性与缺失机制。",
    "重点关注异方差、极端值和变量尺度问题。",
    "适合先做分组描述统计和分位数对比。"
  ],
  timeseries: [
    "先检查平稳性、结构突变和季节性。",
    "所有图表都要带时间轴与关键事件标记。",
    "需要提前明确预测和因果识别的目标区别。"
  ],
  mixed: [
    "优先统一主键、时间粒度和地区口径。",
    "先做数据来源说明表，再做合并日志。",
    "合并前后样本损失必须单独报告。"
  ]
};

function renderPlannerResult(formData, files) {
  const playbook = methodPlaybooks[formData.method];
  const shapeNotes = shapeAdvice[formData.dataShape];
  const stageMessage = {
    design: "当前重点应放在研究设计卡、变量口径和数据需求单，不建议过早跑大量模型。",
    cleaning: "当前重点应放在变量标准化、缺失机制判断和清洗日志，先不要直接写结论。",
    analysis: "当前重点应放在基准模型、稳健性、图形化识别和结果解释的一致性。",
    writing: "当前重点应放在结果解释、图表叙述、引用补强和学术诚信审阅。"
  }[formData.stage];

  const fileTags = files.length
    ? files.map(file => `<span>${file.name}</span>`).join("")
    : "<span>暂未上传文件</span>";

  return `
    <div class="result-block">
      <h3>${formData.title}</h3>
      <p>${formData.question}</p>
      <div class="archive-meta">
        <span>${playbook.label}</span>
        <span>${formData.dataShape === "panel" ? "面板数据" : formData.dataShape === "cross" ? "截面数据" : formData.dataShape === "timeseries" ? "时间序列" : "多源混合数据"}</span>
      </div>
    </div>
    <div class="result-block">
      <h3>当前阶段提示</h3>
      <p>${stageMessage}</p>
    </div>
    <div class="result-block">
      <h3>第一轮检查清单</h3>
      <ul>${playbook.checks.map(item => `<li>${item}</li>`).join("")}</ul>
    </div>
    <div class="result-block">
      <h3>数据结构建议</h3>
      <ul>${shapeNotes.map(item => `<li>${item}</li>`).join("")}</ul>
    </div>
    <div class="result-block">
      <h3>建议产出</h3>
      <ul>${playbook.outputs.map(item => `<li>${item}</li>`).join("")}</ul>
    </div>
    <div class="result-block">
      <h3>当前已准备文件</h3>
      <div class="uploaded-files">${fileTags}</div>
    </div>
    <div class="result-block">
      <h3>下一步建议</h3>
      <ul>
        <li>先由数据治理 Agent 生成数据字典和缺失报告。</li>
        <li>再由计量识别 Agent 输出基准模型与稳健性路线。</li>
        <li>最后由写作 Agent 生成方法部分骨架和结果解释草稿。</li>
      </ul>
    </div>
  `;
}

async function loadArchive() {
  const list = document.getElementById("content-list");

  try {
    const response = await fetch("./content.json");
    const items = await response.json();
    list.innerHTML = items.map(item => `
      <article class="archive-entry">
        <h3>${item.title}</h3>
        <div class="archive-meta">
          <span>${item.category}</span>
          <span>${item.date}</span>
        </div>
        <p>${item.summary}</p>
        <div class="archive-actions">
          ${item.pdf ? `<a class="button button--primary" href="${item.pdf}" target="_blank" rel="noopener">打开 PDF</a>` : ""}
          ${item.html ? `<a class="button button--secondary" href="${item.html}" target="_blank" rel="noopener">网页查看</a>` : ""}
        </div>
      </article>
    `).join("");
  } catch (error) {
    list.innerHTML = `
      <article class="archive-entry">
        <h3>归档内容暂时不可用</h3>
        <p>请检查 content.json 是否存在，或稍后刷新页面。</p>
      </article>
    `;
  }
}

function hydratePlanner() {
  const form = document.getElementById("planner-form");
  const result = document.getElementById("planner-result");
  const fileInput = document.getElementById("file-input");

  const saved = localStorage.getItem("economics-agent-project");
  if (saved) {
    const project = JSON.parse(saved);
    Object.entries(project).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (input) {
        input.value = value;
      }
    });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem("economics-agent-project", JSON.stringify(formData));
    const files = Array.from(fileInput.files || []);
    result.innerHTML = renderPlannerResult(formData, files);
  });
}

loadArchive();
hydratePlanner();
