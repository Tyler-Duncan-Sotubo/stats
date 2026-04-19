import { Inject, Injectable } from '@nestjs/common';
import {
  songs,
  songAliases,
  songExternalIds,
  songFeatures,
  artists,
} from 'src/infrastructure/drizzle/schema';
import { eq, ilike, and, sql, isNull, inArray } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { CreateSongInput } from './inputs/create-song.input';
import { UpdateSongInput } from './inputs/update-song.input';
import { FindSongsInput } from './inputs/find-songs.input';

@Injectable()
export class SongsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Find ──────────────────────────────────────────────────────────────────

  async findAll(input: FindSongsInput) {
    const {
      search,
      artistId,
      isAfrobeats,
      entityStatus,
      needsReview,
      explicit,
      page,
      limit,
    } = input;
    const offset = (page - 1) * limit;

    const conditions = [isNull(songs.mergedIntoSongId)];

    if (search) conditions.push(ilike(songs.title, `%${search}%`));
    if (artistId) conditions.push(eq(songs.artistId, artistId));
    if (isAfrobeats !== undefined)
      conditions.push(eq(songs.isAfrobeats, isAfrobeats));
    if (entityStatus) conditions.push(eq(songs.entityStatus, entityStatus));
    if (needsReview !== undefined)
      conditions.push(eq(songs.needsReview, needsReview));
    if (explicit !== undefined) conditions.push(eq(songs.explicit, explicit));

    const where = and(...conditions);

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(songs)
        .where(where)
        .orderBy(songs.title)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(songs)
        .where(where),
    ]);

    return { rows, total: Number(count) };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(songs)
      .where(eq(songs.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async findBySpotifyTrackId(spotifyTrackId: string) {
    const [row] = await this.db
      .select()
      .from(songs)
      .where(eq(songs.spotifyTrackId, spotifyTrackId))
      .limit(1);
    return row ?? null;
  }

  async findWithRelations(id: string) {
    const song = await this.findById(id);
    if (!song) return null;

    const [aliases, externalIds, features] = await Promise.all([
      this.db.select().from(songAliases).where(eq(songAliases.songId, id)),
      this.db
        .select()
        .from(songExternalIds)
        .where(eq(songExternalIds.songId, id)),
      this.db
        .select({
          id: songFeatures.id,
          songId: songFeatures.songId,
          featuredArtistId: songFeatures.featuredArtistId,
          artistName: artists.name,
          artistSlug: artists.slug,
        })
        .from(songFeatures)
        .innerJoin(artists, eq(songFeatures.featuredArtistId, artists.id))
        .where(eq(songFeatures.songId, id)),
    ]);

    return { ...song, aliases, externalIds, features };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: CreateSongInput) {
    const [created] = await this.db.insert(songs).values(input).returning();
    return created;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateSongInput) {
    const [updated] = await this.db
      .update(songs)
      .set({ ...input })
      .where(eq(songs.id, id))
      .returning();
    return updated ?? null;
  }

  async merge(sourceId: string, targetId: string) {
    const [updated] = await this.db
      .update(songs)
      .set({
        mergedIntoSongId: targetId,
        entityStatus: 'merged',
      })
      .where(eq(songs.id, sourceId))
      .returning();
    return updated ?? null;
  }

  async flagForReview(id: string, flag: boolean) {
    const [updated] = await this.db
      .update(songs)
      .set({ needsReview: flag })
      .where(eq(songs.id, id))
      .returning();
    return updated ?? null;
  }

  async bulkUpdate(
    ids: string[],
    input: {
      isAfrobeats?: boolean;
      needsReview?: boolean;
      entityStatus?: string;
    },
  ) {
    return this.db
      .update(songs)
      .set({ ...input })
      .where(inArray(songs.id, ids))
      .returning();
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(songs)
      .where(eq(songs.id, id))
      .returning();
    return deleted ?? null;
  }

  // ── Aliases ───────────────────────────────────────────────────────────────

  async findAliases(songId: string) {
    return this.db
      .select()
      .from(songAliases)
      .where(eq(songAliases.songId, songId));
  }

  async addAlias(
    songId: string,
    input: {
      alias: string;
      normalizedAlias: string;
      source?: string;
      isPrimary?: boolean;
    },
  ) {
    const [created] = await this.db
      .insert(songAliases)
      .values({ songId, ...input })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }

  async setPrimaryAlias(songId: string, aliasId: string) {
    await this.db
      .update(songAliases)
      .set({ isPrimary: false })
      .where(eq(songAliases.songId, songId));

    const [updated] = await this.db
      .update(songAliases)
      .set({ isPrimary: true })
      .where(and(eq(songAliases.id, aliasId), eq(songAliases.songId, songId)))
      .returning();
    return updated ?? null;
  }

  async deleteAlias(songId: string, aliasId: string) {
    const [deleted] = await this.db
      .delete(songAliases)
      .where(and(eq(songAliases.id, aliasId), eq(songAliases.songId, songId)))
      .returning();
    return deleted ?? null;
  }

  // ── External IDs ──────────────────────────────────────────────────────────

  async findExternalIds(songId: string) {
    return this.db
      .select()
      .from(songExternalIds)
      .where(eq(songExternalIds.songId, songId));
  }

  async addExternalId(
    songId: string,
    input: {
      source: string;
      externalId: string;
      externalUrl?: string;
    },
  ) {
    const [created] = await this.db
      .insert(songExternalIds)
      .values({ songId, ...input })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }

  async deleteExternalId(songId: string, externalIdId: string) {
    const [deleted] = await this.db
      .delete(songExternalIds)
      .where(
        and(
          eq(songExternalIds.id, externalIdId),
          eq(songExternalIds.songId, songId),
        ),
      )
      .returning();
    return deleted ?? null;
  }

  // ── Features ──────────────────────────────────────────────────────────────

  async findFeatures(songId: string) {
    return this.db
      .select({
        id: songFeatures.id,
        songId: songFeatures.songId,
        featuredArtistId: songFeatures.featuredArtistId,
        artistName: artists.name,
        artistSlug: artists.slug,
      })
      .from(songFeatures)
      .innerJoin(artists, eq(songFeatures.featuredArtistId, artists.id))
      .where(eq(songFeatures.songId, songId));
  }

  async addFeature(songId: string, featuredArtistId: string) {
    const [created] = await this.db
      .insert(songFeatures)
      .values({ songId, featuredArtistId })
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }

  async deleteFeature(songId: string, featuredArtistId: string) {
    const [deleted] = await this.db
      .delete(songFeatures)
      .where(
        and(
          eq(songFeatures.songId, songId),
          eq(songFeatures.featuredArtistId, featuredArtistId),
        ),
      )
      .returning();
    return deleted ?? null;
  }
}
