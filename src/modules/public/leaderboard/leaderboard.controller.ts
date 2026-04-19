import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('public/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * GET /api/public/leaderboard/streams
   * ?limit=50&isAfrobeats=true&country=NG
   */
  @Get('streams')
  getStreams(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('country') country?: string,
  ) {
    const countryCode =
      country && /^[A-Za-z]{2}$/.test(country.trim())
        ? country.trim().toUpperCase()
        : undefined;

    return this.leaderboardService.getStreams({
      limit,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      country: countryCode,
    });
  }

  /**
   * GET /api/public/leaderboard/listeners
   * ?limit=50&isAfrobeats=true&country=NG
   */
  @Get('listeners')
  getListeners(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('country') country?: string,
  ) {
    const countryCode =
      country && /^[A-Za-z]{2}$/.test(country.trim())
        ? country.trim().toUpperCase()
        : undefined;

    return this.leaderboardService.getListeners({
      limit,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      country: countryCode,
    });
  }

  /**
   * GET /api/public/leaderboard/songs
   * ?limit=50&isAfrobeats=true
   */
  @Get('songs')
  getSongs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
  ) {
    return this.leaderboardService.getSongs({
      limit,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
    });
  }
}
