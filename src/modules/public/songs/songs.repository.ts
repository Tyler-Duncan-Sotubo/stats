import { Injectable, Inject } from '@nestjs/common';
import { eq, isNotNull, isNull, sql, and, desc } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { songs } from 'src/infrastructure/drizzle/schema';

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

  async getIndexableSongs(): Promise<{ slug: string; updatedAt: string }[]> {
    return this.db
      .select({
        slug: songs.slug,
        updatedAt: sql<string>`${songs.createdAt}::text`,
      })
      .from(songs)
      .where(
        and(
          isNotNull(songs.slug),
          isNotNull(songs.spotifyTrackId),
          isNull(songs.mergedIntoSongId),
          eq(songs.entityStatus, 'canonical'),
          eq(songs.needsReview, false),
        ),
      )
      .orderBy(desc(songs.createdAt))
      .limit(5000);
  }
}
