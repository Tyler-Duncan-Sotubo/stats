// src/modules/charts/daily-chart-ingestion.service.ts

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import {
  artists,
  songs,
  chartEntries,
  songFeatures,
  chartEntrySnapshots,
} from 'src/infrastructure/drizzle/schema';
import { eq, and, sql, lt, desc } from 'drizzle-orm';
import slugify from 'slugify';
import { KworbSpotifyDailyRow } from '../dto/kworb.dto';
import { SpotifyDailyService } from './spotify-daily.service';

const AFRICAN_COUNTRIES = ['ng', 'gh', 'ke', 'za', 'ug'] as const;
const EAST_AFRICA_COUNTRIES = ['ke', 'tz', 'ug', 'rw', 'et'] as const;

type Country = (typeof AFRICAN_COUNTRIES)[number];

@Injectable()
export class DailyChartIngestionService {
  private readonly logger = new Logger(DailyChartIngestionService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly spotifyDailyService: SpotifyDailyService,
  ) {}

  // ── Public: run full daily ingestion ─────────────────────────────────
  // Called by the cron once per day

  async runDailyIngestion(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    this.logger.log(`Starting daily chart ingestion for ${today}`);

    await Promise.allSettled([
      this.ingestAfricanCountryCharts(today),
      this.ingestCombinedCharts(today),
    ]);

    this.logger.log(`Daily chart ingestion complete for ${today}`);
  }

  // ── African country Spotify + Apple charts ────────────────────────────

  private async ingestAfricanCountryCharts(date: string): Promise<void> {
    for (const country of AFRICAN_COUNTRIES) {
      await Promise.allSettled([
        this.ingestSpotifyDaily(country, date),
        this.ingestAppleDaily(country, date),
      ]);
    }
  }

  // ── Combined charts ───────────────────────────────────────────────────

  private async ingestCombinedCharts(date: string): Promise<void> {
    await Promise.allSettled([
      this.ingestTooXclusiveTop100(date),
      this.ingestEastAfricaTop50(date),
    ]);
  }

  // ── Spotify daily per country ─────────────────────────────────────────

  private async ingestSpotifyDaily(
    country: Country,
    date: string,
  ): Promise<void> {
    try {
      const payload = await this.spotifyDailyService.fetchDailyTracks(
        country,
        100,
      );

      await this.persistRows(
        payload.rows,
        `spotify_daily_${country}`,
        country.toUpperCase(),
        date,
      );

      this.logger.log(
        `[Spotify/${country.toUpperCase()}] Ingested ${payload.rows.length} entries`,
      );
    } catch (err) {
      this.logger.error(
        `[Spotify/${country.toUpperCase()}] Failed: ${(err as Error).message}`,
      );
    }
  }

  // ── Apple daily per country ───────────────────────────────────────────

  private async ingestAppleDaily(
    country: Country,
    date: string,
  ): Promise<void> {
    try {
      const payload = await this.spotifyDailyService.fetchAppleDailyTracks(
        country,
        100,
      );

      await this.persistRows(
        payload.rows,
        `apple_daily_${country}`,
        country.toUpperCase(),
        date,
      );

      this.logger.log(
        `[Apple/${country.toUpperCase()}] Ingested ${payload.rows.length} entries`,
      );
    } catch (err) {
      this.logger.error(
        `[Apple/${country.toUpperCase()}] Failed: ${(err as Error).message}`,
      );
    }
  }

  // ── TooXclusive combined Top 100 ──────────────────────────────────────

  private async ingestTooXclusiveTop100(date: string): Promise<void> {
    try {
      // Run for NG as the primary market — the combined chart is Afrobeats focused
      const payload = await this.spotifyDailyService.combineTop100('ng', {
        spotifyWeight: 1.0,
        appleWeight: 1.0,
        sourceMaxRank: 100,
        cap: 100,
      });

      const rows: KworbSpotifyDailyRow[] = payload.items.map((item) => ({
        rank: item.rank,
        artist: item.artist,
        title: item.title,
        featuredArtists: item.featuredArtists,
      }));

      await this.persistRows(rows, 'tooxclusive_top_100', 'NG', date);

      this.logger.log(`[TooXclusive Top 100] Ingested ${rows.length} entries`);
    } catch (err) {
      this.logger.error(
        `[TooXclusive Top 100] Failed: ${(err as Error).message}`,
      );
    }
  }

  // ── East Africa combined Top 50 ───────────────────────────────────────

  private async ingestEastAfricaTop50(date: string): Promise<void> {
    try {
      const payload = await this.spotifyDailyService.buildEastAfricaTop50Flat({
        countries: [...EAST_AFRICA_COUNTRIES],
        cap: 50,
        sourceMaxRank: 100,
      });

      await this.persistRows(
        payload.rows,
        'tooxclusive_east_africa_top_50',
        'EAST_AFRICA',
        date,
      );

      this.logger.log(
        `[East Africa Top 50] Ingested ${payload.rows.length} entries`,
      );
    } catch (err) {
      this.logger.error(
        `[East Africa Top 50] Failed: ${(err as Error).message}`,
      );
    }
  }

  // ── Core persistence logic ────────────────────────────────────────────

  private async persistRows(
    rows: KworbSpotifyDailyRow[],
    chartName: string,
    chartTerritory: string,
    chartWeek: string,
  ): Promise<void> {
    for (const row of rows) {
      const artist = await this.resolveArtist(row.artist);
      if (!artist) continue;

      const song = await this.resolveSong(artist.id, row.title, row.artist);
      if (!song) continue;

      // featured artists → song_features
      for (const featuredName of row.featuredArtists ?? []) {
        const featuredArtist = await this.resolveArtist(featuredName);
        if (!featuredArtist || featuredArtist.id === artist.id) continue;

        await this.db
          .insert(songFeatures)
          .values({ songId: song.id, featuredArtistId: featuredArtist.id })
          .onConflictDoNothing();
      }

      const [entry] = await this.db
        .insert(chartEntries)
        .values({
          artistId: artist.id,
          songId: song.id,
          chartName,
          chartTerritory,
          position: row.rank,
          peakPosition: null,
          weeksOnChart: null,
          chartWeek,
        })
        .onConflictDoNothing()
        .returning({
          id: chartEntries.id,
          songId: chartEntries.songId,
          chartName: chartEntries.chartName,
          chartTerritory: chartEntries.chartTerritory,
          chartWeek: chartEntries.chartWeek,
          position: chartEntries.position,
        });

      if (!entry || !entry.songId || !entry.chartTerritory) {
        continue;
      }

      await this.deriveMetricsForEntry(
        entry as {
          id: string;
          songId: string;
          chartName: string;
          chartTerritory: string;
          chartWeek: string;
          position: number;
        },
      );
    }
  }

  private async deriveMetricsForEntry(entry: {
    id: string;
    songId: string;
    chartName: string;
    chartTerritory: string;
    chartWeek: string;
    position: number;
  }): Promise<void> {
    const previous = await this.findPreviousEntry(entry);

    const peakPosition = await this.computePeakPosition(entry);
    const weeksOnChart = await this.computeWeeksOnChart(entry);

    await this.db
      .update(chartEntries)
      .set({
        peakPosition,
        weeksOnChart,
      })
      .where(eq(chartEntries.id, entry.id));

    const prevRank = previous?.position ?? null;
    const delta = prevRank === null ? null : prevRank - entry.position;
    const trend =
      prevRank === null
        ? 'NEW'
        : entry.position < prevRank
          ? 'UP'
          : entry.position > prevRank
            ? 'DOWN'
            : 'SAME';

    await this.db
      .insert(chartEntrySnapshots)
      .values({
        entryId: entry.id,
        prevRank,
        delta,
        trend,
      })
      .onConflictDoUpdate({
        target: chartEntrySnapshots.entryId,
        set: {
          prevRank,
          delta,
          trend,
        },
      });
  }

  // ── Artist / song resolution ──────────────────────────────────────────
  // Lightweight — no fuzzy matching needed here since Kworb data is consistent.
  // Backfill services need fuzzy matching because historical data is messy.

  private async resolveArtist(name: string) {
    const slug = this.makeSlug(name);

    const [found] = await this.db
      .select({ id: artists.id, name: artists.name, slug: artists.slug })
      .from(artists)
      .where(eq(artists.slug, slug))
      .limit(1);

    if (found) return found;

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
      .returning({ id: artists.id, name: artists.name, slug: artists.slug });

    return created ?? null;
  }

  private async resolveSong(
    artistId: string,
    title: string,
    artistName: string,
  ) {
    const slug = this.makeSlug(`${artistName}-${title}`);

    const [found] = await this.db
      .select({ id: songs.id, spotifyTrackId: songs.spotifyTrackId })
      .from(songs)
      .where(and(eq(songs.artistId, artistId), eq(songs.slug, slug)))
      .limit(1);

    if (found) return found;

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
      .returning({ id: songs.id, spotifyTrackId: songs.spotifyTrackId });

    return created ?? null;
  }

  private makeSlug(value: string): string {
    return slugify(value, { lower: true, strict: true, trim: true });
  }

  private async findPreviousEntry(entry: {
    songId: string;
    chartName: string;
    chartTerritory: string;
    chartWeek: string;
  }) {
    const [previous] = await this.db
      .select({
        id: chartEntries.id,
        position: chartEntries.position,
        chartWeek: chartEntries.chartWeek,
      })
      .from(chartEntries)
      .where(
        and(
          eq(chartEntries.songId, entry.songId),
          eq(chartEntries.chartName, entry.chartName),
          eq(chartEntries.chartTerritory, entry.chartTerritory),
          lt(chartEntries.chartWeek, entry.chartWeek),
        ),
      )
      .orderBy(desc(chartEntries.chartWeek))
      .limit(1);

    return previous ?? null;
  }

  private async computePeakPosition(entry: {
    songId: string;
    chartName: string;
    chartTerritory: string;
    chartWeek: string;
    position: number;
  }): Promise<number> {
    const [result] = await this.db
      .select({
        peak: sql<number>`min(${chartEntries.position})`,
      })
      .from(chartEntries)
      .where(
        and(
          eq(chartEntries.songId, entry.songId),
          eq(chartEntries.chartName, entry.chartName),
          eq(chartEntries.chartTerritory, entry.chartTerritory),
          lt(chartEntries.chartWeek, entry.chartWeek),
        ),
      );

    if (result?.peak == null) {
      return entry.position;
    }

    return Math.min(result.peak, entry.position);
  }

  private async computeWeeksOnChart(entry: {
    songId: string;
    chartName: string;
    chartTerritory: string;
    chartWeek: string;
  }): Promise<number> {
    const [result] = await this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(chartEntries)
      .where(
        and(
          eq(chartEntries.songId, entry.songId),
          eq(chartEntries.chartName, entry.chartName),
          eq(chartEntries.chartTerritory, entry.chartTerritory),
          lt(chartEntries.chartWeek, entry.chartWeek),
        ),
      );

    return (result?.count ?? 0) + 1;
  }
}
