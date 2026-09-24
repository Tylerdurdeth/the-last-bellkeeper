// Bellhollow guardian (v2), from references-v2/R-guardian.png (calm: tulip-bud hood, slender
// verdigris arms with fan hands, ivory petal bell-skirt over a honey-timber core, rotor heart,
// wispy trail) and R-guardian-inhale.png (hood blooms open, coral inner petals, arms flung wide,
// rotor blazing wind-cyan). ~4.0 m from trail tip to bud tip. Front is +Z.
//
// Rig (all pivots at their joint): root.userData.joints =
//   {body, skirt, trail, torso, rotor, hood, face, leftArm, rightArm, leftForearm, rightForearm,
//    leftHand, rightHand, petals:[6 hood petal pivots], capelet}
// root.userData.setPose(p) applies a named-parameter pose (all 0 = calm rest):
//   crouch 0..1 (body sinks, skirt squashes)   bloom -0.2..1 (hood petals: closed bud -> flat flower)
//   spread 0..1 (arms flung wide + up)          thrust 0..1 (arms + body forward, exhale snap)
//   slump 0..1 (spent droop)                    lean -1..1 (torso pitch; + = forward)
//   look {x,y} radians (hood aim)               swell 0..1 (skirt flare)  fold 0..1 (arms folded, tending)
//   rotorGlow 0..1 (0 warm gold ember, 1 blazing wind cyan)  rotor (angle, radians)  trail (sway, radians)
// opts: {pose:'calm'|'inhale'|'exhale'|'slump'|'tend', variant:'a'|'b'|'c'}
export default function (THREE, opts = {}) {
  const T = THREE, variant = opts.variant || 'd';
  const V = { // candidate proportions (a: slender reference, b: chunkier readable, c: wide skirt heavy hood)
    a: { skirtLen: 1.45, skirtWid: .72, hoodLen: .86, hoodWid: .5, armR: .05, finger: .26, waist: .22, shoulder: .40 },
    b: { skirtLen: 1.5, skirtWid: .84, hoodLen: .98, hoodWid: .6, armR: .062, finger: .31, waist: .26, shoulder: .46 },
    d: { skirtLen: 1.55, skirtWid: 1.12, hoodLen: 1.12, hoodWid: .84, armR: .09, finger: .46, waist: .31, shoulder: .74 },
    c: { skirtLen: 1.62, skirtWid: .95, hoodLen: 1.08, hoodWid: .68, armR: .066, finger: .34, waist: .28, shoulder: .5 },
  }[variant] || {};
  const root = new T.Group(); root.name = 'bh-guardian';
  const rig = new T.Group(); rig.name = 'rig'; root.add(rig);
  // Two vertex-coloured materials carry every opaque part (one draw per rigid joint) + one glow.
  const paint = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .82 }), { name: 'plaster' });
  const metal = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .5, metalness: .25 }), { name: 'metal' });
  const glow = Object.assign(new T.MeshStandardMaterial({ color: 0xf6d9b0, emissive: 0xe9b949, emissiveIntensity: .6, roughness: .4 }), { name: 'guardian-glow' });
  const C = h => new T.Color(h);
  const IVORY = C(0xF2E6C9), IVORY_SH = C(0xCDBB95), TIMBER = C(0xC8894A), TIMBER_SH = C(0x7A4E33), VERD = C(0x3E9C8C), VERD_SH = C(0x2C6A60),
    COPPER = C(0xB8733F), CORAL = C(0xD96956), BLUSH = C(0xF0B7A2), DEEP = C(0x2C4A45), WISP = C(0xE9EEEA);
  const joints = {}; root.userData.joints = joints;
  const group = (name, x = 0, y = 0, z = 0, parent = rig) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); if (name) joints[name] = g; return g; };
  function colorize(geo, fn) {
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color(), v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const r = fn(v, i, c) || c; col[i * 3] = r.r; col[i * 3 + 1] = r.g; col[i * 3 + 2] = r.b; }
    geo.setAttribute('color', new T.BufferAttribute(col, 3)); return geo;
  }
  const solid = (geo, hex) => colorize(geo, (v, i, c) => c.copy(hex));
  function mesh(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
  }
  // Closed petal shell: a deformed sphere. Local +Y = length, +Z = inner (cupped) face.
  function petal({ len, wid, thick = .05, cup = .35, bend = 0, outer = IVORY, inner = IVORY_SH, base = null, seg = [12, 10], shape = .55, rim = null }) {
    const g = new T.SphereGeometry(1, seg[0], seg[1]), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), v = (y + 1) / 2;
      const w = wid * (shape + (1 - shape) * Math.sin(Math.PI * Math.min(1, v * 1.25)) + .25 * v) * .5;
      const X = x * w, Z = z * thick * (1 - .5 * v) + cup * x * x * w + bend * v * v * len, Y = v * len;
      p.setXYZ(i, X, Y, Z);
      if (z > 0) { c.copy(inner); if (base) c.lerp(base, Math.max(0, 1 - v * 2.2)); } else { c.copy(outer); c.lerp(IVORY_SH, Math.max(0, .5 - v) * .9); }
      if (rim && z < .2 && (Math.abs(x) > .93 || v > .94) && v > .45) c.copy(rim);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  }
  function lathe(profile, segs = 20, colorFn = null) {
    const g = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), segs);
    return colorFn ? colorize(g, colorFn) : g;
  }
  // Tapered tube along points (r0 at start, r1 at end), closed with small caps by tapering to r1.
  function taper(points, r0, r1, radial = 8, steps = 16, hex = VERD) {
    const curve = new T.CatmullRomCurve3(points.map(q => new T.Vector3(...q)));
    const g = new T.TubeGeometry(curve, steps, 1, radial, false), p = g.attributes.position;
    const frames = curve.computeFrenetFrames(steps, false), v = new T.Vector3(), c = new T.Vector3();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps; curve.getPointAt(t, c); const r = r0 + (r1 - r0) * t;
      for (let k = 0; k <= radial; k++) { const i = s * (radial + 1) + k; v.fromBufferAttribute(p, i).sub(c).normalize().multiplyScalar(r).add(c); p.setXYZ(i, v.x, v.y, v.z); }
    }
    g.computeVertexNormals();
    return typeof hex === 'function' ? colorize(g, hex) : solid(g, hex);
  }
  const ball = (r, hex, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8) => { const g = new T.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); return solid(g, hex); };

  // ---------------- body: an ancient hovering BELL (R-guardian spec: bell body, rotor heart, petal hood) ----------------
  const waistY = 2.05, shY = .8, chestY = .38;
  const body = group('body', 0, waistY, 0);
  const skirt = group('skirt', 0, 0, 0, body);   // the bell itself (swells/squashes with the breath)
  const bellProf = [[.14, .96], [.46, .88], [.62, .72], [.67, .42], [.69, .1], [.76, -.4], [.95, -.95], [1.18, -1.36], [1.3, -1.5], [1.33, -1.58], [1.2, -1.6], [1.02, -1.4], [.72, -.8], [.5, -.2], [.001, .1]];
  const bellR = y => { for (let i = 1; i < 10; i++) if (y >= bellProf[i][1]) { const a = bellProf[i - 1], b = bellProf[i], t = (y - b[1]) / (a[1] - b[1]); return b[0] + (a[0] - b[0]) * t; } return 1.3; };
  mesh(lathe(bellProf.slice().reverse(), 40, (v, i, c) => {   // lathe profiles run bottom->top for outward faces
    const inside = v.y < -1.35 && Math.hypot(v.x, v.z) < bellR(v.y) - .03 || v.y < -1.3 && i % 2 === 0 && false;
    const a = Math.atan2(v.x, v.z), petalMotif = Math.max(0, Math.cos(a * 8)) * Math.max(0, Math.min(1, (v.y + 1.2) / .6)) * Math.max(0, Math.min(1, (-.1 - v.y) / .4));
    c.copy(IVORY).lerp(IVORY_SH, .15 + .5 * petalMotif * (Math.cos(a * 8) > .93 ? 1 : .35));   // carved petal relief round the flare
    if (v.y < -1.44) c.copy(VERD).lerp(VERD_SH, .3);                                                // verdigris lip
    return c;
  }), paint, skirt);
  for (const [y, r, t, col] of [[.62, .64, .05, COPPER], [.02, .7, .06, COPPER], [-.62, .83, .045, VERD], [-1.28, 1.13, .07, COPPER]]) mesh(solid(new T.TorusGeometry(r, t, 8, 40), col), metal, skirt, 0, y, 0, Math.PI / 2, 0, 0);   // bands
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; mesh(ball(.045, COPPER), metal, skirt, Math.sin(a) * 1.2, -1.3, Math.cos(a) * 1.2); }   // rim rivets
  // Dark hollow mouth with the breath glowing inside (a clapper-like core).
  mesh(lathe([[.001, -.45], [.7, -.7], [1.0, -1.3], [1.16, -1.56]], 28, (v, i, c) => c.copy(DEEP)), paint, skirt);
  mesh(new T.SphereGeometry(.26, 14, 10), glow, skirt, 0, -1.25, 0);
  // Crown loop on top of the bell, like a bell's canon, under the hood.
  mesh(solid(new T.TorusGeometry(.2, .07, 8, 18), COPPER), metal, skirt, 0, .98, 0, 0, 0, 0);

  // ---------------- trail: a flat breath swirl under the rim (no leg-like tubes) ----------------
  const trail = group('trail', 0, waistY - 1.62, 0);
  for (let k = 0; k < 4; k++) {
    const pts = []; for (let i = 0; i <= 14; i++) { const f = i / 14, a = k * Math.PI / 2 + f * 3.4, r = .35 + f * .75; pts.push([Math.cos(a) * r, -f * .28, Math.sin(a) * r]); }
    const o = mesh(taper(pts, .09, .015, 6, 22, (v, i, c) => c.copy(WISP)), paint, trail); o.scale.y = .45;
  }

  // ---------------- torso: rotor heart mounted in the bell's breast, pipes behind ----------------
  const torso = group('torso', 0, 0, 0, body);
  const hz = bellR(chestY);
  mesh(ball(.46, IVORY, 1, 1, .32, 20, 12), paint, torso, 0, chestY, hz - .02);
  mesh(solid(new T.TorusGeometry(.42, .075, 10, 36), COPPER), metal, torso, 0, chestY, hz + .08);
  mesh(solid(new T.TorusGeometry(.3, .035, 8, 30), VERD), metal, torso, 0, chestY, hz + .11);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mesh(ball(.04, COPPER), metal, torso, Math.cos(a) * .42, chestY + Math.sin(a) * .42, hz + .15); }
  mesh(solid(new T.CylinderGeometry(.11, .14, .34, 12), VERD), metal, torso, 0, shY + .15, 0);   // neck into the hood
  mesh(solid(new T.TorusGeometry(.2, .06, 8, 20), CORAL), paint, torso, 0, shY + .06, .02, Math.PI / 2 + .1, 0, 0);
  // Back of the bell: copper breath pipes and a timber spine, so the rear view is modelled.
  for (const s of [-1, 0, 1]) mesh(taper([[s * .28, -.9, -bellR(-.9) + .02], [s * .22, -.2, -bellR(-.2) - .04], [s * .16, .55, -bellR(.55) - .06], [s * .1, .9, -.3]], .06, .045, 8, 12, s ? COPPER : TIMBER_SH), s ? metal : paint, torso);
  // Petal collar where the hood meets the bell (pivot so it lifts on the inhale).
  const capelet = group('capelet', 0, shY - .02, 0, body);
  for (let i = 0; i < 10; i++) { const aa = i / 10 * Math.PI * 2 + .3;
    const pv = new T.Group(); pv.position.set(Math.sin(aa) * .4, 0, Math.cos(aa) * .36); pv.rotation.y = aa; capelet.add(pv);
    mesh(petal({ len: .5, wid: .44, thick: .05, cup: .3, bend: -.1, outer: IVORY, inner: IVORY_SH, seg: [10, 8], rim: COPPER }), paint, pv, 0, 0, 0, Math.PI - 1.2, 0, 0); }

  // ---------------- rotor heart ----------------
  const rotor = group('rotor', 0, chestY, hz + .14, body);
  mesh(new T.SphereGeometry(.14, 14, 10), glow, rotor);
  for (let i = 0; i < 5; i++) { // curved pinwheel blades, big enough to read from the camera
    const b = new T.SphereGeometry(1, 10, 6); b.scale(.2, .06, .03); b.translate(.18, .03, 0);
    const p = b.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k); p.setY(k, p.getY(k) + x * x * 1.6); }
    b.computeVertexNormals(); const o = mesh(b, glow, rotor); o.rotation.z = i * Math.PI * 2 / 5;
  }

  // ---------------- hood (tulip bud that blooms) ----------------
  const hood = group('hood', 0, shY + .26, 0, body);
  mesh(lathe([[.05, -.06], [.16, .02], [.2, .1], [.15, .16]], 14, (v, i, c) => c.copy(VERD).lerp(VERD_SH, .3)), metal, hood);
  for (let i = 0; i < 5; i++) { // calyx sepals
    const a = i / 5 * Math.PI * 2 + .3, pv = new T.Group(); pv.position.set(Math.sin(a) * .15, .02, Math.cos(a) * .15); pv.rotation.y = a + Math.PI; hood.add(pv);
    mesh(petal({ len: .26, wid: .15, thick: .03, cup: .2, bend: -.1, outer: VERD, inner: VERD_SH, seg: [8, 6] }), metal, pv, 0, 0, 0, -.9, 0, 0);
  }
  // Face mask inside the bud: calm ivory mask, glowing eye slits (revealed when the hood blooms).
  const face = group('face', 0, .3, .1, hood); // the mask sits at the front of the hood, under the petals
  { // calm carved mask: flattened oval, soft brow ridge, long nose ridge, closed-smile mouth line
    const g = new T.SphereGeometry(1, 20, 16), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * .2 * (1 - .18 * Math.max(0, -y)), y * .26, z * (z > 0 ? .14 : .1) - .03 * y * y); }
    g.computeVertexNormals(); mesh(colorize(g, (v, i, c) => c.copy(IVORY).lerp(IVORY_SH, v.z < .02 ? .5 : 0)), paint, face);
  }
  mesh(ball(.2, IVORY_SH, 1.05, .32, .5, 14, 8), paint, face, 0, .09, .05);          // brow ridge
  mesh(ball(.034, IVORY, 1, 3.2, 1.3, 8, 8), paint, face, 0, -.025, .135);             // nose ridge
  mesh(taper([[-.06, -.15, .115], [0, -.168, .125], [.06, -.15, .115]], .01, .01, 5, 6, TIMBER_SH), paint, face); // mouth line
  const eyes = group('eyes', 0, .02, .12, face);
  for (const s of [-1, 1]) { const e = new T.SphereGeometry(1, 12, 6); e.scale(.07, .024, .025); const o = mesh(e, glow, eyes, s * .085, 0, .012); o.rotation.z = s * -.16; }
  mesh(new T.SphereGeometry(.045, 10, 8), glow, face, 0, .3, -.14);                 // pistil light above the brow
  joints.petals = [];
  const HP = 6;
  for (let i = 0; i < HP; i++) {
    const innerRing = i % 2, a = Math.PI + (i - (HP - 1) / 2) * (Math.PI * 2 - 1.5) / HP; // hood: open at the front like a cowl around the face
    const pv = new T.Group(); pv.name = 'hoodPetal' + i; pv.position.set(Math.sin(a) * (innerRing ? .12 : .2), .06, Math.cos(a) * (innerRing ? .12 : .2)); pv.rotation.y = a + Math.PI; hood.add(pv);
    const tilt = new T.Group(); tilt.name = 'hoodPetalTilt' + i; pv.add(tilt);
    const len = V.hoodLen * (innerRing ? .9 : 1), wid = V.hoodWid * (innerRing ? .9 : 1);
    mesh(petal({ len, wid, thick: .08, cup: .45, bend: -.08, outer: IVORY, inner: BLUSH, base: CORAL, seg: [14, 12], shape: .55 }), paint, tilt);
    tilt.userData.inner = !!innerRing; tilt.userData.len = len; tilt.userData.front = Math.cos(a) > .3;
    joints.petals.push(tilt); joints['hoodPetal' + i] = tilt;
  }

  // ---------------- arms: shoulder -> forearm -> fan hand ----------------
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'left' : 'right';
    const arm = group(side + 'Arm', s * V.shoulder, shY - .18, -.02, body);
    mesh(ball(.15, COPPER, 1, 1, 1), metal, arm); mesh(ball(.2, IVORY, 1.1, .6, 1, 12, 8), paint, arm, s * .02, .08, 0);   // shoulder boss + ivory pauldron
    mesh(taper([[0, 0, 0], [s * .02, -.34, .01], [0, -.64, 0]], V.armR * 1.15, V.armR * .85, 8, 8, VERD), metal, arm);
    mesh(solid(new T.TorusGeometry(V.armR * 1.25, .018, 6, 14), COPPER), metal, arm, 0, -.3, 0, Math.PI / 2, 0, 0);
    const fore = group(side + 'Forearm', 0, -.66, 0, arm);
    mesh(ball(.08, COPPER), metal, fore);
    mesh(taper([[0, 0, 0], [0, -.3, .02], [0, -.6, 0]], V.armR, V.armR * .75, 8, 8, VERD), metal, fore);
    mesh(solid(new T.CylinderGeometry(V.armR * 1.35, V.armR * 1.3, .1, 10), COPPER), metal, fore, 0, -.48, 0);
    const hand = group(side + 'Hand', 0, -.62, 0, fore);
    mesh(ball(.055, COPPER), metal, hand);
    mesh(ball(.14, VERD, 1.2, .55, 1.1, 12, 8), metal, hand, 0, -.1, .01, 0, 0, 0);   // broad fan palm
    for (let f = 0; f < 5; f++) { // fan of long jointed fingers, splayed like the reference's open hand
      const a = (f - 2) * .38 + (f === 0 ? -.25 : 0) * s, L = V.finger * (f === 0 ? .72 : f === 2 ? 1.05 : .95);
      const x0 = Math.sin(a) * .07, y0 = -.12 - Math.cos(a) * .04;
      const x1 = x0 + Math.sin(a) * L * .55, y1 = y0 - Math.cos(a) * L * .55, x2 = x0 + Math.sin(a * 1.15) * L, y2 = y0 - Math.cos(a * 1.15) * L;
      mesh(taper([[x0, y0, .02], [x1, y1, .05], [x2, y2, .09]], .036, .02, 6, 6, (v, i, c) => c.copy(v.y < y1 ? VERD_SH : VERD)), metal, hand);
      mesh(ball(.024, COPPER), metal, hand, x1, y1, .05);
    }
  }

  // ---------------- batch rigid siblings per joint (one draw per material per pivot) ----------------
  const parents = []; root.traverse(o => { if (o.isGroup) parents.push(o); });
  for (const parent of parents) {
    // Fold material-only leaf pivots (petal placement groups without names) into their parent.
    for (const child of [...parent.children]) {
      if (!child.isGroup || child.name || child.children.some(n => !n.isMesh)) continue;
      child.updateMatrix();
      for (const m of [...child.children]) { m.applyMatrix4(child.matrix); parent.add(m); }
      parent.remove(child);
    }
  }
  for (const parent of parents) {
    const buckets = new Map();
    for (const o of parent.children) { if (!o.isMesh) continue; const key = o.material.uuid + (o.geometry.attributes.color ? 'c' : ''); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(o); }
    for (const nodes of buckets.values()) {
      if (nodes.length < 2) continue;
      const hasColor = !!nodes[0].geometry.attributes.color, arrays = { position: [], normal: [], ...(hasColor ? { color: [] } : {}) };
      for (const o of nodes) {
        o.updateMatrix(); const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); g.applyMatrix4(o.matrix);
        for (const k of Object.keys(arrays)) arrays[k].push(...g.getAttribute(k).array); g.dispose();
      }
      const g = new T.BufferGeometry(); for (const [k, a] of Object.entries(arrays)) g.setAttribute(k, new T.Float32BufferAttribute(a, 3));
      const o = new T.Mesh(g, nodes[0].material); o.castShadow = o.receiveShadow = true; o.name = (parent.name || 'part') + '-' + nodes[0].material.name; parent.add(o);
      for (const n of nodes) { parent.remove(n); n.geometry.dispose(); }
    }
  }

  // Tiny parts cast no shadow (saves shadow-pass draws; their shadow is sub-pixel anyway).
  for (const k of ['rotor', 'face', 'leftHand', 'rightHand']) joints[k].traverse(n => { if (n.isMesh) n.castShadow = false; });
  // ---------------- pose ----------------
  const rest = {}; for (const [k, o] of Object.entries(joints)) if (o.isObject3D) rest[k] = { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() };
  const glowCalm = C(0xE9B949), glowWind = C(0x8FD3E0), glowTmp = new T.Color();
  function setPose(q = {}) {
    const crouch = q.crouch || 0, bloom = q.bloom || 0, spread = q.spread || 0, thrust = q.thrust || 0, slump = q.slump || 0, lean = q.lean || 0,
      swell = q.swell || 0, fold = q.fold || 0, look = q.look || { x: 0, y: 0 }, rg = q.rotorGlow ?? 0, rage = q.rage || 0;
    const J = joints, R = rest;
    J.body.position.copy(R.body.p); J.body.position.y -= .42 * crouch + .18 * slump - .12 * thrust;
    J.body.position.z = R.body.p.z + .25 * thrust - .08 * crouch;
    J.body.rotation.set(R.body.r.x + .3 * lean - .16 * crouch + .3 * thrust + .22 * slump - .38 * rage, 0, 0);   // rage: rears up and back
    J.body.position.y += .35 * rage;
    J.skirt.scale.set(1 + .22 * swell + .1 * crouch - .06 * slump, 1 - .16 * crouch + .06 * thrust, 1 + .22 * swell + .1 * crouch - .06 * slump);
    J.trail.rotation.set(-.35 * thrust + .15 * crouch + (q.trailPitch || 0), 0, q.trail || 0);
    J.trail.scale.set(1 + .2 * swell, 1 - .25 * crouch + .35 * thrust, 1 + .2 * swell);
    J.capelet.rotation.x = -.25 * spread + .1 * slump; J.capelet.scale.setScalar(1 + .12 * spread);
    J.hood.rotation.set(R.hood.r.x - look.x + .25 * slump - .12 * spread + .12 * thrust, look.y, 0);
    J.hood.scale.setScalar(1 + .08 * bloom);
    for (const p of J.petals) {
      // closed bud tilt +0.3 (tips meet); bloom 1 = petals thrown out past horizontal like R-guardian-inhale.
      const closed = p.userData.front ? .05 : p.userData.inner ? .36 : .27, open = p.userData.inner ? -1.05 : -1.5;
      p.rotation.x = closed + (open - closed) * Math.min(1, Math.max(0, bloom) + .25 * rage) - .35 * rage + Math.min(0, bloom) * -.5 + .1 * slump;
    }
    J.face.scale.setScalar(1.2 + .1 * Math.max(0, bloom));
    J.eyes.scale.set(1 + .15 * rg + .3 * rage, Math.max(.08, q.eyes ?? 1) * (1 + .35 * rg + .5 * rage), 1);
    for (const s of ['left', 'right']) {
      const k = s === 'left' ? -1 : 1, A = J[s + 'Arm'], F = J[s + 'Forearm'], H = J[s + 'Hand'];
      // Rest: hanging slightly out and forward; spread: flung wide and up; thrust: pushed forward.
      A.rotation.set(-.22 - 1.25 * thrust - .2 * spread + .15 * slump - .95 * fold - .6 * rage, 0, k * (.28 + 1.25 * spread - .1 * slump - .15 * thrust - .1 * fold + 1.2 * rage));   // rage: arms raised high
      F.rotation.set(-.45 - .1 * spread + .35 * thrust - .15 * slump - 1.25 * fold, 0, k * (.15 * spread - .45 * fold));
      H.rotation.set(-.15 - .35 * spread + .25 * thrust, k * .3 * spread, k * (.25 * spread - .1 * slump));
      H.scale.set(1 + .45 * spread + .25 * thrust, 1 + .15 * spread, 1);
    }
    if (q.rotor !== undefined) J.rotor.rotation.z = q.rotor;
    glowTmp.copy(glowCalm).lerp(glowWind, Math.min(1, rg)).lerp(C(0xFF6A2A), Math.min(1, rage)); glow.emissive.copy(glowTmp); glow.emissiveIntensity = .5 + 2.1 * rg + 1.5 * rage;   // rage: red-gold heart and eyes glow.color.copy(glowTmp).lerp(C(0xffffff), .35);
    root.updateMatrixWorld(true);
  }
  const POSES = {
    calm: {}, inhale: { crouch: .9, bloom: 1, spread: 1, lean: -.12, swell: .8, rotorGlow: 1, look: { x: -.4, y: 0 } },
    exhale: { thrust: 1, bloom: .35, lean: .5, rotorGlow: .8, look: { x: -.35, y: 0 } }, slump: { slump: 1, bloom: -.2, rotorGlow: .05 },
    rage: { rage: 1, bloom: 1, spread: .6, swell: .6, rotorGlow: .6, look: { x: .5, y: 0 } },
    tend: { fold: 1, crouch: .3, lean: .35, look: { x: -.35, y: 0 }, bloom: .5, rotorGlow: .15, eyes: .12 },
  };
  root.userData.setPose = setPose; root.userData.poses = POSES; root.userData.glowMaterial = glow;
  root.userData.animation = { front: '+Z', joints: Object.keys(joints), pose: 'userData.setPose' };
  // Centre on x/z with the trail tip at y = 0 (measured on vertices in the calm pose).
  setPose(POSES.calm);
  const box = new T.Box3(), v = new T.Vector3(); root.updateMatrixWorld(true);
  root.traverse(n => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const k = (opts.height || 4) / (box.max.y - box.min.y), c = box.getCenter(new T.Vector3());
  rig.scale.setScalar(k); rig.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  root.userData.height = opts.height || 4;
  root.userData.anchors = { heart: new T.Vector3(0, (waistY + chestY - box.min.y) * k, (V.waist + .2 - c.z) * k), mouth: new T.Vector3(0, (waistY + shY + .6 - box.min.y) * k, (.2 - c.z) * k) };
  setPose(POSES[opts.pose] || POSES.calm);
  return root;
}
