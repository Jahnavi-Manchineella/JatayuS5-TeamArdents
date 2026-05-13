export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Citation {
  source: string;
  section: string;
  content: string;
  category: string;
}

export interface ChunkDetail {
  source: string;
  section: string;
  category: string;
  score: number | null;
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export async function streamChat({
  messages,
  conversationId,
  accessToken,
  category,
  onDelta,
  onCitations,
  onChunks,
  onAuditId,
  onDone,
  onError,
}: {
  messages: ChatMessage[];
  conversationId?: string;
  accessToken: string;
  category?: string;
  onDelta: (text: string) => void;
  onCitations: (citations: Citation[], category: string) => void;
  onChunks?: (chunks: ChunkDetail[]) => void;
  onAuditId?: (id: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages, conversationId, category }),
    });

    if (resp.status === 429) {
      onError("Rate limit exceeded. Please wait a moment and try again.");
      return;
    }
    if (resp.status === 402) {
      onError("AI credits exhausted. Please add funds to continue.");
      return;
    }
    if (!resp.ok || !resp.body) {
      const text = await resp.text();
      onError(text || "Failed to connect to AI service.");
      return;
    }

    // Parse citations from headers
    const citationsHeader = resp.headers.get("X-Citations");
    const categoryHeader = resp.headers.get("X-Category");
    const chunksHeader = resp.headers.get("X-Chunks");
    const auditIdHeader = resp.headers.get("X-Audit-Id");
    if (citationsHeader) {
      try {
        const decoded = decodeURIComponent(escape(atob(citationsHeader)));
        const citations = JSON.parse(decoded);
        const cat = categoryHeader ? decodeURIComponent(categoryHeader) : "General Operations";
        onCitations(citations, cat);
      } catch {}
    }
    if (chunksHeader && onChunks) {
      try {
        const decoded = decodeURIComponent(escape(atob(chunksHeader)));
        onChunks(JSON.parse(decoded));
      } catch {}
    }
    if (auditIdHeader && onAuditId) onAuditId(auditIdHeader);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Flush remaining
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {}
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}
