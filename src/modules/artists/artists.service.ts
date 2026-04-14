import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ArtistsRepository } from './artists.repository';
import { SpotifyMetadataService } from '../scraper/services/spotify-metadata.service';
import { DiscoveredArtist } from '../scraper/services/kworb-artist-discovery.service';
import slugify from 'slugify';
import { CreateArtistInput } from './inputs/create-artist.input';
import { UpdateArtistInput } from './inputs/update-artist.input';

@Injectable()
export class ArtistsService {
  private readonly logger = new Logger(ArtistsService.name);

  constructor(
    private readonly artistsRepository: ArtistsRepository,
    private readonly spotifyMetadata: SpotifyMetadataService,
  ) {}

  async seedFromDiscovery(discovered: DiscoveredArtist[]): Promise<void> {
    if (!discovered.length) return;

    const existingArtists = await this.artistsRepository.findAllBasic();

    const bySpotifyId = new Map(
      existingArtists.filter((a) => a.spotifyId).map((a) => [a.spotifyId!, a]),
    );

    const byNormName = new Map(
      existingArtists.map((a) => [a.normalizedName, a]),
    );

    const bySlug = new Map(existingArtists.map((a) => [a.slug, a]));

    const toCreate: { name: string; spotifyId: string; slug: string }[] = [];
    const toEnrich: { id: string; spotifyId: string }[] = [];

    for (const artist of discovered) {
      const normName = this.normaliseName(artist.name);
      const slug = this.buildSlug(artist.name);

      if (bySpotifyId.has(artist.spotifyId)) continue;

      const existingByName = byNormName.get(normName) || bySlug.get(slug);

      if (existingByName && !existingByName.spotifyId) {
        toEnrich.push({ id: existingByName.id, spotifyId: artist.spotifyId });
        continue;
      }

      if (!existingByName) {
        toCreate.push({ name: artist.name, spotifyId: artist.spotifyId, slug });
      }
    }

    if (toEnrich.length) {
      await Promise.all(
        toEnrich.map(({ id, spotifyId }) =>
          this.artistsRepository.updateSpotifyId(id, spotifyId),
        ),
      );
      this.logger.log(
        `Linked Spotify IDs to ${toEnrich.length} existing artists`,
      );
    }

    if (toCreate.length) {
      await this.artistsRepository.upsertManyDiscovered(toCreate);
      this.logger.log(
        `Created ${toCreate.length} new artists from Kworb discovery`,
      );
    }

    if (!toEnrich.length && !toCreate.length) {
      this.logger.log('No new artists to seed — all already exist in DB');
    }
  }

  async enrichUnenriched(limit = 100): Promise<void> {
    const unenriched = await this.artistsRepository.findUnenriched(limit);

    if (!unenriched.length) {
      this.logger.log('No unenriched artists found');
      return;
    }

    const withSpotifyId = unenriched
      .map((a) => a.spotifyId)
      .filter((id): id is string => id !== null);

    if (!withSpotifyId.length) {
      this.logger.log('No unenriched artists with a Spotify ID — skipping');
      return;
    }

    this.logger.log(`Enriching ${withSpotifyId.length} artists from Spotify`);
    await this.enrichAndUpsert(withSpotifyId);
  }

  async enrichAndUpsert(spotifyIds: string[]): Promise<void> {
    if (!spotifyIds.length) return;

    const metadata =
      await this.spotifyMetadata.fetchMultipleArtists(spotifyIds);

    const rows = metadata.map((m) => ({
      name: m.name,
      normalizedName: this.normaliseName(m.name),
      canonicalName: m.name,
      spotifyId: m.spotifyId,
      slug: this.buildSlug(m.name),
      imageUrl: m.imageUrl,
      sourceOfTruth: 'spotify',
      entityStatus: 'canonical' as const,
      needsReview: false,
    }));

    const upserted = await this.artistsRepository.upsertManyBySpotifyId(rows);
    this.logger.log(`Upserted ${upserted.length} artists`);
  }

  async refreshArtist(spotifyId: string) {
    await this.enrichAndUpsert([spotifyId]);
    return this.artistsRepository.findBySpotifyId(spotifyId);
  }

  async create(dto: CreateArtistInput) {
    const slug = this.buildSlug(dto.name);
    const normalizedName = this.normaliseName(dto.name);

    let imageUrl: string | null = null;
    try {
      const meta = await this.spotifyMetadata.fetchArtistMetadata(
        dto.spotifyId,
      );
      imageUrl = meta.imageUrl;
    } catch {
      this.logger.warn(
        `Could not fetch Spotify metadata for ${dto.spotifyId} during create — proceeding without image`,
      );
    }

    return this.artistsRepository.upsertBySpotifyId({
      name: dto.name,
      normalizedName,
      canonicalName: dto.name,
      spotifyId: dto.spotifyId,
      slug,
      imageUrl,
      originCountry: dto.originCountry ?? null,
      debutYear: dto.debutYear ?? null,
      bio: dto.bio ?? null,
      isAfrobeats: dto.isAfrobeats ?? false,
      isAfrobeatsOverride: dto.isAfrobeatsOverride ?? false,
      sourceOfTruth: 'manual',
      entityStatus: 'canonical',
      needsReview: false,
    });
  }

  async update(id: string, dto: UpdateArtistInput) {
    const existing = await this.artistsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Artist with id=${id} not found`);
    }

    const slug =
      dto.name && dto.name !== existing.name
        ? this.buildSlug(dto.name)
        : undefined;

    const normalizedName =
      dto.name && dto.name !== existing.name
        ? this.normaliseName(dto.name)
        : undefined;

    const canonicalName =
      dto.name && dto.name !== existing.name ? dto.name : undefined;

    return this.artistsRepository.updateById(id, {
      ...dto,
      ...(slug ? { slug } : {}),
      ...(normalizedName ? { normalizedName } : {}),
      ...(canonicalName ? { canonicalName } : {}),
    });
  }

  async upsertFromDashboard(spotifyId: string, dto: UpdateArtistInput) {
    const existing = await this.artistsRepository.findBySpotifyId(spotifyId);

    if (existing) {
      return this.update(existing.id, dto);
    }

    const meta = await this.spotifyMetadata.fetchArtistMetadata(spotifyId);
    const name = dto.name ?? meta.name;

    return this.artistsRepository.upsertBySpotifyId({
      name,
      normalizedName: this.normaliseName(name),
      canonicalName: name,
      spotifyId,
      slug: this.buildSlug(name),
      imageUrl: dto.imageUrl ?? meta.imageUrl,
      originCountry: dto.originCountry ?? null,
      debutYear: dto.debutYear ?? null,
      bio: dto.bio ?? null,
      isAfrobeats: dto.isAfrobeats ?? false,
      isAfrobeatsOverride: dto.isAfrobeatsOverride ?? false,
      sourceOfTruth: 'manual',
      entityStatus: 'canonical',
      needsReview: false,
    });
  }

  async findBySlug(slug: string) {
    return this.artistsRepository.findBySlug(slug);
  }

  async findById(id: string) {
    return this.artistsRepository.findById(id);
  }

  async findBySpotifyId(spotifyId: string) {
    return this.artistsRepository.findBySpotifyId(spotifyId);
  }

  private buildSlug(name: string): string {
    const result = slugify(name, { lower: true, strict: true });
    if (typeof result === 'string') return result;
    throw new Error(`Failed to slugify artist name: ${name}`);
  }

  private normaliseName(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, 'and')
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
