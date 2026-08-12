/**
 * The shape of the search index.
 *
 * Deliberately separated from the builder in `lib/search.ts`. The builder reads
 * MDX off disk and therefore imports `node:fs`; the command palette needs the
 * kind labels to render groups. If both lived in one module, importing the
 * labels from a `"use client"` component would drag `node:fs` into the browser
 * bundle and fail the production build. Types and constants here, I/O there.
 */

export type SearchKind =
  | "lesson"
  | "module"
  | "term"
  | "lab"
  | "software"
  | "template"
  | "certification"
  | "skill"
  | "glossary"
  | "page";

export interface SearchDocument {
  id: string;
  kind: SearchKind;
  title: string;
  summary: string;
  /** Extra searchable text that is not displayed. */
  body: string;
  href: string;
}

export const KIND_LABELS: Record<SearchKind, string> = {
  lesson: "Lesson",
  module: "Module",
  term: "Term",
  lab: "Lab",
  software: "Software",
  template: "Template",
  certification: "Certification",
  skill: "Skill",
  glossary: "Term",
  page: "Page",
};
