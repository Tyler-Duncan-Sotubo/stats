import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { RecordsRepository } from './records.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import type { RecordBulkRow } from './dto/bulk-create-records.dto';

export interface BulkResult {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

interface ParsedRecord {
  row: number;
  artistName: string;
  recordType: string;
  recordValue: string;
  numericValue?: number;
  scope: string;
  isActive: boolean;
  setOn?: string;
  brokenOn?: string;
  notes?: string;
}

@Injectable()
export class RecordsBulkService {
  private readonly logger = new Logger(RecordsBulkService.name);

  constructor(
    private readonly recordsRepository: RecordsRepository,
    private readonly artistsRepository: ArtistsRepository,
  ) {}

  async bulkCreate(rows: RecordBulkRow[]): Promise<BulkResult> {
    if (!rows?.length) {
      throw new BadRequestException('No rows found in file');
    }

    const parsed = this.parseRows(rows);
    const errors: { row: number; reason: string }[] = [];

    // Resolve all unique artist names upfront
    const uniqueNames = [
      ...new Set(parsed.map((r) => r.artistName.toLowerCase().trim())),
    ];
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

        // Check for duplicate — same artist + recordType + scope
        const existing = await this.recordsRepository.findActiveByTypeAndScope(
          row.recordType,
          row.scope,
        );

        if (existing && existing.artistId === artistId) {
          skipped++;
          continue;
        }

        await this.recordsRepository.create({
          artistId,
          recordType: row.recordType,
          recordValue: row.recordValue,
          numericValue: row.numericValue,
          scope: row.scope,
          isActive: row.isActive,
          setOn: row.setOn,
          brokenOn: row.brokenOn,
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
      `Records bulk import — inserted: ${inserted}, skipped: ${skipped}, errors: ${errors.length}`,
    );

    return { inserted, skipped, errors };
  }

  private parseRows(rows: RecordBulkRow[]): ParsedRecord[] {
    return rows.map((row, i) => {
      const rowNum = i + 2;

      if (!row.artistName?.trim())
        throw new BadRequestException(`Row ${rowNum}: artistName is required`);
      if (!row.recordType?.trim())
        throw new BadRequestException(`Row ${rowNum}: recordType is required`);
      if (!row.recordValue?.trim())
        throw new BadRequestException(`Row ${rowNum}: recordValue is required`);
      if (!row.scope?.trim())
        throw new BadRequestException(`Row ${rowNum}: scope is required`);

      const numericValue = row.numericValue
        ? Number(row.numericValue)
        : undefined;

      if (row.numericValue && isNaN(numericValue!)) {
        throw new BadRequestException(
          `Row ${rowNum}: numericValue must be a number`,
        );
      }

      // isActive defaults to true unless explicitly "false"
      const isActive =
        row.isActive === false || String(row.isActive).toLowerCase() === 'false'
          ? false
          : true;

      return {
        row: rowNum,
        artistName: row.artistName.trim(),
        recordType: row.recordType.trim(),
        recordValue: row.recordValue.trim(),
        numericValue,
        scope: row.scope.trim(),
        isActive,
        setOn: row.setOn?.trim() || undefined,
        brokenOn: row.brokenOn?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
      };
    });
  }

  private async resolveArtists(names: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    for (const name of names) {
      const result = await this.artistsRepository.findAll({
        search: name,
        page: 1,
        limit: 10,
      });

      const match = result.rows.find(
        (a) => a.name.toLowerCase() === name.toLowerCase(),
      );

      if (match) {
        map.set(name.toLowerCase().trim(), match.id);
      }
    }

    return map;
  }
}
