import { Controller, Get, Param } from '@nestjs/common';
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
}
