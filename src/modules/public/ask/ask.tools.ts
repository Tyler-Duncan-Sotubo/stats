import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const ASK_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_artist',
      description:
        'Get full profile, stats, streams, chart history and awards for a specific artist by their slug',
      parameters: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Artist slug e.g. wizkid, burna-boy, asake',
          },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leaderboard_streams',
      description:
        'Get top artists ranked by total Spotify streams. Use for questions like "most streamed", "top artists", "who has the most streams"',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description:
              'Number of results to return. Default is 10. Only set lower if the user explicitly asks for a specific number.',
          },
          country: {
            type: 'string',
            description: 'ISO country code e.g. NG, ZA, GH, GB',
          },
          isAfrobeats: {
            type: 'boolean',
            description: 'Filter to Afrobeats artists only',
          },
          page: { type: 'number', description: 'Page number, default 1' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leaderboard_listeners',
      description:
        'Get top artists ranked by current Spotify monthly listeners. Use for "most listeners", "most popular right now"',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results, default 10',
          },
          country: {
            type: 'string',
            description: 'ISO country code e.g. NG, ZA, GH',
          },
          isAfrobeats: { type: 'boolean' },
          page: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leaderboard_songs',
      description: 'Get top songs ranked by total Spotify streams',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results, default 10',
          },
          isAfrobeats: { type: 'boolean' },
          page: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trending_artists',
      description:
        'Get artists trending right now based on listener growth. Use for "trending", "rising", "growing fastest", "on the rise"',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results, default 10',
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
      description: 'Get songs trending right now based on stream growth',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results, default 10',
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
        'Get current chart entries. Use for chart-specific questions like "UK Afrobeats chart", "Billboard Hot 100", "Nigerian Spotify chart"',
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
              'apple_daily_ng',
              'apple_daily_gh',
              'apple_daily_ke',
              'apple_daily_za',
              'apple_daily_ug',
              'tooxclusive_top_100',
              'tooxclusive_east_africa_top_50',
            ],
          },
          limit: {
            type: 'number',
            description: 'Number of entries, default 20',
          },
        },
        required: ['chartName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_artists',
      description:
        'Search or browse artists by name, country or letter. Use when user asks about a specific artist but you need to find their slug first',
      parameters: {
        type: 'object',
        properties: {
          letter: { type: 'string', description: 'First letter to browse by' },
          country: { type: 'string' },
          sortBy: {
            type: 'string',
            enum: ['name', 'totalStreams', 'monthlyListeners'],
          },
          limit: { type: 'number', default: 10 },
        },
      },
    },
  },
];

export const TOOL_ENDPOINT_MAP: Record<string, string> = {
  get_artist: '/api/public/artists/:slug',
  get_leaderboard_streams: '/api/public/leaderboard/streams',
  get_leaderboard_listeners: '/api/public/leaderboard/listeners',
  get_leaderboard_songs: '/api/public/leaderboard/songs',
  get_trending_artists: '/api/public/trending/artists',
  get_trending_songs: '/api/public/trending/songs',
  get_chart: '/api/public/charts/:chartName/:territory',
  search_artists: '/api/public/artists',
};
