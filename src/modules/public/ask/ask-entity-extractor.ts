// ask-entity-extractor.ts

import { normalize } from './ask-classifier';

export interface ExtractedEntities {
  artistSlug: string | null;
  artistSlug2: string | null; // for comparisons
  songTitle: string | null;
  chartName: string | null;
  chartTerritory: string | null;
  country: string | null;
  isAfrobeats: boolean;
  limit: number;
  milestone: number | null; // for "has X hit 10 billion streams"
}

// ── Country mapping ───────────────────────────────────────────────────────────

const COUNTRY_MAP: Record<string, string> = {
  nigeria: 'NG',
  nigerian: 'NG',
  ghana: 'GH',
  ghanaian: 'GH',
  'south africa': 'ZA',
  'south african': 'ZA',
  kenya: 'KE',
  kenyan: 'KE',
  uganda: 'UG',
  ugandan: 'UG',
  tanzania: 'TZ',
  tanzanian: 'TZ',
  rwanda: 'RW',
  rwandan: 'RW',
  ethiopia: 'ET',
  ethiopian: 'ET',
  uk: 'GB',
  british: 'GB',
  'united kingdom': 'GB',
  us: 'US',
  american: 'US',
  'united states': 'US',
  global: 'GLOBAL',
  worldwide: 'GLOBAL',
  'east africa': 'EAST_AFRICA',
  'east african': 'EAST_AFRICA',
};

// ── Chart mapping ─────────────────────────────────────────────────────────────

const CHART_MAP: Array<{
  patterns: RegExp;
  chartName: string;
  territory: string;
}> = [
  {
    patterns: /spotify.+nigeria|nigerian.+spotify|spotify.+ng\b/,
    chartName: 'spotify_daily_ng',
    territory: 'NG',
  },
  {
    patterns: /spotify.+south africa|south africa.+spotify|spotify.+za\b/,
    chartName: 'spotify_daily_za',
    territory: 'ZA',
  },
  {
    patterns: /spotify.+uk|uk.+spotify|spotify.+gb\b/,
    chartName: 'spotify_daily_gb',
    territory: 'GB',
  },
  {
    patterns: /spotify.+global|global.+spotify/,
    chartName: 'spotify_daily_global',
    territory: 'GLOBAL',
  },
  {
    patterns: /apple.+music.+nigeria|apple.+ng\b/,
    chartName: 'apple_daily_ng',
    territory: 'NG',
  },
  {
    patterns: /apple.+music.+ghana|apple.+gh\b/,
    chartName: 'apple_daily_gh',
    territory: 'GH',
  },
  {
    patterns: /apple.+music.+kenya|apple.+ke\b/,
    chartName: 'apple_daily_ke',
    territory: 'KE',
  },
  {
    patterns: /apple.+music.+south africa|apple.+za\b/,
    chartName: 'apple_daily_za',
    territory: 'ZA',
  },
  {
    patterns: /apple.+music.+uganda|apple.+ug\b/,
    chartName: 'apple_daily_ug',
    territory: 'UG',
  },
  {
    patterns: /uk\s+afrobeats|afrobeats\s+chart|official\s+afrobeats/,
    chartName: 'official_afrobeats_chart',
    territory: 'UK',
  },
  {
    patterns: /uk\s+(official\s+)?singles|uk\s+chart(?!s)/,
    chartName: 'uk_official_singles',
    territory: 'UK',
  },
  {
    patterns: /billboard(\s+hot\s+100)?|hot\s+100/,
    chartName: 'billboard_hot_100',
    territory: 'US',
  },
  {
    patterns: /tooxclusive\s+top\s+100|nigeria\s+top\s+100|tooxclusive\s+chart/,
    chartName: 'tooxclusive_top_100',
    territory: 'NG',
  },
  {
    patterns: /east\s+africa\s+top\s+50|east\s+african\s+chart/,
    chartName: 'tooxclusive_east_africa_top_50',
    territory: 'EAST_AFRICA',
  },
];

// ── Artist name stop words ────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'how',
  'many',
  'streams',
  'does',
  'have',
  'has',
  'did',
  'what',
  'is',
  'are',
  'who',
  'where',
  'when',
  'which',
  'the',
  'a',
  'an',
  'on',
  'in',
  'at',
  'to',
  'for',
  'of',
  'and',
  'or',
  'but',
  'with',
  'by',
  'from',
  'total',
  'monthly',
  'daily',
  'spotify',
  'streams',
  'listeners',
  'stream',
  'listener',
  'grammy',
  'grammys',
  'nominations',
  'nomination',
  'wins',
  'won',
  'win',
  'award',
  'awards',
  'songs',
  'song',
  'biggest',
  'top',
  'most',
  'streamed',
  'popular',
  'globally',
  'global',
  'rank',
  'ranked',
  'ranking',
  'chart',
  'charts',
  'history',
  'uk',
  'number',
  'hit',
  'billion',
  'million',
  'tell',
  'me',
  'about',
  'give',
  'latest',
  'numbers',
  'info',
  'stats',
  'right',
  'now',
  'today',
  'ever',
  'all',
  'time',
  'been',
  'reach',
  'reached',
  'position',
  'peak',
  'currently',
  'get',
  'your',
  'their',
  'his',
  'her',
  'its',
  'our',
  'my',
  'your',
  'sang',
  'sings',
  'made',
  'performed',
  'listen',
  'artists',
  'artist',
  'nigerian',
  'african',
  'afrobeats',
  'ghanaian',
  'kenyan',
  'south',
  'african',
  'biggest',
]);

// ── Known artist slugs ────────────────────────────────────────────────────────
// Used to help disambiguate "[artist] streams" vs "[song] streams"

const KNOWN_ARTIST_NAMES: Record<string, string> = {
  wizkid: 'wizkid',
  'burna boy': 'burna-boy',
  burnaboy: 'burna-boy',
  burna: 'burna-boy',
  rema: 'rema',
  tems: 'tems',
  davido: 'davido',
  asake: 'asake',
  'ayra starr': 'ayra-starr',
  'omah lay': 'omah-lay',
  ckay: 'ckay',
  'fireboy dml': 'fireboy-dml',
  fireboy: 'fireboy-dml',
  'kizz daniel': 'kizz-daniel',
  'seyi vibez': 'seyi-vibez',
  odumodublvck: 'odumodublvck',
  oxlade: 'oxlade',
  'black sherif': 'black-sherif',
  amaarae: 'amaarae',
  sarkodie: 'sarkodie',
  tyla: 'tyla',
  'diamond platnumz': 'diamond-platnumz',
  'sauti sol': 'sauti-sol',
  drake: 'drake',
  'taylor swift': 'taylor-swift',
  'bad bunny': 'bad-bunny',
  'the weeknd': 'the-weeknd',
  weeknd: 'the-weeknd',
  'justin bieber': 'justin-bieber',
  bieber: 'justin-bieber',
  'ariana grande': 'ariana-grande',
  'travis scott': 'travis-scott',
  'ed sheeran': 'ed-sheeran',
  eminem: 'eminem',
  'kanye west': 'kanye-west',
  kanye: 'kanye-west',
  'billie eilish': 'billie-eilish',
  'post malone': 'post-malone',
  'dua lipa': 'dua-lipa',
  'sabrina carpenter': 'sabrina-carpenter',
  'olivia rodrigo': 'olivia-rodrigo',
  sza: 'sza',
  'nicki minaj': 'nicki-minaj',
  'chris brown': 'chris-brown',
  rihanna: 'rihanna',
  beyonce: 'beyonce',
  beyoncé: 'beyonce',
  'lady gaga': 'lady-gaga',
  coldplay: 'coldplay',
  'bruno mars': 'bruno-mars',
  'kendrick lamar': 'kendrick-lamar',
  kendrick: 'kendrick-lamar',
  'j cole': 'j-cole',
  'j. cole': 'j-cole',
  'jay z': 'jay-z',
  jayz: 'jay-z',
  'jay-z': 'jay-z',
  'lana del rey': 'lana-del-rey',
  shakira: 'shakira',
  'doja cat': 'doja-cat',
  'miley cyrus': 'miley-cyrus',
  'zara larsson': 'zara-larsson',
  shallipopi: 'shallipopi',
  pheelz: 'pheelz',
  olamide: 'olamide',
  ruger: 'ruger',
  bnxn: 'bnxn',
  'johnny drille': 'johnny-drille',
  mavo: 'mavo',
  adele: 'adele',
  'harry styles': 'harry-styles',
  'sam smith': 'sam-smith',
  'calvin harris': 'calvin-harris',
  tayc: 'tayc',
  'sofiya nzau': 'sofiya-nzau',
  '21 savage': '21-savage',
  gunna: 'gunna',
  'tyler the creator': 'tyler-the-creator',
  'tyler, the creator': 'tyler-the-creator',
  'lil baby': 'lil-baby',
  '50 cent': '50-cent',
  paramore: 'paramore',
  'benson boone': 'benson-boone',
  vaultboy: 'vaultboy',
  fridayy: 'fridayy',
  // Add to KNOWN_ARTIST_NAMES
  'bella shmurda': 'bella-shmurda',
  'bella smurda': 'bella-shmurda',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractArtistSlug(n: string): string | null {
  // 1. Try known artist names first (longest match wins)
  const sorted = Object.keys(KNOWN_ARTIST_NAMES).sort(
    (a, b) => b.length - a.length,
  );
  for (const name of sorted) {
    if (n.includes(name)) {
      return KNOWN_ARTIST_NAMES[name];
    }
  }

  // 2. Strip known question phrases and extract remaining words
  const stripped = n
    .replace(
      /how many (streams|monthly listeners|daily streams|grammy nominations?|grammys?|awards?) (does|has|did|have)/g,
      '',
    )
    .replace(
      /\b(tell me about|give me|latest numbers? for|who is|where does|what is|has|have|hit|won?|win|a grammy|grammy|billion|million|streams?|monthly listeners?|daily streams?|total|rank|globally|on spotify|in the uk|chart history|been number 1|topped|reached)\b/g,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();

  const words = stripped
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  if (!words.length) return null;

  // Try multi-word combinations first
  for (let len = Math.min(words.length, 3); len >= 1; len--) {
    const candidate = words.slice(0, len).join(' ');
    if (KNOWN_ARTIST_NAMES[candidate]) {
      return KNOWN_ARTIST_NAMES[candidate];
    }
  }

  // Fall back to slug from remaining words
  return words.length > 0 ? toSlug(words.join(' ')) : null;
}

function extractBothSlugs(n: string): {
  artist1: string | null;
  artist2: string | null;
} {
  // "wizkid vs burna boy", "wizkid versus burna boy"
  const vsMatch = n.match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\?)?$/);
  if (vsMatch) {
    return {
      artist1: extractArtistSlug(vsMatch[1].trim()),
      artist2: extractArtistSlug(vsMatch[2].trim()),
    };
  }

  // "compare wizkid and davido"
  const compareMatch = n.match(/compare\s+(.+?)\s+and\s+(.+?)(?:\?)?$/);
  if (compareMatch) {
    return {
      artist1: extractArtistSlug(compareMatch[1].trim()),
      artist2: extractArtistSlug(compareMatch[2].trim()),
    };
  }

  // "is wizkid bigger than davido"
  const biggerMatch = n.match(/is\s+(.+?)\s+bigger\s+than\s+(.+?)(?:\?)?$/);
  if (biggerMatch) {
    return {
      artist1: extractArtistSlug(biggerMatch[1].trim()),
      artist2: extractArtistSlug(biggerMatch[2].trim()),
    };
  }

  // "who has more streams wizkid or davido"
  const moreMatch = n.match(
    /(?:who has more .+?)\s+(\w[\w\s-]+?)\s+or\s+(\w[\w\s-]+?)(?:\?)?$/,
  );
  if (moreMatch) {
    return {
      artist1: extractArtistSlug(moreMatch[1].trim()),
      artist2: extractArtistSlug(moreMatch[2].trim()),
    };
  }

  // "rihanna or beyonce" style
  const orMatch = n.match(/^(\w[\w\s-]+?)\s+or\s+(\w[\w\s-]+?)(?:\?)?$/);
  if (orMatch) {
    return {
      artist1: extractArtistSlug(orMatch[1].trim()),
      artist2: extractArtistSlug(orMatch[2].trim()),
    };
  }

  // "rihanna or beyonce who has more streams"
  const orLeadMatch = n.match(/^(\w[\w\s-]+?)\s+or\s+(\w[\w\s-]+?)\s+who/);
  if (orLeadMatch) {
    return {
      artist1: extractArtistSlug(orLeadMatch[1].trim()),
      artist2: extractArtistSlug(orLeadMatch[2].trim()),
    };
  }

  return { artist1: null, artist2: null };
}

function extractSongTitle(n: string): string | null {
  // "how many streams does [song] have"
  const doesHaveMatch = n.match(/how many streams does (.+?) have/);
  if (doesHaveMatch) return doesHaveMatch[1].trim();

  // "how many streams does [song] by [artist] have"
  const byMatch = n.match(/how many streams does (.+?) by .+ have/);
  if (byMatch) return byMatch[1].trim();

  // "streams for [song]"
  const forMatch = n.match(/streams? for (.+?)(?:\?)?$/);
  if (forMatch) return forMatch[1].trim();

  // "who sang [song]" / "who made [song]"
  const whoMatch = n.match(
    /who (?:sang|sings?|made|performed|recorded|is) (?:the song )?(.+?)(?:\?)?$/,
  );
  if (whoMatch) return whoMatch[1].trim();

  // "how many streams does [song] have" — no by
  const streamsDoes = n.match(/how many streams (does|has|did) (.+?) have/);
  if (streamsDoes) return streamsDoes[2].trim();

  // "[song] by [artist] streams" / "[song] [artist] streams"
  const byArtistMatch = n.match(/^(.+?)\s+by\s+\w[\w\s-]+?\s+streams?$/);
  if (byArtistMatch) return byArtistMatch[1].trim();

  // "[song] streams" where song contains multiple words
  const simpleStreams = n.match(/^(.+?)\s+streams?$/);
  if (simpleStreams && simpleStreams[1].split(' ').length > 1) {
    return simpleStreams[1].trim();
  }

  return null;
}

function extractCountry(n: string): string | null {
  // Try multi-word countries first
  const sorted = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (n.includes(key)) return COUNTRY_MAP[key];
  }
  return null;
}

function extractChart(
  n: string,
): { chartName: string; territory: string } | null {
  for (const entry of CHART_MAP) {
    if (entry.patterns.test(n)) {
      return { chartName: entry.chartName, territory: entry.territory };
    }
  }
  return null;
}

function extractLimit(n: string): number {
  const match =
    n.match(/top\s+(\d+)/i) ||
    n.match(/(\d+)\s+artists?/i) ||
    n.match(/(\d+)\s+songs?/i);
  if (match) return Math.min(parseInt(match[1]), 20);
  return 10;
}

function extractMilestone(n: string): number | null {
  // "has wizkid hit 10 billion streams"
  const billionMatch = n.match(/(\d+(?:\.\d+)?)\s*billion/);
  if (billionMatch) return parseFloat(billionMatch[1]) * 1_000_000_000;

  const millionMatch = n.match(/(\d+(?:\.\d+)?)\s*million/);
  if (millionMatch) return parseFloat(millionMatch[1]) * 1_000_000;

  return null;
}

function extractIsAfrobeats(n: string): boolean {
  return (
    n.includes('afrobeats') ||
    n.includes('african artist') ||
    n.includes('african artists') ||
    n.includes('african music') ||
    n.includes('african song') ||
    n.includes('king of afrobeats') || // ← add
    n.includes('queen of afrobeats') || // ← add
    n.includes('nigerian song') || // ← add for song leaderboard
    n.includes('biggest african') ||
    n.includes('most streamed african')
  );
}

// ── Main extractor ────────────────────────────────────────────────────────────

export function extractEntities(
  question: string,
  category: string,
): ExtractedEntities {
  const n = normalize(question);

  const country = extractCountry(n);
  const isAfrobeats = extractIsAfrobeats(n);
  const limit = extractLimit(n);
  const chart = extractChart(n);
  const milestone = extractMilestone(n);

  let artistSlug: string | null = null;
  let artistSlug2: string | null = null;
  let songTitle: string | null = null;

  if (category === 'comparison') {
    const { artist1, artist2 } = extractBothSlugs(n);
    artistSlug = artist1;
    artistSlug2 = artist2;
  } else if (category === 'song_streams' || category === 'song_who_sang') {
    songTitle = extractSongTitle(n);
    // Also try to extract artist for disambiguation
    if (n.includes(' by ')) {
      const byPart = n.split(' by ')[1];
      if (byPart) artistSlug = extractArtistSlug(byPart);
    }
  } else if (
    category !== 'leaderboard_streams' &&
    category !== 'leaderboard_listeners' &&
    category !== 'leaderboard_songs' &&
    category !== 'leaderboard_trending_artists' &&
    category !== 'leaderboard_trending_songs' &&
    category !== 'chart_number_1' &&
    category !== 'chart_top_5' &&
    category !== 'chart_list' &&
    category !== 'afrobeats_uk_summary'
  ) {
    artistSlug = extractArtistSlug(n);
  }

  return {
    artistSlug,
    artistSlug2,
    songTitle,
    chartName: chart?.chartName ?? null,
    chartTerritory: chart?.territory ?? null,
    country,
    isAfrobeats,
    limit,
    milestone,
  };
}
