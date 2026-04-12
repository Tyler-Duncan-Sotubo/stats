import { Injectable, Logger } from '@nestjs/common';
import { AlbumsRepository } from './albums.repository';

export interface MinimalAlbumInput {
  artistId: string;
  spotifyAlbumId: string;
  title: string;
  albumType?: string | null;
  releaseDate?: string | null;
  imageUrl?: string | null;
  totalTracks?: number | null;
  isAfrobeats?: boolean;
}

@Injectable()
export class AlbumService {
  private readonly logger = new Logger(AlbumService.name);

  constructor(private readonly albumsRepository: AlbumsRepository) {}

  async findBySpotifyAlbumId(spotifyAlbumId: string) {
    return this.albumsRepository.findBySpotifyAlbumId(spotifyAlbumId);
  }

  async findOrCreateMinimalAlbum(input: MinimalAlbumInput) {
    const existing = await this.albumsRepository.findBySpotifyAlbumId(
      input.spotifyAlbumId,
    );

    if (existing) {
      return existing;
    }

    const slug = this.buildAlbumSlug(input.title, input.spotifyAlbumId);

    const created = await this.albumsRepository.upsertBySpotifyAlbumId({
      artistId: input.artistId,
      spotifyAlbumId: input.spotifyAlbumId,
      title: input.title,
      slug,
      albumType: input.albumType ?? 'album',
      releaseDate: input.releaseDate ?? null,
      imageUrl: input.imageUrl ?? null,
      totalTracks: input.totalTracks ?? null,
      isAfrobeats: input.isAfrobeats ?? false,
    });

    this.logger.log(`Created album ${input.title} (${input.spotifyAlbumId})`);

    return created;
  }

  async upsertAlbum(input: MinimalAlbumInput) {
    const existing = await this.albumsRepository.findBySpotifyAlbumId(
      input.spotifyAlbumId,
    );

    const slug =
      existing?.slug ?? this.buildAlbumSlug(input.title, input.spotifyAlbumId);

    const saved = await this.albumsRepository.upsertBySpotifyAlbumId({
      artistId: input.artistId,
      spotifyAlbumId: input.spotifyAlbumId,
      title: input.title,
      slug,
      albumType: input.albumType ?? 'album',
      releaseDate: input.releaseDate ?? null,
      imageUrl: input.imageUrl ?? null,
      totalTracks: input.totalTracks ?? null,
      isAfrobeats: input.isAfrobeats ?? existing?.isAfrobeats ?? false,
    });

    this.logger.log(`Upserted album ${input.title} (${input.spotifyAlbumId})`);

    return saved;
  }

  private buildAlbumSlug(title: string, spotifyAlbumId: string): string {
    return `${this.slugify(title)}-${spotifyAlbumId.slice(0, 8)}`;
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
