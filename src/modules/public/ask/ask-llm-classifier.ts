import OpenAI from 'openai';

export interface LLMClassified {
  // mirrors what ask.service.ts previously got from classifyQuestion + extractEntities
  category: AskCategory;
  normalized: string;
  raw: string;

  // entities (mirrors ExtractedEntities)
  artistSlug: string | null;
  artistSlug2: string | null;
  songTitle: string | null;
  chartName: string | null;
  chartTerritory: string | null;
  country: string | null;
  isAfrobeats: boolean;
  limit: number;
  milestone: number | null;
}

export type AskCategory =
  | 'artist_streams'
  | 'artist_monthly_listeners'
  | 'artist_daily_streams'
  | 'artist_peak_listeners'
  | 'artist_grammy_wins'
  | 'artist_grammy_nominations'
  | 'artist_awards'
  | 'artist_chart_history'
  | 'artist_milestone' // "has wizkid hit 10 billion streams"
  | 'artist_profile' // "tell me about wizkid" / just "wizkid"
  | 'artist_top_songs'
  | 'artist_biggest_song'
  | 'artist_global_rank'
  | 'song_streams'
  | 'song_who_sang'
  | 'chart_number_1'
  | 'chart_top_5'
  | 'chart_list'
  | 'leaderboard_streams'
  | 'leaderboard_listeners'
  | 'leaderboard_songs'
  | 'leaderboard_trending_artists'
  | 'leaderboard_trending_songs'
  | 'comparison'
  | 'afrobeats_uk_summary'
  | 'african_billboard_number1'
  | 'unclassified';

export interface ClassifiedQuestion {
  category: AskCategory;
  raw: string;
  normalized: string;
}

// ── Category descriptions passed to the LLM ──────────────────────────────────
// Descriptions give the LLM enough context to pick correctly without
// being so long that they eat tokens on every call.

const CATEGORY_DESCRIPTIONS = `
artist_streams          — total Spotify stream count for a specific artist
artist_monthly_listeners — monthly listener count for a specific artist
artist_daily_streams    — daily stream count for a specific artist
artist_peak_listeners   — peak monthly listeners for a specific artist
artist_grammy_wins      — how many Grammys an artist has won
artist_grammy_nominations — how many Grammy nominations an artist has
artist_awards           — total award wins for an artist
artist_chart_history    — an artist's chart performance history
artist_milestone        — has an artist hit X billion/million streams
artist_profile          — general stats overview for a named artist
artist_top_songs        — top N most streamed songs by an artist
artist_biggest_song     — the single most streamed song by an artist
artist_global_rank      — an artist's global Spotify rank by listeners
song_streams            — stream count for a specific song
song_who_sang           — which artist made/sang a specific song
chart_number_1          — what is currently #1 on a specific chart
chart_top_5             — top 3-5 entries on a specific chart
chart_list              — full chart listing for a territory/platform
leaderboard_streams     — most streamed artists overall or by country
leaderboard_listeners   — artists ranked by monthly listeners
leaderboard_songs       — most streamed songs overall or by genre
leaderboard_trending_artists — fastest growing artists right now
leaderboard_trending_songs   — fastest growing songs right now
comparison              — comparing two artists against each other
afrobeats_uk_summary    — overview of Afrobeats presence in the UK
african_billboard_number1 — has an African artist topped Billboard Hot 100
unclassified            — cannot be answered with available music stats data
`.trim();

// ── Chart name map — LLM returns a key, we resolve to chartName + territory ──

const CHART_KEYS: Record<string, { chartName: string; territory: string }> = {
  spotify_ng: { chartName: 'spotify_daily_ng', territory: 'NG' },
  spotify_gh: { chartName: 'spotify_daily_gh', territory: 'GH' },
  spotify_ke: { chartName: 'spotify_daily_ke', territory: 'KE' },
  spotify_za: { chartName: 'spotify_daily_za', territory: 'ZA' },
  spotify_ug: { chartName: 'spotify_daily_ug', territory: 'UG' },
  spotify_gb: { chartName: 'spotify_daily_gb', territory: 'GB' },
  spotify_global: { chartName: 'spotify_daily_global', territory: 'GLOBAL' },
  apple_ng: { chartName: 'apple_daily_ng', territory: 'NG' },
  apple_gh: { chartName: 'apple_daily_gh', territory: 'GH' },
  apple_ke: { chartName: 'apple_daily_ke', territory: 'KE' },
  apple_za: { chartName: 'apple_daily_za', territory: 'ZA' },
  apple_ug: { chartName: 'apple_daily_ug', territory: 'UG' },
  afrobeats_uk: { chartName: 'official_afrobeats_chart', territory: 'UK' },
  uk_singles: { chartName: 'uk_official_singles', territory: 'UK' },
  billboard_hot_100: { chartName: 'billboard_hot_100', territory: 'US' },
  tooxclusive_ng: { chartName: 'tooxclusive_top_100', territory: 'NG' },
  tooxclusive_ea: {
    chartName: 'tooxclusive_east_africa_top_50',
    territory: 'EAST_AFRICA',
  },
};

// ── Country code map ──────────────────────────────────────────────────────────

const COUNTRY_CODES: Record<string, string> = {
  nigeria: 'NG',
  ghana: 'GH',
  'south africa': 'ZA',
  kenya: 'KE',
  uganda: 'UG',
  tanzania: 'TZ',
  rwanda: 'RW',
  ethiopia: 'ET',
  uk: 'GB',
  'united kingdom': 'GB',
  us: 'US',
  'united states': 'US',
  global: 'GLOBAL',
  worldwide: 'GLOBAL',
  'east africa': 'EAST_AFRICA',
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a music stats query classifier for TooXclusive Stats, a platform tracking
Spotify streams, chart positions, and awards for African and global artists.

Your job: given a user question, return a single JSON object — no markdown, no explanation.

JSON shape:
{
  "category": "<one of the categories below>",
  "artistName": "<canonical artist name or null>",
  "artistName2": "<second artist name for comparisons or null>",
  "songTitle": "<song title or null>",
  "chartKey": "<chart key from the list below or null>",
  "country": "<country name lowercase or null>",
  "isAfrobeats": <true|false>,
  "limit": <integer 1-20, default 10>,
  "milestionBillions": <number or null — e.g. 10 for "10 billion streams">
}

Categories:
${CATEGORY_DESCRIPTIONS}

Chart keys (use exactly these strings):
${Object.keys(CHART_KEYS).join(', ')}

Known artists that may look ambiguous (always treat as artist names):
50 Cent, 21 Savage, 6lack, Summer Walker, Tems, Rema, Burna Boy, Wizkid, 
Davido, Asake, Ayra Starr, Blaqbonez, Odumodublvck, Shallipopi, Seyi Vibez

Rules:
- artistName must be the real artist name, correctly spelled, even if the user misspelled it
  e.g. "jcole" → "J. Cole", "ayra star" → "Ayra Starr", "burna" → "Burna Boy"
- A bare artist name with no question words (e.g. "wizkid", "50 cent", "burna boy", "rema") 
  must always return artist_profile — never unclassified
- Short inputs of 1-4 words that are clearly an artist name default to artist_profile
- For leaderboard/chart/trending categories, artistName is null unless a specific artist is named
- isAfrobeats is true when the question is specifically about African/Afrobeats artists or music
- country is the country mentioned (lowercase, e.g. "nigeria", "uk"), or null
- limit defaults to 10 unless the user says "top 5", "top 3" etc
- milestionBillions is the number before "billion" if asking about a stream milestone, else null
- If the question is not about music stats (e.g. download links, lyrics, general chat), use "unclassified"
- Return ONLY the JSON object. No prose, no markdown fences.
`.trim();

// ── Name → slug helper ────────────────────────────────────────────────────────
// The LLM returns a real name; we convert to slug for DB lookups.
// Fuzzy matching against the DB happens in the resolver if this slug misses.

function nameToSlug(name: string | null): string | null {
  if (!name) return null;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Raw LLM response shape ────────────────────────────────────────────────────

interface RawLLMResponse {
  category?: string;
  artistName?: string | null;
  artistName2?: string | null;
  songTitle?: string | null;
  chartKey?: string | null;
  country?: string | null;
  isAfrobeats?: boolean;
  limit?: number;
  milestionBillions?: number | null;
}

// ── Main classifier ───────────────────────────────────────────────────────────

export class AskLLMClassifier {
  constructor(private readonly openai: OpenAI) {}

  async classify(question: string): Promise<LLMClassified> {
    const normalized = normalize(question);
    const fallback = this.fallbackResult(question, normalized);

    let raw: RawLLMResponse;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        temperature: 0, // deterministic — classification only
        response_format: { type: 'json_object' }, // enforces valid JSON always
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question },
        ],
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      raw = JSON.parse(content) as RawLLMResponse;
    } catch (err) {
      // JSON parse failure or API error — return unclassified, never throw
      console.error('[AskLLMClassifier] failed:', (err as Error).message);
      return fallback;
    }

    // ── Validate category ───────────────────────────────────────────────────
    const category = this.resolveCategory(raw.category);

    // ── Resolve chart ───────────────────────────────────────────────────────
    const chart = raw.chartKey ? (CHART_KEYS[raw.chartKey] ?? null) : null;

    // ── Resolve country ─────────────────────────────────────────────────────
    const countryRaw = (raw.country ?? '').toLowerCase().trim();
    const country = COUNTRY_CODES[countryRaw] ?? null;

    // ── Resolve milestone ───────────────────────────────────────────────────
    const milestone = raw.milestionBillions
      ? raw.milestionBillions * 1_000_000_000
      : null;

    // ── Resolve limit ───────────────────────────────────────────────────────
    const limit =
      typeof raw.limit === 'number' ? Math.min(Math.max(raw.limit, 1), 20) : 10;

    return {
      category,
      normalized,
      raw: question,
      artistSlug: nameToSlug(raw.artistName ?? null),
      artistSlug2: nameToSlug(raw.artistName2 ?? null),
      songTitle: raw.songTitle ?? null,
      chartName: chart?.chartName ?? null,
      chartTerritory: chart?.territory ?? null,
      country,
      isAfrobeats: raw.isAfrobeats === true,
      limit,
      milestone,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private resolveCategory(raw: string | undefined): AskCategory {
    const VALID_CATEGORIES: AskCategory[] = [
      'artist_streams',
      'artist_monthly_listeners',
      'artist_daily_streams',
      'artist_peak_listeners',
      'artist_grammy_wins',
      'artist_grammy_nominations',
      'artist_awards',
      'artist_chart_history',
      'artist_milestone',
      'artist_profile',
      'artist_top_songs',
      'artist_biggest_song',
      'artist_global_rank',
      'song_streams',
      'song_who_sang',
      'chart_number_1',
      'chart_top_5',
      'chart_list',
      'leaderboard_streams',
      'leaderboard_listeners',
      'leaderboard_songs',
      'leaderboard_trending_artists',
      'leaderboard_trending_songs',
      'comparison',
      'afrobeats_uk_summary',
      'african_billboard_number1',
      'unclassified',
    ];

    if (raw && VALID_CATEGORIES.includes(raw as AskCategory)) {
      return raw as AskCategory;
    }
    return 'unclassified';
  }

  private fallbackResult(question: string, normalized: string): LLMClassified {
    return {
      category: 'unclassified',
      normalized,
      raw: question,
      artistSlug: null,
      artistSlug2: null,
      songTitle: null,
      chartName: null,
      chartTerritory: null,
      country: null,
      isAfrobeats: false,
      limit: 10,
      milestone: null,
    };
  }
}
