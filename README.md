# 浏览中的英语学习插件

在中文网页中适量替换英文词汇，通过悬停卡片理解当前含义，并将词汇加入单词本和复习计划。基础功能本地运行，AI 增强支持用户自填 API Key、官方预设和自定义兼容接口。

## 当前阶段

当前 v0.2.0：本地网页替换、问号词卡、16,053 词头离线词典、单词本、复习、数据备份，以及可选 AI 服务配置。170 个精选义项用于网页替换，保留原有 20 个词的收藏 ID。

- [技术架构与建设路线](docs/architecture.md)
- 首版技术栈：Chrome Manifest V3、WXT、TypeScript、React、CSS Modules、IndexedDB / Dexie、Zod。
- 原则：本地优先、业务规则独立于框架、通过接口接入外部能力、为未来服务端保留同步边界。

首版不包含 Gemini 侧边栏调用、账号订阅反代、自建服务端或账号系统。

## 开发和加载

环境：Node.js 24（至少 22.12）、pnpm 11.25。依赖版本见 pnpm-lock.yaml。

```sh
pnpm install
pnpm dev
```

构建生产扩展和检查：

```sh
npm run check
npm run zip
```

Chrome 打开 `chrome://extensions`，启用开发者模式，选择“加载已解压的扩展程序”，选中 `.output/chrome-mv3`。安装、更新和权限弹窗由使用者操作。

点击插件图标，在需要处理的中文网页上选择“在此网站开启”。单词本和设置从“打开学习空间”进入。首次不需要 API Key。

本地体验页面：

```sh
npm run demo
```

然后访问 `http://127.0.0.1:4173`，用插件为该网站开启替换。

## AI 使用

学习空间 → AI 服务 → 选择预设或填写自定义配置 → 填写 Key → 获取或手填模型 → 测试连接与选词 → 保存 → 选择当前服务 → 开启 AI。另需在“阅读偏好”为指定网站勾选“允许发送文段给 AI”。

- 支持 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages 三种协议。
- Base URL 是路径前缀：例如 `https://api.example.com/v1`；DeepSeek 官方预设使用 `https://api.deepseek.com`。
- 默认 Key 只保存本次浏览器会话，可选择在本机记住；不会被内容脚本读取或进入备份文件。
- 默认每天最多 50 次生成请求，连接测试计入。缓存命中不计入；请求失败可能仍被服务商计费，因此不返还计数。
- 真实供应商调用需要用户自己的 Key、可用模型和网络，本仓库的自动测试使用模拟响应。

## 分层目录

- `src/domain`：实体、纯规则和外部能力接口。
- `src/application`：学习、复习、替换和服务配置用例。
- `src/infrastructure`：Chrome、数据库、DOM、AI 和消息适配器。
- `src/presentation`：React 页面、卡片和 CSS Modules。
- `src/composition`、`entrypoints`：按扩展运行环境组装依赖。
- `src/contracts`：跨环境消息、备份校验和视图客户端接口。

## 词库和难度

学习空间 → 离线词典，输入英文词头/前缀或中文释义。查询结果可直接加入单词本并复习；断网也可使用。普通词典词头可能包含多个义项，尚无配套用法/例句时明确留空。网页仅替换经过整理的 170 个精选义项，涵盖工作、学习、科技和日常场景。

难度依据为 ECDICT 的有效 `frq` 词频排名，缺失时使用 `bnc`：前 2000 为基础，2001–5000 为进阶，其余为高阶。选中进阶会包含基础词。170 个精选词条中 169 个有有效排名，`plugin` 暂用人工档位；3 个词缺少音标，界面不会补造。每个词可查看分级依据。这些是产品词频档位，不是 CEFR 或考试测评；个人“已掌握/忽略”优先于难度设置。

ECDICT 数据固定于提交 `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`，按仓库 MIT 许可附带原文。来源、筛选条件、校验值记录于 `src/infrastructure/dictionary/metadata.json`，扩展也可查看许可。精选用法和例句为项目原创。

已生成的精简词典约 1.44 MB，随扩展安装，首次查词时由后台读取并校验；内容脚本只接收本页候选。正常安装和构建无需联网下载词库。维护者复现数据：从上述固定提交下载 `ecdict.csv` 到 `.cache/dictionary/ecdict.csv`，再执行 `npm run dictionary:build`；脚本校验源文件 SHA-256，拒绝未知版本。契约见 [离线词库说明](docs/dictionary-contract.md)。

## 验证

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run build
npm run test:e2e
```

端到端测试使用独立浏览器 profile 和扩展副本；仅测试副本增加 localhost 权限，不修改生产扩展的可选权限策略。测试覆盖真实网页替换、词卡收藏去重、单词本、复习、权限隔离和恢复原文。截图生成到 `docs/screenshots`。

若 Playwright 下载的浏览器在当前 Windows 无法启动，可使用已安装 Chrome 的官方扩展调试接口，仍使用测试专属 profile：

```powershell
$env:TEST_CHROME_CHANNEL = 'chrome'
npm run test:e2e
```

实际验证结果见 [验证记录](docs/verification.md)。

## 体验版边界

- 内置 16,053 个词头的精简词典，不能覆盖所有英文词。普通词典释义不会自动反转成网页替换候选。
- 使用缓存前缀树、中文分词边界和有限复合词保护（如时间戳、项目经理、环境变量）；仍无法消除全部多义词和词性歧义。AI 也仅筛选已有候选，不重写网页。
- 每段预算目前以文本节点为单位，不等同于视觉段落。跳过编辑器、输入框、代码和交互控件。
- 单词本目前查询本地全集后在界面分批展示；大规模词库分片和数据库分页后续再做。
- 当前保留每个词首次收藏的来源和上下文，尚未实现多次接触的独立记录、发音和学习统计。
- 备份恢复只新增当前词库支持的词条，不覆盖已有学习进度；暂不导出复习事件历史或 API Key。
- 无账号、云同步、真实供应商自动联测，也不自动切换服务商。

后续继续验证真实工作网站与供应商兼容性，并补齐更多精选义项、更细的语境判断、发音和接触记录。
