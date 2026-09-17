# Outfit pass — 17 September 2026

Baseline 3ba2157. The user approved the head/hair and asked to move on. Work proceeded on body/outfit in the minimal studio, using the existing Atlas R06 concept. No additional Atlas generation or spending.

The selected A character now has shaped tunic/sleeve/trouser sections, rolled sleeve cuffs, leather wrist guards, boot shafts with soles/stitching/laces, a framed belt buckle, a smaller pouch, a shallower scarf and a continuous rear tunic hem. The accepted head/hair source was checked byte-for-byte against baseline and remains unchanged. CC0 motion clips, playback and woodland are unchanged.

A separate body template now allows outfit changes without modifying the approved head or woodland hero. `tools/build-head-studies.py` inserts the approved head template into the selected body template. B/C remain comparison studies.

Independent still-image review found trouser material protruding down boot shafts and incomplete rear tunic coverage. Both were repaired and independently confirmed resolved in the final side/back views. An inner leather ankle tongue bridges foot flexion; this small addition was checked by the implementer. A longer front hem experiment was rejected for thigh intersection and is not shipped.

Local studio regression passed movement/source selections, freeze/frame step, keyboard and emulated touch, successful facial-map loading, no console/page errors or failed assets, and no downloaded mesh requests. Recipe geometry verifier: 1/1 clean, 58,604 triangles and 148 meshes. Full body stills and walk/run pose sequences were inspected; this is not independent real-time animation approval or physical iPhone performance verification.

The build containing this report is the outfit release. The user's character head approval does not imply acceptance of this new outfit or of overall game quality.
