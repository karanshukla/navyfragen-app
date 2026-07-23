// Minimal typed wrapper around the `obscenity` profanity matcher (#58). It is
// ESM-native with full TypeScript types, so we import it directly (unlike the
// CJS `naughty-words` wordlist it replaced). It matches the English dataset
// with the recommended transformers, which also defeat common evasion attempts
// (leetspeak, confusable Unicode lookalikes, repeated characters) — a stronger
// check than a naive wordlist with word boundaries.
//
// Used by message-service.sendMessage() to silently drop flagged messages:
// the sender still gets a success response, but the message is never inserted
// into the recipient's inbox — no rejected-message UX surfaced to the visitor.

import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// One matcher instance, reused for every check — the dataset is built once.
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/**
 * Returns true if `text` contains any English blacklisted profanity. Empty
 * text is treated as clean (the empty-message case is already rejected
 * upstream by the send validation).
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  return matcher.hasMatch(text);
}
