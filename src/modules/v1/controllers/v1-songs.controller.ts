// src/modules/v1/controllers/v1-songs.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/modules/api-keys/guards/api-key.guard';
import { ArtistsService } from 'src/modules/public/artists/artists.service';
import { SongsService } from 'src/modules/public/songs/songs.service';

@ApiTags('Songs')
@ApiBearerAuth('api-key')
@Controller('v1/songs')
@UseGuards(ApiKeyGuard)
export class V1SongsController {
  constructor(
    private readonly songsService: SongsService,
    private readonly artistsService: ArtistsService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Search songs by title' })
  @ApiQuery({ name: 'title', required: true, example: 'essence' })
  search(
    @Query('title') title: string,
    @Query('artistName') artistName?: string,
  ) {
    return this.songsService.searchSong(title, artistName);
  }

  @Get(':slug/history')
  @ApiOperation({ summary: 'Get song stream history' })
  @ApiParam({ name: 'slug', example: 'wizkid-essence' })
  getHistory(@Param('slug') slug: string) {
    return this.songsService.getSongHistory(slug);
  }

  @Get(':slug/songs')
  @ApiOperation({ summary: 'Get all songs by artist slug' })
  @ApiParam({ name: 'slug', example: 'wizkid' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getArtistSongs(@Param('slug') slug: string, @Query('limit') limit = '20') {
    return this.artistsService.getArtistSongs(slug, Number(limit));
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get song by slug' })
  @ApiParam({ name: 'slug', example: 'wizkid-essence' })
  getBySlug(@Param('slug') slug: string) {
    return this.songsService.getBySlug(slug);
  }
}
