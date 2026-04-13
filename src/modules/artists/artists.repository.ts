import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { artists, artistGenres } from '../../infrastructure/drizzle/schema';
import { eq, inArray, sql, isNull, isNotNull, and } from 'drizzle-orm';

@Injectable()
export class ArtistsRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // artists.repository.ts — add this method

  async upsertManyDiscovered(
    data: { name: string; spotifyId: string; slug: string }[],
  ) {
    if (!data.length) return [];

    return this.db
      .insert(artists)
      .values(data)
      .onConflictDoUpdate({
        target: artists.spotifyId,
        set: {
          // only update name if it changed — don't touch enriched fields
          name: sql`excluded.name`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: artists.id, spotifyId: artists.spotifyId });
  }

  // separate method to find artists that haven't been enriched yet
  async findUnenriched(limit = 100) {
    return this.db
      .select({ id: artists.id, spotifyId: artists.spotifyId })
      .from(artists)
      .where(isNull(artists.imageUrl)) // imageUrl is null = never enriched
      .limit(limit);
  }

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

  async findAllWithSpotifyId() {
    return this.db
      .select({
        id: artists.id,
        name: artists.name,
        spotifyId: artists.spotifyId,
      })
      .from(artists)
      .where(
        sql`
        ${artists.spotifyId} IS NOT NULL
        AND (${artists.kworbStatus} IS NULL OR ${artists.kworbStatus} != 'not_found')
      `,
      );
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
      .where(
        and(
          isNotNull(artists.spotifyId),
          inArray(artists.spotifyId, spotifyIds),
        ),
      );

    return rows
      .map((r) => r.spotifyId)
      .filter((id): id is string => id !== null);
  }

  async updateById(id: string, data: Partial<typeof artists.$inferInsert>) {
    const [updated] = await this.db
      .update(artists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(artists.id, id))
      .returning();

    return updated;
  }

  async markKworbNotFound(artistId: string) {
    await this.db
      .update(artists)
      .set({
        kworbStatus: 'not_found',
        kworbLastCheckedAt: new Date(),
      })
      .where(eq(artists.id, artistId));
  }

  // artists.repository.ts

  async updateSpotifyId(id: string, spotifyId: string): Promise<void> {
    await this.db
      .update(artists)
      .set({ spotifyId, updatedAt: new Date() })
      .where(eq(artists.id, id));
  }

  async findAllBasic() {
    return this.db
      .select({
        id: artists.id,
        name: artists.name,
        slug: artists.slug,
        spotifyId: artists.spotifyId,
      })
      .from(artists);
  }
}
