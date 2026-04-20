import { Inject, Injectable } from '@nestjs/common';
import {
  desc,
  sql,
  ilike,
  isNotNull,
  and,
  eq,
  gte,
  not,
  like,
} from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { askQuestions } from 'src/infrastructure/drizzle/schema';

export interface AskQuestionRow {
  id: string;
  question: string;
  slug: string;
  toolUsed: string | null;
  answer: string | null;
  askCount: number;
  lastAsked: Date | null;
  createdAt: Date | null;
}

@Injectable()
export class AskRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Upsert ────────────────────────────────────────────────────────────────

  async upsert(data: {
    question: string;
    slug: string;
    toolUsed: string | null;
    answer: string;
  }): Promise<void> {
    await this.db
      .insert(askQuestions)
      .values({
        question: data.question,
        slug: data.slug,
        toolUsed: data.toolUsed,
        answer: data.answer,
        askCount: 1,
        lastAsked: new Date(),
      })
      .onConflictDoUpdate({
        target: askQuestions.slug,
        set: {
          askCount: sql`${askQuestions.askCount} + 1`,
          lastAsked: new Date(),
          answer: data.answer,
        },
      });
  }

  // ── Popular ───────────────────────────────────────────────────────────────

  async getPopular(limit = 10): Promise<AskQuestionRow[]> {
    return this.db
      .select()
      .from(askQuestions)
      .orderBy(desc(askQuestions.askCount))
      .limit(limit);
  }

  // ── Recent ────────────────────────────────────────────────────────────────

  async getRecent(limit = 10): Promise<AskQuestionRow[]> {
    return this.db
      .select()
      .from(askQuestions)
      .orderBy(desc(askQuestions.lastAsked))
      .limit(limit);
  }

  // ── Suggest ───────────────────────────────────────────────────────────────

  async suggest(q: string, limit = 5): Promise<AskQuestionRow[]> {
    const term = q
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return this.db
      .select()
      .from(askQuestions)
      .where(ilike(askQuestions.slug, `${term}%`))
      .orderBy(desc(askQuestions.askCount))
      .limit(limit);
  }

  // ── Find by slug ──────────────────────────────────────────────────────────

  async findBySlug(slug: string): Promise<AskQuestionRow | null> {
    const [row] = await this.db
      .select()
      .from(askQuestions)
      .where(sql`${askQuestions.slug} = ${slug}`)
      .limit(1);
    return row ?? null;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(): Promise<{
    totalQuestions: number;
    totalAsks: number;
    topTool: string | null;
  }> {
    const [counts] = await this.db
      .select({
        totalQuestions: sql<number>`COUNT(*)`,
        totalAsks: sql<number>`SUM(${askQuestions.askCount})`,
      })
      .from(askQuestions);

    const [topTool] = await this.db
      .select({
        toolUsed: askQuestions.toolUsed,
        count: sql<number>`SUM(${askQuestions.askCount})`,
      })
      .from(askQuestions)
      .groupBy(askQuestions.toolUsed)
      .orderBy(desc(sql`SUM(${askQuestions.askCount})`))
      .limit(1);

    return {
      totalQuestions: Number(counts?.totalQuestions ?? 0),
      totalAsks: Number(counts?.totalAsks ?? 0),
      topTool: topTool?.toolUsed ?? null,
    };
  }

  // ask.repository.ts
  async getIndexable(): Promise<{ slug: string; updatedAt: Date | null }[]> {
    return this.db
      .select({
        slug: askQuestions.slug,
        updatedAt: askQuestions.lastAsked,
        question: askQuestions.question,
      })
      .from(askQuestions)
      .where(
        and(
          isNotNull(askQuestions.toolUsed),
          not(eq(askQuestions.toolUsed, 'get_artist:comparison')),

          gte(askQuestions.askCount, 1),
          not(like(askQuestions.answer, '%data does not provide%')),
          not(like(askQuestions.answer, '%No data found%')),
          not(like(askQuestions.answer, '%No answer generated%')),
          not(like(askQuestions.answer, "%couldn't find%")),
        ),
      )
      .orderBy(desc(askQuestions.askCount))
      .limit(1000);
  }
}
