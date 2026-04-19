export interface FindCertificationsInput {
  artistId?: string;
  songId?: string;
  territory?: string;
  body?: string;
  level?: string;
  resolutionStatus?: string;
  page: number;
  limit: number;
}
