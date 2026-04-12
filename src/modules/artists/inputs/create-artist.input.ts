export interface CreateArtistInput {
  name: string;
  spotifyId: string;
  originCountry?: string;
  debutYear?: number;
  bio?: string;
  isAfrobeats?: boolean;
  isAfrobeatsOverride?: boolean;
}
