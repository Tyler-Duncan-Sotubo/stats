/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';

export interface RecentMilestone {
  id: string;
  metric: string;
  threshold: number;
  crossedAt: string;
  isAfrobeats: boolean;
  streamValue: number | null;
  artistId: string | null;
  artistName: string | null;
  artistSlug: string | null;
  artistImageUrl: string | null;
  songId: string | null;
  songTitle: string | null;
  songSlug: string | null;
  songImageUrl: string | null;
}

export interface ArtistMilestoneTimelineEntry {
  metric: string;
  threshold: number;
  crossedAt: string;
  streamValue: number | null;
}

// milestone.repository.ts — add to exports
export interface MilestoneFact {
  id: string;
  metric: string;
  threshold: number;
  crossedAt: string;
  isAfrobeats: boolean;
  streamValue: number | null;
  artistId: string;
  artistName: string;
  artistSlug: string;
  artistImageUrl: string | null;
  originCountry: string | null;
  spotifyId: string | null;
  songId: string | null;
  songTitle: string | null;
  songSlug: string | null;
  songImageUrl: string | null;
  spotifyTrackId: string | null;
  currentArtistStreams: number;
  currentSongStreams: number;
  artistMilestones: {
    metric: string;
    threshold: number;
    crossedAt: string;
  }[];
}

@Injectable()
export class MilestoneRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getRecentMilestones(params: {
    isAfrobeats?: boolean;
    metric?: string;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ data: RecentMilestone[]; total: number }> {
    const { isAfrobeats, metric, q, limit, offset } = params;
    console.log({ isAfrobeats, metric, q, limit, offset });

    const afrobeatsFragment =
      isAfrobeats !== undefined
        ? sql` AND me.is_afrobeats = ${isAfrobeats}`
        : sql``;

    const metricFragment = metric ? sql` AND me.metric = ${metric}` : sql``;

    const searchFragment = q
      ? sql` AND (a.name ILIKE ${'%' + q + '%'} OR s.title ILIKE ${'%' + q + '%'})`
      : sql``;

    const [dataResult, countResult] = await Promise.all([
      this.db.execute(sql`
      SELECT *
      FROM (
        SELECT DISTINCT ON (
          COALESCE(me.song_id::text, me.artist_id::text)
        )
          me.id,
          me.metric,
          me.threshold::bigint                      AS "threshold",
          me.crossed_at                             AS "crossedAt",
          me.is_afrobeats                           AS "isAfrobeats",
          me.stream_value_at_crossing::bigint       AS "streamValue",
          a.id                                      AS "artistId",
          a.name                                    AS "artistName",
          a.slug                                    AS "artistSlug",
          a.image_url                               AS "artistImageUrl",
          s.id                                      AS "songId",
          s.title                                   AS "songTitle",
          s.slug                                    AS "songSlug",
          s.image_url                               AS "songImageUrl"
        FROM milestone_events me
        LEFT JOIN artists a ON a.id = me.artist_id
        LEFT JOIN songs s ON s.id = me.song_id
        WHERE 1=1
          ${afrobeatsFragment}
          ${metricFragment}
          ${searchFragment}
        ORDER BY
          COALESCE(me.song_id::text, me.artist_id::text),
          me.threshold DESC,
          me.crossed_at DESC
      ) deduped
      ORDER BY "crossedAt" DESC, "threshold" DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
      this.db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT DISTINCT ON (
          COALESCE(me.song_id::text, me.artist_id::text)
        )
          me.id
        FROM milestone_events me
        LEFT JOIN artists a ON a.id = me.artist_id
        LEFT JOIN songs s ON s.id = me.song_id
        WHERE 1=1
          ${afrobeatsFragment}
          ${metricFragment}
          ${searchFragment}
        ORDER BY
          COALESCE(me.song_id::text, me.artist_id::text),
          me.threshold DESC
      ) deduped
    `),
    ]);

    console.log({ dataResult, countResult });

    return {
      data: dataResult.rows as RecentMilestone[],
      total: (countResult.rows[0] as any)?.total ?? 0,
    };
  }

  async getArtistMilestoneTimeline(
    artistSlug: string,
  ): Promise<ArtistMilestoneTimelineEntry[]> {
    const result = await this.db.execute(sql`
      SELECT
        me.metric,
        me.threshold::bigint              AS "threshold",
        me.crossed_at                     AS "crossedAt",
        me.stream_value_at_crossing::bigint AS "streamValue"
      FROM milestone_events me
      JOIN artists a ON a.id = me.artist_id
      WHERE a.slug = ${artistSlug}
      ORDER BY me.crossed_at ASC, me.threshold ASC
    `);

    return result.rows as ArtistMilestoneTimelineEntry[];
  }

  async getMilestoneFact(params: {
    artistSlug: string;
    metric: string;
    threshold: number;
    songSlug?: string;
  }): Promise<MilestoneFact | null> {
    const { artistSlug, metric, threshold, songSlug } = params;

    const result = await this.db.execute(sql`
    SELECT
      me.id,
      me.metric,
      me.threshold::bigint              AS "threshold",
      me.crossed_at                     AS "crossedAt",
      me.is_afrobeats                   AS "isAfrobeats",
      me.stream_value_at_crossing::bigint AS "streamValue",
      a.id                              AS "artistId",
      a.name                            AS "artistName",
      a.slug                            AS "artistSlug",
      a.image_url                       AS "artistImageUrl",
      a.origin_country                  AS "originCountry",
      a.spotify_id                      AS "spotifyId",
      s.id                              AS "songId",
      s.title                           AS "songTitle",
      s.slug                            AS "songSlug",
      s.image_url                       AS "songImageUrl",
      s.spotify_track_id                AS "spotifyTrackId",
      -- current streams for context
      COALESCE(ass.total_streams, 0)::bigint    AS "currentArtistStreams",
      COALESCE(sss.total_spotify_streams, 0)::bigint AS "currentSongStreams",
      -- related milestones for this artist
      (
        SELECT json_agg(json_build_object(
          'metric', rm.metric,
          'threshold', rm.threshold,
          'crossedAt', rm.crossed_at
        ) ORDER BY rm.threshold ASC)
        FROM milestone_events rm
        WHERE rm.artist_id = a.id
          AND rm.metric = ${metric}
          AND rm.song_id IS NULL
      ) AS "artistMilestones"
    FROM milestone_events me
    JOIN artists a ON a.id = me.artist_id
    LEFT JOIN songs s ON s.id = me.song_id
    LEFT JOIN artist_stream_summary ass ON ass.artist_id = a.id
    LEFT JOIN song_stream_summary sss ON sss.song_id = me.song_id
    WHERE a.slug = ${artistSlug}
      AND me.metric = ${metric}
      AND me.threshold = ${threshold}
      ${songSlug ? sql`AND s.slug = ${songSlug}` : sql`AND me.song_id IS NULL`}
    LIMIT 1
  `);

    if (!result.rows.length) return null;
    return result.rows[0] as MilestoneFact;
  }

  async getIndexableFacts(
    limit: number,
    offset: number,
  ): Promise<
    {
      slug: string;
      updatedAt: string;
      artistSlug: string;
      metric: string;
      threshold: number;
      songSlug: string | null;
    }[]
  > {
    const result = await this.db.execute(sql`
    SELECT
      a.slug                              AS "artistSlug",
      s.slug                              AS "songSlug",
      me.metric,
      me.threshold::bigint                AS "threshold",
      me.created_at                       AS "updatedAt",
      -- build slug on the fly
      CASE
        WHEN me.song_id IS NOT NULL THEN
          CONCAT(
            a.slug, '-', s.slug, '-',
            CASE
              WHEN me.threshold >= 1000000000
                THEN CONCAT((me.threshold / 1000000000)::text, 'b')
              WHEN me.threshold >= 1000000
                THEN CONCAT((me.threshold / 1000000)::text, 'm')
              ELSE me.threshold::text
            END,
            '-streams-spotify'
          )
        WHEN me.metric = 'monthly_listeners' THEN
          CONCAT(
            a.slug, '-',
            CASE
              WHEN me.threshold >= 1000000000
                THEN CONCAT((me.threshold / 1000000000)::text, 'b')
              WHEN me.threshold >= 1000000
                THEN CONCAT((me.threshold / 1000000)::text, 'm')
              ELSE me.threshold::text
            END,
            '-monthly-listeners-spotify'
          )
        ELSE
          CONCAT(
            a.slug, '-',
            CASE
              WHEN me.threshold >= 1000000000
                THEN CONCAT((me.threshold / 1000000000)::text, 'b')
              WHEN me.threshold >= 1000000
                THEN CONCAT((me.threshold / 1000000)::text, 'm')
              ELSE me.threshold::text
            END,
            '-streams-spotify'
          )
      END                                 AS "slug"
    FROM milestone_events me
    JOIN artists a ON a.id = me.artist_id
    LEFT JOIN songs s ON s.id = me.song_id
    WHERE a.slug IS NOT NULL
    ORDER BY me.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

    return result.rows as any[];
  }
}
