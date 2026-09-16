# Target-facing repair observation

The specific back-to-chime acting defect is corrected in this normal-input reproduction. Frame 017 starts with the hero facing away, inside interaction range. After Space, frame 018 visibly turns the body; frame 019 presents the face and committed gesture toward the chime; frames 020 onward preserve that orientation after the interaction succeeds. The previous round3 gesture stayed facing the flowers throughout. This is now visibly an action about the object.

Test used the same keyboard route and back-to-chime setup as round3, with no runtime state writes. Exact served hashes and telemetry are in result.json. Before action: [-9.8630, -15.1428], context chime, awakened false. After: same position, awakened true. No page errors. Nearby chime geometry partially masks the lower torso in this camera composition, but head, shoulders and staff make the corrected direction observable.

The shared yaw repair also passes meaningful controller tests: smooth initial 180-degree turn; short path across ±pi; retained yaw at rest after completion; translational control during targeting; resumed normal facing with subsequent movement input; and equal turn integration at 30/60/120 Hz. Existing movement, jump, gap, slope and recovery checks continue to pass. Main now maps capture to the actual garden source rather than the chime.

This is a narrow observed correction, **not full animation polish approval**. The reviewer authored both the original animator and this yaw repair. Sparse screenshot sampling is insufficient to certify weight, microtiming, foot planting or human charisma at the user’s benchmark. The ground material also changed between rounds; this review compares character direction, not palette, and makes no performance claim.
