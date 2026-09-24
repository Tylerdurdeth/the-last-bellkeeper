/**
 * The Last Bellkeeper v2 look: toon bands + coloured shadows + warm character rim, ink outlines (hulls on characters,
 * merged hulls on key props, optional screen-space depth edges), painted sky dome, aerial fog, per-area light rigs with
 * crossfades and a restoration blend, and one cheap full-screen grade pass.
 *
 *   const look = createLook({THREE, renderer, scene, camera});
 *   look.applyTo(hero, 'character');           // toon + rim + ink hull that follows joints
 *   look.applyTo(bell, 'outline');             // one merged ink hull for a static prop (+1 draw)
 *   look.applyTo(lantern, 'lantern');          // gold emissive glow; 'wind' for cyan; 'glow' with {color}
 *   // per frame (after gameplay, before drawing):
 *   look.update(dt, {area:'terrace-dawn', restored:0..1|bool, t});
 *   look.render();                             // replaces renderer.render(scene, camera)
 *
 * Tiers: 'high' (4× MSAA, ink edges + grade), 'low' (2× MSAA, ink edges + grade; phones start here), 'grade' (grade pass,
 * no screen-space ink; hulls stay), 'min' (direct render). Sustained low FPS steps down one level at a time. Force with opts.tier.
 * Every tier keeps ONE post pass at most (edges live inside the grade pass, they are extra depth taps, not a pass).
 */
import { createToon } from './toon.js';
import { createOutlines } from './outline.js';
import { createSky } from './sky.js';
import { createWindMaterial } from './wind-material.js';
import { createWindFx, DISTORT_LAYER } from './fx/wind-fx.js';
import { createFireFx } from './fx/fire.js';
import { createWaterFx } from './fx/water.js';
import { createShafts } from './fx/shafts.js';
import { prepareFoliage } from './fx/foliage.js';
export { createWindMaterial };
import { setPaintedCel } from '../art-direction.js';

const C = (THREE, h) => new THREE.Color(h);

/** Rig parameters. Colours are sRGB hex (converted to linear), dirs point toward the light. */
function baseRigs(THREE) {
  const c = h => C(THREE, h), v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const rig = o => ({
    keyDir: v(.52, .62, .68), keyColor: c('#FFE0B6'), keyIntensity: 2.9,
    skyColor: c('#C8D8EA'), groundColor: c('#86705A'), hemiIntensity: 1.6,
    fogColor: c('#DCE0D8'), fogSun: c('#F8D8AE'), fogDensity: .014, fogShape: new THREE.Vector2(14, .7), fogHeight: new THREE.Vector3(-3, 6, .6),
    skyTop: c('#8FC3D6'), skyHorizon: c('#F6D9B0'), skyBelow: c('#B8B79E'), sunColor: c('#FFD49A'), cloudAmt: .85,
    cloud: c('#FFF0DA'), cloudShade: c('#C8B6B3'),
    bands: new THREE.Vector4(.10, .46, .045, .52),
    shadowTint: c('#B4BED6'), shade: c('#2C4A45'), shadeAmt: .1, ambSteps: .6,
    height: new THREE.Vector4(-100, -99, 1, 1), lowTint: c('#FFFFFF'),
    rim: c('#FFB870'), rimIntensity: .9,
    exposure: 1.0,
    lift: new THREE.Vector3(.004, .018, .022), gain: new THREE.Vector3(1.03, 1.0, .96), sat: .98, contrast: 1.08,
    vignette: .20, ink: c('#2A1E1C'),
    skyMapMix: 1, mapTint: c('#FFFFFF'), backMix: 1, backTint: c('#FFFFFF'), hazeAmt: .22,
    restoreExposure: 1.24, restoreWarm: 1, shadowIntensity: 1, postGain: 1,
    aerial: new THREE.Vector3(18, 75, .22), aerialColor: c('#BCCDD6'), sunGlow: 1, shafts: .08,   // how hard restoration brightens / warms this area
    ...o,
  });
  return {
    // Low warm key from east-south-east, cool sky fill, long soft shadows, hazy peach distance.
    'terrace-dawn': rig({}),
    // Brighter, higher, whiter key; crisper bands, clearer air.
    'branches-day': rig({
      keyDir: v(.55, .78, .32), keyColor: c('#FFF0D8'), keyIntensity: 3.1,
      skyColor: c('#C4DDEA'), groundColor: c('#5A6E62'), hemiIntensity: 1.45,
      fogColor: c('#A9C7CF'), fogSun: c('#F1E2C0'), fogDensity: .011, fogShape: new THREE.Vector2(18, .55), fogHeight: new THREE.Vector3(-4, 10, .3),
      skyTop: c('#6FB6D6'), skyHorizon: c('#E3F0EC'), skyBelow: c('#A9C4B8'), sunColor: c('#FFF4DC'), cloudAmt: 1.0,
      cloud: c('#FFFFFF'), cloudShade: c('#BFD2DA'),
      bands: new THREE.Vector4(.10, .42, .03, .50), shadowTint: c('#AEB9CC'), shadeAmt: .06,   // cool blue, not teal: warm timber must not go olive
      lift: new THREE.Vector3(.0, .012, .02), gain: new THREE.Vector3(1.02, 1.01, .99), sat: 1.06, contrast: 1.10,
      vignette: .14, mapTint: c('#F4F8FF'), hazeAmt: .12, aerial: new THREE.Vector3(22, 90, .2), shafts: .05,
      restoreExposure: 1.2, restoreWarm: .45,   // already bright: warmth and fill, not exposure (no clipping)
    }),
    // Warm shaft from above, cool darker lower well.
    'hollow': rig({
      keyDir: v(.66, .9, .66), keyColor: c('#FFD39A'), keyIntensity: 3.4,
      skyColor: c('#B6CCD0'), groundColor: c('#30464A'), hemiIntensity: 1.45,
      fogColor: c('#4F6772'), fogSun: c('#D8AE74'), fogDensity: .018, fogShape: new THREE.Vector2(10, .45), fogHeight: new THREE.Vector3(-14, -2, .8),
      skyTop: c('#5E817C'), skyHorizon: c('#B89A73'), skyBelow: c('#2E4843'), sunColor: c('#FFC27A'), cloudAmt: 0,
      bands: new THREE.Vector4(.12, .50, .05, .50), shadowTint: c('#9FB6C8'), shade: c('#2C4A45'), shadeAmt: .22,
      height: new THREE.Vector4(-15, 1, .72, .45), lowTint: c('#9FC0C2'),
      rim: c('#FFB060'), rimIntensity: 1.1, exposure: 1.1,
      restoreExposure: 1.1, restoreWarm: .55, aerial: new THREE.Vector3(12, 40, .12), aerialColor: c('#6F8C92'), sunGlow: .4, shafts: .07,   // restored Hollow: brighter and warmer, not yellow
      shadowIntensity: .72,   // inside the trunk: occluded key survives at half strength as warm bounce (interiors keep form)
      lift: new THREE.Vector3(.0, .015, .04), gain: new THREE.Vector3(1.03, 1.0, .96), sat: 1.04, contrast: 1.22,
      vignette: .2, skyMapMix: .85, mapTint: c('#9FA7A0'), backMix: .35, backTint: c('#8E9A92'), hazeAmt: .45,
    }),
  };
}

/** Restoration: warmer, brighter key and fill, golden haze, warmer grade (≥12% mean luminance). */
function restoredOf(THREE, r) {
  const o = cloneRig(r), warm = C(THREE, '#FFC47A'), gold = C(THREE, '#F4D39A');
  const w = r.restoreWarm;
  o.keyColor.lerp(warm, .30 * w); o.keyIntensity *= 1 + .25 * w;
  o.skyColor.lerp(C(THREE, '#F2E0B8'), .35); o.groundColor.lerp(C(THREE, '#6B5A3A'), .25); o.hemiIntensity *= 1.28;
  o.fogColor.lerp(gold, .40); o.fogSun.lerp(C(THREE, '#FFD08A'), .4); o.fogDensity *= .85;
  o.skyHorizon.lerp(C(THREE, '#FFD49C'), .40); o.skyTop.lerp(C(THREE, '#A7D2DC'), .3); o.sunColor.lerp(warm, .3);
  o.shadowTint.lerp(C(THREE, '#B7B7A0'), .35); o.lowTint.lerp(C(THREE, '#E8D2A8'), .5);
  o.height.z = Math.min(1, o.height.z + .12); o.height.w = Math.min(1, o.height.w + .12);   // the well stays deeper than its rim
  o.mapTint.lerp(C(THREE, '#FFE7C4'), .45); o.backTint.lerp(C(THREE, '#FFEBCB'), .4); o.hazeAmt *= .6;
  o.postGain = 1.07;   // display-space lift (not compressed by tone mapping): keeps the restored delta ≥12% in bright frames
  o.exposure *= r.restoreExposure; o.gain.set(o.gain.x * (1 + .04 * w), o.gain.y * (1 + .01 * w), o.gain.z * (1 - .05 * w));
  o.sat *= 1 + .03 * w; o.vignette *= .8;
  return o;
}
function cloneRig(r) { const o = {}; for (const k in r) o[k] = r[k]?.clone ? r[k].clone() : r[k]; return o; }
function lerpRig(out, a, b, t) {
  for (const k in a) {
    const x = a[k], y = b[k];
    if (typeof x === 'number') out[k] = x + (y - x) * t;
    else if (x?.isColor) out[k].copy(x).lerp(y, t);
    else if (x?.isVector3 || x?.isVector4) out[k].copy(x).lerp(y, t);
  }
  if (out.keyDir) out.keyDir.normalize();
  return out;
}

const TEX = n => new URL(`../textures/v2/${n}.webp`, import.meta.url).href;

export function createLook({ THREE, renderer, scene, camera, tier: forcedTier, pixelWidth = 1.5, sky: skyOpts = true, autoTiles = true, hierarchy: hierarchyOpt = true, beauty = true } = {}) {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('beauty') === '0') beauty = false;   // dev comparison override
  const hierarchy = hierarchyOpt && beauty;   // beauty:false = pass-3 look (no hierarchy/weathering/AO/aerial/shafts/sun glow), for comparisons
  setPaintedCel(false);   // the old art-direction cel ramp would stack on top of the toon bands
  const toon = createToon(THREE), sky = createSky(THREE);
  const ink = createOutlines(THREE, { bkFocusA: toon.uniforms.bkFocusA, bkFocusB: toon.uniforms.bkFocusB, bkFocusCount: toon.uniforms.bkFocusCount });
  const rigs = baseRigs(THREE), restoredRigs = {};
  for (const k in rigs) restoredRigs[k] = restoredOf(THREE, rigs[k]);
  const cur = cloneRig(rigs['terrace-dawn']), target = cloneRig(cur), blendTmp = cloneRig(cur);
  let area = 'terrace-dawn', restoredNow = 0, snapped = false;

  // Lights: adopt the host's hemisphere + shadow-casting sun if present, otherwise create them.
  let hemi = null, sun = null;
  scene.traverse(o => { if (o.isHemisphereLight && !hemi) hemi = o; if (o.isDirectionalLight && o.castShadow && !sun) sun = o; });
  if (!hemi) { hemi = new THREE.HemisphereLight(); scene.add(hemi); }
  if (!sun) {
    sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: .5, far: 70 });
    sun.shadow.bias = -.0003; sun.shadow.normalBias = .025; scene.add(sun, sun.target);
  }
  if (!scene.fog?.isFogExp2) scene.fog = new THREE.FogExp2(0xffffff, .016);
  scene.add(sky.mesh);
  // Natural elements (not toon): wind streams/particles/updrafts, lantern flames, water. See game/render/fx/*.
  const fxWind = createWindFx({ THREE, scene });
  const shafts = createShafts({ THREE, scene });
  const fx = { wind: fxWind, fire: createFireFx({ THREE, scene }), water: createWaterFx({ THREE, wind: fxWind }), shafts };
  // Atlas painted sky + distant valley (≈125 KB, async, never blocks the first frame). Pass sky:false to skip.
  const ready = skyOpts ? Promise.all([
    sky.setTexture(skyOpts.sky ?? TEX('sky-dawn'), skyOpts.skyOptions),
    sky.setBackdrop(skyOpts.valley ?? TEX('valley'), skyOpts.valleyOptions),
  ]).catch(e => console.warn('[look] sky textures', e.message)) : Promise.resolve();
  scene.background = null;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;

  // Tier selection.
  const small = Math.min(innerWidth, innerHeight) < 600 || matchMedia?.('(pointer: coarse)').matches;
  let tier = forcedTier || (small ? 'low' : 'high');
  const autoTier = !forcedTier;

  // Post pass: scene → multisampled HDR target (+ float depth) → grade/ink quad to screen.
  const size = new THREE.Vector2();
  let rt = null;
  function ensureTarget() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, size.x | 0), h = Math.max(1, size.y | 0);
    if (rt && rt.width === w && rt.height === h && rt.samples === (tier === 'high' ? 4 : 2)) return rt;
    rt?.dispose();
    const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: tier === 'high' ? 4 : 2, depthTexture, depthBuffer: true });
    rt.texture.name = 'look-color';
    return rt;
  }
  // Heat shimmer: wind FX on DISTORT_LAYER render once, half res, into an offset buffer (rg = .5 + offset).
  let distRT = null; const NEUTRAL_OFFSET = new THREE.Color().setRGB(.5, .5, 0, THREE.LinearSRGBColorSpace);   // raw .5 = no offset
  const distortMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `attribute vec4 color; varying vec2 vUv; varying float vA;
void main() { vUv = uv; vA = color.a > 0.0 ? color.a : 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: `uniform float uTime; uniform sampler2D tDepth; uniform vec2 uRes; varying vec2 vUv; varying float vA;
float h( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float n( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( h( i ), h( i + vec2( 1, 0 ) ), f.x ), mix( h( i + vec2( 0, 1 ) ), h( i + vec2( 1, 1 ) ), f.x ), f.y ); }
void main() {
  if ( gl_FragCoord.z > texture2D( tDepth, gl_FragCoord.xy / uRes ).x + 1e-5 ) discard;   // behind the world
  vec2 q = vec2( vUv.x * 1.6 - uTime * 2.2, vUv.y * 3.0 + uTime * 0.7 );
  vec2 o = vec2( n( q ) - 0.5, n( q + 17.3 ) - 0.5 );
  float across = 1.0 - smoothstep( 0.2, 0.5, abs( vUv.y - 0.5 ) );
  gl_FragColor = vec4( 0.5 + o * 0.9 * vA * across, 0.0, 1.0 );
}`,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
  distortMat.userData.look = false;
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: .1 }, uFar: { value: 100 },
      uPx: { value: 1 }, uInk: { value: new THREE.Color('#2A1E1C') }, uInkAmt: { value: .92 }, uFade: { value: new THREE.Vector2(18, 55) },
      uLift: { value: new THREE.Vector3() }, uPostGain: { value: 1 }, tDistort: { value: null }, uDistort: { value: .006 }, uAoR: { value: 6 }, uAo: { value: .38 }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
    fragmentShader: `#include <common>
uniform sampler2D tColor, tDepth, tDistort; uniform float uDistort, uAoR, uAo; uniform vec2 uRes, uFade; uniform float uNear, uFar, uPx, uInkAmt, uSat, uContrast, uVignette;
uniform vec3 uInk, uLift, uGain; uniform float uPostGain; varying vec2 vUv;
float linZ( vec2 uv ) { float d = texture2D( tDepth, uv ).x; return uNear * uFar / ( uFar - d * ( uFar - uNear ) ); }
vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
  vec4 src = texture2D( tColor, vUv );
  vec3 col = src.rgb;
  #ifdef BK_DISTORT
    vec2 dOff = texture2D( tDistort, vUv ).rg - 0.5;
    if ( dot( dOff, dOff ) > 1e-6 ) col = texture2D( tColor, vUv + dOff * uDistort ).rgb;   // heat shimmer inside wind
  #endif
  float e = 0.0;
  #ifdef BK_EDGES
    vec2 px = uPx / uRes;
    float z0 = linZ( vUv );
    float zl = linZ( vUv - vec2( px.x, 0.0 ) ), zr = linZ( vUv + vec2( px.x, 0.0 ) );
    float zd = linZ( vUv - vec2( 0.0, px.y ) ), zu = linZ( vUv + vec2( 0.0, px.y ) );
    // Silhouette: a neighbour much farther away → ink on the near object's edge.
    float zmax = max( max( zl, zr ), max( zd, zu ) );
    float sil = smoothstep( 0.06, 0.16, ( zmax - z0 ) / z0 );
    // Crease: curvature of view depth across the pixel, relative to depth (convex/concave corners of blocks).
    float lap = ( abs( zl + zr - 2.0 * z0 ) + abs( zd + zu - 2.0 * z0 ) ) / z0;
    float crease = smoothstep( 0.012, 0.03, lap ) * 0.8 * smoothstep( 0.6, 0.9, src.a );   // terrain (a=.5): silhouettes only
    e = max( sil, crease ) * ( 1.0 - smoothstep( uFade.x, uFade.y, z0 ) );
    // Soft AO where things meet + light edge wear on convex edges: depth second derivative over opposing tap pairs
    // (planes cancel), windowed so object/background gaps do not halo. Fades with distance; skipped on sky.
    {
      vec2 r = uAoR / uRes; float occ = 0.0, wear = 0.0;
      vec2 D[ 4 ]; D[ 0 ] = vec2( 1.0, 0.0 ); D[ 1 ] = vec2( 0.0, 1.0 ); D[ 2 ] = vec2( 0.707, 0.707 ); D[ 3 ] = vec2( 0.707, -0.707 );
      for ( int i = 0; i < BK_AO_PAIRS; i ++ ) {
        float d = ( z0 - 0.5 * ( linZ( vUv + D[ i ] * r ) + linZ( vUv - D[ i ] * r ) ) ) / z0;
        occ += smoothstep( 0.002, 0.02, d ) * ( 1.0 - smoothstep( 0.06, 0.15, d ) );
        wear += smoothstep( 0.002, 0.012, - d ) * ( 1.0 - smoothstep( 0.03, 0.06, - d ) );
      }
      float k = ( 1.0 - smoothstep( 25.0, 60.0, z0 ) ) * step( z0, uFar * 0.8 ) / float( BK_AO_PAIRS );
      col *= 1.0 - uAo * occ * k;
      col *= 1.0 + uAo * 0.5 * wear * k;
    }
    e *= step( z0, uFar * 0.85 );
    e *= smoothstep( 0.3, 0.4, src.a );   // no ink on fading occluders (alpha .25 marker)
  #endif
  #ifdef TONE_MAPPING
    col = toneMapping( col );
  #endif
  col = mix( saturate( col ), uInk, e * uInkAmt );
  vec3 s = toSRGB( saturate( col ) );
  // LUT-ish grade in display space: lift (tinted shadows), gain (warm highlights), saturation, soft contrast.
  float l = dot( s, vec3( 0.2126, 0.7152, 0.0722 ) );
  s = s * uGain * uPostGain + uLift * ( 1.0 - l );
  l = dot( s, vec3( 0.2126, 0.7152, 0.0722 ) );
  s = mix( vec3( l ), s, uSat );
  s = mix( s, s * s * ( 3.0 - 2.0 * s ), uContrast - 1.0 );
  // Soft shoulder per channel above .80 so saturated paint (coral coat, lime tips) rolls off instead of clipping.
  vec3 bkOver = max( s - 0.80, 0.0 );
  s = min( s, 0.80 ) + 0.20 * ( 1.0 - exp( - bkOver / 0.20 ) );
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  s *= 1.0 - uVignette * smoothstep( 0.35, 1.05, length( q ) );
  gl_FragColor = vec4( saturate( s ), 1.0 );
}`,
    depthTest: false, depthWrite: false,
  });
  post.userData.look = false;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post); quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  function setEdges(on, pairs = 4) {
    const had = post.defines.BK_EDGES !== undefined, hadPairs = post.defines.BK_AO_PAIRS;
    if (on) post.defines.BK_EDGES = ''; else delete post.defines.BK_EDGES;
    post.defines.BK_AO_PAIRS = pairs;
    if (had !== on || hadPairs !== pairs) post.needsUpdate = true;
  }

  // Registration: every lit material in the scene is patched (scanned periodically, cheap).
  let scanTimer = 0;
  // World surface materials (bellhollow kit, userData.bhKey) get painted tiles automatically; pass autoTiles:false to opt out.
  const AUTO_TILES = autoTiles ? { bark: 'bark', barkShade: 'bark', deck: 'timber', stone: 'stone-wall', stoneShade: 'stone-wall' } : {};
  // Modelled cobble paving is ground: silhouette ink only (no crease ink on every cobble).
  // The world's mist sea (flat, far below) is painted as a distant forest canopy in drifting mist.
  const AUTO_ROLES = { paving: 'terrain', mist: 'mist' };
  const NEVER_FADE = /^(bark|barkShade|heartwood|heartwoodLight|stoneDeep|pavingDeep|trunk.*)$/;
  // The world's light-shaft wedges (bhKey 'shaft') become soft volumetric-looking beams: feathered by view angle,
  // broken by drifting noise, faded near the camera and with distance; additive, never a hard polygon edge.
  const softShaft = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#FFD68A') }, uAmt: { value: .07 } },
    vertexShader: `varying vec3 vW, vN; void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; vN = normalize( mat3( modelMatrix ) * normal ); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uAmt; uniform vec3 uColor; varying vec3 vW, vN;
float h( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float n3( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( h( i ), h( i + vec3( 1, 0, 0 ) ), f.x ), mix( h( i + vec3( 0, 1, 0 ) ), h( i + vec3( 1, 1, 0 ) ), f.x ), f.y ), mix( mix( h( i + vec3( 0, 0, 1 ) ), h( i + vec3( 1, 0, 1 ) ), f.x ), mix( h( i + vec3( 0, 1, 1 ) ), h( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
void main() {
  vec3 V = normalize( cameraPosition - vW ); float facing = abs( dot( normalize( vN ), V ) );
  float feather = pow( facing, 2.5 );                                   // edges seen edge-on vanish: no hard wedge outline
  float dust = 0.55 + 0.45 * n3( vW * 0.7 + vec3( 0.0, - uTime * 0.12, uTime * 0.05 ) );
  float d = length( cameraPosition - vW ), near = smoothstep( 3.0, 10.0, d ) * ( 1.0 - smoothstep( 45.0, 90.0, d ) );
  float a = feather * dust * near * uAmt;
  if ( a < 0.002 ) discard;
  gl_FragColor = vec4( uColor * a, 1.0 );
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  softShaft.userData.look = false; softShaft.name = 'fx-soft-shaft';
  /** Interior volume (the Hollow): no aerial fog/mist inside. Default = Bellhollow trunk; override for other worlds. */
  function setInterior({ x = 0, z = 0, radius = 12.5, top = 9 } = {}) { toon.uniforms.bkInterior.value.set(x, z, radius, top); }
  setInterior();
  const lanternGlass = o => o.isInstancedMesh && /^bh-lanterns-/.test(o.name);
  const characterMaterial = (o, m) => toon.roleOf(m) === 'character' || [...characters].some(c => { for (let q = o; q; q = q.parent) if (q === c) return true; return false; });
  const tiled = new WeakSet(), surfaced = new WeakSet(), hsl = {};
  // Rule 1 (value/saturation hierarchy): large surfaces calm and weathered, saturation kept for accents.
  const HONEY_GREY = new THREE.Color('#A58B6B'), LEAF_BLUE_GREEN = new THREE.Color('#6F9A63');
  function classifySurface(m) {
    const role = toon.roleOf(m);
    const glowing = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1) > .15;
    if (!m.color || ['character', 'glow', 'mist'].includes(role) || glowing || m.userData.accent) return null;
    const key = m.userData.bhKey || '', name = m.name || '';
    m.color.getHSL(hsl);
    const teal = hsl.h > .38 && hsl.h < .56, warm = hsl.h < .12 || hsl.h > .95, coral = warm && hsl.s > .45 && hsl.l > .45;
    if (/^(deck|timber|timberDark)$/.test(key) || name === 'timber') return { sat: .6, tint: HONEY_GREY, tintAmt: .2, moss: key === 'deck' ? .2 : .35, grime: .6 };
    if (/^(stone|stoneShade|paving|plaster)$/.test(key) || name === 'stone' || name === 'plaster') return { sat: .7, moss: .7, grime: .7 };
    if (/^bark/.test(key) || name === 'bark') return { sat: .72, moss: .6, grime: .4 };
    if (name === 'tile' || /^tile/.test(key)) return { sat: coral ? .7 : .6, moss: .45, grime: .5 };   // roofs are large: calm
    if (name === 'metal') return teal ? { sat: .45, grime: .5 } : { sat: .82, grime: .2 };   // verdigris pipes calm; polished copper stays warm
    if (name === 'fabric' || /^cloth/.test(key) || /Double$/.test(key)) return coral ? null : { sat: .8 };   // cloth is an accent: no grime/streaks/moss
    if (name === 'foliage' || /^leaf/.test(key) || key === 'far' || key === 'farLight') return { sat: hsl.l > .5 ? .66 : .82, tint: LEAF_BLUE_GREEN, tintAmt: hsl.l > .5 ? .12 : .06 };   // lime → palette greens   // lime tips calmer
    if (role === 'terrain' || name === 'ground') return { sat: .78, moss: .3, grime: .2 };
    return hsl.s > .5 ? { sat: .78, grime: .4 } : { sat: .92, grime: .3 };
  }
  // Foliage (auto): palette leaf materials and anything named 'foliage' get mass normals + the foliage role.
  const isFoliageMat = m => m && !m.transparent && (m.name === 'foliage' || /^(leaf|leafLight|leafShade|far|farLight)$/.test(m.userData?.bhKey || '')) && !/Double$/.test(m.userData?.bhKey || '');
  let foliageStats = { meshes: 0, ms: 0 };
  const foliageOn = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('foliage') === '0');   // ?foliage=0 comparison
  function scanFoliage() {
    if (!foliageOn) return;
    const fresh = [];
    scene.traverse(o => {
      if (!o.isMesh || o.userData.lookHull || o.userData.lookFoliage || o.isInstancedMesh || o.isSkinnedMesh) return;
      const ms = [].concat(o.material); if (!ms.every(isFoliageMat)) return;
      for (let q = o; q; q = q.parent) if (characters.has(q)) return;
      if (o.geometry.userData.lookFoliage) { o.userData.lookFoliage = true; } else fresh.push(o);
      for (const m of ms) if (toon.roleOf(m) !== 'foliage') toon.patch(m, 'foliage');
    });
    if (fresh.length) {
      const st = prepareFoliage(THREE, fresh); for (const o of fresh) o.geometry.userData.lookFoliage = true;
      foliageStats = { meshes: foliageStats.meshes + st.meshes, ms: foliageStats.ms + st.ms };
    }
  }
  const scan = () => {
    toon.patchObject(scene);
    scanFoliage();
    scene.traverse(o => {
      if (!o.isMesh || o.userData.lookHull) return;
      for (const m of [].concat(o.material)) {
        if (m && AUTO_ROLES[m.userData?.bhKey]) toon.patch(m, AUTO_ROLES[m.userData.bhKey]);
        if (m && lanternGlass(o) && toon.roleOf(m) !== 'glow') toon.patch(m, 'glow');
        // Large structure never fades (trunk shell, bark, heartwood, Hollow walls): only small props can.
        if (m && NEVER_FADE.test(m.userData?.bhKey || '') && !toon.isNoFade(m)) toon.setNoFade(m);
        if (m && m.userData?.bhKey === 'shaft' && o.material !== softShaft) { o.material = softShaft; o.renderOrder = 9; }
        if (o.name === 'bellhollow-wind' && !fx.wind.attached.has(o)) fx.wind.attach(o);   // zero-wiring fallback for wind.js
        // Thin double-sided cloth (sails, awnings, flags, laundry, banners): no self-shadow → no shadow acne stipple.
        if (m && m.side === THREE.DoubleSide && (m.name === 'fabric' || /^cloth|Double$/.test(m.userData?.bhKey || '')) && o.receiveShadow) o.receiveShadow = false;
        if (m && hierarchy && !surfaced.has(m) && toon.isPatched(m) && !characterMaterial(o, m)) { surfaced.add(m); const c = classifySurface(m); if (c) toon.setSurface(m, c); }
        const role = m && AUTO_TILES[m.userData?.bhKey];
        if (role && !tiled.has(m)) { tiled.add(m); toon.setTile(m, tile(role)); }
      }
    });
  };

  const GLOW = { lantern: '#E9B949' };
  // Wind: shared animated streak materials (see wind-material.js). Cached per option set; time driven by update().
  const winds = new Map();
  function windMaterial(opts = {}) {
    const key = JSON.stringify(opts);
    if (!winds.has(key)) winds.set(key, createWindMaterial(THREE, opts));
    return winds.get(key);
  }
  let windClock = 0;
  // Painted tiles for large surfaces (terrain, trunk, walls): loaded on first use, triplanar in world space.
  // role: [file, world metres per tile, amount, tile saturation kept (0 = value-only detail, 1 = full painted colour)]
  const TILES = {
    bark: ['bark', 9.0, .42, .2], timber: ['timber', 1.6, .65, .4],
    'stone-wall': ['ivory-stone', .9, .42, .3], 'stone-floor': ['ivory-stone', 2.4, .7, .4], stone: ['ivory-stone', .9, .42, .3],
  }, tiles = {};
  function tile(name, { scale, amount = TILES[name][2], saturation = TILES[name][3] } = {}) {
    const key = `${name}:${scale ?? ''}:${amount}:${saturation}`;
    if (tiles[key]) return tiles[key];
    const u = { bkTile: { value: null }, bkTileMean: { value: new THREE.Vector3(1, 1, 1) }, bkTileScale: { value: scale ?? TILES[name][1] }, bkTileAmt: { value: 0 }, bkTileSat: { value: saturation } };
    tiles[key] = u;
    new THREE.TextureLoader().loadAsync(TEX(TILES[name][0])).then(t => {
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      // Mean colour (linear) so the tile adds painted variation without shifting the palette.
      const cv = document.createElement('canvas'); cv.width = cv.height = 8; const cx = cv.getContext('2d'); cx.drawImage(t.image, 0, 0, 8, 8);
      const d = cx.getImageData(0, 0, 8, 8).data, m = [0, 0, 0], lin = x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += lin(d[i + k]) / 64;
      u.bkTileMean.value.set(...m); u.bkTile.value = t; u.bkTileAmt.value = amount;
    }).catch(e => console.warn('[look] tile', name, e.message));
    return u;
  }
  const hulls = new Set();
  function applyTo(object, role = 'scene', opts = {}) {
    if (!object) return object;
    if (opts.occluder === false) object.traverse(o => { if (o.isMesh && !o.userData.lookHull) for (const m of [].concat(o.material)) toon.setNoFade(m); });
    if (role === 'character') {
      characters.add(object);
      toon.patchObject(object, 'character');
      if (!object.userData.lookHulled) { object.userData.lookHulled = true; ink.hullCharacter(object, opts); hulls.add(object); }
    } else if (role === 'outline') {
      toon.patchObject(object);
      if (!object.userData.lookHulled) { object.userData.lookHulled = true; (opts.dynamic ? ink.hullCharacter : ink.hullStatic)(object, { ...opts, fade: opts.occluder !== false }); hulls.add(object); }
    } else if (role === 'glow' || role in GLOW) {
      const color = new THREE.Color(opts.color || GLOW[role] || '#E9B949'), strength = opts.strength ?? (role === 'wind' ? 1.1 : 1.6);
      object.traverse(o => {
        if (!o.isMesh || o.userData.lookHull) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m) continue;
          if (m.emissive) { m.emissive.copy(color); m.emissiveIntensity = strength; toon.patch(m, 'glow'); }
          else if (m.color) m.color.copy(color).multiplyScalar(strength);   // unlit ribbons: brighter flat colour
        }
      });
    } else if (role === 'wind') {
      const mat = windMaterial(opts);
      object.traverse(o => { if (o.isMesh && !o.userData.lookHull) { o.material = mat; o.castShadow = false; } });
    } else if (role in TILES) {
      const u = tile(role, opts);
      object.traverse(o => { if (o.isMesh && !o.userData.lookHull) for (const m of [].concat(o.material)) toon.setTile(m, u); });
    } else if (role === 'none') {
      object.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && !toon.isPatched(m)) m.userData.look = false; });
    } else toon.patchObject(object, role === 'scene' ? undefined : role);
    return object;
  }

  // Frame timing → tier degrade.
  let fpsAcc = 0, fpsN = 0, fpsWindow = 0, slowWindows = 0;
  function watchFps(dt) {
    if (!autoTier || tier === "min" || !(dt > 0) || dt > .2) return;   // ignore hitches and catch-up steps
    fpsAcc += dt; fpsN++; fpsWindow += dt;
    if (fpsWindow < 2) return;
    const fps = fpsN / fpsAcc; fpsAcc = fpsN = fpsWindow = 0;
    slowWindows = fps < (tier === 'high' ? 48 : 30) ? slowWindows + 1 : 0;
    if (slowWindows >= 2) { tier = { high: 'low', low: 'grade', grade: 'min' }[tier] || 'min'; slowWindows = 0; console.info('[look] degraded to', tier, 'at', fps.toFixed(1), 'fps'); }
  }

  const lin = new THREE.Color(), tmp = new THREE.Vector3(), WHITE = new THREE.Color(1, 1, 1);
  function apply(r) {
    const U = toon.uniforms;
    sun.color.copy(r.keyColor); sun.intensity = r.keyIntensity; sun.shadow.intensity = r.shadowIntensity;
    hemi.color.copy(r.skyColor); hemi.groundColor.copy(r.groundColor); hemi.intensity = r.hemiIntensity;
    hemi.position.set(0, 1, 0);
    scene.fog.color.copy(r.fogColor); scene.fog.density = r.fogDensity;
    U.bkFogSun.value.copy(r.fogSun); U.bkFogHeight.value.copy(r.fogHeight); U.bkFogShape.value.copy(r.fogShape);
    // Tints are chroma only (normalised to luminance 1): value comes from the lights, hue from the palette.
    const chroma = (out, col) => out.copy(col).multiplyScalar(1 / Math.max(1e-4, .2126 * col.r + .7152 * col.g + .0722 * col.b));
    U.bkBands.value.copy(r.bands); chroma(U.bkShadowTint.value, r.shadowTint); chroma(U.bkShade.value, r.shade); U.bkShadeAmt.value = r.shadeAmt;
    U.bkAmbSteps.value = r.ambSteps; U.bkHeight.value.copy(r.height); U.bkLowTint.value.copy(r.lowTint);
    U.bkRimColor.value.copy(r.rim).multiplyScalar(r.rimIntensity);
    U.bkMist.value.copy(r.fogColor).lerp(WHITE, .35);
    U.bkSway.value = .035 + .045 * restoredNow; U.bkLeafTrans.value.copy(r.keyColor).lerp(C(THREE, '#E8D27A'), .5);
    U.bkAerial.value.copy(r.aerial); U.bkAerialColor.value.copy(r.aerialColor); sky.uniforms.uSunGlow.value = r.sunGlow; shafts.amount = r.shafts;
    if (!beauty) { U.bkAerial.value.z = 0; sky.uniforms.uSunGlow.value = 0; shafts.amount = 0; post.uniforms.uAo.value = 0; } shafts.dir.copy(r.keyDir); shafts.color.copy(r.keyColor);
    U.bkSunDir.value.copy(r.keyDir);
    const S = sky.uniforms;
    S.uTop.value.copy(r.skyTop); S.uHorizon.value.copy(r.skyHorizon); S.uBelow.value.copy(r.skyBelow); S.uSunColor.value.copy(r.sunColor);
    S.uSunDir.value.copy(r.keyDir); S.uCloudAmt.value = r.cloudAmt; S.uCloud.value.copy(r.cloud); S.uCloudShade.value.copy(r.cloudShade);
    const L = sky.layers; S.uMapMix.value = L.map ? r.skyMapMix : 0; S.uBackMix.value = L.back ? r.backMix : 0;
    S.uMapTint.value.copy(r.mapTint); S.uBackTint.value.copy(r.backTint); S.uHaze.value.copy(r.fogColor); S.uHazeAmt.value = r.hazeAmt;
    sky.followSun(r.keyDir);
    renderer.toneMappingExposure = r.exposure;
    const P = post.uniforms;
    P.uLift.value.copy(r.lift); P.uPostGain.value = r.postGain; P.uGain.value.copy(r.gain); P.uSat.value = r.sat; P.uContrast.value = r.contrast; P.uVignette.value = r.vignette;
    P.uInk.value.copy(r.ink); ink.uniforms.uInk.value.copy(r.ink);
  }

  /** dt seconds; area name; restored bool or 0..1; t unused for now (reserved for animated sky). */
  function update(dt = 0, { area: a = area, restored = 0, t, gentle = false } = {}) {
    if (a && rigs[a]) area = a;
    const rTarget = typeof restored === 'number' ? restored : restored ? 1 : 0;
    restoredNow = snapped ? THREE.MathUtils.damp(restoredNow, rTarget, 1.2, dt) : rTarget;
    lerpRig(target, rigs[area], restoredRigs[area], restoredNow);
    if (!snapped) { lerpRig(cur, target, target, 0); snapped = true; }
    else lerpRig(cur, cur, target, 1 - Math.exp(-dt * 1.4));
    apply(cur);
    windClock = Number.isFinite(t) ? t : windClock + dt; softShaft.uniforms.uTime.value = windClock;
    fx.wind.update(dt, windClock, { gentle }); fx.fire.update(dt, windClock); fx.water.update(dt, windClock, cur.keyDir);
    toon.uniforms.bkTime.value = windClock; toon.uniforms.bkFlicker.value = fx.fire.flicker.value;
    fx.wind.particleMaterial.uniforms.uScale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const m of winds.values()) m.uniforms.uTime.value = windClock;
    if ((scanTimer -= dt) <= 0) { scanTimer = .5; scan(); }
    watchFps(dt);
  }

  // ---------- camera-to-hero occluder fade ----------
  // main.js: look.setFocus({hero: heroFeetPosition, extra: [maraFeet, ...]}) every frame (or null to disable).
  let focus = null, focusExplicit = false, autoHero = null; const autoFeet = new THREE.Vector3(), characters = new Set(), camPos = new THREE.Vector3();
  const fA = toon.uniforms.bkFocusA.value, fB = toon.uniforms.bkFocusB.value, pv = new THREE.Vector3(), pw = new THREE.Vector3();
  /** f = {hero: feet Vector3, heroObject?: Object3D (excluded from the probe), extra?: [feet Vector3...]} or null. */
  const fadeOn = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('fade') === '0');   // ?fade=0 comparison
  function setFocus(f) { focusExplicit = true; focus = f && f.hero ? f : null; }
  function projectPx(p, out) { pv.copy(p).project(camera); out.set((pv.x * .5 + .5) * size.x, (pv.y * .5 + .5) * size.y, pv.z); return out; }
  const pFeet = new THREE.Vector3(), pHead = new THREE.Vector3(), pMid = new THREE.Vector3();
  function focusEllipse(feet, strength, i) {
    projectPx(feet, pFeet); projectPx(pw.copy(feet).setY(feet.y + 1.7), pHead);
    if (pFeet.z > 1 || pHead.z > 1) return false;   // behind the camera
    const mid = pw.copy(feet).setY(feet.y + .95), depth = -mid.clone().applyMatrix4(camera.matrixWorldInverse).z;
    projectPx(mid, pMid);
    const scale = Math.max(.75, size.y / 1080), bodyPx = Math.hypot(pHead.x - pFeet.x, pHead.y - pFeet.y);
    fA[i].set(pMid.x, pMid.y, depth, Math.max(60 * scale, bodyPx * .8));
    fB[i].set(feet.y, .8, strength, 0);
    return true;
  }
  function updateFocus() {
    let n = 0;
    // Until the host calls setFocus, focus the first object registered as 'character' (main.js registers the hero first).
    if (!focusExplicit && characters.size) {
      // Fallback: the registered character nearest the camera (the follow camera stays ~11 m from the hero).
      camera.getWorldPosition(camPos); let best = Infinity;
      for (const c of characters) { if (!c.parent || !c.visible) continue; const d = c.getWorldPosition(pw).distanceToSquared(camPos); if (d < best) { best = d; autoHero = c; } }
      focus = autoHero ? { hero: autoHero.getWorldPosition(autoFeet) } : null;
    }
    if (focus) {
      camera.updateMatrixWorld(); renderer.getDrawingBufferSize(size);
      if (focusEllipse(focus.hero, 1, n)) n++;   // full strength: clean core, dithered rim only
      for (const e of focus.extra || []) { if (n >= 4) break; if (e && focusEllipse(e, .8, n)) n++; }
    }
    toon.uniforms.bkFocusCount.value = fadeOn ? n : 0;
  }
  /** Test/telemetry: can the camera see the hero's head? Rays to 5 head points; a ray counts as blocked if the first
   *  non-character hit would stay (fade < 60%) under the shader's fade rule. Raycasts the scene: call sparingly. */
  const ray = new THREE.Raycaster();
  function focusProbe() {
    if (!focus) return null;
    const feet = focus.hero, cam = camera.getWorldPosition(new THREE.Vector3()), right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const heroDepth = -pw.copy(feet).setY(feet.y + .95).applyMatrix4(camera.matrixWorldInverse).z;
    const pts = [[0, 1.5], [-.12, 1.5], [.12, 1.5], [0, 1.62], [0, 1.38]].map(([x, y]) => feet.clone().addScaledVector(right, x).setY(feet.y + y));
    let raw = 0, after = 0; const names = [];
    for (const p of pts) {
      const dir = p.clone().sub(cam), dist = dir.length(); dir.normalize(); ray.set(cam, dir); ray.far = dist - .05;
      const hits = ray.intersectObject(scene, true).filter(h => {
        const o = h.object, m = Array.isArray(o.material) ? o.material[h.face?.materialIndex ?? 0] : o.material;
        if (!o.visible || o.userData.lookHull || o === sky.mesh || !m || m.transparent || m.isShaderMaterial || m.visible === false) return false;
        for (let q = o; q; q = q.parent) if (q === focus.heroObject || q === autoHero || !q.visible) return false;   // the hero and what it carries
        return toon.roleOf(m) !== 'character';
      });
      if (!hits.length) continue;
      raw++;
      const h = hits[0], hitDepth = -h.point.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      const fn = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      const allowed = Math.max(1 - ss(.45, .6, Math.abs(fn.y)), ss(feet.y + 1, feet.y + 1.3, h.point.y));
      const fade = m?.userData && toon.isPatched(m) && !toon.isNoFade?.(m) ? ss(1, 1.6, heroDepth - hitDepth) * allowed * .92 : 0;
      if (fade < .6) { after++; names.push(`${h.object.name || h.object.type}:${(heroDepth - hitDepth).toFixed(1)}m`); }
    }
    return { rays: pts.length, blockedRaw: raw, blockedAfterFade: after, headVisible: after <= 2, blockers: [...new Set(names)].slice(0, 3) };
  }

  function render() {
    toon.uniforms.bkDetail.value = beauty && (tier === 'high' || tier === 'low') ? 1 : 0;
    updateFocus();
    shafts.update(windClock, focus?.hero ?? sun.target.position);
    // Key direction is owned by the rig; the host keeps choosing the shadow focus via sun.target.
    sun.position.copy(sun.target.position).addScaledVector(cur.keyDir, 30);
    sun.target.updateMatrixWorld();
    // Directional key normaliser for the band shader (sum of all directional lights).
    const key = toon.uniforms.bkKeyColor.value.setRGB(0, 0, 0);
    scene.traverseVisible(o => { if (o.isDirectionalLight) key.add(lin.copy(o.color).multiplyScalar(o.intensity)); });
    if (!snapped) update(0);
    renderer.getDrawingBufferSize(size);
    ink.uniforms.uRes.value.copy(size);
    ink.uniforms.uWidth.value = pixelWidth * Math.max(.75, size.y / 1080);
    // renderer.info keeps three's semantics (shadow pass excluded) and adds the post quad, so host telemetry stays honest.
    const info = renderer.info, auto = info.autoReset;
    if (tier === 'min') { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    const rtT = ensureTarget();
    renderer.setRenderTarget(rtT); renderer.render(scene, camera);
    // Shimmer pass (high tier, only when a wind object on DISTORT_LAYER is visible).
    let distort = false;
    if (tier === 'high') {
      scene.traverseVisible(o => { if (!distort && o.layers.isEnabled(DISTORT_LAYER) && (o.isMesh || o.isPoints) && o.geometry) distort = true; });
      if (distort) {
        const w = Math.max(1, rtT.width >> 1), h = Math.max(1, rtT.height >> 1);
        if (!distRT || distRT.width !== w || distRT.height !== h) { distRT?.dispose(); distRT = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false }); }
        const mask = camera.layers.mask, auto = renderer.shadowMap.autoUpdate, clear = renderer.getClearColor(new THREE.Color()), clearA = renderer.getClearAlpha();
        renderer.shadowMap.autoUpdate = false; camera.layers.set(DISTORT_LAYER); scene.overrideMaterial = distortMat;
        distortMat.uniforms.tDepth.value = rtT.depthTexture; distortMat.uniforms.uRes.value.set(w, h); distortMat.uniforms.uTime.value = windClock;
        info.autoReset = false;
        renderer.setRenderTarget(distRT); renderer.setClearColor(NEUTRAL_OFFSET, 1); renderer.render(scene, camera);
        scene.overrideMaterial = null; camera.layers.mask = mask; renderer.shadowMap.autoUpdate = auto; renderer.setClearColor(clear, clearA);
      }
    }
    if (post.defines.BK_DISTORT !== undefined !== distort) { if (distort) post.defines.BK_DISTORT = ''; else delete post.defines.BK_DISTORT; post.needsUpdate = true; }
    post.uniforms.tDistort.value = distort ? distRT.texture : null;
    renderer.setRenderTarget(null);
    info.autoReset = false;
    setEdges(tier === 'high' || tier === 'low', tier === 'high' ? 4 : 2);   // phones: 2 AO pairs
    const P = post.uniforms;
    P.tColor.value = rtT.texture; P.tDepth.value = rtT.depthTexture; P.uRes.value.copy(size);
    P.uNear.value = camera.near; P.uFar.value = camera.far; P.uAoR.value = 6 * Math.max(.75, size.y / 1080); P.uPx.value = Math.max(.75, size.y / 1080) * 1.0;
    renderer.render(postScene, postCam);
    info.autoReset = auto;
  }

  const api = {
    update, render, applyTo,
    ready, setFocus, focusProbe, fx, setInterior,
    /** Shared animated wind material (options: see wind-material.js); time is advanced by look.update(). */
    windMaterial,
    /** Painted sky strip: (urlOrTexture, {range:[minY,maxY], azimuthDeg, mix}). Defaults to textures/v2/sky-dawn.webp. */
    setSkyTexture: sky.setTexture,
    /** Distant backdrop band: (urlOrTexture, {azimuthDeg, arcDeg, range:[minY,maxY], skyFade:[v0,v1], mix}). */
    setBackdrop: sky.setBackdrop,
    /** Tune an area rig (e.g. world-specific Hollow heights: {height: new Vector4(yLow, yHigh, keyLow, ambLow)}). */
    setAreaParams(name, params, { restored = true } = {}) {
      rigs[name] ??= cloneRig(rigs['terrace-dawn']);
      Object.assign(rigs[name], params);
      if (restored) restoredRigs[name] = restoredOf(THREE, rigs[name]);
    },
    get tier() { return tier; }, set tier(v) { tier = v; }, get foliage() { return foliageStats; },
    get area() { return area; }, get restored() { return restoredNow; },
    get lights() { return { sun, hemi }; },
    areas: Object.keys(rigs),
    dispose() { rt?.dispose(); post.dispose(); scene.remove(sky.mesh); },
  };
  // Dev/test telemetry handle (read-only use: focusProbe, tier, area). Harmless in production.
  if (typeof window !== 'undefined') window.__LOOK__ = api;
  return api;
}
