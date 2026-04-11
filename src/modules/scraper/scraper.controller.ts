import { Controller, Get, Param } from '@nestjs/common';
import { KworbArtistDiscoveryService } from './services/kworb-artist-discovery.service';
import { KworbTotalsService } from './services/kworb-totals.service';
import { SpotifyMetadataService } from './services/spotify-metadata.service';

@Controller('scraper')
export class ScraperController {
  constructor(
    private kworbArtistDiscovery: KworbArtistDiscoveryService,
    private kworbTotals: KworbTotalsService,
    private spotifyMetadata: SpotifyMetadataService,
  ) {}

  @Get('discover-artists')
  async discoverArtists() {
    return this.kworbArtistDiscovery.discoverFromMultipleCharts();
  }

  @Get('fetch-totals/:spotifyId')
  async fetchTotalsForSampleArtists(@Param('spotifyId') spotifyId: string) {
    return this.kworbTotals.fetchArtistTotals(spotifyId);
  }

  @Get('fetch-spotify-artist/:spotifyId')
  async fetchArtistMetadata(@Param('spotifyId') spotifyId: string) {
    return this.spotifyMetadata.fetchArtistMetadata(spotifyId);
  }

  @Get('fetch-track-meta/:trackId')
  async fetchTrackMetadata(@Param('trackId') trackId: string) {
    return this.spotifyMetadata.fetchTrackMetadata(trackId);
  }
}
