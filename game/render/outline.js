/**
 * Inverted-hull ink outlines with constant pixel width.
 *
 * - hullCharacter(root): one hull per sizeable moving part (follows joints; skips tiny parts such as eyes/buttons).
 * - hullStatic(root): every eligible mesh merged into ONE hull child in root space → +1 draw per prop.
 * Double-sided/transparent/instanced meshes are skipped (an open bell or cloth plane would fill with ink); those get
 * their outline from the screen-space pass on capable devices. Hull normals are smoothed by position so hard-edged
 * low-poly parts do not crack at corners.
 */
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function createOutlines(THREE) {
  const U = {
    uInk: { value: new THREE.Color('#2A1E1C') },
    uWidth: { value: 1.5 },            // pixels in the drawing buffer
    uRes: { value: new THREE.Vector2(1280, 720) },
    uPush: { value: .05 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: `#include <common>
#include <fog_pars_vertex>
uniform float uWidth, uPush; uniform vec2 uRes;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  // Push the hull slightly away from the eye: it survives at silhouettes but loses the depth test inside concavities
  // (eye sockets, door recesses), which is where inverted hulls otherwise leak ink over detail.
  mvPosition.xyz += normalize( mvPosition.xyz ) * uPush;
  vec4 clip = projectionMatrix * mvPosition;
  vec3 n = normalize( normalMatrix * normal );
  vec2 dir = ( projectionMatrix * vec4( n, 0.0 ) ).xy;
  float len = length( dir );
  dir = len > 1e-5 ? dir / len : vec2( 0.0 );
  clip.xy += dir * uWidth * 2.0 / uRes * clip.w;
  gl_Position = clip;
  #include <fog_vertex>
}`,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform vec3 uInk;
void main() {
  gl_FragColor = vec4( uInk, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    side: THREE.BackSide, fog: true,
  });
  Object.assign(material.uniforms, U);
  material.userData.look = false;

  const smoothCache = new WeakMap();
  /** Position+normal only, normals averaged across coincident vertices. */
  function smoothGeometry(src, matrix) {
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', src.getAttribute('position').clone());
    if (src.index) g.setIndex(src.index.clone());
    if (matrix) g.applyMatrix4(matrix);
    g = BufferGeometryUtils.mergeVertices(g, 1e-4);   // position-only: coincident corners collapse
    if (matrix && matrix.determinant() < 0 && g.index) {   // mirrored part: keep winding so BackSide stays the back
      const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
    }
    g.computeVertexNormals();
    return g;
  }
  const eligible = (o, minRadius) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.lookHull || o.userData.noOutline || !o.visible) return false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some(m => !m || m.side === THREE.DoubleSide || m.transparent || m.visible === false)) return false;
    const g = o.geometry; if (!g?.getAttribute('position')) return false;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const s = o.getWorldScale(new THREE.Vector3());
    return g.boundingSphere.radius * Math.max(s.x, s.y, s.z) >= minRadius;
  };
  const visibleChain = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

  /** Articulated: parts that share a parent (a joint) move rigidly together → one merged hull per joint. */
  function hullCharacter(root, { minRadius = .03 } = {}) {
    root.updateMatrixWorld(true);
    const byParent = new Map();
    root.traverse(o => {
      if (!eligible(o, minRadius) || !visibleChain(o) || !o.parent) return;
      if (!byParent.has(o.parent)) byParent.set(o.parent, []);
      byParent.get(o.parent).push(o);
    });
    let n = 0;
    for (const [parent, meshes] of byParent) {
      const inv = parent.matrixWorld.clone().invert();
      const parts = meshes.map(o => smoothGeometry(o.geometry, inv.clone().multiply(o.matrixWorld)));
      const g = parts.length === 1 ? parts[0] : BufferGeometryUtils.mergeGeometries(parts, false);
      if (!g) continue;
      const hull = new THREE.Mesh(g, material);
      hull.userData.lookHull = true; hull.castShadow = hull.receiveShadow = false; hull.name = 'ink-hull-joint';
      parent.add(hull); n++;
    }
    return n;
  }
  function hullStatic(root, { minRadius = .05 } = {}) {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert(), parts = [];
    root.traverse(o => {
      if (!eligible(o, minRadius) || !visibleChain(o)) return;
      parts.push(smoothGeometry(o.geometry, inv.clone().multiply(o.matrixWorld)));
    });
    if (!parts.length) return 0;
    const g = parts.length === 1 ? parts[0] : BufferGeometryUtils.mergeGeometries(parts, false);
    if (!g) return 0;
    const hull = new THREE.Mesh(g, material);
    hull.userData.lookHull = true; hull.castShadow = hull.receiveShadow = false; hull.name = 'ink-hull-merged';
    root.add(hull);
    return 1;
  }
  return { uniforms: U, material, hullCharacter, hullStatic };
}
