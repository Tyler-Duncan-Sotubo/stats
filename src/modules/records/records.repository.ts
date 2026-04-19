import { Inject, Injectable } from '@nestjs/common';
import {
  records,
  artists,
  songs,
  albums,
} from 'src/infrastructure/drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { CreateRecordInput } from './inputs/create-record.input';
import { UpdateRecordInput } from './inputs/update-record.input';
import { FindRecordsInput } from './inputs/find-records.input';

@Injectable()
export class RecordsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Find ──────────────────────────────────────────────────────────────────

  async findAll(input: FindRecordsInput) {
    const { artistId, songId, recordType, scope, isActive, page, limit } =
      input;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (artistId) conditions.push(eq(records.artistId, artistId));
    if (songId) conditions.push(eq(records.songId, songId));
    if (recordType) conditions.push(eq(records.recordType, recordType));
    if (scope) conditions.push(eq(records.scope, scope));
    if (isActive !== undefined) conditions.push(eq(records.isActive, isActive));

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: records.id,
          artistId: records.artistId,
          songId: records.songId,
          albumId: records.albumId,
          recordType: records.recordType,
          recordValue: records.recordValue,
          numericValue: records.numericValue,
          scope: records.scope,
          isActive: records.isActive,
          setOn: records.setOn,
          brokenOn: records.brokenOn,
          notes: records.notes,
          artistName: artists.name,
          artistSlug: artists.slug,
          songTitle: songs.title,
          songSlug: songs.slug,
          albumTitle: albums.title,
          albumSlug: albums.slug,
        })
        .from(records)
        .leftJoin(artists, eq(records.artistId, artists.id))
        .leftJoin(songs, eq(records.songId, songs.id))
        .leftJoin(albums, eq(records.albumId, albums.id))
        .where(where)
        .orderBy(records.setOn)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(records)
        .where(where),
    ]);

    return { rows, total: Number(count) };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({
        id: records.id,
        artistId: records.artistId,
        songId: records.songId,
        albumId: records.albumId,
        recordType: records.recordType,
        recordValue: records.recordValue,
        numericValue: records.numericValue,
        scope: records.scope,
        isActive: records.isActive,
        setOn: records.setOn,
        brokenOn: records.brokenOn,
        notes: records.notes,
        artistName: artists.name,
        artistSlug: artists.slug,
        songTitle: songs.title,
        songSlug: songs.slug,
        albumTitle: albums.title,
        albumSlug: albums.slug,
      })
      .from(records)
      .leftJoin(artists, eq(records.artistId, artists.id))
      .leftJoin(songs, eq(records.songId, songs.id))
      .leftJoin(albums, eq(records.albumId, albums.id))
      .where(eq(records.id, id))
      .limit(1);
    return row ?? null;
  }

  async findActiveByTypeAndScope(recordType: string, scope: string) {
    const [row] = await this.db
      .select()
      .from(records)
      .where(
        and(
          eq(records.recordType, recordType),
          eq(records.scope, scope),
          eq(records.isActive, true),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: CreateRecordInput) {
    const [created] = await this.db
      .insert(records)
      .values({
        ...input,
        isActive: input.isActive ?? true,
      })
      .returning();
    return created;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateRecordInput) {
    const [updated] = await this.db
      .update(records)
      .set(input)
      .where(eq(records.id, id))
      .returning();
    return updated ?? null;
  }

  // ── Break ─────────────────────────────────────────────────────────────────

  async breakRecord(id: string, brokenOn: string, notes?: string) {
    const [updated] = await this.db
      .update(records)
      .set({
        isActive: false,
        brokenOn,
        ...(notes ? { notes } : {}),
      })
      .where(eq(records.id, id))
      .returning();
    return updated ?? null;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(records)
      .where(eq(records.id, id))
      .returning();
    return deleted ?? null;
  }
}
