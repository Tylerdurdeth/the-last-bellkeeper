// Bellhollow morning bell: 0.7 m verdigris bell under a small tiled timber frame with a
// pull rope. Moving part: userData.bell (pivot at crown).
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
  box(1.5, .25, 1.1, shade, 0, .125, 0);
  for (const sx of [-1, 1]) { box(.18, 2.3, .18, dark, sx * .6, 1.4, 0); const br = box(.1, .6, .1, timber, sx * .45, 2.3, 0); br.rotation.z = sx * .8; }
  box(1.5, .18, .3, dark, 0, 2.55, 0);
  const roof = new THREE.Shape(); roof.moveTo(-.95, 0); roof.lineTo(.95, 0); roof.lineTo(0, .55); roof.closePath();
  const rg = new THREE.ExtrudeGeometry(roof, {depth: .9, bevelEnabled: false}); rg.translate(0, 0, -.45);
  add(rg, M(0xD96956, "tile", .8), 0, 2.64, 0);
  const bell = new THREE.Group(); bell.name = "bell"; bell.position.set(0, 2.45, 0); g.add(bell);
  const prof = [[0, 0], [.18, -.03], [.22, -.2], [.26, -.45], [.35, -.65], [.33, -.7], [0, -.66]].reverse().map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(prof, 14), verd, 0, 0, 0, 0, 0, 0, bell);
  add(new THREE.TorusGeometry(.34, .03, 4, 14), copper, 0, -.67, 0, Math.PI / 2, Math.PI / 2, 0, bell);
  add(new THREE.SphereGeometry(.07, 6, 4), copper, 0, -.72, 0, 0, 0, 0, bell);
  add(new THREE.CylinderGeometry(.02, .02, 1.2, 4), M(0xC8894A, "fabric"), .2, -1.3, 0, 0, 0, 0, bell);
  add(new THREE.SphereGeometry(.06, 6, 4), coral, .2, -1.92, 0, 0, 0, 0, bell);
  g.userData.bell = bell;
  const box3 = new THREE.Box3(), v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
