export interface FindAlbumsInput {
  artistId?: string;
  search?: string;
  albumType?: string;
  isAfrobeats?: boolean;
  page: number;
  limit: number;
}
