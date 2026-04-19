export interface RecordBulkRow {
  artistName: string;
  recordType: string;
  recordValue: string;
  numericValue?: string | number;
  scope: string;
  isActive?: string | boolean;
  setOn?: string;
  brokenOn?: string;
  notes?: string;
}
