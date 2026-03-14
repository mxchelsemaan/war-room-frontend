import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSuccess: () => void;
}

export function ReportModal({ open, onOpenChange, eventId, onSuccess }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (!supabase) throw new Error("Supabase not configured");
      const { error: insertError } = await supabase
        .from("event_reports")
        .insert({ event_id: eventId, reason: reason.trim() || null });
      if (insertError) throw insertError;
      onSuccess();
      onOpenChange(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold">Report Inaccurate Event</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What's inaccurate? (optional)"
          rows={3}
          className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-2xs"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 text-2xs"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
