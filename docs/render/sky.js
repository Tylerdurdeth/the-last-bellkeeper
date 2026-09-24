/**
 * Painted sky dome, one draw, follows the camera (infinitely far).
 * Layers: procedural dawn gradient + sun glow + streak clouds (fallback), an optional painted sky strip
 * (textures/v2/sky-dawn.webp, cylindrical, 360° with a mirrored seam behind the sun) and an optional distant valley
 * backdrop band (textures/v2/valley.webp) over a limited arc, faded into the sky at its top and at the arc ends, hazed
 * toward the area's fog colour. Azimuth convention: 0 = north (−Z), +90° = east (+X).
 */
export function createSky(THREE) {
  const U = {
    uTop: { value: new THREE.Color('#BFE1EA') },
    uHorizon: { value: new THREE.Color('#F6D9B0') },
    uBelow: { value: new THREE.Color('#9FB7A8') },
    uSunColor: { value: new THREE.Color('#FFD9A0') },
    uSunDir: { value: new THREE.Vector3(0, .3, 1).normalize() },
    uCloud: { value: new THREE.Color('#FFF1DC') },
    uCloudShade: { value: new THREE.Color('#C9B9B0') },
    uCloudAmt: { value: .8 }, uSunGlow: { value: 1 },
    // Painted sky strip
    uMap: { value: null }, uMapMix: { value: 0 }, uMapRange: { value: new THREE.Vector2(-.06, .62) }, uMapTint: { value: new THREE.Color(1, 1, 1) },
    uMapAz: { value: 0 },          // azimuth of the image centre (radians); follows the sun unless pinned
    // Valley backdrop band
    uBack: { value: null }, uBackMix: { value: 0 }, uBackRange: { value: new THREE.Vector2(-.16, .22) },
    uBackAz: { value: THREE.MathUtils.degToRad(-38) }, uBackArc: { value: THREE.MathUtils.degToRad(200) },
    uBackSkyFade: { value: new THREE.Vector2(.52, .78) },   // image v where the painted valley sky fades into our sky
    uHaze: { value: new THREE.Color('#D5DCCF') }, uHazeAmt: { value: .18 }, uBackTint: { value: new THREE.Color(1, 1, 1) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;   // on the far plane
}`,
    fragmentShader: `#include <common>
uniform vec3 uTop, uHorizon, uBelow, uSunColor, uSunDir, uCloud, uCloudShade, uMapTint, uHaze, uBackTint;
uniform float uCloudAmt, uSunGlow, uMapMix, uMapAz, uBackMix, uBackAz, uBackArc, uHazeAmt;
uniform vec2 uMapRange, uBackRange, uBackSkyFade;
uniform sampler2D uMap, uBack;
varying vec3 vDir;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float noise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
float fbm( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 4; i ++ ) { s += a * noise( p ); p *= 2.03; a *= 0.5; } return s; }
float wrapPi( float a ) { return a - 2.0 * PI * floor( ( a + PI ) / ( 2.0 * PI ) ); }
void main() {
  vec3 d = normalize( vDir );
  float h = d.y;
  float az = atan( d.x, - d.z );
  vec3 col = mix( uHorizon, uTop, pow( smoothstep( -0.02, 0.85, h ), 0.55 ) );
  col = mix( col, uBelow, smoothstep( 0.0, -0.22, h ) );
  float s = max( dot( d, uSunDir ), 0.0 );
  col = mix( col, uSunColor, pow( s, 6.0 ) * 0.45 );
  // Procedural painted streak clouds (only when no painted strip is loaded).
  vec2 cp = vec2( az * 2.4, h * 11.0 );
  float n = fbm( cp + vec2( fbm( cp * 0.7 ) * 1.6, 0.0 ) );
  float band = smoothstep( 0.02, 0.10, h ) * ( 1.0 - smoothstep( 0.30, 0.55, h ) );
  float c = smoothstep( 0.52, 0.66, n ) * band * uCloudAmt * ( 1.0 - uMapMix );
  vec3 cc = mix( uCloudShade, uCloud, smoothstep( 0.45, 0.8, fbm( cp * 1.7 + 3.0 ) ) * 0.6 + pow( s, 3.0 ) * 0.6 );
  col = mix( col, cc, c * 0.85 );
  if ( uMapMix > 0.0 ) {
    // One copy over 360°, centred on uMapAz; mirrored crossfade hides the seam behind.
    float u = 0.5 + wrapPi( az - uMapAz ) / ( 2.0 * PI );
    float v = ( h - uMapRange.x ) / ( uMapRange.y - uMapRange.x );
    vec2 uv = vec2( u, clamp( v, 0.003, 0.997 ) );
    vec3 m = texture2D( uMap, uv ).rgb;
    float seam = 1.0 - smoothstep( 0.0, 0.05, min( u, 1.0 - u ) );
    m = mix( m, texture2D( uMap, vec2( 1.0 - u, uv.y ) ).rgb, seam * 0.5 );
    float inside = smoothstep( -0.04, 0.02, v ) * ( 1.0 - smoothstep( 0.86, 1.0, v ) );
    col = mix( col, m * uMapTint, uMapMix * inside );
  }
  col += uSunColor * pow( s, 400.0 ) * 1.2 * ( 1.0 - uMapMix * 0.7 );
  col += uSunColor * ( pow( s, 3.0 ) * 0.10 + pow( s, 14.0 ) * 0.22 ) * uSunGlow;   // bloom-free glow around the sun
  if ( uBackMix > 0.0 ) {
    float da = wrapPi( az - uBackAz );
    float u = 0.5 + da / uBackArc;
    float v = ( h - uBackRange.x ) / ( uBackRange.y - uBackRange.x );
    if ( u > 0.0 && u < 1.0 && v < 1.0 ) {
      vec3 b = texture2D( uBack, vec2( u, clamp( v, 0.003, 0.997 ) ) ).rgb * uBackTint;
      b = mix( b, uHaze, uHazeAmt );
      float a = 1.0 - smoothstep( uBackSkyFade.x, uBackSkyFade.y, v );   // painted sky → our sky
      a *= smoothstep( 0.0, 0.07, u ) * ( 1.0 - smoothstep( 0.93, 1.0, u ) );
      col = mix( col, b, a * uBackMix );
    }
  }
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  material.userData.look = false;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
  mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.name = 'look-sky'; mesh.userData.lookHull = true;
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.scale.setScalar(cam.far * .9); mesh.updateMatrixWorld(); };

  const loader = new THREE.TextureLoader();
  const load = tex => {
    if (typeof tex !== 'string') return Promise.resolve(tex);
    return loader.loadAsync(tex).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; return t; });
  };
  let pinnedAz = null;
  /** Painted sky strip. range = [minY, maxY] of view direction.y covered; azimuthDeg pins the image centre (default: sun). */
  async function setTexture(tex, { mix = 1, range, azimuthDeg } = {}) {
    const t = tex ? await load(tex) : null;
    U.uMap.value = t; U.uMapMix.value = t ? mix : 0;
    if (range) U.uMapRange.value.set(range[0], range[1]);
    pinnedAz = azimuthDeg == null ? null : THREE.MathUtils.degToRad(azimuthDeg);
    return t;
  }
  /** Distant backdrop band. azimuthDeg = direction of the image centre, arcDeg = horizontal span, range = [minY,maxY]. */
  async function setBackdrop(tex, { mix = 1, azimuthDeg, arcDeg, range, skyFade } = {}) {
    const t = tex ? await load(tex) : null;
    U.uBack.value = t; U.uBackMix.value = t ? mix : 0;
    if (azimuthDeg != null) U.uBackAz.value = THREE.MathUtils.degToRad(azimuthDeg);
    if (arcDeg != null) U.uBackArc.value = THREE.MathUtils.degToRad(arcDeg);
    if (range) U.uBackRange.value.set(range[0], range[1]);
    if (skyFade) U.uBackSkyFade.value.set(skyFade[0], skyFade[1]);
    return t;
  }
  function followSun(dir) { U.uMapAz.value = pinnedAz ?? Math.atan2(dir.x, -dir.z); }
  return { mesh, uniforms: U, setTexture, setBackdrop, followSun, get layers() { return { map: U.uMap.value, back: U.uBack.value }; } };
}
