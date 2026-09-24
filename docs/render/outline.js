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

export function createOutlines(THREE, focus = {}) {
  const U = {
    uInk: { value: new THREE.Color('#2A1E1C') },
    uWidth: { value: 1.5 },            // pixels in the drawing buffer
    uRes: { value: new THREE.Vector2(1280, 720) },
    uPush: { value: .05 },
  };
  // Two shell materials: props fade with the occluder focus (same rule as toon.js), characters never do.
  function makeMaterial(fade) {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      defines: fade ? { BK_FADE: '' } : {},
      vertexShader: `#include <common>
#include <fog_pars_vertex>
uniform float uWidth, uPush; uniform vec2 uRes;
varying float vDepth; varying vec3 vWorld;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  vDepth = - mvPosition.z; vWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
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
uniform vec3 uInk; varying float vDepth; varying vec3 vWorld;
uniform vec4 bkFocusA[ 4 ]; uniform vec4 bkFocusB[ 4 ]; uniform int bkFocusCount;
void main() {
  #ifdef BK_FADE
  {
    vec2 bp = mod( floor( gl_FragCoord.xy * 0.5 ), 4.0 );
    vec4 R = bp.y < 0.5 ? vec4( 0.0, 8.0, 2.0, 10.0 ) : bp.y < 1.5 ? vec4( 12.0, 4.0, 14.0, 6.0 ) : bp.y < 2.5 ? vec4( 3.0, 11.0, 1.0, 9.0 ) : vec4( 15.0, 7.0, 13.0, 5.0 );
    float ign = ( ( bp.x < 0.5 ? R.x : bp.x < 1.5 ? R.y : bp.x < 2.5 ? R.z : R.w ) + 0.5 ) / 16.0;
    vec3 fn = normalize( cross( dFdx( vWorld ), dFdy( vWorld ) ) ); float flatS = smoothstep( 0.45, 0.6, abs( fn.y ) );
    for ( int i = 0; i < 4; i ++ ) {
      if ( i >= bkFocusCount ) break;
      vec4 A = bkFocusA[ i ], B = bkFocusB[ i ];
      vec2 d = ( gl_FragCoord.xy - A.xy ) / vec2( A.w * B.y, A.w );
      float f = ( 1.0 - smoothstep( 0.8, 1.05, length( d ) ) ) * smoothstep( 1.0, 1.6, A.z - vDepth ) * max( 1.0 - flatS, smoothstep( B.x + 1.0, B.x + 1.3, vWorld.y ) ) * B.z;
      if ( f > 0.02 ) discard;   // a fading object loses its ink shell entirely (no dark dots through the dither holes)
    }
  }
  #endif
  gl_FragColor = vec4( uInk, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
      side: THREE.BackSide, fog: true,
    });
    Object.assign(m.uniforms, U, focus);
    m.userData.look = false;
    return m;
  }
  const material = makeMaterial(true), characterMaterial = makeMaterial(false);

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
  function hullCharacter(root, { minRadius = .03, fade = false } = {}) {
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
      const hull = new THREE.Mesh(g, fade ? material : characterMaterial);
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
  return { uniforms: U, material, characterMaterial, hullCharacter, hullStatic };
}
