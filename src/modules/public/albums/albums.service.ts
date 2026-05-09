import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { AlbumsRepository } from './albums.repository';
import type { PublicAlbum, PublicAlbumTrack } from './albums.repository';

export interface BrowseAlbumsParams {
  limit?: number;
  page?: number;
  isAfrobeats?: boolean;
  albumType?: string;
  sortBy?: 'totalStreams' | 'releaseDate' | 'dailyStreams';
}

export interface BrowseAlbumsResponse {
  data: PublicAlbum[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FullAlbum {
  album: PublicAlbum;
  tracklist: PublicAlbumTrack[];
}

@Injectable()
export class AlbumsService {
  constructor(
    private readonly albumsRepository: AlbumsRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getBySlug(slug: string): Promise<FullAlbum> {
    return this.cacheService.cached(
      `public:albums:${slug}`,
      CacheService.TTL.MEDIUM,
      async () => {
        const album = await this.albumsRepository.findBySlug(slug);
        if (!album) throw new NotFoundException(`Album "${slug}" not found`);

        const tracklist = await this.albumsRepository.getTracklist(album.id);

        return { album, tracklist };
      },
    );
  }

  async getByArtist(artistId: string): Promise<PublicAlbum[]> {
    return this.cacheService.cached(
      `public:albums:artist:${artistId}`,
      CacheService.TTL.MEDIUM,
      () => this.albumsRepository.getByArtist(artistId),
    );
  }

  async browse(params: BrowseAlbumsParams): Promise<BrowseAlbumsResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    return this.cacheService.cached(
      `public:albums:browse:${JSON.stringify(params)}`,
      CacheService.TTL.SHORT,
      async () => {
        const { data, total } = await this.albumsRepository.browse({
          limit,
          offset,
          isAfrobeats: params.isAfrobeats,
          albumType: params.albumType,
          sortBy: params.sortBy,
        });

        return {
          data,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
    );
  }

  async getIndexableAlbums(
    limit: number,
    offset: number,
  ): Promise<{ slug: string; updatedAt: string }[]> {
    return this.cacheService.cached(
      `public:albums:indexable:${limit}:${offset}`,
      CacheService.TTL.MEDIUM,
      () => this.albumsRepository.getIndexableAlbums(limit, offset),
    );
  }
}
