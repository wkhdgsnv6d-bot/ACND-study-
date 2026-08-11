import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

/**
 * Database schema.
 *
 * Scope: **your state only**. The curriculum itself lives as MDX under
 * `content/` and is never mirrored into the database — see
 * docs/ARCHITECTURE.md §3. Progress rows therefore reference lessons by their
 * stable path string (`term-1/apis-and-webhooks/what-is-an-api`) rather than by
 * a foreign key, which is what lets content be edited in a pull request without
 * a migration.
 *
 * Two things are deliberately *not* stored, because they are derived:
 *
 * - **XP totals** — recomputed from the `xpEvents` ledger. A bad award is fixed
 *   by correcting one row, never by reconciling a drifting counter.
 * - **Skill levels and streaks** — computed by the engines from events and
 *   sessions. Storing them would create a second source of truth that silently
 *   disagrees with the rules the engines enforce.
 *
 * Security: every table carries `userId`, has RLS enabled, and has an owner
 * policy restricting all operations to `auth.uid() = user_id`. The application
 * connects as the `authenticated` role carrying your JWT, so RLS is genuinely
 * enforced rather than merely configured. Multi-user works later without a
 * migration; multi-tenancy is not built now.
 */

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * The single RLS policy every table gets. Defining it here rather than by hand
 * per table means a new table cannot accidentally ship without protection.
 */
function ownerPolicy(name: string, userIdColumn: AnyPgColumn) {
  return pgPolicy(`${name}_owner`, {
    for: "all",
    to: authenticatedRole,
    using: sql`${authUid} = ${userIdColumn}`,
    withCheck: sql`${authUid} = ${userIdColumn}`,
  });
}

const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" });

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const lessonStatusEnum = pgEnum("lesson_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const submissionKindEnum = pgEnum("submission_kind", [
  "assignment",
  "practical",
  "capstone",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "submitted",
  "approved",
  "needs_improvement",
]);

export const certificationStatusEnum = pgEnum("certification_status", [
  "not_started",
  "learning",
  "practical_required",
  "exam_required",
  "submitted",
  "passed",
  "needs_improvement",
  "certified",
]);

export const xpSourceEnum = pgEnum("xp_source", [
  "lesson_read",
  "quiz_passed",
  "lab_solved",
  "practical_approved",
  "assignment_approved",
  "exam_passed",
  "project_submitted",
  "certification_earned",
  "business_milestone",
  "review_session",
]);

export const studyActivityEnum = pgEnum("study_activity", [
  "lesson",
  "lab",
  "quiz",
  "exam",
  "review",
  "assignment",
  "project",
  "business",
]);

export const reviewRatingEnum = pgEnum("review_rating", [
  "again",
  "hard",
  "good",
  "easy",
]);

export const noteScopeEnum = pgEnum("note_scope", [
  "lesson",
  "module",
  "software",
  "project",
  "general",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "in_progress",
  "complete",
  "archived",
]);

/** The thirteen pipeline stages from the specification, in order. */
export const prospectStageEnum = pgEnum("prospect_stage", [
  "lead",
  "contacted",
  "replied",
  "discovery_booked",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
  "onboarding",
  "delivery",
  "completed",
  "recurring",
]);

export const prospectActivityEnum = pgEnum("prospect_activity", [
  "email",
  "call",
  "meeting",
  "message",
  "proposal",
  "referral",
  "note",
  "other",
]);

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "paused",
  "churned",
  "completed",
]);

export const revenueTypeEnum = pgEnum("revenue_type", [
  "project",
  "setup",
  "recurring",
  "other",
]);

export const costCategoryEnum = pgEnum("cost_category", [
  "software",
  "labour",
  "contractor",
  "advertising",
  "other",
]);

export const packageTierEnum = pgEnum("package_tier", [
  "essential",
  "growth",
  "partner",
]);

/** How third-party and usage-based costs are treated. See `pricingPackages`. */
export const usageBillingEnum = pgEnum("usage_billing", [
  "separate",
  "allowance",
  "included",
]);

export const urgencyEnum = pgEnum("urgency", ["low", "medium", "high", "critical"]);

export const sopStatusEnum = pgEnum("sop_status", ["draft", "active", "retired"]);

/* ================================================================== */
/* Identity and configuration                                          */
/* ================================================================== */

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    /** IANA zone. Streaks are computed against local calendar days, not UTC. */
    timeZone: text("time_zone").notNull().default("Australia/Sydney"),
    currency: text("currency").notNull().default("AUD"),
    locale: text("locale").notNull().default("en-AU"),
    dailyStudyTargetMinutes: integer("daily_study_target_minutes")
      .notNull()
      .default(90),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    pgPolicy("profiles_owner", {
      for: "all",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.id}`,
      withCheck: sql`${authUid} = ${t.id}`,
    }),
  ],
).enableRLS();

export const settings = pgTable(
  "settings",
  {
    userId: userId().primaryKey(),
    /** `Term4UnlockConfig` from lib/engines/unlock.ts. */
    term4Unlock: jsonb("term4_unlock").notNull().default({}),
    /** Free-form study preferences: review session size, reminder times. */
    studyPreferences: jsonb("study_preferences").notNull().default({}),
    /** Hours per week genuinely available for delivery work. */
    deliverableHoursPerWeek: real("deliverable_hours_per_week").notNull().default(30),
    updatedAt: updatedAt(),
  },
  (t) => [ownerPolicy("settings", t.userId)],
).enableRLS();

/**
 * Ascend's real service packages.
 *
 * This table is why the specification's rule about exercises works: a lesson
 * asking you to compute the Growth package's gross margin reads these rows, the
 * same ones the Business Lab calculators read. The exercise is about your
 * business, not a textbook company. Nothing anywhere hard-codes a price.
 *
 * The columns split into two kinds, and the distinction is load-bearing:
 *
 * - **Customer-facing** — `setup_price_cents`, `monthly_price_cents` and
 *   `is_from_pricing`. These are commitments.
 * - **Internal planning assumptions** — hours, software cost and labour rate.
 *   These are estimates for modelling, not promises, and
 *   `assumptions_reviewed` records whether they have been checked against real
 *   delivery data yet.
 */
export const pricingPackages = pgTable(
  "pricing_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    tier: packageTierEnum("tier").notNull(),
    name: text("name").notNull(),
    description: text("description"),

    /* Customer-facing pricing. */
    setupPriceCents: integer("setup_price_cents").notNull().default(0),
    monthlyPriceCents: integer("monthly_price_cents").notNull().default(0),
    /**
     * Growth and Partner are quoted as a floor, not a fixed rate. The platform
     * must present them as "from $X" everywhere — proposals, exercises and the
     * Business Lab alike.
     */
    isFromPricing: boolean("is_from_pricing").notNull().default(false),

    /* Internal planning assumptions. */
    setupSoftwareCostCents: integer("setup_software_cost_cents").notNull().default(0),
    monthlySoftwareCostCents: integer("monthly_software_cost_cents")
      .notNull()
      .default(0),
    setupHours: real("setup_hours").notNull().default(0),
    monthlyHours: real("monthly_hours").notNull().default(0),
    labourRateCentsPerHour: integer("labour_rate_cents_per_hour")
      .notNull()
      .default(6000),

    /**
     * Third-party and usage-based costs: AI and API usage, voice minutes, phone
     * numbers, SMS, CRM licences, domains, premium plugins and subscriptions.
     * Default `separate` — billed on rather than absorbed, because these scale
     * with the client's activity and Ascend does not control them.
     */
    usageBilling: usageBillingEnum("usage_billing").notNull().default("separate"),
    estimatedMonthlyUsageCostCents: integer("estimated_monthly_usage_cost_cents")
      .notNull()
      .default(0),
    usageAllowanceCents: integer("usage_allowance_cents").notNull().default(0),

    /** False until the planning assumptions have been checked against reality. */
    assumptionsReviewed: boolean("assumptions_reviewed").notNull().default(false),
    /** True only while the row still holds unedited seed prices. */
    isPlaceholder: boolean("is_placeholder").notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("pricing_packages_user_tier_idx").on(t.userId, t.tier),
    ownerPolicy("pricing_packages", t.userId),
  ],
).enableRLS();

/* ================================================================== */
/* Learning progress                                                   */
/* ================================================================== */

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    /** Stable content path — not a foreign key. See the file header. */
    lessonPath: text("lesson_path").notNull(),
    status: lessonStatusEnum("status").notNull().default("not_started"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    secondsSpent: integer("seconds_spent").notNull().default(0),
    /**
     * 0–1. Completion requires genuinely reaching the end of the lesson plus a
     * minimum dwell time, so "mark complete" cannot be a reflex on page load.
     */
    scrollCompletion: real("scroll_completion").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("lesson_progress_user_lesson_idx").on(t.userId, t.lessonPath),
    index("lesson_progress_status_idx").on(t.userId, t.status),
    ownerPolicy("lesson_progress", t.userId),
  ],
).enableRLS();

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    activity: studyActivityEnum("activity").notNull(),
    /** Lesson path, lab id, exam id — whatever the session was spent on. */
    ref: text("ref"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    seconds: integer("seconds").notNull().default(0),
    /**
     * The session's local calendar day, resolved in the user's timezone at
     * write time. Streaks read this directly rather than re-deriving it, so a
     * later timezone change cannot silently rewrite study history.
     */
    localDay: date("local_day").notNull(),
  },
  (t) => [
    index("study_sessions_user_day_idx").on(t.userId, t.localDay),
    ownerPolicy("study_sessions", t.userId),
  ],
).enableRLS();

/** Append-only. Never updated, never deleted; totals are always recomputed. */
export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    sourceType: xpSourceEnum("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    amount: integer("amount").notNull(),
    /** `Partial<Record<SkillKey, number>>` — per-branch attribution. */
    skillXp: jsonb("skill_xp").notNull().default({}),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * Idempotency guard. Awards are keyed on (type, source), so re-completing a
     * lesson or re-solving a lab cannot inflate the ledger — the insert simply
     * conflicts and is ignored.
     */
    uniqueIndex("xp_events_unique_award_idx").on(t.userId, t.sourceType, t.sourceId),
    index("xp_events_awarded_idx").on(t.userId, t.awardedAt),
    ownerPolicy("xp_events", t.userId),
  ],
).enableRLS();

/* ================================================================== */
/* Assessment                                                          */
/* ================================================================== */

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    lessonPath: text("lesson_path").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    scorePercent: integer("score_percent").notNull(),
    passed: boolean("passed").notNull(),
    /** questionId → chosen option index(es) or free text. */
    answers: jsonb("answers").notNull().default({}),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("quiz_attempts_user_lesson_idx").on(t.userId, t.lessonPath),
    ownerPolicy("quiz_attempts", t.userId),
  ],
).enableRLS();

/**
 * One row per answered question. This is what turns a failed quiz from a score
 * into a study plan: every incorrect response schedules a review card against
 * its `reviewConcept`, and the weak-areas panel reads straight from here.
 */
export const questionResponses = pgTable(
  "question_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    attemptId: uuid("attempt_id").references(() => quizAttempts.id, {
      onDelete: "cascade",
    }),
    examAttemptId: uuid("exam_attempt_id"),
    questionId: text("question_id").notNull(),
    lessonPath: text("lesson_path"),
    reviewConcept: text("review_concept").notNull(),
    correct: boolean("correct").notNull(),
    answer: jsonb("answer").notNull().default({}),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("question_responses_concept_idx").on(t.userId, t.reviewConcept, t.correct),
    ownerPolicy("question_responses", t.userId),
  ],
).enableRLS();

export const examAttempts = pgTable(
  "exam_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    /** Module path, e.g. `term-1/apis-and-webhooks`. */
    examId: text("exam_id").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    /** Sampled question ids, stored so a resumed attempt keeps its paper. */
    questionIds: jsonb("question_ids").notNull().default([]),
    answers: jsonb("answers").notNull().default({}),
    scorePercent: integer("score_percent"),
    passed: boolean("passed"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [
    index("exam_attempts_user_exam_idx").on(t.userId, t.examId),
    ownerPolicy("exam_attempts", t.userId),
  ],
).enableRLS();

/**
 * Evidence-bearing work: module assignments, lesson practical tasks and term
 * capstones share one table because they share one shape — a brief, a rubric
 * ticked criterion by criterion, and links proving something was actually
 * built.
 */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    kind: submissionKindEnum("kind").notNull(),
    /** Assignment id, or the lesson path for a practical task. */
    ref: text("ref").notNull(),
    status: submissionStatusEnum("status").notNull().default("draft"),
    bodyMd: text("body_md"),
    /** `{ repoUrl?, liveUrl?, externalUrl?, screenshots: string[], files: string[] }` */
    evidence: jsonb("evidence").notNull().default({}),
    /** rubricCriterion → boolean. Ticked individually, never in bulk. */
    rubricCheck: jsonb("rubric_check").notNull().default({}),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("submissions_user_ref_idx").on(t.userId, t.kind, t.ref),
    index("submissions_status_idx").on(t.userId, t.status),
    ownerPolicy("submissions", t.userId),
  ],
).enableRLS();

export const labAttempts = pgTable(
  "lab_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    labId: text("lab_id").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    /** Lab-specific working state, so a half-finished lab survives a refresh. */
    state: jsonb("state").notNull().default({}),
    solved: boolean("solved").notNull().default(false),
    solvedAt: timestamp("solved_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("lab_attempts_user_lab_idx").on(t.userId, t.labId),
    ownerPolicy("lab_attempts", t.userId),
  ],
).enableRLS();

/* ================================================================== */
/* Certification                                                       */
/* ================================================================== */

/**
 * Records the *award* of a certification, not its computation. Status is
 * derived live by the certification engine; this table exists to capture the
 * moment a badge was earned, the evidence that satisfied it, and any
 * needs-improvement feedback — none of which is recoverable from live state.
 */
export const certifications = pgTable(
  "certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    certKey: text("cert_key").notNull(),
    status: certificationStatusEnum("status").notNull().default("not_started"),
    /** The evaluated requirement list at the moment of award, frozen. */
    requirementsSnapshot: jsonb("requirements_snapshot").notNull().default([]),
    evidenceRefs: jsonb("evidence_refs").notNull().default([]),
    awardedAt: timestamp("awarded_at", { withTimezone: true }),
    needsImprovementReason: text("needs_improvement_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("certifications_user_key_idx").on(t.userId, t.certKey),
    ownerPolicy("certifications", t.userId),
  ],
).enableRLS();

/* ================================================================== */
/* Spaced repetition                                                   */
/* ================================================================== */

export const reviewCards = pgTable(
  "review_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    conceptKey: text("concept_key").notNull(),
    lessonPath: text("lesson_path").notNull(),
    ease: real("ease").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    dueOn: date("due_on").notNull(),
    lapses: integer("lapses").notNull().default(0),
    /** Born from a wrong answer rather than a completed lesson. */
    fromMistake: boolean("from_mistake").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("review_cards_user_concept_idx").on(t.userId, t.conceptKey),
    index("review_cards_due_idx").on(t.userId, t.dueOn),
    ownerPolicy("review_cards", t.userId),
  ],
).enableRLS();

export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => reviewCards.id, { onDelete: "cascade" }),
    rating: reviewRatingEnum("rating").notNull(),
    intervalAfterDays: integer("interval_after_days").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("review_logs_user_time_idx").on(t.userId, t.reviewedAt),
    ownerPolicy("review_logs", t.userId),
  ],
).enableRLS();

/* ================================================================== */
/* Notes and portfolio                                                 */
/* ================================================================== */

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    scope: noteScopeEnum("scope").notNull().default("general"),
    /** Lesson path, module path, software key, project id — or null. */
    scopeRef: text("scope_ref"),
    title: text("title"),
    bodyMd: text("body_md").notNull().default(""),
    pinned: boolean("pinned").notNull().default(false),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("notes_scope_idx").on(t.userId, t.scope, t.scopeRef),
    index("notes_pinned_idx").on(t.userId, t.pinned),
    ownerPolicy("notes", t.userId),
  ],
).enableRLS();

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("planning"),
    /** SkillKey[] — which branches this project provides evidence for. */
    skills: text("skills").array().notNull().default(sql`ARRAY[]::text[]`),
    tech: text("tech").array().notNull().default(sql`ARRAY[]::text[]`),
    repoUrl: text("repo_url"),
    liveUrl: text("live_url"),
    screenshots: text("screenshots").array().notNull().default(sql`ARRAY[]::text[]`),
    lessonsLearned: text("lessons_learned"),
    problemsEncountered: text("problems_encountered"),
    howISolvedThem: text("how_i_solved_them"),
    clientReady: boolean("client_ready").notNull().default(false),
    portfolioReady: boolean("portfolio_ready").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("projects_status_idx").on(t.userId, t.status),
    ownerPolicy("projects", t.userId),
  ],
).enableRLS();

/* ================================================================== */
/* Business — the founder-OS half                                      */
/* ================================================================== */

export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    company: text("company").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    industry: text("industry"),
    source: text("source"),
    stage: prospectStageEnum("stage").notNull().default("lead"),
    /** Which Ascend service this opportunity is for. */
    service: text("service"),
    estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    nextAction: text("next_action"),
    nextActionDue: date("next_action_due"),
    expectedCloseOn: date("expected_close_on"),
    actualRevenueCents: integer("actual_revenue_cents").notNull().default(0),
    mrrCents: integer("mrr_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("prospects_stage_idx").on(t.userId, t.stage),
    index("prospects_next_action_idx").on(t.userId, t.nextActionDue),
    ownerPolicy("prospects", t.userId),
  ],
).enableRLS();

/** Individual touches. The outreach funnel on the dashboard counts these. */
export const prospectActivities = pgTable(
  "prospect_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    type: prospectActivityEnum("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
  },
  (t) => [
    index("prospect_activities_prospect_idx").on(t.userId, t.prospectId),
    index("prospect_activities_time_idx").on(t.userId, t.occurredAt),
    ownerPolicy("prospect_activities", t.userId),
  ],
).enableRLS();

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    prospectId: uuid("prospect_id").references(() => prospects.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    industry: text("industry"),
    status: clientStatusEnum("status").notNull().default("active"),
    contractValueCents: integer("contract_value_cents").notNull().default(0),
    mrrCents: integer("mrr_cents").notNull().default(0),
    startDate: date("start_date"),
    endDate: date("end_date"),
    /** Where the client's handover documentation lives. */
    docsUrl: text("docs_url"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("clients_status_idx").on(t.userId, t.status),
    ownerPolicy("clients", t.userId),
  ],
).enableRLS();

export const revenueEntries = pgTable(
  "revenue_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    type: revenueTypeEnum("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    incurredOn: date("incurred_on").notNull(),
    invoiced: boolean("invoiced").notNull().default(false),
    paidOn: date("paid_on"),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [
    index("revenue_entries_date_idx").on(t.userId, t.incurredOn),
    index("revenue_entries_client_idx").on(t.userId, t.clientId),
    ownerPolicy("revenue_entries", t.userId),
  ],
).enableRLS();

export const costs = pgTable(
  "costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    category: costCategoryEnum("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    incurredOn: date("incurred_on").notNull(),
    recurring: boolean("recurring").notNull().default(false),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [
    index("costs_date_idx").on(t.userId, t.incurredOn),
    ownerPolicy("costs", t.userId),
  ],
).enableRLS();

/**
 * The Market Validation Tracker from Module 2. Deliberately its own table
 * rather than a prospect stage: a validation conversation is research, and
 * treating it as a sales lead corrupts both the pipeline metrics and the
 * conversation itself.
 */
export const marketValidationInterviews = pgTable(
  "market_validation_interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    business: text("business").notNull(),
    industry: text("industry"),
    contact: text("contact"),
    problemDiscovered: text("problem_discovered"),
    currentSolution: text("current_solution"),
    costOfProblem: text("cost_of_problem"),
    urgency: urgencyEnum("urgency"),
    potentialService: text("potential_service"),
    estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
    followUp: text("follow_up"),
    notes: text("notes"),
    conductedAt: timestamp("conducted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("market_validation_time_idx").on(t.userId, t.conductedAt),
    ownerPolicy("market_validation_interviews", t.userId),
  ],
).enableRLS();

/**
 * Real business events — first client, first payment, first contractor. These
 * carry the highest XP awards in the system because they are the only
 * achievements that cannot be reached by studying harder.
 */
export const businessMilestones = pgTable(
  "business_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    key: text("key").notNull(),
    achievedAt: timestamp("achieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    valueCents: integer("value_cents"),
    evidence: text("evidence"),
    note: text("note"),
  },
  (t) => [
    uniqueIndex("business_milestones_user_key_idx").on(t.userId, t.key),
    ownerPolicy("business_milestones", t.userId),
  ],
).enableRLS();

export const sops = pgTable(
  "sops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    bodyMd: text("body_md").notNull().default(""),
    version: integer("version").notNull().default(1),
    status: sopStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("sops_category_idx").on(t.userId, t.category),
    ownerPolicy("sops", t.userId),
  ],
).enableRLS();

/** A filled-in copy of a Template Vault template — a real proposal, scope or checklist. */
export const templateInstances = pgTable(
  "template_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    templateKey: text("template_key").notNull(),
    name: text("name").notNull(),
    /** Linked to the prospect or client it was produced for, when relevant. */
    prospectId: uuid("prospect_id").references(() => prospects.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    data: jsonb("data").notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("template_instances_key_idx").on(t.userId, t.templateKey),
    ownerPolicy("template_instances", t.userId),
  ],
).enableRLS();

/* ================================================================== */
/* Meta                                                                */
/* ================================================================== */

export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    key: text("key").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("achievements_user_key_idx").on(t.userId, t.key),
    ownerPolicy("achievements", t.userId),
  ],
).enableRLS();

/** Append-only feed powering "Recent Activity" and the weekly review. */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    kind: text("kind").notNull(),
    ref: text("ref"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activity_log_time_idx").on(t.userId, t.occurredAt),
    ownerPolicy("activity_log", t.userId),
  ],
).enableRLS();

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type Profile = typeof profiles.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type PricingPackage = typeof pricingPackages.$inferSelect;
export type LessonProgressRow = typeof lessonProgress.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type XpEventRow = typeof xpEvents.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type QuestionResponse = typeof questionResponses.$inferSelect;
export type ExamAttempt = typeof examAttempts.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type LabAttempt = typeof labAttempts.$inferSelect;
export type CertificationRow = typeof certifications.$inferSelect;
export type ReviewCardRow = typeof reviewCards.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Prospect = typeof prospects.$inferSelect;
export type ProspectActivity = typeof prospectActivities.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type RevenueEntry = typeof revenueEntries.$inferSelect;
export type Cost = typeof costs.$inferSelect;
export type MarketValidationInterview =
  typeof marketValidationInterviews.$inferSelect;
export type BusinessMilestone = typeof businessMilestones.$inferSelect;
export type Sop = typeof sops.$inferSelect;
export type TemplateInstance = typeof templateInstances.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type ActivityLogRow = typeof activityLog.$inferSelect;
