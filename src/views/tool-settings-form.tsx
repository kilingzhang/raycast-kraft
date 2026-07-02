import { Action, ActionPanel, Form, getPreferenceValues, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { ToolMode } from "../runtime/types";
import { sanitizeApiSettings } from "../runtime/api-settings";
import { listModels, ModelOption } from "../runtime/model-list";
import { resolveWorkflow } from "../runtime/tool-runtime";
import { ToolRenderer, ToolSetting } from "../tool-settings";
import { ToolDefinition } from "../tools";

export interface ToolSettingsFormProps {
  tool: ToolDefinition;
  setting: ToolSetting;
  onSave: (mode: ToolMode, patch: Partial<ToolSetting>) => Promise<void>;
}

export function ToolSettingsForm({ tool, setting, onSave }: ToolSettingsFormProps) {
  const { pop } = useNavigation();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const mode = tool.mode ?? "translate";
  const workflow = resolveWorkflow(setting.workflow);

  useEffect(() => {
    (async () => {
      const apiSettings = sanitizeApiSettings(getPreferenceValues());
      if (!apiSettings.apiBase) {
        return;
      }
      setIsLoadingModels(true);
      try {
        setModels(await listModels(apiSettings));
      } catch (error) {
        await showToast({
          title: "Model list unavailable",
          message: error instanceof Error ? error.message : String(error),
          style: Toast.Style.Failure,
        });
      } finally {
        setIsLoadingModels(false);
      }
    })();
  }, []);

  async function submit(values: {
    model: string;
    customModel: string;
    prompt: string;
    renderer: ToolRenderer;
    enableConversation: boolean;
  }) {
    await onSave(mode, {
      model: values.model,
      customModel: values.customModel.trim(),
      prompt: values.prompt,
      renderer: values.renderer,
      enableConversation: values.enableConversation,
    });
    await showToast({ title: "Tool settings saved", style: Toast.Style.Success });
    pop();
  }

  return (
    <Form
      isLoading={isLoadingModels}
      navigationTitle={`${tool.title} Settings`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Tool Settings" icon={Icon.Checkmark} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="model" title="Model" defaultValue={setting.model}>
        <Form.Dropdown.Item value="" title="Use Custom Model" />
        {models.map((model) => (
          <Form.Dropdown.Item key={model.id} value={model.id} title={model.name} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="customModel"
        title="Custom Model"
        defaultValue={setting.customModel}
        placeholder="Used when no model is selected"
      />
      <Form.TextArea id="prompt" title="Prompt" defaultValue={setting.prompt} />
      <Form.Dropdown id="renderer" title="Renderer" defaultValue={setting.renderer}>
        <Form.Dropdown.Item value="markdown" title="Markdown" />
        <Form.Dropdown.Item value="plain" title="Plain Text" />
      </Form.Dropdown>
      <Form.Checkbox
        id="enableConversation"
        title="Conversation"
        label="Enable multi-turn follow-up for this tool"
        defaultValue={setting.enableConversation}
      />
      <Form.Description
        title="Variables"
        text="{{input}}, {{source}}, {{sourceLang}}, {{targetLang}}, {{toolName}}, {{isoTime}}, {{localeTime}}, {{timezone}}, {{conversation}}"
      />
      <Form.Description
        title="Workflow"
        text={workflow.map((step, index) => `${index + 1}. ${step.title}`).join("\n")}
      />
    </Form>
  );
}
