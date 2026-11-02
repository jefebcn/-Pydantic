# Seconda Mano Hunter

Trova le offerte **Amazon Seconda Mano** (amazon.it, da 100 € in su) con la differenza più grande rispetto al prezzo del **nuovo**. Calcola il margine applicando il vostro sconto del 22% e manda un avviso quando c'è un affare da prendere al volo.

```
PC di casa (scanner Python)  ──►  Supabase (prezzi + storico)  ──►  Dashboard Vercel
        │                                                            (notifiche browser)
        └──► Telegram (avviso immediato sul telefono)
```

Costo: **0 €**. Supabase, Vercel e Telegram si usano col piano gratuito. Lo scanner gira sul vostro PC perché Amazon blocca le richieste che arrivano dai server cloud.

## Come si calcola il margine

| Voce | Formula |
|---|---|
| Tuo costo | prezzo Seconda Mano × (1 − 22%) |
| Riferimento nuovo | media del prezzo nuovo negli ultimi 90 giorni, ma mai sopra il nuovo attuale (così un prezzo gonfiato non falsa il calcolo) |
| Guadagno € | riferimento − tuo costo |
| Margine % | 1 − tuo costo / riferimento |

Lo storico a 90 giorni si costruisce col tempo, salvando i prezzi a ogni controllo. Nei primi giorni il riferimento è il prezzo nuovo attuale. Si usa il prezzo venduto da Amazon e, se Amazon non vende quel prodotto, il nuovo più basso fra gli altri venditori. La soglia degli avvisi, lo sconto e il prezzo minimo si cambiano dalla dashboard (⚙️ Soglie).

## Setup (una volta sola)

### 1. Database Supabase
1. Su [supabase.com](https://supabase.com) apri un progetto (va bene il piano gratuito).
2. In **SQL Editor** incolla ed esegui `supabase/schema.sql`.
3. In **Project Settings → API** copia il **Project URL** e la **service_role key**.

### 2. Bot Telegram
1. Su Telegram scrivi a **@BotFather** → `/newbot` e copia il **token**.
2. Manda un messaggio qualsiasi al tuo bot. Puoi anche aggiungerlo a un gruppo con il socio.
3. Apri `https://api.telegram.org/bot<TOKEN>/getUpdates` nel browser e copia il numero `chat.id`.

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
Imposta le variabili di `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_PASSWORD`) in Vercel → Settings → Environment Variables e fai il deploy. Apri la dashboard e premi **🔔 Attiva notifiche**.

## Ritmo e blocchi
- Un ciclo ogni 20 minuti, con 4–9 secondi di pausa fra una pagina e l'altra. Le offerte di un prodotto vengono ricontrollate solo se il prezzo cambia o dopo 6 ore.
- Se Amazon chiede il CAPTCHA, lo scanner si ferma 30 minuti e avvisa su Telegram. Non prova ad aggirarlo.
- Categorie e parole chiave stanno in `scraper/config.py` (`SEARCHES`).

## Sviluppo
```bash
npm install && npm run dev                       # dashboard (serve .env.local)
pip install -r scraper/requirements.txt
python -m pytest scraper/tests                   # test del parsing
```
