# Prompt per Claude Code — A Case of Identity, KGRC e DEC

Agisci come ricercatore e research software engineer specializzato in knowledge representation, Semantic Web e Digital Humanities. Esegui un'analisi documentata e riproducibile: scarica le fonti, analizza il grafo, confrontalo con il racconto e costruisci un piccolo dimostratore dove serve a verificare le conclusioni. Non fermarti a proporre un piano.

Scrivi i report in italiano. Mantieni testo letterario, citazioni, nomi dei personaggi e identificatori tecnici in inglese.

## 1. Contesto e obiettivo

Remo Grillo e Valentina Pasqual stanno progettando un contributo per ADHO / DH a Galway, usando il framework DEC per studiare identità, credenze, congetture e divergenze fra prospettive nella narrativa investigativa.

Abbiamo scelto **A Case of Identity di Arthur Conan Doyle**, nell'originale inglese. Questo caso riguarda un'identità celata e un inganno: non forzarlo nello schema di un omicidio. Il bersaglio investigativo è identificare Hosmer Angel e ricostruire il raggiro, le informazioni disponibili e le convinzioni dei personaggi.

Esiste già un grafo KGRC sullo stesso racconto. Vogliamo stabilire, con evidenze tratte dal file e dal testo, se convenga:

- **A — riutilizzarlo sostanzialmente com'è**, con una configurazione aggiuntiva;
- **B — conservarlo e arricchirlo**, aggiungendo attribuzioni, contesti e informazioni mancanti;
- **C — trasformarlo in un diverso modello**, recuperando entità, eventi, contenuti e allineamenti utilizzabili;
- **D — rifare l'estrazione dal testo**, usando KGRC come confronto o fonte di ispirazione.

Sono ammesse soluzioni miste per componenti. Non assumere in anticipo che serva rifare tutto, né che basti aggiungere un nome di grafo per personaggio.

La preferenza progettuale è **CIDOC CRM + CRMinf per la rappresentazione, DEC per il trattamento inferenziale dei contesti**. Non introdurre SEM senza un'esigenza concreta e una motivazione esplicita. Questa preferenza non obbliga a convertire ogni tripla KGRC se un adattatore o un livello aggiuntivo conserva meglio le informazioni.

In questa fase vogliamo un audit completo e un prototipo circoscritto, non una migrazione completa decisa prima dell'analisi.

## 2. Fonti da acquisire e leggere

### Racconto: fonte di riferimento

PDF completo fornito dagli autori del progetto:

https://sherlock-holm.es/stories/pdf/letter/2-sided/iden.pdf

Eventuale versione HTML dello stesso sito, da verificare e collazionare con il PDF:

https://sherlock-holm.es/stories/html/iden.html

Il PDF resta il testimone scelto. Se usi l'HTML per facilitare l'estrazione, documenta eventuali differenze. Non sostituire il racconto con riassunti, adattamenti o ricostruzioni generate da un LLM.

### Grafo KGRC da esaminare

Pagina indicata dall'utente:

https://github.com/KnowledgeGraphJapan/KGRC-RDF/blob/master/2023ikgrc/ACaseOfIdentity.ttl

Corrispondente indirizzo raw da tentare:

https://raw.githubusercontent.com/KnowledgeGraphJapan/KGRC-RDF/master/2023ikgrc/ACaseOfIdentity.ttl

Repository:

https://github.com/KnowledgeGraphJapan/KGRC-RDF

Esamina anche README, documentazione della directory 2023ikgrc, ontologie e altri file necessari a interpretare questo grafo. Il repository include kgc.owl: verifica quale versione dello schema si applica effettivamente ai dati del 2023, senza assumere che qualsiasi schema nella radice sia automaticamente compatibile.

Documentazione scientifica del dataset:

https://ceur-ws.org/Vol-3443/ESWC_2023_SEMMES_Mystery.pdf

### DEC

Articolo di riferimento, “Provenance-Enhanced Statements in Knowledge Graphs”:

https://arxiv.org/abs/2606.15246

Se l'accesso fallisce, prova la copia del medesimo articolo:

https://www.alphaxiv.org/abs/2606.15246
https://pdfs.assets.alphaxiv.org/2606.15246v1.pdf

Leggi il paper, soprattutto formalizzazione, identità, tipi di mondo, implementazione, rilevazione dei conflitti e limiti. Non usare un riassunto automatico di alphaXiv come sostituto del paper. Registra la versione effettivamente letta.

Cerca il codice del reasoner nei riferimenti del paper, nella documentazione degli autori e nell'eventuale workspace già disponibile. Verifica che l'implementazione corrisponda al framework del paper: l'acronimo DEC può indicare altri sistemi.

### Ontologie

Punti di partenza ufficiali:

https://cidoc-crm.org/html/cidoc_crm_v7.1.3.html
https://cidoc-crm.org/extensions/crminf/html/CRMinf_v1.2.1.html

Verifica compatibilità e versioni, dichiarando quelle usate. Leggi le scope notes prima di proporre mapping. La presenza di un'etichetta simile non basta a giustificare un'equivalenza ontologica.

## 3. Metodo di lavoro e riproducibilità

Esamina prima il workspace e le istruzioni locali applicabili. Crea una directory di progetto dedicata, senza sovrascrivere materiali esistenti. Procedi autonomamente con download pubblici, analisi e prototipi locali necessari.

Per ogni fonte conserva URL richiesto ed effettivo, data di accesso, dimensione e SHA-256. Per Git registra commit e percorso; il branch master è modificabile. Se recuperi i file senza Git, conserva almeno checksum e URL, segnalando l'eventuale impossibilità di fissare il commit.

Mantieni immutati gli originali e separa download, dati normalizzati e derivati. Registra licenze e indicazioni di riuso effettivamente reperite, distinguendo testo, grafo e codice; una pagina pubblica non prova da sola una licenza di redistribuzione.

Usa strumenti semplici e riproducibili, per esempio Python, RDFLib, un estrattore PDF e SPARQL, con dipendenze dichiarate in un ambiente isolato. Usa Jena/Fuseki o altri componenti soltanto quando servono all'esperimento e documentane versione e configurazione.

Se un URL fallisce, prova raw, clone del repository o una fonte equivalente documentata. Non inventare file, conteggi o risultati. Se una componente rimane indisponibile, completa le parti indipendenti e indica precisamente ciò che non è stato verificato.

## 4. Acquisizione e preparazione del testo

1. Scarica il PDF e verifica che sia effettivamente un PDF leggibile, non una pagina di errore.
2. Estrai il testo completo preservando i riferimenti alle pagine.
3. Controlla ordine di lettura delle colonne, sillabazioni, caratteri alterati, intestazioni, piè di pagina e frontespizio. Ricorri a verifica visiva nei punti dubbi.
4. Produci una copia grezza e una normalizzata, documentando le trasformazioni.
5. Segmenta il corpo narrativo in paragrafi e, se utile, frasi con identificatori stabili. Conserva pagina e riferimento alla versione normalizzata; gli offset devono indicare la loro base.
6. Verifica inizio, fine e completezza del racconto. Riporta conteggio di parole e segmenti, specificando il metodo.
7. Leggi il racconto intero, compreso il finale: il gold standard retrospettivo richiede l'intero testo, anche se le simulazioni investigative useranno solo porzioni disponibili a un dato momento.

Distingui gli eventi del passato raccontati dai personaggi dagli eventi della conversazione con Holmes. Mantieni separati tempo della vicenda, momento in cui un personaggio acquisisce un'informazione e posizione dell'informazione nel testo.

## 5. Audit tecnico e semantico del grafo KGRC

Analizza davvero ACaseOfIdentity.ttl con un parser RDF. Se occorrono correzioni sintattiche, conserva l'originale e descrivi ogni modifica in un derivato separato.

Produci statistiche riproducibili almeno su:

- triple, soggetti distinti, IRI, blank node e letterali;
- namespace, classi e predicati con frequenze;
- lingue dei letterali e disponibilità effettiva dell'inglese;
- persone, luoghi, oggetti, eventi/scene e relazioni temporali, indicando come vengono contati;
- contenuti testuali e riferimenti alle fonti;
- collegamenti di identità, nomi alternativi e identificazioni;
- dichiarazioni, pensieri, ipotesi, negazioni e contraddizioni rappresentabili;
- eventuali nodi o relazioni che già codificano la soluzione.

Non assegnare significati ai predicati sulla sola base del nome. Se trovi costrutti come Situation, Statement, Thought, infoSource o equivalenti, studia documentazione e usi reali prima di interpretarli. Verifica se una fonte è il parlante, il narratore, l'informatore o un altro referente.

Per ogni conclusione importante mostra IRI reali, brevi estratti di triple e query o script che permettano di riprodurla. Gli esempi del grafo non devono essere inventati.

Rispondi in particolare:

- È un grafo dell'intero testo, di una selezione di frasi, di scene sintetiche o di una ricostruzione già interpretata?
- Che cosa rappresenta un nodo di scena? Un evento avvenuto, una dichiarazione, una proposizione, una situazione o una combinazione?
- Si distingue “A dice p” da “p” e da “A crede p”?
- Si può esprimere “A crede che B creda p” senza appiattire i livelli?
- L'identità fra alias e persona è già risolta globalmente? Con quali costrutti?
- È distinguibile l'ordine narrativo dall'ordine cronologico?
- Le affermazioni del detective vengono presentate come sue inferenze o direttamente come fatti?
- Sono preservate incertezze e alternative, oppure trasformate in affermazioni categoriche?
- Quali informazioni sono recuperabili mediante trasformazione e quali richiedono rilettura o nuova annotazione?

Un file Turtle può essere usato per produrre più contesti in un dataset derivato: non confondere l'assenza di named graph nella serializzazione con l'impossibilità di ricostruirli. Verifica però che siano presenti le informazioni necessarie a farlo correttamente.

## 6. Allineamento fra testo integrale e grafo

Costruisci un inventario dei passaggi rilevanti per identità, inganno, credenze, indizi e ragionamento. Allinea questo inventario al grafo.

Per ogni unità rilevante registra:

- ID del segmento testuale e breve estratto;
- soggetto dell'enunciazione e prospettiva;
- contenuto proposizionale;
- evento o intervallo temporale di riferimento;
- stato dell'informazione: osservata, riferita, creduta, ipotizzata, ricostruita;
- IRI KGRC corrispondenti, se individuabili;
- copertura: presente, parziale, assente, distorta o non determinabile;
- motivo dell'eventuale criticità e correzione necessaria.

Se l'allineamento è proposto automaticamente, segnalalo e verifica manualmente i passaggi centrali. Una somiglianza lessicale non basta a identificare la stessa proposizione.

Separa una ricognizione dell'intero racconto da un sottoinsieme di passaggi verificati in dettaglio. Riporta sempre i denominatori delle misure di copertura. Non trasformare una stima su pochi esempi in una percentuale di completezza dell'intero grafo.

Dedica particolare attenzione, verificandoli sul testo, a:

- Hosmer Angel, James Windibank e la risoluzione della loro identità;
- convinzioni e dichiarazioni di Mary Sutherland;
- ruolo della madre e grado di evidenza sul suo coinvolgimento;
- lettere, caratteristiche della macchina da scrivere e confronto documentale;
- descrizioni, travestimento, assenze riferite e successione degli incontri;
- interessi economici e attribuzione del movente;
- differenze fra ciò che Holmes comprende, ciò che spiega a Watson e ciò che Mary apprende effettivamente.

Non introdurre automaticamente la regola “stessa macchina da scrivere → stesso autore”: identifica quali premesse renderebbero valida una conclusione e quali passaggi restano abductivi o indiziari.

Il finale è un controllo essenziale: verifica se Mary riceve realmente la spiegazione. Una previsione di Holmes su ciò che lei crederebbe non equivale a una revisione osservata delle sue credenze.

## 7. Modello concettuale proposto

Proponi il minimo profilo CRM/CRMinf sufficiente a rappresentare il caso e a collegarlo a DEC. Valuta almeno:

- eventi e azioni, persone, nomi, luoghi, tempi e documenti;
- contenuti proposizionali separati dagli atti che li comunicano;
- credenze attribuite a un personaggio in un intervallo;
- ragionamenti, evidenze, premesse e conclusioni;
- intenzioni ingannevoli e attribuzioni di stati mentali ad altri;
- provenienza dell'annotazione e sua giustificazione testuale.

Produci una tabella **costrutto KGRC reale → elemento del profilo proposto → trasformazione → perdita informativa → annotazione aggiuntiva necessaria**.

Distingui equivalenza, specializzazione, trasformazione strutturale e semplice collegamento. Non usare owl:equivalentClass o owl:equivalentProperty come scorciatoie per mapping approssimativi. È possibile mantenere IRI KGRC e aggiungere un livello compatibile con CRM.

Dichiara l'uso intradiegetico del modello e separalo dagli eventi reali di pubblicazione, estrazione e annotazione. La “realtà” di riferimento è quella convenzionalmente ricostruita nel racconto, non il mondo storico reale.

### Identità

Distingui persona, nome/appellativo, persona sotto travestimento e identificazione attribuita a un osservatore. Esplicita come queste distinzioni si traducono nelle IRI usate nei test DEC.

- Non fondere preventivamente tutti i referenti durante la normalizzazione.
- Non dichiarare identici due appellativi solo perché designano la stessa persona.
- L'assenza di sameAs non equivale a differentFrom.
- Non attribuire a Mary una disuguaglianza esplicita senza giustificazione testuale.
- Verifica la sostituzione dei referenti dentro ciascun contesto e l'eventuale propagazione indesiderata dell'identità.

### Affermazioni non credute e inganno

Tieni distinti “A afferma p”, “A crede p”, “A crede non-p”, “A vuole far credere p a B” e “B adotta p”.

La mancanza di una credenza annotata non dimostra che il parlante non creda la proposizione. Una dichiarazione falsa può essere sincera; un atto ingannevole può usare anche contenuti veri.

Controlla le scope notes di CRMinf: I1 Argumentation presuppone sincerità dell'argomentazione e la versione indicata include E13 fra le sue sottoclassi. Valuta quindi un'attività comunicativa locale basata su E7 per una dichiarazione insincera, con credenze e intenzioni rappresentate separatamente. Non attribuire automaticamente al parlante la credenza nel contenuto delle sue parole.

Per ogni classificazione di menzogna indica evidenza, contemporaneità fra dichiarazione e credenza, ed eventuale inferenza sull'intenzione. Lascia indeterminati i casi insufficientemente attestati.

Verifica anche come tradurre i valori di credenza CRMinf in contenuti utilizzabili dal motore. “FALSE” riferito a un insieme di proposizioni non autorizza a negare tutte le proposizioni che contiene.

## 8. Dove serve realmente il motore inferenziale

Distingui esplicitamente quattro attività:

1. recuperare informazioni già espresse mediante query;
2. derivare conseguenze da assiomi o regole;
3. confrontare ipotesi e rilevare incompatibilità;
4. proporre spiegazioni abductive o interpretazioni testuali.

Non chiamare “deduzione dell'identità” una query che legge una tripla conclusiva già presente. Non attribuire a DEC l'estrazione dal testo o la produzione automatica di regole investigative.

Dal paper e dal codice verifica concretamente cosa facciano DEC e il reasoner sottostante. Documenta formato dei dati, versioni, entailment regime, operazioni disponibili e comportamento osservato. I termini tecnici devono corrispondere all'implementazione reperita.

Nel disegno dei test considera che il paper distingue contenuti verbatim senza inferenza, credenze con ragionamento locale, contenuti epistemici che contribuiscono alla realtà e congetture che ricevono fatti dalla realtà. Verifica questi comportamenti, compreso il contenuto condiviso, prima di usarli.

Non dare per implementata una revisione temporale automatica dei mondi: valuta snapshot e gestione esplicita degli aggiornamenti. Distingui inoltre un conflitto logico da una violazione SHACL o da un risultato di query.

### Domande sperimentali

Costruisci almeno 8 test pertinenti scegliendo e precisando queste domande:

| Domanda | Che cosa controllare |
|---|---|
| Chi è Hosmer Angel nella ricostruzione conclusiva? | Risposta esplicita, conseguenza logica o ipotesi selezionata? |
| Mary conosce quell'identità in una scena data? | L'identità esterna non deve essere attribuita automaticamente al suo punto di vista. |
| Quali conclusioni locali dipendono dalla disponibilità dell'identità? | Stesse regole, identità disponibile oppure assente. |
| Che cosa è stato detto, da chi e a chi? | Distinzione fra evento comunicativo e verità del contenuto. |
| Quali affermazioni risultano insincere? | Evidenza su credenza del parlante e intenzione; possibilità di risposta indeterminata. |
| Quali ipotesi sono incompatibili con le evidenze disponibili? | Assiomi necessari e motivo preciso dell'incompatibilità. |
| Quali divergenze fra prospettive sono giustificate dal testo? | Disaccordo effettivo, semplice ignoranza o contenuto non annotato. |
| Come cambiano le conclusioni dopo una nuova evidenza? | Aggiornamento del contesto corretto, senza alterare retroattivamente gli snapshot. |
| Che cosa si può inferire dai documenti dattiloscritti? | Conseguenze autorizzate, assunzioni aggiuntive e alternative ancora compatibili. |
| Il finale modifica le credenze di Mary? | Separazione fra rivelazione al lettore, previsione del detective e informazione comunicata. |

Per ogni test specifica input disponibili, output atteso e giustificazione testuale, regole richieste, mondo/tempo, risultato osservato e limiti. Distingui almeno “derivabile”, “incompatibile” e “non determinato”; non convertire automaticamente una risposta non derivata in falsa.

Non creare contraddizioni artificiali solo per mostrare un vantaggio di DEC. Se una prospettiva non è dimostrabilmente incompatibile con la ricostruzione di riferimento, non classificarla come delusional. Se il motore espone questa etichetta, chiarisci che si tratta di una classificazione tecnica relativa ai dati e agli assiomi.

## 9. Separazione fra analisi retrospettiva ed esperimento investigativo

Prepara due modalità distinte.

### Analisi retrospettiva

Usa l'intero racconto per una ricostruzione di riferimento annotata, conservando il grado di certezza e la provenienza delle affermazioni. Confronta gli stati mentali dei personaggi con questa ricostruzione senza imporre loro la conoscenza del finale.

Non trattare ogni frase del detective come verità onnisciente: distingue spiegazione accolta dalla narrazione, prova ulteriore, congettura e punto non risolto.

### Simulazione progressiva

Definisci checkpoint basati sulle scene o sui segmenti e costruisci gli input disponibili fino a ciascuno. Il gold finale rimane separato, accessibile alla valutazione e non al risolutore.

Controlla fughe della soluzione attraverso:

- triple, equivalenze e collegamenti di identità;
- etichette, commenti, nomi di file e IRI rivelatrici;
- scene future, riepiloghi e spiegazioni retrospettive;
- metadati di provenienza che espongono contenuti futuri;
- mondi epistemici o condivisi da cui il finale può permeare nelle congetture.

Per il prototipo è preferibile separare fisicamente il dataset del gold da quello della simulazione, se questo riduce ambiguità. Specifica se il checkpoint simula le informazioni del lettore o quelle di un particolare personaggio: non sono necessariamente coincidenti.

Una congettura compatibile non è per questo provata vera. Se più ipotesi rimangono ammissibili, riportale; se ottieni unicità solo chiudendo artificialmente il dominio dei candidati o introducendo altre assunzioni, dichiaralo.

## 10. Prototipo minimo e confronto controllato

Dopo l'audit, seleziona un sottoinsieme giustificato di circa 8–12 passaggi centrali e almeno tre prospettive testualmente documentabili. Non inventare stati mentali per raggiungere una quota.

Costruisci un derivato piccolo ma ispezionabile che mostri:

- allineamento al testo;
- contenuti attribuiti e contesti temporali;
- una questione d'identità;
- un evento comunicativo con stato di credenza distinto;
- almeno un confronto fra ipotesi o un aggiornamento informativo documentato.

Confronta, ove tecnicamente fattibile:

1. **KGRC originale:** che cosa risponde già?
2. **Dataset derivato con query esplicite e reasoning standard:** che cosa si ottiene senza DEC?
3. **Lo stesso contenuto e gli stessi assiomi con DEC:** quale comportamento cambia per la gestione dei contesti?

Mantieni comparabili dati, assiomi e quesiti. Se una configurazione usa informazioni aggiuntive, separa il vantaggio dovuto all'arricchimento da quello dovuto al motore. Un confronto con un grafo appiattito può essere utile come prova del problema, ma includi anche una baseline con query correttamente contestualizzate.

Se il reasoner DEC è disponibile e installabile, esegui i test e conserva risultati e comandi. Se non lo è:

- completa audit, allineamento e valutazione del riuso;
- esegui le baseline disponibili;
- produci fixture e attese per una futura esecuzione DEC;
- distingui chiaramente risultati eseguiti, risultati attesi e simulazioni;
- non presentare un'implementazione ad hoc come validazione del reasoner degli autori.

Misura l'esecuzione solo se utile; su un piccolo campione non rivendicare scalabilità. Non avviare estrazioni massive o valutazioni LLM a pagamento per completare questo audit.

Come sviluppo successivo, descrivi brevemente un esperimento LLM con e senza DEC a parità di evidenze. Considera la possibile memorizzazione del racconto; anonimizzare nomi e confrontare varianti è un controllo diagnostico, non una garanzia di assenza di contaminazione.

## 11. Decisione sul riuso

Concludi con una raccomandazione motivata fra A, B, C e D, anche differenziata per componente:

| Componente | Riutilizzabile? | Intervento necessario | Evidenza | Rischio residuo |
|---|---|---|---|---|
| Entità e denominazioni | | | | |
| Eventi e scene | | | | |
| Successione temporale | | | | |
| Contenuti testuali e allineamenti | | | | |
| Dichiarazioni e fonti | | | | |
| Credenze e congetture | | | | |
| Identità contestuale | | | | |
| Negazioni e incompatibilità | | | | |

Distingui trasformazioni automatiche, aggiunte ricavabili dal testo con revisione umana e informazioni non sufficientemente attestate. Stima l'impegno per componenti, con assunzioni e intervalli ragionevoli, evitando percentuali non misurate.

Indica esplicitamente anche dove DEC non offre un vantaggio rispetto a query o regole standard. La conclusione può essere che alcuni obiettivi sono già soddisfatti dal grafo o che il racconto non sostiene tutti gli esperimenti desiderati.

## 12. Deliverable

Organizza i risultati in una directory dedicata. Puoi adattare i nomi alla struttura esistente, ma produci almeno:

- **README.md** — obiettivo, risultati principali, struttura e comandi di riproduzione.
- **sources/manifest.json** — URL, versioni, checksum, provenienza e note sulle licenze.
- **sources/** — PDF, Turtle e schema originali acquisiti, separati dai derivati.
- **data/text/** — estrazione grezza, testo normalizzato e segmentazione con riferimenti.
- **scripts/** — acquisizione/normalizzazione e analisi riproducibili, con dipendenze.
- **reports/graph_audit.md** e **data/graph_stats.json** — risultati dell'ispezione del grafo.
- **data/text_graph_alignment.csv** — allineamento, copertura e criticità.
- **reports/reuse_decision.md** — scelta fra riuso, arricchimento, trasformazione o nuova estrazione.
- **reports/conceptual_model.md** — profilo CRM/CRMinf, mapping e trattamento di identità, tempo e inganno.
- **reports/reasoning_assessment.md** — utilità concreta di DEC, baseline, ipotesi e limiti.
- **prototype/** — dataset minimo, eventuali regole, query, attese e risultati.
- **reports/next_steps.md** — lavoro necessario per passare dal prototipo allo studio.

Per file non prodotti spiega il motivo. Non creare output vuoti che sembrino risultati completati. Nel report finale cita passi testuali, IRI KGRC, sezioni delle specifiche e risultati dei test; i link web da soli non bastano a giustificare la valutazione.

## 13. Criteri di completamento

Il lavoro è concluso quando:

- testo e grafo sono stati acquisiti, oppure un limite di accesso è documentato precisamente;
- il grafo è stato analizzato con strumenti, non solo descritto;
- le conclusioni sul riuso sono motivate da esempi allineati al testo;
- è chiaro cosa già rappresenti KGRC e cosa richieda nuova annotazione;
- il profilo proposto distingue fatti, dichiarazioni, credenze, congetture e attribuzioni;
- i test distinguono lettura della soluzione, inferenza e selezione di ipotesi;
- lo stato di esecuzione del reasoner DEC è dichiarato senza ambiguità;
- la simulazione non riceve implicitamente la soluzione dal gold finale;
- risultati, limiti e prossimi interventi sono riproducibili e ispezionabili.

Nel messaggio conclusivo apri con il verdetto sul riuso del grafo e le prove principali. Poi indica i test in cui DEC aggiunge valore, quelli in cui non serve e i punti ancora da verificare. Non chiedere agli autori di scegliere una strategia prima di avere completato questa analisi.

