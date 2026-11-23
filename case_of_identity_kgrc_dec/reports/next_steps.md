# Dal prototipo allo studio: lavoro necessario

Le stime sono intervalli in ore-persona per una persona esperta del dominio, con le assunzioni indicate. Non derivano da misure di produttività.

## 1. Annotazione (la parte che il riuso di KGRC non copre)

| Attività | Base di partenza | Stima | Assunzioni |
|---|---|---|---|
| Inventario completo di atti comunicativi (parlante, destinatario, relatore, citazione) | 66 scene `say` di KGRC come candidati; 138 paragrafi | 12–20 h | dialogo denso nelle pp. 2–8; la revisione ricontrolla ogni attribuzione |
| Credenze per personaggio e per intervallo (Mary, Windibank, madre, Holmes, Watson) | `Thought`/`pred:think` di KGRC + inventario `passage_inventory.csv` | 10–16 h | atteggiamenti attestati solo dove il testo li giustifica; nessuna credenza inventata per completezza |
| Ricostruzione di Holmes come I5 (premesse, logica, conclusione, corroborazioni) | `d:472`, `d:558` e P124–P136 | 4–8 h | una catena principale + corroborazioni (P127, P136) |
| Tempo della vicenda e momenti di acquisizione | nessuno (KGRC `kgc:time` non riusabile) | 4–6 h | tempo relativo; niente date assolute |
| Tabella predicati KGRC → proprietà del profilo | 206 + 75 valori `pred:` | 6–12 h | solo i predicati usati nelle scene rilevanti; il resto resta collegamento |
| Revisione delle entità (segnaposto, varianti di maiuscole, etichette, classi errate) | `entities.csv`, `anomalies.json` | 3–5 h | 796 entità, la maggior parte irrilevante per le domande |
| Seconda annotazione indipendente su un campione e misura dell'accordo | — | 8–12 h | campione di 30–40 unità; serve per una pubblicazione ADHO |

## 2. Motore e infrastruttura

1. **Segnalare agli autori di DEC** il difetto di `verifyClosedFor` (condizione `<=` sempre vera; `break` invece di `continue`), con E13 come caso minimo. Un'eventuale correzione va eseguita come variante dichiarata, non spacciata per il reasoner originale.
2. Chiarire con gli autori: tipo di default dei grafi con nome (verbatim nel codice, doxastic nel paper); seconda `handlePermeation()` non nulla; marcatura `delusional` dei mondi verbatim; mancata interpretazione dei mondi annidati e delle inferenze in reificazione; assenza di `settle`.
3. **Prestazioni**: lo slicing per query è necessario. Senza slicing, un checkpoint di circa 350 triple con il frammento CRM nello shared richiede minuti; con lo slicing ci vogliono 0,1–15 s (`dec_performance.md`). Per uno studio più ampio: (a) schema minimo nello shared, CRM completo solo per l'esportazione; (b) `checkInconsistencies` attivato solo nelle query che lo richiedono; (c) limitare il numero di mondi per slice (costo O(n²)).
4. Annidamento («A crede che B creda p»): DEC non lo interpreta. Si può spianare in mondi distinti con IRI composti (es. `w:holmes_thinks_mary_believes`) e predicati governanti dichiarati nella realtà, documentando la perdita della struttura gerarchica.

## 3. Estensione del corpus

Il caso regge bene i test d'identità e d'inganno, ma **non** sostiene alcuni esperimenti desiderati. Non c'è revisione delle credenze di Mary osservabile nel testo (il finale è una previsione) e mancano congetture concorrenti di più personaggi con evidenze contrastanti (Watson formula una sola ipotesi). Per un contributo DH più robusto conviene aggiungere uno o due racconti KGRC con aggiornamenti di credenza osservati, per esempio *The Speckled Band* o *Silver Blaze*, verificandoli sul testo con lo stesso protocollo.

## 4. Esperimento LLM con e senza DEC (sviluppo successivo, non eseguito)

**Domanda.** A parità di evidenze, la contestualizzazione esplicita (mondi DEC materializzati) riduce gli errori di attribuzione (fuga dell'identità nel punto di vista di Mary, «detto = vero», previsione = evento) rispetto a un contesto piatto?

**Disegno.**

- *Condizioni:* (1) testo dei segmenti fino al checkpoint; (2) testo + triple appiattite; (3) testo + mondi DEC serializzati per tipo di stance; (4) solo mondi DEC.
- *Domande:* le 30 query dei test, riformulate in linguaggio naturale, con risposte a tre valori (sì / no / non determinato).
- *Metriche:* accuratezza a tre valori, tasso di fughe (risposte che usano informazione futura rispetto al checkpoint), confusione «non determinato → falso».

**Controlli di contaminazione.** Il racconto è noto e probabilmente memorizzato. Le varianti con nomi anonimizzati e con dettagli permutati (città, mestieri) servono a misurare quanto pesi il ricordo. Sono **controlli diagnostici, non garanzie** di assenza di contaminazione. Conviene anche un caso di controllo sintetico con la stessa struttura e nessun precedente letterario.

**Costi.** Nessuna valutazione LLM a pagamento è stata eseguita in questo audit. L'esperimento richiede un budget esplicito e un protocollo pre-registrato.

## 5. Deliverable per ADHO/DH (Galway)

- Messaggio difendibile: DEC aggiunge valore nella **gestione tipizzata dei contesti**: permeazione epistemica nella realtà, isolamento dei punti di vista, rilevazione automatica dei disaccordi. Non ne aggiunge per lookup ed estrazione.
- Materiali: il racconto annotato (unità verificate), il dataset gold e i checkpoint senza fughe, le query e le metriche riproducibili.
- Rischi da dichiarare: annotazione a un solo annotatore; dimensione minima; dipendenza da assiomi analitici dichiarati; difetti del reasoner.
