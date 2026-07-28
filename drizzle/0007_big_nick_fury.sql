ALTER TABLE "task_templates" ADD COLUMN "reminder_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN "reminder_days" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "linked_task_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "link_offset_days" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reminder_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reminder_days" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");