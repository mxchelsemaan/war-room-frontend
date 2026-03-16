import { useState, useCallback, useRef } from "react";

export interface ChatSource {
  n: number;
  src: "Telegram" | "X/Twitter";
  author: string;
  date: string;
  url: string;
  sim: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

const COPILOT_URL = import.meta.env.VITE_COPILOT_URL ?? "";

export function useCopilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!COPILOT_URL) {
      setError("Coming soon!");
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(COPILOT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          history: historyRef.current,
        }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Rate limit reached. Please wait a moment.");
        return;
      }

      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer ?? "",
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.history) {
        historyRef.current = data.history;
      }
    } catch {
      setError("Could not reach Shifra. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    historyRef.current = [];
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat, setError };
}
