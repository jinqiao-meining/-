# 公开资料站仓库

这是一个适合放到 GitHub Pages 的公开站点仓库。

## 目录说明

- `docs/`
  GitHub Pages 站点目录
- `docs/content.json`
  公开内容索引
- `docs/files/`
  实际资料文件
- `scripts/add-content.ps1`
  手动添加新内容的脚本

## 首次发布到 GitHub

1. 在 GitHub 上创建一个新的公开仓库。
2. 把当前 `public_site` 文件夹内容上传到仓库根目录。
3. 打开 GitHub 仓库设置。
4. 进入 `Settings > Pages`。
5. 在 `Build and deployment` 中选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
6. 保存后等待 GitHub Pages 发布完成。

发布后，公开链接通常会是：

`https://你的用户名.github.io/你的仓库名/`

## 后续手动上传新内容

在仓库根目录运行：

```powershell
.\scripts\add-content.ps1 `
  -Title "Python 第二章作业答案" `
  -Category "Python" `
  -SourceFile "C:\你的文件路径\chapter2.pdf" `
  -HtmlFile "C:\你的文件路径\chapter2.html" `
  -Summary "第二章题目答案与知识点整理"
```

如果只有 PDF，没有 HTML，也可以不传 `-HtmlFile`。

然后执行：

```powershell
git add .
git commit -m "add new content"
git push
```

## 适合放进去的内容

- 作业答案
- 讲义
- 报告
- 学习笔记
- PDF 资料
- HTML 可视化页面

## 后续可扩展

- 自动把某个文件夹的新 PDF 扫描后加入站点
- 自动生成封面图和摘要
- 按课程分类、按日期筛选
- 绑定自定义域名
