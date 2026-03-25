const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const db = require("./db");
const { methodPlaybooks, getAnalysisPlan } = require("./playbooks");
const { reviewText } = require("./integrity");
const { analyzeFile } = require("./analyze");
const { runRegression } = require("./regression");

const app = express();
const port = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^\w.\u4e00-\u9fa5-]/g, "_")}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(uploadDir));
app.use("/", express.static(path.join(__dirname, "..", "docs")));

const insertProject = db.prepare(`
  INSERT INTO projects (title, question, sample, data_shape, method, stage, created_at, updated_at)
  VALUES (@title, @question, @sample, @data_shape, @method, @stage, @created_at, @updated_at)
`);
const updateProject = db.prepare(`
  UPDATE projects
  SET title=@title, question=@question, sample=@sample, data_shape=@data_shape, method=@method, stage=@stage, updated_at=@updated_at
  WHERE id=@id
`);
const getProjectStmt = db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC LIMIT 1`);
const getProjectByIdStmt = db.prepare(`SELECT * FROM projects WHERE id = ?`);
const insertUpload = db.prepare(`
  INSERT INTO uploads (project_id, original_name, stored_name, mime_type, size_bytes, note, created_at)
  VALUES (@project_id, @original_name, @stored_name, @mime_type, @size_bytes, @note, @created_at)
`);
const listUploadsStmt = db.prepare(`SELECT * FROM uploads WHERE project_id = ? ORDER BY id DESC`);
const getUploadStmt = db.prepare(`SELECT * FROM uploads WHERE id = ?`);
const insertLogStmt = db.prepare(`
  INSERT INTO research_logs (project_id, content, created_at)
  VALUES (@project_id, @content, @created_at)
`);
const listLogsStmt = db.prepare(`SELECT * FROM research_logs WHERE project_id = ? ORDER BY id DESC`);
const getRoleStmt = db.prepare(`SELECT * FROM variable_roles WHERE project_id = ? AND upload_id = ?`);
const upsertRoleInsertStmt = db.prepare(`
  INSERT INTO variable_roles (project_id, upload_id, dependent_var, independent_vars, control_vars, group_var, time_var, updated_at)
  VALUES (@project_id, @upload_id, @dependent_var, @independent_vars, @control_vars, @group_var, @time_var, @updated_at)
`);
const upsertRoleUpdateStmt = db.prepare(`
  UPDATE variable_roles
  SET dependent_var=@dependent_var, independent_vars=@independent_vars, control_vars=@control_vars, group_var=@group_var, time_var=@time_var, updated_at=@updated_at
  WHERE id=@id
`);

function serializeProject(project) {
  if (!project) return null;
  return {
    id: project.id,
    title: project.title,
    question: project.question,
    sample: project.sample,
    dataShape: project.data_shape,
    method: project.method,
    stage: project.stage,
    createdAt: project.created_at,
    updatedAt: project.updated_at
  };
}

function serializeRole(role) {
  if (!role) return null;
  return {
    id: role.id,
    projectId: role.project_id,
    uploadId: role.upload_id,
    dependentVar: role.dependent_var,
    independentVars: JSON.parse(role.independent_vars || "[]"),
    controlVars: JSON.parse(role.control_vars || "[]"),
    groupVar: role.group_var,
    timeVar: role.time_var,
    updatedAt: role.updated_at
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "economics-agent-backend", time: new Date().toISOString() });
});

app.get("/api/project", (_req, res) => {
  const project = serializeProject(getProjectStmt.get());
  if (!project) {
    return res.json({ project: null, uploads: [], logs: [], plan: null, methods: methodPlaybooks });
  }

  const uploads = listUploadsStmt.all(project.id).map(item => ({
    id: item.id,
    name: item.original_name,
    storedName: item.stored_name,
    mimeType: item.mime_type,
    sizeBytes: item.size_bytes,
    note: item.note,
    createdAt: item.created_at,
    url: `/uploads/${item.stored_name}`
  }));

  const logs = listLogsStmt.all(project.id).map(item => ({
    id: item.id,
    content: item.content,
    createdAt: item.created_at
  }));

  res.json({
    project,
    uploads,
    logs,
    plan: getAnalysisPlan({
      title: project.title,
      method: project.method,
      stage: project.stage,
      data_shape: project.dataShape
    }),
    methods: methodPlaybooks
  });
});

app.post("/api/project", (req, res) => {
  const now = new Date().toISOString();
  const payload = {
    title: req.body.title || "未命名项目",
    question: req.body.question || "",
    sample: req.body.sample || "",
    data_shape: req.body.dataShape || "panel",
    method: req.body.method || "did",
    stage: req.body.stage || "design",
    created_at: now,
    updated_at: now
  };

  const current = getProjectStmt.get();
  let id;
  if (current) {
    id = current.id;
    updateProject.run({ ...payload, id, updated_at: now });
  } else {
    const result = insertProject.run(payload);
    id = result.lastInsertRowid;
  }

  const project = serializeProject(getProjectByIdStmt.get(id));
  res.json({ project, plan: getAnalysisPlan({ title: project.title, method: project.method, stage: project.stage, data_shape: project.dataShape }) });
});

app.post("/api/upload", upload.array("files"), (req, res) => {
  const current = getProjectStmt.get();
  if (!current) {
    return res.status(400).json({ error: "请先保存项目，再上传数据文件。" });
  }

  const now = new Date().toISOString();
  const note = req.body.note || "已登记到项目数据收件箱。";
  const files = (req.files || []).map(file => {
    const result = insertUpload.run({
      project_id: current.id,
      original_name: file.originalname,
      stored_name: file.filename,
      mime_type: file.mimetype,
      size_bytes: file.size,
      note,
      created_at: now
    });
    return {
      id: result.lastInsertRowid,
      name: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      note,
      createdAt: now,
      url: `/uploads/${file.filename}`
    };
  });

  res.json({ files });
});

app.get("/api/uploads/:id/analyze", (req, res) => {
  const uploadItem = getUploadStmt.get(req.params.id);
  if (!uploadItem) {
    return res.status(404).json({ error: "未找到对应文件。" });
  }

  const fullPath = path.join(uploadDir, uploadItem.stored_name);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "文件已不存在。" });
  }

  const role = serializeRole(getRoleStmt.get(uploadItem.project_id, uploadItem.id));
  const analysis = analyzeFile(fullPath, role);
  res.json({
    file: {
      id: uploadItem.id,
      name: uploadItem.original_name,
      storedName: uploadItem.stored_name
    },
    analysis,
    roles: role
  });
});

app.post("/api/uploads/:id/roles", (req, res) => {
  const uploadItem = getUploadStmt.get(req.params.id);
  if (!uploadItem) {
    return res.status(404).json({ error: "未找到对应文件。" });
  }

  const now = new Date().toISOString();
  const payload = {
    project_id: uploadItem.project_id,
    upload_id: uploadItem.id,
    dependent_var: req.body.dependentVar || "",
    independent_vars: JSON.stringify(req.body.independentVars || []),
    control_vars: JSON.stringify(req.body.controlVars || []),
    group_var: req.body.groupVar || "",
    time_var: req.body.timeVar || "",
    updated_at: now
  };

  const existing = getRoleStmt.get(uploadItem.project_id, uploadItem.id);
  if (existing) {
    upsertRoleUpdateStmt.run({ ...payload, id: existing.id });
  } else {
    upsertRoleInsertStmt.run(payload);
  }

  res.json({
    roles: serializeRole(getRoleStmt.get(uploadItem.project_id, uploadItem.id))
  });
});

app.get("/api/uploads/:id/regression", (req, res) => {
  const uploadItem = getUploadStmt.get(req.params.id);
  if (!uploadItem) {
    return res.status(404).json({ error: "未找到对应文件。" });
  }

  const fullPath = path.join(uploadDir, uploadItem.stored_name);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "文件已不存在。" });
  }

  const role = serializeRole(getRoleStmt.get(uploadItem.project_id, uploadItem.id));
  const regression = runRegression(fullPath, role, {
    winsorizeTail: req.query.winsorizeTail,
    subgroupEnabled: req.query.subgroupEnabled
  });
  res.json({
    file: {
      id: uploadItem.id,
      name: uploadItem.original_name,
      storedName: uploadItem.stored_name
    },
    regression,
    roles: role
  });
});

app.get("/api/uploads/:id/research-report", (req, res) => {
  const uploadItem = getUploadStmt.get(req.params.id);
  if (!uploadItem) {
    return res.status(404).json({ error: "未找到对应文件。" });
  }

  const project = serializeProject(getProjectByIdStmt.get(uploadItem.project_id));
  const role = serializeRole(getRoleStmt.get(uploadItem.project_id, uploadItem.id));
  const fullPath = path.join(uploadDir, uploadItem.stored_name);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "文件已不存在。" });
  }

  const analysis = analyzeFile(fullPath, role);
  const regression = runRegression(fullPath, role, {
    winsorizeTail: req.query.winsorizeTail,
    subgroupEnabled: req.query.subgroupEnabled
  });
  const logs = listLogsStmt.all(uploadItem.project_id).slice(0, 5).map(item => ({
    content: item.content,
    createdAt: item.created_at
  }));

  const reportLines = [
    `# ${project?.title || "经济学研究项目"} 研究备忘录`,
    "",
    "## 一、项目概况",
    `- 研究问题：${project?.question || "未填写"}`,
    `- 样本范围：${project?.sample || "未填写"}`,
    `- 方法选择：${project?.method || "未填写"}`,
    `- 当前阶段：${project?.stage || "未填写"}`,
    "",
    "## 二、数据摘要"
  ];

  if (analysis.supported) {
    reportLines.push(`- 数据文件：${uploadItem.original_name}`);
    reportLines.push(`- 工作表：${analysis.sheetName}`);
    reportLines.push(`- 样本量：${analysis.rowCount}`);
    reportLines.push(`- 字段数：${analysis.columns.length}`);
    reportLines.push("");
    reportLines.push("### 描述统计要点");
    (analysis.interpretationDraft || []).forEach(line => reportLines.push(`- ${line}`));
  } else {
    reportLines.push(`- 数据摘要暂不可用：${analysis.message}`);
  }

  reportLines.push("");
  reportLines.push("## 三、回归结果摘要");
  if (regression.supported) {
    reportLines.push(`- 因变量：${regression.dependentVar}`);
    reportLines.push(`- 解释变量：${regression.regressors.join("、")}`);
    reportLines.push(`- 样本量 N：${regression.sampleSize}`);
    reportLines.push(`- R²：${regression.rSquared}`);
    reportLines.push(`- Adjusted R²：${regression.adjustedRSquared ?? "NA"}`);
    (regression.preprocessingNotes || []).forEach(note => reportLines.push(`- 数据处理：${note}`));
    reportLines.push("");
    reportLines.push("| 变量 | 系数 | 标准误 | t 值 | p 值 |");
    reportLines.push("| --- | ---: | ---: | ---: | ---: |");
    regression.coefficients.forEach(item => {
      reportLines.push(`| ${item.variable} ${item.stars} | ${item.coefficient} | ${item.stdError} | ${item.tStat} | ${item.pValue} |`);
    });
    reportLines.push("");
    reportLines.push("### 回归解释");
    (regression.interpretationDraft || []).forEach(line => reportLines.push(`- ${line}`));
    if (regression.suiteResults?.length) {
      reportLines.push("");
      reportLines.push("### 规格对照");
      regression.suiteResults.forEach(item => {
        reportLines.push(`- ${item.label}：N=${item.sampleSize}，R²=${item.rSquared}，Adjusted R²=${item.adjustedRSquared ?? "NA"}`);
      });
    }
    if (regression.subgroupResults?.length) {
      reportLines.push("");
      reportLines.push("### 异质性比较");
      regression.subgroupResults.forEach(item => {
        reportLines.push(`- ${item.groupVar}=${item.groupLabel}：N=${item.sampleSize}，R²=${item.rSquared}`);
      });
    }
  } else {
    reportLines.push(`- 回归结果暂不可用：${regression.message}`);
  }

  reportLines.push("");
  reportLines.push("## 四、最近研究日志");
  if (logs.length) {
    logs.forEach(item => reportLines.push(`- [${item.createdAt}] ${item.content}`));
  } else {
    reportLines.push("- 暂无研究日志。");
  }

  reportLines.push("");
  reportLines.push("## 五、后续建议");
  reportLines.push("- 在正式论文版本中补充稳健标准误、固定效应和内生性识别。");
  reportLines.push("- 对核心变量做替代定义、样本修剪和异质性分析。");
  reportLines.push("- 将本备忘录与图表、回归表、文献综述一起整理到完整研究档案。");

  res.json({
    file: {
      id: uploadItem.id,
      name: uploadItem.original_name
    },
    report: {
      title: `${project?.title || "经济学研究项目"} 研究备忘录`,
      markdown: reportLines.join("\n")
    }
  });
});

app.post("/api/logs", (req, res) => {
  const current = getProjectStmt.get();
  if (!current) {
    return res.status(400).json({ error: "请先保存项目，再记录研究日志。" });
  }

  const content = (req.body.content || "").trim();
  if (!content) {
    return res.status(400).json({ error: "日志内容不能为空。" });
  }

  const createdAt = new Date().toISOString();
  const result = insertLogStmt.run({
    project_id: current.id,
    content,
    created_at: createdAt
  });

  res.json({
    log: {
      id: result.lastInsertRowid,
      content,
      createdAt
    }
  });
});

app.post("/api/integrity-review", (req, res) => {
  res.json({ tips: reviewText(req.body.text || "") });
});

app.get("/api/analysis-plan", (_req, res) => {
  const current = getProjectStmt.get();
  if (!current) {
    return res.json({ plan: null });
  }
  res.json({
    plan: getAnalysisPlan(current)
  });
});

app.listen(port, () => {
  console.log(`Economics Agent backend listening on http://localhost:${port}`);
});
