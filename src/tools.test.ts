import assert from "node:assert/strict";
import fs from "node:fs";
import packageJson from "../package.json";
import { defaultToolSettings, getDefaultToolSetting } from "./tool-settings";
import { sortExecutionToolsByUsage } from "./tool-usage";
import { allTools, executionTools, getToolById, menuSections } from "./tools";

assert.ok(allTools.length >= 8, "toolbox should expose text, input, and configuration tools");

const translate = getToolById("translate");
assert.equal(translate?.title, "Translate");
assert.equal(translate?.kind, "execution");
assert.equal(translate?.mode, "translate");
assert.equal(translate?.launch.command, "translate");
assert.deepEqual(translate?.launch.context, {
  mode: "translate",
  loadSelected: true,
  loadClipboard: true,
  autoStart: true,
});

const selected = getToolById("selected");
assert.equal(selected?.title, "Ask About Selected Text");
assert.equal(selected?.kind, "input");
assert.equal(selected?.launch.command, "selected");

const appSettings = getToolById("app-settings");
assert.equal(appSettings?.title, "App Settings");
assert.equal(appSettings?.kind, "configuration");

const apiSettings = getToolById("api-settings");
assert.equal(apiSettings?.title, "API Settings");
assert.equal(apiSettings?.kind, "configuration");

assert.deepEqual(
  menuSections.map((section) => section.title),
  ["Text Tools", "Input Sources", "Configuration"],
);

assert.deepEqual(
  executionTools.map((tool) => tool.id),
  ["translate", "polishing", "summarize", "what"],
);

assert.equal(getToolById("translate")?.workflow?.length, 4);
assert.equal(getToolById("what")?.defaultConversationEnabled, true);
assert.equal(defaultToolSettings.translate.enableConversation, false);
assert.equal(defaultToolSettings.what.enableConversation, true);
assert.equal(getDefaultToolSetting("summarize").renderer, "markdown");

assert.equal(
  allTools.some((tool) => /vendor-only/i.test(tool.title + tool.description)),
  false,
);

assert.equal("preferences" in packageJson, false);
assert.deepEqual(
  packageJson.commands
    .filter((command) => ["kraft", "translate", "polishing", "summarize", "what"].includes(command.name))
    .map((command) => command.name),
  ["kraft", "translate", "polishing", "summarize", "what"],
);
assert.equal(
  packageJson.commands.some((command) => "preferences" in command),
  false,
);

assert.deepEqual(
  sortExecutionToolsByUsage(executionTools, [{ mode: "summarize" }, { mode: "what" }, { mode: "summarize" }]).map(
    (tool) => tool.id,
  ),
  ["summarize", "what", "translate", "polishing"],
);

for (const [file, mode] of [
  ["src/translate.tsx", "translate"],
  ["src/polishing.tsx", "polishing"],
  ["src/summarize.tsx", "summarize"],
  ["src/what.tsx", "what"],
]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, new RegExp(`getBase\\(props, "${mode}", true, true, true\\)`));
}

const customToolsSource = fs.readFileSync("src/custom-tools.ts", "utf8");
assert.match(
  customToolsSource,
  /launch:\s*\{\s*command:\s*"kraft",\s*context:\s*\{\s*mode,\s*loadSelected:\s*true,\s*loadClipboard:\s*true,\s*autoStart:\s*true\s*\}/s,
);

const inputToolPickerSource = fs.readFileSync("src/views/input-tool-picker.tsx", "utf8");
assert.match(inputToolPickerSource, /selectedItemId=\{sortedTools\[0\]\?\.id\}/);
assert.match(inputToolPickerSource, /id=\{tool\.id\}/);

const contentSource = fs.readFileSync("src/views/content.tsx", "utf8");
assert.match(contentSource, /title="Run Again"/);
assert.match(contentSource, /onAction=\{\(\) => rerunRecord\(record\)\}/);
assert.match(contentSource, /const getRecordActionPanel = \(record: Record\) => \(\s*<ActionPanel>\s*<Action/s);
assert.match(contentSource, /getOutputActionSection/);

const outputActionsSource = fs.readFileSync("src/actions/output.tsx", "utf8");
assert.match(outputActionsSource, /Paste Result/);
assert.match(outputActionsSource, /Replace Selected Text/);
assert.match(outputActionsSource, /Clipboard\.paste/);
assert.match(outputActionsSource, /closeMainWindow/);
assert.doesNotMatch(contentSource, /toast\.title\s*=\s*"AI result ready"/);
assert.match(
  contentSource,
  /await showToast\(\{\s*title:\s*"AI result ready",\s*style:\s*Toast\.Style\.Success,\s*\}/s,
);

const useQuerySource = fs.readFileSync("src/hooks/useQuery.tsx", "utf8");
assert.match(useQuerySource, /const \[from, setFrom\] = useState<string>\("auto"\)/);
assert.match(useQuerySource, /const shouldLoadClipboard =/);
assert.match(useQuerySource, /const clipboardText = text\?\.trim\(\) \?\? ""/);
assert.match(useQuerySource, /if \(clipboardText\.length > 1\)/);
assert.doesNotMatch(useQuerySource, /title:\s*"Selected text couldn't load"/);
assert.doesNotMatch(useQuerySource, /title:\s*"Input text couldn't load"/);
assert.match(contentSource, /if\s*\(\s*query\.text\.trim\(\)\.length\s*===\s*0\s*\)\s*\{/);
assert.match(contentSource, /temperature:\s*toolSetting\.temperature/);
assert.match(contentSource, /maxTokens:\s*toolSetting\.maxTokens/);
assert.match(contentSource, /allowNonStreamFallback:\s*true/);
assert.match(contentSource, /useConversation\(/);
assert.match(contentSource, /renderer=\{toolSetting\.renderer\}/);

const detailSource = fs.readFileSync("src/views/detail.tsx", "utf8");
assert.match(detailSource, /formatResultBody/);
assert.match(detailSource, /renderer=\{toolSetting\.renderer\}|renderer\?: ToolRenderer|renderer = "markdown"/);

const renderOutputSource = fs.readFileSync("src/runtime/render-output.ts", "utf8");
assert.match(renderOutputSource, /export function formatResultBody/);
assert.match(renderOutputSource, /renderer === "plain"/);

const toolSettingsSource = fs.readFileSync("src/tool-settings.ts", "utf8");
assert.match(toolSettingsSource, /temperature:\s*0/);
assert.match(toolSettingsSource, /maxTokens:\s*2048/);
assert.match(toolSettingsSource, /export function normalizeToolSetting/);

const llmClientSource = fs.readFileSync("src/runtime/llm-client.ts", "utf8");
assert.match(llmClientSource, /export async function completeChatOnce/);
assert.match(llmClientSource, /shouldFallbackToNonStream/);
assert.match(llmClientSource, /chat\.stream_fallback\.start/);
assert.match(llmClientSource, /streamAISDKText|streamWithAISDK/);
assert.doesNotMatch(llmClientSource, /sseFetcher/);
assert.doesNotMatch(llmClientSource, /eventsource-parser/);
assert.doesNotMatch(llmClientSource, /createParser/);

const aiSdkSource = fs.readFileSync("src/runtime/ai-sdk-provider.ts", "utf8");
assert.match(aiSdkSource, /export async function\* streamAISDKText/);
assert.match(aiSdkSource, /export async function generateAISDKText/);
assert.match(aiSdkSource, /maxOutputTokens:\s*generation\.maxTokens/);
assert.match(aiSdkSource, /temperature:\s*generation\.temperature/);

const httpSource = fs.readFileSync("src/runtime/http.ts", "utf8");
assert.doesNotMatch(httpSource, /export async function\* fetchSSE/);
assert.doesNotMatch(httpSource, /eventsource-parser/);
assert.match(httpSource, /export function getErrorText/);

const conversationSource = fs.readFileSync("src/hooks/useConversation.ts", "utf8");
assert.match(conversationSource, /export function useConversation/);
assert.match(conversationSource, /cacheRef/);
