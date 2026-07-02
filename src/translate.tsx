import { LaunchProps } from "@raycast/api";
import { useState } from "react";
import getBase from "./base";
import { ToolMenu } from "./views/tool-menu";
import { ToolDefinition } from "./tools";

function ExecutionCommand({ props }: { props: LaunchProps }) {
  return getBase(props, "translate");
}

function shouldOpenExecutionView(props: LaunchProps) {
  const context = props.launchContext ?? {};
  return Boolean(
    props.fallbackText ||
      context["mode"] ||
      context["txt"] ||
      context["img"] ||
      context["autoStart"] ||
      context["loadSelected"] ||
      context["loadClipboard"],
  );
}

export default function Command(props: LaunchProps) {
  const [executionContext, setExecutionContext] = useState<Record<string, unknown> | undefined>();

  if (shouldOpenExecutionView(props)) {
    return <ExecutionCommand props={props} />;
  }

  if (executionContext) {
    return <ExecutionCommand props={{ ...props, launchContext: executionContext }} />;
  }

  return (
    <ToolMenu onOpenCurrentCommandTool={(tool: ToolDefinition) => setExecutionContext(tool.launch.context ?? {})} />
  );
}
