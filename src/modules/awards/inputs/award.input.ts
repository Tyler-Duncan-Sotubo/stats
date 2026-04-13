export interface AwardInput {
  id: string;
  artistId: string;
  songId: string | null;
  albumId: string | null;
  awardBody: string;
  awardName: string;
  category: string;
  result: 'won' | 'nominated';
  year: number;
  ceremony: string | null;
  territory: string | null;
  sourceUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
