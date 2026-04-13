import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { songs } from 'src/infrastructure/drizzle/schema';
import slugify from 'slugify';

@Injectable()
export class SongsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findBySpotifyTrackId(spotifyTrackId: string) {
    const [row] = await this.db
      .select()
      .from(songs)
      .where(eq(songs.spotifyTrackId, spotifyTrackId))
      .limit(1);

    return row ?? null;
  }

  async findBySpotifyTrackIds(spotifyTrackIds: string[]) {
    if (!spotifyTrackIds.length) return [];

    return this.db
      .select()
      .from(songs)
      .where(inArray(songs.spotifyTrackId, spotifyTrackIds));
  }

  async findSongsNeedingEnrichment(limit = 100) {
    return this.db
      .select({
        id: songs.id,
        artistId: songs.artistId,
        spotifyTrackId: songs.spotifyTrackId,
        title: songs.title,
        albumId: songs.albumId,
        releaseDate: songs.releaseDate,
        durationMs: songs.durationMs,
        imageUrl: songs.imageUrl,
      })
      .from(songs)
      .where(
        sql`(
        ${songs.albumId} is null
        or ${songs.releaseDate} is null
        or ${songs.durationMs} is null
        or ${songs.imageUrl} is null
      )`,
      )
      .limit(limit);
  }

  async upsertBySpotifyTrackId(data: typeof songs.$inferInsert) {
    const [row] = await this.db
      .insert(songs)
      .values(data)
      .onConflictDoUpdate({
        target: songs.spotifyTrackId,
        set: {
          title: sql`excluded.title`,
          albumId: sql`excluded.album_id`,
          releaseDate: sql`excluded.release_date`,
          durationMs: sql`excluded.duration_ms`,
          explicit: sql`excluded.explicit`,
          imageUrl: sql`excluded.image_url`,
        },
      })
      .returning();

    return row;
  }

  async upsertManyBySpotifyTrackId(data: (typeof songs.$inferInsert)[]) {
    if (!data.length) return [];

    return this.db
      .insert(songs)
      .values(data)
      .onConflictDoUpdate({
        target: songs.spotifyTrackId,
        set: {
          title: sql`excluded.title`,
          albumId: sql`excluded.album_id`,
          releaseDate: sql`excluded.release_date`,
          durationMs: sql`excluded.duration_ms`,
          explicit: sql`excluded.explicit`,
          imageUrl: sql`excluded.image_url`,
        },
      })
      .returning();
  }

  // songs.repository.ts — add these methods
  async upsertScraperFields(data: typeof songs.$inferInsert) {
    const [row] = await this.db
      .insert(songs)
      .values(data)
      .onConflictDoUpdate({
        target: songs.spotifyTrackId,
        set: {
          title: sql`excluded.title`,
          albumId: sql`excluded.album_id`,
          releaseDate: sql`excluded.release_date`,
          durationMs: sql`excluded.duration_ms`,
          explicit: sql`excluded.explicit`,
          imageUrl: sql`excluded.image_url`,
          // isAfrobeats deliberately excluded
        },
      })
      .returning();

    return row;
  }

  async upsertManyScraperFields(data: (typeof songs.$inferInsert)[]) {
    if (!data.length) return [];

    return this.db
      .insert(songs)
      .values(data)
      .onConflictDoUpdate({
        target: songs.spotifyTrackId,
        set: {
          title: sql`excluded.title`,
          albumId: sql`excluded.album_id`,
          releaseDate: sql`excluded.release_date`,
          durationMs: sql`excluded.duration_ms`,
          explicit: sql`excluded.explicit`,
          imageUrl: sql`excluded.image_url`,
          // isAfrobeats deliberately excluded
        },
      })
      .returning();
  }

  // ── Dashboard writes — full control ──────────────────────────────────

  async upsertAllFields(data: typeof songs.$inferInsert) {
    const [row] = await this.db
      .insert(songs)
      .values(data)
      .onConflictDoUpdate({
        target: songs.spotifyTrackId,
        set: {
          title: sql`excluded.title`,
          albumId: sql`excluded.album_id`,
          releaseDate: sql`excluded.release_date`,
          durationMs: sql`excluded.duration_ms`,
          explicit: sql`excluded.explicit`,
          imageUrl: sql`excluded.image_url`,
          isAfrobeats: sql`excluded.is_afrobeats`,
        },
      })
      .returning();

    return row;
  }

  async updateById(id: string, data: Partial<typeof songs.$inferInsert>) {
    const [row] = await this.db
      .update(songs)
      .set(data)
      .where(eq(songs.id, id))
      .returning();

    return row;
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    return row ?? null;
  }

  // songs.repository.ts

  async findByArtistId(artistId: string) {
    return this.db
      .select({ id: songs.id, title: songs.title })
      .from(songs)
      .where(eq(songs.artistId, artistId));
  }

  // songs.repository.ts

  async createFromCertification(input: { artistId: string; title: string }) {
    // Clean the title before storing — strip RIAA uppercase and feat suffixes
    const cleanTitle = this.cleanCertTitle(input.title);
    const slug = this.makeSlug(cleanTitle, input.artistId);

    const [existing] = await this.db
      .select({ id: songs.id, title: songs.title })
      .from(songs)
      .where(eq(songs.slug, slug))
      .limit(1);

    if (existing) return existing;

    const [created] = await this.db
      .insert(songs)
      .values({
        artistId: input.artistId,
        title: cleanTitle,
        slug,
        isAfrobeats: false,
        explicit: false,
        // No spotifyTrackId yet — enrichment cron will fill it in
        // once Kworb snapshot or Spotify enrichment runs
      })
      .onConflictDoUpdate({
        target: songs.slug,
        set: { title: cleanTitle },
      })
      .returning({ id: songs.id, title: songs.title });

    return created ?? null;
  }

  // Title cleaning — RIAA titles are ALL CAPS with featured artist suffixes
  // "GOD'S PLAN" → "God's Plan"
  // "CHICAGO FREESTYLE (FT. GIVEON)" → "Chicago Freestyle"
  private cleanCertTitle(raw: string): string {
    return raw
      .replace(/\s*\(feat\.?.*?\)/gi, '')
      .replace(/\s*\(ft\.?.*?\)/gi, '')
      .replace(/\s*\[feat\.?.*?\]/gi, '')
      .trim()
      .toLowerCase()
      .replace(/(^\w|\s\w)/g, (c) => c.toUpperCase()); // Title Case
  }

  private makeSlug(title: string, artistId: string): string {
    const suffix = artistId.slice(-6);
    return slugify(`${title}-${suffix}`, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
}
