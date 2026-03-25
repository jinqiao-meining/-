function reviewText(text) {
  const raw = (text || "").trim();
  const tips = [];

  if (!raw) {
    return ["请先输入需要审阅的段落。"];
  }

  if (raw.length < 120) {
    tips.push("文本偏短，建议至少提供一个完整自然段。");
  }

  const templateSignals = ["值得注意的是", "综上所述", "可以看出", "不难发现", "具有重要意义"];
  const hitTemplate = templateSignals.filter(item => raw.includes(item));
  if (hitTemplate.length) {
    tips.push(`检测到较模板化表达：${hitTemplate.join("、")}。建议改为更具体的作者判断。`);
  }

  if (!/[0-9％%]/.test(raw)) {
    tips.push("若这是结果解释段，建议补充系数、比例、显著性或样本信息。");
  }

  if (!/变量|样本|回归|估计|文献|模型|机制/.test(raw)) {
    tips.push("该段研究语境较弱，建议补充变量口径、样本背景或模型信息。");
  }

  if (!/因为|由于|因此|说明|表明|意味着/.test(raw)) {
    tips.push("逻辑链条偏弱，建议增加因果或解释连接词。");
  }

  tips.push("请始终以人工复核为准，不要把任何检测结果当作自动定案。");
  return tips;
}

module.exports = {
  reviewText
};
