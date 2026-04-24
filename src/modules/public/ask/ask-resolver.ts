// ask-resolver.ts

import { Injectable, Logger } from '@nestjs/common';
import { AskCategory } from './ask-classifier';
import { ExtractedEntities } from './ask-entity-extractor';
import { AskDataService } from './ask-data.service';

export interface ResolvedData {
  category: AskCategory;
  data: any;
  meta: {
    artistSlug?: string | null;
    artistSlug2?: string | null;
    songTitle?: string | null;
    chartName?: string | null;
    chartTerritory?: string | null;
    country?: string | null;
    isAfrobeats?: boolean;
    limit?: number;
    milestone?: number | null;
    comparisonMetric?: 'streams' | 'listeners' | 'general';
  };
}

@Injectable()
export class AskResolver {
  private readonly logger = new Logger(AskResolver.name);

  constructor(private readonly askDataService: AskDataService) {}

  async resolve(
    category: AskCategory,
    entities: ExtractedEntities,
    normalizedQuestion: string,
  ): Promise<ResolvedData | null> {
    try {
      switch (category) {
        // ── Artist stat categories ──────────────────────────────────────────
        case 'artist_streams':
        case 'artist_monthly_listeners':
        case 'artist_daily_streams':
        case 'artist_peak_listeners':
        case 'artist_grammy_wins':
        case 'artist_grammy_nominations':
        case 'artist_awards':
        case 'artist_chart_history':
        case 'artist_milestone':
        case 'artist_profile':
        case 'artist_biggest_song':
        case 'artist_global_rank': {
          if (!entities.artistSlug) return null;
          const artist = await this.askDataService.getArtist(
            entities.artistSlug,
          );
          if (!artist) return null;
          return {
            category,
            data: artist,
            meta: {
              artistSlug: entities.artistSlug,
              milestone: entities.milestone,
            },
          };
        }

        // ── Artist top songs ────────────────────────────────────────────────
        case 'artist_top_songs': {
          if (!entities.artistSlug) return null;
          const [artist, songs] = await Promise.all([
            this.askDataService.getArtist(entities.artistSlug),
            this.askDataService.getArtistTopSongs(
              entities.artistSlug,
              entities.limit,
            ),
          ]);
          if (!artist || !songs?.length) return null;
          return {
            category,
            data: { artistName: artist.name, artistSlug: artist.slug, songs },
            meta: {
              artistSlug: entities.artistSlug,
              limit: entities.limit,
            },
          };
        }

        // ── Song streams / who sang ─────────────────────────────────────────
        case 'song_streams':
        case 'song_who_sang': {
          if (!entities.songTitle) return null;

          // Try with artist disambiguation first
          const artistName = entities.artistSlug
            ? entities.artistSlug.replace(/-/g, ' ')
            : undefined;

          const song = await this.askDataService.getSong(
            entities.songTitle,
            artistName,
          );
          if (!song) return null;
          return {
            category,
            data: song,
            meta: { songTitle: entities.songTitle },
          };
        }

        // ── Comparison ──────────────────────────────────────────────────────
        case 'comparison': {
          if (!entities.artistSlug || !entities.artistSlug2) return null;

          const [artist1, artist2] = await Promise.all([
            this.askDataService.getArtist(entities.artistSlug),
            this.askDataService.getArtist(entities.artistSlug2),
          ]);

          if (!artist1 || !artist2) return null;

          const comparisonMetric =
            this.inferComparisonMetric(normalizedQuestion);

          return {
            category,
            data: { artist1, artist2 },
            meta: {
              artistSlug: entities.artistSlug,
              artistSlug2: entities.artistSlug2,
              comparisonMetric,
            },
          };
        }

        // ── Chart queries ───────────────────────────────────────────────────
        case 'chart_number_1':
        case 'chart_top_5':
        case 'chart_list': {
          const chartName = entities.chartName;
          const territory = entities.chartTerritory;

          if (!chartName || !territory) return null;

          const limit =
            category === 'chart_number_1'
              ? 1
              : category === 'chart_top_5'
                ? 5
                : entities.limit;

          const chart = await this.askDataService.getChart(
            chartName,
            territory,
            limit,
          );
          if (!chart?.data?.length) return null;

          return {
            category,
            data: chart,
            meta: { chartName, chartTerritory: territory, limit },
          };
        }

        // ── Leaderboard streams ─────────────────────────────────────────────
        case 'leaderboard_streams': {
          const result = await this.askDataService.getLeaderboardStreams({
            limit: entities.limit,
            country: entities.country ?? undefined,
            isAfrobeats: entities.isAfrobeats || undefined,
          });
          if (!result?.length) return null;
          return {
            category,
            data: { data: result },
            meta: {
              country: entities.country,
              isAfrobeats: entities.isAfrobeats,
              limit: entities.limit,
            },
          };
        }

        // ── Leaderboard listeners ───────────────────────────────────────────
        case 'leaderboard_listeners': {
          const result = await this.askDataService.getLeaderboardListeners({
            limit: entities.limit,
            country: entities.country ?? undefined,
            isAfrobeats: entities.isAfrobeats || undefined,
          });
          if (!result?.length) return null;
          return {
            category,
            data: { data: result },
            meta: {
              country: entities.country,
              isAfrobeats: entities.isAfrobeats,
              limit: entities.limit,
            },
          };
        }

        // ── Leaderboard songs ───────────────────────────────────────────────
        case 'leaderboard_songs': {
          const result = await this.askDataService.getLeaderboardSongs({
            limit: entities.limit,
            isAfrobeats: entities.isAfrobeats || undefined,
          });
          if (!result?.length) return null;
          return {
            category,
            data: { data: result },
            meta: {
              isAfrobeats: entities.isAfrobeats, // ← make sure this is passed
              limit: entities.limit,
            },
          };
        }

        // ── Trending artists ────────────────────────────────────────────────
        case 'leaderboard_trending_artists': {
          const result = await this.askDataService.getTrendingArtists({
            limit: entities.limit,
            country: entities.country ?? undefined,
            isAfrobeats: entities.isAfrobeats || undefined,
          });
          if (!result?.length) return null;
          return {
            category,
            data: { data: result },
            meta: {
              country: entities.country,
              isAfrobeats: entities.isAfrobeats,
              limit: entities.limit,
            },
          };
        }

        // ── Trending songs ──────────────────────────────────────────────────
        case 'leaderboard_trending_songs': {
          const result = await this.askDataService.getTrendingSongs({
            limit: entities.limit,
            isAfrobeats: entities.isAfrobeats || undefined,
          });
          if (!result?.length) return null;
          return {
            category,
            data: { data: result },
            meta: {
              isAfrobeats: entities.isAfrobeats,
              limit: entities.limit,
            },
          };
        }

        // ── Afrobeats UK summary ────────────────────────────────────────────
        case 'afrobeats_uk_summary': {
          const result = await this.askDataService.getAfrobeatsUkSummary();
          if (!result) return null;
          return {
            category,
            data: result,
            meta: {},
          };
        }

        // ── African Billboard #1 ────────────────────────────────────────────────
        case 'african_billboard_number1': {
          const result =
            await this.askDataService.getAfricanBillboardNumber1s();
          return {
            category,
            data: result,
            meta: {},
          };
        }

        default:
          return null;
      }
    } catch (err) {
      this.logger.error(
        `Resolver failed for category=${category}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private inferComparisonMetric(
    n: string,
  ): 'streams' | 'listeners' | 'general' {
    if (/\b(monthly )?listeners?\b/.test(n)) return 'listeners';
    if (/\bstreams?\b/.test(n) || /\bbigger\b/.test(n)) return 'streams';
    return 'general';
  }
}
