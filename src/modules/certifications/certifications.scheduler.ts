// src/modules/certifications/certifications.scheduler.ts

import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { CertificationsService } from './certifications.service';
import { ArtistsRepository } from '../artists/artists.repository';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const BATCH_SIZE = 10; // artists per batch
const DELAY_BETWEEN_MS = 2000; // 2s between each artist within a batch
const REDIS_CURSOR_KEY = 'cron:riaa_sync:cursor'; // tracks where we left off

@Injectable()
export class CertificationsScheduler {
  private readonly logger = new Logger(CertificationsScheduler.name);

  constructor(
    private readonly certificationsService: CertificationsService,
    private readonly artistsRepository: ArtistsRepository,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Runs every 4 hours — processes the next batch of artists
  // Works through the full artist list over the course of a day
  // then resets and starts again
  //
  // With 300 artists and batches of 10 every 4 hours:
  // 6 runs per day × 10 artists = 60 artists per day
  // Full list covered in ~5 days — adjust BATCH_SIZE to speed up
  //
  // For faster coverage set BATCH_SIZE = 50 and cron to every 2 hours:
  // 12 runs × 50 = 600 per day — full list in one day
  // ─────────────────────────────────────────────────────────────────────────────
  // @Cron(CronExpression.EVERY_MINUTE)
  async processBatch(): Promise<void> {
    this.logger.log('RIAA batch sync starting');

    const allArtists = await this.artistsRepository.findAllBasic();
    if (!allArtists.length) {
      this.logger.log('No artists found — skipping');
      return;
    }

    // Read cursor from Redis — where did we leave off?
    const cursorStr = await this.redis.get(REDIS_CURSOR_KEY);
    let cursor = cursorStr ? parseInt(cursorStr, 10) : 0;

    // Reset if we've reached the end
    if (cursor >= allArtists.length) {
      cursor = 0;
      this.logger.log(
        `Cursor reset — full list of ${allArtists.length} artists completed, starting over`,
      );
    }

    // Slice the next batch
    const batch = allArtists.slice(cursor, cursor + BATCH_SIZE);
    const nextCursor = cursor + batch.length;

    this.logger.log(
      `Processing artists ${cursor + 1}–${nextCursor} of ${allArtists.length}`,
    );

    let synced = 0;
    let failed = 0;

    for (const artist of batch) {
      try {
        await this.certificationsService.syncRiaaForArtist(
          artist.id,
          artist.name,
        );
        synced++;
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed: "${artist.name}" (${artist.id}) — ${(err as Error).message}`,
        );
      }

      // Polite delay between artists
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
    }

    // Save cursor for next run
    await this.redis.set(REDIS_CURSOR_KEY, String(nextCursor));

    this.logger.log(
      `Batch complete — ${synced} synced, ${failed} failed. ` +
        `Next run starts at artist ${nextCursor + 1}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Manual trigger — useful for testing or forcing a full reset
  // POST /api/certifications/sync/trigger
  // ─────────────────────────────────────────────────────────────────────────────
  async triggerManually(resetCursor = false): Promise<void> {
    if (resetCursor) {
      await this.redis.del(REDIS_CURSOR_KEY);
      this.logger.log('Cursor reset manually');
    }
    await this.processBatch();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Status — see where the cursor is without triggering a run
  // ─────────────────────────────────────────────────────────────────────────────
  async getStatus(): Promise<{
    cursor: number;
    totalArtists: number;
    percentComplete: number;
    nextBatch: string;
  }> {
    const allArtists = await this.artistsRepository.findAllWithSpotifyId();
    const cursorStr = await this.redis.get(REDIS_CURSOR_KEY);
    const cursor = cursorStr ? parseInt(cursorStr, 10) : 0;

    return {
      cursor,
      totalArtists: allArtists.length,
      percentComplete: Math.round((cursor / allArtists.length) * 100),
      nextBatch: `Artists ${cursor + 1}–${Math.min(cursor + BATCH_SIZE, allArtists.length)}`,
    };
  }
}
