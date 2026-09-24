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
    d: { skirtLen: 1.55, skirtWid: 1.12, hoodLen: 1.08, hoodWid: .78, armR: .075, finger: .34, waist: .31, shoulder: .54 },
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

  // ---------------- trail (wispy lower tail) ----------------
  const hem = 1.05, waistY = hem + V.skirtLen * .86;
  const trail = group('trail', 0, hem + .1, 0);
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const f = i / 8, a = k * 2.1 + f * 3.6, r = .12 + f * (.34 - k * .06); pts.push([Math.cos(a) * r, -f * (1.05 - k * .08), Math.sin(a) * r * .9]); }
    mesh(taper(pts, .2 - k * .03, .018, 7, 18, (v, i, c) => c.copy(WISP).lerp(IVORY, Math.min(1, Math.max(0, (v.y + 1) / 1.1)))), paint, trail);
  }
  { // swirl flourish at the tip
    const pts = []; for (let i = 0; i <= 14; i++) { const f = i / 14, a = f * 5.2 + 1, r = .42 * (1 - f * .8); pts.push([Math.cos(a) * r, -1.02 + f * .12, Math.sin(a) * r]); }
    mesh(taper(pts, .06, .012, 6, 26, WISP), paint, trail);
  }

  // ---------------- body (waist pivot) ----------------
  const body = group('body', 0, waistY, 0);
  const skirt = group('skirt', 0, 0, 0, body);
  // Honey-timber core (visible between the front petals), pointed like a seed.
  mesh(lathe([[0, -V.skirtLen * .92], [.12, -V.skirtLen * .8], [.3, -V.skirtLen * .45], [V.waist + .06, -.1], [V.waist, .02]], 18,
    (v, i, c) => c.copy(TIMBER).lerp(TIMBER_SH, .5 + .5 * Math.sin(Math.atan2(v.x, v.z) * 7 + v.y * 5) > .82 ? .6 : 0)), paint, skirt);
  mesh(solid(new T.TorusGeometry(V.waist + .06, .065, 8, 28), COPPER), metal, skirt, 0, .04, 0, Math.PI / 2, 0, 0); // copper waist band
  // Coral cloth tongue at the waist front (R-guardian).
  { const g = petal({ len: .62, wid: .34, thick: .03, cup: .15, bend: .06, outer: CORAL, inner: CORAL, seg: [10, 8], shape: .9 });
    const o = mesh(g, paint, skirt, 0, .02, V.waist + .03, Math.PI - .12, 0, 0); o.scale.set(1, 1, 1); }
  const SK = 7;
  for (let i = 0; i < SK; i++) {
    // Front gap: petals avoid the +Z front sector so the timber core and coral read, as in the reference.
    const a = (i - (SK - 1) / 2) * (2 * Math.PI - .9) / SK + Math.PI;
    const pv = new T.Group(); pv.position.set(Math.sin(a) * (V.waist - .02), .06, Math.cos(a) * (V.waist - .02)); pv.rotation.y = a; skirt.add(pv);
    const g = petal({ len: V.skirtLen, wid: V.skirtWid * (i === 0 || i === SK - 1 ? .9 : 1), thick: .12, cup: .3, bend: -.2, outer: IVORY, inner: IVORY_SH, base: TIMBER_SH, seg: [14, 12], shape: .62, rim: COPPER });
    mesh(g, paint, pv, 0, 0, 0, Math.PI - .34, 0, (i % 2 ? .04 : -.04));
  }

  // ---------------- torso ----------------
  const torso = group('torso', 0, 0, 0, body);
  const chestY = .52, shY = .8;
  mesh(lathe([[V.waist, -.02], [V.waist + .02, .14], [V.waist + .1, chestY - .05], [V.shoulder - .08, chestY + .14], [V.shoulder - .12, shY], [.12, shY + .1], [.1, shY + .12]], 20,
    (v, i, c) => { const a = Math.atan2(v.x, v.z), grain = Math.sin(a * 5 + v.y * 9 + Math.sin(a * 3) * 1.5); return c.copy(TIMBER).lerp(TIMBER_SH, grain > .8 ? .55 : grain < -.9 ? .25 : 0); }), paint, torso);
  // Rotor housing: ivory plate + copper ring set into the chest.
  mesh(ball(.32, IVORY, 1, 1.1, .45, 16, 10), paint, torso, 0, chestY, V.waist + .07);
  mesh(solid(new T.TorusGeometry(.27, .06, 8, 28), COPPER), metal, torso, 0, chestY, V.waist + .15);
  mesh(solid(new T.TorusGeometry(.19, .025, 6, 24), VERD), metal, torso, 0, chestY, V.waist + .17);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; mesh(ball(.03, COPPER), metal, torso, Math.cos(a) * .27, chestY + Math.sin(a) * .27, V.waist + .21); }
  // High timber collar (two flared leaves) and coral scarf.
  for (const s of [-1, 1]) {
    const g = petal({ len: .42, wid: .34, thick: .04, cup: .3, bend: -.12, outer: TIMBER, inner: TIMBER_SH, seg: [10, 8] });
    const pv = new T.Group(); pv.position.set(s * .08, shY - .02, .02); pv.rotation.y = Math.PI + s * .9; torso.add(pv); mesh(g, paint, pv, 0, 0, 0, -.35, 0, 0);
  }
  mesh(solid(new T.TorusGeometry(.17, .055, 8, 20), CORAL), paint, torso, 0, shY + .02, .02, Math.PI / 2 + .15, 0, 0);
  mesh(solid(new T.CylinderGeometry(.075, .095, .3, 10), VERD), metal, torso, 0, shY + .15, 0);
  // Petal capelet on the shoulders (pivot so it can lift on the inhale).
  const capelet = group('capelet', 0, shY - .06, 0, body);
  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * .52 + (i < 3 ? -.25 : .25);
    for (const back of [0, 1]) {
      const aa = back ? a + Math.PI : a;
      const pv = new T.Group(); pv.position.set(Math.sin(aa) * .2, 0, Math.cos(aa) * .16); pv.rotation.y = aa; capelet.add(pv);
      mesh(petal({ len: .5, wid: .42, thick: .045, cup: .3, bend: -.1, outer: IVORY, inner: IVORY_SH, seg: [10, 8] }), paint, pv, 0, 0, 0, Math.PI - 1.05, 0, 0);
    }
  }
  // Back: timber spine ridge + copper breath pipes so the rear view is modelled.
  mesh(taper([[0, .02, -V.waist + .02], [0, .4, -V.waist - .06], [0, .78, -.2]], .07, .05, 8, 10, TIMBER_SH), paint, torso);
  for (const s of [-1, 1]) mesh(taper([[s * .12, .05, -V.waist], [s * .2, .45, -V.waist - .08], [s * .14, .82, -.16]], .035, .03, 6, 10, COPPER), metal, torso);

  // ---------------- rotor heart ----------------
  const rotor = group('rotor', 0, chestY, V.waist + .19, body);
  mesh(new T.SphereGeometry(.1, 12, 8), glow, rotor);
  for (let i = 0; i < 4; i++) { // curved pinwheel blades
    const b = new T.SphereGeometry(1, 10, 6); b.scale(.15, .045, .022); b.translate(.13, .025, 0);
    const p = b.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k); p.setY(k, p.getY(k) + x * x * 2.2); }
    b.computeVertexNormals(); const o = mesh(b, glow, rotor); o.rotation.z = i * Math.PI / 2;
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
    const arm = group(side + 'Arm', s * V.shoulder, shY - .1, -.02, body);
    mesh(ball(.1, COPPER, 1, 1, 1), metal, arm);
    mesh(taper([[0, 0, 0], [s * .02, -.34, .01], [0, -.64, 0]], V.armR * 1.15, V.armR * .85, 8, 8, VERD), metal, arm);
    mesh(solid(new T.TorusGeometry(V.armR * 1.25, .018, 6, 14), COPPER), metal, arm, 0, -.3, 0, Math.PI / 2, 0, 0);
    const fore = group(side + 'Forearm', 0, -.66, 0, arm);
    mesh(ball(.08, COPPER), metal, fore);
    mesh(taper([[0, 0, 0], [0, -.3, .02], [0, -.6, 0]], V.armR, V.armR * .75, 8, 8, VERD), metal, fore);
    mesh(solid(new T.CylinderGeometry(V.armR * 1.35, V.armR * 1.3, .1, 10), COPPER), metal, fore, 0, -.48, 0);
    const hand = group(side + 'Hand', 0, -.62, 0, fore);
    mesh(ball(.055, COPPER), metal, hand);
    mesh(ball(.1, VERD, 1, .55, 1.1, 12, 8), metal, hand, 0, -.1, .01, 0, 0, 0);
    for (let f = 0; f < 5; f++) { // fan of long jointed fingers, splayed like the reference's open hand
      const a = (f - 2) * .3 + (f === 0 ? -.25 : 0) * s, L = V.finger * (f === 0 ? .72 : f === 2 ? 1.05 : .95);
      const x0 = Math.sin(a) * .07, y0 = -.12 - Math.cos(a) * .04;
      const x1 = x0 + Math.sin(a) * L * .55, y1 = y0 - Math.cos(a) * L * .55, x2 = x0 + Math.sin(a * 1.15) * L, y2 = y0 - Math.cos(a * 1.15) * L;
      mesh(taper([[x0, y0, .02], [x1, y1, .05], [x2, y2, .09]], .026, .014, 6, 6, (v, i, c) => c.copy(v.y < y1 ? VERD_SH : VERD)), metal, hand);
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
      swell = q.swell || 0, fold = q.fold || 0, look = q.look || { x: 0, y: 0 }, rg = q.rotorGlow ?? 0;
    const J = joints, R = rest;
    J.body.position.copy(R.body.p); J.body.position.y -= .42 * crouch + .18 * slump - .12 * thrust;
    J.body.position.z = R.body.p.z + .25 * thrust - .08 * crouch;
    J.body.rotation.set(R.body.r.x + .3 * lean - .16 * crouch + .3 * thrust + .22 * slump, 0, 0);
    J.skirt.scale.set(1 + .22 * swell + .1 * crouch - .06 * slump, 1 - .16 * crouch + .06 * thrust, 1 + .22 * swell + .1 * crouch - .06 * slump);
    J.trail.rotation.set(-.35 * thrust + .15 * crouch + (q.trailPitch || 0), 0, q.trail || 0);
    J.trail.scale.set(1 + .2 * swell, 1 - .25 * crouch + .35 * thrust, 1 + .2 * swell);
    J.capelet.rotation.x = -.25 * spread + .1 * slump; J.capelet.scale.setScalar(1 + .12 * spread);
    J.hood.rotation.set(R.hood.r.x - look.x + .25 * slump - .12 * spread + .12 * thrust, look.y, 0);
    J.hood.scale.setScalar(1 + .08 * bloom);
    for (const p of J.petals) {
      // closed bud tilt +0.3 (tips meet); bloom 1 = petals thrown out past horizontal like R-guardian-inhale.
      const closed = p.userData.front ? .05 : p.userData.inner ? .36 : .27, open = p.userData.inner ? -1.05 : -1.5;
      p.rotation.x = closed + (open - closed) * Math.max(0, bloom) + Math.min(0, bloom) * -.5 + .1 * slump;
    }
    J.face.scale.setScalar(1.2 + .1 * Math.max(0, bloom));
    J.eyes.scale.set(1 + .15 * rg, Math.max(.08, q.eyes ?? 1) * (1 + .35 * rg), 1);
    for (const s of ['left', 'right']) {
      const k = s === 'left' ? -1 : 1, A = J[s + 'Arm'], F = J[s + 'Forearm'], H = J[s + 'Hand'];
      // Rest: hanging slightly out and forward; spread: flung wide and up; thrust: pushed forward.
      A.rotation.set(-.22 - 1.25 * thrust - .2 * spread + .15 * slump - .95 * fold, 0, k * (.28 + 1.25 * spread - .1 * slump - .15 * thrust - .1 * fold));
      F.rotation.set(-.45 - .1 * spread + .35 * thrust - .15 * slump - 1.25 * fold, 0, k * (.15 * spread - .45 * fold));
      H.rotation.set(-.15 - .35 * spread + .25 * thrust, k * .3 * spread, k * (.25 * spread - .1 * slump));
      H.scale.set(1 + .45 * spread + .25 * thrust, 1 + .15 * spread, 1);
    }
    if (q.rotor !== undefined) J.rotor.rotation.z = q.rotor;
    glowTmp.copy(glowCalm).lerp(glowWind, Math.min(1, rg)); glow.emissive.copy(glowTmp); glow.emissiveIntensity = .5 + 2.1 * rg; glow.color.copy(glowTmp).lerp(C(0xffffff), .35);
    root.updateMatrixWorld(true);
  }
  const POSES = {
    calm: {}, inhale: { crouch: .9, bloom: 1, spread: 1, lean: -.12, swell: .8, rotorGlow: 1, look: { x: -.4, y: 0 } },
    exhale: { thrust: 1, bloom: .35, lean: .5, rotorGlow: .8, look: { x: -.35, y: 0 } }, slump: { slump: 1, bloom: -.2, rotorGlow: .05 },
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
