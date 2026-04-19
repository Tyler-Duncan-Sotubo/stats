import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SongsService } from './songs.service';
import { SongQueryDto } from './dto/song-query.dto';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { MergeSongDto } from './dto/merge-song.dto';
import { CreateSongAliasDto } from './dto/create-song-alias.dto';
import { CreateSongExternalIdDto } from './dto/create-song-external-id.dto';
import { CreateSongFeatureDto } from './dto/create-song-feature.dto';
import { BulkUpdateSongsDto } from './dto/bulk-update-songs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('songs')
@UseGuards(JwtAuthGuard)
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  // ── Songs ─────────────────────────────────────────────────────────────────

  @Get()
  findAll(@Query() query: SongQueryDto) {
    return this.songsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.songsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSongDto) {
    return this.songsService.create(dto);
  }

  @Patch('bulk')
  bulkUpdate(@Body() dto: BulkUpdateSongsDto) {
    return this.songsService.bulkUpdate(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSongDto) {
    return this.songsService.update(id, dto);
  }

  @Post(':id/merge')
  @HttpCode(HttpStatus.OK)
  merge(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MergeSongDto) {
    return this.songsService.merge(id, dto);
  }

  @Patch(':id/flag-review')
  flagForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('flag') flag: boolean,
  ) {
    return this.songsService.flagForReview(id, flag);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.songsService.remove(id);
  }

  // ── Aliases ───────────────────────────────────────────────────────────────

  @Get(':id/aliases')
  findAliases(@Param('id', ParseUUIDPipe) id: string) {
    return this.songsService.findAliases(id);
  }

  @Post(':id/aliases')
  addAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSongAliasDto,
  ) {
    return this.songsService.addAlias(id, dto);
  }

  @Patch(':id/aliases/:aliasId/primary')
  setPrimaryAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
  ) {
    return this.songsService.setPrimaryAlias(id, aliasId);
  }

  @Delete(':id/aliases/:aliasId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
  ) {
    return this.songsService.removeAlias(id, aliasId);
  }

  // ── External IDs ──────────────────────────────────────────────────────────

  @Get(':id/external-ids')
  findExternalIds(@Param('id', ParseUUIDPipe) id: string) {
    return this.songsService.findExternalIds(id);
  }

  @Post(':id/external-ids')
  addExternalId(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSongExternalIdDto,
  ) {
    return this.songsService.addExternalId(id, dto);
  }

  @Delete(':id/external-ids/:externalIdId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExternalId(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('externalIdId', ParseUUIDPipe) externalIdId: string,
  ) {
    return this.songsService.removeExternalId(id, externalIdId);
  }

  // ── Features ──────────────────────────────────────────────────────────────

  @Get(':id/features')
  findFeatures(@Param('id', ParseUUIDPipe) id: string) {
    return this.songsService.findFeatures(id);
  }

  @Post(':id/features')
  addFeature(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSongFeatureDto,
  ) {
    return this.songsService.addFeature(id, dto);
  }

  @Delete(':id/features/:featuredArtistId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFeature(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('featuredArtistId', ParseUUIDPipe) featuredArtistId: string,
  ) {
    return this.songsService.removeFeature(id, featuredArtistId);
  }
}
