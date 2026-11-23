# Log di normalizzazione del testo (testimone PDF)

Fonte: `sources/text/iden.pdf` (SHA-256 nel manifest). Script: `scripts/extract_text.py` → `scripts/normalize.py` → `scripts/segment.py`; controllo: `scripts/collate_html.py`.
Il log completo, evento per evento, è in `normalization_log.jsonl` (145 eventi).

## Struttura del PDF verificata
- 10 pagine letter, 2-sided. Pag. PDF 1 = frontespizio (titolo, autore); pag. 2 = disclaimer del sito ("version 3.1"); racconto su pag. PDF 3–10 = pagine stampate 1–8.
- Due colonne con margini specchiati: pagine PDF dispari x0≈44/299 pt, pari x0≈87/342 pt → split di colonna calcolato per pagina.
- Capolettera "M" (glifo scalato, alto ~40 pt) con "y dear" in maiuscoletto; la virgoletta d'apertura non è stampata (verificato visivamente, render di pag. 3).
- Annuncio "Missing…" stampato come blocco rientrato unico (verificato visivamente, pag. 7): unità `letter`, coerente con `div.letter-block` dell'HTML.
- Frazione "4½" composta in apice/pedice (verificato visivamente, pag. 4): lo strato testuale dà "41/2".

## Regole applicate (conteggi)
| Regola | Descrizione | Eventi |
|---|---|---|
| N1 | Esclusione frontespizio, disclaimer e numeri di pagina | 15 righe (7 front matter + 8 numeri di pagina) |
| N2 | Capolettera anteposto alla prima riga + virgoletta d'apertura ripristinata; 3 righe accanto al capolettera trattate come continuazione | 4 |
| N3 | Fusione di frammenti di riga giustificata sulla stessa linea di base | 12 |
| N4 | Paragrafi da geometria (rientro ~15 pt; blocco ≥22 pt; colonna/pagina senza rientro = continuazione) | 138 paragrafi (137 prosa + 1 blocco) |
| N5 | A-capo con trattino: rimosso salvo forma con trattino attestata nell'HTML | 62 (61 rimossi, 1 mantenuto: Sunday-school) |
| N6 | Legature tipografiche sciolte | 76 caratteri (U+FB01: 72, U+FB02: 4) |
| N7 | Accenti in stile TeX (accento spaziante + lettera) composti | 3 (outré ×2, Voilà) |
| N8 | Frazione "41/2" → "4½" | 1 |
| — | Unicode NFC; virgolette curve, apostrofi ’ e trattini lunghi conservati; nessuna modernizzazione ortografica | — |

Trattini rimossi senza conferma diretta nell'HTML (forma unita con apostrofo curvo assente nell'HTML): 1, `gentle-man’s` → `gentleman’s` (HTML: `gentleman's`). La collazione parola per parola con l'HTML non mostra differenze su nessuna di queste parole (vedi sotto), quindi tutte le decisioni N5 sono coerenti col secondo testimone.

## Collazione con l'HTML
`data/text/collation_pdf_html.md`: 138 unità narrative in entrambi i testimoni, allineamento 1:1. Dopo la normalizzazione restano differenze solo di codifica: apostrofo curvo (PDF) vs dritto (HTML) in 35 unità, e la sequenza di virgolette in `‘e’s’`/`‘r’s’` (unità 118, PDF `’` vs HTML `'`). Nessuna differenza lessicale.

## Conteggi
Vedi `text_stats.json`: 138 paragrafi, 391 frasi, 6.982 parole (metodo dichiarato nel file). Inizio: “My dear fellow,” said Sherlock Holmes…; fine: …as much knowledge of the world.”
