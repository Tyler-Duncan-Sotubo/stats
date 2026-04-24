// ask-formatter.ts

import { Injectable } from '@nestjs/common';
import { ResolvedData } from './ask-resolver';

@Injectable()
export class AskFormatter {
  format(resolved: ResolvedData, question: string): string | null {
    const { category, data, meta } = resolved;
    const n = question.toLowerCase();

    switch (category) {
      // ── Artist streams ────────────────────────────────────────────────────
      case 'artist_streams': {
        if (!data?.totalStreams)
          return `We don't have stream data for that artist yet.`;
        return `${data.name} has ${this.num(data.totalStreams)} total Spotify streams.`;
      }

      // ── Artist monthly listeners ──────────────────────────────────────────
      case 'artist_monthly_listeners': {
        if (!data?.monthlyListeners)
          return `We don't have listener data for that artist yet.`;
        return `${data.name} has ${this.num(data.monthlyListeners)} monthly listeners on Spotify.`;
      }

      // ── Artist daily streams ──────────────────────────────────────────────
      case 'artist_daily_streams': {
        if (!data?.dailyStreams)
          return `We don't have daily stream data for that artist yet.`;
        return `${data.name} is currently getting ${this.num(data.dailyStreams)} daily Spotify streams.`;
      }

      // ── Artist peak listeners ─────────────────────────────────────────────
      case 'artist_peak_listeners': {
        if (!data?.peakListeners)
          return `We don't have peak listener data for that artist yet.`;
        return `${data.name}'s peak monthly listeners on Spotify is ${this.num(data.peakListeners)}.`;
      }

      // ── Artist Grammy wins ────────────────────────────────────────────────
      case 'artist_grammy_wins': {
        const wins = Number(data?.awardsSummary?.grammyWins ?? 0);
        const noms = Number(data?.awardsSummary?.grammyNominations ?? 0);

        if (wins > 0 && noms > 0) {
          return `${data.name} has won ${wins} Grammy${wins > 1 ? 's' : ''} from ${noms} nomination${noms > 1 ? 's' : ''}.`;
        }
        if (wins > 0) {
          return `${data.name} has won ${wins} Grammy${wins > 1 ? 's' : ''}.`;
        }
        if (noms > 0) {
          return `${data.name} has not won a Grammy but has received ${noms} nomination${noms > 1 ? 's' : ''}.`;
        }
        return `${data.name} has no Grammy wins or nominations in our records.`;
      }

      // ── Artist Grammy nominations ─────────────────────────────────────────
      case 'artist_grammy_nominations': {
        const noms = Number(data?.awardsSummary?.grammyNominations ?? 0);
        const wins = Number(data?.awardsSummary?.grammyWins ?? 0);
        if (noms === 0)
          return `${data.name} has no Grammy nominations in our records.`;
        return `${data.name} has received ${noms} Grammy nomination${noms > 1 ? 's' : ''}${wins > 0 ? ` and won ${wins}` : ''}.`;
      }

      // ── Artist awards ─────────────────────────────────────────────────────
      case 'artist_awards': {
        const wins = Number(data?.awardsSummary?.totalWins ?? 0);
        if (wins === 0) return `${data.name} has no award wins in our records.`;
        return `${data.name} has won ${wins} award${wins > 1 ? 's' : ''}.`;
      }

      // ── Artist chart history ──────────────────────────────────────────────
      case 'artist_chart_history': {
        const charts: any[] = data?.charts ?? [];
        if (!charts.length)
          return `We don't have chart history for ${data.name} yet.`;

        // Filter for UK charts if question mentions UK
        const isUkQuestion = /\buk\b/.test(n);
        const relevant = isUkQuestion
          ? charts.filter(
              (c: any) =>
                c.chartName?.includes('uk') ||
                c.chartName?.includes('official') ||
                c.chartTerritory === 'UK',
            )
          : charts;

        const chart = relevant[0] ?? charts[0];
        if (!chart) return `We don't have chart history for ${data.name} yet.`;

        const chartLabel = this.chartLabel(chart.chartName);
        const peak = chart.bestPeakPosition;
        const weeksAt1 = Number(chart.weeksAtNumber1 ?? 0);
        const totalWeeks = Number(chart.totalChartWeeks ?? 0);

        const parts: string[] = [];
        if (peak) parts.push(`peaked at #${peak}`);
        if (weeksAt1 > 0)
          parts.push(`spent ${weeksAt1} week${weeksAt1 > 1 ? 's' : ''} at #1`);
        if (totalWeeks > 0)
          parts.push(
            `logged ${totalWeeks} total chart week${totalWeeks > 1 ? 's' : ''}`,
          );

        if (!parts.length)
          return `${data.name} has appeared on the ${chartLabel}.`;
        return `${data.name} has ${parts.join(', ')} on the ${chartLabel}.`;
      }

      // ── Artist milestone ──────────────────────────────────────────────────
      case 'artist_milestone': {
        const milestone = meta.milestone ?? 0;
        const total = Number(data?.totalStreams ?? 0);
        if (!total) return `We don't have stream data for ${data.name} yet.`;

        const milestoneStr = this.friendlyMilestone(milestone);
        if (total >= milestone) {
          return `Yes, ${data.name} has hit ${milestoneStr} streams with ${this.num(total)} total Spotify streams.`;
        }
        return `${data.name} has not yet hit ${milestoneStr} streams — currently at ${this.num(total)} Spotify streams.`;
      }

      // ── Artist global rank ────────────────────────────────────────────────
      case 'artist_global_rank': {
        const rank = data?.globalRank ?? null;
        const streams = Number(data?.totalStreams ?? 0);
        const listeners = Number(data?.monthlyListeners ?? 0);

        if (rank) {
          return `${data.name} ranks #${this.num(rank)} globally by monthly listeners on Spotify${listeners ? ` with ${this.num(listeners)} listeners` : ''}.`;
        }
        if (streams) {
          return `${data.name} has ${this.num(streams)} total Spotify streams.`;
        }
        return `We don't have global rank data for ${data.name} yet.`;
      }

      // ── Artist profile ────────────────────────────────────────────────────
      case 'artist_profile': {
        const parts: string[] = [];
        const spotifyParts: string[] = [];
        const awardParts: string[] = [];

        if (data?.totalStreams) {
          spotifyParts.push(
            `${this.num(data.totalStreams)} total Spotify streams`,
          );
        }
        if (data?.monthlyListeners) {
          spotifyParts.push(
            `${this.num(data.monthlyListeners)} monthly listeners on Spotify`,
          );
        }

        const wins = Number(data?.awardsSummary?.grammyWins ?? 0);
        const noms = Number(data?.awardsSummary?.grammyNominations ?? 0);
        if (wins > 0) {
          awardParts.push(`${wins} Grammy win${wins > 1 ? 's' : ''}`);
        } else if (noms > 0) {
          awardParts.push(`${noms} Grammy nomination${noms > 1 ? 's' : ''}`);
        }

        parts.push(...spotifyParts, ...awardParts);

        if (!parts.length)
          return `${data.name} is in our database but we don't have stats yet.`;

        return `${data.name} has ${parts.join(', ')}.`;
      }

      // ── Artist top songs ──────────────────────────────────────────────────
      case 'artist_top_songs': {
        const songs: any[] = data?.songs ?? [];
        if (!songs.length)
          return `We don't have song data for ${data.artistName} yet.`;

        const count = Math.min(meta.limit ?? 5, songs.length);
        const topN = songs.slice(0, count);

        if (count === 1) {
          const top = topN[0];
          return `${top.title} is the most streamed song by ${data.artistName} on Spotify with ${this.num(top.totalStreams)} streams.`;
        }

        const list = topN
          .map(
            (s: any, i: number) =>
              `${i + 1}. ${s.title} (${this.num(s.totalStreams)})`,
          )
          .join(', ');

        return `Top ${count} most streamed songs by ${data.artistName} on Spotify: ${list}.`;
      }

      // ── Artist biggest song ───────────────────────────────────────────────
      case 'artist_biggest_song': {
        const topSongs: any[] = data?.topSongs ?? [];
        if (!topSongs.length)
          return `We don't have song data for ${data.name} yet.`;
        const top = topSongs[0];
        return `${data.name}'s most streamed song is "${top.title}" with ${this.num(top.streams ?? top.totalStreams)} Spotify streams.`;
      }

      // ── Song streams ──────────────────────────────────────────────────────
      case 'song_streams': {
        if (!data) return `We couldn't find that song in our database.`;
        const streams = data.totalStreams;
        if (!streams)
          return `"${data.title}" by ${data.artistName} is in our database but has no stream data yet.`;
        return `"${data.title}" by ${data.artistName} has ${this.num(streams)} Spotify streams.`;
      }

      // ── Song who sang ─────────────────────────────────────────────────────
      case 'song_who_sang': {
        if (!data) return `We couldn't find that song in our database.`;
        const streams = data.totalStreams;
        return streams
          ? `"${data.title}" is by ${data.artistName} with ${this.num(streams)} Spotify streams.`
          : `"${data.title}" is by ${data.artistName}.`;
      }

      // ── Chart number 1 ────────────────────────────────────────────────────
      case 'chart_number_1': {
        const top = data?.data?.[0];
        if (!top) return `We couldn't find chart data for that.`;
        const label = this.chartLabel(data.chartName);
        return `"${top.songTitle}" by ${top.artistName} is #1 on the ${label}.`;
      }

      // ── Chart top 5 ───────────────────────────────────────────────────────
      case 'chart_top_5': {
        const entries: any[] = data?.data ?? [];
        if (!entries.length) return `We couldn't find chart data for that.`;
        const label = this.chartLabel(data.chartName);
        const count = Math.min(meta.limit ?? 5, entries.length);
        const list = entries
          .slice(0, count)
          .map((e: any) => `${e.position}. ${e.songTitle} — ${e.artistName}`)
          .join(', ');
        return `Top ${count} on the ${label}: ${list}.`;
      }

      // ── Chart list ────────────────────────────────────────────────────────
      case 'chart_list': {
        const entries: any[] = data?.data ?? [];
        if (!entries.length) return `We couldn't find chart data for that.`;
        const label = this.chartLabel(data.chartName);
        const top = entries[0];
        const top5 = entries
          .slice(0, 5)
          .map((e: any) => `${e.position}. ${e.songTitle} — ${e.artistName}`)
          .join(', ');
        return `"${top.songTitle}" by ${top.artistName} leads the ${label}. Top 5: ${top5}.`;
      }

      // ── Leaderboard streams ───────────────────────────────────────────────
      case 'leaderboard_streams': {
        const entries: any[] = data?.data ?? [];
        if (!entries.length)
          return `We couldn't load the stream leaderboard right now.`;

        const label = this.leaderboardLabel(meta);
        const count = Math.min(meta.limit ?? 10, entries.length);
        const top = entries[0];

        if (count === 1) {
          return `${top.artistName} leads with ${this.num(top.totalStreams)} Spotify streams.`;
        }

        const list = entries
          .slice(0, count)
          .map(
            (a: any, i: number) =>
              `${i + 1}. ${a.artistName} (${this.num(a.totalStreams)})`,
          )
          .join(', ');

        return `Top ${count} most streamed ${label} on Spotify: ${list}.`;
      }

      // ── Leaderboard listeners ─────────────────────────────────────────────
      case 'leaderboard_listeners': {
        const entries: any[] = data?.data ?? [];
        if (!entries.length) return `No listener data found.`;

        const label = this.leaderboardLabel(meta);
        const count = Math.min(meta.limit ?? 10, entries.length);
        const top = entries[0];

        if (count === 1) {
          return `${top.artistName} has the most monthly listeners with ${this.num(top.monthlyListeners)} on Spotify.`;
        }

        const list = entries
          .slice(0, count)
          .map(
            (a: any, i: number) =>
              `${i + 1}. ${a.artistName} (${this.num(a.monthlyListeners)})`,
          )
          .join(', ');

        return `Top ${count} ${label} by monthly listeners on Spotify: ${list}.`;
      }

      // ── Leaderboard songs ─────────────────────────────────────────────────
      // leaderboard_songs — add afrobeats/nigerian label context
      case 'leaderboard_songs': {
        const entries: any[] = data?.data ?? [];
        if (!entries.length) return `No song data found.`;

        const count = Math.min(meta.limit ?? 10, entries.length);
        const top = entries[0];
        const title = top.songTitle ?? top.title;
        const label = meta.isAfrobeats ? 'Afrobeats' : '';

        if (count === 1) {
          return `"${title}" by ${top.artistName} is the most streamed ${label} song with ${this.num(top.totalStreams)} Spotify streams.`.replace(
            '  ',
            ' ',
          );
        }

        const list = entries
          .slice(0, count)
          .map(
            (s: any, i: number) =>
              `${i + 1}. ${s.songTitle ?? s.title} by ${s.artistName} (${this.num(s.totalStreams)})`,
          )
          .join(', ');

        return `Top ${count} most streamed ${label} songs on Spotify: ${list}.`.replace(
          '  ',
          ' ',
        );
      }

      // ── Trending artists ──────────────────────────────────────────────────
      case 'leaderboard_trending_artists': {
        const entries: any[] = data?.data ?? [];
        if (!entries.length) return `No trending data found.`;

        const count = Math.min(meta.limit ?? 10, entries.length);
        const top = entries[0];
        const label = this.leaderboardLabel(meta);

        if (count === 1) {
          return `${top.artistName ?? top.name} is the fastest growing ${label} with +${this.num(top.dailyGrowth)} daily Spotify stream growth.`;
        }

        const list = entries
          .slice(0, count)
          .map(
            (a: any, i: number) =>
              `${i + 1}. ${a.artistName ?? a.name} (+${this.num(a.dailyGrowth)})`,
          )
          .join(', ');

        return `Top ${count} trending ${label} on Spotify by daily growth: ${list}.`;
      }

      // ── Trending songs ────────────────────────────────────────────────────
      case 'leaderboard_trending_songs': {
        const entries: any[] = data?.data ?? [];
        if (!entries.length) return `No trending data found.`;

        const count = Math.min(meta.limit ?? 10, entries.length);
        const top = entries[0];

        if (count === 1) {
          return `"${top.songTitle ?? top.title}" by ${top.artistName} is trending fastest with +${this.num(top.dailyGrowth)} daily Spotify streams.`;
        }

        const list = entries
          .slice(0, count)
          .map(
            (s: any, i: number) =>
              `${i + 1}. ${s.songTitle ?? s.title} by ${s.artistName} (+${this.num(s.dailyGrowth)})`,
          )
          .join(', ');

        return `Top ${count} trending songs on Spotify: ${list}.`;
      }

      // ── Comparison ────────────────────────────────────────────────────────
      case 'comparison': {
        const { artist1, artist2 } = data;
        const metric = meta.comparisonMetric ?? 'general';

        const streams1 = Number(artist1?.totalStreams ?? 0);
        const streams2 = Number(artist2?.totalStreams ?? 0);
        const listeners1 = Number(artist1?.monthlyListeners ?? 0);
        const listeners2 = Number(artist2?.monthlyListeners ?? 0);

        if (metric === 'listeners') {
          const winner = listeners1 >= listeners2 ? artist1 : artist2;
          const loser = winner === artist1 ? artist2 : artist1;
          const winnerVal = Math.max(listeners1, listeners2);
          const loserVal = Math.min(listeners1, listeners2);
          return `${winner.name} has more monthly listeners on Spotify with ${this.num(winnerVal)}, compared to ${loser.name}'s ${this.num(loserVal)}.`;
        }

        if (metric === 'streams') {
          const winner = streams1 >= streams2 ? artist1 : artist2;
          const loser = winner === artist1 ? artist2 : artist1;
          const winnerVal = Math.max(streams1, streams2);
          const loserVal = Math.min(streams1, streams2);
          return `${winner.name} has more Spotify streams with ${this.num(winnerVal)}, compared to ${loser.name}'s ${this.num(loserVal)}.`;
        }

        // General — show both stats
        return `${artist1.name} has ${this.num(streams1)} Spotify streams and ${this.num(listeners1)} monthly listeners, compared to ${artist2.name}'s ${this.num(streams2)} streams and ${this.num(listeners2)} monthly listeners.`;
      }

      // ── Afrobeats UK summary ──────────────────────────────────────────────
      case 'afrobeats_uk_summary': {
        const topNames = (data.topArtists ?? [])
          .slice(0, 5)
          .map((a: any) => a.artistName as string)
          .join(', ');
        return `Afrobeats has a strong UK presence — ${this.num(data.uniqueArtists)} artists have appeared on the official UK Afrobeats chart across ${this.num(data.weeksTracked)} weeks, with ${this.num(data.weeksAtNumber1)} weeks producing a #1. Top artists include ${topNames}.`;
      }

      case 'african_billboard_number1': {
        const rows: any[] = data ?? [];
        if (!rows.length) {
          return `Based on our data, no African artist has topped the Billboard Hot 100 yet.`;
        }
        const names = rows.map((r: any) => r.artistName as string).join(', ');
        return `Yes — ${names} ${rows.length === 1 ? 'has' : 'have'} topped the Billboard Hot 100.`;
      }

      default:
        return null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private num(value: any): string {
    return Number(value).toLocaleString('en-GB');
  }

  private friendlyMilestone(n: number): string {
    if (n >= 1_000_000_000) return `${n / 1_000_000_000}B`;
    if (n >= 1_000_000) return `${n / 1_000_000}M`;
    return n.toLocaleString();
  }

  private chartLabel(chartName: string): string {
    const labels: Record<string, string> = {
      official_afrobeats_chart: 'UK Afrobeats Chart',
      uk_official_singles: 'UK Official Singles Chart',
      billboard_hot_100: 'Billboard Hot 100',
      tooxclusive_top_100: 'TooXclusive Top 100',
      tooxclusive_east_africa_top_50: 'East Africa Top 50',
      spotify_daily_ng: 'Spotify Nigeria Chart',
      spotify_daily_za: 'Spotify South Africa Chart',
      spotify_daily_gb: 'Spotify UK Chart',
      spotify_daily_global: 'Spotify Global Chart',
      apple_daily_ng: 'Apple Music Nigeria Chart',
      apple_daily_gh: 'Apple Music Ghana Chart',
      apple_daily_ke: 'Apple Music Kenya Chart',
      apple_daily_za: 'Apple Music South Africa Chart',
      apple_daily_ug: 'Apple Music Uganda Chart',
    };
    return labels[chartName] ?? chartName.replace(/_/g, ' ');
  }

  private leaderboardLabel(meta: ResolvedData['meta']): string {
    if (meta.isAfrobeats) return 'African artists';
    if (meta.country) {
      const countryNames: Record<string, string> = {
        NG: 'Nigerian',
        GH: 'Ghanaian',
        ZA: 'South African',
        KE: 'Kenyan',
        UG: 'Ugandan',
        GB: 'UK',
        US: 'US',
        GLOBAL: 'global',
      };
      const adj = countryNames[meta.country] ?? meta.country;
      return `${adj} artists`;
    }
    return 'artists';
  }
}
