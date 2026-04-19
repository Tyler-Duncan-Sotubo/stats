export interface CreateCertificationInput {
  artistId?: string;
  songId?: string;
  albumId?: string;
  territory: string;
  body: string;
  title: string;
  level: string;
  units?: number;
  certifiedAt?: string;
  sourceUrl?: string;
  rawArtistName?: string;
  rawTitle?: string;
  resolutionStatus?: string;
}
