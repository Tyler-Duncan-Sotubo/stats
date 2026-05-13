// src/modules/v1/controllers/v1-milestones.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/modules/api-keys/guards/api-key.guard';
import {
  MilestonesService,
  ARTIST_TIERS,
  SONG_TIERS,
} from 'src/modules/public/milestone/milestones.service';

@ApiTags('Milestones')
@ApiBearerAuth('api-key')
@Controller('v1/milestones')
@UseGuards(ApiKeyGuard)
export class V1MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get('recent')
  @ApiOperation({ summary: 'Get recent milestones' })
  @ApiQuery({ name: 'isAfrobeats', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecent(
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.milestonesService.getRecentMilestones({
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 100) : 20,
    });
  }

  @Get('artists/:tier')
  getArtistTier(
    @Param('tier') tier: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
  ) {
    if (!ARTIST_TIERS[tier])
      throw new BadRequestException(`Invalid tier: ${tier}`);
    return this.milestonesService.getArtistMilestone({
      tier,
      isAfrobeats: isAfrobeats === 'true' ? true : undefined,
      page,
      limit: Math.min(limit, 100),
    });
  }

  @Get('songs/:tier')
  @ApiOperation({ summary: 'Get songs by milestone tier' })
  @ApiParam({
    name: 'tier',
    example: '1b',
    description: 'e.g. 50m, 100m, 500m, 1b, 2b',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getSongTier(
    @Param('tier') tier: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    if (!SONG_TIERS[tier])
      throw new BadRequestException(`Invalid tier: ${tier}`);
    return this.milestonesService.getSongMilestone({
      tier,
      page,
      limit: Math.min(limit, 100),
    });
  }

  @Get('timeline/:artistSlug')
  @ApiOperation({ summary: 'Get artist milestone timeline' })
  @ApiParam({ name: 'artistSlug', example: 'wizkid' })
  getTimeline(@Param('artistSlug') artistSlug: string) {
    return this.milestonesService.getArtistMilestoneTimeline(artistSlug);
  }

  @Get('facts/:artistSlug/streams/:threshold')
  @ApiOperation({ summary: 'Get artist stream milestone fact' })
  @ApiParam({ name: 'artistSlug', example: 'wizkid' })
  @ApiParam({ name: 'threshold', example: 10000000000 })
  getArtistStreamFact(
    @Param('artistSlug') artistSlug: string,
    @Param('threshold') threshold: string,
  ) {
    return this.milestonesService.getMilestoneFact({
      artistSlug,
      metric: 'spotify_streams',
      threshold: Number(threshold),
    });
  }

  @Get('facts/:artistSlug/listeners/:threshold')
  @ApiOperation({ summary: 'Get artist listener milestone fact' })
  @ApiParam({ name: 'artistSlug', example: 'wizkid' })
  @ApiParam({ name: 'threshold', example: 10000000 })
  getArtistListenerFact(
    @Param('artistSlug') artistSlug: string,
    @Param('threshold') threshold: string,
  ) {
    return this.milestonesService.getMilestoneFact({
      artistSlug,
      metric: 'monthly_listeners',
      threshold: Number(threshold),
    });
  }

  @Get('facts/:artistSlug/songs/:songSlug/streams/:threshold')
  @ApiParam({ name: 'artistSlug', example: 'wizkid' })
  @ApiParam({ name: 'songSlug', example: 'wizkid-essence' })
  @ApiParam({ name: 'threshold', example: 1000000000 })
  getSongStreamFact(
    @Param('artistSlug') artistSlug: string,
    @Param('songSlug') songSlug: string,
    @Param('threshold') threshold: string,
  ) {
    return this.milestonesService.getMilestoneFact({
      artistSlug,
      metric: 'spotify_streams',
      threshold: Number(threshold),
      songSlug,
    });
  }
}
