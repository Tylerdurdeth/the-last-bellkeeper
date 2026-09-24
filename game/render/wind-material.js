/**
 * Stylised wind material: painted brush streaks that flow along ribbons and up updraft columns. One cheap shader,
 * no textures. Cyan #8FD3E0 is reserved for wind (style lock).
 *
 *   import { createWindMaterial } from './render/wind-material.js';
 *   const ribbonMat = createWindMaterial(THREE, { shape: 'ribbon' });              // flat strips / tubes: uv.x along
 *   const columnMat = createWindMaterial(THREE, { shape: 'column', flow: 'v' });   // CylinderGeometry(openEnded): uv.y up
 *   // per frame (look.update does this for materials it created via look.windMaterial()/applyTo(o,'wind')):
 *   ribbonMat.uniforms.uTime.value = t;
 *
 * Options (all optional; each is also a live uniform, e.g. mat.uniforms.uOpacity.value = .5):
 *   shape      'ribbon' (edges across uv) | 'column' (fresnel edges; for cylinders/cones seen from outside)
 *   flow       'u' | 'v'   which uv axis runs WITH the wind (default: ribbon 'u', column 'v')
 *   length     metres (or repeats) along the flow axis, sets streak density along the strip (default 6)
 *   lanes      streak lanes across the strip (default ribbon 3, column 12 around the circumference)
 *   speed      streak speed in uv-lengths/s (default 1.2); negative reverses
 *   opacity    overall alpha (default .9)
 *   color/core/rim   body colour (#8FD3E0), bright core (#F4FFFF), darker rim (#2F7F8E)
 *   vertexAlpha true when the geometry carries a vec4 'color' attribute (RGBA): rgb tints, a fades (e.g. wind.js batch)
 *   fadeEnds   fraction of the flow axis faded in/out at the ends (default .12)
 * Transparent, depthWrite off, double sided, fog aware. Works with the toon look (it is not toon-patched).
 */
export function createWindMaterial(THREE, o = {}) {
  const column = o.shape === 'column';
  const flowV = (o.flow ?? (column ? 'v' : 'u')) === 'v';
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uSpeed: { value: o.speed ?? 1.2 }, uLength: { value: o.length ?? 6 },
      uLanes: { value: o.lanes ?? (column ? 12 : 3) }, uOpacity: { value: o.opacity ?? .9 }, uFade: { value: o.fadeEnds ?? .12 },
      uColor: { value: new THREE.Color(o.color ?? '#8FD3E0') }, uCore: { value: new THREE.Color(o.core ?? '#F4FFFF') },
      uRim: { value: new THREE.Color(o.rim ?? '#2F7F8E') },
    }]),
    defines: { ...(column ? { BK_COLUMN: '' } : {}), ...(flowV ? { BK_FLOW_V: '' } : {}) },
    vertexColors: !!o.vertexAlpha,
    vertexShader: `#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  #include <color_vertex>
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  vN = normalize( normalMatrix * normal ); vV = normalize( - mvPosition.xyz );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `#include <common>
#include <color_pars_fragment>
#include <fog_pars_fragment>
uniform float uTime, uSpeed, uLength, uLanes, uOpacity, uFade; uniform vec3 uColor, uCore, uRim;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h1( float n ) { return fract( sin( n * 127.1 ) * 43758.5453 ); }
void main() {
  #ifdef BK_FLOW_V
    float along = vUv.y, across = vUv.x;
  #else
    float along = vUv.x, across = vUv.y;
  #endif
  // Edges: ribbons use the strip's own width, columns a fresnel rim (bright silhouette, clear middle).
  #ifdef BK_COLUMN
    float e = 1.0 - abs( dot( normalize( vN ), normalize( vV ) ) );
    float body = 0.45 + 0.55 * smoothstep( 0.15, 0.8, e );          // strokes denser toward the silhouette
    float rim = smoothstep( 0.86, 0.97, e );                         // thin dark-cyan outline of the column
  #else
    float e = abs( across - 0.5 ) * 2.0;
    float body = 1.0 - smoothstep( 0.82, 1.0, e );
    float rim = smoothstep( 0.62, 0.86, e ) * body;
  #endif
  // Painted strokes: lanes across, dabs along, each lane with its own length, speed and phase.
  float lane = across * uLanes, li = floor( lane ), lf = fract( lane ), hl = h1( li + 1.0 );
  float d = fract( along * uLength * ( 0.35 + 0.3 * hl ) - uTime * uSpeed * ( 0.75 + 0.5 * hl ) + hl * 7.0 );
  float dab = smoothstep( 0.0, 0.10, d ) * ( 1.0 - smoothstep( 0.35 + 0.25 * hl, 0.6 + 0.3 * hl, d ) );
  float laneShape = smoothstep( 0.10, 0.40, lf ) * ( 1.0 - smoothstep( 0.55, 0.85, lf ) );
  float streak = dab * laneShape;
  #ifndef BK_COLUMN
    streak = max( streak, ( 1.0 - smoothstep( 0.0, 0.35, e ) ) * 0.55 );   // ribbons keep a continuous spine
  #endif
  float ends = smoothstep( 0.0, uFade, along ) * ( 1.0 - smoothstep( 1.0 - uFade, 1.0, along ) );
  // Each stroke: white-cyan centre, #8FD3E0 body, dark-cyan edge (reads on ivory and sky); clear between strokes.
  float edge = smoothstep( 0.08, 0.30, streak ) * ( 1.0 - smoothstep( 0.35, 0.62, streak ) );
  vec3 col = mix( uColor, uCore, smoothstep( 0.62, 1.0, streak ) * 0.85 );
  col = mix( col, uRim, max( edge * 0.85, rim ) );
  float a = uOpacity * ends * max( body * ( 0.06 + 0.94 * smoothstep( 0.08, 0.4, streak ) ), rim * 0.8 );
  #if defined( USE_COLOR_ALPHA )
    col *= vColor.rgb; a *= vColor.a;
  #elif defined( USE_COLOR )
    col *= vColor;
  #endif
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  m.name = 'wind'; m.userData.look = false; m.userData.windMaterial = true;
  return m;
}
