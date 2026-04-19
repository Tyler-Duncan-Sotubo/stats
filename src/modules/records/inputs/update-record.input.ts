export interface UpdateRecordInput {
  artistId?: string;
  songId?: string;
  albumId?: string;
  recordType?: string;
  recordValue?: string;
  numericValue?: number;
  scope?: string;
  isActive?: boolean;
  setOn?: string;
  brokenOn?: string;
  notes?: string;
}
