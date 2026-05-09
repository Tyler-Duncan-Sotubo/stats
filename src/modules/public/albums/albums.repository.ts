/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';

export interface PublicAlbum {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  releaseDate: string | null;
  albumType: string;
  totalTracks: number | null;
  spotifyAlbumId: string;
  isAfrobeats: boolean;
  artistId: string;
  artistName: string;
  artistSlug: string;
  artistImageUrl: string | null;
  // computed from song_stream_summary
  totalStreams: number | null;
  dailyStreams: number | null;
}

export interface PublicAlbumTrack {
  id: string;
  title: string;
  slug: string | null;
  trackNumber: number | null;
  spotifyTrackId: string | null;
  imageUrl: string | null;
  explicit: boolean;
  durationMs: number | null;
  releaseDate: string | null;
  totalStreams: number | null;
  dailyStreams: number | null;
  featuredArtists: { id: string; name: string; slug: string | null }[];
}

export interface BrowseAlbumsResult {
  data: PublicAlbum[];
  total: number;
}

@Injectable()
export class AlbumsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Single album by slug ──────────────────────────────────────────────

  async findBySlug(slug: string): Promise<PublicAlbum | null> {
    const result = await this.db.execute(sql`
      SELECT
        al.id,
        al.title,
        al.slug,
        al.image_url          AS "imageUrl",
        al.release_date       AS "releaseDate",
        al.album_type         AS "albumType",
        al.total_tracks       AS "totalTracks",
        al.spotify_album_id   AS "spotifyAlbumId",
        al.is_afrobeats       AS "isAfrobeats",
        al.artist_id          AS "artistId",
        a.name                AS "artistName",
        a.slug                AS "artistSlug",
        a.image_url           AS "artistImageUrl",
        SUM(ss.total_spotify_streams)   AS "totalStreams",
        SUM(ss.daily_streams)           AS "dailyStreams"
      FROM albums al
      JOIN artists a ON a.id = al.artist_id
      LEFT JOIN song_albums sa ON sa.album_id = al.id
      LEFT JOIN song_stream_summary ss ON ss.song_id = sa.song_id
      WHERE al.slug = ${slug}
      GROUP BY
        al.id, al.title, al.slug, al.image_url, al.release_date,
        al.album_type, al.total_tracks, al.spotify_album_id,
        al.is_afrobeats, al.artist_id,
        a.name, a.slug, a.image_url
      LIMIT 1
    `);

    if (!result.rows.length) return null;
    const row = result.rows[0] as any;
    return {
      ...row,
      totalStreams: row.totalStreams ? Number(row.totalStreams) : null,
      dailyStreams: row.dailyStreams ? Number(row.dailyStreams) : null,
    };
  }

  // ── Album tracklist ───────────────────────────────────────────────────

  async getTracklist(albumId: string): Promise<PublicAlbumTrack[]> {
    const result = await this.db.execute(sql`
      SELECT
        s.id,
        s.title,
        s.slug,
        sa.track_number       AS "trackNumber",
        s.spotify_track_id    AS "spotifyTrackId",
        s.image_url           AS "imageUrl",
        s.explicit,
        s.duration_ms         AS "durationMs",
        s.release_date        AS "releaseDate",
        ss.total_spotify_streams  AS "totalStreams",
        ss.daily_streams          AS "dailyStreams"
      FROM song_albums sa
      JOIN songs s ON s.id = sa.song_id
      LEFT JOIN song_stream_summary ss ON ss.song_id = s.id
      WHERE sa.album_id = ${albumId}
        AND s.entity_status = 'canonical'
        AND s.merged_into_song_id IS NULL
      ORDER BY sa.track_number ASC NULLS LAST
    `);

    const tracks = result.rows as any[];

    // Fetch featured artists for all tracks in one query
    if (!tracks.length) return [];

    const trackIds = tracks.map((t) => t.id);

    const featuredResult = await this.db.execute(sql`
      SELECT
        sf.song_id    AS "songId",
        a.id,
        a.name,
        a.slug
      FROM song_features sf
      JOIN artists a ON a.id = sf.featured_artist_id
      WHERE sf.song_id = ANY(${sql.raw(`ARRAY['${trackIds.join("','")}']::uuid[]`)})
      ORDER BY a.name ASC
    `);

    const featuredMap = new Map<
      string,
      { id: string; name: string; slug: string | null }[]
    >();

    for (const row of featuredResult.rows as any[]) {
      const existing = featuredMap.get(row.songId) ?? [];
      existing.push({ id: row.id, name: row.name, slug: row.slug });
      featuredMap.set(row.songId, existing);
    }

    return tracks.map((t) => ({
      ...t,
      totalStreams: t.totalStreams ? Number(t.totalStreams) : null,
      dailyStreams: t.dailyStreams ? Number(t.dailyStreams) : null,
      featuredArtists: featuredMap.get(t.id) ?? [],
    }));
  }

  // ── Artist albums ─────────────────────────────────────────────────────

  async getByArtist(artistId: string): Promise<PublicAlbum[]> {
    const result = await this.db.execute(sql`
      SELECT
        al.id,
        al.title,
        al.slug,
        al.image_url          AS "imageUrl",
        al.release_date       AS "releaseDate",
        al.album_type         AS "albumType",
        al.total_tracks       AS "totalTracks",
        al.spotify_album_id   AS "spotifyAlbumId",
        al.is_afrobeats       AS "isAfrobeats",
        al.artist_id          AS "artistId",
        a.name                AS "artistName",
        a.slug                AS "artistSlug",
        a.image_url           AS "artistImageUrl",
        SUM(ss.total_spotify_streams)   AS "totalStreams",
        SUM(ss.daily_streams)           AS "dailyStreams"
      FROM albums al
      JOIN artists a ON a.id = al.artist_id
      LEFT JOIN song_albums sa ON sa.album_id = al.id
      LEFT JOIN song_stream_summary ss ON ss.song_id = sa.song_id
      WHERE al.artist_id = ${artistId}
      GROUP BY
        al.id, al.title, al.slug, al.image_url, al.release_date,
        al.album_type, al.total_tracks, al.spotify_album_id,
        al.is_afrobeats, al.artist_id,
        a.name, a.slug, a.image_url
      ORDER BY al.release_date DESC NULLS LAST
    `);

    return (result.rows as any[]).map((row) => ({
      ...row,
      totalStreams: row.totalStreams ? Number(row.totalStreams) : null,
      dailyStreams: row.dailyStreams ? Number(row.dailyStreams) : null,
    }));
  }

  // ── Browse albums hub ─────────────────────────────────────────────────

  async browse(params: {
    limit: number;
    offset: number;
    isAfrobeats?: boolean;
    albumType?: string;
    sortBy?: 'totalStreams' | 'releaseDate' | 'dailyStreams';
  }): Promise<BrowseAlbumsResult> {
    const {
      limit,
      offset,
      isAfrobeats,
      albumType,
      sortBy = 'totalStreams',
    } = params;

    const afrobeatsFragment =
      isAfrobeats !== undefined
        ? sql` AND al.is_afrobeats = ${isAfrobeats}`
        : sql``;

    const albumTypeFragment = albumType
      ? sql` AND al.album_type = ${albumType}`
      : sql``;

    const orderBy =
      sortBy === 'releaseDate'
        ? sql`al.release_date DESC NULLS LAST`
        : sortBy === 'dailyStreams'
          ? sql`SUM(ss.daily_streams) DESC NULLS LAST`
          : sql`SUM(ss.total_spotify_streams) DESC NULLS LAST`;

    const [dataResult, countResult] = await Promise.all([
      this.db.execute(sql`
        SELECT
          al.id,
          al.title,
          al.slug,
          al.image_url          AS "imageUrl",
          al.release_date       AS "releaseDate",
          al.album_type         AS "albumType",
          al.total_tracks       AS "totalTracks",
          al.spotify_album_id   AS "spotifyAlbumId",
          al.is_afrobeats       AS "isAfrobeats",
          al.artist_id          AS "artistId",
          a.name                AS "artistName",
          a.slug                AS "artistSlug",
          a.image_url           AS "artistImageUrl",
          SUM(ss.total_spotify_streams)   AS "totalStreams",
          SUM(ss.daily_streams)           AS "dailyStreams"
        FROM albums al
        JOIN artists a ON a.id = al.artist_id
        LEFT JOIN song_albums sa ON sa.album_id = al.id
        LEFT JOIN song_stream_summary ss ON ss.song_id = sa.song_id
        WHERE 1=1
          ${afrobeatsFragment}
          ${albumTypeFragment}
        GROUP BY
          al.id, al.title, al.slug, al.image_url, al.release_date,
          al.album_type, al.total_tracks, al.spotify_album_id,
          al.is_afrobeats, al.artist_id,
          a.name, a.slug, a.image_url
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(DISTINCT al.id)::int AS total
        FROM albums al
        WHERE 1=1
          ${afrobeatsFragment}
          ${albumTypeFragment}
      `),
    ]);

    return {
      data: (dataResult.rows as any[]).map((row) => ({
        ...row,
        totalStreams: row.totalStreams ? Number(row.totalStreams) : null,
        dailyStreams: row.dailyStreams ? Number(row.dailyStreams) : null,
      })),
      total: (countResult.rows[0] as any)?.total ?? 0,
    };
  }

  // ── Indexable albums for sitemap ──────────────────────────────────────

  async getIndexableAlbums(
    limit: number,
    offset: number,
  ): Promise<{ slug: string; updatedAt: string }[]> {
    const result = await this.db.execute(sql`
      SELECT
        al.slug,
        al.created_at AS "updatedAt"
      FROM albums al
      WHERE al.slug IS NOT NULL
      ORDER BY al.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return result.rows as { slug: string; updatedAt: string }[];
  }
}
