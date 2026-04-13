// src/modules/awards/awards.repository.ts

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { awardRecords } from 'src/infrastructure/drizzle/schema';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';
import { QueryAwardDto } from './dto/query-award.dto';

@Injectable()
export class AwardsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Write ─────────────────────────────────────────────────────────────

  async create(input: CreateAwardDto) {
    const [row] = await this.db
      .insert(awardRecords)
      .values({
        artistId: input.artistId,
        songId: input.songId ?? null,
        albumId: input.albumId ?? null,
        awardBody: input.awardBody,
        awardName: input.awardName,
        category: input.category,
        result: input.result,
        year: input.year,
        ceremony: input.ceremony ?? null,
        territory: input.territory ?? null,
        sourceUrl: input.sourceUrl ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    return row;
  }

  async bulkCreate(inputs: CreateAwardDto[]) {
    if (!inputs.length) return [];

    return this.db
      .insert(awardRecords)
      .values(
        inputs.map((input) => ({
          artistId: input.artistId,
          songId: input.songId ?? null,
          albumId: input.albumId ?? null,
          awardBody: input.awardBody,
          awardName: input.awardName,
          category: input.category,
          result: input.result,
          year: input.year,
          ceremony: input.ceremony ?? null,
          territory: input.territory ?? null,
          sourceUrl: input.sourceUrl ?? null,
          notes: input.notes ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: [
          awardRecords.artistId,
          awardRecords.awardBody,
          awardRecords.awardName,
          awardRecords.year,
        ],
        set: {
          result: awardRecords.result,
          category: awardRecords.category,
          ceremony: awardRecords.ceremony,
          territory: awardRecords.territory,
          sourceUrl: awardRecords.sourceUrl,
          notes: awardRecords.notes,
          updatedAt: new Date(),
        },
      })
      .returning();
  }

  async update(id: string, input: UpdateAwardDto) {
    const [row] = await this.db
      .update(awardRecords)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(awardRecords.id, id))
      .returning();

    return row ?? null;
  }

  async delete(id: string) {
    const [row] = await this.db
      .delete(awardRecords)
      .where(eq(awardRecords.id, id))
      .returning();

    return row ?? null;
  }

  async deleteByIds(ids: string[]) {
    if (!ids.length) return [];

    return this.db
      .delete(awardRecords)
      .where(inArray(awardRecords.id, ids))
      .returning();
  }

  // ── Read ──────────────────────────────────────────────────────────────

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(awardRecords)
      .where(eq(awardRecords.id, id))
      .limit(1);

    return row ?? null;
  }

  async findMany(query: QueryAwardDto) {
    const conditions: any[] = [];

    if (query.artistId)
      conditions.push(eq(awardRecords.artistId, query.artistId));

    if (query.songId) conditions.push(eq(awardRecords.songId, query.songId));
    if (query.albumId) conditions.push(eq(awardRecords.albumId, query.albumId));
    if (query.awardBody)
      conditions.push(eq(awardRecords.awardBody, query.awardBody));
    if (query.result) conditions.push(eq(awardRecords.result, query.result));
    if (query.year) conditions.push(eq(awardRecords.year, query.year));
    if (query.territory)
      conditions.push(
        eq(awardRecords.territory, query.territory.toUpperCase()),
      );

    return this.db
      .select()
      .from(awardRecords)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(awardRecords.year);
  }

  async findByArtist(artistId: string) {
    return this.db
      .select()
      .from(awardRecords)
      .where(eq(awardRecords.artistId, artistId))
      .orderBy(awardRecords.year);
  }
}
