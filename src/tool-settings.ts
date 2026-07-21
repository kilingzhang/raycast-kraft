import { BuiltInToolMode, ToolMode } from "./runtime/types";
import { WorkflowStepId } from "./runtime/tool-runtime";

export type ToolRenderer = "markdown" | "plain";

export interface ToolSetting {
  model: string;
  customModel: string;
  prompt: string;
  renderer: ToolRenderer;
  enableConversation: boolean;
  temperature: number;
  maxTokens: number;
  workflow: WorkflowStepId[];
}

export type ToolSettings = Record<string, ToolSetting>;

export const defaultWorkflow: WorkflowStepId[] = ["input", "prompt", "llm", "renderer"];

export const defaultToolSettings: Record<BuiltInToolMode, ToolSetting> = {
  translate: {
    model: "",
    customModel: "",
    prompt:
      "Translate {{input}} from {{sourceLang}} to {{targetLang}}. Preserve meaning, tone, formatting, and only return the translation.",
    renderer: "markdown",
    enableConversation: false,
    temperature: 0,
    maxTokens: 2048,
    workflow: defaultWorkflow,
  },
  polishing: {
    model: "",
    customModel: "",
    prompt:
      "Polish the following {{sourceLang}} text for clarity, flow, and professional tone. Return only the revised text.\n\n{{input}}",
    renderer: "markdown",
    enableConversation: false,
    temperature: 0.3,
    maxTokens: 2048,
    workflow: defaultWorkflow,
  },
  summarize: {
    model: "",
    customModel: "",
    prompt: "Summarize the following content in {{targetLang}}. Keep the result concise and structured.\n\n{{input}}",
    renderer: "markdown",
    enableConversation: false,
    temperature: 0.2,
    maxTokens: 2048,
    workflow: defaultWorkflow,
  },
  what: {
    model: "",
    customModel: "",
    prompt:
      "Explain or identify the following content in {{targetLang}}. Use Markdown with clear sections.\n\n{{input}}\n\nConversation context:\n{{conversation}}",
    renderer: "markdown",
    enableConversation: true,
    temperature: 0.5,
    maxTokens: 4096,
    workflow: [...defaultWorkflow, "conversation"],
  },
};

export function createDefaultToolSetting(patch: Partial<ToolSetting> = {}): ToolSetting {
  return {
    model: "",
    customModel: "",
    prompt: "{{input}}",
    renderer: "markdown",
    enableConversation: false,
    temperature: 0.2,
    maxTokens: 2048,
    workflow: defaultWorkflow,
    ...patch,
  };
}

function clampTemperature(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(2, Math.max(0, parsed));
}

function clampMaxTokens(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(128000, Math.floor(parsed));
}

export function normalizeToolSetting(setting: Partial<ToolSetting>, fallback: ToolSetting = createDefaultToolSetting()): ToolSetting {
  return {
    ...fallback,
    ...setting,
    model: typeof setting.model === "string" ? setting.model : fallback.model,
    customModel: typeof setting.customModel === "string" ? setting.customModel : fallback.customModel,
    prompt: typeof setting.prompt === "string" && setting.prompt.trim() ? setting.prompt : fallback.prompt,
    renderer:
      setting.renderer === "plain" || setting.renderer === "markdown" ? setting.renderer : fallback.renderer,
    enableConversation: Boolean(setting.enableConversation ?? fallback.enableConversation),
    temperature: clampTemperature(setting.temperature, fallback.temperature),
    maxTokens: clampMaxTokens(setting.maxTokens, fallback.maxTokens),
    workflow: Array.isArray(setting.workflow) && setting.workflow.length ? setting.workflow : fallback.workflow,
  };
}

export function getDefaultToolSetting(mode: ToolMode): ToolSetting {
  if (mode in defaultToolSettings) {
    return defaultToolSettings[mode as BuiltInToolMode];
  }
  return createDefaultToolSetting();
}

export function mergeToolSettings(stored: Partial<Record<string, Partial<ToolSetting>>>): ToolSettings {
  return {
    translate: normalizeToolSetting(stored.translate ?? {}, defaultToolSettings.translate),
    polishing: normalizeToolSetting(stored.polishing ?? {}, defaultToolSettings.polishing),
    summarize: normalizeToolSetting(stored.summarize ?? {}, defaultToolSettings.summarize),
    what: normalizeToolSetting(stored.what ?? {}, defaultToolSettings.what),
    ...Object.fromEntries(
      Object.entries(stored)
        .filter(([mode]) => mode.startsWith("custom:"))
        .map(([mode, setting]) => [mode, normalizeToolSetting(setting ?? {})]),
    ),
  };
}

export function resolveToolModel(setting: ToolSetting): string {
  return setting.customModel.trim() || setting.model.trim();
}
