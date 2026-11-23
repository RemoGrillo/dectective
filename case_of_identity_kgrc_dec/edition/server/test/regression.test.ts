// The audit's test queries, replayed on the edition store, give DEC's recorded answers — except where merging
// all slices into one store legitimately adds results. Those differences are listed and checked explicitly.
import { describe, expect, it } from "vitest";
import { runAuditQueries } from "../src/regression.ts";

const results = runAuditQueries();
const W = "http://example.org/dectective/world/";

const KNOWN: Record<string, (edition: unknown, dec: unknown) => void> = {
  // The test slice held no conjectural world; in the edition, every conjectural world (incl. those of the
  // complementary run) receives the narrative, where the engagement holds de re through identity.
  T03b_where_engaged_to_windibank: (edition) => {
    expect(edition).toEqual(["h_author_other", "holmes_mother", "holmes_motive", "holmes_same_machine", "watson_hyp"].map((w) => `g=${W}${w}`));
  },
  // The union of runs adds windibank_beliefs, diagnosed delusional by the T05 runs only through the closedFor
  // defect (identical values) — the edition flags that verdict as an artifact (see dossiers-worlds.test.ts).
  T06a_belief_worlds_vs_reality: (edition, dec) => {
    expect(edition).toEqual([...(dec as string[]), `w=${W}windibank_beliefs`].sort());
  },
};

describe("regression against the audit (DEC observations)", () => {
  it("covers the 29 non-ablation queries", () => {
    expect(results.length).toBe(29);
  });
  for (const r of results) {
    it(`${r.id} (${r.dataset})`, () => {
      if (KNOWN[r.id]) KNOWN[r.id](r.edition, r.dec);
      else expect(r.edition).toEqual(r.dec);
    });
  }
});
