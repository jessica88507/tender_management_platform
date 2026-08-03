CREATE TABLE "vendor_directory" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
