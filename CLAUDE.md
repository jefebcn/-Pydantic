# CLAUDE.md — Amazon Infographic Generator
> Briefing completo per Claude Code. Leggi tutto prima di scrivere una riga di codice.

---

## 1. MISSIONE

Costruire una **web app full-stack** che accetta un ASIN Amazon in input e restituisce
**7 slide infografiche professionali** pronte per il listing Amazon, in meno di 90 secondi.

Stack: **Next.js 15** (frontend + API gateway) su **Vercel**, pipeline di generazione
immagini in **Python** (serverless Vercel), storage su **Cloudflare R2**,
DB cache su **Supabase**.

**Priorità assolute (in ordine):**
1. Pipeline funzionante end-to-end su un ASIN reale
2. Tempi sotto 90s (parallelismo async obbligatorio)
3. UI minimale ma funzionale per input/output
4. Deploy stabile su Vercel

---

## 2. TECH STACK — DECISIONI FINALI (non proporre alternative)

| Layer | Tool | Perché |
|---|---|---|
| Frontend | Next.js 15 App Router + TypeScript | Deploy nativo Vercel |
| Stili | Tailwind CSS v4 | Zero config |
| API Gateway | Next.js Route Handlers (TypeScript) | Routing + auth layer |
| Pipeline | Python 3.12 serverless (`/api/*.py`) | Librerie AI/immagini |
| AI orchestrazione | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | MVD + QC, economico |
| AI escalation | Claude Opus 4.7 (`claude-opus-4-7`) | QC borderline |
| Image generation | Nano Banana 2 — Google Gemini 3.1 Flash Image | Coerenza nativa |
| Image gen fallback | GPT-Image-2 (`gpt-image-2-2026-04-21`) | Prodotti con testo |
| Scraping Amazon | Rainforest API | Anti-bot gestito |
| Storage immagini | Cloudflare R2 | Egress gratis |
| Database + cache | Supabase (Postgres) | Cache MVD/PTS per ASIN |
| Compositing | Pillow (Python) con multiprocessing | Zero API cost |
| Font | Google Fonts scaricati localmente (Inter, Manrope) | Zero latenza |
| Icone | Iconify SVG bundle locale | Zero dipendenze runtime |
| Monitoring | Helicone proxy per chiamate LLM | Cost tracking |

---

## 3. STRUTTURA FILE COMPLETA

Crea questa struttura esatta. Non aggiungere file non listati senza motivo.

```
amazon-infographic-generator/
│
├── CLAUDE.md                          # Questo file (non cancellare)
├── README.md                          # Documentazione pubblica
├── .gitignore
├── .env.local                         # Variabili locali (non committare)
├── .env.example                       # Template variabili (committare)
├── vercel.json                        # Config Vercel
├── next.config.ts                     # Config Next.js
├── package.json
├── requirements.txt                   # Dipendenze Python pipeline
├── tsconfig.json
├── tailwind.config.ts
│
├── api/                               # Python serverless functions (Vercel)
│   ├── generate.py                    # POST: avvia pipeline, ritorna job_id
│   ├── status.py                      # GET: polling stato job
│   └── _lib/                          # Moduli pipeline (non esposti come endpoint)
│       ├── __init__.py
│       ├── config.py                  # Costanti e config globale
│       ├── scraper.py                 # Rainforest API → dati prodotto
│       ├── mvd_generator.py           # Haiku vision → PTS JSON + canonical_paragraph
│       ├── image_generator.py         # NB2 → immagini slide
│       ├── qc_checker.py              # Haiku/Opus vision → score qualità
│       ├── compositor.py              # Pillow → overlay testo/icone
│       ├── storage.py                 # Cloudflare R2 upload/download
│       └── prompts.py                 # Template prompt per le 7 slide
│
├── app/                               # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                       # Homepage: form input ASIN
│   ├── globals.css
│   ├── results/
│   │   └── [jobId]/
│   │       └── page.tsx               # Pagina risultati con le 7 slide
│   └── api/                           # Next.js Route Handlers (TypeScript)
│       ├── generate/
│       │   └── route.ts               # POST → chiama /api/generate.py
│       └── status/
│           └── [jobId]/
│               └── route.ts           # GET → chiama /api/status.py
│
├── components/
│   ├── ASINInput.tsx                  # Form input + validation
│   ├── ProgressBar.tsx                # Progress tracker durante elaborazione
│   ├── SlideGrid.tsx                  # Griglia 7 slide risultati
│   ├── SlideCard.tsx                  # Singola slide con download
│   └── QCBadge.tsx                    # Badge score qualità per debug
│
├── lib/
│   ├── supabase.ts                    # Client Supabase
│   ├── types.ts                       # TypeScript types condivisi
│   └── utils.ts                       # Helper functions
│
├── public/
│   ├── fonts/                         # Font TTF scaricati (Inter, Manrope)
│   │   ├── Inter-Regular.ttf
│   │   ├── Inter-Bold.ttf
│   │   └── Manrope-Bold.ttf
│   └── icons/                         # Bundle SVG icone Iconify pre-scaricate
│       └── [categoria]/               # Es: mdi/, tabler/, lucide/
│
└── supabase/
    └── schema.sql                     # Schema DB completo (da runnare su Supabase)
```

---

## 4. ENVIRONMENT VARIABLES

### `.env.example` (committare nel repo)

```bash
# ── Anthropic ────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Google AI (Nano Banana 2) ────────────────────────────────────────
GOOGLE_AI_API_KEY=AIza...

# ── OpenAI (GPT-Image-2, fallback per prodotti con testo) ────────────
OPENAI_API_KEY=sk-...

# ── Amazon Scraping ──────────────────────────────────────────────────
RAINFOREST_API_KEY=...

# ── Cloudflare R2 ────────────────────────────────────────────────────
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=amazon-infographics
CLOUDFLARE_R2_PUBLIC_URL=https://pub-XXXX.r2.dev

# ── Supabase ─────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Monitoring (opzionale ma consigliato) ────────────────────────────
HELICONE_API_KEY=sk-helicone-...

# ── App ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Note sulle variabili

- `NEXT_PUBLIC_*`: esposte al browser, solo quelle sicure
- `SUPABASE_SERVICE_ROLE_KEY`: solo server-side, mai client-side
- In Vercel Dashboard: Settings → Environment Variables → aggiungile tutte
- In locale: copia `.env.example` in `.env.local` e compila i valori

---

## 5. SCHEMA DATABASE SUPABASE

### `supabase/schema.sql` — eseguire su Supabase SQL Editor

```sql
-- Tabella prodotti: cache PTS/MVD per ASIN
CREATE TABLE IF NOT EXISTS products (
  asin            TEXT PRIMARY KEY,
  title           TEXT,
  pts_json        JSONB NOT NULL,
  mvd_text        TEXT NOT NULL,
  ref_image_urls  TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella job: stato elaborazione per polling frontend
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued',
  -- status: queued | scraping | mvd | generating | qc | compositing | done | error
  progress        INTEGER DEFAULT 0,     -- 0-100
  current_step    TEXT DEFAULT '',
  slide_urls      TEXT[] DEFAULT '{}',   -- URL R2 delle 7 slide completate
  qc_scores       JSONB DEFAULT '{}',    -- score QC per slide
  error_message   TEXT,
  cost_usd        NUMERIC(10,4),
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella runs: log storico per analytics
CREATE TABLE IF NOT EXISTS runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID REFERENCES jobs(id),
  asin            TEXT NOT NULL,
  cache_hit       BOOLEAN DEFAULT FALSE,
  total_cost_usd  NUMERIC(10,4),
  duration_ms     INTEGER,
  avg_qc_score    NUMERIC(5,2),
  retry_count     INTEGER DEFAULT 0,
  slide_urls      TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index per query frequenti
CREATE INDEX IF NOT EXISTS idx_jobs_asin    ON jobs(asin);
CREATE INDEX IF NOT EXISTS idx_jobs_status  ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_runs_asin    ON runs(asin);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 6. CONFIGURAZIONE VERCEL

### `vercel.json`

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "installCommand": "npm install && pip install -r requirements.txt",
  "functions": {
    "api/generate.py": {
      "runtime": "python3.12",
      "maxDuration": 120
    },
    "api/status.py": {
      "runtime": "python3.12",
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/api/generate",
      "destination": "/api/generate.py"
    },
    {
      "source": "/api/status",
      "destination": "/api/status.py"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,OPTIONS" }
      ]
    }
  ]
}
```

> **IMPORTANTE:** `maxDuration: 120` richiede **Vercel Pro** ($20/mese).
> Hobby plan ha limite 60s che è insufficiente per la pipeline.
> Vercel Pro supporta fino a 300s.

---

## 7. DIPENDENZE

### `requirements.txt`

```
anthropic>=0.40.0
google-generativeai>=0.8.0
openai>=1.50.0
pillow>=11.0.0
aiohttp>=3.10.0
supabase>=2.10.0
boto3>=1.35.0          # Per Cloudflare R2 (S3-compatible)
requests>=2.32.0
python-dotenv>=1.0.0
```

### `package.json` (dipendenze Node principali)

```json
{
  "name": "amazon-infographic-generator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:setup": "echo 'Esegui supabase/schema.sql nel Supabase SQL Editor'"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "15.0.0"
  }
}
```

---

## 8. CODICE CORE — MODULI CHIAVE

Implementa questi moduli esattamente come specificato. Sono il cuore della pipeline.

### `api/_lib/config.py`

```python
import os
from dataclasses import dataclass

@dataclass
class Config:
    # Models
    HAIKU_MODEL: str = "claude-haiku-4-5-20251001"
    OPUS_MODEL:  str = "claude-opus-4-7"
    NB2_MODEL:   str = "gemini-2.5-flash"          # Nano Banana 2
    NB_PRO_MODEL: str = "gemini-3-pro-image-preview"  # Nano Banana Pro
    GPT_IMG_MODEL: str = "gpt-image-2-2026-04-21"

    # QC thresholds
    QC_PASS_THRESHOLD:    int = 90
    QC_RETRY_THRESHOLD:   int = 75
    QC_OPUS_THRESHOLD:    int = 65
    MAX_RETRIES:          int = 3

    # Image settings
    OUTPUT_SIZE:      tuple = (2000, 2000)
    MAX_REF_IMAGES:   int = 4

    # Pipeline target
    TARGET_DURATION_S: int = 90

cfg = Config()
```

### `api/_lib/prompts.py`

```python
# Template prompt per le 7 slide. {mvd} viene sostituito con canonical_paragraph.
# {pain_point} e {persona_env} vengono estratti dal PTS.

GLOBAL_LIGHTING = {
    "HERO_DRAMATIC": (
        "three-point lighting: 4ft octabox key 45° camera-left 30° elevation 5500K, "
        "6ft scrim fill camera-right ratio 0.4, 2ft strip rim light 70° behind product "
        "6200K cool blue separation, soft gradient background vignette"
    ),
    "TECH_CLEAN": (
        "large overhead softbox axial 5500K, symmetric side scrims ratio 0.7 very flat, "
        "neutral gray gradient background #F5F5F5 to #EBEBEB"
    ),
    "LIFESTYLE_NATURAL": (
        "large diffused window light 5200K, natural bounce fill, "
        "real environment context defocused"
    )
}

GLOBAL_SUFFIX = (
    "shot on 85mm prime lens f/4 ISO 100 focus stacked, "
    "subtle teal-orange color grade, photorealistic product photography, "
    "2K resolution PBR-accurate materials, no AI artifacts, "
    "no text in image, no annotations rendered"
)

NEGATIVE_PROMPT = (
    "oversaturated colors, crushed blacks, blown highlights, mixed color temperature, "
    "hard shadow edges, HDR over-processing, cartoonish rendering, "
    "plastic look on metal, text in image, annotations, watermarks"
)

SLIDE_TEMPLATES = {
    1: {
        "name": "HERO",
        "lighting": "HERO_DRAMATIC",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, single hero product shot floating slightly above neutral gradient surface, "
            "{lighting}, cool blue rim light separating silhouette, micro-shadow grounding, "
            "product occupies 55% frame height, absolute center of attention, "
            "museum-display minimal luxury aesthetic, "
            "deliberate negative space top 20% left 30% for headline overlay"
        )
    },
    2: {
        "name": "PROBLEM_SOLUTION",
        "lighting": "HERO_DRAMATIC",
        "ratio": "1:1",
        "prompt": (
            "split-frame 50/50 composition with thin vertical divider line. "
            "LEFT HALF: visual representation of {pain_point}, desaturated cold palette 6500K, "
            "slightly underexposed, mundane setting, no product visible. "
            "RIGHT HALF: {mvd}, {lighting}, warm 5200K, full saturation, "
            "visual sense of resolution and relief. Same camera height both halves."
        )
    },
    3: {
        "name": "KEY_FEATURES",
        "lighting": "TECH_CLEAN",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, product centered, {lighting}, editorial clean composition, "
            "three deliberate empty sectors at 10-oclock 2-oclock and 6-oclock positions "
            "around product for callout overlays in post. "
            "No text in image. Clean geometric whitespace. Product 40% frame area."
        )
    },
    4: {
        "name": "LIFESTYLE",
        "lighting": "LIFESTYLE_NATURAL",
        "ratio": "16:9",
        "prompt": (
            "{mvd}, product placed naturally in {persona_env}, "
            "{lighting}, shallow DOF f/2.0, product lower-third right critical focus, "
            "environment elegantly defocused creamy bokeh, warm ambient atmosphere, "
            "optional partial hand element no face visible, candid editorial style, "
            "negative space top-left quadrant for text overlay"
        )
    },
    5: {
        "name": "TECH_SPECS",
        "lighting": "TECH_CLEAN",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, product centered perfectly neutral seamless background, "
            "{lighting} maximum flat even illumination, camera 10° above center, "
            "absolute focus stacking entire surface, minimal contact shadow only, "
            "clean geometric whitespace all four sides for dimension callouts in post, "
            "blueprint-grade clarity, no text in image"
        )
    },
    6: {
        "name": "SOCIAL_PROOF",
        "lighting": "TECH_CLEAN",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, small-scale product accent element bottom-right 15% area, "
            "reduced contrast muted neutral background {lighting}, "
            "ample negative space dominating frame for typographic overlay, "
            "editorial magazine minimalist, product de-emphasized supporting text-led composition"
        )
    },
    7: {
        "name": "WHY_US",
        "lighting": "HERO_DRAMATIC",
        "ratio": "1:1",
        "prompt": (
            "{mvd}, product elevated top-third as authoritative trophy, "
            "{lighting} intensified rim light for finality, "
            "bottom 60% clean negative space for comparison table overlay, "
            "wide composition conclusive closing aesthetic"
        )
    }
}

def build_prompt(slide_num: int, mvd: str, pts: dict) -> str:
    """Assembla il prompt completo per una slide."""
    tmpl = SLIDE_TEMPLATES[slide_num]
    lighting_desc = GLOBAL_LIGHTING[tmpl["lighting"]]
    pain = pts.get("pain_point", "common problem this product solves")
    env  = pts.get("target_persona_env", "modern minimalist workspace")

    body = tmpl["prompt"].format(
        mvd=mvd,
        lighting=lighting_desc,
        pain_point=pain,
        persona_env=env
    )
    return f"{body}. {GLOBAL_SUFFIX}"
```

### `api/_lib/mvd_generator.py`

```python
import anthropic
import base64
import json
import os
from .config import cfg

MVD_SYSTEM_PROMPT = """You are a senior product designer and PBR rendering specialist.
Analyze the provided product images and Amazon metadata.
Output a Product Technical Sheet (PTS) as strict JSON with these fields:

{
  "surfaces": [ array of surface objects ],
  "geometry": { geometric specs object },
  "canonical_paragraph": "string of 180-220 words",
  "pain_point": "one sentence: the problem this product solves",
  "target_persona_env": "one sentence: environment where target user uses this product",
  "has_text_on_surface": boolean
}

canonical_paragraph rules:
- name every visible material with PBR vocabulary (roughness, metallic, IOR values)
- describe geometry with CAD vocabulary (chamfer/fillet/curvature/bilateral_Y)
- specify color in premium terms AND approximate LAB values
- describe branding placement and proportional size
- describe surface micro-details: logos, ports, buttons, seams
- zero marketing language, zero quality adjectives
- deterministic: two readings produce the same mental image

Output JSON only. No commentary, no markdown fences."""

async def generate_mvd(images_b64: list[dict], amazon_data: dict) -> dict:
    """
    Genera PTS + MVD usando Claude Haiku 4.5 vision.
    images_b64: lista di {"data": base64_str, "media_type": "image/jpeg"}
    amazon_data: dict con title, bullets, specs da Rainforest
    """
    client = anthropic.Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        base_url="https://anthropic.helicone.ai",  # proxy Helicone
        default_headers={"Helicone-Auth": f"Bearer {os.environ.get('HELICONE_API_KEY', '')}"}
    )

    # Costruisci content: prima le immagini, poi il testo
    content = []
    for img in images_b64[:4]:  # max 4 immagini
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": img["media_type"], "data": img["data"]}
        })

    content.append({
        "type": "text",
        "text": f"Product title: {amazon_data.get('title', '')}\n"
                f"Bullets: {json.dumps(amazon_data.get('feature_bullets', []))}\n"
                f"Specs: {json.dumps(amazon_data.get('specifications', {}))}"
    })

    response = client.messages.create(
        model=cfg.HAIKU_MODEL,
        max_tokens=2048,
        system=MVD_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}]
    )

    raw = response.content[0].text.strip()
    pts = json.loads(raw)
    return pts
```

### `api/_lib/image_generator.py`

```python
import asyncio
import base64
import os
import google.generativeai as genai
from PIL import Image
from io import BytesIO
from .config import cfg
from .prompts import build_prompt, NEGATIVE_PROMPT

genai.configure(api_key=os.environ["GOOGLE_AI_API_KEY"])

def _bytes_to_pil(data: bytes) -> Image.Image:
    return Image.open(BytesIO(data))

def _url_to_pil(url: str) -> Image.Image:
    import requests
    r = requests.get(url, timeout=15)
    return Image.open(BytesIO(r.content))

async def _generate_one(
    slide_num: int,
    prompt: str,
    ref_images_pil: list,
    model: str = None
) -> bytes:
    """Genera una singola slide con NB2. Ritorna bytes PNG."""
    model = model or cfg.NB2_MODEL
    nb2 = genai.GenerativeModel(model)

    content = ref_images_pil + [prompt]  # reference prima del prompt

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: nb2.generate_content(
            content,
            generation_config=genai.GenerationConfig(
                response_modalities=["image", "text"]
            )
        )
    )

    for part in response.parts:
        if hasattr(part, "inline_data") and part.inline_data:
            return part.inline_data.data

    raise ValueError(f"Slide {slide_num}: nessuna immagine nella risposta NB2")

async def generate_slide_1(
    mvd: str,
    pts: dict,
    ref_image_pils: list,
    use_pro: bool = False
) -> bytes:
    """Genera slide 1 (anchor). Sequenziale, può fare retry."""
    model = cfg.NB_PRO_MODEL if use_pro else cfg.NB2_MODEL
    prompt = build_prompt(1, mvd, pts)
    return await _generate_one(1, prompt, ref_image_pils, model)

async def generate_slides_2_to_7(
    mvd: str,
    pts: dict,
    ref_image_pils: list,      # include slide 1 come ultimo elemento
) -> list[bytes]:
    """Genera slide 2–7 in parallelo con asyncio.gather."""
    tasks = [
        _generate_one(n, build_prompt(n, mvd, pts), ref_image_pils)
        for n in range(2, 8)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Gestisci eccezioni parziali (una slide fallisce, le altre continuano)
    slides = []
    for i, r in enumerate(results, 2):
        if isinstance(r, Exception):
            print(f"[WARN] Slide {i} fallita: {r}")
            slides.append(None)   # verrà rilevata da QC e retried
        else:
            slides.append(r)
    return slides
```

### `api/_lib/qc_checker.py`

```python
import anthropic
import base64
import json
import os
from .config import cfg

QC_SYSTEM_PROMPT = """You are a QC specialist for product photography consistency.
Compare image_A (anchor: slide 1 hero) with image_B (generated slide).
Score each criterion from 0 to 100:
  shape_match:    proportions and 3D form fidelity to anchor
  color_match:    hue saturation lightness using LAB delta-E reasoning
  material_match: surface finish reflection type texture accuracy
  branding_match: logo position and relative size
  detail_match:   ports buttons seams micro-features

List any AI artifacts: extra ports, melted edges, impossible geometry,
text hallucinations, inconsistent reflections, impossible shadows.

Output JSON only:
{
  "scores": {"shape": N, "color": N, "material": N, "branding": N, "detail": N},
  "avg": N,
  "artifacts": [],
  "pass": true/false,
  "reason": "one concise line"
}"""

async def qc_check(
    slide_bytes: bytes,
    anchor_bytes: bytes | None,
    model: str = None
) -> dict:
    """
    Controlla qualità di una slide rispetto all'anchor.
    Se anchor è None (slide 1), fa solo artifact check.
    """
    model = model or cfg.HAIKU_MODEL
    import asyncio

    client = anthropic.Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        base_url="https://anthropic.helicone.ai",
        default_headers={"Helicone-Auth": f"Bearer {os.environ.get('HELICONE_API_KEY', '')}"}
    )

    content = []

    if anchor_bytes:
        content.append({"type": "image", "source": {
            "type": "base64", "media_type": "image/png",
            "data": base64.b64encode(anchor_bytes).decode()
        }})
        content.append({"type": "text", "text": "This is image_A (anchor: slide 1 hero)."})

    content.append({"type": "image", "source": {
        "type": "base64", "media_type": "image/png",
        "data": base64.b64encode(slide_bytes).decode()
    }})
    content.append({
        "type": "text",
        "text": "This is image_B (generated slide). Evaluate and output JSON."
        if anchor_bytes else
        "This is the hero anchor image. Check only for AI artifacts and output JSON "
        "(all scores 100 if no artifacts, else flag them)."
    })

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model=model,
            max_tokens=512,
            system=QC_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}]
        )
    )

    raw = response.content[0].text.strip()
    return json.loads(raw)
```

### `api/_lib/compositor.py`

```python
import os
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from concurrent.futures import ProcessPoolExecutor
from .config import cfg

FONT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public", "fonts")

def _load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = os.path.join(FONT_DIR, name)
    return ImageFont.truetype(path, size)

def _composite_single(slide_num: int, img_bytes: bytes, pts: dict) -> bytes:
    """
    Worker per un singolo slide compositing.
    Aggiunge overlay di testo e icone. Eseguito in ProcessPoolExecutor.
    """
    img = Image.open(BytesIO(img_bytes)).convert("RGBA")
    W, H = img.size
    draw = ImageDraw.Draw(img)

    # Font
    font_bold   = _load_font("Inter-Bold.ttf", int(H * 0.04))
    font_reg    = _load_font("Inter-Regular.ttf", int(H * 0.025))
    font_display = _load_font("Manrope-Bold.ttf", int(H * 0.09))

    # Colori (coerenti con design system Minimal Luxury)
    WHITE     = (255, 255, 255, 230)
    GOLD      = (201, 169, 97, 255)   # #C9A961
    DARK      = (26, 26, 26, 220)

    # Testo dinamico dal PTS
    product_name  = pts.get("title", "")[:60]
    key_features  = pts.get("key_features", ["Feature 1", "Feature 2", "Feature 3"])
    rating        = pts.get("rating", "4.8")
    review_count  = pts.get("review_count", "1,000+")

    if slide_num == 1:
        # Headline top-left
        draw.text((int(W * 0.06), int(H * 0.07)), product_name,
                  font=font_bold, fill=WHITE)

    elif slide_num == 2:
        # Divider line verticale oro
        x = W // 2
        draw.line([(x, int(H * 0.05)), (x, int(H * 0.95))], fill=GOLD, width=2)
        draw.text((int(W * 0.06), int(H * 0.08)), "PROBLEMA",
                  font=font_reg, fill=(150, 150, 150, 200))
        draw.text((int(W * 0.56), int(H * 0.08)), "SOLUZIONE",
                  font=font_reg, fill=GOLD)

    elif slide_num == 3:
        # 3 callout a 10, 2, 6 del prodotto
        callout_positions = [
            (int(W * 0.08), int(H * 0.20)),
            (int(W * 0.62), int(H * 0.20)),
            (int(W * 0.35), int(H * 0.76))
        ]
        for i, (cx, cy) in enumerate(callout_positions):
            if i < len(key_features):
                draw.text((cx, cy), key_features[i],
                          font=font_bold, fill=WHITE)

    elif slide_num == 5:
        # Dimension lines (semplici linee orizzontali/verticali)
        draw.line([(int(W*0.1), int(H*0.12)), (int(W*0.9), int(H*0.12))],
                  fill=DARK, width=1)
        draw.text((int(W * 0.38), int(H * 0.07)), pts.get("width_mm", ""),
                  font=font_reg, fill=DARK)

    elif slide_num == 6:
        # Rating e review count prominenti
        draw.text((int(W * 0.08), int(H * 0.30)), f"{rating}★",
                  font=font_display, fill=DARK)
        draw.text((int(W * 0.08), int(H * 0.52)), f"{review_count} recensioni",
                  font=font_bold, fill=(100, 100, 100, 220))

    elif slide_num == 7:
        # Header tabella comparativa
        draw.text((int(W * 0.25), int(H * 0.46)), "QUESTO PRODOTTO",
                  font=font_bold, fill=GOLD)
        draw.text((int(W * 0.62), int(H * 0.46)), "CONCORRENZA",
                  font=font_bold, fill=(150, 150, 150, 200))

    # Converti in RGB per output PNG
    final = img.convert("RGB")
    final = final.resize(cfg.OUTPUT_SIZE, Image.LANCZOS)

    out = BytesIO()
    final.save(out, format="PNG", optimize=True, quality=95)
    return out.getvalue()


def composite_all_slides(
    slides_bytes: list[bytes],
    pts: dict
) -> list[bytes]:
    """
    Processa tutte le slide in parallelo con ProcessPoolExecutor.
    """
    args = [(i + 1, b, pts) for i, b in enumerate(slides_bytes) if b is not None]

    with ProcessPoolExecutor(max_workers=7) as executor:
        results = list(executor.map(lambda a: _composite_single(*a), args))

    return results
```

### `api/_lib/storage.py`

```python
import boto3
import os
import uuid
from botocore.config import Config as BotoConfig

def _r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['CLOUDFLARE_R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
        config=BotoConfig(signature_version="s3v4"),
        region_name="auto"
    )

def upload_image(img_bytes: bytes, asin: str, slide_num: int) -> str:
    """Carica PNG su R2, ritorna URL pubblico."""
    client = _r2_client()
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
    key = f"{asin}/slide_{slide_num:02d}_{uuid.uuid4().hex[:8]}.png"

    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=img_bytes,
        ContentType="image/png",
        CacheControl="public, max-age=31536000"
    )

    base_url = os.environ["CLOUDFLARE_R2_PUBLIC_URL"].rstrip("/")
    return f"{base_url}/{key}"

def upload_all(slides_bytes: list[bytes], asin: str) -> list[str]:
    """Upload parallelo di tutte le slide. Ritorna lista URL."""
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as ex:
        futures = {
            ex.submit(upload_image, b, asin, i + 1): i
            for i, b in enumerate(slides_bytes)
        }
        urls = [""] * len(slides_bytes)
        for future in concurrent.futures.as_completed(futures):
            idx = futures[future]
            urls[idx] = future.result()
    return urls
```

### `api/generate.py` — Entry point pipeline

```python
"""
POST /api/generate
Body: { "asin": "B08XYZ123" }
Returns: { "job_id": "uuid", "cached": bool }
"""
import asyncio
import base64
import json
import os
import time
import traceback
from http.server import BaseHTTPRequestHandler
from supabase import create_client

from _lib.scraper import scrape_asin, download_ref_images
from _lib.mvd_generator import generate_mvd
from _lib.image_generator import generate_slide_1, generate_slides_2_to_7
from _lib.qc_checker import qc_check
from _lib.compositor import composite_all_slides
from _lib.storage import upload_all
from _lib.config import cfg


def _supabase():
    return create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )

def _update_job(db, job_id: str, **kwargs):
    db.table("jobs").update(kwargs).eq("id", job_id).execute()


async def run_pipeline(asin: str, job_id: str):
    """Pipeline principale. Aggiorna stato job in Supabase."""
    db = _supabase()
    t0 = time.time()
    total_cost = 0.0

    try:
        # ── Step 1: Cache check ────────────────────────────────────────
        _update_job(db, job_id, status="scraping", progress=5, current_step="Verifica cache")
        cached = db.table("products").select("*").eq("asin", asin).execute()

        if cached.data:
            pts       = cached.data[0]["pts_json"]
            mvd       = cached.data[0]["mvd_text"]
            ref_urls  = cached.data[0]["ref_image_urls"]
            cache_hit = True
        else:
            # ── Step 2: Scraping ────────────────────────────────────────
            _update_job(db, job_id, status="scraping", progress=10, current_step="Scraping Amazon")
            amazon_data, ref_urls = await asyncio.gather(
                scrape_asin(asin),
                download_ref_images(asin)
            )
            cache_hit = False

            # ── Step 3: MVD Generation ──────────────────────────────────
            _update_job(db, job_id, status="mvd", progress=20, current_step="Analisi prodotto (AI)")
            images_b64 = []
            for url in ref_urls[:4]:
                import aiohttp
                async with aiohttp.ClientSession() as s:
                    async with s.get(url) as r:
                        data = await r.read()
                        images_b64.append({
                            "data": base64.b64encode(data).decode(),
                            "media_type": "image/jpeg"
                        })

            pts = await generate_mvd(images_b64, amazon_data)
            mvd = pts["canonical_paragraph"]

            # Salva in cache
            db.table("products").upsert({
                "asin": asin,
                "title": amazon_data.get("title", ""),
                "pts_json": pts,
                "mvd_text": mvd,
                "ref_image_urls": ref_urls
            }).execute()

        # ── Step 4: Carica reference images ────────────────────────────
        from PIL import Image
        from io import BytesIO
        import requests

        ref_pils = []
        for url in ref_urls[:4]:
            r = requests.get(url, timeout=15)
            ref_pils.append(Image.open(BytesIO(r.content)))

        # ── Step 5: Slide 1 anchor ──────────────────────────────────────
        _update_job(db, job_id, status="generating", progress=30, current_step="Generazione slide 1 (anchor)")
        use_pro = pts.get("is_high_value", False)
        slide1_bytes = None
        for attempt in range(cfg.MAX_RETRIES):
            slide1_bytes = await generate_slide_1(mvd, pts, ref_pils, use_pro)
            qc1 = await qc_check(slide1_bytes, anchor_bytes=None)
            if qc1["pass"] or attempt == cfg.MAX_RETRIES - 1:
                break

        # ── Step 6: Slide 2–7 parallele ────────────────────────────────
        _update_job(db, job_id, status="generating", progress=45, current_step="Generazione slide 2-7 (parallele)")
        ref_pils_full = ref_pils + [Image.open(BytesIO(slide1_bytes))]
        slides_2_7 = await generate_slides_2_to_7(mvd, pts, ref_pils_full)

        # ── Step 7: QC parallelo ───────────────────────────────────────
        _update_job(db, job_id, status="qc", progress=65, current_step="Quality check")
        qc_tasks = [qc_check(s, slide1_bytes) for s in slides_2_7 if s]
        qc_results = await asyncio.gather(*qc_tasks)

        # Retry slide fallite
        final_slides = [slide1_bytes]
        qc_all = [qc1]
        for i, (slide, qc) in enumerate(zip(slides_2_7, qc_results)):
            if qc["pass"]:
                final_slides.append(slide)
                qc_all.append(qc)
            else:
                from _lib.image_generator import _generate_one
                from _lib.prompts import build_prompt
                model = cfg.OPUS_MODEL if qc["avg"] < cfg.QC_OPUS_THRESHOLD else None
                prompt = build_prompt(i + 2, mvd, pts)
                retried = await _generate_one(i + 2, prompt, ref_pils_full, model)
                final_slides.append(retried)
                qc_retry = await qc_check(retried, slide1_bytes)
                qc_all.append(qc_retry)

        # ── Step 8: Compositing ────────────────────────────────────────
        _update_job(db, job_id, status="compositing", progress=80, current_step="Compositing testo e layout")
        composited = composite_all_slides(final_slides, pts)

        # ── Step 9: Upload R2 ──────────────────────────────────────────
        _update_job(db, job_id, status="compositing", progress=90, current_step="Upload immagini")
        urls = upload_all(composited, asin)

        # ── Step 10: Completa ──────────────────────────────────────────
        duration_ms = int((time.time() - t0) * 1000)
        avg_score = sum(q["avg"] for q in qc_all) / len(qc_all)
        _update_job(db, job_id,
            status="done", progress=100, current_step="Completato",
            slide_urls=urls,
            qc_scores={f"slide_{i+1}": q for i, q in enumerate(qc_all)},
            duration_ms=duration_ms,
            cost_usd=total_cost
        )

        # Log run
        db.table("runs").insert({
            "job_id": job_id, "asin": asin,
            "cache_hit": cache_hit,
            "duration_ms": duration_ms,
            "avg_qc_score": avg_score,
            "slide_urls": urls
        }).execute()

    except Exception as e:
        _update_job(db, job_id, status="error", error_message=str(e))
        print(traceback.format_exc())


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length))
        asin   = body.get("asin", "").strip().upper()

        if not asin or len(asin) != 10:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "ASIN non valido"}).encode())
            return

        # Crea job in Supabase
        db  = _supabase()
        res = db.table("jobs").insert({"asin": asin}).execute()
        job_id = res.data[0]["id"]

        # Lancia pipeline in background (asyncio)
        asyncio.run(run_pipeline(asin, job_id))

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"job_id": job_id, "asin": asin}).encode())
```

### `api/status.py`

```python
"""
GET /api/status?job_id=UUID
Returns: job status object
"""
import json
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from supabase import create_client


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        job_id = qs.get("job_id", [None])[0]

        if not job_id:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "job_id mancante"}).encode())
            return

        db  = create_client(
            os.environ["NEXT_PUBLIC_SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        )
        res = db.table("jobs").select("*").eq("id", job_id).execute()

        if not res.data:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Job non trovato"}).encode())
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(res.data[0]).encode())
```

---

## 9. FRONTEND KEY COMPONENTS

### `app/page.tsx` — Homepage ASIN input

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [asin, setAsin]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asin.match(/^[A-Z0-9]{10}$/)) {
      setError("ASIN deve essere 10 caratteri alfanumerici (es. B08XYZ12AB)");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asin: asin.toUpperCase() })
    });

    const data = await res.json();
    if (data.job_id) {
      router.push(`/results/${data.job_id}`);
    } else {
      setError(data.error || "Errore sconosciuto");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950">
      <div className="w-full max-w-lg px-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          Amazon Infographic Generator
        </h1>
        <p className="text-neutral-400 mb-8">
          Inserisci un ASIN Amazon. Le 7 slide vengono generate in ~90 secondi.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={asin}
            onChange={e => setAsin(e.target.value.toUpperCase())}
            placeholder="Es. B08XYZ12AB"
            maxLength={10}
            className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700
                       rounded-lg text-white font-mono text-lg tracking-wider
                       focus:outline-none focus:border-amber-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || asin.length !== 10}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-black font-bold rounded-lg transition-colors"
          >
            {loading ? "Avvio pipeline..." : "Genera Infografiche"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

### `app/results/[jobId]/page.tsx` — Polling + display risultati

```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Job {
  id: string; asin: string; status: string;
  progress: number; current_step: string;
  slide_urls: string[]; error_message: string | null;
  qc_scores: Record<string, { avg: number; pass: boolean }>;
  duration_ms: number;
}

export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      const res  = await fetch(`/api/status/${jobId}`);
      const data = await res.json();
      setJob(data);
      if (["done", "error"].includes(data.status)) clearInterval(poll);
    }, 2000);  // polling ogni 2s
    return () => clearInterval(poll);
  }, [jobId]);

  if (!job) return <div className="min-h-screen bg-neutral-950 flex items-center
    justify-center text-white">Caricamento...</div>;

  if (job.status === "error") return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-red-400 text-center">
        <p className="text-xl font-bold mb-2">Errore</p>
        <p>{job.error_message}</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">ASIN: {job.asin}</h1>
          {job.status !== "done" && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-neutral-400 mb-1">
                <span>{job.current_step}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}
          {job.status === "done" && (
            <p className="text-neutral-400 mt-2">
              Completato in {(job.duration_ms / 1000).toFixed(1)}s
            </p>
          )}
        </div>

        {job.slide_urls?.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {job.slide_urls.map((url, i) => {
              const score = job.qc_scores?.[`slide_${i + 1}`];
              return (
                <div key={i} className="bg-neutral-900 rounded-xl overflow-hidden">
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full" />
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-neutral-400 text-sm">Slide {i + 1}</span>
                    {score && (
                      <span className={`text-xs font-mono px-2 py-1 rounded
                        ${score.pass ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                        QC {score.avg.toFixed(0)}
                      </span>
                    )}
                    <a href={url} download className="text-amber-500 text-sm hover:underline">
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
```

---

## 10. GITHUB SETUP — COMANDI ESATTI

Esegui questi comandi nell'ordine in cui appaiono.

```bash
# 1. Nella cartella root del progetto (dopo aver creato tutti i file)
git init
git branch -M main

# 2. Crea .gitignore PRIMA del primo commit
cat > .gitignore << 'EOF'
# Environment
.env.local
.env.*.local

# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
.venv/
venv/
dist/
build/
.pytest_cache/

# Node
node_modules/
.next/
out/

# OS
.DS_Store
Thumbs.db

# Vercel
.vercel

# IDE
.idea/
.vscode/
*.swp
EOF

# 3. Crea repo su GitHub (via GitHub CLI — installalo se non ce l'hai: brew install gh)
gh auth login
gh repo create amazon-infographic-generator \
  --private \
  --description "Amazon product infographic generator — 7 slides in <90s" \
  --confirm

# 4. Primo commit e push
git add .
git commit -m "feat: initial project structure and pipeline architecture"
git remote add origin https://github.com/TUO_USERNAME/amazon-infographic-generator.git
git push -u origin main

# 5. Commit del codice man mano che Claude Code lo genera
git add .
git commit -m "feat: implement core pipeline (MVD, NB2, QC, compositor)"
git push
```

---

## 11. VERCEL SETUP — DEPLOY

```bash
# 1. Installa Vercel CLI
npm install -g vercel

# 2. Login Vercel
vercel login

# 3. Link progetto (dalla root del repo)
vercel link
# Segui le istruzioni: scegli il tuo team/account, crea nuovo progetto

# 4. Imposta tutte le environment variables su Vercel
# METODO A: via CLI (ripeti per ogni variabile)
vercel env add ANTHROPIC_API_KEY production
# Inserisci il valore quando richiesto

# METODO B: via Dashboard (più comodo per molte variabili)
# → Vai su vercel.com → progetto → Settings → Environment Variables
# → Aggiungi tutte le variabili da .env.example una per una

# 5. Deploy di produzione
vercel --prod

# 6. Configura dominio custom (opzionale)
vercel domains add tuo-dominio.com
```

### Verifica post-deploy

```bash
# Testa endpoint generate
curl -X POST https://tua-app.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"asin": "B08N5WRWNW"}'
# Risposta attesa: { "job_id": "uuid-...", "asin": "B08N5WRWNW" }

# Testa polling status (usa job_id dalla risposta precedente)
curl https://tua-app.vercel.app/api/status?job_id=JOB_ID_QUI
```

---

## 12. ORDINE DI BUILD PER CLAUDE CODE

Segui questo ordine. Non saltare step. Testa ogni step prima di procedere.

**Step 1 — Scaffolding**
- `npx create-next-app@latest . --typescript --tailwind --app --src-dir=false`
- Crea tutte le cartelle dalla struttura in §3
- Crea `requirements.txt`, `.env.example`, `vercel.json`

**Step 2 — Database**
- Crea progetto su Supabase.com
- Esegui `supabase/schema.sql` nel SQL Editor
- Crea `lib/supabase.ts` con il client

**Step 3 — Storage R2**
- Crea bucket su Cloudflare R2
- Configura accesso pubblico sul bucket
- Implementa `api/_lib/storage.py`
- Testa upload di un PNG di prova

**Step 4 — Scraper**
- Implementa `api/_lib/scraper.py` con Rainforest API
- Testa su un ASIN reale (es. B08N5WRWNW)
- Verifica che restituisca titolo, bullets, immagini

**Step 5 — MVD Generator**
- Implementa `api/_lib/mvd_generator.py`
- Implementa `api/_lib/config.py`
- Testa standalone: chiama con immagini reali, verifica JSON output

**Step 6 — Image Generator**
- Implementa `api/_lib/prompts.py` con tutti i 7 template
- Implementa `api/_lib/image_generator.py`
- Testa generazione slide 1 (hero) su un prodotto

**Step 7 — QC Checker**
- Implementa `api/_lib/qc_checker.py`
- Testa confronto tra slide 1 e slide 1 (score atteso: ~95)
- Testa confronto tra slide 1 e immagine non correlata (score atteso: <60)

**Step 8 — Compositor**
- Scarica font Inter e Manrope in `public/fonts/`
- Implementa `api/_lib/compositor.py`
- Testa overlay su una slide generata

**Step 9 — Pipeline end-to-end**
- Implementa `api/generate.py`
- Implementa `api/status.py`
- Testa pipeline completa su un ASIN in locale con `vercel dev`

**Step 10 — Frontend**
- Implementa `app/page.tsx` (form input)
- Implementa `app/results/[jobId]/page.tsx` (polling + grid)
- Implementa componenti in `components/`
- Testa flusso completo: inserisci ASIN → vedi progress → vedi slide

**Step 11 — GitHub + Deploy**
- Esegui comandi da §10 (git init, commit, push)
- Esegui comandi da §11 (vercel link, env vars, deploy)
- Verifica con `curl` che gli endpoint rispondano
- Verifica end-to-end su URL Vercel

---

## 13. CHECKLIST FINALE PRE-DEMO

- [ ] Pipeline completa su 3 ASIN diversi senza errori
- [ ] Tempo medio < 90s (misura da `duration_ms` in Supabase)
- [ ] QC score medio > 85 per tutte le slide
- [ ] Download PNG funzionante dalla UI
- [ ] `.env.local` NON committato in git (`git status` non deve mostrarlo)
- [ ] Tutte le env vars impostate su Vercel Dashboard
- [ ] URL Vercel pubblico funzionante
- [ ] `README.md` aggiornato con URL e istruzioni di uso

---

## 14. RIFERIMENTI ARCHITETTURALI

Per la grammatica visiva completa (Material Ontology PBR, Geometric Specs CAD,
Lighting Recipes, Slide Compositions), consulta:

**`gold_standard_amazon_infographic_architecture.md`** — allegato separato.

Le decisioni di design (perché Haiku e non Opus, perché NB2 e non MJ,
perché Pillow e non Bannerbear, quando usare GPT-Image-2) sono spiegate lì.
Non devi reimplementarle, devi usarle come specifiche.

---

*CLAUDE.md v1.0 — Questo file È il progetto. Segui l'ordine. Testa ogni step.*
