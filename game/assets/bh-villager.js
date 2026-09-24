// Bellhollow villagers (rebuild after references-v2/R-villagers.png): four bespoke people at hero/Mara quality.
//   opts.who: 'baker'  plump cheerful baker woman: headscarf, coral dress, flour-dusted cream apron, rolled sleeves, bread basket on the hip
//             'elder'  lanky old man: white beard, flat cap, green jumper, patched honey waistcoat, pipe, cane
//             'girl'   8-year-old girl: twin braids with yellow ties, teal tunic over striped sleeves and leggings, pinwheel raised
//             'seller' young market seller: curly hair, green shirt, brown vest, satchel, fruit crate carried in both arms
// Anatomy: pelvis with legs (thigh, knee, shin, ankle, shoe), chest, neck, sculpted head (brow, sockets, nose, cheeks, chin) with
// modelled eyes (white, iris, pupil, catchlight, lid line), brows and mouth; shoulders, upper arm, elbow, forearm, hands with four
// fingers and a thumb. Clothing layered with folds. Vertex colour only, no textures. <= 12k tris each.
// Rig pivots (userData.joints): pelvis, chest, head, leftUpperArm, leftForeArm, rightUpperArm, rightForeArm, prop (girl).
// One mesh per pivot (7-8 draws); arms/prop are userData.noOutline so ink hulls are added for pelvis, chest, head only.
// userData.setPose({t, act, yaw, pitch, look, gentle}) act: idle|worried|cheer|wave; each character has its own idle loop.
export default function (THREE, opts = {}) {
  const T = THREE, who = opts.who || { chat: 'seller', sweeper: 'baker', keeper: 'seller', child: 'girl', elder: 'elder', worried: 'elder', sitter: 'elder' }[opts.role] || 'baker';
  const C = h => new T.Color(h);
  const root = new T.Group(); root.name = 'bh-villager-' + who; const rig = new T.Group(); root.add(rig);
  const paint = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .85 }), { name: 'fabric' });
  const joints = {}; root.userData.joints = joints;
  const group = (name, x, y, z, parent = rig) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); joints[name] = g; return g; };
  const parts = new Map(); const E = new T.Euler(), Q = new T.Quaternion();
  const put = (pv, geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { if (!parts.has(pv)) parts.set(pv, []); parts.get(pv).push([geo, col, new T.Matrix4().compose(new T.Vector3(x, y, z), Q.clone().setFromEuler(E.set(rx, ry, rz)), new T.Vector3(sx, sy, sz))]); };
  const ell = (pv, col, x, y, z, a, b, c, ws = 12, hs = 9) => put(pv, new T.SphereGeometry(1, ws, hs), col, x, y, z, 0, 0, 0, a, b, c);
  const lathe = (pv, prof, col, x = 0, y = 0, z = 0, depth = 1, segs = 20, fold = 0) => { const g = new T.LatheGeometry(prof.map(([r, h]) => new T.Vector2(r, h)), segs); if (fold) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)), k = 1 + fold * Math.sin(a * 9) * Math.max(0, (prof[prof.length - 1][1] - p.getY(i)) / (prof[prof.length - 1][1] - prof[0][1])); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); } put(pv, g, col, x, y, z, 0, 0, 0, 1, 1, depth); };
  const tube = (pv, pts, r0, col, r1 = r0, radial = 8, seg = 0) => { const c = new T.CatmullRomCurve3(pts.map(v => new T.Vector3(...v))), n = seg || Math.max(4, pts.length * 3), g = new T.TubeGeometry(c, n, 1, radial, false), a = g.attributes.position, v = new T.Vector3(), q = new T.Vector3();
    for (let i = 0; i <= n; i++) { c.getPointAt(i / n, q); const t = i / n, r = r0 + (r1 - r0) * t; for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(a, k).sub(q).normalize().multiplyScalar(r).add(q); a.setXYZ(k, v.x, v.y, v.z); } } g.computeVertexNormals(); put(pv, g, col); };
  const slab = (pv, col, x, y, z, w, h, d, p = 5, rx = 0, ry = 0, rz = 0) => { const g = new T.SphereGeometry(1, 12, 8), a = g.attributes.position, f = e => Math.sign(e) * Math.pow(Math.abs(e), 2 / p); for (let i = 0; i < a.count; i++) a.setXYZ(i, f(a.getX(i)) * w / 2, f(a.getY(i)) * h / 2, f(a.getZ(i)) * d / 2); g.computeVertexNormals(); put(pv, g, col, x, y, z, rx, ry, rz); };
  const sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

  // ---------------- character sheets ----------------
  const S = {
    baker: { H: 1.55, hip: .8, sh: 1.27, sw: .2, ua: .27, fa: .24, leg: .075, waist: .19, hips: .245, chest: .215, hr: .108, skin: 0xE8B48E, skinSh: 0xC98D68, iris: 0x4A3322, brow: 0x2E2320, blush: .8, lips: 0xB85F55 },
    elder: { H: 1.72, hip: .93, sh: 1.43, sw: .19, ua: .31, fa: .28, leg: .062, waist: .14, hips: .16, chest: .17, hr: .104, skin: 0xE2AA86, skinSh: 0xC08664, iris: 0x4F6E78, brow: 0xECECE8, blush: .5, lips: 0xA86A5C },
    girl: { H: 1.22, hip: .6, sh: .95, sw: .135, ua: .2, fa: .18, leg: .05, waist: .12, hips: .14, chest: .13, hr: .118, skin: 0xEFC4A0, skinSh: 0xD39E7C, iris: 0x5A3A22, brow: 0x4A3222, blush: .9, lips: 0xC76E62 },
    seller: { H: 1.72, hip: .94, sh: 1.44, sw: .2, ua: .3, fa: .27, leg: .066, waist: .15, hips: .165, chest: .19, hr: .105, skin: 0xB07A52, skinSh: 0x8E5E3E, iris: 0x3A2618, brow: 0x241812, blush: .35, lips: 0x8E5446 },
  }[who];
  const pelvis = group('pelvis', 0, S.hip, 0);
  const chest = group('chest', 0, .1, 0, pelvis);
  const shY = S.sh - S.hip - .1;                    // shoulder height inside chest
  // ---------------- legs (static, in the pelvis) ----------------
  function legs(colThigh, colShin, colShoe, { bentL = .06, bentR = .0, stripes = null, bare = false, cuff = null } = {}) {
    for (const s of [-1, 1]) {
      const x = s * S.hips * .45, knee = S.hip * .52, bend = s < 0 ? bentL : bentR;
      const kz = bend * .5, stripe = stripes ? (v, c) => c.set(Math.floor((v.y + 2) * 28) % 2 ? stripes[0] : stripes[1]) : null;
      const col = (base) => stripe ? (v, c) => stripe(v, c) : base;
      tube(pelvis, [[x, -.02, 0], [x * 1.02, -(S.hip - knee) * .5, kz * .3], [x * 1.04, -(S.hip - knee), kz]], S.leg * 1.25, col(colThigh), S.leg * .95, 10, 8);   // thigh
      ell(pelvis, stripes ? stripes[1] : colShin, x * 1.04, -(S.hip - knee), kz, S.leg * .98, S.leg * 1.05, S.leg * .98, 10, 8);   // knee
      tube(pelvis, [[x * 1.04, -(S.hip - knee), kz], [x * 1.05, -(S.hip - knee) - knee * .45, kz * .4 - .01], [x * 1.05, -S.hip + .085, 0]], S.leg * .95, col(colShin), S.leg * .62, 10, 8);   // shin with calf taper
      if (cuff) put(pelvis, new T.TorusGeometry(S.leg * .8, .016, 5, 12), cuff, x * 1.05, -S.hip + .2, 0, Math.PI / 2);
      const fy = -S.hip + .035;                                                                          // shoe: heel + rounded toe
      ell(pelvis, colShoe, x * 1.05, fy + .03, -.005, S.leg * .8, .045, S.leg * .85, 10, 7);
      ell(pelvis, colShoe, x * 1.05, fy + .015, .065, S.leg * .75, .04, .09, 10, 7);
      slab(pelvis, 0x2E2420, x * 1.05, fy - .02, .035, S.leg * 1.5, .018, .2, 4);                         // sole
      if (bare) ell(pelvis, S.skin, x * 1.05, fy + .08, .01, S.leg * .62, .05, S.leg * .62, 8, 6);
    }
  }
  // ---------------- torso ----------------
  function torso(colTop, { prof = null, depth = .74, fold = 0 } = {}) {
    const P = prof || [[S.hips * .92, -.12], [S.hips, -.05], [S.waist * 1.05, .08], [S.waist, .16], [S.chest * .98, .26], [S.chest, shY - .12], [S.sw * .95, shY - .05], [S.sw * .72, shY + .02], [.07, shY + .05]];
    lathe(chest, P, colTop, 0, 0, 0, depth, 24, fold);
    for (const s of [-1, 1]) ell(chest, colTop, s * S.sw * .82, shY - .04, 0, S.leg * .85, S.leg * .72, S.leg * .9, 10, 7);   // shoulders, blended into the arm
  }
  // ---------------- neck + head (sculpted face, modelled eyes, brows, mouth) ----------------
  const neckY = shY + .03, headPivotY = neckY + .07;
  function neckAndHead({ smile = .6, open = 0, eyeSize = 1, longFace = 1, fullCheeks = 1, browArch = 1, age = 0 } = {}) {
    lathe(chest, [[.052, neckY - .04], [.046, neckY + .02], [.044, neckY + .08]], S.skin, 0, 0, 0, .95, 12);
    const head = group('head', 0, headPivotY, .005, chest);
    const hr = S.hr, cy = hr * 1.02;                     // head centre above the neck pivot
    const g = new T.SphereGeometry(1, 36, 28), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
    const G = (dx, dy, sx, sy) => Math.exp(-((dx / sx) ** 2) - ((dy / sy) ** 2));
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i), f = sm(0, .5, uz), ax = Math.abs(ux);
      let x = ux * hr * .9, y = uy * hr * 1.1 * longFace, z = uz * hr * .98;
      x *= 1 - .12 * sm(-.2, -.9, uy) * (2 - fullCheeks);                                                   // jaw taper
      z += f * hr * (.26 * G(ux, uy + .12, .11, .2) + .1 * G(ux, uy + .27, .13, .09)                        // nose bridge + tip
        + .07 * G(0, uy - .33, 1, .12) * sm(.7, .45, ax) - .09 * G(ax - .36, uy - .12, .17, .11)            // brow ridge, sockets
        + .1 * fullCheeks * G(ax - .45, uy + .18, .22, .17) + .08 * G(ux, uy + .72, .22, .14));              // cheeks, chin
      p.setXYZ(i, x, y, z);
      c.set(S.skin); c.lerp(C(S.skinSh), sm(.2, -.7, uz) * .35);
      c.lerp(C(0xE78A78), f * S.blush * .5 * G(ax - .46, uy + .2, .2, .15));                                // blush
      if (age) c.lerp(C(S.skinSh), f * .5 * sm(.012, .004, Math.abs(Math.hypot(ax - .22, uy + .3) - .14)) * (uy < -.2 ? 1 : 0));   // laugh lines
      c.lerp(C(S.skinSh), f * .25 * G(ux, uy + .58, .12, .05));                                             // soft chin shadow only
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals(); put(head, g, null, 0, cy, 0);
    for (const s of [-1, 1]) { ell(head, S.skin, s * hr * .88, cy, -hr * .05, hr * .14, hr * .26, hr * .12, 8, 6); ell(head, S.skinSh, s * hr * .9, cy, -hr * .02, hr * .07, hr * .15, hr * .05, 6, 4); }   // ears
    const ez = hr * .84, ey = cy + hr * .1, es = eyeSize;
    for (const s of [-1, 1]) {
      const ex = s * hr * .36;
      ell(head, 0xF7F2E8, ex, ey, ez, hr * .15 * es, hr * .11 * es, hr * .06, 12, 8);                            // eye white
      ell(head, S.iris, ex, ey - hr * .005, ez + hr * .045, hr * .085 * es, hr * .09 * es, hr * .03, 10, 8);     // iris
      ell(head, 0x14100E, ex, ey - hr * .005, ez + hr * .068, hr * .045 * es, hr * .05 * es, hr * .015, 8, 6);   // pupil
      ell(head, 0xFFFFFF, ex - hr * .03, ey + hr * .035, ez + hr * .08, hr * .025 * es, hr * .025 * es, hr * .012, 6, 4);   // catchlight
      tube(head, [[ex - s * hr * .17 * es, ey + hr * .01, ez + hr * .01], [ex, ey + hr * .11 * es, ez + hr * .05], [ex + s * hr * .17 * es, ey + hr * .03, ez - hr * .01]], hr * .02, 0x2A1E1C, hr * .012, 5, 8);   // upper lid line
      tube(head, [[s * hr * .14, ey + hr * .24, ez + hr * .06], [s * hr * .36, ey + hr * (.28 + .06 * browArch), ez + hr * .05], [s * hr * .56, ey + hr * .22, ez - hr * .04]], hr * .05, S.brow, hr * .025, 5, 8);   // brows
    }
    // Mouth: a clear smile line with upturned corners (optionally open, with teeth), and a soft lower lip.
    const my = cy - hr * .47, mz = hr * .9;
    if (open > 0) { ell(head, 0x5A2A26, 0, my - hr * .03, mz, hr * .18, hr * .08 * (1 + open), hr * .05, 10, 6); ell(head, 0xFFF8EE, 0, my + hr * .02, mz + hr * .02, hr * .13, hr * .03, hr * .03, 8, 4); }
    const pts = []; for (let i = 0; i <= 10; i++) { const u = -1 + i / 5, x = u * hr * .24; pts.push([x, my + smile * hr * .1 * u * u, mz + hr * .04 - u * u * hr * .08]); }
    tube(head, pts, hr * .028, S.lips, hr * .028, 5, 16);
    ell(head, C(S.lips).lerp(C(S.skin), .5), 0, my - hr * .08, mz + hr * .01, hr * .12, hr * .04, hr * .03, 8, 5);
    return head;
  }
  // ---------------- arms: shoulder -> elbow -> hand with fingers ----------------
  function arms(colSleeve, colCuff, { sleeve = 1, stripes = null, rolled = false } = {}) {
    const out = {};
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'left' : 'right';
      const ua = group(side + 'UpperArm', s * S.sw * .95, shY - .05, 0, chest);
      const sc = stripes ? (v, c) => c.set(Math.floor((-v.y + 2) * 30) % 2 ? stripes[0] : stripes[1]) : colSleeve;
      tube(ua, [[0, 0, 0], [s * .01, -S.ua * .5, .005], [0, -S.ua, 0]], S.leg * .92, sc, S.leg * .72, 10, 8);
      const fa = group(side + 'ForeArm', 0, -S.ua, 0, ua);
      ell(fa, sleeve >= .9 ? (typeof sc === 'function' ? stripes[0] : colSleeve) : S.skin, 0, 0, 0, S.leg * .7, S.leg * .7, S.leg * .7, 8, 6);   // elbow
      const cover = sleeve >= .9 ? (typeof sc === 'function' ? sc : colSleeve) : S.skin;
      tube(fa, [[0, 0, 0], [0, -S.fa * .5, .008], [0, -S.fa, 0]], S.leg * .7, cover, S.leg * .5, 10, 8);
      if (rolled) lathe(fa, [[S.leg * .78, .02], [S.leg * .92, -.01], [S.leg * .9, -.05], [S.leg * .76, -.07]], colCuff, 0, 0, 0, 1, 12);
      else if (sleeve >= .9 && colCuff !== null) put(fa, new T.TorusGeometry(S.leg * .56, .012, 5, 12), colCuff, 0, -S.fa + .015, 0, Math.PI / 2);
      // hand: palm, four jointed fingers, thumb (curled a little, relaxed)
      const hy = -S.fa - .01, hw = S.leg * .75;
      slab(fa, S.skin, 0, hy - .035, .004, hw * 1.25, .075, hw * .6, 4);
      for (let f = 0; f < 4; f++) { const fx = (-1.5 + f) * hw * .36, L = [.052, .06, .057, .045][f] * (S.H / 1.7);
        tube(fa, [[fx, hy - .068, .006], [fx * 1.04, hy - .068 - L * .55, .014], [fx * 1.06, hy - .068 - L, .028]], hw * .17, S.skin, hw * .13, 6, 6); }
      tube(fa, [[-s * hw * .55, hy - .03, .012], [-s * hw * .8, hy - .058, .03], [-s * hw * .72, hy - .085, .045]], hw * .2, S.skin, hw * .15, 6, 6);
      out[side] = { ua, fa };
    }
    return out;
  }

  // ======================== the four characters ========================
  let head, idle, elderCane = false;
  if (who === 'baker') {
    const CORAL = 0xD4735F, CORAL_SH = 0xB25B4A, APRON = 0xF2E6C9;
    legs(S.skin, S.skin, 0x3A2E2A, { bentL: .08 });
    // coral dress: bodice + full skirt with folds to mid-calf
    torso(CORAL, { prof: [[S.hips * .98, -.1], [S.hips * 1.02, -.02], [S.waist * 1.08, .1], [S.chest * 1.02, .2], [S.chest * 1.05, .3], [S.chest, shY - .1], [S.sw * .98, shY - .04], [S.sw * .72, shY + .02], [.07, shY + .05]] });
    lathe(pelvis, [[S.hips * 1.02, .06], [S.hips * 1.15, -.1], [S.hips * 1.35, -.4], [S.hips * 1.42, -.55], [S.hips * 1.38, -.6]].reverse(), (v, c) => c.set(CORAL).lerp(C(CORAL_SH), Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 9)) * .45), 0, 0, 0, .82, 32, .05);
    ell(chest, CORAL, 0, .2, S.chest * .5, S.chest * .85, .09, .08);                                                    // bust
    for (const s of [-1, 1]) tube(chest, [[s * .04, shY + .03, .05], [s * .06, shY - .02, .1]], .02, CORAL_SH, .016, 5, 4);   // collar points
    // flour-dusted cream apron: bib + skirt panel, ties at the back with a bow
    const flour = (v, c) => c.set(APRON).lerp(C(0xFFFFFF), hash(v.x * 9, v.y * 9, v.z * 9) > .82 ? .9 : 0).lerp(C(0xD9CFB5), hash(v.x * 3, v.y * 4, 1) > .88 ? .5 : 0);
    { const g = new T.CylinderGeometry(1, 1, 1, 14, 10, true, -.95, 1.9), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) + .5, a = Math.atan2(p.getX(i), p.getZ(i)), r = S.hips * 1.2 + (1 - t) * .12 + .012 * Math.sin(a * 8) * (1 - t); p.setXYZ(i, Math.sin(a) * r, .03 - (1 - t) * .56, Math.cos(a) * r * .86 + .012); } g.computeVertexNormals(); put(pelvis, g, flour); }
    { const g = new T.CylinderGeometry(1, 1, 1, 10, 6, true, -.8, 1.6), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) + .5, a = Math.atan2(p.getX(i), p.getZ(i)), r = S.chest * 1.07 - .02 * t; p.setXYZ(i, Math.sin(a) * r * (1 - .3 * t), .08 + t * .3, Math.cos(a) * r * .78 + .06 * Math.exp(-(((t - .45) / .3) ** 2))); } g.computeVertexNormals(); put(chest, g, flour); }
    for (const s of [-1, 1]) { tube(chest, [[s * .07, .38, .12], [s * .06, shY + .03, .06], [0, shY + .06, -.06]], .012, APRON); put(pelvis, new T.TorusGeometry(.04, .012, 6, 12), APRON, s * .045, .04, -S.hips * .88, 0, 0, s * .4, 1, .6, .5); }
    head = neckAndHead({ smile: .9, fullCheeks: 1.3, eyeSize: 1.05, browArch: 1.2 });
    const hr = S.hr, cy = hr * 1.02;
    // black hair with a low bun under a patterned teal headscarf knotted at the back
    { const g = new T.SphereGeometry(1, 24, 14, Math.PI * .72, Math.PI * .56, Math.PI * .25, Math.PI * .4), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * hr * 1.0, p.getY(i) * hr * 1.13, p.getZ(i) * hr * 1.04); g.computeVertexNormals(); put(head, g, 0x221A18, 0, cy, 0); }   // back hair only
    for (const s of [-1, 1]) tube(head, [[s * hr * .78, cy + hr * .5, hr * .3], [s * hr * .95, cy + hr * .15, hr * .02], [s * hr * .88, cy - hr * .3, -hr * .3]], hr * .1, 0x221A18, hr * .06, 6, 6);   // side hair, tucked behind the ears
    ell(head, 0x221A18, 0, cy - hr * .45, -hr * .95, hr * .38, hr * .32, hr * .3, 10, 8);                                  // low bun
    const scarf = (v, c) => c.set(0x2F5E5A).lerp(C(0xE9C98F), hash(Math.floor(v.x * 140), Math.floor(v.y * 140), Math.floor(v.z * 140)) > .86 ? .75 : 0);
    { const g = new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * .5), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = Math.max(0, p.getZ(i)); p.setXYZ(i, p.getX(i) * hr * 1.07, p.getY(i) * hr * 1.12 + f * f * hr * .25 + hr * .12, p.getZ(i) * hr * 1.1 - hr * .04); } g.computeVertexNormals(); put(head, g, scarf, 0, cy, 0); }
    ell(head, scarf, 0, cy + hr * .45, -hr * 1.05, hr * .22, hr * .18, hr * .16, 8, 6);
    for (const s of [-1, 1]) tube(head, [[0, cy + hr * .45, -hr * 1.1], [s * hr * .35, cy + hr * .2, -hr * 1.3], [s * hr * .5, cy - hr * .05, -hr * 1.2]], hr * .14, scarf, hr * .06, 5, 6);
    // arms: rolled coral sleeves; bread basket carried on the right hip
    const A = arms(CORAL, CORAL_SH, { sleeve: .5, rolled: true });
    for (const s of [-1, 1]) { const u = A[s < 0 ? 'left' : 'right'].ua; lathe(u, [[S.leg * 1.05, -S.ua * .62], [S.leg * 1.2, -S.ua * .7], [S.leg * 1.1, -S.ua * .78]], CORAL_SH, 0, 0, 0, 1, 12); }
    const fa = A.right.fa, by = -S.fa - .02;
    lathe(fa, [[.001, -.14], [.13, -.13], [.17, -.04], [.18, .03], [.16, .04]].map(([r, h]) => [r, h]), (v, c) => c.set(0xB8844A).lerp(C(0x8C6232), (Math.floor(v.y * 60) + Math.floor(Math.atan2(v.x, v.z) * 6)) % 2 ? .45 : 0), .02, by, .17, .72, 18);
    put(fa, new T.TorusGeometry(.16, .014, 6, 20, Math.PI), 0x8C6232, .02, by + .03, .17, 0, Math.PI / 2, 0, 1, 1.1, .72);
    for (let i = 0; i < 4; i++) ell(fa, (v, c) => c.set(0xC98A48).lerp(C(0xF0D8A6), v.y > by + .06 ? .35 : 0), -.06 + i * .045, by + .05 + (i % 2) * .02, .12 + (i % 3) * .05, .07, .035, .035, 10, 6);
    idle = (t, J) => { const k = Math.sin(t * .7); // chatty sway, hand on hip, basket shifted now and then
      J.leftUpperArm.rotation.set(.12, 0, -.55); J.leftForeArm.rotation.set(-1.5, 1.05, 0);   // hand on the hip, elbow out
      J.rightUpperArm.rotation.set(-.1 - .04 * k, 0, .42); J.rightForeArm.rotation.set(-1.05 + .05 * k, .45, 0);
      J.chest.rotation.set(.03 * Math.sin(t * 1.5), .12 * Math.sin(t * .35), .04 * k); J.head.rotation.set(-.05 + .04 * Math.sin(t * .9), .25 * Math.sin(t * .45), .06 * Math.sin(t * .6)); };
  } else if (who === 'elder') {
    const JUMPER = 0x5E7A4A, VEST = 0xC8923E, TROUSER = 0x6E5A40;
    legs(TROUSER, TROUSER, 0x4A3226, { bentL: .1 });
    torso(JUMPER, { fold: .02 });
    lathe(chest, [[.055, shY - .01], [.062, shY + .05], [.058, shY + .09]], JUMPER, 0, 0, 0, .95, 12);          // roll neck
    // patched honey waistcoat, open strip at the front showing the jumper, buttons, pockets
    const vest = (v, c) => { c.set(VEST).lerp(C(0x9C6E2E), Math.max(0, Math.sin(v.y * 90)) * .2); if (Math.abs(v.x) < .03 && v.z > 0) c.set(JUMPER); if (Math.hypot(v.x + .07, v.y - .2) < .035 && v.z > 0) c.set(0x7A5A2E); return c; };
    lathe(chest, [[S.chest * 1.06, -.1], [S.waist * 1.12, .08], [S.chest * 1.07, .24], [S.chest * 1.05, shY - .13], [S.sw * .82, shY - .06], [.09, shY]], vest, 0, 0, 0, .78, 22);
    for (let i = 0; i < 4; i++) ell(chest, 0x5A3E22, .038, -.02 + i * .07, S.chest * .8, .01, .01, .006, 6, 4);
    for (const s of [-1, 1]) slab(chest, 0x9C6E2E, s * .085, .02, S.chest * .76, .06, .035, .01, 5);
    head = neckAndHead({ smile: .7, eyeSize: .95, longFace: 1.08, fullCheeks: .8, browArch: .6, age: 1 });
    const hr = S.hr, cy = hr * 1.02;
    // white hair at the sides and nape, bushy brows, full white beard and moustache
    for (const s of [-1, 1]) tube(head, [[s * hr * .8, cy + hr * .35, hr * .1], [s * hr * .95, cy, -hr * .25], [s * hr * .7, cy - hr * .1, -hr * .8], [0, cy - hr * .15, -hr * .98]], hr * .2, 0xEDEDE8, hr * .14, 6, 8);
    { const g = new T.SphereGeometry(1, 20, 14, 0, Math.PI * 2, Math.PI * .45, Math.PI * .45), p = g.attributes.position, col = [];
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * hr * .95, y * hr * 1.3 - hr * .2, z * hr * .98 + Math.max(0, z) * hr * .06); }
      g.computeVertexNormals(); put(head, g, (v, c) => c.set(0xF2F2EE).lerp(C(0xC9CCC6), hash(v.x * 80, v.y * 80, 0) > .7 ? .5 : 0), 0, cy - hr * .08, 0); }
    for (const s of [-1, 1]) tube(head, [[0, cy - hr * .36, hr * 1.02], [s * hr * .25, cy - hr * .4, hr * .96], [s * hr * .42, cy - hr * .55, hr * .8]], hr * .08, 0xF2F2EE, hr * .04, 6, 6);   // moustache
    // flat cap (tweed): a flattened crown pulled forward with a short peak
    ell(head, (v, c) => c.set(0x7A6A4A).lerp(C(0x5E5238), (Math.floor(v.x * 90) + Math.floor(v.z * 90)) % 2 ? .4 : 0), 0, cy + hr * .82, hr * .08, hr * 1.1, hr * .42, hr * 1.14, 16, 8);
    ell(head, 0x5E5238, 0, cy + hr * .66, hr * 1.02, hr * .72, hr * .07, hr * .42, 10, 5);
    const A = arms(JUMPER, null, { sleeve: 1 });
    ell(A.left.ua, 0x7A5A8A, -.02, -S.ua * .6, -.02, .035, .04, .02, 6, 4);                                         // elbow patch
    // pipe in the right hand near the mouth; cane in the left
    const f = A.right.fa, hy = -S.fa - .06;
    lathe(f, [[.001, 0], [.03, .003], [.034, .06], [.028, .066]], 0x5A3220, .01, hy - .01, .08, 1, 12);
    tube(f, [[.01, hy, .075], [0, hy + .03, .02], [-.01, hy + .06, -.07]], .009, 0x2E221C, .007, 5, 6);
    elderCane = true;
    idle = (t, J) => { const puff = Math.max(0, Math.sin(t * .55)) ** 3; // leaning on the cane, lifting the pipe for a puff every few seconds
      J.chest.rotation.set(.14 + .02 * Math.sin(t * 1.3), .1, -.03);
      J.leftUpperArm.rotation.set(-.35, 0, -.14); J.leftForeArm.rotation.set(-.3, 0, 0);
      J.rightUpperArm.rotation.set(-.85 - .15 * puff, -.45, .22); J.rightForeArm.rotation.set(-2.45 - .1 * puff, .55, 0);
      J.head.rotation.set(-.1 - .08 * puff, -.15 + .2 * Math.sin(t * .3), .03); };
  } else if (who === 'girl') {
    const TUNIC = 0x3E9C8C, TUNIC_SH = 0x2F7F72, STRIPE = [0xF2E6C9, 0x5E7F78];
    legs(0, 0, 0x5A3A2A, { stripes: STRIPE, bentR: .05 });
    torso(TUNIC);
    lathe(pelvis, [[S.hips * .95, .06], [S.hips * 1.2, -.07], [S.hips * 1.38, -.17], [S.hips * 1.4, -.19]].reverse(), (v, c) => c.set(TUNIC).lerp(C(TUNIC_SH), Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 7)) * .4), 0, 0, 0, .82, 24, .04);
    tube(chest, [[-.02, shY + .04, .08], [0, shY - .03, .12], [.02, shY + .04, .08]], .008, TUNIC_SH, .008, 5, 6);  // neckline notch
    head = neckAndHead({ smile: 1, open: .6, eyeSize: 1.25, fullCheeks: 1.2, browArch: 1.4 });
    const hr = S.hr, cy = hr * 1.02;
    // brown hair: cap with a soft fringe, twin braids with yellow ribbon ties
    { const g = new T.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * .58), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = Math.max(0, p.getZ(i)) ** 2; p.setXYZ(i, p.getX(i) * hr, p.getY(i) * hr * 1.12 + f * hr * .55 * (1 - p.getY(i)) + hr * .02, p.getZ(i) * hr * 1.03); } g.computeVertexNormals(); put(head, g, (v, c) => c.set(0x5A3A26).lerp(C(0x3E271A), Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 12)) * .35), 0, cy, 0); }
    for (const s of [-1, 1]) { const pts = []; for (let i = 0; i < 6; i++) pts.push([s * (hr * .92 + i * .006), cy - hr * .1 - i * hr * .26, -hr * .2 + i * .01]);
      for (let i = 0; i < 6; i++) ell(head, 0x5A3A26, ...pts[i], hr * .17 - i * .004, hr * .17, hr * .17 - i * .004, 8, 6);
      ell(head, 0xE9B949, pts[5][0], pts[5][1] - hr * .1, pts[5][2], hr * .12, hr * .06, hr * .1, 8, 5);
      for (const d of [-1, 1]) ell(head, 0xE9B949, pts[5][0] + d * hr * .12, pts[5][1] - hr * .1, pts[5][2], hr * .1, hr * .06, hr * .05, 6, 4); }
    const A = arms(TUNIC, null, { sleeve: .45 });
    for (const s of [-1, 1]) { const side = s < 0 ? 'left' : 'right';
      // striped undersleeves below the short tunic sleeve
      tube(A[side].ua, [[0, -S.ua * .45, 0], [0, -S.ua, 0]], S.leg * .78, (v, c) => c.set(Math.floor(-v.y * 55) % 2 ? STRIPE[0] : STRIPE[1]), S.leg * .72, 8, 6);
      tube(A[side].fa, [[0, 0, 0], [0, -S.fa * .85, .005]], S.leg * .72, (v, c) => c.set(Math.floor(-v.y * 55) % 2 ? STRIPE[0] : STRIPE[1]), S.leg * .55, 8, 6);
      ell(A[side].ua, TUNIC, 0, -S.ua * .3, 0, S.leg * 1.25, S.ua * .3, S.leg * 1.25, 10, 6); }
    // pinwheel raised in the right hand
    const f = A.right.fa, hy = -S.fa - .06;
    tube(f, [[0, hy, .02], [0, hy - .3, .04]], .006, 0xC8894A, .006, 5, 4);
    const pw = group('prop', 0, hy - .3, .06, f);
    const vanes = [0xD96956, 0xE9B949, 0x3E9C8C, 0x7FB26A];
    for (let i = 0; i < 4; i++) { const g = new T.ConeGeometry(.07, .12, 3); g.rotateX(Math.PI / 2); g.translate(0, .06, 0); put(pw, g, vanes[i], 0, 0, 0, 0, 0, i * Math.PI / 2); }
    ell(pw, 0xB8733F, 0, 0, .02, .016, .016, .016, 6, 4);
    idle = (t, J) => { const w = Math.sin(t * 1.8); // pinwheel held high and waved, a little bounce
      J.rightUpperArm.rotation.set(-.2 * w, 0, 2.75 + .1 * w); J.rightForeArm.rotation.set(-.25, 0, .15);
      J.leftUpperArm.rotation.set(-.1, 0, -.45 - .1 * Math.sin(t * 1.3)); J.leftForeArm.rotation.set(-.3, 0, 0);
      J.pelvis.position.y = S.hip + .012 * Math.abs(Math.sin(t * 3)); J.chest.rotation.set(-.03, .1 * w, -.04 * w); J.head.rotation.set(-.25, .15 + .1 * w, .08 * w); };
  } else { // seller
    const SHIRT = 0x6E9A6A, VEST = 0x6E4A33, TROUSER = 0x3E4A38;
    legs(TROUSER, TROUSER, 0x4A3226, { bentL: .05, cuff: 0x2E382A });
    torso(SHIRT, { fold: .02 });
    lathe(chest, [[S.chest * 1.06, -.08], [S.waist * 1.14, .08], [S.chest * 1.07, .22], [S.chest * 1.04, shY - .13], [S.sw * .84, shY - .06], [.1, shY - .01]], (v, c) => { c.set(VEST); if (Math.abs(v.x) < .045 && v.z > 0) c.set(SHIRT); return c; }, 0, 0, 0, .8, 22);
    for (const s of [-1, 1]) tube(chest, [[s * .03, shY + .03, .06], [s * .07, shY - .03, .11]], .018, 0x5E8A5A, .012, 5, 4);   // open shirt collar
    tube(chest, [[-S.sw * .7, shY - .02, .06], [0, .15, S.chest * .85], [S.sw * .8, -.08, .02]], .014, 0x5A3E2A, .014, 5, 10);   // satchel strap
    slab(pelvis, 0x7A6040, S.hips * 1.05, -.02, .04, .07, .2, .2, 4); slab(pelvis, 0x6A5236, S.hips * 1.08, .04, .05, .07, .09, .21, 4);   // satchel + flap
    head = neckAndHead({ smile: .85, eyeSize: 1, fullCheeks: .9, browArch: 1 });
    const hr = S.hr, cy = hr * 1.02;
    // short curly hair: a cap plus clustered curls
    { const g = new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * .5), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = Math.max(0, p.getZ(i)) ** 2; p.setXYZ(i, p.getX(i) * hr * 1.02, p.getY(i) * hr * 1.12 + hr * .06 + f * hr * .55 * (1 - p.getY(i)), p.getZ(i) * hr * 1.04); } g.computeVertexNormals(); put(head, g, 0x241812, 0, cy, 0); }
    for (let i = 0; i < 26; i++) { const a = i * 2.39996, e = .25 + .65 * ((i * .618) % 1), x = Math.cos(a) * Math.sin(e * 1.3), z = Math.sin(a) * Math.sin(e * 1.3), y = Math.cos(e * 1.3); if (z > .25 && y < .78) continue;
      ell(head, i % 3 ? 0x2E2018 : 0x1E140E, x * hr * 1.03, cy + y * hr * 1.12 + hr * .08, z * hr * 1.05, hr * .2, hr * .18, hr * .2, 6, 5); }
    const A = arms(SHIRT, null, { sleeve: .5, rolled: true });
    for (const s of [-1, 1]) { const u = A[s < 0 ? 'left' : 'right'].ua; lathe(u, [[S.leg * 1.0, -S.ua * .7], [S.leg * 1.12, -S.ua * .78], [S.leg * 1.02, -S.ua * .86]], 0x5E8A5A, 0, 0, 0, 1, 12); }
    // fruit crate carried at the waist in both arms (on the chest pivot so it stays level)
    const cz = .3, cyy = .02;
    for (const [w, h, d, x, y, z] of [[.46, .03, .28, 0, cyy - .09, cz], [.46, .09, .02, 0, cyy - .04, cz + .135], [.46, .09, .02, 0, cyy - .04, cz - .135], [.02, .09, .28, .22, cyy - .04, cz], [.02, .09, .28, -.22, cyy - .04, cz]]) slab(chest, (v, c) => c.set(0xA8784A).lerp(C(0x7A5230), Math.abs(Math.sin(v.x * 60)) > .95 ? .5 : 0), x, y, z, w, h, d, 6);
    const fruit = [0xC8443A, 0x9CC25A, 0xE9B949, 0x6E4A8A, 0xD2553F, 0xA6C46A, 0xC8443A, 0x5E3A6E];
    for (let i = 0; i < 12; i++) ell(chest, fruit[i % 8], -.17 + (i % 6) * .068, cyy + .01 + (i % 2) * .015, cz - .07 + Math.floor(i / 6) * .14, .036, .036, .036, 8, 6);
    idle = (t, J) => { const k = Math.sin(t * .8); // weight shift, hitches the crate up now and then, looks around the market
      const hitch = Math.max(0, Math.sin(t * .5)) ** 6;
      J.leftUpperArm.rotation.set(-.3 + .05 * hitch, 0, -.12); J.leftForeArm.rotation.set(-1.3 - .1 * hitch, 0, .05);
      J.rightUpperArm.rotation.set(-.3 + .05 * hitch, 0, .12); J.rightForeArm.rotation.set(-1.3 - .1 * hitch, 0, -.05);
      J.pelvis.rotation.z = .025 * k; J.chest.rotation.set(-.02 + .04 * hitch, .06 * k, -.03 * k); J.head.rotation.set(-.04, .35 * Math.sin(t * .4), .04 * k); };
  }

  if (elderCane) { // pose once, find the left hand, plant the cane vertically below it
    idle(0, joints); root.updateMatrixWorld(true);
    const hand = new T.Vector3(0, -S.fa - .06, .03); joints.leftForeArm.localToWorld(hand); joints.pelvis.worldToLocal(hand);
    tube(pelvis, [[hand.x, hand.y, hand.z], [hand.x, hand.y - .4, hand.z + .005], [hand.x, -S.hip + .02, hand.z]], .015, 0x8A6240, .012, 6, 8);
    tube(pelvis, [[hand.x, hand.y, hand.z], [hand.x + .01, hand.y + .06, hand.z + .05], [hand.x, hand.y + .02, hand.z + .1]], .015, 0x8A6240, .015, 6, 6);
  }
  // ---------------- merge one mesh per pivot ----------------
  for (const [pivot, list] of parts) {
    const pos = [], nor = [], col = [], c = new T.Color(), v = new T.Vector3();
    for (const [geo, cl, m] of list) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); const pre = g.attributes.color; g.applyMatrix4(m);
      const p = g.attributes.position; pos.push(...p.array); nor.push(...g.attributes.normal.array);
      for (let i = 0; i < p.count; i++) { if (cl === null && pre) c.setRGB(pre.getX(i), pre.getY(i), pre.getZ(i)); else if (typeof cl === 'function') { v.fromBufferAttribute(p, i); cl(v, c); } else c.set(cl); col.push(c.r, c.g, c.b); } g.dispose(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const o = new T.Mesh(g, paint); o.castShadow = o.receiveShadow = true; o.name = pivot.name + '-mesh'; if (/Arm|prop/.test(pivot.name)) o.userData.noOutline = true; pivot.add(o);
  }
  // ---------------- acting ----------------
  const J = joints;
  function setPose({ t = 0, act = 'idle', yaw = 0, pitch = 0, look = 0, gentle = false } = {}) {
    const m = gentle ? .5 : 1, br = Math.sin(t * 1.5);
    J.pelvis.position.y = S.hip; J.pelvis.rotation.set(0, 0, 0);
    idle(t, J);
    J.chest.scale.set(1 + .006 * br, 1 + .01 * br, 1 + .01 * br);
    if (act === 'worried') { J.head.rotation.x = -.45; J.chest.rotation.x -= .05; }                             // looking up at the silent bells
    if (act === 'cheer') { const b = Math.abs(Math.sin(t * 7)); J.pelvis.position.y += .05 * b * m; if (who !== 'seller') { J.leftUpperArm.rotation.set(0, 0, -2.5 - .2 * b); J.leftForeArm.rotation.set(-.3, 0, 0); } J.head.rotation.x = -.3; }
    if (act === 'wave' && who !== 'seller' && who !== 'girl') { J.leftUpperArm.rotation.set(0, 0, -2.4); J.leftForeArm.rotation.set(0, 0, -.3 + .4 * Math.sin(t * 9)); }
    J.head.rotation.x = J.head.rotation.x * (1 - look) - pitch * look; J.head.rotation.y = J.head.rotation.y * (1 - look) + yaw * look;
    if (J.prop) J.prop.rotation.z = -t * (gentle ? 3 : 7);
    root.updateMatrixWorld(true);
  }
  root.userData.setPose = setPose; root.userData.who = who; root.userData.height = S.H;
  setPose({ t: 0 });
  const box = new T.Box3(), vv = new T.Vector3(); root.updateMatrixWorld(true);
  root.traverse(n => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(vv.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  rig.position.set(0, -box.min.y, 0);   // feet on the ground; the character's own origin stays between the feet
  return root;
}
