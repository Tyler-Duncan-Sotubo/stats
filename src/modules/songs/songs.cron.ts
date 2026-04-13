import { Injectable, Logger } from '@nestjs/common';
// import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { SongScraperService } from './song-scraper.service';
import { SongsRepository } from './songs.repository';

const BATCH_SIZE = 50;
const DELAY_BETWEEN_MS = 300;
const REDIS_CURSOR_KEY = 'cron:song_enrichment:cursor';

@Injectable()
export class SongsCron {
  private readonly logger = new Logger(SongsCron.name);

  constructor(
    private readonly songScraperService: SongScraperService,
    private readonly songsRepository: SongsRepository,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // Runs every 11 hours — works through unenriched songs in batches.
  // With 50 songs per run and ~2 runs/day a library of 1,000 songs
  // gets fully enriched in ~10 days. Increase BATCH_SIZE to speed up.
  // @Cron('39 15 * * *', { timeZone: 'Europe/London' })
  async handleSongEnrichment() {
    this.logger.log('Song enrichment cron starting');

    const pending =
      await this.songsRepository.findSongsNeedingEnrichment(10_000);

    if (!pending.length) {
      this.logger.log('No songs need enrichment — skipping');
      await this.redis.del(REDIS_CURSOR_KEY);
      return;
    }

    // Read cursor
    const cursorStr = await this.redis.get(REDIS_CURSOR_KEY);
    let cursor = cursorStr ? parseInt(cursorStr, 10) : 0;

    if (cursor >= pending.length) {
      cursor = 0;
      this.logger.log(
        `Cursor reset — all ${pending.length} pending songs processed, starting over`,
      );
    }

    const batch = pending.slice(cursor, cursor + BATCH_SIZE);
    const nextCursor = cursor + batch.length;

    this.logger.log(
      `Processing songs ${cursor + 1}–${nextCursor} of ${pending.length} pending`,
    );

    let synced = 0;
    let failed = 0;

    for (const song of batch) {
      try {
        if (!song.spotifyTrackId) {
          failed++;
          this.logger.warn(`Skipping song "${song.title}" — no spotifyTrackId`);
          continue;
        }
        await this.songScraperService.enrichOne(
          song.artistId,
          song.spotifyTrackId,
        );
        synced++;
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed: "${song.title}" (${song.spotifyTrackId}) — ${(err as Error).message}`,
        );
      }

      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
    }

    await this.redis.set(REDIS_CURSOR_KEY, String(nextCursor));

    this.logger.log(
      `Batch complete — ${synced} synced, ${failed} failed. ` +
        `Next run starts at song ${nextCursor + 1}`,
    );
  }

  // ── Manual triggers ───────────────────────────────────────────────────

  async triggerManually(resetCursor = false): Promise<void> {
    if (resetCursor) {
      await this.redis.del(REDIS_CURSOR_KEY);
      this.logger.log('Song enrichment cursor reset manually');
    }
    await this.handleSongEnrichment();
  }

  async getStatus(): Promise<{
    cursor: number;
    totalPending: number;
    percentComplete: number;
    nextBatch: string;
  }> {
    const pending =
      await this.songsRepository.findSongsNeedingEnrichment(10_000);
    const cursorStr = await this.redis.get(REDIS_CURSOR_KEY);
    const cursor = cursorStr ? parseInt(cursorStr, 10) : 0;

    return {
      cursor,
      totalPending: pending.length,
      percentComplete: pending.length
        ? Math.round((cursor / pending.length) * 100)
        : 100,
      nextBatch: `Songs ${cursor + 1}–${Math.min(cursor + BATCH_SIZE, pending.length)}`,
    };
  }
}
