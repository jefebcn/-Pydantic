# CLAUDE.md — Seconda Mano Hunter × Sander Chill House

## Missione
Trovare su **amazon.it** le offerte **Amazon Seconda Mano** (≥ 100 €) con il margine più alto rispetto al prezzo **nuovo**. Gli utenti comprano i prodotti venduti da Amazon (Seconda Mano compreso) con il **22% di sconto** e li rivendono. Il software deve:
1. trovare le offerte da solo (informatica, gaming, audio, foto, casa…);
2. calcolare il margine: costo = usato × 0,78; riferimento = media 90 gg del nuovo (mai sopra il nuovo attuale);
3. mostrare una classifica in dashboard e avvisare subito (Telegram + notifiche browser).

**Vincolo: costo 0 €.** Niente Keepa né API a pagamento. La Creators API di Amazon richiede vendite affiliate, quindi non si usa.

## Architettura
| Parte | Dove gira | File |
|---|---|---|
| Scanner (Python, requests + BeautifulSoup) | **PC di casa degli utenti**: Amazon blocca gli IP cloud (503) | `scraper/` |
| Database | Supabase free | `supabase/schema.sql` (tabelle + vista `deals_v`) |
| Dashboard (gestionale) | Next.js 16 su Vercel free | `app/` (Panoramica, `offerte/`, `magazzino/`, `impostazioni/`), `components/`, `proxy.ts` + `lib/auth.ts` (accesso admin) |
| Avvisi | Telegram Bot API + Notification API del browser | `scraper/notify.py`, `app/page.tsx` |

Flusso dello scanner (`scraper/main.py`):
0. Imposta il CAP di consegna `DELIVERY_ZIP` (default 20121) col popup "Seleziona la tua posizione" (`AmazonClient.set_location`). Gli utenti sono a San Marino: senza CAP italiano Amazon mostra "Non disponibile" e nasconde prezzi e offerte. La homepage di amazon.it dà la verifica anti-robot AWS WAF, quindi non si usa.
1. Ricerca `amazon.it/s?k=…&i=warehouse-deals&rh=p_36:10000-` per ogni voce in `SEARCHES`.
2. Per ogni ASIN nuovo o con prezzo cambiato legge il pannello offerte AOD: `/gp/product/ajax/aodAjaxMain/?asin=…`.
3. Salva lo snapshot in `price_snapshots`.
4. Legge `deals_v` e manda l'avviso se il prodotto supera le soglie in `settings`.

Dati della dashboard: `components/DataProvider.tsx` carica `/api/deals` e, per l'admin, `/api/inventory` ogni 60 s, gestisce le notifiche del browser e espone le azioni (triage offerte, CRUD magazzino, impostazioni). Il SQL è tutto in un solo file (`supabase/schema.sql`), idempotente.

## Regole
- Il calcolo del margine sta **solo** nella vista SQL `deals_v`, il profitto del magazzino solo in `inventory_v`. Scanner e dashboard le leggono, non ricalcolano.
- Offerte con `triage` ignorato o acquistato non generano avvisi.
- Offerta attiva = vista entro 6 ore dall'ultimo giro dello scanner (`app/api/deals/route.ts`, `bot.live_deals`), non il campo `active` di `deals_v` (3 ore da adesso): con le ricerche a rotazione e a PC spento le offerte sparirebbero tutte.
- Riferimento dubbio = il nuovo viene solo da altri venditori, o uno di loro vende sotto il 95% del prezzo Amazon (`refIssue` in `lib/format.ts`, `ref_warning` in `scraper/notify.py`). Il margine resta quello di `deals_v`; il sito mostra "da verificare" e non conta queste offerte nei numeri in evidenza, gli avvisi hanno una riga ⚠️.
- Canale Telegram pubblico (`TELEGRAM_CHANNEL_ID`, `send_channel` in `scraper/notify.py`): solo riferimenti non dubbi, niente doppioni (`channel_wants`, registro locale `scraper/.published.json`), niente pulsanti di triage né messaggi di servizio. I post usano la card generata da `scraper/card.py`; se la card o la foto falliscono si ripiega sulla foto Amazon e poi sul testo.
- Lo scanner gira in una sola istanza (porta locale `INSTANCE_PORT`) e scrive in `scraper/scanner.log`; `avvia-scanner.bat` lo fa ripartire se si chiude. Un riavvio non anticipa il giro programmato (`next_cycle_at` in `.state.json`): una sessione nuova subito dopo un giro prende il 503 di Amazon.
- Scraping educato: pause casuali, niente rotazione proxy, niente risoluzione CAPTCHA o verifiche anti-robot (AWS WAF, Akamai `bm-verify`). Se arrivano ci si ferma: `scraper/pace.py` rallenta il profilo (`SCAN_SPEED` lento/normale/veloce in `config.SPEED_PROFILES`) e raddoppia la pausa; risale dopo cicli puliti.
- Il parsing HTML (`scraper/amazon.py`, funzioni `parse_*`) deve restare puro e coperto da `scraper/tests/`. Quando Amazon cambia layout, aggiungere l'HTML reale (da `--debug`) come fixture.
- La service role key di Supabase si usa solo lato server: route handler e scanner, mai nei componenti client.
- Accesso: Panoramica, Offerte e `GET /api/deals` sono pubblici. Magazzino, Impostazioni, `/api/inventory` e ogni chiamata non-GET richiedono il cookie admin (`lib/auth.ts`, login su `/accedi` con `DASHBOARD_PASSWORD`). Nuove pagine o API riservate vanno aggiunte in `needsAdmin`; i controlli di modifica nei componenti si mostrano solo se `useData().admin`.
- Stile: tema chiaro come il design di riferimento (cornice scura, pannello bianco, card pastello). Colori e font sono token in `app/globals.css` (`ink`, `muted`, `line`, `soft`, `lilac`, `mint`, `cream`, `sky`, `gain`): usare quelli, non colori zinc o amber del vecchio tema scuro.
- Next.js 16: il middleware si chiama `proxy.ts`. Prima di usare API nuove consultare `node_modules/next/dist/docs/`.

## Comandi
```bash
npm run lint && npm run build
python -m pytest scraper/tests
python -m scraper.main --search notebook | --test ASIN | --once | --debug
```
