import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotebookPen } from "lucide-react";

import { PageHeader, StatCard } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { NotesSearch } from "@/components/notes/notes-search";
import { loadCurriculum } from "@/lib/content/loader";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notes" };

export interface NoteRecord {
  id: string;
  scope: "lesson" | "module" | "software" | "project" | "general";
  scopeRef: string | null;
  scopeLabel: string;
  scopeHref: string | null;
  title: string | null;
  bodyMd: string;
  pinned: boolean;
  updatedAt: string;
}

export default async function NotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data, error } = supabase
    ? await supabase
        .from("notes")
        .select("id, scope, scope_ref, title, body_md, pinned, updated_at")
        .eq("user_id", user.id)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
    : { data: [], error: null };

  const { curriculum } = loadCurriculum();

  const notes: NoteRecord[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const scope = r.scope as NoteRecord["scope"];
    const scopeRef = (r.scope_ref as string) ?? null;

    let scopeLabel = "General";
    let scopeHref: string | null = null;

    if (scope === "lesson" && scopeRef) {
      const lesson = curriculum.lessonsByPath.get(scopeRef);
      scopeLabel = lesson?.frontmatter.title ?? scopeRef;
      scopeHref = lesson
        ? `/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}`
        : null;
    } else if (scope === "module" && scopeRef) {
      const mod = curriculum.modulesByPath.get(scopeRef);
      scopeLabel = mod?.frontmatter.title ?? scopeRef;
      scopeHref = mod ? `/course/${mod.termSlug}/${mod.slug}` : null;
    } else if (scope === "software" && scopeRef) {
      scopeLabel = scopeRef;
      scopeHref = `/software/${scopeRef}`;
    } else if (scope === "project") {
      scopeLabel = "Project";
      scopeHref = "/projects";
    }

    return {
      id: r.id as string,
      scope,
      scopeRef,
      scopeLabel,
      scopeHref,
      title: (r.title as string) ?? null,
      bodyMd: (r.body_md as string) ?? "",
      pinned: r.pinned as boolean,
      updatedAt: r.updated_at as string,
    };
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Notes"
        description="Everything you have written down, wherever you wrote it."
      />

      {error ? <ErrorState className="mt-6" description={error.message} /> : null}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Notes" value={notes.length} />
        <StatCard label="Pinned" value={notes.filter((n) => n.pinned).length} />
        <StatCard
          label="On lessons"
          value={notes.filter((n) => n.scope === "lesson").length}
        />
      </section>

      {notes.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={NotebookPen}
          title="No notes yet"
          description="Notes taken while studying appear here. Add them from any lesson."
        />
      ) : (
        <div className="mt-8">
          <NotesSearch notes={notes} />
        </div>
      )}
    </div>
  );
}
