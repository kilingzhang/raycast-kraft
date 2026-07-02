import { createParser } from "eventsource-parser";
import { SocksProxyAgent } from "socks-proxy-agent";
import { ApiSettings } from "./api-settings";
import { buildCompatibleUrl, getCompatibilityProfile } from "./api-compatibility";
import { ConversationMessage } from "./tool-runtime";
import { fetchSSE } from "./http";

export interface StreamChatInput {
  settings: ApiSettings;
  model: string;
  messages: ConversationMessage[];
  signal: AbortSignal;
  agent?: SocksProxyAgent;
}

function parseOpenAICompatibleDelta(data: string): string | undefined {
  if (data === "[DONE]") {
    return undefined;
  }

  const payload = JSON.parse(data);
  const choice = payload.choices?.[0];
  if (!choice || choice.finish_reason) {
    return undefined;
  }
  return choice.delta?.content ?? "";
}

export async function* streamChatCompletions(input: StreamChatInput): AsyncGenerator<string> {
  const profile = getCompatibilityProfile(input.settings.apiCompatible);
  const url = buildCompatibleUrl(input.settings.apiBase, profile.chatCompletionsPath);
  const decoder = new TextDecoder();
  const events: string[] = [];
  const parser = createParser((event) => {
    if (event.type === "event") {
      events.push(event.data);
    }
  });

  const body = {
    model: input.model,
    messages: input.messages,
    temperature: 0,
    stream: true,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.settings.apiKey) {
    headers.Authorization = `Bearer ${input.settings.apiKey}`;
  }

  for await (const chunk of fetchSSE(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers,
    signal: input.signal,
    agent: input.agent as never,
  })) {
    events.length = 0;
    parser.feed(decoder.decode(chunk as ArrayBuffer));
    for (const event of events) {
      const delta = parseOpenAICompatibleDelta(event);
      if (delta) {
        yield delta;
      }
    }
  }
}
