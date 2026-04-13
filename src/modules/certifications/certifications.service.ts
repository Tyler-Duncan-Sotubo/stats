// certifications.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { RiaaCertificationService } from '../scraper/services/riaa-certification.service';
import { CertificationsRepository } from './certifications.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongsRepository } from '../songs/songs.repository';

@Injectable()
export class CertificationsService {
  private readonly logger = new Logger(CertificationsService.name);

  constructor(
    private readonly riaa: RiaaCertificationService,
    private readonly certificationsRepository: CertificationsRepository,
    private readonly artistsRepository: ArtistsRepository,
    private readonly songsRepository: SongsRepository,
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

    // Load all songs for this artist once
    const artistSongs = await this.songsRepository.findByArtistId(artistId);

    // Mutable — we add newly created songs so subsequent certs can match them
    const songCache = [...artistSongs];

    for (const cert of certs) {
      let matchedSong = this.matchSong(cert.title, songCache);

      // No match — create the song from the cert title
      if (!matchedSong) {
        const newSong = await this.songsRepository.createFromCertification({
          artistId,
          title: cert.title,
        });

        if (newSong) {
          songCache.push({ id: newSong.id, title: newSong.title });
          matchedSong = newSong;
        }
      }

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
      });
    }
  }

  // ── Manual certification entry ────────────────────────────────────────

  async addManualCertification(data: {
    artistId: string;
    songId?: string | null;
    territory: string;
    body: string;
    title: string;
    level: string;
    units?: number | null;
    certifiedAt?: string | null;
    sourceUrl?: string;
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
    });

    this.logger.log(
      `Manual cert added: ${data.body} ${data.level} — "${data.title}" for artist ${data.artistId}`,
    );
  }

  // ── Song matching ─────────────────────────────────────────────────────
  // RIAA titles are uppercase and often include featured artist suffixes
  // e.g. "GOD'S PLAN" matches "God's Plan"
  //      "CHICAGO FREESTYLE (FT. GIVEON)" matches "Chicago Freestyle"
  // We normalise both sides and find the closest match

  private matchSong(
    certTitle: string,
    artistSongs: { id: string; title: string }[],
  ): { id: string; title: string } | null {
    const normCert = this.normalizeForMatch(certTitle);

    // Pass 1 — exact normalised match
    const exact = artistSongs.find(
      (s) => this.normalizeForMatch(s.title) === normCert,
    );
    if (exact) return exact;

    // Pass 2 — cert title starts with song title
    // Handles "GOD'S PLAN (REMIX)" matching "God's Plan"
    const startsWith = artistSongs.find((s) => {
      const normSong = this.normalizeForMatch(s.title);
      return normCert.startsWith(normSong) && normSong.length > 3;
    });
    if (startsWith) return startsWith;

    // Pass 3 — song title starts with cert title
    // Handles cert "CHICAGO FREESTYLE" matching "Chicago Freestyle (feat. Giveon)"
    const songStartsWith = artistSongs.find((s) => {
      const normSong = this.normalizeForMatch(s.title);
      return normSong.startsWith(normCert) && normCert.length > 3;
    });
    if (songStartsWith) return songStartsWith;

    return null;
  }

  private normalizeForMatch(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/\s*\(feat\.?.*?\)/gi, '') // strip (feat. X)
      .replace(/\s*\(ft\.?.*?\)/gi, '') // strip (ft. X)
      .replace(/\s*\[feat\.?.*?\]/gi, '') // strip [feat. X]
      .replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation
      .replace(/\s+/g, ' ')
      .trim();
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

  private parseDate(raw: string): string | null {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }

  private parseUnits(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const match = raw.match(/^(\d+)x/i);
      if (match) return parseInt(match[1], 10);
      const direct = parseInt(raw, 10);
      return isNaN(direct) ? null : direct;
    }
    return null;
  }
}
