# Modello concettuale: profilo minimo CIDOC CRM + CRMinf e ponte verso DEC

**Versioni.** CIDOC CRM **7.1.3** (`sources/ontologies/cidoc_crm_v7.1.3.html`, RDFS ufficiale). CRMinf **1.2.1** (rilasciato ad aprile 2026; HTML, RDF e OWL ufficiali), che dichiara esplicitamente la dipendenza da CIDOC CRM v7.1.3 e CRMsci v3.2: le due versioni sono compatibili per dichiarazione degli autori. Profilo locale: `prototype/profile/dtv_profile.ttl` (prefisso `prof:` = `http://example.org/dectective/profile#`; `example.org` è un namespace di comodo, da sostituire con uno di progetto prima di pubblicare).

**Uso intradiegetico.** Persone, eventi, credenze ed enunciati sono quelli del mondo **convenzionalmente ricostruito nel racconto**, non del mondo storico. «Fatto» significa «stabilito nella finzione secondo la ricostruzione di riferimento». Gli eventi reali di pubblicazione, estrazione e annotazione stanno su un piano distinto: il catalogo dei moduli (`prototype/modules/catalog.jsonl`) registra per ogni modulo segmenti testuali, base epistemica (observed, reported, believed, reconstructed, …) e checkpoint; la provenienza dell'annotazione **non** entra nei dati dati a DEC.

## 1. Scope notes che vincolano il modello

- **I1 Argumentation**: «the activity of making **honest** inferences or observations» (l'attore «justifies and believes» il valore di credenza risultante). In CRMinf 1.2.1 «E13 Attribute Assignment rdfs:subClassOf I1 Argumentation» (e S27 Observation ⊑ I1). Né I1 né E13 possono quindi tipizzare un'affermazione insincera di Windibank/Hosmer.
- **I2 Belief**: un I4 tenuto con un valore (vero/falso/intermedio) da un attore per un periodo: ha estensione temporale (⊑ E2).
- **I4 Proposition Set**: neutro rispetto alla realtà. «FALSE means that **at least one** of the propositions in the set is regarded as not corresponding to reality»: FALSE su un insieme **non** autorizza a negare ogni proposizione. Un I4 «may be represented by the URI of a Named Graph» se le proposizioni sono tenute vere dai manutentori, oppure, se tenute possibilmente vere, «if the operation of the Knowledge Base foresees filtering by provenance and likelihood». Le credenze false dei personaggi non rientrano nel primo caso: è proprio il filtro di provenienza di DEC (mondi non epistemici che non permeano) a legittimarne la codifica come named graph. Va dichiarato.
- **I7 Belief Adoption**: adozione basata sulla fiducia nella fonte, non su regole d'inferenza. È adatta a Mary, che crede a ciò che Hosmer le dice o le scrive.
- **I11 Situation** ammette la negazione («persons A and B have met is FALSE») e un periodo minimo di validità (J24).
- **J5 holds to be** ha valore letterale (nel RDF 1.2.1 il range è `rdfs:Literal`).
- **E7 Activity**: azioni intenzionali che cambiano lo stato di sistemi sociali. Vi rientra un atto comunicativo, ingannevole o no.
- **E41 Appellation**: segni che identificano per convenzione in un contesto. Un appellativo non coincide con il suo referente e due appellativi non sono identici perché designano la stessa persona.

## 2. Profilo minimo

| Bisogno | Elemento | Relazione con il CRM |
|---|---|---|
| Persone | `crm:E21_Person` | uso diretto |
| Nomi | `crm:E41_Appellation` + `crm:P1_is_identified_by` | uso diretto; `st:app_hosmer_angel` ≠ `st:app_windibank`, mai identificati |
| Eventi e azioni | `crm:E5_Event`, `crm:E7_Activity`; `prof:Journey`, `prof:Disappearance`, `prof:Impersonation` | specializzazioni (`rdfs:subClassOf`) |
| Documenti | `prof:Letter`/`prof:TypewrittenLetter` ⊑ `crm:E22_Human-Made_Object`; annuncio come `crm:E31_Document` | specializzazione |
| Atto comunicativo | `prof:CommunicativeAct` ⊑ `crm:E7_Activity` (non I1/E13); `crm:P14_carried_out_by`, `prof:addressee`, `prof:hasContent` → I4 (named graph), `prof:reportedBy` | nuova classe locale + collegamenti |
| Credenza attribuita | `inf:I2_Belief`, `inf:J4_that` → I4, `inf:J5_holds_to_be "TRUE"`, `crm:P4_has_time-span`; `prof:heldBy` (scorciatoia: in CRMinf il titolare è indiretto, via I1/I7 P14 + J2) | uso diretto + scorciatoia documentata |
| Adozione | `inf:I7_Belief_Adoption`, `inf:J7_is_based_on_evidence_from` (lettere, enunciati), `inf:J2_concluded_that` | uso diretto |
| Ragionamento | `inf:I5_Inference_Making`, `inf:J1_used_as_premise`, `inf:J3_applied` → `inf:I3_Inference_Logic` (es. «convergent circumstantial evidence», P134.S05), `inf:J2_concluded_that` | uso diretto |
| Intenzione ingannevole | credenza attribuita dall'interprete (Holmes) su ciò che Windibank voleva far credere: I2 di Holmes il cui I4 descrive l'intento (P128.S10) | composizione, nessuna classe nuova |
| Ponte DEC | `prof:believes`, `prof:establishes`, `prof:conjectures`, `prof:uttered` (attore → I4) | scorciatoie del percorso Attore ←P14− I1/I7/I5 −J2→ I2 −J4→ I4 (J5 TRUE); tipizzazione DEC in un modulo separato (`D01_typing`) |

Nessun `owl:equivalentClass`/`owl:equivalentProperty` verso il CRM. Gli assiomi analitici (disgiunzioni tra viaggio effettivo e simulato, scomparsa volontaria e involontaria, vista debole e acuta) stanno in `S03_axioms`, dichiarati come assunzioni. SEM non è introdotto: gli eventi necessari stanno in E5/E7 e nulla richiede ruoli SEM.

## 3. Identità

| Distinzione | Rappresentazione | IRI nei test |
|---|---|---|
| Persona | `crm:E21_Person` | `st:windibank`, `st:mary`, `st:mother`; nel mondo di Mary anche `st:hosmer` come persona |
| Nome/appellativo | `crm:E41_Appellation` | `st:app_hosmer_angel`, `st:app_windibank` (mai `sameAs` tra appellativi) |
| Persona sotto travestimento | `prof:Impersonation` ⊑ E7, `P14 st:windibank`, `prof:usedAppellation st:app_hosmer_angel` | `st:impersonation` (solo nella ricostruzione di Holmes) |
| Identificazione attribuita a un osservatore | I5 di Holmes → I2 → I4 = `w:holmes_reconstruction` contenente `st:hosmer owl:sameAs st:windibank` | mondo epistemico nel gold; congetturale `w:w20` del solutore nei checkpoint |

Regole applicate: nessuna fusione preventiva dei referenti (`st:hosmer` e `st:windibank` restano due IRI); l'identità è un **contenuto** di mondi, mai una normalizzazione globale; l'assenza di `sameAs` nel mondo di Mary non diventa `differentFrom` (non c'è giustificazione testuale per attribuirglielo). DEC confina `sameAs` al mondo in cui compare e ai mondi che ricevono quel mondo per permeazione (E06): nel gold la sostituzione avviene nella realtà (Mary era fidanzata, *de re*, con Windibank: T02c) ma non nel mondo di Mary (T02b). È l'inverso di KGRC, dove la sostituzione è già dentro gli atteggiamenti di Mary (`d:507`, `d:518`, `d:524`). Non bisogna mettere `sameAs` nello shared world: filtrerebbe ovunque (E12).

## 4. Affermazioni, credenze, inganno

Sono rappresentati separatamente:

- «A afferma p» = atto `prof:CommunicativeAct` + mondo **verbatim** con p (`prof:uttered`);
- «A crede p» = I2 (`prof:believes` → mondo doxastic);
- «A crede non-p» = I2 il cui I4 contiene una proposizione incompatibile con p secondo assiomi dichiarati (DEC non ha negazione esplicita di triple);
- «A vuole far credere p a B» = credenza attribuita (da Holmes) sull'intento;
- «B adotta p» = I7 → I2 di B.

Una dichiarazione non comporta la credenza del parlante: il mondo verbatim non permea né riceve nulla. La **classificazione di insincerità** è un'inferenza esterna documentata da tre elementi:

1. **evidenza**: contenuto in disaccordo con il mondo di credenze del parlante;
2. **contemporaneità**: credenza riferita all'intervallo dell'enunciato (il mondo `w:windibank_beliefs` è attribuito al periodo del corteggiamento e del dopo-matrimonio);
3. **intenzione**: solo se attestata (P128.S10, attribuzione di Holmes).

Esiti nel prototipo (T05):

- autodescrizione di Hosmer come cassiere (P041.S03): **insincera** sotto identità + autoconoscenza + chiusura sul mestiere;
- rassicurazione di Windibank (P067.S01): **insincera** sotto disgiunzione volontaria/involontaria, con la cautela che il rapporto di Mary è attenuato («seemed to think»);
- «father went to France» detto da Mary (P031.S10): **falsa ma sincera**;
- «I am delighted to hear it» (P115.S02): **non determinata** (c'è solo l'indizio del sussulto osservato, P115.S01);
- dichiarazioni della madre (P053.S03, P065.S01): **non determinate** (nessuna credenza attestata; la complicità è un'affermazione di Holmes, sostenuta solo indirettamente dal «We» di P127.S02).

**Valori di credenza → contenuti per il motore.** J5 «TRUE» → il mondo riceve il tipo dello stance (doxastic/epistemic/conjectural). «FALSE» su un I4 a più proposizioni non viene tradotto in negazioni: si annota solo, oppure, se l'I4 è un **I17 One-Proposition Set**, si codifica la proposizione incompatibile con un assioma dichiarato. «Possibly true» → mondo congetturale.

## 5. Tempo

Tre assi distinti:

- **tempo della vicenda**: eventi E5/E7 ordinati relativamente (E0…E11, D1, D2 nel catalogo); niente date assolute, perché il testo non ne dà;
- **tempo di acquisizione** per personaggio: mondi datati (es. `w:mary_D1`) e checkpoint del lettore C1…C4;
- **posizione nel testo**: ID di segmento P/S nel catalogo.

DEC non ha tempo né revisione: ogni checkpoint è uno **snapshot** separato e la «settle» è emulata cambiando il tipo del mondo della ricostruzione (congetturale in C2/C3, epistemico in C4).

## 6. Tabella di mapping: costrutti KGRC reali → profilo

Tipi di relazione: **T** trasformazione strutturale, **S** specializzazione, **C** semplice collegamento, **—** nessun equivalente.

| Costrutto KGRC | Elemento del profilo | Tipo | Trasformazione | Perdita informativa | Annotazione aggiuntiva necessaria |
|---|---|---|---|---|---|
| `kgc:Person` (18) | `crm:E21_Person` | T | per IRI, dopo pulizia | nessuna per i personaggi | escludere `d:hansom_carriage`, `d:police`, `d:Single_women`; distinguere `d:Hosmer` persona/persona |
| `rdfs:label` @en/@ja | `crm:P1_is_identified_by` → `crm:E41_Appellation` | T | etichette → appellativi | etichette errate (`d:Hosmer` «サザランド») | revisione manuale delle etichette; appellativi testuali («Hosmer Angel», «James Windibank») |
| `kgc:Situation` + `pred:say` + `kgc:what` | `prof:CommunicativeAct` + mondo verbatim | T | atto + contenuto in named graph | destinatario assente (`infoReceiver` 0); relatore vs parlante confusi | destinatario, relatore, tempo, citazione testuale |
| `kgc:Statement` + `kgc:infoSource` | contenuto di un I4 attribuito (stance da decidere) | T + rilettura | per fonte | lo stance (detto/creduto/saputo/congetturato) non è codificato | stance, tempo, sincerità; disambiguazione dei segnaposto (`d:Hosmer_s_statement` …) |
| `kgc:Thought` (21) | I2 (mondo doxastic) | T | infoSource → titolare | segnaposto (`d:Sutherland_s_thoughts`); 082 attribuisce un pensiero al padre defunto | correzione dei titolari e dei casi distorti |
| `pred:believe` (3 scene) | I2 **oppure** atto commissivo | rilettura | — | `d:207`/`d:244`/`d:287` sono giuramenti/impegni, non credenze | riclassificazione |
| `kgc:subject`/`hasPredicate`/`what`/`whom` (scena n-aria) | triple del profilo (`prof:engagedTo`, `prof:hasOccupation`, …) | T | n-ario → binario per predicato | 206 predicati non tipizzati; ruoli 5W1H generici | tabella predicato KGRC → proprietà del profilo |
| `kgc:hasProperty pred:Hosmer` (`d:504`) | `owl:sameAs` dentro `w:holmes_reconstruction` | T | rilettura dell'identità | nessuna, ma serve contesto | stance (accolta dalla narrazione), corroborazioni (P127, P136) |
| Scene di Holmes con sostituzione (`d:507`, `d:518`, `d:524`) | da **non** riprodurre negli atteggiamenti di Mary | — | scartare o spostare nella realtà | — | ricostruire *de dicto* nel mondo di Mary |
| `kgc:Not`, `pred:not*` | proposizione negativa in I11 (FALSE) o assioma di incompatibilità | T parziale | caso per caso | negazione lessicale non collegata al positivo | definire le incompatibilità richieste |
| `kgc:if` | — (DEC non ha condizionali) | — | annotazione | condizionale perso già in KGRC (`d:579`) | mondo ipotetico (es. `w:holmes_prediction`) |
| `kgc:because`/`therefore` | `inf:J1_used_as_premise` / `inf:J2_concluded_that` | T parziale | dove presenti (5 + 11) | rare; la catena di Holmes non ha premesse collegate | I5 con premesse e logica applicata |
| `kgc:then` | ordine del discorso (segmenti) | C | ID/then → posizione | ordine della vicenda e acquisizione assenti; ciclo in `d:558` | assi temporali separati |
| `kgc:time` (26) | `crm:P4_has_time-span` | — | **non** trasferito | date non testuali e incoerenti | tempo relativo dal testo |
| `kgc:source@en` | — | C | link di confronto | non è testo di Doyle (0/536 verbatim) | allineamento a segmenti del testimone PDF |
| IRI di scena | `prof:alignedWithKGRCScene` (collegamento opzionale) | C | mantenere gli IRI KGRC come riferimento | — | allineamento verificato (`text_graph_alignment.csv`) |

## 7. Mondi e tipi DEC usati nel prototipo

| Mondo | Tipo DEC | Contenuto | Base |
|---|---|---|---|
| `w:mary_D1` | doxastic | credenze di Mary al giorno della visita | P031–P079 |
| `w:holmes_reconstruction` | epistemic (gold) | identità, viaggi simulati, scomparsa volontaria, autore delle lettere, travestimento | P126–P136, corroborato da P127 e P136 |
| `w:holmes_mother`, `w:holmes_motive` | conjectural | complicità della madre; movente economico | P126.S01–S11, P127.S02 |
| `w:watson_hyp` | conjectural | firma dattiloscritta per negarla | P099.S01 (respinta in P100.S01) |
| `w:windibank_beliefs` | doxastic | credenze di Windibank nel periodo degli enunciati (attribuzione dell'analista) | ricostruzione |
| `w:v_*` | verbatim | contenuti di enunciati | P031.S10, P041.S03, P067.S01, P115.S02, P117.S01 |
| `w:holmes_same_machine` / `w:w22` | conjectural | principio d'individualità delle macchine come `owl:InverseFunctionalProperty` | P116.S01–S02 |
| `w:h_author_other` / `w:w24` | conjectural | **alternativa dell'analista** (non testuale): un altro utente della macchina d'ufficio | P117.S01 |
| `w:holmes_prediction` | doxastic | previsione condizionale con individui ipotetici | P138.S01 |
| `w:w20`, `w:w21`, `w:w23` | conjectural | ipotesi del solutore nei checkpoint | — |
