# Rebuild input and route regression — 16 September 2026

PASS for the tested local build served at `http://127.0.0.1:4173/the-last-bellkeeper/`. Final run 16:29:58–16:30:48 UTC, desktop 1440×900 plus Chromium phone emulation 430×932. No physical phone test and no audio listening pass claimed.

`tools/test-rebuild.mjs` sends actual keyboard events, browser button clicks, CDP touchscreen contacts and touch taps. It only reads `window.__GAME__`; it never sets gameplay state, teleports, invokes private completion methods or edits storage. It waits for the actual enabled start button because this rebuild did not expose the former readiness flag.

## Observed results

- Walk 2.19m/s, Shift run 4.49m/s. J became airborne and landed. Paused movement stayed fixed. Restart restored initial world state and position.
- Followed known world-coordinate waypoints on the winding path, rang chimes, captured current, returned to wheel, restored bridge, crossed the actual deck, and activated the overlook finish. Final score 1. Travel 115.5m; scripted route duration 35.5 seconds including brief interaction waits.
- Walked into the un-restored crossing after restart, observed a genuine fall, then automatic recovery to a grounded safe bank point at approximately [8.01, -0.96], y1.2. Input cleared on recovery.
- Phone-emulated joystick drag travelled 2.59m and reached 4.50m/s. Releasing touch braked to 0.035m/s. Touch Jump became airborne; touch Pause and Restart worked.
- No page errors and no HTTP failures recorded. Selected telemetry was around 60FPS, but this is not a dedicated performance benchmark. Final renderer peak sampling and official deployment gate belong to the lead.

First attempt reached restoration but the scripted next waypoint crossed the wheel collision cylinder and stopped. Added a waypoint around the physical wheel, then the full route passed. This was a test-path correction, not a runtime collision fix. The first attempt report is preserved in `runtime-result-attempt1.json`.

## Limits and issues for the lead

This is an omniscient scripted regression: 35.5 seconds does not measure first-time discovery. It does show the area is now longer than the two-second study; it does not establish the proposed 3–5-minute experience. There was no forced jump on the traversed main route, no optional keepsake collection tested, and no phone-emulated full completion in this run. Touch movement/actions were tested separately; desktop completed the full quest.

The actual capture screenshot exposes a sharp, empty terrain boundary/horizon. The overlook screenshot shows foliage and ordinary trees rather than a distinct composed vista/payoff. These are world-composition observations, not an independent review of this agent's own animation or geometry. Screenshots do not approve animation quality. Sound was not listened to.

Files: `runtime-result.json` exact observations; `runtime-*.png` arrival, cottage, roots, chimes, capture, restoration, bridge, overlook, recovery and phone views. Lead was notified of successful tests and remaining composition/readiness concerns. No runtime files were edited by this testing task.
