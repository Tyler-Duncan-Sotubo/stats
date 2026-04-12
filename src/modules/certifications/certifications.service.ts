// src/modules/certifications/certifications.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { RiaaCertificationService } from '../scraper/services/riaa-certification.service';
import { BpiCertificationService } from '../scraper/services/bpi-certification.service';
import { CertificationsRepository } from './certifications.repository';
import { ArtistsRepository } from '../artists/artists.repository';

@Injectable()
export class CertificationsService {
  private readonly logger = new Logger(CertificationsService.name);

  constructor(
    private readonly riaa: RiaaCertificationService,
    private readonly bpi: BpiCertificationService,
    private readonly certificationsRepository: CertificationsRepository,
    private readonly artistsRepository: ArtistsRepository,
  ) {}

  async syncArtistCertifications(artistId: string): Promise<void> {
    const artist = await this.artistsRepository.findById(artistId);
    if (!artist) return;

    await Promise.allSettled([
      this.syncRiaa(artist.id, artist.name),
      this.syncBpi(artist.id, artist.name),
    ]);
  }

  private async syncRiaa(artistId: string, artistName: string): Promise<void> {
    const certs = await this.riaa.searchArtist(artistName);

    for (const cert of certs) {
      await this.certificationsRepository.upsert({
        artistId,
        territory: 'US',
        body: 'RIAA',
        title: cert.title,
        level: this.normalizeLevel(cert.level),
        units: this.parseUnits(cert.units),
        certifiedAt: this.parseDate(cert.certifiedAt),
        sourceUrl: 'https://www.riaa.com/gold-platinum',
      });
    }

    this.logger.log(`Synced ${certs.length} RIAA certs for ${artistName}`);
  }

  private async syncBpi(artistId: string, artistName: string): Promise<void> {
    const certs = await this.bpi.searchArtist(artistName);

    for (const cert of certs) {
      await this.certificationsRepository.upsert({
        artistId,
        territory: 'UK',
        body: 'BPI',
        title: cert.title,
        level: this.normalizeLevel(cert.level),
        units: null,
        certifiedAt: this.parseDate(cert.certifiedAt),
        sourceUrl: 'https://www.bpi.co.uk/certifications',
      });
    }

    this.logger.log(`Synced ${certs.length} BPI certs for ${artistName}`);
  }

  // ── Normalisation ─────────────────────────────────────────────────────

  private normalizeLevel(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower.includes('diamond')) return 'diamond';
    if (lower.includes('platinum')) return 'platinum';
    if (lower.includes('gold')) return 'gold';
    if (lower.includes('silver')) return 'silver';
    return lower;
  }

  private parseUnits(raw: string): number | null {
    // '3x Platinum' → 3, '1x Gold' → 1, 'Diamond' → null
    const match = raw.match(/^(\d+)x/i);
    return match ? parseInt(match[1], 10) : null;
  }

  private parseDate(raw: string): string | null {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
}
