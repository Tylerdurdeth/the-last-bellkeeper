# 20 September first-scene refinement

Scope: arrows-only keyboard locomotion, A jump, camera-aligned premium field chart, visible terrain limits, bridge-only sanctuary access, distinct instruments and woodland life. This is a refinement of the existing first area, not completion of the full adventure.

## Direction

The chart uses forest ink, parchment and aged copper, matching the world’s tools. Camera-forward projects toward the chart’s top at every camera yaw. Its arrow indicates character facing, not compass north. North rotates separately. The bridge line uses the actual bridge endpoints; locked/open states are explicit. Phone users can enlarge the chart for its legend.

The sanctuary sits on isolated land surrounded by visible water and rock banks. Ground support and rendered terrain share geometry data. The raised bridge deck supports feet by raycasting its actual triangles; no progression-dependent invisible wall gates the bell. Outer limits use a visible cliff ridge. Decoration must not become a channel stepping stone.

Research: the official GDC session [Invisible Intuition: Blockmesh and Lighting Tips to Guide Players and Set the Mood](https://www.gdcvault.com/play/1025360/Level-) describes guiding players through blockmesh, environment art, lighting, effects and sound. Our design inference is to make the route legible in the environment: broad quiet walking surfaces, strong bank silhouettes, clustered thorn/rock edges, a visible destination and a single physical crossing. This is an application of those principles, not a claim to have copied or measured a specific commercial level.

## Asset provenance

Two original Atlas 1K reference sheets were generated on 20 September using the configured Gemini 3.1 Flash Lite Image node, seed 43. R08 depicts a bronze gong on antler-like posts, root-hung ceramic seed bells, ivory/copper wind harp with teal pennant, and a bronze sanctuary bell in a rooted stone crown. R09 depicts thorn bramble, broad-leaf hosta, shelf-fungus stump, rabbit, kingfisher and luna moth. Settled cost: 4 credits each, 8 total, from a user-approved maximum of 400; no outstanding reservation. Fresh billing confirmed the 8-credit balance change.

Atlas images are references, not imported meshes. Original import-free Three.js asset code was authored in three candidate variants per type, run through the unmodified recipe verifier, and selected by viewing its actual multi-angle render sheets. The selected harp received an attached mast after a floating pennant was noticed; its final 1,172-triangle version was reverified. Game rendering applies the existing shared painterly material treatment. No new third-party animal/instrument meshes or new paid audio files are used.

Selection sheets and reports are retained with this evidence. Audio cues are original procedural synthesis with different partials/phrasing for gong, ceramic bells and harp. Human listening approval is not implied by code tests.
