// src/modules/artists/artist.entity.ts

export interface Artist {
  id: string;
  name: string;
  spotifyId: string;
  slug: string;
  originCountry: string | null;
  debutYear: number | null;
  imageUrl: string | null;
  popularity: number | null;
  isAfrobeats: boolean;
  isAfrobeatsOverride: boolean;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}
