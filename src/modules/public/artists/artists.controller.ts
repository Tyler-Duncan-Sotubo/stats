import { Controller, Get, Param, Query } from '@nestjs/common';
import { ArtistsService } from './artists.service';

@Controller('public/artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  /**
   * GET /public/artists
   * Browse all artists with pagination, letter filter, country filter
   */
  @Get()
  browse(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('letter') letter?: string,
    @Query('country') country?: string,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('sortBy') sortBy?: 'name' | 'totalStreams' | 'monthlyListeners',
  ) {
    return this.artistsService.browse({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      letter: letter || undefined,
      country: country || undefined,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      sortBy,
    });
  }

  /**
   * GET /public/artists/:slug
   * Full artist profile
   */
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.artistsService.getBySlug(slug);
  }
}
