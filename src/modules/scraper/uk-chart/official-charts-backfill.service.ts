// src/modules/backfill/services/official-charts-backfill.service.ts
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
import { and, eq } from 'drizzle-orm';
import slugify from 'slugify';
import * as cheerio from 'cheerio';

type OfficialChartsEntry = {
  song: string;
  artist: string;
  this_week: number;
  peak_position: number | null;
  weeks_on_chart: number | null;
};

type OfficialChartsChart = {
  data: OfficialChartsEntry[];
};

@Injectable()
export class OfficialChartsBackfillService {
  private readonly logger = new Logger(OfficialChartsBackfillService.name);

  private readonly baseUrl = 'https://www.officialcharts.com';
  private readonly chartPath = 'singles-chart';
  private readonly chartId = '7501';

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Public entry point ────────────────────────────────────────────────

  async run(
    job?: Job,
    options?: {
      fromDate?: string;
      toDate?: string;
      chartPath?: string;
      chartName?: string;
      chartId?: string;
    },
  ): Promise<{ dates: number; entries: number }> {
    this.logger.log('Loading existing artists and songs into memory...');

    const chartPath = options?.chartPath ?? this.chartPath;
    const chartId = options?.chartId ?? this.chartId;
    const chartName = options?.chartName ?? 'uk_official_singles';

    const [artistRows, songRows] = await Promise.all([
      this.db.select().from(artists),
      this.db.select().from(songs),
    ]);

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

    const dates = this.generateWeeklyDates(options);
    this.logger.log(`Found ${dates.length} UK chart dates to process`);

    let totalEntries = 0;
    let totalDates = 0;

    for (const date of dates) {
      const chart = await this.fetchChart(date, chartPath, chartId);

      if (!chart) {
        this.logger.warn(`Skipping ${date} — failed to fetch/parse`);
        continue;
      }

      if (!chart.data.length) {
        this.logger.warn(
          `Skipping ${date} — empty chart (selectors may have changed)`,
        );
        continue;
      }

      for (const entry of chart.data) {
        const { primary, featured } = this.parseAllArtists(entry.artist);

        const primaryArtist = await this.resolveArtist(primary, artistByNorm);
        if (!primaryArtist) {
          this.logger.warn(`Could not resolve artist: "${primary}" — skipping`);
          continue;
        }

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

        for (const featuredName of featured) {
          const featuredArtist = await this.resolveArtist(
            featuredName,
            artistByNorm,
          );
          if (!featuredArtist) continue;
          if (featuredArtist.id === primaryArtist.id) continue;

          await this.db
            .insert(songFeatures)
            .values({ songId: song.id, featuredArtistId: featuredArtist.id })
            .onConflictDoNothing();
        }

        await this.db
          .insert(chartEntries)
          .values({
            artistId: primaryArtist.id,
            songId: song.id,
            chartName: chartName,
            chartTerritory: 'UK',
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

      await this.sleep(250);
    }

    this.logger.log(
      `UK backfill complete — ${totalDates} dates, ${totalEntries} chart entries`,
    );

    return { dates: totalDates, entries: totalEntries };
  }

  // ── Test single date — logs raw HTML + parsed result ──────────────────

  async testSingleDate(
    date: string,
    options?: { chartPath?: string; chartId?: string },
  ): Promise<{
    url: string;
    entries: number;
    data: OfficialChartsEntry[];
    parsed: { primary: string; featured: string[] }[];
  }> {
    const chartPath = options?.chartPath ?? this.chartPath;
    const chartId = options?.chartId ?? this.chartId;
    const url = this.buildChartUrl(date, chartPath, chartId);
    this.logger.log(`Testing UK chart fetch: ${url}`);

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; tooXclusiveStatsBot/1.0; +https://tooxclusive.com)',
      },
    });

    this.logger.log(`HTTP status: ${res.status}`);

    if (!res.ok) {
      this.logger.error(`Failed to fetch ${url} — status ${res.status}`);
      return { url, entries: 0, data: [], parsed: [] };
    }

    const html = await res.text();

    console.log('=== RAW HTML SAMPLE (first 3000 chars) ===');
    console.log(html.slice(0, 3000));
    console.log('=== END SAMPLE ===');

    const chart = this.parseChartHtml(html);

    // Show cleaned song/artist AND how parseAllArtists splits each entry
    const parsed = chart.data.map((entry) => ({
      position: entry.this_week,
      song: entry.song,
      artistRaw: entry.artist,
      ...this.parseAllArtists(entry.artist),
    }));

    console.log('=== PARSED ENTRIES ===');
    console.log(JSON.stringify(parsed, null, 2));
    console.log(`Total parsed: ${chart.data.length}`);

    return {
      url,
      entries: chart.data.length,
      data: chart.data,
      parsed: parsed as any,
    };
  }

  // ── Artist resolution ─────────────────────────────────────────────────

  private async resolveArtist(
    name: string,
    cache: Map<string, { id: string; name: string; slug: string }>,
  ) {
    const key = this.normalize(name);

    const cached = cache.get(key);
    if (cached) return cached;

    const fuzzy = this.findFuzzyMatch(key, cache);
    if (fuzzy) {
      cache.set(key, fuzzy);
      return fuzzy;
    }
    const cleanName = this.toTitleCase(name);
    const slug = this.makeSlug(cleanName);

    const [found] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.slug, slug))
      .limit(1);

    if (found) {
      cache.set(key, found);
      return found;
    }

    const [created] = await this.db
      .insert(artists)
      .values({
        name: cleanName,
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

  // ── Song resolution ───────────────────────────────────────────────────

  private async resolveSong(
    artistId: string,
    title: string,
    artistName: string,
    byArtistTitle: Map<string, { id: string }>,
    byTitleOnly: Map<string, { id: string }>,
  ) {
    const titleKey = this.normalize(title);

    const byBoth = byArtistTitle.get(`${artistId}::${titleKey}`);
    if (byBoth) return byBoth;

    const byTitle = byTitleOnly.get(titleKey);
    if (byTitle) return byTitle;

    const cleanTitle = this.toTitleCase(title);
    const slug = this.makeSlug(`${artistName}-${cleanTitle}`);

    const [found] = await this.db
      .select()
      .from(songs)
      .where(and(eq(songs.artistId, artistId), eq(songs.slug, slug)))
      .limit(1);

    if (found) {
      byArtistTitle.set(`${artistId}::${titleKey}`, found);
      return found;
    }

    const [created] = await this.db
      .insert(songs)
      .values({
        artistId,
        title: cleanTitle,
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

  // ── Fuzzy matching ────────────────────────────────────────────────────

  private findFuzzyMatch(
    normName: string,
    cache: Map<string, { id: string; name: string; slug: string }>,
  ): { id: string; name: string; slug: string } | null {
    if (normName.length < 10) return null;

    for (const [key, artist] of cache.entries()) {
      if (Math.abs(key.length - normName.length) > 3) continue;
      if (this.levenshtein(normName, key) <= 2) {
        this.logger.warn(
          `Fuzzy matched "${normName}" → "${key}" (artist: "${artist.name}")`,
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

  // ── HTML parsing ──────────────────────────────────────────────────────

  private async fetchChart(
    date: string,
    chartPath: string,
    chartId: string,
  ): Promise<OfficialChartsChart | null> {
    const url = this.buildChartUrl(date, chartPath, chartId);

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; tooXclusiveStatsBot/1.0; +https://tooxclusive.com)',
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    return this.parseChartHtml(html);
  }

  private parseChartHtml(html: string): OfficialChartsChart {
    const $ = cheerio.load(html);
    const rows: OfficialChartsEntry[] = [];
    const seen = new Set<number>();

    const candidates = [
      '[data-chart-position]',
      '.chart-item',
      '.chart-list-item',
      'article',
      'li',
    ];

    for (const selector of candidates) {
      $(selector).each((_, el) => {
        const $el = $(el);

        const position = this.extractInt(
          $el.attr('data-chart-position') ||
            $el.find('[data-chart-position]').attr('data-chart-position') ||
            $el.find('.position, .chart-key, .chart-position').first().text(),
        );

        if (!position || position < 1 || position > 100 || seen.has(position))
          return;

        const rawTitle = this.cleanText(
          $el.find('h3, h4, .title, .chart-name, .track-title').first().text(),
        );

        const rawArtist = this.cleanText(
          $el
            .find('p, .artist, .chart-artist, .artist-name')
            .filter((_, node) => {
              const txt = $(node).text().trim();
              return !!txt && txt.length < 200;
            })
            .first()
            .text(),
        );

        if (!rawTitle || !rawArtist) return;

        // ── Fix 1: strip "New" prefix injected by Official Charts CMS ────
        const title = this.stripNewPrefix(rawTitle);
        const artist = this.stripNewPrefix(rawArtist);

        // ── Fix 2: strip song title that bleeds into the artist field ─────
        // e.g. title="REIN ME IN" artist="REIN ME INSAM FENDER & OLIVIA DEAN"
        const cleanArtist = this.stripTitleFromArtist(title, artist);

        if (!title || !cleanArtist) return;

        const peak = this.extractInt(
          $el.find('.peak, .chart-peak').first().text(),
        );
        const weeks = this.extractInt(
          $el.find('.weeks, .chart-weeks').first().text(),
        );

        rows.push({
          song: title,
          artist: cleanArtist,
          this_week: position,
          peak_position: peak,
          weeks_on_chart: weeks,
        });

        seen.add(position);
      });

      if (rows.length >= 100) break;
    }

    rows.sort((a, b) => a.this_week - b.this_week);
    return { data: rows };
  }

  // ── Artist string parsing ─────────────────────────────────────────────
  // Separators:
  //   "feat." / "ft." / "featuring"  → feature credit
  //   "/"                            → equal collaboration
  //   "&"                            → equal collaboration
  //   ","                            → equal collaboration
  //   "x"                            → collaboration
  // All values lowercased then title-cased for consistent DB matching

  private parseAllArtists(raw: string): {
    primary: string;
    featured: string[];
  } {
    // Title-case the raw string so it matches DB records
    const titleCased = raw
      .toLowerCase()
      .replace(/(^\w|\s\w)/g, (c) => c.toUpperCase());

    const parts = titleCased
      .split(/\s+(?:featuring|feat\.?|ft\.?|with)\s+|\s+x\s+|\s+&\s+|\/|,\s+/i)
      .map((s) => s.replace(/^[&,/]\s*/, '').trim())
      .filter((s) => s.length > 1);

    return {
      primary: parts[0] ?? titleCased.trim(),
      featured: parts.slice(1),
    };
  }

  // ── Strip "New" prefix injected by Official Charts CMS ───────────────
  // "NewSWIM"               → "SWIM"
  // "NewCLICK CLACK..."     → "CLICK CLACK..."
  // "NewBODY TO BODY"       → "BODY TO BODY"

  private stripNewPrefix(value: string): string {
    return value.replace(/^New(?=[A-Z\s(])/, '').trim();
  }

  // ── Strip song title prefix that bleeds into artist field ────────────
  // title  = "REIN ME IN"
  // artist = "REIN ME INSAM FENDER & OLIVIA DEAN"
  // result = "SAM FENDER & OLIVIA DEAN"

  private stripTitleFromArtist(title: string, artist: string): string {
    const normTitle = title.toUpperCase().replace(/\s+/g, ' ').trim();
    const normArtist = artist.toUpperCase().replace(/\s+/g, ' ').trim();

    if (normArtist.startsWith(normTitle)) {
      return artist.slice(title.length).trim();
    }

    return artist.trim();
  }

  // ── Date generation ───────────────────────────────────────────────────

  private generateWeeklyDates(options?: {
    fromDate?: string;
    toDate?: string;
  }): string[] {
    const to = options?.toDate ? new Date(options.toDate) : new Date();
    const from = options?.fromDate
      ? new Date(options.fromDate)
      : new Date('2000-01-01');

    const end = this.alignToFriday(to);
    const dates: string[] = [];

    for (
      let d = end;
      d >= from;
      d = new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000)
    ) {
      dates.push(this.toIsoDate(d));
    }

    return dates;
  }

  private alignToFriday(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
    return d;
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private buildChartUrl(
    date: string,
    chartPath: string,
    chartId: string,
  ): string {
    const yyyymmdd = date.replaceAll('-', '');
    return `${this.baseUrl}/charts/${chartPath}/${yyyymmdd}/${chartId}/`;
  }

  // ── Utilities ─────────────────────────────────────────────────────────

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

  private cleanText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private extractInt(value?: string | null): number | null {
    if (!value) return null;
    const match = value.replace(/,/g, '').match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private toTitleCase(value: string): string {
    return value
      .toLowerCase()
      .split(' ')
      .map((word) =>
        word.length <= 2
          ? word // keep "in", "of", "to" lowercase if you want
          : word.charAt(0).toUpperCase() + word.slice(1),
      )
      .join(' ')
      .replace(/\b(feat|ft|featuring)\b/gi, 'feat.')
      .replace(/\b(And)\b/g, '&'); // optional stylistic
  }
}
