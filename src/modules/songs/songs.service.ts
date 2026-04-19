import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SongsRepository } from './songs.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongQueryDto } from './dto/song-query.dto';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { MergeSongDto } from './dto/merge-song.dto';
import { CreateSongAliasDto } from './dto/create-song-alias.dto';
import { CreateSongExternalIdDto } from './dto/create-song-external-id.dto';
import { CreateSongFeatureDto } from './dto/create-song-feature.dto';
import { BulkUpdateSongsDto } from './dto/bulk-update-songs.dto';

@Injectable()
export class SongsService {
  constructor(
    private readonly songsRepository: SongsRepository,
    private readonly artistsRepository: ArtistsRepository,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private normalize(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  private slugify(artistSlug: string, title: string): string {
    const titleSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return `${artistSlug}-${titleSlug}`;
  }

  // ── Songs ─────────────────────────────────────────────────────────────────

  async findAll(query: SongQueryDto) {
    const { rows, total } = await this.songsRepository.findAll({
      search: query.search,
      artistId: query.artistId,
      isAfrobeats: query.isAfrobeats,
      entityStatus: query.entityStatus,
      needsReview: query.needsReview,
      explicit: query.explicit,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      data: rows,
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        totalPages: Math.ceil(total / (query.limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const song = await this.songsRepository.findWithRelations(id);
    if (!song) throw new NotFoundException(`Song ${id} not found`);
    return song;
  }

  async create(dto: CreateSongDto) {
    const artist = await this.artistsRepository.findById(dto.artistId);
    if (!artist)
      throw new NotFoundException(`Artist ${dto.artistId} not found`);

    if (dto.spotifyTrackId) {
      const existing = await this.songsRepository.findBySpotifyTrackId(
        dto.spotifyTrackId,
      );
      if (existing) {
        throw new ConflictException(
          `Song with Spotify track ID "${dto.spotifyTrackId}" already exists`,
        );
      }
    }

    const normalizedTitle = this.normalize(dto.title);
    const slug = this.slugify(artist.slug, dto.title);

    const existingSlug = await this.songsRepository.findBySlug(slug);
    if (existingSlug) {
      throw new ConflictException(`Song with slug "${slug}" already exists`);
    }

    return this.songsRepository.create({
      ...dto,
      normalizedTitle,
      canonicalTitle: dto.title,
      slug,
      entityStatus: dto.entityStatus ?? 'canonical',
      isAfrobeats: dto.isAfrobeats ?? false,
      explicit: dto.explicit ?? false,
      sourceOfTruth: dto.sourceOfTruth ?? 'manual',
    });
  }

  async update(id: string, dto: UpdateSongDto) {
    const song = await this.songsRepository.findById(id);
    if (!song) throw new NotFoundException(`Song ${id} not found`);

    const input: Record<string, unknown> = { ...dto };

    if (dto.title) {
      input.normalizedTitle = this.normalize(dto.title);
      input.canonicalTitle = dto.title;

      const artist = await this.artistsRepository.findById(song.artistId);
      if (artist) {
        const newSlug = this.slugify(artist.slug, dto.title);
        if (newSlug !== song.slug) {
          const slugConflict = await this.songsRepository.findBySlug(newSlug);
          if (slugConflict && slugConflict.id !== id) {
            throw new ConflictException(`Slug "${newSlug}" is already taken`);
          }
          input.slug = newSlug;
        }
      }
    }

    return this.songsRepository.update(id, input);
  }

  async merge(sourceId: string, dto: MergeSongDto) {
    if (sourceId === dto.targetSongId) {
      throw new BadRequestException('Cannot merge a song into itself');
    }

    const [source, target] = await Promise.all([
      this.songsRepository.findById(sourceId),
      this.songsRepository.findById(dto.targetSongId),
    ]);

    if (!source)
      throw new NotFoundException(`Source song ${sourceId} not found`);
    if (!target)
      throw new NotFoundException(`Target song ${dto.targetSongId} not found`);
    if (source.entityStatus === 'merged') {
      throw new BadRequestException(`Song ${sourceId} is already merged`);
    }

    return this.songsRepository.merge(sourceId, dto.targetSongId);
  }

  async flagForReview(id: string, flag: boolean) {
    const song = await this.songsRepository.findById(id);
    if (!song) throw new NotFoundException(`Song ${id} not found`);
    return this.songsRepository.flagForReview(id, flag);
  }

  async bulkUpdate(dto: BulkUpdateSongsDto) {
    if (
      dto.isAfrobeats === undefined &&
      dto.needsReview === undefined &&
      !dto.entityStatus
    ) {
      throw new BadRequestException(
        'At least one field to update must be provided',
      );
    }
    return this.songsRepository.bulkUpdate(dto.ids, {
      isAfrobeats: dto.isAfrobeats,
      needsReview: dto.needsReview,
      entityStatus: dto.entityStatus,
    });
  }

  async remove(id: string) {
    const song = await this.songsRepository.findById(id);
    if (!song) throw new NotFoundException(`Song ${id} not found`);
    return this.songsRepository.delete(id);
  }

  // ── Aliases ───────────────────────────────────────────────────────────────

  async findAliases(songId: string) {
    await this.ensureExists(songId);
    return this.songsRepository.findAliases(songId);
  }

  async addAlias(songId: string, dto: CreateSongAliasDto) {
    await this.ensureExists(songId);
    const normalizedAlias = this.normalize(dto.alias);
    const created = await this.songsRepository.addAlias(songId, {
      alias: dto.alias,
      normalizedAlias,
      source: dto.source,
      isPrimary: dto.isPrimary ?? false,
    });
    if (!created)
      throw new ConflictException('Alias already exists for this song');
    return created;
  }

  async setPrimaryAlias(songId: string, aliasId: string) {
    await this.ensureExists(songId);
    const updated = await this.songsRepository.setPrimaryAlias(songId, aliasId);
    if (!updated)
      throw new NotFoundException(
        `Alias ${aliasId} not found for song ${songId}`,
      );
    return updated;
  }

  async removeAlias(songId: string, aliasId: string) {
    await this.ensureExists(songId);
    const deleted = await this.songsRepository.deleteAlias(songId, aliasId);
    if (!deleted)
      throw new NotFoundException(
        `Alias ${aliasId} not found for song ${songId}`,
      );
    return deleted;
  }

  // ── External IDs ──────────────────────────────────────────────────────────

  async findExternalIds(songId: string) {
    await this.ensureExists(songId);
    return this.songsRepository.findExternalIds(songId);
  }

  async addExternalId(songId: string, dto: CreateSongExternalIdDto) {
    await this.ensureExists(songId);
    const created = await this.songsRepository.addExternalId(songId, {
      source: dto.source,
      externalId: dto.externalId,
      externalUrl: dto.externalUrl,
    });
    if (!created) throw new ConflictException('External ID already exists');
    return created;
  }

  async removeExternalId(songId: string, externalIdId: string) {
    await this.ensureExists(songId);
    const deleted = await this.songsRepository.deleteExternalId(
      songId,
      externalIdId,
    );
    if (!deleted)
      throw new NotFoundException(
        `External ID ${externalIdId} not found for song ${songId}`,
      );
    return deleted;
  }

  // ── Features ──────────────────────────────────────────────────────────────

  async findFeatures(songId: string) {
    await this.ensureExists(songId);
    return this.songsRepository.findFeatures(songId);
  }

  async addFeature(songId: string, dto: CreateSongFeatureDto) {
    await this.ensureExists(songId);
    const artist = await this.artistsRepository.findById(dto.featuredArtistId);
    if (!artist)
      throw new NotFoundException(`Artist ${dto.featuredArtistId} not found`);

    const created = await this.songsRepository.addFeature(
      songId,
      dto.featuredArtistId,
    );
    if (!created)
      throw new ConflictException(
        'Featured artist already linked to this song',
      );
    return created;
  }

  async removeFeature(songId: string, featuredArtistId: string) {
    await this.ensureExists(songId);
    const deleted = await this.songsRepository.deleteFeature(
      songId,
      featuredArtistId,
    );
    if (!deleted)
      throw new NotFoundException(
        `Featured artist ${featuredArtistId} not found on song ${songId}`,
      );
    return deleted;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async ensureExists(id: string) {
    const song = await this.songsRepository.findById(id);
    if (!song) throw new NotFoundException(`Song ${id} not found`);
    return song;
  }
}
