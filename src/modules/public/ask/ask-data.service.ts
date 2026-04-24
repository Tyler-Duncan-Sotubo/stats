/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';

@Injectable()
export class AskDataService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Artist ────────────────────────────────────────────────────────────────

  async getArtist(slug: string) {
    try {
      // First get the artist
      const artistResult = await this.db.execute(sql`
      SELECT
        a.id,
        a.name,
        a.slug,
        a.image_url           AS "imageUrl",
        a.origin_country      AS "originCountry",
        a.is_afrobeats        AS "isAfrobeats",
        ass.total_streams     AS "totalStreams",
        ass.daily_streams     AS "dailyStreams",
        ass.track_count       AS "trackCount",
        aml.monthly_listeners AS "monthlyListeners",
        aml.global_rank       AS "globalRank",
        aml.daily_change      AS "listenersDailyChange"
      FROM artists a
      LEFT JOIN artist_stream_summary ass ON ass.artist_id = a.id
      LEFT JOIN artist_monthly_listener_summary aml ON aml.artist_id = a.id
      WHERE a.slug = ${slug}
      LIMIT 1
    `);

      const artist = artistResult.rows[0];
      if (!artist) return null;

      const artistId = (artist as any).id;

      // Awards
      const awardsResult = await this.db.execute(sql`
      SELECT json_build_object(
        'grammyWins',        COUNT(*) FILTER (WHERE LOWER(award_body) = 'grammy' AND result = 'won'),
        'grammyNominations', COUNT(*) FILTER (WHERE LOWER(award_body) = 'grammy'),
        'totalWins',         COUNT(*) FILTER (WHERE result = 'won'),
        'totalNominations',  COUNT(*)
      ) AS summary
      FROM artist_awards_summary
      WHERE artist_id = ${artistId}
    `);

      // Top songs
      const songsResult = await this.db.execute(sql`
      SELECT song_title AS title, total_spotify_streams AS streams
      FROM song_stream_summary
      WHERE artist_id = ${artistId}
      ORDER BY total_spotify_streams DESC NULLS LAST
      LIMIT 3
    `);

      // Charts
      const chartsResult = await this.db.execute(sql`
      SELECT
        chart_name         AS "chartName",
        chart_territory    AS "chartTerritory",
        best_peak_position AS "bestPeakPosition",
        weeks_at_number_1  AS "weeksAtNumber1",
        total_chart_weeks  AS "totalChartWeeks"
      FROM artist_chart_summary
      WHERE artist_id = ${artistId}
        AND role = 'primary'
      ORDER BY total_chart_weeks DESC
      LIMIT 5
    `);

      return {
        ...artist,
        awardsSummary: (awardsResult.rows[0] as any)?.summary ?? {
          grammyWins: 0,
          grammyNominations: 0,
          totalWins: 0,
          totalNominations: 0,
        },
        topSongs: songsResult.rows,
        charts: chartsResult.rows,
      };
    } catch (err) {
      console.error(
        '[AskDataService] getArtist failed:',
        (err as Error).message,
      );
      return null;
    }
  }

  // ── Song ──────────────────────────────────────────────────────────────────

  async getSong(title: string, artistName?: string) {
    const sanitised = title
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tsQuery = sanitised
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => w + ':*')
      .join(' & ');

    const artistFilter = artistName
      ? sql`AND LOWER(artist_name) LIKE ${'%' + artistName.toLowerCase() + '%'}`
      : sql``;

    const cols = sql`
      id,
      title,
      slug,
      spotify_track_id  AS "spotifyTrackId",
      artist_name       AS "artistName",
      artist_slug       AS "artistSlug",
      artist_image_url  AS "artistImageUrl",
      song_image_url    AS "imageUrl",
      total_streams     AS "totalStreams",
      daily_streams     AS "dailyStreams"
    `;

    // 1. Full-text search
    if (tsQuery) {
      const result = await this.db.execute(sql`
        SELECT ${cols}
        FROM song_search_summary
        WHERE search_vector @@ to_tsquery('english', ${tsQuery})
          ${artistFilter}
        ORDER BY total_streams DESC NULLS LAST
        LIMIT 1
      `);
      if (result.rows[0]) return result.rows[0];
    }

    // 2. Trigram fuzzy fallback
    const fuzzy = await this.db.execute(sql`
      SELECT ${cols},
        similarity(LOWER(title), LOWER(${title})) AS score
      FROM song_search_summary
      WHERE similarity(LOWER(title), LOWER(${title})) > 0.3
        ${artistFilter}
      ORDER BY score DESC, total_streams DESC NULLS LAST
      LIMIT 1
    `);
    if (fuzzy.rows[0]) return fuzzy.rows[0];

    // 3. LIKE fallback
    const like = await this.db.execute(sql`
      SELECT ${cols}
      FROM song_search_summary
      WHERE LOWER(title) LIKE ${'%' + sanitised.toLowerCase() + '%'}
        ${artistFilter}
      ORDER BY total_streams DESC NULLS LAST
      LIMIT 1
    `);

    return like.rows[0] ?? null;
  }

  // ── Artist top songs ──────────────────────────────────────────────────────

  async getArtistTopSongs(slug: string, limit: number) {
    const result = await this.db.execute(sql`
      SELECT
        s.id,
        s.title,
        s.slug,
        s.image_url              AS "imageUrl",
        a.name                   AS "artistName",
        a.slug                   AS "artistSlug",
        ss.total_spotify_streams AS "totalStreams",
        ss.daily_streams         AS "dailyStreams"
      FROM songs s
      JOIN artists a ON a.id = s.artist_id
      LEFT JOIN song_stream_summary ss ON ss.song_id = s.id
      WHERE a.slug = ${slug}
        AND s.entity_status = 'canonical'
        AND s.merged_into_song_id IS NULL
      ORDER BY ss.total_spotify_streams DESC NULLS LAST
      LIMIT ${limit}
    `);

    return result.rows;
  }

  // ── Leaderboard streams ───────────────────────────────────────────────────

  async getLeaderboardStreams(params: {
    limit: number;
    country?: string;
    isAfrobeats?: boolean;
  }) {
    const result = await this.db.execute(sql`
      SELECT
        artist_name      AS "artistName",
        artist_slug      AS "artistSlug",
        artist_image_url AS "imageUrl",
        origin_country   AS "originCountry",
        total_streams    AS "totalStreams",
        daily_streams    AS "dailyStreams"
      FROM artist_stream_summary
      WHERE 1=1
        ${params.country ? sql`AND origin_country = ${params.country}` : sql``}
        ${params.isAfrobeats ? sql`AND is_afrobeats = true` : sql``}
      ORDER BY total_streams DESC NULLS LAST
      LIMIT ${params.limit}
    `);

    return result.rows;
  }

  // ── Leaderboard listeners ─────────────────────────────────────────────────

  async getLeaderboardListeners(params: {
    limit: number;
    country?: string;
    isAfrobeats?: boolean;
  }) {
    const result = await this.db.execute(sql`
      SELECT
        artist_name       AS "artistName",
        artist_slug       AS "artistSlug",
        artist_image_url  AS "imageUrl",
        origin_country    AS "originCountry",
        monthly_listeners AS "monthlyListeners",
        global_rank       AS "globalRank"
      FROM artist_monthly_listener_summary
      WHERE 1=1
        ${params.country ? sql`AND origin_country = ${params.country}` : sql``}
        ${params.isAfrobeats ? sql`AND is_afrobeats = true` : sql``}
      ORDER BY monthly_listeners DESC NULLS LAST
      LIMIT ${params.limit}
    `);

    return result.rows;
  }

  // ── Leaderboard songs ─────────────────────────────────────────────────────

  async getLeaderboardSongs(params: { limit: number; isAfrobeats?: boolean }) {
    const result = await this.db.execute(sql`
      SELECT
        song_title            AS "songTitle",
        song_slug             AS "songSlug",
        artist_name           AS "artistName",
        artist_slug           AS "artistSlug",
        song_image_url        AS "imageUrl",
        total_spotify_streams AS "totalStreams",
        daily_streams         AS "dailyStreams"
      FROM song_stream_summary
      WHERE 1=1
        ${params.isAfrobeats ? sql`AND artist_is_afrobeats = true` : sql``}
      ORDER BY total_spotify_streams DESC NULLS LAST
      LIMIT ${params.limit}
    `);

    return result.rows;
  }

  // ── Trending artists ──────────────────────────────────────────────────────

  async getTrendingArtists(params: {
    limit: number;
    country?: string;
    isAfrobeats?: boolean;
  }) {
    const result = await this.db.execute(sql`
      SELECT
        artist_name      AS "artistName",
        artist_slug      AS "artistSlug",
        image_url        AS "imageUrl",
        origin_country   AS "originCountry",
        daily_growth     AS "dailyGrowth",
        growth_7d        AS "growth7d",
        momentum_score   AS "momentumScore",
        total_streams    AS "totalStreams"
      FROM artist_trending_summary
      WHERE snapshot_date = (
        SELECT MAX(snapshot_date) FROM artist_trending_summary
      )
        ${params.country ? sql`AND origin_country = ${params.country}` : sql``}
        ${params.isAfrobeats ? sql`AND is_afrobeats = true` : sql``}
      ORDER BY momentum_score DESC NULLS LAST
      LIMIT ${params.limit}
    `);

    return result.rows;
  }

  // ── Trending songs ────────────────────────────────────────────────────────

  async getTrendingSongs(params: { limit: number; isAfrobeats?: boolean }) {
    const result = await this.db.execute(sql`
      SELECT
        song_title     AS "songTitle",
        song_slug      AS "songSlug",
        artist_name    AS "artistName",
        artist_slug    AS "artistSlug",
        daily_growth   AS "dailyGrowth",
        growth_7d      AS "growth7d",
        momentum_score AS "momentumScore",
        total_streams  AS "totalStreams"
      FROM song_trending_summary
      WHERE snapshot_date = (
        SELECT MAX(snapshot_date) FROM song_trending_summary
      )
        ${params.isAfrobeats ? sql`AND artist_is_afrobeats = true` : sql``}
      ORDER BY momentum_score DESC NULLS LAST
      LIMIT ${params.limit}
    `);

    return result.rows;
  }

  // ── Chart ─────────────────────────────────────────────────────────────────

  async getChart(chartName: string, territory: string, limit: number) {
    const result = await this.db.execute(sql`
      SELECT
        position,
        song_title     AS "songTitle",
        song_slug      AS "songSlug",
        artist_name    AS "artistName",
        artist_slug    AS "artistSlug",
        song_image_url AS "imageUrl",
        weeks_on_chart AS "weeksOnChart",
        peak_position  AS "peakPosition",
        trend,
        delta
      FROM chart_latest_leaderboard
      WHERE chart_name      = ${chartName}
        AND chart_territory = ${territory}
      ORDER BY position ASC
      LIMIT ${limit}
    `);

    return {
      chartName,
      territory,
      data: result.rows,
    };
  }

  // ── Afrobeats UK summary ──────────────────────────────────────────────────

  async getAfrobeatsUkSummary() {
    const summary = await this.db.execute(sql`
      SELECT
        COUNT(DISTINCT artist_id)                               AS "uniqueArtists",
        COUNT(DISTINCT chart_week)                              AS "weeksTracked",
        COUNT(DISTINCT chart_week) FILTER (WHERE position = 1) AS "weeksAtNumber1"
      FROM chart_latest_leaderboard
      WHERE chart_name      = 'official_afrobeats_chart'
        AND chart_territory = 'UK'
    `);

    const topArtists = await this.db.execute(sql`
      SELECT
        artist_name AS "artistName",
        artist_slug AS "artistSlug",
        COUNT(*)    AS appearances
      FROM chart_latest_leaderboard
      WHERE chart_name      = 'official_afrobeats_chart'
        AND chart_territory = 'UK'
      GROUP BY artist_name, artist_slug
      ORDER BY appearances DESC
      LIMIT 5
    `);

    return {
      ...summary.rows[0],
      topArtists: topArtists.rows,
    };
  }

  // ── Comparison ────────────────────────────────────────────────────────────

  async getComparison(slug1: string, slug2: string) {
    const result = await this.db.execute(sql`
      SELECT
        a.name,
        a.slug,
        a.image_url           AS "imageUrl",
        a.origin_country      AS "originCountry",
        ass.total_streams     AS "totalStreams",
        ass.daily_streams     AS "dailyStreams",
        aml.monthly_listeners AS "monthlyListeners",
        aml.global_rank       AS "globalRank"
      FROM artists a
      LEFT JOIN artist_stream_summary ass ON ass.artist_id = a.id
      LEFT JOIN artist_monthly_listener_summary aml ON aml.artist_id = a.id
      WHERE a.slug IN (${slug1}, ${slug2})
    `);

    const artist1 = result.rows.find((r: any) => r.slug === slug1);
    const artist2 = result.rows.find((r: any) => r.slug === slug2);

    if (!artist1 || !artist2) return null;

    return { artist1, artist2 };
  }

  // ── Certification leaderboard ─────────────────────────────────────────────

  async getCertificationLeaderboard(params: {
    limit: number;
    level?: string;
    territory?: string;
    isAfrobeats?: boolean;
  }) {
    const result = await this.db.execute(sql`
      SELECT
        artist_name                 AS "artistName",
        artist_slug                 AS "artistSlug",
        artist_image_url            AS "imageUrl",
        origin_country              AS "originCountry",
        SUM(total_certifications)   AS "totalCertifications",
        SUM(platinum_count)         AS "platinumCount",
        SUM(diamond_count)          AS "diamondCount",
        SUM(gold_count)             AS "goldCount",
        SUM(total_platinum_units)   AS "totalPlatinumUnits"
      FROM artist_certification_summary
      WHERE 1=1
        ${params.territory ? sql`AND territory = ${params.territory}` : sql``}
        ${params.isAfrobeats ? sql`AND is_afrobeats = true` : sql``}
      GROUP BY artist_name, artist_slug, artist_image_url, origin_country
      ORDER BY ${
        params.level === 'diamond'
          ? sql`SUM(diamond_count)`
          : params.level === 'gold'
            ? sql`SUM(gold_count)`
            : sql`SUM(total_platinum_units)`
      } DESC
      LIMIT ${params.limit}
    `);

    return result.rows;
  }

  // ── Chart weeks leaderboard ───────────────────────────────────────────────

  async getChartWeeksLeaderboard(params: {
    limit: number;
    territory?: string;
    chartName?: string;
    isAfrobeats?: boolean;
  }) {
    const result = await this.db.execute(sql`
      SELECT
        artist_name                AS "artistName",
        artist_slug                AS "artistSlug",
        artist_image_url           AS "imageUrl",
        origin_country             AS "originCountry",
        SUM(total_chart_weeks)     AS "totalChartWeeks",
        SUM(weeks_at_number_1)     AS "weeksAtNumber1",
        MIN(best_peak_position)    AS "bestPeakPosition",
        COUNT(DISTINCT chart_name) AS "chartsAppearedOn"
      FROM artist_chart_summary
      WHERE role = 'primary'
        ${params.territory ? sql`AND chart_territory = ${params.territory}` : sql``}
        ${params.chartName ? sql`AND chart_name = ${params.chartName}` : sql``}
        ${params.isAfrobeats ? sql`AND is_afrobeats = true` : sql``}
      GROUP BY artist_name, artist_slug, artist_image_url, origin_country
      ORDER BY SUM(total_chart_weeks) DESC
      LIMIT ${params.limit}
    `);

    return result.rows;
  }

  async getAfricanBillboardNumber1s() {
    const result = await this.db.execute(sql`
    SELECT DISTINCT
      a.name        AS "artistName",
      a.slug        AS "artistSlug",
      MIN(ce.chart_week) AS "firstNumber1",
      COUNT(*)      AS "weeksAtNumber1"
    FROM chart_entries ce
    JOIN artists a ON a.id = ce.artist_id
    WHERE ce.chart_name = 'billboard_hot_100'
      AND ce.position = 1
      AND a.is_afrobeats = true
    GROUP BY a.name, a.slug
    ORDER BY "firstNumber1" ASC
  `);

    return result.rows;
  }
}
