/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';

export interface StreamLeaderboardEntry {
  rank: number;
  artistId: string;
  artistName: string;
  artistSlug: string | null;
  artistImageUrl: string | null;
  originCountry: string | null;
  isAfrobeats: boolean;
  spotifyId: string | null;
  totalStreams: number | null;
  dailyStreams: number | null;
  trackCount: number | null;
  snapshotDate: string | null;
}

export interface ListenerLeaderboardEntry {
  rank: number;
  globalRank: number | null;
  artistId: string;
  artistName: string;
  artistSlug: string | null;
  artistImageUrl: string | null;
  originCountry: string | null;
  isAfrobeats: boolean;
  spotifyId: string | null;
  monthlyListeners: number | null;
  dailyChange: number | null;
  peakListeners: number | null;
  snapshotDate: string;
}

export interface SongLeaderboardEntry {
  rank: number;
  songId: string;
  songTitle: string;
  songSlug: string | null;
  songImageUrl: string | null;
  spotifyTrackId: string | null;
  isAfrobeats: boolean;
  artistId: string;
  artistName: string | null;
  artistSlug: string | null;
  artistImageUrl: string | null;
  totalStreams: number | null;
  dailyStreams: number | null;
  snapshotDate: string | null;
}

export interface LeaderboardFilters {
  limit?: number;
  isAfrobeats?: boolean;
  country?: string;
}

@Injectable()
export class LeaderboardRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getStreamLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<StreamLeaderboardEntry[]> {
    const limit = Math.min(filters.limit ?? 50, 200);

    let outerAfrobeatsFragment = sql``;
    let outerCountryFragment = sql``;

    if (filters.isAfrobeats !== undefined) {
      outerAfrobeatsFragment = sql` AND ranked."isAfrobeats" = ${filters.isAfrobeats}`;
    }

    if (filters.country) {
      outerCountryFragment = sql` AND ranked."originCountry" = ${filters.country.toUpperCase()}`;
    }

    const result = await this.db.execute(sql`
    WITH ranked AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY s.total_streams DESC NULLS LAST)::int AS rank,
        a.id                    AS "artistId",
        a.name                  AS "artistName",
        a.slug                  AS "artistSlug",
        a.image_url             AS "artistImageUrl",
        a.origin_country        AS "originCountry",
        a.is_afrobeats          AS "isAfrobeats",
        a.spotify_id            AS "spotifyId",
        s.total_streams::bigint AS "totalStreams",
        s.daily_streams::bigint AS "dailyStreams",
        s.track_count::int      AS "trackCount",
        s.snapshot_date         AS "snapshotDate"
      FROM artist_stream_summary s
      JOIN artists a ON a.id = s.artist_id
      WHERE a.entity_status = 'canonical'
    )
    SELECT *
    FROM ranked
    WHERE 1 = 1
      ${outerAfrobeatsFragment}
      ${outerCountryFragment}
    ORDER BY rank ASC
    LIMIT ${limit}
  `);

    return (result.rows as any[]).map((row) => ({
      ...row,
      totalStreams: row.totalStreams ? Number(row.totalStreams) : null,
      dailyStreams: row.dailyStreams ? Number(row.dailyStreams) : null,
      trackCount: row.trackCount ? Number(row.trackCount) : null,
    }));
  }
  async getListenerLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<ListenerLeaderboardEntry[]> {
    const limit = Math.min(filters.limit ?? 50, 200);

    let afrobeatsFragment = sql``;
    let countryFragment = sql``;

    if (filters.isAfrobeats !== undefined) {
      afrobeatsFragment = sql` AND a.is_afrobeats = ${filters.isAfrobeats}`;
    }

    if (filters.country) {
      countryFragment = sql` AND a.origin_country = ${filters.country.toUpperCase()}`;
    }

    const result = await this.db.execute(sql`
    SELECT
      ROW_NUMBER() OVER (ORDER BY ml.monthly_listeners DESC NULLS LAST)::int AS rank,
      ml.global_rank::int               AS "globalRank",
      a.id                              AS "artistId",
      a.name                            AS "artistName",
      a.slug                            AS "artistSlug",
      a.image_url                       AS "artistImageUrl",
      a.origin_country                  AS "originCountry",
      a.is_afrobeats                    AS "isAfrobeats",
      a.spotify_id                      AS "spotifyId",
      ml.monthly_listeners::bigint      AS "monthlyListeners",
      ml.daily_change::bigint           AS "dailyChange",
      ml.peak_listeners::bigint         AS "peakListeners",
      ml.snapshot_date                  AS "snapshotDate"
    FROM artist_monthly_listener_summary ml
    JOIN artists a ON a.id = ml.artist_id
    WHERE a.entity_status = 'canonical'
      ${afrobeatsFragment}
      ${countryFragment}
    ORDER BY ml.monthly_listeners DESC NULLS LAST
    LIMIT ${limit}
  `);

    return (result.rows as any[]).map((row) => ({
      ...row,
      monthlyListeners: row.monthlyListeners
        ? Number(row.monthlyListeners)
        : null,
      dailyChange: row.dailyChange ? Number(row.dailyChange) : null,
      peakListeners: row.peakListeners ? Number(row.peakListeners) : null,
      globalRank: row.globalRank ? Number(row.globalRank) : null,
    }));
  }

  async getSongLeaderboard(
    filters: LeaderboardFilters,
  ): Promise<SongLeaderboardEntry[]> {
    const limit = Math.min(filters.limit ?? 50, 200);

    let afrobeatsFragment = sql``;

    if (filters.isAfrobeats !== undefined) {
      afrobeatsFragment = sql` AND sg.is_afrobeats = ${filters.isAfrobeats}`;
    }

    const result = await this.db.execute(sql`
      SELECT
        ROW_NUMBER() OVER (ORDER BY s.total_spotify_streams DESC NULLS LAST)::int AS rank,
        sg.id                             AS "songId",
        sg.title                          AS "songTitle",
        sg.slug                           AS "songSlug",
        sg.image_url                      AS "songImageUrl",
        sg.spotify_track_id               AS "spotifyTrackId",
        sg.is_afrobeats                   AS "isAfrobeats",
        a.id                              AS "artistId",
        a.name                            AS "artistName",
        a.slug                            AS "artistSlug",
        a.image_url                       AS "artistImageUrl",
        s.total_spotify_streams::bigint   AS "totalStreams",
        s.daily_streams::bigint           AS "dailyStreams",
        s.snapshot_date                   AS "snapshotDate"
      FROM song_stream_summary s
      JOIN songs sg ON sg.id = s.song_id
      JOIN artists a ON a.id = sg.artist_id
      WHERE sg.entity_status IN ('canonical', 'provisional')
        ${afrobeatsFragment}
      ORDER BY s.total_spotify_streams DESC NULLS LAST
      LIMIT ${limit}
    `);

    return (result.rows as any[]).map((row) => ({
      ...row,
      totalStreams: row.totalStreams ? Number(row.totalStreams) : null,
      dailyStreams: row.dailyStreams ? Number(row.dailyStreams) : null,
    }));
  }
}
