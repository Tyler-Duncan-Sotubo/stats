import { Controller, Get, Param, Query } from '@nestjs/common';
import { SongsService } from './songs.service';

@Controller('public/songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  /**
   * GET /public/songs/:slug
   * Full song profile with streams, chart history, featured artists
   */
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.songsService.getBySlug(slug);
  }

  @Get('indexable')
  async getIndexableSongs() {
    return this.songsService.getIndexableSongs();
  }

  @Get('search')
  async searchSong(
    @Query('title') title: string,
    @Query('artistName') artistName?: string,
  ) {
    return this.songsService.searchSong(title, artistName);
  }
}
