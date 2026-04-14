export type UpsertCertificationInput = {
  artistId?: string | null;
  songId?: string | null;
  albumId?: string | null;
  territory: string;
  body: string;
  title: string;
  level: string;
  units?: number | null;
  certifiedAt?: string | null;
  sourceUrl?: string | null;
  rawArtistName?: string | null;
  rawTitle?: string | null;
  resolutionStatus?: 'matched' | 'artist_only' | 'unresolved';
};
