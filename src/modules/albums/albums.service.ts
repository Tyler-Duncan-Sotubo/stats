import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AlbumsRepository } from './albums.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { AlbumQueryDto } from './dto/album-query.dto';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';

@Injectable()
export class AlbumsService {
  constructor(
    private readonly albumsRepository: AlbumsRepository,
    private readonly artistsRepository: ArtistsRepository,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private slugify(artistSlug: string, title: string): string {
    const titleSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return `${artistSlug}-${titleSlug}`;
  }

  // ── Albums ────────────────────────────────────────────────────────────────

  async findAll(query: AlbumQueryDto) {
    const { rows, total } = await this.albumsRepository.findAll({
      artistId: query.artistId,
      search: query.search,
      albumType: query.albumType,
      isAfrobeats: query.isAfrobeats,
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
    const album = await this.albumsRepository.findWithSongs(id);
    if (!album) throw new NotFoundException(`Album ${id} not found`);
    return album;
  }

  async create(dto: CreateAlbumDto) {
    const artist = await this.artistsRepository.findById(dto.artistId);
    if (!artist)
      throw new NotFoundException(`Artist ${dto.artistId} not found`);

    // Check for duplicate Spotify album ID
    const existingSpotify = await this.albumsRepository.findBySpotifyAlbumId(
      dto.spotifyAlbumId,
    );
    if (existingSpotify) {
      throw new ConflictException(
        `Album with Spotify ID "${dto.spotifyAlbumId}" already exists`,
      );
    }

    const slug = this.slugify(artist.slug, dto.title);

    const existingSlug = await this.albumsRepository.findBySlug(slug);
    if (existingSlug) {
      throw new ConflictException(`Album with slug "${slug}" already exists`);
    }

    return this.albumsRepository.create({
      ...dto,
      slug,
      albumType: dto.albumType ?? 'album',
      isAfrobeats: dto.isAfrobeats ?? false,
    });
  }

  async update(id: string, dto: UpdateAlbumDto) {
    const album = await this.albumsRepository.findById(id);
    if (!album) throw new NotFoundException(`Album ${id} not found`);

    const input: Record<string, unknown> = { ...dto };

    if (dto.spotifyAlbumId && dto.spotifyAlbumId !== album.spotifyAlbumId) {
      const existing = await this.albumsRepository.findBySpotifyAlbumId(
        dto.spotifyAlbumId,
      );
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Album with Spotify ID "${dto.spotifyAlbumId}" already exists`,
        );
      }
    }

    if (dto.title) {
      const artist = await this.artistsRepository.findById(album.artistId);
      if (artist) {
        const newSlug = this.slugify(artist.slug, dto.title);
        if (newSlug !== album.slug) {
          const slugConflict = await this.albumsRepository.findBySlug(newSlug);
          if (slugConflict && slugConflict.id !== id) {
            throw new ConflictException(`Slug "${newSlug}" is already taken`);
          }
          input.slug = newSlug;
        }
      }
    }

    return this.albumsRepository.update(id, input);
  }

  async remove(id: string) {
    const album = await this.albumsRepository.findById(id);
    if (!album) throw new NotFoundException(`Album ${id} not found`);
    return this.albumsRepository.delete(id);
  }
}
