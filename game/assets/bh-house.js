// Bellhollow house kit. One module, several families chosen by opts.type:
//   'small'    4 x 4 m cottage, one storey + steep gable, timber frame, flower boxes
//   'tall'     4 x 5 m two storeys, jettied upper floor, front balcony, dormer
//   'tower'    round stone house, bell-flared conical roof, copper finial
//   'workshop' Mara's workshop: wide, big doors, copper pipes, side wind wheel, awning
// opts.seed varies proportions, roof colour, lean and dressing so no two match.
// Palette and sizes: STYLE-LOCK-V2.md. Base y = 0, centred on x/z, front (door) faces +Z.
export default function (THREE, opts = {}) {
  const type = opts.type || 'small';
  let s = (opts.seed ?? 7) >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const R = (a, b) => a + (b - a) * rnd();
  const M = (color, name, rough = .9, metal = 0) => Object.assign(new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal}), {name});
  const mat = {
    plaster: M(0xF2E6C9, 'plaster'), stone: M(0xCDBB95, 'stone'), stoneLight: M(0xF2E6C9, 'stone'),
    timber: M(0xC8894A, 'timber', .85), dark: M(0x7A4E33, 'timber', .88), verd: M(0x3E9C8C, 'metal', .5, .3),
    copper: M(0xB8733F, 'metal', .45, .4), cloth: M(0xD96956, 'fabric', .95), glass: M(0xF6D9B0, 'glass', .35),
    leaf: M(0x5E8F4E, 'foliage', .95), leafLight: M(0xA6C46A, 'foliage', .95),
  };
  const roofChoices = [M(0xD96956, 'tile', .8), M(0xB8733F, 'tile', .75), M(0x3E9C8C, 'tile', .78), M(0x7A4E33, 'tile', .82)];
  const rr = rnd(), roofMat = roofChoices[opts.roof ?? (rr < .58 ? 0 : rr < .8 ? 1 : rr < .94 ? 3 : 2)];
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz, 'YXZ'); parent.add(o); return o; };
  const box = (w, h, d, m, x, y, z, ry = 0, parent = g) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, ry, 0, 0, parent);
  // Chamfered block (bevel >= 4% of the smallest dimension).
  const bevel = (w, h, d, m, x, y, z, b = Math.min(w, h, d) * .07, parent = g) => {
    const sh = new THREE.Shape(), hw = w / 2 - b, hh = h / 2 - b, c = b;
    sh.moveTo(-hw + c, -hh); sh.lineTo(hw - c, -hh); sh.lineTo(hw, -hh + c); sh.lineTo(hw, hh - c); sh.lineTo(hw - c, hh); sh.lineTo(-hw + c, hh); sh.lineTo(-hw, hh - c); sh.lineTo(-hw, -hh + c); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, {depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1});
    geo.translate(0, 0, -(d - 2 * b) / 2);
    return add(geo, m, x, y, z, 0, 0, 0, parent);
  };
  const beamAB = (a, b, w, m, parent = g) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
    const o = add(new THREE.BoxGeometry(w, w, L), m, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, 0, 0, 0, parent);
    o.lookAt(B.clone().add(o.parent.position)); o.lookAt(new THREE.Vector3().copy(B)); return o;
  };

  // Window: dark frame, glass, cross mullion, two shutters, sill + optional flower box.
  function windowAt(x, y, z, ry, w = .8, h = 1, flowers = true, parent = g) {
    const wg = new THREE.Group(); wg.position.set(x, y, z); wg.rotation.y = ry; parent.add(wg);
    box(w + .16, h + .16, .1, mat.dark, 0, 0, 0, 0, wg);
    box(w, h, .06, mat.glass, 0, 0, .04, 0, wg);
    box(.06, h, .05, mat.dark, 0, 0, .08, 0, wg); box(w, .06, .05, mat.dark, 0, .08, .08, 0, wg);
    // arched head: half disc
    const arch = add(new THREE.CylinderGeometry(w / 2 + .08, w / 2 + .08, .1, 10, 1, false, -Math.PI / 2, Math.PI), mat.dark, 0, h / 2, 0, 0, Math.PI / 2, 0, wg);
    void arch;
    for (const sd of [-1, 1]) { const sh = box(w / 2, h, .06, sd < 0 ? mat.verd : mat.verd, sd * (w * .75 + .1), 0, .06, 0, wg); sh.rotation.y = sd * .5; }
    box(w + .3, .08, .22, mat.stoneLight, 0, -h / 2 - .1, .1, 0, wg);
    if (flowers) {
      box(w + .1, .2, .24, mat.timber, 0, -h / 2 - .24, .18, 0, wg);
      for (let i = 0; i < 4; i++) add(new THREE.IcosahedronGeometry(.13, 0), i % 2 ? mat.leafLight : mat.leaf, -w / 2 + .12 + i * (w - .24) / 3, -h / 2 - .08, .2, i, 0, 0, wg);
      add(new THREE.IcosahedronGeometry(.07, 0), mat.cloth, -w / 4, -h / 2, .26, 0, 0, 0, wg);
    }
    return wg;
  }
  function doorAt(x, z, ry, w = 1.1, h = 2, parent = g) {
    const dg = new THREE.Group(); dg.position.set(x, 0, z); dg.rotation.y = ry; parent.add(dg);
    box(w + .3, h + .2, .12, mat.stoneLight, 0, h / 2 + .1, 0, 0, dg);
    box(w, h - w / 2, .1, mat.timber, 0, (h - w / 2) / 2, .04, 0, dg);
    add(new THREE.CylinderGeometry(w / 2, w / 2, .1, 12, 1, false, -Math.PI / 2, Math.PI), mat.timber, 0, h - w / 2, .04, 0, Math.PI / 2, 0, dg);
    for (const px of [-w / 4, w / 4]) box(.04, h - .2, .03, mat.dark, px, (h - .2) / 2, .1, 0, dg);
    add(new THREE.TorusGeometry(.07, .018, 4, 10), mat.copper, w * .3, 1, .12, 0, 0, 0, dg);
    box(w + .5, .12, .45, mat.stone, 0, .06, .25, 0, dg); // step
  }
  // Gable roof of tile courses. Ridge along x, width w (x), depth d (z), pitch rise.
  function gableRoof(w, d, y0, rise, over = .35, parent = g) {
    const half = d / 2 + over, slopeLen = Math.hypot(half, rise), ang = Math.atan2(rise, half), rows = Math.max(4, Math.round(slopeLen / .38));
    for (const sd of [-1, 1]) {
      for (let i = 0; i < rows; i++) {
        const f = (i + .5) / rows, zz = sd * half * (1 - f), yy = y0 + rise * f;
        const row = box(w + over * 2, .09, slopeLen / rows + .12, i % 2 ? roofMat : roofMat, 0, yy + .05, zz, 0, parent);
        row.rotation.x = sd * ang; // front slope tilts down towards +z
        if (i === 0) { // scalloped eave: petal tabs (bell/petal motif)
          const n = Math.round((w + over * 2) / .42);
          for (let k = 0; k < n; k++) { const tab = add(new THREE.CylinderGeometry(.19, .19, .09, 8, 1, false, 0, Math.PI), roofMat, -w / 2 - over + (k + .5) * (w + over * 2) / n, yy - .02, zz + sd * (slopeLen / rows) * .55 * Math.cos(ang), 0, 0, 0, parent); tab.rotation.set(sd * ang, sd > 0 ? 0 : Math.PI, 0, 'YXZ'); tab.rotation.y = sd > 0 ? Math.PI / 2 * 0 : Math.PI; }
        }
      }
      // gable-end bargeboards
      for (const ex of [-1, 1]) { const b = box(.14, .14, slopeLen + .1, mat.dark, ex * (w / 2 + over - .05), y0 + rise / 2 + .08, sd * half / 2, 0, parent); b.rotation.x = sd * ang; }
    }
    const ridge = add(new THREE.CylinderGeometry(.12, .12, w + over * 2 + .1, 8), mat.dark, 0, y0 + rise + .1, 0, 0, 0, Math.PI / 2, parent); void ridge;
    // triangular gable walls (plaster) with a timber king post
    const tri = new THREE.Shape(); tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, rise); tri.closePath();
    for (const ex of [-1, 1]) {
      const gw = add(new THREE.ExtrudeGeometry(tri, {depth: .2, bevelEnabled: false}), mat.plaster, ex * (w / 2 - .1) - .1, y0, 0, Math.PI / 2, 0, 0, parent);
      gw.position.x = ex * w / 2 + (ex < 0 ? 0 : -.2);
      box(.1, rise * .8, .1, mat.dark, ex * (w / 2 + .02), y0 + rise * .4, 0, 0, parent);
      const vent = add(new THREE.CircleGeometry(.22, 10), mat.dark, ex * (w / 2 + .03), y0 + rise * .45, 0, ex * Math.PI / 2, 0, 0, parent); void vent;
    }
  }
  function timberFrame(w, d, y0, h, braces = true, parent = g) {
    const t = .16;
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) box(t, h, t, mat.dark, x, y0 + h / 2, z, 0, parent);
    for (const z of [-d / 2, d / 2]) { box(w + t, t, t, mat.dark, 0, y0 + h - t / 2, z, 0, parent); box(w + t, t * .8, t, mat.dark, 0, y0 + .08, z, 0, parent); }
    for (const x of [-w / 2, w / 2]) { box(t, t, d + t, mat.dark, x, y0 + h - t / 2, 0, 0, parent); box(t, t * .8, d + t, mat.dark, x, y0 + .08, 0, 0, parent); }
    if (braces) for (const sd of [-1, 1]) for (const z of [-d / 2 - .01, d / 2 + .01]) { const b = box(t * .8, Math.hypot(w * .3, h * .55), t * .6, mat.dark, sd * w * .36, y0 + h * .35, z, 0, parent); b.rotation.z = sd * Math.atan2(w * .3, h * .55); }
    for (const sd of [-1, 1]) for (const x of [-w / 2 - .01, w / 2 + .01]) { const b = box(t * .6, Math.hypot(d * .3, h * .55), t * .8, mat.dark, x, y0 + h * .35, sd * d * .36, 0, parent); b.rotation.x = -sd * Math.atan2(d * .3, h * .55); }
  }
  function chimney(x, z, top, parent = g) {
    bevel(.6, top, .6, mat.stone, x, top / 2, z, .05, parent);
    box(.75, .14, .75, mat.stoneLight, x, top, z, 0, parent);
    add(new THREE.CylinderGeometry(.16, .2, .4, 8), mat.copper, x, top + .27, z, 0, 0, 0, parent);
    add(new THREE.ConeGeometry(.3, .22, 8), mat.verd, x, top + .6, z, 0, 0, 0, parent);
  }
  function plinth(w, d, h = .45) { bevel(w + .3, h, d + .3, mat.stone, 0, h / 2, 0, .06); }

  if (type === 'small' || type === 'tall') {
    const tall = type === 'tall';
    const w = tall ? R(3.8, 4.3) : R(3.7, 4.4), d = tall ? R(4.7, 5.3) : R(3.7, 4.2);
    const storey = 2.8, walls = tall ? 2 : 1, pl = .45;
    plinth(w, d, pl);
    // ground storey: stone for tall houses, plaster for cottages
    bevel(w, storey, d, tall ? mat.stoneLight : mat.plaster, 0, pl + storey / 2, 0, .08);
    let top = pl + storey;
    if (!tall) timberFrame(w + .04, d + .04, pl, storey, rnd() < .7);
    if (tall) {
      // jettied upper storey on corbels
      const jw = w + .5, jd = d + .4;
      for (let i = 0; i < 5; i++) box(.2, .22, .6, mat.dark, -jw / 2 + .3 + i * (jw - .6) / 4, top + .05, d / 2 + .1, 0);
      bevel(jw, storey, jd, mat.plaster, 0, top + .15 + storey / 2, 0, .08);
      timberFrame(jw + .04, jd + .04, top + .15, storey, true);
      windowAt(-jw * .22, top + 1.55, jd / 2 + .06, 0, .7, .9); windowAt(jw * .22, top + 1.55, jd / 2 + .06, 0, .7, .9);
      windowAt(jw / 2 + .06, top + 1.55, 0, Math.PI / 2, .7, .9, false); windowAt(-jw / 2 - .06, top + 1.55, 0, -Math.PI / 2, .7, .9, false);
      windowAt(0, top + 1.55, -jd / 2 - .06, Math.PI, .7, .9, false);
      // front balcony on the upper floor
      const by = top + .15, bd = .9;
      box(jw * .7, .14, bd, mat.timber, 0, by, jd / 2 + bd / 2);
      for (let i = 0; i <= 6; i++) box(.06, .8, .06, mat.dark, -jw * .35 + i * jw * .7 / 6, by + .45, jd / 2 + bd - .05);
      box(jw * .7 + .1, .08, .1, mat.timber, 0, by + .88, jd / 2 + bd - .05);
      for (const sx of [-1, 1]) { box(.08, .8, bd, mat.dark, sx * jw * .35, by + .45, jd / 2 + bd / 2); const br = box(.1, .9, .1, mat.dark, sx * jw * .3, by - .4, jd / 2 + .45); br.rotation.x = .6; }
      top += .15 + storey;
      gableRoof(jw, jd, top, R(2.1, 2.7));
      // dormer on the front slope
      const dz = jd * .12, dy = top + .75;
      bevel(1.1, 1.1, 1.2, mat.plaster, 0, dy, dz + .4, .05);
      windowAt(0, dy, dz + 1.02, 0, .5, .6, false);
      const tri = new THREE.Shape(); tri.moveTo(-.75, 0); tri.lineTo(.75, 0); tri.lineTo(0, .7); tri.closePath();
      const dg = new THREE.ExtrudeGeometry(tri, {depth: 1.5, bevelEnabled: false}); dg.translate(0, 0, -.75);
      add(dg, roofMat, 0, dy + .55, dz + .4);
      chimney(-jw * .3, -jd * .2, top + 2.4);
      // lamp bracket
      add(new THREE.SphereGeometry(.16, 8, 6), mat.glass, w / 2 - .2, pl + 2.4, d / 2 + .45);
      box(.06, .06, .5, mat.dark, w / 2 - .2, pl + 2.6, d / 2 + .25);
    } else {
      windowAt(-w * .26, pl + 1.5, d / 2 + .06, 0, .7, .85); windowAt(w * .26, pl + 1.5, d / 2 + .06, 0, .7, .85, rnd() < .6);
      windowAt(w / 2 + .06, pl + 1.5, 0, Math.PI / 2, .7, .85, rnd() < .5); windowAt(-w / 2 - .06, pl + 1.5, 0, -Math.PI / 2, .7, .85, false);
      windowAt(0, pl + 1.5, -d / 2 - .06, Math.PI, .8, .85, false);
      gableRoof(w, d, top, R(1.9, 2.5), R(.3, .45));
      if (rnd() < .8) chimney(w * .28 * (rnd() < .5 ? -1 : 1), -d * .18, top + 2.3);
    }
    doorAt(tall ? w * .18 : 0, d / 2 + .06, 0);
    // canopy over the door
    const cz = d / 2 + .5, ch = pl + 2.35;
    const canopy = box(1.6, .08, .8, roofMat, tall ? w * .18 : 0, ch, cz); canopy.rotation.x = .3;
    for (const sx of [-.7, .7]) { const b = box(.08, .5, .08, mat.dark, (tall ? w * .18 : 0) + sx, ch - .25, cz); b.rotation.x = .5; }
    void walls;
    // side barrel + planter
    const bx = -w / 2 - .45, bz = d / 2 - .4;
    add(new THREE.CylinderGeometry(.3, .26, .75, 10), mat.timber, bx, pl * 0 + .38, bz);
    for (const yy of [.15, .6]) add(new THREE.TorusGeometry(.29, .03, 4, 12), mat.verd, bx, yy, bz, 0, Math.PI / 2);
  } else if (type === 'tower') {
    const r = R(1.9, 2.3), h1 = 2.8, h2 = R(2.4, 3.2), pl = .45;
    add(new THREE.CylinderGeometry(r + .25, r + .35, pl, 20), mat.stone, 0, pl / 2, 0);
    add(new THREE.CylinderGeometry(r, r + .05, h1, 20), mat.stoneLight, 0, pl + h1 / 2, 0);
    add(new THREE.CylinderGeometry(r + .2, r + .2, .2, 20), mat.stone, 0, pl + h1, 0);
    add(new THREE.CylinderGeometry(r - .1, r, h2, 20), mat.plaster, 0, pl + h1 + h2 / 2 + .1, 0);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; box(.14, h2, .1, mat.dark, Math.sin(a) * (r - .03), pl + h1 + h2 / 2 + .1, Math.cos(a) * (r - .03), a); }
    const top = pl + h1 + h2 + .1;
    // bell-flared conical roof (lathe) — the recurring bell motif
    const prof = [[0, 3.4], [.25, 3.1], [.6, 2.3], [1.1, 1.3], [1.8, .5], [r + .55, .08], [r + .7, -.12], [r + .5, -.1], [0, -.1]].reverse().map(([x, y]) => new THREE.Vector2(x, y));
    const roof = add(new THREE.LatheGeometry(prof, 20), roofMat, 0, top, 0); roof.scale.set(1, R(.9, 1.15), 1);
    add(new THREE.CylinderGeometry(.04, .04, 1.2, 6), mat.copper, 0, top + 3.6, 0);
    add(new THREE.SphereGeometry(.14, 8, 6), mat.copper, 0, top + 3.5, 0);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4; windowAt(Math.sin(a) * (r + .02), pl + h1 + 1.5, Math.cos(a) * (r + .02), a, .6, .8, false); }
    windowAt(Math.sin(2.2) * (r + .02), pl + 1.5, Math.cos(2.2) * (r + .02), 2.2, .6, .8, true);
    doorAt(0, r + .02, 0);
    // wrap-around balcony
    const by = pl + h1 + .1;
    const deck = add(new THREE.RingGeometry(r, r + .8, 20, 1, -Math.PI * .45, Math.PI * .9), mat.timber, 0, by + .02, 0, 0, -Math.PI / 2); deck.material = mat.timber; deck.geometry.rotateZ(Math.PI / 2);
    for (let i = 0; i <= 12; i++) { const a = -Math.PI * .45 + i / 12 * Math.PI * .9 + Math.PI / 2; box(.06, .8, .06, mat.dark, Math.cos(a) * (r + .75), by + .42, -Math.sin(a) * (r + .75) * -1); }
    const railR = add(new THREE.TorusGeometry(r + .75, .045, 4, 20, Math.PI * .9), mat.timber, 0, by + .85, 0, 0, Math.PI / 2); railR.rotation.z = Math.PI * .05; railR.rotation.set(Math.PI / 2, 0, -Math.PI * .05 + 0);
  } else if (type === 'workshop') {
    const w = opts.w ?? 6, d = opts.d ?? 4.5, pl = .45, h = 3.2;
    plinth(w, d, pl);
    bevel(w, h, d, mat.plaster, 0, pl + h / 2, 0, .08);
    timberFrame(w + .04, d + .04, pl, h, true);
    // big double doors
    box(2.4, 2.4, .12, mat.stoneLight, -1, pl + 1.2, d / 2 + .04);
    for (const sx of [-1, 1]) { box(1.05, 2.2, .1, mat.timber, -1 + sx * .55, pl + 1.1, d / 2 + .1); box(.9, .08, .05, mat.dark, -1 + sx * .55, pl + 1.6, d / 2 + .16); }
    windowAt(1.7, pl + 1.6, d / 2 + .06, 0, 1.1, 1.1, true);
    windowAt(w / 2 + .06, pl + 1.6, .6, Math.PI / 2, .8, .9, false); windowAt(-w / 2 - .06, pl + 1.6, -.5, -Math.PI / 2, .8, .9, false);
    windowAt(0, pl + 1.6, -d / 2 - .06, Math.PI, .8, .9, false);
    gableRoof(w, d, pl + h, 2.4, .4);
    chimney(w * .32, -d * .15, pl + h + 3);
    // awning (coral cloth) over the doors, scalloped edge
    const aw = box(3, .06, 1.3, mat.cloth, -1, pl + 2.75, d / 2 + .7); aw.rotation.x = .35;
    for (let k = 0; k < 7; k++) add(new THREE.CylinderGeometry(.2, .2, .05, 8, 1, false, 0, Math.PI), mat.cloth, -2.3 + k * .43, pl + 2.5, d / 2 + 1.33, Math.PI, Math.PI / 2 - .35);
    for (const sx of [-2.4, .4]) box(.08, 2.7, .08, mat.dark, sx, pl + 1.35, d / 2 + 1.3);
    // copper pipes running along the wall to a roof vent, with junction rings
    const pipeMat = mat.verd;
    for (const [x, z] of [[w / 2 + .15, d / 2 - .6], [w / 2 + .15, -d / 2 + .6]]) {
      add(new THREE.CylinderGeometry(.13, .13, h + 1.8, 8), pipeMat, x, pl + (h + 1.8) / 2, z);
      for (let yy = .8; yy < h + 1.5; yy += 1.1) add(new THREE.TorusGeometry(.16, .045, 5, 10), mat.copper, x, pl + yy, z, 0, Math.PI / 2);
    }
    add(new THREE.CylinderGeometry(.13, .13, d - 1.2, 8), pipeMat, w / 2 + .15, pl + h + 1.8, 0, 0, Math.PI / 2);
    add(new THREE.SphereGeometry(.2, 8, 6), mat.copper, w / 2 + .15, pl + h + 1.8, 0);
    // side wind wheel
    const wheel = new THREE.Group(); wheel.position.set(-w / 2 - .35, pl + 2.2, .8); wheel.rotation.y = Math.PI / 2; g.add(wheel); wheel.name = 'workshopWheel';
    add(new THREE.TorusGeometry(1, .06, 5, 18), mat.verd, 0, 0, 0, 0, 0, 0, wheel);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sp = box(.08, 1, .05, mat.timber, Math.sin(a) * .5, Math.cos(a) * .5, 0, 0, wheel); sp.rotation.z = -a; const bl = box(.4, .3, .04, mat.clothIvory || mat.plaster, Math.sin(a) * .8, Math.cos(a) * .8, 0, 0, wheel); bl.rotation.z = -a; }
    add(new THREE.CylinderGeometry(.14, .14, .3, 8), mat.copper, 0, 0, 0, 0, Math.PI / 2, 0, wheel);
    // crates + workbench out front
    for (const [x, z, sz] of [[2.6, d / 2 + .9, .6], [3.1, d / 2 + .5, .5], [2.8, d / 2 + .5, .45]]) bevel(sz, sz, sz, mat.timber, x, sz / 2 + (x === 2.8 ? .6 : 0), z, .04);
  }

  // Seeded lean (±2–4°) so nothing reads CAD-perfect; applied to everything above the plinth.
  const lean = (rnd() < .5 ? -1 : 1) * R(.035, .06);
  g.children.forEach((c) => { if (c.position.y > .5) { c.rotation.z += lean * .5; c.position.x += c.position.y * lean * .5; } });

  // Placement contract: measure vertices, base to y = 0, centre x/z.
  const box3 = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mm) => { for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mm)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  g.userData.footprint = {w: box3.max.x - box3.min.x, d: box3.max.z - box3.min.z, h: box3.max.y - box3.min.y};
  return g;
}
