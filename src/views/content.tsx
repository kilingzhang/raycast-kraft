import {
  Action,
  ActionPanel,
  Clipboard,
  confirmAlert,
  getPreferenceValues,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import capitalize from "capitalize";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { getLoadActionSection } from "../actions/load";
import { useApiSettings } from "../hooks/useApiSettings";
import { HistoryHook, Record } from "../hooks/useHistory";
import { useProxy } from "../hooks/useProxy";
import { QueryHook } from "../hooks/useQuery";
import { getLangName, detectLang } from "../runtime/languages";
import { ToolMode } from "../runtime/types";
import { getErrorText } from "../runtime/http";
import { streamChatCompletions } from "../runtime/llm-client";
import { buildPromptMessages, buildToolVariables, ConversationMessage } from "../runtime/tool-runtime";
import { resolveToolModel, ToolSetting } from "../tool-settings";
import { ToolDefinition, executionTools } from "../tools";
import { DetailView } from "./detail";
import { EmptyView } from "./empty";
import { ToolSettingsForm } from "./tool-settings-form";

export interface ContentViewProps {
  query: QueryHook;
  history: HistoryHook;
  mode: ToolMode;
  setMode: (value: ToolMode) => void;
  activeTool: ToolDefinition;
  toolSetting: ToolSetting;
  updateToolSetting: (mode: ToolMode, patch: Partial<ToolSetting>) => Promise<void>;
  setSelectedId: (value: string) => void;
  setIsInit: (value: boolean) => void;
  setIsEmpty: (value: boolean) => void;
}

export interface RuntimeQuery {
  text: string;
  detectFrom: string;
  detectTo: string;
  mode: ToolMode;
  toolTitle: string;
  model: string;
}

export interface Querying {
  hook: QueryHook;
  query: RuntimeQuery;
  id: string;
  controller: AbortController;
}

type ViewItem = Querying | Record;

const { alwayShowMetadata } = getPreferenceValues<{
  alwayShowMetadata: boolean;
}>();

const { isAutoCopy2Clipboard } = getPreferenceValues<{
  isAutoCopy2Clipboard: boolean;
}>();

function isQuerying(item: ViewItem): item is Querying {
  return "controller" in item;
}

export const ContentView = (props: ContentViewProps) => {
  const {
    query,
    history,
    mode,
    setMode,
    activeTool,
    toolSetting,
    updateToolSetting,
    setSelectedId,
    setIsInit,
    setIsEmpty,
  } = props;
  const agent = useProxy();
  const apiSettings = useApiSettings();
  const [data, setData] = useState<ViewItem[]>();
  const [querying, setQuerying] = useState<Querying | null>();
  const [translatedText, setTranslatedText] = useState("");
  const [showMetadata, setShowMetadata] = useState(alwayShowMetadata);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);

  function updateData() {
    if (history.data) {
      const sortedResults = [...history.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      if (querying == null) {
        setData(sortedResults);
        if (sortedResults.length > 0) {
          setSelectedId(sortedResults[0].id);
        }
        setIsInit(false);
      } else {
        setData([querying, ...sortedResults]);
        setSelectedId("querying");
        setIsInit(false);
      }
    }
  }

  async function copy2Clipboard(text: string) {
    await Clipboard.copy(text);
    await showToast({
      title: "Result copied to Clipboard",
      style: Toast.Style.Success,
    });
  }

  async function doQuery() {
    const model = resolveToolModel(toolSetting) || apiSettings.data.validatedModel || "";
    if (!model) {
      await showToast({
        title: "Model is required",
        message: "Choose a model in Tool Settings or enter a custom model.",
        style: Toast.Style.Failure,
      });
      query.updateQuerying(false);
      return;
    }

    if (!apiSettings.data.apiBase || !apiSettings.data.validatedAt) {
      await showToast({
        title: "Validate API settings first",
        message: "Open API Settings and pass the model list plus hi chat check.",
        style: Toast.Style.Failure,
      });
      query.updateQuerying(false);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const toast = await showToast({
      title: "Running AI tool...",
      style: Toast.Style.Animated,
    });

    const text = query.text;
    const detectFrom: string = query.from == "auto" ? (await detectLang(query.text)) ?? "en" : query.from;
    const detectTo = query.to;
    const img = query.ocrImage;
    const messages = buildPromptMessages({
      systemPrompt: "You are executing the {{toolName}} tool. Follow the tool prompt exactly.",
      userPrompt: toolSetting.prompt,
      variables: buildToolVariables({
        input: text,
        source: img ? "ocr" : "manual",
        sourceLang: getLangName(detectFrom),
        targetLang: getLangName(detectTo),
        toolName: activeTool.title,
        conversation,
      }),
      conversation,
      includeConversation: toolSetting.enableConversation,
    });

    const runtimeQuery: RuntimeQuery = {
      mode,
      text,
      detectFrom,
      detectTo,
      toolTitle: activeTool.title,
      model,
    };
    const activeQuerying: Querying = {
      hook: query,
      controller,
      query: runtimeQuery,
      id: "querying",
    };

    setTranslatedText("");
    setQuerying(activeQuerying);
    query.updateText("");

    let output = "";
    try {
      for await (const delta of streamChatCompletions({
        settings: apiSettings.data,
        model,
        messages,
        signal,
        agent,
      })) {
        output += delta;
        setTranslatedText(output);
      }

      if (isAutoCopy2Clipboard) {
        await copy2Clipboard(output);
      } else {
        toast.title = "AI result ready";
        toast.style = Toast.Style.Success;
      }

      const record: Record = {
        id: uuidv4(),
        mode,
        created_at: new Date().toISOString(),
        result: {
          from: detectFrom,
          to: detectTo,
          original: text,
          text: output,
        },
        ocrImg: img,
        provider: `${apiSettings.data.apiCompatible} / ${model}`,
      };
      await history.add(record);
      if (toolSetting.enableConversation) {
        setConversation((current) => [
          ...current,
          { role: "user", content: text },
          { role: "assistant", content: output },
        ]);
      }
      query.updateQuerying(false);
    } catch (error) {
      if (signal.aborted) {
        toast.title = "Run cancelled";
        toast.style = Toast.Style.Success;
        query.updateQuerying(false);
        return;
      }
      const message = getErrorText(error);
      toast.title = "Error";
      toast.message = message;
      toast.style = Toast.Style.Failure;
      const record: Record = {
        id: uuidv4(),
        mode,
        created_at: new Date().toISOString(),
        result: {
          from: detectFrom,
          to: detectTo,
          original: text,
          text: output,
          error: message,
        },
        ocrImg: img,
        provider: `${apiSettings.data.apiCompatible} / ${model}`,
      };
      await history.add(record);
      query.updateQuerying(false);
    }
  }

  useEffect(() => {
    if (query.querying && !querying) {
      doQuery();
    } else if (!query.querying && querying) {
      setQuerying(null);
    }
  }, [query.querying]);

  useEffect(() => {
    updateData();
  }, [history.data, querying]);

  useEffect(() => {
    setIsEmpty(data == undefined || data.length == 0);
  }, [data]);

  const getQueryingActionPanel = () => (
    <ActionPanel>
      <Action
        title="Cancel Run"
        icon={Icon.Stop}
        shortcut={{ modifiers: ["ctrl"], key: "c" }}
        onAction={() => {
          if (querying) {
            querying.controller.abort();
          }
        }}
      />
    </ActionPanel>
  );

  const getToolActionSection = () => (
    <ActionPanel.Submenu title="Switch Tool" icon={Icon.CommandSymbol} shortcut={{ modifiers: ["cmd"], key: "m" }}>
      {executionTools.map((tool) => (
        <Action
          title={tool.title}
          icon={Icon.Text}
          key={tool.id}
          autoFocus={tool.mode === mode}
          onAction={() => {
            if (tool.mode) {
              setMode(tool.mode);
            }
          }}
        />
      ))}
    </ActionPanel.Submenu>
  );

  const getCommonActions = () => (
    <>
      {query.text && (
        <Action
          title={toolSetting.enableConversation && conversation.length > 0 ? "Continue Conversation" : activeTool.title}
          icon={Icon.Book}
          onAction={() => query.updateQuerying(true)}
        />
      )}
      <Action
        title={`Control ${query.langType == "To" ? "Source" : "Output"} Language`}
        icon={Icon.Switch}
        onAction={() => {
          query.updateLangType(query.langType == "To" ? "From" : "To");
        }}
      />
      {getToolActionSection()}
      <Action.Push
        title="Tool Settings"
        icon={Icon.Gear}
        shortcut={{ modifiers: ["cmd"], key: "," }}
        target={<ToolSettingsForm tool={activeTool} setting={toolSetting} onSave={updateToolSetting} />}
      />
    </>
  );

  const getRecordActionPanel = (record: Record) => (
    <ActionPanel>
      {getCommonActions()}
      <ActionPanel.Section title="Copy">
        <Action.CopyToClipboard
          title="Copy Result"
          content={record.result.text ?? ""}
          shortcut={{ modifiers: ["cmd", "ctrl"], key: "c" }}
        />
        <Action.CopyToClipboard
          title="Copy Original"
          content={record.result.original ?? ""}
          shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
        />
      </ActionPanel.Section>
      {getLoadActionSection(record, (str) => {
        query.updateText(str);
      })}
      <ActionPanel.Section title="Options">
        <Action
          title={showMetadata ? "Hide Metadata" : "Show Metadata"}
          icon={showMetadata ? Icon.EyeSlash : Icon.Eye}
          shortcut={{ modifiers: ["cmd", "ctrl"], key: "m" }}
          onAction={() => {
            setShowMetadata(!showMetadata);
          }}
        />
        {toolSetting.enableConversation && conversation.length > 0 && (
          <Action
            title="Clear Conversation"
            icon={Icon.XmarkCircle}
            onAction={() => {
              setConversation([]);
            }}
          />
        )}
      </ActionPanel.Section>
      <ActionPanel.Section title="History">
        <Action
          title="Delete Item"
          icon={{ source: Icon.Trash, tintColor: "red" }}
          style={Action.Style.Destructive}
          shortcut={{ modifiers: ["ctrl"], key: "x" }}
          onAction={async () => {
            if (
              await confirmAlert({
                title: "Remove Item?",
              })
            ) {
              history.remove(record);
            }
          }}
        />
        <Action
          title="Clear History"
          icon={Icon.DeleteDocument}
          style={Action.Style.Destructive}
          shortcut={{ modifiers: ["ctrl", "opt"], key: "x" }}
          onAction={async () => {
            if (
              await confirmAlert({
                title: "Clear History?",
                message: `${history.data?.length} items will be removed.`,
              })
            ) {
              history.clear();
            }
          }}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );

  return data == undefined ? null : data.length === 0 ? (
    <EmptyView />
  ) : (
    <List.Section
      title={toolSetting.enableConversation ? "Results & Conversation" : "History"}
      subtitle={history.data?.length.toLocaleString()}
    >
      {data?.map((item, i) => {
        return isQuerying(item) ? (
          <List.Item
            id={item.id}
            key={item.id}
            title={item.query.text}
            subtitle="Generating..."
            accessories={[{ text: item.query.toolTitle }, { text: item.query.model }]}
            actions={getQueryingActionPanel()}
            detail={
              <DetailView
                showMetadata={showMetadata}
                text={translatedText}
                isLoading={translatedText.length === 0}
                original={item.query.text}
                from={item.query.detectFrom}
                mode={item.query.mode}
                ocrImg={query.ocrImage}
                to={item.query.detectTo}
                provider={item.query.model}
              />
            }
          />
        ) : (
          <List.Item
            id={item.id}
            key={item.id}
            title={item.result.original}
            subtitle={item.result.error || item.result.text}
            accessories={[{ text: item.result.error ? "Error" : capitalize(item.mode) }, { text: `#${i}` }]}
            actions={getRecordActionPanel(item)}
            detail={
              <DetailView
                showMetadata={showMetadata}
                text={item.result.text}
                error={item.result.error}
                original={item.result.original}
                from={item.result.from}
                to={item.result.to}
                mode={item.mode}
                created_at={item.created_at}
                ocrImg={item.ocrImg}
                provider={item.provider}
              />
            }
          />
        );
      })}
    </List.Section>
  );
};
