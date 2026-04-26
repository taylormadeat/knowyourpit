import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Modal,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { fetch as expoFetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { usePaywall } from "@/contexts/PaywallContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";
import { useSubscription } from "@/contexts/SubscriptionContext";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

// ─── Types ─────────────────────────────────────────────────────────────────

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

// ─── Constants ─────────────────────────────────────────────────────────────

const HISTORY_LIMIT = 20;

const SUGGESTED = [
  "Best wood for brisket?",
  "How long per lb for pork butt?",
  "Stall explained",
  "Bark tips",
];

const INPUT_BAR_GAP_ABOVE_TABS = 10;

// ─── Date grouping ─────────────────────────────────────────────────────────

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

// ─── Main screen ───────────────────────────────────────────────────────────

export default function AIScreen() {
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken, isSignedIn } = useAuth();
  const listRef = useRef<FlatList>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);

  // History panel state
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<number | null>(null);

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renaming, setRenaming] = useState(false);

  const streamingIdRef = useRef<string | null>(null);

  // ─── Auth header helper ─────────────────────────────────────────────────
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, [getToken]);

  // ─── Fetch conversation list ────────────────────────────────────────────
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
    } catch {
      // silently ignore — history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  }, [isSignedIn, authHeaders]);

  // ─── Load a past conversation ───────────────────────────────────────────
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

  // ─── Delete a conversation ──────────────────────────────────────────────
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

  // ─── Rename a conversation ──────────────────────────────────────────────
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

  // ─── Start a fresh chat ─────────────────────────────────────────────────
  const startNewChat = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
  }, []);

  // ─── Open history panel ─────────────────────────────────────────────────
  const openHistory = useCallback(() => {
    fetchConversations();
    setShowHistory(true);
  }, [fetchConversations]);

  const { showPaywall } = usePaywall();
  const { data: paywallUsage, refetch: refetchPaywall } = usePaywallUsage();
  const { isPro } = useSubscription();

  // ─── Send message ───────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    // Pre-emptive cap check — saves a server round-trip when the user is
    // already out of free chats and avoids painting a "thinking…" bubble that
    // immediately gets replaced by the paywall.
    if (
      paywallUsage &&
      !paywallUsage.unlimited &&
      paywallUsage.remaining.aiMessagesToday <= 0
    ) {
      showPaywall({ trigger: "ai_message_limit_reached" });
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

      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      // expoFetch is not routed through customFetch (the orval-generated
      // client), so we have to attach the Pro-bypass header manually here.
      // Without this, Pro users would still hit the 5/day chat cap.
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
          // Free-tier daily AI chat cap — surface the paywall instead of an
          // ambiguous error in the chat thread.
          let payload: any = null;
          try { payload = await res.json(); } catch { /* ignore */ }
          showPaywall({
            trigger: "ai_message_limit_reached",
            subtitle: payload?.message ?? null,
          });
          // Remove the optimistic empty assistant bubble + the user bubble we
          // just added so the input feels untouched after the modal opens.
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantId));
          setInput(msg);
          setLoading(false);
          streamingIdRef.current = null;
          return;
        }
        if (res.status === 429) throw new Error("Too many questions in a row. Please wait a moment.");
        throw new Error(`Request failed (${res.status})`);
      }

      if (!res.body) throw new Error("Streaming not supported on this device.");

      const reader = res.body.getReader();
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
          // Add new session to top of history list if not already there
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

      if (streamError) {
        finalizeWithError(streamError);
      } else if (!sawAnyDelta) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Sorry, I couldn't get a response." } : m
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
      // Refresh remaining-chats counter after every send (success or failure)
      // so the badge updates without waiting for staleness.
      refetchPaywall();
    }
  };

  // ─── Render helpers ─────────────────────────────────────────────────────
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

  // ─── History panel ──────────────────────────────────────────────────────
  const groups = groupConversations(conversations);

  const historyPanel = (
    <Modal
      visible={showHistory}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowHistory(false)}
    >
      <View style={[s.historyContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[s.historyHeader, { borderBottomColor: colors.border }]}>
          <Text style={[s.historyTitle, { color: colors.foreground }]}>Past Chats</Text>
          <Pressable onPress={() => setShowHistory(false)} hitSlop={8} style={s.headerBtn}>
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {/* New Chat button */}
        <Pressable
          onPress={startNewChat}
          style={[s.newChatBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={s.newChatBtnText}>New Chat</Text>
        </Pressable>

        {/* List */}
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
              No past chats yet. Start a conversation!
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
                      <Pressable
                        onPress={() => openRename(conv)}
                        hitSlop={8}
                        style={s.deleteBtn}
                      >
                        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                      </Pressable>
                      <Pressable
                        onPress={() => deleteConversation(conv)}
                        hitSlop={8}
                        style={s.deleteBtn}
                      >
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

  // ─── Rename modal ───────────────────────────────────────────────────────
  const renameModal = (
    <Modal
      visible={renameTarget !== null}
      animationType="fade"
      transparent
      onRequestClose={() => setRenameTarget(null)}
    >
      <Pressable
        style={s.renameOverlay}
        onPress={() => setRenameTarget(null)}
      >
        <Pressable
          style={[s.renameBox, { backgroundColor: colors.card, borderRadius: colors.radius + 4 }]}
          onPress={() => {}}
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

  // ─── Header actions ─────────────────────────────────────────────────────
  const headerRight = (
    <View style={s.headerActions}>
      {messages.length > 0 && (
        <Pressable
          onPress={startNewChat}
          hitSlop={8}
          disabled={loading}
          accessibilityLabel="New chat"
          style={s.headerBtn}
        >
          <Feather name="plus-square" size={18} color="#F3EDE1" />
        </Pressable>
      )}
      <Pressable
        onPress={openHistory}
        hitSlop={8}
        accessibilityLabel="Chat history"
        style={s.headerBtn}
      >
        <Feather name="clock" size={18} color="#F3EDE1" />
      </Pressable>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="PitMaster" dark right={headerRight} />

      {historyPanel}
      {renameModal}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 && !loading && (
          <View style={s.welcome}>
            <Text style={[s.welcomeTitle, { color: colors.foreground }]}>Ask me anything BBQ</Text>
            <View style={s.suggestions}>
              {SUGGESTED.map((q) => (
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
              paddingBottom: tabBarHeight + INPUT_BAR_GAP_ABOVE_TABS,
            },
          ]}
        >
          {/* Free-tier remaining-chats counter. Hidden for Pro / when paywall is disabled. */}
          {paywallUsage && !paywallUsage.unlimited && (
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_500Medium",
                color:
                  paywallUsage.remaining.aiMessagesToday <= 1
                    ? colors.primary
                    : colors.mutedForeground,
                paddingHorizontal: 4,
                paddingBottom: 6,
              }}
            >
              {paywallUsage.remaining.aiMessagesToday} of {paywallUsage.limits.aiChatPerDay} free
              chats left today
            </Text>
          )}
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
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "78%", borderWidth: 1, padding: 12 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  chips: { width: "100%", gap: 10 },
  chip: { borderWidth: 1, padding: 14 },
  chipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  contextNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 5,
    paddingHorizontal: 16, paddingVertical: 5,
  },
  contextNoteText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
  inputBar: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  inputWrap: {
    flexDirection: "row", alignItems: "flex-end",
    borderWidth: 1, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  textInput: {
    flex: 1, fontSize: 15, fontFamily: "Inter_400Regular",
    maxHeight: 100, paddingTop: 4, paddingBottom: 4,
  },
  sendBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  headerBtn: { padding: 6 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },

  // History panel
  historyContainer: { flex: 1 },
  historyHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  historyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  newChatBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginVertical: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  newChatBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  historyGroup: { marginBottom: 20 },
  historyGroupLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 8, paddingHorizontal: 4,
  },
  historyItem: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, padding: 14, marginBottom: 8,
  },
  historyItemTitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  historyItemActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  deleteBtn: { padding: 4, marginLeft: 4 },
  emptyHistory: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 40 },

  // Rename modal
  renameOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 24,
  },
  renameBox: { width: "100%", padding: 20, gap: 16 },
  renameTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  renameInput: {
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, fontFamily: "Inter_400Regular",
  },
  renameActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  renameCancelBtn: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  renameCancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  renameSaveBtn: { paddingHorizontal: 20, paddingVertical: 10, alignItems: "center", minWidth: 70 },
  renameSaveText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
