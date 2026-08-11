CREATE TYPE "public"."usage_billing" AS ENUM('separate', 'allowance', 'included');--> statement-breakpoint
ALTER TABLE "pricing_packages" ALTER COLUMN "is_placeholder" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "pricing_packages" ADD COLUMN "is_from_pricing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_packages" ADD COLUMN "usage_billing" "usage_billing" DEFAULT 'separate' NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_packages" ADD COLUMN "estimated_monthly_usage_cost_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_packages" ADD COLUMN "usage_allowance_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pricing_packages" ADD COLUMN "assumptions_reviewed" boolean DEFAULT false NOT NULL;