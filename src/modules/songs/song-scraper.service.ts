import { Injectable, Logger } from '@nestjs/common';
import { SongsRepository } from './songs.repository';
import { AlbumScraperService } from '../albums/album-scraper.service';
import { SpotifyMetadataService } from '../scraper/services/spotify-metadata.service';

export interface MinimalSongInput {
  artistId: string;
  spotifyTrackId: string;
  title: string;
}

@Injectable()
export class SongScraperService {
  private readonly logger = new Logger(SongScraperService.name);

  constructor(
    private readonly songsRepository: SongsRepository,
    private readonly spotifyMetadataService: SpotifyMetadataService,
    private readonly albumScraperService: AlbumScraperService,
  ) {}

  // ── Called by snapshot pipeline ───────────────────────────────────────
  // Creates a bare-minimum song record from Kworb data.
  // No Spotify call — just enough to attach snapshots to.

  async findOrCreate(input: MinimalSongInput) {
    const existing = await this.songsRepository.findBySpotifyTrackId(
      input.spotifyTrackId,
    );

    if (existing) return existing;

    const slug = this.buildSlug(input.title, input.spotifyTrackId);

    const created = await this.songsRepository.upsertScraperFields({
      artistId: input.artistId,
      spotifyTrackId: input.spotifyTrackId,
      title: input.title,
      slug,
      explicit: false,
      isAfrobeats: false,
    });

    this.logger.log(
      `[Scraper] Created song "${input.title}" (${input.spotifyTrackId})`,
    );

    return created;
  }

  // ── Called by enrichment cron ─────────────────────────────────────────
  // Fetches full metadata from Spotify and fills in album, duration etc.
  // Preserves existing isAfrobeats — never overwrites it.

  async enrichOne(artistId: string, spotifyTrackId: string) {
    const metadata =
      await this.spotifyMetadataService.fetchTrackMetadata(spotifyTrackId);

    let albumId: string | null = null;

    if (metadata.spotifyAlbumId) {
      const album = await this.albumScraperService.upsert({
        artistId,
        spotifyAlbumId: metadata.spotifyAlbumId,
        title: metadata.albumName,
        albumType: metadata.albumType,
        releaseDate: metadata.releaseDate || null,
        imageUrl: metadata.albumImageUrl,
        totalTracks: metadata.totalTracks,
      });
      albumId = album.id;
    }

    const existing =
      await this.songsRepository.findBySpotifyTrackId(spotifyTrackId);

    const slug =
      existing?.slug ?? this.buildSlug(metadata.title, metadata.spotifyTrackId);

    return this.songsRepository.upsertScraperFields({
      artistId,
      spotifyTrackId: metadata.spotifyTrackId,
      title: metadata.title,
      slug,
      albumId,
      releaseDate: metadata.releaseDate || null,
      durationMs: metadata.durationMs,
      explicit: metadata.explicit,
      imageUrl: metadata.albumImageUrl,
      isAfrobeats: existing?.isAfrobeats ?? false,
    });
  }

  // ── Batch enrichment ──────────────────────────────────────────────────

  async enrichMany(artistId: string, spotifyTrackIds: string[]) {
    if (!spotifyTrackIds.length) return [];

    const uniqueIds = [...new Set(spotifyTrackIds)];
    const metadataRows =
      await this.spotifyMetadataService.fetchMultipleTracks(uniqueIds);

    const existingSongs =
      await this.songsRepository.findBySpotifyTrackIds(uniqueIds);

    const existingMap = new Map(
      existingSongs.map((s) => [s.spotifyTrackId, s]),
    );

    // Upsert albums first — deduplicated
    const albumInputs = Array.from(
      new Map(
        metadataRows
          .filter((t) => t.spotifyAlbumId)
          .map((t) => [
            t.spotifyAlbumId,
            {
              artistId,
              spotifyAlbumId: t.spotifyAlbumId,
              title: t.albumName,
              albumType: t.albumType,
              releaseDate: t.releaseDate || null,
              imageUrl: t.albumImageUrl,
              totalTracks: t.totalTracks,
            },
          ]),
      ).values(),
    );

    const upsertedAlbums =
      await this.albumScraperService.upsertMany(albumInputs);
    const albumMap = new Map(upsertedAlbums.map((a) => [a.spotifyAlbumId, a]));

    const songPayload = metadataRows.map((track) => {
      const existing = existingMap.get(track.spotifyTrackId);
      const album = track.spotifyAlbumId
        ? albumMap.get(track.spotifyAlbumId)
        : null;

      return {
        artistId,
        spotifyTrackId: track.spotifyTrackId,
        title: track.title,
        slug:
          existing?.slug ?? this.buildSlug(track.title, track.spotifyTrackId),
        albumId: album?.id ?? null,
        releaseDate: track.releaseDate || null,
        durationMs: track.durationMs,
        explicit: track.explicit,
        imageUrl: track.albumImageUrl,
        isAfrobeats: existing?.isAfrobeats ?? false,
      };
    });

    const saved =
      await this.songsRepository.upsertManyScraperFields(songPayload);
    this.logger.log(`[Scraper] Bulk enriched ${saved.length} songs`);

    return saved;
  }

  // ── Pending enrichment ────────────────────────────────────────────────
  // Called by the cron — finds songs missing Spotify metadata.

  async enrichPending(spotifyTrackIds: string[], artistId: string) {
    const results: Awaited<ReturnType<typeof this.enrichOne>>[] = [];
    let failed = 0;

    for (const id of spotifyTrackIds) {
      try {
        const enriched = await this.enrichOne(artistId, id);
        results.push(enriched);
      } catch (err) {
        failed++;
        this.logger.warn(
          `[Scraper] Failed to enrich ${id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `[Scraper] Enriched ${results.length} songs, ${failed} failed`,
    );
    return results;
  }

  private buildSlug(title: string, spotifyTrackId: string): string {
    return `${this.slugify(title)}-${spotifyTrackId.slice(0, 8)}`;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }
}
