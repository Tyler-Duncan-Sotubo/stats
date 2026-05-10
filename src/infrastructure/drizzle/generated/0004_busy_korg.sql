CREATE TABLE "milestone_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid,
	"song_id" uuid,
	"metric" text NOT NULL,
	"threshold" bigint NOT NULL,
	"crossed_at" date NOT NULL,
	"stream_value_at_crossing" bigint,
	"notified_at" timestamp,
	"tweet_id" text,
	"tweet_text" text,
	"is_afrobeats" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "milestone_events_unique_idx" ON "milestone_events" USING btree ("artist_id","song_id","metric","threshold");--> statement-breakpoint
CREATE INDEX "milestone_events_artist_idx" ON "milestone_events" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "milestone_events_song_idx" ON "milestone_events" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "milestone_events_crossed_at_idx" ON "milestone_events" USING btree ("crossed_at");--> statement-breakpoint
CREATE INDEX "milestone_events_notified_idx" ON "milestone_events" USING btree ("notified_at");--> statement-breakpoint
CREATE INDEX "milestone_events_is_afrobeats_idx" ON "milestone_events" USING btree ("is_afrobeats");