import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AlbumsService } from './albums.service';

@Controller('public/albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Get()
  browse(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isAfrobeats') isAfrobeats?: string,
    @Query('albumType') albumType?: string,
    @Query('sortBy') sortBy?: 'totalStreams' | 'releaseDate' | 'dailyStreams',
  ) {
    return this.albumsService.browse({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      isAfrobeats:
        isAfrobeats !== undefined ? isAfrobeats === 'true' : undefined,
      albumType: albumType || undefined,
      sortBy,
    });
  }

  @Get('indexable')
  async getIndexableAlbums(
    @Query('limit', new DefaultValuePipe(5000), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.albumsService.getIndexableAlbums(limit, offset);
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.albumsService.getBySlug(slug);
  }
}
