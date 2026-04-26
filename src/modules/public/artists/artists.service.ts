import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { ArtistsRepository } from './artists.repository';
import type {
  PublicArtist,
  BrowseArtistEntry,
  ArtistSongEntry,
  ArtistHistoryPoint,
} from './artists.repository';
import { LeaderboardRepository } from '../leaderboard/leaderboard.repository';

export interface BrowseArtistsParams {
  limit?: number;
  page?: number;
  letter?: string;
  country?: string;
  isAfrobeats?: boolean;
  sortBy?: 'name' | 'totalStreams' | 'monthlyListeners';
}

export interface BrowseArtistsResponse {
  data: BrowseArtistEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ArtistsService {
  constructor(
    private readonly artistsRepository: ArtistsRepository,
    private readonly cacheService: CacheService,
    private readonly leaderboardRepository: LeaderboardRepository,
  ) {}

  async getIndexableArtists(
    limit: number,
    offset: number,
  ): Promise<{ slug: string; updatedAt: string }[]> {
    return this.cacheService.cached(
      `public:artists:indexable:${limit}:${offset}`,
      CacheService.TTL.MEDIUM,
      () => this.artistsRepository.getIndexableArtists(limit, offset),
    );
  }

  async getBySlug(slug: string): Promise<PublicArtist> {
    // const cacheKey = `public:artists:${slug}`;

    // return this.cacheService.cached(
    //   cacheKey,
    //   CacheService.TTL.MEDIUM,
    //   async () => {
    const artist = await this.artistsRepository.findBySlug(slug);

    if (!artist) throw new NotFoundException(`Artist "${slug}" not found`);

    const [
      certifications,
      charts,
      records,
      awards,
      topSongs,
      awardsSummary,
      audiomackStats,
      rankContext,
    ] = await Promise.all([
      this.artistsRepository.getCertifications(artist.id),
      this.artistsRepository.getCharts(artist.id),
      this.artistsRepository.getRecords(artist.id),
      this.artistsRepository.getAwards(artist.id),
      this.artistsRepository.getTopSongs(artist.id),
      this.artistsRepository.getAwardsSummary(artist.id),
      this.artistsRepository.getAudiomackStats(artist.id),
      this.leaderboardRepository.getArtistRankContext(artist.id), // 👈 ADD THIS
    ]);

    return {
      ...artist,
      certifications,
      charts,
      records,
      awards,
      topSongs,
      awardsSummary,
      audiomackStats,
      rankContext,
    };
    //   },
    // );
  }

  async browse(params: BrowseArtistsParams): Promise<BrowseArtistsResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const cacheKey = `public:artists:browse:${JSON.stringify(params)}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.SHORT,
      async () => {
        const { data, total } = await this.artistsRepository.browse({
          limit,
          offset,
          letter: params.letter,
          country: params.country,
          isAfrobeats: params.isAfrobeats,
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

  async getArtistSongs(slug: string, limit = 20): Promise<ArtistSongEntry[]> {
    const res = await this.artistsRepository.getArtistSongs(slug, limit);
    return res;
  }

  async getArtistHistory(slug: string): Promise<ArtistHistoryPoint[]> {
    return this.cacheService.cached(
      `public:artists:history:${slug}`,
      CacheService.TTL.MEDIUM,
      () => this.artistsRepository.getArtistHistory(slug),
    );
  }

  async getArtistSongRanking(params: {
    artistSlug: string;
    limit: number;
    metric: string;
  }) {
    const { artistSlug, limit, metric } = params;
    const cacheKey = `public:rankings:songs:${artistSlug}:${limit}:${metric}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.LONG,
      async () => {
        const artist = await this.artistsRepository.findBySlug(artistSlug);
        if (!artist)
          throw new NotFoundException(`Artist "${artistSlug}" not found`);

        const songs = await this.artistsRepository.getTopSongs(
          artist.id,
          limit,
        );

        return {
          data: songs,
          meta: {
            artistSlug,
            artistName: artist.name,
            artistImage: artist.imageUrl,
            limit,
            metric,
            total: songs.length,
            slug: `top-${limit}-${artistSlug}-songs-by-${metric}`,
            generatedAt: new Date().toISOString(),
          },
        };
      },
    );
  }
}
