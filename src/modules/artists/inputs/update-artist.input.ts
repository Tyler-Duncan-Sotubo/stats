export interface UpdateArtistInput {
  name?: string;
  normalizedName?: string;
  slug?: string;
  spotifyId?: string;
  originCountry?: string;
  debutYear?: number;
  imageUrl?: string;
  isAfrobeats?: boolean;
  isAfrobeatsOverride?: boolean;
  bio?: string;
  entityStatus?: string;
  sourceOfTruth?: string;
  needsReview?: boolean;
  mergedIntoArtistId?: string;
}
