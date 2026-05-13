export interface UpdateSongInput {
  title?: string;
  normalizedTitle?: string;
  canonicalTitle?: string;
  slug?: string;
  albumId?: string;
  spotifyTrackId?: string;
  releaseDate?: string;
  durationMs?: number;
  explicit?: boolean;
  isAfrobeats?: boolean;
  imageUrl?: string;
  tooxclusiveUrl?: string;
  entityStatus?: string;
  sourceOfTruth?: string;
  needsReview?: boolean;
  mergedIntoSongId?: string;
}
