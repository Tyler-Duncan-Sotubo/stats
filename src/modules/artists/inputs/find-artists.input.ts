export interface FindArtistsInput {
  search?: string;
  originCountry?: string;
  isAfrobeats?: boolean;
  entityStatus?: string;
  needsReview?: boolean;
  page: number;
  limit: number;
}
