CREATE TABLE "chart_entry_snapshots" (
	"entry_id" uuid PRIMARY KEY NOT NULL,
	"prev_rank" smallint,
	"delta" smallint,
	"trend" varchar DEFAULT 'NEW' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chart_entry_snapshots" ADD CONSTRAINT "chart_entry_snapshots_entry_id_chart_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."chart_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_snapshot_entry" ON "chart_entry_snapshots" USING btree ("entry_id");