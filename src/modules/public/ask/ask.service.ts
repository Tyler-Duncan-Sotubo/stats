/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { TrendingService } from '../trending/trending.service';
import { ASK_TOOLS } from './ask.tools';
import { ArtistsService } from '../artists/artists.service';
import { ChartsService } from '../charts/charts.service';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { AskRepository } from 'src/modules/public/ask/ask.repository';

export interface AskResult {
  answer: string;
  toolUsed: string | null;
  data: any;
  slug: string | null;
}

const TOOL_SYSTEM_PROMPT = `You are a data assistant for tooXclusive Stats, a music statistics platform.
All stream counts are Spotify only.
Pick the most relevant tool to answer the user's question.
If a question mentions a specific artist by name, use get_artist with their slug.

Country code mapping — use these exact codes:
- Nigeria / Nigerian → NG
- Ghana / Ghanaian → GH
- South Africa / South African → ZA
- Kenya / Kenyan → KE
- Uganda / Ugandan → UG
- Tanzania / Tanzanian → TZ
- Rwanda / Rwandan → RW
- Ethiopia / Ethiopian → ET
- UK / British / United Kingdom → GB
- US / American / United States → US
- Global / Worldwide → GLOBAL

Chart name mapping — use these exact chartName values:
- Spotify Nigeria → spotify_daily_ng
- Spotify South Africa → spotify_daily_za
- Spotify UK → spotify_daily_gb
- Spotify Global → spotify_daily_global
- Apple Music Nigeria → apple_daily_ng
- Apple Music Ghana → apple_daily_gh
- Apple Music Kenya → apple_daily_ke
- Apple Music South Africa → apple_daily_za
- Apple Music Uganda → apple_daily_ug
- UK Afrobeats Chart → official_afrobeats_chart
- UK Singles / UK Official Singles → uk_official_singles
- Billboard / Billboard Hot 100 → billboard_hot_100
- TooXclusive / Nigeria Top 100 → tooxclusive_top_100
- East Africa Top 50 → tooxclusive_east_africa_top_50

Rules for parameters:
- Set country using the mapping above when the user mentions a nationality or country
- NEVER set isAfrobeats unless the user explicitly says "Afrobeats"
- NEVER set country unless the user mentions a country or nationality
- ALWAYS set limit to 10 unless the user asks for a specific number like "top 5" or "top 3"
- For chart questions always include the chartName from the mapping above and the correct territory`;

const ANSWER_SYSTEM_PROMPT = `You are tooXclusive Stats, a music statistics platform.
You MUST answer using ONLY the data provided. Never use your training knowledge for statistics.
Answer in one confident sentence — direct, specific, with the key number prominent.
All stream counts are Spotify only — always mention this.
Never reference a date. Never say "as of". Never add caveats. No markdown.

Field reference — use these fields for these question types:
- "most streamed" → totalStreams
- "most listeners" → monthlyListeners
- "growing fastest" / "trending" → dailyGrowth (highest value = fastest growing)
- "daily streams" → dailyStreams
- chart questions → ALWAYS use songTitle for the song name and artistName for the artist
- NEVER confuse artistName with the song — the song is always songTitle
- For "who is #1" or "what is #1" → answer with songTitle by artistName at position 1
- For chart list questions, list the top 5 as: "1. {songTitle} - {artistName}, 2. ..." format
- The first item in the data array is always rank 1 — use that for "#1" questions
- For trending questions → dailyGrowth is the key metric, highest value = fastest growing
- For leaderboard questions → reference both the artist name and their stream/listener count
- For artist questions → lead with the artist name then the key stat they asked about`;

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly artistService: ArtistsService,
    private readonly leaderboardService: LeaderboardService,
    private readonly trendingService: TrendingService,
    private readonly chartService: ChartsService,
    private readonly cacheService: CacheService,
    private readonly askRepository: AskRepository,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  async getIndexable(): Promise<{ slug: string; updatedAt: Date | null }[]> {
    return this.askRepository.getIndexable();
  }

  async ask(question: string): Promise<AskResult> {
    if (!question?.trim()) {
      return {
        answer: 'Please ask a question.',
        toolUsed: null,
        data: null,
        slug: null,
      };
    }

    if (question.length > 200) {
      return {
        answer: 'Please keep your question under 200 characters.',
        toolUsed: null,
        data: null,
        slug: null,
      };
    }

    const cacheKey = `ask:${question.toLowerCase().trim().replace(/\s+/g, ' ')}`;

    const cached = await this.cacheService.cached<AskResult>(
      cacheKey,
      CacheService.TTL.MEDIUM,
      async () => {
        const isComparison = this.isComparisonQuestion(question);
        if (isComparison) {
          return this.handleComparison(question);
        }
        return this.askSingle(question);
      },
    );

    await this.saveQuestion(question, cached);
    return cached;
  }

  private async saveQuestion(
    question: string,
    result: AskResult,
  ): Promise<void> {
    const slug = question
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    await this.askRepository.upsert({
      question,
      slug,
      toolUsed: result.toolUsed,
      answer: result.answer,
    });
  }

  private isComparisonQuestion(question: string): boolean {
    const lower = question.toLowerCase();
    return (
      lower.includes(' vs ') ||
      lower.includes(' versus ') ||
      lower.includes(' or ') ||
      lower.includes('more than') ||
      lower.includes('compared to') ||
      lower.includes('compare')
    );
  }

  private async handleComparison(question: string): Promise<AskResult> {
    const slugResponse = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract the two artist slugs from the question.
Return ONLY a JSON object like: {"artist1": "wizkid", "artist2": "burna-boy"}
Rules: lowercase, spaces become hyphens, remove special characters.
Examples: "Burna Boy" → "burna-boy", "Wizkid" → "wizkid", "ASAP Rocky" → "asap-rocky"`,
        },
        { role: 'user', content: question },
      ],
      response_format: { type: 'json_object' },
    });

    let artist1: string | undefined;
    let artist2: string | undefined;

    try {
      const parsed = JSON.parse(
        slugResponse.choices[0]?.message?.content ?? '{}',
      );
      artist1 = parsed.artist1;
      artist2 = parsed.artist2;
    } catch {
      this.logger.warn(
        'Failed to parse comparison slugs, falling back to single',
      );
      return this.askSingle(question);
    }

    if (!artist1 || !artist2) {
      this.logger.warn('Could not extract two artists, falling back to single');
      return this.askSingle(question);
    }

    this.logger.log(`Comparison detected: ${artist1} vs ${artist2}`);

    const [data1, data2] = await Promise.all([
      this.artistService.getBySlug(artist1).catch(() => null),
      this.artistService.getBySlug(artist2).catch(() => null),
    ]);

    if (!data1 || !data2) {
      this.logger.warn(
        `Could not fetch one or both artists (${artist1}, ${artist2}), falling back to single`,
      );
      return this.askSingle(question);
    }

    return {
      answer: `Comparing ${data1.name} and ${data2.name} on AfroStats.`,
      toolUsed: 'get_artist:comparison',
      data: { artist1: data1, artist2: data2 },
      slug: data1.slug ?? null,
    };
  }

  private readonly UNANSWERABLE_PHRASES = [
    'which country listens',
    'which country streams the most',
    'how many afrobeats artists are on spotify',
    'how many artists are on spotify',
    'how popular is afrobeats',
    'fastest growing genre',
    'most streamed genre',
    'how many streams does afrobeats have',
    'is afrobeats popular in',
  ];

  private isUnanswerable(question: string): boolean {
    const lower = question.toLowerCase();
    return this.UNANSWERABLE_PHRASES.some((phrase) => lower.includes(phrase));
  }

  private async askSingle(question: string): Promise<AskResult> {
    // Guard — questions we can't answer with available data
    if (this.isUnanswerable(question)) {
      return {
        answer:
          "That's a great question but we doesn't have country-level streaming breakdowns yet. We track artist and song stats across charts and Spotify data.",
        toolUsed: null,
        data: null,
        slug: null,
      };
    }

    // Step 1 — let OpenAI pick the right tool + params
    const toolResponse = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      messages: [
        { role: 'system', content: TOOL_SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
      tools: ASK_TOOLS,
      tool_choice: 'required',
    });

    const toolCall = toolResponse.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.type !== 'function') {
      return {
        answer: "I couldn't find relevant data for that question.",
        toolUsed: null,
        data: null,
        slug: null,
      };
    }

    const toolName = toolCall.function.name;
    const params = JSON.parse(toolCall.function.arguments);

    this.logger.log(
      `Tool selected: ${toolName} with params: ${JSON.stringify(params)}`,
    );

    // Step 2 — call the right internal service
    const data = await this.callService(toolName, params);

    if (!data) {
      return {
        answer: 'No data found for that query.',
        toolUsed: toolName,
        data: null,
        slug: null,
      };
    }

    // Step 3 — format answer locally for predictable shapes, OpenAI for complex ones
    const answer =
      this.formatAnswer(toolName, question, data) ??
      (await this.generateAnswer(question, toolName, data));

    const slug = this.extractSlug(toolName, params, data);

    return { answer, toolUsed: toolName, data, slug };
  }

  // Fast local formatting — no OpenAI call needed for predictable shapes
  private formatAnswer(
    toolName: string,
    question: string,
    data: any,
  ): string | null {
    switch (toolName) {
      case 'get_chart': {
        const top = data.data?.[0];
        if (!top) return 'No chart data found.';
        const chartLabel = data.chartName.replace(/_/g, ' ');
        const isTopQuestion =
          /\b(#1|number 1|top|who is|what is|topping)\b/i.test(question);
        if (isTopQuestion) {
          return `"${top.songTitle}" by ${top.artistName} is #1 on the ${chartLabel} chart.`;
        }
        const top5 = data.data
          ?.slice(0, 5)
          .map((e: any) => `${e.position}. ${e.songTitle} - ${e.artistName}`)
          .join(', ');
        return `Top 5 on the ${chartLabel}: ${top5}.`;
      }

      case 'get_leaderboard_streams': {
        const top = data.data?.[0];
        if (!top) return 'No leaderboard data found.';
        return `${top.artistName} leads with ${Number(top.totalStreams).toLocaleString()} Spotify streams.`;
      }

      case 'get_leaderboard_listeners': {
        const top = data.data?.[0];
        if (!top) return 'No leaderboard data found.';
        return `${top.artistName} has the most monthly listeners with ${Number(top.monthlyListeners).toLocaleString()} on Spotify.`;
      }

      case 'get_leaderboard_songs': {
        const top = data.data?.[0];
        if (!top) return 'No leaderboard data found.';
        const title = top.songTitle ?? top.title; // ← try both
        return `"${title}" by ${top.artistName} is the most streamed song with ${Number(top.totalStreams).toLocaleString()} Spotify streams.`;
      }

      case 'get_trending_artists': {
        const top = data.data?.[0];
        if (!top) return 'No trending data found.';
        return `${top.name} is the fastest growing artist with +${Number(top.dailyGrowth).toLocaleString()} daily Spotify stream growth.`;
      }

      case 'get_trending_songs': {
        const top = data.data?.[0];
        if (!top) return 'No trending data found.';
        return `"${top.title}" by ${top.artistName} is trending fastest with +${Number(top.dailyGrowth).toLocaleString()} daily Spotify streams.`;
      }

      // get_artist and search_artists need OpenAI — fall through
      default:
        return null;
    }
  }

  // Only called for complex cases like get_artist and search_artists
  private async generateAnswer(
    question: string,
    toolName: string,
    data: any,
  ): Promise<string> {
    const answerResponse = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ANSWER_SYSTEM_PROMPT },
        { role: 'user', content: question },
        {
          role: 'user',
          content: `Use only this data to answer: ${JSON.stringify(this.trimForAnswer(toolName, data))}`,
        },
      ],
    });

    return (
      answerResponse.choices[0]?.message?.content ?? 'No answer generated.'
    );
  }

  private async callService(toolName: string, params: any): Promise<any> {
    switch (toolName) {
      case 'get_artist':
        return this.artistService.getBySlug(params.slug);

      case 'get_leaderboard_streams':
        return this.leaderboardService.getStreams({
          limit: params.limit ?? 10,
          country: params.country,
          isAfrobeats: params.isAfrobeats,
        });

      case 'get_leaderboard_listeners':
        return this.leaderboardService.getListeners({
          limit: params.limit ?? 10,
          country: params.country,
          isAfrobeats: params.isAfrobeats,
        });

      case 'get_leaderboard_songs':
        return this.leaderboardService.getSongs({
          limit: params.limit ?? 10,
          isAfrobeats: params.isAfrobeats,
        });

      case 'get_trending_artists':
        return this.trendingService.getTrendingArtists({
          limit: params.limit ?? 10,
          country: params.country,
          isAfrobeats: params.isAfrobeats,
        });

      case 'get_trending_songs':
        return this.trendingService.getTrendingSongs({
          limit: params.limit ?? 10,
          isAfrobeats: params.isAfrobeats,
        });

      case 'get_chart':
        return this.chartService.getChart(
          params.chartName,
          params.territory ?? this.inferTerritory(params.chartName),
          params.limit ?? 20,
        );

      case 'search_artists':
        return this.artistService.browse({
          letter: params.letter,
          country: params.country,
          sortBy: params.sortBy ?? 'totalStreams',
          limit: params.limit ?? 10,
          page: 1,
        });

      default:
        this.logger.warn(`Unknown tool: ${toolName}`);
        return null;
    }
  }

  private trimForAnswer(toolName: string, data: any): any {
    switch (toolName) {
      case 'get_artist':
        return {
          name: data.name,
          slug: data.slug,
          originCountry: data.originCountry,
          totalStreams: data.totalStreams,
          monthlyListeners: data.monthlyListeners,
          dailyStreams: data.dailyStreams,
          trackCount: data.trackCount,
          topSongs: data.topSongs?.slice(0, 3).map((s: any) => ({
            title: s.title,
            totalStreams: s.totalStreams,
            dailyStreams: s.dailyStreams,
          })),
          charts: data.charts?.slice(0, 3).map((c: any) => ({
            chartName: c.chartName,
            chartTerritory: c.chartTerritory,
            bestPeakPosition: c.bestPeakPosition,
            weeksAtNumber1: c.weeksAtNumber1,
            totalChartWeeks: c.totalChartWeeks,
          })),
          awards: data.awards?.slice(0, 3).map((a: any) => ({
            awardBody: a.awardBody,
            awardName: a.awardName,
            result: a.result,
            year: a.year,
          })),
          records: data.records?.slice(0, 2).map((r: any) => ({
            recordType: r.recordType,
            recordValue: r.recordValue,
          })),
        };

      case 'get_leaderboard_streams':
      case 'get_leaderboard_listeners':
        return {
          data: data.data?.map((a: any) => ({
            rank: a.rank,
            artistName: a.artistName,
            artistSlug: a.artistSlug,
            originCountry: a.originCountry,
            totalStreams: a.totalStreams,
            monthlyListeners: a.monthlyListeners,
            dailyStreams: a.dailyStreams,
          })),
          meta: data.meta,
        };

      case 'get_leaderboard_songs':
        return {
          data: data.data?.map((s: any) => ({
            rank: s.rank,
            title: s.songTitle ?? s.title ?? null,
            artistName: s.artistName,
            totalStreams: s.totalStreams,
            dailyStreams: s.dailyStreams,
          })),
          meta: data.meta,
        };

      case 'get_trending_artists':
        return {
          data: data.data?.map((a: any) => ({
            name: a.name,
            slug: a.slug,
            originCountry: a.originCountry,
            dailyGrowth: a.dailyGrowth,
            momentumScore: a.momentumScore,
            monthlyListeners: a.monthlyListeners,
            totalStreams: a.totalStreams,
          })),
          meta: data.meta,
        };

      case 'get_trending_songs':
        return {
          data: data.data?.map((s: any) => ({
            title: s.title,
            artistName: s.artistName,
            dailyGrowth: s.dailyGrowth,
            totalStreams: s.totalStreams,
          })),
          meta: data.meta,
        };

      case 'get_chart':
        return {
          chartName: data.chartName,
          chartTerritory: data.chartTerritory,
          data: data.data?.slice(0, 10).map((e: any) => ({
            position: e.position,
            songTitle: e.songTitle,
            artistName: e.artistName,
            artistSlug: e.artistSlug,
            songSlug: e.songSlug,
            songImageUrl: e.songImageUrl ?? null,
            artistImageUrl: e.artistImageUrl ?? null,
            weeksOnChart: e.weeksOnChart,
            peakPosition: e.peakPosition,
            trend: e.trend,
            delta: e.delta,
          })),
          meta: data.meta,
        };

      default:
        return data;
    }
  }

  private extractSlug(toolName: string, params: any, data: any): string | null {
    if (toolName === 'get_artist') return params.slug ?? null;
    if (data?.data?.[0]?.artistSlug) return data.data[0].artistSlug;
    if (data?.data?.[0]?.slug) return data.data[0].slug;
    if (data?.data?.[0]?.artist?.slug) return data.data[0].artist.slug;
    return null;
  }

  private inferTerritory(chartName: string): string {
    const territoryMap: Record<string, string> = {
      spotify_daily_ng: 'NG',
      spotify_daily_za: 'ZA',
      spotify_daily_gb: 'GB',
      spotify_daily_global: 'GLOBAL',
      apple_daily_ng: 'NG',
      apple_daily_gh: 'GH',
      apple_daily_ke: 'KE',
      apple_daily_za: 'ZA',
      apple_daily_ug: 'UG',
      tooxclusive_top_100: 'NG',
      tooxclusive_east_africa_top_50: 'EAST_AFRICA',
      official_afrobeats_chart: 'UK',
      uk_official_singles: 'UK',
      billboard_hot_100: 'US',
    };

    return territoryMap[chartName] ?? 'GLOBAL';
  }
}
