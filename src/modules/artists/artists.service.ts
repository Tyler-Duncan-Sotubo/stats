import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ArtistsRepository } from './artists.repository';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { MergeArtistDto } from './dto/merge-artist.dto';
import { ArtistQueryDto } from './dto/artist-query.dto';
import { CreateArtistAliasDto } from './dto/create-artist-alias.dto';
import { CreateArtistGenreDto } from './dto/create-artist-genre.dto';
import { CreateArtistExternalIdDto } from './dto/create-artist-external-id.dto';
import { BulkUpdateArtistsDto } from './dto/bulk-update-artists.dto';

@Injectable()
export class ArtistsService {
  constructor(private readonly artistsRepository: ArtistsRepository) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private normalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  // ── Artists ───────────────────────────────────────────────────────────────

  async findAll(query: ArtistQueryDto) {
    const { rows, total } = await this.artistsRepository.findAll({
      search: query.search,
      originCountry: query.originCountry,
      isAfrobeats: query.isAfrobeats,
      entityStatus: query.entityStatus,
      needsReview: query.needsReview,
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
    const artist = await this.artistsRepository.findWithRelations(id);
    if (!artist) throw new NotFoundException(`Artist ${id} not found`);
    return artist;
  }

  async create(dto: CreateArtistDto) {
    const slug = this.slugify(dto.name);
    const normalizedName = this.normalize(dto.name);

    const existing = await this.artistsRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException(`Artist with slug "${slug}" already exists`);
    }

    if (dto.spotifyId) {
      const existingSpotify = await this.artistsRepository.findBySpotifyId(
        dto.spotifyId,
      );
      if (existingSpotify) {
        throw new ConflictException(
          `Artist with Spotify ID "${dto.spotifyId}" already exists`,
        );
      }
    }

    return this.artistsRepository.create({
      ...dto,
      normalizedName,
      slug,
      entityStatus: dto.entityStatus ?? 'canonical',
      isAfrobeats: dto.isAfrobeats ?? false,
      isAfrobeatsOverride: dto.isAfrobeatsOverride ?? false,
      sourceOfTruth: dto.sourceOfTruth ?? 'manual',
    });
  }

  async update(id: string, dto: UpdateArtistDto) {
    const artist = await this.artistsRepository.findById(id);
    if (!artist) throw new NotFoundException(`Artist ${id} not found`);

    const input: Record<string, unknown> = { ...dto };

    if (dto.name) {
      input.normalizedName = this.normalize(dto.name);
      const newSlug = this.slugify(dto.name);

      if (newSlug !== artist.slug) {
        const slugConflict = await this.artistsRepository.findBySlug(newSlug);
        if (slugConflict && slugConflict.id !== id) {
          throw new ConflictException(`Slug "${newSlug}" is already taken`);
        }
        input.slug = newSlug;
      }
    }

    return this.artistsRepository.update(id, input);
  }

  async merge(sourceId: string, dto: MergeArtistDto) {
    if (sourceId === dto.targetArtistId) {
      throw new BadRequestException('Cannot merge an artist into itself');
    }

    const [source, target] = await Promise.all([
      this.artistsRepository.findById(sourceId),
      this.artistsRepository.findById(dto.targetArtistId),
    ]);

    if (!source)
      throw new NotFoundException(`Source artist ${sourceId} not found`);
    if (!target)
      throw new NotFoundException(
        `Target artist ${dto.targetArtistId} not found`,
      );
    if (source.entityStatus === 'merged') {
      throw new BadRequestException(`Artist ${sourceId} is already merged`);
    }

    return this.artistsRepository.merge(sourceId, dto.targetArtistId);
  }

  async flagForReview(id: string, flag: boolean) {
    const artist = await this.artistsRepository.findById(id);
    if (!artist) throw new NotFoundException(`Artist ${id} not found`);
    return this.artistsRepository.flagForReview(id, flag);
  }

  async bulkUpdate(dto: BulkUpdateArtistsDto) {
    if (
      !dto.originCountry &&
      dto.isAfrobeats === undefined &&
      dto.needsReview === undefined
    ) {
      throw new BadRequestException(
        'At least one field to update must be provided',
      );
    }
    return this.artistsRepository.bulkUpdate(dto.ids, {
      originCountry: dto.originCountry,
      isAfrobeats: dto.isAfrobeats,
      needsReview: dto.needsReview,
    });
  }

  async remove(id: string) {
    const artist = await this.artistsRepository.findById(id);
    if (!artist) throw new NotFoundException(`Artist ${id} not found`);
    return this.artistsRepository.delete(id);
  }

  // ── Aliases ───────────────────────────────────────────────────────────────

  async findAliases(artistId: string) {
    await this.ensureExists(artistId);
    return this.artistsRepository.findAliases(artistId);
  }

  async addAlias(artistId: string, dto: CreateArtistAliasDto) {
    await this.ensureExists(artistId);
    const normalizedAlias = this.normalize(dto.alias);
    const created = await this.artistsRepository.addAlias(artistId, {
      alias: dto.alias,
      normalizedAlias,
      source: dto.source,
      isPrimary: dto.isPrimary ?? false,
    });
    if (!created)
      throw new ConflictException('Alias already exists for this artist');
    return created;
  }

  async setPrimaryAlias(artistId: string, aliasId: string) {
    await this.ensureExists(artistId);
    const updated = await this.artistsRepository.setPrimaryAlias(
      artistId,
      aliasId,
    );
    if (!updated)
      throw new NotFoundException(
        `Alias ${aliasId} not found for artist ${artistId}`,
      );
    return updated;
  }

  async removeAlias(artistId: string, aliasId: string) {
    await this.ensureExists(artistId);
    const deleted = await this.artistsRepository.deleteAlias(artistId, aliasId);
    if (!deleted)
      throw new NotFoundException(
        `Alias ${aliasId} not found for artist ${artistId}`,
      );
    return deleted;
  }

  // ── Genres ────────────────────────────────────────────────────────────────

  async findGenres(artistId: string) {
    await this.ensureExists(artistId);
    return this.artistsRepository.findGenres(artistId);
  }

  async addGenre(artistId: string, dto: CreateArtistGenreDto) {
    await this.ensureExists(artistId);
    const created = await this.artistsRepository.addGenre(artistId, {
      genre: dto.genre,
      isPrimary: dto.isPrimary ?? false,
    });
    if (!created)
      throw new ConflictException('Genre already exists for this artist');
    return created;
  }

  async setPrimaryGenre(artistId: string, genreId: string) {
    await this.ensureExists(artistId);
    const updated = await this.artistsRepository.setPrimaryGenre(
      artistId,
      genreId,
    );
    if (!updated)
      throw new NotFoundException(
        `Genre ${genreId} not found for artist ${artistId}`,
      );
    return updated;
  }

  async removeGenre(artistId: string, genreId: string) {
    await this.ensureExists(artistId);
    const deleted = await this.artistsRepository.deleteGenre(artistId, genreId);
    if (!deleted)
      throw new NotFoundException(
        `Genre ${genreId} not found for artist ${artistId}`,
      );
    return deleted;
  }

  // ── External IDs ──────────────────────────────────────────────────────────

  async findExternalIds(artistId: string) {
    await this.ensureExists(artistId);
    return this.artistsRepository.findExternalIds(artistId);
  }

  async addExternalId(artistId: string, dto: CreateArtistExternalIdDto) {
    await this.ensureExists(artistId);
    const created = await this.artistsRepository.addExternalId(artistId, {
      source: dto.source,
      externalId: dto.externalId,
      externalUrl: dto.externalUrl,
    });
    if (!created) throw new ConflictException('External ID already exists');
    return created;
  }

  async removeExternalId(artistId: string, externalIdId: string) {
    await this.ensureExists(artistId);
    const deleted = await this.artistsRepository.deleteExternalId(
      artistId,
      externalIdId,
    );
    if (!deleted)
      throw new NotFoundException(
        `External ID ${externalIdId} not found for artist ${artistId}`,
      );
    return deleted;
  }

  async bulkSetAfrobeatsAndCountry(
    artists: { slug: string; country: string }[],
  ): Promise<{ updated: number; notFound: string[] }> {
    const notFound: string[] = [];
    let updated = 0;

    const AFROBEATS_COUNTRIES = [
      'NG',
      'GH',
      'TZ',
      'KE',
      'ZA',
      'CM',
      'SN',
      'CI',
    ];

    for (const entry of artists) {
      const artist = await this.artistsRepository.findBySlug(entry.slug);

      if (!artist) {
        notFound.push(entry.slug);
        continue;
      }

      const isAfrobeats = AFROBEATS_COUNTRIES.includes(entry.country);

      await this.artistsRepository.update(artist.id, {
        ...(isAfrobeats && {
          isAfrobeats: true,
          isAfrobeatsOverride: true,
        }),
        originCountry: entry.country,
      });

      if (isAfrobeats) {
        await this.artistsRepository.updateSongsByArtistId(artist.id, {
          isAfrobeats: true,
        });
      }

      updated++;
    }

    return { updated, notFound };
  }

  async bulkSetCountryOnly(
    artists: { slug: string; country: string }[],
  ): Promise<{ updated: number; notFound: string[] }> {
    const notFound: string[] = [];
    let updated = 0;

    for (const entry of artists) {
      const artist = await this.artistsRepository.findBySlug(entry.slug);

      if (!artist) {
        notFound.push(entry.slug);
        continue;
      }

      // Only set country — never touch isAfrobeats
      await this.artistsRepository.update(artist.id, {
        originCountry: entry.country,
      });

      updated++;
    }

    return { updated, notFound };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async ensureExists(id: string) {
    const artist = await this.artistsRepository.findById(id);
    if (!artist) throw new NotFoundException(`Artist ${id} not found`);
    return artist;
  }
}
