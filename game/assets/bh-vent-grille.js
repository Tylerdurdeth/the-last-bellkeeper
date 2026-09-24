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
  // Wind well (R-floor-vent): an octagonal ivory stone surround set into the floor, a riveted
  // copper ring, a verdigris petal grille over a dark shaft, and a copper feed elbow entering from
  // one side and dropping into the floor (the well is fed from below). Flush-walkable (rim .12).
  const R = .8;
  add(new THREE.CylinderGeometry(R + .55, R + .62, .12, 8), shade, 0, .06, 0, Math.PI / 8);
  // Ivory collar is a true ring (open over the grille): a solid disc here shared the petals' top plane and z-fought.
  const collar = new THREE.LatheGeometry([[R + .02, .12], [R + .02, .17], [R + .42, .17], [R + .5, .12]].map(([x, y]) => new THREE.Vector2(x, y)), 8);
  add(collar, ivory, 0, 0, 0, Math.PI / 8);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; box(.05, .02, R * .7, shade, Math.sin(a) * (R + .3), .175, Math.cos(a) * (R + .3)).rotation.y = a; }
  add(new THREE.TorusGeometry(R + .06, .08, 6, 28), copper, 0, .15, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(R, R, .06, 24), M(0x2C4A45, "metal", .8, .1), 0, .1, 0);
  // eight petals radiating from a copper boss (drawn as flattened leaf shapes)
  for (let k = 0; k < 8; k++) {
    const sh = new THREE.Shape(); sh.moveTo(0, .1); sh.quadraticCurveTo(.3, .38, 0, R - .06); sh.quadraticCurveTo(-.3, .38, 0, .1);
    const g2 = new THREE.ExtrudeGeometry(sh, {depth: .04, bevelEnabled: false, curveSegments: 4}); g2.rotateX(-Math.PI / 2); g2.rotateY(k / 8 * Math.PI * 2);
    add(g2, verd, 0, .13, 0);
  }
  add(new THREE.CylinderGeometry(.16, .18, .08, 12), copper, 0, .16, 0);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(new THREE.SphereGeometry(.04, 6, 4), copper, Math.cos(a) * (R + .06), .2, Math.sin(a) * (R + .06)); }
  // feed pipe: runs in along the floor and dives into it through a bolted flange (fed from below)
  add(new THREE.CylinderGeometry(.12, .12, .9, 8), verd, R + .95, .14, 0, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(.2, .2, .06, 10), copper, R + 1.42, .03, 0);
  add(new THREE.SphereGeometry(.15, 8, 6), verd, R + 1.42, .12, 0);
  for (const x of [R + .62, R + 1.18]) add(new THREE.TorusGeometry(.15, .035, 5, 10), copper, x, .14, 0, Math.PI / 2, 0, 0);
  const box3 = new THREE.Box3(), v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
