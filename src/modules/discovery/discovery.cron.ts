import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { ArtistsService } from '../artists/artists.service';
import { KworbArtistDiscoveryService } from '../scraper/services/kworb-artist-discovery.service';

@Injectable()
export class DiscoveryCron {
  private readonly logger = new Logger(DiscoveryCron.name);

  constructor(
    private readonly discovery: KworbArtistDiscoveryService,
    private readonly artistsService: ArtistsService,
  ) {}

  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  // @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async discoverAndSeed() {
    this.logger.log('Running artist discovery cron');
    // Step 1 — Discover from Kworb daily charts (brings Spotify IDs)
    const discovered = await this.discovery.discoverFromMultipleCharts();
    // Step 2 — Match to existing Billboard-seeded artists + create new ones
    await this.artistsService.seedFromDiscovery(discovered.artists);
    this.logger.log('Artist discovery cron complete');
  }

  // @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async enrichPending() {
    this.logger.log('Running artist enrichment cron');
    await this.artistsService.enrichUnenriched();
    this.logger.log('Artist enrichment cron complete');
  }
}
