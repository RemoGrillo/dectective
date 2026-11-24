// The edition's vocabulary: plain words first, DEC's terms second (shown on hover and on the Method page).
// Every page uses these labels, so the same thing is always called the same way.
import type { DecType, Status } from "./api";

export type Verb = "says" | "believes" | "concludes" | "supposes";
export type Polarity = "yes" | "no";
export type DiagnosisKind = "lie" | "delusion" | "mistake";
export type RealityValue = "true" | "false" | "false-if" | "unknown";

export const VERB: Record<Verb, { label: string; yes: string; no: string; noun: string; dec: string; help: string }> = {
  says: { label: "says", yes: "says it", no: "says otherwise", noun: "statement", dec: "verbatim world", help: "What someone said, word for word, whether or not they mean it." },
  believes: { label: "believes", yes: "believes it", no: "believes otherwise", noun: "belief", dec: "doxastic world", help: "What someone believes. What is true in Reality does not leak into it." },
  concludes: { label: "concludes", yes: "concludes it", no: "concludes otherwise", noun: "conclusion", dec: "epistemic world", help: "An account someone has worked out and the story accepts (Holmes's solution)." },
  supposes: { label: "supposes", yes: "supposes it", no: "supposes otherwise", noun: "guess", dec: "conjectural world", help: "A guess or hypothesis. It also takes Reality for granted." },
};
export const VERB_OF_PREDICATE: Record<string, Verb> = { uttered: "says", believes: "believes", establishes: "concludes", conjectures: "supposes" };
export const VERB_OF_DECTYPE: Partial<Record<DecType, Verb>> = { verbatim: "says", doxastic: "believes", epistemic: "concludes", conjectural: "supposes" };

export const DIAG: Record<DiagnosisKind, { label: string; short: string; rule: string; dec: string }> = {
  lie: { label: "Lie", short: "says it, believes otherwise", rule: "Someone says something that their own beliefs rule out.", dec: "the statement (verbatim world) holds p; the speaker's doxastic world rules p out" },
  delusion: { label: "Delusion", short: "believes it, Reality rules it out", rule: "Someone believes something that Reality rules out.", dec: "the doxastic world holds p; reality rules p out (DEC: delusional world)" },
  mistake: { label: "Honest mistake", short: "says and believes it, but it is false", rule: "Someone says what they believe, but Reality rules it out.", dec: "verbatim and doxastic worlds hold p; reality rules p out" },
};

export const REALITY: Record<RealityValue, { label: string; short: string; glyph: string }> = {
  true: { label: "True in the story", short: "True", glyph: "✓" },
  false: { label: "False in the story", short: "False", glyph: "✕" },
  "false-if": { label: "False, given an assumption", short: "False if…", glyph: "✕" },
  unknown: { label: "The story does not say", short: "Not said", glyph: "?" },
};

/** World kinds, in plain words. */
export const KIND: Record<DecType, { label: string; plural: string; dec: string }> = {
  reality: { label: "Reality", plural: "Reality", dec: "reality world" },
  epistemic: { label: "Conclusion", plural: "Conclusions", dec: "epistemic world" },
  doxastic: { label: "Beliefs", plural: "Beliefs", dec: "doxastic world" },
  conjectural: { label: "Guess", plural: "Guesses", dec: "conjectural world" },
  verbatim: { label: "Statement", plural: "Statements", dec: "verbatim world" },
  shared: { label: "Background", plural: "Background", dec: "shared world" },
};

/** How a world holds a proposition (DEC status), in plain words. */
export const STATUS: Record<Status, { label: string; help: string }> = {
  asserted: { label: "stated", help: "stated in this point of view" },
  received: { label: "inherited", help: "not stated here, but taken over from another point of view (DEC: permeation)" },
  derived: { label: "inferred by DEC", help: "inferred by DEC's reasoner inside this point of view (identity, symmetry, class hierarchy…)" },
  contradicted: { label: "ruled out", help: "incompatible with something this point of view holds" },
  "contradicted-assuming": { label: "ruled out, if…", help: "incompatible only under an assumption (e.g. one occupation at a time)" },
  "not-determined": { label: "silent", help: "this point of view says nothing either way (never read as “false”)" },
};

/** Verdicts on DEC's conflict flags between two points of view. */
export const PAIR: Record<string, { label: string; help: string }> = {
  conflict: { label: "Conflict", help: "They really cannot both be true: something is of two incompatible kinds." },
  assumption: { label: "Only if…", help: "They clash only under an assumption (e.g. one occupation at a time)." },
  artifact: { label: "False alarm", help: "DEC flags a conflict, but both sides agree. A bug in DEC's single-value check fires on identical values." },
  unexplained: { label: "Unexplained", help: "DEC flags a conflict the edition cannot explain." },
};

export const PEOPLE_HELP: Record<string, string> = {
  reader: "A simulated first-time reader. Their guesses only exist in spoiler-free reading.",
  whatif: "A test hypothesis added by the editors (not in the story), to see what the evidence alone can prove.",
};
