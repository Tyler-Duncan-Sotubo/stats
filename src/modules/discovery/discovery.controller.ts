import { Controller, Get, Param, Query } from '@nestjs/common';
import { ArtistsService } from '../artists/artists.service';
import { KworbArtistDiscoveryService } from '../scraper/services/kworb-artist-discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discovery: KworbArtistDiscoveryService,
    private readonly artistsService: ArtistsService,
  ) {}

  // GET /api/discovery/discover
  // runs the full pipeline: scrape → seed → kick off enrichment
  @Get('discover')
  async discoverAndSeed() {
    const discovered = await this.discovery.discoverFromMultipleCharts();
    await this.artistsService.seedFromDiscovery(discovered.artists);
    return {
      message: 'Discovery complete',
      count: discovered.artists.length,
      duplicates: discovered.duplicates,
    };
  }

  // GET /api/discovery/discover/:country
  // test a single country chart e.g. /api/discovery/discover/ng
  @Get('discover/:country')
  async discoverByCountry(@Param('country') country: string) {
    const discovered = await this.discovery.discoverFromDailyChart(country);
    await this.artistsService.seedFromDiscovery(discovered);
    return {
      message: `Discovery complete for ${country.toUpperCase()}`,
      count: discovered.length,
    };
  }

  // GET /api/discovery/enrich
  // runs enrichment on unenriched artists (Spotify metadata)
  // optionally pass ?limit=50 to control batch size
  @Get('enrich')
  async enrichPending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    await this.artistsService.enrichUnenriched(parsedLimit);
    return { message: `Enrichment triggered for up to ${parsedLimit} artists` };
  }

  // GET /api/discovery/enrich/:spotifyId
  // force refresh a single artist by Spotify ID
  @Get('enrich/:spotifyId')
  async enrichOne(@Param('spotifyId') spotifyId: string) {
    const artist = await this.artistsService.refreshArtist(spotifyId);
    return { message: 'Artist refreshed', artist };
  }
}
