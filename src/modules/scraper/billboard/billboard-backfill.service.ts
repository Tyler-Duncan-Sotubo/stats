/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import {
  artists,
  songs,
  chartEntries,
  songFeatures,
} from 'src/infrastructure/drizzle/schema';
import slugify from 'slugify';
import { eq, and } from 'drizzle-orm';

type BillboardEntry = {
  song: string;
  artist: string;
  this_week: number;
  peak_position: number | null;
  weeks_on_chart: number | null;
};

type BillboardChart = { data: BillboardEntry[] };

@Injectable()
export class BillboardBackfillService {
  private readonly logger = new Logger(BillboardBackfillService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(
    job?: Job,
    options?: { fromDate?: string; toDate?: string },
  ): Promise<{ dates: number; entries: number }> {
    this.logger.log('Loading existing artists and songs into memory...');

    const [artistRows, songRows] = await Promise.all([
      this.db.select().from(artists),
      this.db.select().from(songs),
    ]);

    // ── In-memory lookup maps — avoid DB round trips per entry ───────────
    const artistByNorm = new Map<string, (typeof artistRows)[number]>();
    for (const a of artistRows) {
      artistByNorm.set(this.normalize(a.name), a);
    }

    const songByArtistTitle = new Map<string, (typeof songRows)[number]>();
    const songByTitleOnly = new Map<string, (typeof songRows)[number]>();
    for (const s of songRows) {
      const tk = this.normalize(s.title);
      songByArtistTitle.set(`${s.artistId}::${tk}`, s);
      if (!songByTitleOnly.has(tk)) songByTitleOnly.set(tk, s);
    }

    this.logger.log('Fetching valid chart dates...');
    const dates = await this.fetchDates(options);
    this.logger.log(`Found ${dates.length} chart dates to process`);

    let totalEntries = 0;
    let totalDates = 0;

    for (const date of dates) {
      const chart = await this.fetchChart(date);

      if (!chart) {
        this.logger.warn(`Skipping ${date} — failed to fetch`);
        continue;
      }

      for (const entry of chart.data) {
        // ── Parse primary + featured artists from Billboard string ────────
        const { primary, featured } = this.parseAllArtists(entry.artist);

        // ── Resolve primary artist ────────────────────────────────────────
        const primaryArtist = await this.resolveArtist(primary, artistByNorm);

        if (!primaryArtist) {
          this.logger.warn(
            `Could not resolve primary artist: "${primary}" — skipping`,
          );
          continue;
        }

        // ── Resolve song ──────────────────────────────────────────────────
        const song = await this.resolveSong(
          primaryArtist.id,
          entry.song,
          primary,
          songByArtistTitle,
          songByTitleOnly,
        );

        if (!song) {
          this.logger.warn(
            `Could not resolve song: "${entry.song}" — skipping`,
          );
          continue;
        }

        // ── Resolve featured artists + populate song_features ─────────────
        for (const featuredName of featured) {
          const featuredArtist = await this.resolveArtist(
            featuredName,
            artistByNorm,
          );

          if (!featuredArtist) continue;

          // Skip if featured artist is the same as primary
          if (featuredArtist.id === primaryArtist.id) continue;

          await this.db
            .insert(songFeatures)
            .values({
              songId: song.id,
              featuredArtistId: featuredArtist.id,
            })
            .onConflictDoNothing();
        }

        // ── Write chart entry ─────────────────────────────────────────────
        await this.db
          .insert(chartEntries)
          .values({
            artistId: primaryArtist.id,
            songId: song.id,
            chartName: 'billboard_hot_100',
            chartTerritory: 'US',
            position: entry.this_week,
            peakPosition: entry.peak_position ?? null,
            weeksOnChart: entry.weeks_on_chart ?? null,
            chartWeek: date,
          })
          .onConflictDoNothing();

        totalEntries++;
      }

      totalDates++;

      await job?.updateProgress({
        totalDates,
        totalCharts: dates.length,
        totalEntries,
        currentDate: date,
        percent: Math.round((totalDates / dates.length) * 100),
      });

      this.logger.log(
        `[${totalDates}/${dates.length}] Done ${date} — ${chart.data.length} entries`,
      );

      await this.sleep(150);
    }

    this.logger.log(
      `Backfill complete — ${totalDates} dates, ${totalEntries} chart entries`,
    );

    return { dates: totalDates, entries: totalEntries };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Artist resolution — checks in-memory map first, then DB, then creates
  // ─────────────────────────────────────────────────────────────────────────────
  private async resolveArtist(
    name: string,
    cache: Map<string, { id: string; name: string; slug: string }>,
  ) {
    const key = this.normalize(name);

    // Exact normalised match
    const cached = cache.get(key);
    if (cached) return cached;

    // Fuzzy match against cache — catches "YoungBoy Never Brok Again"
    // matching "YoungBoy Never Broke Again"
    const fuzzyMatch = this.findFuzzyMatch(key, cache);
    if (fuzzyMatch) {
      // Add the variant to cache so future lookups hit immediately
      cache.set(key, fuzzyMatch);
      return fuzzyMatch;
    }

    const slug = this.makeSlug(name);

    // Try DB by slug
    const [found] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.slug, slug))
      .limit(1);

    if (found) {
      cache.set(key, found);
      return found;
    }

    // Create new artist
    const [created] = await this.db
      .insert(artists)
      .values({
        name,
        slug,
        isAfrobeats: false,
        isAfrobeatsOverride: false,
      })
      .onConflictDoUpdate({
        target: artists.slug,
        set: { name },
      })
      .returning();

    if (created) cache.set(key, created);
    return created ?? null;
  }

  // Levenshtein distance — finds names that differ by only 1-2 characters
  // Catches typos in Billboard data like "Brok" vs "Broke"
  private findFuzzyMatch(
    normName: string,
    cache: Map<string, { id: string; name: string; slug: string }>,
  ): { id: string; name: string; slug: string } | null {
    // Only fuzzy match on longer names — short names have too many false positives
    if (normName.length < 10) return null;

    for (const [key, artist] of cache.entries()) {
      if (Math.abs(key.length - normName.length) > 3) continue;
      if (this.levenshtein(normName, key) <= 2) {
        this.logger.warn(
          `Fuzzy matched "${normName}" → "${key}" (existing artist "${artist.name}")`,
        );
        return artist;
      }
    }

    return null;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }

    return dp[m][n];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Song resolution — checks in-memory maps first, then DB, then creates
  // ─────────────────────────────────────────────────────────────────────────────
  private async resolveSong(
    artistId: string,
    title: string,
    artistName: string,
    byArtistTitle: Map<string, { id: string }>,
    byTitleOnly: Map<string, { id: string }>,
  ) {
    const titleKey = this.normalize(title);

    // Try artist+title match first (most accurate)
    const byBoth = byArtistTitle.get(`${artistId}::${titleKey}`);
    if (byBoth) return byBoth;

    // Fall back to title-only match
    const byTitle = byTitleOnly.get(titleKey);
    if (byTitle) return byTitle;

    const slug = this.makeSlug(`${artistName}-${title}`);

    // Try DB
    const [found] = await this.db
      .select()
      .from(songs)
      .where(and(eq(songs.artistId, artistId), eq(songs.slug, slug)))
      .limit(1);

    if (found) {
      byArtistTitle.set(`${artistId}::${titleKey}`, found);
      return found;
    }

    // Create new song
    const [created] = await this.db
      .insert(songs)
      .values({
        artistId,
        title: title.trim(),
        slug,
        isAfrobeats: false,
        explicit: false,
      })
      .onConflictDoUpdate({
        target: songs.slug,
        set: { title: title.trim() },
      })
      .returning();

    if (created) {
      byArtistTitle.set(`${artistId}::${titleKey}`, created);
      byTitleOnly.set(titleKey, created);
    }

    return created ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Parse Billboard artist string into primary + featured
  //
  // Billboard formats:
  //   "Drake"
  //   "Drake Featuring Wizkid & Kyla"
  //   "21 Savage, Burna Boy"
  //   "Wizkid & Tems"
  //   "Rema x Selena Gomez"
  // ─────────────────────────────────────────────────────────────────────────────
  private parseAllArtists(raw: string): {
    primary: string;
    featured: string[];
  } {
    const parts = raw
      // Split on these separators — order matters, longest patterns first
      .split(/\s+(?:featuring|feat\.?|ft\.?|with)\s+|\s+x\s+|\s+&\s+|,\s+/i)
      .map((s) =>
        s
          .trim()
          // Strip leading & or , that slipped through
          .replace(/^[&,]\s*/, '')
          .trim(),
      )
      .filter(Boolean)
      // Remove any part that is just punctuation or empty after cleaning
      .filter((s) => s.length > 1);

    return {
      primary: parts[0] ?? raw.trim(),
      featured: parts.slice(1),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  private async fetchDates(options?: {
    fromDate?: string;
    toDate?: string;
  }): Promise<string[]> {
    const res = await fetch(
      'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/valid_dates.json',
    );
    const dates: string[] = await res.json();

    return dates
      .filter((date) => {
        if (options?.fromDate && date < options.fromDate) return false;
        if (options?.toDate && date > options.toDate) return false;
        return true;
      })
      .sort((a, b) => b.localeCompare(a)); // newest → oldest
  }

  private async fetchChart(date: string): Promise<BillboardChart | null> {
    const res = await fetch(
      `https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/date/${date}.json`,
    );
    if (!res.ok) return null;
    return res.json() as Promise<BillboardChart>;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/&/g, ' and ')
      .replace(/feat\.?/gi, 'featuring')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ');
  }

  private makeSlug(value: string): string {
    return slugify(value, { lower: true, strict: true, trim: true });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
