import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
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

  @Get('indexable')
  async getIndexableArtists(
    @Query('limit', new DefaultValuePipe(5000), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.artistsService.getIndexableArtists(limit, offset);
  }
  @Get(':slug/history')
  async getArtistHistory(@Param('slug') slug: string) {
    return this.artistsService.getArtistHistory(slug);
  }

  /**
   * GET /public/artists/:slug
   * Full artist profile
   */
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.artistsService.getBySlug(slug);
  }
}
