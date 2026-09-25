/**
 * Soft light shafts (rule 7), one instanced draw: long additive cards along the key light, cylindrically billboarded,
 * gaussian across, faded at both ends and near the camera, gently breathing. Placed at stable world positions on a
 * 9 m grid around the focus (hash-chosen cells), so they don't swim with the hero. Strength per area rig (`shafts`):
 * dawn terrace faint, branches fainter, Hollow strongest (light falling into the trunk).
 */
import { NOISE_GLSL } from './noise.js';

export function createShafts({ THREE, scene }) {
  const MAX = 25, CELL = 9;
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
  const iC = new Float32Array(MAX * 3), iD = new Float32Array(MAX * 4);
  geo.setAttribute('iC', new THREE.InstancedBufferAttribute(iC, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('iD', new THREE.InstancedBufferAttribute(iD, 4).setUsage(THREE.DynamicDrawUsage));
  geo.instanceCount = 0;
  const U = { uDir: { value: new THREE.Vector3(0, 1, 0) }, uColor: { value: new THREE.Color(1, .9, .75) }, uAmount: { value: .1 }, uTime: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `attribute vec3 iC; attribute vec4 iD; uniform vec3 uDir; varying vec2 vUv; varying float vA, vSeed, vNear;
void main() {
  vUv = uv; vA = iD.z; vSeed = iD.w;
  vec3 toCam = cameraPosition - iC, right = normalize( cross( uDir, toCam ) );
  vec3 w = iC + uDir * position.y * iD.x + right * position.x * iD.y;
  vNear = smoothstep( 3.0, 9.0, length( cameraPosition - w ) );
  gl_Position = projectionMatrix * viewMatrix * vec4( w, 1.0 );
}`,
    fragmentShader: `uniform vec3 uColor; uniform float uAmount, uTime; varying vec2 vUv; varying float vA, vSeed, vNear;
${NOISE_GLSL}
void main() {
  float across = exp( - pow( ( vUv.x - 0.5 ) / 0.22, 2.0 ) );
  float along = sin( 3.14159 * vUv.y ); along *= along;
  float breath = 0.75 + 0.25 * fxNoise( vec2( vSeed * 13.0 + uTime * 0.15, vUv.y * 2.0 - uTime * 0.05 ) );
  float dust = 0.85 + 0.3 * fxNoise( vec2( vUv.x * 8.0 + vSeed * 5.0, vUv.y * 20.0 - uTime * 0.3 ) );
  float a = across * along * breath * dust * vA * uAmount * vNear;
  if ( a < 0.002 ) discard;
  gl_FragColor = vec4( uColor * a, 0.0 );
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    // Pure additive on colour, alpha channel untouched. (AdditiveBlending also added 1.0 to the target's alpha, which
    // look.js's post pass reads as a material marker: under each shaft card terrain (a=.5) lost its "no crease ink"
    // flag, so floor-piece junctions inked as long black straight lines beside the beams, e.g. the guardian well.)
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  material.userData.look = false; material.name = 'fx-shafts';
  const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false; mesh.name = 'fx-shafts'; mesh.renderOrder = 8;
  scene.add(mesh);
  const hash = (x, z, k) => { const v = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
  const api = {
    mesh, amount: .1, dir: U.uDir.value, color: U.uColor.value,
    update(t, focus) {
      U.uTime.value = t; U.uAmount.value = api.amount;
      let n = 0;
      if (focus && api.amount > .001) {
        const cx = Math.floor(focus.x / CELL), cz = Math.floor(focus.z / CELL);
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
          const gx = cx + i, gz = cz + j; if (hash(gx, gz, 1) > .42) continue;
          const x = (gx + hash(gx, gz, 2)) * CELL, z = (gz + hash(gx, gz, 3)) * CELL, y = focus.y + 1 + hash(gx, gz, 4) * 6;
          const d = Math.hypot(x - focus.x, z - focus.z), fade = 1 - Math.min(1, Math.max(0, (d - 12) / 10));
          if (fade <= 0) continue;
          iC.set([x, y, z], n * 3); iD.set([16 + hash(gx, gz, 5) * 10, 1.2 + hash(gx, gz, 6) * 2.2, fade * (.6 + .4 * hash(gx, gz, 7)), hash(gx, gz, 8)], n * 4); n++;
        }
      }
      geo.instanceCount = n; geo.attributes.iC.needsUpdate = true; geo.attributes.iD.needsUpdate = true; mesh.visible = n > 0;
    },
  };
  return api;
}
