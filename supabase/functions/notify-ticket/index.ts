import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ticketCreatedEmail,
  ticketCreatedRequesterEmail,
  ticketAssignedEmail,
  ticketResolvedEmail,
  ticketUpdatedEmail,
  qaSubmittedEmail,
} from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Event = "created" | "assigned" | "resolved" | "updated" | "qa_submitted";

interface Body {
  event: Event;
  ticket_id: string;
  qa_id?: string;
}

async function sendViaGmail(to: string, subject: string, html: string, ticketId: string, purpose: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email-gmail`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ to, subject, html, ticket_id: ticketId, purpose }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[notify-ticket] Gmail send to ${to} failed:`, txt);
    return { error: txt };
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.event || !body?.ticket_id) {
      return new Response(JSON.stringify({ error: "event and ticket_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", body.ticket_id)
      .single();

    if (error || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always notify: requester + assignee + all admins (and SMEs) for every event.
    const recipients = new Set<string>();
    let template: { subject: string; html: string };
    let purpose = "ticket_updated";
    let qa: any = null;

    // 1) Requester
    if (ticket.user_email) recipients.add(ticket.user_email);

    // 2) Assignee
    if (ticket.assigned_to_email) recipients.add(ticket.assigned_to_email);
    if (ticket.assigned_to) {
      const { data } = await supabase.auth.admin.getUserById(ticket.assigned_to);
      if (data?.user?.email) recipients.add(data.user.email);
    }

    // 3) Admins + SMEs
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "sme"]);
    for (const r of roles || []) {
      const { data } = await supabase.auth.admin.getUserById((r as any).user_id);
      if (data?.user?.email) recipients.add(data.user.email);
    }

    // Pick template per event
    if (body.event === "created") {
      template = ticketCreatedEmail(ticket);
      purpose = "ticket_created";
      // Also send the requester-flavoured confirmation (no staff CTA)
      if (ticket.user_email) {
        const requesterTpl = ticketCreatedRequesterEmail(ticket);
        await sendViaGmail(
          ticket.user_email,
          requesterTpl.subject,
          requesterTpl.html,
          ticket.id,
          "ticket_created_requester"
        );
      }
    } else if (body.event === "assigned") {
      template = ticketAssignedEmail(ticket);
      purpose = "ticket_assigned";
    } else if (body.event === "resolved") {
      template = ticketResolvedEmail(ticket);
      purpose = "ticket_resolved";
    } else if (body.event === "qa_submitted" && body.qa_id) {
      const { data: qaRow } = await supabase
        .from("ticket_qa")
        .select("*")
        .eq("id", body.qa_id)
        .single();
      if (!qaRow) {
        return new Response(JSON.stringify({ error: "QA not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      qa = qaRow;
      template = qaSubmittedEmail(ticket, qa);
      purpose = "qa_submitted";
    } else {
      template = ticketUpdatedEmail(ticket);
    }

    if (recipients.size === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "no recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      Array.from(recipients).map((to) =>
        sendViaGmail(to, template.subject, template.html, ticket.id, purpose)
      )
    );

    return new Response(JSON.stringify({ ok: true, recipients: Array.from(recipients), results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-ticket error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});