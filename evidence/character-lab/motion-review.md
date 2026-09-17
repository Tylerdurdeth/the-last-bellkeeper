# Animation polish — 17 September 2026

Baseline 3a4a3a5. Approved character geometry, textures, and original CC0 clips remain unchanged. No Atlas generation or spending.

Changes: phase-preserving gait transitions; normalized interruptible action blending; studio-specific acceleration, braking and turn response; damped acceleration pitch, turn banking/head lead and scarf follow-through. Isolated Start & stop preview added. Jump poses follow takeoff and flight, with authored extra flight height suppressed during physical jumps. Landing now includes compression and recovery instead of truncating after 0.22 seconds; 22% idle pose blend restrains the deepest crouch. Placed world transform before retargeting and sole correction. Grounded landing keeps sole correction at floor height.

Two-joint boot deformation keeps soles attached to feet and shafts/cuffs following shins during deep bends. Rest appearance is unchanged. Woodland movement defaults are preserved; new motor tuning is supplied only by the studio.

Validation passed: normalized weights, phase continuity, interrupted blends, landing completion/replay; boot rest shape, cuff/shin attachment, unchanged soles and non-accumulating deformation; existing movement regressions; studio source/mode switching, freeze/step, keyboard and emulated touch; real-input acceleration, turns, braking, repeated jump/landing/recovery and transition preview. Browser tests reported no errors. Repeated-jump and turn/brake observations are saved in motion-pass/report.json.

Independent reviewer found no blocking code issue and coherent attachment/poses in sampled stills. It flagged changed original-baseline preview speeds, which were corrected. This review does not constitute a human real-time animation quality verdict or BOTW parity. Full foot planting through every transition remains a future refinement, not a claimed solved problem.

A local normal-speed 11.4-second WebM captures start/stop, turning and repeated jump/landing. It is retained outside the shipping payload. Implementer inspected sampled poses; no claim is made that stills establish temporal smoothness. Performance sample on desktop headless Chrome with a phone viewport: 120 measured frames, median16.7ms and p95 16.8ms. This is not physical iPhone performance evidence.
