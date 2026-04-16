import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Flame, Plus, Trash2, MessageSquare, ArrowLeft, MoreVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Conversation = { id: number; title: string; createdAt: string; updatedAt: string };
type ChatMessage = { id: number; conversationId: number; role: string; content: string; createdAt: string };

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function WelcomeScreen({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-6">
      <div className="bg-primary/20 p-4 rounded-2xl border border-primary/30">
        <Flame className="w-12 h-12 text-primary animate-pulse" />
      </div>
      <div>
        <h2 className="text-2xl font-bold font-serif uppercase tracking-tight mb-2">PitKing AI</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Your personal pit coach with access to all your cook logs. Ask anything about BBQ or your own cooks.
        </p>
      </div>
      <Button onClick={onNewChat} className="bg-primary hover:bg-primary/90 gap-2">
        <Plus className="w-4 h-4" /> Start a New Chat
      </Button>
    </div>
  );
}

function ChatView({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: remoteMessages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["messages", conversation.id],
    queryFn: () => apiFetch(`/api/ai/conversations/${conversation.id}/messages`),
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      apiFetch<{ reply: string; messageId: number }>(`/api/ai/conversations/${conversation.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversation.id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Optimistic user message shown while waiting
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || sendMutation.isPending) return;
    setInput("");
    setPendingMessage(msg);
    sendMutation.mutate(msg, {
      onSettled: () => setPendingMessage(null),
    });
  };

  const displayMessages = remoteMessages;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [remoteMessages, pendingMessage, sendMutation.isPending]);

  const suggestions = [
    "How long did my last brisket take?",
    "What's my highest-rated cook?",
    "What should I try cooking next?",
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Chat header */}
      <div className="h-12 flex items-center gap-3 px-4 border-b border-border bg-card/60 shrink-0">
        <button
          onClick={onBack}
          className="lg:hidden p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
          <Flame className="w-4 h-4 text-primary" />
        </div>
        <span className="font-medium text-sm truncate flex-1">{conversation.title}</span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-5 max-w-3xl mx-auto">
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}

          {!isLoading && displayMessages.length === 0 && !pendingMessage && (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm mb-4">
                I have access to your cook logs. Ask me anything!
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center flex-wrap">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); }}
                    className="text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayMessages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 mt-0.5">
                  <Flame className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`px-4 py-3 rounded-xl max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border rounded-tl-sm shadow-sm"
              }`}>
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Optimistic user message */}
          {pendingMessage && (
            <div className="flex gap-3 justify-end">
              <div className="px-4 py-3 rounded-xl max-w-[85%] text-sm leading-relaxed bg-primary text-primary-foreground rounded-tr-sm opacity-80">
                {pendingMessage}
              </div>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-secondary-foreground" />
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {sendMutation.isPending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                <Flame className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="px-4 py-3 rounded-xl bg-card border border-border rounded-tl-sm flex items-center gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}

          {sendMutation.isError && (
            <p className="text-xs text-destructive text-center">
              Failed to send. Please try again.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about BBQ or your cooks…"
            className="flex-1 bg-background"
            disabled={sendMutation.isPending}
            data-testid="input-ai-chat"
          />
          <Button
            type="submit"
            disabled={!input.trim() || sendMutation.isPending}
            data-testid="btn-ai-send"
          >
            <Send className="w-4 h-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isCreating,
}: {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (c: Conversation) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  isCreating: boolean;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border shrink-0">
        <Button
          onClick={onNew}
          disabled={isCreating}
          className="w-full bg-primary hover:bg-primary/90 gap-2 h-9 text-sm"
          data-testid="btn-new-chat"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
            No chats yet
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {conversations.map(c => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  activeId === c.id
                    ? "bg-primary/15 border border-primary/30"
                    : "hover:bg-sidebar-accent"
                }`}
                onClick={() => onSelect(c)}
                data-testid={`conversation-${c.id}`}
              >
                <MessageSquare className={`w-4 h-4 shrink-0 ${activeId === c.id ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${activeId === c.id ? "text-primary" : "text-foreground"}`}>
                    {c.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(c.updatedAt)}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}
                      data-testid={`menu-conversation-${c.id}`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive gap-2"
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default function AiAssistant() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const qc = useQueryClient();

  const { data: convos = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch("/api/ai/conversations"),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch<Conversation>("/api/ai/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New Chat" }) }),
    onSuccess: (convo) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setActiveConversation(convo);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/ai/conversations/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (activeConversation?.id === id) setActiveConversation(null);
    },
  });

  // Mobile: show list or chat
  const showMobileChat = activeConversation !== null;

  return (
    <AppLayout>
      <div className="h-[calc(100dvh-8rem)] md:h-[calc(100dvh-6rem)] flex flex-col">
        {/* Page title — desktop only */}
        <div className="hidden lg:flex items-center gap-2 mb-4 shrink-0">
          <Bot className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
          <span className="text-muted-foreground text-sm ml-1">· knows your cook logs</span>
        </div>

        <div className="flex-1 flex overflow-hidden rounded-xl border border-border bg-background min-h-0">
          {/* Conversations sidebar — hidden on mobile when chat is open */}
          <div className={`${showMobileChat ? "hidden" : "flex"} lg:flex w-full lg:w-64 xl:w-72 border-r border-border flex-col shrink-0 bg-sidebar/30`}>
            <div className="p-3 border-b border-border shrink-0 lg:hidden">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" /> AI Assistant
              </h2>
            </div>
            <ConversationList
              conversations={convos}
              activeId={activeConversation?.id ?? null}
              onSelect={setActiveConversation}
              onNew={() => createMutation.mutate()}
              onDelete={(id) => deleteMutation.mutate(id)}
              isCreating={createMutation.isPending}
            />
          </div>

          {/* Chat area */}
          <div className={`${showMobileChat ? "flex" : "hidden"} lg:flex flex-1 flex-col min-w-0 min-h-0`}>
            {activeConversation ? (
              <ChatView
                key={activeConversation.id}
                conversation={activeConversation}
                onBack={() => setActiveConversation(null)}
              />
            ) : (
              <WelcomeScreen onNewChat={() => createMutation.mutate()} />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
