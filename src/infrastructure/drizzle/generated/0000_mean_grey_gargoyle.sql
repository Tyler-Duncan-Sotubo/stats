
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" "role" DEFAULT 'contributor' NOT NULL,
	"location" text,
	"avatar" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"spotify_album_id" text NOT NULL,
	"album_type" text DEFAULT 'album' NOT NULL,
	"release_date" date,
	"image_url" text,
	"total_tracks" integer,
	"is_afrobeats" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_genres" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid NOT NULL,
	"genre" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_stats_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid NOT NULL,
	"total_streams" bigint,
	"total_streams_as_lead" bigint,
	"total_streams_solo" bigint,
	"total_streams_as_feature" bigint,
	"daily_streams" bigint,
	"daily_streams_as_lead" bigint,
	"daily_streams_as_feature" bigint,
	"track_count" integer,
	"source_updated_at" date,
	"snapshot_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"spotify_id" text,
	"slug" text NOT NULL,
	"origin_country" text,
	"debut_year" integer,
	"image_url" text,
	"popularity" integer,
	"is_afrobeats" boolean DEFAULT false NOT NULL,
	"is_afrobeats_override" boolean DEFAULT false NOT NULL,
	"bio" text,
	"kworb_status" text,
	"kworb_last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid,
	"song_id" uuid,
	"album_id" uuid,
	"award_body" text NOT NULL,
	"award_name" text NOT NULL,
	"category" text NOT NULL,
	"result" text NOT NULL,
	"year" integer NOT NULL,
	"ceremony" text,
	"territory" text,
	"source_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid,
	"song_id" uuid,
	"album_id" uuid,
	"territory" text NOT NULL,
	"body" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"level" text NOT NULL,
	"units" bigint,
	"certified_at" date,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "chart_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid,
	"song_id" uuid,
	"album_id" uuid,
	"chart_name" text NOT NULL,
	"chart_territory" text,
	"position" integer NOT NULL,
	"peak_position" integer,
	"weeks_on_chart" integer,
	"chart_week" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid,
	"song_id" uuid,
	"album_id" uuid,
	"record_type" text NOT NULL,
	"record_value" text NOT NULL,
	"numeric_value" bigint,
	"scope" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"set_on" date,
	"broken_on" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "song_features" (
	"id" uuid PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"featured_artist_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_stats_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"spotify_streams" bigint,
	"snapshot_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"artist_id" uuid NOT NULL,
	"album_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"spotify_track_id" text,
	"release_date" date,
	"duration_ms" integer,
	"explicit" boolean DEFAULT false NOT NULL,
	"is_afrobeats" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_genres" ADD CONSTRAINT "artist_genres_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_stats_snapshots" ADD CONSTRAINT "artist_stats_snapshots_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_records" ADD CONSTRAINT "award_records_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_records" ADD CONSTRAINT "award_records_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_records" ADD CONSTRAINT "award_records_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_features" ADD CONSTRAINT "song_features_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_features" ADD CONSTRAINT "song_features_featured_artist_id_artists_id_fk" FOREIGN KEY ("featured_artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_stats_snapshots" ADD CONSTRAINT "song_stats_snapshots_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "albums_spotify_album_id_idx" ON "albums" USING btree ("spotify_album_id");--> statement-breakpoint
CREATE INDEX "albums_artist_id_idx" ON "albums" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "albums_release_date_idx" ON "albums" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "albums_is_afrobeats_idx" ON "albums" USING btree ("is_afrobeats");--> statement-breakpoint
CREATE UNIQUE INDEX "artist_genres_artist_genre_idx" ON "artist_genres" USING btree ("artist_id","genre");--> statement-breakpoint
CREATE INDEX "artist_genres_genre_idx" ON "artist_genres" USING btree ("genre");--> statement-breakpoint
CREATE UNIQUE INDEX "artist_stats_artist_date_idx" ON "artist_stats_snapshots" USING btree ("artist_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "artist_stats_snapshot_date_idx" ON "artist_stats_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "artist_stats_total_streams_idx" ON "artist_stats_snapshots" USING btree ("total_streams");--> statement-breakpoint
CREATE INDEX "artist_stats_daily_streams_idx" ON "artist_stats_snapshots" USING btree ("daily_streams");--> statement-breakpoint
CREATE UNIQUE INDEX "artists_spotify_id_idx" ON "artists" USING btree ("spotify_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artists_slug_idx" ON "artists" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "artists_origin_country_idx" ON "artists" USING btree ("origin_country");--> statement-breakpoint
CREATE INDEX "artists_is_afrobeats_idx" ON "artists" USING btree ("is_afrobeats");--> statement-breakpoint
CREATE INDEX "artists_popularity_idx" ON "artists" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "awards_artist_idx" ON "award_records" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "awards_year_idx" ON "award_records" USING btree ("year");--> statement-breakpoint
CREATE INDEX "awards_body_idx" ON "award_records" USING btree ("award_body");--> statement-breakpoint
CREATE INDEX "awards_result_idx" ON "award_records" USING btree ("result");--> statement-breakpoint
CREATE UNIQUE INDEX "awards_unique_idx" ON "award_records" USING btree ("artist_id","award_body","award_name","year");--> statement-breakpoint
CREATE INDEX "certs_artist_territory_idx" ON "certifications" USING btree ("artist_id","territory");--> statement-breakpoint
CREATE INDEX "certs_song_territory_idx" ON "certifications" USING btree ("song_id","territory");--> statement-breakpoint
CREATE INDEX "certs_territory_level_idx" ON "certifications" USING btree ("territory","level");--> statement-breakpoint
CREATE INDEX "certs_certified_at_idx" ON "certifications" USING btree ("certified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "certs_unique_idx" ON "certifications" USING btree ("artist_id","territory","body","title");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_entries_song_chart_week_idx" ON "chart_entries" USING btree ("song_id","chart_name","chart_week");--> statement-breakpoint
CREATE INDEX "chart_entries_chart_week_idx" ON "chart_entries" USING btree ("chart_name","chart_week");--> statement-breakpoint
CREATE INDEX "chart_entries_artist_chart_idx" ON "chart_entries" USING btree ("artist_id","chart_name");--> statement-breakpoint
CREATE INDEX "chart_entries_position_idx" ON "chart_entries" USING btree ("chart_name","position");--> statement-breakpoint
CREATE INDEX "chart_entries_peak_idx" ON "chart_entries" USING btree ("chart_name","peak_position");--> statement-breakpoint
CREATE INDEX "records_scope_type_idx" ON "records" USING btree ("scope","record_type");--> statement-breakpoint
CREATE INDEX "records_artist_idx" ON "records" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "records_song_idx" ON "records" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "records_is_active_idx" ON "records" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "records_numeric_value_idx" ON "records" USING btree ("record_type","numeric_value");--> statement-breakpoint
CREATE UNIQUE INDEX "song_features_song_artist_idx" ON "song_features" USING btree ("song_id","featured_artist_id");--> statement-breakpoint
CREATE INDEX "song_features_featured_artist_idx" ON "song_features" USING btree ("featured_artist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "song_stats_song_date_idx" ON "song_stats_snapshots" USING btree ("song_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "song_stats_snapshot_date_idx" ON "song_stats_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "song_stats_streams_idx" ON "song_stats_snapshots" USING btree ("spotify_streams");--> statement-breakpoint
CREATE UNIQUE INDEX "songs_spotify_track_id_idx" ON "songs" USING btree ("spotify_track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "songs_slug_idx" ON "songs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "songs_artist_id_idx" ON "songs" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "songs_album_id_idx" ON "songs" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "songs_release_date_idx" ON "songs" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "songs_is_afrobeats_idx" ON "songs" USING btree ("is_afrobeats");