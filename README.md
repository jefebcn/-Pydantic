# Seconda Mano Hunter × Sander Chill House

Trova le offerte **Amazon Seconda Mano** (amazon.it, da 100 € in su) con la differenza più grande rispetto al prezzo del **nuovo**. Calcola il margine applicando il vostro sconto del 22% e manda un avviso quando c'è un affare da prendere al volo.

```
PC di casa (scanner Python)  ──►  Supabase (prezzi + storico)  ──►  Dashboard Vercel
        │                                                            (notifiche browser)
        └──► Telegram (avviso immediato sul telefono)
```

La dashboard è un piccolo gestionale con quattro sezioni:
- **Panoramica:** indicatori, offerte da prendere al volo, stato del magazzino, ultime vendite.
- **Offerte:** classifica con filtri. ☆ segna un'offerta interessante, ✕ la ignora (e smette di mandare avvisi), 🛒 registra l'acquisto in magazzino.
- **Magazzino:** pezzi comprati divisi per stato (ordinato → ricevuto → in vendita → venduto / reso), con costo, prezzo obiettivo, prezzo di vendita, profitto, ROI, giorni in giacenza ed export CSV.
- **Impostazioni:** sconto, soglie degli avvisi, stato dello scanner, guida al setup.

Magazzino e Impostazioni sono riservati all'admin; Panoramica e Offerte sono pubbliche (vedi il punto 4 del setup).

Costo: **0 €**. Supabase, Vercel e Telegram si usano col piano gratuito. Lo scanner gira sul vostro PC perché Amazon blocca le richieste che arrivano dai server cloud.

## Come si calcola il margine

| Voce | Formula |
|---|---|
| Tuo costo | prezzo Seconda Mano × (1 − 22%) |
| Riferimento nuovo | media del prezzo nuovo negli ultimi 90 giorni, ma mai sopra il nuovo attuale (così un prezzo gonfiato non falsa il calcolo) |
| Guadagno € | riferimento − tuo costo |
| Margine % | 1 − tuo costo / riferimento |

Lo storico a 90 giorni si costruisce col tempo, salvando i prezzi a ogni controllo. Nei primi giorni il riferimento è il prezzo nuovo attuale. Si usa il prezzo venduto da Amazon e, se Amazon non vende quel prodotto, il nuovo più basso fra gli altri venditori. La soglia degli avvisi, lo sconto e il prezzo minimo si cambiano dalla dashboard, nella pagina Impostazioni.

## Setup (una volta sola)

### 1. Database Supabase
1. Su [supabase.com](https://supabase.com) apri un progetto (va bene il piano gratuito).
2. In **SQL Editor → New query** incolla **tutto** il file `supabase/schema.sql` e premi **Run**. È l'unico file SQL e contiene tutto: tabelle, viste, sicurezza. Si può rilanciare senza perdere dati.
3. In **Project Settings → API** copia il **Project URL** e la **service_role key**.

### 2. Bot Telegram
1. Su Telegram scrivi a **@BotFather** → `/newbot` e copia il **token** in `TELEGRAM_BOT_TOKEN` (`scraper/.env`).
2. Lancia una volta `python -m scraper.main --telegram-setup`: imposta nome, foto (`scraper/assets/bot_avatar.jpg`), biografia, descrizione e comandi del bot.
3. Avvia lo scanner, scrivi `/chatid` al bot e metti il numero in `TELEGRAM_CHAT_ID`, poi riavvia lo scanner.

Gli avvisi arrivano come foto del prodotto con margine, prezzi e pulsanti "Apri su Amazon" e "Gestionale". Il bot risponde anche a comandi:

| Comando | Cosa fa | Dove |
|---|---|---|
| `/top [n]` | le offerte attive con più guadagno (5, massimo 10) | solo chat collegate |
| `/nuove` | le offerte comparse nelle ultime 24 ore | solo chat collegate |
| `/fasce` | quante offerte per fascia di prezzo e la migliore di ognuna | solo chat collegate |
| `/cerca parole` | cerca fra le offerte attive, es. `/cerca rtx 5070` | solo chat collegate |
| `/stato` | ultimo giro, velocità, pausa dopo un blocco, offerte attive e sopra soglia | solo chat collegate |
| `/chatid` | ID della chat (e del topic) da mettere in `TELEGRAM_CHAT_ID` | ovunque |
| `/help` | cosa fa il bot | ovunque |

Negli avvisi in chat privata ci sono anche i pulsanti **☆ Interessante** e **✕ Ignora**, che aggiornano il gestionale. Nei gruppi non compaiono, perché li potrebbe premere chiunque. Entro 24 ore un prodotto già avvisato viene riproposto solo se il prezzo scende almeno dell'1%, con la riga "📉 Prezzo sceso".

Il segno ⚠️ (sul sito "da verificare") vuol dire che il prezzo del nuovo può essere gonfiato: viene solo da altri venditori, oppure uno di loro vende a meno di Amazon. In quel caso il margine reale può essere più basso.

**Canale pubblico:** aggiungi il bot come amministratore del canale, metti l'ID (te lo dà `/chatid` scritto nel canale) in `TELEGRAM_CHANNEL_ID` e riavvia lo scanner. Il canale riceve solo le offerte con prezzo verificato, una volta sola (di nuovo se il prezzo cala o dopo 7 giorni), senza pulsanti ☆ e ✕ né messaggi di servizio. La descrizione del canale si imposta con `python -m scraper.main --telegram-setup`.

**Gruppo dedicato agli avvisi:** crea il gruppo, aggiungi il bot. Il bot scrive da solo l'ID del gruppo; aggiungilo a `TELEGRAM_CHAT_ID` separato da virgola (es. `8498296680,-1001234567890`) e riavvia lo scanner. In un gruppo con argomenti usa `id_gruppo:id_topic` (te lo dà `/chatid` scritto nel topic). La foto del gruppo può essere la stessa del bot.

### 3. Scanner sul PC
Requisito: Python 3.10+ ([python.org](https://www.python.org/downloads/); su Windows spunta *Add to PATH*).

```bash
git clone https://github.com/jefebcn/-Pydantic.git
cd -Pydantic
cp scraper/.env.example scraper/.env     # su Windows: copy scraper\.env.example scraper\.env
```
Compila `scraper/.env`, poi:
- **Windows:** doppio click su `avvia-scanner.bat`
- **Mac/Linux:** `./avvia-scanner.sh`

Prima di lasciarlo girare fai una prova veloce, che non salva nulla:
```bash
.venv/bin/python -m scraper.main --search notebook      # Windows: .venv\Scripts\python -m scraper.main --search notebook
.venv/bin/python -m scraper.main --test B0XXXXXXXX      # un ASIN che ha un'offerta Seconda Mano
```
Se escono prezzi sensati, lo scanner funziona. Se esce un errore di lettura, rilancia con `--debug` e mandaci i file in `scraper/debug/`.

### 4. Dashboard su Vercel
Imposta le variabili di `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_PASSWORD`) in Vercel → Settings → Environment Variables e fai il deploy. Apri la dashboard e premi la **campanella** in alto a destra per attivare le notifiche del browser.

**Chi vede cosa:** Panoramica e Offerte sono pubbliche, senza password. Magazzino, Impostazioni e le azioni sulle offerte (☆, ✕, carrello) richiedono l'accesso admin: pulsante **Accedi** in alto a destra (pagina `/accedi`), password = `DASHBOARD_PASSWORD`. L'accesso dura 30 giorni su quel dispositivo; cambiando la password su Vercel scadono tutti gli accessi. Senza `DASHBOARD_PASSWORD` chiunque può modificare.

## Ritmo e blocchi
- Tre velocità, da scegliere con `SCAN_SPEED` in `scraper/.env` (oppure `--speed`):

  | Profilo | Ciclo | Ricerche per ciclo (a rotazione) | Pausa fra pagine | Pannelli offerte per ciclo |
  |---|---|---|---|---|
  | `lento` (default) | 60 min | 8 di 31, 1 pagina | 10–25 s | max 15 |
  | `normale` | 30 min | 16 di 31, 1 pagina | 6–14 s | max 40 |
  | `veloce` | 20 min | tutte, 2 pagine | 4–9 s | max 150 |

- Le offerte di un prodotto vengono ricontrollate solo se il prezzo cambia o dopo 6 ore. La sessione (cookie e CAP) resta la stessa fra un ciclo e l'altro.
- Se Amazon chiede il CAPTCHA o una verifica anti-robot, lo scanner non prova ad aggirarla: si ferma, avvisa su Telegram, scende di una velocità e riprova dopo una pausa che raddoppia a ogni blocco (30, 60, 120… fino a 6 ore). Dopo 6 cicli senza blocchi risale di una velocità, mai oltre `SCAN_SPEED`. Lo stato sta in `scraper/.state.json`.
- La connessione degli utenti risulta da San Marino: lo scanner imposta da solo il CAP italiano `DELIVERY_ZIP` (default 20121), altrimenti Amazon nasconde prezzi e offerte.
- Categorie e parole chiave stanno in `scraper/config.py` (`SEARCHES`).
- Se lo scanner si chiude, `avvia-scanner.bat` lo fa ripartire dopo un minuto; chiudendo la finestra si ferma davvero. Gira una sola copia alla volta. Il registro è in `scraper/scanner.log`. A PC spento o in sospensione non cerca nulla: il sito lo segnala con "Scanner fermo".

## Sviluppo
```bash
npm install && npm run dev                       # dashboard (serve .env.local)
pip install -r scraper/requirements.txt
python -m pytest scraper/tests                   # test del parsing
```
