# Prestazioni di DEC: slicing, tempi di materializzazione, conoscenza prodotta

Tutte le cifre provengono da `prototype/results/` e sono tabulate in `dec_performance_tables.md` (generato da script, nessun numero trascritto a mano). Piccolo campione, prototipo minimo: **nessuna pretesa di scalabilità**.

**Ambiente.** AMD Ryzen AI MAX+ 388, 16 core, 62 GiB di RAM (circa 15 GiB liberi durante le misure); OpenJDK 21.0.13 con `-Xmx4g`; Jena 4.8.0 `OWLFBRuleReasoner`; esecuzioni sequenziali, mai in parallelo, ciascuna sotto `timeout`.

## 1. Perché lo slicing è necessario

Senza slicing (dataset completi con schema CRM minimo nello shared e controllo dei disaccordi attivo):

| Dataset | Triple | Mondi | Coppie | DEC | ctx | flat |
|---|---|---|---|---|---|---|
| C1 | 359 | 7 | 15 | 55,2 s | 3,0 s | 1,0 s |
| C4 | 397 | 13 | 66 | 330,7 s | 4,3 s | 1,3 s |
| gold | 465 | 16 | 105 | **496,6 s** | 4,9 s | 1,4 s |

Durante la messa a punto, il controllo di fuga sui checkpoint completi ha superato i 15 minuti, e una seconda chiamata a `handlePermeation()` ricomputa tutto (80,5 s su C1) invece di essere nulla.

**Slicer** (`scripts/slice_for_query.py`, una slice per `.rq`):

- moduli dichiarati nel manifest del test;
- potatura per firma della query (IRI dell'algebra SPARQL) con espansione a 2 hop;
- solo i predicati governanti e la configurazione DEC effettivamente usati;
- schema **minimo**: assiomi del profilo per i termini usati, più il frammento CRM solo per i termini CRM nominati nella query;
- limiti di guardia: triple per mondo e numero di mondi, perché le coppie crescono come n(n−1)/2; se superati, il run si interrompe con errore esplicito.

**Esiti:**

- slice di dimensione mediana pari al **30,2%** del dataset completo (18,8–44,5%);
- **risposte preservate in 30/30** query (configurazione ctx, slice contro completo);
- campione DEC sul completo: vedi §6.

Con schema minimo invece del frammento CRM completo, la slice T05a passa da 51,2 s a 14,7 s (11.555 contro 6.277 triple materializzate) **con diagnosi identiche**.

## 2. Che cosa si misura e come (definizioni euristiche)

Per ogni `.rq`: 1 warm-up + **10 ripetizioni** nella stessa JVM (ogni ripetizione con un `DecDataset` nuovo) + **3 esecuzioni a JVM fredda**; quattro configurazioni sulla stessa slice. In più, una esecuzione strumentata, che ripete la sequenza pubblica di `handlePermeation()` con dei timer. La sua equivalenza è stata verificata confrontando l'hash SHA-256 della materializzazione ordinata con il percorso normale: **30/30 identici**.

- **Asserite**: triple in input per mondo (dal TriG; DEC riscrive i grafi base, quindi non vanno lette dopo).
- **Permeate**: triple ricevute da mondi sorgente secondo DEC (`getPermeations()`).
- **Inferite** = materializzate − asserite − permeate, suddivise in:
  - *banali*: fatti sul vocabolario RDF/RDFS/OWL, `rdf:type rdfs:Resource`/`owl:Thing`, riflessivi;
  - *tassonomiche*: `rdf:type` verso classi CRM/CRMinf/profilo;
  - *sostanziali*: tutto il resto («conoscenza nuova»).
- **Diagnostiche DEC**: `dec:disagreesWith`, `dec:delusionalWorld`, tipi di mondo.
- **Rapporti**:
  - amplificazione = materializzate/asserite;
  - tasso di conoscenza nuova = sostanziali/asserite;
  - ridondanza = Σ|mondo| / |triple distinte|;
  - throughput = triple/s;
  - costo per coppia = `verifyInconsistencies` / coppie;
  - **utilità dell'inferenza** = triple non asserite effettivamente usate dai match della query / (inferite + permeate).
- **Risposta che richiede inferenza**: risposta diversa da quella della configurazione `asserted`.

## 3. Risultati principali (30 query)

| | flat | ctx | dec |
|---|---|---|---|
| Materializzazione, mediana delle mediane | 121,8 ms | 181,1 ms | 169,4 ms |
| Materializzazione, media | 116,4 ms | 206,1 ms | **2.069,8 ms** |
| A JVM fredda, mediana | 361,3 ms | 734,7 ms | 734,7 ms |
| Triple materializzate, mediana | 1.150 | 4.000 | 4.130 |
| Amplificazione (media geometrica) | 9,1 | 32,1 | 32,5 |
| Conoscenza nuova sostanziale / asserite (media geometrica) | 0,250 | 0,069 | **0,339** |
| Ridondanza tra mondi (mediana) | 1,0 | 3,4 | 3,4 |
| Risposte conformi all'attesa | 10/29 | 15/29 | **28/29** |

La distribuzione di DEC è **bimodale** e dipende da un solo fattore, il controllo dei disaccordi:

| DEC | Query | Mediana | Intervallo | Overhead vs ctx (media geometrica) | Overhead vs flat |
|---|---|---|---|---|---|
| senza `checkInconsistencies` | 17 | **138,8 ms** | 96,5–238,6 ms | **0,85×** | 1,29× |
| con `checkInconsistencies` | 13 | **2.526,9 ms** | 1.399,7–15.571,6 ms | **14,8×** | 28,3× |

Con il controllo attivo, `verifyInconsistencies` assorbe in mediana il **91%** del tempo di `handlePermeation`, cioè 544–973 ms per coppia di mondi. Senza il controllo prevalgono permeazione e inferenza locale (mediana 67%). Assegnazione dei tipi (circa 1,4 ms) e `closedFor` (≤ 78 ms) sono trascurabili. La query vera e propria costa 0,6–1,6 ms alla prima esecuzione e 0,2–0,8 ms alla seconda: la materializzazione avviene una sola volta e la query non la ripete.

**Quanta conoscenza nuova.** DEC materializza da 21 a 54 triple per ogni tripla asserita (mediana 30). Le inferenze banali sono quasi tutto (quota mediana circa 0,9–1,0 delle inferite): l'OWL FB di Jena genera assiomi e tipizzazioni ripetuti in ogni mondo, e ogni mondo non verbatim riceve lo shared e lo re-inferisce (ridondanza 2,4–4,7). Le inferenze **sostanziali** vanno da 9 a 294 per slice. DEC ne produce più di ctx (0,339 contro 0,069 per tripla asserita) **perché permea**: le conseguenze dell'identità epistemica nella realtà e quelle delle ipotesi sui fatti nei mondi congetturali. È questa la parte utile del suo lavoro.

**Utilità.** Le triple non asserite effettivamente usate dai match di una query sono **al massimo lo 0,14% di quelle inferite o permeate** (utilità ≤ 0,0014; mediana < 0,001). La materializzazione completa è quasi tutta lavoro non usato dalla domanda: è un argomento a favore della valutazione pigra e locale che il paper stesso indica come sviluppo (§5) e, nel frattempo, dello slicing.

**Risposte che richiedono inferenza.** In 15 query su 30 la risposta di DEC differisce da quella senza inferenza: identità e sue conseguenze, mondi congetturali, disaccordi. Nelle altre 15 la risposta corretta è la semplice consultazione (spesso un «non determinato» corretto).

## 4. Serie di sensibilità (euristica; base: slice T06a, 3 ripetizioni)

- **Sfondo irrilevante nella realtà** (0–4.000 triple KGRC): DEC resta intorno a **3,8–4,4 s** e ctx a 0,46–0,62 s. Le triple di sfondo non interagiscono con gli assiomi e il numero di coppie non cambia (6).
- **Mondi in più** (2, 4, 8, 16 mondi doxastici neutri): 15, 28, 66, 190 coppie; DEC **8,9 s, 15,9 s, 35,2 s, 102,6 s**; ctx 0,58–0,93 s. Il costo di DEC cresce **linearmente con il numero di coppie** (circa 0,5 s per coppia), quindi **quadraticamente con il numero di mondi**; il rapporto DEC/ctx sale da 9× a 111×.

Lettura: per DEC conta il **numero di mondi confrontati**, non la dimensione dei dati irrilevanti. Una slice deve limitare i mondi alla domanda, e `checkInconsistencies` va attivato solo quando serve.

## 5. Osservazioni sull'implementazione rilevanti per le prestazioni

1. La materializzazione completa avviene al primo accesso al dataset dopo il caricamento.
2. Una seconda `handlePermeation()` non è nulla: un mondo resta «not ready» (il default world ricreato in `prepareRestore`).
3. Le triple permeate vengono **scritte nei grafi base**.
4. Il controllo dei disaccordi crea un `InfModel` nuovo per ogni coppia e include anche i mondi verbatim.
5. Il difetto di `closedFor` non incide sui tempi (≤ 2% del totale), ma produce falsi positivi (T05, T09c).

## 6. Preservazione delle risposte DEC sul dataset completo (campione)

Per il costo, la preservazione con DEC è stata verificata su un **campione di 3 query** (`prototype/results/preservation_dec/summary.json`, una esecuzione ciascuna sul dataset completo):

| Query | Dataset | Risposta (completo = slice) | DEC sul completo | DEC sulla slice (mediana) | Rapporto |
|---|---|---|---|---|---|
| T02b_mary_opacity | gold | false = false ✓ | 476,7 s | 0,165 s | ≈ 2.900× |
| T07a_C3 | C3 | [] = [] ✓ | 212,8 s | 1,41 s | ≈ 150× |
| T08c_identity_C4 | C4 | true = true ✓ | 335,9 s | 0,168 s | ≈ 2.000× |

Le altre 27 query sono verificate solo con la configurazione ctx (30/30 preservate). Lo slicing non può alterare le risposte basate su `checkInconsistencies` purché i mondi coinvolti nella query siano tutti nella slice; lo garantisce la selezione per IRI della query più i moduli richiesti nel manifest, ma una prova generale con DEC richiederebbe ore di calcolo.
