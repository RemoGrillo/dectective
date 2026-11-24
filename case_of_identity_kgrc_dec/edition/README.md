# Arthur Conan Doyle's A Case of Identity — DEC at work

Non è un'edizione per leggere un giallo: è un banco di prova per **DEC**, il reasoner su mondi doxastici, epistemici e congetturali. Serve a valutarne le potenzialità e a mostrarne il metodo, e si rivolge a chi lavora su grafi di conoscenza, contesti e prospettive, non al lettore di gialli in senso stretto. Il testo integrale del racconto è il materiale: ogni affermazione, credenza e ipotesi è codificata come punto di vista, e DEC calcola cosa ne segue, quali punti di vista si scontrano con ciò che è vero e dove non sa decidere. **Menzogne, delusioni ed errori in buona fede** sono segnalati nel testo con sottolineature e icone, e ogni frase apre un **caleidoscopio**: al centro c'è Reality, attorno una fetta per persona con ciò che dice, crede, conclude o suppone. Tutto è calcolato dalle materializzazioni DEC già prodotte nell'audit. Comprende anche:

- i **case file**, organizzati come esperimento: cinque domande poste a DEC, ciascuna con la risposta, cosa dimostra, il confronto dell'audit con e senza DEC e una pila di casi del racconto che la mettono alla prova;
- un **endpoint SPARQL** pubblico, con 27 coppie linguaggio naturale ↔ SPARQL;
- **Deductions**: cosa DEC può concludere a ogni indizio della storia, rispetto alle conclusioni finali.

Interfaccia in inglese. Il linguaggio è piano: il termine DEC compare al passaggio del mouse e nella pagina *How it works*. Grafica: superfici bianche su fondo neutro, testo nero, giallo usato come accento (marchio, Reality, evidenziazioni, stati attivi), rosso per menzogne, delusioni e conflitti. La copertina è l'unica pagina tutta gialla. C'è anche un tema scuro.

![Copertina](docs/screenshots/cover.png)

## Avvio

Richiede Node ≥ 22.18. Il server usa il type stripping nativo, senza passo di compilazione.

```bash
cd edition
npm install            # dipendenze di server e web (workspaces)
npm run build          # compila la SPA in web/dist
npm start              # http://localhost:4410  (endpoint: http://localhost:4410/sparql)
```

| Comando | Effetto |
|---|---|
| `PORT=8080 npm start` | porta diversa; anche `SPARQL_TIMEOUT_MS`, `SPARQL_MAX_ROWS` |
| `npm run dev` | server con `--watch` + Vite su :5173 (proxy di `/api`, `/sparql` e `/portraits` verso :4410) |
| `npm test` | 108 test del server (vitest + supertest) + 26 test di contrasto WCAG dei token grafici (testo e marcatori) |
| `npm run typecheck` | `tsc --noEmit` su entrambi i workspace |
| `npm run build:data` | rigenera `edition/data/` dagli artefatti dell'audit (Python della `.venv` del progetto) |

I dati in `edition/data/` sono già generati. `build:data` serve solo se cambiano gli artefatti a monte. La build è deterministica: due esecuzioni producono file con SHA-256 identico, registrato in `data/build_info.json`.

## Pagine

| Percorso | Contenuto |
|---|---|
| `/` | copertina |
| `/read` | testo integrale. Indice semplice (parti e pagina); gli interruttori dei segni nel testo (**Lie**, **Delusion**, **Honest mistake** in rosso, **Names & identity**, **Reasoning**, **Case files**, **New deductions**) stanno nella testata del Modal plot, in basso. Una frase è cliccabile solo se il modello le lega almeno una proposizione. Il pannello della frase ha una parte fissa in alto (la proposizione in chiaro, la frase in piccolo, i badge dei verdetti, il caleidoscopio) e sotto un accordion che scorre: **Diagram** (Venn mirato sulla frase, già aperto), *Who holds what*, *What DEC can now conclude*, *Case files*, *KGRC*. Su mobile scorre tutto il pannello. Tastiera: ↑/↓, Invio, Esc. In fondo alla pagina c'è il **Modal plot** (era "Timeline"; aperto di default, *Hide* lo chiude e lascia in basso una linguetta per riaprirlo). È un pannello fisso al bordo inferiore, a tutta larghezza e sempre interamente visibile, con una riga per persona e tipo di mondo (Mary dice / crede, Hosmer dice, Windibank dice / crede, Holmes conclude / suppone…) e una colonna per indizio. Segue la lettura: la colonna dell'indizio raggiunto è evidenziata, quelle successive sono sbiadite, e una riga compare quando il suo mondo entra nella storia. Punti neri = ciò che il testo dice; cerchi blu = ciò che DEC inferisce; frecce blu = ciò che passa in Reality (permeazione della soluzione accolta di Holmes); icone rosse = menzogna, delusione, errore in buona fede, con la linea tratteggiata da Reality che le smentisce. Ogni persona è nominata una volta sola, con il ritratto, e ha una riga per ogni modo di sostenere qualcosa (says, believes…); le persone si distinguono per fasce alterne. Sulla riga Reality ci sono solo i contenuti veri nella storia: che qualcuno dica o supponga qualcosa lo mostrano le righe delle persone. **Ogni segno è cliccabile e apre ciò che rappresenta.** Il pallino su Reality al clue 12 apre "Hosmer Angel wore tinted glasses", quello di Mary nella stessa colonna apre "Hosmer Angel has weak eyes". Un'icona di verdetto apre la proposizione su cui cade. Un cerchio blu apre la conclusione di DEC nella sezione "What DEC can now conclude". Un clic altrove nella colonna porta alla frase; nel testo i segnalini *clue N* corrispondono alle colonne. **Al passaggio del mouse** (o con il focus da tastiera) su un segno compare una scheda: chi (ritratto, nome, se dice / crede / suppone…), indizio e pagina, poi ciò che c'è in quel punto (al massimo tre voci). Per una proposizione mostra il suo valore in Reality e gli eventuali verdetti; per una battuta, l'inizio della frase; per una conclusione di DEC, la regola che la produce; per un verdetto, la sua formulazione e l'indizio da cui diventa visibile. Sulle righe "says" ci sono due cose. Le dichiarazioni registrate nel modello hanno un mondo verbatim ciascuna (Mary 1, Hosmer 1, Windibank 4). Le battute pronunciate in una frase-indizio non hanno un mondo proprio: il loro pallino **rappresenta le proposizioni della frase**, non le sue parole. Al clue 2 "Mary says" rappresenta "Hosmer Angel is identified by the name 'Hosmer Angel'", che sta in Reality; al clue 17 "Holmes says" rappresenta i due fatti sulla lettera n. 1. Le parole del testo compaiono passando sul **numero dell'indizio** in testa alla colonna. Valgono solo le frasi dette davvero: la narrazione dentro un paragrafo attribuito a qualcuno non conta (al clue 21, "Mr. Windibank gave a violent start and dropped his gloves", non c'è un "Windibank says"), e una battuta senza proposizioni non ha pallino. Senza spoiler il grafico si ferma all'ultima frase della tappa. |
| `/perspectives` | **Perspectives**: due viste della stessa cosa, **una accanto all'altra**. A sinistra i **Cognitive worlds**: il diagramma di Venn (layout ad aree proporzionali, `@upsetjs/venn.js`, seme fisso, altezza adattata al disegno) con sotto la legenda, "Who influences whom" (deceives / misleads / tells) e l'elenco zona per zona ripiegato. Reality è il cerchio giallo. Ogni persona ha insiemi **separati** per ciò che dice, crede, conclude e suppone, e ogni proposizione è un punto numerato nella zona degli insiemi che la sostengono: dentro Reality è vera, fuori in rosso è smentita, fuori in grigio non è decisa. Dove ciò che X *dice* cade dentro ciò che Y *crede*, fuori da Reality, la zona diventa rossa ("Windibank deceives Mary"). Una linea rossa a zigzag collega due proposizioni che non possono essere vere insieme. Filtri per persona, per affermazioni e per ipotesi; ipotesi e what-if spenti di default. A destra il **Kaleidoscope**: la tabella proposizioni × Reality × persone, con la colonna delle proposizioni stretta (testo a capo) e, davanti a ognuna, **il suo numero nel diagramma** disegnato come il punto. Nella storia intera Hosmer ha una colonna sua accanto a Windibank ("as himself" / "= Windibank"). Filtri: dove i punti di vista si scontrano / menzogne e delusioni / tutte. Le due viste si seguono: la riga sotto il puntatore accende il suo punto (con il cartellino), il punto sotto il puntatore accende la sua riga e la porta in vista nella tabella. **Un clic su una riga o su un punto apre una modale**: proposizione, frase da cui viene, verdetti, caleidoscopio accanto al diagramma (`/api/venn/proposition/:id`), chi sostiene cosa, "Read it in context"; ← → passano alla proposizione precedente o successiva della tabella, Esc o un clic fuori la chiudono. Su mobile la modale è a tutto schermo e le due viste stanno una sotto l'altra (sotto 1300 px). In fondo, ripiegate, le segnalazioni di conflitto di DEC riesaminate |
| `/perspectives?p=:proposizione` | la pagina con quella proposizione aperta e la sua riga in vista. I vecchi indirizzi continuano a funzionare: `/kaleidoscope` e `/worlds` portano qui, `/kaleidoscope/:frase` apre la prima proposizione della frase |
| `/deductions` | **Deductions**: cosa DEC può concludere a ogni indizio della storia. In alto, la barra della storia: quante conclusioni ci sono finora e dove una menzogna o una delusione diventa rilevabile. Sotto, tre schede: *New here* (le conclusioni nuove, ciascuna con regola e premesse collegate alla pagina), *So far* e *Compared with the end* (cosa manca, e quali fatti cambieranno). Si naviga con clic, trascinamento, ←/→, i salti rapidi o `?at=<frase>` |
| `/dossiers` | **i case file come esperimento** (vedi sotto): in testa solo la domanda di ricerca in una riga, poi una riga per ciascuna delle cinque domande (domanda, risposta a timbro, cosa dimostra, un pallino per query dell'audit e per assetto) con a fianco la **pila** delle cartelline. Le cartelline stanno una sull'altra e se ne vedono linguetta e prima riga del titolo; quella sotto il puntatore (o col focus) si apre e spinge giù le altre, mostrando timbro, contributo di DEC, cosa mostra. L'apertura parte un po' prima della chiusura, così passando da una cartellina all'altra la pila non salta sotto il puntatore. Sui touch screen sono tutte aperte |
| `/dossiers/:id` | 14 case file. In alto la fascia con la domanda e il contributo di DEC a questo caso (*Needs DEC*, *DEC + a rule*, *No DEC needed*, *DEC errs*, *Beyond DEC*). Poi la cartellina: timbro (LIE, DELUSION, HONEST MISTAKE, FALSE ALARM, SAME PERSON, INFERRED, REFUTED, CONFIRMED, REJECTED, ONLY IF…, PREDICTED, A MASK), passi numerati con chi li produce (**DEC**, *Edition*, KGRC) e la query ripiegata sotto ogni passo, note e assunzioni, passi del testo. Sotto: *The same question, with and without DEC*, la tabella delle query dell'audit per quella domanda (✓ come atteso, ✕ nessuna risposta o sbagliata) e il diagramma |
| `/identikit`, `/identikit/:persona` | **Identikit** (era Cast). A sinistra i ritratti a coppie: in alto i detective (Holmes e Watson), poi il fidanzamento (Mary e Hosmer), poi la casa (Windibank e la madre di Mary), infine il lettore simulato e il what-if. A destra la scheda della persona, **battuta a macchina su un foglio dentro una cartellina**: foto con graffetta, ruolo, altri nomi, punti di vista, un timbro con i verdetti (es. LIE ×3); poi menzogne e delusioni, cosa dice / crede / conclude / suppone confrontato con Reality, nomi, argomenti su cui tace. Cambiando persona, il foglio viene riposto e il nuovo esce dalla cartellina. Nella storia intera il ritratto di Hosmer Angel ha una **lente**: passandoci sopra compare, sotto il travestimento, il volto di James Windibank. `/cast` porta qui |
| `/interrogation` | **Interrogation** (era SPARQL Lab): domande d'esempio, editor, risultati, download CSV/JSON; endpoint e grafi in un pannello ripiegato. `/lab` porta qui (anche con la query passata da un case file) |
| `/method` | *How it works*: cosa si sta mettendo alla prova e i quattro assetti dell'audit (`#audit`), glossario parola dell'edizione → termine DEC, verdetti, bug di DEC, lettura senza spoiler, provenienza, limiti, licenze |

**Lettura senza spoiler.** Dal pulsante con l'occhio nell'intestazione si sceglie fin dove si è letto:

| Tappa | Nome mostrato | Fine |
|---|---|---|
| C1 | Mary's visit | p. 4 |
| C2 | The clues | p. 6 |
| C3 | The typewriter | p. 7 |
| C4 | The unmasking | p. 8 |
| — | The whole story | — |

Il testo oltre la tappa è sigillato e tutte le viste usano gli snapshot, con IRI neutri. La fine di ogni tappa è segnata anche nel testo, con il pulsante "Pause here, no spoilers". Tappa e tema stanno nell'URL (`?mode=C2`, `?theme=noir`).

**Case file come esperimento** (`annotations/questions.json`, `server/src/casebook.ts`). La domanda di ricerca è: *che cosa aggiunge un reasoner su mondi doxastici, epistemici e congetturali quando un racconto giallo diventa un grafo di conoscenza, e che cosa deve ancora venire dai curatori?* Si articola in cinque domande, ciascuna con una risposta a timbro e un paragrafo su cosa dimostra:

| # | Domanda | Risposta | Case file | Query dell'audit |
|---|---|---|---|---|
| 1 | Un'identità può essere vera in Reality senza entrare nelle credenze di chi è ingannato? | Yes (DEC per Reality, i grafi nominati per Mary) | 01–03 | T01a–c, T02a–c, T03a–b, T08c, T08e |
| 2 | DEC distingue una menzogna da un errore in buona fede? | Yes, with a rule | 04–07 | T04b, T05a–b (+ run `check-denial`) |
| 3 | DEC riconosce chi crede ciò che Reality esclude, e solo allora? | Yes, but check (un falso allarme su due) | 08–09 | T06a–c |
| 4 | DEC soppesa le ipotesi rispetto alle prove mentre la storia procede? | Stage by stage (un run per tappa, nessuna nozione di tempo) | 10–13 | T03c, T07a–c, T08a/b/d, T09a–c |
| 5 | DEC ragiona su ciò che nel testo non accade, come una previsione? | No | 14 | T10a–c |

Ogni domanda raccoglie le query dell'audit che la misurano con gli stessi dati e le stesse regole in quattro assetti: **DEC**, **Named graphs** (`ctx`: grafi separati con inferenza OWL, senza DEC), **One graph** (`flat`) e **Stored only** (`asserted`). Gli esiti si leggono da `runs.json` (`test_result.matches_expected`) e non si ricalcolano: in totale DEC 28/29, Named graphs 15/29, One graph 10/29, Stored only 15/29. I case file sono numerati nell'ordine delle domande. Ognuno dichiara il ruolo di DEC nel caso (*Needs DEC*: senza DEC nessuna risposta o una sbagliata; *DEC + a rule*: DEC trova lo scontro, una regola dell'edizione lo classifica; *No DEC needed*; *DEC errs*: bug; *Beyond DEC*) e una riga su cosa mostra.

**Dimensioni, larghezza e movimento** (`web/src/components/Motion.ts`). Da 900 px in su tutta l'interfaccia è un po' più piccola, come il browser al 90% (`zoom: .9` sulla radice). Le unità di viewport passano da `--vh`/`--dvh`/`--vw`, che dividono per lo zoom, perché lo zoom CSS ridurrebbe anche `100vh`. Le pagine usano la larghezza della testata (1560 px); **Read è a tutta larghezza**, testata compresa, con il testo centrato sul foglio alla sua misura. Il **Modal plot è fisso in basso a tutta larghezza**: tutte le righe sono sempre visibili, senza scorrimento interno; le colonne si allargano a occupare lo spazio, e testo, indice e pannello si riducono di conseguenza. Mentre il Modal plot è visibile il footer non compare; chiuso, resta una linguetta in basso al centro. La prosa mantiene la sua misura, e *How it works* va su due colonne. Il movimento è calmo per regola:
- **Prima il layout, poi il contenuto.** Il pannello del Reader si allarga, poi il contenuto entra in dissolvenza (dal basso su mobile). Chiudendo, il contenuto sfuma e solo dopo la colonna si richiude.
- **La modale di Perspectives** entra con una dissolvenza e un leggero sollevamento, ed esce sfumando.
- **Cambio di contenuto.** Passando a un'altra proposizione o frase il pannello (o la modale) resta aperto: il contenuto vecchio resta finché il nuovo è pronto, sfuma in 0,15 s e il nuovo entra in 0,24 s.
- **Identikit.** Il foglio cambia allo stesso modo, uscendo dalla cartellina.
- **Altro.** Le sezioni ripiegate si aprono scorrendo, le pagine entrano in dissolvenza.

Con `prefers-reduced-motion` tutto il movimento è disattivato.

**Modal plot del Reader** (`web/src/components/FlowChart.tsx`, prima chiamato "Timeline"). Viene dal branch `feature/reader-worlds-flow` di Valentina Pasqual: di quel branch è stata portata su main solo questa parte, cioè il grafico "worlds over the clues" agganciato sotto il testo, i segnalini *clue N* e il salto colonna → frase. Adattamenti rispetto all'originale:
- i verdetti usano le stesse icone rosse del resto dell'edizione invece di triangolo, rombo e quadrato;
- Hosmer ha una riga sua, come nella tabella del Kaleidoscope;
- senza spoiler le colonne si fermano alla tappa;
- l'altezza del pannello è al massimo il 42% dello schermo, e testo, indice e pannello della frase ne tengono conto (`--dock-h`); l'indizio raggiunto si calcola a metà della parte visibile.

Il blu di DEC (`--dec-blue`) è un colore solo grafico, controllato nei test di contrasto (≥ 3:1 su carta e sulla fascia gialla di Reality).

**Terminologia.** L'unità del modello si chiama sempre *proposition* (niente più "claim" o "fact"): nel pannello del Reader ("Proposition 1 of 2"), in Perspectives, in Identikit, nei case file e in How it works. Nomi delle pagine: *Perspectives* (Cognitive worlds + Kaleidoscope), *Identikit* (le persone), *Interrogation* (SPARQL).

**Icone** (`src/components/Glyphs.tsx`, legenda in How it works). Un solo linguaggio:
- la **forma** dice chi la sostiene e come: fumetto = says, nuvoletta = believes, lente = concludes, lampadina = supposes, disco giallo = Reality;
- il **segno nell'angolo** dice la polarità: ✓ nero = la sostiene, ✕ rosso = la esclude (e la forma diventa rossa);
- il **valore di Reality** usa gli stessi segni a tutta grandezza: disco nero ✓ = vero, disco rosso ✕ = falso, cerchio rosso tratteggiato ✕ = falso se…, cerchio grigio ? = non detto. Sono i colori dei punti del Venn; al centro del caleidoscopio il medaglione sta dentro il disco giallo;
- i **verdetti** sono forme rosse piene: fumetto ✕ = Lie, nuvoletta ✕ = Delusion, fumetto ! = Honest mistake (bianche sui badge rossi).

**Verdetti.** I badge sono corti: icona e una parola (Lie, Delusion, Honest mistake). Un clic apre un piccolo popup con il caso specifico, la regola generale e i termini DEC. Vale ovunque: Read, Perspectives, Identikit, Deductions.

**Diagrammi.** Ovunque si usa lo stesso Venn: i Cognitive worlds (mappa intera, in Perspectives), il pannello della frase, la modale del Kaleidoscope e i case file. I Venn mirati (`/api/venn/sentence/:id`, `/api/venn/proposition/:id`, `/api/venn/dossier/:id`) mostrano le proposizioni in questione più i fatti di Reality che le smentiscono, collegati dalla linea rossa a zigzag. Insiemi con gli stessi elementi sono anelli concentrici. Il vecchio diagramma a rete (Cytoscape) è stato tolto.

**Deduzioni nel Reader.**
- Nella barra dei segni c'è il pulsante "New deductions": accende un "⚙ +n" dopo ogni frase da cui DEC può trarre conclusioni nuove.
- Sotto l'indice, "DEC so far" segue la posizione di lettura.
- Nel pannello della frase, "What DEC can now conclude".

**Ritratti.** Gli 8 ritratti (a colori, tondi) stanno in `portraits/<id>.png` (`mary`, `windibank`, `hosmer`, `holmes`, `watson`, `mother`, `reader`, `whatif`). `npm run build:portraits` ne ricava le versioni web in `portraits/web/`: l'ovale intero per l'Identikit, il ritaglio sul volto per i cerchi. Il server li elenca in `/api/meta` senza bisogno di ricompilare. Per un ritratto mancante compare un segnaposto a matita. Prompt e ritagli: [portraits/README.md](portraits/README.md).

## Vocabolario: parola dell'edizione → termine DEC

| Nell'interfaccia | In DEC |
|---|---|
| Reality | mondo `reality` (fatti narrati + soluzione di Holmes accettata) |
| says / believes / concludes / supposes | mondo verbatim / doxastic / epistemic / conjectural governato dalla persona |
| Shared background | mondo `shared` (schema e assiomi) |
| stated / inherited / inferred by DEC | asserted / received (permeazione) / derived |
| ruled out / ruled out, if… / silent | contradicted / contradicted assuming closure / not determined |
| The reader | `st:solver`, lettore simulato (solo nella lettura senza spoiler) |
| Editors' what-if | `st:analyst`, ipotesi di controllo non presente nel testo |
| Hosmer Angel (nella storia intera) | persona fusa in Windibank quando Reality conosce l'identità ("alias Hosmer") |

## Come vengono calcolati stati, posizioni e verdetti

Per una proposizione *p* e un mondo *W*, con M(W) la vista materializzata da DEC e A(W) il contenuto asserito, lo stato di *p* in *W* è il primo che si applica:

1. **stated** (asserted): *p* ∈ A(W).
2. **inherited** (received): *p* ∈ M(W) \ A(W) e *p* è in un mondo che DEC fa permeare in W. Viene indicata la sorgente.
3. **inferred by DEC** (derived): *p* è in M(W) per altra via. Viene riconosciuto lo schema della regola: sostituzione per identità, simmetria, gerarchia di classi, proprietà inverse-funzionale.
4. **ruled out** (contradicted): W contiene qualcosa di incompatibile con *p* secondo un `owl:disjointWith` dichiarato.
5. **ruled out, if…** (contradicted assuming closure): W ha un valore **diverso** per un predicato dichiarato chiuso. È la semantica corretta, non quella difettosa di DEC, e viene mostrato come assunzione.
6. **silent** (not determined): nessuno dei casi precedenti. Non viene mai presentato come "falso".

**Punti di vista** (`server/src/rules/viewpoints.ts`). Per ogni proposizione si calcolano due cose:
- il valore in Reality: vero, falso, falso se…, non detto;
- per ogni persona, sempre nello stesso ordine, le sue posizioni (*says* / *believes* / *concludes* / *supposes*, ✓ o ✕). Valgono anche le posizioni sotto un altro nome, quando l'identità è nota.

Ciò che un'ipotesi si limita a ereditare da Reality non conta come posizione propria. Le persone senza posizione risultano "silent".

**Diagnosi.**

| Diagnosi | Regola |
|---|---|
| **Lie** | la persona dice *p* e una sua credenza lo esclude (schema T05a) |
| **Delusion** | la persona crede *p* e Reality lo esclude |
| **Honest mistake** | la persona dice e crede *p*, ma Reality lo esclude (T05b) |

La diagnosi viene segnata nel testo solo dove è ancorato il mondo che la porta. La menzogna di Windibank sulla scomparsa è segnata in P067.S01, dove viene detta, e non nelle frasi in cui Mary ne ripete il contenuto: lì il segno è la delusione di Mary.

**Segnalazioni DEC riesaminate.** I verdetti `dec:disagreesWith` / `dec:delusionalWorld` vengono controllati coppia per coppia:

| Nell'interfaccia | Significato |
|---|---|
| Conflict | viola una disgiunzione dichiarata |
| Only if… | incompatibile solo se si assume un valore unico per soggetto |
| False alarm | prodotto solo dal bug `closedFor`, quando i due mondi hanno lo **stesso** valore (es. `windibank_beliefs` vs Reality; `w22`/`w23` alla tappa C3) |

## Deduzioni nel tempo (`/deductions`)

Ogni **indizio** è una frase che aggiunge qualcosa al modello gold: ce ne sono 37. Per ciascun indizio, DEC gira una volta su tutto ciò che il lettore ha letto fin lì. Lo fa `scripts/run_edition_timeline.py` (Java + runner dell'audit, circa 3 minuti):

```bash
python3 -I scripts/run_edition_timeline.py .     # 38 esecuzioni DEC (37 indizi + base con il solo schema)
npm run build:data                               # ricava edition/data/timeline.json e il grafo edition/timeline
```

**Regole di ingresso** (`annotations/timeline_overrides.json` per le correzioni; ogni decisione è in `prototype/results/timeline/availability.csv`):
- un fatto entra alla prima frase che lo sostiene;
- un punto di vista entra, insieme alla dichiarazione di chi lo crede o lo conclude, quando sono stati letti sia il suo passo sia il suo primo contenuto, entro la sua tappa;
- lo schema c'è dall'inizio;
- controllo dei conflitti e `closedFor` non vengono usati, così ogni esecuzione richiede secondi e non minuti.

**Cosa ne risulta:**
- **Monotonia verificata.** La materializzazione cresce a ogni indizio e non si perde nulla. Quindi una tripla vale all'indizio k se e solo se il suo primo indizio è ≤ k.
- **Stato finale.** Contiene tutto il contenuto delle viste gold dell'edizione.
- **Conclusioni.** 60 a livello di trama, più 667 minori (gerarchia di classi, contabilità CIDOC CRM). Ognuna ha una regola riconosciuta: identità, simmetria, tratto identificante, inversa, sottoproprietà, dominio/codominio, oppure "accettata in Reality" dalla soluzione di Holmes. Ognuna appare esattamente quando arriva la sua ultima premessa.
- **Verdetti indizio per indizio.** Lie, Delusion e Honest mistake si calcolano con le stesse regole delle altre pagine. L'identità Hosmer = Windibank conta solo da quando è in Reality (P126.S11). Gli 8 verdetti diventano tutti rilevabili fra P126.S11 e P128.S10. Esempio: la menzogna di Windibank sulla scomparsa, detta a P067.S01, diventa rilevabile solo a P128.S10, quando le sue credenze dicono che fu volontaria.
- **Metriche.** Tempo, triple asserite e materializzate per ogni esecuzione, con le medie (4,7 s per esecuzione, 13.509 triple materializzate): `prototype/results/timeline/metrics.json`.
- **Senza spoiler.** L'API si ferma alla tappa scelta e oltre restituisce solo conteggi.

## Endpoint SPARQL

`GET /sparql?query=…`, `POST` form-urlencoded, `POST application/sparql-query`. Risultati JSON (predefinito), CSV, TSV, XML (`?format=` o header `Accept`); CONSTRUCT/DESCRIBE in Turtle o N-Triples. L'endpoint è in sola lettura (Update → 403), con CORS aperto, timeout di 10 s (la query bloccata viene interrotta terminando il worker) e un limite di 10.000 righe. Un browser che apre `/sparql` senza query viene reindirizzato al Lab.

| Grafo | Contenuto |
|---|---|
| grafo di default | realtà DEC del dataset retrospettivo (le query dell'audit girano invariate) |
| `http://w3id.org/conjectures/reality` | la stessa realtà, come grafo con nome |
| `http://example.org/dectective/world/<w>` | vista DEC del mondo `w` (gold) |
| `http://example.org/dectective/asserted/<w>` | contenuto asserito (`reality` = fatti narrati, `shared` = schema e assiomi) |
| `http://example.org/dectective/snapshot/<Ck>/<w>` | vista DEC al checkpoint Ck |
| `http://example.org/dectective/snapshot-asserted/<Ck>/<w>` | asserito al checkpoint Ck |
| `http://example.org/dectective/edition/text` | sezioni, paragrafi, frasi, parlanti, pagine |
| `http://example.org/dectective/edition/annotation` | proposizioni, moduli, mondi, unità di allineamento, collegamenti KGRC |
| `http://example.org/dectective/edition/runs` | esecuzioni DEC e loro diagnosi |
| `http://kgc.knowledge-graph.jp/data/ACaseOfIdentity` | grafo KGRC originale, invariato (CC BY 4.0) |

Le 27 domande d'esempio sono in `annotations/examples.yaml`, in 8 categorie: testo, chi ha detto cosa, credenze, identità e nomi, disaccordi e delusione, checkpoint, confronto con KGRC, provenienza DEC. Ognuna è verificata da un test.

## Architettura

```
edition/
  annotations/   curati a mano: sections, speakers, agents, worlds, labels, triple_anchors, examples.yaml,
                 alignment_issues_en.json (resa inglese delle note di allineamento dell'audit)
  data/          generati da scripts/build_edition_data.py: edition.nq (116.239 quad), text.json, catalog.json,
                 runs.json, provenance.json, build_info.json
  server/        Express 5 + Oxigraph 0.5 (store SPARQL in memoria, ~0,3 s per caricare tutto)
    src/timeline.ts  Deductions: conclusioni per indizio con premesse, eventi (verdetti, valori di Reality), limite spoiler
    src/rules/       perspectives (stati per mondo), viewpoints (persone, Reality, diagnosi, segni per frase),
                     incompatibility (disgiunzioni, chiusure), derivation
    src/dossiers.ts  rilevamento + passi SPARQL + resa deterministica dei case file
    src/graph.ts     elementi del diagramma a colonne (persone → punti di vista → affermazioni → cose e idee)
    src/sparql/      protocollo SPARQL 1.1 in un worker thread con timeout
    src/regression.ts  riesegue le query dell'audit sullo store dell'edizione
    test/            vitest + supertest
  web/           React 19 + Vite 8 + react-router 8, Cytoscape (caricato solo quando serve), CodeMirror 6,
                 font self-hosted (@fontsource: Barlow, Barlow Condensed, Literata, Courier Prime, IBM Plex Mono),
                 vocabolario in src/vocab.ts, icone in src/components/Glyphs.tsx, token grafici in src/theme/tokens.ts
  portraits/     ritratti dei personaggi (PNG aggiunti a mano) e prompt per generarli
  docs/screenshots/
```

Un solo processo Express serve la SPA, l'API JSON (`/api/*`) e l'endpoint `/sparql`.

## Dati e provenienza

Nessuna materializzazione dell'audit è stata ricalcolata. L'edizione riusa:
- i 30 dump DEC delle query (esclusa l'ablazione T06c, che compare tra le esecuzioni ma non nelle viste);
- gli snapshot di realtà C1–C4 del controllo di leakage;
- i moduli asseriti, il testo segmentato, le unità di allineamento e l'allineamento automatico con KGRC;
- i risultati dei test.

Le viste di ogni mondo sono l'unione delle slice in cui compare. La provenienza per tripla (quale esecuzione l'ha prodotta) è in `data/provenance.json`.

**Esecuzioni DEC complementari** (`scripts/run_edition_complement.py`), segnate come `complement` nella provenienza e nella pagina Method:

| Esecuzione | Contenuto | Tempo DEC |
|---|---|---|
| `complement-gold` | i 7 mondi gold mai materializzati da un test: `holmes_mother`, `holmes_motive`, `holmes_same_machine`, `h_author_other`, `v_windibank_delighted`, `v_windibank_machine`, `v_windibank_denial` | ~1 s |
| `check-denial` | controllo dei conflitti di DEC (`checkInconsistencies`, senza `closedFor`) sulla negazione di Windibank a Holmes, con le sue credenze, la ricostruzione e, come controllo, le altre due frasi dette a Holmes | ~6 s |
| `complement-C1` … `complement-C4` | ciascun checkpoint intero, perché il lettore investigativo veda tutti i mondi di ogni checkpoint | 3,4 / 3,7 / 5,2 / 9,1 s |

Le esecuzioni `complement` girano senza i flag di controllo dei conflitti (`checkInconsistencies`, `closedFor`), quindi senza diagnosi. `check-denial` invece usa `checkInconsistencies` e registra le diagnosi di DEC.

**La negazione di Windibank (aggiunta il 2026-11-23, dopo i run dell'audit).** A P119.S02–S03, quando Holmes mostra che le lettere di Hosmer hanno gli stessi difetti della macchina di Windibank, lui risponde “I cannot waste time over this sort of fantastic talk… If you can catch the man, catch him”: liquida l'allusione e parla di Hosmer come di un altro uomo. Il contenuto implicito, “io non sono Hosmer Angel”, è il mondo verbatim `W15_v_windibank_denial` (`st:windibank owl:differentFrom st:hosmer`), detto a Holmes (atto `F10_comm_act_denial`); nella simulazione senza spoiler i gemelli sono `sW07_v_denial` e `sF09_denial` (stadio C4). È una menzogna senza alcun assunto dichiarato: le credenze di Windibank (W06) e la realtà contengono l'identità, e `sameAs`/`differentFrom` sono incompatibili per OWL stesso. Nell'edizione questa incompatibilità è il tipo `distinct` di `rules/incompatibility.ts`, certo come la disgiunzione. DEC la conferma da solo (`check-denial`: `v_windibank_denial disagreesWith windibank_beliefs` e `reality`; nessun conflitto per “delighted” e per la macchina dell'ufficio). Le menzogne dicono ora anche a chi sono dette (“Windibank says it to Holmes, but believes otherwise”).

*Cosa è stato rieseguito:* `build_prototype.py` (moduli e dataset), `run_edition_complement.py` (complement + `check-denial` + stadi), `check_leakage.py` (0 fughe), `run_edition_timeline.py` (38 indizi, monotono), `build_edition_data.py`. *Cosa no:* la suite dell'audit T01–T10 e i tempi sui dataset interi. Le slice salvate restano valide: rigenerandole, 22 slice guadagnerebbero 3 triple inerti (tipo, parlante e destinatario del nuovo atto, per espansione k-hop), nessun mondo in più; l'unica risposta che cambierebbe è T04a (un atto in più).

Le note di allineamento con KGRC dell'audit erano in italiano: l'edizione usa la resa inglese in `annotations/alignment_issues_en.json`. Le correzioni proposte restano solo in `data/text_graph_alignment.csv`.

## Verifica

- **Regola dei punti di vista sul primo viaggio in Francia come viaggio reale.** Asserito nel mondo di Mary. Contraddetto nella ricostruzione di Holmes (testimone asserito) e nella realtà (ricevuto dalla ricostruzione). Contraddetto nell'ipotesi di Watson solo tramite la realtà ereditata, quindi Watson non ha una posizione propria. Mary risulta *sincere but false*.
- **Punti di vista.** Il secondo viaggio come viaggio reale dà una delusione di Mary, Holmes che conclude il contrario e Watson silente. In P067.S01 c'è la menzogna di Windibank, con Hosmer fuso in lui ("alias Hosmer Angel"); in P059.S02 c'è la delusione di Mary e nessuna menzogna. Il "cashier" di Hosmer è una menzogna solo assumendo un'occupazione per persona.
- **Identità Hosmer = Windibank.** Presente nella realtà, assente dal mondo di Mary (opacità).
- **Insincerità di Windibank sulla sparizione.** Rilevata, anche come Hosmer tramite l'identità.
- **Negazione di Windibank a Holmes (P119).** Menzogna detta a Holmes, senza assunti; case file “Lie” generato; scoperta nella timeline solo quando entrano le credenze di Windibank (P126.S11); nella simulazione allo stadio C4 è falsa ma senza menzogna, perché lì non ci sono credenze attribuite (`server/test/denial.test.ts`).
- **Case file.** Tutte le istanze attese vengono trovate, con i timbri attesi: Lie, Delusion, False alarm per "Windibank's beliefs" (bug `closedFor`). Almeno un passo è attribuito a DEC. Ogni case file appartiene a una delle cinque domande ed è numerato nel loro ordine. I punteggi dell'audit letti da `runs.json` coincidono con quelli del report (28/15/10/15 su 29). L'ipotesi "something happened to him", esclusa allo smascheramento, ha il timbro REFUTED: prima un controllo cercava la parola sbagliata e mostrava "Still open".
- **Regressione.** Le 29 query dell'audit (esclusa l'ablazione) rieseguite sullo store dell'edizione danno **25/29 risposte identiche** a quelle registrate da DEC. Le 4 differenze sono verificate esplicitamente in `server/test/regression.test.ts`: T04a (l'atto della negazione) e T05a (la negazione, insincera) vengono dalla negazione aggiunta dopo l'audit; le altre 2 dipendono dall'unione delle slice:
  - T03b: le ipotesi del run complementare ereditano la realtà, dove il fidanzamento vale *de re*;
  - T06a: si aggiunge `windibank_beliefs`, delusional solo per l'artefatto `closedFor`.
- **Endpoint.** GET/POST, JSON/CSV, ASK/CONSTRUCT, sola lettura, errori, redirect, timeout con recupero. Ognuno dei 27 esempi gira e restituisce risultati.
- **Grafica.** Contrasto WCAG di ogni coppia testo/sfondo usata, in entrambi i temi, con test di guardia: niente testo bianco o rosso su giallo.
- **Interfaccia.** Controllata con Firefox headless in entrambi i temi, a 1440 px e a 400 px, nella storia intera e senza spoiler, con e senza un ritratto PNG. Le schermate sono in `docs/screenshots/`.

## Limiti

- Parlanti, ancore e proposizioni hanno un solo annotatore. Le credenze di Windibank derivano dalla ricostruzione di Holmes e sono marcate come attribuzione dei curatori.
- Due mondi mai messi nella stessa slice con controllo dei conflitti non hanno un verdetto DEC tra loro.
- Gli indizi di derivazione riconoscono schemi: sono spiegazioni, non una riesecuzione del ragionatore.
- L'allineamento automatico con KGRC è lessicale e non verificato. Le unità curate sono verificate a mano.

## Licenze

| Componente | Licenza |
|---|---|
| Testo (1891) | pubblico dominio |
| Grafo KGRC (SIG-SWO, JSAI) | CC BY 4.0, mostrato invariato nel proprio grafo con nome |
| DEC reasoner (fvitali/dec-reasoner, commit `e6775b39`) | MIT |
| Font (Barlow, Barlow Condensed, Literata, Courier Prime, IBM Plex Mono) | SIL OFL |

La grafica è originale, ispirata alle copertine dei gialli italiani degli anni Trenta, senza marchi editoriali.
