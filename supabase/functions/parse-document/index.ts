import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Page-batched PDF extraction config
const PDF_PAGES_PER_BATCH = 15;
const PDF_BATCH_CONCURRENCY = 4;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function extractPdfBatch(
  apiKey: string,
  base64: string,
  batchLabel: string,
): Promise<string> {
  const systemPrompt =
    "You are a document text extraction tool. Extract ALL text content from the provided PDF pages exactly as it appears. Preserve paragraph structure using double newlines between paragraphs. Preserve section headings. Do NOT summarize, interpret, or add commentary. Output ONLY the extracted text.";
  const userPrompt = `Extract all text from these PDF pages (${batchLabel}). Preserve structure with section headings and paragraphs.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
            { type: "text", text: userPrompt },
          ],
        },
      ],
      max_tokens: 16000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PDF batch ${batchLabel} extraction failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function extractLargePdf(
  apiKey: string,
  arrayBuffer: ArrayBuffer,
): Promise<string> {
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  console.log(`PDF has ${totalPages} pages, splitting into batches of ${PDF_PAGES_PER_BATCH}`);

  // Build batch page-index ranges
  const batches: { start: number; end: number }[] = [];
  for (let i = 0; i < totalPages; i += PDF_PAGES_PER_BATCH) {
    batches.push({ start: i, end: Math.min(i + PDF_PAGES_PER_BATCH, totalPages) });
  }

  // Pre-build sub-PDFs as base64 (sequential — cheap, avoids memory spikes)
  const subPdfs: { label: string; base64: string }[] = [];
  for (const b of batches) {
    const sub = await PDFDocument.create();
    const indices = Array.from({ length: b.end - b.start }, (_, k) => b.start + k);
    const copied = await sub.copyPages(srcDoc, indices);
    for (const p of copied) sub.addPage(p);
    const bytes = await sub.save();
    subPdfs.push({
      label: `pages ${b.start + 1}-${b.end} of ${totalPages}`,
      base64: bytesToBase64(bytes),
    });
  }

  // Extract batches with bounded concurrency
  const results: string[] = new Array(subPdfs.length).fill("");
  let cursor = 0;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= subPdfs.length) return;
      const { label, base64 } = subPdfs[idx];
      console.log(`Extracting batch ${idx + 1}/${subPdfs.length} (${label})`);
      try {
        results[idx] = await extractPdfBatch(apiKey, base64, label);
      } catch (e) {
        console.error(`Batch ${label} failed:`, e);
        results[idx] = `\n[Extraction failed for ${label}]\n`;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PDF_BATCH_CONCURRENCY, subPdfs.length) }, () => worker()),
  );

  return results.join("\n\n");
}

// Generate embeddings via HuggingFace Inference API (sentence-transformers/all-MiniLM-L6-v2, 384-dim)
async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!HF_KEY) {
    console.warn("HUGGINGFACE_API_KEY not set, skipping embeddings");
    return texts.map(() => null);
  }
  const results: (number[] | null)[] = [];
  // HF feature-extraction supports batching; chunk to avoid huge payloads
  const BATCH = 32;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    try {
      const res = await fetch(
        "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: batch, options: { wait_for_model: true } }),
        }
      );
      if (!res.ok) {
        console.error("HF embed error:", res.status, await res.text());
        for (const _ of batch) results.push(null);
        continue;
      }
      const data = await res.json();
      // data is number[][] (one vector per input)
      for (const v of data) results.push(Array.isArray(v) ? v : null);
    } catch (e) {
      console.error("HF embed exception:", e);
      for (const _ of batch) results.push(null);
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Invalid token");

    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) throw new Error("Admin access required");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    let category = (formData.get("category") as string) || "Auto";
    const parentDocId = formData.get("parent_document_id") as string | null;
    const version = parseInt((formData.get("version") as string) || "1", 10);

    if (!file) throw new Error("No file provided");

    const fileName = file.name;
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "";

    const supportedExts = ["pdf", "docx", "txt", "jpg", "jpeg", "png", "webp", "eml", "msg", "csv", "xlsx", "xls"];
    if (!supportedExts.includes(fileExt)) {
      throw new Error(`Unsupported file type "${fileExt}". Supported: PDF, DOCX, TXT, JPG, PNG, WEBP, EML, MSG, CSV, XLSX, XLS`);
    }

    let extractedText = "";

    if (fileExt === "txt") {
      extractedText = await file.text();
    } else if (fileExt === "csv") {
      // CSV: read as text and format for chunking
      const csvText = await file.text();
      extractedText = `CSV Data: ${fileName}\n\n${csvText}`;
    } else if (fileExt === "eml") {
      // EML: parse email text format
      const emlText = await file.text();
      extractedText = parseEml(emlText);
    } else if (fileExt === "pdf") {
      // PDF: page-batched extraction so we can handle 250-300 page docs
      const arrayBuffer = await file.arrayBuffer();
      extractedText = await extractLargePdf(LOVABLE_API_KEY, arrayBuffer);
      if (!extractedText.trim()) {
        throw new Error("No content could be extracted from the PDF");
      }
    } else {
      // For DOCX, images, MSG, XLSX/XLS — single-shot AI multimodal extraction
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const mimeMap: Record<string, string> = {
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        msg: "application/vnd.ms-outlook",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
      };
      const mimeType = mimeMap[fileExt] || "application/octet-stream";

      // Customize prompt based on file type
      let systemPrompt = "You are a document text extraction tool. Extract ALL text content from the provided document exactly as it appears. Preserve paragraph structure using double newlines between paragraphs. Preserve section headings. Do NOT summarize, interpret, or add commentary. Output ONLY the extracted text.";
      let userPrompt = "Extract all text content from this document. Preserve the structure with section headings and paragraphs.";

      if (["jpg", "jpeg", "png", "webp"].includes(fileExt)) {
        systemPrompt = "You are an image content extraction tool. Extract ALL visible text from this image. If the image contains diagrams, charts, or visual information, describe them in detail. Preserve the structure of the content. Output ONLY the extracted information.";
        userPrompt = "Extract all text and describe any visual content (charts, diagrams, tables) from this image in detail.";
      } else if (fileExt === "msg") {
        systemPrompt = "You are an email extraction tool. Extract the email content including: From, To, CC, Subject, Date, and the full email body. Preserve the structure. If there are attachments listed, note their names. Output ONLY the extracted content.";
        userPrompt = "Extract all email content from this file: headers (From, To, CC, Subject, Date) and the full body text.";
      } else if (["xlsx", "xls"].includes(fileExt)) {
        systemPrompt = "You are a spreadsheet extraction tool. Extract ALL data from this spreadsheet. Format it as structured text with clear headers and rows. Preserve sheet names if visible. Use table format where possible. Output ONLY the extracted data.";
        userPrompt = "Extract all data from this spreadsheet. Preserve column headers and row data in a readable structured format.";
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
                { type: "text", text: userPrompt },
              ],
            },
          ],
          max_tokens: 16000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI extraction error:", aiResponse.status, errText);
        throw new Error(`Failed to extract content from ${fileExt.toUpperCase()} file. AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      extractedText = aiData.choices?.[0]?.message?.content || "";

      if (!extractedText.trim()) {
        throw new Error("No content could be extracted from the document");
      }
    }

    // Auto-classify with LLM if requested (or always when category missing)
    if (category === "Auto" || !category) {
      try {
        category = await classifyCategory(LOVABLE_API_KEY, fileName, extractedText);
      } catch (e) {
        console.error("Auto classify failed:", e);
        category = "General Operations";
      }
    }

    // Upload original file to storage
    const storagePath = `${user.id}/${Date.now()}_${fileName}`;
    await supabase.storage.from("documents").upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

    // Determine file_type label
    const fileTypeLabel = ["jpg", "jpeg", "png", "webp"].includes(fileExt) ? "image" :
      ["eml", "msg"].includes(fileExt) ? "email" :
      ["csv", "xlsx", "xls"].includes(fileExt) ? "spreadsheet" : fileExt;

    // Insert document record
    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        name: fileName,
        file_type: fileTypeLabel,
        category,
        content: extractedText,
        uploaded_by: user.id,
        version,
        is_latest: true,
        parent_document_id: parentDocId,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Chunk the document by paragraphs
    const paragraphs = extractedText.split(/\n\n+/).filter((p: string) => p.trim().length > 30);
    const chunks = paragraphs.map((p: string, i: number) => {
      const firstLine = p.split("\n")[0];
      const isTitle = firstLine.length < 100 && !firstLine.endsWith(".");
      return {
        document_id: doc.id,
        chunk_index: i,
        content: p.trim(),
        section_title: isTitle ? firstLine.trim() : null,
      };
    });

    if (chunks.length > 0) {
      // Generate embeddings for each chunk via HuggingFace
      const embeddings = await embedTexts(chunks.map((c) => c.content));
      const chunksWithEmb = chunks.map((c, i) => ({
        ...c,
        embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : null,
      }));
      const { error: chunkErr } = await supabase.from("document_chunks").insert(chunksWithEmb);
      if (chunkErr) console.error("Chunk insert error:", chunkErr);
    }

    return new Response(
      JSON.stringify({
        id: doc.id,
        name: fileName,
        chunks: chunks.length,
        textLength: extractedText.length,
        category,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    console.error("parse-document error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Classify a document into one of the four banking knowledge-base domains using Lovable AI.
async function classifyCategory(apiKey: string, fileName: string, text: string): Promise<string> {
  const ALLOWED = ["Compliance", "SOP", "Products", "General Operations"];
  const sample = text.slice(0, 6000);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "You classify internal banking documents into exactly one knowledge-base domain. " +
            "Domains:\n" +
            "- Compliance: regulations, AML/KYC, audit, GDPR, risk, sanctions, policies enforcing rules.\n" +
            "- SOP: step-by-step procedures, workflows, how-to guides, operational instructions.\n" +
            "- Products: account types, loans, cards, deposits, mortgages, savings, product specs.\n" +
            "- General Operations: anything else operational that doesn't fit the other three.",
        },
        {
          role: "user",
          content: `Filename: ${fileName}\n\nDocument excerpt:\n${sample}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "set_category",
            description: "Pick the best-fit domain for this document.",
            parameters: {
              type: "object",
              properties: {
                category: { type: "string", enum: ALLOWED },
              },
              required: ["category"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "set_category" } },
    }),
  });
  if (!res.ok) throw new Error(`classify status ${res.status}`);
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return "General Operations";
  const parsed = JSON.parse(args);
  return ALLOWED.includes(parsed.category) ? parsed.category : "General Operations";
}

// Simple EML parser for text-based email files
function parseEml(emlText: string): string {
  const lines = emlText.split(/\r?\n/);
  let headers: string[] = [];
  let bodyStart = false;
  let body: string[] = [];

  for (const line of lines) {
    if (!bodyStart) {
      if (line.trim() === "") {
        bodyStart = true;
        continue;
      }
      const headerMatch = line.match(/^(From|To|Cc|Subject|Date):\s*(.+)/i);
      if (headerMatch) {
        headers.push(`${headerMatch[1]}: ${headerMatch[2]}`);
      }
    } else {
      body.push(line);
    }
  }

  // Strip HTML tags from body if present
  let bodyText = body.join("\n");
  if (bodyText.includes("<html") || bodyText.includes("<HTML")) {
    bodyText = bodyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return `Email Headers:\n${headers.join("\n")}\n\nEmail Body:\n${bodyText}`;
}
