# Raised painted brook — actual camera inspection

Changed only new game/brook.js and existing water plane y in game/assets/terrain.js. Plane local4.25→7.4 (world-3.75→-.6); no terrain vertex/height/bank edit. Single StandardMaterial draw preserves fog, lighting, shadows and renderer colour/tone pipeline. Quiet broad turquoise/cyan flow, interrupted pale strokes and broken bank foam; no imported media, spending, geometry additions or post-processing.

Unmodified recipe verifier PASS, 45,062 triangles,7meshes,120×12.35×120 bounds,groundOffset0. Multi-view sheet visually inspected at _verify/sheet.png. This test covers recipe geometry, not animated shader.

Integrated runtime: desktop1440×900 and phone-emulated430×932. Actual keyboard routes with read-only game telemetry and no state injection; start selected by touch in phone mode. Known-route regression, not blind discovery or physical-phone performance. Both completed source, wheel restoration and crossing to final vista; zero page/console (including shader) errors and zero failed HTTP requests. See desktop/runtime-result.json and phone/runtime-result.json.

Inspected actual restoration and bridge frames in both viewports. Cyan surface is now visible beneath crossing; flow marks and bridge shadow visually distinguish it from surrounding grass. Hero/deck/ropes are readable. Phone activation view crops the bridge to the right; on-bridge view clearly shows water and rails. Still images establish appearance, not flow cadence; animated time uniform implementation is not a claim of motion-quality review.

Remaining limitation: straight rectangular brook cut and vertical green grass bank remain conspicuously engineered. Shader does not repair that bank geometry. Bright quiet cel water is a useful correction to an invisible deep trench, not approval of the full reference-art bar. No further shader change proposed after observed frames.
