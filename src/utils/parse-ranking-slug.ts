export function parseRankingSlug(slug: string) {
  // limit is always followed by a dash then a non-digit
  const match = slug.match(
    /^top-(\d+)-(.+)-songs-by-(streams|listeners|plays)$/,
  );
  if (!match) return null;

  const limit = parseInt(match[1]);
  if (limit < 1 || limit > 100) return null;

  return {
    limit,
    artistSlug: match[2], // everything between limit and -songs-by-
    metric: match[3], // only allow known metrics
  };
}
