// Bellhollow lantern post: 2.7 m honey-timber post on a stone foot, curled copper
// bracket and a 0.45 m lantern whose glass (material name "lantern") glows when lit.
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
  const lamp = Object.assign(new THREE.MeshStandardMaterial({color: 0xF6D9B0, roughness: .5, emissive: 0xE9B949, emissiveIntensity: opts.lit ? 1.2 : .05}), {name: "glass"});
  add(new THREE.CylinderGeometry(.22, .28, .35, 8), shade, 0, .17, 0);
  add(new THREE.CylinderGeometry(.08, .1, 2.6, 8), dark, 0, 1.6, 0);
  add(new THREE.TorusGeometry(.35, .04, 5, 10, Math.PI * .8), copper, .32, 2.62, 0, 0, 0, -.2);
  box(.7, .06, .06, copper, .3, 2.85, 0);
  const lx = .58, ly = 2.4;
  add(new THREE.CylinderGeometry(.03, .03, .2, 5), copper, lx, 2.72, 0);
  add(new THREE.ConeGeometry(.24, .2, 6), verd, lx, ly + .3, 0);
  add(new THREE.CylinderGeometry(.16, .12, .34, 6), lamp, lx, ly, 0);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.BoxGeometry(.025, .36, .025), verd, lx + Math.cos(a) * .16, ly, Math.sin(a) * .16); }
  add(new THREE.CylinderGeometry(.18, .12, .06, 6), verd, lx, ly - .19, 0);
  add(new THREE.SphereGeometry(.07, 6, 4), copper, 0, 2.95, 0);
  const box3 = new THREE.Box3(), v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  g.userData.postTop = [-c.x, 2.95 + .07 - box3.min.y, -c.z]; // the copper knob on top of the post (rope anchor)
  return g;
}
