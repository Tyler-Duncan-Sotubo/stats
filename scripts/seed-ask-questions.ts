const BASE_URL = process.env.SEED_URL ?? 'http://localhost:8000';
const SKIP_IF_UPDATED_WITHIN_HOURS = parseInt(process.env.SKIP_HOURS ?? '6');
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS ?? '1500');

function isStale(updatedAt: string | null): boolean {
  if (!updatedAt) return true;
  const hoursSinceUpdate =
    (Date.now() - new Date(updatedAt).getTime()) / 1000 / 60 / 60;
  return hoursSinceUpdate > SKIP_IF_UPDATED_WITHIN_HOURS;
}

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
  const stale = all.filter((q) => isStale(q.updatedAt));
  const skipped = all.length - stale.length;

  console.log(
    `🌱 ${all.length} total — ${skipped} fresh, refreshing ${stale.length}\n`,
  );

  for (const { question } of stale) {
    await reask(question);
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  console.log(`\n✅ Done — ${stale.length} refreshed, ${skipped} skipped`);
}

void seed();
