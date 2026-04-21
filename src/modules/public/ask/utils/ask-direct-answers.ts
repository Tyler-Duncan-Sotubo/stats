type DirectAnswerRule = {
  patterns: string[];
  answer: string;
  exact?: boolean; // if true, require exact normalized match instead of word scoring
};

const DIRECT_ANSWERS: DirectAnswerRule[] = [
  {
    patterns: [
      'most streamed genre on spotify',
      'what genre is most streamed on spotify',
      'what is the most streamed genre on spotify',
    ],
    answer:
      'Hip-hop/rap is the most streamed genre on Spotify, accounting for roughly 30–32% of all streams globally, followed by pop at about 25–28%.',
    exact: true,
  },
  {
    patterns: [
      'is afrobeats the fastest growing music genre',
      'is afrobeats the fastest growing genre',
      'is afrobeats growing fastest',
    ],
    answer:
      'Afrobeats is widely regarded as one of the fastest-growing music genres globally, although TooXclusive Stats does not track genre-level growth directly.',
    exact: true,
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

/**
 * Strict word-overlap score.
 * Requires ALL high-signal words to match (not just 60%).
 * "High signal" = words longer than 3 chars.
 */
function matchScore(input: string, pattern: string): number {
  const inputWords = new Set(getWords(input));
  const patternWords = getWords(pattern).filter((w) => w.length > 3);

  if (patternWords.length === 0) return 0;

  let matches = 0;
  for (const word of patternWords) {
    if (inputWords.has(word)) matches++;
  }

  return matches / patternWords.length;
}

export function getDirectAnswer(question: string): string | null {
  const normalized = normalize(question);

  for (const rule of DIRECT_ANSWERS) {
    for (const pattern of rule.patterns) {
      if (rule.exact) {
        // For exact rules, normalized input must equal the pattern
        // OR the input must contain the full pattern as a substring
        const normalizedPattern = normalize(pattern);
        if (
          normalized === normalizedPattern ||
          normalized.includes(normalizedPattern)
        ) {
          return rule.answer;
        }
      } else {
        // Raise threshold to 0.85 — nearly all high-signal words must match
        const score = matchScore(normalized, pattern);
        if (score >= 0.85) {
          return rule.answer;
        }
      }
    }
  }

  return null;
}
