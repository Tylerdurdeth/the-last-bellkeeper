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
export { createWindMaterial };
import { setPaintedCel } from '../art-direction.js';

const C = (THREE, h) => new THREE.Color(h);

/** Rig parameters. Colours are sRGB hex (converted to linear), dirs point toward the light. */
function baseRigs(THREE) {
  const c = h => C(THREE, h), v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const rig = o => ({
    keyDir: v(.86, .62, .34), keyColor: c('#FFE2BE'), keyIntensity: 2.9,
    skyColor: c('#CFE2DF'), groundColor: c('#5A7466'), hemiIntensity: 1.6,
    fogColor: c('#D2DCD0'), fogSun: c('#F8D8AE'), fogDensity: .014, fogShape: new THREE.Vector2(14, .7), fogHeight: new THREE.Vector3(-3, 6, .6),
    skyTop: c('#8FC3D6'), skyHorizon: c('#F6D9B0'), skyBelow: c('#B8B79E'), sunColor: c('#FFD49A'), cloudAmt: .85,
    cloud: c('#FFF0DA'), cloudShade: c('#C8B6B3'),
    bands: new THREE.Vector4(.10, .46, .045, .52),
    shadowTint: c('#B2C0CC'), shade: c('#2C4A45'), shadeAmt: .18, ambSteps: .6,
    height: new THREE.Vector4(-100, -99, 1, 1), lowTint: c('#FFFFFF'),
    rim: c('#FFB870'), rimIntensity: .9,
    exposure: 1.0,
    lift: new THREE.Vector3(.004, .018, .022), gain: new THREE.Vector3(1.03, 1.0, .96), sat: 1.04, contrast: 1.08,
    vignette: .20, ink: c('#2A1E1C'),
    skyMapMix: 1, mapTint: c('#FFFFFF'), backMix: 1, backTint: c('#FFFFFF'), hazeAmt: .22,
    restoreExposure: 1.24, restoreWarm: 1, shadowIntensity: 1,   // how hard restoration brightens / warms this area
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
      vignette: .14, mapTint: c('#F4F8FF'), hazeAmt: .12,
      restoreExposure: 1.2, restoreWarm: .45,   // already bright: warmth and fill, not exposure (no clipping)
    }),
    // Warm shaft from above, cool darker lower well.
    'hollow': rig({
      keyDir: v(.66, .9, .66), keyColor: c('#FFD39A'), keyIntensity: 3.4,
      skyColor: c('#B6CCD0'), groundColor: c('#34494C'), hemiIntensity: 1.6,
      fogColor: c('#4F6772'), fogSun: c('#D8AE74'), fogDensity: .018, fogShape: new THREE.Vector2(10, .45), fogHeight: new THREE.Vector3(-14, -2, .8),
      skyTop: c('#5E817C'), skyHorizon: c('#B89A73'), skyBelow: c('#2E4843'), sunColor: c('#FFC27A'), cloudAmt: 0,
      bands: new THREE.Vector4(.12, .50, .05, .50), shadowTint: c('#9FB6C8'), shade: c('#2C4A45'), shadeAmt: .22,
      height: new THREE.Vector4(-16, 3, .5, .5), lowTint: c('#9FC0C2'),
      rim: c('#FFB060'), rimIntensity: 1.1, exposure: 1.0,
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
  o.height.z = Math.min(1, o.height.z + .25); o.height.w = Math.min(1, o.height.w + .25);
  o.mapTint.lerp(C(THREE, '#FFE7C4'), .45); o.backTint.lerp(C(THREE, '#FFEBCB'), .4); o.hazeAmt *= .6;
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

export function createLook({ THREE, renderer, scene, camera, tier: forcedTier, pixelWidth = 1.5, sky: skyOpts = true, autoTiles = true } = {}) {
  setPaintedCel(false);   // the old art-direction cel ramp would stack on top of the toon bands
  const toon = createToon(THREE), ink = createOutlines(THREE), sky = createSky(THREE);
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
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: .1 }, uFar: { value: 100 },
      uPx: { value: 1 }, uInk: { value: new THREE.Color('#2A1E1C') }, uInkAmt: { value: .92 }, uFade: { value: new THREE.Vector2(18, 55) },
      uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
    fragmentShader: `#include <common>
uniform sampler2D tColor, tDepth; uniform vec2 uRes, uFade; uniform float uNear, uFar, uPx, uInkAmt, uSat, uContrast, uVignette;
uniform vec3 uInk, uLift, uGain; varying vec2 vUv;
float linZ( vec2 uv ) { float d = texture2D( tDepth, uv ).x; return uNear * uFar / ( uFar - d * ( uFar - uNear ) ); }
vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
  vec4 src = texture2D( tColor, vUv );
  vec3 col = src.rgb;
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
    e *= step( z0, uFar * 0.85 );
  #endif
  #ifdef TONE_MAPPING
    col = toneMapping( col );
  #endif
  col = mix( saturate( col ), uInk, e * uInkAmt );
  vec3 s = toSRGB( saturate( col ) );
  // LUT-ish grade in display space: lift (tinted shadows), gain (warm highlights), saturation, soft contrast.
  float l = dot( s, vec3( 0.2126, 0.7152, 0.0722 ) );
  s = s * uGain + uLift * ( 1.0 - l );
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
  function setEdges(on) { const had = !!post.defines.BK_EDGES; if (on) post.defines.BK_EDGES = ''; else delete post.defines.BK_EDGES; if (had !== on) post.needsUpdate = true; }

  // Registration: every lit material in the scene is patched (scanned periodically, cheap).
  let scanTimer = 0;
  // World surface materials (bellhollow kit, userData.bhKey) get painted tiles automatically; pass autoTiles:false to opt out.
  const AUTO_TILES = autoTiles ? { bark: 'bark', barkShade: 'bark', deck: 'timber', stone: 'stone-wall', stoneShade: 'stone-wall' } : {};
  // Modelled cobble paving is ground: silhouette ink only (no crease ink on every cobble).
  const AUTO_ROLES = { paving: 'terrain' };
  const tiled = new WeakSet();
  const scan = () => {
    toon.patchObject(scene);
    scene.traverse(o => {
      if (!o.isMesh || o.userData.lookHull) return;
      for (const m of [].concat(o.material)) {
        if (m && AUTO_ROLES[m.userData?.bhKey]) toon.patch(m, AUTO_ROLES[m.userData.bhKey]);
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
    bark: ['bark', 6.0, .6, .25], timber: ['timber', 1.6, .65, .4],
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
    if (role === 'character') {
      toon.patchObject(object, 'character');
      if (!object.userData.lookHulled) { object.userData.lookHulled = true; ink.hullCharacter(object, opts); hulls.add(object); }
    } else if (role === 'outline') {
      toon.patchObject(object);
      if (!object.userData.lookHulled) { object.userData.lookHulled = true; (opts.dynamic ? ink.hullCharacter : ink.hullStatic)(object, opts); hulls.add(object); }
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

  const lin = new THREE.Color(), tmp = new THREE.Vector3();
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
    U.bkSunDir.value.copy(r.keyDir);
    const S = sky.uniforms;
    S.uTop.value.copy(r.skyTop); S.uHorizon.value.copy(r.skyHorizon); S.uBelow.value.copy(r.skyBelow); S.uSunColor.value.copy(r.sunColor);
    S.uSunDir.value.copy(r.keyDir); S.uCloudAmt.value = r.cloudAmt; S.uCloud.value.copy(r.cloud); S.uCloudShade.value.copy(r.cloudShade);
    const L = sky.layers; S.uMapMix.value = L.map ? r.skyMapMix : 0; S.uBackMix.value = L.back ? r.backMix : 0;
    S.uMapTint.value.copy(r.mapTint); S.uBackTint.value.copy(r.backTint); S.uHaze.value.copy(r.fogColor); S.uHazeAmt.value = r.hazeAmt;
    sky.followSun(r.keyDir);
    renderer.toneMappingExposure = r.exposure;
    const P = post.uniforms;
    P.uLift.value.copy(r.lift); P.uGain.value.copy(r.gain); P.uSat.value = r.sat; P.uContrast.value = r.contrast; P.uVignette.value = r.vignette;
    P.uInk.value.copy(r.ink); ink.uniforms.uInk.value.copy(r.ink);
  }

  /** dt seconds; area name; restored bool or 0..1; t unused for now (reserved for animated sky). */
  function update(dt = 0, { area: a = area, restored = 0, t } = {}) {
    if (a && rigs[a]) area = a;
    const rTarget = typeof restored === 'number' ? restored : restored ? 1 : 0;
    restoredNow = snapped ? THREE.MathUtils.damp(restoredNow, rTarget, 1.2, dt) : rTarget;
    lerpRig(target, rigs[area], restoredRigs[area], restoredNow);
    if (!snapped) { lerpRig(cur, target, target, 0); snapped = true; }
    else lerpRig(cur, cur, target, 1 - Math.exp(-dt * 1.4));
    apply(cur);
    windClock = Number.isFinite(t) ? t : windClock + dt;
    for (const m of winds.values()) m.uniforms.uTime.value = windClock;
    if ((scanTimer -= dt) <= 0) { scanTimer = .5; scan(); }
    watchFps(dt);
  }

  function render() {
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
    renderer.setRenderTarget(null);
    info.autoReset = false;
    setEdges(tier === 'high' || tier === 'low');
    const P = post.uniforms;
    P.tColor.value = rtT.texture; P.tDepth.value = rtT.depthTexture; P.uRes.value.copy(size);
    P.uNear.value = camera.near; P.uFar.value = camera.far; P.uPx.value = Math.max(.75, size.y / 1080) * 1.0;
    renderer.render(postScene, postCam);
    info.autoReset = auto;
  }

  return {
    update, render, applyTo,
    ready,
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
    get tier() { return tier; }, set tier(v) { tier = v; },
    get area() { return area; }, get restored() { return restoredNow; },
    get lights() { return { sun, hemi }; },
    areas: Object.keys(rigs),
    dispose() { rt?.dispose(); post.dispose(); scene.remove(sky.mesh); },
  };
}
