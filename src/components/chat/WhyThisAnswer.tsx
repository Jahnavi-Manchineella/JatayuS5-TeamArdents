import { useMemo, useState } from "react";
import { ChevronDown, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import type { ChunkDetail } from "@/lib/chat-stream";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STOP = new Set([
  "the","is","at","which","on","a","an","and","or","but","in","to","for","of",
  "with","what","how","does","are","can","do","this","that","from","about","as",
  "by","be","it","its","we","you","i","not","no","yes","if","then","than","so",
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9*\-])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function WhyThisAnswer({
  answer,
  chunks,
  auditId,
}: {
  answer: string;
  chunks: ChunkDetail[];
  auditId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const mappings = useMemo(() => {
    if (!chunks?.length) return [];
    const chunkTokens = chunks.map((c) => tokens(`${c.section} ${c.content}`));
    return splitSentences(answer).map((sentence) => {
      const sTok = tokens(sentence);
      let best = -1;
      let bestScore = 0;
      chunkTokens.forEach((ct, i) => {
        const s = jaccard(sTok, ct);
        if (s > bestScore) {
          bestScore = s;
          best = i;
        }
      });
      return { sentence, sourceIdx: bestScore > 0.05 ? best : -1, score: bestScore };
    });
  }, [answer, chunks]);

  const sendFeedback = async (val: "up" | "down") => {
    setFeedback(val);
    if (!auditId) return;
    const { error } = await supabase
      .from("audit_logs")
      .update({ feedback: val })
      .eq("id", auditId);
    if (error) toast.error("Could not save feedback");
    else toast.success(val === "up" ? "Thanks for the feedback!" : "Logged — we'll improve");
  };

  if (!chunks?.length) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="text-xs flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
        >
          <Sparkles className="w-3 h-3" /> Why this answer?
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {auditId && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => sendFeedback("up")}
              className={`p-1 rounded-md border transition-colors ${
                feedback === "up"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "border-border text-muted-foreground hover:text-emerald-400"
              }`}
              aria-label="Helpful"
            >
              <ThumbsUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => sendFeedback("down")}
              className={`p-1 rounded-md border transition-colors ${
                feedback === "down"
                  ? "bg-red-500/20 border-red-500/40 text-red-400"
                  : "border-border text-muted-foreground hover:text-red-400"
              }`}
              aria-label="Not helpful"
            >
              <ThumbsDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Retrieved chunks
            </p>
            <div className="space-y-2">
              {chunks.map((c, i) => (
                <div key={i} className="rounded-md border border-border/60 bg-secondary/30 p-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      Source {i + 1}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">{c.source}</span>
                  </div>
                  {c.score != null && (
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1 rounded bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${Math.min(100, Math.max(2, c.score * 100))}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                        {(c.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground/90 leading-relaxed line-clamp-3">
                    {c.section ? <span className="text-foreground/80">{c.section}: </span> : null}
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Sentence → source mapping
            </p>
            <div className="space-y-1">
              {mappings.map((m, i) => (
                <div key={i} className="text-xs leading-relaxed">
                  <span className="text-foreground/90">{m.sentence}</span>{" "}
                  {m.sourceIdx >= 0 ? (
                    <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent ml-1">
                      [Source {m.sourceIdx + 1}] · {(m.score * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground ml-1">
                      [unmapped]
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}