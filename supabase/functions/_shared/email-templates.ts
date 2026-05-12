// Shared HTML email templates — banking-professional dark-on-light layout.

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

const APP_URL = "https://sopassist-ai.lovable.app";

function shell(title: string, intro: string, bodyHtml: string, ctaText: string, ctaUrl: string) {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;color:#0f172a;">
  <div style="border-bottom:3px solid #0ea5e9;padding-bottom:12px;margin-bottom:20px;">
    <h2 style="margin:0;color:#0f172a;font-size:18px;letter-spacing:0.5px;">SOPAssist AI</h2>
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Banking Knowledge Assistant</div>
  </div>
  <h3 style="margin:0 0 8px;color:#0f172a;font-size:16px;">${escapeHtml(title)}</h3>
  <p style="margin:0 0 16px;color:#475569;font-size:14px;">${intro}</p>
  ${bodyHtml}
  ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:600;margin-top:8px;">${escapeHtml(ctaText)}</a>` : ""}
  <p style="margin-top:28px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;">
    This is an automated message from SOPAssist AI · Banking Operations.<br/>
    Please do not reply directly. Use the application to respond.
  </p>
</div>`;
}

function ticketCard(ticket: any): string {
  return `
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0ea5e9;border-radius:6px;padding:14px;margin:12px 0;">
  <div style="font-size:11px;color:#64748b;letter-spacing:0.5px;margin-bottom:6px;">
    TICKET #${ticket.id.slice(0, 8).toUpperCase()} · ${escapeHtml(ticket.category)} · ${escapeHtml(ticket.priority)}
  </div>
  <div style="font-weight:600;color:#0f172a;margin-bottom:8px;font-size:13px;">
    Status: <span style="color:#0ea5e9;text-transform:uppercase;">${escapeHtml((ticket.status || "").replace("_", " "))}</span>
  </div>
  <div style="white-space:pre-wrap;color:#1e293b;font-size:13px;line-height:1.5;">${escapeHtml(ticket.query)}</div>
  ${ticket.resolution_notes ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:13px;color:#334155;"><strong>Resolution:</strong><br/>${escapeHtml(ticket.resolution_notes)}</div>` : ""}
</div>`;
}

export function ticketCreatedEmail(ticket: any) {
  return {
    subject: `[SOPAssist] New ticket #${ticket.id.slice(0, 8).toUpperCase()} — ${ticket.category}`,
    html: shell(
      "New Support Ticket Raised",
      "A new support ticket requires attention from the SME / Admin team.",
      ticketCard(ticket),
      "Open Ticket",
      `${APP_URL}/tickets`
    ),
  };
}

export function ticketCreatedRequesterEmail(ticket: any) {
  return {
    subject: `[SOPAssist] Your ticket #${ticket.id.slice(0, 8).toUpperCase()} has been received`,
    html: shell(
      "We've Received Your Support Ticket",
      "Thank you for reaching out. Our SME team has been notified and will follow up with you shortly. Below are the details of the ticket you raised.",
      ticketCard(ticket),
      "",
      ""
    ),
  };
}

export function ticketAssignedEmail(ticket: any) {
  return {
    subject: `[SOPAssist] Ticket #${ticket.id.slice(0, 8).toUpperCase()} assigned to you`,
    html: shell(
      "Ticket Assigned",
      "A ticket has been assigned to you and is awaiting your action.",
      ticketCard(ticket),
      "Review Ticket",
      `${APP_URL}/tickets`
    ),
  };
}

export function ticketResolvedEmail(ticket: any) {
  return {
    subject: `[SOPAssist] Your ticket #${ticket.id.slice(0, 8).toUpperCase()} has been resolved`,
    html: shell(
      "Your Ticket Has Been Resolved",
      "Our team has resolved your support ticket. Please review the resolution and rate the response.",
      ticketCard(ticket),
      "Rate Resolution",
      `${APP_URL}/tickets`
    ),
  };
}

export function ticketUpdatedEmail(ticket: any) {
  return {
    subject: `[SOPAssist] Ticket #${ticket.id.slice(0, 8).toUpperCase()} updated`,
    html: shell(
      "Ticket Updated",
      "A ticket you are involved with has been updated.",
      ticketCard(ticket),
      "Open Ticket",
      `${APP_URL}/tickets`
    ),
  };
}

export function qaSubmittedEmail(ticket: any, qa: { qa_type: string; verdict?: string | null; rating?: number | null; comment?: string | null }) {
  const isAdmin = qa.qa_type === "admin_review";
  const verdictLabel = qa.verdict === "needs_rework" ? "Needs Rework" : qa.verdict === "approved" ? "Approved" : "";
  const stars = qa.rating ? "★".repeat(qa.rating) + "☆".repeat(5 - qa.rating) : "";
  const detail = `
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin:12px 0;">
  <div style="font-size:11px;color:#64748b;letter-spacing:0.5px;margin-bottom:6px;">
    QA · ${isAdmin ? "ADMIN REVIEW" : "REQUESTER RATING"}
  </div>
  ${verdictLabel ? `<div style="font-weight:600;font-size:13px;color:${qa.verdict === "needs_rework" ? "#ea580c" : "#059669"};margin-bottom:6px;">Verdict: ${verdictLabel}</div>` : ""}
  ${stars ? `<div style="font-size:18px;color:#f59e0b;margin-bottom:6px;">${stars}</div>` : ""}
  ${qa.comment ? `<div style="white-space:pre-wrap;color:#1e293b;font-size:13px;">${escapeHtml(qa.comment)}</div>` : ""}
</div>`;
  return {
    subject: `[SOPAssist] QA ${isAdmin ? "review" : "rating"} on ticket #${ticket.id.slice(0, 8).toUpperCase()}`,
    html: shell(
      isAdmin ? "Admin QA Review Submitted" : "Requester Rated Your Resolution",
      isAdmin
        ? "An admin has reviewed the resolution of a ticket you are involved with."
        : "The requester has rated the resolution you provided.",
      detail + ticketCard(ticket),
      "View Ticket",
      `${APP_URL}/tickets`
    ),
  };
}

export function inviteEmail(opts: { fullName: string | null; role: string; inviteUrl: string; invitedBy: string | null }) {
  const greeting = opts.fullName ? `Hello ${escapeHtml(opts.fullName)},` : "Hello,";
  const body = `
<p style="margin:0 0 14px;color:#475569;font-size:14px;">${greeting}</p>
<p style="margin:0 0 14px;color:#475569;font-size:14px;">
  You have been invited${opts.invitedBy ? ` by <strong>${escapeHtml(opts.invitedBy)}</strong>` : ""} to join
  <strong>SOPAssist AI</strong> — the banking operations knowledge assistant — as
  <strong style="color:#0ea5e9;text-transform:uppercase;">${escapeHtml(opts.role)}</strong>.
</p>
<p style="margin:0 0 14px;color:#475569;font-size:14px;">
  Click the button below to set your password and activate your account. This link is single-use and expires for security.
</p>`;
  return {
    subject: `[SOPAssist] You've been invited as ${opts.role.toUpperCase()}`,
    html: shell(
      "Welcome to SOPAssist AI",
      "Your access has been provisioned by an administrator.",
      body,
      "Set Password & Sign In",
      opts.inviteUrl
    ),
  };
}