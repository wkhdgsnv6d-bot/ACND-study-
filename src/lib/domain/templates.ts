/**
 * The Template Vault.
 *
 * Reusable documents for running Ascend. Each is a checklist or a structure
 * rather than boilerplate to sign — the value is in what it stops you
 * forgetting, not in the wording.
 *
 * On legal documents: the contract and scope templates here are prompts for a
 * conversation and a starting structure. They are **not** legal documents and
 * do not replace advice from an Australian solicitor. Anything you put in front
 * of a client with money attached should be reviewed by one.
 */

export const TEMPLATE_CATEGORIES = [
  "sales",
  "delivery",
  "quality",
  "operations",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  sales: "Sales",
  delivery: "Delivery",
  quality: "Quality",
  operations: "Operations",
};

export interface TemplateSection {
  heading: string;
  /** Prompts or checklist items. */
  items: string[];
  note?: string;
}

export interface TemplateDefinition {
  key: string;
  name: string;
  category: TemplateCategory;
  summary: string;
  /** Why this exists — the failure it prevents. */
  rationale: string;
  requiresLegalReview?: boolean;
  sections: TemplateSection[];
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    key: "discovery-questionnaire",
    name: "Discovery questionnaire",
    category: "sales",
    summary: "The questions that separate an expensive problem from an interesting one.",
    rationale:
      "Most failed projects were scoped from a conversation about a solution rather than a problem. These questions keep you on the problem long enough to price it properly — or to walk away.",
    sections: [
      {
        heading: "The problem",
        items: [
          "Walk me through how this works today, start to finish.",
          "Who does each step, and how long does it take them?",
          "How often does it happen — per day, per week?",
          "What happens when it goes wrong? How often is that?",
          "What have you already tried?",
        ],
      },
      {
        heading: "The cost",
        items: [
          "How many hours a week does this consume across everyone involved?",
          "What is that time worth, roughly?",
          "Has this cost you a job, a customer or a deadline? When?",
          "If nothing changed for another year, what would that cost you?",
        ],
        note: "This section is the difference between a nice-to-have and a purchase. Do not skip it because it feels intrusive.",
      },
      {
        heading: "Urgency and decision",
        items: [
          "Why now, rather than six months ago or six months from now?",
          "Who else needs to agree before this goes ahead?",
          "What does your approval process look like?",
          "Is there a budget already set aside, or does one need to be found?",
          "What would have to be true for you to say no?",
        ],
      },
      {
        heading: "Desired outcome",
        items: [
          "If this worked perfectly, what would be different in three months?",
          "How would you know it worked? What would you measure?",
          "What must not change?",
        ],
      },
    ],
  },

  {
    key: "scope-of-work",
    name: "Scope of work",
    category: "sales",
    summary: "What is included, what is not, and what happens when that changes.",
    rationale:
      "Scope creep is not caused by demanding clients. It is caused by scopes that never wrote down what was excluded, so every request is arguably included.",
    requiresLegalReview: true,
    sections: [
      {
        heading: "Deliverables",
        items: [
          "Each deliverable, described so that a third party could tell whether it exists",
          "The acceptance criteria for each one",
          "What 'done' means for the project as a whole",
        ],
      },
      {
        heading: "Explicitly excluded",
        items: [
          "Content writing and copy, unless stated",
          "Ongoing changes after handover",
          "Third-party subscriptions and usage costs",
          "Anything discussed but not listed under deliverables",
        ],
        note: "The exclusions section is the one that earns its keep. Write it before the client asks.",
      },
      {
        heading: "Assumptions and dependencies",
        items: [
          "What you need from the client, and by when",
          "Access and credentials required",
          "Decisions that must be made before work can start",
          "What happens to the timeline if these are late",
        ],
      },
      {
        heading: "Revisions and change requests",
        items: [
          "How many rounds of revision are included",
          "What counts as a revision versus a change of scope",
          "How a change request is priced and approved",
        ],
      },
      {
        heading: "Commercials",
        items: [
          "Total investment, and what triggers each payment",
          "Deposit required before work begins",
          "Recurring costs, stated separately from the project fee",
          "Third-party and usage costs, and who pays them",
        ],
      },
    ],
  },

  {
    key: "proposal",
    name: "Proposal",
    category: "sales",
    summary: "Their problem in their words, then your solution — in that order.",
    rationale:
      "A proposal that opens with your credentials is about you. One that opens with their problem, quoted accurately, has already demonstrated you listened.",
    sections: [
      {
        heading: "The problem, in their words",
        items: [
          "What they told you is happening today",
          "What it is costing them, using the figures they gave you",
          "Why now",
        ],
        note: "Quote them. If you cannot, you did not do discovery.",
      },
      {
        heading: "Desired state",
        items: [
          "What is different once this works",
          "How they will know it worked",
        ],
      },
      {
        heading: "Proposed solution",
        items: [
          "What you will build, in plain language",
          "How it addresses each part of the problem",
          "What it deliberately does not attempt",
        ],
      },
      {
        heading: "Scope and timeline",
        items: [
          "Deliverables and acceptance criteria",
          "Exclusions",
          "Milestones and dates, with what you need from them at each",
        ],
      },
      {
        heading: "Investment",
        items: [
          "Setup fee and payment schedule",
          "Monthly fee, stated separately",
          "Third-party and usage costs, billed separately or covered by a stated allowance",
          "What is not included in the price",
        ],
      },
      {
        heading: "Next steps",
        items: [
          "Exactly what happens if they say yes",
          "What you need from them first",
          "How long the pricing holds",
        ],
      },
    ],
  },

  {
    key: "website-qa",
    name: "Website QA checklist",
    category: "quality",
    summary: "Run this before every handover, without exception.",
    rationale:
      "The bugs a client finds are almost never novel. They are the same twelve things, and a checklist catches them in ten minutes.",
    sections: [
      {
        heading: "Function",
        items: [
          "Every form submits and the submission arrives where it should",
          "Every form shows a clear success state and a clear error state",
          "Every internal link resolves",
          "404 page exists and is useful",
          "Search, filters and pagination behave with zero results",
        ],
      },
      {
        heading: "Devices and browsers",
        items: [
          "Renders correctly at 390px, 768px and 1440px",
          "No horizontal scrolling at any width",
          "Tested in Chrome, Safari and Firefox",
          "Tested on a real phone, not only a simulator",
        ],
      },
      {
        heading: "Accessibility",
        items: [
          "Every image has meaningful alt text, or is marked decorative",
          "The whole site is navigable by keyboard",
          "Focus is visible everywhere",
          "Colour contrast passes on text and interactive elements",
          "Headings form a sensible outline",
        ],
      },
      {
        heading: "Performance and SEO",
        items: [
          "Images are sized and compressed appropriately",
          "Page titles and meta descriptions are unique and accurate",
          "Sitemap and robots.txt exist and are correct",
          "Analytics is installed and recording",
          "Core Web Vitals measured on a real device, not just locally",
        ],
      },
      {
        heading: "Production",
        items: [
          "HTTPS works and http redirects to it",
          "www and non-www both resolve to one canonical version",
          "Email still works — check MX records after any DNS change",
          "A rollback has been tested, not just assumed",
        ],
      },
    ],
  },

  {
    key: "automation-qa",
    name: "Automation QA checklist",
    category: "quality",
    summary: "What separates an automation you can sleep through from one you cannot.",
    rationale:
      "An automation that works on the happy path is half an automation. The other half is what happens at 2am when a vendor returns a 500.",
    sections: [
      {
        heading: "Happy path",
        items: [
          "Runs end to end with realistic data",
          "Every downstream record is created correctly, not just created",
          "Runs correctly twice in a row without duplicating anything",
        ],
      },
      {
        heading: "Edge cases",
        items: [
          "Empty or missing fields in the trigger payload",
          "Unexpected characters, other languages, very long values",
          "The upstream system returns zero results",
          "The same event fires twice",
        ],
      },
      {
        heading: "Failure",
        items: [
          "An error workflow is attached and has been tested by causing a real failure",
          "Retries are configured with backoff, not immediate repeats",
          "A human is alerted when it fails, and knows what to do",
          "Failure is logged with enough context to diagnose without re-running",
        ],
      },
      {
        heading: "Security and data",
        items: [
          "Credentials are in the credential store, not inline",
          "Webhook endpoints verify a signature or shared secret",
          "Logs do not retain personal information longer than needed",
          "Access to the automation platform is restricted and revocable",
        ],
      },
      {
        heading: "Handover",
        items: [
          "The client knows what it does, in one paragraph without jargon",
          "The client knows who to contact and how fast to expect a response",
          "The failure plan is written down",
        ],
      },
    ],
  },

  {
    key: "client-handover",
    name: "Client handover checklist",
    category: "delivery",
    summary: "What the client needs so they own the system rather than rent you.",
    rationale:
      "Without documentation you are the client's permanent support desk, at no extra charge. Handover is what turns delivery into completion.",
    sections: [
      {
        heading: "Access",
        items: [
          "The client owns every account, with you added rather than the reverse",
          "Domain registrar access confirmed in their name",
          "Billing on every subscription is in their name",
          "You can be removed without breaking anything",
        ],
        note: "Owning a client's domain 'for convenience' is a hostage situation, whether or not you intend it that way.",
      },
      {
        heading: "Documentation",
        items: [
          "What was built, in plain language",
          "How each automation works and what triggers it",
          "Where credentials are stored and how to rotate them",
          "The failure plan: what breaks, how you would know, what to do",
        ],
      },
      {
        heading: "Training",
        items: [
          "A recorded walkthrough of anything they operate themselves",
          "Who to contact and expected response times",
          "What is covered by the retainer and what is billable",
        ],
      },
      {
        heading: "Commercial",
        items: [
          "Final invoice issued",
          "Recurring arrangement documented and started",
          "Testimonial requested while the result is fresh",
          "Follow-up scheduled for 30 days",
        ],
      },
    ],
  },

  {
    key: "incident-report",
    name: "Incident report",
    category: "operations",
    summary: "What happened, what you did, and what stops it happening again.",
    rationale:
      "Incidents damage trust less than silence does. A written report, sent before the client asks, is often the point at which a client decides to keep you.",
    sections: [
      {
        heading: "What happened",
        items: [
          "Plain-language description of the impact on the client",
          "When it started and when it was resolved",
          "How many records, messages or customers were affected",
        ],
      },
      {
        heading: "Cause",
        items: [
          "The technical cause, explained without blame or jargon",
          "Why it was not caught earlier",
        ],
      },
      {
        heading: "Response",
        items: [
          "What you did, and when",
          "What was recovered and what was not",
          "Whether any data was lost or exposed, stated plainly",
        ],
        note: "If personal information was exposed, Australian notifiable data breach obligations may apply. Get advice rather than guessing.",
      },
      {
        heading: "Prevention",
        items: [
          "What has changed so this cannot recur",
          "What monitoring now exists that did not before",
          "When you will confirm the fix held",
        ],
      },
    ],
  },

  {
    key: "monthly-report",
    name: "Monthly client report",
    category: "operations",
    summary: "What a retainer is actually buying, made visible every month.",
    rationale:
      "Retainers churn when the client stops being able to see the value. A monthly report that takes twenty minutes to produce is the cheapest retention there is.",
    sections: [
      {
        heading: "Results",
        items: [
          "The numbers that matter to their business, not to you",
          "Change since last month, and the trend over three",
          "Anything notable, good or bad",
        ],
      },
      {
        heading: "What ran",
        items: [
          "Automations executed, and how many were handled without a human",
          "Time saved, estimated honestly",
          "Any failures, and what you did about them",
        ],
      },
      {
        heading: "What changed",
        items: [
          "Work completed this month",
          "Improvements made proactively",
        ],
      },
      {
        heading: "Next",
        items: [
          "What you recommend next, and why",
          "Anything you need from them",
        ],
      },
    ],
  },

  {
    key: "market-validation-interview",
    name: "Market validation interview",
    category: "sales",
    summary: "A research conversation, not a sales call. Keep it that way.",
    rationale:
      "The moment you pitch, the person stops telling you the truth and starts being polite. These questions are designed to be unpitchable.",
    sections: [
      {
        heading: "Opening",
        items: [
          "I am learning about how businesses like yours handle X. I am not selling anything — can I ask you a few questions?",
          "Tell me about your business — what does a normal week look like?",
        ],
      },
      {
        heading: "Finding the pain",
        items: [
          "What takes more time than it should?",
          "What do you or your team do repeatedly that feels like it should be automatic?",
          "Where do enquiries come from, and what happens to them?",
          "What falls through the cracks?",
        ],
        note: "Ask about the past, not the future. 'What did you do last week' beats 'would you use a tool that…' every time.",
      },
      {
        heading: "Sizing it",
        items: [
          "How much time does that take, in a week?",
          "Has it cost you a job? What happened?",
          "What have you tried? What happened to that?",
          "Who else has this problem?",
        ],
      },
      {
        heading: "Willingness to pay",
        items: [
          "Have you looked at paying someone to fix this?",
          "What stopped you?",
          "What would it need to do to be worth paying for?",
        ],
        note: "'That sounds useful' is not willingness to pay. 'We looked at X and it cost too much' is.",
      },
    ],
  },

  {
    key: "sop",
    name: "SOP template",
    category: "operations",
    summary: "The structure that makes work delegable.",
    rationale:
      "You cannot delegate what only exists in your head. An SOP is the difference between hiring someone and training someone indefinitely.",
    sections: [
      {
        heading: "Header",
        items: [
          "What this procedure is for, in one sentence",
          "Who performs it, and when it is triggered",
          "How long it should take",
          "Owner and last reviewed date",
        ],
      },
      {
        heading: "Before you start",
        items: [
          "Access and tools required",
          "Information you need to hand",
          "Anything that must already be true",
        ],
      },
      {
        heading: "The steps",
        items: [
          "Numbered, each a single action",
          "Written so someone who has never done it can follow them",
          "Screenshots or a recording for anything visual",
        ],
      },
      {
        heading: "Quality check",
        items: [
          "How to tell it was done correctly",
          "What to do if it was not",
          "Who to escalate to, and when",
        ],
      },
    ],
  },
];

export const TEMPLATES_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));

/** Renders a template as Markdown, for copying into a document. */
export function templateToMarkdown(template: TemplateDefinition): string {
  const lines: string[] = [`# ${template.name}`, "", template.summary, ""];

  if (template.requiresLegalReview) {
    lines.push(
      "> This is a structure and a checklist, not a legal document. Have anything",
      "> with money attached reviewed by an Australian solicitor.",
      "",
    );
  }

  for (const section of template.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const item of section.items) lines.push(`- [ ] ${item}`);
    if (section.note) lines.push("", `_${section.note}_`);
    lines.push("");
  }

  return lines.join("\n");
}
