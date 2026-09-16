# Independent rebuild visual review — round 1

16 September 2026. **FAIL against the rebuild's rich, expressive woodland target.** This is a materially different, explorable environment from the first platform study, but the observed frames still look like an early assembled 3D scene. No numeric quality score, art approval, or comparison-equivalence claim is warranted.

Build identity: repository HEAD was `60f9b41ca69fd24a1f3d99566898c135624810d7`, with substantial uncommitted rebuild changes. This report applies to the captured working-tree build, not that commit alone. `independent-visual-round1/input-sha256.txt` records the served core files and supplied frame hashes at review start. Changes subsequently made are not approved by this report.

## Evidence actually inspected

Read MASTER-BRIEF.md, rebuild-scope.md and rebuild-benchmarks.md. Inspected supplied arrival.png, runtime-cottage.png and runtime-roots.png; independently inspected actual private R01 hero and R02 woodland images. The Nintendo/D2R observations are the separate benchmark review's documented still-image observations, not an independently watched gameplay/video comparison here. No claim about original Diablo II motion or audio.

Opened the running local build in Chrome, clicked Step into the woods, inspected desktop at 1703×946 and portrait at 430×932. Used normal pointer drags on the phone joystick to approach the cottage, travel around its left side and approach its roof/wall silhouette. Own screenshots are in `independent-visual-round1/`: live-start, phone-start, phone-cottage-side, phone-cottage-occlusion. Reset viewport afterward. No teleports or game-state mutation. Pointer interaction with phone layout is not physical-phone testing. Input was observed in short intervals; no continuous motion recording, full route or listening performed. Thus no run/jump/landing/capture animation approval.

## Three highest-priority repairs

### 1. Keep the apprentice visible behind cottage and tree architecture

**Major — TEST-02, GAME-03, ART-03.** Supplied runtime-roots frame entirely hides the hero behind the cottage. Independently reproduced a severe phone obstruction: after approaching cottage, moving left around it and then right along its side, roof/wall cover head, torso and staff; only parts of boots and coat remain visible. See phone-cottage-occlusion.png. This interrupts control confidence exactly where the player should discover the side route. Tree-only fading is insufficient.

**Repair:** handle cottage roof/wall and nearby branches as occluders along the actual camera-to-hero line. Prefer a smooth controlled cutaway/fade or a constrained camera correction; preserve the building silhouette outside the occluded region. Avoid simply deleting obstacles or making the whole village transparent.

**Acceptance:** real-input travel cottage-front → both sides → roots and back at desktop and 430×932; head, torso/charge state and feet remain locatable continuously, no sudden camera jump and no foliage flicker. Preserve path collision and intentional discovery. Capture the previously failed roots view plus a short traversal clip.

### 2. Integrate terrain, vegetation and architecture instead of scattering detail on smooth ground

**Major — TEST-01/02, ART-02/03. This is the single largest visual gap to R02 and the benchmark criteria.** Arrival has broad, smooth green expanses dotted with near-identical flower groups. Dense cottage ferns turn into fine wire-like tangles rather than readable leafy masses. Large roots are sharp tapered wedges meeting the ground without moss/bank transition. Plaster, roof and bark have broad uniform surfaces; hard geometric facets and shadows carry most detail. R02's appeal comes from interlocking banks, worn stones, root contact, moss, constructed joints and overlapping forest depth, not object count. Benchmark notes similarly emphasize surface detail following construction and ground cover integrating props.

**Repair:** author two or three plant banks around roots/cottage/path bends using varied scale and coherent massing; reduce fern filament density and give leaves broad silhouettes. Add localized moss/soil/stone transitions at root feet, doorway steps and path wear. Give plaster, roof and bark restrained broad painted variation plus join/contact wear; copper needs a distinct highlight response. Preserve a quiet readable walking corridor rather than filling it with noise. Use existing assets/code and current textures first.

**Acceptance:** matched arrival, cottage and roots frames at both viewports show readable large/medium/small grouping, textured contact and distinct wood/plaster/copper/leaf responses. Foreground/path/background feel connected; no equally spaced flower scatter, fern wire mesh or uniform green sheet dominates a frame. Verify stability while camera moves; stronger saturation, bloom or extra scattered objects alone do not pass.

### 3. Translate R01's attitude into the gameplay silhouette and acting

**Major — TEST-02/04, ART-02, ANIM-01.** R01 has a purposeful bent-arm gesture, asymmetric weight, readable hands, broad cuffs, split long coat and substantial boots. Gameplay hero is improved in identity but commonly reads as a narrow upright figure with straight tubular lower legs, small hands, a broad white shoulder triangle and little visible attitude. Desktop face occupies too little area for its expression to carry the scene. Phone is roughly within the intended height range, so merely enlarging the whole character will not solve shape/acting. I do not infer animation failure from the stills: its quality remains unverified here.

**Repair:** focus geometry/pose on broad readable hands/cuffs/boots, coat asymmetry and head/shoulder direction. Use a confident weight shift and bent free elbow at idle; let head lead meaningful look/capture gestures. Preserve a clear actual hand-to-staff grip. Tune framing so these shapes are readable on desktop as well as phone. Record walk/run/start/stop/turn/jump/land/capture/release, then repair the weakest transition rather than polishing a static pose alone.

**Acceptance:** gameplay-camera three-quarter/front/side views clearly distinguish coat hem, hand, staff grip and boots. Normal-speed clips show purposeful rather than rigid posture, planted idle feet, energetic motion and controlled transitions without detached staff/sliding. Face/head gesture must be legible at real scale, not only a zoomed turntable. Independent motion review remains mandatory.

## Discovery and scope observations

Persistent destination arrows are absent in inspected arrival/cottage views; paths bend, cottage has recognizable human-made details and a small bird was visible in different positions. These create opportunities for discovery. They do not establish the intended 3–5 minute first-time rhythm. Existing runtime-result is explicitly a known-route script and reports a crossing blocker; it cannot prove natural discovery or satisfying payoff. Full route/bridge correctness belongs to gameplay review. Do not pad pacing through slower movement or more walking.

UI's opening instruction leaves room to investigate. The narration about fresh ribbons is not strongly supported by visible readable ribbons on the cottage frame; resolve small story-detail mismatches while dressing that location. Audio, localized ambient rhythms and restoration spectacle remain unverified by this review.

The supplied frames and own route support continued focused repair, not a high-bar pass. The first two repairs can be made without additional Atlas generation; the existing R01/R02 already communicate the missing shape and composition decisions.
