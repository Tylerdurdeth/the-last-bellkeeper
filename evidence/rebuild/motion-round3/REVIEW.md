# Motion review: target intent

Current served build was observed with real keyboard input at 1280×800. Exact main, animation, hero and staff hashes are in result.json. No state writes, teleport, spending, or performance testing. The reviewer authored the original animator, so this is a fresh observed assessment, not author-independent approval.

The strongest remaining acting defect is **performing the interaction away from its subject**. After approaching the chime normally, walking a little past it, and stopping inside its valid radius, Space triggers the same forward gesture without turning. Frame 017 shows the chime behind the hero. Frames 018–019 show the staff and arms acting toward the flowers ahead. By frame 020 the chime has awakened while the hero still presents their back to it. This reads as a generic button animation, not someone intentionally ringing an object. Prior motion-round2 improvements to grip and run posture do not address it.

Before action: position [-10.1184, -15.3576], context chime, awakened false. After action: same position, awakened true. No page errors. The code agrees with the observed problem: render yaw follows movement yaw, but interaction initiation supplies no facing target.

Recommended bounded repair: turn the shared movement yaw toward the actual interaction target during anticipation. Keep translation under player control and preserve the resulting yaw when the action ends. Map capture to the source, release to the wheel, and ringing to the chime. This corrects visible intention without inventing additional gestures.

Run-left frames 003–009 still show a readable bent-knee gait and bent free arm. Jump frame 011 shows a raised body and tucked leg. Those poses are more purposeful than the earlier baseline, but these sparse frames do not establish polished timing, weight transfer, foot planting, or charisma at the Zelda benchmark. Screenshot capture overhead yielded roughly 0.27–0.30 seconds between adjacent action frames, not 6 Hz video. The action-facing defect is clear across the entire sampled action; no broader animation polish approval is given.
