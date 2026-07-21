export interface ModelGenerationOptions {
  temperature?: number;
  maxTokens?: number;
}

export function resolveGenerationOptions(input: ModelGenerationOptions): Required<ModelGenerationOptions> {
  const temperature = Number.isFinite(input.temperature) ? Math.min(2, Math.max(0, input.temperature as number)) : 0;
  const maxTokens =
    Number.isFinite(input.maxTokens) && (input.maxTokens as number) >= 1 ? Math.floor(input.maxTokens as number) : 2048;
  return { temperature, maxTokens };
}
