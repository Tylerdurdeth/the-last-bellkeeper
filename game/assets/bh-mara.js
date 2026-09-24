// Mara, the last bellkeeper (v2), from references-v2/R-mara.png: a stout elderly keeper, 1.55 m,
// silver bun with a copper hairpin, coral neckerchief, ivory rolled-sleeve blouse, ochre work
// apron with bib pocket and a copper tool belt, dark brown skirt, laced brown boots. Front is +Z.
// Rig pivots (userData.joints): chest (waist), head (neck), leftArm/rightArm (shoulder),
//   leftForearm/rightForearm (elbow), leftHand/rightHand.
// Acting hooks:
//   userData.setPose({yaw, pitch, lean, lever, wave, gesture, t}) with
//     yaw/pitch  head turn (radians, clamped ±1.2 / ±0.5; the chest follows 35% of the yaw)
//     lean       chest pitch (+ forward)       lever 0..1  right arm reaches up-forward, grips, pulls down
//     wave 0..1  right arm raised, hand waving with t        gesture 0..1  both hands open, palms out ("listen")
//   userData.headToward(localPoint) -> {yaw, pitch} toward a point in Mara's own space (feed to setPose).
export default function (THREE, opts = {}) {
  const T = THREE;
  const root = new T.Group(); root.name = 'bh-mara';
  const rig = new T.Group(); root.add(rig);
  const paint = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .85 }), { name: 'fabric' });
  const metal = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .45, metalness: .35 }), { name: 'metal' });
  const cloth = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .9, side: T.DoubleSide }), { name: 'fabric' });
  const C = h => new T.Color(h);
  const SKIN = C(0xE0A882), SKIN_SH = C(0xC0835F), HAIR = C(0xD9DBD6), HAIR_SH = C(0x9EA6A2), BLOUSE = C(0xF2E6C9), BLOUSE_SH = C(0xD9C9A8),
    APRON = C(0xC29A4E), APRON_SH = C(0x9A7438), SKIRT = C(0x5A3E2E), BOOT = C(0x6B4630), BOOT_SH = C(0x4A3022), CORAL = C(0xD96956),
    COPPER = C(0xB8733F), VERD = C(0x3E9C8C), INK = C(0x2A1E1C), LIP = C(0xB06A58), BELT = C(0x7A4E33);
  const joints = {}; root.userData.joints = joints;
  const group = (name, x, y, z, parent = rig) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); joints[name] = g; return g; };
  function colorize(geo, fn) { const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color(), v = new T.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } geo.setAttribute('color', new T.BufferAttribute(col, 3)); return geo; }
  const solid = (g, c) => colorize(g, (v, o) => o.copy(c));
  const mesh = (geo, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, mat = paint) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const ell = (parent, c, x, y, z, a, b, d, ws = 14, hs = 10, mat) => { const g = new T.SphereGeometry(1, ws, hs); g.scale(a, b, d); return mesh(solid(g, c), parent, x, y, z, 0, 0, 0, mat); };
  const lathe = (parent, prof, fn, x = 0, y = 0, z = 0, depth = 1, segs = 20) => { const g = new T.LatheGeometry(prof.map(([r, h]) => new T.Vector2(r, h)), segs); g.scale(1, 1, depth); return mesh(colorize(g, fn), parent, x, y, z); };
  function tube(parent, pts, r0, r1, c, mat = paint, radial = 8, steps = 10) {
    const curve = new T.CatmullRomCurve3(pts.map(q => new T.Vector3(...q))), g = new T.TubeGeometry(curve, steps, 1, radial, false), p = g.attributes.position, v = new T.Vector3(), q = new T.Vector3();
    for (let s = 0; s <= steps; s++) { curve.getPointAt(s / steps, q); const r = r0 + (r1 - r0) * s / steps; for (let k = 0; k <= radial; k++) { const i = s * (radial + 1) + k; v.fromBufferAttribute(p, i).sub(q).normalize().multiplyScalar(r).add(q); p.setXYZ(i, v.x, v.y, v.z); } }
    g.computeVertexNormals(); return mesh(solid(g, c), parent, 0, 0, 0, 0, 0, 0, mat);
  }
  // ---- legs, boots, skirt (static base) ----
  const base = group('base', 0, 0, 0);
  for (const s of [-1, 1]) {
    ell(base, BOOT, s * .1, .06, .05, .085, .07, .15);
    lathe(base, [[.065, .05], [.072, .14], [.068, .26], [.075, .28]], (v, o) => o.copy(v.y > .25 ? BOOT_SH : BOOT), s * .1, 0, .0, 1, 12);
    for (let k = 0; k < 3; k++) mesh(solid(new T.TorusGeometry(.072, .007, 4, 12), BOOT_SH), base, s * .1, .12 + k * .05, 0, Math.PI / 2);
  }
  lathe(base, [[.2, .26], [.3, .27], [.29, .45], [.25, .72], [.22, .8], [.2, .82]], (v, o) => o.copy(SKIRT).lerp(C(0x3e2a20), v.y < .3 ? .4 : 0), 0, 0, 0, .85);
  // Apron skirt panel: curved cloth with patches.
  { const g = new T.CylinderGeometry(1, 1, 1, 14, 6, true, -.95, 1.9), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) + .5, a = Math.atan2(p.getX(i), p.getZ(i)), r = .305 - .06 * t; p.setXYZ(i, Math.sin(a) * r, .33 + t * .52, Math.cos(a) * r * .88 + .015); } g.computeVertexNormals();
    mesh(colorize(g, (v, c) => c.copy(APRON).lerp(APRON_SH, v.y < .38 ? .5 : 0)), base, 0, 0, 0, 0, 0, 0, cloth); }
  ell(base, APRON_SH, -.08, .5, .27, .07, .07, .012); // patch
  // Tool belt with copper wrenches and a hammer.
  lathe(base, [[.255, .8], [.262, .83], [.262, .86], [.255, .88]], (v, o) => o.copy(BELT), 0, 0, 0, .86);
  mesh(solid(new T.BoxGeometry(.06, .05, .02), COPPER), base, 0, .845, .235, 0, 0, 0, metal);
  for (const [x, len] of [[-.15, .2], [-.08, .23], [.02, .18], [.1, .21]]) { mesh(solid(new T.BoxGeometry(.022, len, .012), COPPER), base, x, .84 - len / 2, .24 - Math.abs(x) * .15, 0, 0, x * .5, metal); mesh(solid(new T.TorusGeometry(.022, .008, 4, 8), COPPER), base, x, .84 - len, .24 - Math.abs(x) * .15, 0, 0, 0, metal); }
  ell(base, APRON_SH, -.24, .76, .1, .06, .08, .05); // pouch
  mesh(solid(new T.CylinderGeometry(.035, .05, .09, 8), COPPER), base, .23, .76, .1, 0, 0, 0, metal); // oil can
  // ---- chest (waist pivot) ----
  const chest = group('chest', 0, .86, 0);
  lathe(chest, [[.24, 0], [.27, .1], [.27, .24], [.24, .34], [.16, .4], [.07, .43]], (v, o) => o.copy(BLOUSE).lerp(BLOUSE_SH, v.y < .05 ? .4 : 0), 0, 0, 0, .78);
  { const g = new T.CylinderGeometry(1, 1, 1, 10, 4, true, -.7, 1.4), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) + .5, a = Math.atan2(p.getX(i), p.getZ(i)), r = .245 - .03 * t; p.setXYZ(i, Math.sin(a) * r, t * .3, Math.cos(a) * r * .8 + .012); } g.computeVertexNormals(); mesh(colorize(g, (v, c) => c.copy(APRON)), chest, 0, 0, 0, 0, 0, 0, cloth); }
  ell(chest, APRON_SH, 0, .15, .205, .08, .06, .012); // bib pocket
  for (const s of [-1, 1]) tube(chest, [[s * .1, .3, .19], [s * .14, .38, .1], [s * .12, .4, -.1], [s * .1, .2, -.19]], .016, .016, APRON_SH);
  // Coral neckerchief: knot + two tails.
  mesh(solid(new T.TorusGeometry(.085, .035, 6, 16), CORAL), chest, 0, .41, .01, Math.PI / 2 + .25);
  ell(chest, CORAL, 0, .37, .1, .045, .04, .035);
  for (const s of [-1, 1]) { const g = new T.ConeGeometry(.05, .14, 4); g.rotateZ(Math.PI); const o = mesh(solid(g, CORAL), chest, s * .035, .3, .11, .25, 0, s * .45); }
  // ---- head ----
  const head = group('head', 0, .44, .01, chest);
  lathe(head, [[.04, 0], [.045, .06]], (v, o) => o.copy(SKIN_SH), 0, 0, 0, 1, 10);
  { const g = new T.SphereGeometry(1, 22, 16), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), low = Math.max(0, -y); p.setXYZ(i, p.getX(i) * (.108 + .01 * low), .15 + y * .13, p.getZ(i) * .1 + (p.getZ(i) > 0 ? .012 * low : 0)); } g.computeVertexNormals(); mesh(solid(g, SKIN), head); }
  ell(head, SKIN_SH, 0, .14, .105, .022, .028, .025); // nose
  for (const s of [-1, 1]) {
    ell(head, SKIN, s * .105, .15, 0, .02, .03, .016);                 // ears
    ell(head, INK, s * .04, .175, .092, .014, .01, .008);               // smiling eyes (squint arcs)
    tube(head, [[s * .018, .196, .096], [s * .042, .205, .094], [s * .066, .196, .084]], .006, .004, HAIR_SH); // brows
    ell(head, C(0xE89880), s * .06, .13, .085, .025, .016, .01);        // cheeks
  }
  tube(head, [[-.03, .095, .098], [0, .087, .104], [.03, .095, .098]], .006, .006, LIP);
  const cap = new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, 1.75); cap.scale(.12, .125, .112); mesh(solid(cap, HAIR), head, 0, .17, -.01);
  for (let i = 0; i < 5; i++) ell(head, i % 2 ? HAIR : HAIR_SH, -.08 + i * .04, .245, .05 - Math.abs(i - 2) * .02, .045, .03, .04);
  ell(head, HAIR, 0, .3, -.06, .075, .07, .07);                          // bun
  tube(head, [[-.12, .32, -.02], [0, .31, -.06], [.1, .33, -.1]], .007, .007, COPPER, metal);   // hairpin
  ell(head, COPPER, -.125, .32, -.02, .018, .018, .018, 8, 6, metal);
  // ---- arms ----
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'left' : 'right';
    const arm = group(side + 'Arm', s * .235, .33, 0, chest);
    ell(arm, BLOUSE, 0, 0, 0, .075, .075, .075);
    tube(arm, [[0, 0, 0], [s * .02, -.13, 0], [s * .01, -.24, .01]], .07, .062, BLOUSE);
    ell(arm, BLOUSE_SH, 0, -.13, -.05, .03, .04, .01); // sleeve patch hint
    const fore = group(side + 'Forearm', s * .01, -.25, .01, arm);
    lathe(fore, [[.062, .02], [.068, -.02], [.06, -.05]], (v, o) => o.copy(BLOUSE_SH), 0, 0, 0, 1, 12); // rolled cuff
    tube(fore, [[0, -.03, 0], [0, -.13, .01], [0, -.22, .01]], .048, .038, SKIN);
    const hand = group(side + 'Hand', 0, -.23, .01, fore);
    ell(hand, SKIN, 0, -.04, 0, .042, .055, .03);
    ell(hand, SKIN_SH, s * -.035, -.03, .02, .016, .03, .016); // thumb
  }
  // ---- batch per pivot ----
  const parents = []; root.traverse(o => { if (o.isGroup) parents.push(o); });
  for (const parent of parents) {
    const buckets = new Map(); for (const o of parent.children) if (o.isMesh) { const k = o.material.uuid; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o); }
    for (const nodes of buckets.values()) {
      if (nodes.length < 2) continue;
      const arrays = { position: [], normal: [], color: [] };
      for (const o of nodes) { o.updateMatrix(); const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrix); for (const k in arrays) arrays[k].push(...g.getAttribute(k).array); g.dispose(); }
      const g = new T.BufferGeometry(); for (const k in arrays) g.setAttribute(k, new T.Float32BufferAttribute(arrays[k], 3));
      const o = new T.Mesh(g, nodes[0].material); o.castShadow = o.receiveShadow = true; parent.add(o); for (const n of nodes) { parent.remove(n); n.geometry.dispose(); }
    }
  }
  // ---- acting ----
  const clamp = (v, a) => Math.max(-a, Math.min(a, v));
  function setPose({ yaw = 0, pitch = 0, lean = 0, lever = 0, wave = 0, gesture = 0, t = 0 } = {}) {
    const J = joints; yaw = clamp(yaw, 1.2); pitch = clamp(pitch, .5);
    J.chest.rotation.set(.12 * lean + .03 * Math.sin(t * 1.3) * (1 - lever), yaw * .35, 0);
    J.head.rotation.set(-pitch + .05 * lean, yaw * .65, .04 * Math.sin(t * .9));
    // lever: 0..0.5 reach up-forward and grip, 0.5..1 pull down hard with the chest bending into it.
    const reach = Math.min(1, lever * 2), pull = Math.max(0, lever * 2 - 1);
    const waveUp = wave, wv = Math.sin(t * 9) * .45 * wave;
    J.rightArm.rotation.set(-.1 - 2.3 * reach + 1.5 * pull - 2.6 * waveUp * (1 - reach) - .9 * gesture, 0, .12 + .25 * waveUp + .5 * gesture);
    J.rightForearm.rotation.set(-.35 - .2 * reach + .5 * pull - .5 * waveUp - .6 * gesture, 0, wv);
    J.rightHand.rotation.set(0, 0, wv * .5);
    J.leftArm.rotation.set(-.1 - .9 * gesture + .3 * pull, 0, -.12 - .5 * gesture);
    J.leftForearm.rotation.set(-.35 - .6 * gesture, 0, 0);
    J.chest.rotation.x += .18 * pull;
    root.updateMatrixWorld(true);
  }
  function headToward(p) { const h = new T.Vector3(); joints.head.getWorldPosition(h); root.worldToLocal(h); return { yaw: Math.atan2(p.x - h.x, p.z - h.z), pitch: Math.atan2(p.y - h.y - .15, Math.hypot(p.x - h.x, p.z - h.z)) }; }
  root.userData.setPose = setPose; root.userData.headToward = headToward;
  setPose(opts.pose || {});
  const box = new T.Box3(), v = new T.Vector3(); root.updateMatrixWorld(true);
  root.traverse(n => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const k = 1.55 / (box.max.y - box.min.y), c = box.getCenter(new T.Vector3());
  rig.scale.setScalar(k); rig.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  return root;
}
