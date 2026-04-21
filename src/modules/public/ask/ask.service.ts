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
import { SongsService } from '../songs/songs.service';
import { getDirectAnswer } from './utils/ask-direct-answers';

export interface AskResult {
  answer: string;
  toolUsed: string | null;
  data: any;
  slug: string | null;
}

const TOOL_SYSTEM_PROMPT = `You are a data assistant for TooXclusive Stats, a music statistics platform.
All stream counts are Spotify only.
Pick the most relevant tool to answer the user's question.

ARTIST ROUTING RULES:
- If the question mentions a specific artist by name → ALWAYS use get_artist with their slug
- Short queries like "[artist] streams", "[artist] monthly listeners", "[artist] daily streams" → use get_artist
- Examples: "rema monthly listeners" → get_artist slug=rema, "wizkid streams" → get_artist slug=wizkid
- "[artist] uk chart history" → get_artist slug=[artist]
- "[artist] total streams" → get_artist slug=[artist]
- "[artist] grammy nominations/wins" → get_artist slug=[artist]
- "has [artist] won a grammy" → get_artist slug=[artist]
- "has [artist] hit X billion streams" → get_artist slug=[artist]

SONG ROUTING RULES:
- "how many streams does [song] have" → use get_song with title=[song]
- "how many streams does [song] by [artist] have" → use get_song with title=[song] artistName=[artist]
- "streams for [song]" → use get_song
- "[song] streams" where no artist name is present → use get_song
- "most streamed song ever" / "most streamed song overall" → use get_leaderboard_songs
- "top songs by [artist]" → use get_artist_top_songs with slug=[artist]
- "top 10 [artist] songs" → use get_artist_top_songs with slug=[artist], limit=10
- "[artist] top songs" → use get_artist_top_songs with slug=[artist]
- "most streamed [artist] songs" → use get_artist_top_songs with slug=[artist]
- "[artist] biggest songs" → use get_artist_top_songs with slug=[artist]
- "top songs" / "biggest songs on spotify" → use get_leaderboard_songs
- "trending songs" / "fastest growing songs" → use get_trending_songs
- "who sang [song]" → use get_song with title=[song]
- "who sings [song]" → use get_song with title=[song]
- "who made [song]" → use get_song with title=[song]
- "who is [song] by" → use get_song with title=[song]
- "[song] by who" → use get_song with title=[song]

AFROBEATS / AFRICAN RULES — CRITICAL:
- "african artist", "african artists", "african music" → ALWAYS set isAfrobeats=true, NO EXCEPTIONS
- "afrobeats artist", "afrobeats song" → ALWAYS set isAfrobeats=true
- "most popular african artist" → get_leaderboard_streams isAfrobeats=true
- "biggest african artist" → get_leaderboard_streams isAfrobeats=true
- "which african artist has X streams" → get_leaderboard_streams isAfrobeats=true
- "nigerian artist", "ghanaian artist" etc → set country only, do NOT set isAfrobeats
- NEVER return global leaderboard for african/afrobeats questions
- "is afrobeats popular in the uk" / "afrobeats in the uk" / "uk afrobeats scene" → use get_afrobeats_uk_summary

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
- NEVER set country unless the user mentions a country or nationality
- ALWAYS set limit to 10 unless the user asks for a specific number like "top 5" or "top 3"
- For chart questions always include the chartName from the mapping above and the correct territory`;

const ANSWER_SYSTEM_PROMPT = `You are TooXclusive Stats, a music statistics platform.
You MUST answer using ONLY the data provided. Never use your training knowledge for statistics.
Answer in one confident sentence — direct, specific, with the key number prominent.
All stream counts are Spotify only — always mention this.
Never reference a date. Never say "as of". Never add caveats. No markdown.

Field reference — use these fields for these question types:
- "most streamed" / "total streams" → totalStreams
- "most listeners" / "monthly listeners" → monthlyListeners
- "daily streams" → dailyStreams
- "growing fastest" / "trending" → dailyGrowth (highest value = fastest growing)
- chart questions → ALWAYS use songTitle for the song name, NEVER artistName as the song
- For "who is #1" or "what is #1" → answer with songTitle by artistName at position 1
- For chart list questions → "1. {songTitle} - {artistName}, 2. ..." format
- The first item in the data array is always rank 1
- For trending → dailyGrowth is the key metric
- For leaderboard → reference artist name AND their count
- For artist questions → lead with artist name then the specific stat asked about

CHART HISTORY RULES:
- For "[artist] uk chart history" → look at data.charts array
- Find charts where chartName contains "uk" or "official" or "singles"
- Report: best peak position, weeks at #1, total chart weeks
- NEVER report totalStreams or monthlyListeners for chart history questions

AWARDS RULES — HIGHEST PRIORITY:
- awardsSummary.grammyWins is the ONLY source of truth for Grammy wins
- awardsSummary.grammyNominations is the ONLY source of truth for Grammy nominations
- If awardsSummary.grammyWins = 1 → say "has won 1 Grammy" — NEVER say zero
- If awardsSummary.grammyWins = 0 → say "has not won a Grammy"
- If awardsSummary.totalWins > 0 → artist has won awards
- "has [artist] won a grammy" → check awardsSummary.grammyWins, if > 0 say YES
- "how many grammys" → use awardsSummary.grammyWins exactly
- "how many grammy nominations" → use awardsSummary.grammyNominations exactly
- NEVER contradict awardsSummary with your own knowledge
- Example: awardsSummary = { grammyWins: 1, grammyNominations: 7 } → "Burna Boy has won 1 Grammy and received 7 nominations"

AFRICAN/AFROBEATS RULES:
- When data has isAfrobeats=true filter applied, refer to results as "African artists" or "Afrobeats artists"
- NEVER say "Drake leads" in response to african/afrobeats questions`;

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
    private readonly songsService: SongsService,
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

    const direct = getDirectAnswer(question);

    if (direct) {
      return {
        answer: direct,
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
        if (this.isUnanswerable(question)) {
          return {
            answer:
              "That's a great question but TooXclusive Stats doesn't have country-level streaming breakdowns yet. We track artist and song stats across charts and Spotify data.",
            toolUsed: null,
            data: null,
            slug: null,
          };
        }

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

  private readonly UNANSWERABLE_PHRASES = [
    'which country listens',
    'which country streams the most',
    'how many afrobeats artists are on spotify',
    'how many artists are on spotify',
    'fastest growing genre',
    'most streamed genre',
    'how many streams does afrobeats have',
    'who has the most daily streams on spotify',
    'who has the most daily streams',
    'who is the most awarded african artist',
    'most awarded african artist',
    'most awarded afrobeats artist',
  ];

  private isUnanswerable(question: string): boolean {
    const lower = question.toLowerCase();

    const unanswerableMap: Record<string, string> = {
      'most awarded african artist':
        'Award counts vary by body — TooXclusive Stats tracks individual awards but does not currently rank artists by total wins.',
      'most awarded afrobeats artist':
        'Award counts vary by body — TooXclusive Stats tracks individual awards but does not currently rank artists by total wins.',
    };

    for (const phrase of Object.keys(unanswerableMap)) {
      if (lower.includes(phrase)) {
        return true;
      }
    }

    return this.UNANSWERABLE_PHRASES.some((phrase) => lower.includes(phrase));
  }

  private isComparisonQuestion(question: string): boolean {
    const lower = question.toLowerCase();

    return (
      /\b.+?\s+vs\.?\s+.+?\b/i.test(lower) ||
      /\b.+?\s+versus\s+.+?\b/i.test(lower) ||
      /\bcompare\s+.+?\s+and\s+.+?\b/i.test(lower) ||
      /\bis\s+.+?\s+bigger\s+than\s+.+?\b/i.test(lower) ||
      /\bwho has more (streams|monthly listeners|listeners)\b/i.test(lower) ||
      /\bwho is (bigger|more popular)\b/i.test(lower) ||
      /\bcompared to\b/i.test(lower) ||
      // "wizkid or davido" — only treat as comparison when sandwiched between two non-trivial words
      /\b\w{3,}\s+or\s+\w{3,}\b/i.test(lower)
    );
  }
  private async handleComparison(question: string): Promise<AskResult> {
    const slugResponse = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // FIX: was gpt-5.4-mini
      max_tokens: 100, // FIX: was max_completion_tokens
      messages: [
        {
          role: 'system',
          content: `Extract the two artist slugs from the question.
Return ONLY a JSON object like: {"artist1": "wizkid", "artist2": "burna-boy"}
Rules: lowercase, spaces become hyphens, remove special characters.
Examples:
"Burna Boy" → "burna-boy"
"Wizkid" → "wizkid"
"ASAP Rocky" → "asap-rocky"
Phrasings to handle:
"wizkid vs burna boy" → artist1=wizkid, artist2=burna-boy
"wizkid or davido" → artist1=wizkid, artist2=davido
"is wizkid bigger than davido" → artist1=wizkid, artist2=davido
"compare wizkid and davido" → artist1=wizkid, artist2=davido
"who has more streams wizkid or davido" → artist1=wizkid, artist2=davido`,
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

    const monthly1 = Number(data1.monthlyListeners ?? 0);
    const monthly2 = Number(data2.monthlyListeners ?? 0);
    const streams1 = Number(data1.totalStreams ?? 0);
    const streams2 = Number(data2.totalStreams ?? 0);

    if (/monthly listeners|popular|rank/i.test(question)) {
      const winner = monthly1 >= monthly2 ? data1 : data2;
      const loser = winner === data1 ? data2 : data1;
      const winnerVal = monthly1 >= monthly2 ? monthly1 : monthly2;
      const loserVal = monthly1 >= monthly2 ? monthly2 : monthly1;

      return {
        answer: `${winner.name} has more monthly listeners on Spotify with ${winnerVal.toLocaleString()}, compared to ${loser.name}'s ${loserVal.toLocaleString()}.`,
        toolUsed: 'get_artist:comparison',
        data: { artist1: data1, artist2: data2 },
        slug: winner.slug ?? null,
      };
    }

    if (/streams|bigger/i.test(question)) {
      const winner = streams1 >= streams2 ? data1 : data2;
      const loser = winner === data1 ? data2 : data1;
      const winnerVal = streams1 >= streams2 ? streams1 : streams2;
      const loserVal = streams1 >= streams2 ? streams2 : streams1;

      return {
        answer: `${winner.name} has more Spotify streams with ${winnerVal.toLocaleString()}, compared to ${loser.name}'s ${loserVal.toLocaleString()}.`,
        toolUsed: 'get_artist:comparison',
        data: { artist1: data1, artist2: data2 },
        slug: winner.slug ?? null,
      };
    }

    // Default for "wizkid or davido" with no specific metric — compare both stats
    return {
      answer: `${data1.name} has ${monthly1.toLocaleString()} monthly listeners and ${streams1.toLocaleString()} total Spotify streams, compared to ${data2.name}'s ${monthly2.toLocaleString()} monthly listeners and ${streams2.toLocaleString()} streams.`,
      toolUsed: 'get_artist:comparison',
      data: { artist1: data1, artist2: data2 },
      slug: null,
    };
  }
  // In ask.utils.ts

  private async askSingle(question: string): Promise<AskResult> {
    const lower = question.toLowerCase();

    // ── Pre-process: inject isAfrobeats context into params ──
    const forceAfrobeats = this.isAfricaQuestion(lower);

    const toolResponse = await this.openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      max_completion_tokens: 100,
      messages: [
        { role: 'system', content: TOOL_SYSTEM_PROMPT },
        {
          role: 'user',
          content: forceAfrobeats
            ? `${question}\n\n[SYSTEM: This question is about African/Afrobeats artists. You MUST set isAfrobeats=true in your tool call.]`
            : question,
        },
      ],
      tools: ASK_TOOLS,
      tool_choice: 'auto',
    });

    const toolCall = toolResponse.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.type !== 'function') {
      return {
        answer:
          "TooXclusive Stats couldn't find relevant data for that question.",
        toolUsed: null,
        data: null,
        slug: null,
      };
    }

    const toolName = toolCall.function.name;
    const params = JSON.parse(toolCall.function.arguments);

    // ── Force isAfrobeats in code — don't trust the LLM ──
    if (
      forceAfrobeats &&
      [
        'get_leaderboard_streams',
        'get_leaderboard_listeners',
        'get_trending_artists',
      ].includes(toolName)
    ) {
      params.isAfrobeats = true;
    }

    this.logger.log(
      `Tool selected: ${toolName} with params: ${JSON.stringify(params)}`,
    );

    // rest of the method stays the same...
    const data = await this.callService(toolName, params);

    if (!data) {
      return {
        answer: 'No data found for that query.',
        toolUsed: toolName,
        data: null,
        slug: null,
      };
    }

    const answer =
      this.formatAnswer(toolName, question, data) ??
      (await this.generateAnswer(question, toolName, data));

    const slug = this.extractSlug(toolName, params, data);

    return { answer, toolUsed: toolName, data, slug };
  }

  private isAfricaQuestion(lower: string): boolean {
    return (
      lower.includes('african artist') ||
      lower.includes('african artists') ||
      lower.includes('african music') ||
      lower.includes('afrobeats artist') ||
      lower.includes('afrobeats artists') ||
      lower.includes('afrobeats song') ||
      lower.includes('afrobeats songs') ||
      lower.includes('biggest african') ||
      lower.includes('most streamed african') ||
      lower.includes('most popular african') ||
      lower.includes('top african') ||
      lower.includes('best african') ||
      lower.includes('king of afrobeats') ||
      lower.includes('queen of afrobeats') ||
      lower.includes('number 1 afrobeats') ||
      lower.includes('best afrobeats') ||
      lower.includes('biggest afrobeats') ||
      lower.includes('fastest growing african') ||
      lower.includes('trending african')
    );
  }

  private formatAnswer(
    toolName: string,
    question: string,
    data: any,
  ): string | null {
    const topNMatch = question.match(/top\s*(\d+)/i);
    const topN = topNMatch ? parseInt(topNMatch[1]) : null;
    const isListQuestion =
      topN !== null || /\b(list|top|best|biggest)\b/i.test(question);
    const isAfrican = /african|afrobeats/i.test(question);
    const label = isAfrican ? 'African artists' : 'artists';

    switch (toolName) {
      case 'get_song': {
        if (!data) return 'No stream data found for that song.';

        const streams = data.totalStreams
          ? Number(data.totalStreams).toLocaleString()
          : null;

        const isWhoQuestion =
          /\bwho\b/i.test(question) &&
          (/\b(sang|sings|made|performed|does|did)\b/i.test(question) ||
            /\bwho\s+is\b/i.test(question) ||
            /\bby\s+who\b/i.test(question));

        if (isWhoQuestion) {
          return streams
            ? `"${data.title}" is by ${data.artistName} with ${streams} Spotify streams.`
            : `"${data.title}" is by ${data.artistName}.`;
        }

        return streams
          ? `"${data.title}" by ${data.artistName} has ${streams} Spotify streams.`
          : `"${data.title}" is by ${data.artistName}.`;
      }

      case 'get_afrobeats_uk_summary': {
        return `Afrobeats has strong UK presence — ${data.uniqueArtists} artists have appeared on the official UK Afrobeats chart across ${data.weeksTracked} weeks, with ${data.weeksAtNumber1} weeks producing a #1. Top artists include ${data.topArtists.map((a: any) => a.artistName).join(', ')}.`;
      }

      case 'get_chart': {
        const top = data.data?.[0];
        if (!top) return 'No chart data found.';
        const chartLabel = data.chartName.replace(/_/g, ' ');
        const isTopQuestion =
          /\b(#1|number 1|top|who is|what is|topping|leading)\b/i.test(
            question,
          );
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
        if (isListQuestion) {
          const count = Math.min(topN ?? 5, 10);
          const list = data.data
            ?.slice(0, count)
            .map(
              (a: any, i: number) =>
                `${i + 1}. ${a.artistName} (${Number(a.totalStreams).toLocaleString()})`,
            )
            .join(', ');
          return `Top ${count} most streamed ${label} on Spotify: ${list}.`;
        }
        return `${top.artistName} leads with ${Number(top.totalStreams).toLocaleString()} Spotify streams.`;
      }

      case 'get_leaderboard_listeners': {
        const top = data.data?.[0];
        if (!top) return 'No leaderboard data found.';
        if (isListQuestion) {
          const count = Math.min(topN ?? 5, 10);
          const list = data.data
            ?.slice(0, count)
            .map(
              (a: any, i: number) =>
                `${i + 1}. ${a.artistName} (${Number(a.monthlyListeners).toLocaleString()})`,
            )
            .join(', ');
          return `Top ${count} ${label} by monthly listeners on Spotify: ${list}.`;
        }
        return `${top.artistName} has the most monthly listeners with ${Number(top.monthlyListeners).toLocaleString()} on Spotify.`;
      }

      case 'get_leaderboard_songs': {
        const top = data.data?.[0];
        if (!top) return 'No leaderboard data found.';
        const title = top.songTitle ?? top.title;
        if (isListQuestion) {
          const count = Math.min(topN ?? 5, 10);
          const list = data.data
            ?.slice(0, count)
            .map(
              (a: any, i: number) =>
                `${i + 1}. ${a.songTitle ?? a.title} by ${a.artistName} (${Number(a.totalStreams).toLocaleString()})`,
            )
            .join(', ');
          return `Top ${count} most streamed songs on Spotify: ${list}.`;
        }
        return `"${title}" by ${top.artistName} is the most streamed song with ${Number(top.totalStreams).toLocaleString()} Spotify streams.`;
      }

      case 'get_trending_artists': {
        const top = data.data?.[0];
        if (!top) return 'No trending data found.';
        if (isListQuestion) {
          const count = Math.min(topN ?? 5, 10);
          const list = data.data
            ?.slice(0, count)
            .map(
              (a: any, i: number) =>
                `${i + 1}. ${a.name} (+${Number(a.dailyGrowth).toLocaleString()})`,
            )
            .join(', ');
          return `Top ${count} trending ${label} on Spotify by daily growth: ${list}.`;
        }
        return `${top.name} is the fastest growing artist with +${Number(top.dailyGrowth).toLocaleString()} daily Spotify stream growth.`;
      }

      case 'get_trending_songs': {
        const top = data.data?.[0];
        if (!top) return 'No trending data found.';
        if (isListQuestion) {
          const count = Math.min(topN ?? 5, 10);
          const list = data.data
            ?.slice(0, count)
            .map(
              (a: any, i: number) =>
                `${i + 1}. ${a.title} by ${a.artistName} (+${Number(a.dailyGrowth).toLocaleString()})`,
            )
            .join(', ');
          return `Top ${count} trending songs on Spotify: ${list}.`;
        }
        return `"${top.title}" by ${top.artistName} is trending fastest with +${Number(top.dailyGrowth).toLocaleString()} daily Spotify streams.`;
      }

      case 'get_artist_top_songs': {
        const top = data?.data?.[0];
        if (!top) return 'No song data found.';

        return `${top.title} is the most streamed song by ${data.artistName} on Spotify with ${Number(top.totalStreams).toLocaleString()} streams.`;
      }

      // get_artist needs OpenAI — fall through
      default:
        return null;
    }
  }

  private async generateAnswer(
    question: string,
    toolName: string,
    data: any,
  ): Promise<string> {
    const answerResponse = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
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

      case 'get_afrobeats_uk_summary':
        return this.chartService.getAfrobeatsUkSummary();

      case 'get_song':
        return this.songsService.searchSong(params.title, params.artistName);

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

      case 'get_chart': {
        const territory =
          params.territory ?? this.inferTerritory(params.chartName);
        // Normalize — some charts use UK not GB
        const normalizedTerritory = this.normalizeTerritory(
          params.chartName,
          territory,
        );
        return this.chartService.getChart(
          params.chartName,
          normalizedTerritory,
          params.limit ?? 20,
        );
      }

      case 'get_artist_top_songs': {
        const [artist, songs] = await Promise.all([
          this.artistService.getBySlug(params.slug),
          this.artistService.getArtistSongs(params.slug, params.limit ?? 10),
        ]);

        return {
          artistName: artist.name,
          artistSlug: artist.slug,
          data: songs,
        };
      }

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
          // ── ADD THIS ──
          awardsSummary: data.awardsSummary ?? null,
          topSongs: data.topSongs?.slice(0, 3).map((s: any) => ({
            title: s.title,
            totalStreams: s.totalStreams,
            dailyStreams: s.dailyStreams,
          })),
          charts: data.charts?.slice(0, 5).map((c: any) => ({
            chartName: c.chartName,
            chartTerritory: c.chartTerritory,
            bestPeakPosition: c.bestPeakPosition,
            weeksAtNumber1: c.weeksAtNumber1,
            totalChartWeeks: c.totalChartWeeks,
          })),
          awards: data.awards?.slice(0, 5).map((a: any) => ({
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

      case 'get_afrobeats_uk_summary':
        return data;

      case 'get_song':
        return {
          title: data.title,
          artistName: data.artistName,
          totalStreams: data.totalStreams,
          dailyStreams: data.dailyStreams,
          slug: data.slug,
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

      case 'get_artist_top_songs':
        return {
          artistName: data.artistName,
          artistSlug: data.artistSlug,
          data: data.data?.map((s: any) => ({
            rank: s.rank,
            title: s.title,
            songTitle: s.title,
            songSlug: s.slug ?? s.songSlug ?? null,
            artistName: s.artistName ?? data.artistName,
            totalStreams: s.totalStreams,
            dailyStreams: s.dailyStreams,
            songImageUrl: s.imageUrl ?? s.songImageUrl ?? null,
          })),
        };

      default:
        return data;
    }
  }

  private extractSlug(toolName: string, params: any, data: any): string | null {
    if (toolName === 'get_artist') return params.slug ?? null;
    if (toolName === 'get_song') return data?.slug ?? null;
    if (data?.data?.[0]?.artistSlug) return data.data[0].artistSlug;
    if (data?.data?.[0]?.slug) return data.data[0].slug;
    if (data?.data?.[0]?.artist?.slug) return data.data[0].artist.slug;
    return null;
  }

  private normalizeTerritory(chartName: string, territory: string): string {
    // These charts are stored with territory 'UK' not 'GB'
    const ukCharts = ['official_afrobeats_chart', 'uk_official_singles'];
    if (ukCharts.includes(chartName)) return 'UK';
    return territory ?? this.inferTerritory(chartName);
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
