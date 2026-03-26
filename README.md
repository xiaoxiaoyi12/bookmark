# BookMark

Web 端电子书阅读器 + 笔记工具。左侧阅读，右侧做笔记，选中文字可高亮并引用到笔记。纯本地应用，数据存储在浏览器 IndexedDB，无需后端。

## 功能

- **书库管理** — 拖拽或点击导入 EPUB / PDF，封面网格展示，支持删除
- **EPUB 阅读** — 连续滚动，目录导航，章节切换，暗色主题适配
- **PDF 阅读** — 连续滚动懒渲染，缩放（50%~400%），HiDPI 支持
- **文字高亮** — 选中文字弹出工具栏，5 种颜色，高亮持久化
- **笔记编辑** — Tiptap 富文本编辑器，标题/粗体/列表/引用/代码块
- **引用到笔记** — 选中书中文字一键插入笔记，自动生成引用块
- **阅读进度** — 自动保存，重新打开恢复到上次位置
- **面板布局** — 目录/笔记面板可折叠，笔记面板宽度可拖拽调整

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
| 状态 | Zustand |
| 路由 | React Router 7 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 项目结构

```
src/
├── main.tsx                    # 入口
├── App.tsx                     # 路由（/ 书库，/read/:id 阅读器）
├── index.css                   # 全局样式 + Tiptap/PDF 文字层样式
├── db/index.ts                 # Dexie 数据库（books, highlights, notes, readingProgress）
├── types/index.ts              # TypeScript 类型定义
├── stores/useReaderStore.ts    # Zustand 状态（面板开关）
├── utils/epub-metadata.ts      # EPUB 元数据提取
├── pages/
│   ├── LibraryPage.tsx         # 书库页面
│   └── ReaderPage.tsx          # 阅读页面（三栏布局）
└── components/
    ├── library/
    │   ├── ImportDropzone.tsx   # 拖拽导入
    │   ├── BookCard.tsx        # 书籍卡片
    │   └── BookGrid.tsx        # 网格布局
    ├── reader/
    │   ├── EpubReader.tsx      # EPUB 渲染器
    │   ├── PdfReader.tsx       # PDF 渲染器（连续滚动）
    │   ├── TableOfContents.tsx # 目录面板
    │   └── SelectionToolbar.tsx# 选中工具栏
    └── notes/
        ├── NotePanel.tsx       # 笔记面板
        ├── TiptapEditor.tsx    # 富文本编辑器
        └── HighlightList.tsx   # 高亮列表
```

## 数据模型

- **books** — 书籍元数据 + 文件二进制数据
- **highlights** — 高亮记录（位置、文字、颜色）
- **notes** — 每本书一个笔记（Tiptap JSON）
- **readingProgress** — 阅读进度（EPUB CFI / PDF 页码）

所有数据存储在浏览器 IndexedDB `bookmark-db` 中，刷新页面不丢失。
