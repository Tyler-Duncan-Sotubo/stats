import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface RiaaCertification {
  artist: string;
  title: string;
  level: string; // 'Gold' | 'Platinum' | 'Multi-Platinum' | 'Diamond'
  units: string; // '1x Platinum', '3x Platinum' etc.
  certifiedAt: string; // date string
  type: string; // 'Single' | 'Album' | 'Video'
}

@Injectable()
export class RiaaCertificationService {
  private readonly logger = new Logger(RiaaCertificationService.name);
  private readonly baseUrl = 'https://www.riaa.com/gold-platinum';

  async searchArtist(artistName: string): Promise<RiaaCertification[]> {
    const url = `${this.baseUrl}/?tab_active=default-award&ar=${encodeURIComponent(artistName)}`;

    const { data } = await axios.get<string>(url, {
      timeout: 15_000,
      headers: {
        'User-Agent': 'tooXclusiveStatsBot/1.0 (+https://tooxclusive.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const $ = cheerio.load(data);
    const results: RiaaCertification[] = [];

    // RIAA renders results in a table
    $('table.table tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 5) return;

      results.push({
        artist: $(cells[0]).text().trim(),
        title: $(cells[1]).text().trim(),
        level: $(cells[2]).text().trim(),
        units: $(cells[3]).text().trim(),
        certifiedAt: $(cells[4]).text().trim(),
        type: $(cells[5])?.text().trim() ?? '',
      });
    });

    this.logger.log(
      `Found ${results.length} RIAA certifications for "${artistName}"`,
    );

    return results;
  }
}
