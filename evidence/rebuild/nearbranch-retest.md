# Independent near-camera branch retest

Candidate `14d3f76642bc10199690b0ad70cf1e0096ef080e`, local served build. File hashes, route telemetry, endpoint PNGs, 60fps encoded recordings and 3Hz sampled contact sheets are in `nearbranch-retest/`. Input was normal keyboard steering in desktop and portrait phone layouts, with start clicked/tapped and read-only telemetry. No state writes, no full quest repetition. No page errors were recorded.

## Result: endpoint repaired; transition limitation remains

Compared `story-garden-desktop/runtime-roots.png` directly with the new `runtime-desktop-roots.png`: the former broad opaque upper-right slab is absent at the matched roots waypoint. The forward path, shrubs and standing trees are visible. The view has not lost the whole forest. Phone roots/arc samples also keep the hero locatable and surrounding forest present.

However, do not describe the entire approach as free of near-branch intrusion. The desktop recording's approximately 1.0–2.0 second samples show a large opaque foreground trunk/branch crossing the right half before it fades. Phone samples around 0.67–1.0 seconds have an upper-right brown wedge; around 5.33 seconds on retreat a nearer brown wedge crosses the lower edge beneath the hero. The severe stationary roots slab is repaired, but the approach threshold still allows conspicuously oversized near geometry before clearance. The sampled sequence shows disappearance between samples; it cannot establish whether this is a one-frame pop or a short fade.

Concrete remaining hypothesis: begin near-camera clearance early enough that the intruding tree fades before occupying a large fraction of the view during approach, and retain it long enough through retreat to avoid re-entry. Verify the same cottage-to-roots route and return, preserving the farther trees. This is a composition/timing limitation, not a reproduced complete hero occlusion or whole-forest disappearance.

## Garden neighbor

The portrait responsive-bed endpoint retains visible boots/lower legs, the flower border, white current loops, and the capture action. The prior garden-pocket clearance repair remains intact. A sheltered-pocket caption can linger briefly while standing in the responsive bed during this brisk route, while the contextual button correctly offers capture; the still should not be presented as proof of a reversed mechanic.

## Limits

Recordings were generated at normal game speed and encoded at 60fps; visual judgments above come from endpoint images and 3Hz sampled contact sheets, not inspection of every encoded frame or a human real-time playback. No physical iPhone, new-player discovery, audio listening, root collision sweep, or overall illustrative-quality approval is implied.
