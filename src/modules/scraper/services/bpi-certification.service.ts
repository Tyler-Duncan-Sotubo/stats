import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface BpiCertification {
  artist: string;
  title: string;
  level: string; // 'Silver' | 'Gold' | 'Platinum'
  certifiedAt: string;
  type: string; // 'Single' | 'Album'
}

@Injectable()
export class BpiCertificationService {
  private readonly logger = new Logger(BpiCertificationService.name);

  async searchArtist(artistName: string): Promise<BpiCertification[]> {
    const { data } = await axios.get('https://www.bpi.co.uk/certifications', {
      params: { q: artistName },
      timeout: 15_000,
      headers: {
        'User-Agent': 'tooXclusiveStatsBot/1.0 (+https://tooxclusive.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const $ = cheerio.load(data);
    const results: BpiCertification[] = [];

    $('.certification-result').each((_, el) => {
      results.push({
        artist: $('.artist', el).text().trim(),
        title: $('.title', el).text().trim(),
        level: $('.level', el).text().trim(),
        certifiedAt: $('.date', el).text().trim(),
        type: $('.type', el).text().trim(),
      });
    });

    this.logger.log(
      `Found ${results.length} BPI certifications for "${artistName}"`,
    );

    return results;
  }
}
