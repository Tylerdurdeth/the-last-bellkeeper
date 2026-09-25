/**
 * Natural wind FX (deliberately NOT toon): soft translucent streams of wispy filaments, carried particulates
 * (dust motes, seed fluff, a few leaves/petals) and rising-mist updraft columns. Everything here is excluded from the
 * toon/outline patches (userData.look = false) and joins the look's heat-shimmer pass through DISTORT_LAYER.
 *
 * Wiring for game/bellhollow/wind.js (the gust logic stays there):
 *   const fx = look?.fx?.wind;                                  // createLook() creates it; null when look is off
 *   fx?.attach(mesh);        // the batched strip mesh: soft stream material + shimmer + particulates sampled from its quads
 *   // optional, other emitters: fx.trace(points, n, { alpha }) spawns particulates along any polyline
 *   // vents (openVent / update): a mist column per active updraft
 *   fx?.setUpdraft(v.id, { x: v.x, y: v.y, z: v.z, top: v.top, radius: v.radius, strength: k });   // k 0..1 each frame
 *   fx?.removeUpdraft(v.id);                                   // when the vent closes
 * look.update() advances time and simulates the particles; nothing else to call.
 * Strip conventions it relies on (already true in wind.js): uv.x = metres along the flow, uv.y = 0..1 across,
 * vec4 'color' = wind tint + alpha. Catch/give stay readable: every stream keeps a soft glowing core and rings keep a
 * visible band; #8FD3E0 tints the mist, it is never a flat fill.
 */
import { NOISE_GLSL } from './noise.js';

export const DISTORT_LAYER = 3;

export function createWindFx({ THREE, scene }) {
  const time = { value: 0 };
  // Premultiplied, additive-leaning blend: shaders output rgb*a and an occlusion alpha (a*occ, occ < 1 = mostly
  // additive), so wisps brighten dark planks instead of reading as dirty smoke. The alpha channel of the scene target is
  // left untouched (look.js's post pass reads it as a material marker: terrain .5, fading occluders .25; FX that
  // rewrite it switch the ink/crease detection on or off under themselves).
  const BLEND = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

  // ---------- A. stream material for the batched strips ----------
  const streamMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: `attribute vec4 color; varying vec2 vUv; varying vec4 vCol;
#include <fog_pars_vertex>
void main() { vUv = uv; vCol = color; vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 ); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec4 vCol;
#include <common>
#include <fog_pars_fragment>
${NOISE_GLSL}
void main() {
  // uv.y 0..1 = camera-facing stream (soft air); uv.y 2..3 = floor-flat band (catch / vent rings).
  // uv.y 4..5 = billow (finale flood): broad glowing warm air, fully additive, feathered on every edge.
  float billow = step( 3.5, vUv.y );
  bool isFlat = vUv.y > 1.5 && billow < 0.5;
  float along = vUv.x, across = vUv.y - ( billow > 0.5 ? 4.0 : isFlat ? 2.0 : 0.0 ), t = uTime;
  vec3 tint = vCol.rgb; float a; vec3 col; float occ = 0.4;
  float va = vCol.a;
  occ = mix( 0.4, 0.0, billow );   // billows fully additive: never a grey sheet over dark bark
  float lum = dot( tint, vec3( 0.3, 0.55, 0.15 ) );
  if ( lum < 0.4 ) {
    // Dark underlay (warm-dark shadow band under a catch ring): a soft, solid, feathered band so the
    // ring reads on sunlit ivory cobbles; a faint noise keeps it from looking like a printed decal.
    float band = exp( - pow( ( across - 0.5 ) / 0.3, 2.0 ) );
    a = band * ( 0.88 + 0.12 * fxNoise( vec2( along * 1.7 - t * 0.6, 3.0 ) ) ) * vCol.a;
    col = tint; occ = 1.0;   // the underlay must darken (normal blend)
  } else if ( isFlat ) {
    // Luminous floor ring: a continuous bright core (readable catch zone) breathing with slow air,
    // with thin filaments drifting along it; feathered edges, never a hard strip.
    // Wandering centre line and a broken, breathing stroke: a ring of moving air, not a neon tube.
    float cw = 0.5 + ( fxNoise( vec2( along * 0.6 - t * 0.5, 8.0 ) ) - 0.5 ) * 0.3;
    float core = exp( - pow( ( across - cw ) / 0.22, 2.0 ) );
    float halo = exp( - pow( ( across - 0.5 ) / 0.4, 2.0 ) );
    float brk = 0.35 + 0.65 * smoothstep( 0.25, 0.7, fxFbm3( vec2( along * 1.1 - t * 0.8, 9.0 + across * 0.8 ) ) );
    core *= brk;
    float c = 0.5 + ( fxNoise( vec2( along * 0.9 - t * 1.4, 1.3 ) ) - 0.5 ) * 0.6;
    float fil = exp( - pow( ( across - c ) / 0.07, 2.0 ) ) * smoothstep( 0.35, 0.75, fxFbm3( vec2( along * 1.6 - t * 2.0, 2.0 ) ) );
    float breathe = 0.72 + 0.28 * fxFbm3( vec2( along * 0.7 - t * 0.9, 6.0 ) );
    a = clamp( core * 0.7 * breathe + halo * 0.2 + fil * 0.35, 0.0, 1.0 ) * vCol.a;
    col = mix( mix( tint, vec3( 1.0 ), 0.3 ), vec3( 0.95, 0.99, 1.0 ), clamp( core * 0.4 + fil * 0.3, 0.0, 1.0 ) );   // soft pale cyan, white only in filaments
    occ = 0.8;   // rings stay solid enough to read on pale stone
  } else {
    // Soft air: thin wispy filaments whose centre lines wander across the stream, broken by scrolling fbm
    // (feathered, dissolving ends), over a very faint haze. No solid core: it must never read as a ribbon.
    float fil = 0.0;
    for ( int i = 0; i < 3; i ++ ) {
      float fi = float( i );
      float c = 0.5 + ( fxNoise( vec2( along * 0.55 - t * 0.9, fi * 3.7 ) ) - 0.5 ) * 0.8;
      float w = 0.035 + 0.05 * fxNoise( vec2( along * 1.4 - t * 1.3, fi * 7.1 + 2.0 ) );
      float line = exp( - pow( ( across - c ) / w, 2.0 ) );
      float brk = smoothstep( 0.34, 0.74, fxFbm3( vec2( along * 1.25 - t * 2.4, fi * 5.3 + across * 1.7 ) ) );
      fil += line * brk * ( 0.8 - 0.18 * fi );
    }
    float haze = exp( - pow( ( across - 0.5 ) / 0.26, 2.0 ) ) * smoothstep( 0.25, 0.8, fxFbm3( vec2( along * 0.45 - t * 1.1, 4.0 ) ) );
    a = clamp( fil * mix( 1.05, 1.3, billow ) + haze * mix( 0.12, 0.3, billow ), 0.0, 1.0 ) * va;
    a *= mix( 1.0, smoothstep( 0.0, 0.3, across ) * smoothstep( 1.0, 0.7, across ), billow );   // billow long edges feather to zero   // faint haze (a cyan veil reads as teal smoke on dark planks); billows glow
    // Cool translucent air lit from within: slightly deeper cyan in the haze (reads over ivory stone),
    // near-white only where filaments are dense.
    col = mix( mix( tint, vec3( 1.0 ), 0.55 ), vec3( 0.97, 1.0, 1.0 ), clamp( fil * 0.7, 0.0, 1.0 ) );
    // Billows: golden light, not a pale veil (additive white over dark bark reads as a grey sheet).
    col = mix( col, mix( vec3( 1.0, 0.72, 0.38 ), vec3( 1.0, 0.93, 0.8 ), clamp( fil * 0.8, 0.0, 1.0 ) ), billow );   // pale air, never a dark or saturated teal   // never darker than the wind tint
  }
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 preFog = gl_FragColor.rgb;
  #include <fog_fragment>
  #ifdef USE_FOG
    if ( billow > 0.5 ) gl_FragColor.rgb = preFog * ( 1.0 - fogFactor );   // additive: fade into fog, never add grey fog colour
  #endif
  gl_FragColor = vec4( gl_FragColor.rgb * a, a * occ );
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, ...BLEND,
  });
  streamMaterial.uniforms.uTime = time;
  streamMaterial.name = 'fx-wind-stream'; streamMaterial.userData.look = false;

  // ---------- B. carried particulates (one Points draw) ----------
  const MAX = 2200;
  const pos = new Float32Array(MAX * 3), vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxLife = new Float32Array(MAX);
  const kind = new Float32Array(MAX), size = new Float32Array(MAX), seed = new Float32Array(MAX), fade = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1).setUsage(THREE.DynamicDrawUsage));
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uScale: { value: 600 } }]),
    vertexShader: `attribute float aKind, aSize, aSeed, aFade; uniform float uTime, uScale; varying float vKind, vSeed, vFade, vSpin;
#include <fog_pars_vertex>
void main() { vKind = aKind; vSeed = aSeed; vFade = aFade; vSpin = aSeed * 6.28 + uTime * ( 1.5 + aSeed * 3.0 ) * ( aKind > 1.5 ? 1.0 : 0.2 );
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_PointSize = aSize * uScale / max( 0.5, - mvPosition.z ); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `varying float vKind, vSeed, vFade, vSpin;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 p = gl_PointCoord - 0.5; float c = cos( vSpin ), s = sin( vSpin ); p = vec2( c * p.x - s * p.y, s * p.x + c * p.y );
  vec3 col; float a;
  if ( vKind < 0.5 ) {            // dust mote: tiny warm-lit speck with soft falloff
    float d = length( p ); a = smoothstep( 0.5, 0.0, d ); a *= a * a * 1.4; col = vec3( 1.0, 0.97, 0.9 );   // fine glinting speck, not a puff
  } else if ( vKind < 1.5 ) {     // seed fluff: soft white star of filaments
    float d = length( p ), ang = atan( p.y, p.x );
    float rays = 0.5 + 0.5 * cos( ang * 5.0 );
    a = ( smoothstep( 0.5, 0.05, d ) * ( 0.45 + 0.3 * rays ) * 0.6 + smoothstep( 0.14, 0.0, d ) ) * 0.85;   // soft thistledown, not a snowflake
    col = vec3( 0.98, 0.97, 0.92 );
  } else {                        // leaf / petal: small ellipse, palette colour by seed, lit edge
    float d = length( p * vec2( 1.0, 2.2 ) ); a = smoothstep( 0.5, 0.42, d );
    col = vSeed < 0.4 ? vec3( 0.37, 0.56, 0.31 ) : vSeed < 0.7 ? vec3( 0.65, 0.77, 0.42 ) : vSeed < 0.88 ? vec3( 0.85, 0.41, 0.34 ) : vec3( 0.91, 0.73, 0.29 );
    col *= 0.75 + 0.35 * smoothstep( 0.1, -0.3, p.y );
  }
  a *= vFade; if ( a < 0.02 ) discard;
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
  a = min( a, 1.0 ); gl_FragColor = vec4( gl_FragColor.rgb * a, a * 0.6 );
}`,
    transparent: true, depthWrite: false, fog: true, ...BLEND,
  });
  particleMaterial.uniforms.uTime = time; particleMaterial.userData.look = false; particleMaterial.name = 'fx-wind-particles';
  const points = new THREE.Points(geo, particleMaterial); points.frustumCulled = false; points.name = 'fx-wind-particles'; points.renderOrder = 6;
  scene.add(points);
  let next = 0;
  function spawn(x, y, z, vx, vy, vz, k, lifeS) {
    const i = next; next = (next + 1) % MAX;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    kind[i] = k; seed[i] = Math.random(); life[i] = maxLife[i] = lifeS;
    size[i] = k === 0 ? .025 + Math.random() * .025 : k === 1 ? .045 + Math.random() * .035 : .09 + Math.random() * .06;
  }
  const pickKind = () => { const r = Math.random(); return r < .68 ? 0 : r < .9 ? 1 : 2; };

  // Traced strips from wind.js this frame (polyline copies), turned into spawns in update().
  const traces = []; const MAXTR = 80;
  function trace(pts, n, { alpha = 1, flat = false } = {}) {
    if (traces.length >= MAXTR || n < 2 || alpha < .15) return;
    traces.push({ p: Float32Array.from(pts.subarray ? pts.subarray(0, n * 3) : pts.slice(0, n * 3)), n, alpha, flat });
  }

  // Gust swirl: motes, seed fluff and the odd leaf lifted in a loose spiral out of a catch ring (natural air made
  // visible by what it carries). rate = particles/s; call every frame for each visible gust source.
  const swirlAcc = new Map();
  function swirl(id, x, y, z, r, dt, rate = 9) {
    let acc = (swirlAcc.get(id) || 0) + dt * rate;
    while (acc >= 1) {
      acc--; const a = Math.random() * Math.PI * 2, rr = r * (.35 + .6 * Math.random()), k = Math.random() < .55 ? 0 : Math.random() < .7 ? 1 : 2;
      const sp = 1.2 + Math.random() * 1.2;
      spawn(x + Math.cos(a) * rr, y + .1 + Math.random() * .5, z + Math.sin(a) * rr, -Math.sin(a) * sp, 1.1 + Math.random() * 1.3, Math.cos(a) * sp, k, 1.3 + Math.random() * 1.2);
    }
    swirlAcc.set(id, acc);
  }

  // ---------- C. updraft mist columns ----------
  // 40 sides x 10 rings so the vertex shader can breathe the silhouette (no straight glass edges).
  const colGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 10, true); colGeo.translate(0, .5, 0);
  const columnMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uStrength: { value: 1 }, uTint: { value: new THREE.Color('#8FD3E0') } }]),
    vertexShader: `uniform float uTime; varying vec2 vUv; varying vec3 vN, vV; varying float vDist;
#include <fog_pars_vertex>
void main() { vUv = uv; vec3 p = position; float ang = uv.x * 6.2832, y = uv.y;
  // Billowing radius: slow waves travelling up and around; narrow at the grille, blooming and loosening on top.
  float wob = 0.1 * sin( y * 7.0 - uTime * 2.3 + ang * 2.0 ) + 0.06 * sin( y * 11.0 - uTime * 3.1 - ang * 3.0 + 1.7 );
  p.xz *= ( 0.72 + 0.2 * smoothstep( 0.0, 1.0, y ) ) * ( 1.0 + wob );   // stays inside the vent's ledge gap
  vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 ); vN = normalize( normalMatrix * normal ); vV = normalize( - mvPosition.xyz ); vDist = - mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime, uStrength; uniform vec3 uTint; varying vec2 vUv; varying vec3 vN, vV; varying float vDist;
#include <common>
#include <fog_pars_fragment>
${NOISE_GLSL}
void main() {
  float y = vUv.y, ang = vUv.x, t = uTime;
  // Rising spiralling mist: fbm scrolled upward and twisted around the axis (no hard helix).
  // Seamless around the axis: blend the noise sampled at ang and ang - 1 (identical at the uv seam).
  float sway = 0.45 * sin( y * 6.0 - t * 1.3 + ang * 6.2832 ) + 0.25 * sin( y * 13.0 + t * 0.9 );   // bends the streaks: no straight vertical lines
  vec2 q = vec2( ang * 6.0 + y * 2.2 - t * 0.35 + sway, y * 4.5 - t * 1.6 ), q2 = q - vec2( 6.0, 0.0 );
  float m = mix( fxFbm( q ), fxFbm( q2 ), ang );
  float wisps = smoothstep( 0.45, 0.8, mix( fxFbm( q * 1.9 + 5.0 ), fxFbm( q2 * 1.9 + 5.0 ), ang ) );
  float facing = abs( dot( normalize( vN ), normalize( vV ) ) );
  // Volume-like density: thickest through the middle of the column, fading fully to nothing at the silhouette
  // (a real mist column has no edge). Wisps add streaks that also vanish toward the rim.
  // Seen from above (desktop gameplay angle) the side walls face away, so the rim fade is looser and there is a
  // denser core; the base fade starts the mist above the grille lip (no noisy mist over the bars).
  float body = pow( smoothstep( 0.22, 0.85, facing ), 2.0 );   // hard fade toward the silhouette: no glass-tube edges
  float a = ( 0.14 + 0.38 * smoothstep( 0.3, 0.85, m ) + 0.4 * wisps ) * body * uStrength;   // premultiplied/additive-leaning (front + back face add up)
  a *= smoothstep( 0.0, 0.3, y ) * ( 1.0 - smoothstep( 0.8, 1.0, y ) ) * smoothstep( 1.2, 4.0, vDist );   // near-camera fade: a close phone camera inside the column must not tint the screen   // still dense around the hero near the top           // born at the grille, dissolves on top
  vec3 col = mix( uTint * 0.9, vec3( 0.96, 1.0, 1.0 ), clamp( wisps * 0.8 + m * 0.2, 0.0, 1.0 ) );
  if ( a < 0.003 ) discard;
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
  gl_FragColor = vec4( gl_FragColor.rgb * a * 0.75, a * 0.5 );   // linear-space add is strong: keep the hero readable inside
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, ...BLEND,
  });
  columnMaterial.uniforms.uTime = time; columnMaterial.userData.look = false; columnMaterial.name = 'fx-updraft';
  const updrafts = new Map();
  function setUpdraft(id, { x, y, z, top, radius = .8, strength = 1 }) {
    let u = updrafts.get(id);
    if (!u) {
      const mat = columnMaterial.clone(); mat.uniforms.uTime = time; mat.userData.look = false;
      const mesh = new THREE.Mesh(colGeo, mat); mesh.name = 'fx-updraft-' + id; mesh.renderOrder = 4; mesh.frustumCulled = false;
      scene.add(mesh); u = { mesh, acc: 0 }; updrafts.set(id, u);   // not on DISTORT_LAYER: shimmer made the grille bars jitter
    }
    const h = Math.max(.5, (top ?? y + 5) - y + 3);   // mist continues ~3 m past the ledge so the hero rises inside it
    u.mesh.position.set(x, y, z); u.mesh.scale.set(radius * .95, h, radius * .95);
    u.mesh.material.uniforms.uStrength.value = strength; u.mesh.visible = strength > .01;
    u.x = x; u.y = y; u.z = z; u.h = h; u.r = radius; u.k = strength; u.seen = true;
    return u.mesh;
  }
  function removeUpdraft(id) { const u = updrafts.get(id); if (!u) return; scene.remove(u.mesh); u.mesh.material.dispose(); updrafts.delete(id); }

  const attached = new Set();
  /** One call wiring for the wind.js strip batch: soft stream material, shimmer layer, and particulates sampled from
   *  the batch's own quads each frame (no hook inside strip() needed; trace() stays available for other emitters). */
  function attach(mesh, { material = true } = {}) {
    if (material) mesh.material = streamMaterial;
    mesh.layers.enable(DISTORT_LAYER); attached.add(mesh);
  }
  // Sample random quads of an attached strip batch: index[q*6] is the left vertex of a segment, +2 the next pair.
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  function autoTrace(mesh, dt, rate) {
    const g = mesh.geometry, idx = g.index, P = g.attributes.position, C = g.attributes.color;
    if (!mesh.visible || !idx || !P) return;
    const quads = Math.floor(Math.min(g.drawRange.count, idx.count) / 6); if (quads < 1) return;
    const tries = Math.min(24, Math.ceil(quads * .04));
    for (let k = 0; k < tries; k++) {
      const q = (Math.random() * quads) | 0, v = idx.array[q * 6];
      if (v + 3 >= P.count) continue;
      A.set((P.getX(v) + P.getX(v + 1)) / 2, (P.getY(v) + P.getY(v + 1)) / 2, (P.getZ(v) + P.getZ(v + 1)) / 2);
      B.set((P.getX(v + 2) + P.getX(v + 3)) / 2, (P.getY(v + 2) + P.getY(v + 3)) / 2, (P.getZ(v + 2) + P.getZ(v + 3)) / 2);
      const a = C ? C.getW(v) : 1, len = A.distanceTo(B);
      // expected spawns for this segment scaled so the sampled subset represents the whole batch
      const expected = len * rate * a * dt * (quads / tries);
      const count = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
      for (let s = 0; s < Math.min(count, 3); s++) {
        const f = Math.random(), sp = 1.4 + Math.random() * 1.8, kk = pickKind(), inv = 1 / (len || 1);
        spawn(A.x + (B.x - A.x) * f + (Math.random() - .5) * .2, A.y + (B.y - A.y) * f + (Math.random() - .5) * .2, A.z + (B.z - A.z) * f + (Math.random() - .5) * .2,
          (B.x - A.x) * inv * sp, (B.y - A.y) * inv * sp + (kk === 2 ? .3 : .1), (B.z - A.z) * inv * sp, kk, 1.1 + Math.random() * 1.4);
      }
    }
  }

  // ---------- simulation ----------
  function update(dt, t, { gentle = false } = {}) {
    time.value = t;
    dt = Math.min(dt, .1);
    // Spawn along traced flows: ~1.1 particles per metre of visible stream per second (half in gentle mode).
    const rate = gentle ? .5 : 1.1;
    for (const tr of traces) {
      const { p, n } = tr; let L = 0;
      for (let i = 1; i < n; i++) L += Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 1] - p[i * 3 - 2], p[i * 3 + 2] - p[i * 3 - 1]);
      const expected = L * rate * tr.alpha * dt, count = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
      for (let s = 0; s < count; s++) {
        const i = Math.min(n - 2, (Math.random() * (n - 1)) | 0), f = Math.random();
        const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2], bx = p[i * 3 + 3], by = p[i * 3 + 4], bz = p[i * 3 + 5];
        const tx = bx - ax, ty = by - ay, tz = bz - az, tl = Math.hypot(tx, ty, tz) || 1, sp = 1.4 + Math.random() * 1.8;
        const k = pickKind();
        spawn(ax + tx * f + (Math.random() - .5) * .25, ay + ty * f + (Math.random() - .5) * .25, az + tz * f + (Math.random() - .5) * .25,
          tx / tl * sp, ty / tl * sp + (k === 2 ? .3 : .1), tz / tl * sp, k, 1.1 + Math.random() * 1.4);
      }
    }
    traces.length = 0;
    for (const m of attached) autoTrace(m, dt, rate);
    // Updraft particles: lifted and spiralled inside each column.
    for (const [id, u] of updrafts) {
      if (!u.seen) { u.mesh.visible = false; } u.seen = false;
      if (!u.mesh.visible) continue;
      u.acc += dt * (gentle ? 12 : 36) * u.k;
      while (u.acc >= 1) {
        u.acc--; const a = Math.random() * Math.PI * 2, r = u.r * Math.sqrt(Math.random()) * .8;
        spawn(u.x + Math.cos(a) * r, u.y + .2, u.z + Math.sin(a) * r, -Math.sin(a) * 1.2, 3 + Math.random() * 2.5, Math.cos(a) * 1.2, Math.random() < .4 ? 0 : Math.random() < .6 ? 1 : 2, u.h / 4.5);   // more fluff and leaves: readable lift
      }
    }
    // Integrate: drag toward a slow curl-ish swirl, leaves feel gravity, fade in/out.
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) { fade[i] = 0; continue; }
      life[i] -= dt;
      const k = kind[i], j = i * 3, drag = Math.exp(-dt * (k === 0 ? .6 : k === 1 ? .9 : 1.4));
      const sx = Math.sin(pos[j + 1] * 1.3 + t * 1.7 + seed[i] * 9), sz = Math.cos(pos[j] * 1.1 + t * 1.3 + seed[i] * 7);
      vel[j] = vel[j] * drag + sx * dt * .9; vel[j + 2] = vel[j + 2] * drag + sz * dt * .9;
      vel[j + 1] = vel[j + 1] * drag - (k === 2 ? 1.6 : k === 1 ? .15 : .05) * dt;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      const age = 1 - life[i] / maxLife[i];
      fade[i] = Math.min(1, age / .15) * Math.min(1, life[i] / .35);
    }
    for (const n of ['position', 'aFade', 'aKind', 'aSize', 'aSeed']) geo.attributes[n].needsUpdate = true;
  }

  return { streamMaterial, particleMaterial, columnMaterial, points, trace, swirl, setUpdraft, removeUpdraft, attach, update, updrafts, attached,
    stats: () => ({ particles: life.reduce((n, l) => n + (l > 0 ? 1 : 0), 0), updrafts: updrafts.size }) };
}
