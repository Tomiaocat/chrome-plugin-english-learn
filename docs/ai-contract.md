# AI 适配器契约 v1

业务端口定义在 `src/domain/ports.ts`。基建实现负责协议转换，业务层只处理经过验证的候选和替换计划。

## 输入与输出

输入：若干中文文本片段、候选编号、对应位置、候选英文和词义。网页内容是不可信数据，禁止解释为系统指令。候选最多取前 100 条；每批最多 30 个片段、每片段 2000 字符。

模型只返回：

```json
{ "selected": [0, 2] }
```

允许 `selected` 为空。索引必须是候选范围内的非负整数；越界则判定失败，不对其自由生成的词条或 HTML 执行替换。业务层随后再次校验原词、位置、词义和替换预算。

## 协议映射

| 协议               | 相对于 Base URL 的路径 | 请求                                                    | 文本响应                                       |
| ------------------ | ---------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| Chat Completions   | `chat/completions`     | `model, messages, stream:false`                         | `choices[].message.content`                    |
| Responses          | `responses`            | `model, instructions, input, stream:false, store:false` | `output` 中 `message.content` 的 `output_text` |
| Anthropic Messages | `messages`             | `model, system, messages, max_tokens, stream:false`     | `content` 中 `text` 块                         |

模型列表使用相对路径 `models`，读取 `data[].id`。部分平台不实现此端点或分页行为不同，所以保留手填模型 ID。当前读取第一批列表，不宣称穷尽全部可用模型。

请求仅发往 HTTPS 配置地址，不允许嵌入账号密码、查询参数或片段。Base URL 包含版本前缀时保留，不自动重复添加 `/v1`。配置更换地址后必须重新填写 Key，禁止静默复用旧 Key。

## 失败与限额

- 最多等待 20 秒，最多读取 1 MB 响应，不跟随重定向，不自动重试生成请求。
- 401/403 → AUTH_INVALID，404 → MODEL_UNAVAILABLE，429 → RATE_LIMITED，超时 → TIMEOUT。
- 模型文本未通过结构校验 → BAD_MODEL_OUTPUT；无法识别的网络错误不暴露完整上游响应。
- 语境分析失败回退本地规则；连接测试和模型获取在设置页面明确显示错误。
- 生成前持久化预留每日计数，失败不返还。缓存存候选选择索引，刷新页面后重新映射片段 ID；命中后仍执行当前学习规则。

## 验证状态

三种协议均有离线模拟响应测试；没有使用真实用户 Key，也没有完成真实厂商计费请求验证。连接测试会使用短句执行同一结构的词汇判断，不能用仅返回 200 的探测代替。

参考：[OpenAI Chat Completions](https://developers.openai.com/api/reference/chat-completions/overview)、[OpenAI Responses 迁移说明](https://developers.openai.com/api/docs/guides/migrate-to-responses)、[DeepSeek 首次调用](https://api-docs.deepseek.com/)、[Anthropic 模型列表](https://platform.claude.com/docs/en/api/models/list)。
