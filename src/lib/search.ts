import { LABS } from "@/lib/domain/labs";
import { SOFTWARE } from "@/lib/domain/software";
import { TEMPLATES } from "@/lib/domain/templates";
import { CERTIFICATIONS } from "@/lib/domain/certifications";
import { SKILLS, SKILL_KEYS } from "@/lib/domain/skills";
import type { SearchDocument } from "@/lib/domain/search";

/**
 * The searchable surface of the platform.
 *
 * Content-derived documents are built here from the same definitions the pages
 * render, so search can never drift from what actually exists. User data —
 * notes, prospects, projects — is deliberately excluded from this static index
 * and searched separately, because a static index would leak it into a cached
 * response.
 */

const PAGES: SearchDocument[] = [
  { id: "page-dashboard", kind: "page", title: "Dashboard", summary: "Where you are and what to do next", body: "home overview", href: "/dashboard" },
  { id: "page-today", kind: "page", title: "Today", summary: "Your study plan for today", body: "daily plan", href: "/today" },
  { id: "page-review", kind: "page", title: "Review", summary: "Spaced repetition due now", body: "flashcards revision", href: "/review" },
  { id: "page-weekly", kind: "page", title: "Weekly review", summary: "What happened this week", body: "retrospective", href: "/weekly" },
  { id: "page-course", kind: "page", title: "My Course", summary: "Terms, modules and lessons", body: "curriculum", href: "/course" },
  { id: "page-assignments", kind: "page", title: "Assignments", summary: "Practical work across the curriculum", body: "tasks evidence", href: "/assignments" },
  { id: "page-labs", kind: "page", title: "Labs", summary: "Interactive practical labs", body: "exercises", href: "/labs" },
  { id: "page-certifications", kind: "page", title: "Certifications", summary: "Requirements and progress", body: "badges", href: "/certifications" },
  { id: "page-skills", kind: "page", title: "Skill tree", summary: "Twelve branches, levels 0–5", body: "levels", href: "/skills" },
  { id: "page-projects", kind: "page", title: "Projects", summary: "Portfolio and evidence", body: "portfolio", href: "/projects" },
  { id: "page-business", kind: "page", title: "Business Lab", summary: "Pricing, margins, capacity, hiring", body: "calculators", href: "/business" },
  { id: "page-pipeline", kind: "page", title: "Client pipeline", summary: "Prospects from lead to recurring", body: "crm sales deals", href: "/pipeline" },
  { id: "page-validation", kind: "page", title: "Market validation", summary: "Conversations with real businesses", body: "interviews research", href: "/validation" },
  { id: "page-revenue", kind: "page", title: "Revenue", summary: "Revenue, MRR and clients", body: "money invoices", href: "/revenue" },
  { id: "page-software", kind: "page", title: "Software library", summary: "The tools Ascend runs on", body: "tools", href: "/software" },
  { id: "page-templates", kind: "page", title: "Templates", summary: "Checklists and structures", body: "documents", href: "/templates" },
  { id: "page-notes", kind: "page", title: "Notes", summary: "Everything you have written down", body: "notes", href: "/notes" },
  { id: "page-resources", kind: "page", title: "Resources", summary: "References and glossary", body: "links", href: "/resources" },
  { id: "page-progress", kind: "page", title: "Progress", summary: "Detailed analytics", body: "charts stats", href: "/progress" },
  { id: "page-settings", kind: "page", title: "Settings", summary: "Profile, pricing and unlock rules", body: "configuration", href: "/settings" },
];

/**
 * Builds the static index. Server-only — it reads the curriculum from disk.
 * Exposed through a cached route handler so the palette fetches it once.
 */
export async function buildSearchIndex(): Promise<SearchDocument[]> {
  const { buildGlossary, loadCurriculum } = await import("@/lib/content/loader");
  const { curriculum } = loadCurriculum();
  const documents: SearchDocument[] = [...PAGES];

  for (const term of curriculum.terms) {
    documents.push({
      id: term.path,
      kind: "term",
      title: term.frontmatter.title,
      summary: term.frontmatter.summary,
      body: term.frontmatter.objective,
      href: `/course/${term.slug}`,
    });

    for (const mod of term.modules) {
      documents.push({
        id: mod.path,
        kind: "module",
        title: mod.frontmatter.title,
        summary: mod.frontmatter.summary,
        body: mod.frontmatter.objectives.join(" "),
        href: `/course/${term.slug}/${mod.slug}`,
      });

      for (const lesson of mod.lessons) {
        if (lesson.frontmatter.status !== "complete") continue;
        documents.push({
          id: lesson.path,
          kind: "lesson",
          title: lesson.frontmatter.title,
          summary: lesson.frontmatter.summary,
          body: [
            ...lesson.frontmatter.objectives,
            ...lesson.frontmatter.terminology.map((t) => `${t.term} ${t.definition}`),
            ...lesson.frontmatter.commonMistakes.map((m) => m.mistake),
          ].join(" "),
          href: `/course/${lesson.termSlug}/${lesson.moduleSlug}/${lesson.slug}`,
        });
      }
    }
  }

  for (const entry of buildGlossary()) {
    documents.push({
      id: `glossary-${entry.term}-${entry.lessonPath}`,
      kind: "glossary",
      title: entry.term,
      summary: entry.definition,
      body: entry.plainEnglish ?? "",
      href: "/resources",
    });
  }

  for (const lab of LABS) {
    documents.push({
      id: `lab-${lab.id}`,
      kind: "lab",
      title: lab.title,
      summary: lab.summary,
      body: `${lab.brief} ${lab.inoculatesAgainst}`,
      href: `/labs/${lab.id}`,
    });
  }

  for (const tool of SOFTWARE) {
    documents.push({
      id: `software-${tool.key}`,
      kind: "software",
      title: tool.name,
      summary: tool.summary,
      body: [tool.whatItIs, tool.whyAscendUsesIt, tool.ascendUseCase]
        .filter(Boolean)
        .join(" "),
      href: `/software/${tool.key}`,
    });
  }

  for (const template of TEMPLATES) {
    documents.push({
      id: `template-${template.key}`,
      kind: "template",
      title: template.name,
      summary: template.summary,
      body: `${template.rationale} ${template.sections.map((s) => s.heading).join(" ")}`,
      href: `/templates/${template.key}`,
    });
  }

  for (const cert of CERTIFICATIONS) {
    documents.push({
      id: `cert-${cert.key}`,
      kind: "certification",
      title: cert.name,
      summary: cert.tagline,
      body: cert.description,
      href: `/certifications/${cert.key}`,
    });
  }

  for (const key of SKILL_KEYS) {
    documents.push({
      id: `skill-${key}`,
      kind: "skill",
      title: SKILLS[key].name,
      summary: SKILLS[key].summary,
      body: "skill branch level",
      href: "/skills",
    });
  }

  return documents;
}
