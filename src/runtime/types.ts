export type ToolMode = "translate" | "polishing" | "summarize" | "what";

export interface ToolResult {
  original: string;
  text: string;
  from: string;
  to: string;
  error?: string;
}
