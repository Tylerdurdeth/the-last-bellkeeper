// Bellhollow villagers (rebuild 3, after references-v2/R-villagers.png), made the way Mara is made: one continuous sculpted
// head per person (brow, sockets, nose, cheeks, smile, chin) painted by vertex colour, modelled eyes with lids and
// catchlights, sculpted hair, layered clothes with folds and real props. Vertex colour only, no textures.
//   opts.who: 'baker'  plump cheerful baker: knotted teal headscarf over dark hair and a low bun, coral dress, flour-dusted
//                      cream apron, rolled sleeves, a basket of loaves on the left arm; the right hand talks
//             'elder'  lanky old man: tweed flat cap, white beard and moustache, green jumper, patched honey waistcoat,
//                      brown trousers, a walking stick in the right hand, a pipe in the left
//             'girl'   eight-year-old: twin braids with yellow bows, teal tunic over striped sleeves and leggings, pinwheel
//             'seller' young fruit seller: short curly hair, sage shirt with rolled sleeves, brown vest, satchel, fruit crate
// Rig (userData.joints) uses the hero's joint names so the CC0 Quaternius idle clips retarget onto it (bellhollow/
// villagers.js drives them): hips, chest, head, left/right UpperArm, LowerArm, Hand, UpperLeg, LowerLeg, Foot.
// Front is +Z, feet on y = 0. Rest pose: limbs hang straight down (identity rotations).
// userData.setPose({t, act, yaw, pitch, look, gentle, motion}) — motion(tick) is supplied by the animator (retargeted clip);
// setPose then layers the props' arm poses, head look-at and acts (worried | cheer | wave) on top.
export default function (THREE, opts = {}) {
  const T = THREE, who = opts.who || 'baker';
  const C = h => new T.Color(h);
  const root = new T.Group(); root.name = 'bh-villager-' + who; const rig = new T.Group(); rig.name = 'villager-rig'; root.add(rig);
  const paint = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .86 }), { name: 'fabric' });
  // Face skin keeps a minimum brightness in shade (as the hero's face does): a small self-lit share of its own colour.
  const skinPaint = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .86 }), { name: 'fabric' });
  skinPaint.onBeforeCompile = sh => { sh.vertexShader = 'attribute float skinGlow; varying float vSkinGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinGlow = skinGlow;');
    sh.fragmentShader = 'varying float vSkinGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.26 * vSkinGlow;'); };
  const skin = new Set(), asSkin = () => { const l = parts.get(lastPv); skin.add(l[l.length - 1][0]); }; let lastPv = null;
  const joints = {}; root.userData.joints = joints; root.userData.keepHierarchy = true;
  const group = (name, x, y, z, parent = rig) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); joints[name] = g; return g; };
  const parts = new Map(); const E = new T.Euler(), Q = new T.Quaternion();
  const put = (pv, geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { lastPv = pv; if (!parts.has(pv)) parts.set(pv, []); parts.get(pv).push([geo, col, new T.Matrix4().compose(new T.Vector3(x, y, z), Q.clone().setFromEuler(E.set(rx, ry, rz)), new T.Vector3(sx, sy, sz))]); };
  const ell = (pv, col, x, y, z, a, b, c, ws = 12, hs = 8, rx = 0, ry = 0, rz = 0) => put(pv, new T.SphereGeometry(1, ws, hs), col, x, y, z, rx, ry, rz, a, b, c);
  const lathe = (pv, prof, col, x = 0, y = 0, z = 0, depth = 1, segs = 24, fold = 0, foldN = 9, gap = 0) => {   // gap: front opening half-angle
    const g = new T.LatheGeometry(prof.map(([r, h]) => new T.Vector2(Math.max(.0005, r), h)), segs, gap, Math.PI * 2 - 2 * gap);
    if (fold) { const p = g.attributes.position, top = prof[prof.length - 1][1], bot = prof[0][1]; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)), w = Math.max(0, (top - p.getY(i)) / (top - bot || 1)), k = 1 + fold * Math.sin(a * foldN) * w; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
    g.scale(1, 1, depth); g.computeVertexNormals(); put(pv, g, col, x, y, z);
  };
  const tube = (pv, pts, r0, col, r1 = r0, radial = 10, seg = 0, bulge = 0) => {
    const c = new T.CatmullRomCurve3(pts.map(v => new T.Vector3(...v))), n = seg || Math.max(6, pts.length * 4), g = new T.TubeGeometry(c, n, 1, radial, false), a = g.attributes.position, v = new T.Vector3(), q = new T.Vector3();
    for (let i = 0; i <= n; i++) { c.getPointAt(i / n, q); const t = i / n, r = (r0 + (r1 - r0) * t) * (1 + bulge * Math.sin(Math.PI * t)); for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(a, k).sub(q).normalize().multiplyScalar(r).add(q); a.setXYZ(k, v.x, v.y, v.z); } }
    g.computeVertexNormals(); put(pv, g, col);
    for (const [end, rr] of [[pts[0], r0], [pts[pts.length - 1], r1]]) ell(pv, col, ...end, rr, rr, rr, 8, 6);   // rounded caps
  };
  const slab = (pv, col, x, y, z, w, h, d, p = 5, rx = 0, ry = 0, rz = 0) => { const g = new T.SphereGeometry(1, 14, 10), a = g.attributes.position, f = e => Math.sign(e) * Math.pow(Math.abs(e), 2 / p); for (let i = 0; i < a.count; i++) a.setXYZ(i, f(a.getX(i)) * w / 2, f(a.getY(i)) * h / 2, f(a.getZ(i)) * d / 2); g.computeVertexNormals(); put(pv, g, col, x, y, z, rx, ry, rz); };
  const sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  const shade = (base, dark, amt) => (v, c) => c.set(base).lerp(C(dark), amt(v));
  // Hair cap hugging the skull, with a hairline: high at the brow (front), low at the nape; fringe lift and volume.
  const hairCap = (pv, col, { front = .052, side = .0, back = -.075, vol = 1.07, fringe = 0, y0 = .11 } = {}) => {
    const g = new T.SphereGeometry(1, 30, 22), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i) * .088 * vol, y = p.getY(i) * .112 * vol, z = p.getZ(i) * .096 * vol; const az = Math.atan2(x, z), fz = Math.cos(az);
      const line = fz > 0 ? side + (front - side) * sm(.35, .95, fz) : side + (back - side) * sm(0, -.9, fz);
      if (y < line) { y = line + (y - line) * .05; const k = Math.sqrt(Math.max(0, 1 - (line / (.112 * vol)) ** 2)); x = Math.sin(az) * .088 * vol * k * 1.01; z = Math.cos(az) * .096 * vol * k * 1.01; }
      if (fringe && fz > .5) z += fringe * sm(.02, .07, y) * 0;
      p.setXYZ(i, x, y, z + (z > 0 ? .004 : 0)); }
    g.computeVertexNormals(); put(pv, g, col, 0, y0, 0);
  };

  // ---------------- character sheets (metres) ----------------
  // hip: hip-joint height; thigh/shin lengths; sh: shoulder height above hips; sw: shoulder half-width; ua/fa arm lengths;
  // hs: head scale (1 = Mara-sized head, ~0.23 m tall); limb radii scale lr.
  const S = {
    baker: { hip: .74, thigh: .36, shin: .34, sh: .47, sw: .185, ua: .26, fa: .23, hs: 1.02, lr: 1.18, waist: .16, chest: .2, hipsW: .22, skin: 0xE8B48E, skinSh: 0xCB9270, iris: 0x5A3A22, brow: 0x2E2320, lips: 0xC8766A, blush: .9, age: .15, cheeks: 1.25, jaw: 1.05, smile: 1 },
    elder: { hip: .79, thigh: .386, shin: .368, sh: .46, sw: .175, ua: .3, fa: .27, hs: .98, lr: .92, waist: .12, chest: .15, hipsW: .15, skin: 0xE2AA86, skinSh: 0xC48A66, iris: 0x4F6E78, brow: 0xECECE6, lips: 0xB07466, blush: .55, age: 1, cheeks: .85, jaw: .92, smile: .8 },
    girl: { hip: .56, thigh: .27, shin: .26, sh: .33, sw: .125, ua: .19, fa: .17, hs: .92, lr: .78, waist: .1, chest: .11, hipsW: .12, skin: 0xF0C6A2, skinSh: 0xD6A07E, iris: 0x5A3A22, brow: 0x4A3222, lips: 0xD27A6C, blush: 1, age: 0, cheeks: 1.3, jaw: .88, smile: 1.1, child: 1 },
    seller: { hip: .88, thigh: .43, shin: .41, sh: .5, sw: .195, ua: .3, fa: .27, hs: 1, lr: 1, waist: .14, chest: .17, hipsW: .16, skin: 0xB07A52, skinSh: 0x8F5E3E, iris: 0x3A2618, brow: 0x241812, lips: 0x9A5A4A, blush: .35, age: 0, cheeks: .95, jaw: 1, smile: 1 },
  }[who];
  const R = .05 * S.lr;                                   // base limb radius

  const hips = group('hips', 0, S.hip, 0);
  const chest = group('chest', 0, .12, 0, hips);          // spine_03: the upper torso bends here
  const SH = S.sh - .12;                                  // shoulder height inside the chest pivot

  // ---------------- legs: thigh / shin / foot pivots ----------------
  function legs({ trouser = null, sock = null, shoe = 0x3E2E26, stripes = null, rolled = null, bootTop = false } = {}) {
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'left' : 'right', x = s * S.hipsW * .42;
      const up = group(side + 'UpperLeg', x, -.02, 0, hips), lo = group(side + 'LowerLeg', 0, -S.thigh, 0, up), ft = group(side + 'Foot', 0, -S.shin, 0, lo);
      const stripe = stripes ? (v, c) => c.set(Math.floor((v.y + 3) * 34) % 2 ? stripes[0] : stripes[1]) : null;
      const cT = stripe || trouser || S.skin, cS = stripe || sock || trouser || S.skin;
      tube(up, [[0, 0, 0], [0, -S.thigh * .5, .006], [0, -S.thigh, 0]], R * 1.45, cT, R * 1.05, 12, 0, .05);
      tube(lo, [[0, 0, 0], [0, -S.shin * .35, -.012], [0, -S.shin + .05, 0]], R * 1.02, cS, R * .72, 12, 0, .08);
      if (rolled) lathe(lo, [[R * .98, .0], [R * 1.08, -.02], [R * 1.04, -.05], [R * .9, -.06]], rolled, 0, -S.shin * .72, 0, 1, 16);
      if (bootTop) lathe(lo, [[R * .95, -S.shin + .16], [R * 1.02, -S.shin + .12], [R * .98, -S.shin + .04]], shoe, 0, 0, 0, 1, 14);
      // foot: heel, rounded toe, sole (a shoe, not a block)
      ell(ft, shoe, 0, -.035, -.005, R * .95, .045, R * 1.1, 12, 8);
      ell(ft, shoe, 0, -.045, .07, R * .9, .035, .085 * S.lr, 12, 8);
      slab(ft, 0x2A201C, 0, -.075, .035, R * 1.9, .016, .19 * S.lr, 4);
    }
  }
  // ---------------- arms: upper / lower / hand pivots, soft hands with a thumb and grouped fingers ----------------
  function arms({ sleeve, cuff = null, sleeveTo = 1, rolledAt = null, stripes = null } = {}) {
    const A = {};
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'left' : 'right';
      const ua = group(side + 'UpperArm', s * S.sw, SH - .02, -.005, chest), fa = group(side + 'LowerArm', 0, -S.ua, 0, ua), hd = group(side + 'Hand', 0, -S.fa, .004, fa);
      const st = stripes ? (v, c) => c.set(Math.floor((-v.y + 3) * 40) % 2 ? stripes[0] : stripes[1]) : null;
      ell(ua, sleeve, s * -.012, -.012, 0, R * 1.08, R * .95, R * 1.05, 12, 8);                                         // shoulder cap
      tube(ua, [[0, 0, 0], [s * .006, -S.ua * .5, .004], [0, -S.ua, 0]], R * 1.06, sleeveTo > .3 ? sleeve : stripes ? st : S.skin, R * .86, 12, 0, .06);
      if (sleeveTo <= .3) lathe(ua, [[R * 1.18, 0], [R * 1.26, -.05], [R * 1.12, -S.ua * sleeveTo * 2 - .04]], sleeve, 0, 0, 0, 1, 14);
      if (stripes && sleeveTo <= .6) tube(ua, [[0, -S.ua * .45, 0], [0, -S.ua, 0]], R * .9, st, R * .84, 10);
      const foreCol = sleeveTo >= 1 ? sleeve : stripes ? st : S.skin;
      tube(fa, [[0, 0, 0], [0, -S.fa * .45, .01], [0, -S.fa + .02, 0]], R * .86, foreCol, R * .62, 12, 0, .08);
      if (rolledAt !== null) lathe(fa, [[R * 1.0, .02], [R * 1.14, -.005], [R * 1.1, -.04], [R * .94, -.055]], cuff ?? sleeve, 0, -rolledAt, 0, 1, 14);
      if (sleeveTo >= 1 && cuff) lathe(fa, [[R * .74, -S.fa + .06], [R * .8, -S.fa + .03], [R * .72, -S.fa + .01]], cuff, 0, 0, 0, 1, 12);
      // hand: soft palm, four fingers grouped in two gentle curves, a thumb; relaxed, slightly cupped
      const k = S.lr * .95, sk = S.skin, skd = (v, c) => c.set(sk).lerp(C(S.skinSh), .18);
      slab(hd, sk, 0, -.038 * k, .004, .062 * k, .08 * k, .03 * k, 3.2);
      for (let f = 0; f < 4; f++) { const fx = (-.021 + f * .014) * k, L = [.05, .058, .055, .044][f] * k;
        tube(hd, [[fx, -.07 * k, .004], [fx * 1.04, -.07 * k - L * .55, .012 * k], [fx * 1.06, -.07 * k - L, .024 * k]], .0082 * k, skd, .0064 * k, 6, 6); }
      tube(hd, [[-s * .026 * k, -.03 * k, .012], [-s * .04 * k, -.056 * k, .026 * k], [-s * .036 * k, -.078 * k, .036 * k]], .0098 * k, sk, .0074 * k, 6, 6);
      A[side] = { ua, fa, hd };
    }
    return A;
  }
  // ---------------- head: the Mara method (one sculpted surface, painted), scaled per person ----------------
  const neck = group('neck', 0, SH + .03, -.005, chest);
  lathe(neck, [[.05 * S.hs * S.lr ** .3, -.05], [.046 * S.hs, 0], [.043 * S.hs, .05], [.045 * S.hs, .075]], S.skin, 0, 0, 0, .92, 16); asSkin();
  const head = group('head', 0, .035, .004, neck); head.scale.setScalar(S.hs * 1.12);
  const HY = .11;
  // The sculpted head as a function of the unit sphere (also used to lay the mouth line exactly on the surface).
  const G = (dx, dy, sx, sy) => Math.exp(-((dx / sx) ** 2) - ((dy / sy) ** 2));
  function headAt(ux, uy, uz) {
      let x = ux * .088, y = uy * .112, z = uz * .096;
      const front = sm(.05, .5, uz), jawK = S.child ? .9 : 1;
      x *= (1 + .09 * (S.cheeks - .8) * G(0, y + .055, 1, .035)) * (1 - .12 * sm(-.25, -.85, uy) * (2 - S.jaw)) * jawK ** .3;
      if (S.child) { y *= .96; z *= .98; }
      z += front * (.012 * G(x, y + .004, .012, .028) * (S.child ? .6 : 1) + .013 * G(x, y + .027, .018, .013) * (S.child ? .75 : 1)   // nose bridge + bulb
        + .008 * G(0, y - .042, 1, .012) * sm(.075, .04, Math.abs(x)) - .011 * G(Math.abs(x) - .034, y - .016, .017, .011)                      // brow, sockets
        + .013 * S.cheeks * G(Math.abs(x) - .044, y + .016, .021, .017) + .002 * G(Math.abs(x) - .036, y + .05, .006, .006)                    // cheeks, smile lift
        + .006 * G(x, y + .088, .026, .016) + .0015 * G(x, y + .051, .03, .006) - .001 * G(x, y + .062, .026, .004));          // chin, lips
      return [x, y, z];
  }
  {
    const g = new T.SphereGeometry(1, 56, 44), p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new T.Color();
    const ox = [], oy = [], oz = [];
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i); ox.push(ux); oy.push(uy); oz.push(uz);
      const [x, y, z] = headAt(ux, uy, uz), front = sm(.05, .5, uz), ax = Math.abs(x);
      p.setXYZ(i, x, y, z);
      c.set(S.skin);
      c.lerp(C(S.skinSh), sm(.1, -.6, uz) * .3);
      c.lerp(C(0xE58F7A), front * S.blush * .85 * G(ax - .046, y + .016, .022, .016));
      const smileY = -.054 + 13 * x * x * S.smile;
      if (front > .5 && ax < .032) c.lerp(C(S.lips), sm(.007, .002, y - smileY + .002 > 0 ? (y - smileY) * .5 : smileY - y - .003) * .8);
      if (front > .5 && ax < .036) c.lerp(C(S.lips).lerp(C(0x2A1E1C), .55), sm(.0032, .0012, Math.abs(y - smileY)) * .9 * sm(.036, .022, ax));
      if (S.age) { for (const k of [-1, 0, 1]) if (front > .3) { const cx = .063, cy = .016 + k * .006, d = Math.abs((ax - cx) * Math.sin(-k * .45) + (y - cy) * Math.cos(-k * .45)); if (Math.abs(ax - cx - .006) < .008) c.lerp(C(S.skinSh), sm(.0022, .0008, d) * .45 * S.age); }
        for (const ly of [.058, .07]) if (front > .5 && ax < .045) c.lerp(C(S.skinSh), sm(.0022, .0008, Math.abs(y - ly - .004 * Math.cos(x * 40))) * .35 * S.age); }
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(cols, 3)); g.computeVertexNormals();
    // Cel light stays coherent over the face: front normals lean toward a soft forward plane (no dark jaw / beard band).
    const n = g.attributes.normal, v = new T.Vector3(), e = new T.Vector3();
    for (let i = 0; i < p.count; i++) { const front = sm(-.15, .45, oz[i]), low = sm(.3, -.1, oy[i]), nose = Math.exp(-((ox[i] / .16) ** 2) - (((oy[i] + .12) / .2) ** 2)) * sm(.6, .9, oz[i]);
      e.set(ox[i] * .45, oy[i] * .25 + .12, 1).normalize(); v.fromBufferAttribute(n, i).lerp(e, front * (.6 + .35 * low) * (1 - .35 * nose)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
    put(head, g, null, 0, HY, 0); asSkin();
  }
  // smile line, ears, eyes with lids and catchlights, brows
  { const pts = []; for (let i = 0; i <= 14; i++) { const tx = -.029 + i * .058 / 14, ty = -.054 + 13 * tx * tx * S.smile; let ux = tx / .088, uy = ty / .112;
      for (let k = 0; k < 6; k++) { const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy)), [x, y] = headAt(ux, uy, uz); ux += (tx - x) / .088; uy += (ty - y) / .112; }
      const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy)), [x, y, z] = headAt(ux, uy, uz); pts.push([x, HY + y, z + .0009]); }
    const mc = C(S.lips).lerp(C(0x3A2220), .55); for (let i = 0; i < pts.length - 1; i++) put(head, new T.TubeGeometry(new T.LineCurve3(new T.Vector3(...pts[i]), new T.Vector3(...pts[i + 1])), 1, .0011, 4, false), mc);
  }
  for (const s of [-1, 1]) { ell(head, S.skin, s * .088, HY + .005, -.004, .017, .03, .014); asSkin(); ell(head, S.skinSh, s * .092, HY + .004, .002, .007, .016, .005); asSkin(); }
  const eyes = group('eyes', 0, HY + .016, 0, head);
  for (const s of [-1, 1]) {
    const ex = s * .035, ez = .084, es = S.child ? 1.62 : 1.45;
    ell(eyes, 0xF6EFE2, ex, 0, ez, .014 * es, .0088 * es, .006, 14, 10);
    ell(eyes, (v, o) => o.set(S.iris).lerp(C(0x1A1410), sm(.0055, .0085, Math.hypot(v.x - ex - s * .001, v.y)) * .6), ex + s * .001, -.0005, ez + .0045, .0068 * es, .0072 * es, .003, 12, 8);
    ell(eyes, 0x14100E, ex + s * .001, -.0005, ez + .0068, .0036 * es / 1.4, .0038 * es / 1.4, .0012, 8, 6);
    ell(eyes, 0xFFFFFF, ex + s * .001 - .003, .003, ez + .0084, .0028, .0028, .0012, 6, 4);
    const lid = (v, o) => o.set(S.skin).lerp(C(S.skinSh), .2);
    ell(eyes, lid, ex, .0142 * es / 1.42 + (S.child ? .002 : 0), ez + .0005, .0205 * es / 1.42, .0048, .008, 14, 8, 0, 0, -s * .1);
    tube(eyes, [[ex - s * .019 * es / 1.42, .002, ez + .002], [ex, .0105 * es / 1.42, ez + .007], [ex + s * .021 * es / 1.42, .003, ez + .001]], .0017, 0x2A1E1C, .001, 5, 8);
    tube(head, [[s * .014, HY + .05, .095], [s * .034, HY + .063 + (S.child ? .004 : 0), .095], [s * .057, HY + .055, .088]], .0062 * (who === 'elder' ? 1.5 : 1), S.brow, .0032 * (who === 'elder' ? 1.6 : 1), 6, 8);
  }

  // ======================== the four people ========================
  let hold = null;   // per-character prop arm pose (applied over the clip): (J, t, w) => void
  const cheer = { left: true, right: true };
  if (who === 'baker') {
    const CORAL = 0xD4735F, CORAL_SH = 0xB25B4A, APRON = 0xF2E6C9, HAIR = 0x2A201C, SCARF = 0x2F6A64;
    legs({ sock: S.skin, shoe: 0x3A2E2A });
    // coral dress: bodice with a soft bust and collar, full skirt with folds to mid-calf
    lathe(chest, [[S.waist * 1.25, -.13], [S.waist * 1.18, -.04], [S.chest * 1.02, .06], [S.chest * 1.12, .14], [S.chest * 1.08, .22], [S.sw * 1.02, SH - .06], [S.sw * .8, SH + .01], [.06, SH + .04]], CORAL, 0, 0, 0, .8, 26);
    for (const s of [-1, 1]) ell(chest, CORAL, s * .07, .15, .1, .085, .075, .07);
    for (const s of [-1, 1]) tube(chest, [[s * .012, SH + .035, .065], [s * .05, SH + .005, .085], [s * .075, SH + .015, .06]], .012, 0xF2E6C9, .008, 6, 6);   // cream collar
    const SK = [[S.hipsW * 1.02, .03], [S.hipsW * 1.15, -.08], [S.hipsW * 1.36, -.32], [S.hipsW * 1.48, -.5], [S.hipsW * 1.5, -.55]];
    const skirtR = y => { for (let i = 1; i < SK.length; i++) if (y >= SK[i][1]) { const [r0, y0] = SK[i - 1], [r1, y1] = SK[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return SK[SK.length - 1][0]; };
    lathe(hips, SK.slice().reverse(), shade(CORAL, CORAL_SH, v => Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 9)) * .45), 0, 0, 0, .86, 36, .04);
    // flour-dusted apron: bib + skirt panel, waist band, bow at the back
    const flour = (v, c) => c.set(APRON).lerp(C(0xFFFFFF), hash(Math.floor(v.x * 70), Math.floor(v.y * 70), 3) > .8 ? .8 : 0).lerp(C(0xD9CFB5), Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 7)) * .25);
    { const g = new T.CylinderGeometry(1, 1, 1, 18, 12, true, -.85, 1.7), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) + .5, a = Math.atan2(p.getX(i), p.getZ(i)), y = .04 - (1 - t) * .5, r = skirtR(Math.min(.03, y)) + .012 + .01 * Math.sin(a * 6) * (1 - t); p.setXYZ(i, Math.sin(a) * r, y, Math.cos(a) * r * .86); } g.computeVertexNormals(); put(hips, g, flour); }
    { const g = new T.CylinderGeometry(1, 1, 1, 12, 6, true, -.72, 1.44), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) + .5, a = Math.atan2(p.getX(i), p.getZ(i)), r = S.chest * 1.2; p.setXYZ(i, Math.sin(a) * r * (1 - .35 * t), -.09 + t * .3, Math.cos(a) * r * .8 + .02 + .05 * Math.exp(-(((t - .5) / .3) ** 2))); } g.computeVertexNormals(); put(chest, g, flour); }
    lathe(hips, [[S.hipsW * 1.08, .01], [S.hipsW * 1.1, .05]], 0xE6D9B8, 0, 0, 0, .88, 26);
    for (const s of [-1, 1]) { tube(chest, [[s * .06, .2, .12], [s * .075, SH + .02, .03], [s * .03, SH + .02, -.1]], .009, APRON, .009, 5); ell(hips, APRON, s * .04, .03, -S.hipsW * .9, .045, .03, .02, 8, 6, 0, 0, s * .5); }
    // dark hair: side-swept front under the scarf, low bun at the nape
    hairCap(head, shade(HAIR, 0x3E302A, v => Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 14 + v.y * 30)) * .5), { front: .055, side: .01, back: -.06, y0: HY });
    for (const s of [-1, 1]) tube(head, [[s * .008, HY + .088, .085], [s * .05, HY + .075, .082], [s * .085, HY + .04, .045], [s * .09, HY + .005, -.01]], .012, HAIR, .008, 7, 10);
    ell(head, shade(HAIR, 0x3E302A, v => Math.max(0, Math.sin(v.x * 200)) * .4), 0, HY - .045, -.1, .045, .04, .038, 12, 8);
    // patterned teal headscarf pushed back from the forehead, knotted at the back, two tails
    const scarf = (v, c) => { c.set(SCARF).lerp(C(0x245450), Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 10 + v.y * 40)) * .3); const d = hash(Math.floor(v.x * 90), Math.floor(v.y * 90), Math.floor(v.z * 90)); if (d > .9) c.set(0xE9C98F); else if (d > .84) c.set(0xD96956); };
    { const g = new T.SphereGeometry(1, 30, 16, 0, Math.PI * 2, 0, Math.PI * .5), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), back = Math.max(0, -z); p.setXYZ(i, x * .102, y * .1 + .02 - Math.max(0, z) * .02, z * .106 - .014 - back * .01); } g.computeVertexNormals(); put(head, g, scarf, 0, HY + .035, -.01, -.6, 0, 0); }
    ell(head, scarf, 0, HY + .02, -.115, .03, .026, .024, 10, 8);
    for (const s of [-1, 1]) tube(head, [[0, HY + .02, -.12], [s * .03, HY + .0, -.14], [s * .04, HY - .04, -.13]], .014, scarf, .005, 6, 8);
    // arms: rolled coral sleeves; a woven basket of loaves on the left forearm
    const A = arms({ sleeve: CORAL, cuff: CORAL_SH, sleeveTo: .5, rolledAt: .0 });
    for (const s of [-1, 1]) lathe(s < 0 ? A.left.ua : A.right.ua, [[R * 1.05, -S.ua * .72], [R * 1.22, -S.ua * .79], [R * 1.08, -S.ua * .86]], CORAL_SH, 0, 0, 0, 1, 14);
    const hang = group('basketHang', 0, -S.fa * .45, .02, A.left.fa), bk = group('basket', 0, -.25, .04, hang);
    const weave = (v, c) => c.set(0xC08A4E).lerp(C(0x8C6232), (Math.floor(v.y * 55) + Math.floor(Math.atan2(v.x, v.z) * 7)) % 2 ? .45 : 0);
    lathe(bk, [[.001, -.08], [.12, -.075], [.16, -.02], [.17, .05], [.155, .055], [.15, .04]], weave, 0, 0, 0, .7, 24);
    put(bk, new T.TorusGeometry(.14, .012, 6, 26, Math.PI), 0x8C6232, 0, .05, 0, 0, 0, 0, 1, 1.45, 1);
    for (const [x, y, z, rz] of [[-.07, .06, .02, .3], [.03, .07, -.02, -.2], [.07, .055, .05, .5], [-.02, .05, .06, -.1]]) {
      ell(bk, (v, c) => c.set(0xC9884A).lerp(C(0xF0D0A0), v.y > y + .01 ? .35 : 0), x, y, z, .075, .032, .036, 14, 8, 0, rz, 0);
      for (let k = -1; k <= 1; k++) ell(bk, 0xF0D8A6, x + k * .03 * Math.cos(rz), y + .028, z - k * .03 * Math.sin(rz), .006, .004, .02, 6, 4, 0, rz, 0);
    }
    hold = (J, t) => { // basket arm: elbow bent, forearm forward, basket resting against the hip
      J.leftUpperArm.rotation.set(.1, 0, -.28); J.leftLowerArm.rotation.set(-1.3, -.25, 0); J.leftHand.rotation.set(0, 0, 0);
    };
    cheer.left = false;
  } else if (who === 'elder') {
    const JUMPER = 0x5E7A4A, JUMPER_SH = 0x4A6238, VEST = 0xC8923E, VEST_SH = 0x9C6E2E, TROUSER = 0x6E5A40, CAP = 0x7A6A4A;
    legs({ trouser: shade(TROUSER, 0x5A4832, v => Math.max(0, Math.sin(v.y * 40)) * .25), shoe: 0x4A3226, bootTop: true });
    lathe(hips, [[S.hipsW * 1.02, -.1], [S.hipsW * 1.06, -.02], [S.hipsW * .95, .04]], TROUSER, 0, 0, 0, .82, 20);
    // ribbed jumper under a honey waistcoat with a patch, buttons and pockets
    const rib = (v, c) => c.set(JUMPER).lerp(C(JUMPER_SH), Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 40)) * .3);
    lathe(chest, [[S.hipsW * 1.06, -.16], [S.waist * 1.2, -.02], [S.chest * 1.08, .12], [S.chest * 1.1, .22], [S.sw * 1.02, SH - .05], [S.sw * .75, SH + .01], [.065, SH + .04]], rib, 0, 0, 0, .8, 26);
    lathe(neck, [[.055, -.06], [.06, -.02], [.057, .015]], rib, 0, 0, 0, .95, 18);
    const vest = (v, c) => { c.set(VEST).lerp(C(VEST_SH), Math.max(0, Math.sin(v.y * 90)) * .15); if (Math.hypot(v.x - .07, v.y - .02) < .03 && v.z > 0) c.set(0x8A6A3A); };
    lathe(chest, [[S.hipsW * 1.1, -.17], [S.waist * 1.3, -.03], [S.chest * 1.14, .12], [S.chest * 1.14, .2], [S.sw * .88, SH - .06], [.08, SH - .02]], vest, 0, 0, 0, .82, 28, 0, 9, .32);   // open at the front
    for (let i = 0; i < 4; i++) ell(chest, 0x5A3E22, .042, -.12 + i * .06, S.chest * .9, .008, .008, .005, 6, 4);
    for (const s of [-1, 1]) slab(chest, VEST_SH, s * .075, -.1, S.chest * .88, .055, .03, .01, 5);
    // white side hair and nape, full beard and moustache, flat cap with a peak
    for (const s of [-1, 1]) tube(head, [[s * .078, HY + .045, .03], [s * .09, HY + .01, -.02], [s * .075, HY - .005, -.075], [0, HY - .01, -.095]], .016, 0xEDEDE8, .012, 7, 10);
    { const g = new T.SphereGeometry(1, 28, 18, 0, Math.PI * 2, Math.PI * .47, Math.PI * .4), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * .09, y * .14 - .025 + Math.max(0, z) * -.02, z * .1 + Math.max(0, z) * .012); } g.computeVertexNormals(); put(head, g, (v, c) => c.set(0xF2F2EE).lerp(C(0xCBCFC9), Math.max(0, Math.sin(v.x * 260 + v.y * 60)) * .5), 0, HY - .012, 0); }
    for (const s of [-1, 1]) tube(head, [[0, HY - .034, .104], [s * .022, HY - .038, .104], [s * .042, HY - .05, .092]], .011, 0xF6F6F2, .005, 7, 8);
    ell(head, shade(CAP, 0x5E5238, v => (Math.floor(v.x * 160) + Math.floor(v.z * 160)) % 2 ? .35 : 0), 0, HY + .085, .006, .105, .042, .112, 18, 10, -.12, 0, 0);
    ell(head, 0x5E5238, 0, HY + .07, .098, .075, .01, .045, 14, 6, -.1, 0, 0);
    ell(head, 0x5E5238, 0, HY + .122, .02, .012, .008, .012, 6, 4);
    // arms: jumper sleeves with a purple elbow patch; walking stick (right) and pipe (left)
    const A = arms({ sleeve: rib, cuff: JUMPER_SH, sleeveTo: 1 });
    ell(A.left.ua, 0x7A5A8A, -.01, -S.ua * .9, -.03, .03, .035, .018, 8, 6);
    const pipe = group('pipe', 0, -.07, .03, A.left.hd);
    put(pipe, new T.CylinderGeometry(.018, .014, .045, 12), 0x5A3220, 0, .02, .03); tube(pipe, [[0, .0, .03], [0, -.02, -.02], [0, -.02, -.08]], .006, 0x2E221C, .005, 6, 6);
    const stick = group('stick', 0, -.06, .02, A.right.hd);
    tube(stick, [[0, .02, .06], [0, .05, 0], [0, 0, -.03]], .016, 0x7A5436, .016, 8, 8);
    tube(stick, [[0, 0, 0], [0, -.4, .006], [0, -.86, 0]], .015, shade(0x8A6240, 0x6A4A30, v => Math.max(0, Math.sin(v.y * 30)) * .4), .012, 8, 10);
    hold = (J, t) => { const puff = Math.max(0, Math.sin(t * .5)) ** 4;
      J.rightUpperArm.rotation.set(-.12, 0, .1); J.rightLowerArm.rotation.set(-.25, 0, 0); J.rightHand.rotation.set(0, 0, 0);
      J.leftUpperArm.rotation.set(-.45 - .3 * puff, .25, -.22); J.leftLowerArm.rotation.set(-1.9 - .35 * puff, .35, 0); J.leftHand.rotation.set(0, 0, .2);
    };
    cheer.right = false;
  } else if (who === 'girl') {
    const TUNIC = 0x3E9C8C, TUNIC_SH = 0x2F7F72, STRIPE = [0xF2E6C9, 0x5E7F78], HAIR = 0x4E3222;
    legs({ stripes: STRIPE, shoe: 0x5A3A2A });
    lathe(chest, [[S.waist * 1.3, -.12], [S.chest * 1.1, .02], [S.chest * 1.12, .12], [S.sw * .98, SH - .04], [S.sw * .72, SH + .01], [.05, SH + .03]], TUNIC, 0, 0, 0, .82, 24);
    lathe(hips, [[S.waist * 1.25, .1], [S.hipsW * 1.18, 0], [S.hipsW * 1.4, -.14], [S.hipsW * 1.65, -.28], [S.hipsW * 1.68, -.3]].reverse(), shade(TUNIC, TUNIC_SH, v => Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 7)) * .4 * sm(.05, -.1, v.y)), 0, 0, 0, .82, 30, .04, 7);
    lathe(hips, [[S.hipsW * 1.62, -.3], [S.hipsW * 1.66, -.32]], STRIPE[1], 0, 0, 0, .82, 30);
    tube(chest, [[-.02, SH + .03, .07], [0, SH - .02, .085], [.02, SH + .03, .07]], .005, TUNIC_SH, .005, 5, 6);
    // hair: cap with a soft fringe, twin braids with yellow bows
    hairCap(head, shade(HAIR, 0x3A2418, v => Math.max(0, Math.sin(Math.atan2(v.x, v.z) * 16)) * .4), { front: .06, side: .022, back: -.07, y0: HY });
    for (let i = 0; i < 9; i++) { const x = -.048 + i * .012, dz = .006 * Math.cos(x * 30); tube(head, [[x * .7, HY + .1, .062], [x * .95, HY + .085, .088 + dz], [x * 1.05, HY + .064, .094 + dz]], .0085, i % 2 ? HAIR : 0x5E3E2A, .004, 6, 6); }
    for (const s of [-1, 1]) { const pts = []; for (let i = 0; i < 7; i++) pts.push([s * (.082 + i * .005), HY - .01 - i * .028, -.03 - i * .004]);
      for (let i = 0; i < 7; i++) ell(head, i % 2 ? HAIR : 0x5E3E2A, ...pts[i], .02 - i * .0012, .02, .02 - i * .0012, 10, 8);
      const b = pts[6]; ell(head, 0xE9B949, b[0], b[1] - .02, b[2], .012, .01, .012, 8, 6);
      for (const d of [-1, 1]) ell(head, 0xE9B949, b[0] + d * .018, b[1] - .02, b[2] + .004, .016, .008, .006, 8, 5, 0, 0, d * .3); }
    const A = arms({ sleeve: TUNIC, sleeveTo: .3, stripes: STRIPE });
    const pw = group('pinwheel', 0, -.07, .015, A.right.hd);
    tube(pw, [[0, -.06, 0], [0, .32, 0]], .006, 0xC8894A, .006, 6, 6);
    const vanes = group('prop', 0, .32, .02, pw); vanes.scale.setScalar(1.45);
    for (const [i, col] of [0xD96956, 0xE9B949, 0x3E9C8C, 0x8FB86A, 0xB85C8A, 0x6FA8D6].entries()) {
      const g = new T.BufferGeometry(), a = i / 6 * Math.PI * 2; const pts = [[0, 0, 0], [Math.cos(a) * .085, Math.sin(a) * .085, .004], [Math.cos(a + .5) * .07, Math.sin(a + .5) * .07, .018]];
      g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3)); g.setIndex([0, 1, 2, 0, 2, 1]); g.computeVertexNormals(); put(vanes, g, col);
    }
    ell(vanes, 0xB8733F, 0, 0, .02, .012, .012, .012, 8, 6);
    hold = (J, t) => { const w = Math.sin(t * 1.6); // pinwheel held up high, waved a little
      J.rightUpperArm.rotation.set(-.35 - .05 * w, 0, 2.75 + .06 * w); J.rightLowerArm.rotation.set(-.15, 0, -.45); J.rightHand.rotation.set(0, 0, -.2);
    };
    cheer.right = false;
  } else { // seller
    const SHIRT = 0x7FA878, SHIRT_SH = 0x5E8A5A, VEST = 0x6E4A33, TROUSER = 0x4E5A44, HAIR = 0x221610;
    legs({ trouser: TROUSER, shoe: 0x4A3226, rolled: 0x4A5A44 });
    lathe(hips, [[S.hipsW * 1.02, -.1], [S.hipsW * 1.06, -.02], [S.hipsW * .98, .03]], TROUSER, 0, 0, 0, .82, 20);
    lathe(chest, [[S.hipsW * 1.02, -.13], [S.waist * 1.2, -.02], [S.chest * 1.08, .12], [S.chest * 1.1, .22], [S.sw * 1.02, SH - .05], [S.sw * .78, SH + .01], [.066, SH + .04]], shade(SHIRT, SHIRT_SH, v => Math.max(0, Math.sin(v.x * 60 + v.y * 20)) * .25), 0, 0, 0, .8, 26);
    lathe(chest, [[S.hipsW * 1.1, -.12], [S.waist * 1.3, -.02], [S.chest * 1.15, .12], [S.chest * 1.16, .2], [S.sw * 1.06, SH - .06], [S.sw * .82, SH - .01], [.1, SH + .01]], (v, c) => c.set(VEST).lerp(C(0x563826), Math.max(0, Math.sin(v.y * 70)) * .2), 0, 0, 0, .83, 28, 0, 9, .42);   // open at the front
    for (const s of [-1, 1]) tube(chest, [[s * .02, SH + .035, .06], [s * .055, SH + .005, .1], [s * .07, SH + .012, .07]], .014, SHIRT_SH, .007, 6, 6);
    for (let i = 0; i < 3; i++) ell(chest, 0x2A1E1C, 0, SH - .05 - i * .035, S.chest * .88, .004, .004, .003, 5, 4);
    tube(chest, [[-S.sw * .8, SH, .02], [-.02, .12, S.chest * 1.02], [S.sw * .95, -.1, .05]], .012, 0x5A3E2A, .012, 6, 12);   // satchel strap
    slab(hips, 0x7A6040, S.hipsW * 1.25, -.08, .02, .08, .2, .22, 4); slab(hips, 0x6A5236, S.hipsW * 1.32, -.02, .02, .03, .1, .23, 4);
    // short curly hair
    hairCap(head, HAIR, { front: .06, side: .02, back: -.055, y0: HY });
    for (let i = 0; i < 90; i++) { const a = i * 2.39996, e = .1 + .78 * Math.sqrt((i + .5) / 90), x = Math.cos(a) * Math.sin(e * 1.35), z = Math.sin(a) * Math.sin(e * 1.35), y = Math.cos(e * 1.35); if (z > .3 && y < .72) continue;
      ell(head, i % 3 ? 0x2E2018 : 0x1A100A, x * .1, HY + .012 + y * .122, z * .106, .018, .016, .018, 8, 6); }
    const A = arms({ sleeve: SHIRT, cuff: SHIRT_SH, sleeveTo: .5, rolledAt: .0 });
    // fruit crate carried in both hands at the waist
    const crate = group('crate', 0, -.02, .26, chest);
    const wood = (v, c) => c.set(0xA8784A).lerp(C(0x7A5230), Math.abs(Math.sin(v.x * 50 + v.z * 20)) > .9 ? .45 : 0);
    for (const [w, h, d, x, y, z] of [[.46, .025, .28, 0, -.1, 0], [.46, .1, .02, 0, -.05, .135], [.46, .1, .02, 0, -.05, -.135], [.02, .1, .28, .22, -.05, 0], [.02, .1, .28, -.22, -.05, 0]]) slab(crate, wood, x, y, z, w, h, d, 7);
    const fruit = [0xC8443A, 0x9CC25A, 0xE9B949, 0x6E4A8A, 0xD2553F, 0xA6C46A, 0xC8443A, 0x4A3A7A, 0xE0A040];
    for (let i = 0; i < 14; i++) { const r = i % 9 === 3 || i % 9 === 7 ? .02 : .036; ell(crate, fruit[i % 9], -.17 + (i % 7) * .056, -.035 + (i % 2) * .012 + (r < .03 ? .02 : 0), -.07 + Math.floor(i / 7) * .14 + (i % 3) * .01, r, r * .95, r, 10, 8); }
    hold = (J, t) => { const hitch = Math.max(0, Math.sin(t * .5)) ** 6;
      for (const s of [-1, 1]) { const side = s < 0 ? 'left' : 'right'; J[side + 'UpperArm'].rotation.set(-.32 + .06 * hitch, 0, s * .1); J[side + 'LowerArm'].rotation.set(-1.25 - .08 * hitch, s * .15, 0); J[side + 'Hand'].rotation.set(0, s * .3, s * .15); }
      // the crate sits between the hands (hands hold its side walls)
      const a = new T.Vector3(0, -.05, .02), b = new T.Vector3(0, -.05, .02); J.leftHand.localToWorld(a); J.rightHand.localToWorld(b); J.chest.worldToLocal(a); J.chest.worldToLocal(b);
      J.crate.position.copy(a.add(b).multiplyScalar(.5)).add(new T.Vector3(0, .02, -.02));
    };
    cheer.left = cheer.right = false;
  }

  // ---------------- merge one mesh per pivot ----------------
  for (const [pivot, list] of parts) {
    const pos = [], nor = [], col = [], glow = [], c = new T.Color(), v = new T.Vector3();
    for (const [geo, cl, m] of list) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); const pre = g.attributes.color; g.applyMatrix4(m);
      const p = g.attributes.position; pos.push(...p.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < p.count; i++) glow.push(skin.has(geo) ? 1 : 0);
      for (let i = 0; i < p.count; i++) { if (cl === null && pre) c.setRGB(pre.getX(i), pre.getY(i), pre.getZ(i)); else if (typeof cl === 'function') { v.fromBufferAttribute(p, i); cl(v, c); } else c.set(cl); col.push(c.r, c.g, c.b); } g.dispose(); geo.dispose?.(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const lit = glow.some(x => x > 0); if (lit) g.setAttribute('skinGlow', new T.Float32BufferAttribute(glow, 1));
    const o = new T.Mesh(g, lit ? skinPaint : paint); o.castShadow = true; o.receiveShadow = pivot !== head && pivot !== joints.eyes; o.name = pivot.name + '-mesh';
    if (/Hand|pinwheel|prop|pipe|stick|eyes/.test(pivot.name)) o.userData.noOutline = true;
    pivot.add(o);
  }
  // props that stay upright in the world whatever the hand does (walking stick, pinwheel)
  const upright = (g, twist = 0) => { if (!g?.parent) return; g.parent.updateWorldMatrix(true, false); const pq = g.parent.getWorldQuaternion(new T.Quaternion()).invert(), rq = root.getWorldQuaternion(new T.Quaternion()); g.quaternion.copy(pq.multiply(rq).multiply(new T.Quaternion().setFromEuler(new T.Euler(0, twist, 0)))); };
  // ---------------- acting ----------------
  const J = joints, rest = new Map(); for (const [k, j] of Object.entries(J)) rest.set(k, j.quaternion.clone());
  let lastT = null; const W = { worry: 0, cheer: 0, wave: 0, look: 0 }, qa = new T.Quaternion(), qb = new T.Quaternion(), eu = new T.Euler();
  const ease = (k, target, dt, rate = 4) => (W[k] += (target - W[k]) * (1 - Math.exp(-dt * rate)));
  // Acts are soft weights eased over time (never popped): worry (0..1, continuous from the host), cheer, wave.
  function setPose({ t = 0, act = 'idle', worry = act === 'worried' ? 1 : 0, yaw = 0, pitch = 0, look = 0, gentle = false, motion = null } = {}) {
    const dt = lastT === null ? 0 : Math.max(0, Math.min(.1, t - lastT)); lastT = t;
    if (motion) { motion(dt); for (const k of ['leftUpperLeg', 'rightUpperLeg']) J[k].quaternion.slerp(rest.get(k), .45); } else for (const [k, q] of rest) J[k].quaternion.copy(q);
    hold?.(J, t);
    const m = gentle ? .5 : 1, wW = ease('worry', worry, dt, 2.5), wC = ease('cheer', act === 'cheer' ? 1 : 0, dt, 5), wV = ease('wave', act === 'wave' ? 1 : 0, dt, 5), arm = Math.min(1, wC + wV);
    J.head.rotation.x -= .4 * wW; J.chest.rotation.x -= .06 * wW;                                     // looking up at the silent bells
    const b = Math.abs(Math.sin(t * 7)), side = cheer.left ? 'left' : cheer.right ? 'right' : null;
    if (side && arm > .001) { const s = side === 'left' ? -1 : 1;
      qa.setFromEuler(eu.set(0, 0, s * (2.5 + .15 * b * m * wC))); J[side + 'UpperArm'].quaternion.slerp(qa, arm);
      qb.setFromEuler(eu.set(0, 0, s * (.3 + .35 * Math.sin(t * 9)) * wV / Math.max(arm, .001))); J[side + 'LowerArm'].quaternion.slerp(qb, arm); }
    J.head.rotation.x -= .25 * wC; J.hips.position.y += .025 * b * m * wC;
    const lk = ease('look', look * (1 - .7 * wC), dt, 3);
    J.neck.rotation.set(-pitch * lk * .4 + (S.child ? -.12 : who === 'elder' ? -.06 : 0), yaw * lk * .4, 0);
    J.head.rotation.x += -pitch * lk * .6; J.head.rotation.y += yaw * lk * .6;
    upright(J.stick); upright(J.pinwheel, .5); upright(J.basketHang);
    const bl = (t + (who.length * .7)) % 4.3; J.eyes.scale.y = bl > 4.12 ? 1 - .9 * Math.sin((bl - 4.12) / .18 * Math.PI) : 1;
    if (J.prop) J.prop.rotation.z = -t * (gentle ? 3 : 7);
    root.updateMatrixWorld(true);
  }
  root.userData.setPose = setPose; root.userData.who = who; root.userData.restPose = () => { for (const [k, q] of rest) J[k].quaternion.copy(q); J.hips.position.set(0, S.hip, 0); };
  setPose({ t: 0 });
  // feet on the ground (rest pose)
  const box = new T.Box3(), vv = new T.Vector3(); root.updateMatrixWorld(true);
  root.traverse(n => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(vv.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  rig.position.set(0, -box.min.y, 0); root.userData.height = box.max.y - box.min.y;
  return root;
}
