import { Action, ActionPanel, Clipboard, closeMainWindow, getSelectedText, Icon, Keyboard, showHUD, showToast, Toast } from "@raycast/api";

export async function pasteToFrontmost(text: string, options?: { hud?: string }) {
  const content = text ?? "";
  if (!content) {
    await showToast({
      title: "Nothing to paste",
      style: Toast.Style.Failure,
    });
    return;
  }

  await closeMainWindow({ clearRootSearch: true });
  await Clipboard.paste(content);
  if (options?.hud) {
    await showHUD(options.hud);
  }
}

export async function replaceSelectedText(text: string) {
  const content = text ?? "";
  if (!content) {
    await showToast({
      title: "Nothing to replace with",
      style: Toast.Style.Failure,
    });
    return;
  }

  try {
    const selected = (await getSelectedText()).trim();
    if (!selected) {
      await showToast({
        title: "No selected text in frontmost app",
        message: "Select text first, then replace it with the result.",
        style: Toast.Style.Failure,
      });
      return;
    }
  } catch {
    await showToast({
      title: "No selected text in frontmost app",
      message: "Select text first, then replace it with the result.",
      style: Toast.Style.Failure,
    });
    return;
  }

  await pasteToFrontmost(content, { hud: "Replaced selected text" });
}

export function getOutputActionSection(text: string | undefined) {
  const content = text ?? "";
  return (
    <ActionPanel.Section title="Output">
      <Action
        title="Paste Result"
        icon={Icon.Clipboard}
        shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
        onAction={() => pasteToFrontmost(content, { hud: "Pasted result" })}
      />
      <Action
        title="Replace Selected Text"
        icon={Icon.TextCursor}
        shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
        onAction={() => replaceSelectedText(content)}
      />
      <Action.CopyToClipboard
        title="Copy Result"
        content={content}
        shortcut={Keyboard.Shortcut.Common.CopyPath}
      />
    </ActionPanel.Section>
  );
}
