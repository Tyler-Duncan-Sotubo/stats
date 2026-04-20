type DirectAnswerRule = {
  patterns: string[];
  answer: string;
};

const DIRECT_ANSWERS: DirectAnswerRule[] = [
  {
    patterns: [
      'most streamed genre on spotify',
      'what genre is most streamed on spotify',
    ],
    answer:
      'Hip-hop/rap is the most streamed genre on Spotify, accounting for roughly 30–32% of all streams globally, followed by pop at about 25–28%.',
  },
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function getWords(str: string): string[] {
  return str.split(' ').filter(Boolean);
}

function matchScore(input: string, pattern: string): number {
  const inputWords = new Set(getWords(input));
  const patternWords = getWords(pattern);

  let matches = 0;
  for (const word of patternWords) {
    if (inputWords.has(word)) matches++;
  }

  return matches / patternWords.length; // % match
}

export function getDirectAnswer(question: string): string | null {
  const normalized = normalize(question);

  let bestMatch: { score: number; answer: string } | null = null;

  for (const rule of DIRECT_ANSWERS) {
    for (const pattern of rule.patterns) {
      const score = matchScore(normalized, pattern);

      // threshold = 0.6 (60% words must match)
      if (score >= 0.6) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { score, answer: rule.answer };
        }
      }
    }
  }

  return bestMatch?.answer ?? null;
}
