export type ApiCompatible = "chat-completions-compatible";

export interface CompatibilityProfile {
  id: ApiCompatible;
  title: string;
  chatCompletionsPath: string;
  modelsPath: string;
}

export const compatibilityProfiles: CompatibilityProfile[] = [
  {
    id: "chat-completions-compatible",
    title: "Chat Completions Compatible",
    chatCompletionsPath: "/chat/completions",
    modelsPath: "/models",
  },
];

export function getCompatibilityProfile(id: ApiCompatible): CompatibilityProfile {
  return compatibilityProfiles.find((profile) => profile.id === id) ?? compatibilityProfiles[0];
}

export function normalizeApiBase(apiBase: string): string {
  return apiBase.trim().replace(/\/+$/, "");
}

export function buildCompatibleUrl(apiBase: string, path: string): string {
  const normalizedBase = normalizeApiBase(apiBase);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
