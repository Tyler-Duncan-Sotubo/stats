import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

export interface SpotifyArtistMetadata {
  spotifyId: string;
  name: string;
  imageUrl: string | null; // highest resolution image
  followers: number;
  popularity: number; // Spotify's 0-100 score
  genres: string[];
}

export interface SpotifyTrackMetadata {
  spotifyTrackId: string;
  title: string;
  albumName: string;
  albumImageUrl: string | null;
  releaseDate: string; // "2023-03-24"
  durationMs: number;
  explicit: boolean;
}

@Injectable()
export class SpotifyMetadataService {
  private readonly logger = new Logger(SpotifyMetadataService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private config: ConfigService) {}

  // ── Auth ─────────────────────────────────────────────────────────────
  private async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const clientId = this.config.get<string>('SPOTIFY_CLIENT_ID');
    const clientSecret = this.config.get<string>('SPOTIFY_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );

    const { data } = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken;
  }

  private async get<T>(path: string) {
    const token = await this.getAccessToken();

    const response: AxiosResponse<T> = await axios.get(
      `https://api.spotify.com/v1${path}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10_000,
      },
    );

    return response.data as T;
  }

  // ── Artist metadata ───────────────────────────────────────────────────
  async fetchArtistMetadata(spotifyId: string): Promise<SpotifyArtistMetadata> {
    const data = await this.get<any>(`/artists/${spotifyId}`);

    // Images are sorted largest to smallest — take first
    const imageUrl = data.images?.[0]?.url ?? null;

    return {
      spotifyId,
      name: data.name,
      imageUrl,
      followers: data.followers?.total ?? 0,
      popularity: data.popularity ?? 0,
      genres: data.genres ?? [],
    };
  }

  // Batch fetch — Spotify allows up to 50 artist IDs in one request
  async fetchMultipleArtists(
    spotifyIds: string[],
  ): Promise<SpotifyArtistMetadata[]> {
    const results: SpotifyArtistMetadata[] = [];
    const chunks = this.chunk(spotifyIds, 50);

    for (const chunk of chunks) {
      const data = await this.get<any>(`/artists?ids=${chunk.join(',')}`);

      for (const artist of data.artists ?? []) {
        if (!artist) continue;
        results.push({
          spotifyId: artist.id,
          name: artist.name,
          imageUrl: artist.images?.[0]?.url ?? null,
          followers: artist.followers?.total ?? 0,
          popularity: artist.popularity ?? 0,
          genres: artist.genres ?? [],
        });
      }
    }

    return results;
  }

  // ── Track metadata ────────────────────────────────────────────────────
  async fetchTrackMetadata(
    spotifyTrackId: string,
  ): Promise<SpotifyTrackMetadata> {
    const data = await this.get<any>(`/tracks/${spotifyTrackId}`);

    return {
      spotifyTrackId,
      title: data.name,
      albumName: data.album?.name ?? '',
      albumImageUrl: data.album?.images?.[0]?.url ?? null,
      releaseDate: data.album?.release_date ?? '',
      durationMs: data.duration_ms ?? 0,
      explicit: data.explicit ?? false,
    };
  }

  // Batch fetch tracks — up to 50 per request
  async fetchMultipleTracks(
    spotifyTrackIds: string[],
  ): Promise<SpotifyTrackMetadata[]> {
    const results: SpotifyTrackMetadata[] = [];
    const chunks = this.chunk(spotifyTrackIds, 50);

    for (const chunk of chunks) {
      const data = await this.get<any>(`/tracks?ids=${chunk.join(',')}`);

      for (const track of data.tracks ?? []) {
        if (!track) continue;
        results.push({
          spotifyTrackId: track.id,
          title: track.name,
          albumName: track.album?.name ?? '',
          albumImageUrl: track.album?.images?.[0]?.url ?? null,
          releaseDate: track.album?.release_date ?? '',
          durationMs: track.duration_ms ?? 0,
          explicit: track.explicit ?? false,
        });
      }
    }

    return results;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size),
    );
  }
}
