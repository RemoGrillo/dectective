# DEC: paper, codice e comportamento osservato

**Fonti.** Paper: Vitali & Pasqual, *Provenance-Enhanced Statements in Knowledge Graphs*, arXiv:2606.15246, **v1** (13 giugno 2026), `sources/papers/arxiv_2606.15246v1.pdf`, letto per intero (sezioni 1–7). Codice: `fvitali/dec-reasoner`, branch `main` @ `e6775b39e228…` (2026-07-06), clonato in `vendor/dec-reasoner`, licenza MIT. Il README del repository cita lo stesso articolo e il dimostratore `https://w3id.org/conjectures/dec`, e il paper (nota 7) rimanda a `https://w3id.org/conjectures/dec/code/reasoner`: si tratta dello stesso framework DEC (Doxastic, Epistemic, Conjectural), non di un sistema omonimo.

**Build e test.** Java 21 (target 17), Maven 3.9.9 locale, Jena/Fuseki 4.8.0. `mvn package` riuscito; `mvn test`: **32 test, 0 fallimenti, 1 saltato** (`prototype/results/logs/dec_mvn_test.log`). Esecuzione headless: `new DecDataset(null,false,false,true,timeout, ReasonerRegistry.getOWLReasoner(), levels)` + SPARQL ARQ sul dataset (`prototype/runner/…/Runner.java`). Base reasoner: `OWLFBRuleReasoner` (regime OWL "FB" di Jena: regole forward/backward, non OWL 2 DL completo; niente property chain).

## 1. Che cosa fa (paper §4–5) e come è implementato

| Aspetto | Paper | Codice osservato |
|---|---|---|
| Mondi | Insiemi di affermazioni con la stessa provenienza; tipi doxastic, epistemic, conjectural, verbatim, shared, delusional, reality | `DecUtils.decCategories`: verbatim, doxastic, epistemic, conjectural, **nirvana**, shared, reality, **union**, **colored**, **error**, **special** (gli ultimi cinque non sono documentati) |
| Tipizzazione | Tipo diretto del grafo o predicato governante (diretto/inverso); Tab. 1 usa `dec:reverseEpistemicPredicate` | Riconosce `dec:<cat>World`, `dec:<cat>Predicate`, `dec:<cat>ReversePredicate` (ordine del README, **non** quello del paper), `rdfs:range dec:<cat>World`, e una famiglia non documentata `dec:pointofviewPredicate` |
| Permeazione | doxastic ← shared; epistemic ← shared e → reality; conjectural ← shared + reality; reality ← shared + epistemic; verbatim isolato | Matrice `DecPermeations` coerente con il paper per i tipi documentati |
| Rappresentazioni | named graph, RDF-star, reificazione | Handler separati; vedi E11 sotto per la reificazione |
| Default | grafi con nome non tipizzati → **doxastic**; reificazione/quoted → verbatim | Un grafo con nome non tipizzato risulta **verbatim** (E05) |
| Identità | `owl:sameAs` trattato come ogni predicato ontologico, confinato al mondo in cui compare (§4.4) | Confermato (E06, E12) |
| Disaccordi | `checkInconsistencies`: coppie di mondi soddisfacibili insieme? `closedFor`: valori alternativi incompatibili | `verifyInconsistencies`: tutte le coppie tranne shared/special, ciascuna con un nuovo `InfModel` (costo O(n²)); `verifyClosedFor`: **difettoso** (§3) |
| Settle | Operatore dinamico (§3.2.2, §4.5) | **Non implementato**: nessuna operazione `settle` nel codice; gli aggiornamenti si emulano modificando il tipo di un mondo |
| Aggiornamenti | «handled incrementally» (§5.1) | Materializzazione completa via `handlePermeation()`; una seconda chiamata ricomputa tutto (§4) |
| Piattaforma | «built on Apache Jena Fuseki 5» (§5) | pom: Jena/Fuseki **4.8.0** |

Dettaglio rilevante per le misure: `DecWorld.getInfModel()` **copia le triple permeate nel grafo base del mondo** (`baseModel.add(stmt)`). Dopo la materializzazione il grafo base non coincide più con quanto asserito; inoltre `restoreDefaultGraph()` copia la realtà inferita nel default graph e rimuove il mondo `dec:reality`. In SPARQL la realtà si interroga quindi **nel default graph**: `GRAPH dec:reality {…}` non restituisce nulla dopo il restore (E03, sonda SPARQL).

## 2. Test esplorativi (`prototype/exploratory/E*.trig`, `scripts/run_exploratory.py`)

Le attese codificano il comportamento **documentato** (paper/README); quando l'esito differisce, la differenza è registrata come risultato, non nascosta.

| Test | Esito | Commento |
|---|---|---|
| E01 verbatim | come documentato | nessuna inferenza interna; nulla verso la realtà |
| E02 doxastic | come documentato | riceve shared, inferisce localmente, isolato dalla realtà in entrambe le direzioni |
| E03 epistemic | come documentato nella vista materializzata | permea nella realtà; in SPARQL visibile nel default graph ma **non** con `GRAPH dec:reality` |
| E04 conjectural | come documentato | riceve realtà e shared; le conseguenze non tornano nella realtà |
| E05 grafo con nome non tipizzato | **differisce dal paper** | tipizzato verbatim, nessuna inferenza (il paper indica doxastic) |
| E06 identità | come documentato | `sameAs` nella realtà non entra nel mondo doxastic di Lois; entra nel conjectural; un `sameAs` asserito *dentro* un doxastic sostituisce localmente |
| E07 attribuzione annidata | solo osservato | un mondo governato **dall'interno** di un altro mondo non viene riconosciuto (resta verbatim): «A crede che B creda p» si memorizza ma non si interpreta |
| E08 verbatim in conflitto | solo osservato | anche un mondo **verbatim** viene marcato `disagreesWith dec:reality` e `delusionalWorld`: il controllo ragiona sull'unione delle due coppie |
| E09 `closedFor` | come documentato | valori diversi → disaccordo; il mondo doxastic opposto all'epistemic risulta delusional |
| E10 disgiunzione OWL | come documentato | `disjointWith` nello shared genera disaccordo |
| E11 reificazione + predicato doxastic | solo osservato | viene creato un mondo, ma dopo il restore nessuna inferenza locale è osservabile né riemessa |
| E12 `sameAs` nello shared | come documentato (rischio) | l'identità nello shared **filtra in ogni mondo non verbatim**: errore di configurazione da evitare |
| E13 `closedFor`, valori identici | **differisce dal paper** | due mondi con lo **stesso** valore risultano in disaccordo (falso positivo) |
| E14 `closedFor`, `break` | come documentato in questa esecuzione | il rischio di mancata rilevazione dipende dall'ordine di iterazione; non riprodotto |

## 3. Difetto in `verifyClosedFor` (DecStatementHandler.java, commit e6775b39)

```java
if (objects1.isEmpty() || objects2.isEmpty()) break;          // ~r. 576: 'break' interrompe il ciclo sui soggetti
...
if (matchedInObjects1.size() <= objects1.size() || matchedInObjects2.size() <= objects2.size()) { // ~r. 586
    // registra disagreesWith (e delusionalWorld se una delle due è la realtà)
```

Gli insiemi «matched» sono sottoinsiemi degli insiemi completi, quindi la condizione `<=` è sempre vera: basta che due mondi assegnino **un qualsiasi valore** del predicato chiuso allo stesso soggetto perché risultino in disaccordo, anche con valori identici (riprodotto in E13). La semantica del paper («worlds assigning different objects to the same subject are incompatible») richiederebbe `<`. Il `break` al primo soggetto assente nell'altro mondo interrompe l'esame degli altri soggetti, rendendo la rilevazione dipendente dall'ordine.

Effetto sul caso. In T05 la combinazione `closedFor prof:hasOccupation` marca `w:windibank_beliefs` come in disaccordo con la realtà e quindi **delusional**, benché assegni lo stesso mestiere che la realtà contiene (ablazione in `reports/reasoning_assessment.md`). Le risposte dei test che usano `closedFor` vanno lette tenendo conto del difetto. Non ho corretto il codice degli autori: una variante corretta sarebbe un'altra implementazione e non va presentata come validazione del loro reasoner.

## 4. Prestazioni osservate durante la messa a punto (dettagli in `dec_performance.md`)

- Checkpoint C1 completo (352 triple asserite, 7 mondi, schema CRM nel mondo shared): `handlePermeation` **50,8 s**; una seconda chiamata esplicita **80,5 s** invece di essere nulla, perché un mondo (il default world ricreato da `prepareRestore`) resta «not ready». Risultato: 12.695 triple materializzate (×36), ridondanza 4,5.
- Il controllo di leak dinamico sui checkpoint completi ha superato i 15 minuti. Sulla sola parte che raggiunge la realtà (164–194 quadruple) ha impiegato 0,9–1,8 s.
- Slice T05a (8 mondi, 21 coppie): 14,7 s con schema minimo, 51,2 s con il frammento CRM completo, a parità di diagnosi.
