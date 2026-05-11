import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { Input } from "@/components/ui/input";

interface RaiseTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  category?: string;
  conversationId?: string | null;
  assistantResponse?: string;
}

const CATEGORIES = ["General Operations", "Compliance", "SOP", "Products"];
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export function RaiseTicketDialog({
  open,
  onOpenChange,
  query,
  category = "General Operations",
  conversationId,
  assistantResponse,
}: RaiseTicketDialogProps) {
  const { user } = useAuth();
  const [editedQuery, setEditedQuery] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("medium");
  const [extraContext, setExtraContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  // Reset when reopened with new query
  useState(() => {
    setEditedQuery(query);
    setSelectedCategory(category);
  });

  const handleSubmit = async () => {
    if (!editedQuery.trim()) {
      toast.error("Question cannot be empty");
      return;
    }
    if (!user) {
      if (!guestEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        toast.error("Please enter a valid email so we can follow up");
        return;
      }
    }
    setSubmitting(true);
    try {
      const context = [
        !user && guestName && `Guest name: ${guestName}`,
        extraContext && `Additional context from user:\n${extraContext}`,
        assistantResponse && `Assistant's previous answer:\n${assistantResponse}`,
      ]
        .filter(Boolean)
        .join("\n\n---\n\n");

      const ticketId = crypto.randomUUID();
      const { error } = await supabase
        .from("tickets")
        .insert({
          id: ticketId,
          user_id: user?.id ?? null,
          user_email: user?.email ?? guestEmail.trim(),
          guest_name: !user ? (guestName.trim() || null) : null,
          query: editedQuery.trim(),
          context: context || null,
          category: selectedCategory,
          priority,
          conversation_id: conversationId || null,
        } as any);

      if (error) throw error;

      // Fire-and-forget notification (non-blocking)
      supabase.functions
        .invoke("notify-ticket", {
          body: { event: "created", ticket_id: ticketId },
        })
        .catch(() => {});

      toast.success("Ticket raised — our team will follow up soon.");
      onOpenChange(false);
      setExtraContext("");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to raise ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-accent" />
            Raise a Support Ticket
          </DialogTitle>
          <DialogDescription>
            Couldn&apos;t find what you needed? Send this to our SME team for follow-up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!user && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guest-name" className="text-xs">Your name (optional)</Label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Jane Doe"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-email" className="text-xs">Your email *</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@bank.com"
                  className="text-sm"
                  required
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-query" className="text-xs">Your question</Label>
            <Textarea
              id="ticket-query"
              value={editedQuery}
              onChange={(e) => setEditedQuery(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-context" className="text-xs">Additional context (optional)</Label>
            <Textarea
              id="ticket-context"
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              rows={3}
              placeholder="Anything that would help an SME answer faster…"
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}