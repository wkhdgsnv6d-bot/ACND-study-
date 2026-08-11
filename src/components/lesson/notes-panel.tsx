"use client";

import { NotebookPen, Pin, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { deleteNote, saveNote } from "@/app/(app)/course/actions";
import { Card, CardBody, CardHeader } from "@/components/common/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import type { LessonNoteRow } from "@/lib/queries/course";

/**
 * Lesson notes.
 *
 * Deliberately plain: a textarea and a save button. Notes taken while studying
 * are worth nothing if the act of taking them has friction, and a rich editor
 * would be friction. Markdown is preserved as typed and rendered elsewhere.
 */
export function NotesPanel({
  lessonPath,
  revalidate,
  notes,
}: {
  lessonPath: string;
  revalidate: string;
  notes: LessonNoteRow[];
}) {
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave() {
    if (draft.trim().length === 0) return;
    setMessage(null);
    startTransition(async () => {
      const result = await saveNote({
        scope: "lesson",
        scopeRef: lessonPath,
        bodyMd: draft,
        revalidate,
      });
      if (result.ok) {
        setDraft("");
        setMessage("Saved.");
      } else {
        setMessage(result.message);
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteNote(id, revalidate);
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Notes"
        description="Yours, on this lesson. Searchable from the Notes page."
      />
      <CardBody className="space-y-4">
        <div>
          <label htmlFor="lesson-note" className="sr-only">
            New note
          </label>
          <Textarea
            id="lesson-note"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What clicked? What did not?"
            rows={4}
          />
          <div className="mt-2 flex items-center gap-3">
            <Button
              size="sm"
              onClick={onSave}
              disabled={pending || draft.trim().length === 0}
              aria-busy={pending}
            >
              {pending ? "Saving…" : "Save note"}
            </Button>
            {message ? (
              <span
                role="status"
                className="text-xs text-muted-foreground"
              >
                {message}
              </span>
            ) : null}
          </div>
        </div>

        {notes.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-subtle-foreground">
            <NotebookPen className="size-3.5 shrink-0" aria-hidden />
            No notes on this lesson yet.
          </p>
        ) : (
          <ul className="space-y-2 border-t border-border pt-4">
            {notes.map((note) => (
              <li
                key={note.id}
                className="group rounded-lg border border-border bg-surface-2 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap text-muted-foreground">
                    {note.bodyMd}
                  </p>
                  <button
                    type="button"
                    onClick={() => onDelete(note.id)}
                    aria-label="Delete note"
                    className="shrink-0 rounded p-1 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-subtle-foreground">
                  {note.pinned ? <Pin className="size-3" aria-hidden /> : null}
                  <time dateTime={note.updatedAt.toISOString()}>
                    {note.updatedAt.toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
