## Scope

Four enhancements across QA access control, ROI analytics, answer explainability, and audit/standardization.

---

### 1. Restrict ticket QA approval to admin + SME only

**Goal:** Only `admin` and `sme` roles can perform admin QA reviews on resolved tickets. `process_manager`, `process_analyst`, `senior_manager` lose this power.

**Changes:**
- Migration: update `ticket_qa` INSERT policy `Admin posts QA review` → allow when `has_role(uid,'admin') OR has_role(uid,'sme')` (currently admin-only).
- `TicketQAPanel.tsx`: gate the admin review form on `isAdmin || isSme` (not just `isAdmin`). Other staff roles see the QA records read-only.
- Requester rating flow unchanged.

---

### 2. ROI dashboard — deflection % and time saved per user

**Goal:** New section on `/analytics` showing per-user metrics:
- **Deflection %** = `(audit_log queries that did NOT result in a ticket) / total queries`
- **Time saved** = `(deflected queries × 8 min)` — assumed avg manual SOP lookup time, configurable constant.
- Aggregate totals + per-user table (top 20).

**Changes:**
- Add a `ROIPanel` section in `Analytics.tsx`. Pull `audit_logs` (already loaded) + `tickets` (count by `audit_log_id`/`user_id`). Compute client-side from existing data — no schema change.
- Cards: Total Deflected, Deflection Rate, Hours Saved, Est. Cost Saved (× $35/hr).
- Table: user_email, queries, tickets raised, deflection %, hours saved.

---

### 3. "Why this answer?" explainability panel

**Goal:** In chat, every assistant message gets an expandable panel showing each retrieved chunk with its similarity score, plus which sentences in the answer map to which source.

**Changes:**
- `chat` edge function: include similarity scores in the existing `X-Citations` header payload (already returns chunks; extend to include `similarity` and `section_title`). Also stream a new `X-Chunks` header with the full retrieved chunk text + score for the explainability view (truncated to ~400 chars each).
- `src/lib/chat-stream.ts`: parse the new chunk payload alongside citations.
- `ChatBubble.tsx`: add a collapsible "Why this answer?" section under each assistant message:
  - List chunks with similarity bar (0–1) and source name.
  - Sentence-to-source mapping computed client-side: split answer into sentences, for each sentence find the chunk with the highest token-overlap (Jaccard on lowercased word sets) and render `[Source N]` chips next to each sentence.

No schema change.

---

### 4. Audit Explorer + Answer Templates

**Goal A — Audit Explorer (admin):** New tab on `/analytics` listing each query with: timestamp, user, category, retrieved chunks (with scores), final answer, citations, and feedback (👍/👎 if present).

**Goal B — Answer templates:** Standard wording for top-N intents stored in DB, surfaced in the chat system prompt so the model uses consistent phrasing.

**Changes:**
- Migration: 
  - Add `feedback` column (`text`, nullable: `up`/`down`) and `feedback_comment` (text) to `audit_logs`. RLS: user can update only own row's feedback fields (add UPDATE policy).
  - New table `answer_templates(id, intent text unique, pattern text, template text, category text, created_at, updated_at)`. Admin RLS for CRUD; authenticated read.
- `chat` edge function: persist `retrieved_chunks` (already a column — confirm we're writing the full chunk JSON with scores; if not, expand the insert). Load top answer templates and inject into system prompt as "Use these standardized phrasings when applicable: …".
- Frontend:
  - `ChatBubble.tsx`: add 👍/👎 buttons on assistant messages → write to `audit_logs.feedback` via the audit_log id returned in a new `X-Audit-Id` header.
  - `Analytics.tsx`: add tabbed layout — **Overview** (current charts) / **ROI** / **Audit Explorer** / **Templates**.
  - **Audit Explorer**: paginated list (already loaded `audit_logs`), expandable row showing chunks, answer, citations, feedback.
  - **Templates**: simple admin CRUD (list, add, edit, delete) for `answer_templates`.

---

## Technical details

- All migrations via `supabase--migration` tool.
- New RLS:
  - `ticket_qa` admin_review policy: allow admin OR sme.
  - `audit_logs`: add `UPDATE` policy where `auth.uid() = user_id` restricted to feedback columns (enforced via trigger or column-level — use simple row-level UPDATE since only user can update own row).
  - `answer_templates`: SELECT for authenticated, INSERT/UPDATE/DELETE for admin via `has_role`.
- Chat function now returns extra headers: `X-Audit-Id`, `X-Chunks` (base64 JSON to avoid header char issues), keeps `X-Citations`.
- Sentence-to-source mapping is purely client-side (no extra LLM call).
- Time-saved constant: 8 min/query, $35/hr — exposed as constants at top of ROI panel for easy tuning.

## Out of scope
- Re-ranking or hybrid retrieval changes.
- Reworking the existing ticket flow beyond the QA permission tightening.
- LLM-based sentence attribution (using lexical overlap heuristic instead — fast, no extra cost, and aligns with "explainability" rather than "citation generation").
