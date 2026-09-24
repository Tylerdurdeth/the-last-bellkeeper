// Bellhollow market stall: timber frame, striped coral/ivory awning with scalloped hem,
// counter with baskets, fruit and jars. ~2.6 x 1.6 m, 2.6 m tall. Front faces +Z.
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
  const W = 2.6, D = 1.5;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.12, z > 0 ? 2.3 : 2.6, .12, dark, x * W / 2, (z > 0 ? 2.3 : 2.6) / 2, z * D / 2);
  // counter
  box(W, .9, .5, timber, 0, .45, D / 2 - .2); box(W + .12, .08, .62, dark, 0, .92, D / 2 - .2);
  for (let i = 0; i < 5; i++) box(.04, .8, .02, dark, -W / 2 + .3 + i * (W - .6) / 4, .42, D / 2 + .06);
  // back shelf with jars
  box(W, .06, .4, timber, 0, 1.3, -D / 2 + .25);
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(.09, .1, .24, 8), i % 3 ? verd : copper, -W / 2 + .3 + i * .4, 1.45, -D / 2 + .25);
  // goods on the counter: baskets of fruit (coral/gold/leaf spheres)
  for (let b = 0; b < 3; b++) {
    const bx = -.85 + b * .85;
    add(new THREE.CylinderGeometry(.3, .22, .2, 10, 1, true), Object.assign(timber.clone(), {side: THREE.DoubleSide}), bx, 1.06, D / 2 - .2);
    const fm = [coral, gold, leafL][(b + (opts.seed || 0)) % 3];
    for (let k = 0; k < 5; k++) add(new THREE.IcosahedronGeometry(.09, 0), fm, bx + Math.cos(k * 1.3) * .14, 1.16 + (k === 4 ? .08 : 0), D / 2 - .2 + Math.sin(k * 1.3) * .12);
  }
  // awning: sloped striped cloth, scalloped front hem
  const aw = new THREE.Group(); aw.position.set(0, 2.45, 0); aw.rotation.x = .28; g.add(aw);
  const n = 7;
  for (let i = 0; i < n; i++) box(W / n + .005, .04, D + .6, i % 2 ? cloth : coral, -W / 2 + (i + .5) * W / n, 0, .15, aw);
  for (let i = 0; i < n; i++) add(new THREE.CylinderGeometry(W / n / 2, W / n / 2, .04, 8, 1, false, 0, Math.PI), i % 2 ? cloth : coral, -W / 2 + (i + .5) * W / n, 0, D / 2 + .45, Math.PI / 2, 0, 0, aw).rotation.set(0, -Math.PI / 2, 0);
  box(W + .1, .1, .1, dark, 0, 2.6, -D / 2);
  // hanging sign
  box(.06, .3, .02, dark, W / 2 - .2, 2.1, D / 2 + .1); box(.5, .3, .04, timber, W / 2 - .2, 1.85, D / 2 + .1);
  // crates beside
  for (const [x, z, sz] of [[-W / 2 - .35, .2, .5], [-W / 2 - .3, -.35, .42]]) box(sz, sz, sz, timber, x, sz / 2, z);
  const box3 = new THREE.Box3(), v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
