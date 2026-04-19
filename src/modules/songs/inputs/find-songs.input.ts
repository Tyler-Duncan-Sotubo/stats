export interface FindSongsInput {
  search?: string;
  artistId?: string;
  isAfrobeats?: boolean;
  entityStatus?: string;
  needsReview?: boolean;
  explicit?: boolean;
  page: number;
  limit: number;
}
