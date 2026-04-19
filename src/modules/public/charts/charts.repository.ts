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
}
