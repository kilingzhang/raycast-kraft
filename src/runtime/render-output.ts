import { ToolRenderer } from "../tool-settings";

export function codeBlock(value: string) {
  const matches = value.match(/`+/g) ?? [];
  const maxFenceLength = matches.reduce((max, match) => Math.max(max, match.length), 0);
  const fence = "`".repeat(Math.max(3, maxFenceLength + 1));
  return `${fence}\n${value}\n${fence}`;
}

export function formatResultBody(text: string, renderer: ToolRenderer = "markdown") {
  if (!text) {
    return "";
  }
  return renderer === "plain" ? codeBlock(text) : text;
}