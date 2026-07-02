import assert from "node:assert/strict";
import { defaultToolSettings, getDefaultToolSetting } from "./tool-settings";
import { allTools, executionTools, getToolById, menuSections } from "./tools";

assert.ok(allTools.length >= 7, "toolbox should expose text, input, and configuration tools");

const translate = getToolById("translate");
assert.equal(translate?.title, "Translate");
assert.equal(translate?.kind, "execution");
assert.equal(translate?.mode, "translate");
assert.equal(translate?.launch.command, "translate");
assert.deepEqual(translate?.launch.context, { mode: "translate", autoStart: false });

const selected = getToolById("selected");
assert.equal(selected?.title, "Ask About Selected Text");
assert.equal(selected?.kind, "input");
assert.equal(selected?.launch.command, "selected");

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
  allTools.some((tool) => /vendor-only|translator-only/i.test(tool.title + tool.description)),
  false,
);
