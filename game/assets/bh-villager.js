// Bellhollow villager: seeded variation (age, build, skin, hair, clothes from the style-lock palette, hats,
// scarves, aprons, baskets, tools) in the hero/Mara style, cel-friendly, no textures.
// Budget: <= 9k tris; 4 meshes (body, head, left arm, right arm) + a pinwheel for the child. Arms are marked
// userData.noOutline so the ink pass adds hulls only for body + head (<= 6 draws each incl. outlines).
//   opts: {seed, role: 'sweeper'|'sitter'|'chat'|'worried'|'child'|'keeper'|'elder'}
// Rig pivots (userData.joints): body, head, leftArm, rightArm, prop (pinwheel spinner, child only).
// userData.setPose({t, act, yaw, pitch, look = 0..1, gentle}) act: idle|sweep|sit|chat|worried|cheer|wave|keeper|pinwheel
export default function (THREE, opts = {}) {
  const T = THREE, role = opts.role || 'chat';
  let seed = (opts.seed ?? 1) * 9301 + 49297; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = a => a[Math.floor(rnd() * a.length) % a.length];
  const C = h => new T.Color(h);
  const child = role === 'child', elder = role === 'elder' || (role === 'sitter' && rnd() < .7) || (role === 'worried' && rnd() < .4);
  const H = child ? 1.08 : elder ? 1.5 : 1.55 + rnd() * .15, stout = child ? .9 : .85 + rnd() * .35, fem = rnd() < .5;
  const SKIN = pick([0xE3AC86, 0xC98D66, 0x9C6A4A, 0xEDC29E]);
  const HAIR = elder ? pick([0xD9DAD5, 0xB9BDB8]) : pick([0x3B2A22, 0x5A3A26, 0x8A5A32, 0x2A2222, 0xB07A3E]);
  const PAL = [0xC8894A, 0x7A4E33, 0x3E9C8C, 0x2C4A45, 0x5E8F4E, 0xA6C46A, 0xF2E6C9, 0xCDBB95, 0xB8733F];
  const TOP = role === 'keeper' ? pick([0x3E9C8C, 0x5E8F4E, 0xF2E6C9]) : pick([0xF2E6C9, 0xC8894A, 0x3E9C8C, 0x5E8F4E, 0xCDBB95, 0xA6C46A]), BOTTOM = pick([0x7A4E33, 0x2C4A45, 0x5E8F4E, 0x3E9C8C, 0xB8733F]);
  const ACC = pick(PAL.filter(c => c !== TOP && c !== BOTTOM)), dress = fem && !child ? rnd() < .7 : false;
  const accessory = role === 'keeper' || role === 'sweeper' ? 'apron' : pick(['hat', 'scarf', 'none', 'cap', fem ? 'kerchief' : 'hat']);
  const headwear = role === 'keeper' ? 'cap' : null;
  const hairStyle = elder && !fem ? pick(['bald', 'short']) : fem ? pick(['bun', 'long', 'braid']) : pick(['short', 'tuft']);
  const beard = !fem && !child && rnd() < (elder ? .7 : .25);
  const root = new T.Group(); root.name = 'bh-villager'; const rig = new T.Group(); root.add(rig);
  const paint = Object.assign(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .85 }), { name: 'fabric' });
  const joints = {}; root.userData.joints = joints;
  const group = (name, x, y, z, parent = rig) => { const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); joints[name] = g; return g; };
  const parts = new Map(); // pivot -> [geo, color, matrix]
  const E = new T.Euler(), Q = new T.Quaternion();
  const put = (pivot, geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { if (!parts.has(pivot)) parts.set(pivot, []); parts.get(pivot).push([geo, hex, new T.Matrix4().compose(new T.Vector3(x, y, z), Q.clone().setFromEuler(E.set(rx, ry, rz)), new T.Vector3(sx, sy, sz))]); };
  const ell = (pv, hex, x, y, z, a, b, c, ws = 12, hs = 9) => put(pv, new T.SphereGeometry(1, ws, hs), hex, x, y, z, 0, 0, 0, a, b, c);
  const lathe = (pv, prof, hex, x = 0, y = 0, z = 0, depth = 1, segs = 16) => put(pv, new T.LatheGeometry(prof.map(([r, h]) => new T.Vector2(r, h)), segs), hex, x, y, z, 0, 0, 0, 1, 1, depth);
  const tube = (pv, pts, r0, hex, r1 = r0, radial = 7) => { const c = new T.CatmullRomCurve3(pts.map(v => new T.Vector3(...v))), n = Math.max(3, pts.length * 2), g = new T.TubeGeometry(c, n, 1, radial, false), a = g.attributes.position, v = new T.Vector3(), q = new T.Vector3();
    for (let i = 0; i <= n; i++) { c.getPointAt(i / n, q); const r = r0 + (r1 - r0) * i / n; for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(a, k).sub(q).normalize().multiplyScalar(r).add(q); a.setXYZ(k, v.x, v.y, v.z); } } g.computeVertexNormals(); put(pv, g, hex); };
  // proportions in metres for a 1.6 m adult, scaled at the end
  const W = .9 + .25 * (stout - .85), hipY = child ? .5 : .82, shoulderY = child ? .82 : 1.3, headY = child ? 1.02 : 1.49, sit = role === 'sitter';
  const body = group('body', 0, 0, 0);
  // ---- legs & shoes (baked into the body; sitters bend at hip and knee) ----
  for (const s of [-1, 1]) {
    const lx = s * .085 * W;
    if (sit) { tube(body, [[lx, .47, .02], [lx, .47, .2], [lx, .47, .36]], .065 * W, BOTTOM, .058 * W); tube(body, [[lx, .47, .36], [lx, .25, .38], [lx, .07, .38]], .052, BOTTOM, .045); ell(body, 0x4A3226, lx, .04, .42, .055, .045, .09); }
    else { tube(body, [[lx, hipY, 0], [lx, hipY * .5, .01], [lx, .08, 0]], (dress ? .045 : .066) * W, dress ? 0xCDBB95 : BOTTOM, dress ? .04 : .052); ell(body, 0x4A3226, lx, .045, .035, .058, .05, .1); }
  }
  // ---- torso: tunic or dress, belt, apron ----
  const y0 = sit ? .45 : hipY - .02, top = shoulderY - (sit ? hipY - .45 : 0);
  if (dress && !sit) lathe(body, [[.2 * W, .12], [.245 * W, .3], [.21 * W, hipY], [.19 * W, hipY + .12], [.2 * W, top - .1], [.15 * W, top], [.06, top + .06]], TOP, 0, 0, 0, .78, 18);
  else {
    lathe(body, [[.17 * W, y0 - .02], [.2 * W, y0 + .06], [.18 * W, y0 + .16], [.2 * W, (y0 + top) / 2 + .06], [.205 * W, top - .12], [.19 * W, top - .05], [.13 * W, top + .01], [.06, top + .05]], TOP, 0, 0, 0, .74, 18);
    lathe(body, [[.19 * W, y0 - .02], [.205 * W, y0 - .1], [.2 * W, y0 - .14]], TOP, 0, 0, 0, .76, 16);   // tunic skirt
    if (!dress) lathe(body, [[.18 * W, y0 - .1], [.2 * W, y0 - .02], [.185 * W, y0 + .04]], BOTTOM, 0, 0, 0, .76, 16);
  }
  const beltY = (dress && !sit ? hipY + .1 : y0 + .06);
  lathe(body, [[.19 * W, beltY - .025], [.197 * W, beltY], [.19 * W, beltY + .025]], 0x7A4E33, 0, 0, 0, .78, 16);
  if (accessory === 'apron') { const g = new T.CylinderGeometry(1, 1, 1, 10, 2, true, -.8, 1.6), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) + .5, a = Math.atan2(p.getX(i), p.getZ(i)), r = .215 * W - .03 * t; p.setXYZ(i, Math.sin(a) * r, beltY - .45 + t * .45 + (sit ? .3 : 0), Math.cos(a) * r * .82 + .01); } g.computeVertexNormals(); put(body, g, TOP === 0xF2E6C9 ? 0x2C4A45 : 0xF2E6C9); }
  if (accessory === 'scarf' || accessory === 'kerchief') tube(body, [[-.08, top + .02, -.02], [0, top - .01, .1], [.08, top + .02, -.02], [0, top + .03, -.07], [-.08, top + .02, -.02]], .025, ACC);
  ell(body, SKIN, 0, top + .05, 0, .05, .06, .05, 8, 6);                                                         // neck
  put(body, new T.TorusGeometry(.07, .018, 6, 16), accessory === 'scarf' ? ACC : 0xF2E6C9, 0, top + .02, 0, Math.PI / 2, 0, 0, 1, .8, 1);   // collar
  for (const s of [-1, 1]) ell(body, TOP, s * .16 * W, top - .04, 0, .075 * W, .06, .07, 10, 7);                  // shoulders
  // ---- arms (own pivots; no ink hull) ----
  for (const s of [-1, 1]) {
    const arm = group(s < 0 ? 'leftArm' : 'rightArm', s * .2 * W, top - .04, 0);
    const len = child ? .36 : .58;
    tube(arm, [[0, 0, 0], [s * .02, -len * .45, .01], [s * .015, -len * .82, .03]], .058 * W, TOP, .045);
    put(arm, new T.TorusGeometry(.046, .014, 5, 12), 0xF2E6C9, s * .015, -len * .82, .03, Math.PI / 2, 0, 0);   // cuff
    tube(arm, [[s * .015, -len * .82, .03], [s * .013, -len * .9, .035]], .036, SKIN, .034, 6);
    ell(arm, SKIN, s * .012, -len * .97, .035, .05, .062, .04, 8, 6);   // hands a touch large for readability
    ell(arm, SKIN, s * -.026, -len * .93, .055, .016, .024, .016, 6, 4);                                          // thumb
    // props held in the right hand
    if (s > 0) {
      const hy = -len * .95;
      if (role === 'sweeper') { tube(arm, [[.02, hy + .5, .06], [.02, hy - .55, .1]], .012, 0xC8894A); lathe(arm, [[.02, 0], [.08, -.1], [.1, -.22], [.02, -.2]], 0xCDBB95, .02, hy - .5, .1, .5, 10); }
      if (role === 'keeper') { lathe(arm, [[.001, -.07], [.07, -.07], [.1, .02], [.09, .03]], 0xC8894A, .02, hy - .02, .12, 1, 12); put(arm, new T.TorusGeometry(.07, .008, 5, 14, Math.PI), 0x7A4E33, .02, hy + .02, .12); for (let i = 0; i < 3; i++) ell(arm, i ? 0xA6C46A : 0xE9B949, .0 + i * .03 - .03, hy + .02, .12 + (i - 1) * .02, .03, .03, .03, 8, 6); }
      if (role === 'chat' && rnd() < .5) lathe(arm, [[.001, -.05], [.03, -.05], [.034, .03], [.03, .035]], 0xF2E6C9, .015, hy + .02, .06, 1, 10);
      if (child) { tube(arm, [[.015, hy, .04], [.015, hy + .32, .04]], .008, 0x7A4E33); const pw = group('prop', .015, hy + .33, .07, arm); for (let i = 0; i < 4; i++) { const g = new T.ConeGeometry(.055, .09, 3); g.rotateX(Math.PI / 2); g.translate(0, .045, 0); put(pw, g, i % 2 ? 0xE9B949 : 0x3E9C8C, 0, 0, 0, 0, 0, i * Math.PI / 2); } ell(pw, 0xB8733F, 0, 0, .01, .012, .012, .012, 6, 4); }
    }
  }
  // ---- head: sculpted sphere with painted face (eyes, catchlights, brows, smile, blush) ----
  const head = group('head', 0, headY - (sit ? hipY - .45 : 0), 0);
  const hr = child ? .155 : .138;   // slightly large heads read at the gameplay camera
  {
    const g = new T.SphereGeometry(1, 20, 16), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
    const G = (dx, dy, sx, sy) => Math.exp(-((dx / sx) ** 2) - ((dy / sy) ** 2));
    for (let i = 0; i < p.count; i++) { const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i), f = Math.max(0, uz);
      const x = ux * hr * .92, y = uy * hr * 1.08, z = uz * hr + f * hr * (.18 * G(ux, uy + .18, .16, .22) + .06 * G(Math.abs(ux) - .45, uy + .25, .25, .2));
      p.setXYZ(i, x, y, z); c.set(SKIN); c.lerp(C(0xE58F7A), f * .5 * G(Math.abs(ux) - .45, uy + .25, .2, .15)); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals(); put(head, g, null);
  }
  for (const s of [-1, 1]) {
    ell(head, 0xF6EFE2, s * hr * .36, hr * .05, hr * .9, hr * .16, hr * .15, hr * .05, 10, 7);                   // eye whites
    ell(head, 0x2A1E1C, s * hr * .36, hr * .03, hr * .95, hr * .1, hr * .12, hr * .04, 8, 6);                    // iris
    ell(head, 0xFFFFFF, s * hr * .36 - hr * .035, hr * .09, hr * .99, hr * .04, hr * .04, hr * .02, 5, 4);         // catchlight
    tube(head, [[s * hr * .2, hr * .28, hr * .92], [s * hr * .38, hr * .34, hr * .9], [s * hr * .55, hr * .28, hr * .82]], hr * .055, elder ? 0x9A9F9A : 0x3A2A22, hr * .03, 4);   // brows (bold, readable)
    ell(head, SKIN, s * hr * .92, 0, 0, hr * .15, hr * .25, hr * .12, 6, 5);                                   // ears
  }
  { const pts = []; for (let i = 0; i <= 6; i++) { const x = (-1 + i / 3) * hr * .28; pts.push([x, -hr * .42 + (x / hr) ** 2 * hr * 1.4, hr * .9 - (x / hr) ** 2 * hr * .5]); } tube(head, pts, hr * .045, 0x6A3028, hr * .045, 4); }   // smile
  // hair
  const cap = (thetaLen, extra = 0) => { const g = new T.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * thetaLen), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), f = Math.max(0, z) ** 2; p.setXYZ(i, p.getX(i) * hr * 1.02, p.getY(i) * hr * 1.1 + f * hr * .35 + hr * .06, p.getZ(i) * hr * 1.04 - hr * .02 * (1 - f) - extra); } g.computeVertexNormals(); put(head, g, HAIR); };
  if (hairStyle !== 'bald') cap(hairStyle === 'long' || hairStyle === 'braid' ? .62 : .5);
  else { const g = new T.TorusGeometry(hr * .8, hr * .16, 5, 14, Math.PI * 1.2); put(head, g, HAIR, 0, -hr * .05, -hr * .15, Math.PI / 2, 0, Math.PI * -.1); }
  if (hairStyle === 'bun') ell(head, HAIR, 0, hr * .75, -hr * .6, hr * .38, hr * .34, hr * .36, 10, 8);
  if (hairStyle === 'long') lathe(head, [[hr * .95, -hr * .1], [hr * .9, -hr * 1.1], [hr * .6, -hr * 1.25]], HAIR, 0, 0, -hr * .15, .8, 12);
  if (hairStyle === 'braid') for (const s of [-1, 1]) tube(head, [[s * hr * .8, -hr * .2, -hr * .2], [s * hr * .9, -hr * .9, 0], [s * hr * .8, -hr * 1.35, .02]], hr * .14, HAIR, hr * .08, 5);
  if (hairStyle === 'tuft') for (let i = 0; i < 3; i++) ell(head, HAIR, (i - 1) * hr * .35, hr * 1.05, hr * .35, hr * .25, hr * .18, hr * .3, 6, 5);
  if (beard) lathe(head, [[hr * .7, -hr * .15], [hr * .75, -hr * .55], [hr * .4, -hr * 1.05], [.001, -hr * 1.12]], HAIR, 0, 0, hr * .15, .75, 12);
  // hats & headwear
  if (accessory === 'hat') { lathe(head, [[hr * 2.1, 0], [hr * 2.05, hr * .08], [hr * 1.05, hr * .12], [hr * .95, hr * .7], [.001, hr * .8]], pick([0xE9C98F, 0xC8894A, 0xCDBB95]), 0, hr * .72, 0, 1, 18); lathe(head, [[hr * 1.0, hr * .12], [hr * 1.0, hr * .3]], ACC, 0, hr * .72, 0, 1, 16); }
  if (accessory === 'cap' || headwear === 'cap') { const CAPC = headwear ? 0x7A4E33 : ACC; ell(head, CAPC, 0, hr * .78, -hr * .02, hr * 1.05, hr * .45, hr * 1.05, 12, 6); ell(head, CAPC, 0, hr * .62, hr * .9, hr * .6, hr * .07, hr * .45, 8, 4); }
  if (accessory === 'kerchief') { const g = new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * .55); put(head, g, ACC, 0, hr * .12, -hr * .05, 0, 0, 0, hr * 1.1, hr * 1.12, hr * 1.1); ell(head, ACC, 0, -hr * .3, -hr * 1.05, hr * .25, hr * .3, hr * .15, 6, 5); }
  // ---- merge per pivot: one mesh per pivot, vertex coloured ----
  for (const [pivot, list] of parts) {
    const pos = [], nor = [], col = [], c = new T.Color();
    for (const [geo, hex, m] of list) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); const cc = g.attributes.color;
      for (let i = 0; i < g.attributes.position.count; i++) { if (hex === null && cc) col.push(cc.getX(i), cc.getY(i), cc.getZ(i)); else { c.set(hex ?? 0xffffff); col.push(c.r, c.g, c.b); } } g.dispose(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    const o = new T.Mesh(g, paint); o.castShadow = o.receiveShadow = true; o.name = pivot.name + '-mesh';
    if (/Arm|prop/.test(pivot.name)) o.userData.noOutline = true; pivot.add(o);
  }
  // ---- acting ----
  const J = joints, baseHeadY = J.head.position.y;
  function setPose({ t = 0, act = 'idle', yaw = 0, pitch = 0, look = 0, gentle = false } = {}) {
    const m = gentle ? .5 : 1, br = Math.sin(t * 1.6 + (opts.seed || 0)), sway = Math.sin(t * .5 + (opts.seed || 0) * 1.7);
    // Each act cycles through three sub-poses (~2.8 s each, blended), so no villager holds one frozen pose.
    const pose = (act, v, t) => { // -> [bodyX, lift, hx, hy, aL, aR]
      const S = Math.sin, sd = opts.seed || 0;
      if (act === 'sweep') { const k = S(t * 3.2); return [[.18 + .04 * k, 0, .2, 0, [-.9 + .3 * k, -.3, -.1], [-.75 + .3 * k, .2, .25]], [.02, 0, -.15, .5 * S(t * .8), [-.25, 0, -.12], [-.55, 0, .15]], [.05, 0, -.3, -.3, [-.3, 0, -.1], [-.6, .1, .25]]][v]; }   // stroke / lean on the broom, look around / look up
      if (act === 'chat') { const g = Math.max(0, S(t * 1.6 + sd)); return [[0, 0, -.05 * S(t * 2.3) * g, .1 * S(t * .7), [-.1, 0, -.12], [-.6 * g - .1, 0, .2 + .3 * g]], [0, 0, .1, 0, [-.1, 0, -.12], [-1.7, .35, .45]], [-.04, .02 * Math.abs(S(t * 6)), -.15, 0, [-.35, 0, -.25], [-.35, 0, .25]]][v]; }   // gesture / sip the cup / laugh
      if (act === 'worried') return [[-.05, 0, -.55, 0, [-1.2, -.5, -.35], [-1.2, .5, .35]], [-.05, 0, -.5, .2, [-.1, 0, -.12], [-1.4, 0, .9]], [.05, 0, -.1, -.35 * S(t * .6), [-1.3, -.4, -.6], [-.2, 0, .12]]][v];   // clasp / point at the bell / hand to cheek
      if (act === 'keeper') return [[.05, 0, .1, 0, [-.5 - .3 * Math.max(0, S(t * .9)), 0, -.15], [-.9, 0, .1]], [0, 0, -.1, .45 * S(t * .5), [-.2, 0, -.12], [-1.1, 0, .35]], [.12, 0, .25, 0, [-.8, -.2, -.1], [-.8, .2, .1]]][v];   // arrange / offer the basket / straighten goods
      if (act === 'pinwheel') return [[0, 0, -.35, 0, [-.1, 0, -.15], [-2.3 + .15 * S(t * 2), 0, .15]], [0, .05 * Math.abs(S(t * 5)), -.2, .3 * S(t * 1.5), [-.3, 0, -.4], [-1.6, 0, .6 + .3 * S(t * 3)]], [0, 0, .15, 0, [-.2, 0, -.15], [-.9, 0, .2]]][v];   // hold up / run it round / look at it
      if (act === 'sit') return [[0, 0, .05, 0, [-.5, 0, -.1], [-.5, 0, .1]], [-.08, 0, -.1, .4 * S(t * .5), [-.5, 0, -.1], [-.5, 0, .1]], [-.12, 0, -.3, 0, [-2.4, 0, -.3], [-2.4, 0, .3]]][v];   // hands on knees / look round / stretch
      if (act === 'cheer') { const b = Math.abs(S(t * 7)); return [0, .08 * b, -.25, 0, [0, 0, -2.6 - .2 * b], [0, 0, 2.6 + .2 * b]]; }
      if (act === 'wave') return [0, 0, -.1, 0, [-.05, 0, -.12], [0, 0, 2.5 + .35 * S(t * 9)]];
      return [[0, 0, 0, 0, [-.05, 0, -.12], [-.05, 0, .12]], [0, 0, -.05, .45 * S(t * .6), [-.05, 0, -.2], [-.05, 0, .2]], [.03, 0, .1, 0, [-.9, .6, -.6], [-.9, -.6, .6]]][v];   // stand / look round / arms crossed
    };
    const cyc = (t + (opts.seed || 0) * 1.37) / 2.8, vi = Math.floor(cyc) % 3, fb = Math.min(1, (cyc % 1) / .22), bl = fb * fb * (3 - 2 * fb);
    const P1 = pose(act, vi, t), P0 = pose(act, (vi + 2) % 3, t), mix = (a, b) => Array.isArray(a) ? a.map((x, i) => mix(x, b[i])) : b + (a - b) * bl;
    const [bx, lf, hxx, hyy, aLL, aRR] = act === 'cheer' || act === 'wave' ? P1 : mix(P1, P0);
    let bodyX = bx, bodyZ = .015 * sway * m, lift = lf * m, hx = hxx, hy = hyy, aL = aLL, aR = aRR;
    J.body.rotation.set(bodyX * m + .01 * br, 0, bodyZ); J.body.position.y = lift;
    J.leftArm.rotation.set(aL[0] + .02 * br, aL[1], aL[2]); J.rightArm.rotation.set(aR[0] + .02 * br, aR[1], aR[2]);
    J.leftArm.position.y = J.rightArm.position.y = (top - .04) + lift; J.leftArm.position.z = J.rightArm.position.z = 0;
    J.head.position.y = baseHeadY + lift;
    J.head.rotation.set((hx * (1 - look) - pitch * look) * m - .02 * br, (hy * (1 - look) + yaw * look), .04 * sway * m);
    if (J.prop) J.prop.rotation.z = -t * (gentle ? 3 : 8);
    root.updateMatrixWorld(true);
  }
  root.userData.setPose = setPose; root.userData.role = role; root.userData.traits = { H, fem, elder, child, hairStyle, accessory };
  setPose({ act: sit ? 'sit' : 'idle' });
  // scale to height; base at y=0, centred
  const box = new T.Box3(), v = new T.Vector3(); root.updateMatrixWorld(true);
  root.traverse(n => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const k = (sit ? H * .72 : H) / (box.max.y - box.min.y), c = box.getCenter(new T.Vector3());
  rig.scale.setScalar(k); rig.position.set(-c.x * k, -box.min.y * k, sit ? 0 : -c.z * k);
  return root;
}
