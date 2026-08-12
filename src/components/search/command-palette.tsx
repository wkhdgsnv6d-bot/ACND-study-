"use client";

import { Command } from "cmdk";
import MiniSearch from "minisearch";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { KIND_LABELS, type SearchDocument, type SearchKind } from "@/lib/domain/search";
import { cn } from "@/lib/utils";

/**
 * Command palette — ⌘K / Ctrl+K.
 *
 * The index is fetched once on first open rather than shipped with every page,
 * because it is a few hundred kilobytes that most page views never need. It
 * contains content only: notes and client records are searched through their
 * own authenticated surfaces, never baked into a cacheable response.
 */

const KIND_ORDER: SearchKind[] = [
  "page",
  "lesson",
  "lab",
  "software",
  "template",
  "certification",
  "module",
  "term",
  "skill",
  "glossary",
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<{
    documents: SearchDocument[];
    engine: MiniSearch<SearchDocument> | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (index || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/search-index");
      const data: SearchDocument[] = await response.json();

      const search = new MiniSearch<SearchDocument>({
        fields: ["title", "summary", "body"],
        storeFields: ["title", "summary", "href", "kind"],
        searchOptions: {
          prefix: true,
          fuzzy: 0.2,
          boost: { title: 3, summary: 1.5 },
        },
      });
      search.addAll(data);

      setIndex({ documents: data, engine: search });
    } catch {
      // Search is an accelerator, not a dependency. Failing to load it should
      // never block navigation, so the palette simply shows nothing.
      setIndex({ documents: [], engine: null });
    } finally {
      setLoading(false);
    }
  }, [index, loading]);

  /**
   * Opening loads the index. Doing this from the event that opens the palette,
   * rather than from an effect watching `open`, keeps the fetch where the
   * intent is and avoids a state update cascading out of a render.
   */
  const openPalette = useCallback(() => {
    setOpen(true);
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => {
          if (!value) void load();
          return !value;
        });
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [load]);

  const results = useMemo(() => {
    if (!index) return [];
    if (query.trim().length === 0) {
      return index.documents.filter((d) => d.kind === "page").slice(0, 8);
    }
    if (!index.engine) return [];

    const byId = new Map(index.documents.map((d) => [d.id, d] as const));
    return index.engine
      .search(query, { prefix: true, fuzzy: 0.2 })
      .slice(0, 24)
      .map((result) => byId.get(String(result.id)))
      .filter((d): d is SearchDocument => Boolean(d));
  }, [index, query]);

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: results.filter((r) => r.kind === kind),
  })).filter((g) => g.items.length > 0);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-subtle-foreground transition-colors hover:bg-surface-2 hover:text-muted-foreground"
        aria-label="Search"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border px-1 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <button
            type="button"
            aria-label="Close search"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <Command
            label="Search"
            shouldFilter={false}
            className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search lessons, labs, tools, templates…"
                className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
              />
            </div>

            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {loading ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : null}

              <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                {query.trim().length === 0 ? "Start typing" : "Nothing matches"}
              </Command.Empty>

              {grouped.map((group) => (
                <Command.Group
                  key={group.kind}
                  heading={KIND_LABELS[group.kind]}
                  className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-subtle-foreground [&_[cmdk-group-heading]]:uppercase"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      onSelect={() => go(item.href)}
                      className={cn(
                        "flex cursor-pointer flex-col gap-0.5 rounded-lg px-2.5 py-2",
                        "data-[selected=true]:bg-surface-2",
                      )}
                    >
                      <span className="text-sm">{item.title}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {item.summary}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      ) : null}
    </>
  );
}
