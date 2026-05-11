import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Ticket, RefreshCw, Clock, User as UserIcon, Tag, AlertCircle, RotateCcw } from "lucide-react";
import { TicketQAPanel } from "@/components/tickets/TicketQAPanel";

type TicketStatus = "open" | "assigned" | "in_progress" | "resolved" | "closed" | "reopened";

interface TicketRow {
  id: string;
  user_id: string;
  user_email: string | null;
  query: string;
  context: string | null;
  category: string;
  status: TicketStatus;
  priority: string;
  assigned_to: string | null;
  assigned_to_email: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  conversation_id: string | null;
}

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
];

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  assigned: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  in_progress: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
  reopened: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-400",
  high: "bg-orange-500/15 text-orange-400",
  urgent: "bg-red-500/15 text-red-400",
};

export default function Tickets() {
  const { user, isStaff } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [staff, setStaff] = useState<Array<{ user_id: string; email: string }>>([]);

  const loadTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load tickets");
    } else {
      setTickets((data as TicketRow[]) || []);
    }
    setLoading(false);
  };

  const loadStaff = async () => {
    if (!isStaff) return;
    // Get admins + SMEs from user_roles, joined with profiles for email/name
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "sme"] as any);
    if (!roles?.length) return;
    const ids = Array.from(new Set(roles.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    setStaff(
      ids.map((uid) => ({
        user_id: uid,
        email: profiles?.find((p) => p.user_id === uid)?.full_name || uid.slice(0, 8),
      }))
    );
  };

  useEffect(() => {
    loadTickets();
    loadStaff();
    // Realtime updates
    const channel = supabase
      .channel("tickets-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => loadTickets())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [tickets, statusFilter, categoryFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length, open: 0, assigned: 0, in_progress: 0, resolved: 0, closed: 0 };
    tickets.forEach((t) => (c[t.status] = (c[t.status] || 0) + 1));
    return c;
  }, [tickets]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Ticket className="w-6 h-6 text-primary" />
            {isStaff ? "Support Tickets" : "My Tickets"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isStaff
              ? "Triage and resolve user-raised tickets"
              : "Track tickets you've raised from chat"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTickets} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Status pill summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`glass-panel rounded-lg px-3 py-2.5 text-left transition-all ${
              statusFilter === s.value ? "border-primary/40 bg-primary/10" : "hover:border-primary/20"
            }`}
          >
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-xl font-semibold text-foreground">{counts[s.value] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="General Operations">General Operations</SelectItem>
            <SelectItem value="Compliance">Compliance</SelectItem>
            <SelectItem value="SOP">SOP</SelectItem>
            <SelectItem value="Products">Products</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {loading && <div className="text-sm text-muted-foreground p-8 text-center">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="glass-panel rounded-lg p-12 text-center">
            <Ticket className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No tickets match the current filters.</p>
          </div>
        )}
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTicket(t)}
            className="w-full text-left glass-panel rounded-lg p-4 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Badge variant="outline" className={STATUS_COLORS[t.status]}>
                    {t.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline" className={PRIORITY_COLORS[t.priority]}>
                    {t.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {t.category}
                  </span>
                  {isStaff && t.user_email && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> {t.user_email}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground line-clamp-2">{t.query}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                  {t.assigned_to_email && (
                    <span>→ {t.assigned_to_email}</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <TicketDetailDialog
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdated={loadTickets}
        canManage={isStaff}
        staff={staff}
        currentUserId={user?.id || null}
      />
    </div>
  );
}

function TicketDetailDialog({
  ticket,
  onClose,
  onUpdated,
  canManage,
  staff,
  currentUserId,
}: {
  ticket: TicketRow | null;
  onClose: () => void;
  onUpdated: () => void;
  canManage: boolean;
  staff: Array<{ user_id: string; email: string }>;
  currentUserId: string | null;
}) {
  const [status, setStatus] = useState<TicketStatus>("open");
  const [assignee, setAssignee] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setAssignee(ticket.assigned_to || "");
      setNotes(ticket.resolution_notes || "");
    }
  }, [ticket]);

  if (!ticket) return null;

  const handleSave = async () => {
    // Resolution notes required when marking a ticket as resolved or closed
    if ((status === "resolved" || status === "closed") && !notes.trim()) {
      toast.error("Resolution notes are required to resolve or close a ticket");
      return;
    }
    setSaving(true);
    const assigneeRow = staff.find((s) => s.user_id === assignee);
    const update: any = {
      status,
      assigned_to: assignee || null,
      assigned_to_email: assigneeRow?.email || null,
      resolution_notes: notes || null,
    };
    // Auto-promote to 'assigned' when an assignee is set on an open ticket
    if (assignee && status === "open") update.status = "assigned";

    const { error } = await supabase.from("tickets").update(update).eq("id", ticket.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Notify on lifecycle events
    const event =
      update.status === "resolved" ? "resolved" :
      update.status === "assigned" || update.status === "in_progress" ? "assigned" :
      "updated";
    supabase.functions
      .invoke("notify-ticket", { body: { event, ticket_id: ticket.id } })
      .catch(() => {});

    toast.success("Ticket updated");
    onUpdated();
    onClose();
  };

  return (
    <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            Ticket #{ticket.id.slice(0, 8)}
          </DialogTitle>
          <DialogDescription>
            Raised {new Date(ticket.created_at).toLocaleString()}
            {ticket.user_email && ` by ${ticket.user_email}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Question</Label>
            <div className="glass-panel rounded-lg p-3 mt-1 text-sm whitespace-pre-wrap">
              {ticket.query}
            </div>
          </div>

          {ticket.context && (
            <div>
              <Label className="text-xs text-muted-foreground">Context</Label>
              <div className="glass-panel rounded-lg p-3 mt-1 text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                {ticket.context}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)} disabled={!canManage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assignee</Label>
              <Select value={assignee || "__none__"} onValueChange={(v) => setAssignee(v === "__none__" ? "" : v)} disabled={!canManage}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-xs">
              Resolution notes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={canManage ? "Required when resolving or closing — document the resolution for compliance…" : "No notes yet"}
              disabled={!canManage}
              required
            />
          </div>

          {!canManage && ticket.status === "resolved" && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 flex gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-emerald-300">This ticket has been resolved.</span>
            </div>
          )}

          <TicketQAPanel
            ticketId={ticket.id}
            ticketStatus={ticket.status}
            isRequester={!!currentUserId && currentUserId === ticket.user_id}
            onChanged={onUpdated}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canManage && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}