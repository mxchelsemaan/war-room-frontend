import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatSource } from "@/hooks/useCopilot";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 496 512" fill="currentColor" className={className}>
      <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm115 168l-41 193c-3 13-11 16-23 10l-64-47-31 30c-3 3-6 6-13 6l5-65 120-108c5-5-1-7-8-3L155 310l-62-19c-14-4-14-14 3-20l242-93c11-4 21 3 17 20l-1-2z"/>
    </svg>
  );
}

function XTwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className}>
      <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"/>
    </svg>
  );
}

function SourceIcon({ src }: { src: ChatSource["src"] }) {
  if (src === "Telegram")
    return <TelegramIcon className="inline size-3 text-[#26A5E4]" />;
  if (src === "X/Twitter")
    return <XTwitterIcon className="inline size-3 text-foreground" />;
  return null;
}

interface CopilotSourcesProps {
  sources: ChatSource[];
}

export function CopilotSources({ sources }: CopilotSourcesProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  const preview =
    sources.length <= 2
      ? sources.map((s) => s.author).join(", ")
      : `${sources[0].author}, ${sources[1].author}, and ${sources.length - 2} more`;

  return (
    <div className="mt-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded((v) => !v)}
        className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-foreground gap-1"
      >
        <span>Sources: {preview}</span>
        <ChevronDown
          className={`size-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </Button>

      {expanded && (
        <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-primary/30 pl-3">
          {sources.map((s) => (
            <li key={s.n} className="text-xs text-muted-foreground flex items-center gap-1">
              <SourceIcon src={s.src} />
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary/80 hover:text-primary hover:underline"
                >
                  {s.author}
                </a>
              ) : (
                <span>{s.author}</span>
              )}
              <span className="mx-1">·</span>
              <span>{s.date}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
