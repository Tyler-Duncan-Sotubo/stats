import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { songs } from 'src/infrastructure/drizzle/schema';

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
}
