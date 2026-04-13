import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SongsRepository } from './songs.repository';

export interface CreateSongInput {
  artistId: string;
  spotifyTrackId: string;
  title: string;
  albumId?: string;
  releaseDate?: string;
  durationMs?: number;
  explicit?: boolean;
  isAfrobeats?: boolean;
  imageUrl?: string;
}

export interface UpdateSongInput {
  title?: string;
  albumId?: string;
  releaseDate?: string;
  durationMs?: number;
  explicit?: boolean;
  isAfrobeats?: boolean;
  imageUrl?: string;
}

@Injectable()
export class SongService {
  private readonly logger = new Logger(SongService.name);

  constructor(private readonly songsRepository: SongsRepository) {}

  // ── Lookups ───────────────────────────────────────────────────────────

  async findById(id: string) {
    return this.songsRepository.findById(id);
  }

  async findBySpotifyTrackId(spotifyTrackId: string) {
    return this.songsRepository.findBySpotifyTrackId(spotifyTrackId);
  }

  // ── Dashboard: create ─────────────────────────────────────────────────

  async create(input: CreateSongInput) {
    const slug = this.buildSlug(input.title, input.spotifyTrackId);

    return this.songsRepository.upsertAllFields({
      artistId: input.artistId,
      spotifyTrackId: input.spotifyTrackId,
      title: input.title,
      slug,
      albumId: input.albumId ?? null,
      releaseDate: input.releaseDate ?? null,
      durationMs: input.durationMs ?? null,
      explicit: input.explicit ?? false,
      isAfrobeats: input.isAfrobeats ?? false,
      imageUrl: input.imageUrl ?? null,
    });
  }

  // ── Dashboard: update ─────────────────────────────────────────────────

  async update(id: string, input: UpdateSongInput) {
    const existing = await this.songsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Song with id=${id} not found`);
    }

    const slug =
      input.title && input.title !== existing.title
        ? this.buildSlug(input.title, existing.spotifyTrackId!)
        : undefined;

    return this.songsRepository.updateById(id, {
      ...input,
      ...(slug ? { slug } : {}),
    });
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
