export interface CreateSongInput {
  artistId: string;
  title: string;
  normalizedTitle: string;
  canonicalTitle: string;
  slug: string;
  albumId?: string;
  spotifyTrackId?: string;
  releaseDate?: string;
  durationMs?: number;
  explicit?: boolean;
  isAfrobeats?: boolean;
  imageUrl?: string;
  entityStatus?: string;
  sourceOfTruth?: string;
}
