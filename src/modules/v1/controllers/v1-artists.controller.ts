// src/modules/v1/controllers/v1-artists.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from 'src/modules/api-keys/guards/api-key.guard';
import { ArtistsService } from 'src/modules/public/artists/artists.service';
import { ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';

@Controller('v1/artists')
@UseGuards(ApiKeyGuard)
export class V1ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get()
  @ApiOperation({
    summary: 'Browse artists',
    description: 'Returns a paginated list of artists sorted by streams.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search by name' })
  @ApiQuery({ name: 'isAfrobeats', required: false, type: Boolean })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'ISO country code e.g. NG',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max 100',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'totalStreams', 'monthlyListeners'],
  })
  browse(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('letter') letter?: string,
    @Query('country') country?: string,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('sortBy') sortBy?: 'name' | 'totalStreams' | 'monthlyListeners',
    @Query('q') q?: string,
  ) {
    return this.artistsService.browse({
      page: page ? Number(page) : undefined,
      limit: limit ? Math.min(Number(limit), 100) : undefined,
      letter: letter || undefined,
      country: country || undefined,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      sortBy,
      q: q || undefined,
    });
  }

  @Get(':slug/history')
  @ApiOperation({
    summary: 'Get artist stream history',
    description: 'Returns 90 days of daily stream snapshots.',
  })
  @ApiParam({ name: 'slug', example: 'wizkid' })
  getHistory(@Param('slug') slug: string) {
    return this.artistsService.getArtistHistory(slug);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get artist by slug',
    description:
      'Returns full artist profile including streams, listeners, charts, awards and top songs.',
  })
  @ApiParam({ name: 'slug', example: 'wizkid' })
  getBySlug(@Param('slug') slug: string) {
    return this.artistsService.getBySlug(slug);
  }
}
