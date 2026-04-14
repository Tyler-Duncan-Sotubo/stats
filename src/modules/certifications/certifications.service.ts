import { Injectable, Logger } from '@nestjs/common';
import { RiaaCertificationService } from '../scraper/services/riaa-certification.service';
import { CertificationsRepository } from './certifications.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { EntityResolutionService } from '../catalog/entity-resolution.service';

@Injectable()
export class CertificationsService {
  private readonly logger = new Logger(CertificationsService.name);

  constructor(
    private readonly riaa: RiaaCertificationService,
    private readonly certificationsRepository: CertificationsRepository,
    private readonly artistsRepository: ArtistsRepository,
    private readonly entityResolutionService: EntityResolutionService,
  ) {}

  async syncArtistCertifications(artistId: string): Promise<void> {
    const artist = await this.artistsRepository.findById(artistId);
    if (!artist) return;

    await this.syncRiaaForArtist(artist.id, artist.name);
  }

  async syncAllArtists(): Promise<void> {
    const artists = await this.artistsRepository.findAllWithSpotifyId();
    this.logger.log(`Starting RIAA sync for ${artists.length} artists`);

    let synced = 0;
    let failed = 0;

    for (const artist of artists) {
      try {
        await this.syncRiaaForArtist(artist.id, artist.name);
        synced++;
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed RIAA sync for "${artist.name}" (${artist.id}): ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `RIAA sync complete — ${synced} succeeded, ${failed} failed out of ${artists.length} artists`,
    );
  }

  async syncRiaaForArtist(artistId: string, artistName: string): Promise<void> {
    const certs = await this.riaa.searchArtist(artistName);

    for (const cert of certs) {
      const matchedSong = await this.entityResolutionService.resolveSong({
        artistId,
        title: cert.title,
        source: 'riaa',
        allowCreate: false,
      });

      await this.certificationsRepository.upsert({
        artistId,
        songId: matchedSong?.id ?? null,
        territory: 'US',
        body: 'RIAA',
        title: cert.title,
        level: this.normalizeLevel(cert.level),
        units: this.parseUnits(cert.units),
        certifiedAt: this.parseDate(cert.certifiedAt),
        sourceUrl: 'https://www.riaa.com/gold-platinum',
        rawArtistName: artistName,
        rawTitle: cert.title,
        resolutionStatus: matchedSong ? 'matched' : 'artist_only',
      });
    }
  }

  async addManualCertification(data: {
    artistId: string;
    songId?: string | null;
    territory: string;
    body: string;
    title: string;
    level: string;
    units?: number | null;
    certifiedAt?: string | null;
    sourceUrl?: string | null;
  }): Promise<void> {
    await this.certificationsRepository.upsert({
      artistId: data.artistId,
      songId: data.songId ?? null,
      territory: data.territory,
      body: data.body,
      title: data.title,
      level: this.normalizeLevel(data.level),
      units: data.units ?? null,
      certifiedAt: data.certifiedAt ?? null,
      sourceUrl: data.sourceUrl ?? null,
      rawArtistName: null,
      rawTitle: data.title,
      resolutionStatus: data.songId ? 'matched' : 'artist_only',
    });

    this.logger.log(
      `Manual cert added: ${data.body} ${data.level} — "${data.title}" for artist ${data.artistId}`,
    );
  }

  private normalizeLevel(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower.includes('diamond')) return 'diamond';
    if (lower.includes('platinum')) return 'platinum';
    if (lower.includes('gold')) return 'gold';
    if (lower.includes('silver')) return 'silver';
    return lower;
  }

  private parseDate(raw: string): string | null {
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }

  private parseUnits(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;

    if (typeof raw === 'number') return raw;

    if (typeof raw === 'string') {
      const match = raw.match(/^(\d+)x/i);
      if (match) return parseInt(match[1], 10);

      const direct = parseInt(raw, 10);
      return Number.isNaN(direct) ? null : direct;
    }

    return null;
  }
}
