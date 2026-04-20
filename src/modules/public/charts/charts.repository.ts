import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';

export interface ChartEntry {
  entryId: string;
  songId: string;
  artistId: string;
  chartName: string;
  chartTerritory: string;
  position: number;
  peakPosition: number | null;
  weeksOnChart: number | null;
  chartWeek: string;
  prevRank: number | null;
  delta: number | null;
  trend: string | null;
  songTitle: string;
  songSlug: string | null;
  songImageUrl: string | null;
  spotifyTrackId: string | null;
  artistName: string;
  artistSlug: string | null;
  artistImageUrl: string | null;
  isAfrobeats: boolean;
}

export interface AvailableChart {
  chartName: string;
  chartTerritory: string;
  latestWeek: string;
  totalEntries: number;
}

export interface ChartFilters {
  chartName: string;
  territory: string;
  limit?: number;
}

export interface AfrobeatsUkSummary {
  totalEntries: number;
  uniqueArtists: number;
  weeksTracked: number;
  weeksAtNumber1: number;
  topArtists: { artistName: string; entries: number; bestPosition: number }[];
  latestWeek: string;
}

@Injectable()
export class ChartsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getAvailableCharts(): Promise<AvailableChart[]> {
    const result = await this.db.execute(sql`
      SELECT
        chart_name              AS "chartName",
        chart_territory         AS "chartTerritory",
        MAX(chart_week)         AS "latestWeek",
        COUNT(*)::int           AS "totalEntries"
      FROM chart_latest_leaderboard
      GROUP BY chart_name, chart_territory
      ORDER BY chart_territory, chart_name
    `);

    return result.rows as AvailableChart[];
  }

  async getLatestLeaderboard(filters: ChartFilters): Promise<ChartEntry[]> {
    const limit = Math.min(filters.limit ?? 100, 200);

    const result = await this.db.execute(sql`
    WITH latest_week AS (
      SELECT MAX(chart_week) AS week
      FROM chart_latest_leaderboard
      WHERE chart_name      = ${filters.chartName}
        AND chart_territory = ${filters.territory.toUpperCase()}
    )
    SELECT
      entry_id                AS "entryId",
      song_id                 AS "songId",
      artist_id               AS "artistId",
      chart_name              AS "chartName",
      chart_territory         AS "chartTerritory",
      position::int           AS "position",
      peak_position::int      AS "peakPosition",
      weeks_on_chart::int     AS "weeksOnChart",
      chart_week              AS "chartWeek",
      prev_rank::int          AS "prevRank",
      delta::int              AS "delta",
      trend,
      song_title              AS "songTitle",
      song_slug               AS "songSlug",
      song_image_url          AS "songImageUrl",
      spotify_track_id        AS "spotifyTrackId",
      artist_name             AS "artistName",
      artist_slug             AS "artistSlug",
      artist_image_url        AS "artistImageUrl",
      is_afrobeats            AS "isAfrobeats"
    FROM chart_latest_leaderboard
    WHERE chart_name      = ${filters.chartName}
      AND chart_territory = ${filters.territory.toUpperCase()}
      AND chart_week      = (SELECT week FROM latest_week)
    ORDER BY position ASC
    LIMIT ${limit}
  `);

    return result.rows as ChartEntry[];
  }

  async getAfrobeatsUkSummary(): Promise<AfrobeatsUkSummary> {
    const result = await this.db.execute(sql`
    SELECT
      COUNT(*)::int                                      AS "totalEntries",
      COUNT(DISTINCT artist_id)::int                     AS "uniqueArtists",
      COUNT(DISTINCT chart_week)::int                    AS "weeksTracked",
      COUNT(*) FILTER (WHERE position = 1)::int          AS "weeksAtNumber1",
      MAX(chart_week)                                    AS "latestWeek"
    FROM chart_latest_leaderboard
    WHERE chart_name = 'official_afrobeats_chart'
      AND chart_territory = 'UK'
  `);

    const topArtistsResult = await this.db.execute(sql`
    SELECT
      artist_name                    AS "artistName",
      COUNT(*)::int                  AS "entries",
      MIN(peak_position)::int        AS "bestPosition"
    FROM chart_latest_leaderboard
    WHERE chart_name = 'official_afrobeats_chart'
      AND chart_territory = 'UK'
    GROUP BY artist_id, artist_name
    ORDER BY entries DESC
    LIMIT 5
  `);

    const summary = result.rows[0] as any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
      ...summary,
      topArtists: topArtistsResult.rows as AfrobeatsUkSummary['topArtists'],
    };
  }
}
