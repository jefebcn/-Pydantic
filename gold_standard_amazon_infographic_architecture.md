# GOLD STANDARD — Architettura per Automazione Infografiche Amazon
### Manuale d'istruzioni v2.0 — Pipeline ad alta coerenza, esecuzione in < 2 minuti

> **Filosofia di base — tre assi irrinunciabili**
>
> **1. Vocabolario prima di tutto.** I modelli generativi rispondono in modo radicalmente
> diverso a linguaggio CAD/PBR/cinematografico rispetto a descrittivo. Questo documento
> codifica quel vocabolario.
>
> **2. Cache è la prima ottimizzazione.** Ogni ASIN già visto riutilizza il suo MVD.
> Nessun lavoro viene rifatto due volte.
>
> **3. Parallelismo è la seconda.** Slide 2–7 si generano in una singola chiamata
> concorrente, non in sequenza. Il collo di bottiglia è Slide 1 (anchor), non le sei
> successive. Target: **< 90 secondi su prima elaborazione,
> < 60 secondi su ASIN già visto**.

---

## FASE 1 — DECOSTRUZIONE TECNICA (L'Ingegnere)

L'output di questa fase è un singolo oggetto JSON canonico: il **Product Technical Sheet
(PTS)**. Viene generato **una sola volta per ASIN**, salvato in DB, e riutilizzato a
ogni rigenerazione. Il modello scelto è **Claude Haiku 4.5** (vision nativa, 10×
più economico di Opus, latenza ~4–6s): il task è deterministico e strutturato,
non richiede ragionamento aperto. Il PTS è l'input di tutto il resto della pipeline.

### 1.1 Material Ontology

Vietato usare termini generici. Ogni superficie del prodotto viene classificata
secondo questa tassonomia gerarchica.

**Schema gerarchico:**

```
MATERIAL_CLASS / SUBCLASS / FINISH / COLOR_SYSTEM / MICRO_DETAIL
```

**Tassonomia operativa:**

| Classe | Sottoclasse esempio | Vocabolario per il prompt |
|---|---|---|
| Polimeri rigidi | ABS, PC, PMMA, POM, PA66-GF | "matte textured ABS polymer", "polished polycarbonate" |
| Polimeri morbidi | TPE, TPU, LSR, silicone | "soft-touch TPE elastomer", "translucent TPU with subsurface scattering" |
| Alluminio | 6061 anodizzato, 7075 sabbiato | "anodized aluminum 6061 with brushed satin finish" |
| Acciaio | SUS304/316L, mirror/satin | "mirror-polished stainless steel 316L", "satin-brushed SUS304" |
| Vetro | soda-lime, boro, Gorilla | "AR-coated tempered glass with oleophobic layer" |
| Compositi | CFRP twill 2x2, aramid | "2x2 twill carbon fiber composite with glossy clear coat" |
| Tessili tecnici | Ripstop nylon DWR, mesh 3D | "ripstop nylon with DWR coating", "3D spacer mesh weave" |
| Pelli/sintetici | Nappa full-grain, Alcantara | "full-grain Nappa leather with visible pore structure" |
| Coating | PVD, DLC, soft-touch rubber | "PVD rose-gold coating", "DLC ceramic black coating" |

**Schema JSON per superficie:**

```json
{
  "surface_id": "main_body",
  "base_material": "aluminum_6061",
  "finish": "anodized_brushed",
  "color": { "system": "CIELAB", "L": 32, "a": 0, "b": -2, "common_name": "space_gray" },
  "microsurface_roughness": 0.35,
  "anisotropy": 0.8,
  "anisotropy_direction_deg": 90,
  "has_metallic_flake": false,
  "subsurface_scattering": "none",
  "IOR": null,
  "wear_signs": "none",
  "fingerprint_visibility": "low_oleophobic"
}
```

**Regola d'oro:** ogni prompt finale deve nominare il materiale con **almeno tre attributi**
(es. *"anodized aluminum 6061 with brushed satin finish, anisotropic reflection along
vertical axis"*).

### 1.2 Geometric Specs (linguaggio CAD)

**Vocabolario obbligatorio:**

- **Trattamento bordi**: `sharp_edge` | `chamfer_2mm_45deg` | `fillet_R3mm` | `bullnose` | `compound_radius`
- **Curvatura superficie**: `planar` | `single_curvature_R_X` | `double_curvature_freeform` | `NURBS_class_A`
- **Simmetria**: `bilateral_axis_Y` | `radial_4_fold` | `asymmetric_organic`
- **Proporzioni volumetriche**: rapporto L:W:H (es. `1.0 : 0.62 : 0.18`)
- **Linee di stampaggio**: `parting_line_visible_horizontal` | `seamless_unibody`
- **Spessore pareti**: `thin_wall_<2mm` | `standard_3-5mm` | `chunky_>5mm`
- **Elementi funzionali**: `recessed_button_R1mm`, `embossed_logo_0.3mm`

**Schema JSON:**

```json
{
  "primary_form": "rounded_rectangular_prism",
  "edge_treatments": [
    { "edge_id": "front_perimeter", "type": "fillet_R3mm" },
    { "edge_id": "back_perimeter",  "type": "chamfer_1.5mm_30deg" }
  ],
  "surface_curvature": "double_curvature_freeform",
  "symmetry_axes": ["bilateral_Y"],
  "volumetric_proportion": [1.0, 0.62, 0.18],
  "wall_thickness_class": "standard_3-5mm",
  "parting_lines": "seamless_unibody",
  "functional_features": [
    { "type": "recessed_button", "geometry": "circular_R6mm_depth_0.5mm", "location": "top_face_centered" }
  ]
}
```

### 1.3 Optical Properties (vocabolario PBR)

Tutto espresso secondo il modello **Physically Based Rendering** standard (Disney BRDF).

| Parametro | Range | Note operative |
|---|---|---|
| `albedo` | LAB / sRGB | Colore base senza illuminazione |
| `roughness` | 0.0–1.0 | 0 = specchio, 1 = diffuso. Matte ≈ 0.7, vetro ≈ 0.05, Al satinato ≈ 0.3 |
| `metallic` | 0.0 o 1.0 | Binario in PBR strict |
| `anisotropy` | 0.0–1.0 | 0 = isotropo, 1 = direzionale (spazzolato) |
| `clearcoat` | 0.0–1.0 | Strato vernice sopra base |
| `IOR` | 1.0–2.5 | Vetro 1.52, plastica 1.46 |
| `transmission` | 0.0–1.0 | Per superfici translucide |
| `subsurface_scatter_distance` | mm | Pelle, plastiche lattiginose |

**Traduzione PBR → linguaggio modello:**

- `roughness 0.05` → *"mirror-like specular reflection, optical-grade polish"*
- `roughness 0.3 + anisotropy 0.8` → *"controlled anisotropic highlights along brushed grain"*
- `clearcoat 1.0` → *"deep automotive-grade clearcoat with secondary specular layer"*
- `IOR 1.52 + transmission 0.95` → *"optical glass refraction, Fresnel falloff at grazing angles"*
- `subsurface 0.5mm` → *"soft subsurface scattering giving the surface internal depth"*

---

## FASE 2 — PROTOCOLLO DI ILLUMINAZIONE (Lo Studio Fotografico)

Queste **Global Rules** sono invarianti e model-agnostic (funzionano su NB2,
GPT-Image-2, MJ). Si concatenano ad ogni prompt.

### 2.1 Regole invarianti

```
GLOBAL_LIGHTING_PRESET = "minimal_luxury_studio_v1":
  - large soft light sources only (octabox 120cm+ or scrim)
  - no harsh point lights, no hard sun
  - controlled specular highlights, never blown (max luminance 245/255)
  - shadow density capped at 70% (no crushed blacks, lifted toe)
  - mandatory rim/edge separation light for product silhouette
  - single coherent color temperature per scene (no mixed WB)
  - background: never pure #FFFFFF, always subtle tonal gradient
  - camera height 5–15° below product center (hero stance)
  - depth of field: shallow but product 100% in critical focus
```

### 2.2 Tre ricette canoniche

Ogni slide dichiara quale ricetta usare. Non inventare varianti.

**Recipe A — `HERO_DRAMATIC`** (slide 1, 7)
```
Key:        4ft octabox, 45° camera-left, 30° elevation, 5500K, ratio 1.0
Fill:       6ft scrim camera-right, 0° elevation, 5500K, ratio 0.4 (-1.3 stops)
Rim:        2ft strip light behind product, 70° from camera axis,
            5500K + 1/8 CTB gel ≈ 6200K (cool separation)
Background: 10ft seamless gradient, negative fill, soft vignette
Bounce:     white card under product, lift micro-shadows
```

**Recipe B — `TECH_CLEAN`** (slide 3, 5)
```
Key:        large overhead softbox, axial, 5500K, ratio 1.0
Fill:       symmetric side scrims left+right, ratio 0.7 (very flat)
Background: neutral light gray gradient (#F5F5F5 → #EBEBEB)
```

**Recipe C — `LIFESTYLE_NATURAL`** (slide 4)
```
Key:        large diffused window light equivalent, 5200K
Fill:       natural bounce from environment
Background: real-context environment, defocused
```

### 2.3 Ottica e color grading

| Slide type | Lens equivalent | Aperture |
|---|---|---|
| Hero / Tech | 85mm prime | f/4 |
| Tech dettaglio | 100mm macro | f/8 |
| Lifestyle | 35–50mm | f/2.0 |

```
WHITE_BALANCE_BASE  = 5500K
TONE_CURVE          = filmic_subtle (highlight roll-off, shadows +5, contrast +8)
GLOBAL_SATURATION   = -10%
PRODUCT_LOCAL_SAT   = +5% (selective mask)
SPLIT_TONING        = teal_orange, weight 15–20%
```

**Negative prompt obbligatori:**
> *"oversaturated colors, crushed blacks, blown highlights, mixed color temperature,
> hard shadow edges, HDR over-processing, cartoonish rendering, plastic look on metal,
> text in image, visible annotations"*

---

## FASE 3 — STRUTTURA DELLE 7 SLIDE "KILLER"

**Regola universale:** nessun testo viene renderizzato dal modello generativo.
Ogni template produce spazio negativo deliberato per overlay tipografico in Pillow.

**Struttura del prompt finale** (tre layer concatenati):
```
[MVD_CANONICAL]  +  [SLIDE_SPECIFIC_TEMPLATE]  +  [GLOBAL_TECHNICAL_SUFFIX]
```

**Global Technical Suffix** (costante per tutti i prompt):
```
shot on Phase One IQ4 medium format equivalent, 85mm lens, f/4, ISO 100,
focus stacked, subtle teal-orange color grade, photorealistic product photography,
2K resolution detail, PBR-accurate materials, no AI artifacts, no text in image,
no annotations, {LIGHTING_RECIPE}, --ar {RATIO}
```

---

### SLIDE 1 — HERO IMPATTO
**Leva:** Pattern Interrupt + Curiosity Gap

```
{MVD}, single hero shot floating slightly above neutral gradient surface,
HERO_DRAMATIC lighting, cool blue rim separation, micro-shadow grounding,
55% frame height, absolute center of attention, museum-display aesthetic,
deliberate negative space top 20% and left 30% for headline overlay.
```

**Composizione (grid 0–1, ratio 1:1)**
- Prodotto: (0.5, 0.55), ~55% altezza frame
- Headline: (0.08, 0.08) top-left
- Sub-copy: (0.08, 0.18)
- Logo brand: (0.92, 0.08) top-right
- Spazio negativo: ≥ 35% area totale ← critico

**Recipe:** `HERO_DRAMATIC` — questa slide è l'**ANCHOR** dell'intera serie.

---

### SLIDE 2 — PROBLEMA / SOLUZIONE
**Leva:** Loss Aversion + Relief (perdere pesa 2.25× guadagnare)

```
Split-frame composition 50/50 with thin vertical gold divider (#C9A961, 2px).
LEFT HALF: visual of {pain_point}, desaturated palette, cold WB 6500K,
slightly underexposed, mundane setting, no product visible.
RIGHT HALF: {MVD}, HERO_DRAMATIC, warm WB 5200K, full saturation,
visual sense of resolution and relief. Same camera height across both halves.
```

**Composizione**
- Split a x=0.5, linea oro 2px (Pillow overlay)
- Prodotto: (0.75, 0.55)
- Headline overlay: (0.5, 0.10), centrata, attraversa il divisore

**Recipe:** Left `LIFESTYLE_NATURAL` desaturato / Right `HERO_DRAMATIC`

---

### SLIDE 3 — 3 FEATURE CHIAVE
**Leva:** Rationalization — il sistema 2 cerca giustificazioni post-acquisto

```
{MVD}, product centered, TECH_CLEAN lighting, editorial composition,
three deliberate empty sectors at 10-o'clock, 2-o'clock, and 6-o'clock
positions around the product for icon + microcopy overlay in post.
No text in image. Clean geometric whitespace. 40% frame area for product.
```

**Composizione**
- Prodotto: (0.5, 0.5), ~40% area
- Callout 1: (0.18, 0.25) | Callout 2: (0.82, 0.25) | Callout 3: (0.5, 0.85)
- Leader lines 1px #1A1A1A 70% opacity, aggiunte in Pillow

**Recipe:** `TECH_CLEAN`

---

### SLIDE 4 — LIFESTYLE / CONTESTO
**Leva:** Self-Identification + Tribal Belonging

```
{MVD}, product placed naturally in {target_persona_environment},
LIFESTYLE_NATURAL lighting, shallow DOF f/2.0, product on lower-third
in critical focus, environment elegantly defocused, warm ambient atmosphere,
optional partial human element (hand only, no face visible),
candid editorial style. Negative space top-left for text overlay.
```

**Composizione (16:9 cinematic)**
- Prodotto: (0.66, 0.66) lower-third destra
- Testo overlay: quadrante top-left (0.05–0.45, 0.05–0.30)

**Recipe:** `LIFESTYLE_NATURAL`

---

### SLIDE 5 — SPECIFICHE TECNICHE
**Leva:** Authority + Trust — riduzione del rischio con numeri esatti

```
{MVD}, product centered on perfectly neutral seamless background,
TECH_CLEAN maximum flat lighting, camera 10° above center,
absolute focus stacking across entire surface, minimal contact shadow only,
clean geometric whitespace on all four sides for dimension callouts
and spec table in post. Blueprint-grade clarity. No text in image.
```

**Composizione**
- Prodotto: (0.5, 0.5), ~45% area
- Dimension callouts (Pillow): linee orizzontali/verticali con quote numeriche
- Tabella materiali: colonna destra (0.78–0.96, 0.3–0.7)
- Stile tipografico: monospace o geometric sans

**Recipe:** `TECH_CLEAN`
**Nota critica:** questa slide è il test di stress della coerenza. Il prodotto DEVE
essere visivamente identico alla Slide 1.

---

### SLIDE 6 — PROVA SOCIALE
**Leva:** Bandwagon Effect + Risk Reduction

```
{MVD}, small-scale product as subtle accent element bottom-right (15% area),
TECH_CLEAN reduced contrast, muted neutral background, ample negative space
dominating frame for typographic overlay. Editorial, magazine-minimalist.
Product de-emphasized, supporting text-led composition.
```

**Composizione**
- Numero hero (es. "4.8★", "50.000+"): (0.3, 0.4) font display 200pt+
- Sub-claim: (0.3, 0.55)
- Micro-testimonianze: colonna destra (0.7, 0.3–0.7)
- Prodotto accent: (0.85, 0.85)

**Recipe:** `TECH_CLEAN` ridotto

---

### SLIDE 7 — WHY US (Confronto Competitivo)
**Leva:** Loss Aversion finale + Commitment/Consistency

```
{MVD}, product elevated top-third as authoritative trophy,
HERO_DRAMATIC with intensified rim for finality,
bottom 60% of frame as clean negative space for comparison table overlay.
Wide composition, conclusive closing aesthetic.
```

**Composizione**
- Prodotto: (0.5, 0.25), ~30% area
- Tabella comparativa overlay: (0.1–0.9, 0.45–0.92)
  - 2 colonne: "Il nostro" vs "Concorrenza tipica"
  - Check verdi #2D8A3E vs X grigi #888888
- Headline-CTA: (0.5, 0.08)

**Recipe:** `HERO_DRAMATIC` — simmetria con Slide 1, chiusura narrativa.

---

## FASE 4 — LOGICA DI COERENZA (Semplificata con NB2)

### Il cambio di paradigma

La v1.0 richiedeva 5 livelli (seed, anchor, cref, ControlNet, 3D) per risolvere la
coerenza visiva tra slide. **Con Nano Banana 2 questo problema è risolto nativamente.**
Il modello accetta fino a 8 immagini di riferimento in input e mantiene Subject
Consistency attraverso generazioni multiple. L'architettura scende a 3 livelli.

### 4.1 Livello 1 — Master Visual Description (MVD)

Descrizione canonica testuale del prodotto, generata una volta, persistita in DB.
**Modello:** Claude Haiku 4.5 (vision) — deterministico, ~$0.02 per ASIN, 4–6s.

**Prompt di sistema per generazione MVD:**

```
You are a senior product designer and PBR rendering specialist.
Analyze the provided product images and Amazon metadata.
Output a Product Technical Sheet (PTS) as strict JSON with:
  - surfaces: array of surface objects (schema Fase 1)
  - geometry: geometric specs object (schema Fase 1)
  - canonical_paragraph: string of 180-220 words

canonical_paragraph rules:
  - name every visible material with PBR vocabulary
  - describe geometry with CAD vocabulary (chamfer/fillet/curvature)
  - specify color in premium terms AND approximate LAB values
  - describe branding: placement, proportional size
  - describe surface micro-details: logos, ports, buttons, seams
  - zero marketing language, zero adjectives of quality
  - deterministic: two readings produce the same mental image
Output JSON only, no commentary, no markdown fences.
```

**Esempio di canonical_paragraph (auricolari premium):**

> *"Closed-back over-ear headphones, bilateral_Y symmetry. Earcups: machined
> aluminum 6061, anodized brushed satin finish, space gray (LAB L:32 a:0 b:-2),
> anisotropy 0.8 along vertical axis, roughness 0.3. Headband: full-grain Nappa
> leather matte black (LAB L:12) over stainless steel core, visible stitching
> 4mm pitch. Earpads: memory foam, perforated protein leather, soft-touch.
> Logo: laser-etched 8mm wordmark on outer earcup, depth 0.05mm, no fill.
> Hinges: polished stainless steel, chamfer_1mm_45deg edges. Cable port:
> 3.5mm jack left earcup, recessed 1mm. Proportions: earcup diameter 95mm,
> depth 35mm. Seamless unibody, no parting lines. Factory-fresh, no fingerprints."*

Il `canonical_paragraph` è il **prefisso fisso** di ogni prompt generativo.

### 4.2 Livello 2 — Reference Image Set (NB2 Subject Consistency)

NB2 accetta fino a **8 immagini di riferimento** che fissano l'identità visiva.
Si usano le immagini ufficiali Amazon: **nessun anchor da generare in precedenza,
nessuna seed da gestire.**

```python
REFERENCE_IMAGE_SET = [
    amazon_image_front.jpg,           # vista frontale principale
    amazon_image_threequarter.jpg,    # tre quarti (preferita)
    amazon_image_detail.jpg,          # dettaglio superficie/logo
    amazon_image_back.jpg             # retro (se disponibile)
]
```

Dopo che Slide 1 è generata e approvata, viene aggiunta al reference set
per le Slide 2–7, rafforzando la coerenza:

```python
ref_set_slide_1    = REFERENCE_IMAGE_SET               # 4 img ufficiali Amazon
ref_set_slides_2_7 = REFERENCE_IMAGE_SET + [slide1]    # + anchor generata
```

**Wrapper di chiamata NB2:**

```python
import google.generativeai as genai
from PIL import Image
import requests
from io import BytesIO

def load_image_from_url(url: str) -> Image.Image:
    r = requests.get(url, timeout=10)
    return Image.open(BytesIO(r.content))

async def generate_slide_nb2(
    slide_num: int,
    mvd: str,
    slide_template: str,
    ref_urls: list[str],
    global_suffix: str,
    model: str = "gemini-2.5-flash"   # Nano Banana 2
) -> bytes:
    client = genai.GenerativeModel(model)
    refs   = [load_image_from_url(u) for u in ref_urls[:4]]   # cap a 4 per velocità
    prompt = f"{mvd}\n\n{slide_template}\n\n{global_suffix}"
    content = refs + [prompt]   # immagini reference PRIMA del prompt

    response = client.generate_content(
        content,
        generation_config=genai.GenerationConfig(
            response_modalities=["image", "text"]
        )
    )
    # estrai bytes immagine dalla risposta
    for part in response.parts:
        if part.inline_data:
            return part.inline_data.data
    raise ValueError(f"No image in NB2 response for slide {slide_num}")
```

### 4.3 Livello 3 — Quality Gate Haiku 4.5

Ogni slide generata passa un controllo automatico prima del compositing.
Haiku gestisce il 90% dei casi. Escalation a Opus solo se score borderline.

**Prompt di sistema per QC:**

```
You are a QC specialist for product photography consistency.
Compare image_A (anchor: slide 1 hero) with image_B (generated slide).
Score each criterion from 0 to 100:
  shape_match:    proportions and 3D form fidelity
  color_match:    hue, saturation, lightness (LAB delta-E reasoning)
  material_match: surface finish, reflection type, texture
  branding_match: logo position and size relative to product
  detail_match:   ports, buttons, seams, micro-features

List AI artifacts: extra ports, melted edges, impossible geometry,
text hallucinations, inconsistent reflections.

Output JSON only:
{
  "scores": { "shape": N, "color": N, "material": N, "branding": N, "detail": N },
  "avg": N,
  "artifacts": ["..."],
  "pass": true/false,
  "reason": "one line"
}
```

**Soglie decisionali:**

| Score medio | Artefatti | Azione |
|---|---|---|
| ≥ 90 | nessuno | ✅ PASS → compositing |
| 75–89 | nessuno/minori | ⚠️ RETRY con prompt + peso reference aumentato |
| 75–89 | rilevanti | ⚠️ RETRY con prompt riscritto da zero |
| < 75 | qualsiasi | ❌ ESCALATION Opus → retry con prompt Opus-revisionato |
| 3 retry falliti | — | 🔴 FLAG manuale, slide saltata nel batch |

---

## FASE 5 — PIPELINE DI ESECUZIONE (Il Direttore d'Orchestra)

Questa è la sezione che determina la velocità. Il codice va scritto con `asyncio`.
Nessuno step sequenziale che poteva essere parallelo.

### 5.1 Diagramma temporale completo

```
T+0s  ┌──────────────────────────────────────────────────────────────┐
      │ INPUT: ASIN                                                  │
      │ CHECK CACHE: ASIN in DB?                                     │
      │   → HIT:  carica PTS/MVD + ref_image_urls  ──────────────┐  │
      │   → MISS: procedi con scraping             ──────────────┤  │
      └──────────────────────────────────────────────────────────────┘

T+0s (cache miss) ─────────────────────────────────────────────────────
     [PARALLEL — asyncio.gather]
     Task A: Scraping ASIN  (Rainforest API)         ~3–8s
     Task B: Download ref images Amazon              ~2–4s

T+8s ──────────────────────────────────────────────────────────────────
     [SEQUENTIAL]
     MVD generation — Haiku 4.5 vision               ~5–8s
     → Output: PTS JSON + canonical_paragraph
     → SAVE TO DB (ASIN cached per future run)

T+16s ─────────────────────────────────────────────────────────────────
     [SEQUENTIAL — unico step non parallelizzabile]
     SLIDE 1 — ANCHOR — Nano Banana 2                ~10–15s
     → Input: MVD + Slide1 template + 4 ref images
     → NB2 genera immagine
     → QC con Haiku (async, parte subito dopo ricezione)

T+31s ─────────────────────────────────────────────────────────────────
     [PARALLEL — asyncio.gather — 6 task simultanei]
     Slide 2 ─┐
     Slide 3  │
     Slide 4  ├── NB2 API                            ~12–15s
     Slide 5  │   Input per ciascuna:
     Slide 6  │   MVD + slide_template + ref_images + slide1_anchor
     Slide 7 ─┘
     (NB2 piano paid: 60 req/min → 6 parallele = no throttle)

T+46s ─────────────────────────────────────────────────────────────────
     [PARALLEL — asyncio.gather — 6 task simultanei]
     QC Slide 2 ─┐
     QC Slide 3  │
     QC Slide 4  ├── Haiku 4.5 vision               ~5–8s
     QC Slide 5  │   Confronto vs Slide 1 anchor
     QC Slide 6  │
     QC Slide 7 ─┘
     → PASS: inviate a compositing
     → FAIL: retry (aggiunge ~12–15s per slide fallita)

T+54s ─────────────────────────────────────────────────────────────────
     [PARALLEL — multiprocessing.Pool — 7 worker]
     Compositing slide 1–7 con Pillow:               ~3–5s
     - Overlay headline + sub-copy (font locale TTF)
     - Overlay icone SVG (cache locale Iconify)
     - Overlay tabelle / dimension lines (Pillow.Draw)
     - Export PNG 2000×2000

T+59s ─────────────────────────────────────────────────────────────────
     [PARALLEL]
     Upload 7 PNG → Cloudflare R2                    ~3s
     Log run → Supabase (ASIN, timing, costi, QC scores)
     Aggiorna cache ref_image_urls con slide1 generata

T+62s ──────────────────────────────────────────── DONE
      OUTPUT: 7 URL PNG pubblici

      Prima elaborazione (cache miss):   ~62–75s
      ASIN già visto (cache hit):        ~45–55s
      Con 1 slide in retry:              ~75–90s
```

### 5.2 Pseudocodice Python — struttura async completa

```python
import asyncio
from anthropic import AsyncAnthropic
import google.generativeai as genai
from multiprocessing import Pool

HAIKU = "claude-haiku-4-5-20251001"
OPUS  = "claude-opus-4-7"
NB2   = "gemini-2.5-flash"          # Nano Banana 2

async def process_asin(asin: str) -> dict:

    # ── STEP 1: Cache check ─────────────────────────────────────────
    pts = await db.get_pts(asin)

    # ── STEP 2: Scraping + download (solo cache miss) ───────────────
    if not pts:
        data, images = await asyncio.gather(
            scrape_amazon(asin),         # Rainforest API
            download_product_images(asin) # 4 immagini ufficiali
        )
        # ── STEP 3: MVD con Haiku ───────────────────────────────────
        pts = await generate_mvd(HAIKU, data, images)
        await db.save_pts(asin, pts)
    else:
        images = await db.get_images(asin)

    mvd = pts["canonical_paragraph"]

    # ── STEP 4: Slide 1 anchor — sequenziale ───────────────────────
    slide1_bytes = await generate_slide_nb2(1, mvd, images, NB2)
    qc1          = await qc_check(HAIKU, slide1_bytes, anchor=None)

    retries = 0
    while not qc1["pass"] and retries < 3:
        slide1_bytes = await generate_slide_nb2(1, mvd, images, NB2)
        qc1          = await qc_check(HAIKU, slide1_bytes, anchor=None)
        retries += 1

    ref_full = images + [slide1_bytes]  # anchor aggiunta al ref set

    # ── STEP 5: Slide 2–7 — tutte in parallelo ─────────────────────
    gen_tasks = [
        generate_slide_nb2(n, mvd, ref_full, NB2)
        for n in range(2, 8)
    ]
    slides_2_7 = await asyncio.gather(*gen_tasks)

    # ── STEP 6: QC parallelo ───────────────────────────────────────
    qc_tasks = [
        qc_check(HAIKU, slide, anchor=slide1_bytes)
        for slide in slides_2_7
    ]
    qc_results = await asyncio.gather(*qc_tasks)

    # Retry slide fallite (sequenziale per quelle che falliscono)
    final_slides = [slide1_bytes]
    for i, (slide, qc) in enumerate(zip(slides_2_7, qc_results)):
        if qc["pass"]:
            final_slides.append(slide)
        elif qc["avg"] >= 65:  # borderline: retry con stesso modello
            retried = await retry_with_adjusted_prompt(i + 2, mvd, ref_full, qc)
            final_slides.append(retried)
        else:  # score basso: escalation Opus per revisione prompt
            revised_prompt = await opus_revise_prompt(OPUS, mvd, qc)
            retried = await generate_slide_nb2(i + 2, revised_prompt, ref_full, NB2)
            final_slides.append(retried)

    # ── STEP 7: Compositing parallelo (multiprocessing) ────────────
    with Pool(processes=7) as pool:
        composited = pool.starmap(
            composite_slide,
            [(n, img, pts) for n, img in enumerate(final_slides, 1)]
        )

    # ── STEP 8: Upload e log ────────────────────────────────────────
    urls = await asyncio.gather(*[upload_to_r2(img) for img in composited])
    await db.log_run(asin, urls, qc_results)

    return {"asin": asin, "slides": list(urls)}
```

### 5.3 Tre decisioni di architettura per la velocità

**1. Pillow, non Bannerbear**
Bannerbear fa una API call per slide (latenza ~1–2s ciascuna, sequenziale nel piano base).
Pillow con `multiprocessing.Pool(7)` processa tutte le slide in ~3–5s totali,
zero latenza di rete, font e template caricati in memoria. Risparmio: ~10–15s per run.

**2. Nessun upscaling di default**
NB2 a 2K (2048px) è sufficiente per Amazon (requisito minimo 1500px per lato, target
ideale 2000px). L'upscaling a 8K aggiunge 30–60s e ~$0.15–0.30/img.
Si attiva solo su flag esplicito (`high_value=True`) su ASIN premium, come step
post-pipeline fuori dal main path.

**3. Batch API solo per lavori notturni**
La Batch API Google taglia i costi del 50% ma ha latenza 24h.
Incompatibile con qualsiasi SLA interattivo.
Uso corretto: rigenerazione pianificata di cataloghi completi (es. resize o rebrand
su 1.000 ASIN), schedulata off-peak, non nel main path.

### 5.4 Quando usare GPT-Image-2 invece di NB2

GPT-Image-2 (API GA maggio 2026, ID: `gpt-image-2-2026-04-21`) ha un vantaggio
su un caso specifico: **testo visibile sulla superficie del prodotto** —
display di smartwatch, schermo con UI, etichette con scritta prominente, packaging
con copy leggibile. NB2 tende ad allucinare o sfocare testo piccolo sulle superfici.

```
USA NB2:      prodotti senza testo su superficie  (≈ 80% categorie Amazon)
USA GPT-I2:   prodotti con testo/display visibile (smartwatch, speaker
               con display, packaging con scritta prominente)
```

GPT-Image-2 non ha reference image nativa: compensare con MVD verbatim nel prompt
+ descrizione testuale dell'anchor (slide 1). Costo ~$0.053/img a medium quality.

### 5.5 Regola di escalation modello — tabella operativa

| Task | Modello | Motivo |
|---|---|---|
| MVD generation | Haiku 4.5 | Deterministico, economico, 4–6s |
| QC score ≥ 75 | Haiku 4.5 | Sufficiente per punteggi netti |
| QC score 65–74 (borderline) | Opus 4.7 | Giudizio sottile su casi ambigui |
| Retry prompt revision | Haiku 4.5 | Aggiustamenti meccanici |
| Retry dopo escalation Opus | Opus 4.7 | Prompt riscritto, qualità critica |
| Prompt assembly (template fill) | Python f-string | Zero LLM, zero latenza, zero costo |

Opus 4.7 è una **eccezione**, non il default. Su 100 ASIN, il 90% non lo tocca.

---

## APPENDICE — Stack tecnologico (v2.0)

### AI e orchestrazione

| Ruolo | Tool | Costo orientativo |
|---|---|---|
| MVD generation | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | ~$0.018/ASIN |
| QC visivo standard | Claude Haiku 4.5 | incluso sopra |
| QC visivo escalation | Claude Opus 4.7 (`claude-opus-4-7`) | ~$0.015 amortizzato |
| Prompt assembly | Python f-string (no AI) | $0 |

### Generazione immagini

| Tool | Uso consigliato | Prezzo |
|---|---|---|
| **NB2** — Nano Banana 2 (Gemini 3.1 Flash Image) | Default, tutti i prodotti | $0.045–0.151/img |
| **NB Pro** — Nano Banana Pro (Gemini 3 Pro Image) | Hero shot ASIN high-value | $0.134–0.24/img |
| **GPT-Image-2** (`gpt-image-2-2026-04-21`) | Prodotti con testo/display visibile | ~$0.053/img (medium) |
| Midjourney v7 (via GoAPI/PiAPI) | Solo per estetica specifica MJ | ~$0.20–0.40/img |

Inizia solo con NB2. Aggiungi GPT-I2 quando incontri casistiche con testo su
superficie. Non aggiungere MJ finché NB2 non è validato su 50+ ASIN reali.

### Scraping Amazon

| Tool | Note |
|---|---|
| **Rainforest API** | Scraping strutturato, anti-bot gestito, dati JSON |
| **Keepa API** | Immagini alta risoluzione + storico prezzi |
| **Apify** (Amazon actor) | Alternativa scalabile per volumi alti |

### Compositing e asset

| Tool | Costo |
|---|---|
| **Pillow + multiprocessing** | $0 — 7 slide in parallelo, nessuna API call |
| **Iconify API** (cache locale SVG) | $0 — 200k+ icone open |
| **Google Fonts** (cache locale TTF) | $0 — font offline, zero latenza |
| **Cloudflare R2** | $0 egress, $0.015/GB/mese storage |
| Magnific / Topaz (opzionale 8K) | ~$0.15–0.30/img, solo su flag esplicito |

### Infrastruttura

| Tool | Ruolo |
|---|---|
| **Supabase** (Postgres) | Cache PTS/MVD per ASIN, log runs, score QC |
| **Upstash Redis** | Queue per richieste concorrenti, throttle API |
| **Cloudflare R2** | Object storage immagini output e reference set |
| **Modal** o **Railway** | Deploy async worker Python |
| **Helicone** | Monitoring costi + latenza chiamate LLM |
| **Sentry** | Error tracking su retry loop e fallback |

### Costi per ASIN — due profili

**Profilo Lean** (~$0.36 per ASIN — prima elaborazione)

| Voce | Costo |
|---|---|
| Scraping Rainforest | ~$0.005 |
| MVD Haiku 4.5 vision (4 img) | ~$0.018 |
| NB2 slide 1–7 standard (1K) | ~$0.315 (7 × $0.045) |
| QC Haiku 4.5 (7 chiamate vision) | ~$0.020 |
| Compositing Pillow | $0 |
| Storage R2 | ~$0.001 |
| **Totale** | **~$0.36** |

**Profilo Gold** (~$0.91 per ASIN)

| Voce | Costo |
|---|---|
| MVD Haiku 4.5 | ~$0.018 |
| NB Pro slide 1 + 7 (4K, hero) | ~$0.48 (2 × $0.24) |
| NB2 slide 2–6 (2K) | ~$0.38 (5 × $0.076) |
| QC Haiku standard | ~$0.020 |
| QC Opus escalation (10% ASIN) | ~$0.015 amortizzato |
| **Totale** | **~$0.91** |

---

## CHECKLIST DI IMPLEMENTAZIONE (ordine ottimale)

**Fase 0 — Setup infrastruttura (una volta sola)**
- [ ] Supabase DB: schema `asin, pts_json, mvd_text, ref_image_urls, runs`
- [ ] Cloudflare R2 bucket configurato
- [ ] Font TTF e icone SVG Iconify essenziali scaricati in locale
- [ ] `pip install google-generativeai anthropic pillow aiohttp`
- [ ] Helicone proxy configurato per monitoring

**Fase 1 — Pipeline core**
- [ ] Scraping ASIN → JSON strutturato (Rainforest API)
- [ ] Download immagini Amazon → R2 (con deduplication per ASIN)
- [ ] Haiku MVD generation → PTS JSON validato contro schema Fase 1
- [ ] Cache PTS in Supabase → test hit/miss logic

**Fase 2 — Generazione**
- [ ] NB2 wrapper async con retry logic (max 3)
- [ ] Slide 1 sequenziale con QC Haiku
- [ ] Slide 2–7 con `asyncio.gather()`
- [ ] QC parallelo, escalation a Opus se score < 75

**Fase 3 — Compositing**
- [ ] Template Pillow per ogni slide (coordinate hardcodate da Fase 3)
- [ ] Font renderer con line-wrap per headline variabili
- [ ] SVG icon loader da cache locale
- [ ] Export PNG 2000×2000

**Fase 4 — Output e monitoring**
- [ ] Upload R2 → URL pubblici
- [ ] Log run su Supabase (ASIN, costi, score, timing, retry_count)
- [ ] Alert se avg_score < 85 su un batch
- [ ] Dashboard Helicone per cost-per-ASIN nel tempo

**Fase 5 — Ottimizzazioni**
- [ ] A/B test: NB2 vs NB Pro su campione ASIN high-value
- [ ] Identificare categorie dove score < 85 → aggiustare template slide
- [ ] Batch API notturna per rigenerazioni pianificate (50% sconto)
- [ ] GPT-Image-2 su casistica prodotti con testo su superficie

---

## NOTE FINALI — Anti-pattern e regole d'oro

**Non fare:**
- Non generare testo dentro l'immagine NB2 — sempre overlay Pillow
- Non lanciare Slide 2–7 in sequenza — `asyncio.gather()` obbligatorio
- Non chiamare Opus per MVD — è lavoro da Haiku
- Non saltare il caching: un ASIN rivisto senza cache paga il doppio
- Non usare Batch API su workflow interattivi (SLA 24h)
- Non descrivere materiali con aggettivi di valore ("premium", "high-quality")
- Non mischiare italiano e inglese nei prompt: solo inglese tecnico
- Non aggiungere MJ finché NB2 non è validato su 50+ ASIN reali

**Fai:**
- Logga ogni prompt + risultato + score QC nel DB: è il dataset per migliorare
- Tratta la Slide 1 come l'investimento di qualità della pipeline (fino a 3 retry)
- Scala NB2 prima, aggiungi complessità solo dove i dati lo giustificano
- Testa su ASIN di categorie diverse (elettronica, cucina, sport, personal care)
  nelle prime settimane — si comportano diversamente
- Monitora cost-per-ASIN su Helicone: se supera $0.60 sul profilo Lean, c'è un bug

---

*v2.0 — Stack: Claude Haiku 4.5 + Nano Banana 2 + Pillow multiprocessing.*
*Target: < 90s prima elaborazione, < 60s su ASIN cached.*
*La grammatica visiva è nelle Fasi 1–3. La velocità è nella Fase 5.*
