# 离线词库契约（v0.2）

DictionaryPort.list 只返回经过整理、有明确中文触发词、原创用法和双语例句的替换义项。查询词典不自动加入网页候选。get 按稳定 ID 解析可收藏词条；search 支持英文精确/前缀及中文释义查询，返回最多 30 条及总命中数；info 返回离线词典规模、可替换词条数、版本和来源。

新增内部消息 dictionary-search：query 为去除首尾空白后的 1–80 字符，返回 {words: Word[], total: number}。只有扩展页面有权查询。Web 内容脚本仍只可分析/收藏/标记认识。所有查询只读随扩展打包的数据，没有远端请求。

Word 新增可选 source（curated/ecdict）和 levelReason，不破坏 v1 备份。旧 20 个义项 ID 保留。普通词典词条采用 ecdict:<英文词头> ID，可以收藏和复习；不具备原创用法/例句时字段为空，视图明确说明，不伪造内容。导入按词库重新解析，备份里的释义不直接信任。

词频档位不等同于 CEFR 或考试等级：优先采用 ECDICT frq 有效正排名，否则 bnc；1–2000 基础、2001–5000 进阶、5001 及以后高阶。精选词条缺少排名时保留人工档位并标注依据；普通词典缺少排名时仅暂按高阶展示，明确说明无有效词频。熟悉度单独保存，已掌握/忽略始终优先过滤。

数据构建固定 ECDICT Git 提交与 SHA-256，保留原始许可，输出确定性的精简词库及元数据。生成脚本可从本地缓存复现；普通开发和插件运行均不需要下载词库。

## 当前数据包

- 固定提交：`bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`。
- 源 CSV SHA-256：`1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf`。
- 英文小写词头（含连字符）、中文释义非空；有效 frq 或 bnc 排名不大于 15000，或带 zk/gk/cet4/cet6 标签，或属于精选词条。保留释义至多 1000 字符。
- 共 16,053 词头，1,440,918 字节；资源仅由扩展后台读取，首次查词时惰性加载并复用单个 Promise。
- 精选替换 170 个义项，169 个有效词频；plugin 无有效排名，采用人工档位。plugin/webpage/website 缺少音标，保持留空。
- 前缀树按不可变词库数组缓存。中文边界通过 TextBoundaryPort 注入，基础层使用 Intl.Segmenter；有限复合词保护表补充分词局限，并不保证一般词义消歧。
- 查询结果英文精确优先、前缀其次、中文释义再次；精选义项覆盖同名查询词头，避免重复收藏。已有 ecdict ID 仍可解析，旧备份 ID 不变。

## 复现

从 `https://raw.githubusercontent.com/skywind3000/ECDICT/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv` 下载源数据，保存至 `.cache/dictionary/ecdict.csv`，执行 `npm run dictionary:build`。大 CSV 不进入发布包。`public/dictionaries/core.json` 和构建元数据已作为项目文件提供；`public/licenses/ECDICT-MIT.txt` 保留原始许可。新增/修改精选词条后需要重新生成词频映射。
