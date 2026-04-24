const BASE_URL = process.env.SEED_URL ?? 'http://localhost:8000';
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS ?? '1500');

async function fetchQuestions(): Promise<
  { slug: string; question: string; updatedAt: string | null }[]
> {
  const res = await fetch(`${BASE_URL}/api/public/ask/indexable`);
  if (!res.ok) throw new Error(`Failed to fetch questions: ${res.status}`);
  return res.json() as Promise<
    { slug: string; question: string; updatedAt: string | null }[]
  >;
}

async function reask(question: string): Promise<void> {
  try {
    const askRes = await fetch(`${BASE_URL}/api/public/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    if (!askRes.ok) {
      console.error(`❌ Ask failed [${askRes.status}] ${question}`);
      return;
    }

    const data = await askRes.json();
    console.log(`✅ ${question}`);
    console.log(`   → ${data.toolUsed} | ${data.answer?.slice(0, 80)}...\n`);
  } catch (err) {
    console.error(`❌ Failed: ${question} — ${(err as Error).message}`);
  }
}

async function seed(): Promise<void> {
  const all = await fetchQuestions();

  console.log(`🌱 Refreshing all ${all.length} questions with new engine\n`);

  for (const { question } of all) {
    await reask(question);
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  console.log(`\n✅ Done — ${all.length} refreshed`);
}

void seed();
