import { Inject, Injectable } from '@nestjs/common';
import {
  artists,
  artistAliases,
  artistGenres,
  artistExternalIds,
  artistMonthlyListenerSnapshots,
  songs,
} from 'src/infrastructure/drizzle/schema';
import { eq, ilike, and, sql, isNull, inArray, isNotNull } from 'drizzle-orm';
import { CreateArtistInput } from './inputs/create-artist.input';
import { UpdateArtistInput } from './inputs/update-artist.input';
import { FindArtistsInput } from './inputs/find-artists.input';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';

@Injectable()
export class ArtistsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Find ──────────────────────────────────────────────────────────────────

  async findAll(input: FindArtistsInput) {
    const {
      search,
      originCountry,
      isAfrobeats,
      entityStatus,
      needsReview,
      page,
      limit,
    } = input;
    const offset = (page - 1) * limit;

    const conditions = [isNull(artists.mergedIntoArtistId)];

    if (search) conditions.push(ilike(artists.name, `%${search}%`));
    if (originCountry)
      conditions.push(eq(artists.originCountry, originCountry));
    if (isAfrobeats !== undefined)
      conditions.push(eq(artists.isAfrobeats, isAfrobeats));
    if (entityStatus) conditions.push(eq(artists.entityStatus, entityStatus));
    if (needsReview !== undefined)
      conditions.push(eq(artists.needsReview, needsReview));

    const where = and(...conditions);

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(artists)
        .where(where)
        .orderBy(artists.name)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(artists)
        .where(where),
    ]);

    return { rows, total: Number(count) };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.id, id))
      .limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async findBySpotifyId(spotifyId: string) {
    const [row] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.spotifyId, spotifyId))
      .limit(1);
    return row ?? null;
  }

  async findAllWithSpotifyId() {
    const latestListeners = this.db
      .select({
        artistId: artistMonthlyListenerSnapshots.artistId,
        monthlyListeners: artistMonthlyListenerSnapshots.monthlyListeners,
        rn: sql<number>`ROW_NUMBER() OVER (
          PARTITION BY ${artistMonthlyListenerSnapshots.artistId}
          ORDER BY ${artistMonthlyListenerSnapshots.snapshotDate} DESC
        )`.as('rn'),
      })
      .from(artistMonthlyListenerSnapshots)
      .as('latest_listeners');

    return this.db
      .select({
        id: artists.id,
        spotifyId: artists.spotifyId,
        name: artists.name,
        monthlyListeners: sql<number>`COALESCE(${latestListeners.monthlyListeners}, 0)`,
      })
      .from(artists)
      .leftJoin(
        latestListeners,
        and(
          eq(latestListeners.artistId, artists.id),
          eq(latestListeners.rn, 1),
        ),
      )
      .where(isNotNull(artists.spotifyId));
  }

  async findAllBasic() {
    return this.db
      .select({
        id: artists.id,
        name: artists.name,
        spotifyId: artists.spotifyId,
      })
      .from(artists)
      .where(isNull(artists.mergedIntoArtistId));
  }

  async findWithRelations(id: string) {
    const artist = await this.findById(id);
    if (!artist) return null;

    const [aliases, genres, externalIds] = await Promise.all([
      this.db
        .select()
        .from(artistAliases)
        .where(eq(artistAliases.artistId, id)),
      this.db.select().from(artistGenres).where(eq(artistGenres.artistId, id)),
      this.db
        .select()
        .from(artistExternalIds)
        .where(eq(artistExternalIds.artistId, id)),
    ]);

    return { ...artist, aliases, genres, externalIds };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: CreateArtistInput) {
    const [created] = await this.db.insert(artists).values(input).returning();
    return created;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateArtistInput) {
    const [updated] = await this.db
      .update(artists)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(artists.id, id))
      .returning();
    return updated ?? null;
  }

  async updateSongsByArtistId(
    artistId: string,
    values: { isAfrobeats: boolean },
  ): Promise<void> {
    await this.db
      .update(songs)
      .set({ isAfrobeats: values.isAfrobeats })
      .where(
        and(
          eq(songs.artistId, artistId),
          inArray(songs.entityStatus, ['canonical', 'provisional']),
        ),
      );
  }

  async merge(sourceId: string, targetId: string) {
    const [updated] = await this.db
      .update(artists)
      .set({
        mergedIntoArtistId: targetId,
        entityStatus: 'merged',
        updatedAt: new Date(),
      })
      .where(eq(artists.id, sourceId))
      .returning();
    return updated ?? null;
  }

  async flagForReview(id: string, flag: boolean) {
    const [updated] = await this.db
      .update(artists)
      .set({ needsReview: flag, updatedAt: new Date() })
      .where(eq(artists.id, id))
      .returning();
    return updated ?? null;
  }

  async bulkUpdate(
    ids: string[],
    input: {
      originCountry?: string;
      isAfrobeats?: boolean;
      needsReview?: boolean;
    },
  ) {
    return this.db
      .update(artists)
      .set({ ...input, updatedAt: new Date() })
      .where(inArray(artists.id, ids))
      .returning();
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(artists)
      .where(eq(artists.id, id))
      .returning();
    return deleted ?? null;
  }

  // ── Aliases ───────────────────────────────────────────────────────────────

  async findAliases(artistId: string) {
    return this.db
      .select()
      .from(artistAliases)
      .where(eq(artistAliases.artistId, artistId));
  }

  async addAlias(
    artistId: string,
    input: {
      alias: string;
      normalizedAlias: string;
      source?: string;
      isPrimary?: boolean;
    },
  ) {
    const [created] = await this.db
      .insert(artistAliases)
      .values({ artistId, ...input })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }

  async setPrimaryAlias(artistId: string, aliasId: string) {
    // Unset all primary first, then set the target
    await this.db
      .update(artistAliases)
      .set({ isPrimary: false })
      .where(eq(artistAliases.artistId, artistId));

    const [updated] = await this.db
      .update(artistAliases)
      .set({ isPrimary: true })
      .where(
        and(
          eq(artistAliases.id, aliasId),
          eq(artistAliases.artistId, artistId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async deleteAlias(artistId: string, aliasId: string) {
    const [deleted] = await this.db
      .delete(artistAliases)
      .where(
        and(
          eq(artistAliases.id, aliasId),
          eq(artistAliases.artistId, artistId),
        ),
      )
      .returning();
    return deleted ?? null;
  }

  // ── Genres ────────────────────────────────────────────────────────────────

  async findGenres(artistId: string) {
    return this.db
      .select()
      .from(artistGenres)
      .where(eq(artistGenres.artistId, artistId));
  }

  async addGenre(
    artistId: string,
    input: {
      genre: string;
      isPrimary?: boolean;
    },
  ) {
    const [created] = await this.db
      .insert(artistGenres)
      .values({ artistId, ...input })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }

  async setPrimaryGenre(artistId: string, genreId: string) {
    await this.db
      .update(artistGenres)
      .set({ isPrimary: false })
      .where(eq(artistGenres.artistId, artistId));

    const [updated] = await this.db
      .update(artistGenres)
      .set({ isPrimary: true })
      .where(
        and(eq(artistGenres.id, genreId), eq(artistGenres.artistId, artistId)),
      )
      .returning();
    return updated ?? null;
  }

  async deleteGenre(artistId: string, genreId: string) {
    const [deleted] = await this.db
      .delete(artistGenres)
      .where(
        and(eq(artistGenres.id, genreId), eq(artistGenres.artistId, artistId)),
      )
      .returning();
    return deleted ?? null;
  }

  // ── External IDs ──────────────────────────────────────────────────────────

  async findExternalIds(artistId: string) {
    return this.db
      .select()
      .from(artistExternalIds)
      .where(eq(artistExternalIds.artistId, artistId));
  }

  async addExternalId(
    artistId: string,
    input: {
      source: string;
      externalId: string;
      externalUrl?: string;
    },
  ) {
    const [created] = await this.db
      .insert(artistExternalIds)
      .values({ artistId, ...input })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }

  async deleteExternalId(artistId: string, externalIdId: string) {
    const [deleted] = await this.db
      .delete(artistExternalIds)
      .where(
        and(
          eq(artistExternalIds.id, externalIdId),
          eq(artistExternalIds.artistId, artistId),
        ),
      )
      .returning();
    return deleted ?? null;
  }
}
