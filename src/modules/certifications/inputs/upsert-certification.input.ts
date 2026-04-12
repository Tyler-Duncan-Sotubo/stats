export interface UpsertCertificationInput {
  artistId?: string | null;
  songId?: string | null;
  albumId?: string | null;
  territory: string;
  body: string;
  title?: string | null;
  level: string;
  units?: number | null;
  certifiedAt?: string | null;
  sourceUrl?: string | null;
}
