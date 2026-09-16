# Movement rebuild — 16 September 2026

User explicitly requested energetic running and jumping for the rebuilt first area; this supersedes the old no-jump study scope. This module does not change scene geometry or animation assets and spends no Atlas credits.

## Integration

`game/movement.js` exports `createMovement(THREE, options)` with the agreed position/velocity/yaw/speed/grounded/mode/verticalVelocity getters and update/reset/jump/dispose methods. Position is the character's foot point. Terrain callback returns a finite height or null for gaps. The collision callback must account for the supplied 0.23m character radius. The terrain's safe routes must fit the 0.28m step limit; higher ledges block walking but may be jumped onto.

Call `update(dt, {enabled: started && !paused, actionSlow: actionPlaying})` every frame; copy position and yaw into the visual hero. Walk is 2.2m/s, Shift run 4.5m/s. Touch deflection maps to 0–4.5m/s with a dead zone; optional Run button toggles running for keyboard use. J jumps. Space remains available to the lead's contextual action handler. Optional `jumpKey` permits a deliberate remap. UI must label J and provide a touch jump button. Joystick should have CSS `touch-action: none`.

Animation uses mode idle/walk/run/jump/fall, actual horizontal speed, grounded state and verticalVelocity. Acceleration and braking are responsive, turning follows player intent, and air control is deliberately weaker. Gravity is 19m/s², launch velocity 6.1m/s, jump apex approximately 0.98m, airtime approximately 0.64s on equal ground. Coyote time is 0.11s and jump buffer is 0.14s. Action slowing delays buffered jumps while an action owns the body.

Simulation substeps at at most 1/120s, caps incoming dt to 0.05s, follows gradual slopes, slides along collisions, and recovers from a fall to the most recent interior grounded point. Recovery clears input and prevents a teleport from being reported as running speed. Pause, reset, blur, hidden document and disposal clear input; pointer cancellation releases only the owning pointer. Paused update freezes physics.

## Validation actually run

`/Users/seb/.local/bin/node tools/test-movement.mjs` passed. Tests use the real Three Vector3 and native EventTarget input dispatch. They check screen-relative walk/run, braking, Space isolation, J jump, airborne arc/landing, jump buffering, pause/reset, wall sliding, high-ledge rejection, a one-metre gap crossing, coyote jumping, safe fall recovery, 30/60/120Hz displacement agreement under 1.5cm, blur/disposal, pointer ownership/cancellation, paused capture release, and slope following.

These are controller tests, supporting TEST03/04 locomotion/input behavior. They do not constitute an actual browser input pass, collision-map audit, iPhone playtest, animation quality review, or certification that the final environment's jumps/routes are traversable. The lead must inspect running, braking, turning, takeoff and landing with the final character at gameplay camera distance. The cylinder/heightfield collision design does not support ceilings, overhangs or stacked traversable surfaces at the same x/z.
