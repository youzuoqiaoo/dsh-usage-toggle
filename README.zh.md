# dsh-usage-toggle

一个 DSH(DeepSeek Harness)Web 插件:为输入框下方的**用量信息行**提供**显示 / 隐藏**开关。开关是一枚紧凑的**眼睛图标**,位于输入框工具行、**模型选择器前面**;点击即可显示或隐藏输入框下方的用量信息。

```
[ 👁 ]  [ 模型选择器 ]  ContextMeter    [ 发送 ]   ← 输入框工具行
              ┌────────────────────────────┐
              │ 2 轮 · 3 步 | LLM …        │  ← 用量信息(受开关控制)
              └────────────────────────────┘
```

- **睁眼**(默认):显示用量信息
- **闭眼 + 斜线**:隐藏用量信息

它忠实复刻了内置用量行的统计(轮数/步数、LLM 与工具调用时长、TTFT、每秒 token、缓存命中率、输入/输出 token)。

> 纯客户端 UI 插件:无宿主行为,不做持久化,开关状态存在内存里,刷新页面后回到默认"显示"。

---

## 安装

这是一个普通 npm 包,DSH 通过 `cordis.patch.yml` bundle 挂载它。用 DSH CLI 安装到某个 profile:

```sh
# 从已发布的 npm 包安装:
dsh plugin --profile web add dsh-usage-toggle

# 直接从 GitHub 仓库安装:
dsh plugin --profile web add https://github.com/<你的GitHub用户名>/dsh-usage-toggle

# 从本地目录安装(开发用):
dsh plugin --profile web add dsh-usage-toggle@file:../dsh-usage-toggle
```

该命令会把包安装进 profile 的 `node_modules`、追加到 `dsh.profile.bundles`,下次启动 profile 时再通过 `cordis.patch.yml` 挂载插件行。**需要重启 profile(wib 窗口)** 才能生效。

> 注意:这是**真实插件包**,不需要会话内的动态插件授权流程,启动时即安装并挂载。

---

## 构建

仅用 TypeScript 编译(无需打包器):

```sh
npm install
npm run build
```

会生成 `lib/`(入口 `main`)和 `lib/client/`(浏览器半,通过 `exports["./client"]` 暴露,并由 `package.json` 的 `dsh.client` 声明自动发现)。

---

## 项目结构

```
dsh-usage-toggle/
├── package.json            # name/version,dsh.client + dsh.bundle.patch 声明
├── cordis.patch.yml        # 把插件行挂载进 profile 的 bundle 栈
├── tsconfig.json
├── src/
│   ├── index.ts            # 宿主半(空 apply —— 纯 UI 插件)
│   └── client/
│       └── index.ts        # 客户端半:用量行 + 眼睛图标(React)
├── lib/                    # 构建产物(已编译)
├── README.md
├── README.zh.md
└── LICENSE
```

### 两半如何工作

- **宿主半**(`lib/index.js`):一个空 `apply`,让包在宿主名册上注册一个行。
- **客户端半**(`lib/client/index.js`):通过 `exports["./client"]` 暴露、由 `dsh.client` 声明自动发现。它注册到:
  - `conversation.composer.dock` — 替换内置的 `stats` 单元格,渲染受开关控制的用量行。
  - `conversation.input.right` — 在模型选择器前添加眼睛开关,通过模块级 store 与用量行共享状态。

---

## 发布到 GitHub

1. **创建仓库**,更新 `package.json` 里的链接(`repository.url`、`homepage`),然后推送:

   ```sh
   git init
   git add .
   git commit -m "dsh-usage-toggle: 初始提交"
   git branch -M main
   git remote add origin git@github.com:<你的GitHub用户名>/dsh-usage-toggle.git
   git push -u origin main
   ```

2. **发布到 npm**(让别人可 `dsh plugin add dsh-usage-toggle`):

   ```sh
   npm login
   npm publish --access public
   ```

   `publishConfig.access` 已经是 `public`;`package.json` 的 `files` 已列出要发布的产物。

3. **仅从 GitHub 安装**(不发 npm)也可用上面的 git 地址。

---

## 许可证

MIT
