# Ritratti dei personaggi

Metti qui i PNG, con questi nomi esatti:

| File | Personaggio |
|---|---|
| `mary.png` | Mary Sutherland |
| `windibank.png` | James Windibank |
| `hosmer.png` | Hosmer Angel |
| `holmes.png` | Sherlock Holmes |
| `watson.png` | Dr. Watson |
| `mother.png` | La madre di Mary |
| `reader.png` | Il lettore simulato (compare solo nella lettura senza spoiler) |
| `whatif.png` | Il "what-if" dei curatori: un altro impiegato ha battuto le lettere |

Il server li serve da `/portraits/` e li elenca in `/api/meta`, quindi non serve ricompilare: basta ricaricare la pagina. Finché un file manca, l'edizione mostra un segnaposto a matita con il monogramma.

Gli originali (circa 1,5 MB l'uno) restano qui come sorgente. Per il web, `npm run build:portraits` (`scripts/build_portraits.py`, richiede Pillow) produce in `web/` due versioni:

| File | Uso |
|---|---|
| `<id>.webp` | l'ovale intero, ritagliato sulla cornice disegnata: Cast e pagina del personaggio |
| `<id>-face.webp` | un quadrato sul volto, 192 px: cerchi piccoli (caleidoscopio, "Who knows what", mappa dei mondi, diagrammi, elenchi) |

Il ritaglio del volto si regola in `crops.json`: `[x, y, lato]` in pixel dell'originale 1024×1024. Se le versioni web mancano, l'edizione usa l'originale.

Le immagini compaiono:
- nel Cast;
- nella pagina di ogni personaggio;
- nelle fette del caleidoscopio;
- nelle intestazioni di "Who knows what";
- nella mappa dei mondi;
- nei pannelli delle frasi.

Nel caleidoscopio vengono ritagliate a cerchio, quindi conviene che la testa stia al centro dell'ovale.

## Come generarli con ChatGPT

Genera un'immagine per messaggio, nella **stessa conversazione**, così lo stile resta coerente. Incolla prima il blocco **Stile comune**, poi il prompt del personaggio. Se un'immagine esce diversa dalle altre, chiedi: "Same style as the previous portraits: …".

### Stile comune (da incollare ogni volta, prima del prompt del personaggio)

```
Pencil portrait for a book edition. Style: graphite pencil drawing with fine cross-hatching, in the manner of
1890s magazine illustrations; head and shoulders in strict SIDE PROFILE, FACING LEFT; the figure sits inside an
upright OVAL vignette framed by a thin double pencil line; inside the oval, plain off-white paper with light
hatching behind the head; OUTSIDE the oval the background is fully TRANSPARENT. Monochrome graphite only: no
colour, no text, no signature, no border other than the oval. Square PNG, 1024×1024, the oval fills about 90% of
the height and is centred. Consistent light from the left, calm expression, Victorian period (1890).
```

### 1. `mary.png` — Mary Sutherland

```
Mary Sutherland, a large young woman of about 25, kind and slightly vacant expression, short-sighted (she peers a
little). A heavy fur boa round her neck and a broad-brimmed hat tilted coquettishly over her ear, with a large
curling feather. Simple, modest, a little old-fashioned.
```

### 2. `windibank.png` — James Windibank

```
James Windibank, a sturdy, middle-sized man of about thirty, clean-shaven, sallow skin, a bland, insinuating
manner, and wonderfully sharp, penetrating eyes. Neat dark suit and collar of a travelling wine salesman. Smooth,
self-assured, faintly smiling.
```

### 3. `hosmer.png` — Hosmer Angel

```
Hosmer Angel, a man about five feet seven, strongly built, sallow complexion, black hair a little bald in the
centre, bushy black side-whiskers and moustache, TINTED round glasses that hide his eyes. Black frock-coat faced
with silk, black waistcoat, gold watch chain. The face should look slightly theatrical, like a disguise.
```

### 4. `holmes.png` — Sherlock Holmes

```
Sherlock Holmes, a tall, lean man of about 35, sharp aquiline nose, high forehead, thin intent face, hair brushed
back. Wearing a dressing-gown over a shirt, holding a pipe near his chin, deep in thought. No deerstalker hat.
```

### 5. `watson.png` — Dr. Watson

```
Dr. John Watson, a solidly built man of about 35, neat moustache, short hair, kind and attentive expression.
Wearing a dark Victorian suit with a high collar and a tie. A doctor and a writer, listening carefully.
```

### 6. `mother.png` — Mary's mother

```
Mrs. Windibank, Mary's mother, a woman of about fifty, plump, comfortable, wearing a Victorian bonnet tied under
the chin and a dark dress with a small brooch. A pleasant face with a hint of complicity in the eyes.
```

### 7. `reader.png` — the reader

```
An anonymous reader seen in profile, face partly hidden behind an open book held up to the eyes, so that no
features can be recognised. Victorian clothes, neutral and genderless. The book cover is plain. A sense of
curiosity and suspense.
```

### 8. `whatif.png` — the editors' what-if

```
A hypothetical office clerk at a typewriter, seen in profile, drawn with a lighter, DOTTED or broken pencil
outline so that the figure looks unreal, like a sketch of a possibility. Victorian office: sleeve protectors,
waistcoat, an 1890s typewriter in front of him. The face is vague and anonymous.
```

## Note

- If ChatGPT returns a white background instead of a transparent one, ask: "Make everything outside the oval transparent and export as PNG."
- The images must be original works. Do not use photographs of actors or illustrations under copyright as references.
