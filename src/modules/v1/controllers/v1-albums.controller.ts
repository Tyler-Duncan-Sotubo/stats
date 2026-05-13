// src/modules/v1/controllers/v1-albums.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/modules/api-keys/guards/api-key.guard';
import { AlbumsService } from 'src/modules/public/albums/albums.service';

@Controller('v1/albums')
@UseGuards(ApiKeyGuard)
export class V1AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Get()
  @ApiOperation({ summary: 'Browse albums' })
  @ApiQuery({ name: 'isAfrobeats', required: false, type: Boolean })
  @ApiQuery({
    name: 'albumType',
    required: false,
    enum: ['album', 'single', 'ep'],
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['totalStreams', 'releaseDate', 'dailyStreams'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  browse(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('albumType') albumType?: string,
    @Query('sortBy') sortBy?: 'totalStreams' | 'releaseDate' | 'dailyStreams',
  ) {
    return this.albumsService.browse({
      page: page ? Number(page) : undefined,
      limit: limit ? Math.min(Number(limit), 100) : undefined,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      albumType: albumType || undefined,
      sortBy,
    });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get album by slug' })
  @ApiParam({ name: 'slug', example: 'wizkid-more-love-less-ego' })
  getBySlug(@Param('slug') slug: string) {
    return this.albumsService.getBySlug(slug);
  }
}
