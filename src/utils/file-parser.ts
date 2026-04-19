import { BadRequestException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export async function parseFile(
  path: string,
  filename: string,
  maxRows: number,
): Promise<Record<string, any>[]> {
  const ext = filename.split('.').pop()?.toLowerCase();
  const buffer = await readFile(path);

  let rows: Record<string, any>[];

  if (ext === 'csv') {
    rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } else if (ext === 'xls' || ext === 'xlsx') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else {
    throw new BadRequestException('Unsupported file format');
  }

  if (rows.length === 0) {
    throw new BadRequestException('File is empty');
  }

  if (rows.length > maxRows) {
    throw new BadRequestException(`File exceeds maximum of ${maxRows} rows`);
  }

  return rows;
}
