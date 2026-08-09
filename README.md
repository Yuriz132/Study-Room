## 📎 相关资源与部署教程

- 白嫖monkeycode理论永久服务器教程：[docx 下载](https://ncstatic-file.clewm.net/rsrc/2026/0809/10/785d5018effb6e5e4dbbc25f4bdcaef7.docx)
- 白嫖阿里云服务器300学生优惠免费至少半年：[docx 下载](https://ncstatic-file.clewm.net/rsrc/2026/0809/10/4d72a60d69ad91eef2fe2bea28086b79.docx)

- 项目预览地址：https://sanzizyf.asia/sr/
- 项目开源地址：https://github.com/Yuriz132/Study-Room

---

# Study Room · 升本词汇学习平台

> 一个面向**专升本英语词汇**学习的现代化 Web 应用：集词汇学习、AI 智能辅助、社交社区、实时单词 PK、自习室与学习统计于一体。液态玻璃（Liquid Glass）质感 UI，移动端优先，支持深色模式。

- 前端：React 19 + Vite 7 + TypeScript + Tailwind CSS v4 + Radix UI
- 后端：Node.js + Express 4 + TypeScript + Socket.IO 4 + Zod
- 存储：**JSON 文件**（零数据库，开箱即用）
- 实时：Socket.IO（在线状态、单词 PK、私信、自习室）
- 许可：MIT

---

## ✨ 功能特性（完整清单）

下面把项目「一点一点扒」出来的全部功能按模块列出。

### 一、词汇学习核心

| 功能 | 说明 |
|---|---|
| **单词浏览** (`Browse`) | 单词列表分页浏览，支持按单元 / 字母筛选 |
| **单词搜索** (`Search`) | 按单词、释义、词性全局搜索 |
| **闪卡学习** (`Flashcards`) | 卡牌式记忆，正面单词 / 反面释义，支持标记掌握 |
| **自定义闪卡** (`CustomFlashcards`) | 用户自建闪卡组，独立练习 |
| **自定义词库** (`CustomLibrary`) | 导入 / 维护个人词库，脱离内置词表 |
| **易混淆词** (`Confusables`) | 形近 / 义近词对比记忆 |
| **随身听** (`Listen`) | 循环播放单词发音，「路上磨耳朵」 |
| **单词测验** (`Quiz`) | 选择题 / 拼写题自测，即时判分 |
| **沉浸式学习** (`ImmersiveLearn`) | 全屏沉浸背词，含「大家的灵光一现」社区灵感墙 |
| **单词详情 + 评论** (`WordCard` / `WordComments`) | 单字释义、例句，以及用户对该词的讨论区 |
| **收藏** (`Starred`) | 收藏单词 / 文章，集中复习 |
| **错题合集** (`WrongBookPanel`) | 拍照 / 文本收集错题，支持建多个合集分别归类；每个合集内置**隔离的 AI 错题教练**（仅基于本合集错题分析薄弱点、出题、给建议） |

### 二、AI 智能功能 ⭐

| 功能 | 入口 | 后端接口 | 说明 |
|---|---|---|---|
| **AI 学习助手** | 悬浮按钮 `AIChatFAB` / `StudyAssistantChat` | `POST /api/ai/chat` | 专注河南专升本英语词汇与语法的对话助手，对话保存在本机 |
| **AI 智能导入** | `AIImportPanel` | `POST /api/ai/vision/extract-words` | 拍照 / 上传图片 → 视觉模型自动识别并整理出单词（补中文释义），一键加入词库 |
| **AI 英语文章** | `ArticleGen` | `POST /api/ai/chat` | 用你已掌握 / 已收藏的单词，生成适合专升本水平的英语短文，并自动存入收藏页的「笔记」 |
| **AI 个人学习总结** | `Summary` / `PersonalSummary` | `POST /api/ai/chat` | 基于真实学习数据（已学词数、掌握词数、连续天数）生成「有温度、可执行」的下一步建议 |
| **AI 每日英语谚语** | 首页 (`Index`) | `POST /api/ai/chat` | 首页展示 AI 生成的英语谚语 + 中文注释，可在「更多设置」关闭 |
| **错题合集 · AI 错题教练** | `WrongBookPanel` / `WrongBookChat` | `POST /api/wrongbook/:id/chat`、`POST /api/ai/vision/extract-words` | 每个合集的 AI 对话**隔离**——系统提示词只携带该合集的错题，不串台；支持「分析不足 / 生成知识点 / 生成新题 / 生成建议」一键指令；拍照的错题复用视觉模型提取题目原文 |

> 所有 AI 调用都经由**后端代理**（`backend/src/modules/ai.ts`），API Key 只存在于服务端环境变量，绝不暴露到前端。

### 三、社交与社区

| 功能 | 说明 |
|---|---|
| **社区 / 论坛** (`Community`) | 5 大板块：全部 / 公告 / 娱乐 / 学习 / 疑难 / 日常；发帖、评论、点赞、板块分类 |
| **公开笔记** (`PublicNotes`) | 用户可发布公开学习笔记，供社区查阅 |
| **好友** (`Friends`) | 好友列表、实时在线状态、通过私信邀请加好友 |
| **私信** (`Dm`) | 一对一聊天：展示对方真实在线状态、内置安全提醒（可展开）、进入不自动弹键盘、界面固定单屏不滚动 |
| **用户主页** (`User`) | 查看他人学习数据，可发私信 / 加好友 |
| **在线状态** (`presence`) | 基于 Socket.IO 的全局在线状态，好友列表与聊天页统一呈现 |

### 四、竞技与激励

| 功能 | 说明 |
|---|---|
| **单词 PK 实时对战** (`Battle`) | 基于 Socket.IO 实时匹配对手，比拼谁背得又快又准 |
| **学习排行榜** (`Leaderboard`) | 公开的学习数据排行，激励坚持 |

### 五、学习工具

| 功能 | 说明 |
|---|---|
| **自习室** (`StudyRoom`) | 与好友实时「一起学」，互相督促 |
| **番茄钟** (`Pomodoro`) | 专注 / 短休 / 长休，计时结束震动提醒 |
| **学习计划** (`Plans` / `StudyPlans`) | 制定并管理个人学习计划 |
| **学习日历** (`StudyCalendar`) | 按日历查看学习打卡 |
| **学习图表** (`StudyChart`，recharts) | 学习量、连续天数等可视化统计 |
| **复习提醒** (`ReviewReminder`) | 根据遗忘曲线推送复习 |
| **每日壁纸** (`DailyWallpaper`) | 每日随机壁纸，提升沉浸感 |
| **进度导入 / 导出** (`ProgressIO`) | 学习进度本地备份与恢复 |

### 六、账户与系统

| 功能 | 说明 |
|---|---|
| **登录 / 注册** (`Login`) | 极验（Geetest 4 代）人机验证；登录成功轮换 Token（Bearer 鉴权） |
| **我的** (`Account`) | 头像、个性签名、修改密码；头像违规可被封禁 |
| **更多设置** (`More`) | 界面动效开关（弱机自动降级）、AI 每日谚语开关、单词 PK 入口、**管理员面板** |
| **签到领会员** (`Starred`) | 每日 **6:30–7:00** 早起时段签到；连续签满 **7 天**可领会员，**名额仅 1 份，最早签满者优先**（活动 8 月 5 日起） |
| **管理员能力** | 注销任意用户账号，并级联清理其全部帖子 / 评论；封禁用户头像 |

---


## ⚠️ 已知未完全实现（Known Limitations）

本项目功能持续迭代，以下条目在 README 中虽已列出，但当前代码中**尚未完全落地**，列于此供参考（是否保留 / 删除由社区决定）：

| 功能 | 现状 |
|---|---|
| **单词浏览**：分页 / 字母筛选 | 目前仅有「单元树形浏览」，分页与按字母筛选入口暂未提供 |
| **易混淆词（Confusables）** | 组件代码存在，但未挂载到任何界面入口，暂不可访问 |
| **单词详情 + 评论（WordCard / WordComments）** | 无独立单词详情页；`WordComments` 评论组件未被任何页面引用（死代码） |
| **「我的」修改密码** | 代码中无修改密码 UI（仅有注销账号的密码确认），README 所述未实现 |

> 其余功能均已实现并在线上运行。

## 🛠 技术栈

**前端**

- React 19 · TypeScript · Vite 7
- Tailwind CSS v4（`@tailwindcss/vite`，`line-clamp` 等核心内置）
- Radix UI 全家桶（无障碍组件）
- framer-motion + GSAP（动效）、@gsap/react
- react-router-dom 7（路由）、@tanstack/react-query（数据请求）
- socket.io-client（实时）
- recharts（图表）、zod（校验）、lucide-react（图标）、sonner（Toast）、cmdk（命令面板）、vaul（抽屉）、react-hook-form

**后端**

- Node.js + Express 4 · TypeScript
- Socket.IO 4（实时通信）
- Zod（参数校验）、Pino + pino-http（结构化日志）
- dotenv、compression、cors
- 存储：JSON 文件（`backend/data/`），无数据库依赖

**部署**

- Nginx（静态托管 + 反向代理 + WebSocket 升级）
- systemd（后端常驻服务）
- Let's Encrypt（HTTPS，可选但强烈建议）

---

## 📁 目录结构

```
study-room/
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── pages/            # 26 个页面（Index/Community/Dm/Battle/...）
│   │   ├── components/       # 40+ 组件（AIImportPanel/StudyAssistantChat/LiquidGlass/...）
│   │   ├── lib/              # api-client、auth 等
│   │   └── ...
│   ├── vite.config.ts        # base: './'，适配子路径部署
│   └── package.json
├── backend/                  # Express 后端
│   ├── src/
│   │   ├── modules/          # 18 个业务模块（auth/ai/forum/comments/dm/pk/...）
│   │   ├── config/           # env.ts / logger.ts
│   │   ├── middleware/       # 错误处理 / 日志
│   │   └── index.ts          # 入口：挂载 Express + Socket.IO
│   ├── data/                 # JSON 运行数据（已被 gitignore，不入库）
│   └── package.json
├── README.md
└── LICENSE
```

---

## 🚀 快速开始（本地开发）

> 需要 Node.js ≥ 18 与 pnpm（或 npm / yarn）。

```bash
# 1. 克隆
git clone https://github.com/<your-username>/Study-Room.git
cd Study-Room

# 2. 后端
cd backend
cp .env.example .env          # 填入 AI / 极验等密钥（见下文「环境变量」）
pnpm install
pnpm dev                      # tsx watch，默认 http://localhost:3000

# 3. 前端（另开一个终端）
cd ../frontend
cp .env.example .env          # 填入 VITE_API_BASE_URL / VITE_GEETEST_CAPTCHA_ID
pnpm install
pnpm dev                      # Vite，默认 http://localhost:5173
```

前端开发服务器已配置 `/api` → `http://localhost:3000` 代理（含 WebSocket），本地直接可用。

---

## 🔐 环境变量

### 后端 `backend/.env`

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `3000` | 后端监听端口 |
| `API_PREFIX` | `/api` | REST 前缀 |
| `CORS_ORIGIN` | `*` | 允许的来源；生产请改为前端域名（如 `https://your-domain.com`） |
| `RATE_LIMIT_WINDOW_MS` | `900000` | 限流窗口（ms） |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | 窗口内最大请求数 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `AI_BASE_URL` | `https://api.agnes-ai.cn/v1` | **AI 端点（OpenAI 兼容）** |
| `AGNES_API_KEY` | 空 | AI 鉴权 Key（也可用 `STEP_API_KEY`） |
| `STEP_API_KEY` | 空 | AI 鉴权 Key 备选 |
| `AI_CHAT_MODEL` | `agnes-2.5-flash` | 对话 / 文章 / 总结所用模型 |
| `AI_VISION_MODEL` | `agnes-2.5-flash` | 图片识词所用视觉模型 |
| `AI_REASONING_EFFORT` | `low` | 推理强度 |
| `MIMO_BASE_URL` | `https://api.xiaomimimo.com/v1` | 第二套 AI 端点（OpenAI 兼容） |
| `MIMO_API_KEY` | 空 | 第二套 AI Key |
| `MIMO_MODEL` | `mimo-v2.5` | 第二套 AI 模型 |
| `GEETEST_CAPTCHA_ID` | 空 | 极验前端 ID（与前端 `VITE_GEETEST_CAPTCHA_ID` 一致） |
| `GEETEST_CAPTCHA_KEY` | 空 | 极验后端 Key（**保密**） |

### 前端 `frontend/.env`

| 变量 | 示例 | 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` 或 `/vs/api` | API 基础地址（后端地址 + `/api`） |
| `VITE_GEETEST_CAPTCHA_ID` | — | 极验前端 ID（公开，从极验后台获取） |

> ⚠️ `.env` 已被 `.gitignore` 忽略，里面含密钥，**请勿提交**。仓库仅保留 `.env.example` 占位模板。

---

## 📦 详细部署教程（含 AI 配置）⭐⭐⭐

下面是一份**从零到上线**的保姆级教程，重点展开 AI 相关配置。示例域名用 `your-domain.com`、服务器 IP 用 `your-server-ip`，请自行替换。

### 第 1 步：准备服务器

- 一台 Linux 服务器（Ubuntu 22.04 推荐），开放 80 / 443 端口。
- 安装 Node.js（≥ 18）与 pnpm：

```bash
# 安装 Node 18+（以 NodeSource 为例）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
# 安装 pnpm
sudo npm i -g pnpm
# 安装 Nginx
sudo apt-get install -y nginx
```

> 本项目后端用**文件存储**，无需数据库。若用中国大陆服务器，**务必先完成 ICP 备案**，否则浏览器会对未备案域名提示「此网站有风险」。

### 第 2 步：克隆并安装依赖

```bash
git clone https://github.com/<your-username>/Study-Room.git
cd Study-Room
cd backend && pnpm install && cd ..
cd frontend && pnpm install && cd ..
```

### 第 3 步：配置后端

```bash
cd backend
cp .env.example .env
nano .env          # 填入下面的 AI / 极验变量
```

`backend/.env` 关键项（其余保持默认即可）：

```ini
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-domain.com
AI_BASE_URL=https://api.agnes-ai.cn/v1
AGNES_API_KEY=sk-your-agnes-key
AI_CHAT_MODEL=agnes-2.5-flash
AI_VISION_MODEL=agnes-2.5-flash
AI_REASONING_EFFORT=low
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_API_KEY=sk-your-mimo-key
MIMO_MODEL=mimo-v2.5
GEETEST_CAPTCHA_ID=你的极验ID
GEETEST_CAPTCHA_KEY=你的极验KEY
```

构建后端：

```bash
pnpm build       # tsc 编译到 dist/
```

### 第 4 步：配置 AI 服务（重点）⭐

本项目所有 AI 功能都走**后端代理**（`POST /api/ai/chat`、`/api/ai/vision/extract-words`、`/api/ai/mimo`），只要端点**兼容 OpenAI `/v1/chat/completions` 协议**即可，你可以任选其一：

| 你想用的服务 | 怎么配 |
|---|---|
| **agnes-ai.cn** | `AI_BASE_URL=https://api.agnes-ai.cn/v1` + `AGNES_API_KEY=<key>`（项目默认，开箱即用） |
| **xiaomimimo.com** | 用于 `/api/ai/mimo`：`MIMO_BASE_URL=https://api.xiaomimimo.com/v1` + `MIMO_API_KEY=<key>` |
| **OpenAI / DeepSeek / 通义 / 智谱 等** | 把 `AI_BASE_URL` 改成对应 `/v1`，`AGNES_API_KEY` 改成对应 Key，模型名改成对应模型（如 `deepseek-chat`） |
| **本地 Ollama** | `AI_BASE_URL=http://127.0.0.1:11434/v1` + `AGNES_API_KEY=ollama`（Ollama 忽略 Key），模型填本地模型名 |
| **自建兼容网关** | 任意 OpenAI 兼容代理地址均可 |

> 图片识词依赖**视觉模型**（`AI_VISION_MODEL`），请确保其支持图片输入；若你的端点不支持视觉，AI 智能导入功能会失败，可改用支持视觉的模型或关闭该入口。
>
> 若 `MIMO_API_KEY` 缺失，访问 `/api/ai/mimo` 会返回 `503 AI 服务未配置`，不影响其它 AI 功能。

### 第 5 步：配置极验（注册 / 登录人机验证）

1. 到 [geetest.com](https://www.geetest.com/) 注册，创建「行为验 4 代」应用。
2. 拿到 `CAPTCHA_ID`（前端用）和 `CAPTCHA_KEY`（后端用）。
3. 后端 `.env` 填 `GEETEST_CAPTCHA_ID` / `GEETEST_CAPTCHA_KEY`。
4. 前端 `frontend/.env` 填 `VITE_GEETEST_CAPTCHA_ID`（公开，无 secret）。

> 若暂时不想接极验：把 `backend/src/modules/auth.ts` 中 `verifyGeetest(...)` 的校验临时放行即可（仅测试用，生产务必开启）。

### 第 6 步：构建前端

```bash
cd frontend
cp .env.example .env
nano .env         # VITE_API_BASE_URL 与 VITE_GEETEST_CAPTCHA_ID
```

```ini
# 根路径部署（推荐）：
VITE_API_BASE_URL=/api
# 或子路径部署（如挂在 /vs）：
# VITE_API_BASE_URL=/vs/api
VITE_GEETEST_CAPTCHA_ID=你的极验ID
```

```bash
pnpm build       # 产物在 frontend/dist/，base 为相对路径，可挂在任意子目录
```

### 第 7 步：配置 Nginx

下面给**根路径部署**示例（最通用）。若挂在子路径（如 `/vs`），见文末「子路径说明」。

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 前端静态文件
    root /path/to/Study-Room/frontend/dist;
    index index.html;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO（WebSocket 升级，必须）
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA 前端路由（其余请求回退 index.html）
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 第 8 步：用 systemd 托管后端

新建 `/etc/systemd/system/study-room-backend.service`（注意 `User` 要对 `backend/data` 有写权限）：

```ini
[Unit]
Description=Study Room Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/Study-Room/backend
ExecStart=/usr/bin/node /path/to/Study-Room/backend/dist/index.js
EnvironmentFile=/path/to/Study-Room/backend/.env
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now study-room-backend
sudo systemctl status study-room-backend
```

> ⚠️ 务必保证运行用户（上例 `www-data`）对 `backend/data/` 目录有**读写权限**，否则登录时因 Token 轮换写库会报 `EACCES`。
> 修复权限：`sudo chown -R www-data:www-data /path/to/Study-Room/backend/data`。

### 第 9 步：HTTPS（强烈建议）

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot 会自动把 80 跳转 443 并配置证书。证书每 90 天自动续期。

### 第 10 步：启动与验证

1. 浏览器打开 `https://your-domain.com`。
2. 注册账号（需通过极验），登录后首页应显示「AI 每日英语谚语」。
3. 进入「AI 智能导入」拍照一张单词书页，确认能识别并整理出单词（验证视觉模型）。
4. 进入「AI 英语文章」生成一篇短文（验证对话模型）。
5. 打开两个浏览器分别登录两个账号，进入「单词 PK」确认能实时匹配对战（验证 Socket.IO）。

### 子路径部署（如挂在 `/vs`、`/sr`）

前端已内置子路径自动识别：`/vs` 与 `/sr` 两种前缀下，API 前缀（`/vs/api`、`/sr/api`）、SPA 路由 `basename`、Socket.IO 路径、静态资源前缀均会自动切换，**通常无需设置 `VITE_API_BASE_URL`**（仅安卓 APK 等无代理场景才用构建期注入的绝对地址覆盖）。

Nginx 只需为子路径加 3 类 location（SPA 根 + API 反代 + Socket.IO 升级），例如挂在 `/vs`：

```nginx
location /vs/ {
    alias /path/to/Study-Room/frontend/dist/;
    try_files $uri $uri/ /vs/index.html;
}
location /vs/api/  { proxy_pass http://127.0.0.1:3000/api/; /* + 通用 proxy 头 */ }
location /vs/socket.io/ { proxy_pass http://127.0.0.1:3000/socket.io/; /* + Upgrade 头 */ }
```

本仓库附带一份**可直接复用的 `/sr` 预览部署样例**（线上同款）：

- [`deploy/nginx-sr.conf`](./deploy/nginx-sr.conf) —— 加入 443 server 块的 5 个 `/sr` location（含 assets 长缓存、SPA 回退、API 与 Socket.IO 反代到 3100）。
- [`deploy/study-room-backend.service`](./deploy/study-room-backend.service) —— systemd 单元，后端监听 `3100`，与 `/vs` 实例（3000）互不干扰。

> 演示站（`/sr`）出于开源预览目的**关闭了极验人机验证**：只要不配置 `VITE_GEETEST_CAPTCHA_ID` 与后端 `GEETEST_CAPTCHA_ID`，注册即免验证码；同时所有用户/社交数据已清空，仅保留词库。

### 故障排查

| 现象 | 排查 |
|---|---|
| 登录报 500 / `EACCES` | 后端运行用户对 `backend/data/` 无写权限 → 第 8 步 chown |
| 注册提示「请先完成人机验证」 | 极验未配置或 `VITE_GEETEST_CAPTCHA_ID` 与后端 `GEETEST_CAPTCHA_ID` 不一致 |
| AI 功能 503「AI 服务未配置」 | 对应 `AGNES_API_KEY` / `MIMO_API_KEY` 缺失或未重启后端 |
| AI 返回空 / 识别失败 | 模型名错误、端点不兼容、或视觉模型不支持图片 |
| 单词 PK / 私信连不上 | Nginx 未配置 `/socket.io/` 的 `Upgrade` 头（第 7 步） |
| 刷新子路径页面 404 | Nginx `try_files` 未回退到 `index.html` |

---

## 📡 API 概览

| 模块 | 主要端点 |
|---|---|
| 认证 | `POST /api/auth/register`、`POST /api/auth/login`、`PUT /api/auth/password` |
| 账户 | `DELETE /api/account/`（自注销）、`DELETE /api/account/admin/:username`（管理员注销） |
| 评论 | `POST /api/comments`、`/api/comments/admin/author/:author`（管理员清评） |
| AI | `POST /api/ai/chat`、`POST /api/ai/vision/extract-words`、`POST /api/ai/mimo` |
| 排行榜 | `GET /api/leaderboard` |
| 公开笔记 | `GET/POST /api/public-notes` |
| 论坛 | `GET/POST /api/forum/posts`、板块筛选、`DELETE /api/forum/posts/admin/author/:author`（管理员清帖） |
| 好友 | `GET/POST/DELETE /api/friends` |
| 私信 | `GET/POST /api/dm`、`POST /api/dm/invite`（好友邀请） |
| 错题合集 | `GET/POST /api/wrongbook`、`DELETE /api/wrongbook/:id`、`POST/DELETE /api/wrongbook/:id/items`、`POST /api/wrongbook/:id/chat`（均需登录；数据随账号持久化、跨设备同步） |
| 系统 | `GET /api/system/health` |

实时能力（Socket.IO）：在线状态、单词 PK 对战、私信、自习室共学、学习状态广播。

---

## 🔒 安全

安全架构、部署安全建议（强制 HTTPS、密钥管理、最小权限运行、SSH 加固）与漏洞负责任披露方式，请见 [SECURITY.md](./SECURITY.md)。

## 📄 许可证

[MIT](./LICENSE) © 2026 Study Room


## 部署须知（低配 ECS 必读）

> 低配服务器（单核 / ≤2GB 内存）部署前端时，**禁止**运行 `tsc -b` 全量类型检查 —— 曾因此导致 CPU/内存打满、服务器卡死重启。

- 部署构建：`pnpm build`（已改为仅 `vite build`，约 10 秒完成，无资源压力）
- 完整类型检查：`pnpm build:full`（含 `tsc -b`），仅在高配机器或 CI 中执行，不要在本机跑
- 推荐做法：类型检查放到 CI（GitHub Actions 等）高配 runner 执行，ECS 只负责 `vite build` + 部署
