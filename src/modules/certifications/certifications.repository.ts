import { Inject, Injectable } from '@nestjs/common';
import {
  certifications,
  artists,
  songs,
} from 'src/infrastructure/drizzle/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { CreateCertificationInput } from './inputs/create-certification.input';
import { UpdateCertificationInput } from './inputs/update-certification.input';
import { FindCertificationsInput } from './inputs/find-certifications.input';

@Injectable()
export class CertificationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Find ──────────────────────────────────────────────────────────────────

  async findAll(input: FindCertificationsInput) {
    const {
      artistId,
      songId,
      territory,
      body,
      level,
      resolutionStatus,
      page,
      limit,
    } = input;
    const offset = (page - 1) * limit;

    const conditions: (ReturnType<typeof eq> | ReturnType<typeof and>)[] = [];

    if (artistId) conditions.push(eq(certifications.artistId, artistId));
    if (songId) conditions.push(eq(certifications.songId, songId));
    if (territory) conditions.push(eq(certifications.territory, territory));
    if (body) conditions.push(eq(certifications.body, body));
    if (level) conditions.push(eq(certifications.level, level));
    if (resolutionStatus)
      conditions.push(eq(certifications.resolutionStatus, resolutionStatus));

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: certifications.id,
          artistId: certifications.artistId,
          songId: certifications.songId,
          albumId: certifications.albumId,
          territory: certifications.territory,
          body: certifications.body,
          title: certifications.title,
          level: certifications.level,
          units: certifications.units,
          certifiedAt: certifications.certifiedAt,
          sourceUrl: certifications.sourceUrl,
          rawArtistName: certifications.rawArtistName,
          rawTitle: certifications.rawTitle,
          resolutionStatus: certifications.resolutionStatus,
          createdAt: certifications.createdAt,
          updatedAt: certifications.updatedAt,
          artistName: artists.name,
          artistSlug: artists.slug,
          songTitle: songs.title,
          songSlug: songs.slug,
        })
        .from(certifications)
        .leftJoin(artists, eq(certifications.artistId, artists.id))
        .leftJoin(songs, eq(certifications.songId, songs.id))
        .where(where)
        .orderBy(certifications.certifiedAt)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(certifications)
        .where(where),
    ]);

    return { rows, total: Number(count) };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({
        id: certifications.id,
        artistId: certifications.artistId,
        songId: certifications.songId,
        albumId: certifications.albumId,
        territory: certifications.territory,
        body: certifications.body,
        title: certifications.title,
        level: certifications.level,
        units: certifications.units,
        certifiedAt: certifications.certifiedAt,
        sourceUrl: certifications.sourceUrl,
        rawArtistName: certifications.rawArtistName,
        rawTitle: certifications.rawTitle,
        resolutionStatus: certifications.resolutionStatus,
        createdAt: certifications.createdAt,
        updatedAt: certifications.updatedAt,
        artistName: artists.name,
        artistSlug: artists.slug,
        songTitle: songs.title,
        songSlug: songs.slug,
      })
      .from(certifications)
      .leftJoin(artists, eq(certifications.artistId, artists.id))
      .leftJoin(songs, eq(certifications.songId, songs.id))
      .where(eq(certifications.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByUniqueKey(
    artistId: string,
    territory: string,
    body: string,
    title: string,
  ) {
    const [row] = await this.db
      .select()
      .from(certifications)
      .where(
        and(
          eq(certifications.artistId, artistId),
          eq(certifications.territory, territory),
          eq(certifications.body, body),
          eq(certifications.title, title),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: CreateCertificationInput) {
    const [created] = await this.db
      .insert(certifications)
      .values({
        ...input,
        resolutionStatus: input.resolutionStatus ?? 'matched',
      })
      .returning();
    return created;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateCertificationInput) {
    const [updated] = await this.db
      .update(certifications)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(certifications.id, id))
      .returning();
    return updated ?? null;
  }

  // ── Bulk resolve ──────────────────────────────────────────────────────────

  async bulkResolve(ids: string[], resolutionStatus: string) {
    return this.db
      .update(certifications)
      .set({ resolutionStatus, updatedAt: new Date() })
      .where(inArray(certifications.id, ids))
      .returning();
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(certifications)
      .where(eq(certifications.id, id))
      .returning();
    return deleted ?? null;
  }
}
