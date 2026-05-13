// src/modules/v1/controllers/v1-charts.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/modules/api-keys/guards/api-key.guard';
import { ChartsService } from 'src/modules/public/charts/charts.service';

@Controller('v1/charts')
@UseGuards(ApiKeyGuard)
export class V1ChartsController {
  constructor(private readonly chartsService: ChartsService) {}

  @Get()
  @ApiOperation({ summary: 'Get available charts' })
  getAvailable() {
    return this.chartsService.getAvailableCharts();
  }

  @Get(':chartName/:territory')
  @ApiOperation({ summary: 'Get chart entries' })
  @ApiParam({ name: 'chartName', example: 'official_afrobeats_chart' })
  @ApiParam({ name: 'territory', example: 'UK' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max 200',
  })
  getChart(
    @Param('chartName') chartName: string,
    @Param('territory') territory: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return this.chartsService.getChart(
      chartName,
      territory,
      Math.min(limit, 200),
    );
  }
}
