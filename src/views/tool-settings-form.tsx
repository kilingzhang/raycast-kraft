import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { useApiSettings } from "../hooks/useApiSettings";
import { ToolMode } from "../runtime/types";
import { validateApiConnection } from "../runtime/api-validation";
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
  const apiSettings = useApiSettings();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const mode = tool.mode ?? "translate";
  const workflow = resolveWorkflow(setting.workflow);

  useEffect(() => {
    (async () => {
      if (apiSettings.isLoading || !apiSettings.data.apiBase || !apiSettings.data.validatedAt) {
        return;
      }
      setIsLoadingModels(true);
      try {
        setModels(await listModels(apiSettings.data));
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
  }, [apiSettings.data, apiSettings.isLoading]);

  async function submit(values: {
    model: string;
    customModel: string;
    prompt: string;
    renderer: ToolRenderer;
    enableConversation: boolean;
  }) {
    const model = values.customModel.trim() || values.model || apiSettings.data.validatedModel || "";
    if (!apiSettings.data.validatedAt) {
      await showToast({
        title: "Validate API settings first",
        message: "Open API Settings and pass the model list plus hi chat check.",
        style: Toast.Style.Failure,
      });
      return;
    }
    if (!model) {
      await showToast({
        title: "Model is required",
        message: "Choose a model or enter a custom model.",
        style: Toast.Style.Failure,
      });
      return;
    }

    const toast = await showToast({
      title: "Validating model...",
      message: "Sending hi chat",
      style: Toast.Style.Animated,
    });
    setIsValidating(true);
    try {
      await validateApiConnection({ ...apiSettings.data, validatedModel: model }, fetch, (message) => {
        toast.message = message;
      });
      toast.title = "Model validated";
      toast.style = Toast.Style.Success;
    } catch (error) {
      toast.title = "Model validation failed";
      toast.message = error instanceof Error ? error.message : String(error);
      toast.style = Toast.Style.Failure;
      setIsValidating(false);
      return;
    }

    await onSave(mode, {
      model: values.model,
      customModel: values.customModel.trim(),
      prompt: values.prompt,
      renderer: values.renderer,
      enableConversation: values.enableConversation,
    });
    toast.title = "Tool settings saved";
    toast.style = Toast.Style.Success;
    setIsValidating(false);
    pop();
  }

  return (
    <Form
      isLoading={apiSettings.isLoading || isLoadingModels || isValidating}
      navigationTitle={`${tool.title} Settings`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Tool Settings" icon={Icon.Checkmark} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="model" title="Model" defaultValue={setting.model}>
        <Form.Dropdown.Item value="" title={apiSettings.data.validatedModel || "Use Custom Model"} />
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
