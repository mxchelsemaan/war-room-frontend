import { useState, useRef, useEffect } from "react";
import { Send, Trash2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopilotSources } from "./CopilotSources";
import type { ChatMessage } from "@/hooks/useCopilot";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CopilotChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => void;
  clearChat: () => void;
  setError: (error: string | null) => void;
}

const SUGGESTIONS = [
  "What happened in southern Lebanon today?",
  "Summarize the latest Telegram chatter",
  "Any escalation signals near the Blue Line?",
];

export function CopilotChat({
  messages,
  isLoading,
  error,
  sendMessage,
  clearChat,
  setError,
}: CopilotChatProps) {
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 copilot-scroll">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Ask Shifra anything about the latest intelligence.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl flex flex-col gap-3">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary/10 px-3.5 py-2 text-sm text-foreground">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="copilot-prose rounded-2xl rounded-bl-md bg-muted/50 px-3.5 py-2 text-sm text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <CopilotSources sources={msg.sources} />
                    )}
                  </div>
                </div>
              ),
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-muted/50 px-4 py-3">
                  <div className="flex gap-1 typing-dots">
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-2">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearChat}
            aria-label="Clear chat"
            className="text-muted-foreground"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Ask Shifra..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="text-primary"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
