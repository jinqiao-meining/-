# 经济学研究 Agent 门户

这是一个面向经济学教授与课题组的研究平台原型。

当前已经进入第 6 版：除了 GitHub Pages 上的门户与工作台页面，还支持变量角色设定、描述统计表导出、基础回归原型，以及基于分析与回归结果的解释草稿生成。

## 当前能力

- 门户首页：展示研究流程、Agent 分工与工作台入口
- 研究工作台：保存项目、登记文件、记录日志、查看分析模板
- 本地后端：`Express + SQLite`
- 文件上传：通过后端登记并保存在本地 `uploads/`
- 数据分析：自动识别 CSV / XLS / XLSX 字段类型并输出描述统计
- 图表建议：自动生成基础柱状图数据
- 变量角色设定：支持设置因变量、自变量、控制变量、分组变量和时间变量
- 描述统计导出：可下载描述统计表 CSV
- 结果解释草稿：根据统计结果生成论文写作草稿提示
- 基础回归原型：基于角色设定运行一轮 OLS，输出系数表、R² 和回归解释草稿
- 诚信审阅：通过统一接口生成基础审阅提示
- 前后端双模式：
  - 启动后端时，优先使用服务端数据库
  - 未启动后端时，自动回退到浏览器本地模式

## 目录结构

- `docs/`
  GitHub Pages 前端页面
- `docs/index.html`
  门户首页
- `docs/workbench.html`
  研究工作台
- `docs/app.js`
  门户交互
- `docs/workbench.js`
  工作台交互
- `server/`
  本地后端
- `server/index.js`
  API 与静态资源服务入口
- `server/db.js`
  SQLite 初始化
- `server/playbooks.js`
  分析模板与路线
- `server/integrity.js`
  审阅逻辑
- `server/analyze.js`
  表格自动分析逻辑
- `scripts/add-content.ps1`
  手动加入公开资料的脚本

## 本地运行

安装依赖：

```bash
npm install
```

启动本地后端：

```bash
npm start
```

启动后访问：

- `http://localhost:3000/`
- `http://localhost:3000/workbench.html`

第 4 版新增：

- 上传 CSV / Excel 后可点击“分析最近上传文件”
- 自动返回字段识别、样本行数、数值变量描述统计、分类变量频数摘要和基础图表建议

第 5 版新增：

- 分析后可设定变量角色
- 可导出描述统计表
- 可生成结果解释草稿

第 6 版新增：

- 可在工作台内直接运行基础回归原型
- 自动输出系数表、样本量与 R²
- 自动生成系数柱状图与学术化解释草稿

## GitHub Pages 发布

GitHub Pages 仍然使用：

- Branch: `main`
- Folder: `/docs`

说明：

- GitHub Pages 只负责静态前端页面
- 本地后端不部署在 GitHub Pages 上
- 若未来要公网使用真实上传和数据库功能，需要单独部署 Node 服务

## 下一步扩展方向

- 接入真实 Python / R 执行层
- 接入项目数据库与用户权限
- 接入 Quarto 报告生成
- 接入真实 OpenAI Agent 编排
- 接入更完整的回归表、标准误与显著性检验
- 接入更严格的相似性审阅工作流
