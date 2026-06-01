"""
SOPAssist AI – Document Chunking & Ingestion Pipeline
======================================================
This script replicates the core text-splitting logic used by the
SOPAssist AI knowledge base before documents are synced to Supabase.

It mirrors the chunking strategy used in the production pipeline:
  - 384-dimensional embedding target (all-MiniLM-L6-v2 compatible)
  - Paragraph-level splitting with configurable overlap
  - Section-title detection for metadata enrichment
  - Category auto-classification via keyword heuristics
  - Output schema matches the `document_chunks` table in Supabase

Usage:
    python chunker.py --file path/to/sop.txt --category Compliance
    python chunker.py --file path/to/policy.txt --category Auto
"""

import argparse
import json
import re
import uuid
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration – mirrors production Supabase document_chunks schema
# ---------------------------------------------------------------------------

CHUNK_SIZE = 400          # target tokens per chunk (≈ 384-dim embedding window)
CHUNK_OVERLAP = 80        # overlap tokens between consecutive chunks
MIN_CHUNK_LENGTH = 30     # discard chunks shorter than this (noise filter)

# Keyword-based category classifier (mirrors classify-document edge function)
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Compliance": [
        "kyc", "aml", "ctr", "bsa", "ofac", "fatf", "regulatory",
        "compliance", "anti-money laundering", "suspicious activity",
        "sar", "due diligence", "cdd", "edd",
    ],
    "SOP": [
        "procedure", "step", "process", "workflow", "checklist",
        "standard operating", "sop", "guideline", "instruction",
        "how to", "protocol",
    ],
    "Products": [
        "loan", "mortgage", "credit card", "savings account",
        "current account", "fixed deposit", "insurance", "product",
        "interest rate", "fee", "charge", "premium",
    ],
    "General Operations": [],   # fallback
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def classify_category(text: str) -> str:
    """
    Keyword-based category classifier.
    Scores each category by keyword hit count and returns the winner.
    Falls back to 'General Operations' when no keywords match.
    """
    lower = text.lower()
    scores: dict[str, int] = {cat: 0 for cat in CATEGORY_KEYWORDS}

    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            scores[category] += lower.count(kw)

    # Remove fallback from competition unless it wins outright
    best = max(
        (cat for cat in scores if cat != "General Operations"),
        key=lambda c: scores[c],
        default="General Operations",
    )
    return best if scores[best] > 0 else "General Operations"


def is_section_title(line: str) -> bool:
    """
    Heuristic: a line is a section title if it is short, does not end
    with a period, and is not purely numeric.
    Mirrors the frontend Documents.tsx title-detection logic.
    """
    stripped = line.strip()
    return (
        len(stripped) > 0
        and len(stripped) < 100
        and not stripped.endswith(".")
        and not stripped.replace(" ", "").isdigit()
    )


def split_into_paragraphs(text: str) -> list[str]:
    """Split raw text on blank lines, filtering out very short fragments."""
    paragraphs = re.split(r"\n{2,}", text)
    return [p.strip() for p in paragraphs if len(p.strip()) >= MIN_CHUNK_LENGTH]


def sliding_window_chunks(
    paragraphs: list[str],
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[dict]:
    """
    Merge paragraphs into fixed-size token windows with overlap.
    Each chunk carries:
      - chunk_index  : sequential position in the document
      - content      : the text payload
      - section_title: first line of the chunk if it looks like a heading
      - token_count  : approximate word-token count
    """
    chunks: list[dict] = []
    buffer: list[str] = []
    buffer_tokens = 0
    chunk_index = 0

    for para in paragraphs:
        para_tokens = len(para.split())

        # If a single paragraph exceeds chunk_size, hard-split it
        if para_tokens > chunk_size:
            words = para.split()
            for start in range(0, len(words), chunk_size - overlap):
                slice_words = words[start : start + chunk_size]
                slice_text = " ".join(slice_words)
                first_line = slice_text.split("\n")[0]
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "content": slice_text,
                        "section_title": first_line if is_section_title(first_line) else None,
                        "token_count": len(slice_words),
                    }
                )
                chunk_index += 1
            continue

        # Flush buffer when it would exceed chunk_size
        if buffer_tokens + para_tokens > chunk_size and buffer:
            combined = "\n\n".join(buffer)
            first_line = combined.split("\n")[0]
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "content": combined,
                    "section_title": first_line if is_section_title(first_line) else None,
                    "token_count": buffer_tokens,
                }
            )
            chunk_index += 1

            # Retain overlap: keep last N tokens worth of paragraphs
            overlap_buffer: list[str] = []
            overlap_tokens = 0
            for prev_para in reversed(buffer):
                t = len(prev_para.split())
                if overlap_tokens + t <= overlap:
                    overlap_buffer.insert(0, prev_para)
                    overlap_tokens += t
                else:
                    break
            buffer = overlap_buffer
            buffer_tokens = overlap_tokens

        buffer.append(para)
        buffer_tokens += para_tokens

    # Flush remaining content
    if buffer:
        combined = "\n\n".join(buffer)
        first_line = combined.split("\n")[0]
        chunks.append(
            {
                "chunk_index": chunk_index,
                "content": combined,
                "section_title": first_line if is_section_title(first_line) else None,
                "token_count": buffer_tokens,
            }
        )

    return chunks


# ---------------------------------------------------------------------------
# Main ingestion pipeline
# ---------------------------------------------------------------------------

def ingest_document(
    file_path: str,
    category: str = "Auto",
    document_id: Optional[str] = None,
) -> dict:
    """
    Full ingestion pipeline for a plain-text SOP / policy document.

    Returns a dict that mirrors the Supabase insert payload for:
      - documents table row
      - document_chunks table rows (list)

    In production this payload is sent to the Supabase Edge Function
    `parse-document` which handles embedding generation via pgvector.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    raw_text = path.read_text(encoding="utf-8")
    doc_id = document_id or str(uuid.uuid4())

    # Auto-classify if requested
    final_category = classify_category(raw_text) if category == "Auto" else category

    # Split into paragraphs then apply sliding-window chunking
    paragraphs = split_into_paragraphs(raw_text)
    chunks = sliding_window_chunks(paragraphs)

    # Build Supabase-compatible chunk rows
    chunk_rows = [
        {
            "id": str(uuid.uuid4()),
            "document_id": doc_id,
            "chunk_index": c["chunk_index"],
            "content": c["content"],
            "section_title": c["section_title"],
            # embedding: None here – generated by Supabase Edge Function
            # using text-embedding-3-small (384 dims) in production
            "embedding": None,
        }
        for c in chunks
    ]

    document_row = {
        "id": doc_id,
        "name": path.name,
        "file_type": path.suffix.lstrip(".") or "txt",
        "category": final_category,
        "content": raw_text[:2000] + ("…" if len(raw_text) > 2000 else ""),
        "version": 1,
        "is_latest": True,
        "parent_document_id": None,
    }

    return {
        "document": document_row,
        "chunks": chunk_rows,
        "stats": {
            "total_characters": len(raw_text),
            "total_paragraphs": len(paragraphs),
            "total_chunks": len(chunks),
            "avg_tokens_per_chunk": (
                sum(c["token_count"] for c in chunks) / len(chunks) if chunks else 0
            ),
            "category_detected": final_category,
        },
    }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="SOPAssist AI – Local document chunking & ingestion script"
    )
    parser.add_argument("--file", required=True, help="Path to the .txt document")
    parser.add_argument(
        "--category",
        default="Auto",
        choices=["Auto", "Compliance", "SOP", "Products", "General Operations"],
        help="Knowledge base category (default: Auto-detect)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to write JSON output (default: print to stdout)",
    )
    args = parser.parse_args()

    result = ingest_document(args.file, args.category)

    print("\n=== SOPAssist AI – Chunking Pipeline ===")
    print(f"  Document   : {result['document']['name']}")
    print(f"  Category   : {result['stats']['category_detected']}")
    print(f"  Characters : {result['stats']['total_characters']:,}")
    print(f"  Paragraphs : {result['stats']['total_paragraphs']}")
    print(f"  Chunks     : {result['stats']['total_chunks']}")
    print(f"  Avg tokens : {result['stats']['avg_tokens_per_chunk']:.1f}")
    print(f"\nFirst 3 chunks preview:")
    for chunk in result["chunks"][:3]:
        title = chunk["section_title"] or "(no title)"
        preview = chunk["content"][:120].replace("\n", " ")
        print(f"  [{chunk['chunk_index']}] {title!r} → {preview!r}…")

    if args.output:
        out_path = Path(args.output)
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
        print(f"\nFull output written to: {out_path}")
    else:
        print("\nFull JSON payload (document + chunks):")
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
# chunker.py — Document ingestion pipeline that:

# Splits text into 384-token chunks with configurable overlap (matching the all-MiniLM-L6-v2 embedding window your pgvector setup uses)
# Detects section titles using the same heuristic as your Documents.tsx upload handler
# Auto-classifies into your exact four categories (Compliance, SOP, Products, General Operations) via keyword scoring — mirrors the classify-document edge function
# Outputs a JSON payload that matches your documents + document_chunks Supabase table schema exactly
