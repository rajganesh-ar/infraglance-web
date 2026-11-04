# Media shot list

Every photo and video on the site is referenced by a **key**. Raw downloads live in
`assets/raw/photos/<key>.jpg` and `assets/raw/video/<key>.mp4`; credits in `assets/credits.json`.
The pipeline (`npm run media`) encodes them into `public/media/` and writes `src/data/media.json`.

Rules for every file:
- Free licence that allows commercial use without payment: Unsplash, Pexels, Pixabay, Mixkit, Coverr,
  or Wikimedia Commons CC0 / public domain / CC BY (no -SA, no -NC, no -ND).
- No watermarks, no text overlays, no visible competitor or camera-brand logos as the subject.
- Industrial, realistic, well lit; landscape unless noted. Photos at least 2400 px wide where possible.
- Tone: modern, credible, not cheesy (no thumbs-up, no posed handshakes).
- Prefer daylight or evenly lit scenes in the middle of the tonal range. The grade evens out exposure and
  colour casts, but it is bounded on purpose: a near-black frame stays dark, and a scene lit almost
  entirely by orange light stays warm.

## House grade

The pipeline gives every asset its own grade so the library reads as one brand on the site palette
(cool blue-grey neutrals, ink `#05070B`, cyan accent). `scripts/media.mjs` measures each photo, or
three frames of each clip, and then:

1. **White balance.** Moves the neutral pixels part of the way toward a slightly cool grey. It can
   cool an image more than it can warm one, and it is near-off for highlights, so clipped whites
   stay white. When a frame has almost no neutral pixels (sodium lighting, for example), the
   correction is weaker.
2. **Exposure and contrast.** Moves mean brightness about half-way toward a house mid-tone and
   overall contrast toward a house amount. Black and white points stay fixed, so nothing clips.
3. **Saturation.** Moves colourfulness toward a muted house level and never boosts it. Very strong
   colour is compressed more gently, and saturated orange gets slightly more restraint. Skin
   tones stay natural.
4. **Shadows.** Adds a cool tint in the shadows only. Pure black lands on the site ink, so dark
   areas of an image meet dark sections without a seam.

All of this is baked into one 65³ 3D LUT per asset. Photos apply the LUT in the script; clips
apply the same LUT through ffmpeg `lut3d`. Poster and clip therefore match, within 1/255.

Measured on the smallest output of the 62 graded entries (thermal-image excluded), standard
deviation across the library before → after:

| Measure | Before | After |
|---|---|---|
| Mean luminance | 0.159 | 0.102 |
| Saturation | 0.169 | 0.098 |
| Warmth (R−B) | 0.115 | 0.083 |

Images with more than 20% saturated orange went from 10 to 3. No loading placeholder is
near-black any more (30 were before).

Per-asset options in `credits.json`:
- `"grade": "none"` leaves the asset untouched. Used for `thermal-image`: its false colours carry
  meaning.
- `"grade": "soft"` applies about half the correction. Use it where colour carries meaning (for
  example a colour-matching close-up).
- `"start": <seconds>` sets where a clip begins (default: 10% in, at most 1.5 s).

Each clip is published as a seamless loop. Its last 0.6 s cross-dissolves into its first frames,
so it never fades to black. Clips are 25 fps, H.264 and VP9 at 1920 and 1280 px, tagged BT.709.
The poster is the loop's first frame, taken from the same graded chain, so it is not graded twice.

### Running it

```sh
npm run media                       # everything (skips outputs that already exist)
node scripts/media.mjs --only=tunnel,v-workers-ppe
node scripts/media.mjs --photos     # or --videos
node scripts/media.mjs --clean      # also delete files in public/media/{p,v} the manifest no longer uses
node scripts/media.mjs --force      # re-encode even when outputs exist
```

Output names carry a hash of the source, the grade version, the grade maths and that asset's
grade parameters. Changing the grade therefore produces new file names, and caches never serve
an old look. Run with `--clean` before committing, so no orphaned files are committed or
deployed. `assets/raw/` is gitignored, so the encode runs locally (it needs ffmpeg and ffprobe
on PATH) and the generated `public/media/` and `src/data/media.json` are committed. A full run
takes about 12 minutes.

Each manifest entry has `color`, the graded image's average colour (used as the loading
placeholder), and `lum`, its mean luma from 0 to 1. Components set
`style="--media-lum:{lum(key)}"` (from `src/lib/media.ts`) so text scrims can adapt to how
bright the image is.

## Videos (6–10 s usable, landscape, ≥1920 px wide)

| Key | Subject |
|---|---|
| `v-factory-robots` | Automated production line or robot arms working (welding/assembly) |
| `v-workers-ppe` | Workers in hard hats and hi-vis walking or working on an industrial/construction site |
| `v-bulk-conveyor` | Bulk material (ore, coal, aggregate) moving on a long conveyor belt |
| `v-inspection-line` | Products (bottles, cans, parts) moving fast on a production/packaging line |
| `v-bridge-aerial` | Aerial/drone shot of a large bridge |
| `v-power-aerial` | Aerial of transmission towers, substation or solar farm |
| `v-warehouse-forklift` | Forklift moving in a warehouse aisle |
| `v-refinery-night` | Refinery / process plant at dusk or night with lights |

## Photos

### Safety (Guard)
| Key | Subject |
|---|---|
| `ppe-site-workers` | Group of workers in helmets and hi-vis on site |
| `ppe-helmet-closeup` | Close-up of a worker wearing a hard hat (and glasses) |
| `ppe-welder` | Welder with face shield, sparks |
| `ppe-gloves` | Gloved hands handling metal/parts |
| `forklift-aisle` | Forklift in warehouse aisle with racking |
| `scaffold-height` | Worker on scaffolding / working at height |
| `harness-worker` | Worker wearing a fall-arrest harness, ideally clipped on |
| `floor-markings` | Industrial floor with yellow/black safety markings or walkways |
| `robot-cell` | Industrial robot cell / robot arms in a factory |
| `steel-plant` | Steel mill / foundry with molten metal glow |
| `cctv-industrial` | Security/CCTV camera mounted in an industrial setting |
| `control-room` | Control room with operators and screens |

### Quality (Inspect)
| Key | Subject |
|---|---|
| `cnc-parts` | Machined metal parts / CNC machining |
| `castings` | Metal castings or foundry parts |
| `plastic-molding` | Injection-moulded plastic parts or moulding machine |
| `color-samples` | Paint/colour swatches, colour matching, coloured materials |
| `textile-rolls` | Fabric rolls / textile production |
| `tiles-production` | Ceramic tiles on a production line or stacked |
| `bottling-line` | Bottles on a filling/bottling line |
| `pharma-packs` | Pharmaceutical blister packs / pills production |
| `pcb-inspection` | Circuit board close-up or electronics assembly |
| `quality-inspector` | Person inspecting a part (calipers, magnifier, gloves) |
| `auto-assembly` | Automotive assembly line |
| `packaging-line` | Cartons/boxes with labels on a packaging line |

### Operations (Flow / Sense)
| Key | Subject |
|---|---|
| `mining-conveyor` | Long conveyor belt at a mine or quarry |
| `cement-plant` | Cement plant exterior |
| `port-terminal` | Container port with cranes |
| `truck-gate` | Trucks at a logistics gate / loading docks |
| `parcel-conveyor` | Parcel/sortation conveyors in a distribution centre |
| `food-line` | Food processing line |
| `conveyor-rollers` | Close-up of conveyor idlers/rollers |
| `pipe-rack` | Pipes and valves in a refinery or plant |
| `pressure-gauge` | Analog pressure gauge on pipework |
| `thermal-image` | Thermal/infrared image of equipment |
| `steam-valve` | Steam or vapour from industrial pipes/valves |
| `electrical-panel` | Industrial electrical cabinet / switchgear |
| `chemical-plant-night` | Chemical or process plant at night |

### Infrastructure (Infra)
| Key | Subject |
|---|---|
| `bridge-piers` | Concrete bridge with piers |
| `bridge-steel` | Steel truss or cable-stayed bridge |
| `concrete-crack` | Close-up of cracked concrete |
| `tunnel` | Tunnel interior |
| `highway-aerial` | Highway / road from above |
| `railway-tracks` | Railway tracks |
| `metro-platform` | Metro/train platform |
| `transmission-tower` | High-voltage transmission tower |
| `substation` | Electrical substation |
| `solar-farm` | Solar farm (aerial preferred) |
| `wind-turbines` | Wind turbines |
| `construction-cranes` | Construction site with tower cranes |
| `drone-inspection` | Drone flying (ideally near a structure) |

### Technology & company
| Key | Subject |
|---|---|
| `edge-hardware` | Industrial computer / server board / compact computing hardware |
| `engineer-laptop` | Engineer with laptop in a factory or plant |
| `team-engineering` | Engineering team working together (screens, whiteboard) |
| `data-screens` | (dropped: the stock shot showed a third-party web-analytics UI) |
| `factory-hall-wide` | Wide shot of a large modern factory hall |
| `industrial-night` | Industrial site at night, dramatic lights |

## Current stock, where it differs from the brief

Replace these first when you have your own footage.

| Key | What the current file actually shows |
|---|---|
| `thermal-image` | Not a real thermal capture. A false-colour treatment of `electrical-panel`, made by us and captioned "Illustrative" wherever it appears. Excluded from the house grade (`"grade": "none"`) |
| `castings` | A pile of cast aluminium parts, not a foundry |
| `tiles-production` | Stacks of glazed tiles, not a production line |
| `steam-valve` | Steam around pipes and ducts at an old steelworks, no valve close-up |
| `floor-markings` | Yellow markings around a reach-truck bay; the truck maker's name is readable on the nearest truck, so keep it at figure size |
| `v-bulk-conveyor` | Aggregate falling off a stacker conveyor onto a pile |
| `v-power-aerial` | Drone shot over a desert solar farm. Used on the Energy & utilities industry page |
| `v-bridge-aerial` | Sunshine Skyway, Tampa (a recognisable landmark, not a customer site) |
| `v-warehouse-forklift` | Man-up order picker with one operator in hi-vis and harness in a racking aisle; no pedestrian in frame, so captions must not describe one |
| `port-terminal` | "MAERSK LINE" on the hull and MAERSK, HYUNDAI and MOL marks on containers are legible at hero and backdrop width. Used only as a gallery thumbnail (Logistics industry page); never as a hero, CTA backdrop or in `ctaPool` |
| `truck-gate` | "SITC" on a container and "ETIMADEN" on bulk bags; figure size only, never a hero |
| `cctv-industrial` | "BOSCH" is readable on both camera housings at hero width; prefer card or figure size |
| `highway-aerial` | A road interchange with no gates, docks or yards; keep it to road contexts (Infra Road hero, Construction backdrop), not logistics gate products |
| `pipe-rack` | Valve positioners, transmitters and pipework, no dial gauge; use `pressure-gauge` where a caption talks about gauges |
| `pressure-gauge` | A pressure switch at the bottom-right edge shows part of its maker's script logo |
| `metro-platform` | Full-height platform screen doors, so captions can mention crowding but not track intrusion |
| `engineer-laptop`, `team-engineering` | Identifiable stock people. Use them only where they read as generic (the integrator partner card, insight article figures). Never place them beside "our engineers", careers or company copy, where they would pass as Infraglance staff, lab or office |
