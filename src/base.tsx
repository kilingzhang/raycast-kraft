import { List, ActionPanel, Action, LaunchProps, Icon } from "@raycast/api";
import { useState } from "react";
import { ContentView } from "./views/content";
import { useQuery } from "./hooks/useQuery";
import { LangDropdown } from "./views/lang-dropdown";
import { useHistory } from "./hooks/useHistory";
import capitalize from "capitalize";
import { ToolMode } from "./runtime/types";
import { useApiSettings } from "./hooks/useApiSettings";
import { useAppSettings } from "./hooks/useAppSettings";
import { useToolSettings } from "./hooks/useToolSettings";
import { executionTools } from "./tools";

export default function getBase(
  props: LaunchProps,
  initialMode: ToolMode = "translate",
  forceEnableAutoStart = false,
  forceEnableAutoLoadSelected = false,
  forceEnableAutoLoadClipboard = false,
) {
  let initialQuery: string | undefined = "";
  let ocrImage: string | undefined;
  if (props.launchContext) {
    initialMode = props.launchContext["mode"] as ToolMode;
    initialQuery = props.launchContext["txt"];
    ocrImage = props.launchContext["img"];
    // if has key of autoStart, set it else set to false
    if (props.launchContext["autoStart"]) {
      forceEnableAutoStart = props.launchContext["autoStart"] as boolean;
    } else {
      if (props.launchContext["img"]) {
        forceEnableAutoStart = true; // ocr hack
      } else {
        forceEnableAutoStart = false;
      }
    }

    if (props.launchContext["loadSelected"]) {
      forceEnableAutoLoadSelected = props.launchContext["loadSelected"] as boolean;
    } else {
      forceEnableAutoLoadSelected = false;
    }

    if (props.launchContext["loadClipboard"]) {
      forceEnableAutoLoadClipboard = props.launchContext["loadClipboard"] as boolean;
    } else {
      forceEnableAutoLoadClipboard = false;
    }
  } else {
    initialQuery = props.fallbackText;
  }

  const [mode, setMode] = useState<ToolMode>(initialMode);
  const [selectedId, setSelectedId] = useState<string>("");
  const appSettings = useAppSettings();
  const query = useQuery({
    initialQuery,
    forceEnableAutoStart,
    forceEnableAutoLoadSelected,
    forceEnableAutoLoadClipboard,
    ocrImage,
    appSettings: appSettings.data,
  });
  const history = useHistory(appSettings.data);
  const apiSettings = useApiSettings();
  const toolSettings = useToolSettings();

  const [isInit, setIsInit] = useState<boolean>(true);
  const [isEmpty, setIsEmpty] = useState<boolean>(true);

  if (appSettings.isLoading || apiSettings.isLoading || toolSettings.isLoading || history.isLoading) {
    return <List isLoading />;
  }

  const activeTool = executionTools.find((tool) => tool.mode === mode) ?? executionTools[0];
  const activeTitle = activeTool?.title ?? capitalize(mode);
  return (
    <List
      searchText={query.text}
      isShowingDetail={!isInit && !isEmpty}
      filtering={false}
      isLoading={isInit || query.isLoading}
      selectedItemId={selectedId}
      searchBarPlaceholder={`${activeTitle}...`}
      onSearchTextChange={query.updateText}
      searchBarAccessory={
        <LangDropdown
          type={query.langType}
          selectedStandardLang={query.langType == "To" ? query.to : query.from}
          onLangChange={query.langType == "To" ? query.updateTo : query.updateFrom}
        />
      }
      throttle={false}
      navigationTitle={activeTitle}
      actions={
        <ActionPanel>
          {query.text && <Action title={activeTitle} icon={Icon.Book} onAction={() => query.updateQuerying(true)} />}
          <Action
            title={`Control ${query.langType == "To" ? "Source" : "Output"} Language`}
            icon={Icon.Switch}
            onAction={() => {
              query.updateLangType(query.langType == "To" ? "From" : "To");
            }}
          />
        </ActionPanel>
      }
    >
      <ContentView
        query={query}
        history={history}
        mode={mode}
        setMode={setMode}
        activeTool={activeTool}
        toolSetting={toolSettings.data[mode]}
        updateToolSetting={toolSettings.updateToolSetting}
        setSelectedId={setSelectedId}
        setIsInit={setIsInit}
        setIsEmpty={setIsEmpty}
        appSettings={appSettings.data}
      />
    </List>
  );
}
