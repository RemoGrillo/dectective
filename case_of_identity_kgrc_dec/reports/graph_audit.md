# Audit tecnico e semantico del grafo KGRC «A Case of Identity»

Riproduzione: `scripts/graph_audit.py` → `data/graph_stats.json`, `data/kgrc/{scenes,entities,source_vs_text}.csv`, `data/kgrc/anomalies.json`; query SPARQL in `scripts/queries/kgrc/Q01–Q15.rq`, risultati in `data/kgrc/query_results/`. Prefissi usati sotto: `d:` = `http://kgc.knowledge-graph.jp/data/ACaseOfIdentity/`, `kgc:` = `http://kgc.knowledge-graph.jp/ontology/kgc.owl#`, `pred:` = `http://kgc.knowledge-graph.jp/data/predicate/`.

## 1. Oggetto, versione e provenienza

| Elemento | Valore verificato |
|---|---|
| File | `sources/kgrc/ACaseOfIdentity.ttl`, 507.686 B, SHA-256 `def23673…` (manifest) |
| Repository / commit | KnowledgeGraphJapan/KGRC-RDF, `master` @ `d62328bd166d…` (clone sparse in `vendor/`); ultimo commit che modifica il file: `cae95727` (2023-07-24, «added 2023ikgrc on the master») |
| Altre copie | Il branch `ikgrc2023` contiene lo **stesso blob** (`022b8cb7…`) alla radice: è la versione descritta nel paper CEUR (nota 4) |
| Metadati interni | `d:metadata rdfs:comment "作成日（2022-12-02）"@ja`; `cc:license <https://creativecommons.org/licenses/by/4.0/>`; `cc:attributionName "SIG-SWO, JSAI"` |
| Licenza | CC BY 4.0 (README di `2023ikgrc/`, file `LICENSE`, triple `cc:license`) |
| Versioni precedenti nel repo | `2019/`, `2020/`, `2020v2/ACaseOfIdentity.ttl` (non analizzate: fuori ambito) |
| Parsing | rdflib 7.6.0 e Jena 4.8.0: **7.217 triple** con entrambi; nessuna correzione sintattica necessaria, quindi nessun derivato `.fixed.ttl` |

**Schema applicabile.** Il TTL dichiara inline 44 proprietà (`owl:ObjectProperty`/`AnnotationProperty`/`DatatypeProperty`), con commenti che citano un namespace diverso (`…/kgcc.owl#`, doppia «c») da quello effettivamente usato (`kgc.owl#`). `2023ikgrc/kgc.owl` (58 termini) è un sottoinsieme di `kgc.owl` in radice (62 termini): la radice aggiunge solo l'intestazione d'ontologia, `dc:title`, `dc:description`, `xsd:DateTime`. Termini `kgc:` usati nei dati ma **non dichiarati né inline né in alcuno schema**: `kgc:CanAction`, `kgc:PhysicalObject`, `kgc:after`, `kgc:and`, `kgc:hadPredicate`, `kgc:whoｍ` (con «ｍ» full-width U+FF4D) e una proprietà con local name vuoto (`kgc:`). Nessuno dei **206 valori distinti di `kgc:hasPredicate`** e dei **75 di `kgc:hasProperty`** (namespace `pred:`) è dichiarato in uno schema: il vocabolario delle azioni è non tipizzato.

## 2. Statistiche (metodo dichiarato per ogni voce)

**Livello RDF.** 7.217 triple; 1.415 soggetti distinti; 1.496 IRI distinti in qualsiasi posizione; 0 blank node; 2.538 occorrenze di letterali (2.355 distinti): 2.511 `rdf:langString`, 26 `xsd:dateTime`, 1 stringa semplice.

**Namespace (occorrenze s/p/o).** `d:` 6.023 s / 2.419 o; `kgc:` 4.136 p / 1.578 o / 114 s; `pred:` 1.074 s / 617 o; `rdf:` 1.587 p; `rdfs:` 1.492 p; due pseudo-namespace generati da IRI malformati (`d:mother_of_Sutherland&#…`, `d:Sutherland&#…`).

**Classi (`rdf:type`, istanze distinte, tipizzazione multipla ammessa).** `kgc:Statement` 389, `kgc:PhysicalObject` 248, `kgc:Object` 213, `kgc:Action` 206, `kgc:Situation` 149, `kgc:OFobj` 129, `kgc:Property` 75, `kgc:NotAction` 30, `kgc:Thought` 21, `kgc:AbstractTime` 21, `kgc:Person` 18, `kgc:Place` 13, `kgc:CanNotAction` 10, `kgc:CanAction` 4.

**Predicati più frequenti.** `rdf:type` 1.587, `rdfs:label` 1.438, `kgc:source` 1.073, `kgc:what` 801, `kgc:subject` 482, `kgc:hasPredicate` 457, `kgc:infoSource` 410, `kgc:then` 168, `kgc:ofWhole` 159, `kgc:ofPart` 129, `kgc:hasProperty` 94, `kgc:when` 75, `kgc:where` 53, `kgc:whom` 51; `kgc:infoReceiver` **0**.

**Scene** (soggetti tipizzati `Statement|Situation|Thought|Talk`, conteggiati una volta): **557**: 387 solo `Statement`, 147 solo `Situation`, 21 `Thought`, 2 `Situation+Statement` (`d:122`, `d:161`). 539 hanno ID numerico (intervallo 1–580, **41 ID mancanti**, es. 3, 9, 46, 50…), 18 hanno suffisso (`04a`, `21a`, `67a`, `495a`, …). 536 hanno `kgc:source` sia `@en` sia `@ja`. Sei scene non hanno né `hasPredicate` né `hasProperty` (`d:161`, `d:196`, `d:312`, `d:430`, `d:579`, `d:71a`).

**Confronto con il paper (Kozaki et al. 2023, Tab. 1: 544 scene, 449 hasPredicate, 86 hasProperty, 464 subject, 396 infoSource).** Sullo stesso blob, contando solo le scene con ID numerico si ottiene `subject` = 464 (identico), `infoSource` = 394, `hasPredicate` = 441, `hasProperty` = 93, 539 scene. I conteggi del paper non sono quindi interamente riproducibili con un metodo esplicito: le differenze (≈1–8%) dipendono da criteri non documentati (`graph_stats.json → scenes.counting_alternatives`).

**Lingue.** `kgc:source`: 536 `@en` + 536 `@ja`; `rdfs:label`: 796 `@en` + 642 `@ja`; tutte le 796 entità non-scena hanno un'etichetta inglese. L'inglese è disponibile, ma **non è testo di Doyle** (§3.6).

**Entità.** Persone (18 `kgc:Person`): `d:Holmes`, `d:Watson`, `d:Sutherland`, `d:Windibank`, `d:Hosmer`, `d:mother_of_Sutherland`, `d:father_of_Sutherland`, `d:Etheridge` (nel testo «Etherege»), `d:husband_of_Etheridge`, `d:Hardy`, `d:Ned`, `d:Boy`, ma anche `d:police`, `d:Single_women`, `d:parent`, `d:Woman`, `d:Man` e perfino **`d:hansom_carriage`** (una carrozza tipizzata come persona). Luoghi 13, `AbstractTime` 21, oggetti fisici 248 (metodo: `rdf:type`, non disgiunti).

**Tempo.** 26 triple `kgc:time` su 25 scene, con date dal 1877 al 1891 (es. `d:001` 1891-09-01T10:00, `d:223` 1891-08-14T14:00). Il testo **non indica anno né mese** (solo «the fourteenth», «Friday», «last Friday», «last Saturday»): le date sono aggiunte dagli annotatori. Sono anche incoerenti: `d:221` («Windibank left for England just before the letter arrived») è datato 1891-08-27, dopo `d:219` (lettera tornata «on the morning of the wedding day», 1891-08-14), mentre il testo richiede la partenza prima del ritorno della lettera (P053.S07, P055.S01). La data della consultazione (1891-09-01) contraddice «That was last Friday» (P057.S06).

**Relazioni tra scene.** `then` 168, `therefore` 11, `at_the_same_time` 10, `if` 6, `because` 5, `after` 2, `and` 1, `otherwise` 0. Il grafo `then` ha 187 nodi in **20 componenti** (la maggiore di 113 nodi) e **370 scene ne restano fuori**. Non è aciclico: `d:558 kgc:then d:558` (auto-anello). Nessun arco `then` punta a un ID inferiore. Tra scene: 470 archi `kgc:what` (117 scene "contenitore", profondità massima di annidamento 3).

**Negazione e modalità.** `kgc:Not` 30, `kgc:canNot` 10, `kgc:can` 4, `kgc:if` 6; 40 predicati negativi lessicalizzati (`pred:notKnow` 6, `pred:notHave` 6, `pred:notWant` 5, …, `pred:notBelieve` 1, `pred:notAppear` 1). La negazione è quindi in parte un costrutto (`kgc:Not`) e in parte un'etichetta lessicale non collegata al predicato positivo.

## 3. Interpretazione dei costrutti (documentazione + uso reale)

1. **Costruzione documentata.** Il paper descrive questa procedura: frasi «necessary for deduction» estratte manualmente (300–500 per racconto) da traduzioni giapponesi, riscritte in frasi brevi (una frase = una scena), arricchite di ruoli 5W1H con strumenti NLP, quindi **tradotte in inglese** (passo 6, «about 1 hour per person»). Sono incluse «false statements spoken by the characters».
2. **Scena.** Non è un'unità del testo, ma una frase riscritta che fonde descrizione d'evento e proposizione (`kgc:subject` + `kgc:hasPredicate` + 5W1H).
3. **`Situation` / `Statement` / `Thought`.** Uso osservato (Q01, Q02): tutte le 389 `Statement` hanno `infoSource`, solo 2/149 `Situation` l'hanno, tutte le 21 `Thought` l'hanno. Le `Situation` sono di fatto eventi del livello narrativo (es. `d:001` «Holmes stood out of a chair»); le `Statement` sono contenuti attribuiti a una fonte; le `Thought` sono contenuti mentali. Gli atti linguistici sono `Situation` con `hasPredicate pred:say` e `kgc:what` verso le `Statement`-contenuto (66 delle 73 scene `say` incorporano scene, Q03): ad esempio `d:113` «Sutherland said the following» → `d:114 … d:128`, `d:472` (ricostruzione di Holmes) → `d:473 … d:507`, `d:558` (spiegazione a Watson) → `d:559 … d:580`.
4. **`kgc:infoSource`.** Non ha una semantica unica. Nei 470 incorporamenti, il valore coincide con il soggetto dell'atto contenitore in 391 casi, differisce in 63, manca in 16. Talvolta è il parlante originario (`d:128` «Sutherland has no clothes to wear», `infoSource d:Windibank` dentro la testimonianza di Mary `d:113`), talvolta il relatore (`d:67a`, `infoSource d:Sutherland` sotto `d:067` «Windibank does not want…»), talvolta un **nodo segnaposto** non tipizzato come persona: `d:Hosmer_s_statement` (8 occorrenze), `d:Sutherland_s_thoughts` (4), `d:Hosmer_s_thoughts` (2), `d:Windibank_s_Thoughts` (1), `d:The_speaker_s_statement` (1), `d:mother_of_Sutherland&#39_s_remark` (1, IRI malformato), `d:someone_of_Company` (1), `d:Father_of_Sutherland` (1, variante maiuscola della persona `d:father_of_Sutherland`). Il destinatario (`kgc:infoReceiver`) non è mai annotato.
5. **`kgc:what` tra scene** è sovraccarico. Collega l'atto linguistico al contenuto (`d:113`→`d:114`), il desiderio al suo oggetto (`d:067 pred:notWant` → `d:67a pred:visit`) e il pensiero alla proposizione (`d:081 pred:think` → `d:082`).
6. **`kgc:source@en`.** Nessuna delle 536 stringhe inglesi è una sottostringa letterale del testo normalizzato (0/536). La similarità `token_set_ratio` con la frase più vicina ha quartili 52,8 / 61,5 / 71,4 e solo il 2,2% supera 90 (`source_vs_text.csv`). Sono visibili artefatti di traduzione automatica: `d:018` «The above is color love Saya» (da 色恋沙汰, «affare di cuore»), `d:168` «teller of Redon Hall Street office» (Leadenhall), `d:091` «quarter and five o'clock» (4½ per cent), `d:360` «There is a small boat on the top of Hosmer's head»; inoltre 13 letterali contengono entità HTML (`&#39;`) e 3 letterali `@en` contengono caratteri giapponesi (`d:079`, `d:092`, `d:101`).
7. **Etichette.** Nomi incoerenti: `d:Hosmer` ha anche l'etichetta «サザランド» (Sutherland); `d:mother_of_Sutherland` ha «サザランドの父» («padre di Sutherland»); `d:Windibank` ha «ウィンディバンクの物腰» («i modi di Windibank»); `d:Sutherland` ha «サザランドと». Ci sono inoltre 21 coppie di IRI che differiscono solo per maiuscole (`d:Father_of_Sutherland`/`d:father_of_Sutherland`, `d:Money`/`d:money`, `d:Typewriter`/`d:typewriter`, …).

## 4. Risposte alle domande del §5

| Domanda | Risposta con evidenza |
|---|---|
| Intero testo, selezione, scene sintetiche o ricostruzione? | **Selezione di scene sintetiche, in parte interpretate.** Frasi riscritte da una traduzione giapponese e ritradotte (§3.1, §3.6). Il candidato automatico di allineamento colloca scene in 70 dei 138 paragrafi (stima euristica, `alignment_auto.csv`). La ricostruzione di Holmes vi entra come sue `Statement` (`d:472`, `d:558`), con l'identità già applicata. |
| Che cosa rappresenta un nodo di scena? | Una combinazione: evento narrato (`Situation`), contenuto attribuito (`Statement`), contenuto mentale (`Thought`). Gli atti linguistici sono `Situation` che incorporano `Statement` (§3.3). |
| Si distingue «A dice p» da «p» e da «A crede p»? | **In parte, strutturalmente, non semanticamente.** «A dice p» = `say`-`Situation` + `Statement` incorporata. «p» = `Situation` senza fonte. «A crede p» = scena `pred:think/believe` + `what`, oppure `Thought`. Però la stessa proprietà `infoSource` serve per dire e per credere; `pred:believe` codifica anche impegni (`d:207`, `d:244`, `d:287` per «be true to him») e la testimonianza di Mary è talvolta promossa a fatto narrativo (`d:257` `Situation` «mother said to Sutherland», `d:259` «Windibank said»). |
| «A crede che B creda p» senza appiattire? | **Rappresentabile ma non tipizzato.** Esistono annidamenti fino a profondità 3, es. `d:512` (Holmes: «Sutherland thinks that») → `d:513` `Thought` «Windibank is in France», `infoSource d:Sutherland_s_thoughts`. Il livello intermedio è però un segnaposto: l'atteggiamento non è un tipo e manca il tempo. |
| Identità alias/persona già risolta globalmente? | **No come identità logica; sì come contenuto testuale.** 0 `owl:sameAs`, 0 `owl:differentFrom`. La soluzione è in `d:504` («Windibank is Hosmer») come `d:Windibank kgc:hasProperty pred:Hosmer`, con `pred:Hosmer` ≠ `d:Hosmer` (nessun collegamento, Q04/Q05). Nelle scene di Holmes la sostituzione è già applicata **dentro gli atteggiamenti di Mary**: `d:507` «Sutherland loves Windibank», `d:518` «Windibank gets engaged with Sutherland», `d:524` «heart_of_Sutherland engrave Windibank». |
| Ordine narrativo vs cronologico? | **Solo l'ordine narrativo è recuperabile** (ID e `then`). Il tempo della vicenda è parziale (26 `kgc:time`, non testuali, incoerenti). Gli eventi passati raccontati da Mary sono ordinati secondo il racconto. Il momento di acquisizione dell'informazione da parte dei personaggi è assente. |
| Le affermazioni del detective sono inferenze o fatti? | **Sue affermazioni** (`infoSource d:Holmes`, 171), non fatti: è corretto. Ma **non inferenze**: mancano premesse e conclusione esplicite (in `d:558`, tra le premesse `d:561–d:575` e l'identità `d:504` non ci sono `because`/`therefore`) e la regola applicata non compare. |
| Incertezze e alternative preservate? | **Spesso perse.** «seemed to think» (P067.S01) → `d:259`/`d:260` categorici. «would recognise» (P134.S04) → `d:568` «Sutherland notices Windibank handwriting». Il condizionale «If I tell her she will not believe me» (P138.S01) → `d:578` categorico, con `d:579` `Situation` vuota `kgc:if d:580` scollegata da `d:578`. Conservati invece «I believe that he foresaw some danger» (`d:250` `Thought`) e l'ipotesi di Watson respinta (`d:378`, `d:380`, `d:382` «not important»). |
| Che cosa si recupera trasformando e che cosa richiede rilettura? | Vedi §6. |

**Named graph ricostruibili?** Sì, in parte. Da `infoSource` e dall'incorporamento `say`/`think`→`what` si possono generare automaticamente insiemi di contenuti per fonte (contesti). Mancano però le informazioni per tipizzarli correttamente: atteggiamento (detto/creduto/saputo/congetturato), tempo, destinatario, distinzione relatore/fonte, sincerità. Servono inoltre la disambiguazione dei segnaposto e delle varianti di IRI e il trattamento delle scene in cui la soluzione è già sostituita.

## 5. Nodi che già codificano la soluzione (rischio di fuga in simulazione)

- `d:504` (identità), `d:497–d:501` (travestimento), `d:496` (aiuto della madre), `d:563` («Windibank and Hosmer do not appear together»), `d:564–d:566`, `d:575` («The characteristics of the type matched Hosmer»), `d:577` («The document is Windibank»).
- **Letterale fuorviante e rivelatore**: `d:280` ha `kgc:subject d:Windibank` (affermazione di Mary, P077.S01), ma la sua `kgc:source@en` è «Hosmer is a foreign company in West House & Marbank». Il letterale nomina Hosmer come dipendente della ditta di Windibank: in un checkpoint costruito sulle stringhe inglesi è una fuga della soluzione.
- Le scene di Holmes con referenti sostituiti (`d:507`, `d:518`, `d:524`) portano l'identità dentro contenuti attribuiti a Mary.

## 6. Che cosa si recupera e come (sintesi; tabella completa in `conceptual_model.md`)

| Componente | Recupero | Nota |
|---|---|---|
| Entità principali e appellativi | trasformazione automatica + revisione | segnaposto, varianti di maiuscole, etichette errate, carrozza come `Person` |
| Atti linguistici (chi dice a chi) | trasformazione parziale | parlante sì (soggetto della `say`-`Situation`); destinatario assente; relatore/fonte confusi |
| Contenuti proposizionali | trasformazione strutturale | n-ario → triple del profilo; 206 predicati non tipizzati da mappare a mano |
| Credenze/pensieri | parziale, con rilettura | `Thought` e `pred:think` sì; impegni codificati come `believe`; modalità e tempo assenti |
| Ricostruzione di Holmes | parziale | contenuti presenti; struttura inferenziale e grado di conferma assenti; identità non logica |
| Ordine | trasformazione | narrativo sì; fabula e acquisizione da annotare |
| Testo e allineamento | nuova annotazione | `kgc:source` non è testo di Doyle |

## 7. Query riproducibili

| Query | Righe | Uso |
|---|---|---|
| Q01_scene_types | 3 | tipi di scena |
| Q02_infosource_by_type | 17 | fonti per tipo |
| Q03_speech_embedding | 385 | atti linguistici e contenuti |
| Q04_identity_explicit | 3 | `sameAs` (0), `pred:Hosmer`, `equalTo` |
| Q05_who_is_hosmer_kgrc | 1 | lettura di `d:504` (lookup, non deduzione) |
| Q06_negation | 4 | dispositivi di negazione |
| Q07_mental_predicates | 39 | predicati mentali |
| Q08_scene_relations | 12 | relazioni tra scene tipizzate |
| Q09_ending | 41 | `d:558`, `d:578–d:580` |
| Q10_typewriter_signature | 53 | lettere, firma, caratteristiche |
| Q11_mother | 22 | madre |
| Q12_money | 21 | denaro e rendita |
| Q13_holmes_acts | 56 | contenuti di `d:472`/`d:558` |
| Q14_france_absence | 6 | Francia/Bordeaux |
| Q15_mary_beliefs | 24 | credenze di Mary |
