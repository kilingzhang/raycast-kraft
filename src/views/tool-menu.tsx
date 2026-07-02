import { Action, ActionPanel, Icon, launchCommand, LaunchType, List } from "@raycast/api";
import { useApiSettings } from "../hooks/useApiSettings";
import { useAppSettings } from "../hooks/useAppSettings";
import { useToolSettings } from "../hooks/useToolSettings";
import { ToolDefinition, menuSections } from "../tools";
import { AppSettingsForm } from "./app-settings-form";
import { ApiSettingsForm } from "./api-settings-form";
import { ToolSettingsForm } from "./tool-settings-form";

export type ToolMenuProps = {
  onOpenCurrentCommandTool?: (tool: ToolDefinition) => void;
};

const TOOL_ICONS: Record<string, Icon> = {
  translate: Icon.Globe,
  polishing: Icon.Pencil,
  summarize: Icon.Text,
  what: Icon.QuestionMark,
  selected: Icon.TextSelection,
  clipboard: Icon.Clipboard,
  ocr: Icon.Image,
  "app-settings": Icon.Gear,
  "api-settings": Icon.Gear,
};

function openTool(tool: ToolDefinition, onOpenCurrentCommandTool?: (tool: ToolDefinition) => void) {
  if (tool.launch.command === "translate" && onOpenCurrentCommandTool) {
    onOpenCurrentCommandTool(tool);
    return;
  }

  return launchCommand({
    name: tool.launch.command,
    type: LaunchType.UserInitiated,
    context: tool.launch.context,
  });
}

function actionTitle(tool: ToolDefinition) {
  if (tool.kind === "configuration") {
    return `Open ${tool.title}`;
  }
  return `Use ${tool.title}`;
}

export function ToolMenu({ onOpenCurrentCommandTool }: ToolMenuProps) {
  const apiSettings = useApiSettings();
  const appSettings = useAppSettings();
  const toolSettings = useToolSettings();

  return (
    <List
      isLoading={apiSettings.isLoading || appSettings.isLoading || toolSettings.isLoading}
      searchBarPlaceholder="Search AI tools..."
      navigationTitle="AI Tools"
    >
      {menuSections.map((section) => (
        <List.Section key={section.id} title={section.title}>
          {section.tools.map((tool) => (
            <List.Item
              key={tool.id}
              icon={TOOL_ICONS[tool.id] ?? Icon.CommandSymbol}
              title={tool.title}
              subtitle={tool.subtitle}
              accessories={[{ text: tool.kind === "execution" ? "Tool" : tool.kind === "input" ? "Input" : "Setup" }]}
              actions={
                <ActionPanel>
                  {tool.kind === "configuration" ? (
                    <Action.Push
                      title={actionTitle(tool)}
                      icon={TOOL_ICONS[tool.id] ?? Icon.CommandSymbol}
                      target={
                        tool.id === "api-settings" ? (
                          <ApiSettingsForm hook={apiSettings} />
                        ) : (
                          <AppSettingsForm hook={appSettings} />
                        )
                      }
                    />
                  ) : (
                    <Action
                      title={actionTitle(tool)}
                      icon={TOOL_ICONS[tool.id] ?? Icon.CommandSymbol}
                      onAction={() => openTool(tool, onOpenCurrentCommandTool)}
                    />
                  )}
                  {tool.kind === "execution" && tool.mode && (
                    <Action.Push
                      title="Tool Settings"
                      icon={Icon.Gear}
                      shortcut={{ modifiers: ["cmd"], key: "," }}
                      target={
                        <ToolSettingsForm
                          tool={tool}
                          setting={toolSettings.data[tool.mode]}
                          onSave={toolSettings.updateToolSetting}
                        />
                      }
                    />
                  )}
                  {tool.kind !== "configuration" && (
                    <ActionPanel.Section title="Setup">
                      <Action.Push
                        title="Open App Settings"
                        icon={Icon.Gear}
                        shortcut={{ modifiers: ["cmd", "ctrl"], key: "," }}
                        target={<AppSettingsForm hook={appSettings} />}
                      />
                      <Action.Push
                        title="Open API Settings"
                        icon={Icon.Gear}
                        shortcut={{ modifiers: ["cmd", "ctrl"], key: "p" }}
                        target={<ApiSettingsForm hook={apiSettings} />}
                      />
                    </ActionPanel.Section>
                  )}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
