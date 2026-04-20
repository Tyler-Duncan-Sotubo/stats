import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const ASK_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_artist',
      description:
        'Get full profile, stats, streams, chart history and awards for a specific artist. Use when the question is about a specific named artist — their streams, listeners, chart history, awards, Grammy nominations, UK chart history, biggest songs etc.',
      parameters: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description:
              'Artist slug — lowercase, spaces as hyphens. e.g. wizkid, burna-boy, asake, omah-lay, ayra-starr',
          },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_song',
      description:
        'Search for a specific song by title and optional artist name to get its stream count. Use when the question asks about streams for a specific song title like "how many streams does calm down have", "streams for ojuelegba", "how many streams does essence have".',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'Song title to search for e.g. "calm down", "essence", "ojuelegba"',
          },
          artistName: {
            type: 'string',
            description:
              'Optional artist name to disambiguate e.g. "rema", "wizkid", "tems"',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leaderboard_streams',
      description:
        'Get top artists ranked by total Spotify streams. Use for "most streamed", "top artists by streams", "who has the most streams". Do NOT use for specific artist or song questions.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results. Default 10.',
          },
          country: {
            type: 'string',
            description: 'ISO country code e.g. NG, ZA, GH, KE, GB, US',
          },
          isAfrobeats: {
            type: 'boolean',
            description:
              'Filter to Afrobeats/African artists only. Set true for "afrobeats artists" or "african artists".',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leaderboard_listeners',
      description:
        'Get top artists ranked by current Spotify monthly listeners. Use for "most listeners", "most popular right now", "highest monthly listeners".',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results. Default 10.',
          },
          country: {
            type: 'string',
            description: 'ISO country code e.g. NG, ZA, GH, KE',
          },
          isAfrobeats: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leaderboard_songs',
      description:
        'Get top songs ranked by total Spotify streams. Use for "most streamed songs", "top songs overall", "biggest songs on spotify". Do NOT use for specific song title questions — use get_song instead.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results. Default 10.',
          },
          isAfrobeats: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trending_artists',
      description:
        'Get artists trending right now based on stream growth. Use for "trending", "rising", "growing fastest", "who is trending today".',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results. Default 10.',
          },
          country: { type: 'string' },
          isAfrobeats: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trending_songs',
      description:
        'Get songs trending right now based on stream growth. Use for "trending songs", "fastest growing songs", "what songs are blowing up".',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results. Default 10.',
          },
          isAfrobeats: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_chart',
      description:
        'Get current chart entries for a specific chart. Use for chart-specific questions like "UK Afrobeats chart", "Billboard Hot 100", "Nigerian Spotify chart", "what is number 1 on...".',
      parameters: {
        type: 'object',
        properties: {
          chartName: {
            type: 'string',
            enum: [
              'official_afrobeats_chart',
              'uk_official_singles',
              'billboard_hot_100',
              'spotify_daily_ng',
              'spotify_daily_za',
              'spotify_daily_gb',
              'spotify_daily_global',
              'apple_daily_ng',
              'apple_daily_gh',
              'apple_daily_ke',
              'apple_daily_za',
              'apple_daily_ug',
              'tooxclusive_top_100',
              'tooxclusive_east_africa_top_50',
            ],
            description: 'The chart identifier',
          },
          territory: {
            type: 'string',
            description:
              'Chart territory e.g. UK, NG, US, GB, GLOBAL, EAST_AFRICA',
          },
          limit: {
            type: 'number',
            description: 'Number of entries. Default 10.',
          },
        },
        required: ['chartName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_afrobeats_uk_summary',
      description:
        'Get aggregated stats on Afrobeats popularity in the UK based on the official UK Afrobeats chart',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

export const TOOL_ENDPOINT_MAP: Record<string, string> = {
  get_artist: '/api/public/artists/:slug',
  get_song: '/api/public/songs/search',
  get_leaderboard_streams: '/api/public/leaderboard/streams',
  get_leaderboard_listeners: '/api/public/leaderboard/listeners',
  get_leaderboard_songs: '/api/public/leaderboard/songs',
  get_trending_artists: '/api/public/trending/artists',
  get_trending_songs: '/api/public/trending/songs',
  get_chart: '/api/public/charts/:chartName/:territory',
};
