# PYDANTIC — Visione & Regole Fondamentali

> Documento di riferimento. Non è codice: serve a non perdere la direzione del
> progetto tra una sessione e l'altra. Aggiornabile man mano che la visione si
> affina.

---

## 1. Regole FONDAMENTALI (valide per TUTTE le immagini di TUTTI gli account)

Queste sono il **fondamento universale**: ogni account, ogni prodotto, ogni
stile le eredita SEMPRE. Non vanno mai rimosse né indebolite.

1. **Formato**: ogni immagine è un **quadrato perfetto 1:1, 2000×2000 px**.
   - Applicato in modo garantito a valle da `api/_lib/mariano_image_generator.py`
     → `_to_square_png()` (pad centrato, mai distorto/tagliato) + ribadito nel prompt.
2. **Prodotto intoccabile**: il prodotto va riprodotto **pixel-per-pixel** dalla
   foto reference. Stessa forma, colore, materiali, proporzioni, dettagli.
   **Identico in ogni slide** e identico alla reference. Mai reinterpretato.
   - Vive in `_build_global_rule()` (`mariano_prompts_generator.py`).
   - Ancoraggio: la MAIN (01a) viene generata per prima e usata come reference
     per le altre slide (`generate_all`), così tutte condividono lo stesso prodotto.
   - Le reference definiscono SOLO il prodotto, mai lo sfondo.
3. **Testo**: italiano, ortografia corretta, niente parole inventate/duplicate,
   **niente sovrapposizioni**, niente testo tagliato ai bordi, un solo font
   bold sans-serif, alto contrasto (`_TEXT_QUALITY_RULE`).
4. **Logo fornitore**: ignorare loghi/marchi del fornitore sul prodotto.
   Il logo del CLIENTE va integrato dove previsto (regole logo).
5. **Rinomina file** (convenzione Amazon, `lib/amazonNames.ts`):
   - `01a` (hero sfondo bianco) → `{ASIN}.MAIN`
   - le altre prodotte, in ordine → `{ASIN}.PT01`, `{ASIN}.PT02`, …
6. **Negative prompt**: niente prodotto ridisegnato, niente effetti sul prodotto,
   niente testo inglese, niente watermark, niente sovrapposizioni/affollamento.

---

## 2. VISIONE: profili per Account (clienti dell'agenzia)

### Il problema con l'impianto attuale
Il set di 10 infografiche è valido ma **generico**: ottimo per prodotti tech /
con tante specifiche (es. un rilevatore), ma **non adatto a tutto**:
- una **poltrona** o uno **specchio** → meno testo, più estetica/qualità immagine
- un **integratore** → spesso bastano **5-6 immagini**, non 9-10
- rischio: infografiche **identiche** per tutti i clienti dell'agenzia

### Il risultato desiderato
Un **menu a tendina a sinistra** con tutti gli **account/aziende** con cui si
collabora. Per ogni account si definisce, **insieme**, un set di infografiche
**su misura**:
- **quante** immagini (può essere < 10, es. 5-6)
- **quali** slide / che tipo (più testo vs più estetica)
- **stile** visivo dedicato (palette, tono, densità di testo)
- **logo** del cliente caricato e applicato
- prendendo spunto dai **set già perfezionati** in precedenza per quei prodotti

Regola d'oro: **ogni account ha il suo stile**, usato per **tutti i prodotti di
quell'account**, ma **diverso da account ad account**. Le regole fondamentali
(§1) restano sotto, invariate, per tutti.

---

## 3. Architettura proposta (a grandi linee, da costruire un passo alla volta)

- **Tabella `accounts`** (Supabase): id, nome azienda, logo_url, palette,
  stile/preset, set di slide attive (quali + ordine + n.), note, created_at.
- **Profilo slide per-account**: quali delle slide disponibili usare, con
  override per-slide (testo on/off, layout, densità).
- **Libreria di "tipi di slide"** estendibile (non solo i 10 attuali): es.
  varianti "estetica/lifestyle pura", "dettaglio macro", "dimensioni", ecc.
- **Selettore account** in sidebar (menu a tendina) → quando scegli un account,
  la generazione usa il SUO set/stile/logo, sopra le regole fondamentali.
- **Gestione account** (admin): crea/modifica account, carica logo, definisci set.
- I "set perfezionati passati" diventano **preset salvati** riutilizzabili.

Tutto questo è un **layer sopra** il motore attuale (prompt + generazione +
square + naming), che resta il fondamento.

---

## 4. Primo passo consigliato (quando si parte)

Partire dal **modello dati `accounts` + selettore in sidebar + set di slide
per-account** (anche solo: nome, logo, quante/quali slide, stile). Poi iterare
aggiungendo nuovi "tipi di slide" e gli override fini.

> Nessuna fretta: un account alla volta, perfezionando lo stile insieme.
