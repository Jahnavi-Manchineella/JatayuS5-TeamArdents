# SOPAssist AI – Python Backend Scripts

This folder contains the **Python data engineering and AI evaluation pipeline** for SOPAssist AI.

Our architecture is a **polyglot stack**: Python handles the data science and AI validation workloads, while Supabase Edge Functions (TypeScript/Deno) handle low-latency API streaming to the React frontend.

---

## Scripts

### `chunker.py` – Document Chunking & Ingestion Pipeline

Implements the text-splitting algorithm used to prepare banking SOP documents for the RAG knowledge base.

**What it does:**
- Splits documents into 384-token chunks with configurable overlap (mirrors the `all-MiniLM-L6-v2` embedding window)
- Detects section titles using the same heuristic as the production `Documents.tsx` upload handler
- Auto-classifies documents into knowledge base categories (Compliance, SOP, Products, General Operations) via keyword scoring
- Outputs a Supabase-compatible JSON payload matching the `documents` + `document_chunks` table schema

**Run it:**
```bash
# Auto-detect category
python chunker.py --file my_sop.txt --category Auto

# Force a category and save output
python chunker.py --file compliance_policy.txt --category Compliance --output chunks.json
```

**Dependencies:** Python 3.10+ standard library only (no pip install needed)

---

### `eval_metrics.py` – RAG Evaluation & Hallucination Detection

Benchmarks the chatbot's responses against four RAG quality metrics, inspired by the **Ragas** and **TruLens** evaluation frameworks.

**Metrics computed:**

| Metric | Description |
|---|---|
| **Groundedness** | Fraction of answer sentences traceable to retrieved chunks |
| **Context Relevance** | How well the retrieved chunks match the user's query |
| **Faithfulness** | Whether numeric claims in the answer appear in the source context |
| **Precision@K** | Fraction of retrieved chunks that are actually relevant |

**Hallucination risk** is classified as `low / medium / high` based on combined groundedness + faithfulness scores.

**Run it:**
```bash
# Local mode – uses 5 built-in banking domain test cases
python eval_metrics.py --mode local

# Live mode – pulls real queries from Supabase audit_logs
python eval_metrics.py --mode live --url https://YOUR_PROJECT.supabase.co --key YOUR_ANON_KEY

# Export results to CSV
python eval_metrics.py --mode local --output eval_results.csv
```

**Dependencies:**
- Local mode: Python 3.10+ standard library only
- Live mode: `pip install supabase`

---

## How this fits the architecture

```
Banking SOP Documents
        │
        ▼
  chunker.py  ◄── Python: text splitting, overlap calculation,
  (local dev)      category classification, chunk validation
        │
        ▼
  Supabase pgvector  ◄── Edge Function: embedding generation,
  (document_chunks)       vector insert, similarity search
        │
        ▼
  Gemini / Llama 3.3  ◄── LLM: grounded response generation
        │
        ▼
  eval_metrics.py  ◄── Python: Ragas-style scoring, hallucination
  (CI validation)       detection, precision metrics, CSV export
        │
        ▼
  React Frontend  ◄── TypeScript: streaming chat UI, citations panel
```

Python's rich data science ecosystem (`re`, `json`, `csv`, `uuid`) handles the mathematical logic for chunking overlap and evaluation scoring. The validated data models are then deployed through Supabase Edge Functions for ultra-low latency API streaming.
