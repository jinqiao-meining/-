# 经济学研究 Agent 门户

这是一个部署在 GitHub Pages 上的经济学研究门户第一版。

当前版本重点不是完整后端，而是先把教授端入口、研究流程框架、Agent 分工、项目规划器和学术诚信审阅模块部署上线，作为后续接入真实数据分析服务的前台门户。

## 当前能力

- 经济学研究门户首页
- 六大 Agent 分工展示
- 引导式研究项目规划器
- 学术诚信与 AI 痕迹风险审阅说明
- 已归档公开资料展示

## 目录结构

- `docs/index.html`
  门户首页
- `docs/styles.css`
  门户样式
- `docs/app.js`
  页面交互逻辑
- `docs/content.json`
  归档内容索引
- `docs/files/`
  已公开资料文件
- `scripts/add-content.ps1`
  手动加入新公开资料的脚本

## 发布方式

GitHub Pages 选择：

- Branch: `main`
- Folder: `/docs`

## 下一步扩展方向

- 接入真实数据上传后端
- 接入 Python / R 任务执行层
- 接入数据库与项目日志系统
- 接入真实 OpenAI Agent 编排
- 接入 Quarto 报告生成
- 接入相似性审阅和人工审稿工作流
