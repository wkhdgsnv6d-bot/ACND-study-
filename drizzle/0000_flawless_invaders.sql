CREATE TYPE "public"."certification_status" AS ENUM('not_started', 'learning', 'practical_required', 'exam_required', 'submitted', 'passed', 'needs_improvement', 'certified');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'paused', 'churned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('software', 'labour', 'contractor', 'advertising', 'other');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."note_scope" AS ENUM('lesson', 'module', 'software', 'project', 'general');--> statement-breakpoint
CREATE TYPE "public"."package_tier" AS ENUM('essential', 'growth', 'partner');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'in_progress', 'complete', 'archived');--> statement-breakpoint
CREATE TYPE "public"."prospect_activity" AS ENUM('email', 'call', 'meeting', 'message', 'proposal', 'referral', 'note', 'other');--> statement-breakpoint
CREATE TYPE "public"."prospect_stage" AS ENUM('lead', 'contacted', 'replied', 'discovery_booked', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost', 'onboarding', 'delivery', 'completed', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."revenue_type" AS ENUM('project', 'setup', 'recurring', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_rating" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TYPE "public"."sop_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."study_activity" AS ENUM('lesson', 'lab', 'quiz', 'exam', 'review', 'assignment', 'project', 'business');--> statement-breakpoint
CREATE TYPE "public"."submission_kind" AS ENUM('assignment', 'practical', 'capstone');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'submitted', 'approved', 'needs_improvement');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."xp_source" AS ENUM('lesson_read', 'quiz_passed', 'lab_solved', 'practical_approved', 'assignment_approved', 'exam_passed', 'project_submitted', 'certification_earned', 'business_milestone', 'review_session');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref" text,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "business_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value_cents" integer,
	"evidence" text,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "business_milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cert_key" text NOT NULL,
	"status" "certification_status" DEFAULT 'not_started' NOT NULL,
	"requirements_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"awarded_at" timestamp with time zone,
	"needs_improvement_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prospect_id" uuid,
	"name" text NOT NULL,
	"industry" text,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"contract_value_cents" integer DEFAULT 0 NOT NULL,
	"mrr_cents" integer DEFAULT 0 NOT NULL,
	"start_date" date,
	"end_date" date,
	"docs_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid,
	"category" "cost_category" NOT NULL,
	"amount_cents" integer NOT NULL,
	"incurred_on" date NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "costs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_id" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"question_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_percent" integer,
	"passed" boolean,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "exam_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lab_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lab_id" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"solved" boolean DEFAULT false NOT NULL,
	"solved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_path" text NOT NULL,
	"status" "lesson_status" DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"seconds_spent" integer DEFAULT 0 NOT NULL,
	"scroll_completion" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "market_validation_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business" text NOT NULL,
	"industry" text,
	"contact" text,
	"problem_discovered" text,
	"current_solution" text,
	"cost_of_problem" text,
	"urgency" "urgency",
	"potential_service" text,
	"estimated_value_cents" integer DEFAULT 0 NOT NULL,
	"follow_up" text,
	"notes" text,
	"conducted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_validation_interviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" "note_scope" DEFAULT 'general' NOT NULL,
	"scope_ref" text,
	"title" text,
	"body_md" text DEFAULT '' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pricing_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" "package_tier" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"setup_price_cents" integer DEFAULT 0 NOT NULL,
	"monthly_price_cents" integer DEFAULT 0 NOT NULL,
	"setup_software_cost_cents" integer DEFAULT 0 NOT NULL,
	"monthly_software_cost_cents" integer DEFAULT 0 NOT NULL,
	"setup_hours" real DEFAULT 0 NOT NULL,
	"monthly_hours" real DEFAULT 0 NOT NULL,
	"labour_rate_cents_per_hour" integer DEFAULT 6000 NOT NULL,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing_packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"time_zone" text DEFAULT 'Australia/Sydney' NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"locale" text DEFAULT 'en-AU' NOT NULL,
	"daily_study_target_minutes" integer DEFAULT 90 NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"skills" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"tech" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"repo_url" text,
	"live_url" text,
	"screenshots" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"lessons_learned" text,
	"problems_encountered" text,
	"how_i_solved_them" text,
	"client_ready" boolean DEFAULT false NOT NULL,
	"portfolio_ready" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prospect_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"type" "prospect_activity" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "prospect_activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"industry" text,
	"source" text,
	"stage" "prospect_stage" DEFAULT 'lead' NOT NULL,
	"service" text,
	"estimated_value_cents" integer DEFAULT 0 NOT NULL,
	"last_contact_at" timestamp with time zone,
	"next_action" text,
	"next_action_due" date,
	"expected_close_on" date,
	"actual_revenue_cents" integer DEFAULT 0 NOT NULL,
	"mrr_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prospects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"attempt_id" uuid,
	"exam_attempt_id" uuid,
	"question_id" text NOT NULL,
	"lesson_path" text,
	"review_concept" text NOT NULL,
	"correct" boolean NOT NULL,
	"answer" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_path" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"score_percent" integer NOT NULL,
	"passed" boolean NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "revenue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid,
	"type" "revenue_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"incurred_on" date NOT NULL,
	"invoiced" boolean DEFAULT false NOT NULL,
	"paid_on" date,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "revenue_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_key" text NOT NULL,
	"lesson_path" text NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"due_on" date NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"from_mistake" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"rating" "review_rating" NOT NULL,
	"interval_after_days" integer NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"term4_unlock" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"study_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deliverable_hours_per_week" real DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "sop_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity" "study_activity" NOT NULL,
	"ref" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"seconds" integer DEFAULT 0 NOT NULL,
	"local_day" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "submission_kind" NOT NULL,
	"ref" text NOT NULL,
	"status" "submission_status" DEFAULT 'draft' NOT NULL,
	"body_md" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rubric_check" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "template_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"prospect_id" uuid,
	"client_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" "xp_source" NOT NULL,
	"source_id" text NOT NULL,
	"amount" integer NOT NULL,
	"skill_xp" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "xp_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_milestones" ADD CONSTRAINT "business_milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_attempts" ADD CONSTRAINT "lab_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_validation_interviews" ADD CONSTRAINT "market_validation_interviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_packages" ADD CONSTRAINT "pricing_packages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_review_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."review_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sops" ADD CONSTRAINT "sops_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_instances" ADD CONSTRAINT "template_instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_instances" ADD CONSTRAINT "template_instances_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_instances" ADD CONSTRAINT "template_instances_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_user_key_idx" ON "achievements" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "activity_log_time_idx" ON "activity_log" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "business_milestones_user_key_idx" ON "business_milestones" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "certifications_user_key_idx" ON "certifications" USING btree ("user_id","cert_key");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "costs_date_idx" ON "costs" USING btree ("user_id","incurred_on");--> statement-breakpoint
CREATE INDEX "exam_attempts_user_exam_idx" ON "exam_attempts" USING btree ("user_id","exam_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_attempts_user_lab_idx" ON "lab_attempts" USING btree ("user_id","lab_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_user_lesson_idx" ON "lesson_progress" USING btree ("user_id","lesson_path");--> statement-breakpoint
CREATE INDEX "lesson_progress_status_idx" ON "lesson_progress" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "market_validation_time_idx" ON "market_validation_interviews" USING btree ("user_id","conducted_at");--> statement-breakpoint
CREATE INDEX "notes_scope_idx" ON "notes" USING btree ("user_id","scope","scope_ref");--> statement-breakpoint
CREATE INDEX "notes_pinned_idx" ON "notes" USING btree ("user_id","pinned");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_packages_user_tier_idx" ON "pricing_packages" USING btree ("user_id","tier");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "prospect_activities_prospect_idx" ON "prospect_activities" USING btree ("user_id","prospect_id");--> statement-breakpoint
CREATE INDEX "prospect_activities_time_idx" ON "prospect_activities" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "prospects_stage_idx" ON "prospects" USING btree ("user_id","stage");--> statement-breakpoint
CREATE INDEX "prospects_next_action_idx" ON "prospects" USING btree ("user_id","next_action_due");--> statement-breakpoint
CREATE INDEX "question_responses_concept_idx" ON "question_responses" USING btree ("user_id","review_concept","correct");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_lesson_idx" ON "quiz_attempts" USING btree ("user_id","lesson_path");--> statement-breakpoint
CREATE INDEX "revenue_entries_date_idx" ON "revenue_entries" USING btree ("user_id","incurred_on");--> statement-breakpoint
CREATE INDEX "revenue_entries_client_idx" ON "revenue_entries" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_cards_user_concept_idx" ON "review_cards" USING btree ("user_id","concept_key");--> statement-breakpoint
CREATE INDEX "review_cards_due_idx" ON "review_cards" USING btree ("user_id","due_on");--> statement-breakpoint
CREATE INDEX "review_logs_user_time_idx" ON "review_logs" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "sops_category_idx" ON "sops" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "study_sessions_user_day_idx" ON "study_sessions" USING btree ("user_id","local_day");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_user_ref_idx" ON "submissions" USING btree ("user_id","kind","ref");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "template_instances_key_idx" ON "template_instances" USING btree ("user_id","template_key");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_unique_award_idx" ON "xp_events" USING btree ("user_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "xp_events_awarded_idx" ON "xp_events" USING btree ("user_id","awarded_at");--> statement-breakpoint
CREATE POLICY "achievements_owner" ON "achievements" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "achievements"."user_id") WITH CHECK ((select auth.uid()) = "achievements"."user_id");--> statement-breakpoint
CREATE POLICY "activity_log_owner" ON "activity_log" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "activity_log"."user_id") WITH CHECK ((select auth.uid()) = "activity_log"."user_id");--> statement-breakpoint
CREATE POLICY "business_milestones_owner" ON "business_milestones" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "business_milestones"."user_id") WITH CHECK ((select auth.uid()) = "business_milestones"."user_id");--> statement-breakpoint
CREATE POLICY "certifications_owner" ON "certifications" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "certifications"."user_id") WITH CHECK ((select auth.uid()) = "certifications"."user_id");--> statement-breakpoint
CREATE POLICY "clients_owner" ON "clients" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "clients"."user_id") WITH CHECK ((select auth.uid()) = "clients"."user_id");--> statement-breakpoint
CREATE POLICY "costs_owner" ON "costs" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "costs"."user_id") WITH CHECK ((select auth.uid()) = "costs"."user_id");--> statement-breakpoint
CREATE POLICY "exam_attempts_owner" ON "exam_attempts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "exam_attempts"."user_id") WITH CHECK ((select auth.uid()) = "exam_attempts"."user_id");--> statement-breakpoint
CREATE POLICY "lab_attempts_owner" ON "lab_attempts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "lab_attempts"."user_id") WITH CHECK ((select auth.uid()) = "lab_attempts"."user_id");--> statement-breakpoint
CREATE POLICY "lesson_progress_owner" ON "lesson_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "lesson_progress"."user_id") WITH CHECK ((select auth.uid()) = "lesson_progress"."user_id");--> statement-breakpoint
CREATE POLICY "market_validation_interviews_owner" ON "market_validation_interviews" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "market_validation_interviews"."user_id") WITH CHECK ((select auth.uid()) = "market_validation_interviews"."user_id");--> statement-breakpoint
CREATE POLICY "notes_owner" ON "notes" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "notes"."user_id") WITH CHECK ((select auth.uid()) = "notes"."user_id");--> statement-breakpoint
CREATE POLICY "pricing_packages_owner" ON "pricing_packages" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "pricing_packages"."user_id") WITH CHECK ((select auth.uid()) = "pricing_packages"."user_id");--> statement-breakpoint
CREATE POLICY "profiles_owner" ON "profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "profiles"."id") WITH CHECK ((select auth.uid()) = "profiles"."id");--> statement-breakpoint
CREATE POLICY "projects_owner" ON "projects" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "projects"."user_id") WITH CHECK ((select auth.uid()) = "projects"."user_id");--> statement-breakpoint
CREATE POLICY "prospect_activities_owner" ON "prospect_activities" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "prospect_activities"."user_id") WITH CHECK ((select auth.uid()) = "prospect_activities"."user_id");--> statement-breakpoint
CREATE POLICY "prospects_owner" ON "prospects" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "prospects"."user_id") WITH CHECK ((select auth.uid()) = "prospects"."user_id");--> statement-breakpoint
CREATE POLICY "question_responses_owner" ON "question_responses" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "question_responses"."user_id") WITH CHECK ((select auth.uid()) = "question_responses"."user_id");--> statement-breakpoint
CREATE POLICY "quiz_attempts_owner" ON "quiz_attempts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "quiz_attempts"."user_id") WITH CHECK ((select auth.uid()) = "quiz_attempts"."user_id");--> statement-breakpoint
CREATE POLICY "revenue_entries_owner" ON "revenue_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "revenue_entries"."user_id") WITH CHECK ((select auth.uid()) = "revenue_entries"."user_id");--> statement-breakpoint
CREATE POLICY "review_cards_owner" ON "review_cards" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "review_cards"."user_id") WITH CHECK ((select auth.uid()) = "review_cards"."user_id");--> statement-breakpoint
CREATE POLICY "review_logs_owner" ON "review_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "review_logs"."user_id") WITH CHECK ((select auth.uid()) = "review_logs"."user_id");--> statement-breakpoint
CREATE POLICY "settings_owner" ON "settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "settings"."user_id") WITH CHECK ((select auth.uid()) = "settings"."user_id");--> statement-breakpoint
CREATE POLICY "sops_owner" ON "sops" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "sops"."user_id") WITH CHECK ((select auth.uid()) = "sops"."user_id");--> statement-breakpoint
CREATE POLICY "study_sessions_owner" ON "study_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "study_sessions"."user_id") WITH CHECK ((select auth.uid()) = "study_sessions"."user_id");--> statement-breakpoint
CREATE POLICY "submissions_owner" ON "submissions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "submissions"."user_id") WITH CHECK ((select auth.uid()) = "submissions"."user_id");--> statement-breakpoint
CREATE POLICY "template_instances_owner" ON "template_instances" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "template_instances"."user_id") WITH CHECK ((select auth.uid()) = "template_instances"."user_id");--> statement-breakpoint
CREATE POLICY "xp_events_owner" ON "xp_events" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "xp_events"."user_id") WITH CHECK ((select auth.uid()) = "xp_events"."user_id");