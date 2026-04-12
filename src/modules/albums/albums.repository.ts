import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { albums } from 'src/infrastructure/drizzle/schema';

@Injectable()
export class AlbumsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findBySpotifyAlbumId(spotifyAlbumId: string) {
    const [row] = await this.db
      .select()
      .from(albums)
      .where(eq(albums.spotifyAlbumId, spotifyAlbumId))
      .limit(1);

    return row ?? null;
  }

  async findBySpotifyAlbumIds(spotifyAlbumIds: string[]) {
    if (!spotifyAlbumIds.length) return [];

    return this.db
      .select()
      .from(albums)
      .where(inArray(albums.spotifyAlbumId, spotifyAlbumIds));
  }

  async upsertBySpotifyAlbumId(data: typeof albums.$inferInsert) {
    const [row] = await this.db
      .insert(albums)
      .values(data)
      .onConflictDoUpdate({
        target: albums.spotifyAlbumId,
        set: {
          artistId: sql`excluded.artist_id`,
          title: sql`excluded.title`,
          slug: sql`excluded.slug`,
          albumType: sql`excluded.album_type`,
          releaseDate: sql`excluded.release_date`,
          imageUrl: sql`excluded.image_url`,
          totalTracks: sql`excluded.total_tracks`,
          isAfrobeats: sql`excluded.is_afrobeats`,
        },
      })
      .returning();

    return row;
  }

  async upsertManyBySpotifyAlbumId(data: (typeof albums.$inferInsert)[]) {
    if (!data.length) return [];

    return this.db
      .insert(albums)
      .values(data)
      .onConflictDoUpdate({
        target: albums.spotifyAlbumId,
        set: {
          artistId: sql`excluded.artist_id`,
          title: sql`excluded.title`,
          slug: sql`excluded.slug`,
          albumType: sql`excluded.album_type`,
          releaseDate: sql`excluded.release_date`,
          imageUrl: sql`excluded.image_url`,
          totalTracks: sql`excluded.total_tracks`,
          isAfrobeats: sql`excluded.is_afrobeats`,
        },
      })
      .returning();
  }
}
