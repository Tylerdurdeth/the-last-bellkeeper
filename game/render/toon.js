/**
 * Toon patch for lit three.js materials (Standard/Physical/Toon/Lambert/Phong).
 *
 * The key (directional) light is re-quantised into three soft-edged bands; point and spot lights stay smooth
 * (lanterns). Ambient/hemisphere light is tinted toward the deep-shade palette colour in the shadow band, a vertical
 * grade darkens low areas (the Hollow well), fog becomes aerial perspective (sun-side warm), characters get a thin warm
 * rim, glow materials get a fresnel lift on their emissive. Materials are patched in place: onBeforeCompile is composed
 * with any prior hook and the program cache key is extended, so existing vertex colours, maps and art-direction
 * shaders keep working. All patched materials share one uniform set, so the rig crossfade is one upload per program.
 */
export function createToon(THREE) {
  const U = {
    bkKeyColor: { value: new THREE.Color(1, 1, 1) },   // sum of directional light colour × intensity (linear)
    bkBands: { value: new THREE.Vector4(.10, .46, .045, .52) }, // terminator, lit threshold, edge softness, mid level
    bkShadowTint: { value: new THREE.Color(1, 1, 1) },  // chroma multiplier for the shadow band
    bkShade: { value: new THREE.Color(0, 0, 0) },       // deep-shade colour painted into the darkest band
    bkShadeAmt: { value: .12 },
    bkHeight: { value: new THREE.Vector4(-100, -99, 1, 1) }, // y low, y high, key at low, ambient at low
    bkLowTint: { value: new THREE.Color(1, 1, 1) },
    bkAmbSteps: { value: .6 },
    bkRimColor: { value: new THREE.Color(1, .8, .55) },
    bkSunDir: { value: new THREE.Vector3(0, 1, 0) },    // world space, toward the light
    bkFogSun: { value: new THREE.Color(1, .85, .7) },
    bkFogHeight: { value: new THREE.Vector3(-100, -99, 0) },
    bkGlow: { value: 1.2 },
    bkFogShape: { value: new THREE.Vector2(12, .85) },   // start distance (m), max haze
  };
  const LUM = 'vec3(0.2126, 0.7152, 0.0722)';
  const patched = new WeakMap();
  const ROLES = { scene: 0, terrain: 1, character: 2, glow: 3, foliage: 4 };

  const src = THREE.ShaderChunk.lights_fragment_begin;
  const dirStart = src.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )');
  const rectStart = src.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 )');
  if (dirStart < 0 || rectStart < 0) throw Error('look: lights_fragment_begin layout changed');
  const LIGHTS = src.slice(0, dirStart)
    + 'vec3 bkSun = vec3( 0.0 );\nvec3 bkDD0 = reflectedLight.directDiffuse;\n'
    + src.slice(dirStart, rectStart).replace('RE_Direct( directLight,',
      'bkSun += directLight.color * saturate( dot( geometryNormal, directLight.direction ) );\n\t\tRE_Direct( directLight,')
    + 'vec3 bkDirDiffuse = reflectedLight.directDiffuse - bkDD0;\n'
    + src.slice(rectStart).replace('getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal )',
      'bkHemi( hemisphereLights[ i ], geometryNormal )');

  const FRAG_PARS = `
uniform vec3 bkKeyColor; uniform vec4 bkBands; uniform vec3 bkShadowTint; uniform vec3 bkShade; uniform float bkShadeAmt;
uniform vec4 bkHeight; uniform vec3 bkLowTint; uniform float bkAmbSteps; uniform vec3 bkRimColor; uniform vec3 bkSunDir;
uniform vec3 bkFogSun; uniform vec3 bkFogHeight; uniform float bkGlow; uniform vec2 bkFogShape;
varying vec3 vBkWorldPos;`;
  const HEMI = `
vec3 bkHemi( const in HemisphereLight h, const in vec3 n ) {
  float w = 0.5 * dot( n, h.direction ) + 0.5;
  // Flatten the sky/ground gradient into a two-step painted fill.
  w = mix( w, 0.25 + 0.5 * smoothstep( 0.30, 0.70, w ), bkAmbSteps );
  return mix( h.groundColor, h.skyColor, w );
}`;
  const AFTER_LIGHTS = `
{
  float bkSoft = bkBands.z;
  #if BK_ROLE == 2
    bkSoft *= 0.7;
  #endif
  #ifdef BK_SOFT
    bkSoft *= 3.0;
  #endif
  float bkK = dot( bkSun, ${LUM} ) / max( dot( bkKeyColor, ${LUM} ), 1e-4 );
  float bkBand = bkBands.w * smoothstep( bkBands.x - bkSoft, bkBands.x + bkSoft, bkK )
               + ( 1.0 - bkBands.w ) * smoothstep( bkBands.y - bkSoft, bkBands.y + bkSoft, bkK );
  vec3 bkAlbedo = diffuseColor.rgb;
  #if BK_ROLE == 1
    // Ground keeps a little of the smooth term so large planes do not posterise into stripes.
    bkBand = mix( bkBand, clamp( bkK * 1.1, 0.0, 1.0 ), 0.18 );
  #endif
  reflectedLight.directDiffuse += BRDF_Lambert( bkAlbedo ) * bkKeyColor * bkBand - bkDirDiffuse;
  float bkDark = 1.0 - bkBand;
  float bkH = smoothstep( bkHeight.x, bkHeight.y, vBkWorldPos.y );
  // Shadow band: hue shift toward the deep-shade teal at the same luminance (never grey, never muddy-dark).
  vec3 bkInd = reflectedLight.indirectDiffuse * mix( vec3( 1.0 ), bkShadowTint, bkDark );
  float bkIndL = dot( bkInd, ${LUM} );
  bkInd = mix( bkInd, bkShade * bkIndL, bkShadeAmt * bkDark );
  reflectedLight.indirectDiffuse = bkInd * mix( bkLowTint * bkHeight.w, vec3( 1.0 ), bkH );
  reflectedLight.directDiffuse *= mix( bkHeight.z, 1.0, bkH );
  reflectedLight.directSpecular *= BK_SPEC;
  #if BK_ROLE == 2
  {
    float bkNdv = saturate( dot( normal, geometryViewDir ) );
    float bkRim = smoothstep( 0.72, 0.84, 1.0 - bkNdv );
    float bkSide = 0.25;
    #if NUM_DIR_LIGHTS > 0
      bkSide = saturate( dot( normal, directionalLights[ 0 ].direction ) * 1.2 + 0.25 );
    #endif
    // Warm rim tinted by the surface's own paint (hair stays brown, coat goes light coral), never a white halo.
    totalEmissiveRadiance += bkRimColor * bkRim * bkSide * ( 0.08 + bkAlbedo * 1.4 );
  }
  #endif
  #if BK_ROLE == 3
    totalEmissiveRadiance *= 1.0 + bkGlow * pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), 2.0 );
  #endif
}`;
  const FOG = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    // Aerial perspective: nothing within bkFogShape.x metres, then exponential haze capped at bkFogShape.y so distant
    // silhouettes (crags, the far bell) stay readable instead of dissolving into flat fog.
    float fogFactor = bkFogShape.y * ( 1.0 - exp( - fogDensity * max( vFogDepth - bkFogShape.x, 0.0 ) ) );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  vec3 bkView = normalize( vBkWorldPos - cameraPosition );
  float bkSunF = pow( saturate( dot( bkView, bkSunDir ) ), 5.0 );
  float bkLowF = 1.0 - smoothstep( bkFogHeight.x, bkFogHeight.y, vBkWorldPos.y );
  fogFactor = saturate( fogFactor * ( 1.0 + bkLowF * bkFogHeight.z ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, bkFogSun, bkSunF ), fogFactor );
#endif`;

  function inject(shader, info, m) {
    Object.assign(shader.uniforms, U);
    const spec = m.isMeshStandardMaterial && m.metalness > .2 ? '0.55' : '0.2';
    const defs = `#define BK_ROLE ${ROLES[info.role] ?? 0}\n#define BK_SPEC ${spec}\n${info.soft ? '#define BK_SOFT\n' : ''}`;
    let v = shader.vertexShader, f = shader.fragmentShader;
    v = v.replace('#include <common>', '#include <common>\nvarying vec3 vBkWorldPos;');
    v = v.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 bkW = vec4( transformed, 1.0 );
      #ifdef USE_BATCHING
        bkW = batchingMatrix * bkW;
      #endif
      #ifdef USE_INSTANCING
        bkW = instanceMatrix * bkW;
      #endif
      vBkWorldPos = ( modelMatrix * bkW ).xyz;`);
    f = defs + f;
    f = f.replace('#include <common>', '#include <common>' + FRAG_PARS);
    f = f.replace('#include <lights_pars_begin>', '#include <lights_pars_begin>' + HEMI);
    f = f.replace('#include <lights_fragment_begin>', LIGHTS);
    f = f.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + AFTER_LIGHTS);
    f = f.replace('#include <fog_fragment>', FOG);
    // Ink mask for the post pass: terrain writes alpha .5 (opaque, so blending is off) → no crease ink on ground folds.
    if (info.role === 'terrain' && !m.transparent) f = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = 0.5;');
    if (info.tile) {
      Object.assign(shader.uniforms, info.tile.uniforms);
      f = f.replace('#include <common>', '#include <common>\nuniform sampler2D bkTile; uniform vec3 bkTileMean; uniform float bkTileScale, bkTileAmt, bkTileSat;');
      f = f.replace('#include <map_fragment>', `#include <map_fragment>
  {
    // World-space triplanar painted tile, normalised by its mean so the asset's palette colour is kept.
    vec3 bkFn = abs( normalize( cross( dFdx( vBkWorldPos ), dFdy( vBkWorldPos ) ) ) );
    vec3 bkTw = pow( bkFn, vec3( 4.0 ) ); bkTw /= bkTw.x + bkTw.y + bkTw.z + 1e-4;
    vec3 bkP = vBkWorldPos / bkTileScale;
    vec3 bkT = texture2D( bkTile, bkP.zy ).rgb * bkTw.x + texture2D( bkTile, bkP.xz ).rgb * bkTw.y + texture2D( bkTile, bkP.xy ).rgb * bkTw.z;
    vec3 bkRel = bkT / max( bkTileMean, vec3( 0.02 ) );
    // Desaturate the tile's own hue toward pure value variation so the palette colour of the asset wins.
    float bkRelL = dot( bkT, ${LUM} ) / max( dot( bkTileMean, ${LUM} ), 0.02 );
    bkRel = mix( vec3( bkRelL ), bkRel, bkTileSat );
    diffuseColor.rgb *= mix( vec3( 1.0 ), bkRel, bkTileAmt );
  }`);
    }
    shader.vertexShader = v; shader.fragmentShader = f;
  }

  const eligible = m => m && (m.isMeshStandardMaterial || m.isMeshToonMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)
    && m.userData?.look !== false;

  /** Patch one material in place. Calling again with a role upgrades it (e.g. scene → character). */
  function patch(m, role) {
    if (!eligible(m)) return false;
    let info = patched.get(m);
    if (info) {
      if (role && role !== info.role) { info.role = role; m.needsUpdate = true; }
      return true;
    }
    info = { role: role || 'scene', soft: !!(m.isMeshToonMaterial && m.gradientMap?.image?.width > 8) };
    if (!role && m.name === 'ground') info.role = 'terrain';
    patched.set(m, info);
    const prior = m.onBeforeCompile, priorKey = m.customProgramCacheKey;
    // three's default key is onBeforeCompile.toString(): after wrapping, every material would report the SAME wrapper
    // source and silently share one program (e.g. the hero's iris shader lost). Keep the original hook's identity.
    const ownKey = priorKey === THREE.Material.prototype.customProgramCacheKey;
    const base = ownKey ? String(prior) : null;
    m.onBeforeCompile = function (shader, renderer) { prior?.call(this, shader, renderer); inject(shader, info, this); };
    m.customProgramCacheKey = function () {
      return (ownKey ? base : priorKey.call(this)) + `|bk-look-2:${info.role}:${info.soft ? 1 : 0}:${info.tile ? 't' : ''}:${this.isMeshStandardMaterial && this.metalness > .2 ? 1 : 0}`;
    };
    m.needsUpdate = true;
    return true;
  }
  /** Attach a painted tile (shared uniforms object {bkTile, bkTileMean, bkTileScale, bkTileAmt}) to a material. */
  function setTile(m, uniforms) {
    if (!patch(m)) return false;
    const info = patched.get(m);
    if (info.tile?.uniforms !== uniforms) { info.tile = { uniforms }; m.needsUpdate = true; }
    return true;
  }
  function patchObject(root, role) {
    let n = 0;
    root.traverse(o => {
      if (!o.isMesh || o.userData.lookHull) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (patch(m, role)) n++;
    });
    return n;
  }
  return { uniforms: U, patch, patchObject, setTile, isPatched: m => patched.has(m), roleOf: m => patched.get(m)?.role };
}
