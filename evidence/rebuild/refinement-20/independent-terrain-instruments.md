# Independent terrain / instruments repair verification

Verified 20 September 2026, 07:31 BST. **All three reported defects are fixed.** No game source was changed during this review.

| Repair | Independent check | Result |
| --- | --- | --- |
| Bridge landing | Loaded the actual world and raycast the restored deck at 21 landing points: x=7/8/9, z=-7.8/-7.7/-7.6/-7.4/0.8/1/1.1. | Planks stand 0.027833–0.040000 m above terrain; `world.ground()` matches the visible deck within 1e-8 m. Fresh bridge/sanctuary images no longer show the fragmented coplanar landing. |
| Bell interaction | Confirmed `POINTS.overlook=[8,-11.3]` equals the instantiated bell position, and the actual main.js condition uses radius 1.65. | Former trigger point `(8,1.2,-7.81)` is 3.49 m away and excluded. `(8,1.2,-9.7)` is 1.60 m away, supported and unblocked. Exactly one sanctuary bell instance remains. |
| Rehearsal message | Instantiated discoveries and played the full sequence after separate resets with omitted state, `awakened:false`, and `awakened:true`. Confirmed main passes state to `interact`. | All sequences succeed and preserve `echoSolved`. Omitted/false state says “The instruments remember the song. Wake the root chime to release its wind.” Only true state claims the current is freed. |

## Regression and visual evidence

`node tools/test-island-navigation.mjs` passed: minimum polygon channel 8.000 m, island disconnected before restoration, 264 actual-input jump-bypass attempts, conservative elevated jump range 5.23 m, 109 rising-deck support samples, traversal both directions at 30/60/120 Hz, and reset isolation. No regression to invisible bridge support or an alternate island entry was detected.

Fresh render command:

```sh
node tools/test-island-render.mjs evidence/rebuild/refinement-20/independent-terrain-runtime
```

It passed with no browser errors. Isolated terrain remains 2 calls / 16,245 triangles; bridge 4 calls / 3,000 triangles. Inspected the actual [bridge](./independent-terrain-runtime/bridge.png), [sanctuary](./independent-terrain-runtime/sanctuary.png), [restored island](./independent-terrain-runtime/island-after.png), and [ridge](./independent-terrain-runtime/ridge.png) images. The raised landing reads continuously, the large bell is unique and clearly presented, and the perimeter remains visibly represented by rock cliffs. [Machine render results](./independent-terrain-runtime/result.json).

Fresh images/results were written **07:31:44–45 BST**, after the reviewed world/layout/main repairs at **07:30:53** and discoveries repair at **07:31:11**. Older `island-terrain/runtime` (07:18) and `organic-runtime` (07:25) images were not used to approve the fixes.

## Remaining / limits

No remaining actionable defect found within these three repairs. The render harness exercises the world, not the full gameplay HUD; finish eligibility was independently checked against its actual source and world geometry, and instrument text via the real discoveries module. A complete new keyboard-driven story run and audio listening review were not performed. Map/life were outside this review. Only this report and generated verification images/results were added.
