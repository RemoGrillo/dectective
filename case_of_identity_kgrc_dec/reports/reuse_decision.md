# Decisione sul riuso del grafo KGRC «A Case of Identity»

## Verdetto

**Soluzione mista, a prevalenza C + D.** Conviene **trasformare** in CRM/CRMinf + mondi DEC le parti strutturali recuperabili di KGRC: entità, atti linguistici con parlante, ordine narrativo, contenuti di scena come candidati (C). La **nuova annotazione dal testo** serve invece per credenze, identità contestuale, sincerità, modalità, tempo e allineamento (D), con KGRC come indice di partenza e termine di confronto. L'opzione **A** (riuso così com'è con una configurazione aggiuntiva) è esclusa. L'opzione **B** (conservare e arricchire) vale solo per poche componenti (entità, ordine) e non come strategia generale.

### Prove principali

1. **Testo e fonte.** KGRC non è costruito sul testo inglese di Doyle: 0/536 `kgc:source@en` sono citazioni letterali. Sono frasi riscritte da una traduzione giapponese e ritradotte (paper CEUR §3.2, passo 6), con artefatti come `d:018` «The above is color love Saya», `d:168` «Redon Hall Street», `d:091` «quarter and five o'clock».
2. **Identità.** Non è utilizzabile logicamente (`d:504`: `d:Windibank kgc:hasProperty pred:Hosmer`; `pred:Hosmer` ≠ `d:Hosmer`; 0 `sameAs`) ed è già **sostituita dentro gli atteggiamenti di Mary** (`d:507`, `d:518`, `d:524`).
3. **Stance.** Detto, creduto e accettato si confondono: `infoSource` serve indifferentemente per parlante, relatore e segnaposto; `pred:believe` codifica giuramenti (`d:207`, `d:244`, `d:287`); testimonianze diventano fatti narrativi (`d:257`, `d:259`).
4. **Modalità e condizionali persi** (P067.S01 → `d:259/260`; P134.S04 → `d:568`; P138.S01 → `d:578` categorico, `d:579` vuoto).
5. **Copertura verificata.** Sulle 42 unità centrali, 7 presenti, 21 parziali, 13 distorte, 1 assente (P128.S07, «pretended journeys»). Su 55 unità della ricognizione: 11 / 28 / 15 / 1. Sono stime su unità curate, **non** percentuali di completezza del grafo intero.
6. **Prototipo.** Con le stesse 30 query, il modello derivato con DEC risponde come atteso in 28/29 casi, contro 15/29 per il contestualizzato senza DEC e 10/29 per il grafo appiattito (`reasoning_assessment.md`). KGRC originale risponde soltanto alle domande di lookup (`kgrc_baseline.json`).

## Tabella per componente

| Componente | Riutilizzabile? | Intervento necessario | Evidenza | Rischio residuo |
|---|---|---|---|---|
| Entità e denominazioni | **Sì, con revisione** (B/C) | mappare `kgc:Person` → E21 (escludendo `d:hansom_carriage`, `d:police`, `d:Single_women`); etichette → E41; risolvere segnaposto e varianti di maiuscole (21 coppie) | `graph_stats.json → entities`, `anomalies.json` | etichette errate (`d:Hosmer` «サザランド»); nomi del testo diversi («Etherege» vs `d:Etheridge`) |
| Eventi e scene | **Parzialmente** (C) | trasformare le `Situation` narrative in E5/E7; le scene n-arie in triple del profilo tramite una tabella dei 206 predicati | 557 scene; 6 senza predicato; artefatti di traduzione | scene sintetiche, non segmenti; granularità diversa dal testo |
| Successione temporale | **Solo ordine narrativo** (B per l'ordine, D per il resto) | usare ID/`then` come posizione nel discorso; ricostruire dal testo tempo della vicenda e momenti di acquisizione; **scartare** `kgc:time` | 20 componenti `then`, auto-anello `d:558`; date non testuali e incoerenti (`d:221` vs `d:219`) | ordine della fabula ricostruito a mano |
| Contenuti testuali e allineamenti | **No** (D) | segmentazione del testimone PDF (138 paragrafi, 391 frasi) e allineamento verificato | 0/536 verbatim; quartili di similarità 52,8/61,5/71,4 | — (risolto dalla segmentazione nuova) |
| Dichiarazioni e fonti | **Parzialmente** (C + D) | atti `say` → `prof:CommunicativeAct` con parlante; aggiungere destinatario, relatore, citazione; separare parlante originario e relatore | 66/73 `say` con contenuto; `infoReceiver` 0; 63 casi di fonte ≠ soggetto dell'atto | affidabilità di `infoSource` |
| Credenze e congetture | **Come indice, non come dati** (D) | annotare dal testo le credenze per personaggio e intervallo; trasformare le `Thought` corrette; riclassificare `pred:believe` come impegno dove serve; ipotesi (Watson) come mondi congetturali | 21 `Thought` con segnaposto; `d:082` distorta; `d:250` utilizzabile | dipendenza dall'interpretazione dell'annotatore |
| Identità contestuale | **No** (D) | identità come contenuto di mondi (ricostruzione di Holmes, ipotesi del solutore); niente `sameAs` globale né nello shared; *de dicto* nel mondo di Mary | `d:504`, `d:507`, `d:518`, `d:524`; test T01–T03, T08 | assiomi d'identità da attribuire con prudenza |
| Negazioni e incompatibilità | **Minimamente** (D) | definire le incompatibilità necessarie come assiomi dichiarati (disgiunzioni) o chiusure; non tradurre `pred:not*` in negazioni logiche senza verifica | `kgc:Not` 30, 40 predicati negativi lessicali non collegati ai positivi | assunzioni analitiche; difetto di `closedFor` nel reasoner |

## Automatico, rivisto, non attestato

- **Trasformazione automatica (con controllo a campione):** IRI delle entità e degli atti `say`, parlanti, ordine del discorso, contenuti di scena come candidati, collegamento agli IRI KGRC.
- **Aggiunte ricavabili dal testo con revisione umana:** destinatari, relatori, citazioni, credenze per intervallo, stance dei mondi, struttura inferenziale di Holmes, tempo relativo, viaggi simulati (P128.S07), modalità e condizionali.
- **Non sufficientemente attestate (da lasciare indeterminate):**
  - complicità della madre: solo affermazione di Holmes più il «We» di P127.S02;
  - movente «for her money»: attribuzione di Holmes;
  - sincerità di «I am delighted»: solo un indizio comportamentale;
  - credenze di Mary dopo P080: nessuna scena;
  - autore materiale delle lettere: la macchina era condivisa (P117.S01), quindi l'autore è determinato solo sotto le premesse della ricostruzione.

## Impegno stimato (intervalli; assunzioni in `next_steps.md`)

| Componente | Ore-persona |
|---|---|
| Trasformazione automatica (script) + verifica a campione | 6–10 |
| Revisione entità e predicati | 9–17 |
| Annotazione atti comunicativi | 12–20 |
| Credenze, ricostruzione e tempo | 18–30 |
| Seconda annotazione e accordo | 8–12 |
| **Totale per questo racconto** | **≈ 53–89** |

Il prototipo copre circa 10 test su un sottoinsieme; i passaggi sono già disponibili (`scripts/`).

## Dove DEC non offre vantaggi

- lookup, chi-ha-detto-cosa ed estrazione dal testo;
- isolamento dei punti di vista **in sé**: la baseline contestualizzata (`ctx`) evita già le fughe d'identità nel mondo di Mary (T02a, T02b, T08e);
- tempo e revisione (snapshot manuali; nessuna `settle`);
- annidamento e condizionali.

DEC conviene per la permeazione tipizzata (epistemico → realtà, realtà → congetture) e per la rilevazione automatica dei disaccordi tra mondi. Questa ha però costi elevati: 1,4–15,6 s per slice con il controllo, contro 0,1–0,2 s senza (`dec_performance.md`) e difetti documentati (`closedFor`).

## Che cosa il racconto non sostiene

Non c'è una revisione osservata delle credenze di Mary (il finale è una previsione di Holmes, P138.S01) e manca una pluralità di congetture concorrenti attribuite a personaggi diversi: c'è la sola ipotesi di Watson, P099. Per gli esperimenti di aggiornamento sono necessari snapshot del lettore o del solutore, non credenze dei personaggi.
