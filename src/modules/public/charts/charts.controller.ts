import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ChartsService } from './charts.service';

@Controller('public/charts')
export class ChartsController {
  constructor(private readonly chartsService: ChartsService) {}

  /**
   * GET /api/public/charts
   * List all available charts with latest week
   */
  @Get()
  getAvailableCharts() {
    return this.chartsService.getAvailableCharts();
  }

  /**
   * GET /api/public/charts/:chartName/:territory
   * e.g. /api/public/charts/spotify_daily_ng/NG
   *      /api/public/charts/tooxclusive_top_100/NG
   *      /api/public/charts/apple_daily_ng/NG
   */
  @Get(':chartName/:territory')
  getChart(
    @Param('chartName') chartName: string,
    @Param('territory') territory: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return this.chartsService.getChart(chartName, territory, limit);
  }
}
