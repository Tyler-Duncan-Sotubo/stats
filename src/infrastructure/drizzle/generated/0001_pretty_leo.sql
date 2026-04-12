DROP INDEX "artist_stats_monthly_listeners_idx";--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "total_streams" bigint;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "total_streams_as_lead" bigint;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "total_streams_solo" bigint;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "total_streams_as_feature" bigint;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "daily_streams" bigint;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "daily_streams_as_lead" bigint;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "daily_streams_as_feature" bigint;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "track_count" integer;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "source_updated_at" date;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "artist_stats_total_streams_idx" ON "artist_stats_snapshots" USING btree ("total_streams");--> statement-breakpoint
CREATE INDEX "artist_stats_daily_streams_idx" ON "artist_stats_snapshots" USING btree ("daily_streams");--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" DROP COLUMN "spotify_monthly_listeners";--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" DROP COLUMN "spotify_followers";--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" DROP COLUMN "popularity";