// Bellhollow floor vent: 1.6 m copper grille set in a raised stone collar; radial
// verdigris slats, bright copper rim bolts. Flush-walkable (rim 0.08 m).
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
  const R = .8;
  add(new THREE.CylinderGeometry(R + .28, R + .34, .12, 20), shade, 0, .06, 0);
  add(new THREE.TorusGeometry(R + .05, .07, 5, 24), copper, 0, .1, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(R, R, .06, 20), M(0x2C4A45, "metal", .7, .2), 0, .06, 0);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI; const sl = box(R * 2 - .1, .05, .07, verd, 0, .1, 0); sl.rotation.y = a; }
  add(new THREE.TorusGeometry(R * .5, .04, 4, 16), verd, 0, .11, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(.14, .14, .08, 10), copper, 0, .12, 0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.SphereGeometry(.05, 6, 4), copper, Math.cos(a) * (R + .2), .13, Math.sin(a) * (R + .2)); }
  const box3 = new THREE.Box3(), v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
