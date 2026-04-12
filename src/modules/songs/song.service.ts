import { Injectable, Logger } from '@nestjs/common';
import { SongsRepository } from './songs.repository';
import { AlbumService } from '../albums/album.service';
import { SpotifyMetadataService } from '../scraper/services/spotify-metadata.service';

export interface MinimalSongInput {
  artistId: string;
  spotifyTrackId: string;
  title: string;
  isFeature?: boolean;
}

export interface SpotifySongEnrichmentInput {
  artistId: string;
  spotifyTrackId: string;
}

@Injectable()
export class SongService {
  private readonly logger = new Logger(SongService.name);

  constructor(
    private readonly songsRepository: SongsRepository,
    private readonly spotifyMetadataService: SpotifyMetadataService,
    private readonly albumService: AlbumService,
  ) {}

  async findBySpotifyTrackId(spotifyTrackId: string) {
    return this.songsRepository.findBySpotifyTrackId(spotifyTrackId);
  }

  async findOrCreateMinimalSong(input: MinimalSongInput) {
    const existing = await this.songsRepository.findBySpotifyTrackId(
      input.spotifyTrackId,
    );

    if (existing) {
      return existing;
    }

    const slug = this.buildSongSlug(input.title, input.spotifyTrackId);

    const created = await this.songsRepository.upsertBySpotifyTrackId({
      artistId: input.artistId,
      spotifyTrackId: input.spotifyTrackId,
      title: input.title,
      slug,
      explicit: false,
      isAfrobeats: false,
    });

    this.logger.log(
      `Created minimal song ${input.title} (${input.spotifyTrackId})`,
    );

    return created;
  }

  async enrichSongFromSpotify(input: SpotifySongEnrichmentInput) {
    const metadata = await this.spotifyMetadataService.fetchTrackMetadata(
      input.spotifyTrackId,
    );

    let albumId: string | null = null;

    if (metadata.spotifyAlbumId) {
      const album = await this.albumService.upsertAlbum({
        artistId: input.artistId,
        spotifyAlbumId: metadata.spotifyAlbumId,
        title: metadata.albumName,
        albumType: metadata.albumType,
        releaseDate: metadata.releaseDate || null,
        imageUrl: metadata.albumImageUrl,
        totalTracks: metadata.totalTracks,
      });

      albumId = album.id;
    }

    const existing = await this.songsRepository.findBySpotifyTrackId(
      input.spotifyTrackId,
    );

    const slug =
      existing?.slug ??
      this.buildSongSlug(metadata.title, metadata.spotifyTrackId);

    const saved = await this.songsRepository.upsertBySpotifyTrackId({
      artistId: input.artistId,
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

    this.logger.log(
      `Enriched song ${metadata.title} (${metadata.spotifyTrackId}) from Spotify`,
    );

    return saved;
  }

  async enrichManySongsFromSpotify(
    artistId: string,
    spotifyTrackIds: string[],
  ) {
    if (!spotifyTrackIds.length) return [];

    const uniqueIds = [...new Set(spotifyTrackIds)];
    const metadataRows =
      await this.spotifyMetadataService.fetchMultipleTracks(uniqueIds);

    const existingSongs =
      await this.songsRepository.findBySpotifyTrackIds(uniqueIds);

    const existingSongMap = new Map(
      existingSongs.map((song) => [song.spotifyTrackId, song]),
    );

    const albumPayload = metadataRows
      .filter((track) => track.spotifyAlbumId)
      .map((track) => ({
        artistId,
        spotifyAlbumId: track.spotifyAlbumId,
        title: track.albumName,
        albumType: track.albumType,
        releaseDate: track.releaseDate || null,
        imageUrl: track.albumImageUrl,
        totalTracks: track.totalTracks,
        isAfrobeats: false,
      }));

    const dedupedAlbumPayload = Array.from(
      new Map(
        albumPayload.map((album) => [album.spotifyAlbumId, album]),
      ).values(),
    );

    const upsertedAlbums: Awaited<
      ReturnType<typeof this.albumService.upsertAlbum>
    >[] = [];
    for (const album of dedupedAlbumPayload) {
      const upserted = await this.albumService.upsertAlbum(album);
      upsertedAlbums.push(upserted);
    }

    const albumMap = new Map(
      upsertedAlbums.map((album) => [album.spotifyAlbumId, album]),
    );

    const songPayload = metadataRows.map((track) => {
      const existing = existingSongMap.get(track.spotifyTrackId);
      const album = track.spotifyAlbumId
        ? albumMap.get(track.spotifyAlbumId)
        : null;

      return {
        artistId,
        spotifyTrackId: track.spotifyTrackId,
        title: track.title,
        slug:
          existing?.slug ??
          this.buildSongSlug(track.title, track.spotifyTrackId),
        albumId: album?.id ?? null,
        releaseDate: track.releaseDate || null,
        durationMs: track.durationMs,
        explicit: track.explicit,
        imageUrl: track.albumImageUrl,
        isAfrobeats: existing?.isAfrobeats ?? false,
      };
    });

    const saved =
      await this.songsRepository.upsertManyBySpotifyTrackId(songPayload);

    this.logger.log(`Bulk enriched ${saved.length} songs from Spotify`);

    return saved;
  }

  private buildSongSlug(title: string, spotifyTrackId: string): string {
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

  async enrichPendingSongs(limit = 100) {
    const songs = await this.songsRepository.findSongsNeedingEnrichment(limit);

    if (!songs.length) {
      this.logger.log('No songs need enrichment');
      return [];
    }

    const results: Awaited<ReturnType<typeof this.enrichOneSong>>[] = [];

    for (const song of songs) {
      try {
        const enriched = await this.enrichOneSong(
          song.artistId,
          song.spotifyTrackId,
        );
        results.push(enriched);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to enrich song ${song.spotifyTrackId}: ${message}`,
        );
      }
    }

    this.logger.log(`Enriched ${results.length} songs`);
    return results;
  }

  private async enrichOneSong(artistId: string, spotifyTrackId: string) {
    const metadata =
      await this.spotifyMetadataService.fetchTrackMetadata(spotifyTrackId);

    let albumId: string | null = null;

    if (metadata.spotifyAlbumId) {
      const album = await this.albumService.upsertAlbum({
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
      existing?.slug ??
      this.buildSongSlug(metadata.title, metadata.spotifyTrackId);

    return this.songsRepository.upsertBySpotifyTrackId({
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
}
