// Paired bells of Bellhollow (finale), from references-v2/R-paired-bells.png: a large verdigris
// bell (the outward bell, faces the village) and a smaller bright-copper bell (the forgotten
// return bell, faces the roots) hanging from one living-wood yoke that grows out of a
// root-wrapped ivory stone pedestal. ~2.9 m tall. Front is +Z.
// Hooks: userData.joints = {outBell, returnBell, outClapper, returnClapper, yoke}
//   userData.setSwing({out, ret}) swing angles (radians) about each hang point;
//   userData.phrase(t, {gentle}) -> {out, ret, outStrike, retStrike} the two-part phrase as a pure
//     function of seconds since the ring began (outward toll at 0 s, return answer at 1.7 s).
//   userData.anchors = {out, ret} bell mouth centres (asset space) for wind/sound cues.
export default function (THREE, opts = {}) {
  const T = THREE;
  const M = (color, name, o = {}) => Object.assign(new T.MeshStandardMaterial({ color, roughness: .85, ...o }), { name });
  const stone = M(0xF2E6C9, 'stone'), stoneSh = M(0xCDBB95, 'stone'), wood = M(0x8A5A3A, 'timber', { roughness: .9 }), woodL = M(0xC8894A, 'timber'),
    leaf = M(0x5E8F4E, 'foliage'), moss = M(0xA6C46A, 'foliage'), coral = M(0xD96956, 'fabric', { side: T.DoubleSide }), rope = M(0xCDB27A, 'fabric'),
    verd = M(0x3E9C8C, 'metal', { roughness: .55, metalness: .3, side: T.DoubleSide }), verdSh = M(0x2C6A60, 'metal', { roughness: .6, metalness: .3 }),
    copper = M(0xD08850, 'metal', { roughness: .35, metalness: .55, side: T.DoubleSide }), copperDk = M(0x8A4E2A, 'metal', { roughness: .45, metalness: .4 });
  // Draw-call budget: every part is baked to vertex colour on two shared materials (opaque paint,
  // double-sided metal shell for bell bodies/ribbons), then merged per pivot -> ~7 draws.
  const paint = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .85 }), { name: 'stone' });
  const shell = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .45, metalness: .4, side: T.DoubleSide }), { name: 'metal' });
  const root = new T.Group(); root.name = 'bh-paired-bells';
  const rig = new T.Group(); root.add(rig);
  const joints = {}; root.userData.joints = joints;
  const group = (name, x, y, z, parent = rig) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); joints[name] = g; return g; };
  const mesh = (geo, m, parent = rig, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const n = geo.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([m.color.r, m.color.g, m.color.b], i * 3);
    geo.setAttribute('color', new T.BufferAttribute(col, 3)); const o = new T.Mesh(geo, m.side === T.DoubleSide ? shell : paint); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  function tube(points, r0, r1, m, parent = rig, radial = 8, steps = 20) {
    const curve = new T.CatmullRomCurve3(points.map(q => new T.Vector3(...q)));
    const g = new T.TubeGeometry(curve, steps, 1, radial, false), p = g.attributes.position, v = new T.Vector3(), c = new T.Vector3();
    for (let s = 0; s <= steps; s++) { const t = s / steps; curve.getPointAt(t, c); const r = r0 + (r1 - r0) * t * (1 + .15 * Math.sin(t * 9)); for (let k = 0; k <= radial; k++) { const i = s * (radial + 1) + k; v.fromBufferAttribute(p, i).sub(c).normalize().multiplyScalar(r).add(c); p.setXYZ(i, v.x, v.y, v.z); } }
    g.computeVertexNormals(); return mesh(g, m, parent);
  }
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Pedestal: bevelled ivory drum with a band, wrapped in roots.
  mesh(new T.CylinderGeometry(.66, .72, .78, 20), stone, rig, 0, .39, 0);
  mesh(new T.CylinderGeometry(.7, .7, .1, 20), stoneSh, rig, 0, .79, 0);
  mesh(new T.CylinderGeometry(.62, .66, .06, 20), stone, rig, 0, .87, 0);
  mesh(new T.TorusGeometry(.69, .035, 5, 24), stoneSh, rig, 0, .42, 0, Math.PI / 2);
  for (let i = 0; i < 9; i++) { // stone block seams
    const a = i / 9 * Math.PI * 2 + .2; mesh(new T.BoxGeometry(.03, .34, .05), stoneSh, rig, Math.sin(a) * .705, i % 2 ? .6 : .2, Math.cos(a) * .705, 0, a, 0);
  }
  for (let i = 0; i < 7; i++) { // roots wrapping the drum and splaying on the floor
    const a0 = i / 7 * Math.PI * 2 + rnd() * .4, a1 = a0 + .5 + rnd() * .6, pts = [];
    for (let k = 0; k <= 6; k++) { const f = k / 6, a = a0 + (a1 - a0) * f, r = .73 + .03 * Math.sin(f * 7) + (f > .8 ? (f - .8) * 1.6 : 0); pts.push([Math.sin(a) * r, .95 - f * .95 + (f > .85 ? .02 : 0), Math.cos(a) * r]); }
    tube(pts, .075 - i * .004, .03, wood);
  }
  // Living-wood yoke: trunk rising from the pedestal's right-back, arching over to the left.
  const trunkPts = [[.35, .85, -.25], [.62, 1.35, -.2], [.66, 1.95, -.12], [.48, 2.5, -.05], [.1, 2.72, 0], [-.45, 2.72, 0], [-.95, 2.6, .02], [-1.2, 2.66, .02]];
  const yoke = rig; joints.yoke = rig;
  tube(trunkPts, .16, .08, wood, yoke, 10, 36);
  tube([[.5, 2.45, -.08], [.66, 2.6, -.05], [.75, 2.85, 0]], .06, .025, wood, yoke);  // stub branch
  tube([[-.9, 2.62, .02], [-1.02, 2.8, .05], [-1.0, 2.95, .1]], .04, .015, woodL, yoke);
  for (const [x, y, z, s] of [[.72, 2.9, 0, 1], [-1, 2.98, .1, .8], [.6, 1.4, -.2, .9], [.1, 2.83, .05, .7], [-1.23, 2.72, .02, .8], [.7, 1.9, -.1, .8]]) {
    for (let k = 0; k < 3; k++) { const g = new T.SphereGeometry(.11 * s, 8, 6); g.scale(1, .35, .55); const o = mesh(g, k % 2 ? moss : leaf, yoke, x + (k - 1) * .08, y + k * .03, z + .05 * k, .3, k * 1.8, .6 * (k - 1)); }
  }
  tube([[.35, .86, -.25], [.2, .9, .1], [-.2, .9, .3]], .07, .03, wood); // trunk foot roots over the top
  tube([[.35, .86, -.25], [.6, .6, .15], [.55, .2, .45]], .07, .03, wood);

  // Bells: lathe bodies (open, double-sided), lip bead, crown loop, clapper; rope to the yoke.
  function bell(name, x, hangY, h, r, body, lip, dark) {
    const pivot = group(name, x, hangY, 0);
    const prof = [[.001, 0], [r * .42, 0], [r * .56, -h * .08], [r * .6, -h * .45], [r * .72, -h * .78], [r * .95, -h * .95], [r, -h], [r * .9, -h * .97], [r * .66, -h * .8], [r * .52, -h * .45], [r * .4, -h * .06], [.001, -h * .04]];
    mesh(new T.LatheGeometry(prof.map(([a, b]) => new T.Vector2(a, b)), 24), body, pivot, 0, -.2, 0);
    mesh(new T.TorusGeometry(r * .97, h * .035, 6, 24), lip, pivot, 0, -.2 - h * .975, 0, Math.PI / 2);
    mesh(new T.TorusGeometry(r * .62, h * .022, 5, 24), lip, pivot, 0, -.2 - h * .6, 0, Math.PI / 2);
    mesh(new T.TorusGeometry(.09, .03, 6, 14), dark, pivot, 0, -.14, 0);
    mesh(new T.CylinderGeometry(.012, .012, .2, 5), rope, pivot, 0, -.05, 0);
    const clap = group(name.replace('Bell', 'Clapper'), 0, -.25, 0, pivot);
    mesh(new T.CylinderGeometry(.018, .018, h * .7, 6), dark, clap, 0, -h * .35, 0);
    mesh(new T.SphereGeometry(h * .09, 10, 8), dark, clap, 0, -h * .75, 0);
    // coral ribbon tied at the crown
    const rg = new T.PlaneGeometry(.1, .42, 1, 6), rp = rg.attributes.position; for (let i = 0; i < rp.count; i++) { const y = rp.getY(i); rp.setZ(i, Math.sin(y * 9) * .03); rp.setX(i, rp.getX(i) + (y + .21) * -.2); }
    rg.computeVertexNormals(); mesh(rg, coral, pivot, -r * .5, -.45, r * .45, .1, .6, .3);
    return pivot;
  }
  const outBell = bell('outBell', -.5, 2.64, .95, .52, verd, verdSh, verdSh);
  const retBell = bell('returnBell', .28, 2.68, .56, .31, copper, copperDk, copperDk);
  for (const [x, y] of [[-.5, 2.7], [.28, 2.72]]) mesh(new T.TorusGeometry(.13, .03, 6, 14), rope, yoke, x, y, 0, 0, Math.PI / 2, 0); // rope wraps

  // Batch rigid siblings per material inside each pivot.
  const parents = []; root.traverse(o => { if (o.isGroup) parents.push(o); });
  for (const parent of parents) {
    const buckets = new Map(); for (const o of parent.children) if (o.isMesh) { if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(o); }
    for (const [m, nodes] of buckets) {
      if (nodes.length < 2) continue;
      const arrays = { position: [], normal: [], color: [] };
      for (const o of nodes) { o.updateMatrix(); const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrix); for (const k in arrays) arrays[k].push(...g.getAttribute(k).array); g.dispose(); }
      const g = new T.BufferGeometry(); for (const k in arrays) g.setAttribute(k, new T.Float32BufferAttribute(arrays[k], 3));
      const o = new T.Mesh(g, m); o.castShadow = o.receiveShadow = true; parent.add(o); for (const n of nodes) { parent.remove(n); n.geometry.dispose(); }
    }
  }
  function setSwing({ out = 0, ret = 0 } = {}) {
    outBell.rotation.z = out; retBell.rotation.z = ret;
    joints.outClapper.rotation.z = -out * .6; joints.returnClapper.rotation.z = -ret * .6;
  }
  // Two-part phrase: the outward toll (big, slow), then the smaller return answer. Pure function of t.
  function phrase(t, { gentle = false } = {}) {
    const k = gentle ? .6 : 1;
    const env = (u, dur) => u < 0 || u > dur ? 0 : Math.sin(Math.min(1, u / .25) * Math.PI / 2) * Math.exp(-u * 1.1);
    const out = .32 * k * env(t, 5) * Math.sin(t * 3.4), rt = t - 1.7, ret = .42 * k * env(rt, 5) * Math.sin(rt * 4.6);
    return { out, ret, outStrike: t >= 0 && t < .1, retStrike: rt >= 0 && rt < .1 };
  }
  root.userData.setSwing = setSwing; root.userData.phrase = phrase;
  // Centre: base at y=0 on x/z (vertex-measured).
  const box = new T.Box3(), v = new T.Vector3(); root.updateMatrixWorld(true);
  root.traverse(n => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new T.Vector3()); rig.position.set(-c.x, -box.min.y, -c.z);
  root.userData.anchors = { out: new T.Vector3(-.5 - c.x, 2.64 - .2 - .95 - box.min.y, -c.z), ret: new T.Vector3(.28 - c.x, 2.68 - .2 - .56 - box.min.y, -c.z) };
  if (opts.swing) setSwing(opts.swing);
  return root;
}
