// Shared GLSL value-noise / fbm / curl helpers for the element FX (procedural, no textures).
export const NOISE_GLSL = /* glsl */`
float fxHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float fxHash3( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float fxNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( fxHash( i ), fxHash( i + vec2( 1, 0 ) ), f.x ), mix( fxHash( i + vec2( 0, 1 ) ), fxHash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
float fxFbm( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 4; i ++ ) { s += a * fxNoise( p ); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
float fxFbm3( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 3; i ++ ) { s += a * fxNoise( p ); p = p * 2.07 + 3.1; a *= 0.5; } return s; }
`;
