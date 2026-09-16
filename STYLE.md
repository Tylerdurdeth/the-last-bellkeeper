# The Last Bellkeeper — style lock v1

> An illustrated woodland diorama built from softly carved ivory machinery, patinated copper and warm timber, with sculpted leaf clusters, quiet painted surfaces, colored shadows and a coral-clad apprentice whose silhouette reads cleanly from an elevated camera.

## Palette

| Role | Hex | Use |
|---|---|---|
| Deep woodland | #183E3D | Shadow families and distant tree masses |
| Leaf midtone | #3F7860 | Broad canopy masses |
| Leaf light | #90AE68 | Selected sunlit leaf tips |
| Ivory | #E7DDC2 | Platform and machine body |
| Warm light | #FFF0C9 | Restrained edge highlights |
| Copper | #B76F48 | Bells, ribs, joints |
| Copper shadow | #704337 | Shaded metal |
| Turquoise | #62C9BC | Active wind, seed lantern cores |
| Hero coral | #D96956 | Coat and scarf |
| Hero warm dark | #593F46 | Hair, boots, belt |
| Timber | #977557 | Walkway inlays, brackets |
| Sky haze | #B7D7CF | Distant background |

Wind states use shape, rhythm and audio as well as color. Calm inactive scenery must not compete with active targets. Avoid heavy black outlines, grain, random neon emissive parts and flat saturated grass sheets.

## Camera and composition

Fixed yaw approximately 38 degrees and elevation 42 degrees as a starting composition; gentle perspective 36-degree vertical FOV. Camera follows within authored limits without manual rotation. Tune framing to actual phone and desktop captures; these starting values are not evidence of success. Hero ideally 9–13% of screen height; keep source, target and route readable with restrained focus shifts. Fade obstructing foliage rather than letting it hide the player. Three layers: foreground leaves, traversable terrace, atmospheric branches and windworks.

Main composition: tree anchors upper-left; ivory path curves across middle; copper wheel right of centre; distant windworks through a gap. Leave clean value space behind hero. Default light: warm upper-left key, blue-green soft shadow, pale sky fill. Character two/three bands, environmental transitions softer. Bloom only if it improves restrained magic highlights. No outline around every leaf.

## Scale and geometry

Metres; hero 1.35m tall, head approximately 0.34m, expressive hands; staff 1.25m; handheld bell 0.20m; seed wheel 1.8m diameter; walkway clear width 2.4m minimum; guardrail 0.75m; terrace approximately 18x14m. Compact world with authored changes in height. Safe slopes/steps; no lethal fall test in the scene.

Assets: base y=0, centred x/z, front +Z. Exactly one default function(THREE) returning Group per asset; no imports/network/timers/files. Geometry from Three.js constructors/operations, no literal mesh arrays or downloaded models. Recipe material names: plaster, stone, timber, tile, metal, fabric, foliage, ground. Author MeshStandardMaterial, map to the shared runtime art treatment consistently. Use keepHierarchy for articulated objects, merge rigid parts per joint only.

## Apprentice direction

Original asymmetric coral work coat, short dark swept hair, rounded boots, cream collar and turquoise fastening. No pointed cap, green tunic, sword, shield or recognisable reference-game silhouette. Copper bell staff carried with a clear hand grip. Face readable through brow/eye direction and head tilt at gameplay scale; no promise of face detail invisible at that distance.

Shoulders/hips lead turns; feet plant at idle; stride speed matches travel. Walk contact, start, stop and turn transitions must be inspected in motion. Capture: slight lean, open free hand, bell draws an orbiting ribbon. Release: brief wind-up, staff follows target, crisp note and restrained follow-through. Staff never detaches from hand. Charged state visible while moving. Cloth and foliage share a coherent wind direction; no arbitrary global wobble.

## First reference and asset priorities

Pilot image should show the apprentice full-body in a small style board beside the terrace composition and three-quarter views of copper wheel/bell/seed lantern/tree kit. Inspect that this remains useful; do not claim tiny sheet objects are adequate references. Additional isolated references only when the sheet lacks required readable structure, within remaining budget. Prioritise hero, tree, terrace, wheel, bell, lantern and foliage kit; instance/reuse accepted assets.

Art lock is provisional until the pilot reference is inspected. Keep accepted reference files and candidate sheets in private evidence, not runtime payload. Record changes to this lock before dispatching later assets.
