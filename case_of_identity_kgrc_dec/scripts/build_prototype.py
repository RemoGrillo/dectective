#!/usr/bin/env python3
"""Author the prototype modules (gold + simulation checkpoints) and their catalog.

Every module is a small TriG file. The catalog (prototype/modules/catalog.jsonl) records, per module:
  id, dataset (gold|sim), checkpoint (C1..C4 = reader information at the end of the checkpoint
  segment; G = retrospective only), role (schema|dec|fact|world|crminf), graph (world IRI or
  'default'), dec_type (for worlds), segments (sentence IDs of data/text/sentences.csv),
  basis (observed|reported-accepted|reported|believed|hypothesized|reconstructed|admitted|
  predicted|analyst), tags, note.
Metadata stays in the catalog and never enters the RDF given to DEC.

Checkpoints (reader perspective, not Holmes's):
  C1 end of P080 (Mary leaves)          C2 end of P100 (letters examined, two letters written)
  C3 end of P118 (typewriter comparison) C4 end of P130 (reconstruction stated, Windibank's reply)
  G  end of P138 (gold, retrospective; includes P134-P138 explanation to Watson and the firm letter)

Outputs: prototype/profile/dtv_profile.ttl, prototype/modules/{schema,dec,facts,worlds}/*.trig,
         prototype/modules/catalog.jsonl, prototype/gold/gold_retrospective.trig,
         prototype/sim/C1.trig .. C4.trig, prototype/gold/sim_name_map.json (NOT readable by the solver)
Usage: python -I scripts/build_prototype.py <project_root>
"""
import json
import os
import sys

import rdflib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_onto_module import extract, load_sources  # noqa: E402

PFX = """@prefix st:   <http://example.org/dectective/story/> .
@prefix w:    <http://example.org/dectective/world/> .
@prefix prof: <http://example.org/dectective/profile#> .
@prefix crm:  <http://www.cidoc-crm.org/cidoc-crm/> .
@prefix inf:  <http://www.cidoc-crm.org/extensions/crminf/> .
@prefix dec:  <http://w3id.org/conjectures/> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
"""

# ------------------------------------------------------------------ local profile (representation layer)
PROFILE = PFX + """
# Local, minimal extension of CIDOC CRM 7.1.3 / CRMinf 1.2.1 for the intradiegetic model of
# "A Case of Identity". Only specialisations (rdfs:subClassOf / rdfs:subPropertyOf) of official
# terms or new local terms; no owl:equivalentClass / owl:equivalentProperty to CRM terms.

prof:CommunicativeAct a owl:Class ; rdfs:subClassOf crm:E7_Activity ;
  rdfs:comment "An act of telling or writing addressed to someone. Unlike crminf:I1 Argumentation (and E13, a subclass of I1 in CRMinf 1.2.1) it does NOT presuppose sincerity: the speaker's belief in the content is represented separately, if at all." .
prof:Impersonation a owl:Class ; rdfs:subClassOf crm:E7_Activity ;
  rdfs:comment "Acting under a persona identified by an appellation that is not one's own." .
prof:Journey a owl:Class ; rdfs:subClassOf crm:E7_Activity .
prof:ActualJourney a owl:Class ; rdfs:subClassOf prof:Journey .
prof:PretendedJourney a owl:Class ; rdfs:subClassOf prof:Journey ;
  rdfs:comment "A journey announced but not performed." .
prof:Disappearance a owl:Class ; rdfs:subClassOf crm:E5_Event .
prof:VoluntaryDisappearance a owl:Class ; rdfs:subClassOf prof:Disappearance .
prof:InvoluntaryDisappearance a owl:Class ; rdfs:subClassOf prof:Disappearance .
prof:Letter a owl:Class ; rdfs:subClassOf crm:E22_Human-Made_Object .
prof:TypewrittenLetter a owl:Class ; rdfs:subClassOf prof:Letter .
prof:Typewriter a owl:Class ; rdfs:subClassOf crm:E22_Human-Made_Object .
prof:Occupation a owl:Class ; rdfs:subClassOf crm:E55_Type .
prof:WeakSighted a owl:Class ; rdfs:subClassOf crm:E21_Person .
prof:KeenSighted a owl:Class ; rdfs:subClassOf crm:E21_Person .
prof:ExpectedToReturn a owl:Class ; rdfs:subClassOf crm:E21_Person ;
  rdfs:comment "Person whom the believer expects to come back (used only inside belief worlds)." .

prof:hasOccupation a owl:ObjectProperty ; rdfs:domain crm:E21_Person ; rdfs:range prof:Occupation .
prof:engagedTo a owl:ObjectProperty , owl:SymmetricProperty ; rdfs:domain crm:E21_Person ; rdfs:range crm:E21_Person .
prof:stepfatherOf a owl:ObjectProperty ; rdfs:domain crm:E21_Person ; rdfs:range crm:E21_Person .
prof:spouseOf a owl:ObjectProperty , owl:SymmetricProperty .
prof:attended a owl:ObjectProperty ; rdfs:domain crm:E21_Person ; rdfs:range crm:E5_Event .
prof:traveller a owl:ObjectProperty ; rdfs:subPropertyOf crm:P14_carried_out_by ; rdfs:domain prof:Journey .
prof:disappearedPerson a owl:ObjectProperty ; rdfs:subPropertyOf crm:P11_had_participant ; rdfs:domain prof:Disappearance .
prof:wore a owl:ObjectProperty ; rdfs:domain crm:E21_Person .
prof:writtenBy a owl:ObjectProperty ; rdfs:domain prof:Letter ; rdfs:range crm:E21_Person .
prof:purportsToBeFrom a owl:ObjectProperty ; rdfs:domain prof:Letter ;
  rdfs:comment "Apparent sender as shown on the document; not authorship." .
prof:typedOn a owl:ObjectProperty ; rdfs:domain prof:TypewrittenLetter ; rdfs:range prof:Typewriter .
prof:hasDefectProfile a owl:ObjectProperty ; rdfs:domain prof:Typewriter ;
  rdfs:comment "Set of typing defects of a machine. Making it owl:InverseFunctionalProperty encodes Holmes's individuality principle (P116.S01-S02); that axiom is NOT shared: it lives only in the worlds that adopt it." .
prof:showsDefectProfile a owl:ObjectProperty ; rdfs:domain prof:TypewrittenLetter .
prof:usedBy a owl:ObjectProperty ; rdfs:domain prof:Typewriter .
prof:employedBy a owl:ObjectProperty ; rdfs:domain crm:E21_Person ; rdfs:range crm:E74_Group .
prof:assisted a owl:ObjectProperty ; rdfs:subPropertyOf crm:P11i_participated_in .
prof:usedAppellation a owl:ObjectProperty ; rdfs:domain prof:Impersonation ; rdfs:range crm:E41_Appellation .
prof:addressee a owl:ObjectProperty ; rdfs:domain prof:CommunicativeAct ; rdfs:range crm:E39_Actor .
prof:hasContent a owl:ObjectProperty ; rdfs:domain prof:CommunicativeAct ; rdfs:range inf:I4_Proposition_Set ;
  rdfs:comment "The proposition set communicated (encoded as a named graph). Communicating it does not imply belief." .
prof:reportedBy a owl:ObjectProperty ; rdfs:domain prof:CommunicativeAct ; rdfs:range crm:E39_Actor ;
  rdfs:comment "Who reports the act in the text (e.g. Mary reporting Hosmer's words)." .
prof:heldBy a owl:ObjectProperty ; rdfs:domain inf:I2_Belief ; rdfs:range crm:E39_Actor ;
  rdfs:comment "Local shortcut: holder of a belief (CRMinf links it only indirectly via I1/I7 P14 and J2)." .
prof:motive a owl:ObjectProperty .
prof:purpose a owl:ObjectProperty .
prof:rejects a owl:ObjectProperty .

# Governing predicates (DEC bridge). Shortcuts for: Actor <-P14- I7/I1/I5 -J2-> I2 -J4-> I4 (named graph), J5 'TRUE'.
# Their DEC typing is kept in a separate module (dec/D01) so that this profile stays DEC-independent.
prof:believes a owl:ObjectProperty ; rdfs:range inf:I4_Proposition_Set .
prof:establishes a owl:ObjectProperty ; rdfs:range inf:I4_Proposition_Set ;
  rdfs:comment "The actor's account accepted by the narrative as part of the reference reconstruction." .
prof:conjectures a owl:ObjectProperty ; rdfs:range inf:I4_Proposition_Set .
prof:uttered a owl:ObjectProperty ; rdfs:range inf:I4_Proposition_Set ;
  rdfs:comment "Verbatim content of a communicative act; no commitment of the speaker implied." .
"""

CRM_TERMS = ["E21_Person", "E41_Appellation", "E7_Activity", "E5_Event", "E22_Human-Made_Object", "E55_Type", "E74_Group",
             "E39_Actor", "E31_Document", "E52_Time-Span", "P1_is_identified_by", "P14_carried_out_by", "P11_had_participant",
             "P11i_participated_in", "P4_has_time-span", "I2_Belief", "I4_Proposition_Set", "I5_Inference_Making",
             "I7_Belief_Adoption", "I3_Inference_Logic", "J1_used_as_premise", "J2_concluded_that", "J3_applied", "J4_that",
             "J5_holds_to_be", "J7_is_based_on_evidence_from"]

M = []  # module records


def mod(mid, dataset, checkpoint, role, graph, body, segments, basis, tags, dec_type=None, note=""):
    M.append({"id": mid, "dataset": dataset, "checkpoint": checkpoint, "role": role, "graph": graph,
              "dec_type": dec_type, "segments": segments, "basis": basis, "tags": tags, "note": note, "body": body})


def wrap(graph, triples):
    return triples if graph == "default" else f"{graph} {{\n{triples}\n}}\n"


# ================================================================== GOLD (retrospective, real IRIs)
G = "gold"
mod("S01_crm_fragment", G, "C1", "schema", "w:shared", None, [], "schema", ["schema"], dec_type="shared",
    note="generated from official RDFS (extract_onto_module.py)")
mod("S02_profile", G, "C1", "schema", "w:shared", None, [], "schema", ["schema"], dec_type="shared", note="prototype/profile/dtv_profile.ttl")
mod("S03_axioms", G, "C1", "schema", "w:shared", """
prof:ActualJourney owl:disjointWith prof:PretendedJourney .
prof:VoluntaryDisappearance owl:disjointWith prof:InvoluntaryDisappearance .
prof:WeakSighted owl:disjointWith prof:KeenSighted .""", [], "schema",
    ["schema", "axiom"], dec_type="shared", note="analytic disjointness axioms; declared assumptions, not textual facts")
mod("D01_typing", G, "C1", "dec", "default", """
prof:believes a dec:doxasticPredicate .
prof:establishes a dec:epistemicPredicate .
prof:conjectures a dec:conjecturalPredicate .
prof:uttered a dec:verbatimPredicate .
w:shared a dec:sharedWorld .""", [], "dec", ["dec"])
mod("D02_check", G, "C1", "dec", "default", "[] dec:checkInconsistencies true .", [], "dec", ["dec", "conflict"])
mod("D03_closed_writtenBy", G, "C1", "dec", "default", "rdf:subject dec:closedFor prof:writtenBy .", [], "dec",
    ["dec", "closure", "typewriter"], note="ASSUMPTION: a letter has a single author")
mod("D04_closed_occupation", G, "C1", "dec", "default", "rdf:subject dec:closedFor prof:hasOccupation .", [], "dec",
    ["dec", "closure", "occupation"], note="ASSUMPTION: one occupation per person in the story time")

mod("F01_persons", G, "C1", "fact", "default", """
st:mary a crm:E21_Person ; crm:P1_is_identified_by st:app_mary_sutherland .
st:app_mary_sutherland a crm:E41_Appellation ; rdfs:label "Mary Sutherland" .
st:windibank a crm:E21_Person ; crm:P1_is_identified_by st:app_windibank .
st:app_windibank a crm:E41_Appellation ; rdfs:label "Windibank" .
st:hosmer a crm:E21_Person ; crm:P1_is_identified_by st:app_hosmer_angel .
st:app_hosmer_angel a crm:E41_Appellation ; rdfs:label "Hosmer Angel" .
st:mother a crm:E21_Person .
st:holmes a crm:E21_Person . st:watson a crm:E21_Person .
st:windibank prof:stepfatherOf st:mary ; prof:spouseOf st:mother .""",
    ["P014.S01", "P018.S03", "P020.S02", "P021.S01", "P022.S01", "P024.S02"], "reported-accepted", ["persons", "identity"])
mod("F02_occupation", G, "C1", "fact", "default", """
st:windibank prof:hasOccupation st:occ_wine_traveller ; prof:employedBy st:westhouse_marbank .
st:occ_wine_traveller a prof:Occupation . st:westhouse_marbank a crm:E74_Group .""",
    ["P024.S03", "P077.S01"], "reported-accepted", ["occupation", "motive"])
mod("F03_courtship", G, "C1", "fact", "default", """
st:ball a crm:E5_Event .
st:mary prof:attended st:ball . st:hosmer prof:attended st:ball .
st:mary prof:engagedTo st:hosmer .
st:hosmer prof:wore st:tinted_glasses .
st:journey_france_1 a prof:Journey ; prof:traveller st:windibank .
st:journey_france_2 a prof:Journey ; prof:traveller st:windibank .
st:disappearance a prof:Disappearance ; prof:disappearedPerson st:hosmer .""",
    ["P031.S10", "P035.S02", "P039.S01", "P041.S02", "P051.S06", "P057.S03", "P057.S04"], "reported-accepted",
    ["courtship", "identity", "timeline"], note="events experienced by Mary, accepted by the narrative; journeys only as announced")
mod("F04_documents", G, "C2", "fact", "default", """
st:letter_H1 a prof:TypewrittenLetter ; prof:purportsToBeFrom st:hosmer ; prof:typedOn st:machine_H ; prof:showsDefectProfile st:profile_eR14 .
st:letter_H2 a prof:TypewrittenLetter ; prof:purportsToBeFrom st:hosmer ; prof:typedOn st:machine_H .
st:letter_H3 a prof:TypewrittenLetter ; prof:purportsToBeFrom st:hosmer ; prof:typedOn st:machine_H .
st:letter_H4 a prof:TypewrittenLetter ; prof:purportsToBeFrom st:hosmer ; prof:typedOn st:machine_H .
st:machine_H a prof:Typewriter .""",
    ["P094.S02", "P095.S01", "P096.S01", "P096.S02", "P118.S04", "P118.S05"], "observed",
    ["typewriter", "documents"], note="st:machine_H = 'the (unknown) machine the four letters were typed on'; defect profile observed in P118.S06")
mod("F05_windibank_visit", G, "C3", "fact", "default", """
st:windibank a prof:KeenSighted .
st:letter_W a prof:TypewrittenLetter ; prof:writtenBy st:windibank ; prof:typedOn st:office_machine ; prof:showsDefectProfile st:profile_eR14 .
st:office_machine a prof:Typewriter ; prof:hasDefectProfile st:profile_eR14 ; prof:usedBy st:westhouse_staff .
st:machine_H prof:hasDefectProfile st:profile_eR14 .""",
    ["P111.S01", "P112.S01", "P113.S01", "P116.S04", "P116.S05", "P117.S01", "P118.S06"], "observed",
    ["typewriter", "identity", "windibank"],
    note="KeenSighted from narrator (P111); letter_W acknowledged by Windibank (P112-P113); office machine shared (P117, admitted)")
mod("F06_comm_acts", G, "C1", "fact", "default", """
st:ca_hosmer_cashier a prof:CommunicativeAct ; crm:P14_carried_out_by st:hosmer ; prof:addressee st:mary ; prof:hasContent w:v_hosmer_cashier ; prof:reportedBy st:mary .
st:hosmer prof:uttered w:v_hosmer_cashier .
st:ca_mary_france a prof:CommunicativeAct ; crm:P14_carried_out_by st:mary ; prof:addressee st:holmes ; prof:hasContent w:v_mary_france .
st:mary prof:uttered w:v_mary_france .
st:ca_windibank_reassure a prof:CommunicativeAct ; crm:P14_carried_out_by st:windibank ; prof:addressee st:mary ; prof:hasContent w:v_windibank_reassure ; prof:reportedBy st:mary .
st:windibank prof:uttered w:v_windibank_reassure .""",
    ["P031.S10", "P041.S03", "P067.S01", "P067.S02"], "reported", ["communication", "deception"])
mod("F07_comm_acts_visit", G, "C3", "fact", "default", """
st:ca_windibank_delighted a prof:CommunicativeAct ; crm:P14_carried_out_by st:windibank ; prof:addressee st:holmes ; prof:hasContent w:v_windibank_delighted .
st:windibank prof:uttered w:v_windibank_delighted .
st:reaction_start a crm:E5_Event ; crm:P11_had_participant st:windibank .
st:ca_windibank_machine a prof:CommunicativeAct ; crm:P14_carried_out_by st:windibank ; prof:addressee st:holmes ; prof:hasContent w:v_windibank_machine .
st:windibank prof:uttered w:v_windibank_machine .""",
    ["P115.S01", "P115.S02", "P117.S01"], "observed", ["communication", "deception", "typewriter"])
mod("F08_holmes_acts", G, "G", "fact", "default", """
st:ca_holmes_reconstruction a prof:CommunicativeAct ; crm:P14_carried_out_by st:holmes ; prof:addressee st:windibank .
st:ca_holmes_explanation a prof:CommunicativeAct ; crm:P14_carried_out_by st:holmes ; prof:addressee st:watson .
st:ca_holmes_prediction a prof:CommunicativeAct ; crm:P14_carried_out_by st:holmes ; prof:addressee st:watson ; prof:hasContent w:holmes_prediction .""",
    ["P124.S02", "P126.S01", "P128.S12", "P134.S01", "P136.S01", "P138.S01"], "observed", ["communication", "ending"],
    note="no communicative act addressed to Mary after P080 exists in the text")
mod("F09_crminf", G, "G", "crminf", "default", """
st:belief_mary_D1 a inf:I2_Belief ; prof:heldBy st:mary ; inf:J4_that w:mary_D1 ; inf:J5_holds_to_be "TRUE" .
st:adoption_mary a inf:I7_Belief_Adoption ; crm:P14_carried_out_by st:mary ; inf:J7_is_based_on_evidence_from st:letter_H1 ; inf:J2_concluded_that st:belief_mary_D1 .
st:inference_holmes a inf:I5_Inference_Making ; crm:P14_carried_out_by st:holmes ;
   inf:J3_applied st:logic_convergent_abduction ; inf:J2_concluded_that st:belief_holmes_identity .
st:logic_convergent_abduction a inf:I3_Inference_Logic ; rdfs:label "convergent circumstantial evidence (abductive), P134.S05" .
st:belief_holmes_identity a inf:I2_Belief ; prof:heldBy st:holmes ; inf:J4_that w:holmes_reconstruction ; inf:J5_holds_to_be "TRUE" .
st:mary prof:believes w:mary_D1 .
st:holmes prof:establishes w:holmes_reconstruction .
st:holmes prof:conjectures w:holmes_mother .
st:holmes prof:conjectures w:holmes_motive .
st:watson prof:conjectures w:watson_hyp .
st:windibank prof:believes w:windibank_beliefs .
st:holmes prof:believes w:holmes_prediction .
st:holmes prof:conjectures w:holmes_same_machine .
st:analyst prof:conjectures w:h_author_other .""",
    ["P018.S03", "P073.S01", "P099.S01", "P126.S11", "P128.S10", "P134.S05", "P138.S01"], "reconstructed",
    ["crminf", "governing"], note="st:analyst = extradiegetic annotator introducing an alternative hypothesis for testing (not in the text)")

mod("W01_mary_D1", G, "C1", "world", "w:mary_D1", """
st:hosmer prof:hasOccupation st:occ_cashier_leadenhall .
st:journey_france_1 a prof:ActualJourney ; prof:traveller st:windibank .
st:journey_france_2 a prof:ActualJourney ; prof:traveller st:windibank .
st:hosmer a prof:WeakSighted .
st:mary prof:engagedTo st:hosmer .
st:disappearance a prof:InvoluntaryDisappearance ; prof:disappearedPerson st:hosmer .
st:hosmer a prof:ExpectedToReturn .""",
    ["P031.S10", "P039.S01", "P041.S02", "P041.S03", "P051.S06", "P053.S07", "P055.S01", "P059.S02", "P061.S02", "P061.S03", "P079.S02", "P079.S03"],
    "believed", ["mary", "belief", "identity"], dec_type="doxastic",
    note="Mary's beliefs at D1; no later Mary scene in the text; no sameAs, no differentFrom")
mod("W02_holmes_reconstruction", G, "C4", "world", "w:holmes_reconstruction", """
st:hosmer owl:sameAs st:windibank .
st:journey_france_1 a prof:PretendedJourney .
st:journey_france_2 a prof:PretendedJourney .
st:disappearance a prof:VoluntaryDisappearance .
st:letter_H1 prof:writtenBy st:windibank . st:letter_H2 prof:writtenBy st:windibank .
st:letter_H3 prof:writtenBy st:windibank . st:letter_H4 prof:writtenBy st:windibank .
st:impersonation a prof:Impersonation ; crm:P14_carried_out_by st:windibank ; prof:usedAppellation st:app_hosmer_angel .""",
    ["P126.S11", "P127.S01", "P128.S07", "P128.S11", "P134.S02", "P134.S04", "P136.S05", "P136.S06"], "reconstructed",
    ["holmes", "identity", "reconstruction"], dec_type="epistemic",
    note="explanation accepted by the narrative, corroborated by P127 (partial admission) and P136 (firm letter, typed reply)")
mod("W03_holmes_mother", G, "C4", "world", "w:holmes_mother", "st:mother prof:assisted st:impersonation .",
    ["P126.S11", "P127.S02", "P053.S03", "P053.S04", "P128.S03"], "hypothesized", ["mother", "holmes"], dec_type="conjectural",
    note="Holmes's claim ('connivance and assistance'), indirectly supported by Windibank's 'We' (P127.S02); not confirmed by the mother")
mod("W04_holmes_motive", G, "C4", "world", "w:holmes_motive", "st:windibank prof:motive st:motive_keep_income .",
    ["P126.S01", "P126.S02", "P126.S05", "P029.S03"], "hypothesized", ["motive", "holmes"], dec_type="conjectural")
mod("W05_watson_hyp", G, "C2", "world", "w:watson_hyp", "st:letter_H1 prof:purpose st:purpose_deny_signature .",
    ["P099.S01", "P100.S01"], "hypothesized", ["watson", "typewriter", "hypothesis"], dec_type="conjectural",
    note="rejected by Holmes ('that was not the point') but not logically incompatible")
mod("W06_windibank_beliefs", G, "C4", "world", "w:windibank_beliefs", """
st:windibank owl:sameAs st:hosmer .
st:windibank prof:hasOccupation st:occ_wine_traveller .
st:disappearance a prof:VoluntaryDisappearance .
st:journey_france_1 a prof:PretendedJourney .""",
    ["P126.S11", "P127.S01", "P128.S10"], "analyst", ["windibank", "belief", "deception"], dec_type="doxastic",
    note="beliefs attributed to Windibank as the agent of the reconstruction (self-knowledge assumption)")
mod("W07_holmes_prediction", G, "G", "world", "w:holmes_prediction", """
st:hyp_telling a prof:CommunicativeAct ; crm:P14_carried_out_by st:holmes ; prof:addressee st:mary .
st:hyp_reaction prof:rejects st:hyp_telling .""",
    ["P138.S01"], "predicted", ["ending", "holmes"], dec_type="doxastic",
    note="conditional prediction; hypothetical individuals; DEC has no conditional operator")
mod("W08_v_hosmer_cashier", G, "C1", "world", "w:v_hosmer_cashier", "st:hosmer prof:hasOccupation st:occ_cashier_leadenhall .",
    ["P041.S03"], "reported", ["communication", "deception"], dec_type="verbatim")
mod("W09_v_mary_france", G, "C1", "world", "w:v_mary_france", "st:journey_france_1 a prof:ActualJourney .",
    ["P031.S10"], "reported", ["communication", "mary"], dec_type="verbatim")
mod("W10_v_windibank_reassure", G, "C1", "world", "w:v_windibank_reassure",
    "st:disappearance a prof:InvoluntaryDisappearance .\nst:hosmer a prof:ExpectedToReturn .",
    ["P067.S01"], "reported", ["communication", "deception"], dec_type="verbatim",
    note="Mary's hedged report: 'he seemed to think, with me, that something had happened'")
mod("W11_v_windibank_delighted", G, "C3", "world", "w:v_windibank_delighted", "st:windibank prof:motive st:wish_hosmer_found .",
    ["P115.S02"], "observed", ["communication", "deception"], dec_type="verbatim")
mod("W12_v_windibank_machine", G, "C3", "world", "w:v_windibank_machine", "st:letter_W prof:typedOn st:office_machine .\nst:office_machine prof:usedBy st:westhouse_staff .",
    ["P117.S01"], "admitted", ["communication", "typewriter"], dec_type="verbatim")
mod("W13_holmes_same_machine", G, "C3", "world", "w:holmes_same_machine", "prof:hasDefectProfile a owl:InverseFunctionalProperty .",
    ["P116.S01", "P116.S02", "P118.S06"], "hypothesized", ["typewriter", "holmes"], dec_type="conjectural",
    note="Holmes's individuality principle ('no two of them write exactly alike', unless new) as an explicit premise")
mod("W14_h_author_other", G, "C3", "world", "w:h_author_other", "st:letter_H1 prof:writtenBy st:other_clerk .\nst:other_clerk a crm:E21_Person ; prof:employedBy st:westhouse_marbank .",
    [], "analyst", ["typewriter", "hypothesis"], dec_type="conjectural",
    note="ANALYST alternative (not in the text): another user of the shared office machine (P117) typed the letters")

# ================================================================== SIMULATION (reader perspective, neutral IRIs)
NAME_MAP = {"st:mary": "st:pA", "st:windibank": "st:pB", "st:hosmer": "st:pC", "st:mother": "st:pD", "st:holmes": "st:pH",
            "st:watson": "st:pW", "st:app_mary_sutherland": "st:nA", "st:app_windibank": "st:nB", "st:app_hosmer_angel": "st:nC",
            "st:journey_france_1": "st:j1", "st:journey_france_2": "st:j2", "st:disappearance": "st:e2", "st:ball": "st:e1",
            "st:letter_H1": "st:d1", "st:letter_H2": "st:d2", "st:machine_H": "st:m1", "st:office_machine": "st:m2",
            "st:letter_W": "st:d9", "st:profile_eR14": "st:f1", "st:occ_wine_traveller": "st:o1", "st:occ_cashier_leadenhall": "st:o2",
            "st:westhouse_marbank": "st:g1", "st:westhouse_staff": "st:g2", "st:tinted_glasses": "st:x1",
            "st:purpose_deny_signature": "st:u1", "st:wish_hosmer_found": "st:u2"}
S = "sim"
sim_common = [m for m in M if m["role"] in ("schema",)]
mod("sD01_typing", S, "C1", "dec", "default", """
prof:believes a dec:doxasticPredicate .
prof:establishes a dec:epistemicPredicate .
prof:conjectures a dec:conjecturalPredicate .
prof:uttered a dec:verbatimPredicate .
w:shared a dec:sharedWorld .""", [], "dec", ["dec"])
mod("sD02_check", S, "C1", "dec", "default", "[] dec:checkInconsistencies true .", [], "dec", ["dec", "conflict"])
mod("sD03_closed_writtenBy", S, "C1", "dec", "default", "rdf:subject dec:closedFor prof:writtenBy .", [], "dec", ["dec", "closure"],
    note="ASSUMPTION: a letter has a single author")
mod("sF01_persons", S, "C1", "fact", "default", """
st:pA a crm:E21_Person ; crm:P1_is_identified_by st:nA . st:nA a crm:E41_Appellation ; rdfs:label "Mary Sutherland" .
st:pB a crm:E21_Person ; crm:P1_is_identified_by st:nB . st:nB a crm:E41_Appellation ; rdfs:label "Windibank" .
st:pC a crm:E21_Person ; crm:P1_is_identified_by st:nC . st:nC a crm:E41_Appellation ; rdfs:label "Hosmer Angel" .
st:pD a crm:E21_Person . st:pH a crm:E21_Person . st:pW a crm:E21_Person .
st:pB prof:stepfatherOf st:pA ; prof:spouseOf st:pD .
st:pB prof:hasOccupation st:o1 ; prof:employedBy st:g1 . st:o1 a prof:Occupation . st:g1 a crm:E74_Group .""",
    ["P014.S01", "P020.S02", "P021.S01", "P022.S01", "P024.S02", "P024.S03", "P077.S01"], "reported-accepted", ["persons"])
mod("sF02_courtship", S, "C1", "fact", "default", """
st:e1 a crm:E5_Event . st:pA prof:attended st:e1 . st:pC prof:attended st:e1 .
st:pA prof:engagedTo st:pC . st:pC prof:wore st:x1 .
st:j1 a prof:Journey ; prof:traveller st:pB . st:j2 a prof:Journey ; prof:traveller st:pB .
st:e2 a prof:Disappearance ; prof:disappearedPerson st:pC .""",
    ["P031.S10", "P035.S02", "P039.S01", "P041.S02", "P051.S06", "P057.S04"], "reported-accepted", ["courtship"])
mod("sF03_comm", S, "C1", "fact", "default", """
st:a1 a prof:CommunicativeAct ; crm:P14_carried_out_by st:pC ; prof:addressee st:pA ; prof:hasContent w:w03 ; prof:reportedBy st:pA .
st:pC prof:uttered w:w03 .
st:a2 a prof:CommunicativeAct ; crm:P14_carried_out_by st:pB ; prof:addressee st:pA ; prof:hasContent w:w04 ; prof:reportedBy st:pA .
st:pB prof:uttered w:w04 .
st:pA prof:believes w:w01 .""", ["P041.S03", "P067.S01"], "reported", ["communication"])
mod("sW01_mary", S, "C1", "world", "w:w01", """
st:pC prof:hasOccupation st:o2 .
st:j1 a prof:ActualJourney . st:j2 a prof:ActualJourney .
st:pC a prof:WeakSighted . st:pA prof:engagedTo st:pC .
st:e2 a prof:InvoluntaryDisappearance . st:pC a prof:ExpectedToReturn .""",
    ["P031.S10", "P039.S01", "P041.S03", "P051.S06", "P059.S02", "P061.S02", "P079.S03"], "believed", ["mary"], dec_type="doxastic")
mod("sW03_v_cashier", S, "C1", "world", "w:w03", "st:pC prof:hasOccupation st:o2 .", ["P041.S03"], "reported", ["communication"], dec_type="verbatim")
mod("sW04_v_reassure", S, "C1", "world", "w:w04", "st:e2 a prof:InvoluntaryDisappearance .\nst:pC a prof:ExpectedToReturn .", ["P067.S01"], "reported",
    ["communication"], dec_type="verbatim")
# reader/solver hypotheses (attributed to the simulated solver, st:solver), available from C1 on
mod("sF04_solver", S, "C1", "fact", "default", "st:solver prof:conjectures w:w20 .\nst:solver prof:conjectures w:w21 .", [], "analyst", ["hypothesis"])
mod("sW20_h_identity", S, "C1", "world", "w:w20", "st:pC owl:sameAs st:pB .", [], "analyst", ["hypothesis", "identity"], dec_type="conjectural",
    note="solver hypothesis H1: the man known as Hosmer Angel is the stepfather")
mod("sW21_h_external", S, "C1", "world", "w:w21", "st:e2 a prof:InvoluntaryDisappearance .", [], "analyst", ["hypothesis"], dec_type="conjectural",
    note="solver hypothesis H2: something happened to him (Mary's view as a hypothesis)")
mod("sF05_documents", S, "C2", "fact", "default", """
st:d1 a prof:TypewrittenLetter ; prof:purportsToBeFrom st:pC ; prof:typedOn st:m1 .
st:d2 a prof:TypewrittenLetter ; prof:purportsToBeFrom st:pC ; prof:typedOn st:m1 .
st:m1 a prof:Typewriter .
st:pW prof:conjectures w:w05 .""", ["P095.S01", "P096.S01", "P099.S01"], "observed", ["typewriter"])
mod("sW05_watson", S, "C2", "world", "w:w05", "st:d1 prof:purpose st:u1 .", ["P099.S01"], "hypothesized", ["watson"], dec_type="conjectural")
mod("sF06_visit", S, "C3", "fact", "default", """
st:pB a prof:KeenSighted .
st:d9 a prof:TypewrittenLetter ; prof:writtenBy st:pB ; prof:typedOn st:m2 ; prof:showsDefectProfile st:f1 .
st:m2 a prof:Typewriter ; prof:hasDefectProfile st:f1 ; prof:usedBy st:g2 .
st:m1 prof:hasDefectProfile st:f1 .
st:a3 a prof:CommunicativeAct ; crm:P14_carried_out_by st:pB ; prof:addressee st:pH ; prof:hasContent w:w06 .
st:pB prof:uttered w:w06 .
st:solver prof:conjectures w:w22 .""",
    ["P111.S01", "P112.S01", "P113.S01", "P116.S04", "P117.S01", "P118.S06", "P115.S02"], "observed", ["typewriter", "visit"])
mod("sW06_v_delighted", S, "C3", "world", "w:w06", "st:pB prof:motive st:u2 .", ["P115.S02"], "observed", ["communication"], dec_type="verbatim")
mod("sW22_h_same_machine", S, "C3", "world", "w:w22", "prof:hasDefectProfile a owl:InverseFunctionalProperty .", ["P116.S01", "P116.S02"], "hypothesized",
    ["typewriter", "hypothesis"], dec_type="conjectural")
mod("sF08_solver_authorship", S, "C3", "fact", "default", "st:solver prof:conjectures w:w23 .\nst:analyst prof:conjectures w:w24 .", [], "analyst",
    ["hypothesis", "typewriter"])
mod("sW23_h_author_pB", S, "C3", "world", "w:w23", "st:d1 prof:writtenBy st:pB .\nst:d2 prof:writtenBy st:pB .", ["P117.S01", "P118.S04"], "analyst",
    ["hypothesis", "typewriter"], dec_type="conjectural", note="solver hypothesis: the stepfather typed the letters")
mod("sW24_h_author_other", S, "C3", "world", "w:w24", "st:d1 prof:writtenBy st:q1 .\nst:q1 a crm:E21_Person ; prof:employedBy st:g1 .", ["P117.S01"], "analyst",
    ["hypothesis", "typewriter"], dec_type="conjectural", note="ANALYST alternative (not in the text): another user of the shared office machine")
mod("sF07_reconstruction", S, "C4", "fact", "default", "st:pH prof:establishes w:w10 .", ["P126.S11", "P127.S01", "P128.S07"], "reconstructed", ["reconstruction"])
mod("sW10_holmes", S, "C4", "world", "w:w10", """
st:pC owl:sameAs st:pB .
st:j1 a prof:PretendedJourney . st:j2 a prof:PretendedJourney .
st:e2 a prof:VoluntaryDisappearance .""",
    ["P126.S11", "P127.S01", "P128.S07", "P128.S11"], "reconstructed", ["reconstruction", "identity"], dec_type="epistemic",
    note="C4 settlement emulated by authoring: the reconstruction is typed epistemic (DEC has no settle operation)")

CK = ["C1", "C2", "C3", "C4", "G"]


def body_of(m, root, crm_fragment_ttl, profile_ttl):
    if m["id"] in ("S01_crm_fragment",):
        inner = crm_fragment_ttl
    elif m["id"] == "S02_profile":
        inner = profile_ttl
    else:
        inner = m["body"]
    return inner


def main(root):
    pdir = os.path.join(root, "prototype")
    for sub in ("profile", "modules/schema", "modules/dec", "modules/facts", "modules/worlds", "gold", "sim"):
        os.makedirs(os.path.join(pdir, sub), exist_ok=True)
    with open(os.path.join(pdir, "profile/dtv_profile.ttl"), "w", encoding="utf-8") as f:
        f.write(PROFILE)
    prof_g = rdflib.Graph().parse(data=PROFILE, format="turtle")
    frag = extract(load_sources(root), CRM_TERMS)
    # strip prefixes from serialisations: we wrap the triple lines inside a named graph
    def nt_lines(g):
        return "\n".join(sorted(l for l in g.serialize(format="nt").splitlines() if l.strip()))
    crm_nt, prof_nt = nt_lines(frag), nt_lines(prof_g)
    catalog = []
    for m in M:
        sub = {"schema": "schema", "dec": "dec", "fact": "facts", "crminf": "facts", "world": "worlds"}[m["role"]]
        path = os.path.join("prototype/modules", sub, m["id"] + ".trig")
        inner = body_of(m, root, crm_nt, prof_nt)
        text = PFX + "\n" + wrap(m["graph"], inner) + "\n"
        rdflib.Dataset().parse(data=text, format="trig")      # syntax check
        with open(os.path.join(root, path), "w", encoding="utf-8") as f:
            f.write(text)
        rec = {k: v for k, v in m.items() if k != "body"}
        rec["file"] = path
        catalog.append(rec)
    # sim shares the schema modules of gold (no story content in them)
    for rec in list(catalog):
        if rec["role"] == "schema" and rec["dataset"] == "gold":
            r2 = dict(rec); r2["id"] = "s" + rec["id"]; r2["dataset"] = "sim"; catalog.append(r2)
    with open(os.path.join(pdir, "modules/catalog.jsonl"), "w", encoding="utf-8") as f:
        for rec in catalog:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def assemble(records, out):
        ds = rdflib.Dataset()
        for rec in records:
            ds.parse(os.path.join(root, rec["file"]), format="trig")
        ds.serialize(destination=out, format="trig")
        n = sum(len(g) for g in ds.graphs())
        return n
    gold_recs = [r for r in catalog if r["dataset"] == "gold"]
    n = assemble(gold_recs, os.path.join(pdir, "gold/gold_retrospective.trig"))
    print("gold modules", len(gold_recs), "triples", n)
    for k in CK[:4]:
        recs = [r for r in catalog if r["dataset"] == "sim" and CK.index(r["checkpoint"]) <= CK.index(k)]
        n = assemble(recs, os.path.join(pdir, f"sim/{k}.trig"))
        print("sim", k, "modules", len(recs), "triples", n)
    with open(os.path.join(pdir, "gold/sim_name_map.json"), "w", encoding="utf-8") as f:
        json.dump({"note": "gold<->simulation name map; for leakage checking and evaluation only, never given to the solver",
                   "map": NAME_MAP}, f, indent=2)
    print("crm fragment triples", len(frag), "profile triples", len(prof_g))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
