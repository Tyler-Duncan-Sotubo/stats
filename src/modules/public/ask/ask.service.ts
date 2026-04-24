/* eslint-disable @typescript-eslint/no-unsafe-return */
// ask.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CacheService } from 'src/infrastructure/cache/cache.service';
import { AskRepository } from 'src/modules/public/ask/ask.repository';
import { classifyQuestion, normalize } from './ask-classifier';
import { extractEntities } from './ask-entity-extractor';
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

const UNANSWERABLE_RESPONSE =
  "That's a great question but TooXclusive Stats doesn't have that data yet. We track artist and song stats across charts and Spotify data.";

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);
  private readonly openai: OpenAI;

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

    // ── Layer 1: hardcoded direct answers ───────────────────────────────────
    const direct = getDirectAnswer(question);
    if (direct) {
      return { answer: direct, toolUsed: null, data: null, slug: null };
    }

    const cacheKey = `ask:v2:${normalize(question)}`;

    const cached = await this.cacheService.cached<AskResult>(
      cacheKey,
      CacheService.TTL.MEDIUM,
      async () => {
        const n = normalize(question);

        // ── Layer 2: unanswerable ───────────────────────────────────────────
        if (UNANSWERABLE_PHRASES.some((p) => n.includes(p))) {
          return {
            answer: UNANSWERABLE_RESPONSE,
            toolUsed: null,
            data: null,
            slug: null,
          };
        }

        // ── Layer 3: classify ───────────────────────────────────────────────
        const classified = classifyQuestion(question);
        this.logger.log(
          `[Ask] category=${classified.category} question="${question}"`,
        );

        // ── Layer 4: resolve + format (no LLM) ─────────────────────────────
        if (classified.category !== 'unclassified') {
          const entities = extractEntities(question, classified.category);
          this.logger.log(`[Ask] entities=${JSON.stringify(entities)}`);

          const resolved = await this.askResolver.resolve(
            classified.category,
            entities,
            classified.normalized,
          );

          if (resolved) {
            const answer = this.askFormatter.format(resolved, question);

            if (answer) {
              const slug = this.extractSlug(resolved);
              await this.saveQuestion(question, {
                answer,
                toolUsed: classified.category,
                data: resolved.data,
                slug,
              });
              return {
                answer,
                toolUsed: classified.category,
                data: resolved.data,
                slug,
              };
            }
          }
        }

        // ── Layer 5: LLM fallback ───────────────────────────────────────────
        this.logger.warn(
          `[Ask] Falling back to LLM — category=${classified.category} question="${question}"`,
        );
        return this.llmFallback(question);
      },
    );

    return cached;
  }

  // ── LLM fallback ─────────────────────────────────────────────────────────────
  // Only reached for truly unclassified questions

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

  // ── Helpers ───────────────────────────────────────────────────────────────────

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
