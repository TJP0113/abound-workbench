# ABOUND CREATION 工作台

设计工作室内部使用的网页工作台，功能包括分配任务、追踪项目进度，并与工作室的 Google Calendar 双向同步交货日期和活动安排。

- **技术**：Next.js（网站）· Firebase（Google 登录、资料库）· Google Calendar API · Vercel（托管与每日定时任务）
- **费用**：3–5 人使用时，以上服务都在免费额度内
- **语言**：中文 / English，每人可自行切换

---

## 功能一览

| 模块 | 内容 |
| --- | --- |
| 登录与权限 | Google 登录；只有员工名单上的 Gmail 能登录；管理员 / 员工两种角色；员工只能看到自己参与的项目 |
| 项目 | 6 项服务各有默认阶段（可增减、改名、排序）；一个项目可含多项服务，进度分开计算；列表 / 看板（拖动更新阶段）/ 时间线三种视图 |
| 制服定制 | 成衣 / 定制两条流程；外包记录：服装厂商、印刷厂、印刷方式、送货安排标签、款式 × 尺码数量表 |
| 社交媒体营销 | 按月循环：每月 1 日自动建立当月周期和当月任务（按贴文、短视频数量），保留过往月份记录，合约结束后自动完成 |
| 任务 | 看板按状态分栏、拖动改状态；子任务；员工提交审核 → 管理员批准或打回（必须写修改要点）；分配时显示每人本周工作量 |
| 仪表盘 | 我的任务（今天 / 本周）、待我修改、近期日程；管理员另有团队总览：进行中项目、本周到期、逾期、待审核、项目进度、逾期预警（交货前 3 天标黄，前 1 天及逾期标红）、团队工作量 |
| 日历 | 月视图 / 周视图；交货日、任务截止日、外包预计日期自动显示；可新建会议、勘察、拍摄、内部活动；与工作室 Google Calendar 双向同步 |
| 通知 | 工作台内通知：新任务、提交审核、打回、批准、明天截止、逾期、日程变动 |

---

## 第一次部署（约 30–40 分钟）

> 以下全部用 **工作室专用 Google 账号** 操作。

### 1. 建立 Firebase 项目

1. 打开 <https://console.firebase.google.com> → **建立项目**，名称例如 `abound-workbench`（Google Analytics 可以关闭）。
2. 左边 **Build → Authentication → Get started** → **Sign-in method** → 启用 **Google**，支持邮箱选工作室邮箱 → 保存。
3. 左边 **Build → Firestore Database → Create database**：
   - 位置选 **asia-southeast1 (Singapore)**
   - 选 **Production mode**
4. Firestore 建好后，点上方 **Rules** 分页，把本仓库 `firestore.rules` 的全部内容贴上去 → **Publish**。
5. 左上齿轮 **Project settings → General**，下方 **Your apps** → 点 **`</>`（Web）** 新增网页应用，名称随意，不用勾选 Hosting。完成后会看到一段 `firebaseConfig`，先记下其中的：
   `apiKey`、`authDomain`、`projectId`、`appId`
6. 同一页切到 **Service accounts** 分页 → **Generate new private key** → 下载一个 JSON 文件（**不要分享给任何人**）。

### 2. 开启 Google Calendar API

Firebase 项目同时也是一个 Google Cloud 项目。

1. 打开 <https://console.cloud.google.com>，左上角选择刚才的项目。
2. **APIs & Services → Library** → 搜索 **Google Calendar API** → **Enable**。
3. **APIs & Services → OAuth consent screen**（或「Google Auth Platform」）：
   - User type 选 **External**
   - App name：`ABOUND CREATION 工作台`，支持邮箱和开发者邮箱填工作室邮箱
   - 完成后，在 **Audience / Publishing status** 点 **Publish app**（改为 In production）。不发布的话，授权 7 天后会失效。
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**：
   - Application type：**Web application**
   - 名称：`Workbench Calendar`
   - **Authorized redirect URIs** 暂时先不填，第 3 步拿到网址后再回来填
   - 建立后记下 **Client ID** 和 **Client secret**

### 3. 部署到 Vercel

1. 打开 <https://vercel.com>，用 GitHub 账号登录。
2. **Add New → Project** → 选择 `abound-workbench` 仓库 → **Import**。
3. 展开 **Environment Variables**，按 `.env.example` 逐项加入：

   | 名称 | 填什么 |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | 第 1 步的 apiKey |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 第 1 步的 authDomain |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 第 1 步的 projectId |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | 第 1 步的 appId |
   | `FIREBASE_SERVICE_ACCOUNT` | 用记事本打开第 1 步下载的 JSON，**整个内容**复制贴上 |
   | `GOOGLE_CLIENT_ID` | 第 2 步的 Client ID |
   | `GOOGLE_CLIENT_SECRET` | 第 2 步的 Client secret |
   | `ADMIN_EMAIL` | 你自己登录用的 Gmail（第一位管理员） |
   | `CRON_SECRET` | 随便一串长密码，例如 30 个字母数字 |
   | `APP_URL` | 先留空，部署后再填 |

4. 点 **Deploy**，等 1–2 分钟完成，会得到网址，例如 `https://abound-workbench.vercel.app`。
5. 回到 Vercel 项目 **Settings → Environment Variables**，把 `APP_URL` 设为这个网址（结尾不要加 `/`），然后 **Deployments → 最新一次 → Redeploy**。

### 4. 把网址加回 Google / Firebase

1. **Firebase Console → Authentication → Settings → Authorized domains → Add domain**：加入 `abound-workbench.vercel.app`（不含 https://）。
2. **Google Cloud → Credentials → 刚才的 OAuth client** → **Authorized redirect URIs** 加入：
   `https://abound-workbench.vercel.app/api/gcal/callback` → Save。

### 5. 开始使用

1. 打开网址，用 `ADMIN_EMAIL` 那个 Gmail 登录，你会自动成为管理员。
2. **设置 → 连接 Google Calendar**，选择 **工作室专用账号**。如果出现「Google 尚未验证此应用」，点 **进阶 → 前往（不安全）** 继续即可（这是你自己的应用）。连接后，该账号下会出现「ABOUND CREATION 工作台」日历。
3. **员工 → 添加员工**：填入员工的 Gmail、姓名、角色。员工之后用该 Gmail 登录即可。

---

## 日常运作说明

- **Google Calendar 同步**：在工作台修改后约 2 秒自动同步；工作台开着时每 5 分钟读回 Google 的改动；每天凌晨 00:05 也会完整同步一次。
  - 在 Google Calendar 修改交货日 / 截止日 / 活动时间，工作台会跟着改。
  - 交货日和截止日要在工作台删除；在 Google 删除的话，下次同步会重新出现。
  - 直接在 Google 的「ABOUND CREATION 工作台」日历新建的活动，也会出现在工作台。
- **社交媒体按月循环**：每天凌晨检查，到新月份就自动建立当月周期和任务（默认指派给项目负责人）。
- **每日提醒**：明天截止的任务会通知负责人；逾期 1 天时通知负责人和管理员。

## 本地预览（开发者用）

```bash
npm install
DEMO=1 npm run dev     # 用示例资料预览，不连 Firebase
# 网址后加 ?as=a@abound.test 可切换成员工视角
```

正式运行需要 `.env.local`（参考 `.env.example`），然后 `npm run dev`。

## 文件结构

```
src/app/            页面：仪表盘、项目、项目详情、任务、日历、员工、设置、登录
src/app/api/        服务器：首位管理员、Google Calendar 连接与同步、每日定时任务
src/components/     界面组件
src/lib/            资料类型、服务与阶段、中英文字典、日期
src/lib/server/     Google Calendar 同步、社交媒体周期与提醒
firestore.rules     资料权限规则（贴到 Firebase Console）
demo/               本地预览用的示例资料
```
