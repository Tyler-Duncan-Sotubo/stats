CREATE TABLE "ask_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"slug" text NOT NULL,
	"tool_used" text,
	"answer" text,
	"ask_count" integer DEFAULT 1 NOT NULL,
	"last_asked" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ask_questions_slug_idx" ON "ask_questions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ask_questions_last_asked_idx" ON "ask_questions" USING btree ("last_asked");