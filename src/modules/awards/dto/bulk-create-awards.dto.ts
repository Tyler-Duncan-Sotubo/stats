export interface AwardBulkRow {
  artistName: string;
  awardBody: string;
  awardName: string;
  category: string;
  result: string;
  year: string | number;
  ceremony?: string;
  territory?: string;
  sourceUrl?: string;
  notes?: string;
}
