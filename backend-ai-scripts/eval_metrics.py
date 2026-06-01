"""
SOPAssist AI – RAG Evaluation & Hallucination Detection Pipeline
================================================================
This script benchmarks the SOPAssist AI chatbot against a curated
set of banking domain test cases to measure:

  1. Groundedness      – Is the answer supported by the retrieved chunks?
  2. Context Relevance – Did the retriever surface the right documents?
  3. Answer Faithfulness – Does the answer contradict the source material?
  4. Precision@K       – How many of the top-K chunks were actually relevant?

These metrics mirror the Ragas / TruLens evaluation framework used to
validate Llama 3.3 and Gemini outputs before production deployment.

The script connects to the Supabase `audit_logs` table to pull real
query/response/chunk triplets and scores them automatically.

Usage:
    # Run against local test cases (no Supabase connection needed)
    python eval_metrics.py --mode local

    # Run against live audit_logs from Supabase
    python eval_metrics.py --mode live --url YOUR_SUPABASE_URL --key YOUR_ANON_KEY

    # Export results to CSV
    python eval_metrics.py --mode local --output results.csv
"""

import argparse
import csv
import json
import math
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from typing import Optional


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class RAGSample:
    """A single query/answer/context triplet for evaluation."""
    query: str
    answer: str
    retrieved_chunks: list[str]
    expected_keywords: list[str] = field(default_factory=list)
    category: str = "General Operations"
    audit_id: Optional[str] = None


@dataclass
class EvalResult:
    """Evaluation scores for one RAGSample."""
    audit_id: Optional[str]
    query: str
    category: str
    groundedness: float        # 0.0 – 1.0
    context_relevance: float   # 0.0 – 1.0
    faithfulness: float        # 0.0 – 1.0
    precision_at_k: float      # 0.0 – 1.0
    hallucination_risk: str    # "low" | "medium" | "high"
    notes: str = ""


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------

def _token_overlap(text_a: str, text_b: str) -> float:
    """
    Jaccard similarity on word tokens (case-insensitive).
    Used as a lightweight proxy for semantic similarity without
    requiring an embedding model at evaluation time.
    """
    tokens_a = set(re.findall(r"\b\w+\b", text_a.lower()))
    tokens_b = set(re.findall(r"\b\w+\b", text_b.lower()))
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


def score_groundedness(answer: str, chunks: list[str]) -> float:
    """
    Groundedness: fraction of answer sentences that can be traced back
    to at least one retrieved chunk (token-overlap threshold ≥ 0.15).

    A fully grounded answer scores 1.0; a hallucinated answer scores 0.0.
    """
    sentences = [s.strip() for s in re.split(r"[.!?]", answer) if len(s.strip()) > 10]
    if not sentences:
        return 0.0

    grounded_count = 0
    for sentence in sentences:
        best_overlap = max(
            (_token_overlap(sentence, chunk) for chunk in chunks),
            default=0.0,
        )
        if best_overlap >= 0.15:
            grounded_count += 1

    return grounded_count / len(sentences)


def score_context_relevance(query: str, chunks: list[str]) -> float:
    """
    Context Relevance: average token-overlap between the query and each
    retrieved chunk. Measures whether the retriever surfaced on-topic
    documents for the user's question.
    """
    if not chunks:
        return 0.0
    overlaps = [_token_overlap(query, chunk) for chunk in chunks]
    return sum(overlaps) / len(overlaps)


def score_faithfulness(answer: str, chunks: list[str]) -> float:
    """
    Faithfulness: checks that the answer does not introduce numeric
    claims (dates, amounts, percentages, thresholds) that are absent
    from the retrieved context.

    Returns 1.0 if all numeric claims in the answer appear in the
    chunks, 0.0 if none do, and a fractional score otherwise.
    """
    # Extract numeric tokens from the answer
    answer_numbers = set(re.findall(r"\b\d[\d,\.%$]*\b", answer))
    if not answer_numbers:
        return 1.0   # No numeric claims → no hallucination risk from numbers

    combined_context = " ".join(chunks)
    context_numbers = set(re.findall(r"\b\d[\d,\.%$]*\b", combined_context))

    supported = answer_numbers & context_numbers
    return len(supported) / len(answer_numbers)


def score_precision_at_k(
    query: str,
    chunks: list[str],
    relevance_threshold: float = 0.10,
) -> float:
    """
    Precision@K: fraction of retrieved chunks that are relevant to the
    query (token-overlap ≥ relevance_threshold).
    """
    if not chunks:
        return 0.0
    relevant = sum(
        1 for chunk in chunks if _token_overlap(query, chunk) >= relevance_threshold
    )
    return relevant / len(chunks)


def classify_hallucination_risk(
    groundedness: float,
    faithfulness: float,
) -> str:
    """
    Combine groundedness and faithfulness into a human-readable risk label.
    Thresholds are calibrated for banking compliance use cases where
    accuracy is critical.
    """
    combined = (groundedness + faithfulness) / 2
    if combined >= 0.70:
        return "low"
    elif combined >= 0.40:
        return "medium"
    else:
        return "high"


# ---------------------------------------------------------------------------
# Evaluation runner
# ---------------------------------------------------------------------------

def evaluate_sample(sample: RAGSample) -> EvalResult:
    """Run all four metrics on a single RAGSample and return an EvalResult."""
    g = score_groundedness(sample.answer, sample.retrieved_chunks)
    cr = score_context_relevance(sample.query, sample.retrieved_chunks)
    f = score_faithfulness(sample.answer, sample.retrieved_chunks)
    pk = score_precision_at_k(sample.query, sample.retrieved_chunks)
    risk = classify_hallucination_risk(g, f)

    notes_parts = []
    if g < 0.5:
        notes_parts.append("Low groundedness – answer may contain unsupported claims")
    if cr < 0.1:
        notes_parts.append("Low context relevance – retriever may have missed key docs")
    if f < 0.5:
        notes_parts.append("Low faithfulness – numeric claims not found in context")

    return EvalResult(
        audit_id=sample.audit_id,
        query=sample.query,
        category=sample.category,
        groundedness=round(g, 4),
        context_relevance=round(cr, 4),
        faithfulness=round(f, 4),
        precision_at_k=round(pk, 4),
        hallucination_risk=risk,
        notes="; ".join(notes_parts) if notes_parts else "All metrics within acceptable range",
    )


def evaluate_batch(samples: list[RAGSample]) -> list[EvalResult]:
    return [evaluate_sample(s) for s in samples]


def aggregate_metrics(results: list[EvalResult]) -> dict:
    """Compute mean scores and risk distribution across all results."""
    if not results:
        return {}

    n = len(results)
    risk_counts = {"low": 0, "medium": 0, "high": 0}
    for r in results:
        risk_counts[r.hallucination_risk] += 1

    return {
        "total_samples": n,
        "mean_groundedness": round(sum(r.groundedness for r in results) / n, 4),
        "mean_context_relevance": round(sum(r.context_relevance for r in results) / n, 4),
        "mean_faithfulness": round(sum(r.faithfulness for r in results) / n, 4),
        "mean_precision_at_k": round(sum(r.precision_at_k for r in results) / n, 4),
        "hallucination_risk_distribution": {
            k: f"{v} ({v/n*100:.1f}%)" for k, v in risk_counts.items()
        },
    }


# ---------------------------------------------------------------------------
# Built-in test cases (banking domain – mirrors SOPAssist AI categories)
# ---------------------------------------------------------------------------

LOCAL_TEST_CASES: list[RAGSample] = [
    RAGSample(
        query="What are the KYC requirements for opening a new account?",
        answer=(
            "To open a new account, customers must provide a valid government-issued "
            "photo ID, proof of address dated within 90 days, and a completed CDD form. "
            "Enhanced due diligence (EDD) is required for high-risk customers."
        ),
        retrieved_chunks=[
            "KYC Policy Section 3.1: All new account applicants must submit a valid "
            "government-issued photo ID and proof of address dated within 90 days.",
            "Customer Due Diligence (CDD) forms must be completed for every new customer. "
            "High-risk customers require Enhanced Due Diligence (EDD) procedures.",
            "AML Compliance Manual: Suspicious activity must be reported via SAR within "
            "30 days of detection.",
        ],
        expected_keywords=["kyc", "cdd", "edd", "photo id", "proof of address"],
        category="Compliance",
    ),
    RAGSample(
        query="What is the CTR reporting threshold?",
        answer=(
            "Currency Transaction Reports (CTRs) must be filed for cash transactions "
            "exceeding $10,000 in a single business day. Multiple transactions by the "
            "same customer that aggregate to over $10,000 must also be reported."
        ),
        retrieved_chunks=[
            "BSA Compliance: CTRs are required for cash transactions exceeding $10,000 "
            "per business day, including aggregated transactions from the same customer.",
            "Anti-Money Laundering Policy: Structuring transactions to avoid the $10,000 "
            "reporting threshold is a federal offense under 31 U.S.C. § 5324.",
        ],
        expected_keywords=["ctr", "$10,000", "cash", "reporting"],
        category="Compliance",
    ),
    RAGSample(
        query="What are the steps for customer onboarding?",
        answer=(
            "Customer onboarding involves: 1) Collect identity documents, 2) Verify KYC "
            "information, 3) Complete risk assessment, 4) Create customer profile in the "
            "core banking system, 5) Issue welcome kit and account details."
        ),
        retrieved_chunks=[
            "Onboarding SOP v2.3: Step 1 – Collect government ID and address proof. "
            "Step 2 – Verify documents against KYC checklist. Step 3 – Conduct risk "
            "assessment and assign customer risk rating.",
            "Core Banking System Guide: New customer profiles must be created within "
            "24 hours of document verification. Account details are issued via secure email.",
        ],
        expected_keywords=["onboarding", "kyc", "risk assessment", "profile"],
        category="SOP",
    ),
    RAGSample(
        query="What is the interest rate on fixed deposits?",
        answer=(
            "Fixed deposit interest rates vary by tenure. The current rate for a "
            "12-month FD is 6.5% per annum. Senior citizens receive an additional "
            "0.5% premium. Rates are subject to change without prior notice."
        ),
        retrieved_chunks=[
            "Products Brochure Q2: Fixed Deposit rates – 6 months: 5.75% p.a., "
            "12 months: 6.5% p.a., 24 months: 6.75% p.a. Senior citizen premium: +0.5%.",
            "Terms and Conditions: Interest rates on fixed deposits are subject to "
            "revision at the bank's discretion.",
        ],
        expected_keywords=["fixed deposit", "6.5%", "interest rate", "senior citizen"],
        category="Products",
    ),
    RAGSample(
        query="How should a suspicious transaction be escalated?",
        answer=(
            "Suspicious transactions must be escalated to the Compliance Officer within "
            "24 hours. A Suspicious Activity Report (SAR) must be filed with FinCEN "
            "within 30 days. Staff must not tip off the customer about the investigation."
        ),
        retrieved_chunks=[
            "AML Escalation Procedure: Any transaction flagged as suspicious must be "
            "reported to the Compliance Officer within 24 hours of detection.",
            "SAR Filing Guidelines: SARs must be submitted to FinCEN within 30 calendar "
            "days. Tipping off the subject of an SAR is prohibited under 31 U.S.C. § 5318.",
        ],
        expected_keywords=["sar", "compliance officer", "24 hours", "fincen", "tipping off"],
        category="Compliance",
    ),
]


# ---------------------------------------------------------------------------
# Live mode: pull from Supabase audit_logs
# ---------------------------------------------------------------------------

def load_live_samples(supabase_url: str, anon_key: str, limit: int = 50) -> list[RAGSample]:
    """
    Fetch recent audit_log rows from Supabase and convert them to RAGSamples.
    Requires: pip install supabase
    """
    try:
        from supabase import create_client  # type: ignore
    except ImportError:
        print("ERROR: supabase-py not installed. Run: pip install supabase")
        sys.exit(1)

    client = create_client(supabase_url, anon_key)
    response = (
        client.table("audit_logs")
        .select("id, query, response, retrieved_chunks, category")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    samples: list[RAGSample] = []
    for row in response.data or []:
        query = row.get("query", "")
        answer = row.get("response") or ""
        raw_chunks = row.get("retrieved_chunks") or []

        # retrieved_chunks is stored as JSON array of {source, content, ...} objects
        if isinstance(raw_chunks, list):
            chunk_texts = [
                c.get("content", "") if isinstance(c, dict) else str(c)
                for c in raw_chunks
            ]
        else:
            chunk_texts = []

        if not query or not answer:
            continue

        samples.append(
            RAGSample(
                query=query,
                answer=answer,
                retrieved_chunks=chunk_texts,
                category=row.get("category") or "General Operations",
                audit_id=row.get("id"),
            )
        )

    return samples


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def print_results_table(results: list[EvalResult], aggregates: dict) -> None:
    """Pretty-print evaluation results to stdout."""
    header = f"{'Query':<45} {'Cat':<18} {'Grnd':>6} {'CtxR':>6} {'Faith':>6} {'P@K':>6} {'Risk':<8}"
    print("\n" + "=" * 100)
    print("SOPAssist AI – RAG Evaluation Report")
    print("=" * 100)
    print(header)
    print("-" * 100)

    for r in results:
        q = (r.query[:42] + "…") if len(r.query) > 45 else r.query
        cat = (r.category[:15] + "…") if len(r.category) > 18 else r.category
        risk_icon = {"low": "✅", "medium": "⚠️ ", "high": "🚨"}.get(r.hallucination_risk, "")
        print(
            f"{q:<45} {cat:<18} {r.groundedness:>6.3f} {r.context_relevance:>6.3f} "
            f"{r.faithfulness:>6.3f} {r.precision_at_k:>6.3f} {risk_icon}{r.hallucination_risk:<6}"
        )

    print("-" * 100)
    print("\n📊 Aggregate Metrics:")
    for key, val in aggregates.items():
        if key == "hallucination_risk_distribution":
            print(f"  Hallucination Risk Distribution:")
            for risk, count in val.items():
                print(f"    {risk:<8}: {count}")
        else:
            label = key.replace("_", " ").title()
            print(f"  {label:<30}: {val}")
    print()


def export_csv(results: list[EvalResult], path: str) -> None:
    """Write evaluation results to a CSV file."""
    if not results:
        return
    fieldnames = list(asdict(results[0]).keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            writer.writerow(asdict(r))
    print(f"Results exported to: {path}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="SOPAssist AI – RAG evaluation & hallucination detection pipeline"
    )
    parser.add_argument(
        "--mode",
        choices=["local", "live"],
        default="local",
        help="'local' uses built-in banking test cases; 'live' pulls from Supabase audit_logs",
    )
    parser.add_argument("--url", default=None, help="Supabase project URL (live mode only)")
    parser.add_argument("--key", default=None, help="Supabase anon key (live mode only)")
    parser.add_argument("--limit", type=int, default=50, help="Max rows to fetch in live mode")
    parser.add_argument("--output", default=None, help="Optional CSV output path")
    args = parser.parse_args()

    if args.mode == "live":
        url = args.url or os.environ.get("SUPABASE_URL")
        key = args.key or os.environ.get("SUPABASE_ANON_KEY")
        if not url or not key:
            print("ERROR: --url and --key are required for live mode.")
            print("       Alternatively set SUPABASE_URL and SUPABASE_ANON_KEY env vars.")
            sys.exit(1)
        print(f"Fetching up to {args.limit} audit log entries from Supabase…")
        samples = load_live_samples(url, key, args.limit)
        if not samples:
            print("No evaluable samples found in audit_logs (need query + response + chunks).")
            sys.exit(0)
        print(f"Loaded {len(samples)} samples from live audit logs.\n")
    else:
        samples = LOCAL_TEST_CASES
        print(f"Running evaluation on {len(samples)} built-in banking test cases.\n")

    results = evaluate_batch(samples)
    aggregates = aggregate_metrics(results)
    print_results_table(results, aggregates)

    if args.output:
        export_csv(results, args.output)


if __name__ == "__main__":
    main()

# Ragas-style evaluation pipeline that:

# Scores Groundedness, Context Relevance, Faithfulness, and Precision@K on any query/answer/chunk triplet
# Classifies hallucination risk as low / medium / high
# Ships with 5 built-in banking domain test cases (KYC, CTR, onboarding, FD rates, SAR escalation)
# Has a --mode live flag that connects to your real Supabase audit_logs table to evaluate actual production queries