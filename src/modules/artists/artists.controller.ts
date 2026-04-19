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
import { ArtistsService } from './artists.service';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { MergeArtistDto } from './dto/merge-artist.dto';
import { ArtistQueryDto } from './dto/artist-query.dto';
import { CreateArtistAliasDto } from './dto/create-artist-alias.dto';
import { CreateArtistGenreDto } from './dto/create-artist-genre.dto';
import { CreateArtistExternalIdDto } from './dto/create-artist-external-id.dto';
import { BulkUpdateArtistsDto } from './dto/bulk-update-artists.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('artists')
@UseGuards(JwtAuthGuard)
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  // ── Artists ───────────────────────────────────────────────────────────────

  @Get()
  findAll(@Query() query: ArtistQueryDto) {
    return this.artistsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.artistsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateArtistDto) {
    return this.artistsService.create(dto);
  }

  @Patch('bulk')
  bulkUpdate(@Body() dto: BulkUpdateArtistsDto) {
    return this.artistsService.bulkUpdate(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArtistDto) {
    return this.artistsService.update(id, dto);
  }

  @Post(':id/merge')
  @HttpCode(HttpStatus.OK)
  merge(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MergeArtistDto) {
    return this.artistsService.merge(id, dto);
  }

  @Patch(':id/flag-review')
  flagForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('flag') flag: boolean,
  ) {
    return this.artistsService.flagForReview(id, flag);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.artistsService.remove(id);
  }

  // ── Aliases ───────────────────────────────────────────────────────────────

  @Get(':id/aliases')
  findAliases(@Param('id', ParseUUIDPipe) id: string) {
    return this.artistsService.findAliases(id);
  }

  @Post(':id/aliases')
  addAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateArtistAliasDto,
  ) {
    return this.artistsService.addAlias(id, dto);
  }

  @Patch(':id/aliases/:aliasId/primary')
  setPrimaryAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
  ) {
    return this.artistsService.setPrimaryAlias(id, aliasId);
  }

  @Delete(':id/aliases/:aliasId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
  ) {
    return this.artistsService.removeAlias(id, aliasId);
  }

  // ── Genres ────────────────────────────────────────────────────────────────

  @Get(':id/genres')
  findGenres(@Param('id', ParseUUIDPipe) id: string) {
    return this.artistsService.findGenres(id);
  }

  @Post(':id/genres')
  addGenre(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateArtistGenreDto,
  ) {
    return this.artistsService.addGenre(id, dto);
  }

  @Patch(':id/genres/:genreId/primary')
  setPrimaryGenre(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('genreId', ParseUUIDPipe) genreId: string,
  ) {
    return this.artistsService.setPrimaryGenre(id, genreId);
  }

  @Delete(':id/genres/:genreId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGenre(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('genreId', ParseUUIDPipe) genreId: string,
  ) {
    return this.artistsService.removeGenre(id, genreId);
  }

  // ── External IDs ──────────────────────────────────────────────────────────

  @Get(':id/external-ids')
  findExternalIds(@Param('id', ParseUUIDPipe) id: string) {
    return this.artistsService.findExternalIds(id);
  }

  @Post(':id/external-ids')
  addExternalId(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateArtistExternalIdDto,
  ) {
    return this.artistsService.addExternalId(id, dto);
  }

  @Delete(':id/external-ids/:externalIdId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExternalId(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('externalIdId', ParseUUIDPipe) externalIdId: string,
  ) {
    return this.artistsService.removeExternalId(id, externalIdId);
  }
}
