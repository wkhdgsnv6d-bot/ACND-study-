import type {
  LessonFrontmatter,
  ModuleFrontmatter,
  TermFrontmatter,
} from "@/lib/content/schema";

/**
 * The shape of the curriculum after the filesystem has been walked and every
 * frontmatter block validated. Ordering comes from numeric filename prefixes
 * (`01-`, `02-`…), which are stripped from the public slug — so reordering a
 * module is a file rename, not a registry edit, and the two can never drift.
 */

export type TermNumber = 1 | 2 | 3 | 4;

export interface LessonNode {
  /** `term-1/agency-foundations/what-an-agency-does` — stable public identity. */
  path: string;
  slug: string;
  termNumber: TermNumber;
  termSlug: string;
  moduleSlug: string;
  /** Position within the module, 1-based, derived from the filename prefix. */
  order: number;
  /** Absolute path on disk. Used to read the MDX body. */
  filePath: string;
  frontmatter: LessonFrontmatter;
  /** Rough reading time from the body, as a sanity check on `duration`. */
  wordCount: number;
}

export interface ModuleNode {
  /** `term-1/agency-foundations` */
  path: string;
  slug: string;
  termNumber: TermNumber;
  termSlug: string;
  order: number;
  filePath: string;
  frontmatter: ModuleFrontmatter;
  lessons: LessonNode[];
}

export interface TermNode {
  /** `term-1` */
  path: string;
  slug: string;
  number: TermNumber;
  filePath: string;
  frontmatter: TermFrontmatter;
  modules: ModuleNode[];
}

export interface Curriculum {
  terms: TermNode[];
  /** Flat index for O(1) lookup by path. */
  lessonsByPath: Map<string, LessonNode>;
  modulesByPath: Map<string, ModuleNode>;
  /** Reading order across the whole program — powers "next lesson" and Today. */
  lessonOrder: string[];
}

/** A validation problem found while loading content. */
export interface ContentIssue {
  file: string;
  message: string;
  severity: "error" | "warning";
}

export interface SearchDoc {
  id: string;
  kind: "lesson" | "module" | "term" | "term-glossary";
  title: string;
  summary: string;
  /** Concatenated searchable text: objectives, terminology, key headings. */
  body: string;
  href: string;
  termNumber: TermNumber;
  status: LessonFrontmatter["status"];
}
