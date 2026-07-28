CREATE TYPE "public"."task_template_anchor" AS ENUM('start', 'workStart', 'deadline');--> statement-breakpoint
CREATE TYPE "public"."task_template_kind" AS ENUM('fixed', 'ratio', 'special');--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"kind" "task_template_kind" NOT NULL,
	"anchor" "task_template_anchor",
	"offset_days" integer,
	"ratio_pct" double precision,
	"snap" boolean DEFAULT true NOT NULL,
	"milestone" text,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "auto_due" date;