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

    // Determine recipients + render template
    const recipients = new Set<string>();
    let template: { subject: string; html: string };
    let purpose = "ticket_updated";

    if (body.event === "created") {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "sme"]);
      const ids = (roles || []).map((r: any) => r.user_id);
      for (const id of ids) {
        const { data } = await supabase.auth.admin.getUserById(id);
        if (data?.user?.email) recipients.add(data.user.email);
      }
      template = ticketCreatedEmail(ticket);
      purpose = "ticket_created";

      // Also send a confirmation (no CTA link) to the requester
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
    } else if (body.event === "assigned" && ticket.assigned_to) {
      const { data } = await supabase.auth.admin.getUserById(ticket.assigned_to);
      if (data?.user?.email) recipients.add(data.user.email);
      template = ticketAssignedEmail(ticket);
      purpose = "ticket_assigned";
    } else if (body.event === "resolved" && ticket.user_email) {
      recipients.add(ticket.user_email);
      template = ticketResolvedEmail(ticket);
      purpose = "ticket_resolved";
    } else if (body.event === "qa_submitted" && body.qa_id) {
      const { data: qa } = await supabase
        .from("ticket_qa")
        .select("*")
        .eq("id", body.qa_id)
        .single();
      if (!qa) {
        return new Response(JSON.stringify({ error: "QA not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Requester rating → notify the assignee/admin team
      // Admin review → notify the requester
      if (qa.qa_type === "admin_review" && ticket.user_email) {
        recipients.add(ticket.user_email);
      } else if (qa.qa_type === "requester_rating" && ticket.assigned_to_email) {
        recipients.add(ticket.assigned_to_email);
      }
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