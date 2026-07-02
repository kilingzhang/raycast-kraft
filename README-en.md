# Kraft

Kraft is a Raycast AI tool collection. It is not tied to one model vendor. The core runtime is:

```text
Input -> Workflow -> Output -> Renderer -> Conversation
```

The default command is `Kraft`. It opens a tool menu first, not a translation or vendor settings page.

## Install

```shell
git clone git@github.com:kilingzhang/raycast-kraft.git
cd raycast-kraft
npm install
npm run dev
```

## Global API Settings

Raycast extension preferences only keep API connection settings:

- `API Base`
- `API Key`
- `API Compatible`

`API Compatible` determines the model call and model list endpoints. The first version supports `Chat Completions Compatible`:

- Chat completions: `/chat/completions`
- Models: `/models`

## Tool Settings

Each tool has its own `Tool Settings`:

- `Model`: select from the model list.
- `Custom Model`: manually enter a model when needed.
- `Prompt`: the tool prompt, with runtime variables.
- `Renderer`: Markdown or plain text.
- `Conversation`: enables multi-turn follow-up for that tool.
- `Workflow`: preview of the current processing steps.

Available variables:

```text
{{input}}, {{source}}, {{sourceLang}}, {{targetLang}}, {{toolName}},
{{isoTime}}, {{localeTime}}, {{timezone}}, {{conversation}}
```

## Default Tools

- Translate
- Polish Writing
- Summarize
- Explain
- Ask Selected Text
- Ask Clipboard
- Ask Screenshot

## Development

```shell
npm test
npm run lint
npm run build
```
