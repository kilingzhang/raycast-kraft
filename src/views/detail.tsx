import { Detail, List } from "@raycast/api";
import capitalize from "capitalize";
import { langMap } from "../runtime/languages";
import { codeBlock, formatResultBody } from "../runtime/render-output";
import { ToolMode } from "../runtime/types";
import { ToolRenderer } from "../tool-settings";

export interface DetailViewProps {
  showMetadata: boolean;
  text: string;
  error?: string;
  isLoading?: boolean;
  original: string;
  from: string;
  to: string;
  mode: ToolMode;
  toolTitle?: string;
  created_at?: string;
  ocrImg: string | undefined;
  provider: string | undefined;
  renderer?: ToolRenderer;
}

function imageMarkdown(path: string | undefined) {
  if (!path) {
    return "";
  }
  return `\n![](<${path.replaceAll(">", "%3E")}>)`;
}

function formatModeTitle(mode: ToolMode) {
  if (mode.startsWith("custom:")) {
    return capitalize(mode.slice("custom:".length).replaceAll("-", " "));
  }
  return capitalize(mode);
}

export { formatResultBody } from "../runtime/render-output";

export const DetailView = (props: DetailViewProps) => {
  const {
    showMetadata,
    text,
    error,
    isLoading,
    original,
    from,
    to,
    mode,
    toolTitle,
    created_at,
    ocrImg,
    provider,
    renderer = "markdown",
  } = props;
  const statusMd = isLoading ? "_Generating..._\n\n" : "";
  const errorMd = error ? `**Error**\n\n${codeBlock(error)}\n\n` : "";
  const resultMd = formatResultBody(text, renderer);
  const imgMd = imageMarkdown(ocrImg);
  return (
    <List.Item.Detail
      markdown={`${statusMd}${errorMd}${resultMd}\n${imgMd}\n\n---\n\n**Original**\n\n${codeBlock(original)}\n`}
      metadata={
        showMetadata ? (
          <Detail.Metadata>
            {mode != "what" ? (
              <Detail.Metadata.Label title="From" text={`${langMap.get(from) || (from === "auto" ? "Auto" : from)}`} />
            ) : null}
            <Detail.Metadata.Label title="To" text={`${langMap.get(to) || to}`} />
            <Detail.Metadata.Label title="Tool" text={toolTitle ?? formatModeTitle(mode)} />
            {created_at && <Detail.Metadata.Label title="Created At" text={`${created_at}`} />}
            {provider && <Detail.Metadata.Label title="Runtime" text={provider} />}
            <Detail.Metadata.Label title="Renderer" text={renderer === "plain" ? "Plain Text" : "Markdown"} />
          </Detail.Metadata>
        ) : null
      }
    />
  );
};
