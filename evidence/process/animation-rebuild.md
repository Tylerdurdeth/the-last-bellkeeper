# Original procedural animation rebuild — 16 September 2026

`game/animation.js` exports the requested `createAnimator(THREE, hero, movement)` interface. The lead continues to own world position and yaw; only declared local joints are animated. Staff remains beneath the existing grip. Bind position, quaternion and scale are restored before each sample and by `reset()`, avoiding additive drift. Limb lengths come from the actual lower-leg and foot pivot offsets and ancestor scale, including loader wrappers.

## Acting implemented

- Travel-distance gait phase, a longer walk stance and shorter running stance, knee/ankle articulation with an approximate planar two-link solve, a larger run recovery lift, elbow bend and forward body intent.
- Smoothed start/stop lean and angular turn response through hips/head; free arm swings more freely than the controlled tool arm. Carrying brings the tool closer to the body.
- Takeoff accent, airborne knee tuck, slightly asymmetric legs, coat follow-through and a 0.16-second landing recoil that never disables controller movement.
- Subtle idle breath and occasional slow attentive head orientation, without making all limbs wobble.
- Capture has torso commitment, gaze, free-hand reach and bell lift. Release separates wind-up, fast extension and recovery. Impact is a short backward torso response with a balancing arm.

Animation expects `actionProgress` normalized over the chosen action duration. Suggested first tuning: capture 0.65s, release 0.55s; judge against actual wind arrival/contact, not arbitrary timer completion. Pass deterministic gameplay `time` (paused time stops). Call animator reset when resetting the scene. Pose changes are not a reason to prevent running/jumping while carrying.

## Actual checks and limitations

`/Users/seb/.local/bin/node tools/test-animation.mjs` PASS using the existing articulated asset. Checks covered finite world matrices through idle/run/180-degree-turn/jump/landing/capture/release/impact, visible numerical leg swing and jump tuck, unchanged root transforms and joint scales, grip attachment, exact bind restoration and safe omission of optional joints.

No animation footage was viewed in this bounded implementation. Neither Zelda-like charisma nor correct final foot placement is certified. The gait approximates local stance with planar IK; it does **not** lock a world-space planted foot during sharp turns, does not independently sample ground under both feet, and can slide on slopes or extreme proportions. Launch compression is an immediate visual accent because the responsive physics jump already launches; it is not a delayed anticipation phase. The first integrated motion review should prioritize stance sliding, knees in the final rig, sudden 180-degree turns, staff clearance and landing height. Tune those against the actual 1.6m character/camera, then record uncut clips. Do not use these numerical tests as animation/art approval.
