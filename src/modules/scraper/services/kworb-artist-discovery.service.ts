import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface DiscoveredArtist {
  name: string;
  spotifyId: string;
  appearedOnCharts: number;
}

export interface DuplicateGroup {
  normalisedName: string;
  keptSpotifyId: string;
  keptName: string;
  rejectedIds: { spotifyId: string; name: string; appearedOnCharts: number }[];
}

export interface DiscoveryResult {
  artists: DiscoveredArtist[];
  duplicates: DuplicateGroup[];
}

@Injectable()
export class KworbArtistDiscoveryService {
  private readonly logger = new Logger(KworbArtistDiscoveryService.name);

  // ─────────────────────────────────────────────────────────────────────────────
  // Name normalisation — collapses casing and special chars so
  // "Shenge WaseHlalankosi", "Shenge Wasehlalankosi", "shenge wasehlalankosi"
  // all resolve to the same dedup key
  // ─────────────────────────────────────────────────────────────────────────────
  private normaliseName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Single country fetch
  // ─────────────────────────────────────────────────────────────────────────────
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
    const seen = new Map<string, string>(); // spotifyId → name

    $('a[href*="/artist/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      // Match /artist/{ID}.html — exclude _songs, _albums, _peaks variants
      const match = href.match(/\/artist\/([A-Za-z0-9]+)\.html$/);
      if (!match) return;

      const spotifyId = match[1];
      const name = $(el).text().trim();
      if (!name || seen.has(spotifyId)) return;

      seen.set(spotifyId, name);
    });

    const artists: DiscoveredArtist[] = Array.from(seen.entries()).map(
      ([spotifyId, name]) => ({ name, spotifyId, appearedOnCharts: 1 }),
    );

    this.logger.log(
      `Discovered ${artists.length} artists from ${country.toUpperCase()} daily chart`,
    );

    return artists;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Multi-country fetch with deduplication
  // ─────────────────────────────────────────────────────────────────────────────
  async discoverFromMultipleCharts(
    countries = ['ng', 'gh', 'ke', 'za', 'ug', 'us', 'gb', 'ca'],
  ): Promise<DiscoveryResult> {
    const results = await Promise.allSettled(
      countries.map((c) => this.discoverFromDailyChart(c)),
    );

    // Step 1 — Accumulate chart appearance counts per Spotify ID
    const idMap = new Map<string, { name: string; count: number }>();

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const artist of result.value) {
        const existing = idMap.get(artist.spotifyId);
        if (existing) {
          existing.count += 1;
        } else {
          idMap.set(artist.spotifyId, { name: artist.name, count: 1 });
        }
      }
    }

    // Step 2 — Group by normalised name to detect duplicate Spotify profiles
    // e.g. 5 different IDs all named some variant of "Shenge Wasehlalankosi"
    const byNormName = new Map<
      string,
      { spotifyId: string; name: string; count: number }[]
    >();

    for (const [spotifyId, { name, count }] of idMap.entries()) {
      const key = this.normaliseName(name);
      const group = byNormName.get(key) ?? [];
      group.push({ spotifyId, name, count });
      byNormName.set(key, group);
    }

    // Step 3 — Resolve each group
    // Single entry  → pass through untouched
    // Multiple IDs  → keep the one that appeared on the most charts (most active profile)
    //                 log the collision for manual review
    const artists: DiscoveredArtist[] = [];
    const duplicates: DuplicateGroup[] = [];

    for (const [normName, group] of byNormName.entries()) {
      if (group.length === 1) {
        const { spotifyId, name, count } = group[0];
        artists.push({ spotifyId, name, appearedOnCharts: count });
        continue;
      }

      // Sort descending by chart appearances — most active profile wins
      group.sort((a, b) => b.count - a.count);
      const winner = group[0];
      const losers = group.slice(1);

      this.logger.warn(
        `Duplicate Spotify profiles for "${normName}": ` +
          group.map((g) => `${g.spotifyId}(${g.count} charts)`).join(', ') +
          ` → keeping ${winner.spotifyId}`,
      );

      artists.push({
        name: winner.name,
        spotifyId: winner.spotifyId,
        appearedOnCharts: winner.count,
      });

      duplicates.push({
        normalisedName: normName,
        keptSpotifyId: winner.spotifyId,
        keptName: winner.name,
        rejectedIds: losers.map((l) => ({
          spotifyId: l.spotifyId,
          name: l.name,
          appearedOnCharts: l.count,
        })),
      });
    }

    this.logger.log(
      `Discovery complete — ${artists.length} unique artists from ${idMap.size} raw IDs across ${countries.length} charts` +
        (duplicates.length
          ? ` (${duplicates.length} duplicate groups collapsed)`
          : ''),
    );

    return { artists, duplicates };
  }
}
