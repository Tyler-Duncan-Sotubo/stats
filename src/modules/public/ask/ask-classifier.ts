// ask-classifier.ts

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

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyQuestion(question: string): ClassifiedQuestion {
  const n = normalize(question);

  // ── Comparison ────────────────────────────────────────────────────────────
  if (
    /\bvs\.?\b/.test(n) ||
    /\bversus\b/.test(n) ||
    /\bcompare\b.+\band\b/.test(n) ||
    /\bis\b.+\bbigger than\b/.test(n) ||
    /\bwho has more (streams|listeners|monthly listeners)\b/.test(n) ||
    /\bwho is (bigger|more popular)\b/.test(n) ||
    /\bcompared to\b/.test(n) ||
    /\b(rihanna|beyonce|wizkid|burna|rema|tems|davido|drake|eminem|jayz|jay z|kendrick|cole)\b.+\bor\b.+\b(rihanna|beyonce|wizkid|burna|rema|tems|davido|drake|eminem|jayz|jay z|kendrick|cole)\b/.test(
      n,
    ) ||
    (/\b\w{3,}\s+or\s+\w{3,}\b/.test(n) &&
      /\b(streams|listeners|bigger|popular)\b/.test(n))
  ) {
    return { category: 'comparison', raw: question, normalized: n };
  }

  // ── Afrobeats UK summary ──────────────────────────────────────────────────
  if (
    /afrobeats.+(popular|scene|presence).+uk/.test(n) ||
    /uk.+afrobeats.+(popular|scene|presence)/.test(n) ||
    /is afrobeats popular in the uk/.test(n) ||
    /afrobeats in the uk/.test(n)
  ) {
    return { category: 'afrobeats_uk_summary', raw: question, normalized: n };
  }

  // ── Grammy wins ───────────────────────────────────────────────────────────
  if (
    /how many grammy(s| awards?)? (does|has|did)\b/.test(n) ||
    /\bgrammys? (wins?|won)\b/.test(n) ||
    /\b(has|did)\b.+\b(won?|win)\b.+\bgrammy\b/.test(n) ||
    /\bwon? a grammy\b/.test(n)
  ) {
    return { category: 'artist_grammy_wins', raw: question, normalized: n };
  }

  // ── Grammy nominations ────────────────────────────────────────────────────
  if (/grammy nominations?\b/.test(n) || /how many grammy noms?\b/.test(n)) {
    return {
      category: 'artist_grammy_nominations',
      raw: question,
      normalized: n,
    };
  }

  // ── Awards (general) ──────────────────────────────────────────────────────
  if (
    /how many awards (does|has|did)\b/.test(n) ||
    /\btotal awards\b/.test(n)
  ) {
    return { category: 'artist_awards', raw: question, normalized: n };
  }

  // ── African Billboard #1 — add BEFORE artist_chart_history ──────────────────
  if (
    /\bhas (a |any )?(african|afrobeats|nigerian|ghanaian|kenyan) artist\b.+\bbillboard\b/.test(
      n,
    ) ||
    /\bwhich (african|afrobeats|nigerian) artist has\b.+\bbillboard\b/.test(
      n,
    ) ||
    /\b(african|afrobeats|nigerian) artist\b.+\b(topped|reached|hit|been) (number 1|#1|no 1)\b.+\bbillboard\b/.test(
      n,
    ) ||
    /\btopped the billboard\b.+\b(african|afrobeats)\b/.test(n) ||
    /\b(african|afrobeats).+\btopped the billboard\b/.test(n) ||
    /\bafrican artist.+billboard\b/.test(n) ||
    /\bbillboard.+african artist\b/.test(n) ||
    /\bnigerian artist.+topped.+billboard\b/.test(n) ||
    /\bnigerian artist.+billboard\b.+\b(number 1|#1|top)\b/.test(n)
  ) {
    return {
      category: 'african_billboard_number1',
      raw: question,
      normalized: n,
    };
  }

  // ── King/Queen of afrobeats — add BEFORE artist_profile ─────────────────────
  if (
    /\b(king|queen) of afrobeats\b/.test(n) ||
    /\bwho is the (king|queen) of afrobeats\b/.test(n)
  ) {
    return { category: 'leaderboard_streams', raw: question, normalized: n };
  }

  // ── Chart history ─────────────────────────────────────────────────────────
  if (
    /\buk chart history\b/.test(n) ||
    /\bchart history\b/.test(n) ||
    /\b(has|have)\b.+\b(been|reached|hit|topped)\b.+\bnumber 1\b.+\buk\b/.test(
      n,
    ) ||
    /\b(has|have)\b.+\b(been|reached|hit)\b.+\b(#1|number one|number 1)\b/.test(
      n,
    ) ||
    /\bwhat charts has\b/.test(n) ||
    /\bwhat charts (has|have|did)\b/.test(n) ||
    /\bappeared on\b.+\bchart\b/.test(n) ||
    /\bcharted on\b/.test(n) ||
    /\bhas any .+ artist topped\b/.test(n) ||
    /\bhas any .+ artist (been|reached|hit) (number 1|#1)\b/.test(n) ||
    /\btopped the billboard\b/.test(n) ||
    /\btopped the uk\b/.test(n)
  ) {
    return { category: 'artist_chart_history', raw: question, normalized: n };
  }

  // ── Artist milestone ──────────────────────────────────────────────────────
  if (
    /\bhas\b.+\bhit\b.+\b(billion|million|b|m)\b.+\bstream/.test(n) ||
    /\bhit\b.+\b\d+\s*(billion|million)\b.+\bstream/.test(n) ||
    /\bover\b.+\b\d+\s*(billion|million)\b.+\bstream/.test(n) ||
    /\bdo(es)?\b.+\bhave over\b.+\bstream/.test(n)
  ) {
    return { category: 'artist_milestone', raw: question, normalized: n };
  }

  // ── Artist global rank ────────────────────────────────────────────────────
  if (
    /\bglobal rank\b/.test(n) ||
    /\brank globally\b/.test(n) ||
    /\bwhere does\b.+\rank\b/.test(n) ||
    /\bwhat (is|position)\b.+\bglobal rank\b/.test(n) ||
    /\bin the top \d+ (most listened|artists)\b/.test(n)
  ) {
    return { category: 'artist_global_rank', raw: question, normalized: n };
  }

  // ── Artist top songs ──────────────────────────────────────────────────────
  if (
    /\btop \d+ songs? (from|by|of)\b/.test(n) ||
    /\btop songs? (from|by|of)\b/.test(n) ||
    /\bbiggest songs? (from|by|of)\b/.test(n) ||
    /\bmost streamed songs? (from|by|of)\b/.test(n) ||
    /\bgive me \d+ .+ songs?\b/.test(n) ||
    /\bgive me top \d+ songs? from\b/.test(n) ||
    (/\b\w+\s+songs?\b$/.test(n) && !/\b(chart|stream|listen)\b/.test(n))
  ) {
    return { category: 'artist_top_songs', raw: question, normalized: n };
  }

  // ── Artist biggest song ───────────────────────────────────────────────────
  if (
    /\b(biggest|most streamed|top|best)\s+song\b/.test(n) &&
    !/\bever\b/.test(n) &&
    !/\bglobally\b/.test(n) &&
    !/\boverall\b/.test(n)
  ) {
    return { category: 'artist_biggest_song', raw: question, normalized: n };
  }

  // ── Song who sang ─────────────────────────────────────────────────────────
  if (
    /\bwho (sang|sings?|made|performed|did|recorded)\b/.test(n) ||
    /\bwho is\b.+\bby\b/.test(n) ||
    /\bby who\b/.test(n) ||
    /\bwho is .+ by\b/.test(n)
  ) {
    return { category: 'song_who_sang', raw: question, normalized: n };
  }

  // ── Song streams ──────────────────────────────────────────────────────────
  // ── Song streams — add artist+song patterns BEFORE artist_streams ─────────────
  if (
    (/\bhow many streams does\b/.test(n) && !/\bhave\b/.test(n)) ||
    /\bstreams? for\b/.test(n) ||
    /\bhow many streams (has|did)\b/.test(n) ||
    (/\b\w+\s+streams?\b$/.test(n) && /\bby\b/.test(n)) ||
    // song + artist patterns — these must come before artist_streams
    /\bhow many streams does .+ have .+/.test(n) ||
    /\b(last last|free mind|calm down|rush|blinding lights|essence|ojuelegba|ye|jogodo|water|outside|on the ground|laho|organise|unfortunate)\b.+\bstreams?\b/.test(
      n,
    ) ||
    /\bstreams?.+\b(burna boy|wizkid|tems|rema|tyla|shallipopi|ckay)\b/.test(
      n,
    ) ||
    /\bhow many streams (does|did|has) .+ (by|have) .+/.test(n)
  ) {
    return { category: 'song_streams', raw: question, normalized: n };
  }

  // ── Leaderboard — listeners ───────────────────────────────────────────────
  if (
    /\bmost (monthly )?listeners\b/.test(n) ||
    /\bhighest (monthly )?listeners\b/.test(n) ||
    /\bmost popular right now\b/.test(n) ||
    /\bwho (has|is).+most.+listeners\b/.test(n) ||
    /\btop \d+ .+by monthly listeners\b/.test(n) ||
    /\btop \d+ .+monthly listeners\b/.test(n) ||
    /\bmost listened\b/.test(n) ||
    /\bnumber 1 for monthly listeners\b/.test(n) ||
    /\bwho is number 1 for (monthly )?listeners\b/.test(n) ||
    /\bwho is number 1 (on spotify )?by (monthly )?listeners\b/.test(n) ||
    /\bwhich artist has the most (monthly )?listeners\b/.test(n) ||
    /\bwho has the most (monthly )?listeners\b/.test(n) ||
    /\bmost (monthly )?listeners\b/.test(n) ||
    /\bmost listeners spotify\b/.test(n) || // ← add
    /\bmonthly listeners spotify\b/.test(n) ||
    /\bwhich african artist has the highest.+listeners\b/.test(n) || // ← add
    /\btop \d+ artists.+monthly listeners.+globally\b/.test(n) || // ← add
    /\bmost monthly listeners.+globally\b/.test(n) // ← add
  ) {
    return { category: 'leaderboard_listeners', raw: question, normalized: n };
  }

  // ── Chart — number 1 ─────────────────────────────────────────────────────
  if (
    (/\bwhat is (number 1|#1|no\.? ?1|topping)\b/.test(n) ||
      /\bwho is (number 1|#1|no\.? ?1|topping|leading)\b/.test(n) ||
      /\bwhat is topping\b/.test(n) ||
      /\bwhich song is topping\b/.test(n) ||
      /\bwho is leading\b.+\bchart\b/.test(n) ||
      /\bwhat is no 1\b/.test(n)) &&
    !/\b(monthly )?listeners\b/.test(n) // ← exclude listener questions
  ) {
    return { category: 'chart_number_1', raw: question, normalized: n };
  }

  // ── Chart — top 5 ────────────────────────────────────────────────────────
  if (
    /\btop [345]\b.+\bchart\b/.test(n) ||
    /\bchart.+\btop [345]\b/.test(n) ||
    /\bbillboard hot 100 top \d\b/.test(n)
  ) {
    return { category: 'chart_top_5', raw: question, normalized: n };
  }

  // ── Chart — list ─────────────────────────────────────────────────────────
  if (
    /\bwhat songs are on\b/.test(n) ||
    /\bwhats? (on|popping on)\b.+\bchart\b/.test(n) ||
    /\bwhats? on\b.+\bspotify\b/.test(n) ||
    /\bshow me\b.+\bchart\b/.test(n) ||
    /\bwhat (is|are) on\b.+\bspotify\b/.test(n) ||
    /\btop \d+ songs? on spotify (nigeria|ghana|kenya|south africa|uganda|uk|us|global)\b/.test(
      n,
    ) || // ← add
    /\btop \d+ songs? (in|on)\b.+\b(nigeria|ghana|kenya|south africa|uganda|uk|us)\b/.test(
      n,
    ) || // ← add
    /\btop \d+ (nigerian|ghanaian|kenyan|south african|ugandan|uk|us) songs?\b/.test(
      n,
    ) ||
    /\bpopping on spotify\b/.test(n)
  ) {
    return { category: 'chart_list', raw: question, normalized: n };
  }

  // ── Leaderboard — trending artists ───────────────────────────────────────
  if (
    /\bwho is (trending|growing fastest|rising)\b/.test(n) ||
    /\bwho is growing fastest\b/.test(n) ||
    /\bfastest growing (artist|african|afrobeats)\b/.test(n) ||
    /\btrending (artist|in|on)\b/.test(n) ||
    /\bwhich .+ artist is trending\b/.test(n) ||
    /\bwho is trending\b/.test(n) ||
    /\bwho is growing the fastest\b/.test(n) || // ← add
    /\bgrowing the fastest right now\b/.test(n) // ← add
  ) {
    return {
      category: 'leaderboard_trending_artists',
      raw: question,
      normalized: n,
    };
  }

  // ── Leaderboard — trending songs ──────────────────────────────────────────
  if (
    /\btrending songs?\b/.test(n) ||
    /\bwhat songs? are trending\b/.test(n) ||
    /\bfastest growing songs?\b/.test(n) ||
    /\bwhat (afrobeats )?songs? are trending\b/.test(n) ||
    /\bafrobeats songs?.+trending\b/.test(n) || // ← add
    /\btrending.+afrobeats songs?\b/.test(n) // ← add
  ) {
    return {
      category: 'leaderboard_trending_songs',
      raw: question,
      normalized: n,
    };
  }

  // ── Leaderboard — songs ───────────────────────────────────────────────────
  if (
    (/\bmost streamed songs? (ever|overall|globally|of all time|on spotify)\b/.test(
      n,
    ) ||
      /\btop \d+ (most streamed )?songs?\b/.test(n) ||
      /\bwhich song has the most streams\b/.test(n) ||
      /\bbiggest songs? on spotify\b/.test(n) ||
      /\bmost streamed song ever\b/.test(n) ||
      /\bwhat (are|is) the (top|most) .+ songs?\b/.test(n) ||
      /\b(most streamed|biggest) afrobeats songs?\b/.test(n) || // ← add
      /\bafrobeats songs?.+(most streamed|ever|all time)\b/.test(n) || // ← add
      /\b(most streamed|biggest) nigerian songs?\b/.test(n) || // ← add
      /\bwhich (nigerian|afrobeats) song has the most\b/.test(n) || // ← add
      /\bwhich song has the most spotify streams\b/.test(n) || // ← add
      /\bwho is leading in spotify daily song streams\b/.test(n)) &&
    !/\b(nigeria|ghana|kenya|south africa|uganda|uk|us|global|afrobeats|chart)\b/.test(
      n,
    ) // ← guard
  ) {
    return { category: 'leaderboard_songs', raw: question, normalized: n };
  }

  // ── Leaderboard — streams ─────────────────────────────────────────────────
  if (
    /\bmost streamed (artist|nigerian|african|ghanaian|kenyan|south african|uk|us|american)\b/.test(
      n,
    ) ||
    /\btop \d+ .+(artist|musicians?)\b/.test(n) ||
    /\bwho has the most (spotify )?streams\b/.test(n) ||
    /\bwho (leads?|is biggest|is number 1).+streams\b/.test(n) ||
    /\bbiggest (african|nigerian|afrobeats|ghanaian|kenyan|south african|uk|us) artist\b/.test(
      n,
    ) ||
    /\bwho has the most streams in\b/.test(n) ||
    /\bwho is the (most|biggest|best).+artist\b/.test(n) ||
    /\btop \d+ .+on spotify\b/.test(n) ||
    /\bwho is the stream leader\b/.test(n) ||
    /\bwhich .+ artist has \d+ billion streams\b/.test(n) ||
    /\bwhich african artist (has|charted|ranks)\b/.test(n) ||
    /\bwho has the most (spotify )?streams\b/.test(n) ||
    /\bwho has the most streams on spotify\b/.test(n) ||
    /\bmost streams (on spotify )?(globally|overall|in the world)?\b/.test(n) ||
    /\btop artist (worldwide|globally)\b/.test(n) || // ← add
    /\btop artists? (in |from )?(the )?(uk|us|nigeria|ghana|kenya|south africa|east africa|worldwide|globally)\b/.test(
      n,
    ) || // ← add
    /\bnigerian streams on spotify\b/.test(n) || // ← add
    /\bwho are the top artists in\b/.test(n) || // ← add
    /\bwhich african artist ranks highest\b/.test(n) || // ← add
    /\b(number 1|#1).+afrobeats artist\b/.test(n) || // ← add
    /\bafrobeats artist.+(number 1|#1|biggest|top)\b/.test(n) // ← add
  ) {
    return { category: 'leaderboard_streams', raw: question, normalized: n };
  }

  // ── Monthly listeners (artist specific) ───────────────────────────────────
  if (
    /\bhow many monthly listeners (does|has|did)\b/.test(n) ||
    /\bmonthly listeners (does|has)\b/.test(n) ||
    /\b\w+\s+monthly listeners?\b$/.test(n) ||
    /\bhow does .+ rank .+ by monthly listeners\b/.test(n) ||
    /\bwhat .+ monthly listeners\b/.test(n) ||
    /\bhow many listeners does\b/.test(n)
  ) {
    return {
      category: 'artist_monthly_listeners',
      raw: question,
      normalized: n,
    };
  }

  // ── Daily streams (artist specific) ──────────────────────────────────────
  if (
    /\bhow many daily streams (does|has|did)\b/.test(n) ||
    /\bdaily streams? (does|has)\b/.test(n) ||
    /\b\w+\s+daily streams?\b$/.test(n)
  ) {
    return { category: 'artist_daily_streams', raw: question, normalized: n };
  }

  // ── Artist streams (specific artist) ─────────────────────────────────────
  if (
    /\bhow many streams (does|has|did)\b/.test(n) ||
    /\btotal streams?\b/.test(n) ||
    /\bspotify (streams?|numbers?)\b/.test(n) ||
    /\bgive me .+ (spotify )?numbers?\b/.test(n) ||
    /\blatest numbers? for\b/.test(n) ||
    /\b\w[\w\s-]+\s+streams?\b$/.test(n) ||
    /\b\w[\w\s-]+\s+total streams?\b$/.test(n)
  ) {
    return { category: 'artist_streams', raw: question, normalized: n };
  }

  // ── Artist profile (catch-all for named artist with no clear intent) ──────
  if (
    /\btell me about\b/.test(n) ||
    (/\bwho is\b/.test(n) && !/\bchart\b/.test(n)) ||
    /\blatest (stats?|numbers?|info)\b/.test(n) ||
    (/^[a-z\s-]+$/.test(n) && n.split(' ').length <= 4)
  ) {
    return { category: 'artist_profile', raw: question, normalized: n };
  }

  return { category: 'unclassified', raw: question, normalized: n };
}
