/**
 * The twelve skill branches tracked by Ascend Business Mastery.
 *
 * Skill level is *derived*, never set directly. It is the minimum of two
 * independent measures — accumulated XP and accumulated practical evidence —
 * so no amount of reading can push a skill past "Practised". See
 * `src/lib/engines/skills.ts` for the calculation.
 */

export const SKILL_KEYS = [
  "web",
  "crm",
  "automation",
  "ai",
  "api",
  "security",
  "sales",
  "seo",
  "support",
  "voice",
  "operations",
  "leadership",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface SkillDefinition {
  key: SkillKey;
  name: string;
  /** One line the learner sees on the skill tree node. */
  summary: string;
  /** CSS custom-property token defined in globals.css. */
  colorToken: `--skill-${string}`;
  /** Tailwind text colour utility backed by the same token. */
  colorClass: string;
  /** Which term first introduces this branch. Used to lay out the tree. */
  introducedInTerm: 1 | 2 | 3 | 4;
  /** Branches that feed into this one. Rendered as edges in the skill tree. */
  dependsOn: SkillKey[];
}

export const SKILLS: Record<SkillKey, SkillDefinition> = {
  web: {
    key: "web",
    name: "Web Development",
    summary:
      "Building, styling and shipping production websites with React, Next.js and Tailwind.",
    colorToken: "--skill-web",
    colorClass: "text-skill-web",
    introducedInTerm: 1,
    dependsOn: [],
  },
  api: {
    key: "api",
    name: "API Integration",
    summary:
      "Reading documentation, authenticating, calling endpoints, handling errors and wiring webhooks.",
    colorToken: "--skill-api",
    colorClass: "text-skill-api",
    introducedInTerm: 1,
    dependsOn: ["web"],
  },
  crm: {
    key: "crm",
    name: "CRM",
    summary:
      "Modelling contacts, companies, deals and pipelines, then automating the movement between them.",
    colorToken: "--skill-crm",
    colorClass: "text-skill-crm",
    introducedInTerm: 1,
    dependsOn: [],
  },
  automation: {
    key: "automation",
    name: "Automation",
    summary:
      "Designing reliable multi-step workflows with proper error handling, retries and logging.",
    colorToken: "--skill-automation",
    colorClass: "text-skill-automation",
    introducedInTerm: 1,
    dependsOn: ["api"],
  },
  ai: {
    key: "ai",
    name: "AI Engineering",
    summary:
      "Prompting, structured output, tool calling, RAG, evaluation and cost control against real model APIs.",
    colorToken: "--skill-ai",
    colorClass: "text-skill-ai",
    introducedInTerm: 1,
    dependsOn: ["api"],
  },
  security: {
    key: "security",
    name: "Risk & Reliability",
    summary:
      "Protecting credentials and client data, and making sure systems fail safely and visibly.",
    colorToken: "--skill-security",
    colorClass: "text-skill-security",
    introducedInTerm: 1,
    dependsOn: ["api"],
  },
  sales: {
    key: "sales",
    name: "Sales",
    summary:
      "Prospecting, discovery, qualification, scoping, pricing, proposals and closing.",
    colorToken: "--skill-sales",
    colorClass: "text-skill-sales",
    introducedInTerm: 1,
    dependsOn: [],
  },
  seo: {
    key: "seo",
    name: "SEO",
    summary:
      "Search intent, technical health, on-page structure, local presence and honest reporting.",
    colorToken: "--skill-seo",
    colorClass: "text-skill-seo",
    introducedInTerm: 2,
    dependsOn: ["web"],
  },
  support: {
    key: "support",
    name: "AI Customer Service",
    summary:
      "Knowledge bases, intent handling, guardrails, escalation and quality monitoring.",
    colorToken: "--skill-support",
    colorClass: "text-skill-support",
    introducedInTerm: 2,
    dependsOn: ["ai", "crm"],
  },
  voice: {
    key: "voice",
    name: "Voice AI",
    summary:
      "Speech pipelines, latency and turn-taking, telephony, consent, and safe failure paths.",
    colorToken: "--skill-voice",
    colorClass: "text-skill-voice",
    introducedInTerm: 3,
    dependsOn: ["ai", "support"],
  },
  operations: {
    key: "operations",
    name: "Operations",
    summary:
      "Repeatable delivery: SOPs, QA, capacity planning, reporting and incident response.",
    colorToken: "--skill-operations",
    colorClass: "text-skill-operations",
    introducedInTerm: 3,
    dependsOn: ["security"],
  },
  leadership: {
    key: "leadership",
    name: "Leadership",
    summary:
      "Delegation, hiring, finance, accountability and running Ascend as a company.",
    colorToken: "--skill-leadership",
    colorClass: "text-skill-leadership",
    introducedInTerm: 4,
    dependsOn: ["operations", "sales"],
  },
};

export const SKILL_LEVEL_NAMES: Record<SkillLevel, string> = {
  0: "Untrained",
  1: "Foundation",
  2: "Practised",
  3: "Client Ready",
  4: "Advanced",
  5: "Mastered",
};

export const SKILL_LEVEL_DESCRIPTIONS: Record<SkillLevel, string> = {
  0: "No exposure yet.",
  1: "You understand the concepts and can follow a guided example.",
  2: "You have built something with it under instruction.",
  3: "You can do this unsupervised on a paying client's system.",
  4: "You can handle non-standard cases and make architectural calls.",
  5: "You can design, teach and delegate this work with confidence.",
};

export function isSkillKey(value: string): value is SkillKey {
  return (SKILL_KEYS as readonly string[]).includes(value);
}

export function skillsInTerm(term: 1 | 2 | 3 | 4): SkillDefinition[] {
  return SKILL_KEYS.map((k) => SKILLS[k]).filter(
    (s) => s.introducedInTerm <= term,
  );
}
