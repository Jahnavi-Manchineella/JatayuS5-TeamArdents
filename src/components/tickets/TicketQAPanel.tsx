import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface QARow {
  id: string;
  qa_type: "requester_rating" | "admin_review";
  reviewer_id: string;
  reviewer_email: string | null;
  rating: number | null;
  verdict: "approved" | "needs_rework" | null;
  comment: string | null;
  created_at: string;
}

export function TicketQAPanel({
  ticketId,
  ticketStatus,
  isRequester,
  onChanged,
}: {
  ticketId: string;
  ticketStatus: string;
  isRequester: boolean;
  onChanged?: () => void;
}) {
  const { user, isAdmin, isSme } = useAuth();
  const canAdminReview = isAdmin || isSme;
  const [qa, setQa] = useState<QARow[]>([]);
  const [loading, setLoading] = useState(true);

  // Requester form
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // Admin form
  const [verdict, setVerdict] = useState<"approved" | "needs_rework">("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ticket_qa" as any)
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });
    setQa(((data as unknown) as QARow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const myRating = qa.find(
    (q) => q.qa_type === "requester_rating" && q.reviewer_id === user?.id
  );
  const myReview = qa.find(
    (q) => q.qa_type === "admin_review" && q.reviewer_id === user?.id
  );

  const isResolved = ticketStatus === "resolved" || ticketStatus === "closed";

  const submitRating = async () => {
    if (rating < 1) {
      toast.error("Please select a rating");
      return;
    }
    setSubmittingRating(true);
    const insertRating = await (supabase.from("ticket_qa" as any) as any).insert({
      ticket_id: ticketId,
      qa_type: "requester_rating",
      reviewer_id: user!.id,
      reviewer_email: user!.email,
      rating,
      comment: ratingComment || null,
    }).select("id").single();
    const inserted = insertRating.data as { id: string } | null;
    const error = insertRating.error;
    setSubmittingRating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thanks for your feedback!");
    if (inserted?.id) {
      supabase.functions
        .invoke("notify-ticket", {
          body: { event: "qa_submitted", ticket_id: ticketId, qa_id: inserted.id },
        })
        .catch(() => {});
    }
    setRating(0);
    setRatingComment("");
    load();
    onChanged?.();
  };

  const submitReview = async () => {
    setSubmittingReview(true);
    const insertReview = await (supabase.from("ticket_qa" as any) as any).insert({
      ticket_id: ticketId,
      qa_type: "admin_review",
      reviewer_id: user!.id,
      reviewer_email: user!.email,
      verdict,
      comment: reviewNotes || null,
    }).select("id").single();
    const inserted = insertReview.data as { id: string } | null;
    const error = insertReview.error;
    setSubmittingReview(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      verdict === "needs_rework" ? "Ticket reopened for rework" : "QA approved"
    );
    if (inserted?.id) {
      supabase.functions
        .invoke("notify-ticket", {
          body: { event: "qa_submitted", ticket_id: ticketId, qa_id: inserted.id },
        })
        .catch(() => {});
    }
    setReviewNotes("");
    load();
    onChanged?.();
  };

  if (!isResolved) {
    return (
      <div className="text-xs text-muted-foreground italic">
        QA becomes available once the ticket is resolved.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold">Quality Assurance</h3>
      </div>

      {/* Existing QA records */}
      {!loading && qa.length > 0 && (
        <div className="space-y-2">
          {qa.map((q) => (
            <div key={q.id} className="glass-panel rounded-md p-3 text-sm">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {q.qa_type === "requester_rating" ? "Requester" : "Admin Review"}
                </Badge>
                {q.rating != null && (
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < q.rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </span>
                )}
                {q.verdict && (
                  <Badge
                    variant="outline"
                    className={
                      q.verdict === "approved"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-orange-500/15 text-orange-400 border-orange-500/30"
                    }
                  >
                    {q.verdict === "approved" ? "Approved" : "Needs Rework"}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(q.created_at).toLocaleString()}
                </span>
              </div>
              {q.comment && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                  {q.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Requester rating form */}
      {isRequester && !myRating && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <Label className="text-xs">Rate this resolution</Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-0.5"
                aria-label={`${n} stars`}
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400/60"
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            rows={2}
            placeholder="Optional comment…"
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            maxLength={1000}
          />
          <Button size="sm" onClick={submitRating} disabled={submittingRating}>
            {submittingRating ? "Submitting…" : "Submit rating"}
          </Button>
        </div>
      )}

      {/* Admin / SME review form */}
      {canAdminReview && !myReview && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <Label className="text-xs">Admin QA review</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={verdict === "approved" ? "default" : "outline"}
              onClick={() => setVerdict("approved")}
              className="gap-1"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant={verdict === "needs_rework" ? "default" : "outline"}
              onClick={() => setVerdict("needs_rework")}
              className="gap-1"
            >
              <AlertTriangle className="w-4 h-4" /> Needs rework
            </Button>
          </div>
          <Textarea
            rows={2}
            placeholder={
              verdict === "needs_rework"
                ? "Why does this need rework? Ticket will be reopened."
                : "Optional QA notes…"
            }
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            maxLength={1000}
          />
          <Button size="sm" onClick={submitReview} disabled={submittingReview}>
            {submittingReview ? "Submitting…" : "Submit QA review"}
          </Button>
        </div>
      )}
    </div>
  );
}