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

  // ── Discovery pipeline ────────────────────────────────────────────────

  async seedFromDiscovery(discovered: DiscoveredArtist[]): Promise<void> {
    if (!discovered.length) return;

    const incomingIds = discovered.map((d) => d.spotifyId);
    const existingIds =
      await this.artistsRepository.getExistingSpotifyIds(incomingIds);
    const existingSet = new Set(existingIds);

    const newArtists = discovered.filter((d) => !existingSet.has(d.spotifyId));

    if (!newArtists.length) {
      this.logger.log('No new artists to seed — all already exist in DB');
      return;
    }

    const rows = newArtists.map((a) => ({
      name: a.name,
      spotifyId: a.spotifyId,
      slug: this.buildSlug(a.name),
    }));

    await this.artistsRepository.upsertManyDiscovered(rows);
    this.logger.log(`Seeded ${rows.length} new artists from discovery`);
  }

  async enrichUnenriched(limit = 100): Promise<void> {
    const unenriched = await this.artistsRepository.findUnenriched(limit);

    if (!unenriched.length) {
      this.logger.log('No unenriched artists found');
      return;
    }

    this.logger.log(`Enriching ${unenriched.length} artists from Spotify`);
    await this.enrichAndUpsert(unenriched.map((a) => a.spotifyId));
  }

  async enrichAndUpsert(spotifyIds: string[]): Promise<void> {
    if (!spotifyIds.length) return;

    const metadata =
      await this.spotifyMetadata.fetchMultipleArtists(spotifyIds);

    const rows = metadata.map((m) => ({
      name: m.name,
      spotifyId: m.spotifyId,
      slug: this.buildSlug(m.name),
      imageUrl: m.imageUrl,
    }));

    const upserted = await this.artistsRepository.upsertManyBySpotifyId(rows);
    this.logger.log(`Upserted ${upserted.length} artists`);
  }

  async refreshArtist(spotifyId: string) {
    await this.enrichAndUpsert([spotifyId]);
    return this.artistsRepository.findBySpotifyId(spotifyId);
  }

  // ── Dashboard: create ─────────────────────────────────────────────────
  // For manually adding an artist that hasn't been discovered via Kworb yet.
  // Fetches image from Spotify immediately.
  async create(dto: CreateArtistInput) {
    const slug = this.buildSlug(dto.name);

    // pull image from Spotify if we can
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
      spotifyId: dto.spotifyId,
      slug,
      imageUrl,
      originCountry: dto.originCountry ?? null,
      debutYear: dto.debutYear ?? null,
      bio: dto.bio ?? null,
      isAfrobeats: dto.isAfrobeats ?? false,
      isAfrobeatsOverride: dto.isAfrobeatsOverride ?? false,
    });
  }

  // ── Dashboard: update ─────────────────────────────────────────────────
  // Partial update by DB id — only touches fields explicitly passed in.
  // This is what the dashboard calls when an editor fills in the form.

  async update(id: string, dto: UpdateArtistInput) {
    const existing = await this.artistsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Artist with id=${id} not found`);
    }

    // rebuild slug only if name changed
    const slug =
      dto.name && dto.name !== existing.name
        ? this.buildSlug(dto.name)
        : undefined;

    return this.artistsRepository.updateById(id, {
      ...dto,
      ...(slug ? { slug } : {}),
    });
  }

  // ── Dashboard: upsert by spotifyId ───────────────────────────────────
  // Useful when the dashboard imports an artist by Spotify URL —
  // creates if not exists, updates editorial fields if it does.
  async upsertFromDashboard(spotifyId: string, dto: UpdateArtistInput) {
    const existing = await this.artistsRepository.findBySpotifyId(spotifyId);

    if (existing) {
      return this.update(existing.id, dto);
    }

    // not in DB yet — fetch name + image from Spotify and create
    const meta = await this.spotifyMetadata.fetchArtistMetadata(spotifyId);

    return this.artistsRepository.upsertBySpotifyId({
      name: dto.name ?? meta.name,
      spotifyId,
      slug: this.buildSlug(dto.name ?? meta.name),
      imageUrl: dto.imageUrl ?? meta.imageUrl,
      originCountry: dto.originCountry ?? null,
      debutYear: dto.debutYear ?? null,
      bio: dto.bio ?? null,
      isAfrobeats: dto.isAfrobeats ?? false,
      isAfrobeatsOverride: dto.isAfrobeatsOverride ?? false,
    });
  }

  // ── Lookups ───────────────────────────────────────────────────────────

  async findBySlug(slug: string) {
    return this.artistsRepository.findBySlug(slug);
  }

  async findById(id: string) {
    return this.artistsRepository.findById(id);
  }

  async findBySpotifyId(spotifyId: string) {
    return this.artistsRepository.findBySpotifyId(spotifyId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private buildSlug(name: string): string {
    const result = slugify(name, { lower: true, strict: true });
    if (typeof result === 'string') return result;
    throw new Error(`Failed to slugify artist name: ${name}`);
  }
}
