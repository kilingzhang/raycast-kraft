import assert from "node:assert/strict";
import { defaultApiSettings, sanitizeApiSettings } from "./api-settings";
import { buildCompatibleUrl, getCompatibilityProfile, normalizeApiBase } from "./api-compatibility";
import { buildModelsUrl, parseModelList } from "./model-list";
import { buildPromptMessages, buildToolVariables, renderTemplate, resolveWorkflow } from "./tool-runtime";

const profile = getCompatibilityProfile("chat-completions-compatible");
assert.equal(profile.chatCompletionsPath, "/chat/completions");
assert.equal(profile.modelsPath, "/models");
assert.equal(normalizeApiBase("https://api.example.com/v1/"), "https://api.example.com/v1");
assert.equal(buildCompatibleUrl("https://api.example.com/v1/", "/models"), "https://api.example.com/v1/models");

const variables = buildToolVariables({
  input: "hello",
  source: "selected",
  sourceLang: "English",
  targetLang: "简体中文",
  toolName: "Translate",
  now: new Date("2026-07-02T08:00:00.000Z"),
  timezone: "Asia/Shanghai",
  conversation: [{ role: "assistant", content: "previous answer" }],
});

assert.equal(variables.input, "hello");
assert.equal(variables.source, "selected");
assert.equal(variables.toolName, "Translate");
assert.equal(variables.conversation, "assistant: previous answer");
assert.equal(
  renderTemplate("{{toolName}} -> {{input}} -> {{targetLang}}", variables),
  "Translate -> hello -> 简体中文",
);
assert.deepEqual(resolveWorkflow(["input", "prompt", "llm", "renderer"]), [
  { id: "input", title: "Input Normalizer", kind: "builtin" },
  { id: "prompt", title: "Prompt Variables", kind: "prompt" },
  { id: "llm", title: "LLM Call", kind: "llm" },
  { id: "renderer", title: "Markdown Renderer", kind: "render" },
]);

assert.equal(defaultApiSettings.apiCompatible, "chat-completions-compatible");
assert.equal(
  sanitizeApiSettings({ apiBase: "https://x.test/v1/", apiKey: " k ", apiCompatible: "chat-completions-compatible" })
    .apiBase,
  "https://x.test/v1",
);
assert.equal(
  sanitizeApiSettings({ apiBase: "", apiKey: "", apiCompatible: "chat-completions-compatible" }).apiBase,
  "",
);

assert.equal(
  buildModelsUrl({ apiBase: "https://x.test/v1", apiCompatible: "chat-completions-compatible" }),
  "https://x.test/v1/models",
);
assert.deepEqual(
  parseModelList({ data: [{ id: "gpt-4.1" }, { id: "claude" }] }).map((model) => model.id),
  ["gpt-4.1", "claude"],
);

const messages = buildPromptMessages({
  systemPrompt: "Tool: {{toolName}}",
  userPrompt: "Input: {{input}}",
  variables,
  conversation: [{ role: "assistant", content: "previous answer" }],
  includeConversation: true,
});

assert.deepEqual(
  messages.map((message) => message.role),
  ["system", "assistant", "user"],
);
assert.equal(messages[0].content, "Tool: Translate");
assert.equal(messages[2].content, "Input: hello");
