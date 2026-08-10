import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// The recommended transformers also defeat common evasion attempts (leetspeak,
// confusable Unicode lookalikes, repeated characters), which a plain wordlist
// with word boundaries does not.
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  return matcher.hasMatch(text);
}
