const methodPlaybooks = {
  did: {
    name: "DID / 事件研究",
    checklist: [
      "明确处理组、对照组、政策年份和识别时点。",
      "完成政策前趋势可比性检查。",
      "输出平行趋势图、事件研究图和基准 DID 表。",
      "补做安慰剂、伪时点和样本替换稳健性。"
    ],
    outputs: ["描述统计", "DID 基准表", "事件研究图", "稳健性汇总"]
  },
  fe: {
    name: "固定效应回归",
    checklist: [
      "明确个体固定效应、时间固定效应和聚类标准误层级。",
      "检查核心解释变量的组内变化。",
      "补做替代变量、样本修剪和不同规格比较。",
      "输出基准回归与异质性结果。"
    ],
    outputs: ["变量定义表", "固定效应表", "异质性表", "系数图"]
  },
  iv: {
    name: "工具变量",
    checklist: [
      "给出工具变量相关性来源和外生性论证。",
      "输出第一阶段、第二阶段和弱工具诊断。",
      "解释局部平均处理效应的适用范围。",
      "讨论排除限制的可信度。"
    ],
    outputs: ["第一阶段", "第二阶段", "弱工具诊断", "识别说明卡"]
  },
  rdd: {
    name: "断点回归",
    checklist: [
      "确认 running variable 与 cutoff。",
      "输出断点图、密度检验和带宽敏感性比较。",
      "比较不同多项式设定。",
      "检查断点附近操纵风险。"
    ],
    outputs: ["断点图", "密度检验", "带宽比较", "稳健性摘要"]
  },
  forecast: {
    name: "预测 / 机器学习",
    checklist: [
      "明确预测目标而非因果识别目标。",
      "划分训练集、验证集和测试集。",
      "确定性能指标和特征解释方法。",
      "保留传统计量模型作为对照。"
    ],
    outputs: ["特征字典", "性能表", "特征重要性图", "预测误差说明"]
  }
};

const stageAdvice = {
  design: "当前应优先完成研究设计卡、变量口径表和数据需求清单。",
  cleaning: "当前应优先完成缺失报告、异常值报告和清洗日志。",
  analysis: "当前应优先完成基准模型、稳健性与图形化识别。",
  writing: "当前应优先完成结果解释、图注、引用补强与诚信审阅。"
};

const shapeAdvice = {
  panel: [
    "检查个体-年份唯一键是否完整。",
    "区分平衡面板与非平衡面板并分别汇报。",
    "提前明确固定效应和聚类标准误层级。"
  ],
  cross: [
    "检查样本代表性与极端值。",
    "重点关注异方差和变量尺度问题。",
    "优先做分组描述统计和分位数对比。"
  ],
  timeseries: [
    "检查平稳性、结构突变和季节性。",
    "所有图表带时间轴与关键事件。",
    "明确预测和因果问题的边界。"
  ],
  mixed: [
    "统一主键、时间粒度和地区口径。",
    "合并前后样本变化必须单列汇报。",
    "先生成数据来源说明，再做合并日志。"
  ]
};

function getAnalysisPlan(project) {
  const playbook = methodPlaybooks[project.method] || methodPlaybooks.did;
  return {
    projectTitle: project.title,
    method: playbook.name,
    stageAdvice: stageAdvice[project.stage] || stageAdvice.design,
    checklist: playbook.checklist,
    outputs: playbook.outputs,
    shapeAdvice: shapeAdvice[project.data_shape] || shapeAdvice.panel
  };
}

module.exports = {
  methodPlaybooks,
  getAnalysisPlan
};
