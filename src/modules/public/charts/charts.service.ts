import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { ChartsRepository } from './charts.repository';
import type {
  ChartEntry,
  AvailableChart,
  AfrobeatsUkSummary,
} from './charts.repository';

export interface ChartResponse {
  chartName: string;
  chartTerritory: string;
  chartWeek: string | null;
  data: ChartEntry[];
  meta: { total: number };
}

@Injectable()
export class ChartsService {
  constructor(
    private readonly chartsRepository: ChartsRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getAvailableCharts(): Promise<AvailableChart[]> {
    return this.cacheService.cached(
      'public:charts:available',
      CacheService.TTL.MEDIUM,
      () => this.chartsRepository.getAvailableCharts(),
    );
  }

  async getChart(
    chartName: string,
    territory: string,
    limit?: number,
  ): Promise<ChartResponse> {
    const cacheKey = `public:charts:${chartName}:${territory}:${limit ?? 100}`;

    return this.cacheService.cached(
      cacheKey,
      CacheService.TTL.SHORT,
      async () => {
        const data = await this.chartsRepository.getLatestLeaderboard({
          chartName,
          territory,
          limit,
        });

        if (!data.length) {
          throw new NotFoundException(
            `Chart "${chartName}" / "${territory}" not found`,
          );
        }

        return {
          chartName,
          chartTerritory: territory.toUpperCase(),
          chartWeek: data[0]?.chartWeek ?? null,
          data,
          meta: { total: data.length },
        };
      },
    );
  }

  async getAfrobeatsUkSummary(): Promise<AfrobeatsUkSummary> {
    return this.cacheService.cached(
      'public:charts:afrobeats-uk-summary',
      CacheService.TTL.LONG,
      () => this.chartsRepository.getAfrobeatsUkSummary(),
    );
  }
}
