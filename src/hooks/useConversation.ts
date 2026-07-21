import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConversationMessage } from "../runtime/tool-runtime";
import { ToolMode } from "../runtime/types";

export type ConversationByMode = Record<string, ConversationMessage[]>;

export interface ConversationHook {
  conversation: ConversationMessage[];
  appendTurn: (userText: string, assistantText: string) => void;
  clear: () => void;
  clearMode: (mode: ToolMode) => void;
}

export function useConversation(mode: ToolMode, enabled: boolean): ConversationHook {
  const cacheRef = useRef<ConversationByMode>({});
  const [conversation, setConversation] = useState<ConversationMessage[]>(() => cacheRef.current[mode] ?? []);

  useEffect(() => {
    setConversation(cacheRef.current[mode] ?? []);
  }, [mode]);

  const appendTurn = useCallback(
    (userText: string, assistantText: string) => {
      if (!enabled) {
        return;
      }
      setConversation((current) => {
        const next = [...current, { role: "user" as const, content: userText }, { role: "assistant" as const, content: assistantText }];
        cacheRef.current[mode] = next;
        return next;
      });
    },
    [enabled, mode],
  );

  const clear = useCallback(() => {
    cacheRef.current[mode] = [];
    setConversation([]);
  }, [mode]);

  const clearMode = useCallback((targetMode: ToolMode) => {
    cacheRef.current[targetMode] = [];
    if (targetMode === mode) {
      setConversation([]);
    }
  }, [mode]);

  return useMemo(
    () => ({
      conversation: enabled ? conversation : [],
      appendTurn,
      clear,
      clearMode,
    }),
    [enabled, conversation, appendTurn, clear, clearMode],
  );
}