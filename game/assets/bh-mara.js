// Mara, the last bellkeeper (v2, character pass 2), from references-v2/R-mara.png: a stout, strong
// elderly keeper, 1.55 m. Kind weathered face with laugh lines and warm smiling eyes; silver hair in a
// bun with a copper pin; coral neckerchief with folds; ivory blouse with rolled sleeves; ochre work
// apron with bib, patch pockets and real tools; leather tool belt with wrenches and a hammer; dark
// brown skirt; laced boots. Soft rounded forms throughout (no boxes). Front is +Z.
// Face method (after hero-study-a): one continuous procedural head surface with sculpted brow, sockets,
// nose, cheeks, smile and chin, painted by vertex colour (blush, lips, nasolabial and crow's-feet lines)
// plus modelled eyes (sclera, iris, pupil, catchlight, smiling upper lids) and brows. No textures.
// Rig pivots (userData.joints): base, hips (waist sway), chest, neck, head, eyes (blink), left/right Arm,
//   Forearm, Hand.
// Acting (unchanged hooks + idle):
//   userData.setPose({yaw, pitch, lean, lever, wave, gesture, t, idle = 1})
//     yaw/pitch head turn (clamped ±1.2/±0.5; chest follows 35%)  lean chest pitch
//     lever 0..1 reach up-forward, grip, pull down   wave 0..1 raised hand waving with t   gesture 0..1 open palms ("listen")
//     idle 0..1 breathing, slow weight shift, a glance every ~7 s and blinks, all driven by t
//   userData.headToward(localPoint) -> {yaw, pitch}
export default function (THREE, opts = {}) {
  const T = THREE;
  const root = new T.Group(); root.name = 'bh-mara';
  const rig = new T.Group(); root.add(rig);
  const paint = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .85 }), { name: 'fabric' });
  const cloth = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .9, side: T.DoubleSide }), { name: 'fabric' });
  const metal = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .42, metalness: .35 }), { name: 'metal' });
  const C = h => new T.Color(h);
  const SKIN = C(0xE3AC86), SKIN_SH = C(0xC98C69), BLUSH = C(0xE58F7A), LINE = C(0xB5785C), LIP = C(0xB8665A), HAIR = C(0xDCDDD8), HAIR_SH = C(0xA3ABA8),
    BLOUSE = C(0xF2E6C9), BLOUSE_SH = C(0xD8C7A4), APRON = C(0xC49A4C), APRON_SH = C(0x9C7536), STITCH = C(0x7A5A2A), SKIRT = C(0x5E4130), SKIRT_SH = C(0x46301F),
    BOOT = C(0x6E4830), BOOT_SH = C(0x4B3021), LEATHER = C(0x7A4E33), CORAL = C(0xD96956), CORAL_SH = C(0xB14E3F), COPPER = C(0xB8733F), VERD = C(0x3E9C8C),
    WHITE = C(0xF6EFE2), IRIS = C(0x5C4028), IRIS_L = C(0x7F6A3A), INK = C(0x2A1E1C);
  const joints = {}; root.userData.joints = joints;
  const group = (name, x, y, z, parent = rig) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); joints[name] = g; return g; };
  function colorize(geo, fn) { const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color(), v = new T.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, c, i); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } geo.setAttribute('color', new T.BufferAttribute(col, 3)); return geo; }
  const solid = (g, c) => colorize(g, (v, o) => o.copy(c));
  const mesh = (geo, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, mat = paint) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const ell = (parent, c, x, y, z, a, b, d, mat = paint, ws = 16, hs = 12) => { const g = new T.SphereGeometry(1, ws, hs); g.scale(a, b, d); return mesh(typeof c === 'function' ? colorize(g, c) : solid(g, c), parent, x, y, z, 0, 0, 0, mat); };
  const lathe = (parent, prof, fn, x = 0, y = 0, z = 0, depth = 1, segs = 24, mat = paint) => { const g = new T.LatheGeometry(prof.map(([r, h]) => new T.Vector2(r, h)), segs); g.scale(1, 1, depth); return mesh(colorize(g, typeof fn === 'function' ? fn : (v, o) => o.copy(fn)), parent, x, y, z, 0, 0, 0, mat); };
  function tube(parent, pts, r0, r1, c, mat = paint, radial = 8, steps = 12) {
    const curve = new T.CatmullRomCurve3(pts.map(q => new T.Vector3(...q))), g = new T.TubeGeometry(curve, steps, 1, radial, false), p = g.attributes.position, v = new T.Vector3(), q = new T.Vector3();
    for (let s = 0; s <= steps; s++) { curve.getPointAt(s / steps, q); const k = s / steps, r = r0 + (r1 - r0) * k; for (let j = 0; j <= radial; j++) { const i = s * (radial + 1) + j; v.fromBufferAttribute(p, i).sub(q).normalize().multiplyScalar(r).add(q); p.setXYZ(i, v.x, v.y, v.z); } }
    g.computeVertexNormals(); return mesh(typeof c === 'function' ? colorize(g, c) : solid(g, c), parent, 0, 0, 0, 0, 0, 0, mat);
  }
  // Rounded slab (soft-bevelled box) from a squashed superellipsoid: cel-friendly pockets, buckles, soles.
  function slab(parent, c, x, y, z, w, h, d, p = 4, mat = paint) {
    const g = new T.SphereGeometry(1, 16, 12), a = g.attributes.position;
    for (let i = 0; i < a.count; i++) { const vx = a.getX(i), vy = a.getY(i), vz = a.getZ(i), f = e => Math.sign(e) * Math.pow(Math.abs(e), 2 / p); a.setXYZ(i, f(vx) * w / 2, f(vy) * h / 2, f(vz) * d / 2); }
    g.computeVertexNormals(); return mesh(typeof c === 'function' ? colorize(g, c) : solid(g, c), parent, x, y, z, 0, 0, 0, mat);
  }
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  // ================= base: boots, skirt, apron, belt (static) =================
  const base = group('base', 0, 0, 0);
  for (const s of [-1, 1]) {
    slab(base, BOOT_SH, s * .1, .02, .035, .12, .04, .24, 3);                                             // sole
    ell(base, (v, o) => o.copy(BOOT).lerp(BOOT_SH, v.y < 0 ? .3 : 0), s * .1, .075, .075, .066, .058, .105);   // rounded toe
    lathe(base, [[.06, .04], [.07, .1], [.068, .2], [.074, .27], [.078, .29]], (v, o) => o.copy(v.y > .26 ? BOOT_SH : BOOT), s * .1, 0, 0, .95, 16);
    for (let k = 0; k < 4; k++) tube(base, [[s * .1 - .035, .12 + k * .038, .066], [s * .1, .128 + k * .038, .074], [s * .1 + .035, .12 + k * .038, .066]], .005, .005, C(0xE8D6B0));   // laces
  }
  // Skirt: soft bell with a hem fold, mid-calf.
  lathe(base, [[.2, .83], [.245, .74], [.29, .52], [.315, .34], [.33, .27], [.325, .25], [.305, .245]], (v, o) => o.copy(SKIRT).lerp(SKIRT_SH, v.y < .3 ? .5 : Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 9) * .35)), 0, 0, 0, .86, 36);
  // Apron: curved cloth panel with rounded lower corners, darker hem, two patch pockets with stitching and tools.
  {
    const g = new T.PlaneGeometry(1, 1, 18, 14), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) + .5, t = p.getY(i) + .5, a = (u - .5) * 1.9, r = .31 - .05 * t + .012 * Math.sin(u * 14) * (1 - t);
      const corner = Math.max(0, Math.abs(u - .5) - .36) * 1.6 * (1 - smooth(0, .25, t)); p.setXYZ(i, Math.sin(a) * r, .3 + t * .56 + corner * .3, Math.cos(a) * r * .9 + .02); }
    g.computeVertexNormals();
    mesh(colorize(g, (v, o) => o.copy(APRON).lerp(APRON_SH, v.y < .34 ? .55 : Math.max(0, Math.sin(v.x * 40) * .12))), base, 0, 0, 0, 0, 0, 0, cloth);
    for (const s of [-1, 1]) {
      const px = s * .13, py = .56, pz = .285 - Math.abs(px) * .25;
      slab(base, (v, o) => o.copy(APRON_SH).lerp(APRON, .35), px, py, pz, .12, .11, .025, 5);                         // pocket
      tube(base, [[px - .052, py + .048, pz + .014], [px, py + .05, pz + .016], [px + .052, py + .048, pz + .014]], .003, .003, STITCH);   // stitched lip
      if (s < 0) { tube(base, [[px - .02, py + .02, pz + .005], [px - .02, py + .12, pz + .01]], .008, .008, C(0x8A5A3A)); ell(base, COPPER, px - .02, py + .125, pz + .01, .012, .01, .012, metal); }  // screwdriver
      else { tube(base, [[px + .02, py + .02, pz + .005], [px + .024, py + .1, pz + .012]], .009, .007, COPPER, metal); mesh(solid(new T.TorusGeometry(.017, .006, 6, 12, Math.PI * 1.5), COPPER), base, px + .024, py + .115, pz + .012, 0, 0, .8, metal); }   // wrench
    }
  }
  // Leather tool belt with buckle, hanging wrenches and a hammer on the hip.
  lathe(base, [[.262, .805], [.27, .82], [.27, .86], [.262, .875]], (v, o) => o.copy(LEATHER), 0, 0, 0, .87, 36);
  slab(base, COPPER, 0, .84, .245, .06, .05, .02, 5, metal); slab(base, LEATHER, 0, .84, .252, .03, .022, .012, 5);
  const wrench = (x, z, len, a) => { const pv = new T.Group(); pv.position.set(x, .83, z); pv.rotation.set(-.12, Math.atan2(x, z * 1.1), a); base.add(pv);
    tube(pv, [[0, 0, 0], [0, -len * .9, 0]], .009, .008, COPPER, metal, 6, 4); mesh(solid(new T.TorusGeometry(.019, .007, 6, 12, Math.PI * 1.45), COPPER), pv, 0, -len, 0, 0, 0, Math.PI * .25 + Math.PI, metal); };
  wrench(-.2, .17, .16, .15); wrench(-.24, .09, .19, .08); wrench(.21, .15, .14, -.12);
  { const pv = new T.Group(); pv.position.set(.26, .8, .02); pv.rotation.set(0, 0, -.12); base.add(pv); tube(pv, [[0, .02, 0], [0, -.2, 0]], .012, .011, C(0x8A5A3A), paint, 6, 4); slab(pv, C(0x5E5A55), 0, -.2, 0, .09, .035, .035, 4, metal); }
  slab(base, APRON_SH, -.27, .76, .04, .07, .1, .07, 3);                                                               // leather pouch
  ell(base, COPPER, .245, .74, .12, .03, .045, .03, metal);                                                            // oil can
  tube(base, [[.245, .78, .12], [.27, .82, .15]], .005, .003, COPPER, metal);

  // ================= hips / chest (waist pivot) =================
  const hips = group('hips', 0, .84, 0);
  const chest = group('chest', 0, 0, 0, hips);
  // Stout torso with sloped shoulders; blouse volume, soft bust.
  lathe(chest, [[.25, -.02], [.265, .06], [.275, .17], [.265, .27], [.24, .35], [.2, .41], [.14, .455], [.075, .49]], (v, o) => o.copy(BLOUSE).lerp(BLOUSE_SH, v.y < .03 ? .4 : Math.max(0, Math.sin(v.x * 30 + v.y * 12) * .18)), 0, 0, 0, .78, 28);
  ell(chest, BLOUSE, 0, .21, .11, .2, .1, .1);                                                                            // bust volume
  // Apron bib with pocket, and straps over the shoulders crossing on the back.
  {
    const g = new T.PlaneGeometry(1, 1, 10, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i), t = p.getY(i) + .5, a = u * 1.25, r = .235 - .02 * t; p.setXYZ(i, Math.sin(a) * r * (1 - .25 * t), .0 + t * .33, Math.cos(a) * r * .86 + .03 - .01 * t + .02 * Math.exp(-(((t - .6) / .25) ** 2))); }
    g.computeVertexNormals(); mesh(colorize(g, (v, o) => o.copy(APRON).lerp(APRON_SH, v.y > .3 ? .3 : 0)), chest, 0, 0, 0, 0, 0, 0, cloth);
    slab(chest, (v, o) => o.copy(APRON_SH).lerp(APRON, .3), 0, .17, .238, .1, .075, .022, 5);
    tube(chest, [[-.045, .205, .251], [.045, .205, .251]], .003, .003, STITCH);
    tube(chest, [[-.012, .19, .25], [-.02, .26, .245]], .005, .005, C(0x3C3C3C));                                        // pencil
    for (const s of [-1, 1]) tube(chest, [[s * .09, .32, .19], [s * .13, .42, .08], [s * .12, .44, -.06], [s * .02, .3, -.2], [-s * .1, .08, -.2]], .014, .014, APRON_SH, cloth, 6, 16);
  }
  // Neck and coral neckerchief: collar roll, a knot and two folded tails.
  const neck = group('neck', 0, .47, .01, chest);
  lathe(neck, [[.058, -.02], [.055, .05], [.052, .085]], SKIN, 0, 0, 0, 1, 14);
  tube(chest, [[-.09, .45, -.02], [-.07, .47, .07], [0, .455, .1], [.07, .47, .07], [.09, .45, -.02], [0, .47, -.08], [-.09, .45, -.02]], .026, .026, (v, o) => o.copy(CORAL).lerp(CORAL_SH, Math.max(0, Math.sin(v.x * 50) * .4)), paint, 8, 24);
  ell(chest, (v, o) => o.copy(CORAL).lerp(CORAL_SH, v.y < .42 ? .4 : 0), 0, .43, .115, .038, .032, .03);
  for (const s of [-1, 1]) {
    const g = new T.SphereGeometry(1, 10, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (1 - y) / 2; p.setXYZ(i, x * .034 * (1 - .6 * t) + s * t * .03, -t * .13, z * .012 + Math.sin(x * 3) * .006 + t * .02); }
    g.computeVertexNormals(); mesh(colorize(g, (v, o) => o.copy(CORAL).lerp(CORAL_SH, Math.max(0, Math.sin(v.x * 80) * .5))), chest, s * .012, .415, .122, .15, 0, s * .22);
  }

  // ================= head =================
  const head = group('head', 0, .085, 0, neck);
  {
    // Continuous head surface: sculpted in metres from a dense sphere; features only on the front.
    const g = new T.SphereGeometry(1, 56, 44), p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new T.Color();
    const G = (dx, dy, sx, sy) => Math.exp(-((dx / sx) ** 2) - ((dy / sy) ** 2));
    const nasolabial = (x, y) => { const s = Math.sign(x) || 1, ax = Math.abs(x); const t = Math.max(0, Math.min(1, (y + .03) / -.034)); const cx = .021 + t * .014, cy = -.03 - t * .034; return Math.hypot(ax - cx, y - cy) + (t <= 0 || t >= 1 ? .004 : 0); };
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
      let x = ux * .088, y = uy * .112, z = uz * .096;
      const front = smooth(.05, .5, uz), ax = Math.abs(x);
      x *= 1 + .1 * G(0, y + .055, 1, .035) * smooth(-.1, .3, -uz * 0 + 1);                 // full cheeks / jowls
      z += front * (.03 * G(x, y + .004, .014, .03) + .016 * G(x, y + .027, .017, .013)      // nose bridge + bulb
        + .008 * G(0, y - .042, 1, .012) * smooth(.075, .04, ax)                              // brow ridge
        - .012 * G(ax - .034, y - .016, .017, .011)                                           // eye sockets
        + .013 * G(ax - .045, y + .02, .024, .02)                                             // cheeks (smiling, lifted)
        + .009 * G(x, y + .088, .026, .016)                                                   // chin
        + .004 * G(x, y + .051, .03, .006)                                                    // lips
        - .002 * G(x, y + .062, .026, .004));                                                 // under-lip
      p.setXYZ(i, x, y, z);
      // Paint: base skin, warm blush, lips on a smiling curve, nasolabial and crow's-feet lines, brow furrows.
      c.copy(SKIN);
      c.lerp(SKIN_SH, smooth(.1, -.6, uz) * .35 + smooth(-.06, -.11, y) * .25);
      c.lerp(BLUSH, front * .55 * G(ax - .048, y + .018, .022, .016));
      const smileY = -.052 + 7 * x * x;
      if (front > .5 && ax < .034) c.lerp(LIP, smooth(.0065, .002, Math.abs(y - smileY)) * .9);
      if (front > .5 && ax < .037) c.lerp(INK, smooth(.0018, .0006, Math.abs(y - smileY)) * .5 * smooth(.037, .02, ax));
      if (front > .4) c.lerp(LINE, smooth(.0032, .001, nasolabial(x, y)) * .55);
      for (const k of [-1, 0, 1]) if (front > .3) { const cx = .063, cy = .016 + k * .006, d = Math.abs((ax - cx) * Math.sin(-k * .45) + (y - cy) * Math.cos(-k * .45)); if (Math.abs(ax - cx - .006) < .008) c.lerp(LINE, smooth(.0022, .0008, d) * .5); }
      for (const ly of [.058, .07]) if (front > .5 && ax < .045) c.lerp(LINE, smooth(.0022, .0008, Math.abs(y - ly - .004 * Math.cos(x * 40))) * .3);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(cols, 3)); g.computeVertexNormals();
    mesh(g, head, 0, .11, 0);
    root.userData.faceSurface = true;
  }
  const HY = .11; // head centre inside the head pivot
  for (const s of [-1, 1]) { ell(head, SKIN, s * .088, HY + .005, -.004, .017, .03, .014); ell(head, SKIN_SH, s * .092, HY + .004, .002, .007, .016, .005); }  // ears
  // Eyes (own pivot for blinks): sclera, iris, pupil, catchlight; smiling upper lids; brows.
  const eyes = group('eyes', 0, HY + .016, 0, head);
  for (const s of [-1, 1]) {
    const ex = s * .034, ez = .083;
    ell(eyes, WHITE, ex, 0, ez, .014, .0085, .006, paint, 14, 10);
    ell(eyes, (v, o) => o.copy(IRIS).lerp(IRIS_L, smooth(.003, .006, Math.hypot(v.x, v.y))), ex + s * .001, -.0005, ez + .0045, .0068, .0068, .003, paint, 12, 8);
    ell(eyes, INK, ex + s * .001, -.0005, ez + .0068, .003, .003, .0012, paint, 8, 6);
    ell(eyes, WHITE, ex + s * .001 - .0022, .0022, ez + .0078, .0016, .0016, .0008, paint, 6, 4);
    // Smiling upper lid: a skin shell dropping over the top of the eye, a crease above it.
    const lid = ell(eyes, (v, o) => o.copy(SKIN).lerp(SKIN_SH, .25), ex, .0045, ez + .001, .0165, .0075, .0078, paint, 14, 8); lid.rotation.z = -s * .12;
    tube(eyes, [[ex - s * .016, .004, ez + .002], [ex, .0105, ez + .006], [ex + s * .017, .002, ez + .001]], .0014, .001, INK);
    tube(eyes, [[ex - s * .013, -.0065, ez + .003], [ex, -.009, ez + .004], [ex + s * .014, -.006, ez + .002]], .0009, .0007, LINE);
    tube(head, [[s * .016, HY + .042, .092], [s * .034, HY + .049, .092], [s * .054, HY + .043, .086]], .0042, .0026, HAIR_SH);   // brows
  }
  // Hair: silver cap swept back from the brow in waves, side waves over the ears, a bun with a copper pin.
  {
    const g = new T.SphereGeometry(1, 36, 22, 0, Math.PI * 2, 0, Math.PI * .62), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), front = Math.max(0, z); p.setXYZ(i, x * .096, y * .12 - front * .018 + .004, z * .104 - .006); }
    g.computeVertexNormals(); mesh(colorize(g, (v, o) => o.copy(HAIR).lerp(HAIR_SH, Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 14 + v.y * 60) * .45))), head, 0, HY + .012, 0);
    for (let i = 0; i < 9; i++) { const a = -1 + i * .25, x = Math.sin(a) * .09, z = Math.cos(a) * .09;
      tube(head, [[x * .9, HY + .06, z * .95], [x * 1.05, HY + .1, z * .6], [x * .7, HY + .125, z * .1 - .02], [0, HY + .12, -.05]], .011, .006, i % 2 ? HAIR : HAIR_SH, paint, 6, 10); }
    for (const s of [-1, 1]) tube(head, [[s * .08, HY + .06, .045], [s * .093, HY + .03, .01], [s * .088, HY + .045, -.04], [s * .06, HY + .09, -.07]], .014, .01, HAIR, paint, 6, 10);
    lathe(head, [[.001, -.02], [.042, -.012], [.052, .012], [.04, .036], [.001, .045]], (v, o) => o.copy(HAIR).lerp(HAIR_SH, Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 5 + v.y * 80) * .5)), 0, HY + .122, -.05, 1, 18);
    mesh(solid(new T.TorusGeometry(.042, .01, 8, 20), HAIR_SH), head, 0, HY + .122, -.05, Math.PI / 2 - .3);
    tube(head, [[-.075, HY + .16, -.03], [0, HY + .158, -.05], [.07, HY + .15, -.07]], .0035, .0035, COPPER, metal);
    mesh(solid(new T.TorusGeometry(.011, .003, 6, 12), COPPER), head, -.082, HY + .162, -.028, 0, 1.2, 0, metal);
    ell(head, CORAL, -.084, HY + .15, -.026, .004, .006, .004);
  }

  // ================= arms: rolled sleeves, real hands =================
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'left' : 'right';
    const arm = group(side + 'Arm', s * .215, .4, -.01, chest);
    ell(arm, BLOUSE, 0, -.01, 0, .075, .07, .075);                                               // shoulder cap (sloped)
    tube(arm, [[0, -.01, 0], [s * .015, -.12, .005], [s * .012, -.22, .01]], .072, .064, (v, o) => o.copy(BLOUSE).lerp(BLOUSE_SH, Math.max(0, Math.sin(v.y * 90) * .35)), paint, 10, 8);
    ell(arm, BLOUSE_SH, s * .06, -.12, -.01, .012, .03, .03);                                   // sleeve patch
    const fore = group(side + 'Forearm', s * .012, -.23, .01, arm);
    lathe(fore, [[.064, .03], [.072, .005], [.072, -.025], [.063, -.045]], (v, o) => o.copy(BLOUSE_SH).lerp(BLOUSE, v.y > -.01 ? .5 : 0), 0, 0, 0, 1, 16);   // rolled cuff
    tube(fore, [[0, -.035, 0], [0, -.13, .008], [0, -.215, .01]], .05, .038, SKIN, paint, 10, 6);
    const hand = group(side + 'Hand', 0, -.225, .01, fore);
    slab(hand, SKIN, 0, -.035, 0, .07, .075, .03, 3);                                            // palm
    for (let f = 0; f < 4; f++) { const fx = -.024 + f * .016, L = [.052, .06, .057, .046][f];
      tube(hand, [[fx, -.066, .002], [fx * 1.05, -.066 - L * .55, .012], [fx * 1.08, -.066 - L, .026]], .0085, .0062, (v, o) => o.copy(SKIN).lerp(SKIN_SH, .15), paint, 6, 5); }
    tube(hand, [[-s * .03, -.03, .01], [-s * .045, -.055, .025], [-s * .042, -.08, .036]], .01, .007, SKIN, paint, 6, 5);   // thumb
  }

  // ================= batch per pivot =================
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
  // ================= acting =================
  const clamp = (v, a) => Math.max(-a, Math.min(a, v));
  function setPose({ yaw = 0, pitch = 0, lean = 0, lever = 0, wave = 0, gesture = 0, t = 0, idle = 1 } = {}) {
    const J = joints; yaw = clamp(yaw, 1.2); pitch = clamp(pitch, .5);
    // Idle life: breathing, slow weight shift between feet, an occasional glance around, blinks.
    const breath = Math.sin(t * 1.55) * idle, shift = Math.sin(t * .42) * idle, g = t % 7.3, glance = idle * (g > 5.6 && g < 6.9 ? Math.sin((g - 5.6) / 1.3 * Math.PI) : 0) * (Math.floor(t / 7.3) % 2 ? 1 : -1);
    const bl = t % 4.1, blink = bl > 3.92 ? Math.sin((bl - 3.92) / .18 * Math.PI) : 0;
    J.base.rotation.z = .012 * shift; J.hips.position.x = .012 * shift; J.hips.rotation.z = -.02 * shift;
    J.chest.scale.set(1 + .008 * breath, 1 + .012 * breath, 1 + .012 * breath);
    J.chest.rotation.set(.12 * lean + .015 * breath * (1 - lever), yaw * .35, .015 * shift);
    J.head.rotation.set(-pitch + .05 * lean - .01 * breath, yaw * .65 + .45 * glance * (1 - Math.min(1, Math.abs(yaw) * 3)), .03 * Math.sin(t * .9) * idle);
    J.eyes.scale.y = 1 - .9 * blink;
    const reach = Math.min(1, lever * 2), pull = Math.max(0, lever * 2 - 1), wv = Math.sin(t * 9) * .45 * wave;
    J.rightArm.rotation.set(-.08 - 2.3 * reach + 1.5 * pull - 2.6 * wave * (1 - reach) - .9 * gesture, 0, .14 + .25 * wave + .5 * gesture + .02 * breath);
    J.rightForearm.rotation.set(-.3 - .2 * reach + .5 * pull - .5 * wave - .6 * gesture, 0, wv);
    J.rightHand.rotation.set(-.2 * reach, 0, wv * .5 + .3 * gesture);
    J.leftArm.rotation.set(-.08 - .9 * gesture + .3 * pull, 0, -.14 - .5 * gesture - .02 * breath);
    J.leftForearm.rotation.set(-.3 - .6 * gesture, 0, 0);
    J.leftHand.rotation.set(0, 0, -.3 * gesture);
    J.chest.rotation.x += .18 * pull;
    root.updateMatrixWorld(true);
  }
  function headToward(p) { const h = new T.Vector3(); joints.head.getWorldPosition(h); root.worldToLocal(h); return { yaw: Math.atan2(p.x - h.x, p.z - h.z), pitch: Math.atan2(p.y - h.y - .15, Math.hypot(p.x - h.x, p.z - h.z)) }; }
  root.userData.setPose = setPose; root.userData.headToward = headToward;
  setPose({ idle: 0, ...(opts.pose || {}) });
  const box = new T.Box3(), v = new T.Vector3(); root.updateMatrixWorld(true);
  root.traverse(n => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const k = 1.55 / (box.max.y - box.min.y), c = box.getCenter(new T.Vector3());
  rig.scale.setScalar(k); rig.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  return root;
}
