# Isolated material comparison — c07c4d5

Decision: retain current production treatment. A and B are regressions; hybrid C is an interesting but insufficient improvement. No production files changed. No spending. No lighting-number change recommended.

## Method and evidence

Copied the stable c07c4d5 docs build into `base`, served isolated variants on port 4188. Each normal keyboard route visits arrival, porch note, chimes, quiet and responsive garden beds, restores the wheel, crosses the bridge and completes at overlook. Read-only gameplay telemetry; no teleport or state mutation. Every screenshot waits 1.2 seconds after movement/action before capture so camera/occlusion settle. Same waypoint targets and camera configuration, but normal movement has sub-half-metre endpoint variation and independent animation/bird/wind phase. Thus these are matched gameplay views, not pixel-registered photographs. Full-resolution frames and runtime-result.json are in base/, A/, B/, C/. Four comparison sheets use base/A/B/C order. No performance conclusion from concurrent desktop headless runs. No physical-phone or new audio inspection in this bounded task.

All four final routes completed successfully. Page/console errors (including shader compile errors): 0. HTTP errors: 0. Hero, cream route, cottage note/pegs, garden interactions and vista remain readable. Baseline tree fade behaviour is common to every copied build; separate lead camera repair is not included.

## Treatments actually rendered

A: light bands driven by direct diffuse illumination, soft blue-green shade and warm cream sunlight; broader low-amplitude pigment; original authored wood colour mixed 22% toward warm timber; lower-contrast bark contribution. Reject: porch and chime trunks become dark flat brown planes, losing visible grain and volume. Cooler cottage plaster is slightly useful but does not compensate.

B: A with stronger cel blend, deeper teal shadow and warmer sunlight. Reject: whole leafy shadow islands become darker and larger in perceptual weight. Brown trunk planes flatten further. Still readable, but too much uniform contrast rather than painted material richness.

C: A's moderate direct-light bands and broad pigment, with production wood colour and bark texture completely restored. Best experiment, but not selected. Grain remains visible; cream path and copper roof keep their separation, shaded plaster becomes subtly cooler. At chimes the shadow beneath foliage feels slightly deeper. Arrival and vista are otherwise extremely similar to baseline. It does not solve the repeated plain trunk forms, uniform polygonal foliage values, or broad empty grass material. The gain is not clear enough across all four views to justify replacing a verified baseline.

## Benchmark interpretation

Re-inspected original Atlas woodland-r02.png. Its material richness follows curved tree growth, moss boundaries, architecture joins, stone edges and local contact. Light/shadow value grouping supports those authored forms. A universal colour-band change cannot manufacture that organization. The prior actually inspected Nintendo official Wind Waker HD gallery stills (documented in repository evidence/references/rebuild-benchmarks.md) use broad clean colour areas around the hero and overlapping background forms, not heavy texture noise. This trial deliberately avoided adding noise, outlines, bloom or geometry.

Remaining major difference from R02: broad trunks need intentional local paint regions and contact/edge variation corresponding to their shape; our bark's colour variation is surface grain, not structural art direction. Foliage requires more coherent lit crown vs shaded interior organization. A further material iteration should target those individually with exact-view checks, not darken the whole scene or buy another panoramic image. These experiments do not approve Zelda-quality art, animation, discovery duration or device performance.

## Reproducibility

`server.py`, `capture.mjs`, A.js, B.js, C.js and the immutable base snapshot are included. Production diff was not applied. `C-proposal.patch` records the unselected hybrid for review only.

## Saved repository evidence

Comparison sheets, shader proposals and final run summaries are copied alongside this report. served-sha256.json records exact served main/world/tree/baseline-art and variant module bytes. Full-resolution individual frames and the copied build remain at /tmp/bellkeeper-material-study. Every proposal is explicitly unselected; production retains its existing art-direction.js.
