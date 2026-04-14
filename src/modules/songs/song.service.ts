import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SongsRepository } from './songs.repository';
import slugify from 'slugify';

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

  async findById(id: string) {
    return this.songsRepository.findById(id);
  }

  async findBySpotifyTrackId(spotifyTrackId: string) {
    return this.songsRepository.findBySpotifyTrackId(spotifyTrackId);
  }

  async create(input: CreateSongInput) {
    const slug = this.buildSlug(input.title, input.spotifyTrackId);
    const normalizedTitle = this.normalizeTitle(input.title);

    return this.songsRepository.upsertAllFields({
      artistId: input.artistId,
      spotifyTrackId: input.spotifyTrackId,
      title: input.title,
      normalizedTitle,
      canonicalTitle: input.title,
      slug,
      albumId: input.albumId ?? null,
      releaseDate: input.releaseDate ?? null,
      durationMs: input.durationMs ?? null,
      explicit: input.explicit ?? false,
      isAfrobeats: input.isAfrobeats ?? false,
      imageUrl: input.imageUrl ?? null,
      sourceOfTruth: 'manual',
      entityStatus: 'canonical',
      needsReview: false,
    });
  }

  async update(id: string, input: UpdateSongInput) {
    const existing = await this.songsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Song with id=${id} not found`);
    }

    const patch: Partial<typeof existing> = {
      ...input,
    };

    if (input.title && input.title !== existing.title) {
      patch.normalizedTitle = this.normalizeTitle(input.title);
      patch.canonicalTitle = input.title;

      if (existing.spotifyTrackId) {
        patch.slug = this.buildSlug(input.title, existing.spotifyTrackId);
      } else {
        patch.slug = this.buildFallbackSlug(input.title, existing.artistId);
      }
    }

    return this.songsRepository.updateById(id, patch);
  }

  private buildSlug(title: string, spotifyTrackId: string): string {
    return `${this.slugify(title)}-${spotifyTrackId.slice(0, 8)}`;
  }

  private buildFallbackSlug(title: string, artistId: string): string {
    return `${this.slugify(title)}-${artistId.slice(-6)}`;
  }

  private slugify(value: string): string {
    return slugify(value, { lower: true, strict: true, trim: true });
  }

  private normalizeTitle(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s*\(feat\.?.*?\)/gi, '')
      .replace(/\s*\(ft\.?.*?\)/gi, '')
      .replace(/\s*\[feat\.?.*?\]/gi, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
