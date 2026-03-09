import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FaTelegram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import type { ChatSource } from "@/hooks/useCopilot";

function SourceIcon({ src }: { src: ChatSource["src"] }) {
  if (src === "Telegram")
    return <FaTelegram className="inline size-3 text-[#26A5E4]" />;
  if (src === "X/Twitter")
    return <FaXTwitter className="inline size-3 text-foreground" />;
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
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Sources: {preview}</span>
        <ChevronDown
          className={`size-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

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
