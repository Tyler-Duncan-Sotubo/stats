export interface FindRecordsInput {
  artistId?: string;
  songId?: string;
  recordType?: string;
  scope?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}
