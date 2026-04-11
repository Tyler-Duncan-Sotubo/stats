import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { KworbArtistDiscoveryService } from './services/kworb-artist-discovery.service';
import { KworbTotalsService } from './services/kworb-totals.service';
import { SpotifyMetadataService } from './services/spotify-metadata.service';

@Module({
  controllers: [ScraperController],
  providers: [
    KworbArtistDiscoveryService,
    KworbTotalsService,
    SpotifyMetadataService,
  ],
})
export class ScraperModule {}
