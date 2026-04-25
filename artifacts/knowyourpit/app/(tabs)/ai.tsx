import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { fetch as expoFetch } from "expo/fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

const SUGGESTED = [
  "Best wood for brisket?",
  "How long per lb for pork butt?",
  "Stall explained",
  "Bark tips",
];

const INPUT_BAR_GAP_ABOVE_TABS = 10;
const CHAT_STORAGE_PREFIX = "kyp_pitmaster_chat:";
const MAX_STORED_MESSAGES = 100;

const getStorageKey = (userId: string | null | undefined) =>
  `${CHAT_STORAGE_PREFIX}${userId ?? "anon"}`;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const parseStoredMessages = (raw: unknown): Message[] => {
  if (!Array.isArray(raw)) return [];
  const out: Message[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const { id, role, content, suggestions } = entry;
    if (typeof id !== "string") continue;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const cleanedSuggestions = Array.isArray(suggestions)
      ? suggestions.filter((s): s is string => typeof s === "string")
      : undefined;
    out.push({
      id,
      role,
      content,
      suggestions: cleanedSuggestions && cleanedSuggestions.length > 0 ? cleanedSuggestions : undefined,
    });
  }
  return out;
};

export default function AIScreen() {
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken, userId } = useAuth();
  const listRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const botPad = tabBarHeight;
  const storageKey = getStorageKey(userId);

  // Load persisted history when the user (or storage key) changes.
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          setMessages([]);
          return;
        }
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
        setMessages(parseStoredMessages(parsed));
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Persist chat history whenever it changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    if (toStore.length === 0) {
      AsyncStorage.removeItem(storageKey).catch(() => {});
    } else {
      AsyncStorage.setItem(storageKey, JSON.stringify(toStore)).catch(() => {});
    }
  }, [messages, hydrated, storageKey]);

  const streamingIdRef = useRef<string | null>(null);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !hydrated) return;
    setInput("");

    const baseId = Date.now();
    const userMsg: Message = {
      id: baseId.toString(),
      role: "user",
      content: msg,
    };
    const assistantId = (baseId + 1).toString();
    streamingIdRef.current = assistantId;

    // Insert the user message and an empty assistant placeholder up front so
    // the UI can fill it in as tokens arrive.
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setLoading(true);

    const appendDelta = (delta: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
      );
    };
    const setAssistantContent = (content: string, suggestions?: string[]) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content,
                suggestions:
                  suggestions && suggestions.length > 0 ? suggestions : m.suggestions,
              }
            : m
        )
      );
    };
    const finalizeWithError = (errText: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: m.content
                  ? `${m.content}\n\n[${errText}]`
                  : errText,
                suggestions: undefined,
              }
            : m
        )
      );
    };

    try {
      if (!API_BASE_URL) throw new Error("API base URL not configured");

      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await expoFetch(`${API_BASE_URL}/api/ai/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in again to use PitMaster.");
        if (res.status === 429) throw new Error("Too many questions in a row. Please wait a moment.");
        throw new Error(`Request failed (${res.status})`);
      }

      if (!res.body) throw new Error("Streaming not supported on this device.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawAnyDelta = false;
      let sawDone = false;
      let finalSuggestions: string[] | undefined;
      let streamError: string | null = null;

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let evt: any;
        try {
          evt = JSON.parse(trimmed);
        } catch {
          return;
        }
        if (evt?.type === "delta" && typeof evt.text === "string") {
          sawAnyDelta = true;
          appendDelta(evt.text);
        } else if (evt?.type === "done") {
          sawDone = true;
          if (Array.isArray(evt.suggestions)) {
            finalSuggestions = evt.suggestions
              .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
              .slice(0, 3);
          }
        } else if (evt?.type === "error") {
          streamError = typeof evt.message === "string" && evt.message
            ? evt.message
            : "PitMaster ran into a problem mid-reply.";
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          handleLine(line);
        }
      }
      // Flush any trailing buffered line (no trailing newline).
      if (buffer.length > 0) handleLine(buffer);

      if (streamError) {
        finalizeWithError(streamError);
      } else if (!sawAnyDelta) {
        setAssistantContent("Sorry, I couldn't get a response.");
      } else if (!sawDone) {
        // Stream ended (clean EOF) before we got an explicit done event —
        // surface that as a soft failure so the user knows the reply may be
        // incomplete and can retry.
        finalizeWithError("Reply ended unexpectedly. Please try again.");
      } else if (finalSuggestions) {
        const suggestionsToAttach = finalSuggestions;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, suggestions: suggestionsToAttach } : m
          )
        );
      }
    } catch (e: any) {
      finalizeWithError(e?.message || "Connection error. Check your internet and try again.");
    } finally {
      streamingIdRef.current = null;
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (messages.length === 0 || loading) return;
    Alert.alert(
      "Clear chat?",
      "This will remove your PitMaster conversation history on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setMessages([]);
          },
        },
      ]
    );
  };

  const allItems: Message[] = messages;

  const lastMsg = messages[messages.length - 1];
  const showSuggestionsForId =
    !loading && lastMsg?.role === "assistant" && !input.trim() ? lastMsg.id : null;
  const streamingId = loading ? streamingIdRef.current : null;

  const headerRight =
    messages.length > 0 ? (
      <Pressable
        onPress={clearChat}
        hitSlop={8}
        disabled={loading}
        accessibilityLabel="Clear chat history"
        style={s.headerBtn}
      >
        <Feather name="trash-2" size={18} color="#F3EDE1" />
      </Pressable>
    ) : null;

  const renderMsg = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const showChips =
      !isUser &&
      item.id === showSuggestionsForId &&
      !!item.suggestions &&
      item.suggestions.length > 0;
    const isStreaming = !isUser && item.id === streamingId;
    const isAwaitingFirstToken = isStreaming && item.content.length === 0;
    return (
      <View style={[s.msgRow, isUser && s.msgRowUser]}>
        {!isUser && (
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Feather name="zap" size={12} color="#fff" />
          </View>
        )}
        <View style={[s.msgColumn, { alignItems: isUser ? "flex-end" : "flex-start" }]}>
          <View
            style={[
              s.bubble,
              {
                backgroundColor: isUser ? colors.primary : colors.card,
                borderColor: isUser ? colors.primary : colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            {isAwaitingFirstToken ? (
              <Text style={[s.bubbleText, { color: colors.mutedForeground }]}>…</Text>
            ) : (
              <Text style={[s.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
                {item.content}
                {isStreaming && (
                  <Text style={[s.bubbleText, { color: colors.mutedForeground }]}>▋</Text>
                )}
              </Text>
            )}
          </View>
          {showChips && (
            <View style={s.chips}>
              {item.suggestions!.slice(0, 3).map((q) => (
                <Pressable
                  key={q}
                  onPress={() => sendMessage(q)}
                  disabled={loading}
                  style={[
                    s.chip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text style={[s.chipText, { color: colors.foreground }]}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="PitMaster" dark right={headerRight} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {messages.length === 0 && !loading && (
          <View style={s.welcome}>
            <Text style={[s.welcomeTitle, { color: colors.foreground }]}>Ask me anything BBQ</Text>
            <View style={s.suggestions}>
              {SUGGESTED.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => sendMessage(q)}
                  style={[s.suggestion, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
                >
                  <Text style={[s.suggestionText, { color: colors.foreground }]}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={allItems}
          extraData={`${showSuggestionsForId ?? ""}|${input.length === 0}|${streamingId ?? ""}`}
          keyExtractor={(item) => item.id}
          renderItem={renderMsg}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 16,
            gap: 12,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          inverted={messages.length > 0}
          scrollEnabled={messages.length > 0}
          onContentSizeChange={() => {
            if (messages.length > 0) listRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
        />

        <View
          style={[
            s.inputBar,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              paddingBottom: botPad + INPUT_BAR_GAP_ABOVE_TABS,
            },
          ]}
        >
          <View
            style={[
              s.inputWrap,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 8 },
            ]}
          >
            <TextInput
              style={[s.textInput, { color: colors.foreground }]}
              placeholder="Ask about temperatures, timing, wood..."
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <Pressable
              style={[
                s.sendBtn,
                { backgroundColor: loading || !hydrated || !input.trim() ? colors.muted : colors.primary },
              ]}
              onPress={() => sendMessage()}
              disabled={loading || !hydrated || !input.trim()}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Feather
                  name="send"
                  size={16}
                  color={loading || !hydrated || !input.trim() ? colors.mutedForeground : "#fff"}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  welcome: { paddingHorizontal: 20, paddingTop: 32, alignItems: "center" },
  welcomeTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginBottom: 20, textAlign: "center" },
  suggestions: { width: "100%", gap: 10 },
  suggestion: { borderWidth: 1, padding: 14 },
  suggestionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowUser: { flexDirection: "row-reverse" },
  msgColumn: { flex: 1, gap: 10 },
  avatar: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  bubble: { maxWidth: "78%", borderWidth: 1, padding: 12 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  chips: { width: "100%", gap: 10 },
  chip: { borderWidth: 1, padding: 14 },
  chipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  inputBar: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  inputWrap: {
    flexDirection: "row", alignItems: "flex-end",
    borderWidth: 1, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  textInput: {
    flex: 1, fontSize: 15, fontFamily: "Inter_400Regular",
    maxHeight: 100, paddingTop: 4, paddingBottom: 4,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginLeft: 8,
  },
  headerBtn: {
    padding: 6,
  },
});
