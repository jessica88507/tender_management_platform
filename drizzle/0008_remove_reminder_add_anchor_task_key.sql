-- Custom SQL migration file, put your code below! --
ALTER TABLE "tasks" DROP COLUMN "reminder_only";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "reminder_days";--> statement-breakpoint
ALTER TABLE "task_templates" DROP COLUMN "reminder_only";--> statement-breakpoint
ALTER TABLE "task_templates" DROP COLUMN "reminder_days";--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN "anchor_task_key" text;