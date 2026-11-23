# Dove serve davvero il motore inferenziale: test, baseline e limiti

**Stato di esecuzione.** Il reasoner DEC degli autori (`fvitali/dec-reasoner` @ `e6775b39`) è stato **compilato ed eseguito**. Ogni risultato qui sotto è **osservato** su quel codice, salvo dove è indicato «atteso». Nessuna implementazione ad hoc ne sostituisce il comportamento: il runner (`prototype/runner/Runner.java`) carica i dati, misura e interroga. L'unica modifica d'esecuzione è la variante «strumentata», che ripete la sequenza pubblica di `handlePermeation()` con dei timer, e la sua equivalenza al percorso normale è verificata per ogni query confrontando l'hash della materializzazione.

## 1. Quattro attività distinte

| Attività | Che cosa la realizza | Test |
|---|---|---|
| 1. Recuperare ciò che è espresso | query SPARQL (anche su KGRC originale) | T01b, T04a, T04b, T10b, T10c |
| 2. Derivare conseguenze da assiomi/regole | base reasoner OWL FB di Jena (non DEC) | T01c, T02c, T03c, T08d, T09a |
| 3. Confrontare ipotesi, rilevare incompatibilità | DEC `checkInconsistencies` (validazione OWL su coppie di mondi) e `closedFor` | T05a/b, T06a–c, T07a–c, T09c |
| 4. Proporre spiegazioni abduttive / interpretare il testo | **nessun motore**: annotazione umana (ricostruzione di Holmes, attribuzione di credenze) | tutti i mondi del gold; T05 dipende da `w:windibank_beliefs`, attribuito dall'analista |

Leggere una conclusione già presente non è dedurla. In KGRC «chi è Hosmer?» si risolve leggendo `d:504` (Q05); nel prototipo T01a legge l'identità che il mondo epistemico di Holmes porta nella realtà. DEC **non** estrae dal testo e **non** produce regole investigative: le premesse (per esempio il principio d'individualità delle macchine come `owl:InverseFunctionalProperty`) sono scritte e attribuite a mano.

## 2. Configurazioni confrontate (stessi dati, stessi assiomi, stesse query, stesso Jena 4.8.0 `OWLFBRuleReasoner`)

- **(0) KGRC originale**: query rdflib sul TTL (`prototype/results/kgrc_baseline.json`).
- **asserted**: dataset derivato senza inferenza.
- **flat**: tutte le triple in un unico grafo con inferenza OWL; ogni nome di grafo punta a quell'unico grafo. È la prova del problema.
- **ctx**: named graph inferiti separatamente, ciascuno con il mondo shared; realtà = default + shared. Nessuna permeazione epistemica né congetturale, nessun controllo tra mondi. È la baseline «correttamente contestualizzata».
- **dec**: reasoner DEC.

Ogni query gira sulla propria slice (`dec_performance.md`): stessi dati per tutte le configurazioni. Nessuna configurazione usa informazioni in più: le differenze dipendono dal motore, non dall'arricchimento.

## 3. Esiti (29 query con attesa verificabile; T04a ha risposte diverse per configurazione e non ha un'unica attesa)

| Configurazione | Risposte conformi all'attesa |
|---|---|
| asserted | 15/29 |
| flat | 10/29 |
| ctx | 15/29 |
| **dec** | **28/29** |

| Test | Domanda e attesa | asserted | flat | ctx | dec | Classe |
|---|---|---|---|---|---|---|
| T01a | Hosmer = ? nella realtà → Windibank | – | ✓ | – | ✓ | lookup (contenuto epistemico) |
| T01b | stesso, interrogando il mondo di Holmes | ✓ | ✓ | ✓ | ✓ | lookup |
| T01c | Windibank portava occhiali colorati (sostituzione) → vero | – | ✓ | – | ✓ | derivabile |
| T02a | Mary attribuisce l'identità? → no | ✓ | ✗ (fuga) | ✓ | ✓ | non determinato |
| T02b | Mary fidanzata con Windibank *nel suo mondo*? → no | ✓ | ✗ (fuga) | ✓ | ✓ | non determinato |
| T02c | Mary fidanzata con Windibank *de re* nella realtà → sì | – | ✓ | – | ✓ | derivabile |
| T03a | «Windibank vista debole» nella realtà → no | ✓ | ✗ | ✓ | ✓ | non determinato |
| T03b | in quali mondi Mary è fidanzata con Windibank → nessuno | ✓ | ✗ | ✓ | ✓ | non determinato |
| T03c | sotto ipotesi d'identità (C3) → solo `w:w20` | – | ✗ | – | ✓ | derivabile |
| T04b | detto vs vero (cassiere) → detto sì, vero no | ✓ | ✗ («detto = vero») | ✓ | ✓ | lookup |
| T05a | contenuti in disaccordo con le credenze del parlante | – | – | – | ✓ | derivabile con assunzioni |
| T05b | falso ma sincero → `w:v_mary_france` | – | – | – | ✓ | derivabile |
| T06a/b | mondo di Mary in disaccordo con la realtà; etichetta delusional | – | – | – | ✓ | incompatibile |
| T06c | ablazione: solo l'assioma sulla vista | – | – | – | ✓ | incompatibile |
| T07a | ipotesi incompatibili a C3 → nessuna | ✓ | ✓ | ✓ | ✓ | non determinato |
| T07b | ipotesi incompatibili a C4 → `w:w21` | – | – | – | ✓ | incompatibile |
| T07c | ipotesi di Watson incompatibile? → no | ✓ | ✓ | ✓ | ✓ | non determinato |
| T08a/b | identità come fatto a C2/C3 → no | ✓ | ✗ | ✓ | ✓ | non determinato |
| T08c | identità come fatto a C4 → sì | – | ✓ | – | ✓ | lookup |
| T08d | stessa macchina nel mondo del principio (C3) → sì | – | ✓ | – | ✓ | derivabile |
| T08e | mondo di Mary invariato a C4 → sì | ✓ | ✗ | ✓ | ✓ | non determinato |
| T09a | lettere battute sulla macchina d'ufficio (nel mondo del principio) | – | ✓ | – | ✓ | derivabile |
| T09b | stessa macchina come fatto → no | ✓ | ✗ | ✓ | ✓ | non determinato |
| T09c | ipotesi d'autore in esclusione reciproca solo per chiusura | – | – | – | ✗ (difetto) | non determinato |
| T10a | Holmes parla a Mary dopo P080? → no | ✓ | ✗ | ✓ | ✓ | non determinato |
| T10b | il rifiuto di Mary esiste solo nella previsione → `w:holmes_prediction` | ✓ | ✗ | ✓ | ✓ | lookup |
| T10c | ultima credenza attestata di Mary invariata | ✓ | ✓ | ✓ | ✓ | lookup |

Legenda: ✓ conforme; – risposta mancante (vuota o falsa dove l'attesa è positiva); ✗ risposta errata. «Non determinato» indica una risposta **non derivata** e non va letto come «falso». Per esempio T02a dice che il testo non attribuisce l'identità a Mary, non che Mary creda che i due siano persone diverse.

**Dettaglio di T09c.** DEC restituisce le due coppie attese (`w23`↔`w24`, in esclusione per la chiusura «un solo autore») più `w23`/`w24 disagreesWith w22`. L'ablazione senza `closedFor` elimina **ogni** disaccordo (`prototype/results/ablations/summary.json`, `scripts/run_ablations.py`). Le coppie in più sono falsi positivi del difetto di `verifyClosedFor`: tutti i mondi congetturali ricevono dalla realtà `d9 writtenBy pB` con lo **stesso** valore.

**Dettaglio di T05.** `closedFor prof:hasOccupation` marca anche `w:windibank_beliefs` come delusional rispetto alla realtà (stesso mestiere, stesso difetto). Con il solo `checkInconsistencies`, T05a trova `v_windibank_reassure` (disgiunzione volontaria/involontaria); con il solo `closedFor` trova `v_hosmer_cashier`. Le due misure servono insieme, e ciascuna dipende da un'assunzione dichiarata.

## 4. Dove DEC aggiunge valore e dove no

**Aggiunge valore (cambia il comportamento a parità di dati e assiomi):**

1. **Permeazione tipizzata epistemico → realtà**: T01a, T01c, T02c, T08c. `ctx` non vede l'identità accolta dalla narrazione se non si scrivono query sul mondo specifico (T01b) o non si copia a mano il mondo nella realtà.
2. **Mondi congetturali che ricevono la realtà**: T03c, T08d, T09a. Le conseguenze di un'ipotesi o di un principio (individualità delle macchine) sui fatti disponibili restano confinate al mondo. `ctx` non lo fa senza permeazione manuale; `flat` lo fa, ma contaminando tutto il resto.
3. **Isolamento dei punti di vista con identità attiva nella realtà**: T02a, T02b, T08e. DEC e `ctx` evitano entrambi la fuga che `flat` produce. Qui DEC **non** è necessario: basta la contestualizzazione corretta.
4. **Rilevazione automatica di disaccordi tra mondi**: T05, T06, T07b. Nessuna baseline la offre senza una procedura dedicata: unione di coppie di mondi e validazione OWL, cioè esattamente ciò che DEC automatizza.

**Non aggiunge valore:**

- lookup e chi-ha-detto-cosa (T01b, T04, T10b, T10c);
- identità d'origine: DEC la legge, non la scopre;
- tutto ciò che è interpretazione o abduzione (attribuire credenze, intenzioni, sincerità; scegliere le premesse);
- ordine e tempo: nessuna revisione temporale, i checkpoint sono snapshot (T08), la «settle» è emulata cambiando a mano il tipo di un mondo;
- annidamento («A crede che B creda p»: non interpretato, E07);
- condizionali (la previsione di P138 vive in un mondo ipotetico senza semantica condizionale).

## 5. Conflitto logico, violazione di vincoli, risultato di query

- **Conflitto logico**: unione di due mondi insoddisfacibile sotto OWL FB (es. `ActualJourney ⊥ PretendedJourney`). È ciò che `checkInconsistencies` rileva.
- **Chiusura**: incompatibilità introdotta da un'assunzione locale (`closedFor`), non da OWL. Nel codice attuale è difettosa.
- **Violazione SHACL**: non usata. Sarebbe un controllo di forma (es. ogni atto comunicativo ha un parlante), non un'incompatibilità tra credenze.
- **Risultato di query**: «non trovato» non è «falso». T02a, T07a, T08a/b, T09b, T10a sono non determinati, non negati.

## 6. Etichetta «delusional»

È una **classificazione tecnica relativa ai dati e agli assiomi**: un mondo è delusional se in coppia con la realtà dà inconsistenza. Il mondo di Mary lo è (T06b) per divergenze testuali reali: viaggi simulati (P128.S07), scomparsa volontaria (P128.S11), vista acuta di Windibank (P111.S01) contro le sue credenze (P031.S10, P061.S02, P051.S06). Non è un giudizio psicologico: Mary è stata ingannata. Coincidenza del testo: Holmes stesso chiama «delusion» la convinzione di Mary («whoso snatches a delusion from a woman», P138.S02). Nessuna contraddizione è stata costruita artificialmente: l'ipotesi di Watson, respinta da Holmes ma logicamente compatibile, resta **non** incompatibile (T07c). Anche i mondi **verbatim** ricevono l'etichetta (E08): per un enunciato ingannevole significa solo «contenuto falso rispetto alla ricostruzione».

## 7. Analisi retrospettiva e simulazione progressiva

- **Retrospettiva** (`prototype/gold/gold_retrospective.trig`): la ricostruzione di Holmes è epistemica solo nelle parti accolte e corroborate (P127, P136). Complicità della madre e movente economico restano congetturali; Watson resta congetturale; la previsione finale resta doxastica e ipotetica.
- **Simulazione** (`prototype/sim/C1–C4.trig`): IRI neutri (`st:pA`…), checkpoint del **lettore** (non di Holmes: per esempio la lettera della ditta arriva al lettore solo in P136, dopo C4), ipotesi attribuite a un solutore (`st:solver`) o all'analista (`st:analyst`, per l'alternativa non testuale). Controlli di fuga (`scripts/check_leakage.py`): statici sul gold mappato, schemi critici, lessicali e dinamici con DEC sulla parte che raggiunge la realtà. **0 fughe in C1–C4**. Il controllo lessicale ha intercettato una fuga reale introdotta in fase di sviluppo, un commento del profilo condiviso che citava «Windibank as 'Hosmer Angel'» (`prototype/results/leakage_report_before_fix.json`), poi corretta.
- **Unicità.** A C3 entrambe le ipotesi (identità; «gli è successo qualcosa») sono **ammissibili** (T07a). Solo a C4, quando la ricostruzione è accolta, H2 diventa incompatibile. Le due ipotesi d'autore delle lettere si escludono **solo** sotto la chiusura dichiarata (T09c); senza di essa restano entrambe compatibili.

## 8. Limiti

Annotazione a cura di un solo analista; 10 test, 30 query, dataset minimo (gold di 465 triple); assiomi analitici dichiarati (disgiunzioni, chiusure); `w:windibank_beliefs` e `w:h_author_other` sono attribuzioni dell'analista; regime OWL FB (niente property chain, niente OWL 2 DL); difetti del reasoner documentati in `dec_reasoner_notes.md`.
