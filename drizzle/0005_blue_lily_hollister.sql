ALTER TABLE "cases" ADD COLUMN "owner_org" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "user_unit" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "contract_mode" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "contract_scope" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "supervisor_unit" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "building_type" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "construction_period" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "special_notes" text DEFAULT '' NOT NULL;