import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface DiscoveredArtist {
  name: string;
  spotifyId: string;
}

@Injectable()
export class KworbArtistDiscoveryService {
  private readonly logger = new Logger(KworbArtistDiscoveryService.name);

  async discoverFromDailyChart(country = 'ng'): Promise<DiscoveredArtist[]> {
    const url = `https://kworb.net/spotify/country/${country.toLowerCase()}_daily.html`;

    const { data } = await axios.get<string>(url, {
      timeout: 15_000,
      headers: {
        'User-Agent': 'tooXclusiveStatsBot/1.0 (+https://tooxclusive.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const $ = cheerio.load(data);
    const seen = new Map<string, string>(); // spotifyId -> name

    // Artist links follow the pattern: ../artist/{SPOTIFY_ID}.html
    $('a[href*="/artist/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      // match /artist/3tVQdUvClmAT7URs9V3rsp.html
      // exclude _songs.html, _albums.html, _peaks variants
      const match = href.match(/\/artist\/([A-Za-z0-9]+)\.html$/);
      if (!match) return;

      const spotifyId = match[1];
      const name = $(el).text().trim();
      if (!name || seen.has(spotifyId)) return;

      seen.set(spotifyId, name);
    });

    const artists: DiscoveredArtist[] = Array.from(seen.entries()).map(
      ([spotifyId, name]) => ({ name, spotifyId }),
    );

    this.logger.log(
      `Discovered ${artists.length} artists from ${country.toUpperCase()} daily chart`,
    );

    return artists;
  }

  // Run across multiple countries to build a broader Afrobeats seed list
  async discoverFromMultipleCharts(
    countries = ['ng', 'gh', 'ke', 'za', 'ug'],
  ): Promise<DiscoveredArtist[]> {
    const results = await Promise.allSettled(
      countries.map((c) => this.discoverFromDailyChart(c)),
    );

    const seen = new Map<string, string>();

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const artist of result.value) {
        if (!seen.has(artist.spotifyId)) {
          seen.set(artist.spotifyId, artist.name);
        }
      }
    }

    const merged: DiscoveredArtist[] = Array.from(seen.entries()).map(
      ([spotifyId, name]) => ({ name, spotifyId }),
    );

    this.logger.log(
      `Total unique artists discovered across ${countries.length} charts: ${merged.length}`,
    );

    return merged;
  }
}
