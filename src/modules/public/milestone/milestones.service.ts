// milestones.service.ts
import { Injectable } from '@nestjs/common';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongsRepository } from '../songs/songs.repository';
import type { MilestoneArtistEntry } from '../artists/artists.repository';
import type { MilestoneSongEntry } from '../songs/songs.repository';

export const ARTIST_TIERS: Record<string, number> = {
  '500-million-streams': 500_000_000,
  '1-billion-streams': 1_000_000_000,
  '5-billion-streams': 5_000_000_000,
};

export const SONG_TIERS: Record<string, number> = {
  '100-million-streams': 100_000_000,
  '500-million-streams': 500_000_000,
  '1-billion-streams': 1_000_000_000,
};

export interface MilestoneArtistResponse {
  data: MilestoneArtistEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    threshold: number;
    tier: string;
  };
}

export interface MilestoneSongResponse {
  data: MilestoneSongEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    threshold: number;
    tier: string;
  };
}

@Injectable()
export class MilestonesService {
  constructor(
    private readonly artistsRepository: ArtistsRepository,
    private readonly songsRepository: SongsRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getArtistMilestone(params: {
    tier: string;
    isAfrobeats?: boolean;
    page: number;
    limit: number;
  }): Promise<MilestoneArtistResponse> {
    const { tier, isAfrobeats, page, limit } = params;
    const threshold = ARTIST_TIERS[tier];

    if (!threshold) throw new Error(`Invalid tier: ${tier}`);

    const offset = (page - 1) * limit;
    const cacheKey = `public:milestones:artists:${tier}:${isAfrobeats ? 'afrobeats' : 'global'}:${page}:${limit}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.LONG,
      async () => {
        const { data, total } =
          await this.artistsRepository.getMilestoneArtists({
            threshold,
            isAfrobeats,
            limit,
            offset,
          });

        return {
          data,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            threshold,
            tier,
          },
        };
      },
    );
  }

  async getSongMilestone(params: {
    tier: string;
    page: number;
    limit: number;
  }): Promise<MilestoneSongResponse> {
    const { tier, page, limit } = params;
    const threshold = SONG_TIERS[tier];

    if (!threshold) throw new Error(`Invalid tier: ${tier}`);

    const offset = (page - 1) * limit;
    const cacheKey = `public:milestones:songs:${tier}:${page}:${limit}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.LONG,
      async () => {
        const { data, total } = await this.songsRepository.getMilestoneSongs({
          threshold,
          limit,
          offset,
        });

        return {
          data,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            threshold,
            tier,
          },
        };
      },
    );
  }

  async getMilestoneCounts(): Promise<{
    artists: Record<string, number>;
    songs: Record<string, number>;
    afrobeatsArtists: Record<string, number>;
  }> {
    return this.cacheService.cached(
      'public:milestones:counts',
      CacheService.TTL.LONG,
      async () => {
        const [artistCounts, songCounts, afrobeatsCounts] = await Promise.all([
          Promise.all(
            Object.entries(ARTIST_TIERS).map(async ([tier, threshold]) => {
              const { total } =
                await this.artistsRepository.getMilestoneArtists({
                  threshold,
                  limit: 1,
                  offset: 0,
                });
              return [tier, total] as [string, number];
            }),
          ),
          Promise.all(
            Object.entries(SONG_TIERS).map(async ([tier, threshold]) => {
              const { total } = await this.songsRepository.getMilestoneSongs({
                threshold,
                limit: 1,
                offset: 0,
              });
              return [tier, total] as [string, number];
            }),
          ),
          Promise.all(
            Object.entries(ARTIST_TIERS).map(async ([tier, threshold]) => {
              const { total } =
                await this.artistsRepository.getMilestoneArtists({
                  threshold,
                  isAfrobeats: true,
                  limit: 1,
                  offset: 0,
                });
              return [tier, total] as [string, number];
            }),
          ),
        ]);

        return {
          artists: Object.fromEntries(artistCounts),
          songs: Object.fromEntries(songCounts),
          afrobeatsArtists: Object.fromEntries(afrobeatsCounts),
        };
      },
    );
  }
}
