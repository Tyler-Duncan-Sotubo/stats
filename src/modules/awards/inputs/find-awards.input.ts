export interface FindAwardsInput {
  artistId?: string;
  awardBody?: string;
  category?: string;
  result?: string;
  territory?: string;
  year?: number;
  page: number;
  limit: number;
}
