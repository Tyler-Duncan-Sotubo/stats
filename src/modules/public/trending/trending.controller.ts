import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TrendingService } from './trending.service';

@Controller('public/trending')
export class TrendingController {
  constructor(private readonly trendingService: TrendingService) {}

  /**
   * GET /public/trending/artists
   * ?limit=20&isAfrobeats=true&country=NG
   */
  @Get('artists')
  getTrendingArtists(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('country') country?: string,
  ) {
    const countryCode =
      country && /^[A-Za-z]{2}$/.test(country.trim())
        ? country.trim().toUpperCase()
        : undefined;

    return this.trendingService.getTrendingArtists({
      limit,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      country: countryCode,
    });
  }

  /**
   * GET /public/trending/songs
   * ?limit=20&isAfrobeats=true
   */
  @Get('songs')
  getTrendingSongs(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
  ) {
    return this.trendingService.getTrendingSongs({
      limit,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
    });
  }
}
