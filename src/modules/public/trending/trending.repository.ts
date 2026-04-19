import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';

export interface TrendingArtist {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  originCountry: string | null;
  isAfrobeats: boolean;
  spotifyId: string | null;
  snapshotDate: string;
  dailyStreams: number | null;
  dailyGrowth: number | null;
  growth7d: number | null;
  momentumScore: number | null;
  totalStreams: number | null;
  monthlyListeners: number | null;
  bestChartPeak: number | null;
  bestChartName: string | null;
  bestChartTerritory: string | null;
}

export interface TrendingSong {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  spotifyTrackId: string | null;
  isAfrobeats: boolean;
  artistId: string;
  artistName: string | null;
  artistSlug: string | null;
  artistImageUrl: string | null;
  snapshotDate: string;
  dailyStreams: number | null;
  dailyGrowth: number | null;
  growth7d: number | null;
  momentumScore: number | null;
  totalStreams: number | null;
  bestChartPeak: number | null;
  bestChartName: string | null;
  bestChartTerritory: string | null;
}

export interface TrendingFilters {
  limit?: number;
  isAfrobeats?: boolean;
  country?: string;
}

@Injectable()
export class TrendingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getTrendingArtists(
    filters: TrendingFilters,
  ): Promise<TrendingArtist[]> {
    const limit = Math.min(filters.limit ?? 20, 100);

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
        a.id,
        a.name,
        a.slug,
        a.image_url                               AS "imageUrl",
        a.origin_country                          AS "originCountry",
        a.is_afrobeats                            AS "isAfrobeats",
        a.spotify_id                              AS "spotifyId",
        t.snapshot_date                           AS "snapshotDate",
        t.daily_streams::bigint                   AS "dailyStreams",
        t.daily_growth::bigint                    AS "dailyGrowth",
        t.growth_7d::bigint                       AS "growth7d",
        t.momentum_score::float                   AS "momentumScore",
        s.total_streams::bigint                   AS "totalStreams",
        ml.monthly_listeners::bigint              AS "monthlyListeners",
        chart.best_peak_position::int             AS "bestChartPeak",
        chart.chart_name                          AS "bestChartName",
        chart.chart_territory                     AS "bestChartTerritory"
      FROM artist_trending_summary t
      JOIN artists a ON a.id = t.artist_id
      LEFT JOIN artist_stream_summary s ON s.artist_id = t.artist_id
      LEFT JOIN artist_monthly_listener_summary ml ON ml.artist_id = t.artist_id
      LEFT JOIN LATERAL (
        SELECT
          arc.best_peak_position,
          arc.chart_name,
          arc.chart_territory
        FROM artist_chart_summary arc
        WHERE arc.artist_id = t.artist_id
        ORDER BY arc.best_peak_position ASC NULLS LAST
        LIMIT 1
      ) chart ON true
      WHERE t.snapshot_date = (SELECT MAX(snapshot_date) FROM artist_trending_summary)
        AND a.entity_status = 'canonical'
        ${afrobeatsFragment}
        ${countryFragment}
      ORDER BY t.momentum_score DESC NULLS LAST
      LIMIT ${limit}
    `);

    return result.rows as TrendingArtist[];
  }

  async getTrendingSongs(filters: TrendingFilters): Promise<TrendingSong[]> {
    const limit = Math.min(filters.limit ?? 20, 100);

    let afrobeatsFragment = sql``;

    if (filters.isAfrobeats !== undefined) {
      afrobeatsFragment = sql` AND sg.is_afrobeats = ${filters.isAfrobeats}`;
    }

    const result = await this.db.execute(sql`
      SELECT
        sg.id,
        sg.title,
        sg.slug,
        sg.image_url                              AS "imageUrl",
        sg.spotify_track_id                       AS "spotifyTrackId",
        sg.is_afrobeats                           AS "isAfrobeats",
        sg.artist_id                              AS "artistId",
        a.name                                    AS "artistName",
        a.slug                                    AS "artistSlug",
        a.image_url                               AS "artistImageUrl",
        t.snapshot_date                           AS "snapshotDate",
        t.daily_streams::bigint                   AS "dailyStreams",
        t.daily_growth::bigint                    AS "dailyGrowth",
        t.growth_7d::bigint                       AS "growth7d",
        t.momentum_score::float                   AS "momentumScore",
        s.total_spotify_streams::bigint           AS "totalStreams",
        chart.peak_position::int                  AS "bestChartPeak",
        chart.chart_name                          AS "bestChartName",
        chart.chart_territory                     AS "bestChartTerritory"
      FROM song_trending_summary t
      JOIN songs sg ON sg.id = t.song_id
      JOIN artists a ON a.id = sg.artist_id
      LEFT JOIN song_stream_summary s ON s.song_id = t.song_id
      LEFT JOIN LATERAL (
        SELECT
          scs.peak_position,
          scs.chart_name,
          scs.chart_territory
        FROM song_chart_summary scs
        WHERE scs.song_id = t.song_id
        ORDER BY scs.peak_position ASC NULLS LAST
        LIMIT 1
      ) chart ON true
      WHERE t.snapshot_date = (SELECT MAX(snapshot_date) FROM song_trending_summary)
        AND sg.entity_status = 'canonical'
        ${afrobeatsFragment}
      ORDER BY t.momentum_score DESC NULLS LAST
      LIMIT ${limit}
    `);

    return result.rows as TrendingSong[];
  }
}
