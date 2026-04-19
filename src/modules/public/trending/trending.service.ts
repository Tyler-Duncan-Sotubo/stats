import { Injectable } from '@nestjs/common';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { TrendingRepository } from './trending.repository';
import type {
  TrendingFilters,
  TrendingArtist,
  TrendingSong,
} from './trending.repository';

export interface TrendingArtistsResponse {
  data: TrendingArtist[];
  meta: {
    total: number;
    snapshotDate: string | null;
  };
}

export interface TrendingSongsResponse {
  data: TrendingSong[];
  meta: {
    total: number;
    snapshotDate: string | null;
  };
}

@Injectable()
export class TrendingService {
  constructor(
    private readonly trendingRepository: TrendingRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getTrendingArtists(
    filters: TrendingFilters,
  ): Promise<TrendingArtistsResponse> {
    const cacheKey = `public:trending:artists:${JSON.stringify(filters)}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.SHORT,
      async () => {
        const data = await this.trendingRepository.getTrendingArtists(filters);
        return {
          data,
          meta: {
            total: data.length,
            snapshotDate: data[0]?.snapshotDate ?? null,
          },
        };
      },
    );
  }

  async getTrendingSongs(
    filters: TrendingFilters,
  ): Promise<TrendingSongsResponse> {
    const cacheKey = `public:trending:songs:${JSON.stringify(filters)}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.SHORT,
      async () => {
        const data = await this.trendingRepository.getTrendingSongs(filters);
        return {
          data,
          meta: {
            total: data.length,
            snapshotDate: data[0]?.snapshotDate ?? null,
          },
        };
      },
    );
  }
}
