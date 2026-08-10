import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";
import { z } from "zod";

import {
  lessonFrontmatter,
  moduleFrontmatter,
  termFrontmatter,
} from "@/lib/content/schema";
import type {
  ContentIssue,
  Curriculum,
  LessonNode,
  ModuleNode,
  SearchDoc,
  TermNode,
  TermNumber,
} from "@/lib/content/types";

/**
 * Filesystem-backed curriculum loader.
 *
 * Content lives as MDX under `content/`, not in the database. The reasoning is
 * in docs/ARCHITECTURE.md, but in short: lessons are reviewable in a diff,
 * editable without a CMS, and impossible to desynchronise from a seed script.
 * The database stores only *your state* — progress, notes, submissions.
 *
 * Every lesson page is statically generated, so these disk reads happen at
 * build time. `next.config.ts` also traces `content/**` into the deployment
 * bundle so any dynamic render still resolves.
 */

export const CONTENT_ROOT = join(process.cwd(), "content");
const TERMS_ROOT = join(CONTENT_ROOT, "terms");

const TERM_DIR = /^term-([1-4])$/;
const ORDERED_DIR = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const ORDERED_FILE = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/;

const MODULE_FILE = "_module.mdx";
const TERM_FILE = "_term.mdx";

export interface LoadResult {
  curriculum: Curriculum;
  issues: ContentIssue[];
}

let cached: LoadResult | null = null;

/** Loads and validates the whole curriculum. Memoised per process. */
export function loadCurriculum(): LoadResult {
  if (cached) return cached;
  cached = loadCurriculumUncached();
  return cached;
}

/** Escape hatch for the content:check script, which must not see stale data. */
export function loadCurriculumUncached(): LoadResult {
  const issues: ContentIssue[] = [];
  const terms: TermNode[] = [];

  if (!existsSync(TERMS_ROOT)) {
    return {
      curriculum: emptyCurriculum(),
      issues: [
        {
          file: "content/terms",
          message:
            "content/terms does not exist yet — no curriculum to load. Create content/terms/term-1/_term.mdx to begin.",
          severity: "warning",
        },
      ],
    };
  }

  for (const termDir of readSortedDirs(TERMS_ROOT)) {
    const termMatch = TERM_DIR.exec(termDir);
    if (!termMatch) {
      issues.push({
        file: `content/terms/${termDir}`,
        message: "directory must be named term-1 … term-4",
        severity: "error",
      });
      continue;
    }
    const number = Number(termMatch[1]) as TermNumber;
    const termPath = join(TERMS_ROOT, termDir);
    const termFile = join(termPath, TERM_FILE);

    if (!existsSync(termFile)) {
      issues.push({
        file: `content/terms/${termDir}/${TERM_FILE}`,
        message: `missing ${TERM_FILE}`,
        severity: "error",
      });
      continue;
    }

    const parsedTerm = parseFrontmatter(termFile, termFrontmatter, issues);
    if (!parsedTerm) continue;

    const term: TermNode = {
      path: termDir,
      slug: termDir,
      number,
      filePath: termFile,
      frontmatter: parsedTerm,
      modules: [],
    };

    for (const moduleDir of readSortedDirs(termPath)) {
      const moduleMatch = ORDERED_DIR.exec(moduleDir);
      if (!moduleMatch) {
        issues.push({
          file: `content/terms/${termDir}/${moduleDir}`,
          message:
            "module directories must be named `NN-kebab-slug`, e.g. 01-agency-foundations",
          severity: "error",
        });
        continue;
      }
      const moduleOrder = Number(moduleMatch[1]);
      const moduleSlug = moduleMatch[2]!;
      const moduleDirPath = join(termPath, moduleDir);
      const moduleFile = join(moduleDirPath, MODULE_FILE);

      if (!existsSync(moduleFile)) {
        issues.push({
          file: `content/terms/${termDir}/${moduleDir}/${MODULE_FILE}`,
          message: `missing ${MODULE_FILE}`,
          severity: "error",
        });
        continue;
      }

      const parsedModule = parseFrontmatter(moduleFile, moduleFrontmatter, issues);
      if (!parsedModule) continue;

      const mod: ModuleNode = {
        path: `${termDir}/${moduleSlug}`,
        slug: moduleSlug,
        termNumber: number,
        termSlug: termDir,
        order: moduleOrder,
        filePath: moduleFile,
        frontmatter: parsedModule,
        lessons: [],
      };

      for (const lessonFile of readSortedFiles(moduleDirPath)) {
        if (lessonFile.startsWith("_")) continue;
        const lessonMatch = ORDERED_FILE.exec(lessonFile);
        if (!lessonMatch) {
          issues.push({
            file: `content/terms/${termDir}/${moduleDir}/${lessonFile}`,
            message:
              "lesson files must be named `NN-kebab-slug.mdx`, e.g. 03-rest-and-http-methods.mdx",
            severity: "error",
          });
          continue;
        }
        const lessonOrder = Number(lessonMatch[1]);
        const lessonSlug = lessonMatch[2]!;
        const absolute = join(moduleDirPath, lessonFile);

        const raw = readFileSync(absolute, "utf8");
        const { data, content } = matter(raw);
        const parsed = lessonFrontmatter.safeParse(data);
        if (!parsed.success) {
          issues.push(...zodIssues(absolute, parsed.error));
          continue;
        }

        mod.lessons.push({
          path: `${termDir}/${moduleSlug}/${lessonSlug}`,
          slug: lessonSlug,
          termNumber: number,
          termSlug: termDir,
          moduleSlug,
          order: lessonOrder,
          filePath: absolute,
          frontmatter: parsed.data,
          wordCount: countWords(content),
        });
      }

      mod.lessons.sort((a, b) => a.order - b.order);
      term.modules.push(mod);
    }

    term.modules.sort((a, b) => a.order - b.order);
    terms.push(term);
  }

  terms.sort((a, b) => a.number - b.number);

  const curriculum = indexCurriculum(terms);
  issues.push(...validateGraph(curriculum));

  return { curriculum, issues };
}

/* ------------------------------------------------------------------ */
/* Indexing and cross-file validation                                  */
/* ------------------------------------------------------------------ */

function indexCurriculum(terms: TermNode[]): Curriculum {
  const lessonsByPath = new Map<string, LessonNode>();
  const modulesByPath = new Map<string, ModuleNode>();
  const lessonOrder: string[] = [];

  for (const term of terms) {
    for (const mod of term.modules) {
      modulesByPath.set(mod.path, mod);
      for (const lesson of mod.lessons) {
        lessonsByPath.set(lesson.path, lesson);
        lessonOrder.push(lesson.path);
      }
    }
  }

  return { terms, lessonsByPath, modulesByPath, lessonOrder };
}

/**
 * Cross-file checks the per-file schema cannot do: dangling references and
 * prerequisite cycles. A cycle would make a lesson permanently unreachable,
 * so it is an error rather than a warning.
 */
function validateGraph(curriculum: Curriculum): ContentIssue[] {
  const issues: ContentIssue[] = [];

  for (const [path, lesson] of curriculum.lessonsByPath) {
    for (const prereq of lesson.frontmatter.prerequisites) {
      if (!curriculum.lessonsByPath.has(prereq)) {
        issues.push({
          file: lesson.filePath,
          message: `prerequisite "${prereq}" does not resolve to a lesson`,
          severity: "error",
        });
      }
      if (prereq === path) {
        issues.push({
          file: lesson.filePath,
          message: "lesson lists itself as a prerequisite",
          severity: "error",
        });
      }
    }

    // A lesson marked complete but carrying no assessment cannot contribute to
    // any certification, which is almost always an authoring oversight.
    const fm = lesson.frontmatter;
    if (
      fm.status === "complete" &&
      fm.quiz.length === 0 &&
      !fm.practicalTask &&
      fm.labs.length === 0
    ) {
      issues.push({
        file: lesson.filePath,
        message:
          "lesson is marked complete but has no quiz, lab or practical task — nothing proves it was understood",
        severity: "warning",
      });
    }

    if (fm.status === "complete" && lesson.wordCount < 400) {
      issues.push({
        file: lesson.filePath,
        message: `lesson is marked complete but only ${lesson.wordCount} words — mark it draft until it actually teaches the topic`,
        severity: "warning",
      });
    }
  }

  for (const [path, mod] of curriculum.modulesByPath) {
    for (const prereq of mod.frontmatter.prerequisites) {
      if (!curriculum.modulesByPath.has(prereq)) {
        issues.push({
          file: mod.filePath,
          message: `prerequisite module "${prereq}" does not resolve`,
          severity: "error",
        });
      }
      if (prereq === path) {
        issues.push({
          file: mod.filePath,
          message: "module lists itself as a prerequisite",
          severity: "error",
        });
      }
    }
  }

  issues.push(...detectCycles(curriculum));
  issues.push(...detectDuplicateQuestionIds(curriculum));

  return issues;
}

function detectCycles(curriculum: Curriculum): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const state = new Map<string, "visiting" | "done">();

  const visit = (path: string, trail: string[]): void => {
    const current = state.get(path);
    if (current === "done") return;
    if (current === "visiting") {
      const lesson = curriculum.lessonsByPath.get(path);
      issues.push({
        file: lesson?.filePath ?? path,
        message: `prerequisite cycle: ${[...trail, path].join(" → ")}`,
        severity: "error",
      });
      return;
    }
    state.set(path, "visiting");
    const lesson = curriculum.lessonsByPath.get(path);
    for (const prereq of lesson?.frontmatter.prerequisites ?? []) {
      if (curriculum.lessonsByPath.has(prereq)) {
        visit(prereq, [...trail, path]);
      }
    }
    state.set(path, "done");
  };

  for (const path of curriculum.lessonsByPath.keys()) visit(path, []);
  return issues;
}

/**
 * Question ids must be unique within a module, because module exams sample
 * across all of a module's lesson quizzes into one attempt.
 */
function detectDuplicateQuestionIds(curriculum: Curriculum): ContentIssue[] {
  const issues: ContentIssue[] = [];

  for (const mod of curriculum.modulesByPath.values()) {
    const seen = new Map<string, string>();
    const record = (id: string, file: string) => {
      const previous = seen.get(id);
      if (previous) {
        issues.push({
          file,
          message: `duplicate question id "${id}" within module ${mod.path} (also in ${previous})`,
          severity: "error",
        });
        return;
      }
      seen.set(id, file);
    };

    for (const lesson of mod.lessons) {
      for (const q of lesson.frontmatter.quiz) record(q.id, lesson.filePath);
    }
    for (const q of mod.frontmatter.exam?.questions ?? []) {
      record(q.id, mod.filePath);
    }
  }

  return issues;
}

/* ------------------------------------------------------------------ */
/* Reading individual files                                            */
/* ------------------------------------------------------------------ */

export interface LessonSource {
  lesson: LessonNode;
  /** Raw MDX body with frontmatter stripped. */
  body: string;
}

export function getLessonSource(path: string): LessonSource | null {
  const { curriculum } = loadCurriculum();
  const lesson = curriculum.lessonsByPath.get(path);
  if (!lesson) return null;
  const { content } = matter(readFileSync(lesson.filePath, "utf8"));
  return { lesson, body: content };
}

export function getModuleSource(
  path: string,
): { module: ModuleNode; body: string } | null {
  const { curriculum } = loadCurriculum();
  const mod = curriculum.modulesByPath.get(path);
  if (!mod) return null;
  const { content } = matter(readFileSync(mod.filePath, "utf8"));
  return { module: mod, body: content };
}

export function getTermSource(
  slug: string,
): { term: TermNode; body: string } | null {
  const { curriculum } = loadCurriculum();
  const term = curriculum.terms.find((t) => t.slug === slug);
  if (!term) return null;
  const { content } = matter(readFileSync(term.filePath, "utf8"));
  return { term, body: content };
}

/* ------------------------------------------------------------------ */
/* Derived views                                                       */
/* ------------------------------------------------------------------ */

export function getAdjacentLessons(path: string): {
  previous: LessonNode | null;
  next: LessonNode | null;
} {
  const { curriculum } = loadCurriculum();
  const index = curriculum.lessonOrder.indexOf(path);
  if (index === -1) return { previous: null, next: null };
  const previousPath = index > 0 ? curriculum.lessonOrder[index - 1] : undefined;
  const nextPath = curriculum.lessonOrder[index + 1];
  return {
    previous: previousPath ? (curriculum.lessonsByPath.get(previousPath) ?? null) : null,
    next: nextPath ? (curriculum.lessonsByPath.get(nextPath) ?? null) : null,
  };
}

/** Flat searchable documents. Consumed by the command palette's lazy index. */
export function buildSearchDocs(): SearchDoc[] {
  const { curriculum } = loadCurriculum();
  const docs: SearchDoc[] = [];

  for (const term of curriculum.terms) {
    docs.push({
      id: term.path,
      kind: "term",
      title: term.frontmatter.title,
      summary: term.frontmatter.summary,
      body: term.frontmatter.objective,
      href: `/course/${term.slug}`,
      termNumber: term.number,
      status: term.frontmatter.status,
    });

    for (const mod of term.modules) {
      docs.push({
        id: mod.path,
        kind: "module",
        title: mod.frontmatter.title,
        summary: mod.frontmatter.summary,
        body: mod.frontmatter.objectives.join(" "),
        href: `/course/${term.slug}/${mod.slug}`,
        termNumber: term.number,
        status: mod.frontmatter.status,
      });

      for (const lesson of mod.lessons) {
        const fm = lesson.frontmatter;
        docs.push({
          id: lesson.path,
          kind: "lesson",
          title: fm.title,
          summary: fm.summary,
          body: [
            ...fm.objectives,
            ...fm.terminology.map((t) => `${t.term} ${t.definition}`),
            ...fm.commonMistakes.map((m) => m.mistake),
          ].join(" "),
          href: `/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}`,
          termNumber: term.number,
          status: fm.status,
        });
      }
    }
  }

  return docs;
}

/** Every terminology entry across the curriculum, for the glossary and search. */
export function buildGlossary(): Array<{
  term: string;
  definition: string;
  plainEnglish?: string;
  lessonPath: string;
  lessonTitle: string;
}> {
  const { curriculum } = loadCurriculum();
  const entries: ReturnType<typeof buildGlossary> = [];

  for (const lesson of curriculum.lessonsByPath.values()) {
    for (const entry of lesson.frontmatter.terminology) {
      entries.push({
        term: entry.term,
        definition: entry.definition,
        plainEnglish: entry.plainEnglish,
        lessonPath: lesson.path,
        lessonTitle: lesson.frontmatter.title,
      });
    }
  }

  return entries.sort((a, b) => a.term.localeCompare(b.term));
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function emptyCurriculum(): Curriculum {
  return {
    terms: [],
    lessonsByPath: new Map(),
    modulesByPath: new Map(),
    lessonOrder: [],
  };
}

function readSortedDirs(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isDirectory())
    .sort();
}

function readSortedFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdx") && statSync(join(dir, name)).isFile())
    .sort();
}

function parseFrontmatter<T extends z.ZodType>(
  file: string,
  schema: T,
  issues: ContentIssue[],
): z.infer<T> | null {
  const { data } = matter(readFileSync(file, "utf8"));
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    issues.push(...zodIssues(file, parsed.error));
    return null;
  }
  return parsed.data;
}

function zodIssues(file: string, error: z.ZodError): ContentIssue[] {
  return error.issues.map((issue) => ({
    file,
    message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    severity: "error" as const,
  }));
}

function countWords(text: string): number {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
