"use client";

import { Sparkles, Send, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/common/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * The study assistant.
 *
 * Conversations are not persisted. That is a decision, not an omission: a
 * transcript would be one more thing to secure and to export, and the value of
 * this surface is in the moment of being stuck, not in a history nobody rereads.
 * The Notes panel is where something worth keeping should go, in the operator's
 * own words — which is also better for remembering it.
 */

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Explain this lesson as if I have to teach it to a client.",
  "What is the most common way people get this wrong?",
  "Where would this break in production?",
];

export function AssistantPanel({
  configured,
  lessonPath,
  lessonTitle,
}: {
  configured: boolean;
  lessonPath?: string;
  lessonTitle?: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (question.length === 0 || streaming) return;

      setError(null);
      setDraft("");

      const history: Turn[] = [...turns, { role: "user", content: question }];
      setTurns([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history, lessonPath }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.error ?? "The assistant is unavailable.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setTurns((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (last) next[next.length - 1] = { ...last, content: last.content + chunk };
            return next;
          });
        }
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") {
          // Stopping is a deliberate action, not a failure.
        } else {
          setError(
            caught instanceof Error ? caught.message : "Something went wrong.",
          );
          setTurns((current) => current.slice(0, -1));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [lessonPath, streaming, turns],
  );

  if (!configured) {
    return (
      <Card>
        <CardHeader
          title="Study assistant"
          description="Not configured — everything else on this page works without it."
        />
        <CardBody>
          <p className="text-sm text-muted-foreground">
            Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> in the
            environment to enable it. It explains concepts, pushes back on
            reasoning and reviews your work — it will not answer knowledge checks
            or write your practical tasks, because a certification here is
            supposed to mean something.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Study assistant"
        description={
          lessonTitle
            ? `Knows this lesson. Ask it to explain, not to answer for you.`
            : "Ask about anything in the curriculum."
        }
      />
      <CardBody className="space-y-4">
        {turns.length === 0 ? (
          <div className="space-y-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="flex w-full items-start gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">{suggestion}</span>
              </button>
            ))}
          </div>
        ) : (
          <ol className="space-y-4">
            {turns.map((turn, index) => (
              <li
                key={index}
                className={cn(
                  "min-w-0 text-sm",
                  turn.role === "user"
                    ? "rounded-lg bg-surface-2 px-3 py-2"
                    : "whitespace-pre-wrap text-muted-foreground",
                )}
              >
                {turn.role === "assistant" && turn.content.length === 0 ? (
                  <span className="text-subtle-foreground">Thinking…</span>
                ) : (
                  turn.content
                )}
              </li>
            ))}
          </ol>
        )}

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div>
          <label htmlFor="assistant-input" className="sr-only">
            Ask the study assistant
          </label>
          <Textarea
            id="assistant-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void send(draft);
              }
            }}
            placeholder="What is not clicking?"
            rows={3}
          />
          <div className="mt-2 flex items-center gap-2">
            {streaming ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => abortRef.current?.abort()}
              >
                <Square className="size-3.5" aria-hidden />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => void send(draft)}
                disabled={draft.trim().length === 0}
              >
                <Send className="size-3.5" aria-hidden />
                Ask
              </Button>
            )}
            <span className="text-xs text-subtle-foreground">⌘↵ to send</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
