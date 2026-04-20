import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { ArtistsService } from '../artists/artists.service';

@Controller('public/songs')
export class SongsController {
  constructor(
    private readonly songsService: SongsService,
    private readonly artistsService: ArtistsService,
  ) {}

  // ── Static routes first ───────────────────────────────────────────────────

  @Get('indexable')
  async getIndexableSongs(
    @Query('limit', new DefaultValuePipe(10000), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.songsService.getIndexableSongs(limit, offset);
  }

  @Get('search')
  async searchSong(
    @Query('title') title: string,
    @Query('artistName') artistName?: string,
  ) {
    return this.songsService.searchSong(title, artistName);
  }

  // ── Parameterized routes last ─────────────────────────────────────────────

  @Get(':slug/history')
  async getSongHistory(@Param('slug') slug: string) {
    return this.songsService.getSongHistory(slug);
  }

  @Get(':slug/songs')
  async getArtistSongs(
    @Param('slug') slug: string,
    @Query('limit') limit = 20,
  ) {
    return this.artistsService.getArtistSongs(slug, Number(limit));
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.songsService.getBySlug(slug);
  }
}
