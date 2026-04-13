// src/modules/snapshots/snapshot.cron.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SnapshotService } from './snapshot.service';

@Injectable()
export class SnapshotCron {
  private readonly logger = new Logger(SnapshotCron.name);

  constructor(private readonly snapshotService: SnapshotService) {}

  // ── Daily — artist totals only ────────────────────────────────────────
  // Runs every day at 14:07 London time
  // Light scrape — just the artist summary row from Kworb
  // Feeds: artist_stats_snapshots

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyArtistSnapshot() {
    this.logger.log('Daily artist snapshot starting');

    try {
      await this.snapshotService.snapshotAllArtists();
      this.logger.log('Daily artist snapshot complete');
    } catch (err) {
      this.logger.error(
        `Daily artist snapshot failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Weekly — song stream counts ───────────────────────────────────────
  // Runs every Sunday at 03:00 London time
  // Heavy scrape — full song table per artist from Kworb
  // Feeds: song_stats_snapshots, links spotifyTrackId to songs
  // Weekly is sufficient because individual song counts shift slowly
  // and the full scrape is significantly heavier than artist totals

  @Cron('0 3 * * 0', { timeZone: 'Europe/London' })
  async handleWeeklySongSnapshot() {
    this.logger.log('Weekly song snapshot starting');

    try {
      await this.snapshotService.snapshotAllSongs();
      this.logger.log('Weekly song snapshot complete');
    } catch (err) {
      this.logger.error(
        `Weekly song snapshot failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
