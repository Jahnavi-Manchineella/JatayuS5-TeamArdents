import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat, ChatMessage, Citation, ChunkDetail } from "@/lib/chat-stream";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { RaiseTicketDialog } from "@/components/chat/RaiseTicketDialog";
import { Bot, Plus, MessageSquare, FileText, X, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DOMAIN_CATEGORIES = ["All", "Compliance", "SOP", "Products", "General Operations"];

interface ConversationMeta {
  id: string;
  title: string;
  created_at: string;
}

interface UIMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  category?: string;
  chunks?: ChunkDetail[];
  auditId?: string;
}

export default function Chat() {
  const { user, session } = useAuth();
  const isAuthenticated = !!user && !!session;
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [showCitations, setShowCitations] = useState(false);
  const [showSidebar, setShowSidebar] = useState(isAuthenticated);
  const [selectedDomain, setSelectedDomain] = useState("All");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketContext, setTicketContext] = useState<{ query: string; response: string; category: string } | null>(null);

  // Load conversations (only for authenticated users)
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      setConversations(data || []);
    };
    load();
  }, [user]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setCitations([]);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("role, content, citations, category")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(
          data.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            citations: m.citations as unknown as Citation[] | undefined,
            category: m.category || undefined,
          }))
        );
      }
    };
    load();
  }, [activeConversationId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const createConversation = async (title: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title })
      .select("id, title, created_at")
      .single();
    if (error || !data) return null;
    setConversations((prev) => [data, ...prev]);
    return data.id;
  };

  const saveMessage = async (conversationId: string, msg: UIMessage) => {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
      citations: msg.citations as any,
      category: msg.category,
    });
  };

  const handleSend = useCallback(
    async (input: string) => {
      if (isStreaming) return;

      // For authenticated users, persist conversations
      let convId = activeConversationId;
      if (isAuthenticated && !convId) {
        const title = input.slice(0, 50) + (input.length > 50 ? "..." : "");
        convId = await createConversation(title);
        if (!convId) {
          toast.error("Failed to create conversation");
          return;
        }
        setActiveConversationId(convId);
      }

      const userMsg: UIMessage = { role: "user", content: input };
      setMessages((prev) => [...prev, userMsg]);
      if (isAuthenticated && convId) {
        await saveMessage(convId, userMsg);
      }

      setIsStreaming(true);
      let assistantContent = "";
      let msgCitations: Citation[] = [];
      let msgCategory = "General Operations";
      let msgChunks: ChunkDetail[] = [];
      let msgAuditId: string | undefined;

      const chatHistory: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: input },
      ];

      // Use session token if available, otherwise use anon key
      const accessToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await streamChat({
        messages: chatHistory,
        conversationId: convId || undefined,
        accessToken,
        category: selectedDomain,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantContent } : m
              );
            }
            return [...prev, { role: "assistant", content: assistantContent }];
          });
        },
        onCitations: (cits, category) => {
          msgCitations = cits;
          msgCategory = category;
          setCitations(cits);
          if (cits.length > 0) setShowCitations(true);
        },
        onChunks: (chunks) => {
          msgChunks = chunks;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, chunks } : m,
              );
            }
            return prev;
          });
        },
        onAuditId: (id) => {
          msgAuditId = id;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, auditId: id } : m,
              );
            }
            return prev;
          });
        },
        onDone: async () => {
          setIsStreaming(false);
          // Persist the final response onto the audit log row so the Audit Explorer can show it.
          if (msgAuditId && assistantContent) {
            supabase
              .from("audit_logs")
              .update({ response: assistantContent })
              .eq("id", msgAuditId)
              .then(() => {});
          }
          if (isAuthenticated && assistantContent && convId) {
            await saveMessage(convId, {
              role: "assistant",
              content: assistantContent,
              citations: msgCitations,
              category: msgCategory,
            });
            // suppress unused-warning for chunks/auditId vars we keep client-side only
            void msgChunks;
            void msgAuditId;
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", convId!);
          }
        },
        onError: (err) => {
          setIsStreaming(false);
          toast.error(err);
        },
      });
    },
    [user, session, activeConversationId, messages, isStreaming, selectedDomain, isAuthenticated]
  );

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setCitations([]);
    setShowCitations(false);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Conversations sidebar - only for authenticated users */}
      {isAuthenticated && showSidebar && (
        <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-card/40">
          <div className="p-3 border-b border-border">
            <Button
              onClick={startNewChat}
              variant="outline"
              className="w-full justify-start gap-2 text-sm border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="w-4 h-4" /> New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                  conv.id === activeConversationId
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <MessageSquare className="w-3 h-3 inline mr-2" />
                {conv.title}
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No conversations yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border gap-3">
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}

            {/* Domain selector */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="text-xs bg-secondary/60 border border-border/50 rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {DOMAIN_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {citations.length > 0 && (
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
            >
              <FileText className="w-3 h-3" />
              {citations.length} source{citations.length > 1 ? "s" : ""}
              <ChevronRight className={`w-3 h-3 transition-transform ${showCitations ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 glow-primary">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Banking AI Assistant</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask me about banking procedures, compliance policies, customer onboarding, or any operational topic.
                {selectedDomain !== "All" && (
                  <span className="block mt-1 text-accent">
                    Filtering: <strong>{selectedDomain}</strong>
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2 mt-6 max-w-lg justify-center">
                {[
                  "What are the KYC requirements for new accounts?",
                  "Explain the AML policy",
                  "What is the CTR reporting threshold?",
                  "Digital onboarding requirements",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-xs px-3 py-2 rounded-lg glass-panel text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            (() => {
              const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
              const streaming = isStreaming && isLastAssistant;
              const hasNoCitations = msg.role === "assistant" && (!msg.citations || msg.citations.length === 0);
              const isFallback = hasNoCitations && !streaming;
              // Show "Raise Ticket" on every assistant reply (guests get prompted to sign in on click)
              const showRaise = msg.role === "assistant" && !streaming;
              const prevUserMsg = i > 0 ? messages[i - 1] : null;
              return (
                <ChatBubble
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={streaming}
                  showRaiseTicket={showRaise}
                  isFallback={isFallback}
                  chunks={msg.chunks}
                  auditId={msg.auditId}
                  onRaiseTicket={() => {
                    setTicketContext({
                      query: prevUserMsg?.content || "",
                      response: msg.content,
                      category: msg.category || selectedDomain !== "All" ? selectedDomain : "General Operations",
                    });
                    setTicketOpen(true);
                  }}
                />
              );
            })()
          ))}
        </div>

        <div className="p-4 pt-2">
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>
      </div>

      {/* Citations panel */}
      {showCitations && citations.length > 0 && (
        <div className="w-72 flex-shrink-0 border-l border-border bg-card/40 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" /> Sources
            </h3>
            <button onClick={() => setShowCitations(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {citations.map((cit, i) => (
              <div key={i} className="glass-panel rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    Source {i + 1}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                    {cit.category}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{cit.source}</p>
                <p className="text-xs text-muted-foreground">{cit.section}</p>
                <p className="text-xs text-muted-foreground/80 leading-relaxed mt-1">
                  {cit.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ticketContext && (
        <RaiseTicketDialog
          open={ticketOpen}
          onOpenChange={setTicketOpen}
          query={ticketContext.query}
          category={ticketContext.category}
          assistantResponse={ticketContext.response}
          conversationId={activeConversationId}
        />
      )}
    </div>
  );
}
