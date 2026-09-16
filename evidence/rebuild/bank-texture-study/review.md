# Isolated exposed-bank texture candidate

One candidate, recommended for selection on visual evidence. Production untouched at report time. Existing stone.png was visually inspected, then used as triplanar5m strata on steep terrain only. Authored earth colour modulates the texture (factor .45+1.55*linear stone RGB), preserving subdued brown/green banks rather than whitening into boulders. Face-up blend is the same smoothstep(.50,.85,abs(worldFaceNormal.y)) introduced with floorB. Painted floorB is unchanged on upward faces, as are path mask, water, light, camera, geometry and gameplay.

Normal keyboard input routes, read-only telemetry, copied stable production build; base and candidate A both complete garden/source→wheel→bridge→overlook. Zero shader/console/page errors and zero HTTP errors. Actual full-resolution restoration and bridge frames in base/ and A/ inspected side-by-side. 1.2s screenshot settle after movement/action; normal endpoint/animation variation means these are not pixel-registered images. No phone or GPU performance claim.

Judgment: useful localized improvement. Broad painted stone layers remove the blank bank plane and tie its material to existing valley rocks. Authored earth colouring remains, cream path and turquoise water remain distinct. No added geometry or draw calls. Cost is three additional terrain fragment texture samples; root must check device/runtime performance if selected. Straight channel edges, abrupt termination and terrain silhouette remain simplistic; texture is not a complete natural bank solution or full artistic benchmark approval.

Source A.js, proposal.patch and exact served-sha256.json retained alongside runtime result JSON and screenshots. No new assets, paid calls or nested agents.
