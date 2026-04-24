CREATE TABLE "artist_audiomack_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid NOT NULL,
	"audiomack_id" text,
	"audiomack_slug" text,
	"snapshot_date" date NOT NULL,
	"total_plays" bigint,
	"monthly_plays" bigint,
	"daily_plays" bigint,
	"followers" bigint,
	"favorites" bigint,
	"source" text DEFAULT 'audiomack' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_audiomack_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"audiomack_id" text,
	"audiomack_url" text,
	"snapshot_date" date NOT NULL,
	"total_plays" bigint,
	"daily_plays" bigint,
	"downloads" bigint,
	"favorites" bigint,
	"reposts" bigint,
	"source" text DEFAULT 'audiomack' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artist_audiomack_snapshots" ADD CONSTRAINT "artist_audiomack_snapshots_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_audiomack_snapshots" ADD CONSTRAINT "song_audiomack_snapshots_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_artist_audiomack_snapshot" ON "artist_audiomack_snapshots" USING btree ("artist_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_aams_snapshot_date" ON "artist_audiomack_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_aams_total_plays" ON "artist_audiomack_snapshots" USING btree ("snapshot_date","total_plays");--> statement-breakpoint
CREATE INDEX "idx_aams_daily_plays" ON "artist_audiomack_snapshots" USING btree ("snapshot_date","daily_plays");--> statement-breakpoint
CREATE INDEX "idx_aams_artist" ON "artist_audiomack_snapshots" USING btree ("artist_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_aams_audiomack_id" ON "artist_audiomack_snapshots" USING btree ("audiomack_id");--> statement-breakpoint
CREATE INDEX "idx_aams_audiomack_slug" ON "artist_audiomack_snapshots" USING btree ("audiomack_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_song_audiomack_snapshot" ON "song_audiomack_snapshots" USING btree ("song_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_sams_snapshot_date" ON "song_audiomack_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_sams_total_plays" ON "song_audiomack_snapshots" USING btree ("snapshot_date","total_plays");--> statement-breakpoint
CREATE INDEX "idx_sams_daily_plays" ON "song_audiomack_snapshots" USING btree ("snapshot_date","daily_plays");--> statement-breakpoint
CREATE INDEX "idx_sams_song" ON "song_audiomack_snapshots" USING btree ("song_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_sams_audiomack_id" ON "song_audiomack_snapshots" USING btree ("audiomack_id");