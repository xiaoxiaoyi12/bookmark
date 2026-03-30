# Bookmark Reader

Web 端电子书阅读器 + 笔记工具 + AI 助手。支持 EPUB / PDF / 网页三种格式，左侧阅读，右侧做笔记或与 AI 对话。纯本地应用，所有数据存储在浏览器 IndexedDB，无需后端。

可部署为网页、安装为 PWA，也可通过 Tauri 打包为桌面应用（Mac / Windows）。

**在线体验**: https://xiaoxiaoyi12.github.io/bookmark/

## 功能

### 阅读

- **EPUB 阅读** — 连续滚动，目录导航，章节切换
- **PDF 阅读** — 连续滚动懒渲染，缩放（50%~400%），HiDPI 清晰渲染
- **网页阅读** — 输入 URL 自动提取正文，干净排版阅读
- **文字高亮** — 选中文字弹出工具栏，5 种颜色标注，点击取消高亮
- **全文搜索** — 在文档中搜索关键词，高亮匹配结果
- **阅读进度** — 自动保存，重新打开恢复到上次位置
- **暗色模式** — 全局暗色主题，所有阅读器完整适配

### 笔记

- **富文本编辑** — Tiptap 编辑器，支持标题/粗体/列表/引用/代码块
- **引用到笔记** — 选中书中文字一键插入笔记，自动生成引用块
- **高亮管理** — 侧边栏查看所有高亮，点击跳转到原文位置

### AI 助手

- **文档摘要** — 一键生成当前文档的 AI 摘要
- **智能问答** — 基于文档内容自由提问，AI 结合上下文回答
- **选中翻译** — 选中文字一键翻译，支持所有阅读器格式
- **流式输出** — SSE Streaming 实时逐字显示回复
- **多提供商** — 支持 OpenAI / DeepSeek / 通义千问等 OpenAI 兼容 API，自由切换
- **配置持久化** — API Key 和设置保存在本地，刷新不丢失

### 书库管理

- **多格式导入** — 拖拽或点击导入 EPUB / PDF 文件
- **网页剪藏** — 输入网页 URL，自动提取正文保存到书库
- **封面展示** — 网格布局，EPUB 自动提取封面，网页自动提取 og:image
- **备份恢复** — 导出/导入 JSON 备份，支持所有格式和笔记数据

### 多平台

- **Web** — 部署到 GitHub Pages 等静态托管，浏览器直接访问
- **PWA** — 可安装到桌面/手机主屏幕，离线可用，自动更新
- **桌面应用** — Tauri 打包为 Mac / Windows 原生应用（约 10MB）

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS 4 |
| EPUB | epub.js |
| PDF | pdfjs-dist |
| 富文本 | Tiptap (ProseMirror) |
| 存储 | Dexie.js (IndexedDB) |
| 状态 | Zustand (persist) |
| 路由 | React Router 7 |
| AI | OpenAI 兼容 API (SSE Streaming) |
| 网页提取 | @mozilla/readability |
| 桌面端 | Tauri 2 (Rust) |
| PWA | vite-plugin-pwa (Workbox) |

## 快速开始

### Web 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本（部署到 GitHub Pages）
npm run build
```

### 桌面应用（Tauri）

需要先安装 [Rust](https://rustup.rs/)：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

然后：

```bash
# 启动桌面开发模式
npm run tauri:dev

# 构建桌面应用
npm run tauri:build
```

构建产物位于：

```
src-tauri/target/release/bundle/macos/Bookmark Reader.app
```

#### 首次安装

将 `Bookmark Reader.app` 拖入 `/Applications/` 文件夹，或直接双击运行。

macOS 首次打开可能提示"无法验证开发者"，解决方法：

```bash
# 移除系统隔离标记
xattr -cr "/Applications/Bookmark Reader.app"
```

#### 更新版本

桌面端目前不支持自动更新，每次代码变更后需手动重新构建并替换：

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建（需要 Rust 环境，首次编译较慢，后续增量编译约 15 秒）
npm run tauri:build

# 3. 关闭正在运行的 Bookmark Reader

# 4. 覆盖安装到 Applications
cp -R "src-tauri/target/release/bundle/macos/Bookmark Reader.app" /Applications/

# 5. 重新打开
open "/Applications/Bookmark Reader.app"
```

> **数据不会丢失**：书库、笔记、高亮、阅读进度等数据存储在 WebView 的 IndexedDB 中，更新 .app 不影响已有数据。

## 项目结构

```
bookmark/
├── src/
│   ├── main.tsx                        # 入口
│   ├── App.tsx                         # 路由（/ 书库，/read/:id 阅读器）
│   ├── index.css                       # 全局样式
│   ├── db/index.ts                     # Dexie 数据库定义
│   ├── types/index.ts                  # TypeScript 类型
│   ├── stores/
│   │   ├── useReaderStore.ts           # 阅读器面板状态
│   │   ├── useThemeStore.ts            # 主题切换状态
│   │   └── useAIStore.ts              # AI 配置 + 面板状态
│   ├── utils/
│   │   ├── epub-metadata.ts            # EPUB 元数据提取
│   │   ├── backup.ts                   # 导出/导入备份
│   │   ├── ai-api.ts                   # OpenAI 兼容 Streaming API
│   │   └── web-fetch.ts               # 网页抓取 + 正文提取
│   ├── pages/
│   │   ├── LibraryPage.tsx             # 书库页面
│   │   └── ReaderPage.tsx              # 阅读页面（三栏布局）
│   └── components/
│       ├── ThemeToggle.tsx             # 主题切换按钮
│       ├── library/
│       │   ├── ImportDropzone.tsx       # 拖拽/点击导入
│       │   ├── BookCard.tsx            # 书籍卡片
│       │   └── BookGrid.tsx            # 网格布局
│       ├── reader/
│       │   ├── EpubReader.tsx          # EPUB 渲染器
│       │   ├── PdfReader.tsx           # PDF 渲染器（连续滚动）
│       │   ├── WebReader.tsx           # 网页渲染器
│       │   ├── TableOfContents.tsx     # 目录面板
│       │   ├── SearchBar.tsx           # 全文搜索
│       │   └── SelectionToolbar.tsx    # 选中工具栏（高亮/笔记/翻译）
│       ├── notes/
│       │   ├── NotePanel.tsx           # 笔记面板
│       │   ├── TiptapEditor.tsx        # 富文本编辑器
│       │   └── HighlightList.tsx       # 高亮列表
│       └── ai/
│           ├── AIChatPanel.tsx         # AI 对话侧边栏
│           └── AISettingsModal.tsx     # API 设置弹窗
├── src-tauri/                          # Tauri 桌面端（Rust）
│   ├── tauri.conf.json                 # Tauri 配置
│   ├── Cargo.toml                      # Rust 依赖
│   └── src/lib.rs                      # Rust 命令（网页抓取等）
├── public/                             # 静态资源
├── changelogs/                         # 变更记录
└── .github/workflows/deploy.yml        # GitHub Actions 自动部署
```

## 数据存储

所有数据存储在浏览器 IndexedDB（`bookmark-db`），刷新页面不丢失：

| 表 | 内容 |
|---|------|
| **books** | 书籍元数据 + 文件二进制（EPUB/PDF/HTML） |
| **highlights** | 高亮记录（位置、文字、颜色） |
| **notes** | 每本书一个笔记（Tiptap JSON 格式） |
| **readingProgress** | 阅读进度（EPUB CFI / PDF 页码 / Web 滚动位置） |

AI 配置（API Key、Base URL、Model）存储在 localStorage。

## 部署

项目通过 GitHub Actions 自动部署到 GitHub Pages：

- 推送到 `main` 分支 → 自动构建 → 部署到 `xiaoxiaoyi12.github.io/bookmark/`
- 使用 `peaceiris/actions-gh-pages` + `keep_files: true` 避免覆盖博客仓库其他内容

> **注意：博客仓库推送顺序**
>
> bookmark 的 CI 部署和博客本地推送操作的是同一个远程分支（`master`），可能产生历史冲突。推送博客内容前，务必先拉取远程最新内容：
>
> ```bash
> cd ~/Desktop/xiaoxiaoyi12.github.io
> git pull origin master   # 先合并 bookmark CI 的 deploy commit
> git add .
> git commit -m "your message"
> git push origin master
> ```
>
> 如果忘记 pull 直接 push 导致博客 404，恢复步骤：
> 1. `git pull origin master --rebase` 合并远程内容
> 2. `git push origin master` 推送
> 3. 在 bookmark 仓库触发一次空 commit 重新部署：`git commit --allow-empty -m "trigger: redeploy" && git push`

## 许可

MIT
