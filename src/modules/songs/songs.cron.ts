import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SongService } from './song.service';

@Injectable()
export class SongsCron {
  private readonly logger = new Logger(SongsCron.name);

  constructor(private readonly songService: SongService) {}

  // Runs every day at 3 AM
  // @Cron(CronExpression.EVERY_DAY_AT_3AM)
  @Cron(CronExpression.EVERY_10_MINUTES, {
    timeZone: 'Europe/London',
  })
  async handleSongEnrichment() {
    this.logger.log('Starting daily song enrichment job');

    try {
      await this.songService.enrichPendingSongs();
      this.logger.log('Completed daily song enrichment job');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Song enrichment job failed: ${errorMessage}`);
    }
  }
}
