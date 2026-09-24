# The Last Bellkeeper — style lock v2 (Bellhollow)

Supersedes STYLE.md for all v2 work. Every reference prompt, asset and material follows this file verbatim.

## Style sentence (use verbatim in every Atlas reference prompt)
Hand-painted cel-shaded fantasy diorama, chunky readable shapes with soft bevels, warm ivory stone and honey timber,
verdigris copper and coral cloth accents, two-tone shading with crisp soft-edged shadows and thin dark ink outlines,
Studio Ghibli warmth meets Wind Waker clarity, single object on plain white background, three-quarter view, even lighting.

(For sky/backdrop/texture prompts replace the last clause with the relevant framing, e.g. "seamless tileable texture,
flat even lighting, no perspective" or "wide painted sky panorama, no objects".)

## Palette
| Hex | Role |
|---|---|
| `#F2E6C9` | Ivory stone — walls, bell galleries, trunk carvings (light) |
| `#CDBB95` | Ivory shadow band |
| `#C8894A` | Honey timber — frames, planks, rails (light) |
| `#7A4E33` | Timber shadow / dark beams |
| `#3E9C8C` | Verdigris copper — pipes, bells, grilles, wheels |
| `#B8733F` | Bright copper — polished bell lips, fittings, staff |
| `#D96956` | Coral cloth — hero coat, awnings, pennants (sparingly elsewhere) |
| `#E9B949` | Lantern gold — lit lanterns, restored accents |
| `#5E8F4E` | Leaf mid — canopy masses |
| `#A6C46A` | Leaf light — sunlit tips, moss |
| `#2C4A45` | Deep shade — trunk bark shadow, far masses (never pure black) |
| `#8FD3E0` | Wind — gust ribbons, updraft columns (only for wind) |
| `#BFE1EA` / `#F6D9B0` | Sky top / dawn horizon |
| `#2A1E1C` | Ink outline (thin, 1–2 px at 1080p) |

Rules: wind is the only cyan; gold appears only on lit/restored things; coral is the hero's colour, used on at most
one accent per building. Shadows are tinted toward `#2C4A45`, never grey.

## Real sizes (metres)
Hero 1.60 (head 0.30). Mara 1.55. Staff 1.30. Door 2.0 × 1.1. House storey 2.8; small house footprint 4 × 4, tall
house 4 × 5 two storeys + roof. Rail height 0.9. Walkway min clear width 2.4 (branches 3.0). Stair step 0.25 rise /
0.35 run. Floor vent grille 1.6 Ø. Seed wheel 1.8 Ø. Windmill tower 8 tall, sail span 7. Morning bell 0.7 tall.
Great trunk Ø 18. Guardian 4.0 tall hovering 1.0 above floor. Lantern 0.45. Updraft lift 4–6.

## Materials (recipe names)
plaster, stone, timber, tile, metal, fabric, foliage, glass, emissive (per recipe asset-contract/surfaces). Assets set
explicit colours from the palette above; no textures inside asset modules (textures are applied by the renderer to
terrain/trunk/large surfaces only).

## Shape language
Chunky, slightly top-heavy, rounded bevels (bevel ≥ 4% of the smallest dimension), gentle lean/irregularity (±2–4°)
so nothing looks CAD-perfect, bell curves and petal shapes as the recurring motif, copper piping that visibly carries
wind between things. Silhouettes readable at 60 px tall.

## Reference shot list (Atlas, one object per image, style sentence verbatim)
Characters: R-hero (apprentice, full body, front 3/4), R-mara (elderly keeper in work apron with bypass lever),
R-guardian (4 m bell-bodied guardian with petal hood and rotor heart; calm and inhaling poses).
Kit: R-house-small, R-house-tall, R-bell-tower, R-windmill, R-market-stall, R-lantern-post, R-floor-vent-grille,
R-seed-wheel, R-hanging-bridge, R-copper-pipe-junction, R-stair-and-rail, R-sail-gate, R-paired-bells (finale).
Nature: R-trunk-bark-detail, R-branch-walkway, R-foliage-cluster, R-root-mass.
Surfaces/sky: T-bark (tileable), T-ivory-stone (tileable), T-timber-planks (tileable), S-dawn-sky panorama,
S-valley-backdrop (distant far bell across a valley).
