import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CertificationsRepository } from './certifications.repository';
import { ArtistsRepository } from '../artists/artists.repository';

interface CertBulkRow {
  artistName: string;
  title: string;
  level: string;
  territory: string;
  body: string;
  units?: string | number;
  certifiedAt?: string;
  sourceUrl?: string;
}

export interface BulkResult {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

@Injectable()
export class CertificationsBulkService {
  private readonly logger = new Logger(CertificationsBulkService.name);

  constructor(
    private readonly certificationsRepository: CertificationsRepository,
    private readonly artistsRepository: ArtistsRepository,
  ) {}

  async bulkCreate(rows: CertBulkRow[]): Promise<BulkResult> {
    if (!rows?.length) {
      throw new BadRequestException('No rows found in file');
    }
    const VALID_LEVELS = ['diamond', 'platinum', 'gold', 'silver'];
    const errors: { row: number; reason: string }[] = [];

    // Resolve all unique artist names upfront
    const uniqueNames = [
      ...new Set(rows.map((r) => r.artistName?.trim()).filter(Boolean)),
    ];
    const artistMap = await this.resolveArtists(uniqueNames);

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Validate required fields
        if (!row.artistName?.trim()) throw new Error('artistName is required');
        if (!row.title?.trim()) throw new Error('title is required');
        if (!row.level?.trim()) throw new Error('level is required');
        if (!row.territory?.trim()) throw new Error('territory is required');
        if (!row.body?.trim()) throw new Error('body is required');

        const level = row.level.toLowerCase().trim();
        if (!VALID_LEVELS.includes(level)) {
          throw new Error(`level must be one of: ${VALID_LEVELS.join(', ')}`);
        }

        const artistId = artistMap.get(row.artistName.toLowerCase().trim());
        if (!artistId) {
          throw new Error(`Artist "${row.artistName}" not found`);
        }

        // Check for duplicate
        const existing = await this.certificationsRepository.findByUniqueKey(
          artistId,
          row.territory.trim(),
          row.body.trim(),
          row.title.trim(),
        );

        if (existing) {
          skipped++;
          continue;
        }

        await this.certificationsRepository.create({
          artistId,
          territory: row.territory.trim(),
          body: row.body.trim(),
          title: row.title.trim(),
          level,
          units: row.units ? Number(row.units) : undefined,
          certifiedAt: row.certifiedAt?.trim() || undefined,
          sourceUrl: row.sourceUrl?.trim() || undefined,
          rawArtistName: row.artistName.trim(),
          rawTitle: row.title.trim(),
          resolutionStatus: 'matched',
        });

        inserted++;
      } catch (err) {
        errors.push({
          row: rowNum,
          reason: err instanceof Error ? err.message : String(err),
        });
        skipped++;
      }
    }

    this.logger.log(
      `Certifications bulk import — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors.length}`,
    );

    return { inserted, skipped, errors };
  }

  private async resolveArtists(names: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    for (const name of names) {
      const artists = await this.artistsRepository.findAll({
        search: name,
        page: 1,
        limit: 20,
      });

      const match = artists.rows.find(
        (a) => a.name.toLowerCase() === name.toLowerCase(),
      );

      if (match) {
        map.set(name.toLowerCase().trim(), match.id);
      }
    }

    return map;
  }
}
