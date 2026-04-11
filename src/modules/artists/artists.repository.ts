import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { artists, artistGenres } from '../../infrastructure/drizzle/schema';
import { eq, inArray, sql } from 'drizzle-orm';

@Injectable()
export class ArtistsRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async upsertBySpotifyId(data: typeof artists.$inferInsert) {
    const [result] = await this.db
      .insert(artists)
      .values(data)
      .onConflictDoUpdate({
        target: artists.spotifyId,
        set: {
          name: sql`excluded.name`,
          imageUrl: sql`excluded.image_url`,
          popularity: sql`excluded.popularity`,
          isAfrobeats: sql`excluded.is_afrobeats`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return result;
  }

  upsertManyBySpotifyId(data: (typeof artists.$inferInsert)[]) {
    if (!data.length) return [];

    return this.db
      .insert(artists)
      .values(data)
      .onConflictDoUpdate({
        target: artists.spotifyId,
        set: {
          name: sql`excluded.name`,
          imageUrl: sql`excluded.image_url`,
          popularity: sql`excluded.popularity`,
          isAfrobeats: sql`excluded.is_afrobeats`,
          updatedAt: sql`now()`,
        },
      })
      .returning();
  }

  async findBySpotifyId(spotifyId: string) {
    const [result] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.spotifyId, spotifyId))
      .limit(1);

    return result ?? null;
  }

  async findBySpotifyIds(spotifyIds: string[]) {
    if (!spotifyIds.length) return [];

    return this.db
      .select()
      .from(artists)
      .where(inArray(artists.spotifyId, spotifyIds));
  }

  async findBySlug(slug: string) {
    const [result] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.slug, slug))
      .limit(1);

    return result ?? null;
  }

  async findById(id: string) {
    const [result] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.id, id))
      .limit(1);

    return result ?? null;
  }

  async upsertGenres(
    artistId: string,
    genres: { genre: string; isPrimary: boolean }[],
  ) {
    if (!genres.length) return;

    const values = genres.map((g) => ({
      artistId,
      genre: g.genre,
      isPrimary: g.isPrimary,
    }));

    await this.db
      .insert(artistGenres)
      .values(values)
      .onConflictDoUpdate({
        target: [artistGenres.artistId, artistGenres.genre],
        set: { isPrimary: sql`excluded.is_primary` },
      });
  }

  async getExistingSpotifyIds(spotifyIds: string[]): Promise<string[]> {
    if (!spotifyIds.length) return [];

    const rows = await this.db
      .select({ spotifyId: artists.spotifyId })
      .from(artists)
      .where(inArray(artists.spotifyId, spotifyIds));

    return rows.map((r) => r.spotifyId);
  }
}
