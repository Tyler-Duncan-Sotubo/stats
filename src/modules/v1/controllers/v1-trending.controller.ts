// src/modules/v1/controllers/v1-trending.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/modules/api-keys/guards/api-key.guard';
import { TrendingService } from 'src/modules/public/trending/trending.service';

@ApiTags('Trending')
@ApiBearerAuth('api-key')
@Controller('v1/trending')
@UseGuards(ApiKeyGuard)
export class V1TrendingController {
  constructor(private readonly trendingService: TrendingService) {}

  @Get('artists')
  @ApiOperation({ summary: 'Trending artists by momentum score' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isAfrobeats', required: false, type: Boolean })
  @ApiQuery({ name: 'country', required: false })
  getArtists(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('country') country?: string,
  ) {
    return this.trendingService.getTrendingArtists({
      limit: Math.min(limit, 100),
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      country: country?.toUpperCase(),
    });
  }

  @Get('songs')
  @ApiOperation({ summary: 'Trending songs by momentum score' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isAfrobeats', required: false, type: Boolean })
  getSongs(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
  ) {
    return this.trendingService.getTrendingSongs({
      limit: Math.min(limit, 100),
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
    });
  }
}
