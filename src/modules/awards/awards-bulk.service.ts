import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { AwardsRepository } from './awards.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import type { AwardBulkRow } from './dto/bulk-create-awards.dto';

interface ParsedAward {
  row: number;
  artistName: string;
  awardBody: string;
  awardName: string;
  category: string;
  result: string;
  year: number;
  ceremony?: string;
  territory?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface BulkResult {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

@Injectable()
export class AwardsBulkService {
  private readonly logger = new Logger(AwardsBulkService.name);

  constructor(
    private readonly awardsRepository: AwardsRepository,
    private readonly artistsRepository: ArtistsRepository,
  ) {}

  async bulkCreate(rows: AwardBulkRow[]): Promise<BulkResult> {
    this.ensureRows(rows);

    const parsed = this.parseRows(rows);
    const errors: { row: number; reason: string }[] = [];

    // Resolve artist names → IDs in one pass
    const uniqueNames = [...new Set(parsed.map((r) => r.artistName))];
    const artistMap = await this.resolveArtists(uniqueNames);

    let inserted = 0;
    let skipped = 0;

    for (const row of parsed) {
      try {
        const artistId = artistMap.get(row.artistName.toLowerCase().trim());

        if (!artistId) {
          errors.push({
            row: row.row,
            reason: `Artist "${row.artistName}" not found`,
          });
          skipped++;
          continue;
        }

        // Check for duplicate
        const existing = await this.awardsRepository.findByUniqueKey(
          artistId,
          row.awardBody,
          row.awardName,
          row.year,
        );

        if (existing) {
          skipped++;
          continue;
        }

        await this.awardsRepository.create({
          artistId,
          awardBody: row.awardBody,
          awardName: row.awardName,
          category: row.category,
          result: row.result,
          year: row.year,
          ceremony: row.ceremony,
          territory: row.territory,
          sourceUrl: row.sourceUrl,
          notes: row.notes,
        });

        inserted++;
      } catch (err) {
        errors.push({
          row: row.row,
          reason: err instanceof Error ? err.message : String(err),
        });
        skipped++;
      }
    }

    this.logger.log(
      `Awards bulk import — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors.length}`,
    );

    return { inserted, skipped, errors };
  }

  private ensureRows(rows: AwardBulkRow[]) {
    if (!rows?.length) {
      throw new BadRequestException('No rows found in file');
    }
  }

  private parseRows(rows: AwardBulkRow[]): ParsedAward[] {
    const VALID_RESULTS = ['won', 'nominated'];

    return rows.map((row, i) => {
      const rowNum = i + 2; // 1-indexed + header

      if (!row.artistName?.trim())
        throw new BadRequestException(`Row ${rowNum}: artistName is required`);
      if (!row.awardBody?.trim())
        throw new BadRequestException(`Row ${rowNum}: awardBody is required`);
      if (!row.awardName?.trim())
        throw new BadRequestException(`Row ${rowNum}: awardName is required`);
      if (!row.category?.trim())
        throw new BadRequestException(`Row ${rowNum}: category is required`);
      if (!row.result?.trim())
        throw new BadRequestException(`Row ${rowNum}: result is required`);

      const result = row.result.toLowerCase().trim();
      if (!VALID_RESULTS.includes(result)) {
        throw new BadRequestException(
          `Row ${rowNum}: result must be "won" or "nominated"`,
        );
      }

      const year = Number(row.year);
      if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
        throw new BadRequestException(
          `Row ${rowNum}: year must be a valid year`,
        );
      }

      return {
        row: rowNum,
        artistName: row.artistName.trim(),
        awardBody: row.awardBody.trim(),
        awardName: row.awardName.trim(),
        category: row.category.trim(),
        result,
        year,
        ceremony: row.ceremony?.trim() || undefined,
        territory: row.territory?.trim() || undefined,
        sourceUrl: row.sourceUrl?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
      };
    });
  }

  private async resolveArtists(names: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    for (const name of names) {
      const artists = await this.artistsRepository.findAll({
        search: name,
        page: 1,
        limit: 20,
      });

      // Find exact match (case-insensitive)
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
