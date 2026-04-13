import { Injectable, Logger } from '@nestjs/common';
// import { Cron } from '@nestjs/schedule';
import { SnapshotService } from './snapshot.service';

@Injectable()
export class SnapshotCron {
  private readonly logger = new Logger(SnapshotCron.name);

  constructor(private readonly snapshotService: SnapshotService) {}

  // @Cron('07 14 * * *', {
  //   timeZone: 'Europe/London',
  // })
  async handleDailySnapshot() {
    this.logger.log('Starting daily artist snapshot job');

    try {
      await this.snapshotService.snapshotAllArtists();
      this.logger.log('Completed daily artist snapshot job');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Snapshot job failed: ${errorMessage}`);
    }
  }
}
