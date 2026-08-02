# Liquid Words — 液态玻璃英语单词学习

## 产品概述

一款采用 Apple Liquid Glass 设计语言的英语单词学习网页，内置 2450 个单词（按 8 个 Part、71 个 List 分组），提供浏览、翻卡记忆、搜索、生词本和学习进度追踪功能。整体视觉以深色流动渐变背景搭配半透明玻璃质感卡片，营造沉浸式学习体验。

## 核心功能

### 1. 单词浏览
- 按 Part（Part One ~ Part Eight）分级，每个 Part 下按 List 分组
- 单词卡片展示：单词、音标、中文释义
- 支持 List 内分页/滚动加载，避免一次性渲染过多卡片
- 点击卡片可展开详情（完整释义、所属 Part/List）

### 2. 翻卡记忆模式
- 选中一个 List 后进入翻卡模式
- 卡片正面显示单词+音标，点击翻转后显示释义
- 支持上一张/下一张切换，键盘左右方向键操作
- 标记"认识"或"不熟"，不熟的单词自动加入生词本

### 3. 单词搜索
- 全局搜索框，实时匹配单词、音标、释义
- 搜索结果以列表展示，点击跳转详情

### 4. 生词本
- 用户可将单词标记为生词
- 生词本页面集中展示所有标记的单词
- 支持在生词本中进行翻卡复习
- 支持移除已掌握的生词

### 5. 学习进度追踪
- 记录每个 List 的翻卡学习进度（已翻卡片数 / 总数）
- 记录每个 Part 的整体完成百分比
- 所有数据存储在 localStorage，无需登录

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 学习概览：总进度、Part 导航卡片、快速入口 |
| `/browse` | 单词浏览 | Part/List 选择 + 单词卡片网格 |
| `/browse/:part/:list` | 指定 List 浏览 | 展示选中 List 的所有单词 |
| `/flashcards/:part/:list` | 翻卡模式 | 全屏翻卡学习 |
| `/search` | 搜索 | 全局单词搜索 |
| `/starred` | 生词本 | 已标记的生词列表+翻卡复习 |

## 数据模型

### 单词数据（内置 JSON）
```typescript
interface Word {
  id: number;
  part: string;       // "Part One"
  list: string;       // "List 1"
  word: string;       // "man"
  phonetic: string;   // "/mæn/"
  meaning: string;    // "n. 男人；人类 (复数:men)"
}
```

### 本地存储（localStorage）
- `liquid-words:progress` — `{ [listKey]: { reviewed: number, total: number } }`
- `liquid-words:starred` — `number[]`（单词 id 数组）
- `liquid-words:known` — `number[]`（已掌握单词 id 数组）

## 设计风格

**Liquid Glass（液态玻璃）**
- 深色动态渐变背景（紫蓝→粉红流动）
- 所有卡片采用 `backdrop-filter: blur + saturate + contrast` 实现玻璃质感
- 边缘高光：`inset 0 1px 0 rgba(255,255,255,0.3)`
- 圆角 20-32px，柔和阴影
- 半透明层叠，内容若隐若现
