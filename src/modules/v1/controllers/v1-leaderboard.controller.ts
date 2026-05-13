// src/modules/v1/controllers/v1-leaderboard.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/modules/api-keys/guards/api-key.guard';
import { LeaderboardService } from 'src/modules/public/leaderboard/leaderboard.service';

@Controller('v1/leaderboard')
@UseGuards(ApiKeyGuard)
export class V1LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('streams')
  @ApiOperation({ summary: 'Top artists by total streams' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max 100',
  })
  @ApiQuery({ name: 'isAfrobeats', required: false, type: Boolean })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'ISO country code',
  })
  getStreams(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('country') country?: string,
  ) {
    return this.leaderboardService.getStreams({
      limit: Math.min(limit, 100),
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      country: country?.toUpperCase(),
    });
  }

  @Get('listeners')
  @ApiOperation({ summary: 'Top artists by monthly listeners' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isAfrobeats', required: false, type: Boolean })
  @ApiQuery({ name: 'country', required: false })
  getListeners(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('country') country?: string,
  ) {
    return this.leaderboardService.getListeners({
      limit: Math.min(limit, 100),
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      country: country?.toUpperCase(),
    });
  }

  @Get('songs')
  @ApiOperation({ summary: 'Top songs by total streams' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isAfrobeats', required: false, type: Boolean })
  getSongs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
  ) {
    return this.leaderboardService.getSongs({
      limit: Math.min(limit, 100),
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
    });
  }
}
