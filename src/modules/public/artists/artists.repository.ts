/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';

export interface PublicArtist {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  originCountry: string | null;
  isAfrobeats: boolean;
  spotifyId: string | null;
  popularity: number | null;
  // streams
  totalStreams: number | null;
  totalStreamsAsLead: number | null;
  totalStreamsAsFeature: number | null;
  dailyStreams: number | null;
  trackCount: number | null;
  streamSnapshotDate: string | null;
  // listeners
  monthlyListeners: number | null;
  dailyListenerChange: number | null;
  peakListeners: number | null;
  listenerSnapshotDate: string | null;
  // certifications
  certifications: PublicArtistCertification[];
  // chart summary
  charts: PublicArtistChart[];
  // records
  records: PublicArtistRecord[];
  // awards
  awards: PublicArtistAward[];
  // top songs
  topSongs: PublicArtistSong[];
  // audiomack stats
  audiomackStats: {
    audiomackSlug: string | null;
    snapshotDate: string | null;
    totalPlays: number | null;
    monthlyPlays: number | null;
    followers: number | null;
  } | null;
  awardsSummary: {
    totalWins: number;
    totalNominations: number;
    grammyWins: number;
    grammyNominations: number;
  };
}

export interface PublicArtistCertification {
  territory: string;
  body: string;
  totalCertifications: number;
  diamondCount: number;
  platinumCount: number;
  goldCount: number;
  silverCount: number;
  totalPlatinumUnits: number;
  latestCertification: string | null;
}

export interface PublicArtistChart {
  chartName: string;
  chartTerritory: string;
  role: string;
  bestPeakPosition: number | null;
  weeksAtNumber1: number;
  weeksInTop10: number;
  totalChartWeeks: number;
  distinctSongsCharted: number;
  firstChartAppearance: string | null;
  latestChartAppearance: string | null;
}

export interface PublicArtistRecord {
  id: string;
  recordType: string;
  recordValue: string;
  numericValue: number | null;
  scope: string;
  isActive: boolean;
  setOn: string | null;
  notes: string | null;
}

export interface PublicArtistAward {
  id: string;
  awardBody: string;
  awardName: string;
  category: string;
  result: string;
  year: number;
  ceremony: string | null;
  territory: string | null;
}

export interface PublicArtistSong {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  spotifyTrackId: string | null;
  totalStreams: number | null;
  dailyStreams: number | null;
  releaseDate: string | null;
}

export interface BrowseArtistEntry {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  originCountry: string | null;
  isAfrobeats: boolean;
  totalStreams: number | null;
  monthlyListeners: number | null;
}

export interface BrowseArtistsResult {
  data: BrowseArtistEntry[];
  total: number;
}

export interface ArtistSongEntry {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  spotifyTrackId: string | null;
  isAfrobeats: boolean;
  explicit: boolean;
  totalStreams: number | null;
  dailyStreams: number | null;
}

export interface ArtistHistoryPoint {
  date: string;
  totalStreams: number | null;
  dailyStreams: number | null;
  dailyGrowth: number | null;
  growth7d: number | null;
}

export interface MilestoneArtistEntry {
  rank: number;
  artistId: string;
  artistName: string;
  artistSlug: string | null;
  imageUrl: string | null;
  originCountry: string | null;
  isAfrobeats: boolean;
  totalStreams: number;
  dailyStreams: number | null;
}

@Injectable()
export class ArtistsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findBySlug(
    slug: string,
  ): Promise<Omit<
    PublicArtist,
    'certifications' | 'charts' | 'records' | 'awards' | 'topSongs'
  > | null> {
    const result = await this.db.execute(sql`
      SELECT
        a.id,
        a.name,
        a.slug,
        a.image_url                           AS "imageUrl",
        a.origin_country                      AS "originCountry",
        a.is_afrobeats                        AS "isAfrobeats",
        a.spotify_id                          AS "spotifyId",
        a.popularity,
        s.total_streams                       AS "totalStreams",
        s.total_streams_as_lead               AS "totalStreamsAsLead",
        s.total_streams_as_feature            AS "totalStreamsAsFeature",
        s.daily_streams                       AS "dailyStreams",
        s.track_count                         AS "trackCount",
        s.snapshot_date                       AS "streamSnapshotDate",
        ml.monthly_listeners                  AS "monthlyListeners",
        ml.daily_change                       AS "dailyListenerChange",
        ml.peak_listeners                     AS "peakListeners",
        ml.snapshot_date                      AS "listenerSnapshotDate"
      FROM artists a
      LEFT JOIN artist_stream_summary s ON s.artist_id = a.id
      LEFT JOIN artist_monthly_listener_summary ml ON ml.artist_id = a.id
      WHERE a.slug = ${slug}
          AND a.entity_status IN ('canonical', 'provisional')
      LIMIT 1
    `);

    if (!result.rows.length) return null;
    return result.rows[0] as any;
  }

  async getCertifications(
    artistId: string,
  ): Promise<PublicArtistCertification[]> {
    const result = await this.db.execute(sql`
      SELECT
        territory,
        body,
        total_certifications      AS "totalCertifications",
        diamond_count             AS "diamondCount",
        platinum_count            AS "platinumCount",
        gold_count                AS "goldCount",
        silver_count              AS "silverCount",
        total_platinum_units      AS "totalPlatinumUnits",
        latest_certification      AS "latestCertification"
      FROM artist_certification_summary
      WHERE artist_id = ${artistId}
      ORDER BY total_platinum_units DESC
    `);

    return result.rows as PublicArtistCertification[];
  }

  async getCharts(artistId: string): Promise<PublicArtistChart[]> {
    const result = await this.db.execute(sql`
      SELECT
        chart_name                AS "chartName",
        chart_territory           AS "chartTerritory",
        role,
        best_peak_position        AS "bestPeakPosition",
        weeks_at_number_1         AS "weeksAtNumber1",
        weeks_in_top_10           AS "weeksInTop10",
        total_chart_weeks         AS "totalChartWeeks",
        distinct_songs_charted    AS "distinctSongsCharted",
        first_chart_appearance    AS "firstChartAppearance",
        latest_chart_appearance   AS "latestChartAppearance"
      FROM artist_chart_summary
      WHERE artist_id = ${artistId}
      ORDER BY best_peak_position ASC NULLS LAST
    `);

    return result.rows as PublicArtistChart[];
  }

  async getRecords(artistId: string): Promise<PublicArtistRecord[]> {
    const result = await this.db.execute(sql`
    SELECT
      id,
      record_type     AS "recordType",
      record_value    AS "recordValue",
      numeric_value   AS "numericValue",
      scope,
      is_active       AS "isActive",
      set_on          AS "setOn",
      notes
    FROM artist_records_summary
    WHERE artist_id = ${artistId}
      AND is_active = true
    ORDER BY set_on DESC NULLS LAST
  `);

    return result.rows as PublicArtistRecord[];
  }

  async getAwards(artistId: string): Promise<PublicArtistAward[]> {
    const result = await this.db.execute(sql`
    SELECT
      id,
      award_body    AS "awardBody",
      award_name    AS "awardName",
      category,
      result,
      year,
      ceremony,
      territory
    FROM artist_awards_summary
    WHERE artist_id = ${artistId}
    ORDER BY year DESC, result ASC
  `);

    return result.rows as PublicArtistAward[];
  }

  async getTopSongs(artistId: string, limit = 10): Promise<PublicArtistSong[]> {
    const result = await this.db.execute(sql`
      SELECT
        s.id,
        s.title,
        s.slug,
        s.image_url             AS "imageUrl",
        s.spotify_track_id      AS "spotifyTrackId",
        ss.total_spotify_streams AS "totalStreams",
        ss.daily_streams        AS "dailyStreams",
        s.release_date          AS "releaseDate"
      FROM songs s
      LEFT JOIN song_stream_summary ss ON ss.song_id = s.id
      WHERE s.artist_id = ${artistId}
        AND s.entity_status = 'canonical'
      ORDER BY ss.total_spotify_streams DESC NULLS LAST
      LIMIT ${limit}
    `);

    return result.rows as PublicArtistSong[];
  }

  async browse(params: {
    limit: number;
    offset: number;
    letter?: string;
    country?: string;
    isAfrobeats?: boolean;
    sortBy?: 'name' | 'totalStreams' | 'monthlyListeners';
  }): Promise<BrowseArtistsResult> {
    const {
      limit,
      offset,
      letter,
      country,
      isAfrobeats,
      sortBy = 'totalStreams',
    } = params;

    let letterFragment = sql``;
    let countryFragment = sql``;
    let afrobeatsFragment = sql``;

    if (letter) {
      letterFragment = sql` AND UPPER(a.name) LIKE ${letter.toUpperCase() + '%'}`;
    }
    if (country) {
      countryFragment = sql` AND a.origin_country = ${country.toUpperCase()}`;
    }
    if (isAfrobeats !== undefined) {
      afrobeatsFragment = sql` AND a.is_afrobeats = ${isAfrobeats}`;
    }

    const orderBy =
      sortBy === 'name'
        ? sql`a.name ASC`
        : sortBy === 'monthlyListeners'
          ? sql`ml.monthly_listeners DESC NULLS LAST`
          : sql`s.total_streams DESC NULLS LAST`;

    const [dataResult, countResult] = await Promise.all([
      this.db.execute(sql`
      SELECT
        a.id,
        a.name,
        a.slug,
        a.image_url           AS "imageUrl",
        a.origin_country      AS "originCountry",
        a.is_afrobeats        AS "isAfrobeats",
        s.total_streams       AS "totalStreams",
        ml.monthly_listeners  AS "monthlyListeners"
      FROM artists a
      LEFT JOIN artist_stream_summary s ON s.artist_id = a.id
      LEFT JOIN artist_monthly_listener_summary ml ON ml.artist_id = a.id
      WHERE a.entity_status = 'canonical'
        ${letterFragment}
        ${countryFragment}
        ${afrobeatsFragment}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `),
      this.db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM artists a
      WHERE a.entity_status = 'canonical'
        ${letterFragment}
        ${countryFragment}
        ${afrobeatsFragment}
    `),
    ]);

    const total = (countResult.rows[0] as any)?.total ?? 0;

    return {
      data: (dataResult.rows as any[]).map((row) => ({
        ...row,
        totalStreams: row.totalStreams ? Number(row.totalStreams) : null,
        monthlyListeners: row.monthlyListeners
          ? Number(row.monthlyListeners)
          : null,
      })),
      total,
    };
  }

  async getAwardsSummary(artistId: string) {
    const result = await this.db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE LOWER(result) = 'won')                                          AS "totalWins",
      COUNT(*) FILTER (WHERE LOWER(result) IN ('won', 'nominated', 'nominee'))                AS "totalNominations",
      COUNT(*) FILTER (WHERE LOWER(award_body) LIKE '%grammy%' AND LOWER(result) = 'won')    AS "grammyWins",
      COUNT(*) FILTER (WHERE LOWER(award_body) LIKE '%grammy%'
        AND LOWER(result) IN ('won', 'nominated', 'nominee'))                                 AS "grammyNominations"
    FROM artist_awards_summary
    WHERE artist_id = ${artistId}
  `);

    const row = result.rows[0] as any;

    return (
      row ?? {
        totalWins: 0,
        totalNominations: 0,
        grammyWins: 0,
        grammyNominations: 0,
      }
    );
  }

  async getIndexableArtists(
    limit: number,
    offset: number,
  ): Promise<{ slug: string; updatedAt: string }[]> {
    const result = await this.db.execute(sql`
    SELECT 
      slug,
      updated_at AS "updatedAt"
    FROM artists
    WHERE entity_status = 'canonical'
      AND slug IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
    return result.rows as { slug: string; updatedAt: string }[];
  }

  async getArtistSongs(
    slug: string,
    limit: number,
  ): Promise<ArtistSongEntry[]> {
    const result = await this.db.execute(sql`
    SELECT
      s.id,
      s.title,
      s.slug,
      s.image_url         AS "imageUrl",
      s.release_date      AS "releaseDate",
      s.spotify_track_id  AS "spotifyTrackId",
      s.is_afrobeats      AS "isAfrobeats",
      s.explicit,
      ss.total_spotify_streams  AS "totalStreams",
      ss.daily_streams          AS "dailyStreams"
    FROM songs s
    JOIN artists a ON a.id = s.artist_id
    LEFT JOIN song_stream_summary ss ON ss.song_id = s.id
    WHERE a.slug = ${slug}
      AND s.entity_status = 'canonical'
      AND s.merged_into_song_id IS NULL
    ORDER BY ss.total_spotify_streams DESC NULLS LAST
    LIMIT ${limit}
  `);
    return result.rows as ArtistSongEntry[];
  }

  async getArtistHistory(slug: string): Promise<ArtistHistoryPoint[]> {
    const result = await this.db.execute(sql`
    SELECT
      ass.snapshot_date                                             AS "date",
      ass.total_streams                                             AS "totalStreams",
      ass.daily_streams                                             AS "dailyStreams",
      (ass.daily_streams - LAG(ass.daily_streams) OVER (
        PARTITION BY ass.artist_id ORDER BY ass.snapshot_date
      ))                                                            AS "dailyGrowth",
      (ass.total_streams - LAG(ass.total_streams, 7) OVER (
        PARTITION BY ass.artist_id ORDER BY ass.snapshot_date
      ))                                                            AS "growth7d"
    FROM artist_stats_snapshots ass
    JOIN artists a ON a.id = ass.artist_id
    WHERE a.slug = ${slug}
    ORDER BY ass.snapshot_date ASC
    LIMIT 90
  `);
    return result.rows as ArtistHistoryPoint[];
  }

  async getMilestoneArtists(params: {
    threshold: number;
    isAfrobeats?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ data: MilestoneArtistEntry[]; total: number }> {
    const { threshold, isAfrobeats, limit, offset } = params;

    const result = await this.db.execute(sql`
    SELECT
      ROW_NUMBER() OVER (ORDER BY ass.total_streams DESC) AS rank,
      a.id              AS "artistId",
      a.name            AS "artistName",
      a.slug            AS "artistSlug",
      a.image_url       AS "imageUrl",
      a.origin_country  AS "originCountry",
      a.is_afrobeats    AS "isAfrobeats",
      ass.total_streams AS "totalStreams",
      ass.daily_streams AS "dailyStreams"
    FROM artist_stream_summary ass
    JOIN artists a ON a.id = ass.artist_id
    WHERE ass.total_streams >= ${threshold}
      ${isAfrobeats ? sql`AND a.is_afrobeats = true` : sql``}
    ORDER BY ass.total_streams DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

    const countResult = await this.db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM artist_stream_summary ass
    JOIN artists a ON a.id = ass.artist_id
    WHERE ass.total_streams >= ${threshold}
      ${isAfrobeats ? sql`AND a.is_afrobeats = true` : sql``}
  `);

    return {
      data: result.rows as MilestoneArtistEntry[],
      total: (countResult.rows[0] as any).total,
    };
  }

  async getAudiomackStats(artistId: string) {
    const result = await this.db.execute(sql`
    SELECT DISTINCT ON (artist_id)
      audiomack_slug  AS "audiomackSlug",
      snapshot_date   AS "snapshotDate",
      total_plays     AS "totalPlays",
      monthly_plays   AS "monthlyPlays",
      followers
    FROM artist_audiomack_snapshots
    WHERE artist_id = ${artistId}
    ORDER BY artist_id, snapshot_date DESC
    LIMIT 1
  `);

    return result.rows[0] ?? null;
  }
}
