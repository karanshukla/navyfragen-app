import {
  DataSet,
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  parseRawPattern,
} from "obscenity";

import { ordinaryWordsToNeverFlag, profaneWordsByLanguage } from "./profanity-wordlists";
import type { ProfaneWord, ProfanityLanguage } from "./profanity-wordlists";

interface PhraseMetadata {
  originalWord: string;
  language?: ProfanityLanguage;
}

/** Which wordlist entry fired, so a questionable drop is traceable in the logs. */
export interface ProfanityMatch {
  readonly word: string;
  readonly language: ProfanityLanguage;
}

/**
 * Longest run of one letter that obscenity's recommended transformers leave
 * standing before collapsing it; every other letter collapses to one. A
 * pattern written with an uncollapsed run (`connard`) is matched against
 * already-collapsed text (`conard`) and can never fire.
 *
 * @see [profanity.test.ts](../tests/profanity.test.ts) — "every listed word
 * matches itself", the test that catches a run this table gets wrong.
 */
const LETTER_RUN_LIMITS: ReadonlyMap<string, number> = new Map([
  ["b", 2],
  ["e", 2],
  ["g", 2],
  ["l", 2],
  ["o", 2],
  ["s", 2],
]);

function collapseRuns(word: string): string {
  let collapsed = "";
  let previous = "";
  let run = 0;
  for (const letter of word) {
    run = letter === previous ? run + 1 : 1;
    previous = letter;
    if (run <= (LETTER_RUN_LIMITS.get(letter) ?? 1)) collapsed += letter;
  }
  return collapsed;
}

function foldDiacritics(word: string): string {
  return word.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * `ß` has no NFD decomposition, and obscenity's confusable table folds it to
 * `b` — so a `ß` spelling reaches the matcher as `scheibe`, which both misses
 * the profanity and would flag the ordinary word "Scheibe" if we wrote the
 * pattern to match it. Expanding to `ss` first, on both sides, is the standard
 * German transliteration and sidesteps the collision entirely.
 *
 * @see [profanity.test.ts](../tests/profanity.test.ts) — "catches the ß
 * spelling" / "leaves the ordinary word Scheibe alone".
 */
function expandEszett(text: string): string {
  return text.replace(/ß/g, "ss");
}

/**
 * Anchored on the left so a stem still catches its inflections (`puta` →
 * `putas`, `fick` → `ficken`) without firing mid-word (`diputado`,
 * `Grafik`). A word that is itself the prefix of an ordinary word carries
 * `boundedEnd` and is anchored on both sides.
 */
function toMatcherPattern({ word, boundedEnd }: ProfaneWord): string {
  const stem = collapseRuns(foldDiacritics(expandEszett(word.toLowerCase())));
  return `|${stem}${boundedEnd ? "|" : ""}`;
}

function buildDataset(): DataSet<PhraseMetadata> {
  const dataset = new DataSet<PhraseMetadata>().addAll(englishDataset);
  const seen = new Set<string>();
  for (const [language, words] of Object.entries(profaneWordsByLanguage) as [
    ProfanityLanguage,
    readonly ProfaneWord[],
  ][]) {
    for (const entry of words) {
      const pattern = toMatcherPattern(entry);
      if (seen.has(pattern)) continue;
      seen.add(pattern);
      dataset.addPhrase((phrase) =>
        phrase
          .setMetadata({ originalWord: entry.word, language })
          .addPattern(parseRawPattern(pattern))
      );
    }
  }
  return dataset.addPhrase((phrase) => {
    for (const word of ordinaryWordsToNeverFlag) phrase.addWhitelistedTerm(word);
    return phrase.setMetadata({ originalWord: "" });
  });
}

/**
 * `obscenity`'s English dataset whitelists the bare string `fick` so that
 * "trafficking" survives its `f?ck` pattern. That also makes the German `fick`
 * permanently unmatchable — a whitelist entry outranks every blacklist
 * pattern. Narrowing it to the word it was protecting keeps "trafficking"
 * clean and gives the German word back.
 *
 * @see [profanity.test.ts](../tests/profanity.test.ts) — "trafficking is not
 * profanity" / "fick dich is".
 */
const OVER_BROAD_ENGLISH_WHITELIST = "fick";

const dataset = buildDataset();
const { blacklistedTerms, whitelistedTerms } = dataset.build();

const matcher = new RegExpMatcher({
  blacklistedTerms,
  whitelistedTerms: whitelistedTerms?.filter((term) => term !== OVER_BROAD_ENGLISH_WHITELIST),
  ...englishRecommendedTransformers,
});

/**
 * Screens text against every language the app supports at once, rather than
 * against the sender's or recipient's language: an anonymous sender picks
 * their own language, so there is no locale to select a wordlist by.
 *
 * Returns the wordlist entry that fired rather than a bare boolean, because a
 * flagged message is dropped silently — the entry is the only evidence a
 * mistaken drop ever leaves. It names the list entry, never the sender's own
 * words, so the log stays free of message content.
 *
 * @see [profanity.test.ts](../tests/profanity.test.ts) — matches per language,
 * evasion-shaped inputs, and the ordinary sentences that must never be flagged.
 */
export function findProfanity(text: string): ProfanityMatch | null {
  if (!text) return null;
  const [match] = matcher.getAllMatches(expandEszett(text), true);
  if (!match) return null;
  const { phraseMetadata } = dataset.getPayloadWithPhraseMetadata(match);
  return {
    word: phraseMetadata?.originalWord ?? "",
    language: phraseMetadata?.language ?? "en",
  };
}
