export interface CreateArtistInput {
  name: string;
  normalizedName: string;
  slug: string;
  spotifyId?: string;
  originCountry?: string;
  debutYear?: number;
  imageUrl?: string;
  isAfrobeats?: boolean;
  isAfrobeatsOverride?: boolean;
  bio?: string;
  entityStatus?: string;
  sourceOfTruth?: string;
}
