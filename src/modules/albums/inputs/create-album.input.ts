export interface CreateAlbumInput {
  artistId: string;
  title: string;
  slug: string;
  spotifyAlbumId: string;
  albumType?: string;
  releaseDate?: string;
  imageUrl?: string;
  totalTracks?: number;
  isAfrobeats?: boolean;
}
