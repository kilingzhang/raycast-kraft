import { ApiCompatible, normalizeApiBase } from "./api-compatibility";

export interface ApiSettings {
  apiBase: string;
  apiKey: string;
  apiCompatible: ApiCompatible;
}

export const defaultApiSettings: ApiSettings = {
  apiBase: "",
  apiKey: "",
  apiCompatible: "chat-completions-compatible",
};

export function sanitizeApiSettings(settings: Partial<ApiSettings>): ApiSettings {
  return {
    apiBase: settings.apiBase ? normalizeApiBase(settings.apiBase) : "",
    apiKey: settings.apiKey?.trim() ?? "",
    apiCompatible: settings.apiCompatible ?? defaultApiSettings.apiCompatible,
  };
}
