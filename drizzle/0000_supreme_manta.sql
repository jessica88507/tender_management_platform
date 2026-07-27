CREATE TYPE "public"."simple_team_kind" AS ENUM('architect', 'mep');--> statement-breakpoint
CREATE TYPE "public"."team_group" AS ENUM('architect', 'jianguo');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"work_start" date NOT NULL,
	"tender_start" date NOT NULL,
	"deadline" timestamp NOT NULL,
	"bid_lead_name" text DEFAULT '' NOT NULL,
	"bid_lead_user_id" text,
	"meeting_weekday" integer DEFAULT 2 NOT NULL,
	"contract_amount" numeric(18, 0) DEFAULT '0' NOT NULL,
	"site_area" double precision DEFAULT 0 NOT NULL,
	"floor_area" double precision DEFAULT 0 NOT NULL,
	"floor_count" text DEFAULT '' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultants" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"role" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"affiliation" text DEFAULT '' NOT NULL,
	"is_custom" boolean DEFAULT true NOT NULL,
	"team_group" "team_group",
	"sort_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"cat" text NOT NULL,
	"label" text NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"due" date NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"milestone" text,
	"sync_to_outlook" boolean DEFAULT false NOT NULL,
	"outlook_event_id" text,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"kind" "simple_team_kind" NOT NULL,
	"name" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"department" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "week_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"week_start" date NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_bid_lead_user_id_users_id_fk" FOREIGN KEY ("bid_lead_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultants" ADD CONSTRAINT "consultants_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_notes" ADD CONSTRAINT "week_notes_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cases_bid_lead_user_id_idx" ON "cases" USING btree ("bid_lead_user_id");--> statement-breakpoint
CREATE INDEX "consultants_case_id_idx" ON "consultants" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "tasks_case_id_idx" ON "tasks" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "tasks_case_id_due_idx" ON "tasks" USING btree ("case_id","due");--> statement-breakpoint
CREATE INDEX "team_members_case_id_idx" ON "team_members" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "week_notes_case_week_idx" ON "week_notes" USING btree ("case_id","week_start");