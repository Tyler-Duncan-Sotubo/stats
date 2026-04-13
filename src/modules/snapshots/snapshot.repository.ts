import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import {
  songs,
  artistStatsSnapshots,
  songStatsSnapshots,
  artists,
} from 'src/infrastructure/drizzle/schema';

@Injectable()
export class SnapshotRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Artist snapshots ──────────────────────────────────────────────────

  async upsertArtistSnapshot(data: {
    artistId: string;
    snapshotDate: string;
    totalStreams?: number | null;
    totalStreamsAsLead?: number | null;
    totalStreamsSolo?: number | null;
    totalStreamsAsFeature?: number | null;
    dailyStreams?: number | null;
    dailyStreamsAsLead?: number | null;
    dailyStreamsAsFeature?: number | null;
    trackCount?: number | null;
    sourceUpdatedAt?: string | null;
    spotifyMonthlyListeners?: number | null;
    spotifyFollowers?: number | null;
    popularity?: number | null;
  }) {
    const [row] = await this.db
      .insert(artistStatsSnapshots)
      .values({
        artistId: data.artistId,
        snapshotDate: data.snapshotDate,
        totalStreams: data.totalStreams ?? null,
        totalStreamsAsLead: data.totalStreamsAsLead ?? null,
        totalStreamsSolo: data.totalStreamsSolo ?? null,
        totalStreamsAsFeature: data.totalStreamsAsFeature ?? null,
        dailyStreams: data.dailyStreams ?? null,
        dailyStreamsAsLead: data.dailyStreamsAsLead ?? null,
        dailyStreamsAsFeature: data.dailyStreamsAsFeature ?? null,
        trackCount: data.trackCount ?? null,
        sourceUpdatedAt: data.sourceUpdatedAt ?? null,
        spotifyMonthlyListeners: data.spotifyMonthlyListeners ?? null,
        spotifyFollowers: data.spotifyFollowers ?? null,
        popularity: data.popularity ?? null,
      } as typeof artistStatsSnapshots.$inferInsert)
      .onConflictDoUpdate({
        target: [
          artistStatsSnapshots.artistId,
          artistStatsSnapshots.snapshotDate,
        ],
        set: {
          totalStreams: data.totalStreams ?? null,
          totalStreamsAsLead: data.totalStreamsAsLead ?? null,
          totalStreamsSolo: data.totalStreamsSolo ?? null,
          totalStreamsAsFeature: data.totalStreamsAsFeature ?? null,
          dailyStreams: data.dailyStreams ?? null,
          dailyStreamsAsLead: data.dailyStreamsAsLead ?? null,
          dailyStreamsAsFeature: data.dailyStreamsAsFeature ?? null,
          trackCount: data.trackCount ?? null,
          sourceUpdatedAt: data.sourceUpdatedAt ?? null,
          spotifyMonthlyListeners: data.spotifyMonthlyListeners ?? null,
          spotifyFollowers: data.spotifyFollowers ?? null,
          popularity: data.popularity ?? null,
        } as Partial<typeof artistStatsSnapshots.$inferInsert>,
      })
      .returning();

    return row;
  }

  async findArtistSnapshot(artistId: string, snapshotDate: string) {
    const [row] = await this.db
      .select()
      .from(artistStatsSnapshots)
      .where(
        and(
          eq(artistStatsSnapshots.artistId, artistId),
          eq(artistStatsSnapshots.snapshotDate, snapshotDate),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  // ── Song snapshots ────────────────────────────────────────────────────

  async upsertSongSnapshot(data: {
    songId: string;
    artistId: string;
    snapshotDate: string;
    spotifyStreams?: number | null;
    dailyStreams?: number | null;
  }) {
    const [row] = await this.db
      .insert(songStatsSnapshots)
      .values({
        songId: data.songId,
        artistId: data.artistId,
        snapshotDate: data.snapshotDate,
        spotifyStreams: data.spotifyStreams ?? null,
        dailyStreams: data.dailyStreams ?? null,
      } as typeof songStatsSnapshots.$inferInsert)
      .onConflictDoUpdate({
        target: [songStatsSnapshots.songId, songStatsSnapshots.snapshotDate],
        set: {
          spotifyStreams: data.spotifyStreams ?? null,
          dailyStreams: data.dailyStreams ?? null,
        } as Partial<typeof songStatsSnapshots.$inferInsert>,
      })
      .returning();

    return row;
  }

  async findSongSnapshot(songId: string, snapshotDate: string) {
    const [row] = await this.db
      .select()
      .from(songStatsSnapshots)
      .where(
        and(
          eq(songStatsSnapshots.songId, songId),
          eq(songStatsSnapshots.snapshotDate, snapshotDate),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  // ── Songs ─────────────────────────────────────────────────────────────

  async upsertSong(data: {
    artistId: string;
    title: string;
    spotifyTrackId: string;
    isFeature?: boolean;
    slug?: string;
    albumId?: string | null;
    releaseDate?: string | null;
    durationMs?: number | null;
    explicit?: boolean;
    isAfrobeats?: boolean;
    imageUrl?: string | null;
  }) {
    const slug =
      data.slug ??
      this.slugify(`${data.title}-${data.spotifyTrackId.slice(0, 8)}`);

    const [row] = await this.db
      .insert(songs)
      .values({
        artistId: data.artistId,
        title: data.title,
        spotifyTrackId: data.spotifyTrackId,
        slug,
        albumId: data.albumId ?? null,
        releaseDate: data.releaseDate ?? null,
        durationMs: data.durationMs ?? null,
        explicit: data.explicit ?? false,
        isAfrobeats: data.isAfrobeats ?? false,
        imageUrl: data.imageUrl ?? null,
      })
      .onConflictDoUpdate({
        target: songs.spotifyTrackId,
        set: {
          artistId: data.artistId,
          title: data.title,
        },
      })
      .returning();

    return row;
  }

  async findSongBySpotifyTrackId(spotifyTrackId: string) {
    const [row] = await this.db
      .select()
      .from(songs)
      .where(eq(songs.spotifyTrackId, spotifyTrackId))
      .limit(1);

    return row ?? null;
  }

  // ── Artists ───────────────────────────────────────────────────────────
  // Minimal artist queries needed by the snapshot pipeline.
  // Full artist queries live in ArtistsRepository.

  async findAllWithSpotifyId(): Promise<
    { id: string; spotifyId: string; name: string }[]
  > {
    const rows = await this.db
      .select({
        id: artists.id,
        spotifyId: artists.spotifyId,
        name: artists.name,
      })
      .from(artists)
      .where(isNotNull(artists.spotifyId));

    return rows.filter(
      (r): r is typeof r & { spotifyId: string } => r.spotifyId !== null,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }
}
