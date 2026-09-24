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
    // Occluder fade: up to 4 focus ellipses. A = (centre px x, centre px y, view depth m, radius px); B = (feet y, x/y aspect, strength, 0)
    bkFocusA: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
    bkFocusB: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
    bkFocusCount: { value: 0 },
    bkMist: { value: new THREE.Color('#E6ECE4') },       // mist colour for the painted under-canopy
    bkTime: { value: 0 }, bkFlicker: { value: 1 }, bkDetail: { value: 1 },
    bkSway: { value: .05 }, bkLeafTrans: { value: new THREE.Color('#F2D48A') },   // foliage wind amplitude (m), sunlit leaf translucency   // bkDetail 0 on fallback tiers: no weathering noise
    bkAerial: { value: new THREE.Vector3(18, 75, .22) }, bkAerialColor: { value: new THREE.Color('#B9CCD6') },   // mid-distance cool layer       // seconds; lantern-glass breathing (fx/fire.js)
  };
  const LUM = 'vec3(0.2126, 0.7152, 0.0722)';
  const patched = new WeakMap();
  const ROLES = { scene: 0, terrain: 1, character: 2, glow: 3, foliage: 4, mist: 5 };

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
uniform vec4 bkFocusA[ 4 ]; uniform vec4 bkFocusB[ 4 ]; uniform int bkFocusCount; uniform vec3 bkMist; uniform float bkTime, bkFlicker, bkDetail; uniform vec3 bkAerial, bkAerialColor;
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
    totalEmissiveRadiance += bkRimColor * bkRim * bkSide * ( 0.08 + bkAlbedo * 1.7 );
    reflectedLight.indirectDiffuse *= 1.12;   // characters sit a touch above the calmed world in value
  }
  #endif
  #if BK_ROLE == 3
    totalEmissiveRadiance *= ( 1.0 + bkGlow * pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), 2.0 ) ) * bkFlicker;
  #endif
}`;
  // Camera-to-hero occluder fade: fragments inside a focus ellipse, clearly nearer the camera than the focus and above
  // its feet, are dithered away with a feathered edge (interleaved-gradient noise, no hard ghost edges). Floors/decks
  // under the hero stay solid (feet test); characters never fade (BK_NOFADE).
  const FADE = `
float bkFadeAmt = 0.0;
#ifndef BK_NOFADE
{
  // Stable ordered dither (4×4 Bayer on 2-px cells): reads as an intentional see-through, not noise.
  vec2 bkBp = mod( floor( gl_FragCoord.xy * 0.5 ), 4.0 );
  vec4 bkR = bkBp.y < 0.5 ? vec4( 0.0, 8.0, 2.0, 10.0 ) : bkBp.y < 1.5 ? vec4( 12.0, 4.0, 14.0, 6.0 ) : bkBp.y < 2.5 ? vec4( 3.0, 11.0, 1.0, 9.0 ) : vec4( 15.0, 7.0, 13.0, 5.0 );
  float bkIgn = ( ( bkBp.x < 0.5 ? bkR.x : bkBp.x < 1.5 ? bkR.y : bkBp.x < 2.5 ? bkR.z : bkR.w ) + 0.5 ) / 16.0;
  // Floors, platforms, inlays, steps and low roofs never fade: flat surfaces fade only if > 1 m above the feet.
  vec3 bkFN = normalize( cross( dFdx( vBkWorldPos ), dFdy( vBkWorldPos ) ) );
  float bkFlatS = smoothstep( 0.45, 0.6, abs( bkFN.y ) );
  for ( int i = 0; i < 4; i ++ ) {
    if ( i >= bkFocusCount ) break;
    vec4 A = bkFocusA[ i ], B = bkFocusB[ i ];
    vec2 d = ( gl_FragCoord.xy - A.xy ) / vec2( A.w * B.y, A.w );
    float inside = 1.0 - smoothstep( 0.35, 0.8, length( d ) );
    float nearer = smoothstep( 1.0, 1.6, A.z - vViewPosition.z );
    float allowed = max( 1.0 - bkFlatS, smoothstep( B.x + 1.0, B.x + 1.3, vBkWorldPos.y ) );
    float f = inside * nearer * allowed * B.z;
    bkFadeAmt = max( bkFadeAmt, f );
    if ( f > bkIgn ) discard;
  }
}
#endif`;
  // Painted under-canopy for flat, low mist surfaces (the world's mist sea): distant forest crowns in drifting mist.
  const MIST = `
#if BK_ROLE == 5
{
  vec3 bkFlat = normalize( cross( dFdx( vBkWorldPos ), dFdy( vBkWorldPos ) ) );
  if ( vBkWorldPos.y < -12.0 && abs( bkFlat.y ) > 0.85 ) {
    vec2 p = vBkWorldPos.xz;
    float crowns = bkFbm( p * 0.16 ), groves = bkFbm( p * 0.035 + 7.0 ), drift = bkFbm( p * 0.022 + vec2( 3.0, 11.0 ) );
    vec3 canopy = mix( vec3( 0.105, 0.20, 0.155 ), vec3( 0.23, 0.36, 0.17 ), smoothstep( 0.3, 0.7, groves ) );
    canopy = mix( canopy * 0.72, canopy * 1.25 + vec3( 0.05, 0.06, 0.0 ), smoothstep( 0.42, 0.72, crowns ) );   // crown tops catch light
    float r = length( p );
    float mist = smoothstep( 0.45, 0.75, drift ) * 0.75 + ( 1.0 - smoothstep( 20.0, 50.0, r ) ) * 0.35;           // mist pools under the tree
    diffuseColor.rgb = mix( canopy, bkMist, clamp( mist, 0.0, 0.92 ) );
  } else if ( abs( bkFlat.y ) < 0.2 ) {
    // Vertical mist sheets are the backdrop waterfalls: bright streaks racing down, foam haze near the mist sea.
    float bkS = bkFbm( vec2( ( vBkWorldPos.x + vBkWorldPos.z ) * 2.2, vBkWorldPos.y * 0.25 + bkTime * 1.8 ) );
    diffuseColor.rgb = mix( vec3( 0.55, 0.74, 0.76 ), vec3( 0.95, 0.98, 0.97 ), smoothstep( 0.35, 0.75, bkS ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, bkMist, 1.0 - smoothstep( -30.0, -18.0, vBkWorldPos.y ) );
  } else {
    diffuseColor.rgb = bkMist * 0.92;   // cloud banks: the area's mist colour, so they melt into the haze
  }
}
#endif`;
  // Weathering on world materials (rule 5) + value/saturation hierarchy (rule 1). Per-material uniforms:
  // bkSurf = (saturation kept, tint amount, moss, grime); bkSurfTint = chroma the albedo is nudged toward.
  const SURFACE = `
#ifdef BK_SURFACE
{
  vec3 bkW = vBkWorldPos;
  vec3 bkFn = normalize( cross( dFdx( bkW ), dFdy( bkW ) ) );
  float bkL = dot( diffuseColor.rgb, ${LUM} );
  // calm large surfaces: desaturate, nudge hue (timber toward honey/grey-brown) at constant value
  diffuseColor.rgb = mix( vec3( bkL ), diffuseColor.rgb, bkSurf.x );
  diffuseColor.rgb = mix( diffuseColor.rgb, bkSurfTint * bkL, bkSurf.y );
  // broad pigment mottling (±7%), rain grime streaks on walls, grime under overhangs, moss on upward faces
  if ( bkDetail > 0.5 ) {
  float bkM = bkNoise( bkW.xz * 0.35 + bkW.y * 0.2 ) * 0.7 + bkNoise( bkW.xz * 1.1 - bkW.y * 0.4 ) * 0.3;
  diffuseColor.rgb *= 0.93 + 0.14 * bkM;
  float bkWall = 1.0 - abs( bkFn.y );
  float bkStreak = smoothstep( 0.55, 0.85, bkNoise( vec2( ( bkW.x + bkW.z ) * 2.3, bkW.y * 0.35 ) ) );
  diffuseColor.rgb *= 1.0 - bkSurf.w * ( 0.12 * bkStreak * bkWall + 0.28 * smoothstep( -0.2, -0.7, bkFn.y ) );
  float bkMoss = smoothstep( 0.55, 0.9, bkFn.y ) * smoothstep( 0.55, 0.75, bkNoise( bkW.xz * 1.3 + 9.0 ) * 0.65 + bkM * 0.35 ) * bkSurf.z;
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.16, 0.25, 0.12 ) * ( 0.8 + 0.4 * bkM ), bkMoss * 0.55 );
  }
}
#endif`;
  const LEAF_PARS_V = `
attribute float aCrease; varying float vBkCrease; uniform float bkTime, bkSway;`;
  const LEAF_SWAY = `
    // Gentle sway: slow common gust + local flutter, stronger toward the top of a mass; stronger when restored.
    {
      vec4 bkSw = modelMatrix * vec4( transformed, 1.0 );
      float bkPh = bkTime * 1.3 + bkSw.x * 0.35 + bkSw.z * 0.27;
      vec3 bkOff = vec3( sin( bkPh ) + 0.35 * sin( bkTime * 3.1 + bkSw.y * 1.7 ), 0.0, 0.6 * cos( bkPh * 0.8 + bkSw.x * 0.2 ) ) * bkSway;
      transformed += bkOff * ( 0.4 + 0.6 * clamp( normal.y * 0.5 + 0.5, 0.0, 1.0 ) );
    }
    vBkCrease = aCrease;`;
  const LEAF_PARS_F = `
varying float vBkCrease; uniform vec3 bkLeafTrans;
float bkH3( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float bkN3( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( bkH3( i ), bkH3( i + vec3( 1, 0, 0 ) ), f.x ), mix( bkH3( i + vec3( 0, 1, 0 ) ), bkH3( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( bkH3( i + vec3( 0, 0, 1 ) ), bkH3( i + vec3( 1, 0, 1 ) ), f.x ), mix( bkH3( i + vec3( 0, 1, 1 ) ), bkH3( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }`;
  // Ragged leafy silhouette at the MASS rim (alpha test) + painted leaf clusters/flecks + cool crease shadow.
  const LEAF_ALBEDO = `
{
  vec3 bkVn = normalize( normal ); float bkRimL = 1.0 - abs( dot( bkVn, normalize( vViewPosition ) ) );
  float bkLeaf = bkN3( vBkWorldPos * 2.6 ) * 0.6 + bkN3( vBkWorldPos * 6.0 ) * 0.4;
  if ( bkRimL > 0.52 && bkLeaf < ( bkRimL - 0.52 ) * 2.1 ) discard;
  // One mass, one palette ramp: albedo from the MASS normal height (sunlit tips → mid → cool underside), so the
  // lobes' separate materials stop reading as coloured balls. The authored colour keeps 25% for variety.
  float bkUpN = inverseTransformDirection( bkVn, viewMatrix ).y;
  vec3 bkRamp = mix( vec3( 0.045, 0.105, 0.09 ), vec3( 0.11, 0.27, 0.08 ), smoothstep( -0.6, 0.15, bkUpN ) );   // deep blue-green → #5E8F4E
  bkRamp = mix( bkRamp, vec3( 0.34, 0.5, 0.14 ), smoothstep( 0.45, 0.95, bkUpN ) );                               // → #A6C46A tips
  diffuseColor.rgb = mix( bkRamp, diffuseColor.rgb, 0.25 );
  float bkCl = bkN3( vBkWorldPos * 1.9 + 3.0 );
  diffuseColor.rgb *= mix( 0.68, 1.14, smoothstep( 0.3, 0.72, bkCl ) ) * ( 1.0 + 0.12 * step( 0.72, bkLeaf ) );
  float bkIn = smoothstep( 0.08, 0.5, vBkCrease );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.42, 0.56, 0.62 ), bkIn * 0.8 );
}`;
  const LEAF_TRANS = `
#if BK_ROLE == 4 && NUM_DIR_LIGHTS > 0
  {
    // Subsurface-ish translucency: looking toward the sun, the mass rim glows warm gold-green.
    float bkBack = pow( saturate( dot( - geometryViewDir, directionalLights[ 0 ].direction ) ), 3.0 );
    float bkEdge = 1.0 - saturate( dot( normal, geometryViewDir ) );
    totalEmissiveRadiance += bkLeafTrans * diffuseColor.rgb * bkBack * ( 0.35 + 0.65 * bkEdge ) * 0.9;
  }
#endif`;
  const NOISE = `
float bkHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float bkNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( bkHash( i ), bkHash( i + vec2( 1, 0 ) ), f.x ), mix( bkHash( i + vec2( 0, 1 ) ), bkHash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
float bkFbm( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 4; i ++ ) { s += a * bkNoise( p ); p *= 2.03; a *= 0.5; } return s; }`;
  const FOG = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    // Aerial perspective: nothing within bkFogShape.x metres, then exponential haze capped at bkFogShape.y so distant
    // silhouettes (crags, the far bell) stay readable instead of dissolving into flat fog.
    float fogFactor = bkFogShape.y * ( 1.0 - exp( - fogDensity * max( vFogDepth - bkFogShape.x, 0.0 ) ) );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  // Rule 7: the mid distance goes cooler and lighter before the far haze takes over.
  gl_FragColor.rgb = mix( gl_FragColor.rgb, bkAerialColor, smoothstep( bkAerial.x, bkAerial.y, vFogDepth ) * bkAerial.z );
  vec3 bkView = normalize( vBkWorldPos - cameraPosition );
  float bkSunF = pow( saturate( dot( bkView, bkSunDir ) ), 5.0 );
  float bkLowF = 1.0 - smoothstep( bkFogHeight.x, bkFogHeight.y, vBkWorldPos.y );
  fogFactor = saturate( fogFactor * ( 1.0 + bkLowF * bkFogHeight.z ) );
  #if BK_ROLE == 5
    fogFactor *= 0.55;   // the painted under-canopy carries its own mist; keep its forms readable from the branches
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, mix( fogColor, bkFogSun, bkSunF ), fogFactor );
#endif`;

  function inject(shader, info, m) {
    Object.assign(shader.uniforms, U);
    const spec = m.isMeshStandardMaterial && m.metalness > .2 ? '0.55' : '0.2';
    const noFade = info.noFade || info.role === 'character' || info.role === 'mist';
    const defs = `#define BK_ROLE ${ROLES[info.role] ?? 0}\n#define BK_SPEC ${spec}\n${info.soft ? '#define BK_SOFT\n' : ''}${noFade ? '#define BK_NOFADE\n' : ''}`;
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
    f = f.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + FADE);
    if (info.role === 'mist') { f = f.replace('#include <common>', '#include <common>' + NOISE); f = f.replace('#include <color_fragment>', '#include <color_fragment>' + MIST); }
    if (info.role === 'foliage') {
      v = v.replace('#include <common>', '#include <common>' + LEAF_PARS_V);
      v = v.replace('#include <begin_vertex>', '#include <begin_vertex>' + LEAF_SWAY);
      f = f.replace('#include <common>', '#include <common>' + LEAF_PARS_F);
      f = f.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>' + LEAF_ALBEDO);
      f = f.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + LEAF_TRANS);
    }
    if (info.surface) {
      shader.uniforms.bkSurf = { value: info.surface.v }; shader.uniforms.bkSurfTint = { value: info.surface.tint };
      f = '#define BK_SURFACE\n' + f;
      if (info.role !== 'mist') f = f.replace('#include <common>', '#include <common>' + NOISE);
      f = f.replace('#include <common>', '#include <common>\nuniform vec4 bkSurf; uniform vec3 bkSurfTint;');
      f = f.replace('#include <color_fragment>', '#include <color_fragment>' + SURFACE);
    }
    // Ink mask for the post pass: terrain writes alpha .5 (opaque, so blending is off) → no crease ink on ground folds.
    if (info.role === 'terrain' && !m.transparent) f = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = 0.5;');
    // Fading occluders mark alpha .25 so the post pass does not ink every dither hole (no dotted screen-door outlines).
    if (!m.transparent) f = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if ( bkFadeAmt > 0.02 ) gl_FragColor.a = 0.25;');
    if (info.role === 'mist' && !m.transparent) f = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = 0.25;');   // no ink on mist/water
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
      return (ownKey ? base : priorKey.call(this)) + `|bk-look-3:${info.role}:${info.soft ? 1 : 0}:${info.tile ? 't' : ''}:${info.noFade ? 'n' : ''}:${info.surface ? 's' : ''}:${this.isMeshStandardMaterial && this.metalness > .2 ? 1 : 0}`;
    };
    m.needsUpdate = true;
    return true;
  }
  /** Exclude a material from the occluder fade (guardian, props the hero must always see). */
  function setNoFade(m, on = true) {
    if (!patch(m)) return false;
    const info = patched.get(m);
    if (info.noFade !== on) { info.noFade = on; m.needsUpdate = true; }
    return true;
  }
  /** World surface treatment: {sat, tint:Color, tintAmt, moss, grime} (values live per material, one program per role). */
  function setSurface(m, o) {
    if (!patch(m)) return false;
    const info = patched.get(m), had = !!info.surface;
    info.surface ??= { v: new THREE.Vector4(), tint: new THREE.Color(1, 1, 1) };
    info.surface.v.set(o.sat ?? 1, o.tintAmt ?? 0, o.moss ?? 0, o.grime ?? 0); if (o.tint) info.surface.tint.copy(o.tint);
    if (!had) m.needsUpdate = true;
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
  return { uniforms: U, patch, patchObject, setTile, setNoFade, setSurface, isPatched: m => patched.has(m), isNoFade: m => !!patched.get(m)?.noFade, roleOf: m => patched.get(m)?.role };
}
