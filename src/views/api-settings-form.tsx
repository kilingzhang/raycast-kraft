import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { ApiSettingsHook } from "../hooks/useApiSettings";
import { ApiCompatible, compatibilityProfiles, getCompatibilityProfile } from "../runtime/api-compatibility";
import { sanitizeApiSettings } from "../runtime/api-settings";
import { validateApiConnection } from "../runtime/api-validation";

export interface ApiSettingsFormProps {
  hook: ApiSettingsHook;
}

export function ApiSettingsForm({ hook }: ApiSettingsFormProps) {
  const { pop } = useNavigation();
  const [isValidating, setIsValidating] = useState(false);
  const [apiCompatible, setApiCompatible] = useState<ApiCompatible>(hook.data.apiCompatible);
  const [apiBase, setApiBase] = useState(
    hook.data.apiBase || getCompatibilityProfile(hook.data.apiCompatible).defaultApiBase,
  );
  const [apiKey, setApiKey] = useState(hook.data.apiKey);
  const selectedProfile = getCompatibilityProfile(apiCompatible);

  function handleCompatibleChange(value: string) {
    const nextCompatible = value as ApiCompatible;
    const currentDefault = selectedProfile.defaultApiBase;
    const nextDefault = getCompatibilityProfile(nextCompatible).defaultApiBase;
    setApiCompatible(nextCompatible);
    if (!apiBase || apiBase === currentDefault) {
      setApiBase(nextDefault);
    }
  }

  async function submit() {
    const settings = sanitizeApiSettings({ apiBase, apiKey, apiCompatible });
    const toast = await showToast({
      title: "Validating API settings...",
      message: "Checking model list",
      style: Toast.Style.Animated,
    });
    setIsValidating(true);
    try {
      const result = await validateApiConnection(settings, fetch, (message) => {
        toast.message = message;
      });
      toast.message = `Validated with ${result.model.id}`;
      await hook.save({
        ...settings,
        validatedAt: new Date().toISOString(),
        validatedModel: result.model.id,
      });
      toast.title = "API settings saved";
      toast.style = Toast.Style.Success;
      pop();
    } catch (error) {
      toast.title = "API validation failed";
      toast.message = error instanceof Error ? error.message : String(error);
      toast.style = Toast.Style.Failure;
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <Form
      isLoading={isValidating}
      navigationTitle="API Settings"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Validate and Save" icon={Icon.Checkmark} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="apiCompatible" title="API Compatible" value={apiCompatible} onChange={handleCompatibleChange}>
        {compatibilityProfiles.map((profile) => (
          <Form.Dropdown.Item key={profile.id} value={profile.id} title={profile.title} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="apiBase"
        title="API Base"
        value={apiBase}
        onChange={setApiBase}
        placeholder={selectedProfile.defaultApiBase}
      />
      <Form.PasswordField id="apiKey" title="API Key" value={apiKey} onChange={setApiKey} />
      <Form.Description
        title="Validation"
        text="Kraft will load the model list, take the first model, and send a hi chat request before saving."
      />
      {hook.data.validatedAt && (
        <Form.Description
          title="Last Validated"
          text={`${hook.data.validatedAt}${hook.data.validatedModel ? ` with ${hook.data.validatedModel}` : ""}`}
        />
      )}
    </Form>
  );
}
