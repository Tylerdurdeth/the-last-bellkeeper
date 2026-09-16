# Environment candidate comparison — 16 September 2026

Reference actually inspected: `setup-evidence/rebuild-atlas/woodland-r02.png` (new Atlas composition). Target translated into curved copper construction, deep window/door layers, practical porch objects, sheltering trunk/roots, leaf-shaped crowns, pinnate ferns, rope/timber crossing, copper wind chimes and small living wildlife. Every module is an original default function returning a Three group, with named recipe materials and constructor/shape/spline geometry. No imported mesh assets, literal mesh buffers, Atlas calls or external files inside the asset functions.

## Distinct construction choices and selection

| Object | A | B | C | Selection and observed reason |
|---|---|---|---|---|
| Cottage | Asymmetric extruded curved roof profile; solid sculpted gable and inset arched timber door | Actual framed infill walls; individual copper roof ribs; porch canopy with braces | Octagonal tower walls; lathed copper petal roof and radial ribs | **A**: clearest reference-like bell roof and door silhouette. Side and rear have windows/timber trim. B corrugated roof looks manufactured; C reads gazebo/tower. |
| Tree | One swept crooked trunk with many helical boughs and tubular roots | Three fused warped lathe buttresses, angular branch elbows and wedge roots | Long asymmetrical sheltering boughs with a leaning swept trunk and arched root spreads | **C**: widest useful sheltering profile for layered path composition. A branches are too evenly distributed; B buttresses angular and regular. All crowns use overlapping curved leaf shapes, no sphere canopies. |
| Fern | Individually paired curved leaflet blades arranged along arching stems | Continuous serrated frond extrusions and curled fiddleheads | Actual spline stems supporting separate sculpted extruded pinnules | **A**: best fine divided silhouette per triangle. B too coarse/toothed; C delicate but more expensive and overly skeletal in profile. |
| Rock | Three overlapping warped icosahedral stones with surface moss | Independent irregular extruded stone strata | Single distorted lathed boulder with moss seam | **A**: most convincing irregular natural rock cluster. B reads a stack of tiles; C is useful boulder shape but too smooth. |
| Bridge | Sagging rope suspension and individually skewed planks | Arched under-beams, bowed deck, dense vertical rope hangers | Three flat modular timber sections joined with double lashings | **A**: believable relaxed suspended path, least rigid. B arch is useful elsewhere; C a utility walkway. |
| Chimes | Lathed copper umbrella crown with six hollow tubes and turquoise sail | Open crown ring with radial suspension wires and five tubes | Bent wooden yoke with five inline tapered tubes | **A**: closest copper source reference, strong crown/tube contrast, visible central clapper. B is simpler but less distinctive. C nearly disappears from the side. |
| Bird | Soft ellipsoid sparrow with continuous folded wing blades | Faceted sculpted torso plus overlapping individual wing feathers | Lathed tilted breast and extruded angular wings/tail | **B**: clearest sparrow side/front form; individual feathers remain available when wings articulate. C looks more mechanical. |
| Flower | Open five-petal coral/turquoise cups and curved leafy stems | Upright plump closed seedpods with sepals | Hanging lathed bell blossoms and curved stems | **A**: best flower read and richest fine silhouette. B resembles upright beads; C suitable as a secondary hanging blossom. |

Selected files are `a/cottage.js`, `c/tree.js`, `a/fern.js`, `a/rock.js`, `a/bridge.js`, `a/chimes.js`, `b/bird.js`, `a/flower.js`. These are recommendations for integration, not an assertion the entire scene reaches the artistic exit bar.

## Actual visual inspection and corrections

Inspected all eight candidate sheets, each with front, three-quarter, side and rear views for A/B/C (96 views). The initial inspection caught fern B's inconsistent Euler rotation, bird beak floating clear of the head, open tube ends on major tree roots, overly narrow/sparse tree leaves, and floating rock moss. Corrected those, rerendered and inspected changed four-view sheets. A later moss projection briefly lifted C's entire seam as a rigid object; excluded the pre-shaped seam from projection and rerendered. Original broad shapes and meshes remain independent construction strategies; changes were defect repairs rather than parameter-only variants.

Final standalone modules have y=0 base and bounding-box-centered x/z, via child transforms rather than a root translation that world placement would erase. Tree height 14m; fern maximum horizontal spread 1.4m; rock 1.5m; bridge length 5m along Z; bird length 0.25m. Cottage A is approximately 5.08m wide/6.02m high, flower A 0.53m wide/0.49m high, chimes A 0.80m wide. Exact bounds/triangle counts are in `audit.json`.

Selected triangle counts: cottage 3,824; tree 14,182; fern 1,224; rock 288; bridge 2,736; chimes 1,804; bird 570; flower 816. Every candidate is below the requested tree 30k / other 15k limits. All geometry has been imported and rendered in Three.js without page errors.

## Integration notes / remaining artistic risks

- **Merge static trees/ferns/flowers by material before placing many copies.** Tree C intentionally contains over 2,000 small source meshes; do not render that hierarchy unmerged. Standard static `ASSET` / `bakeStatic` achieves the required batching. A low triangle count alone does not prove good runtime performance.
- Bird needs `keepHierarchy`. Named `leftWing`, `rightWing`, `body` are exposed via userData. Animate wing Z in opposite directions, body X for attentive tilt, and root hop/departure. The legs stay anchored beneath the body tilt pivot; no canned global wobble.
- Bridge foot surface is slightly sagged; collision/sampleGround must agree with the accepted deck or tolerate the small difference. Rope sides are visual, not automatic collision.
- Material look here is simple studio Standard shading, not the lead's painterly treatment. Bark remains visually clean; tree foliage still angular. Architectural detail and layered silhouettes are improved, but no claim of Zelda-level finish is made. Judge the actual composed views after ground dressing, painted breakup, lighting and life behaviors.
- A single large tree does not create woodland depth. Use separate near branches/middle trunks/distant crowns and deliberate negative spaces, never evenly spaced decoration around an empty floor.
- Modules are the final deliverable. `generate.py` and `refine.py` record the initial construction process, not a one-command reproduction of all subsequent final fixes; `render.mjs` audits/renders the final modules as saved.
