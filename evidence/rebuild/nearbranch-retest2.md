# Independent earlier-fade retest

Candidate `ad77449`, same normal-input roots approach/arc/retreat driver as the prior retest. Evidence and loaded file hashes: `nearbranch-retest2/`. Desktop and portrait layout runs completed without page errors. No runtime edits or state writes.

## Result: initial approach improved; transition still fails

Compared both 3Hz contact sheets against `nearbranch-retest/`: the former large desktop approach intrusion at approximately 1–2 seconds and phone upper-right wedge around 0.67–1 second are absent. Roots endpoints retain forward depth and the farther forest. Phone sampled retreat also avoids the former low brown wedge. This is a concrete improvement rather than removal of every surrounding tree.

Desktop retreat nevertheless produces a short severe brown flash that covers almost the entire view, including the hero. `desktop-retreat-sample16.png` preserves it at full resolution. Frame inspection refines the coarse contact-sheet timestamp: source PTS 5.416 is clear, opaque intrusion appears at 5.433 and persists through 5.466, then fades through approximately 5.550, with the view clear again at 5.566. The 3Hz sample's nominal time of 5.333 is not its exact selected source-frame time. Exact requested images at 5.0, 5.167, 5.333 and 5.5 seconds are also retained; the first three miss this brief event.

The event occurs during the arc-east-to-retreat movement, between recorded endpoints approximately `[-8.94,4.10]` and `[-6.28,6.97]`. Existing telemetry logs endpoints, not exact frame-correlated positions. The observed appearance is abrupt before the fade, so this cannot be called a clean transition or harmless edge framing. Root cause is not established by these images.

Acceptance remains: normal approach and retreat should not produce a nearly full-screen opaque geometry flash. Preserve farther forest and the repaired roots endpoint. Diagnose this event rather than simply asserting the larger ray distance resolves all approach directions.

Recordings encode 60fps at normal speed. Initial comparison used 3Hz samples; the brief failure interval was additionally inspected using source-frame timing and full-resolution extraction. This does not certify every frame elsewhere, physical phone behavior, heard audio, or broad artistic completion. Garden route completed, but no new gameplay approval is implied.
