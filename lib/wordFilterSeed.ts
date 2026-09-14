import seed from "./wordFilterSeed.json";

// Seed terms for app_content/word_filter.blockedTerms — lowercase, no punctuation.
// Edit lib/wordFilterSeed.json to change the list without touching any code.
// Consumed by scripts/seedWordFilter.js to initialize/reset the Firestore doc.
export const WORD_FILTER_SEED: string[] = seed;
