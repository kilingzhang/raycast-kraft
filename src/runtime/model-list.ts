import { ApiCompatible, buildCompatibleUrl, getCompatibilityProfile } from "./api-compatibility";

export interface ModelOption {
  id: string;
  name: string;
}

export interface ModelListSettings {
  apiBase: string;
  apiCompatible: ApiCompatible;
  apiKey?: string;
}

export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export function buildModelsUrl(settings: ModelListSettings): string {
  const profile = getCompatibilityProfile(settings.apiCompatible);
  return buildCompatibleUrl(settings.apiBase, profile.modelsPath);
}

export function requestHeaders(settings: ModelListSettings): Record<string, string> {
  if (settings.apiCompatible === "claude") {
    return {
      "anthropic-version": "2023-06-01",
      ...(settings.apiKey ? { "x-api-key": settings.apiKey } : {}),
    };
  }

  return settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {};
}

export function parseModelList(payload: unknown, apiCompatible: ApiCompatible): ModelOption[] {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
    return [];
  }

  return payload.data
    .map((item) => {
      if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string") {
        return undefined;
      }
      const name =
        apiCompatible === "claude" && "display_name" in item && typeof item.display_name === "string"
          ? item.display_name
          : item.id;
      return { id: item.id, name };
    })
    .filter((item): item is ModelOption => Boolean(item));
}

export async function listModels(settings: ModelListSettings, fetcher: FetchLike = fetch): Promise<ModelOption[]> {
  const response = await fetcher(buildModelsUrl(settings), {
    headers: requestHeaders(settings),
  });
  if (!response.ok) {
    throw new Error(`Model list request failed: ${response.status}`);
  }
  return parseModelList(await response.json(), settings.apiCompatible);
}
