// src/modules/artists/artists.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ArtistsRepository } from './artists.repository';
import { SpotifyMetadataService } from '../scraper/services/spotify-metadata.service';
import { DiscoveredArtist } from '../scraper/services/kworb-artist-discovery.service';
import slugify from 'slugify';

const AFROBEATS_GENRES = new Set([
  'afrobeats',
  'afropop',
  'afro pop',
  'nigerian pop',
  'ghanaian pop',
  'afro r&b',
  'alte',
  'naija',
  'afroswing',
  'afro dancehall',
  'east african pop',
  'bongo flava',
  'afro soul',
  'south african pop',
  'amapiano',
]);

@Injectable()
export class ArtistsService {
  private readonly logger = new Logger(ArtistsService.name);

  constructor(
    private readonly artistsRepository: ArtistsRepository,
    private readonly spotifyMetadata: SpotifyMetadataService,
  ) {}

  // ── Called by the discovery cron ─────────────────────────────────────
  // Seeds new artists from chart discovery, skips ones already in DB,
  // then immediately enriches new ones with Spotify metadata.

  // artists.service.ts

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

    // Step 1: persist immediately with just what Kworb gave us
    const rows = newArtists.map((a) => ({
      name: a.name,
      spotifyId: a.spotifyId,
      slug: this.buildSlug(a.name),
    }));

    await this.artistsRepository.upsertManyDiscovered(rows);
    this.logger.log(`Seeded ${rows.length} new artists from discovery`);
  }

  // Called by seedFromDiscovery opportunistically AND by its own cron
  async enrichUnenriched(limit = 100): Promise<void> {
    const unenriched = await this.artistsRepository.findUnenriched(limit);

    if (!unenriched.length) {
      this.logger.log('No unenriched artists found');
      return;
    }

    this.logger.log(`Enriching ${unenriched.length} artists from Spotify`);
    await this.enrichAndUpsert(unenriched.map((a) => a.spotifyId));
  }

  // ── Enrich a list of Spotify IDs and upsert into DB ──────────────────
  // This is the core method — fetches metadata from Spotify in batches
  // then upserts artists + genres.

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

    // Build a spotifyId → dbId map for genre upserts
    const idMap = new Map(upserted.map((a) => [a.spotifyId, a.id] as const));

    for (const m of metadata) {
      const dbId = idMap.get(m.spotifyId);
      if (!dbId || !m.genres.length) continue;

      const genres = m.genres.map((genre, i) => ({
        genre: genre.toLowerCase(),
        isPrimary: i === 0,
      }));

      await this.artistsRepository.upsertGenres(dbId, genres);
    }

    this.logger.log(`Upserted ${upserted.length} artists with genres`);
  }

  // ── Single artist refresh ─────────────────────────────────────────────
  // Used to re-enrich a specific artist on demand.

  async refreshArtist(spotifyId: string) {
    await this.enrichAndUpsert([spotifyId]);
    return this.artistsRepository.findBySpotifyId(spotifyId);
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

  private deriveIsAfrobeats(genres: string[]): boolean {
    return genres.some((g) => AFROBEATS_GENRES.has(g.toLowerCase()));
  }

  private buildSlug(name: string): string {
    const result = slugify(name, { lower: true, strict: true });
    if (typeof result === 'string') {
      return result;
    }
    throw new Error(`Failed to slugify artist name: ${name}`);
  }
}
