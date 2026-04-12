import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { KworbArtistDiscoveryService } from './services/kworb-artist-discovery.service';
import { KworbTotalsService } from './services/kworb-totals.service';
import { SpotifyMetadataService } from './services/spotify-metadata.service';
import { RiaaCertificationService } from './services/riaa-certification.service';
import { BpiCertificationService } from './services/bpi-certification.service';

@Module({
  controllers: [ScraperController],
  providers: [
    KworbArtistDiscoveryService,
    KworbTotalsService,
    SpotifyMetadataService,
    BpiCertificationService,
    RiaaCertificationService,
  ],
  exports: [
    KworbArtistDiscoveryService,
    KworbTotalsService,
    SpotifyMetadataService,
    BpiCertificationService,
    RiaaCertificationService,
  ],
})
export class ScraperModule {}
