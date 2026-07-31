import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Home } from "lucide-react";
import { Link } from "react-router-dom";

const TOTAL_SLIDES = 12;

function SlideWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="slide-content w-[1920px] h-[1080px] relative overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {children}
    </div>
  );
}

/* ── Decorative helpers ── */
function FlowArrow({ horizontal = true }: { horizontal?: boolean }) {
  return horizontal ? (
    <div className="flex items-center mx-1 shrink-0">
      <div className="w-8 h-0.5 bg-primary" />
      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-primary" />
    </div>
  ) : (
    <div className="flex flex-col items-center my-1 shrink-0">
      <div className="h-6 w-0.5 bg-primary" />
      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-primary" />
    </div>
  );
}

function DiagramBox({ title, sub, color = "primary", icon }: { title: string; sub?: string; color?: string; icon?: string }) {
  const bg = color === "accent" ? "bg-accent/15 border-accent/40" : color === "chart-3" ? "bg-purple-900/30 border-purple-500/40" : "bg-primary/10 border-primary/30";
  const text = color === "accent" ? "text-accent" : color === "chart-3" ? "text-purple-400" : "text-primary";
  return (
    <div className={`${bg} border rounded-xl px-6 py-4 text-center min-w-[160px]`}>
      {icon && <div className="text-2xl mb-1">{icon}</div>}
      <p className={`font-bold text-lg ${text}`}>{title}</p>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function SectionBadge({ text }: { text: string }) {
  return <span className="inline-block text-xs uppercase tracking-[0.2em] text-primary font-semibold bg-primary/10 px-4 py-1.5 rounded-full mb-4">{text}</span>;
}

function SlideNumber({ n }: { n: number }) {
  return <div className="absolute bottom-6 right-10 text-sm text-muted-foreground/60 font-mono">{n} / {TOTAL_SLIDES}</div>;
}

/* ── SLIDE COMPONENTS ── */

function Slide1() {
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-20">
        <div className="w-20 h-20 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-8">
          <span className="text-4xl">🤖</span>
        </div>
        <h1 className="text-7xl font-extrabold text-foreground leading-tight mb-4">
          SOP<span className="text-gradient">Assist</span> AI
        </h1>
        <p className="text-2xl text-muted-foreground max-w-3xl mb-6">
          AI-Powered Knowledge Chatbot for Banking Operations
        </p>
        <div className="h-1 w-32 bg-gradient-to-r from-primary to-accent rounded-full mb-8" />
        <p className="text-lg text-muted-foreground">Team <span className="text-foreground font-semibold">Ardents</span></p>
        <p className="text-base text-muted-foreground/70 mt-2">Virtusa Jatayu — Season 5 | Stage 2 POC Submission</p>
      </div>
      <SlideNumber n={1} />
    </SlideWrapper>
  );
}

function Slide2() {
  const problems = [
    { icon: "📂", title: "Fragmented Knowledge", desc: "SOPs, policies, and manuals are scattered across SharePoint, emails, drives—hard to find when needed." },
    { icon: "👤", title: "SME Dependency", desc: "Employees rely on senior experts for answers, creating bottlenecks and delays during peak hours." },
    { icon: "⚠️", title: "Regulatory Pressure", desc: "Banking compliance requires fast, accurate responses. Delays risk audit penalties and operational errors." },
    { icon: "🕐", title: "Slow Onboarding", desc: "New joiners spend weeks navigating scattered documents instead of serving customers." },
  ];
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="Problem Statement" />
        <h2 className="text-5xl font-bold text-foreground mb-2">Business Need</h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-3xl">Why do banking operations teams need an AI-powered knowledge assistant?</p>
        <div className="grid grid-cols-2 gap-8 flex-1">
          {problems.map((p) => (
            <div key={p.title} className="glass-panel rounded-2xl p-8 flex gap-5">
              <span className="text-4xl shrink-0">{p.icon}</span>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">{p.title}</h3>
                <p className="text-base text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SlideNumber n={2} />
    </SlideWrapper>
  );
}

function Slide3() {
  const segments = [
    { icon: "🏦", label: "L1/L2 Ops Teams", size: "~5,000+ staff", desc: "Daily SOP lookups for processing, exceptions, escalations" },
    { icon: "📋", label: "Compliance & Audit", size: "~500+ staff", desc: "Instant regulatory policy retrieval during audits" },
    { icon: "🎓", label: "New Joiners", size: "~1,000+/year", desc: "Self-serve onboarding without waiting for SME availability" },
    { icon: "💼", label: "Branch Operations", size: "~2,000+ branches", desc: "Quick access to product & process guidelines at the counter" },
  ];
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="Market Opportunity" />
        <h2 className="text-5xl font-bold text-foreground mb-2">Target Segment</h2>
        <p className="text-xl text-muted-foreground mb-12">Who benefits from SOPAssist AI?</p>
        <div className="grid grid-cols-2 gap-6 flex-1">
          {segments.map((s) => (
            <div key={s.label} className="glass-panel rounded-2xl p-8 flex items-start gap-5">
              <span className="text-4xl">{s.icon}</span>
              <div>
                <h3 className="text-xl font-bold text-foreground">{s.label}</h3>
                <span className="inline-block text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full mt-1 mb-2">{s.size}</span>
                <p className="text-base text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SlideNumber n={3} />
    </SlideWrapper>
  );
}

function Slide4() {
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex h-full px-24 py-20 gap-16">
        <div className="flex-1 flex flex-col justify-center">
          <SectionBadge text="Our Solution" />
          <h2 className="text-5xl font-bold text-foreground mb-6">Solution Overview</h2>
          <p className="text-xl text-muted-foreground leading-relaxed mb-8">
            A <span className="text-primary font-semibold">Retrieval-Augmented Generation (RAG)</span> chatbot that ingests approved banking documents, searches them intelligently, and generates accurate, citation-backed answers in real time.
          </p>
          <div className="space-y-4">
            {["No hallucinations — answers grounded in uploaded documents", "Every response includes traceable source citations", "Multi-format ingestion: PDF, DOCX, Images, Emails, Excel", "Role-based access: Admin uploads, everyone chats"].map((t) => (
              <div key={t} className="flex items-start gap-3">
                <span className="text-primary text-lg mt-0.5">✓</span>
                <p className="text-lg text-foreground">{t}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="glass-panel rounded-3xl p-10 glow-primary max-w-lg">
            <div className="space-y-5">
              <div className="bg-secondary/50 rounded-xl p-4"><p className="text-muted-foreground text-sm">User asks:</p><p className="text-foreground font-medium">"What is the KYC renewal process for corporate accounts?"</p></div>
              <div className="bg-primary/10 rounded-xl p-4 border border-primary/20"><p className="text-primary text-sm">SOPAssist AI:</p><p className="text-foreground">"According to the KYC Policy v3.2 (Section 4.1), corporate accounts require re-verification every 2 years with updated director KYC..."</p><p className="text-xs text-muted-foreground mt-2">📄 Source: KYC_Policy_v3.2.pdf — Page 12</p></div>
            </div>
          </div>
        </div>
      </div>
      <SlideNumber n={4} />
    </SlideWrapper>
  );
}

function Slide5() {
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="Architecture" />
        <h2 className="text-5xl font-bold text-foreground mb-10">System Architecture</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-4">
            <DiagramBox title="React Frontend" sub="Vite + TypeScript" icon="🖥️" />
            <FlowArrow />
            <DiagramBox title="Edge Functions" sub="Auth & API Layer" icon="⚡" color="accent" />
            <FlowArrow />
            <div className="flex flex-col items-center gap-3">
              <DiagramBox title="Postgres DB" sub="Full-Text Search" icon="🗄️" color="chart-3" />
              <div className="text-xs text-muted-foreground">document_chunks + tsvector</div>
            </div>
            <FlowArrow />
            <DiagramBox title="Groq LLM" sub="Llama 3 · 70B" icon="🧠" color="accent" />
            <FlowArrow />
            <DiagramBox title="Cited Response" sub="With Source Docs" icon="📄" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" /><span className="text-sm text-muted-foreground">Frontend / Backend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent" /><span className="text-sm text-muted-foreground">Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-sm text-muted-foreground">Storage</span>
          </div>
        </div>
      </div>
      <SlideNumber n={5} />
    </SlideWrapper>
  );
}

function Slide6() {
  const steps = [
    { n: "1", title: "Upload", desc: "Admin uploads PDF, DOCX, Image, Email, CSV", icon: "📤", color: "primary" },
    { n: "2", title: "Parse", desc: "Edge Function extracts text (AI vision for images)", icon: "🔍", color: "accent" },
    { n: "3", title: "Chunk", desc: "Split into ~500-word chunks with section titles", icon: "✂️", color: "chart-3" },
    { n: "4", title: "Index", desc: "Store in Postgres with tsvector full-text index", icon: "📇", color: "primary" },
    { n: "5", title: "Search", desc: "User query → ts_rank full-text search on chunks", icon: "🔎", color: "accent" },
    { n: "6", title: "Generate", desc: "Top chunks + query → Groq LLM → cited answer", icon: "🤖", color: "chart-3" },
  ];
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="How It Works" />
        <h2 className="text-5xl font-bold text-foreground mb-10">RAG Pipeline Flow</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <div className="glass-panel rounded-2xl p-6 w-[240px] text-center">
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center mx-auto mb-2 text-sm">{s.n}</div>
                  <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                </div>
                {i < steps.length - 1 && <FlowArrow />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <SlideNumber n={6} />
    </SlideWrapper>
  );
}

function Slide7() {
  const features = [
    { icon: "💬", title: "AI Chat Interface", desc: "Natural language Q&A with streaming responses and conversation history" },
    { icon: "📁", title: "Multi-Format Ingestion", desc: "PDF, DOCX, TXT, Images, Emails (.eml/.msg), CSV/Excel support" },
    { icon: "🔍", title: "Full-Text Search", desc: "Postgres tsvector ranking for precise, relevant chunk retrieval" },
    { icon: "📎", title: "Source Citations", desc: "Every answer links back to the exact document and section" },
    { icon: "📊", title: "Analytics Dashboard", desc: "Query trends, category breakdown, audit logs, user activity" },
    { icon: "🔐", title: "Role-Based Access", desc: "Admin-only document management, public chat access for all users" },
  ];
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="Capabilities" />
        <h2 className="text-5xl font-bold text-foreground mb-10">Key Features</h2>
        <div className="grid grid-cols-3 gap-6 flex-1">
          {features.map((f) => (
            <div key={f.title} className="glass-panel rounded-2xl p-8 flex flex-col">
              <span className="text-4xl mb-4">{f.icon}</span>
              <h3 className="text-xl font-bold text-foreground mb-2">{f.title}</h3>
              <p className="text-base text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <SlideNumber n={7} />
    </SlideWrapper>
  );
}

function Slide8() {
  const stack = [
    { category: "Frontend", items: [{ name: "React + Vite", desc: "Fast SPA framework" }, { name: "TypeScript", desc: "Type-safe codebase" }, { name: "Tailwind CSS", desc: "Utility-first styling" }, { name: "shadcn/ui", desc: "Accessible components" }] },
    { category: "Backend", items: [{ name: "Supabase", desc: "Postgres + Auth + Edge Functions" }, { name: "Edge Functions", desc: "Deno-based serverless APIs" }, { name: "Postgres FTS", desc: "tsvector full-text search" }, { name: "Row-Level Security", desc: "Fine-grained access control" }] },
    { category: "AI / LLM", items: [{ name: "Groq Cloud", desc: "Ultra-fast LLM inference" }, { name: "Llama 3 70B", desc: "Open-source language model" }, { name: "Gemini Flash", desc: "Vision extraction for images" }, { name: "Streaming SSE", desc: "Real-time token streaming" }] },
  ];
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="Technology" />
        <h2 className="text-5xl font-bold text-foreground mb-10">Tech Stack</h2>
        <div className="grid grid-cols-3 gap-8 flex-1">
          {stack.map((s) => (
            <div key={s.category} className="glass-panel rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-primary mb-6">{s.category}</h3>
              <div className="space-y-4">
                {s.items.map((item) => (
                  <div key={item.name} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div><p className="text-lg font-semibold text-foreground">{item.name}</p><p className="text-sm text-muted-foreground">{item.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <SlideNumber n={8} />
    </SlideWrapper>
  );
}

function Slide9() {
  const formats = [
    { icon: "📄", name: "PDF", desc: "Auto-parsed via edge function" },
    { icon: "📝", name: "DOCX / TXT", desc: "Text extraction & chunking" },
    { icon: "🖼️", name: "Images", desc: "AI vision text extraction (Gemini)" },
    { icon: "📧", name: "Emails", desc: ".eml/.msg header + body parsing" },
    { icon: "📊", name: "CSV / Excel", desc: "Row-by-row data ingestion" },
    { icon: "📂", name: "SharePoint", desc: "Export & upload files" },
  ];
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="Ingestion Pipeline" />
        <h2 className="text-5xl font-bold text-foreground mb-6">Document Ingestion</h2>
        <p className="text-xl text-muted-foreground mb-10">Supports 6+ document formats with intelligent parsing and chunking</p>
        <div className="grid grid-cols-3 gap-6 mb-10">
          {formats.map((f) => (
            <div key={f.name} className="glass-panel rounded-xl p-6 flex items-center gap-4">
              <span className="text-3xl">{f.icon}</span>
              <div><p className="text-lg font-bold text-foreground">{f.name}</p><p className="text-sm text-muted-foreground">{f.desc}</p></div>
            </div>
          ))}
        </div>
        <div className="glass-panel rounded-2xl p-8">
          <h3 className="text-lg font-bold text-foreground mb-4">Ingestion Flow</h3>
          <div className="flex items-center justify-center gap-3">
            <DiagramBox title="Upload File" sub="Any format" icon="📤" />
            <FlowArrow />
            <DiagramBox title="Parse & Extract" sub="Edge Function" icon="⚙️" color="accent" />
            <FlowArrow />
            <DiagramBox title="Chunk Text" sub="~500 words each" icon="✂️" color="chart-3" />
            <FlowArrow />
            <DiagramBox title="Store & Index" sub="Postgres + FTS" icon="🗄️" />
          </div>
        </div>
      </div>
      <SlideNumber n={9} />
    </SlideWrapper>
  );
}

function Slide10() {
  const items = [
    { icon: "🔐", title: "Role-Based Access Control", desc: "Admin and User roles stored in dedicated user_roles table with Postgres enum. Security-definer functions prevent privilege escalation." },
    { icon: "📝", title: "Comprehensive Audit Logs", desc: "Every query is logged with user ID, category, timestamp, retrieved chunks, and full response for compliance review." },
    { icon: "✅", title: "Approved Sources Only", desc: "Only admin-uploaded, verified documents feed the knowledge base. No external or unvetted content enters the system." },
    { icon: "⚖️", title: "Informational-Only Design", desc: "Clear disclaimers that AI responses are for reference only. Users are directed to verify with official sources for critical decisions." },
  ];
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="Compliance" />
        <h2 className="text-5xl font-bold text-foreground mb-10">Security & Governance</h2>
        <div className="grid grid-cols-2 gap-8 flex-1">
          {items.map((item) => (
            <div key={item.title} className="glass-panel rounded-2xl p-8 flex gap-5">
              <span className="text-4xl shrink-0">{item.icon}</span>
              <div><h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3><p className="text-base text-muted-foreground leading-relaxed">{item.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
      <SlideNumber n={10} />
    </SlideWrapper>
  );
}

function Slide11() {
  const metrics = [
    { value: "30–50%", label: "Faster information retrieval" },
    { value: "60%", label: "Reduction in SME dependency" },
    { value: "40%", label: "Faster new-joiner onboarding" },
    { value: "100%", label: "Audit-trail coverage" },
  ];
  const roadmap = [
    { phase: "Phase 1", title: "Current POC", items: ["RAG chatbot with FTS", "Multi-format ingestion", "Analytics + Audit logs"] },
    { phase: "Phase 2", title: "Enhanced", items: ["Vector embeddings (pgvector)", "SharePoint API integration", "Multi-language support"] },
    { phase: "Phase 3", title: "Enterprise", items: ["SSO / LDAP authentication", "Department-wise knowledge silos", "Workflow automation"] },
  ];
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-background" />
      <div className="relative z-10 flex flex-col h-full px-24 py-20">
        <SectionBadge text="Impact" />
        <h2 className="text-5xl font-bold text-foreground mb-10">Expected Impact & Roadmap</h2>
        <div className="grid grid-cols-4 gap-4 mb-10">
          {metrics.map((m) => (
            <div key={m.label} className="glass-panel rounded-xl p-6 text-center">
              <p className="text-4xl font-extrabold text-gradient mb-2">{m.value}</p>
              <p className="text-sm text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6 flex-1">
          {roadmap.map((r) => (
            <div key={r.phase} className="glass-panel rounded-2xl p-8">
              <span className="text-xs uppercase tracking-widest text-primary font-semibold">{r.phase}</span>
              <h3 className="text-xl font-bold text-foreground mt-1 mb-4">{r.title}</h3>
              <ul className="space-y-2">
                {r.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-base text-muted-foreground"><span className="text-primary mt-0.5">•</span>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <SlideNumber n={11} />
    </SlideWrapper>
  );
}

function Slide12() {
  return (
    <SlideWrapper>
      <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-20">
        <h2 className="text-6xl font-extrabold text-foreground mb-4">Thank You!</h2>
        <p className="text-2xl text-muted-foreground mb-12">Ready for Live Demo</p>
        <div className="flex gap-8 mb-12">
          <div className="glass-panel rounded-2xl p-8 glow-primary">
            <p className="text-sm text-muted-foreground mb-2">🌐 Live Application</p>
            <p className="text-lg font-semibold text-primary">sopassist-ai.lovable.app</p>
          </div>
          <div className="glass-panel rounded-2xl p-8 glow-accent">
            <p className="text-sm text-muted-foreground mb-2">💻 Source Code</p>
            <p className="text-lg font-semibold text-accent">GitHub Repository</p>
          </div>
        </div>
        <div className="h-1 w-32 bg-gradient-to-r from-primary to-accent rounded-full mb-8" />
        <p className="text-xl text-foreground font-semibold">Team Ardents</p>
        <p className="text-base text-muted-foreground mt-2">Virtusa Jatayu — Season 5</p>
      </div>
      <SlideNumber n={12} />
    </SlideWrapper>
  );
}

const SLIDES = [Slide1, Slide2, Slide3, Slide4, Slide5, Slide6, Slide7, Slide8, Slide9, Slide10, Slide11, Slide12];

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    const sx = window.innerWidth / 1920;
    const sy = window.innerHeight / 1080;
    setScale(Math.min(sx, sy));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); setCurrent((c) => Math.min(c + 1, TOTAL_SLIDES - 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setCurrent((c) => Math.max(c - 1, 0)); }
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen?.();
      if (e.key === "F5" || (e.key === "f" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  const SlideComp = SLIDES[current];

  return (
    <div className="w-screen h-screen bg-background overflow-hidden relative select-none">
      {/* Scaled slide */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ transform: `scale(${scale})`, transformOrigin: "center center", width: 1920, height: 1080 }}>
          <SlideComp />
        </div>
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50 bg-card/90 backdrop-blur-lg border border-border rounded-full px-4 py-2">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <Home className="w-4 h-4" />
        </Link>
        <button onClick={() => setCurrent((c) => Math.max(c - 1, 0))} disabled={current === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-foreground font-mono min-w-[60px] text-center">{current + 1} / {TOTAL_SLIDES}</span>
        <button onClick={() => setCurrent((c) => Math.min(c + 1, TOTAL_SLIDES - 1))} disabled={current === TOTAL_SLIDES - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
        <button onClick={toggleFullscreen} className="text-muted-foreground hover:text-foreground transition-colors">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 z-50">
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`} />
        ))}
      </div>
    </div>
  );
}
