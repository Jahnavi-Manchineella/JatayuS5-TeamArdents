import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Citations, X-Category",
};

// === Stellar Horizon (public API, no key required) =================
const HORIZON_URL = "https://horizon.stellar.org";

async function horizonGet(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${HORIZON_URL}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error("Horizon error", path, res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("Horizon fetch failed", path, e);
    return null;
  }
}

/**
 * Detect Stellar references in the user query and pull live data from Horizon.
 * Triggers:
 *  - Stellar account ID (G + 55 base32 chars)
 *  - Transaction hash (64 hex chars)
 *  - Mentions of "stellar", "xlm", "lumens", "horizon"
 */
async function fetchStellarContext(query: string): Promise<string> {
  if (!query) return "";

  const accountMatch = query.match(/\bG[A-Z2-7]{55}\b/);
  const txMatch = query.match(/\b[a-fA-F0-9]{64}\b/);
  const mentionsStellar = /\b(stellar|xlm|lumen[s]?|horizon)\b/i.test(query);

  if (!accountMatch && !txMatch && !mentionsStellar) return "";

  const parts: string[] = [];

  if (accountMatch) {
    const acc = await horizonGet(`/accounts/${accountMatch[0]}`);
    if (acc) {
      const balances = (acc.balances || [])
        .map((b: any) =>
          `${b.balance} ${b.asset_type === "native" ? "XLM" : (b.asset_code || b.asset_type)}`
        )
        .join(", ");
      parts.push(
        `Account ${acc.account_id}\n` +
          `  Sequence: ${acc.sequence}\n` +
          `  Subentry count: ${acc.subentry_count}\n` +
          `  Balances: ${balances || "none"}`
      );
    } else {
      parts.push(`Account ${accountMatch[0]} was not found on the Stellar public network.`);
    }
  }

  if (txMatch) {
    const tx = await horizonGet(`/transactions/${txMatch[0]}`);
    if (tx) {
      parts.push(
        `Transaction ${tx.hash}\n` +
          `  Ledger: ${tx.ledger}\n` +
          `  Successful: ${tx.successful}\n` +
          `  Source account: ${tx.source_account}\n` +
          `  Fee charged: ${tx.fee_charged} stroops\n` +
          `  Operation count: ${tx.operation_count}\n` +
          `  Created at: ${tx.created_at}`
      );
    }
  }

  // Always include a small network snapshot when Stellar is in scope
  const ledgers = await horizonGet(`/ledgers?order=desc&limit=1`);
  const latest = ledgers?._embedded?.records?.[0];
  if (latest) {
    parts.push(
      `Latest ledger: #${latest.sequence} at ${latest.closed_at} ` +
        `(${latest.operation_count} ops, ${latest.successful_transaction_count} successful tx).`
    );
  }

  if (mentionsStellar && !accountMatch && !txMatch) {
    const fee = await horizonGet(`/fee_stats`);
    if (fee) {
      parts.push(
        `Network fee stats: last ledger base fee ${fee.last_ledger_base_fee} stroops, ` +
          `fee charged p50 ${fee.fee_charged?.p50}, p90 ${fee.fee_charged?.p90}.`
      );
    }
  }

  return parts.join("\n\n");
}

// Embed a single query via HuggingFace (sentence-transformers/all-MiniLM-L6-v2)
async function embedQuery(text: string): Promise<number[] | null> {
  const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!HF_KEY) return null;
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      }
    );
    if (!res.ok) {
      console.error("HF embed query error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    // Model returns either number[] (sentence embedding) or number[][] (token embeddings)
    if (Array.isArray(data) && typeof data[0] === "number") return data as number[];
    if (Array.isArray(data) && Array.isArray(data[0])) {
      // Mean-pool token embeddings
      const tokens = data as number[][];
      const dim = tokens[0].length;
      const pooled = new Array(dim).fill(0);
      for (const t of tokens) for (let i = 0; i < dim; i++) pooled[i] += t[i];
      for (let i = 0; i < dim; i++) pooled[i] /= tokens.length;
      return pooled;
    }
    return null;
  } catch (e) {
    console.error("HF embed query exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, category: userCategory } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Identify user from auth header
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // === Stellar Horizon API enrichment ===
    // If the user asks about Stellar / XLM, or includes a Stellar account (G...) or tx hash,
    // fetch live data from the public Horizon API and add it to the prompt context.
    let stellarContext = "";
    try {
      stellarContext = await fetchStellarContext(lastUserMessage);
    } catch (e) {
      console.error("Stellar enrichment error:", e);
    }

    let relevantChunks: any[] = [];
    const categoryFilter = userCategory && userCategory !== "All" ? userCategory : null;

    // 1. SEMANTIC SEARCH: embed the query and find similar chunks via cosine similarity
    const queryEmbedding = await embedQuery(lastUserMessage);
    if (queryEmbedding) {
      const { data: semChunks, error: semErr } = await supabase.rpc("match_chunks", {
        query_embedding: JSON.stringify(queryEmbedding),
        category_filter: categoryFilter,
        match_limit: 5,
        similarity_threshold: 0.3,
      });
      if (semErr) console.error("match_chunks error:", semErr);
      relevantChunks = semChunks || [];
      console.log(`Semantic search: ${relevantChunks.length} chunks`);
    }

    // 2. FTS FALLBACK: if no semantic results (e.g. embeddings missing), use full-text search
    if (relevantChunks.length === 0) {
      const { data: chunks, error: searchError } = await supabase.rpc("search_chunks", {
        query_text: lastUserMessage,
        category_filter: categoryFilter,
        match_limit: 5,
      });
      if (searchError) console.error("search_chunks error:", searchError);
      relevantChunks = chunks || [];
    }

    // If full-text search returns nothing, fall back to keyword ilike
    if (relevantChunks.length === 0) {
      const stopWords = new Set(["the", "is", "at", "which", "on", "a", "an", "and", "or", "but", "in", "to", "for", "of", "with", "what", "how", "does", "are", "can", "do", "this", "that", "from", "about"]);
      const keywords = lastUserMessage
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length > 2 && !stopWords.has(w))
        .slice(0, 6);

      if (keywords.length > 0) {
        const orFilter = keywords.map((k: string) => `content.ilike.%${k}%`).join(",");
        let query = supabase
          .from("document_chunks")
          .select("content, section_title, document_id, documents!inner(name, category)")
          .or(orFilter)
          .limit(5);
        if (categoryFilter) {
          // Restrict ilike fallback to the selected category as well
          query = query.eq("documents.category", categoryFilter);
        }

        const { data: fallbackChunks } = await query;
        relevantChunks = (fallbackChunks || []).map((c: any) => ({
          chunk_content: c.content,
          chunk_section_title: c.section_title,
          chunk_document_id: c.document_id,
          doc_name: c.documents?.name || "Unknown",
          doc_category: c.documents?.category || "General Operations",
        }));
      }
    }

    // Build context and citations
    let contextStr = "";
    const citations: any[] = [];
    if (relevantChunks.length > 0) {
      contextStr = "\n\nRelevant document excerpts:\n";
      relevantChunks.forEach((chunk: any, i: number) => {
        const docName = chunk.doc_name || "Unknown";
        const docCat = chunk.doc_category || "General Operations";
        const section = chunk.chunk_section_title || "General";
        const content = chunk.chunk_content || chunk.content || "";
        contextStr += `\n[Source ${i + 1}: ${docName}, Section: ${section}]\n${content}\n`;
        citations.push({
          source: docName,
          section,
          content: content.substring(0, 200),
          category: docCat,
        });
      });
    }

    // Categorize query
    let category = userCategory && userCategory !== "All" ? userCategory : "General Operations";
    if (category === "General Operations") {
      const lowerQuery = lastUserMessage.toLowerCase();
      if (/compliance|regulation|policy|aml|kyc|audit|gdpr/.test(lowerQuery)) category = "Compliance";
      else if (/procedure|process|step|sop|how to|workflow/.test(lowerQuery)) category = "SOP";
      else if (/product|account|loan|card|deposit|mortgage|savings/.test(lowerQuery)) category = "Products";
    }

    const filterScope = categoryFilter ? `the "${categoryFilter}" knowledge base` : "the knowledge base";
    const noDocsMessage = categoryFilter
      ? `No relevant documents were found in the "${categoryFilter}" knowledge base for this query. You MUST reply that no information is available in the "${categoryFilter}" knowledge base and suggest the user either change the filter to "All" or raise a ticket. Do NOT answer from general knowledge while a category filter is active.`
      : `No relevant documents found in the knowledge base. Clearly state that no internal documents were found matching the query, and only then provide a brief best-effort answer from general banking knowledge with a clear disclaimer.`;

    const systemPrompt = `You are a Banking AI Knowledge Assistant for internal banking operations teams. You answer strictly from ${filterScope}.

${contextStr ? `Use ONLY the following document excerpts to ground your answer. Do not introduce facts that are not supported by these excerpts. Always cite your sources using [Source N] notation when referencing information from the documents.${contextStr}` : noDocsMessage}
${stellarContext && !categoryFilter ? `\nLive Stellar network data (from Horizon public API):\n${stellarContext}\nWhen using this data, label it as "Stellar Horizon (live)" so the user knows it is live network data, not from internal documents.\n` : ""}
Guidelines:
- Be professional, accurate, and concise
- Always cite sources when available using [Source N] format
- If information is not in the provided documents, say so clearly
- ${categoryFilter ? `A category filter ("${categoryFilter}") is active. Never answer from outside that knowledge base, even if you know the answer.` : "If no filter is active, you may use general banking knowledge as a clearly labelled fallback."}
- Structure responses with clear headings and bullet points when appropriate
- Focus on actionable, practical answers for banking operations teams
- You are informational only - never suggest taking automated actions`;

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    // Log audit entry — always store, even for guest (user_id null) chats.
    try {
      const { error: auditErr } = await supabase.from("audit_logs").insert({
        user_id: userId,
        query: lastUserMessage,
        retrieved_chunks: citations,
        category,
      });
      if (auditErr) console.error("audit_logs insert error:", auditErr);
    } catch (e) {
      console.error("audit_logs insert exception:", e);
    }

    // Return stream with citation headers
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "text/event-stream");
    // Base64-encode to ensure ByteString-safe header values (citations may contain non-ASCII)
    const citationsB64 = btoa(unescape(encodeURIComponent(JSON.stringify(citations))));
    headers.set("X-Citations", citationsB64);
    headers.set("X-Category", encodeURIComponent(category));

    return new Response(aiResponse.body, { headers });
  } catch (e: any) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
