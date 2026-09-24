/**
 * Natural water (deliberately NOT toon, no ink): createWaterMaterial(THREE, {kind}) for pools/streams ('pool', flat,
 * uv or world xz) and falls ('fall', a vertical sheet with uv.y = 0 at the bottom). Fresnel between a deep teal body
 * and the sky tint, animated normal ripples from noise gradients, a sun glint, soft foam (pool: noise lace; fall:
 * streaks + a foam band at the bottom). Time/sun are shared uniforms that look.update() advances (look.fx.water.update).
 * The world's existing falls and mist sea are handled inside the toon 'mist' role (animated streaks + canopy).
 *   const mat = look.fx.water.material({ kind: 'fall' }); mesh.material = mat;   // mat.userData.look === false
 *   look.fx.water.spray(position, {radius}) → add a soft spray emitter at a fall base (uses the wind particle pool).
 */
import { NOISE_GLSL } from './noise.js';

export function createWaterFx({ THREE, wind }) {
  const time = { value: 0 }, sunDir = { value: new THREE.Vector3(.5, .6, .6).normalize() };
  const made = [];
  function material({ kind = 'pool', deep = '#1F5A5A', shallow = '#5FA8A4', sky = '#CFE6EC', foam = '#F4F8F4', scale = 1 } = {}) {
    const fall = kind === 'fall';
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uSun: { value: new THREE.Vector3() }, uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) },
        uSky: { value: new THREE.Color(sky) }, uFoam: { value: new THREE.Color(foam) }, uScale: { value: scale } }]),
      defines: fall ? { FX_FALL: '' } : {},
      vertexShader: `varying vec2 vUv; varying vec3 vW, vN;
#include <fog_pars_vertex>
void main() { vUv = uv; vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; vN = normalize( mat3( modelMatrix ) * normal );
  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform float uTime, uScale; uniform vec3 uSun, uDeep, uShallow, uSky, uFoam; varying vec2 vUv; varying vec3 vW, vN;
#include <common>
#include <fog_pars_fragment>
${NOISE_GLSL}
void main() {
  vec3 V = normalize( cameraPosition - vW ), N = normalize( vN ), col; float a = 1.0;
  #ifdef FX_FALL
    // Falling sheet: streaks scroll down fast, foam band and spray haze at the bottom, translucent thin edges.
    vec2 q = vec2( vUv.x * 6.0 * uScale, vUv.y * 2.0 + uTime * 2.2 );
    float streak = fxFbm( vec2( q.x * 3.0, q.y * 0.35 ) ), fine = fxNoise( vec2( q.x * 14.0, q.y * 3.0 ) );
    col = mix( uShallow, uFoam, smoothstep( 0.45, 0.8, streak ) * 0.8 + fine * 0.15 );
    float bottom = 1.0 - smoothstep( 0.0, 0.18, vUv.y );
    col = mix( col, uFoam, bottom * ( 0.6 + 0.4 * fxNoise( vec2( vUv.x * 20.0, uTime * 3.0 ) ) ) );
    a = ( 0.75 + 0.25 * streak ) * smoothstep( 0.0, 0.08, vUv.x ) * ( 1.0 - smoothstep( 0.92, 1.0, vUv.x ) );
  #else
    // Ripples: perturb the normal with scrolling noise gradients (two directions), fresnel sky reflection, sun glint.
    vec2 p = vW.xz * 0.9 * uScale; float e = 0.08;
    float h0 = fxFbm3( p + uTime * vec2( 0.25, 0.18 ) ) + 0.5 * fxFbm3( p * 2.3 - uTime * vec2( 0.32, -0.21 ) );
    float hx = fxFbm3( p + vec2( e, 0.0 ) + uTime * vec2( 0.25, 0.18 ) ) + 0.5 * fxFbm3( ( p + vec2( e, 0.0 ) ) * 2.3 - uTime * vec2( 0.32, -0.21 ) );
    float hz = fxFbm3( p + vec2( 0.0, e ) + uTime * vec2( 0.25, 0.18 ) ) + 0.5 * fxFbm3( ( p + vec2( 0.0, e ) ) * 2.3 - uTime * vec2( 0.32, -0.21 ) );
    N = normalize( N + vec3( h0 - hx, 0.0, h0 - hz ) * 2.2 );
    float fres = pow( 1.0 - max( dot( N, V ), 0.0 ), 3.0 ) * 0.85 + 0.08;
    col = mix( mix( uDeep, uShallow, 0.35 ), uSky, fres );
    vec3 H = normalize( uSun + V ); col += vec3( 1.0, 0.93, 0.8 ) * pow( max( dot( N, H ), 0.0 ), 180.0 ) * 1.6;
    float lace = smoothstep( 0.62, 0.8, fxFbm( p * 3.0 + uTime * 0.2 ) );
    col = mix( col, uFoam, lace * 0.35 );
    a = 0.88;
  #endif
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
      transparent: true, depthWrite: !fall, side: fall ? THREE.DoubleSide : THREE.FrontSide, fog: true,
    });
    m.uniforms.uTime = time; m.uniforms.uSun = sunDir; m.userData.look = false; m.name = 'fx-water-' + kind;
    made.push(m); return m;
  }
  const sprays = [];
  function spray(position, { radius = 1, rate = 10 } = {}) { const s = { position: position.clone(), radius, rate, acc: 0 }; sprays.push(s); return s; }
  function update(dt, t, keyDir) {
    time.value = t; if (keyDir) sunDir.value.copy(keyDir);
    if (!wind) return;
    for (const s of sprays) { s.acc += dt * s.rate; const pts = new Float32Array(6);
      while (s.acc >= 1) { s.acc--; const a = Math.random() * Math.PI * 2, r = s.radius * Math.random();
        pts.set([s.position.x + Math.cos(a) * r, s.position.y, s.position.z + Math.sin(a) * r, s.position.x + Math.cos(a) * r * 1.6, s.position.y + 1.2, s.position.z + Math.sin(a) * r * 1.6]);
        wind.trace(pts, 2, { alpha: .9 }); } }
  }
  return { material, spray, update, materials: made };
}
