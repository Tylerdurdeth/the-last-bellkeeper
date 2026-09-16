# Independent visual rebuild review — round 3

16 September 2026. **Targeted vista, chime-cap and rock-visibility repairs demonstrate progress. Overall high-bar visual acceptance remains withheld: near canopy shapes still overwhelm a key interaction composition, especially on phone.** Three rounds do not make an unresolved issue pass.

Build: working tree above HEAD60f9b41, served hashes in `visual-round3/input-sha256.txt`. No runtime edits, spending or delegated agents. Fresh independent normal-input desktop1440×900 and phone430×932 route runs saved to `visual-round3/` and `visual-round3/phone/`, using copies of the current test driver. Both scripts report PASS, including arrival→chime→capture→return→restoration→crossing→finish. Full-route phone run uses keyboard steering in phone viewport; not a physical phone or fully touch-driven discovery run. Separate `visual-round3-rock.mjs` used actual emulated touch joystick/jump/action inputs to collect the rock keepsake and reported PASS. Read-only telemetry guided known routes; no teleport/state changes.

## Targeted results

| Repair | Verdict on observed evidence |
|---|---|
| Chime support/position and cleared pocket | **PASS for cap-over-hero defect:** desktop and phone runtime-chimes show the cap beside rather than across the apprentice. Head, legs and staff can be located. Neighbor crown framing still fails below. |
| Terrain edge and finish reveal | **PASS targeted improvement, not final-art approval:** runtime-overlook now shows foreground ledge/hero, modeled rock valley, waterfall lines and receding forest layers. The old obvious flat-sky/straight-map-edge view is absent from inspected chime/capture frames. Finish is materially more legible as an overlook; portrait shows a narrower rock/waterfall view. |
| Rock keepsake visibility | **PASS sampled phone touch endpoint:** rock/keepsake-rock.png shows full apprentice standing on rock, clear staff and feet, 1/3 keepsakes. Actual approach, jump and action succeeded. This is not every possible angle. |
| Cottage fade neighbor | **Retained at roots:** fresh route capture keeps hero visible through cottage. |

No progression-blocking regression or page error occurred in these bounded routes. Performance certification is excluded: desktop and phone capture runs overlapped, and frame rates under concurrent browser load are not reference-device measurements. Audio and normal-speed acting quality remain outside this visual pass.

## Remaining priority 1: compose a real viewing window around the garden interaction

**Major — TEST-01/02, ART-03.** In `phone/runtime-chimes.png`, a close tree trunk/crown occupies most of the right side and much of the top. The player is squeezed against a solid curtain of pointed leaves; desktop runtime-chimes likewise gives a large fraction of the frame to foreground foliage. Moving the chime fixed direct cap overlap but exposed this neighboring staging problem. Ray visibility to the hero's center does not guarantee a readable interaction composition.

**Concrete repair hypothesis:** move or shorten this nearest garden tree/crown outside the projected action window, or use a wider camera-space occlusion region that includes the apprentice's gesture/staff plus source/chime. Preserve a near framing branch on the edge instead of letting the full crown fill half the screen. Do not add an arrow or remove all vegetation.

**Acceptance:** phone and desktop approach, ring and capture frames show a contiguous clear region containing hero, gesture and interactable, with a readable exit path and distant layer. Nearby foliage frames that region rather than occupying it. Retest a small movement arc around the chime; this is a same-scene placement/fade fix, not geography expansion.

## Remaining priority 2: revise the crown shape language, not another density increase

**Major art gap — ART-02/03, rich woodland target.** Large crowns still read as bundles of long flat triangular spears. Their repeated sharp leaf silhouettes and alternating high-contrast faces dominate the illustration style at the garden and upper frame. The new ground banks, rock texture and forest depth do not change that coarse canopy character. This remains the largest asset-shape gap against the inspected R02's broad layered leaf masses and branching woodland forms.

After repeated placement/density repairs, change the approach: test a revised crown built from broader overlapping leaf masses with a few accent leaves, quieter internal value variation and more readable branch gaps. Reuse the current tree/recipe pipeline and existing reference; no additional Atlas concept is needed. Keep the required candidate/render selection evidence if replacing geometry.

**Acceptance:** matched garden and finish frames, plus normal traversal, preserve readable forest depth without large sawtooth/feather-like planes overwhelming the hero. Improvement should survive both screen sizes, not only a distant beauty view. Do not erase foliage motion or downgrade the required rich environment to meet this condition.

These two remaining gaps are concrete and repairable within the current first scene. The first is small staging work; the second is a bounded canopy geometry/art-direction pass. The result is increasingly coherent, but no fully polished or AAA-equivalent claim follows from successful traversal or this round count.
