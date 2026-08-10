import type { CertificationDefinition } from "@/lib/engines/certification";

/**
 * The twelve Ascend certifications.
 *
 * Two deliberate design decisions are encoded here:
 *
 * 1. No certification can be satisfied by `lessons-complete` alone. Every one
 *    carries at least one practical requirement.
 * 2. The `ascend-operator` milestone requires a real client, real delivery and
 *    real payment — but SEO and AI Customer Service sit *alongside* those, not
 *    before them. Landing client #1 is never gated behind a Term 2 badge.
 */

export const CERTIFICATIONS: CertificationDefinition[] = [
  /* ---------------------------------------------------------------- */
  /* Term 1 — technical                                               */
  /* ---------------------------------------------------------------- */
  {
    key: "website-developer",
    name: "Website Developer",
    tagline: "You can build and ship a professional website unsupervised.",
    description:
      "Covers how the web actually works, the modern React/Next.js toolchain, responsive and accessible layouts, forms, performance, and getting a site onto a real domain with SSL.",
    term: 1,
    skill: "web",
    requirements: [
      {
        kind: "lessons-complete",
        modules: [
          "term-1/web-foundations",
          "term-1/development-workflow",
          "term-1/modern-website-development",
          "term-1/domains-dns-deployment",
        ],
      },
      { kind: "exam-passed", examId: "term-1/modern-website-development", passMark: 80 },
      { kind: "labs-solved", labs: ["fix-broken-dns", "debug-website-layout"] },
      { kind: "assignments-approved", assignments: ["t1-build-service-site"] },
      {
        kind: "project-submitted",
        skills: ["web"],
        requiresEvidence: ["repo-url", "live-url"],
      },
      { kind: "skill-at-least", skill: "web", level: 3 },
    ],
  },
  {
    key: "crm-builder",
    name: "CRM Builder",
    tagline: "You can model a business's sales process and build it in a CRM.",
    description:
      "Contacts, companies, deals, pipelines, lifecycle stages, properties and automations — plus the judgement of which CRM suits which client.",
    term: 1,
    skill: "crm",
    requirements: [
      {
        kind: "lessons-complete",
        modules: ["term-1/crm-fundamentals", "term-1/database-fundamentals"],
      },
      { kind: "exam-passed", examId: "term-1/crm-fundamentals", passMark: 80 },
      { kind: "labs-solved", labs: ["design-crm-pipeline", "design-database-schema"] },
      { kind: "assignments-approved", assignments: ["t1-build-ascend-pipeline"] },
      { kind: "skill-at-least", skill: "crm", level: 3 },
    ],
  },
  {
    key: "automation-builder",
    name: "Automation Builder",
    tagline: "You can build a workflow that survives contact with reality.",
    description:
      "Triggers, actions, routers, data mapping and — the part that separates hobby automations from client ones — error handling, retries, idempotency, logging and human escalation.",
    term: 1,
    skill: "automation",
    requirements: [
      {
        kind: "lessons-complete",
        modules: ["term-1/apis-and-webhooks", "term-1/automation-foundations"],
      },
      { kind: "exam-passed", examId: "term-1/automation-foundations", passMark: 80 },
      {
        kind: "labs-solved",
        labs: ["map-json-payload", "debug-api-response", "build-webhook-flow", "fix-failed-automation"],
      },
      { kind: "assignments-approved", assignments: ["t1-lead-intake-automation"] },
      { kind: "skill-at-least", skill: "automation", level: 3 },
      { kind: "skill-at-least", skill: "api", level: 3 },
    ],
  },
  {
    key: "ai-automation-builder",
    name: "AI Automation Builder",
    tagline: "You can put a language model inside a workflow safely.",
    description:
      "Model APIs versus chat apps, structured output, tool calling, prompt injection, hallucination containment, cost control, and knowing when a deterministic rule beats an LLM.",
    term: 1,
    skill: "ai",
    requirements: [
      {
        kind: "lessons-complete",
        modules: ["term-1/ai-fundamentals", "term-1/ai-automation"],
      },
      { kind: "exam-passed", examId: "term-1/ai-automation", passMark: 80 },
      {
        kind: "labs-solved",
        labs: ["build-ai-prompt", "evaluate-hallucinated-output", "design-human-escalation"],
      },
      { kind: "assignments-approved", assignments: ["t1-ai-lead-qualification"] },
      {
        kind: "project-submitted",
        skills: ["ai", "automation"],
        requiresEvidence: ["repo-url", "written"],
      },
      { kind: "skill-at-least", skill: "ai", level: 3 },
    ],
  },
  {
    key: "risk-and-reliability",
    name: "Risk & Reliability",
    tagline: "Your client systems fail safely, visibly and recoverably.",
    description:
      "Credential handling, least privilege, Australian Privacy Principles awareness, backups, monitoring, retry strategy, disaster recovery, and a written failure plan for every system you ship.",
    term: 1,
    skill: "security",
    requirements: [
      {
        kind: "lessons-complete",
        modules: ["term-1/risk-reliability-security", "term-1/testing-and-qa"],
      },
      { kind: "exam-passed", examId: "term-1/risk-reliability-security", passMark: 85 },
      { kind: "labs-solved", labs: ["identify-exposed-api-key", "design-human-escalation"] },
      { kind: "assignments-approved", assignments: ["t1-failure-plan", "t1-qa-checklists"] },
      { kind: "skill-at-least", skill: "security", level: 3 },
    ],
  },
  {
    key: "technical-client-ready",
    name: "Ascend Technical Client Ready",
    tagline: "You can safely build core systems for a paying business.",
    description:
      "The Term 1 milestone. Proves competence across website development, CRM, AI automation, risk and reliability, testing, deployment and documentation — plus evidence that you have talked to real businesses about real problems.",
    term: 1,
    skill: null,
    requirements: [
      { kind: "certification-earned", certification: "website-developer" },
      { kind: "certification-earned", certification: "crm-builder" },
      { kind: "certification-earned", certification: "automation-builder" },
      { kind: "certification-earned", certification: "ai-automation-builder" },
      { kind: "certification-earned", certification: "risk-and-reliability" },
      {
        kind: "business-milestone",
        milestone: "five-validation-interviews",
        label: "Complete 5 market-validation conversations with real businesses",
      },
      {
        kind: "project-submitted",
        skills: ["web", "crm", "automation", "ai"],
        requiresEvidence: ["repo-url", "live-url", "written"],
        minCount: 1,
      },
      { kind: "assignments-approved", assignments: ["t1-capstone"] },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Term 2 — selling and operating                                   */
  /* ---------------------------------------------------------------- */
  {
    key: "seo",
    name: "SEO",
    tagline: "You can improve a client's organic visibility without tricks.",
    description:
      "Search intent, keyword research, technical health, on-page structure, schema, Search Console, local SEO and Google Business Profile, Core Web Vitals, and reporting that survives scrutiny.",
    term: 2,
    skill: "seo",
    requirements: [
      { kind: "lessons-complete", modules: ["term-2/seo"] },
      { kind: "exam-passed", examId: "term-2/seo", passMark: 80 },
      { kind: "labs-solved", labs: ["audit-page-seo", "fix-technical-seo-issues"] },
      { kind: "assignments-approved", assignments: ["t2-seo-audit"] },
      { kind: "skill-at-least", skill: "seo", level: 3 },
    ],
  },
  {
    key: "ai-customer-service",
    name: "AI Customer Service",
    tagline: "You can deploy support AI that knows when to hand over.",
    description:
      "Knowledge bases and RAG, intent handling, ticket classification, guardrails, hallucination control, sensitive requests, human handoff, and integration with CRM and helpdesk.",
    term: 2,
    skill: "support",
    requirements: [
      { kind: "lessons-complete", modules: ["term-2/ai-customer-service"] },
      { kind: "exam-passed", examId: "term-2/ai-customer-service", passMark: 80 },
      {
        kind: "labs-solved",
        labs: ["design-escalation-rules", "evaluate-support-answers"],
      },
      { kind: "assignments-approved", assignments: ["t2-support-assistant"] },
      {
        kind: "project-submitted",
        skills: ["support"],
        requiresEvidence: ["written", "screenshot"],
      },
      { kind: "skill-at-least", skill: "support", level: 3 },
    ],
  },
  {
    key: "ascend-operator",
    name: "Ascend Operator",
    tagline: "You have turned technical ability into collected revenue.",
    description:
      "The Term 2 milestone. Requires a real client, delivered work, money in the bank and documentation the client can actually use — alongside the SEO and AI Customer Service certifications.",
    term: 2,
    skill: null,
    requirements: [
      {
        kind: "business-milestone",
        milestone: "first-client-won",
        label: "Sign your first real client",
      },
      {
        kind: "business-milestone",
        milestone: "first-project-delivered",
        label: "Deliver the work to the client's satisfaction",
      },
      {
        kind: "business-milestone",
        milestone: "first-payment-collected",
        label: "Collect payment",
      },
      { kind: "assignments-approved", assignments: ["t2-client-documentation", "t2-sales-process"] },
      {
        kind: "lessons-complete",
        modules: [
          "term-2/sales-fundamentals",
          "term-2/discovery",
          "term-2/scoping",
          "term-2/pricing",
          "term-2/proposals",
          "term-2/contracts-and-onboarding",
          "term-2/client-communication",
          "term-2/project-management",
        ],
      },
      { kind: "certification-earned", certification: "seo" },
      { kind: "certification-earned", certification: "ai-customer-service" },
      { kind: "skill-at-least", skill: "sales", level: 3 },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Term 3 — growth systems                                          */
  /* ---------------------------------------------------------------- */
  {
    key: "voice-ai",
    name: "Voice AI",
    tagline: "You can put an AI on a phone line without causing an incident.",
    description:
      "Speech pipelines, latency and turn-taking, interruption handling, telephony and call routing, CRM integration, disclosure and recording consent, emergencies, and human handoff.",
    term: 3,
    skill: "voice",
    requirements: [
      { kind: "lessons-complete", modules: ["term-3/voice-ai"] },
      { kind: "exam-passed", examId: "term-3/voice-ai", passMark: 85 },
      {
        kind: "labs-solved",
        labs: ["debug-voice-workflow", "design-call-escalation", "write-disclosure-script"],
      },
      { kind: "assignments-approved", assignments: ["t3-voice-receptionist"] },
      {
        kind: "project-submitted",
        skills: ["voice"],
        requiresEvidence: ["written", "screenshot"],
      },
      { kind: "skill-at-least", skill: "voice", level: 3 },
    ],
  },
  {
    key: "growth-ready",
    name: "Ascend Growth Ready",
    tagline: "Ascend is a repeatable system, not a set of one-off favours.",
    description:
      "The Term 3 milestone. A productised offer, a repeatable sales process, recurring revenue, documented delivery, and an SOP library that would let someone else do the work.",
    term: 3,
    skill: null,
    requirements: [
      { kind: "assignments-approved", assignments: ["t3-productised-offer", "t3-sop-library"] },
      {
        kind: "business-milestone",
        milestone: "first-recurring-revenue",
        label: "Sign a client onto a recurring plan",
      },
      { kind: "business-metric", metric: "mrr", min: 1000, label: "Reach $1,000 MRR" },
      { kind: "certification-earned", certification: "voice-ai" },
      {
        kind: "lessons-complete",
        modules: [
          "term-3/niching",
          "term-3/productised-services",
          "term-3/recurring-revenue",
          "term-3/advanced-automation",
          "term-3/advanced-ai-systems",
          "term-3/analytics-and-reporting",
          "term-3/sop-development",
          "term-3/hiring-and-delegation",
        ],
      },
      { kind: "skill-at-least", skill: "automation", level: 4 },
      { kind: "skill-at-least", skill: "operations", level: 3 },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Term 4 — CEO and enterprise                                      */
  /* ---------------------------------------------------------------- */
  {
    key: "core-graduate",
    name: "Ascend Core Graduate",
    tagline: "You can run Ascend as a company, not just perform the work.",
    description:
      "The Term 4 milestone. Financial management, leadership, hiring, operations, enterprise sales and security, compliance awareness and long-term strategy.",
    term: 4,
    skill: null,
    requirements: [
      { kind: "certification-earned", certification: "growth-ready" },
      {
        kind: "lessons-complete",
        modules: [
          "term-4/financial-management",
          "term-4/leadership",
          "term-4/hiring",
          "term-4/operations",
          "term-4/enterprise-sales",
          "term-4/enterprise-security",
          "term-4/legal-and-compliance",
          "term-4/strategy",
        ],
      },
      { kind: "assignments-approved", assignments: ["t4-financial-model", "t4-org-design"] },
      { kind: "skill-at-least", skill: "leadership", level: 3 },
      { kind: "skill-at-least", skill: "operations", level: 4 },
    ],
  },
];

export const CERTIFICATIONS_BY_KEY = new Map(
  CERTIFICATIONS.map((c) => [c.key, c]),
);

export function certificationsForTerm(term: 1 | 2 | 3 | 4) {
  return CERTIFICATIONS.filter((c) => c.term === term);
}
