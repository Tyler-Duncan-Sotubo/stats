import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { ArtistsRepository } from './artists.repository';
import type { PublicArtist, BrowseArtistEntry } from './artists.repository';

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
  ) {}

  async getBySlug(slug: string): Promise<PublicArtist> {
    const cacheKey = `public:artists:${slug}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.MEDIUM,
      async () => {
        const artist = await this.artistsRepository.findBySlug(slug);

        if (!artist) throw new NotFoundException(`Artist "${slug}" not found`);

        const [certifications, charts, records, awards, topSongs] =
          await Promise.all([
            this.artistsRepository.getCertifications(artist.id),
            this.artistsRepository.getCharts(artist.id),
            this.artistsRepository.getRecords(artist.id),
            this.artistsRepository.getAwards(artist.id),
            this.artistsRepository.getTopSongs(artist.id),
          ]);

        return {
          ...artist,
          certifications,
          charts,
          records,
          awards,
          topSongs,
        };
      },
    );
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
}
