// Bellhollow seed wheel: 1.8 m verdigris wind wheel with seed-pod cups, on a timber
// A-frame with a copper axle housing and an outlet pipe. Moving part: userData.rotor.
export default function (THREE, opts = {}) {
  const M = (color, name, rough = .9, metal = 0, side) => Object.assign(new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, side: side || THREE.FrontSide}), {name});
  const ivory = M(0xF2E6C9, "stone"), shade = M(0xCDBB95, "stone"), dark = M(0x7A4E33, "timber", .88), timber = M(0xC8894A, "timber", .85);
  const verd = M(0x3E9C8C, "metal", .5, .3), copper = M(0xB8733F, "metal", .45, .4), coral = M(0xD96956, "fabric", .95, 0, THREE.DoubleSide), cloth = M(0xF2E6C9, "fabric", .95, 0, THREE.DoubleSide);
  const leaf = M(0x5E8F4E, "foliage", .95), leafL = M(0xA6C46A, "foliage", .95), gold = M(0xE9B949, "fabric", .9);
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, p = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o; };
  const box = (w, h, d, m, x, y, z, p = g) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, 0, 0, 0, p);
  let s = (opts.seed ?? 5) >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const R = .9, hubY = 1.35;
  for (const sz of [-.35, .35]) { for (const sx of [-1, 1]) { const leg = box(.12, 1.6, .12, dark, sx * .45, .75, sz); leg.rotation.z = sx * .28; } }
  box(1.4, .15, 1.0, shade, 0, .075, 0);
  const rotor = new THREE.Group(); rotor.name = "rotor"; rotor.position.set(0, hubY, 0); g.add(rotor);
  add(new THREE.TorusGeometry(R, .06, 5, 20), verd, 0, 0, 0, 0, 0, 0, rotor);
  add(new THREE.TorusGeometry(R * .45, .04, 4, 14), copper, 0, 0, 0, 0, 0, 0, rotor);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const sp = box(.05, R, .05, timber, Math.sin(a) * R / 2, Math.cos(a) * R / 2, 0, rotor); sp.rotation.z = -a;
    // seed-pod cup: half sphere, petal-shaped
    const cup = add(new THREE.SphereGeometry(.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), Object.assign(coral.clone(), {side: THREE.DoubleSide}), Math.sin(a) * R, Math.cos(a) * R, 0, 0, 0, 0, rotor);
    cup.rotation.set(0, 0, -a - Math.PI / 2); cup.rotateX(Math.PI / 2);
  }
  add(new THREE.CylinderGeometry(.16, .16, .7, 10), copper, 0, 0, 0, 0, Math.PI / 2, 0, rotor);
  add(new THREE.CylinderGeometry(.08, .08, .95, 6), dark, 0, hubY, 0, 0, Math.PI / 2);
  // outlet pipe from the axle down and away
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, hubY, -.45), new THREE.Vector3(0, .6, -.55), new THREE.Vector3(.3, .25, -.6), new THREE.Vector3(.9, .25, -.6)]), 12, .1, 6), verd);
  add(new THREE.CylinderGeometry(.16, .12, .2, 8), copper, .95, .25, -.6, 0, 0, Math.PI / 2);
  g.userData.rotor = rotor;
  const box3 = new THREE.Box3(), v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
