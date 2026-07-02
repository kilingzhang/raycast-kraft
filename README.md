# Kraft

Kraft 是一个 Raycast AI 工具集合。它不绑定具体厂商，核心模型是：

```text
Input -> Workflow -> Output -> Renderer -> Conversation
```

默认入口是 `Kraft`。打开后先看到工具菜单，而不是某个翻译或厂商设置页。

## 安装

```shell
git clone git@github.com:kilingzhang/raycast-kraft.git
cd raycast-kraft
npm install
npm run dev
```

## 全局 API 设置

Raycast 扩展设置里只保留 API 连接信息：

- `API Base`
- `API Key`
- `API Compatible`

`API Compatible` 决定模型调用和模型列表端点。当前第一版支持 `Chat Completions Compatible`：

- Chat completions: `/chat/completions`
- Models: `/models`

## 工具设置

每个工具都有自己的 `Tool Settings`：

- `Model`：从模型列表选择。
- `Custom Model`：模型列表不可用或需要手动指定时使用。
- `Prompt`：该工具自己的提示词，支持变量。
- `Renderer`：Markdown 或纯文本。
- `Conversation`：是否开启多轮追问。
- `Workflow`：当前工具的处理步骤预览。

可用变量：

```text
{{input}}, {{source}}, {{sourceLang}}, {{targetLang}}, {{toolName}},
{{isoTime}}, {{localeTime}}, {{timezone}}, {{conversation}}
```

## 默认工具

- Translate
- Polish Writing
- Summarize
- Explain
- Ask Selected Text
- Ask Clipboard
- Ask Screenshot

## 开发

```shell
npm test
npm run lint
npm run build
```
