import type { SkillKey } from "@/lib/domain/skills";

/**
 * Practical labs.
 *
 * Labs are defined as **data**, not as bespoke components. Five reusable kinds
 * cover the whole specification's lab list, which means adding a lab is writing
 * a definition rather than writing React — the same choice made for the
 * curriculum, and for the same reason: content that needs an engineer to change
 * it stops getting changed.
 *
 * Every lab states the mistake it is inoculating against. A lab that only tests
 * recall is a quiz; a lab should reproduce the situation where the knowledge
 * actually fails.
 */

export type LabKind =
  /** Correct the wrong values in a configuration. */
  | "fix-config"
  /** Assign each item to the right category. */
  | "classify"
  /** Connect source fields to target fields. */
  | "mapping"
  /** Put steps into the correct order. */
  | "ordering"
  /** Find the flaws in a block of code or config. */
  | "spot-the-flaw";

export interface LabField {
  id: string;
  label: string;
  /** What the learner sees before touching anything. */
  given: string;
  /** Accepted answers, compared case-insensitively after trimming. */
  accept: string[];
  hint?: string;
  /** Shown after solving — why this value and not the given one. */
  explanation: string;
}

export interface LabItem {
  id: string;
  label: string;
  detail?: string;
  /** Category id this item belongs in. */
  correctCategory: string;
  explanation: string;
}

export interface LabCategory {
  id: string;
  label: string;
  description?: string;
}

export interface LabStep {
  id: string;
  label: string;
  /** 1-based position in the correct order. */
  position: number;
  explanation: string;
}

export interface LabFlaw {
  id: string;
  /** 1-based line number in `code`. */
  line: number;
  label: string;
  severity: "critical" | "major" | "minor";
  explanation: string;
}

interface LabBase {
  id: string;
  title: string;
  /** One line, shown on the lab index. */
  summary: string;
  /** The situation. Markdown-free plain text so it renders anywhere. */
  brief: string;
  /**
   * The mistake this lab exists to prevent. Shown after solving, because it
   * lands harder once you have felt the problem.
   */
  inoculatesAgainst: string;
  skills: SkillKey[];
  skillXp: Partial<Record<SkillKey, number>>;
  xp: number;
  difficulty: "foundation" | "intermediate" | "advanced";
  estimatedMinutes: number;
  /** Lesson this lab belongs with, if any. */
  lessonPath?: string;
}

export type LabDefinition = LabBase &
  (
    | { kind: "fix-config"; context: string; contextLang?: string; fields: LabField[] }
    | { kind: "classify"; categories: LabCategory[]; items: LabItem[] }
    | {
        kind: "mapping";
        sourceLabel: string;
        targetLabel: string;
        source: string;
        sourceLang?: string;
        fields: LabField[];
      }
    | { kind: "ordering"; steps: LabStep[] }
    | {
        kind: "spot-the-flaw";
        code: string;
        codeLang?: string;
        flaws: LabFlaw[];
        /** Total lines, so the UI can render a selectable gutter. */
        lineCount: number;
      }
  );

/* ------------------------------------------------------------------ */
/* The labs                                                            */
/* ------------------------------------------------------------------ */

export const LABS: LabDefinition[] = [
  {
    id: "fix-broken-dns",
    kind: "fix-config",
    title: "Fix a broken DNS configuration",
    summary:
      "A client's new site does not resolve and their email has stopped. Repair the records.",
    brief:
      "You pointed a client's domain at their new site last night. This morning the site loads for you but not for them, and their email has stopped arriving. Here is the zone file as it stands. Correct every record that is wrong.",
    inoculatesAgainst:
      "Pointing a root domain at a hostname with a CNAME, and wiping MX records while changing web hosting. Both are silent for the person who made the change and catastrophic for the client.",
    skills: ["web", "security"],
    skillXp: { web: 40, security: 20 },
    xp: 90,
    difficulty: "foundation",
    estimatedMinutes: 15,
    context: `; zone file for northsideplumbing.com.au
@        3600  IN  CNAME  cname.vercel-dns.com.
www      3600  IN  CNAME  cname.vercel-dns.com.
mail     3600  IN  A      203.0.113.24
@        3600  IN  TXT    "v=spf1 -all"`,
    contextLang: "dns",
    fields: [
      {
        id: "root-record-type",
        label: "Record type for the root domain (@)",
        given: "CNAME",
        accept: ["A", "ALIAS", "ANAME"],
        hint: "The root of a zone already has other records. What does that forbid?",
        explanation:
          "A CNAME says 'this name is an alias for that name and has no other records'. The root of a zone must also carry MX, TXT and SOA records, so a CNAME there is invalid — some resolvers ignore it, others fail, which is why it worked for you and not for them. Use an A record, or your provider's ALIAS/ANAME flattening record.",
      },
      {
        id: "missing-mx",
        label: "Record type that is missing entirely, breaking email",
        given: "(none)",
        accept: ["MX"],
        hint: "Which record type tells the world where to deliver mail?",
        explanation:
          "There is no MX record, so nothing tells sending servers where the domain's mail goes. Changing web hosting should never touch mail delivery — always export the existing zone before you edit it, and diff what you are about to publish.",
      },
      {
        id: "spf-policy",
        label: "The SPF record's policy is wrong. What should replace `-all`?",
        given: "-all",
        accept: ["~all", "include", "?all"],
        hint: "This SPF record authorises no senders at all.",
        explanation:
          "`v=spf1 -all` means 'no server is authorised to send mail for this domain, reject everything'. Combined with the missing MX, this domain can neither receive nor send. It needs `include:` mechanisms for the client's actual mail provider, and `~all` (softfail) while you verify rather than `-all`.",
      },
    ],
  },

  {
    id: "map-json-payload",
    kind: "mapping",
    title: "Map a form payload into a CRM",
    summary:
      "Wire a website form's JSON into the fields a CRM expects, including a nested value.",
    brief:
      "A website form posts this JSON to your automation. The CRM needs specific fields. Enter the source path for each CRM field, using dot notation — `contact.email`, not `email`.",
    inoculatesAgainst:
      "Guessing at field paths instead of reading the payload, and forgetting that nested objects and arrays need indexing. This is the single most common cause of an automation that 'runs successfully' while writing empty values.",
    skills: ["automation", "api", "crm"],
    skillXp: { automation: 40, api: 20, crm: 20 },
    xp: 90,
    difficulty: "foundation",
    estimatedMinutes: 15,
    sourceLabel: "Incoming webhook payload",
    targetLabel: "CRM fields",
    source: `{
  "form": "quote-request",
  "submitted_at": "2026-08-14T09:31:00+10:00",
  "contact": {
    "first_name": "Marina",
    "last_name": "Okafor",
    "email": "marina@okaforbuilding.com.au",
    "phone": "0412 555 019"
  },
  "job": {
    "type": "bathroom renovation",
    "suburb": "Coburg",
    "budget_band": "15-25k"
  },
  "attachments": [
    { "name": "plans.pdf", "url": "https://files.example.com/a1.pdf" }
  ],
  "utm": { "source": "google", "campaign": "spring-reno" }
}`,
    sourceLang: "json",
    fields: [
      {
        id: "email",
        label: "Contact email",
        given: "",
        accept: ["contact.email"],
        explanation:
          "`contact.email` — nested one level. The path must include every parent key.",
      },
      {
        id: "full-name",
        label: "Contact first name",
        given: "",
        accept: ["contact.first_name", "contact.firstname"],
        explanation:
          "`contact.first_name`. Note the underscore: field names are literal, and a CRM expecting `firstName` needs the mapping to do the renaming.",
      },
      {
        id: "attachment",
        label: "First attachment's URL",
        given: "",
        accept: ["attachments[0].url", "attachments.0.url"],
        hint: "It is inside an array.",
        explanation:
          "`attachments[0].url`. Arrays need an index. Forgetting this is why an automation silently writes an empty string — and why you should always handle the case where the array is empty.",
      },
      {
        id: "lead-source",
        label: "Lead source, for attribution",
        given: "",
        accept: ["utm.source"],
        explanation:
          "`utm.source`. Capturing attribution at intake is the difference between knowing which marketing works and guessing.",
      },
    ],
  },

  {
    id: "debug-api-response",
    kind: "classify",
    title: "Diagnose API failures from their status codes",
    summary:
      "Six failing calls. Decide what actually went wrong in each, and who has to fix it.",
    brief:
      "Your automation is failing intermittently. Sort each response into the correct diagnosis. Getting this right is the difference between a five-minute fix and a day of guessing.",
    inoculatesAgainst:
      "Treating every failure as 'the API is broken'. The status code almost always says whose problem it is — yours, theirs, or the client's credentials.",
    skills: ["api", "automation"],
    skillXp: { api: 45, automation: 20 },
    xp: 90,
    difficulty: "foundation",
    estimatedMinutes: 12,
    categories: [
      {
        id: "your-request",
        label: "Your request is wrong",
        description: "Fix your code or your payload.",
      },
      {
        id: "credentials",
        label: "Credentials or permissions",
        description: "The key is missing, wrong, expired or not scoped for this.",
      },
      {
        id: "their-side",
        label: "Their system, wait and retry",
        description: "Transient. Retry with backoff.",
      },
      {
        id: "slow-down",
        label: "You are going too fast",
        description: "Rate limited. Throttle or queue.",
      },
    ],
    items: [
      {
        id: "401",
        label: "401 Unauthorized",
        detail: '{"message":"Invalid API key"}',
        correctCategory: "credentials",
        explanation:
          "401 means the server does not know who you are. The key is missing, malformed or revoked. Check the header name and that the value is not a truncated paste.",
      },
      {
        id: "403",
        label: "403 Forbidden",
        detail: '{"message":"Insufficient scope: contacts.write"}',
        correctCategory: "credentials",
        explanation:
          "403 means it knows who you are and you are not allowed. The key is valid but not scoped for this operation — a permissions change, not a code change.",
      },
      {
        id: "422",
        label: "422 Unprocessable Entity",
        detail: '{"errors":[{"field":"email","message":"is invalid"}]}',
        correctCategory: "your-request",
        explanation:
          "422 means the request was understood but the data is unacceptable. Your payload is wrong — usually a missing required field or a malformed value. The body names the field; read it.",
      },
      {
        id: "429",
        label: "429 Too Many Requests",
        detail: "Retry-After: 30",
        correctCategory: "slow-down",
        explanation:
          "429 is a rate limit. Respect the `Retry-After` header rather than retrying immediately — hammering a rate-limited endpoint extends the block and can get the key suspended.",
      },
      {
        id: "500",
        label: "500 Internal Server Error",
        detail: "(empty body)",
        correctCategory: "their-side",
        explanation:
          "5xx is their fault. Retry with exponential backoff, and alert a human if it persists. Do not 'fix' your code in response to a 500 — you will introduce a bug chasing someone else's outage.",
      },
      {
        id: "404",
        label: "404 Not Found",
        detail: "GET /v1/contact/8812",
        correctCategory: "your-request",
        explanation:
          "404 on a request you constructed usually means a wrong URL, not a missing record — here the resource is `contacts`, plural. Check the path before assuming the record was deleted.",
      },
    ],
  },

  {
    id: "identify-exposed-api-key",
    kind: "spot-the-flaw",
    title: "Find the credential leaks",
    summary:
      "A working integration that would expose a client's data. Find every flaw.",
    brief:
      "This code works. It also leaks. Select every line that is a security problem — there are four.",
    inoculatesAgainst:
      "Shipping something because it works. The failure mode here is invisible in testing and only surfaces when someone else's customer data is already gone.",
    skills: ["security", "api", "web"],
    skillXp: { security: 60, api: 20 },
    xp: 120,
    difficulty: "intermediate",
    estimatedMinutes: 15,
    codeLang: "javascript",
    lineCount: 12,
    code: `"use client";

const CRM_API_KEY = "hk_live_9f2c8a41d0e74b1c";

export async function submitLead(form) {
  const res = await fetch("https://api.crm.example/v1/contacts", {
    method: "POST",
    headers: { Authorization: \`Bearer \${CRM_API_KEY}\` },
    body: JSON.stringify(form),
  });
  console.log("CRM response", await res.json());
}`,
    flaws: [
      {
        id: "client-directive",
        line: 1,
        label: '"use client" — this whole file ships to the browser',
        severity: "critical",
        explanation:
          "Everything in a client component is downloadable by anyone who opens devtools. A secret in a client component is not a secret. This call belongs in a server action or a route handler.",
      },
      {
        id: "hardcoded-key",
        line: 3,
        label: "A live API key hard-coded in source",
        severity: "critical",
        explanation:
          "The key is now in the source, in git history, and in the browser bundle. It is a live key — `hk_live_` — so it grants write access to a real client's CRM. Rotate it immediately; you cannot un-publish a commit.",
      },
      {
        id: "no-error-handling",
        line: 6,
        label: "The response status is never checked",
        severity: "major",
        explanation:
          "A 401 or 422 here is indistinguishable from success. The lead is lost, the form says 'thank you', and nobody finds out until the client asks why enquiries stopped. Check `res.ok` and escalate on failure.",
      },
      {
        id: "logging-response",
        line: 10,
        label: "Logging the full response body",
        severity: "major",
        explanation:
          "The response contains the contact's personal information, and this runs in the browser console — visible to the user, and to any browser extension they have installed. Log an identifier, never a payload containing personal data.",
      },
    ],
  },

  {
    id: "design-crm-pipeline",
    kind: "ordering",
    title: "Design a lead pipeline",
    summary:
      "Order the stages of Ascend's own pipeline, from first contact to recurring client.",
    brief:
      "A pipeline stage should represent a change in the *prospect's* commitment, not a task on your to-do list. Put these stages into the order a real deal moves through.",
    inoculatesAgainst:
      "Building pipelines out of your own activities ('followed up', 'sent email') rather than the prospect's commitment level. Activity-based stages make forecasting impossible because nothing tells you whether a deal is actually advancing.",
    skills: ["crm", "sales"],
    skillXp: { crm: 45, sales: 25 },
    xp: 90,
    difficulty: "foundation",
    estimatedMinutes: 10,
    steps: [
      {
        id: "lead",
        label: "Lead",
        position: 1,
        explanation: "Identified as a plausible fit. No contact yet.",
      },
      {
        id: "contacted",
        label: "Contacted",
        position: 2,
        explanation: "You have reached out. Still entirely one-sided.",
      },
      {
        id: "replied",
        label: "Replied",
        position: 3,
        explanation:
          "The first real signal. A reply is the point at which a lead becomes a conversation.",
      },
      {
        id: "discovery-booked",
        label: "Discovery booked",
        position: 4,
        explanation:
          "They have given you time in their calendar — a genuine commitment, and the first one worth forecasting on.",
      },
      {
        id: "qualified",
        label: "Qualified",
        position: 5,
        explanation:
          "After discovery you know there is a real problem, a budget and a decision maker. Some deals should die here, and that is a success.",
      },
      {
        id: "proposal-sent",
        label: "Proposal sent",
        position: 6,
        explanation: "A specific scope and price are now in front of them.",
      },
      {
        id: "negotiation",
        label: "Negotiation",
        position: 7,
        explanation:
          "They are engaging with the terms rather than the decision. Close in sight.",
      },
      {
        id: "won",
        label: "Won",
        position: 8,
        explanation:
          "Signed, but not paid and not delivered. Treating a signature as revenue is how agencies celebrate deals that never fund.",
      },
      {
        id: "onboarding",
        label: "Onboarding",
        position: 9,
        explanation:
          "Access, credentials, kickoff. The stage most agencies skip and most projects suffer for.",
      },
      {
        id: "delivery",
        label: "Delivery",
        position: 10,
        explanation:
          "Building the thing. The longest stage, and the one where scope creep does its damage if the scope was never written down.",
      },
      {
        id: "completed",
        label: "Completed",
        position: 11,
        explanation:
          "Delivered, handed over and documented. Without the documentation the client cannot operate what you built, and you become their permanent support desk.",
      },
      {
        id: "recurring",
        label: "Recurring",
        position: 12,
        explanation:
          "On a retainer. This is the stage that turns an agency from a treadmill into a business.",
      },
    ],
  },

  {
    id: "design-human-escalation",
    kind: "classify",
    title: "Decide what an AI may handle alone",
    summary:
      "Six inbound messages. Which can the automation answer, and which must reach a person?",
    brief:
      "You have built an AI handler for a client's inbox. Sort each message by how it should be handled. The cost of getting this wrong is not a bad answer — it is a bad answer sent confidently on your client's behalf.",
    inoculatesAgainst:
      "Letting an AI handle anything it can produce plausible text about. Fluency is not competence, and the categories where it fails are exactly the ones where failure is expensive.",
    skills: ["ai", "support", "security"],
    skillXp: { ai: 45, support: 30, security: 15 },
    xp: 110,
    difficulty: "intermediate",
    estimatedMinutes: 15,
    categories: [
      {
        id: "auto",
        label: "Answer automatically",
        description: "Low risk, verifiable from the knowledge base.",
      },
      {
        id: "draft",
        label: "Draft for human approval",
        description: "Useful to pre-write, but a person sends it.",
      },
      {
        id: "escalate",
        label: "Escalate immediately",
        description: "Route to a human and do not reply.",
      },
    ],
    items: [
      {
        id: "hours",
        label: '"What time do you close on Saturdays?"',
        correctCategory: "auto",
        explanation:
          "Factual, stable, verifiable from the knowledge base, and harmless if slightly stale. This is exactly what automation is for.",
      },
      {
        id: "quote",
        label: '"How much would a full bathroom reno cost?"',
        correctCategory: "draft",
        explanation:
          "An AI-generated number becomes an anchor the client has to honour or walk back. Draft a response that gathers scope and offers a call — but a human sends it.",
      },
      {
        id: "complaint",
        label: '"Your team damaged my floor and nobody has called me back."',
        correctCategory: "escalate",
        explanation:
          "A complaint involving property damage is a liability matter. An automated apology can be read as an admission, and the delay in reaching a person makes it worse. Escalate, do not reply.",
      },
      {
        id: "gas-leak",
        label: '"I can smell gas in the kitchen, what should I do?"',
        correctCategory: "escalate",
        explanation:
          "A safety emergency. There is no acceptable automated response. Every AI system handling inbound messages needs an explicit emergency path that bypasses the model entirely.",
      },
      {
        id: "invoice",
        label: '"Can you resend invoice 4471?"',
        correctCategory: "draft",
        explanation:
          "Plausible to automate, but it involves a financial document and identity you have not verified. Draft it, and let a person confirm the request is from the account holder.",
      },
      {
        id: "address",
        label: '"Where are you located?"',
        correctCategory: "auto",
        explanation:
          "Public, factual, stable. Safe to answer directly.",
      },
    ],
  },
];

export const LABS_BY_ID = new Map(LABS.map((lab) => [lab.id, lab]));

export function labsForSkill(skill: SkillKey): LabDefinition[] {
  return LABS.filter((lab) => lab.skills.includes(skill));
}
