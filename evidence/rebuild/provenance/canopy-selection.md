# Crown repair comparison

Reference: inspected woodland-r02.png and visual-round3.md; repeated spear-like crown planes were the target, not foliage density.

Both variants keep the reviewed curved trunk, roots and branching construction. Leaf geometry is rebuilt as curved closed ShapeGeometry laminae with smoothly rounded outlines, cupped faces and calm mainly-upward normals. There are fewer overlapping sprays, larger broader leaves and intentional branch gaps. Palette value range narrowed. No spheres, imported mesh, added asset or spending.

A: asymmetrical oval leaves, 7 sprays ×9 leaves per crown, 4 Bézier edges at4samples. 13,558 triangles,603meshes, measured14.712×13.906×6.878m. Unmodified recipe PASS. Quiet silhouette but more regular oval-pad impression.

B SELECTED: shallow three-lobed rounded leaf outlines, 7sprays×8leaves per crown, 5curves at4samples. 14,758triangles,547meshes, measured14.936×13.930×7.060m. Unmodified recipe PASS. Actual front/side/back/three-quarter sheet inspected: softer scalloped masses, visible branch gaps, no spear curtain. Closer to R02's broad leaf silhouettes. It still uses stylized leaf layers rather than a fully painted canopy; actual garden camera/phone staging and traversal remain to be checked.

Both technical sheets retained under a/_verify and b/_verify. B source copied byte-for-byte to game/assets/tree.js. No docs build by this agent. Existing backdrop18tree count remains under300k geometry allowance:18×14758 +18rock mass geometry<300000.
