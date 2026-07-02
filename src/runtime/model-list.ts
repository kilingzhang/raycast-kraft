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

export function buildModelsUrl(settings: ModelListSettings): string {
  const profile = getCompatibilityProfile(settings.apiCompatible);
  return buildCompatibleUrl(settings.apiBase, profile.modelsPath);
}

export function parseModelList(payload: unknown): ModelOption[] {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) {
    return [];
  }

  return payload.data
    .map((item) => {
      if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string") {
        return undefined;
      }
      return { id: item.id, name: item.id };
    })
    .filter((item): item is ModelOption => Boolean(item));
}

export async function listModels(settings: ModelListSettings): Promise<ModelOption[]> {
  const response = await fetch(buildModelsUrl(settings), {
    headers: settings.apiKey
      ? {
          Authorization: `Bearer ${settings.apiKey}`,
        }
      : undefined,
  });
  if (!response.ok) {
    throw new Error(`Model list request failed: ${response.status}`);
  }
  return parseModelList(await response.json());
}
