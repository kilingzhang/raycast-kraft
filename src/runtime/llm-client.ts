import { ProxyAgent } from "proxy-agent";
import { generateAISDKText, streamAISDKText } from "./ai-sdk-provider";
import { ApiSettings } from "./api-settings";
import { buildCompatibleUrl, getCompatibilityProfile } from "./api-compatibility";
import { requestHeaders } from "./model-list";
import { ConversationMessage } from "./tool-runtime";
import { DiagnosticLogger, noopDiagnosticLogger } from "./diagnostics";
import { resolveGenerationOptions, type ModelGenerationOptions } from "./generation-options";
import { AITraceContext, traceHeaders } from "./tracing";

export type { ModelGenerationOptions };
export { resolveGenerationOptions } from "./generation-options";

export interface StreamChatInput {
  settings: ApiSettings;
  model: string;
  messages: ConversationMessage[];
  signal: AbortSignal;
  agent?: InstanceType<typeof ProxyAgent>;
  diagnostics?: DiagnosticLogger;
  trace?: AITraceContext;
  temperature?: number;
  maxTokens?: number;
  allowNonStreamFallback?: boolean;
  jsonFetcher?: typeof fetch;
  /** Test seam for OpenAI/Anthropic streaming. Defaults to AI SDK stream. */
  streamer?: (input: StreamChatInput) => AsyncGenerator<string>;
  /** Test seam for OpenAI/Anthropic non-stream fallback. Defaults to AI SDK generateText or raw JSON. */
  completer?: (input: StreamChatInput) => Promise<string>;
}

export interface RaycastAIAskOptions {
  creativity?: "none" | "low" | "medium" | "high" | "maximum" | number;
  model?: string;
  signal?: AbortSignal;
}

export type RaycastAIStream = Promise<string> & {
  on(event: "data", listener: (chunk: string) => void): void;
};

export interface RaycastAIProvider {
  ask(prompt: string, options?: RaycastAIAskOptions): RaycastAIStream;
}

export interface StreamToolCompletionInput extends StreamChatInput {
  raycastAI?: RaycastAIProvider;
}

function splitMessagesForAnthropic(messages: ConversationMessage[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));
  return { system, conversation };
}

function formatRaycastConversationMessage(message: ConversationMessage): string {
  return `${message.role}: ${message.content}`;
}

export function buildRaycastAIPrompt(messages: ConversationMessage[]): string {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const nonSystemMessages = messages.filter((message) => message.role !== "system");
  let lastUserIndex = -1;
  for (let index = nonSystemMessages.length - 1; index >= 0; index -= 1) {
    if (nonSystemMessages[index].role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  const finalUserMessage = lastUserIndex >= 0 ? nonSystemMessages[lastUserIndex] : undefined;
  const conversation = nonSystemMessages.filter((_, index) => index !== lastUserIndex);
  const sections: string[] = [];

  if (system) {
    sections.push(`System:\n${system}`);
  }
  if (conversation.length) {
    sections.push(`Conversation:\n${conversation.map(formatRaycastConversationMessage).join("\n")}`);
  }
  if (finalUserMessage) {
    sections.push(`User:\n${finalUserMessage.content}`);
  }

  return sections.join("\n\n");
}

export function buildChatRequestBody(input: StreamChatInput, stream: boolean): Record<string, unknown> {
  const { temperature, maxTokens } = resolveGenerationOptions(input);

  if (input.settings.apiCompatible === "anthropic") {
    const { system, conversation } = splitMessagesForAnthropic(input.messages);
    return {
      model: input.model,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages: conversation,
      stream,
    };
  }

  return {
    model: input.model,
    messages: input.messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  };
}

export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }
  if (!error || typeof error !== "object") {
    return false;
  }
  if ("name" in error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return true;
  }
  if ("message" in error && typeof error.message === "string") {
    const message = error.message.toLowerCase();
    return message.includes("aborted") || message.includes("connection timeout");
  }
  return false;
}

export function shouldFallbackToNonStream(error: unknown, signal?: AbortSignal): boolean {
  if (isAbortError(error, signal)) {
    return false;
  }
  return true;
}

export function parseChatResponse(settings: ApiSettings, payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  if (settings.apiCompatible === "anthropic") {
    if (!("content" in payload) || !Array.isArray(payload.content)) {
      return "";
    }
    return payload.content
      .map((item) => {
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("");
  }
  if (!("choices" in payload) || !Array.isArray(payload.choices)) {
    return "";
  }
  const first = payload.choices[0];
  if (!first || typeof first !== "object" || !("message" in first)) {
    return "";
  }
  const message = first.message;
  if (!message || typeof message !== "object" || !("content" in message) || typeof message.content !== "string") {
    return "";
  }
  return message.content;
}

export function buildChatUrl(settings: ApiSettings): string {
  const profile = getCompatibilityProfile(settings.apiCompatible);
  return buildCompatibleUrl(settings.apiBase, profile.chatPath);
}

async function getDefaultRaycastAIProvider(): Promise<RaycastAIProvider> {
  const { AI } = await import("@raycast/api");
  return {
    ask(prompt, options) {
      return AI.ask(prompt, options as never) as RaycastAIStream;
    },
  };
}

async function* streamRaycastAICompletion(input: StreamToolCompletionInput): AsyncGenerator<string> {
  const provider = input.raycastAI ?? (await getDefaultRaycastAIProvider());
  const diagnostics = input.diagnostics ?? noopDiagnosticLogger;
  const options: RaycastAIAskOptions = {
    creativity: "none",
    signal: input.signal,
    ...(input.model ? { model: input.model } : {}),
  };
  const prompt = buildRaycastAIPrompt(input.messages);
  const startedAt = Date.now();
  let deltaCount = 0;
  let outputChars = 0;
  let firstDeltaAt = 0;
  diagnostics.checkpoint("raycast_ai.request.start", {
    model: input.model || "default",
    promptChars: prompt.length,
    messageCount: input.messages.length,
  });
  const completion = provider.ask(prompt, options);
  const pending: string[] = [];
  let done = false;
  let failure: unknown;
  let sawDataEvent = false;
  let notify: (() => void) | undefined;

  function wake() {
    notify?.();
    notify = undefined;
  }

  completion.on("data", (chunk) => {
    if (!chunk) {
      return;
    }
    deltaCount += 1;
    outputChars += chunk.length;
    if (!firstDeltaAt) {
      firstDeltaAt = Date.now();
      diagnostics.checkpoint("raycast_ai.first_delta", { firstDeltaMs: firstDeltaAt - startedAt });
    } else if (deltaCount <= 5 || deltaCount % 20 === 0) {
      diagnostics.checkpoint("raycast_ai.delta", { deltaCount, outputChars });
    }
    sawDataEvent = true;
    pending.push(chunk);
    wake();
  });
  completion.then(
    (text) => {
      if (!sawDataEvent && text) {
        deltaCount += 1;
        outputChars += text.length;
        diagnostics.checkpoint("raycast_ai.resolved_text", { outputChars: text.length });
        pending.push(text);
      }
      done = true;
      diagnostics.finish("raycast_ai.complete", {
        deltaCount,
        outputChars,
        totalMs: Date.now() - startedAt,
      });
      wake();
    },
    (error) => {
      failure = error;
      done = true;
      diagnostics.finish("raycast_ai.error", { totalMs: Date.now() - startedAt });
      wake();
    },
  );

  while (true) {
    if (pending.length) {
      yield pending.shift() ?? "";
      continue;
    }
    if (failure) {
      throw failure;
    }
    if (done) {
      return;
    }
    await new Promise<void>((resolve) => {
      notify = resolve;
    });
  }
}

async function* streamWithAISDK(input: StreamChatInput): AsyncGenerator<string> {
  yield* streamAISDKText({
    settings: input.settings,
    model: input.model,
    messages: input.messages,
    signal: input.signal,
    agent: input.agent,
    diagnostics: input.diagnostics,
    trace: input.trace,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });
}

export async function completeChatOnce(input: StreamChatInput): Promise<string> {
  if (input.completer) {
    return input.completer(input);
  }

  if (input.jsonFetcher) {
    const url = buildChatUrl(input.settings);
    const diagnostics = input.diagnostics ?? noopDiagnosticLogger;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...requestHeaders(input.settings),
      ...traceHeaders(input.trace),
    };
    const body = JSON.stringify(buildChatRequestBody(input, false));
    const startedAt = Date.now();
    diagnostics.checkpoint("chat.non_stream.start", {
      runtime: input.settings.apiCompatible,
      url,
      model: input.model,
      messageCount: input.messages.length,
      bodyChars: body.length,
      via: "jsonFetcher",
    });

    const response = await input.jsonFetcher(url, {
      method: "POST",
      headers,
      body,
      signal: input.signal,
    });

    if (!response.ok) {
      const responseText = await response.text();
      diagnostics.finish("chat.non_stream.error", {
        status: response.status,
        bodyChars: responseText.length,
        totalMs: Date.now() - startedAt,
      });
      throw new Error(responseText || `Chat request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const text = parseChatResponse(input.settings, payload);
    diagnostics.finish("chat.non_stream.complete", {
      outputChars: text.length,
      totalMs: Date.now() - startedAt,
    });
    return text;
  }

  return generateAISDKText({
    settings: input.settings,
    model: input.model,
    messages: input.messages,
    signal: input.signal,
    agent: input.agent,
    diagnostics: input.diagnostics,
    trace: input.trace,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });
}

export async function* streamToolCompletion(input: StreamToolCompletionInput): AsyncGenerator<string> {
  if (input.settings.apiCompatible === "raycast") {
    yield* streamRaycastAICompletion(input);
    return;
  }

  const streamer = input.streamer ?? streamWithAISDK;

  try {
    yield* streamer(input);
  } catch (error) {
    if (input.allowNonStreamFallback === false || !shouldFallbackToNonStream(error, input.signal)) {
      throw error;
    }

    const diagnostics = input.diagnostics ?? noopDiagnosticLogger;
    diagnostics.checkpoint("chat.stream_fallback.start", {
      reason: error instanceof Error ? error.message : String(error),
      provider: "ai-sdk",
    });
    const text = await completeChatOnce(input);
    if (text) {
      yield text;
    }
  }
}
