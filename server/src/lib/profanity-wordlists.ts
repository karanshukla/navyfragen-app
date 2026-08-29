/**
 * Sourced by machine-translating the English `obscenity` dataset into each
 * language and keeping only what survived back-translation and a
 * cross-language collision review (#412). Words a reviewer could not call
 * confidently are recorded on the issue rather than shipped: the filter drops
 * a flagged message silently, so a false positive is invisible censorship
 * while a false negative merely lets a rude message through.
 *
 * Entries are stems, not dictionary forms — the matcher anchors on the left
 * and stays open on the right, so `puta` covers `putas` and `fick` covers
 * `ficken`. `boundedEnd` closes the right side for a stem that is also the
 * prefix of an ordinary word, and applies in every language once any language
 * needs it.
 *
 * @see [profanity.test.ts](../tests/profanity.test.ts) — every entry matches
 * itself, and no entry fires on the ordinary-sentence corpus.
 */
export type ProfanityLanguage = "en" | "es" | "pt" | "de" | "fr";

export interface ProfaneWord {
  readonly word: string;
  readonly boundedEnd?: boolean;
}

export const profaneWordsByLanguage: Readonly<
  Record<Exclude<ProfanityLanguage, "en">, readonly ProfaneWord[]>
> = {
  es: [
    { word: "anal", boundedEnd: true },
    { word: "bastardo" },
    { word: "cagada" },
    { word: "cojones" },
    { word: "culo" },
    { word: "eyacular" },
    { word: "felación" },
    { word: "follar" },
    { word: "gilipollas" },
    { word: "incesto" },
    { word: "maricón" },
    { word: "masturba" },
    { word: "meada" },
    { word: "mierda" },
    { word: "orgasmo" },
    { word: "pajea" },
    { word: "pene", boundedEnd: true },
    { word: "polla" },
    { word: "porno" },
    { word: "puta", boundedEnd: true },
    { word: "teta" },
    { word: "zoofilia" },
  ],
  pt: [
    { word: "ânus" },
    { word: "bastardo" },
    { word: "buceta" },
    { word: "bunda" },
    { word: "caralho" },
    { word: "dildo" },
    { word: "ejacular" },
    { word: "estupro" },
    { word: "felação" },
    { word: "fisting" },
    { word: "foder" },
    { word: "gangbang" },
    { word: "hentai" },
    { word: "incesto" },
    { word: "maricas" },
    { word: "masturba" },
    { word: "merda" },
    { word: "orgasmo" },
    { word: "penetração dupla" },
    { word: "pênis" },
    { word: "piroca" },
    { word: "plug anal" },
    { word: "porno" },
    { word: "porra", boundedEnd: true },
    { word: "puta", boundedEnd: true },
    { word: "sêmen", boundedEnd: true },
    { word: "vagina" },
    { word: "xoxota" },
  ],
  de: [
    { word: "arsch" },
    { word: "doppelte penetration" },
    { word: "fick" },
    { word: "fotze" },
    { word: "hündchenstellung" },
    { word: "hure" },
    { word: "masturbier" },
    { word: "muschi" },
    { word: "nutte" },
    { word: "scheisse" },
    { word: "scheiße" },
    { word: "schlampe" },
    { word: "schlitzauge" },
    { word: "schwuchtel" },
    { word: "vergewaltig" },
    { word: "wichser" },
  ],
  fr: [
    { word: "anal", boundedEnd: true },
    { word: "anus" },
    { word: "bestialité" },
    { word: "branler" },
    { word: "branlette" },
    { word: "chinetoque" },
    { word: "cocu" },
    { word: "connard" },
    { word: "connasse" },
    { word: "couille" },
    { word: "doigter" },
    { word: "double pénétration" },
    { word: "éjaculer" },
    { word: "fellation" },
    { word: "gang bang" },
    { word: "gode", boundedEnd: true },
    { word: "gorge profonde" },
    { word: "inceste" },
    { word: "masturber" },
    { word: "merde" },
    { word: "nichon" },
    { word: "nique" },
    { word: "orgasme" },
    { word: "pédé" },
    { word: "pénis" },
    { word: "pisse" },
    { word: "plug anal" },
    { word: "porno" },
    { word: "putain" },
    { word: "salaud" },
    { word: "salope" },
    { word: "sperme" },
    { word: "vagin" },
    { word: "youpin" },
  ],
};

/**
 * Ordinary words that contain a listed stem, or that the English dataset
 * matches by accident. `obscenity` gives the whitelist priority over the
 * blacklist, so these keep their meaning without narrowing any stem.
 */
export const ordinaryWordsToNeverFlag: readonly string[] = [
  "abo",
  "anale",
  "analfabet",
  "anus praeter",
  "assez",
  "bestialidad",
  "bestialidade",
  "bestialitat",
  "bestialität",
  "culotte",
  "culottes",
  "dick",
  "dickicht",
  "negra",
  "negro",
  "niquel",
  "níquel",
  "pissenlit",
  "pissenlits",
  "retard",
  "salopette",
  "salopettes",
  "scat",
  "semente",
  "sementes",
  "tetano",
  "tetanus",
  "traffick",
  "tétano",
  "tétanos",
];
