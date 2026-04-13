import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AlbumsRepository } from './albums.repository';

export interface CreateAlbumInput {
  artistId: string;
  spotifyAlbumId: string;
  title: string;
  albumType?: string;
  releaseDate?: string;
  imageUrl?: string;
  totalTracks?: number;
  isAfrobeats?: boolean;
}

export interface UpdateAlbumInput {
  title?: string;
  albumType?: string;
  releaseDate?: string;
  imageUrl?: string;
  totalTracks?: number;
  isAfrobeats?: boolean;
}

@Injectable()
export class AlbumService {
  private readonly logger = new Logger(AlbumService.name);

  constructor(private readonly albumsRepository: AlbumsRepository) {}

  // ── Lookups ───────────────────────────────────────────────────────────

  async findById(id: string) {
    return this.albumsRepository.findById(id);
  }

  async findBySpotifyAlbumId(spotifyAlbumId: string) {
    return this.albumsRepository.findBySpotifyAlbumId(spotifyAlbumId);
  }

  // ── Dashboard: create ─────────────────────────────────────────────────
  // Manual creation from the dashboard — full control over all fields
  // including editorial ones like isAfrobeats.

  async create(input: CreateAlbumInput) {
    const slug = this.buildSlug(input.title, input.spotifyAlbumId);

    return this.albumsRepository.upsertAllFields({
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
  }

  // ── Dashboard: update ─────────────────────────────────────────────────
  // Partial update by DB id. Only touches fields explicitly passed in.
  // This is the only path that can set isAfrobeats = true.

  async update(id: string, input: UpdateAlbumInput) {
    const existing = await this.albumsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Album with id=${id} not found`);
    }

    const slug =
      input.title && input.title !== existing.title
        ? this.buildSlug(input.title, existing.spotifyAlbumId)
        : undefined;

    return this.albumsRepository.updateById(id, {
      ...input,
      ...(slug ? { slug } : {}),
    });
  }

  // ── Dashboard: upsert by spotifyAlbumId ──────────────────────────────
  // Paste a Spotify album ID in the dashboard — creates or merges.
  // Preserves existing isAfrobeats if already set.

  async upsertFromDashboard(spotifyAlbumId: string, input: UpdateAlbumInput) {
    const existing =
      await this.albumsRepository.findBySpotifyAlbumId(spotifyAlbumId);

    if (existing) {
      return this.update(existing.id, input);
    }

    if (!input.title) {
      throw new Error(
        `title is required when creating a new album via dashboard`,
      );
    }

    return this.create({
      artistId: '', // caller must provide artistId separately for new records
      spotifyAlbumId,
      title: input.title,
      albumType: input.albumType,
      releaseDate: input.releaseDate,
      imageUrl: input.imageUrl,
      totalTracks: input.totalTracks,
      isAfrobeats: input.isAfrobeats ?? false,
    });
  }

  private buildSlug(title: string, spotifyAlbumId: string): string {
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
