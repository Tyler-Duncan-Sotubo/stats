/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';

export interface PublicSong {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  spotifyTrackId: string | null;
  isAfrobeats: boolean;
  explicit: boolean;
  releaseDate: string | null;
  artistId: string;
  artistName: string | null;
  artistSlug: string | null;
  artistImageUrl: string | null;
  artistOriginCountry: string | null;
  // streams
  totalStreams: number | null;
  dailyStreams: number | null;
  streamSnapshotDate: string | null;
  // charts
  charts: PublicSongChart[];
  // features
  features: PublicSongFeature[];
}

export interface PublicSongChart {
  chartName: string;
  chartTerritory: string;
  peakPosition: number | null;
  weeksAtNumber1: number;
  weeksInTop10: number;
  totalChartWeeks: number;
  firstCharted: string | null;
  lastCharted: string | null;
}

export interface PublicSongFeature {
  artistId: string;
  artistName: string | null;
  artistSlug: string | null;
  artistImageUrl: string | null;
}

export interface SongHistoryPoint {
  date: string;
  totalStreams: number | null;
  dailyStreams: number | null;
  dailyGrowth: number | null;
  growth7d: number | null;
}

export interface MilestoneSongEntry {
  rank: number;
  songId: string;
  songTitle: string;
  songSlug: string | null;
  imageUrl: string | null;
  artistId: string;
  artistName: string;
  artistSlug: string | null;
  isAfrobeats: boolean;
  totalStreams: number;
  dailyStreams: number | null;
  releaseDate: string | null;
}

@Injectable()
export class SongsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findBySlug(
    slug: string,
  ): Promise<Omit<PublicSong, 'charts' | 'features'> | null> {
    const result = await this.db.execute(sql`
    SELECT
      sg.id,
      sg.title,
      sg.slug,
      sg.image_url                          AS "imageUrl",
      sg.spotify_track_id                   AS "spotifyTrackId",
      sg.is_afrobeats                       AS "isAfrobeats",
      sg.explicit,
      sg.release_date                       AS "releaseDate",
      sg.artist_id                          AS "artistId",
      a.name                                AS "artistName",
      a.slug                                AS "artistSlug",
      a.image_url                           AS "artistImageUrl",
      a.origin_country                      AS "artistOriginCountry",
      s.total_spotify_streams::bigint       AS "totalStreams",
      s.daily_streams::bigint               AS "dailyStreams",
      s.snapshot_date                       AS "streamSnapshotDate"
    FROM songs sg
    JOIN artists a ON a.id = sg.artist_id
    LEFT JOIN song_stream_summary s ON s.song_id = sg.id
    WHERE sg.slug = ${slug}
      AND sg.entity_status IN ('canonical', 'provisional')
    LIMIT 1
  `);

    if (!result.rows.length) return null;
    return result.rows[0] as any;
  }

  async getCharts(songId: string): Promise<PublicSongChart[]> {
    const result = await this.db.execute(sql`
      SELECT
        chart_name                  AS "chartName",
        chart_territory             AS "chartTerritory",
        peak_position::int          AS "peakPosition",
        weeks_at_number_1::int      AS "weeksAtNumber1",
        weeks_in_top_10::int        AS "weeksInTop10",
        total_chart_weeks::int      AS "totalChartWeeks",
        first_charted               AS "firstCharted",
        last_charted                AS "lastCharted"
      FROM song_chart_summary
      WHERE song_id = ${songId}
      ORDER BY peak_position ASC NULLS LAST
    `);

    return result.rows as PublicSongChart[];
  }

  async getFeatures(songId: string): Promise<PublicSongFeature[]> {
    const result = await this.db.execute(sql`
      SELECT
        a.id          AS "artistId",
        a.name        AS "artistName",
        a.slug        AS "artistSlug",
        a.image_url   AS "artistImageUrl"
      FROM song_features sf
      JOIN artists a ON a.id = sf.featured_artist_id
      WHERE sf.song_id = ${songId}
        AND a.entity_status IN ('canonical', 'provisional')
    `);

    return result.rows as PublicSongFeature[];
  }

  async getIndexableSongs(
    limit: number,
    offset: number,
  ): Promise<{ slug: string; updatedAt: string; totalStreams: number }[]> {
    const result = await this.db.execute(sql`
    SELECT
      s.slug,
      s.created_at          AS "updatedAt",
      ss.total_spotify_streams AS "totalStreams"
    FROM songs s
    INNER JOIN song_stream_summary ss ON ss.song_id = s.id
    WHERE s.entity_status = 'canonical'
      AND s.slug IS NOT NULL
      AND s.merged_into_song_id IS NULL
      AND ss.total_spotify_streams >= 1000000
    ORDER BY ss.total_spotify_streams DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
    return result.rows as {
      slug: string;
      updatedAt: string;
      totalStreams: number;
    }[];
  }

  async searchSong(title: string, artistName?: string) {
    const tsQuery = title
      .trim()
      .split(/\s+/)
      .map((w) => w + ':*')
      .join(' & ');

    const result = await this.db.execute(sql`
    SELECT
      id,
      title,
      slug,
      spotify_track_id    AS "spotifyTrackId",
      artist_name         AS "artistName",
      artist_slug         AS "artistSlug",
      artist_image_url    AS "artistImageUrl",
      song_image_url      AS "imageUrl",
      total_streams       AS "totalStreams",
      daily_streams       AS "dailyStreams"
    FROM song_search_summary
    WHERE search_vector @@ to_tsquery('english', ${tsQuery})
      ${artistName ? sql`AND LOWER(artist_name) LIKE ${'%' + artistName.toLowerCase() + '%'}` : sql``}
    ORDER BY total_streams DESC NULLS LAST
    LIMIT 1
  `);

    return result.rows[0] ?? null;
  }

  async getSongHistory(slug: string): Promise<SongHistoryPoint[]> {
    const result = await this.db.execute(sql`
    SELECT
      sss.snapshot_date                                           AS "date",
      sss.spotify_streams                                         AS "totalStreams",
      sss.daily_streams                                           AS "dailyStreams",
      (sss.daily_streams - LAG(sss.daily_streams) OVER (
        PARTITION BY sss.song_id ORDER BY sss.snapshot_date
      ))                                                          AS "dailyGrowth",
      (sss.spotify_streams - LAG(sss.spotify_streams, 7) OVER (
        PARTITION BY sss.song_id ORDER BY sss.snapshot_date
      ))                                                          AS "growth7d"
    FROM song_stats_snapshots sss
    JOIN songs s ON s.id = sss.song_id
    WHERE s.slug = ${slug}
      AND s.entity_status = 'canonical'
    ORDER BY sss.snapshot_date ASC
    LIMIT 90
  `);
    return result.rows as SongHistoryPoint[];
  }

  async getMilestoneSongs(params: {
    threshold: number;
    limit: number;
    offset: number;
  }): Promise<{ data: MilestoneSongEntry[]; total: number }> {
    const { threshold, limit, offset } = params;

    const result = await this.db.execute(sql`
    SELECT
      ROW_NUMBER() OVER (ORDER BY ss.total_spotify_streams DESC) AS rank,
      s.id                        AS "songId",
      s.title                     AS "songTitle",
      s.slug                      AS "songSlug",
      s.image_url                 AS "imageUrl",
      a.id                        AS "artistId",
      a.name                      AS "artistName",
      a.slug                      AS "artistSlug",
      s.is_afrobeats              AS "isAfrobeats",
      ss.total_spotify_streams    AS "totalStreams",
      ss.daily_streams            AS "dailyStreams",
      s.release_date              AS "releaseDate"
    FROM song_stream_summary ss
    JOIN songs s ON s.id = ss.song_id
    JOIN artists a ON a.id = s.artist_id
    WHERE ss.total_spotify_streams >= ${threshold}
      AND s.entity_status = 'canonical'
      AND s.merged_into_song_id IS NULL
    ORDER BY ss.total_spotify_streams DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

    const countResult = await this.db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM song_stream_summary ss
    JOIN songs s ON s.id = ss.song_id
    WHERE ss.total_spotify_streams >= ${threshold}
      AND s.entity_status = 'canonical'
      AND s.merged_into_song_id IS NULL
  `);

    return {
      data: result.rows as MilestoneSongEntry[],
      total: (countResult.rows[0] as any).total,
    };
  }
}
