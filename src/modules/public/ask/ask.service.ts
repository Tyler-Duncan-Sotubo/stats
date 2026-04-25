/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { AskRepository } from 'src/modules/public/ask/ask.repository';
import { AskLLMClassifier } from './ask-llm-classifier';
import { AskResolver } from './ask-resolver';
import { AskFormatter } from './ask-formatter';
import { getDirectAnswer } from './utils/ask-direct-answers';

export interface AskResult {
  answer: string;
  toolUsed: string | null;
  data: any;
  slug: string | null;
}

const UNANSWERABLE_PHRASES = [
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

const DOWNLOAD_PHRASES = [
  'download',
  'mp3',
  'mp4',
  'free download',
  'audio download',
  'indir',
];

const UNANSWERABLE_RESPONSE =
  "That's a great question but TooXclusive Stats doesn't have that data yet. We track artist and song stats across charts and Spotify data.";

const DOWNLOAD_RESPONSE =
  "TooXclusive Stats is a music statistics platform — we don't provide downloads. Visit your preferred streaming platform to listen.";

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);
  private readonly openai: OpenAI;
  private readonly llmClassifier: AskLLMClassifier;
  private readonly inFlight = new Map<string, Promise<AskResult>>();

  constructor(
    private readonly config: ConfigService,
    private readonly cacheService: CacheService,
    private readonly askRepository: AskRepository,
    private readonly askResolver: AskResolver,
    private readonly askFormatter: AskFormatter,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
    this.llmClassifier = new AskLLMClassifier(this.openai);
  }

  async getIndexable(): Promise<{ slug: string; updatedAt: Date | null }[]> {
    return this.askRepository.getIndexable();
  }

  async ask(question: string): Promise<AskResult> {
    // ── Guards ──────────────────────────────────────────────────────────────
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

    // ── Layer 1: direct answers ─────────────────────────────────────────────
    const direct = getDirectAnswer(question);
    if (direct) {
      return { answer: direct, toolUsed: null, data: null, slug: null };
    }

    const n = question.toLowerCase().trim();
    const cacheKey = `ask:v3:${n}`;

    // ── Layer 2: cache hit ──────────────────────────────────────────────────
    const cached = await this.cacheService.get<AskResult>(cacheKey);
    if (cached) return cached;

    // ── Layer 3: in-flight deduplication ────────────────────────────────────
    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const promise = this.resolveAndCache(question, n, cacheKey);
    this.inFlight.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  // ── Pipeline ──────────────────────────────────────────────────────────────

  private async resolveAndCache(
    question: string,
    n: string,
    cacheKey: string,
  ): Promise<AskResult> {
    const result = await this.runAskPipeline(question, n);
    await this.cacheService.set(cacheKey, result, CacheService.TTL.MEDIUM);
    return result;
  }

  private async runAskPipeline(
    question: string,
    n: string,
  ): Promise<AskResult> {
    if (UNANSWERABLE_PHRASES.some((p) => n.includes(p))) {
      return {
        answer: UNANSWERABLE_RESPONSE,
        toolUsed: null,
        data: null,
        slug: null,
      };
    }

    if (DOWNLOAD_PHRASES.some((p) => n.includes(p))) {
      return {
        answer: DOWNLOAD_RESPONSE,
        toolUsed: null,
        data: null,
        slug: null,
      };
    }

    const classified = await this.llmClassifier.classify(question);

    this.logger.log(
      `[Ask] category=${classified.category} artistSlug=${classified.artistSlug} question="${question}"`,
    );

    if (classified.category !== 'unclassified') {
      const entities = {
        artistSlug: classified.artistSlug,
        artistSlug2: classified.artistSlug2,
        songTitle: classified.songTitle,
        chartName: classified.chartName,
        chartTerritory: classified.chartTerritory,
        country: classified.country,
        isAfrobeats: classified.isAfrobeats,
        limit: classified.limit,
        milestone: classified.milestone,
      };

      let resolved = await this.askResolver.resolve(
        classified.category,
        entities,
        classified.normalized,
      );

      // ── Song → artist retry ─────────────────────────────────────────────────
      // If a song_streams or song_who_sang query resolved to null, the full
      // question text might actually be an artist name (e.g. "baby boy av streams").
      // Retry as artist_profile using the raw question words as slug.
      if (
        !resolved &&
        (classified.category === 'song_streams' ||
          classified.category === 'song_who_sang')
      ) {
        const fallbackSlug = n
          .replace(
            /\b(streams?|how many|does|have|has|who sang|who made)\b/g,
            '',
          )
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        this.logger.log(
          `[Ask] song null — retrying as artist_profile slug=${fallbackSlug}`,
        );

        resolved = await this.askResolver.resolve(
          'artist_profile',
          { ...entities, artistSlug: fallbackSlug },
          classified.normalized,
        );
      }

      if (resolved) {
        const answer = this.askFormatter.format(resolved, question);

        if (answer) {
          const slug = this.extractSlug(resolved);
          const result: AskResult = {
            answer,
            toolUsed: classified.category,
            data: resolved.data,
            slug,
          };
          await this.saveQuestion(question, result);
          return result;
        }
      }
    }

    this.logger.warn(
      `[Ask] Resolver null — category=${classified.category} question="${question}"`,
    );
    return this.llmFallback(question);
  }

  // ── LLM answer fallback ───────────────────────────────────────────────────

  private async llmFallback(question: string): Promise<AskResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 100,
        messages: [
          {
            role: 'system',
            content: `You are TooXclusive Stats, a music statistics platform. You only answer questions about music streaming stats, charts, and artist data. If the question is not about music stats, or you don't have enough data to answer accurately, respond with exactly: "We couldn't find relevant data for that question." No markdown, no caveats.`,
          },
          { role: 'user', content: question },
        ],
      });

      const answer =
        response.choices[0]?.message?.content ??
        "We couldn't find relevant data for that question.";

      await this.saveQuestion(question, {
        answer,
        toolUsed: null,
        data: null,
        slug: null,
      }).catch(() => {});
      return { answer, toolUsed: null, data: null, slug: null };
    } catch (err) {
      this.logger.error(`[Ask] LLM fallback failed: ${(err as Error).message}`);
      return {
        answer: "We couldn't find relevant data for that question.",
        toolUsed: null,
        data: null,
        slug: null,
      };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

    await this.askRepository
      .upsert({
        question,
        slug,
        toolUsed: result.toolUsed,
        answer: result.answer,
      })
      .catch((err) => {
        this.logger.warn(
          `[Ask] Failed to save question: ${(err as Error).message}`,
        );
      });
  }

  private extractSlug(resolved: any): string | null {
    const { category, data, meta } = resolved;
    if (meta?.artistSlug) return meta.artistSlug;
    if (category === 'comparison') return meta?.artistSlug ?? null;
    if (category === 'song_streams' || category === 'song_who_sang') {
      return data?.artistSlug ?? null;
    }
    if (data?.data?.[0]?.artistSlug) return data.data[0].artistSlug;
    if (data?.data?.[0]?.slug) return data.data[0].slug;
    return null;
  }
}
