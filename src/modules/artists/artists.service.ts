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

  // artists.service.ts

  async seedFromDiscovery(discovered: DiscoveredArtist[]): Promise<void> {
    if (!discovered.length) return;

    // Load everything we need in one shot
    const existingArtists = await this.artistsRepository.findAllBasic();

    const bySpotifyId = new Map(
      existingArtists.filter((a) => a.spotifyId).map((a) => [a.spotifyId!, a]),
    );

    const byNormName = new Map(
      existingArtists.map((a) => [this.normaliseName(a.name), a]),
    );

    const bySlug = new Map(existingArtists.map((a) => [a.slug, a]));

    const toCreate: { name: string; spotifyId: string; slug: string }[] = [];
    const toEnrich: { id: string; spotifyId: string }[] = []; // existing artist needs spotifyId added

    for (const artist of discovered) {
      const normName = this.normaliseName(artist.name);
      const slug = this.buildSlug(artist.name);

      // Case 1 — already have this Spotify ID → skip entirely
      if (bySpotifyId.has(artist.spotifyId)) continue;

      // Case 2 — artist exists by name but has no Spotify ID yet
      // (was seeded by Billboard backfill) → update with Spotify ID
      const existingByName = byNormName.get(normName) || bySlug.get(slug);
      if (existingByName && !existingByName.spotifyId) {
        toEnrich.push({ id: existingByName.id, spotifyId: artist.spotifyId });
        continue;
      }

      // Case 3 — genuinely new artist not in DB at all → create
      if (!existingByName) {
        toCreate.push({ name: artist.name, spotifyId: artist.spotifyId, slug });
      }
    }

    // Apply enrichment updates — add spotifyId to Billboard-seeded artists
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

    // Create genuinely new artists
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

    // filter out artists that don't have a spotifyId yet
    // (e.g. billboard-only artists waiting to be matched)
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

  private normaliseName(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD') // split accents
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/&/g, 'and') // standardise &
      .replace(/['"]/g, '') // remove quotes
      .replace(/[^a-z0-9\s]/g, ' ') // remove punctuation
      .replace(/\s+/g, ' ') // collapse whitespace
      .trim();
  }
}
