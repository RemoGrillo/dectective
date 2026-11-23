#!/usr/bin/env python3
"""Write the test fixtures T01..T10: one manifest per test, one .rq per question, expectations.

Expected values encode the TEXTUAL/LOGICAL expectation (what a correct contextual treatment should
answer), fixed before running. Each query also records: classification of the answer
(lookup | derivable | incompatible | not-determined), text justification (sentence IDs), axioms or
assumptions required, world/time, and notes. Observed results per configuration are compared
against these expectations by scripts/aggregate_metrics.py.
Reality is always queried through the DEFAULT graph (DEC restores the materialised reality there;
`GRAPH dec:reality` is not answerable after restore, see exploratory E03).
Usage: python -I scripts/build_fixtures.py <project_root>
"""
import json
import os
import sys

P = """PREFIX st: <http://example.org/dectective/story/>
PREFIX w: <http://example.org/dectective/world/>
PREFIX prof: <http://example.org/dectective/profile#>
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX dec: <http://w3id.org/conjectures/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
"""
S = "http://example.org/dectective/story/"
W = "http://example.org/dectective/world/"
REAL_FILTER = "FILTER(?r IN (dec:reality, <urn:x-arq:DefaultGraphNode>))"

T = {
 "T01_who_is_hosmer": {"dataset": "gold", "question": "Who is Hosmer Angel in the reference reconstruction?",
   "queries": [
    ("T01a_identity_in_reality", "SELECT ?x WHERE { st:hosmer owl:sameAs ?x . FILTER(?x != st:hosmer) }",
     [f"x={S}windibank"], "lookup", ["P126.S11", "P127.S01", "P136.S06"], [],
     "reality (gold)", "Reads Holmes's accepted conclusion (epistemic world permeated into reality). Not a deduction of identity."),
    ("T01b_identity_in_holmes_world", "SELECT ?x WHERE { GRAPH w:holmes_reconstruction { st:hosmer owl:sameAs ?x . FILTER(?x != st:hosmer) } }",
     [f"x={S}windibank"], "lookup", ["P126.S11"], [], "w:holmes_reconstruction", "Context-scoped lookup: answerable without DEC permeation."),
    ("T01c_identity_consequence", "ASK { st:windibank prof:wore st:tinted_glasses }",
     True, "derivable", ["P051.S06", "P093.S02", "P126.S11"], ["owl:sameAs substitution (OWL)"], "reality (gold)",
     "Engine-derived: Hosmer's observed glasses transfer to Windibank under the reconstructed identity."),
   ], "seed_iris": [S + "hosmer", S + "windibank"], "require_modules": ["W02_holmes_reconstruction", "F03_courtship"]},
 "T02_mary_knows_identity": {"dataset": "gold", "question": "Does Mary hold the identity Hosmer = Windibank?",
   "queries": [
    ("T02a_mary_identity", "ASK { GRAPH w:mary_D1 { st:hosmer owl:sameAs st:windibank } }",
     False, "not-determined", ["P079.S02", "P079.S03", "P138.S01"], [], "w:mary_D1 (D1, last attested)",
     "False here means 'not attributed', NOT 'Mary believes they differ' (no differentFrom is attributed)."),
    ("T02b_mary_opacity", "ASK { GRAPH w:mary_D1 { st:mary prof:engagedTo st:windibank } }",
     False, "not-determined", ["P041.S02"], ["owl:sameAs must not cross into Mary's world"], "w:mary_D1",
     "Referential opacity: Mary is engaged to Hosmer de dicto; substitution only in reality."),
    ("T02c_mary_engaged_de_re_reality", "ASK { st:mary prof:engagedTo st:windibank }",
     True, "derivable", ["P041.S02", "P126.S11"], ["owl:sameAs substitution", "engagedTo symmetric"], "reality (gold)",
     "De re in reality the engagement was with the person Windibank (KGRC 507/518 put this inside Mary's attitude)."),
   ], "seed_iris": [S + "hosmer", S + "windibank", S + "mary"], "require_modules": ["W01_mary_D1", "W02_holmes_reconstruction", "F03_courtship"]},
 "T03_identity_dependent_conclusions": {"dataset": "gold", "question": "Which local conclusions depend on the availability of the identity?",
   "queries": [
    ("T03a_weak_sight_not_fact", "ASK { st:windibank a prof:WeakSighted }",
     False, "not-determined", ["P051.S06", "P111.S01", "P126.S11"], ["WeakSighted disjoint KeenSighted"], "reality (gold)",
     "Mary's belief about Hosmer's eyes must stay in her world; flattening + identity makes reality inconsistent."),
    ("T03b_where_engaged_to_windibank", "SELECT ?g WHERE { GRAPH ?g { st:mary prof:engagedTo st:windibank } }",
     [], "not-determined", ["P041.S02"], [], "all named worlds",
     "No named world should contain the substituted engagement: Mary's world lacks identity; Holmes's worlds do not mention the engagement unless they receive reality (conjectural)."),
   ], "seed_iris": [S + "windibank", S + "mary", S + "hosmer"], "require_modules": ["W01_mary_D1", "W02_holmes_reconstruction", "F03_courtship", "F05_windibank_visit"],
   "dec_flags": ["checkInconsistencies"]},
 "T03s_identity_dependent_conclusions_sim": {"dataset": "C3", "question": "Same rules, identity available (solver hypothesis) or absent (Mary).",
   "queries": [
    ("T03c_engaged_only_under_hypothesis", "SELECT ?g WHERE { GRAPH ?g { st:pB prof:engagedTo st:pA } }",
     [f"g={W}w20"], "derivable", ["P041.S02"], ["owl:sameAs in w20 (hypothesis)", "conjectural world receives reality"], "w:w20 at C3",
     "Only the identity hypothesis world derives it; Mary's world (w01) does not."),
   ], "seed_iris": [S + "pA", S + "pB", S + "pC"], "require_modules": ["sW20_h_identity", "sW01_mary", "sF02_courtship"]},
 "T04_who_said_what": {"dataset": "gold", "question": "What was said, by whom, to whom (communicative event vs truth of content)?",
   "queries": [
    ("T04a_acts", "SELECT ?act ?speaker ?addressee WHERE { ?act a prof:CommunicativeAct ; crm:P14_carried_out_by ?speaker ; prof:addressee ?addressee . }",
     None, "lookup", ["P041.S03", "P031.S10", "P067.S01", "P115.S02", "P117.S01", "P138.S01"], [], "reality (gold)",
     "Lookup; with identity in reality the speaker of Hosmer's act is also Windibank (de re). Expected set checked per configuration."),
    ("T04b_said_vs_true", "SELECT ?said ?true WHERE { BIND(EXISTS { GRAPH w:v_hosmer_cashier { st:hosmer prof:hasOccupation st:occ_cashier_leadenhall } } AS ?said) BIND(EXISTS { st:hosmer prof:hasOccupation st:occ_cashier_leadenhall } AS ?true) }",
     ['said=true^^http://www.w3.org/2001/XMLSchema#boolean true=false^^http://www.w3.org/2001/XMLSchema#boolean'], "lookup",
     ["P041.S03"], [], "w:v_hosmer_cashier vs reality", "Saying p does not make p true."),
   ], "seed_iris": [S + "hosmer", S + "mary", S + "windibank", W + "v_hosmer_cashier"],
   "require_modules": ["F06_comm_acts", "F07_comm_acts_visit", "F08_holmes_acts", "W08_v_hosmer_cashier", "W02_holmes_reconstruction"]},
 "T05_insincerity": {"dataset": "gold", "question": "Which statements are insincere? (content vs speaker's contemporaneous beliefs)",
   "queries": [
    ("T05a_content_vs_speaker_belief", "SELECT DISTINCT ?content WHERE { ?act prof:hasContent ?content ; crm:P14_carried_out_by ?sp . ?sp prof:believes ?bw . ?content dec:disagreesWith ?bw . }",
     [f"content={W}v_hosmer_cashier", f"content={W}v_windibank_reassure"], "derivable",
     ["P041.S03", "P067.S01", "P126.S11", "P128.S10"],
     ["identity (reconstruction)", "self-knowledge of the speaker (W06, analyst)", "closedFor hasOccupation (assumption)", "Voluntary disjoint Involuntary"],
     "verbatim content vs w:windibank_beliefs (time of the utterances)",
     "Insincerity derivable only under the listed assumptions; Mary's report of the reassurance is hedged ('seemed to think')."),
    ("T05b_sincere_but_false", f"SELECT DISTINCT ?content WHERE {{ ?act prof:hasContent ?content ; crm:P14_carried_out_by ?sp . ?content dec:disagreesWith ?r . {REAL_FILTER} FILTER NOT EXISTS {{ ?sp prof:believes ?bw . ?content dec:disagreesWith ?bw }} }}",
     [f"content={W}v_mary_france"], "derivable", ["P031.S10", "P128.S02", "P128.S07"], ["ActualJourney disjoint PretendedJourney"],
     "w:v_mary_france vs reality and vs w:mary_D1", "A false statement can be sincere."),
   ], "seed_iris": [S + "hosmer", S + "windibank", S + "mary"],
   "require_modules": ["F06_comm_acts", "W08_v_hosmer_cashier", "W09_v_mary_france", "W10_v_windibank_reassure", "W06_windibank_beliefs", "W01_mary_D1", "W02_holmes_reconstruction", "F02_occupation", "F03_courtship"],
   "dec_flags": ["checkInconsistencies"], "closed_for": ["http://example.org/dectective/profile#hasOccupation"]},
 "T06_divergence": {"dataset": "gold", "question": "Which divergences between perspectives are justified by the text?",
   "queries": [
    ("T06a_belief_worlds_vs_reality", f"SELECT DISTINCT ?w WHERE {{ ?agent prof:believes ?w . ?w dec:disagreesWith ?r . {REAL_FILTER} }}",
     [f"w={W}mary_D1"], "incompatible", ["P031.S10", "P039.S01", "P051.S06", "P061.S02", "P128.S02", "P128.S07", "P111.S01"],
     ["ActualJourney disjoint PretendedJourney", "Voluntary disjoint Involuntary", "WeakSighted disjoint KeenSighted (+identity)"],
     "w:mary_D1 vs reality (gold)", "Genuine textual disagreement; 'delusional' is DEC's technical label (cf. Holmes's own word 'delusion', P138.S02)."),
    ("T06b_mary_delusional_label", "ASK { w:mary_D1 a dec:delusionalWorld }", True, "incompatible", ["P128.S02", "P138.S02"], [],
     "w:mary_D1", "Technical classification relative to data and axioms."),
   ], "seed_iris": [S + "hosmer", S + "windibank", S + "mary"],
   "require_modules": ["W01_mary_D1", "W02_holmes_reconstruction", "W07_holmes_prediction", "F03_courtship", "F05_windibank_visit"],
   "dec_flags": ["checkInconsistencies"]},
 "T06x_divergence_ablation_journeys": {"dataset": "gold", "question": "Ablation: without the journey and disappearance axioms, does Mary's world still disagree?",
   "queries": [
    ("T06c_ablation", f"SELECT DISTINCT ?w WHERE {{ ?agent prof:believes ?w . ?w dec:disagreesWith ?r . {REAL_FILTER} }}",
     [f"w={W}mary_D1"], "incompatible", ["P051.S06", "P111.S01"], ["WeakSighted disjoint KeenSighted (+identity)"],
     "w:mary_D1 vs reality", "Expected to remain incompatible through the eyesight axiom alone."),
   ], "seed_iris": [S + "hosmer", S + "windibank", S + "mary"],
   "require_modules": ["W01_mary_D1", "W02_holmes_reconstruction", "F03_courtship", "F05_windibank_visit"],
   "dec_flags": ["checkInconsistencies"], "exclude_axioms": ["ActualJourney", "VoluntaryDisappearance"]},
 "T07_hypotheses_vs_evidence_C3": {"dataset": "C3", "question": "Which hypotheses are incompatible with the evidence available at C3?",
   "queries": [
    ("T07a_C3", f"SELECT DISTINCT ?h WHERE {{ st:solver prof:conjectures ?h . ?h dec:disagreesWith ?r . {REAL_FILTER} }}",
     [], "not-determined", ["P111.S01", "P116.S04", "P118.S06"], [], "solver worlds w20, w21 at C3",
     "Both hypotheses remain admissible at C3: compatibility is not proof."),
   ], "seed_iris": [S + "pC", S + "pB", S + "e2"], "require_modules": ["sW20_h_identity", "sW21_h_external", "sF04_solver", "sF02_courtship"],
   "dec_flags": ["checkInconsistencies"]},
 "T07_hypotheses_vs_evidence_C4": {"dataset": "C4", "question": "Same question after the reconstruction is accepted (C4).",
   "queries": [
    ("T07b_C4", f"SELECT DISTINCT ?h WHERE {{ st:solver prof:conjectures ?h . ?h dec:disagreesWith ?r . {REAL_FILTER} }}",
     [f"h={W}w21"], "incompatible", ["P128.S11"], ["Voluntary disjoint Involuntary"], "solver worlds at C4",
     "H2 (something happened to him) is incompatible with the settled reconstruction."),
   ], "seed_iris": [S + "pC", S + "pB", S + "e2"], "require_modules": ["sW20_h_identity", "sW21_h_external", "sF04_solver", "sW10_holmes", "sF07_reconstruction", "sF02_courtship"],
   "dec_flags": ["checkInconsistencies"]},
 "T07w_watson_rejected": {"dataset": "gold", "question": "Is Watson's rejected hypothesis incompatible with the reconstruction?",
   "queries": [
    ("T07c_watson", "ASK { w:watson_hyp dec:disagreesWith ?x }", False, "not-determined", ["P099.S01", "P100.S01"], [],
     "w:watson_hyp", "Rejected by Holmes but not logically incompatible: no contradiction is manufactured."),
   ], "seed_iris": [S + "letter_H1"], "require_modules": ["W05_watson_hyp", "W02_holmes_reconstruction", "F04_documents"],
   "dec_flags": ["checkInconsistencies"]},
 "T08_update_C2": {"dataset": "C2", "question": "Snapshot C2: is the identity a fact? are the machines identified?",
   "queries": [
    ("T08a_identity_C2", "ASK { st:pC owl:sameAs st:pB }", False, "not-determined", ["P096.S04", "P100.S03"], [], "reality at C2", ""),
   ], "seed_iris": [S + "pC", S + "pB"], "require_modules": ["sW20_h_identity", "sF04_solver"]},
 "T08_update_C3": {"dataset": "C3", "question": "Snapshot C3 (new documentary evidence).",
   "queries": [
    ("T08b_identity_C3", "ASK { st:pC owl:sameAs st:pB }", False, "not-determined", ["P116.S04", "P118.S06"], [], "reality at C3",
     "Evidence added, identity still conjectural (no settle operation in DEC)."),
    ("T08d_same_machine_C3", "ASK { GRAPH w:w22 { st:m1 owl:sameAs st:m2 } }", True, "derivable", ["P116.S01", "P116.S02", "P118.S06"],
     ["hasDefectProfile inverse-functional (Holmes's principle) only in w22"], "w:w22 at C3", "New consequence available only in the later snapshot."),
   ], "seed_iris": [S + "pC", S + "pB", S + "m1", S + "m2"], "require_modules": ["sW20_h_identity", "sW22_h_same_machine", "sF04_solver", "sF06_visit", "sF05_documents"]},
 "T08_update_C4": {"dataset": "C4", "question": "Snapshot C4 (reconstruction accepted).",
   "queries": [
    ("T08c_identity_C4", "ASK { st:pC owl:sameAs st:pB }", True, "lookup", ["P126.S11", "P127.S01"], ["C4 settlement emulated by typing w10 epistemic"],
     "reality at C4", "Manual update of the world type; snapshots C2/C3 are separate files and are not altered."),
    ("T08e_mary_unchanged_C4", "ASK { GRAPH w:w01 { st:pC owl:sameAs st:pB } }", False, "not-determined", ["P079.S02"], [], "w:w01 at C4",
     "Reader learns the identity; Mary's world does not."),
   ], "seed_iris": [S + "pC", S + "pB"], "require_modules": ["sW10_holmes", "sF07_reconstruction", "sW01_mary", "sF03_comm"]},
 "T09_typewriter_C3": {"dataset": "C3", "question": "What can be inferred from the typewritten documents at C3?",
   "queries": [
    ("T09a_typed_on_office_machine", "SELECT ?l WHERE { GRAPH w:w22 { ?l prof:typedOn st:m2 . ?l prof:purportsToBeFrom st:pC } }",
     [f"l={S}d1", f"l={S}d2"], "derivable", ["P116.S01", "P116.S02", "P118.S06", "P117.S01"],
     ["hasDefectProfile inverse-functional (Holmes's individuality principle, caveat 'unless new')"], "w:w22 at C3",
     "Same machine is derivable only under the explicit premise; not in reality."),
    ("T09b_same_machine_not_fact", "ASK { st:d1 prof:typedOn st:m2 }", False, "not-determined", ["P118.S06"], [], "reality at C3",
     "Without the premise the machine identity is not a fact."),
    ("T09c_authorship_alternatives", f"SELECT DISTINCT ?h ?x WHERE {{ ?h dec:disagreesWith ?x . FILTER(?h IN (w:w23, w:w24)) }}",
     [f"h={W}w23 x={W}w24", f"h={W}w24 x={W}w23"], "not-determined", ["P117.S01"],
     ["closedFor writtenBy (single author, assumption)"], "w23 vs w24 at C3",
     "The two authorship hypotheses exclude each other only under the closure; neither is incompatible with the C3 evidence (shared office machine)."),
   ], "seed_iris": [S + "d1", S + "d2", S + "m1", S + "m2", S + "pC", S + "pB"],
   "require_modules": ["sW22_h_same_machine", "sW23_h_author_pB", "sW24_h_author_other", "sF04_solver", "sF05_documents", "sF06_visit"],
   "dec_flags": ["checkInconsistencies"], "closed_for": ["http://example.org/dectective/profile#writtenBy"]},
 "T10_finale": {"dataset": "gold", "question": "Does the ending modify Mary's beliefs?",
   "queries": [
    ("T10a_no_telling_event", "ASK { ?act a prof:CommunicativeAct ; crm:P14_carried_out_by st:holmes ; prof:addressee st:mary . }",
     False, "not-determined", ["P137.S01", "P138.S01"], [], "reality (gold)",
     "No act of Holmes addressed to Mary exists in the text; the telling exists only inside his prediction."),
    ("T10b_rejection_only_predicted", "SELECT ?g WHERE { GRAPH ?g { ?x prof:rejects ?y } }", [f"g={W}holmes_prediction"], "lookup",
     ["P138.S01"], [], "w:holmes_prediction", "Mary's rejection is a predicted, hypothetical reaction."),
    ("T10c_mary_last_belief", "ASK { GRAPH w:mary_D1 { st:hosmer a prof:ExpectedToReturn } }", True, "lookup", ["P079.S03"], [], "w:mary_D1",
     "Mary's last attested belief is unchanged; KGRC d:578 instead asserts 'Sutherland does not believe in Holmes' categorically."),
   ], "seed_iris": [S + "holmes", S + "mary", S + "hosmer"], "require_modules": ["F08_holmes_acts", "W07_holmes_prediction", "W01_mary_D1"]},
}


def main(root):
    base = os.path.join(root, "prototype/fixtures")
    os.makedirs(base, exist_ok=True)
    n = 0
    for tid, spec in T.items():
        d = os.path.join(base, tid)
        os.makedirs(d, exist_ok=True)
        qs = []
        for (qid, body, expected, cls, just, axioms, world, note) in spec["queries"]:
            with open(os.path.join(d, qid + ".rq"), "w", encoding="utf-8") as f:
                f.write(P + body + "\n")
            qs.append({"id": qid, "file": qid + ".rq", "expected": expected, "classification": cls, "justification": just,
                       "axioms_or_assumptions": axioms, "world_time": world, "note": note})
            n += 1
        man = {k: v for k, v in spec.items() if k != "queries"}
        man["queries"] = qs
        with open(os.path.join(d, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(man, f, indent=2, ensure_ascii=False)
    print("fixtures:", len(T), "queries:", n)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
