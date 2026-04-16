import { AppLayout } from "@/components/layout/app-layout";
import { useAiChat } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Flame } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "I'm PitKing — your personal pit coach. I have access to all of your cook logs, so ask me anything: \"How long did my last brisket take?\", \"What's my highest-rated cook?\", or general BBQ technique questions." }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const chatMutation = useAiChat();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    chatMutation.mutate({
      data: { message: userMessage }
    }, {
      onSuccess: (res) => {
        setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
      },
      onError: () => {
        setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I lost connection to the pit. Try asking again." }]);
      }
    });
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-10rem)] max-w-4xl mx-auto flex flex-col space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-8 h-8 text-primary" /> AI Assistant
          </h1>
          <p className="text-muted-foreground">Expert guidance, predictions, and troubleshooting.</p>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden border-sidebar-border bg-sidebar/30">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-6 max-w-3xl mx-auto pb-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                      <Flame className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`p-4 rounded-xl max-w-[85%] ${
                    m.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-card border rounded-tl-sm shadow-sm'
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                      {m.content}
                    </div>
                  </div>
                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Flame className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <div className="p-4 rounded-xl bg-card border rounded-tl-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-card">
            <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
              <Input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="How long does a 12lb brisket take at 250°F?"
                className="flex-1 bg-background"
                disabled={chatMutation.isPending}
                data-testid="input-ai-chat"
              />
              <Button type="submit" disabled={!input.trim() || chatMutation.isPending} data-testid="btn-ai-send">
                <Send className="w-4 h-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
