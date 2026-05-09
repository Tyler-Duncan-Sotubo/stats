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

export const WEEKLY_REPORT_TYPES = [
  'most-streamed-songs',
  'biggest-movers-artists',
  'new-chart-entries',
] as const;
export type WeeklyReportType = (typeof WEEKLY_REPORT_TYPES)[number];

export interface WeeklyReportResponse {
  data: WeeklyReportEntry[];
  meta: {
    weekStart: string;
    weekEnd: string;
    weekLabel: string; // "April 23 – April 29, 2025"
    type: WeeklyReportType;
    isAfrobeats: boolean;
    total: number;
  };
}

export interface WeeklyReportEntry {
  rank: number;
  songId?: string;
  artistId?: string;
  title?: string;
  artistName: string;
  artistSlug: string;
  songSlug?: string;
  imageUrl: string;
  weekStreams: number;
  totalStreams: number;
  dailyAverage: number;
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

  // In MilestonesService

  async getWeeklyReport(params: {
    type: WeeklyReportType;
    weekStart: string; // ISO date "2025-04-23"
    isAfrobeats?: boolean;
    page: number;
    limit: number;
  }): Promise<WeeklyReportResponse> {
    const { type, weekStart, isAfrobeats, page, limit } = params;

    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const weekEnd = end.toISOString().split('T')[0];
    const weekLabel = this.formatWeekLabel(start, end);

    const cacheKey = `public:weekly:${type}:${weekStart}:${isAfrobeats ? 'afrobeats' : 'global'}:${page}:${limit}`;

    // Current week: short TTL (1hr). Past weeks: very long TTL (7 days)
    const isCurrentWeek = this.isCurrentWeek(start);
    const ttl = isCurrentWeek
      ? CacheService.TTL.LONG
      : CacheService.TTL.EXTENDED;

    return this.cacheService.cached(cacheKey, ttl, async () => {
      const offset = (page - 1) * limit;

      const { data, total } = await this.songsRepository.getWeeklyMostStreamed({
        weekStart,
        weekEnd,
        isAfrobeats,
        limit,
        offset,
      });

      return {
        data: data.map((row, i) => ({ ...row, rank: offset + i + 1 })),
        meta: {
          weekStart,
          weekEnd,
          weekLabel,
          type,
          isAfrobeats: !!isAfrobeats,
          total,
        },
      };
    });
  }

  private formatWeekLabel(start: Date, end: Date): string {
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  }

  private isCurrentWeek(start: Date): boolean {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(0, 0, 0, 0);
    return start >= monday;
  }
}
