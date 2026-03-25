# 经济学研究 Agent 门户

这是一个面向经济学教授与课题组的研究平台原型。

当前已经进入第 3 版：除了 GitHub Pages 上的门户与工作台页面，还增加了本地 Node 后端、SQLite 数据库、文件登记接口、研究日志接口和诚信审阅接口。

## 当前能力

- 门户首页：展示研究流程、Agent 分工与工作台入口
- 研究工作台：保存项目、登记文件、记录日志、查看分析模板
- 本地后端：`Express + SQLite`
- 文件上传：通过后端登记并保存在本地 `uploads/`
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
- 接入研究结果导出与图表下载
- 接入更严格的相似性审阅工作流
