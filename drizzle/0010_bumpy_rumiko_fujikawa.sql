ALTER TYPE "public"."simple_team_kind" ADD VALUE 'extra';--> statement-breakpoint
ALTER TYPE "public"."team_group" ADD VALUE 'extra';--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "architect_team_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "extra_team_name" text DEFAULT '' NOT NULL;