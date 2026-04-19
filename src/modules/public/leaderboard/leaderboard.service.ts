import { Injectable } from '@nestjs/common';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { LeaderboardRepository } from './leaderboard.repository';
import type {
  LeaderboardFilters,
  StreamLeaderboardEntry,
  ListenerLeaderboardEntry,
  SongLeaderboardEntry,
} from './leaderboard.repository';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly leaderboardRepository: LeaderboardRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getStreams(
    filters: LeaderboardFilters,
  ): Promise<{ data: StreamLeaderboardEntry[]; meta: { total: number } }> {
    const cacheKey = `public:leaderboard:streams:${JSON.stringify(filters)}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.MEDIUM,
      async () => {
        const data =
          await this.leaderboardRepository.getStreamLeaderboard(filters);
        return { data, meta: { total: data.length } };
      },
    );
  }

  async getListeners(
    filters: LeaderboardFilters,
  ): Promise<{ data: ListenerLeaderboardEntry[]; meta: { total: number } }> {
    const cacheKey = `public:leaderboard:listeners:${JSON.stringify(filters)}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.LONG,
      async () => {
        const data =
          await this.leaderboardRepository.getListenerLeaderboard(filters);
        return { data, meta: { total: data.length } };
      },
    );
  }

  async getSongs(
    filters: LeaderboardFilters,
  ): Promise<{ data: SongLeaderboardEntry[]; meta: { total: number } }> {
    const cacheKey = `public:leaderboard:songs:${JSON.stringify(filters)}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.LONG,
      async () => {
        const data =
          await this.leaderboardRepository.getSongLeaderboard(filters);
        return { data, meta: { total: data.length } };
      },
    );
  }
}
