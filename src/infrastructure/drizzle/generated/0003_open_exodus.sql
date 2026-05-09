CREATE TABLE "song_albums" (
	"id" uuid PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"album_id" uuid NOT NULL,
	"track_number" integer,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "song_albums" ADD CONSTRAINT "song_albums_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_albums" ADD CONSTRAINT "song_albums_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "song_albums_song_album_idx" ON "song_albums" USING btree ("song_id","album_id");--> statement-breakpoint
CREATE INDEX "song_albums_album_idx" ON "song_albums" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "song_albums_song_idx" ON "song_albums" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "song_albums_is_primary_idx" ON "song_albums" USING btree ("is_primary");