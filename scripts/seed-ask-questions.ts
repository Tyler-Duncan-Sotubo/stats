// scripts/seed-ask-questions.ts
const BASE_URL = process.env.SEED_URL ?? 'http://localhost:8000';

const SEED_QUESTIONS = [
  // ── Charts — Spotify ──────────────────────────────────────────────────────
  'what is topping spotify globally today',
  'what is number 1 on spotify globally',
  'what is number 1 on spotify nigeria',
  'what is number 1 on spotify south africa',
  'what is number 1 on spotify uk',
  'what is topping the nigerian spotify chart today',
  'what songs are on the spotify nigeria chart',
  'what songs are on the spotify global chart',
  'what songs are on the spotify uk chart',
  'which song is topping the nigerian chart today',
  'which song is topping the nigerian streaming numbers today',
  'which song is topping the uk chart today',
  'who is leading in spotify nigeria today',
  'who is leading in spotify daily song streams',
  'who is leading in spotify daily song streams in nigeria',

  // ── Charts — Apple Music ──────────────────────────────────────────────────
  'what is number 1 on apple music nigeria',
  'what is number 1 on apple music ghana',
  'what is number 1 on apple music kenya',
  'what is number 1 on apple music south africa',
  'what is number 1 on apple music uganda',
  'what songs are on the apple music nigeria chart',

  // ── Charts — Official ─────────────────────────────────────────────────────
  'what is number 1 on the uk afrobeats chart',
  'what songs are on the uk afrobeats chart',
  'what is number 1 on the billboard hot 100',
  'what songs are on the billboard hot 100',
  'what songs are on the uk official singles chart',
  'what is number 1 on the uk singles chart',
  'what songs are on the tooxclusive top 100',
  'what is number 1 on the east africa top 50',
  'what is number 1 on the tooxclusive top 100',
  'which song is leading charts globally',

  // ── Artist stats — African ────────────────────────────────────────────────
  'how many streams does wizkid have',
  'how many streams does burna boy have',
  'how many streams does davido have',
  'how many streams does asake have',
  'how many streams does tems have',
  'how many streams does rema have',
  'how many streams does ayra starr have',
  'how many streams does omah lay have',
  'how many streams does ckay have',
  'how many streams does fireboy dml have',
  'how many streams does odumodublvck have',
  'how many streams does seyi vibez have',
  'how many streams does kizz daniel have',
  'how many streams does pheelz have',
  'how many streams does oxlade have',
  'how many streams does black sherif have',
  'how many streams does stonebwoy have',
  'how many streams does sarkodie have',
  'how many streams does diamond platnumz have',
  'how many monthly listeners does wizkid have',
  'how many monthly listeners does burna boy have',
  'how many monthly listeners does davido have',
  'how many monthly listeners does tems have',
  'how many monthly listeners does rema have',
  'how many monthly listeners does asake have',
  'how many daily streams does wizkid have',
  'how many daily streams does burna boy have',
  'how many daily streams does tems have',
  'how many daily streams does rema have',

  // ── Artist stats — Global ─────────────────────────────────────────────────
  'how many streams does drake have',
  'how many streams does bad bunny have',
  'how many streams does the weeknd have',
  'how many streams does taylor swift have',
  'how many streams does kendrick lamar have',
  'how many streams does ed sheeran have',
  'how many streams does post malone have',
  'how many streams does j cole have',
  'how many streams does travis scott have',
  'how many streams does 21 savage have',
  'how many monthly listeners does drake have',
  'how many monthly listeners does the weeknd have',
  'how many monthly listeners does taylor swift have',
  'how many monthly listeners does bad bunny have',
  'give me taylor swifts spotify numbers',
  'give me the latest numbers for kendrick lamar',

  // ── Specific songs ────────────────────────────────────────────────────────
  'how many streams does calm down with selena gomez have',
  'how many streams does calm down by rema have',
  'what is rema most streamed song',
  'what is rema biggest song',
  'how many streams does love nwantiti have',
  'how many streams does essence have',
  'how many streams does free mind have tems',
  'how many streams does bloody civilian have tems',
  'how many streams does ye have burna boy',
  'how many streams does last last have',
  'how many streams does outside have',
  'how many streams does ojuelegba have',
  'how many streams does on the ground have',
  'how many streams does rush have',
  'how many streams does science student have',
  'how many streams does unfortunate have',
  'how many streams does organise have',

  // ── Milestones ────────────────────────────────────────────────────────────
  'has wizkid hit 10 billion streams',
  'has burna boy hit 10 billion streams',
  'has tems hit 1 billion streams',
  'has rema hit 1 billion streams',
  'has rema hit 2 billion streams',
  'has ckay hit 1 billion streams',
  'which afrobeats song has the most streams ever',
  'what is the most streamed afrobeats song of all time',
  'what is the most streamed african song ever',
  'what is the most streamed nigerian song ever',
  'which nigerian song has the most streams',
  'which african artist has 1 billion streams',
  'which african artist has 10 billion streams',

  // ── Leaderboards — African ────────────────────────────────────────────────
  'who is the most streamed african artist',
  'who is the most streamed afrobeats artist',
  'who is the most streamed nigerian artist',
  'who has the most streams in nigeria',
  'who has the most streams in ghana',
  'who has the most streams in south africa',
  'who has the most streams in kenya',
  'who has the most streams in uganda',
  'who has the most streams in tanzania',
  'who has the most streams in east africa',
  'who is the biggest artist in nigeria',
  'who is the biggest artist in ghana',
  'who is the biggest artist in south africa',
  'who is the biggest artist in kenya',
  'who is the most famous nigerian artist',
  'who is the most famous ghanaian artist',
  'top 10 most streamed african artists',
  'top 10 afrobeats artists by streams',
  'top 10 nigerian artists on spotify',
  'top 10 ghanaian artists on spotify',
  'top 10 south african artists on spotify',
  'top 10 kenyan artists on spotify',
  'top 10 african artists by monthly listeners',
  'who are the top artists in east africa',
  'top 5 most streamed afrobeats songs',
  'is rema the most streamed nigerian artist',
  'is davido the most streamed nigerian artist',
  'is wizkid the most streamed african artist',
  'is burna boy the most streamed african artist',
  'is burna boy bigger than wizkid',
  'is rema bigger than wizkid',
  'is tems the most streamed female african artist',

  // ── Leaderboards — Global ─────────────────────────────────────────────────
  'who has the most spotify streams',
  'who has the most monthly listeners on spotify',
  'who has the most daily streams on spotify',
  'who has the most streams on spotify globally',
  'who is the most streamed artist in the world',
  'who has the most streams in the uk',
  'who has the most streams in the us',
  'who has the highest monthly listeners',
  'top 10 most streamed artists on spotify',
  'top 10 most streamed songs on spotify',
  'top 10 artists with most monthly listeners',
  'top 10 most streamed songs ever',
  'who are the top 5 artists on spotify',
  'top 10 uk artists on spotify',
  'top 10 us artists on spotify',
  'who has the most spotify streams overall',

  // ── Trending ──────────────────────────────────────────────────────────────
  'who is trending on spotify today',
  'which afrobeats artist is growing fastest',
  'who is the fastest growing african artist',
  'which nigerian artist is trending today',
  'what afrobeats songs are trending today',
  'who is trending in nigeria today',
  'who is trending in south africa today',
  'who is trending in ghana today',
  'who is trending in kenya today',
  'what songs are trending globally today',
  'who is growing fastest on spotify globally',
  'is asake the fastest rising nigerian artist',

  // ── Awards & records ──────────────────────────────────────────────────────
  'how many grammy nominations does burna boy have',
  'how many grammys does burna boy have',
  'has wizkid won a grammy',
  'how many grammys has wizkid won',
  'has tems won a grammy',
  'how many awards does davido have',
  'who is the most awarded african artist',

  // ── Chart history ─────────────────────────────────────────────────────────
  'has wizkid been number 1 in the uk',
  'has burna boy been number 1 in the uk',
  'has tems been number 1 in the uk',
  'has rema been number 1 in the uk',
  'which afrobeats artist has the most uk chart weeks',
  'which afrobeats song spent the most weeks on the uk chart',
  'has any african artist topped the billboard hot 100',
  'which african artist has charted on billboard',
  'wizkid uk chart history',
  'burna boy uk chart history',
  'tems uk chart history',

  // ── Artist specific ───────────────────────────────────────────────────────
  'what charts has rema appeared on',
  'what position is rema on the leaderboard',
  'where is tyler the creator ranked globally',
  'who is the best artist in nigeria today',
  'who is the best artist in kenya today',
  'who is the king of afrobeats',
  'who is the queen of afrobeats',
  'who is the best afrobeats artist of all time',
  'who is the biggest afrobeats artist in the world',
  'who is the most popular african artist',
  'who is the number 1 afrobeats artist',
  'who is the biggest african artist right now',
];

async function ask(question: string): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/public/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      console.error(`❌ [${res.status}] ${question}`);
      return;
    }

    const data = await res.json();
    console.log(`✅ ${question}`);
    console.log(`   → ${data.toolUsed} | ${data.answer?.slice(0, 80)}...\n`);
  } catch (err) {
    console.error(`❌ Failed: ${question} — ${(err as Error).message}`);
  }
}

async function seed(): Promise<void> {
  console.log(
    `🌱 Seeding ${SEED_QUESTIONS.length} questions against ${BASE_URL}\n`,
  );

  for (const question of SEED_QUESTIONS) {
    await ask(question);
    // Rate limit — avoid hammering OpenAI and your own API
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(
    `\n✅ Seed complete — ${SEED_QUESTIONS.length} questions processed`,
  );
}

void seed();
