import ReactMarkdown from "react-markdown";
import { Bot, User, LifeBuoy } from "lucide-react";
import { WhyThisAnswer } from "@/components/chat/WhyThisAnswer";
import type { ChunkDetail } from "@/lib/chat-stream";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  showRaiseTicket?: boolean;
  onRaiseTicket?: () => void;
  isFallback?: boolean;
  chunks?: ChunkDetail[];
  auditId?: string;
}

export function ChatBubble({ role, content, isStreaming, showRaiseTicket, onRaiseTicket, isFallback, chunks, auditId }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 animate-slide-in ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-3 ${
          isUser
            ? "bg-primary/15 border border-primary/20"
            : "glass-panel"
        }`}
      >
        <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded [&_code]:text-primary [&_pre]:bg-secondary [&_pre]:p-3 [&_pre]:rounded-lg">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse-glow ml-1" />
        )}
        {!isUser && !isStreaming && chunks && chunks.length > 0 && (
          <WhyThisAnswer answer={content} chunks={chunks} auditId={auditId} />
        )}
        {showRaiseTicket && !isStreaming && (
          <div className={`mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2 ${isFallback ? "" : ""}`}>
            <span className="text-xs text-muted-foreground">
              {isFallback ? "Need a human to look at this?" : "Not what you needed?"}
            </span>
            <button
              onClick={onRaiseTicket}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30 transition-colors"
            >
              <LifeBuoy className="w-3 h-3" />
              Raise Ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
