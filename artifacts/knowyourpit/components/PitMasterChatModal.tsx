import React, { useCallback, useEffect, useRef, useState } from "react";
import { getTokenSafe } from "@/lib/getTokenSafe";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { fetch as expoFetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { useBottomInset } from "@/hooks/useBottomInset";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { usePaywall } from "@/contexts/PaywallContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";
import { useSubscription } from "@/contexts/SubscriptionContext";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationGroup {
  label: string;
  items: Conversation[];
}

const HISTORY_LIMIT = 20;

const SUGGESTED = [
  "How long per lb for pork butt?",
  "Best wood for beef ribs?",
  "How do I manage heat zones on my grill?",
  "How do I get a better crust on steak?",
];

const FOOD_KEYWORDS = [
  "brisket", "ribs", "pork butt", "pork shoulder", "pork belly", "pulled pork",
  "chicken", "wings", "turkey", "tri tip", "tri-tip", "steak", "burger", "burgers",
  "salmon", "fish", "sausage", "sausages", "bacon", "lamb", "prime rib", "pork",
];

function detectFoodTypeFromText(
  current: string,
  history: Array<{ role: string; content: string }>,
): string | null {
  const sources = [current];
  for (let i = history.length - 1; i >= 0 && sources.length < 4; i--) {
    if (history[i]?.role === "user" && typeof history[i]?.content === "string") {
      sources.push(history[i].content);
    }
  }
  for (const text of sources) {
    const lower = text.toLowerCase();
    for (const kw of FOOD_KEYWORDS) {
      if (lower.includes(kw)) return kw;
    }
  }
  return null;
}

function groupConversations(convs: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(startOfToday);
  startOfMonth.setDate(startOfMonth.getDate() - 30);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Past 7 days", items: [] },
    { label: "Past 30 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conv of convs) {
    const d = new Date(conv.updatedAt);
    if (d >= startOfToday) {
      groups[0].items.push(conv);
    } else if (d >= startOfYesterday) {
      groups[1].items.push(conv);
    } else if (d >= startOfWeek) {
      groups[2].items.push(conv);
    } else if (d >= startOfMonth) {
      groups[3].items.push(conv);
    } else {
      groups[4].items.push(conv);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export interface PitMasterChatModalProps {
  visible: boolean;
  onClose: () => void;
  seedMessage?: string;
  contextLabel?: string;
  /** Cook-specific suggested questions. When provided, replaces the generic SUGGESTED list and adjusts the welcome title. */
  cookSuggestions?: string[];
}

export function PitMasterChatModal({
  visible,
  onClose,
  seedMessage,
  contextLabel,
  cookSuggestions,
}: PitMasterChatModalProps) {
  const colors = useColors();
  const botInset = useBottomInset();
  const { isTablet, contentMaxWidth } = useLayout();
  const { getToken, isSignedIn } = useAuth();
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [streamingRemaining, setStreamingRemaining] = useState<number | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<number | null>(null);

  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renaming, setRenaming] = useState(false);

  const streamingIdRef = useRef<string | null>(null);
  const introInjectedRef = useRef(false);
  const pendingSeedRef = useRef<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getTokenSafe(getToken);
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, [getToken]);

  const { showPaywall } = usePaywall();
  const { data: paywallUsage, refetch: refetchPaywall } = usePaywallUsage();
  const { isPro } = useSubscription();

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const detectedFood = detectFoodTypeFromText(msg, messages);

    if (
      paywallUsage &&
      !paywallUsage.unlimited &&
      paywallUsage.remaining.aiMessagesToday <= 0
    ) {
      showPaywall({
        trigger: "ai_message_limit_reached",
        foodType: detectedFood,
      });
      return;
    }

    setInput("");

    const baseId = Date.now();
    const userMsg: Message = { id: baseId.toString(), role: "user", content: msg };
    const assistantId = (baseId + 1).toString();
    streamingIdRef.current = assistantId;

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
    const setAssistantSuggestions = (suggestions: string[]) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && suggestions.length > 0 ? { ...m, suggestions } : m
        )
      );
    };
    const finalizeWithError = (errText: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content ? `${m.content}\n\n[${errText}]` : errText, suggestions: undefined }
            : m
        )
      );
    };

    try {
      if (!API_BASE_URL) throw new Error("API base URL not configured");

      const token = await getTokenSafe(getToken);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (isPro) headers["X-Subscription-Active"] = "true";

      const body: Record<string, unknown> = { message: msg };
      if (currentSessionId != null) body.sessionId = currentSessionId;

      const res = await expoFetch(`${API_BASE_URL}/api/ai/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in again to use PitMaster.");
        if (res.status === 402) {
          let payload: any = null;
          try { payload = await res.json(); } catch { }
          showPaywall({
            trigger: "ai_message_limit_reached",
            subtitle: payload?.message ?? null,
            foodType: detectedFood,
          });
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantId));
          setInput(msg);
          setLoading(false);
          streamingIdRef.current = null;
          return;
        }
        if (res.status === 429) throw new Error("Too many questions in a row. Please wait a moment.");
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawAnyDelta = false;
      let sawDone = false;
      let finalSuggestions: string[] = [];
      let streamError: string | null = null;
      let localSessionId: number | null = currentSessionId;

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let evt: any;
        try { evt = JSON.parse(trimmed); } catch { return; }
        if (evt?.type === "session" && typeof evt.sessionId === "number") {
          localSessionId = evt.sessionId;
          setCurrentSessionId(evt.sessionId);
          setConversations((prev) => {
            if (prev.some((c) => c.id === evt.sessionId)) return prev;
            const newConv: Conversation = {
              id: evt.sessionId,
              title: msg.slice(0, 80),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            return [newConv, ...prev];
          });
        } else if (evt?.type === "delta" && typeof evt.text === "string") {
          sawAnyDelta = true;
          appendDelta(evt.text);
        } else if (evt?.type === "done") {
          sawDone = true;
          if (Array.isArray(evt.suggestions)) {
            finalSuggestions = evt.suggestions
              .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
              .slice(0, 3);
          }
          if (typeof evt.remaining === "number") {
            setStreamingRemaining(evt.remaining);
          }
          if (typeof evt.title === "string" && evt.title.trim()) {
            const smartTitle = evt.title.trim();
            setConversations((prev) =>
              prev.map((c) =>
                c.id === localSessionId ? { ...c, title: smartTitle } : c
              )
            );
          }
        } else if (evt?.type === "error") {
          streamError = typeof evt.message === "string" && evt.message
            ? evt.message
            : "PitMaster ran into a problem mid-reply.";
        }
      };

      if (reader) {
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
        if (buffer.length > 0) handleLine(buffer);
      } else {
        const text = await res.text();
        for (const line of text.split("\n")) handleLine(line);
      }

      if (streamError) {
        finalizeWithError(streamError);
      } else if (!sawAnyDelta) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "No response came through. Check your connection and try again." } : m
          )
        );
      } else if (!sawDone) {
        finalizeWithError("Reply ended unexpectedly. Please try again.");
      } else if (finalSuggestions.length > 0) {
        setAssistantSuggestions(finalSuggestions);
      }
    } catch (e: any) {
      finalizeWithError(e?.message || "Connection error. Check your internet and try again.");
    } finally {
      streamingIdRef.current = null;
      setLoading(false);
      refetchPaywall().then(() => setStreamingRemaining(null)).catch(() => { });
    }
  }, [input, loading, messages, paywallUsage, showPaywall, getToken, isPro, currentSessionId, refetchPaywall]);

  const fetchConversations = useCallback(async () => {
    if (!isSignedIn || !API_BASE_URL) return;
    setHistoryLoading(true);
    try {
      const headers = await authHeaders();
      const res = await expoFetch(`${API_BASE_URL}/api/ai/chats`, { headers });
      if (res.ok) {
        const data = await res.json() as { conversations: Conversation[] };
        setConversations(data.conversations ?? []);
      }
    } catch { } finally {
      setHistoryLoading(false);
    }
  }, [isSignedIn, authHeaders]);

  const loadConversation = useCallback(async (conv: Conversation) => {
    if (!API_BASE_URL) return;
    setLoadingChatId(conv.id);
    try {
      const headers = await authHeaders();
      const res = await expoFetch(`${API_BASE_URL}/api/ai/chats/${conv.id}`, { headers });
      if (!res.ok) return;
      const data = await res.json() as { messages: { id: number; role: string; content: string }[] };
      const loaded: Message[] = (data.messages ?? []).map((m) => ({
        id: String(m.id),
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      setMessages(loaded);
      setCurrentSessionId(conv.id);
      setShowHistory(false);
    } catch {
      Alert.alert("Error", "Could not load that chat. Please try again.");
    } finally {
      setLoadingChatId(null);
    }
  }, [authHeaders]);

  const deleteConversation = useCallback((conv: Conversation) => {
    Alert.alert(
      "Delete chat?",
      `"${conv.title}" will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const headers = await authHeaders();
              await expoFetch(`${API_BASE_URL}/api/ai/chats/${conv.id}`, {
                method: "DELETE",
                headers,
              });
              setConversations((prev) => prev.filter((c) => c.id !== conv.id));
              if (currentSessionId === conv.id) {
                setMessages([]);
                setCurrentSessionId(null);
              }
            } catch {
              Alert.alert("Error", "Could not delete chat.");
            }
          },
        },
      ]
    );
  }, [authHeaders, currentSessionId]);

  const openRename = useCallback((conv: Conversation) => {
    setRenameTarget(conv);
    setRenameText(conv.title);
  }, []);

  const submitRename = useCallback(async () => {
    if (!renameTarget || !renameText.trim() || !API_BASE_URL) return;
    setRenaming(true);
    try {
      const headers = await authHeaders();
      const res = await expoFetch(`${API_BASE_URL}/api/ai/chats/${renameTarget.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ title: renameText.trim() }),
      });
      if (res.ok) {
        const newTitle = renameText.trim();
        setConversations((prev) =>
          prev.map((c) => (c.id === renameTarget.id ? { ...c, title: newTitle } : c))
        );
      } else {
        Alert.alert("Error", "Could not rename chat. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Could not rename chat. Please try again.");
    } finally {
      setRenaming(false);
      setRenameTarget(null);
    }
  }, [renameTarget, renameText, authHeaders]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
  }, []);

  const openHistory = useCallback(() => {
    fetchConversations();
    setShowHistory(true);
  }, [fetchConversations]);

  // ── Seed message auto-send ─────────────────────────────────────────────
  // When the modal opens with a seedMessage, reset to a fresh session and
  // queue the seed. The second effect fires the send once messages is empty
  // and the chat is not busy.
  useEffect(() => {
    if (!visible) {
      pendingSeedRef.current = null;
      return;
    }
    if (seedMessage) {
      setMessages([]);
      setCurrentSessionId(null);
      setStreamingRemaining(null);
      setInput("");
      pendingSeedRef.current = seedMessage;
    }
  }, [visible, seedMessage]);

  useEffect(() => {
    if (pendingSeedRef.current && messages.length === 0 && !loading) {
      const seed = pendingSeedRef.current;
      pendingSeedRef.current = null;
      sendMessage(seed);
    }
  }, [messages.length, loading, sendMessage]);

  // ── Intro injection for general (no-seed) entry ────────────────────────
  // Only runs once per modal session, only when there's no seedMessage and
  // the user has never chatted before.
  useEffect(() => {
    if (!visible || seedMessage || !isSignedIn || introInjectedRef.current || !API_BASE_URL) return;
    introInjectedRef.current = true;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await expoFetch(`${API_BASE_URL}/api/ai/chats`, { headers });
        if (!res.ok) return;
        const data = await res.json() as { conversations: Conversation[] };
        const convs = data.conversations ?? [];
        setConversations(convs);
        if (convs.length === 0 && messages.length === 0) {
          setMessages([{
            id: "pm-intro",
            role: "assistant",
            content: "Hey. I'm PitMaster — your cook coach.\n\nTell me what you're throwing on today and I'll help you nail it.",
          }]);
        }
      } catch { }
    })();
  }, [visible, seedMessage, isSignedIn, authHeaders]);

  // ── Render helpers ─────────────────────────────────────────────────────
  const lastMsg = messages[messages.length - 1];
  const showSuggestionsForId =
    !loading && lastMsg?.role === "assistant" && !input.trim() ? lastMsg.id : null;
  const streamingId = loading ? streamingIdRef.current : null;

  const renderMsg = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const showChips =
      !isUser && item.id === showSuggestionsForId && !!item.suggestions && item.suggestions.length > 0;
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
                    { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
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

  const groups = groupConversations(conversations);

  const historyPanel = (
    <Modal
      visible={showHistory}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowHistory(false)}
    >
      <View style={[s.historyContainer, { backgroundColor: colors.background }]}>
        <View style={[s.historyHeader, { borderBottomColor: colors.border }]}>
          <Text style={[s.historyTitle, { color: colors.foreground }]}>Past Chats</Text>
          <Pressable onPress={() => setShowHistory(false)} hitSlop={8} style={s.headerBtn}>
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <Pressable
          onPress={startNewChat}
          style={[s.newChatBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={s.newChatBtnText}>New Chat</Text>
        </Pressable>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={historyLoading}
              onRefresh={fetchConversations}
              tintColor={colors.primary}
            />
          }
        >
          {historyLoading && conversations.length === 0 && (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          )}
          {!historyLoading && conversations.length === 0 && (
            <Text style={[s.emptyHistory, { color: colors.mutedForeground }]}>
              No past chats. Fire one up.
            </Text>
          )}
          {groups.map((group) => (
            <View key={group.label} style={s.historyGroup}>
              <Text style={[s.historyGroupLabel, { color: colors.mutedForeground }]}>
                {group.label}
              </Text>
              {group.items.map((conv) => (
                <Pressable
                  key={conv.id}
                  onPress={() => loadConversation(conv)}
                  onLongPress={() => openRename(conv)}
                  style={[
                    s.historyItem,
                    {
                      backgroundColor: currentSessionId === conv.id ? colors.primary + "18" : colors.card,
                      borderColor: currentSessionId === conv.id ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[s.historyItemTitle, { color: colors.foreground }]}
                      numberOfLines={2}
                    >
                      {conv.title}
                    </Text>
                  </View>
                  {loadingChatId === conv.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View style={s.historyItemActions}>
                      <Pressable onPress={() => openRename(conv)} hitSlop={8} style={s.deleteBtn}>
                        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                      </Pressable>
                      <Pressable onPress={() => deleteConversation(conv)} hitSlop={8} style={s.deleteBtn}>
                        <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  const renameModal = (
    <Modal
      visible={renameTarget !== null}
      animationType="fade"
      transparent
      onRequestClose={() => setRenameTarget(null)}
    >
      <Pressable style={s.renameOverlay} onPress={() => setRenameTarget(null)}>
        <Pressable
          style={[s.renameBox, { backgroundColor: colors.card, borderRadius: colors.radius + 4 }]}
          onPress={() => { }}
        >
          <Text style={[s.renameTitle, { color: colors.foreground }]}>Rename Chat</Text>
          <TextInput
            style={[
              s.renameInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
                borderRadius: colors.radius,
              },
            ]}
            value={renameText}
            onChangeText={setRenameText}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submitRename}
            maxLength={200}
            placeholderTextColor={colors.mutedForeground}
            placeholder="Chat name"
          />
          <View style={s.renameActions}>
            <Pressable
              onPress={() => setRenameTarget(null)}
              style={[s.renameCancelBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <Text style={[s.renameCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submitRename}
              disabled={renaming || !renameText.trim()}
              style={[
                s.renameSaveBtn,
                { backgroundColor: colors.primary, borderRadius: colors.radius },
                (renaming || !renameText.trim()) && { opacity: 0.5 },
              ]}
            >
              {renaming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.renameSaveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const headerRight = (
    <View style={s.headerActions}>
      {messages.length > 0 && !seedMessage && (
        <Pressable
          onPress={startNewChat}
          hitSlop={8}
          disabled={loading}
          accessibilityLabel="New chat"
          style={s.headerBtn}
        >
          <Feather name="plus-square" size={18} color={colors.foreground} />
        </Pressable>
      )}
      {!seedMessage && (
        <Pressable
          onPress={openHistory}
          hitSlop={8}
          accessibilityLabel="Chat history"
          style={s.headerBtn}
        >
          <Feather name="clock" size={18} color={colors.foreground} />
        </Pressable>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
        {historyPanel}
        {renameModal}

        {/* ── Header ── */}
        <View style={[s.chatHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <Pressable onPress={onClose} hitSlop={8} style={s.headerBtn}>
            <Feather name="chevron-down" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[s.chatHeaderTitle, { color: colors.foreground }]}>
              {contextLabel ?? "PitMaster"}
            </Text>
            {contextLabel && (
              <Text style={[s.chatHeaderSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                AI Cook Coach
              </Text>
            )}
          </View>
          {headerRight}
        </View>

        <AppKeyboardAvoidingView
          style={[{ flex: 1 }, isTablet && { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }]}
          keyboardVerticalOffset={0}
        >
          {messages.length === 0 && !loading && !seedMessage && (
            <View style={s.welcome}>
              <Text style={[s.welcomeTitle, { color: colors.foreground }]}>
                {cookSuggestions
                  ? `What do you want to know about your ${contextLabel ?? "cook"}?`
                  : "What are you throwing on?"}
              </Text>
              <View style={s.suggestions}>
                {(cookSuggestions ?? SUGGESTED).map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => sendMessage(q)}
                    style={[
                      s.suggestion,
                      { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                    ]}
                  >
                    <Text style={[s.suggestionText, { color: colors.foreground }]}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.length === 0 && loading && seedMessage && (
            <View style={s.seedingWait}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[s.seedingText, { color: colors.mutedForeground }]}>
                Loading your context…
              </Text>
            </View>
          )}

          <FlatList
            ref={listRef}
            data={messages}
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
            scrollEnabled={messages.length > 0}
            onContentSizeChange={() => {
              if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
            }}
          />

          {messages.length > HISTORY_LIMIT && (
            <View style={[s.contextNote, { backgroundColor: colors.background }]}>
              <Feather name="info" size={11} color={colors.mutedForeground} style={{ marginTop: 1 }} />
              <Text style={[s.contextNoteText, { color: colors.mutedForeground }]}>
                AI remembers the last {HISTORY_LIMIT} messages · earlier messages are no longer in context
              </Text>
            </View>
          )}

          <View
            style={[
              s.inputBar,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
                paddingBottom: botInset + 10,
              },
            ]}
          >
            {(() => {
              const limit = paywallUsage?.limits.aiChatPerDay ?? null;
              const remaining = streamingRemaining ?? paywallUsage?.remaining.aiMessagesToday ?? null;
              if (limit === null || remaining === null) return null;
              const threshold = limit > 10 ? 5 : 1;
              if (remaining > threshold) return null;
              const urgent = remaining <= 1;
              return (
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Inter_500Medium",
                    color: urgent ? colors.primary : colors.mutedForeground,
                    paddingHorizontal: 4,
                    paddingBottom: 6,
                  }}
                >
                  {remaining} of {limit} messages left today
                </Text>
              );
            })()}
            <View
              style={[
                s.inputWrap,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius + 8 },
              ]}
            >
              <TextInput
                style={[s.textInput, { color: colors.foreground }]}
                placeholder="What's going on at the pit?"
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
                  { backgroundColor: loading || !input.trim() ? colors.muted : colors.primary },
                ]}
                onPress={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Feather
                    name="send"
                    size={16}
                    color={loading || !input.trim() ? colors.mutedForeground : "#fff"}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </AppKeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  chatHeaderTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  chatHeaderSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  welcome: { paddingHorizontal: 20, paddingTop: 40, alignItems: "center" },
  welcomeTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 24, textAlign: "center", letterSpacing: -0.4 },
  suggestions: { width: "100%", gap: 12 },
  suggestion: { borderWidth: 1, padding: 18, borderRadius: 12 },
  suggestionText: { fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  seedingWait: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  seedingText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  msgRowUser: { flexDirection: "row-reverse" },
  msgColumn: { flex: 1, gap: 12 },
  avatar: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "82%", borderWidth: 1, padding: 16 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_500Medium", lineHeight: 22 },
  chips: { width: "100%", gap: 10 },
  chip: { borderWidth: 1, padding: 16, borderRadius: 12 },
  chipText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  contextNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  contextNoteText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 18 },
  inputBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  inputWrap: {
    flexDirection: "row", alignItems: "flex-end",
    borderWidth: 1, paddingLeft: 16, paddingRight: 8, paddingVertical: 8,
  },
  textInput: {
    flex: 1, fontSize: 16, fontFamily: "Inter_500Medium",
    maxHeight: 120, paddingTop: 6, paddingBottom: 6,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  headerBtn: { padding: 6 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },

  // History panel
  historyContainer: { flex: 1 },
  historyHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, borderBottomWidth: 1,
  },
  historyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  newChatBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginVertical: 16,
    paddingHorizontal: 16, paddingVertical: 16,
    borderRadius: 12,
  },
  newChatBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  historyGroup: { marginBottom: 24 },
  historyGroupLabel: {
    fontSize: 12, fontFamily: "Inter_700Bold",
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 10, paddingHorizontal: 4,
  },
  historyItem: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, padding: 16, marginBottom: 10,
    borderRadius: 12,
  },
  historyItemTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  historyItemActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  deleteBtn: { padding: 6, marginLeft: 6 },
  emptyHistory: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 40 },

  // Rename modal
  renameOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 24,
  },
  renameBox: { width: "100%", padding: 24, gap: 16, borderWidth: 1 },
  renameTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  renameInput: {
    borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontFamily: "Inter_500Medium",
  },
  renameActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  renameCancelBtn: { borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  renameCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  renameSaveBtn: { paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", minWidth: 80, borderRadius: 10 },
  renameSaveText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
