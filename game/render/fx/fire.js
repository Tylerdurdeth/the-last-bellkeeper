/**
 * Natural lantern flames (deliberately NOT toon): one instanced billboard draw for every flame. Each quad layers a
 * noise-licked teardrop flame (white-gold core → orange → deep red tips) over a soft warm glow falloff, additive, with
 * per-flame flicker. A shared flicker value also breathes the lantern glass emissive (fx.flicker) for a cheap "light
 * flicker on nearby surfaces" without extra lights.
 *
 * Automatic: every InstancedMesh named 'bh-lanterns-*' (game/bellhollow/kit/life.js) gets flames at its instances,
 * sized by instance scale and lit by its material's emissiveIntensity (frozen lanterns = tiny ember, restored = full).
 * Manual: fx.fire.add(position, {size, intensity}) for braziers etc.; returns a handle {position, size, intensity}.
 */
import { NOISE_GLSL } from './noise.js';

export function createFireFx({ THREE, scene }) {
  const MAX = 256;
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
  const iPos = new Float32Array(MAX * 3), iData = new Float32Array(MAX * 3);   // size, intensity, seed
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('iData', new THREE.InstancedBufferAttribute(iData, 3).setUsage(THREE.DynamicDrawUsage));
  geo.instanceCount = 0;
  const time = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: `attribute vec3 iPos; attribute vec3 iData; uniform float uTime; varying vec2 vUv; varying vec3 vData; varying float vNear;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vData = iData;
  float s = iData.x * 1.6;                        // quad covers flame + glow halo
  vec4 mvPosition = modelViewMatrix * vec4( iPos, 1.0 );
  vNear = smoothstep( 1.5, 5.0, - mvPosition.z );   // no screen-filling glare from a lantern beside the camera
  mvPosition.xyz += normalize( - mvPosition.xyz ) * ( 0.1 + 0.55 * iData.x );   // in front of its glass (radius ~.16 m × scale)
  mvPosition.xy += position.xy * s;
  mvPosition.y += 0.18 * s;                        // flame rises from the wick
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vData; varying float vNear;
#include <common>
#include <fog_pars_fragment>
${NOISE_GLSL}
void main() {
  float k = vData.y, seed = vData.z * 17.0, t = uTime;
  vec2 p = vUv - vec2( 0.5, 0.32 );                 // wick at (0.5, 0.32)
  float flick = 0.82 + 0.18 * fxNoise( vec2( t * 7.0, seed ) ) + 0.08 * sin( t * 23.0 + seed );
  // Teardrop flame, licked sideways by rising noise; narrower and brighter at the core.
  float h = clamp( p.y / ( 0.42 * flick ), 0.0, 1.0 );
  float sway = ( fxNoise( vec2( p.y * 5.0 - t * 5.5, seed ) ) - 0.5 ) * 0.10 * h;
  float wdt = 0.16 * ( 1.0 - h ) * sqrt( max( h, 0.0 ) + 0.08 ) + 0.03 * ( 1.0 - h );
  float body = 1.0 - smoothstep( wdt * 0.55, wdt, abs( p.x - sway ) );
  body *= step( -0.03, p.y ) * smoothstep( -0.03, 0.02, p.y ) * ( 1.0 - smoothstep( 0.7, 1.0, h ) );
  float lick = fxFbm3( vec2( p.x * 9.0, p.y * 6.0 - t * 4.0 + seed ) );
  body *= smoothstep( 0.25, 0.55, lick + ( 1.0 - h ) * 0.55 );
  float core = body * ( 1.0 - smoothstep( 0.0, 0.55, h ) ) * ( 1.0 - smoothstep( 0.0, wdt * 0.5, abs( p.x - sway ) ) );
  vec3 flame = mix( vec3( 0.95, 0.28, 0.06 ), vec3( 1.0, 0.72, 0.25 ), smoothstep( 0.9, 0.2, h ) );
  flame = mix( flame, vec3( 1.0, 0.97, 0.85 ), core );
  // Warm glow halo (bloom-free): exponential falloff around the flame, breathing with the flicker.
  float r = length( ( vUv - vec2( 0.5, 0.40 ) ) * vec2( 1.0, 0.85 ) );
  float glow = exp( - r * r * 12.0 ) * 0.75 * flick * ( 1.0 - smoothstep( 0.32, 0.5, max( abs( vUv.x - 0.5 ), abs( vUv.y - 0.5 ) ) ) );
  vec3 col = flame * body * 2.4 + vec3( 1.0, 0.55, 0.18 ) * glow * vNear;
  col *= k;
  if ( max( col.r, max( col.g, col.b ) ) < 0.004 ) discard;
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
  });
  material.uniforms.uTime = time; material.userData.look = false; material.name = 'fx-fire';
  const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false; mesh.name = 'fx-fire'; mesh.renderOrder = 7;
  scene.add(mesh);

  const manual = [];
  function add(position, { size = .35, intensity = 1 } = {}) { const h = { position: position.clone(), size, intensity }; manual.push(h); return h; }
  function remove(h) { const i = manual.indexOf(h); if (i >= 0) manual.splice(i, 1); }

  let lanternMeshes = [], scanT = 0;
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const flicker = { value: 1 };
  function update(dt, t) {
    time.value = t;
    flicker.value = .9 + .07 * Math.sin(t * 11.3) + .05 * Math.sin(t * 17.9 + 1.3);
    if ((scanT -= dt) <= 0) { scanT = 1; lanternMeshes = []; scene.traverse(o => { if (o.isInstancedMesh && /^bh-lanterns-/.test(o.name)) lanternMeshes.push(o); }); }
    let n = 0;
    for (const im of lanternMeshes) {
      const lit = Math.min(1, Math.max(.06, (im.material.emissiveIntensity || 0) / 1.5));
      im.updateMatrixWorld();
      for (let i = 0; i < im.count && n < MAX; i++, n++) {
        im.getMatrixAt(i, m4); m4.premultiply(im.matrixWorld); m4.decompose(v, q, sc);
        iPos[n * 3] = v.x; iPos[n * 3 + 1] = v.y - .06 * sc.y; iPos[n * 3 + 2] = v.z;
        iData[n * 3] = .55 * sc.y * (.45 + .55 * lit); iData[n * 3 + 1] = lit; iData[n * 3 + 2] = (i * .6180339) % 1;
        // The glass itself breathes with the flame (bloom-free "light" on the lantern).
        im.material.userData.fxFlicker = flicker;
      }
    }
    for (const h of manual) { if (n >= MAX) break; iPos.set([h.position.x, h.position.y, h.position.z], n * 3); iData.set([h.size, h.intensity, (n * .6180339) % 1], n * 3); n++; }
    geo.instanceCount = n;
    geo.attributes.iPos.needsUpdate = true; geo.attributes.iData.needsUpdate = true;
    mesh.visible = n > 0;
  }
  return { mesh, material, add, remove, update, flicker, get count() { return geo.instanceCount; } };
}
