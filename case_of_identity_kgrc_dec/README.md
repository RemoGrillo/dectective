# A Case of Identity × KGRC × DEC: audit e prototipo

Audit riproducibile del grafo KGRC su *A Case of Identity* (Conan Doyle) e prototipo circoscritto CIDOC CRM + CRMinf + DEC, preparato per il contributo ADHO/DH (Galway) di Remo Grillo e Valentina Pasqual. Specifica di lavoro: `../Prompt_Claude_Code_A_Case_of_Identity_KGRC_DEC.md`.

## Verdetto sul riuso

**Soluzione mista, a prevalenza C (trasformazione) + D (nuova annotazione dal testo).** Il grafo KGRC si usa come indice e fonte di candidati, non come dato finale. Il dettaglio per componente è in `reports/reuse_decision.md`.

- **Si trasforma:** entità, atti linguistici con parlante, ordine narrativo, contenuti di scena come candidati.
- **Si rifà dal testo:** credenze per personaggio e intervallo, identità contestuale, sincerità, modalità, tempo, allineamento.

Prove principali (dettagli in `reports/graph_audit.md`):

1. KGRC è una selezione di frasi riscritte da una traduzione giapponese e ritradotte: **0/536** stringhe `kgc:source@en` sono testo di Doyle (paper CEUR §3.2).
2. La soluzione è già codificata (`d:504` «Windibank is Hosmer»), ma non come identità logica (`kgc:hasProperty pred:Hosmer`; 0 `owl:sameAs`). È inoltre **sostituita dentro gli atteggiamenti di Mary** (`d:507` «Sutherland loves Windibank», `d:518`, `d:524`).
3. Dire, credere e accettare non sono distinti in modo affidabile: `infoSource` indica ora il parlante, ora il relatore, ora un segnaposto; `pred:believe` codifica anche giuramenti. Si perdono modalità e condizionali, e il finale diventa categorico (`d:578`).
4. Sulle 42 unità centrali verificate a mano: 7 presenti, 21 parziali, **13 distorte**, 1 assente («pretended journeys», P128.S07).
5. Ordine narrativo recuperabile; date assolute non testuali e incoerenti; nessun destinatario annotato.

## Dove DEC aggiunge valore e dove no

Il reasoner DEC degli autori (`fvitali/dec-reasoner` @ `e6775b39`) è stato **compilato ed eseguito** (`mvn test`: 32 test, 0 fallimenti, 1 saltato). I 10 test sono articolati in 30 query, ciascuna su una slice dedicata e in quattro configurazioni con stessi dati e stesso Jena OWL FB (`reports/reasoning_assessment.md`). Risposte conformi all'attesa, su 29 query con attesa verificabile:

| DEC | ctx (contestualizzato senza DEC) | asserted | flat (appiattito) |
|---|---|---|---|
| **28/29** | 15/29 | 15/29 | 10/29 |

Dopo l'audit (2026-11-23) il modello gold è stato esteso con un enunciato mancante: la negazione di Windibank a Holmes a P119 (“fantastic talk… If you can catch the man”), cioè “non sono Hosmer Angel”, modulo `W15_v_windibank_denial` più l'atto `F10_comm_act_denial`. La suite T01–T10 non è stata rieseguita: i suoi numeri si riferiscono al modello precedente. Un'esecuzione DEC dedicata (`check-denial`) conferma la menzogna. Dettagli e impatto in `edition/README.md`.

- **Valore di DEC:**
  - permeazione tipizzata epistemico → realtà (T01a, T01c, T02c, T08c);
  - mondi congetturali che ricevono i fatti (T03c, T08d, T09a);
  - rilevazione automatica dei disaccordi: insincerità (T05), divergenza di Mary (T06), ipotesi incompatibili a C4 (T07b).
- **DEC non necessario:**
  - lookup e chi-ha-detto-cosa (T01b, T04, T10);
  - isolamento dell'identità dal punto di vista di Mary, che la baseline `ctx` garantisce già (T02a, T02b, T08e);
  - tempo e revisione (snapshot manuali; nessuna `settle`);
  - annidamento e condizionali (non interpretati).
- **Difetti e scostamenti dal paper** (`reports/dec_reasoner_notes.md`):
  - `verifyClosedFor` segnala disaccordo anche con valori **identici**: condizione `<=` sempre vera; è la causa dell'unico errore di DEC (T09c);
  - i grafi con nome non tipizzati sono verbatim, non doxastic come nel paper;
  - una seconda `handlePermeation()` ricomputa tutto;
  - dopo il restore la realtà è interrogabile solo nel default graph;
  - anche i mondi verbatim ricevono l'etichetta «delusional».

## Prestazioni (`reports/dec_performance.md`, tabelle in `reports/dec_performance_tables.md`)

- **Dataset completi:** senza slicing DEC impiega **496,6 s** sul gold (465 triple, 16 mondi, 105 coppie) contro 4,9 s per ctx.
- **Slice per query** (mediana 30% del dataset):
  - senza controllo dei disaccordi, **96–239 ms**, circa come ctx (0,85×);
  - con controllo, **1,4–15,6 s** (14,8× ctx), di cui il 91% è il confronto a coppie.
- **Mondi aggiunti:** il costo cresce col numero di coppie (circa 0,5 s per coppia; 16 mondi in più → 102,6 s).
- **Materializzazione:** DEC produce ×21–54 triple per tripla asserita, quasi tutte banali; le inferenze sostanziali sono 9–294 per slice, e i match della query usano ≤ 0,14% delle triple inferite o permeate.

## Punti ancora da verificare

- Accordo tra annotatori (annotazione di un solo analista).
- Preservazione delle risposte DEC sul dataset completo: verificata su un campione di 3 query (3/3 identiche; 150–2.900× più lente senza slicing); le altre 27 solo con ctx (30/30).
- Conferma degli autori di DEC su difetti, default e semantica dei mondi verbatim e annidati.
- Valutazione LLM con e senza DEC (progettata, non eseguita: `reports/next_steps.md`).

## Banco di prova web per DEC (`edition/`)

Interfaccia web full-stack (Node: Express + Oxigraph, React + Vite) che usa il racconto integrale come banco di prova per DEC e ne mostra il metodo: le inferenze sono visibili frase per frase. Il pubblico è chi studia grafi di conoscenza e prospettive, non il lettore di gialli. Comprende:
- menzogne, delusioni ed errori in buona fede segnati nel testo;
- il caleidoscopio: Reality al centro e una fetta per persona, con ciò che dice, crede, conclude o suppone;
- 14 case file generati automaticamente e ordinati come esperimento. Cinque domande poste a DEC: identità, sincerità, credenze false, ipotesi nel tempo, limiti. Ciascuna ha la risposta, il confronto dell'audit con e senza DEC e una pila di casi; ogni passo è attribuito a DEC o all'edizione;
- la mappa dei mondi con le segnalazioni DEC riesaminate (conflitto, solo se…, falso allarme dovuto al bug `closedFor`);
- la lettura senza spoiler in quattro tappe;
- **Deductions**: DEC eseguito su ogni prefisso della storia (37 indizi). Per ogni punto mostra cosa la macchina può già concludere, perché, e quanto manca alle conclusioni finali;
- un endpoint SPARQL con 27 domande d'esempio.

Avvio: `cd edition && npm install && npm run build && npm start`, poi http://localhost:4410. Dettagli, semantica e verifica in [`edition/README.md`](edition/README.md).

## Struttura

```
sources/        originali immutabili + manifest.json (URL, date, SHA-256, commit, licenze, strumenti)
vendor/         non versionato: clone KGRC (sparse, pinned), dec-reasoner (pinned), Maven 3.9.9, repository Maven locale;
                si ricrea con `bash scripts/setup_vendor.sh` (lo lancia anche run_all.sh)
data/text/      estrazione grezza, normalizzazione + log, segmenti (138 paragrafi), frasi (391), collazione con l'HTML
data/kgrc/      tabelle di scene/entità, anomalie, confronto kgc:source vs testo, risultati SPARQL Q01–Q15, allineamento automatico
data/           graph_stats.json, passage_inventory.csv (55 unità), text_graph_alignment.csv (42 verificate), alignment_summary.json
scripts/        pipeline riproducibile (vedi sotto) + queries/kgrc/*.rq + requirements.txt
prototype/      profile/ (profilo CRM/CRMinf), modules/ (moduli TriG + catalog.jsonl), gold/, sim/ (C1–C4),
                fixtures/ (T01–T10: manifest, .rq, slice), runner/ (harness Java), exploratory/ (E01–E14), results/
reports/        graph_audit, conceptual_model, reasoning_assessment, reuse_decision, dec_reasoner_notes,
                dec_performance (+ _tables), next_steps
edition/        banco di prova web per DEC (server Node + SPA), dati generati da scripts/build_edition_data.py
```

## Riproduzione

```bash
bash scripts/run_all.sh          # tutta la pipeline: rete solo per l'acquisizione e la prima build Maven
```

Passi principali (dalla radice del progetto, `PY=".venv/bin/python -I"`):

| Passo | Comando |
|---|---|
| Acquisizione e provenienza | `$PY scripts/acquire.py . && $PY scripts/record_provenance.py .` |
| Testo | `$PY scripts/extract_text.py . && $PY scripts/normalize.py . && $PY scripts/segment.py . && $PY scripts/collate_html.py .` |
| Audit del grafo | `$PY scripts/graph_audit.py . && $PY scripts/kgrc_baseline.py .` |
| Allineamento | `$PY scripts/align_candidates.py . && $PY scripts/build_alignment.py .` |
| Build DEC + runner | `vendor/maven/bin/mvn -Dmaven.repo.local=vendor/m2 install` in `vendor/dec-reasoner`, `package` in `prototype/runner` |
| Comportamento DEC | `$PY scripts/run_exploratory.py .` |
| Prototipo | `$PY scripts/build_prototype.py . && $PY scripts/build_fixtures.py . && $PY scripts/check_leakage.py .` |
| Esperimenti | `$PY scripts/run_experiments.py . --reps 10 --warmup 1 --cold 3 --full-dataset-timing` |
| Analisi | `$PY scripts/run_ablations.py . && $PY scripts/sensitivity.py . && $PY scripts/aggregate_metrics.py . && $PY scripts/render_performance_tables.py .` |
| Controllo delle citazioni nei report | `$PY scripts/verify_citations.py .` |

Dopo un clone: `.venv/`, `vendor/`, `node_modules/` e le build non sono nel repository. `run_all.sh` ricrea `.venv` e `vendor/`; `sources/text/iden.pdf` (da non ridistribuire) lo riscarica `scripts/acquire.py`.

Requisiti: Python ≥ 3.12 (usato 3.14.10) con `scripts/requirements.txt` in `.venv`; Java ≥ 17 (usato 21); poppler (`pdftotext` 26.11). Nessun sudo e nessuna installazione di sistema.

## Fonti e licenze (dettagli in `sources/manifest.json`)

| Fonte | Versione | Licenza |
|---|---|---|
| Testo (PDF testimone) | sherlock-holm.es, collection version 3.1 | testo fuori diritti; nessuna licenza esplicita per i file impaginati, quindi non va ridistribuito il PDF |
| KGRC | CC BY 4.0 (SIG-SWO, JSAI) | commit `d62328bd`, file da `cae95727`, stesso blob del branch `ikgrc2023` |
| Paper DEC | arXiv:2606.15246 **v1** | CC BY 4.0 |
| Paper KGRC | CEUR Vol-3443 | CC BY 4.0 |
| Codice DEC | — | MIT |
| Ontologie | CIDOC CRM 7.1.3, CRMinf 1.2.1 (dichiara CRM 7.1.3) | — |

## File non prodotti o sostituiti

- `data/kgrc/ACaseOfIdentity.fixed.ttl`: **non necessario**, il file è sintatticamente valido per rdflib e Jena (7.217 triple con entrambi).
- Grafici: non prodotti; le tabelle generate da script bastano per questo stadio.
- Il «MetricsRunner» del piano coincide con `prototype/runner/src/main/java/dectective/Runner.java`.
- Fuseki: non avviato, perché DEC è stato eseguito in modalità embedded (`DecDataset`); la configurazione Fuseki del repository non è stata modificata.
