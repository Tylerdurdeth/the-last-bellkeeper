// Bellhollow bell tower: ivory stone shaft, open arched belfry with a verdigris bell,
// bell-flared copper dome and finial (title-art silhouette). ~3.2 m square, ~11 m tall.
// Moving part: userData.bell (the bell group, pivot at its crown).
export default function (THREE, opts = {}) {
  let s = (opts.seed ?? 3) >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const M = (color, name, rough = .9, metal = 0) => Object.assign(new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal}), {name});
  const ivory = M(0xF2E6C9, 'stone'), shade = M(0xCDBB95, 'stone'), dark = M(0x7A4E33, 'timber', .88), timber = M(0xC8894A, 'timber', .85);
  const verd = M(0x3E9C8C, 'metal', .5, .3), copper = M(0xB8733F, 'metal', .45, .4), cloth = M(0xD96956, 'fabric'), glass = M(0xF6D9B0, 'glass', .35);
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, p = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o; };
  const box = (w, h, d, m, x, y, z, p = g) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, 0, 0, 0, p);
  const W = 3.2, shaft = 6.2 + rnd() * .8;
  box(W + .6, .5, W + .6, shade, 0, .25, 0);
  // tapering shaft with stone courses
  add(new THREE.CylinderGeometry(W * .66, W * .74, shaft, 4, 1), ivory, 0, .5 + shaft / 2, 0, Math.PI / 4);
  for (let y = 1.4; y < shaft; y += 1.5) add(new THREE.CylinderGeometry(W * .72 - y * .01, W * .73 - y * .01, .14, 4, 1), shade, 0, .5 + y, 0, Math.PI / 4);
  // door + small windows on all faces
  box(1.1, 2, .1, timber, 0, 1.5, W * .5 + .04);
  add(new THREE.CylinderGeometry(.55, .55, .1, 10, 1, false, -Math.PI / 2, Math.PI), timber, 0, 2.5, W * .5 + .04, 0, Math.PI / 2);
  for (const [a, y] of [[0, 4.6], [Math.PI / 2, 3.8], [Math.PI, 4.2], [-Math.PI / 2, 4.9]]) {
    const wx = Math.sin(a) * (W * .5 - .02), wz = Math.cos(a) * (W * .5 - .02);
    add(new THREE.BoxGeometry(.5, .9, .12), dark, wx, y, wz, a); add(new THREE.BoxGeometry(.36, .76, .1), glass, wx * 1.01, y, wz * 1.01, a);
  }
  const by = .5 + shaft;
  box(W + .5, .3, W + .5, shade, 0, by, 0);
  // belfry: four corner piers + arches, open so the bell reads from any side
  const bh = 3;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.55, bh, .55, ivory, x * (W / 2 - .1), by + bh / 2 + .15, z * (W / 2 - .1));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, ax = Math.sin(a) * (W / 2 - .1), az = Math.cos(a) * (W / 2 - .1);
    const arch = add(new THREE.TorusGeometry(W / 2 - .38, .16, 5, 12, Math.PI), ivory, ax, by + bh - .55, az, a);
    void arch;
    box(W - .2, .12, .2, shade, ax * .98, by + .7, az * .98).rotation.y = a;
    // balustrade stub
    for (let k = -2; k <= 2; k++) { const px = Math.cos(a) * k * .45 + ax, pz = -Math.sin(a) * k * .45 + az; add(new THREE.CylinderGeometry(.06, .08, .5, 6), shade, px, by + .42, pz); }
  }
  box(W + .6, .35, W + .6, shade, 0, by + bh + .3, 0);
  // bell (pivot at crown)
  const bell = new THREE.Group(); bell.position.set(0, by + bh - .15, 0); bell.name = 'bell'; g.add(bell);
  const prof = [[0, 0], [.34, -.05], [.44, -.3], [.5, -.75], [.64, -1.1], [.74, -1.25], [.7, -1.3], [.55, -1.2], [0, -1.2]].reverse().map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(prof, 16), verd, 0, 0, 0, 0, 0, 0, bell);
  add(new THREE.TorusGeometry(.7, .05, 5, 16), copper, 0, -1.23, 0, 0, Math.PI / 2, 0, bell);
  add(new THREE.SphereGeometry(.14, 8, 6), copper, 0, -1.25, 0, 0, 0, 0, bell);
  box(W - .4, .2, .2, dark, 0, by + bh - .05, 0);
  // bell-flared dome roof + lantern + finial
  const ry = by + bh + .45;
  const dome = [[W * .78, 0], [W * .74, .12], [W * .55, .3], [W * .46, .7], [W * .42, 1.2], [W * .3, 1.8], [W * .14, 2.2], [.12, 2.45], [0, 2.5]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(dome, 16), copper, 0, ry, 0);
  add(new THREE.CylinderGeometry(.25, .3, .8, 8), ivory, 0, ry + 2.8, 0);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; add(new THREE.BoxGeometry(.08, .5, .08), dark, Math.sin(a) * .28, ry + 2.85, Math.cos(a) * .28); }
  add(new THREE.ConeGeometry(.34, .6, 8), verd, 0, ry + 3.5, 0);
  add(new THREE.CylinderGeometry(.03, .03, 1, 5), copper, 0, ry + 4.2, 0);
  add(new THREE.SphereGeometry(.1, 8, 6), copper, 0, ry + 4.1, 0);
  // pennant on the finial (coral: one accent)
  const flag = new THREE.Shape(); flag.moveTo(0, 0); flag.lineTo(.9, -.15); flag.lineTo(0, -.35); flag.closePath();
  add(new THREE.ShapeGeometry(flag), Object.assign(cloth.clone(), {side: THREE.DoubleSide}), .03, ry + 4.65, 0);
  g.userData.bell = bell;
  const box3 = new THREE.Box3(), v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
