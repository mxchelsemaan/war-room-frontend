import { Bot, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AISummaryCardProps {
  open: boolean;
  onToggle: () => void;
  date?: string;
}

export function AISummaryCard({ open, onToggle }: AISummaryCardProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onToggle}
        className={`absolute inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        className={`absolute inset-2 md:top-14 md:bottom-4 md:left-[136px] md:right-[136px] z-[60] flex flex-col glass-panel overflow-hidden transition-all duration-300 ease-out ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {/* Close button */}
        <div className="absolute top-2 right-2 z-10">
          <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <Bot className="size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground/50">Ask Shifra anything about the latest intelligence.</p>
          </div>
          <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-2">
            <Input
              disabled
              placeholder="Coming soon..."
              className="flex-1 border-0 bg-transparent shadow-none text-sm text-muted-foreground/50 placeholder:text-muted-foreground/30 focus-visible:ring-0"
            />
            <Button variant="ghost" size="icon-sm" disabled aria-label="Send message" className="text-muted-foreground/30">
              <Send className="size-4" />
            </Button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="shrink-0 border-t border-border px-5 py-2.5">
          <p className="text-2xs leading-relaxed text-destructive/80 max-w-2xl mx-auto">
            ⚠ AI-generated. May contain inaccuracies — verify against primary sources before operational use.
          </p>
        </div>
      </div>
    </>
  );
}
