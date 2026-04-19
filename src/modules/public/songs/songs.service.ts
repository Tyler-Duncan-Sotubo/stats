import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { SongsRepository } from './songs.repository';
import type { PublicSong } from './songs.repository';

@Injectable()
export class SongsService {
  constructor(
    private readonly songsRepository: SongsRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getBySlug(slug: string): Promise<PublicSong> {
    const cacheKey = `public:songs:${slug}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.MEDIUM,
      async () => {
        const song = await this.songsRepository.findBySlug(slug);

        if (!song) throw new NotFoundException(`Song "${slug}" not found`);

        const [charts, features] = await Promise.all([
          this.songsRepository.getCharts(song.id),
          this.songsRepository.getFeatures(song.id),
        ]);

        return {
          ...song,
          charts,
          features,
        };
      },
    );
  }

  async getIndexableSongs(): Promise<{ slug: string; updatedAt: string }[]> {
    return this.cacheService.cached(
      'songs:indexable',
      3600, // 1 hour
      () => this.songsRepository.getIndexableSongs(),
    );
  }
}
