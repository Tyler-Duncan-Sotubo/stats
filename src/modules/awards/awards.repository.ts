import { Inject, Injectable } from '@nestjs/common';
import {
  awardRecords,
  artists,
  songs,
  albums,
} from 'src/infrastructure/drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { CreateAwardInput } from './inputs/create-award.input';
import { UpdateAwardInput } from './inputs/update-award.input';
import { FindAwardsInput } from './inputs/find-awards.input';

@Injectable()
export class AwardsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Find ──────────────────────────────────────────────────────────────────

  async findAll(input: FindAwardsInput) {
    const {
      artistId,
      awardBody,
      category,
      result,
      territory,
      year,
      page,
      limit,
    } = input;
    const offset = (page - 1) * limit;

    const conditions: (ReturnType<typeof eq> | ReturnType<typeof and>)[] = [];

    if (artistId) conditions.push(eq(awardRecords.artistId, artistId));
    if (awardBody) conditions.push(eq(awardRecords.awardBody, awardBody));
    if (category) conditions.push(eq(awardRecords.category, category));
    if (result) conditions.push(eq(awardRecords.result, result));
    if (territory) conditions.push(eq(awardRecords.territory, territory));
    if (year) conditions.push(eq(awardRecords.year, year));

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: awardRecords.id,
          artistId: awardRecords.artistId,
          songId: awardRecords.songId,
          albumId: awardRecords.albumId,
          awardBody: awardRecords.awardBody,
          awardName: awardRecords.awardName,
          category: awardRecords.category,
          result: awardRecords.result,
          year: awardRecords.year,
          ceremony: awardRecords.ceremony,
          territory: awardRecords.territory,
          sourceUrl: awardRecords.sourceUrl,
          notes: awardRecords.notes,
          createdAt: awardRecords.createdAt,
          updatedAt: awardRecords.updatedAt,
          artistName: artists.name,
          artistSlug: artists.slug,
          songTitle: songs.title,
          songSlug: songs.slug,
          albumTitle: albums.title,
          albumSlug: albums.slug,
        })
        .from(awardRecords)
        .leftJoin(artists, eq(awardRecords.artistId, artists.id))
        .leftJoin(songs, eq(awardRecords.songId, songs.id))
        .leftJoin(albums, eq(awardRecords.albumId, albums.id))
        .where(where)
        .orderBy(awardRecords.year)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(awardRecords)
        .where(where),
    ]);

    return { rows, total: Number(count) };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({
        id: awardRecords.id,
        artistId: awardRecords.artistId,
        songId: awardRecords.songId,
        albumId: awardRecords.albumId,
        awardBody: awardRecords.awardBody,
        awardName: awardRecords.awardName,
        category: awardRecords.category,
        result: awardRecords.result,
        year: awardRecords.year,
        ceremony: awardRecords.ceremony,
        territory: awardRecords.territory,
        sourceUrl: awardRecords.sourceUrl,
        notes: awardRecords.notes,
        createdAt: awardRecords.createdAt,
        updatedAt: awardRecords.updatedAt,
        artistName: artists.name,
        artistSlug: artists.slug,
        songTitle: songs.title,
        songSlug: songs.slug,
        albumTitle: albums.title,
        albumSlug: albums.slug,
      })
      .from(awardRecords)
      .leftJoin(artists, eq(awardRecords.artistId, artists.id))
      .leftJoin(songs, eq(awardRecords.songId, songs.id))
      .leftJoin(albums, eq(awardRecords.albumId, albums.id))
      .where(eq(awardRecords.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByUniqueKey(
    artistId: string,
    awardBody: string,
    awardName: string,
    year: number,
  ) {
    const [row] = await this.db
      .select()
      .from(awardRecords)
      .where(
        and(
          eq(awardRecords.artistId, artistId),
          eq(awardRecords.awardBody, awardBody),
          eq(awardRecords.awardName, awardName),
          eq(awardRecords.year, year),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: CreateAwardInput) {
    const [created] = await this.db
      .insert(awardRecords)
      .values(input)
      .returning();
    return created;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateAwardInput) {
    const [updated] = await this.db
      .update(awardRecords)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(awardRecords.id, id))
      .returning();
    return updated ?? null;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(awardRecords)
      .where(eq(awardRecords.id, id))
      .returning();
    return deleted ?? null;
  }
}
