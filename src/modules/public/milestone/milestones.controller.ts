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
  WeeklyReportType,
  WEEKLY_REPORT_TYPES,
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

  @Get('weekly/:type/:weekStart')
  getWeeklyReport(
    @Param('type') type: string,
    @Param('weekStart') weekStart: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('isAfrobeats') isAfrobeats?: string,
  ) {
    if (!WEEKLY_REPORT_TYPES.includes(type as WeeklyReportType))
      throw new BadRequestException(`Invalid report type: ${type}`);

    // Validate weekStart is a Monday (or adjust to nearest)
    const date = new Date(weekStart);
    if (isNaN(date.getTime()))
      throw new BadRequestException('Invalid weekStart date');

    return this.milestonesService.getWeeklyReport({
      type: type as WeeklyReportType,
      weekStart,
      isAfrobeats: isAfrobeats === 'true' ? true : undefined,
      page,
      limit: Math.min(limit, 100),
    });
  }
}
