import {
  Controller,
  Get,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  MilestonesService,
  ARTIST_TIERS,
  SONG_TIERS,
} from './milestones.service';

@Controller('public/milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get()
  getCounts() {
    return this.milestonesService.getMilestoneCounts();
  }

  @Get('artists/:tier')
  getArtistMilestone(
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
  getSongMilestone(
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

  @Get('recent')
  async getRecentMilestones(
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.milestonesService.getRecentMilestones({
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('timeline/:artistSlug')
  async getArtistTimeline(@Param('artistSlug') artistSlug: string) {
    return this.milestonesService.getArtistMilestoneTimeline(artistSlug);
  }

  @Get('facts/:artistSlug/streams/:threshold')
  async getArtistStreamFact(
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
  async getArtistListenerFact(
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
  async getSongStreamFact(
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

  @Get('facts')
  async getMilestoneFacts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('metric') metric?: string,
    @Query('q') q?: string,
  ) {
    return this.milestonesService.getRecentMilestones({
      isAfrobeats:
        isAfrobeats === 'true'
          ? true
          : isAfrobeats === 'false'
            ? false
            : undefined,
      metric: metric || undefined,
      q: q || undefined,
      page,
      limit,
    });
  }

  @Get('facts/indexable')
  async getIndexableFacts(
    @Query('limit', new DefaultValuePipe(5000), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.milestonesService.getIndexableFacts(limit, offset);
  }
}
