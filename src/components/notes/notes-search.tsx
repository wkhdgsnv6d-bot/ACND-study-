"use client";

import { Pin, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { NoteRecord } from "@/app/(app)/notes/page";
import { Card, CardBody } from "@/components/common/card";
import { EmptyState } from "@/components/common/states";
import { StatusPill } from "@/components/common/status-pill";
import { Input } from "@/components/ui/field";

/**
 * Notes with search.
 *
 * Filtering happens in the browser because the whole set is already loaded and
 * a personal note collection is small. If it ever is not, this becomes a
 * Postgres full-text query — the shape of the component does not change.
 */
export function NotesSearch({ notes }: { notes: NoteRecord[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return notes;
    return notes.filter((note) =>
      [note.title, note.bodyMd, note.scopeLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [notes, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground"
          aria-hidden
        />
        <label htmlFor="note-search" className="sr-only">
          Search notes
        </label>
        <Input
          id="note-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing matches" description="Try a different word." />
      ) : (
        <ul className="space-y-3">
          {filtered.map((note) => (
            <li key={note.id}>
              <Card>
                <CardBody className="py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {note.pinned ? (
                      <Pin className="size-3 shrink-0 text-primary" aria-hidden />
                    ) : null}
                    {note.scopeHref ? (
                      <Link
                        href={note.scopeHref}
                        className="text-xs text-primary hover:underline"
                      >
                        {note.scopeLabel}
                      </Link>
                    ) : (
                      <StatusPill tone="neutral">{note.scopeLabel}</StatusPill>
                    )}
                    <time
                      dateTime={note.updatedAt}
                      className="text-xs text-subtle-foreground"
                    >
                      {new Date(note.updatedAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </div>

                  {note.title ? (
                    <h3 className="mt-1.5 text-sm font-medium">{note.title}</h3>
                  ) : null}

                  <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                    {note.bodyMd}
                  </p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
