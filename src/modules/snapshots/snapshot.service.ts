import { Injectable, Logger } from '@nestjs/common';
import { ArtistsRepository } from '../artists/artists.repository';
import { KworbTotalsService } from '../scraper/services/kworb-totals.service';
import { SnapshotRepository } from './snapshot.repository';
import { SongScraperService } from '../songs/song-scraper.service';
import axios from 'axios';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private readonly kworbTotals: KworbTotalsService,
    private readonly snapshotRepository: SnapshotRepository,
    private readonly artistsRepository: ArtistsRepository,
    private readonly songScraperService: SongScraperService,
  ) {}

  // ── Public: snapshot a single artist by spotifyId ─────────────────────
  // Used by the controller and any on-demand calls.
  // Computes its own snapshotDate since it runs independently.

  async snapshotArtist(spotifyId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const artist = await this.artistsRepository.findBySpotifyId(spotifyId);
    if (!artist) {
      this.logger.warn(`Artist not found for spotifyId=${spotifyId}, skipping`);
      return;
    }
    if (!artist.spotifyId) return;
    await this.snapshotArtistById(
      artist as { id: string; spotifyId: string; name: string },
      today,
    );
  }

  // ── Public: snapshot every artist in the DB ───────────────────────────
  // Called by the cron. snapshotDate is computed once so all artists
  // in the same run share the same date even if the run crosses midnight.

  async snapshotAllArtists(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const allArtists = await this.artistsRepository.findAllWithSpotifyId();
    const batchSize = 5;
    let succeeded = 0;
    let failed = 0;

    this.logger.log(`Starting snapshot run for ${allArtists.length} artists`);

    for (let i = 0; i < allArtists.length; i += batchSize) {
      const batch = allArtists.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((artist) =>
          this.snapshotArtistById(
            artist as { id: string; spotifyId: string; name: string },
            today,
          ),
        ),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];

        if (result.status === 'rejected') {
          const artist = batch[j];
          const reason =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);

          if (axios.isAxiosError(result.reason)) {
            const status = result.reason.response?.status;

            if (status === 404) {
              await this.artistsRepository.markKworbNotFound(artist.id);
            }
          }
          failed++;
          this.logger.error(
            `Failed to snapshot ${artist.spotifyId}: ${reason}`,
          );
        } else {
          succeeded++;
        }
      }

      // don't sleep after the last batch
      if (i + batchSize < allArtists.length) {
        await this.sleep(5000);
      }
    }

    this.logger.log(
      `Snapshot run complete — ${succeeded} succeeded, ${failed} failed`,
    );
  }

  // ── Private: core snapshot logic ──────────────────────────────────────
  // Separated from snapshotArtist so snapshotAllArtists can pass in
  // already-loaded artists and a shared snapshotDate without redundant
  // DB lookups.

  private async snapshotArtistById(
    artist: { id: string; spotifyId: string; name: string },
    snapshotDate: string,
  ): Promise<void> {
    const payload = await this.kworbTotals.fetchArtistTotals(artist.spotifyId);

    await this.snapshotRepository.upsertArtistSnapshot({
      artistId: artist.id,
      snapshotDate,
      totalStreams: payload.totals.totalStreams,
      totalStreamsAsLead: payload.totals.totalStreamsAsLead,
      totalStreamsSolo: payload.totals.totalStreamsSolo,
      totalStreamsAsFeature: payload.totals.totalStreamsAsFeature,
      dailyStreams: payload.totals.dailyStreams,
      dailyStreamsAsLead: payload.totals.dailyStreamsAsLead,
      dailyStreamsAsFeature: payload.totals.dailyStreamsAsFeature,
      trackCount: payload.totals.trackCount,
      sourceUpdatedAt: this.normalizeKworbDate(payload.totals.lastUpdated),
    });

    // parallelise song upserts — no dependency between them
    await Promise.all(
      payload.songs.map(async (song) => {
        const dbSong = await this.songScraperService.findOrCreate({
          artistId: artist.id,
          title: song.title,
          spotifyTrackId: song.spotifyTrackId,
        });

        await this.snapshotRepository.upsertSongSnapshot({
          songId: dbSong.id,
          artistId: artist.id,
          spotifyStreams: song.streams,
          dailyStreams: song.dailyStreams,
          snapshotDate,
        });
      }),
    );

    this.logger.log(
      `Snapshotted ${artist.name} (${artist.spotifyId}) — ${payload.songs.length} songs`,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private normalizeKworbDate(value?: string | null): string | null {
    if (!value) return null;
    const normalized = value.replace(/\//g, '-');
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
