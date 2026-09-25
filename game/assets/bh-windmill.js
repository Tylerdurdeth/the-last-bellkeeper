// Bellhollow windmill (8 m tower, 7 m sail span). opts.variant:
//   'sails'   coral-and-ivory cloth sails, timber lattice arms, stone tower
//   'pipes'   copper-clad cap, copper intake pipes spiralling down the tower
//   'ladders' tall timber-braced tower, outside ladder and wrap balcony
// Moving parts: userData.cap (the turning cap: dome, hub, rotor and, for 'sails', a tail boom
// with a tail sail at its back; rotates about local y) and userData.rotor (inside the cap; spins
// about its local z).
// Front (the sails) faces +Z. Base y = 0.
// Sail canvas: a procedural linen texture (warm weave, three stitched panel seams, a hem and reef points), drawn once
// in the browser; in node (tests) the sails stay flat colour.
const canvasTex = new WeakMap();
function sailCanvas(THREE) {
  if (canvasTex.has(THREE)) return canvasTex.get(THREE);
  let t = null;
  if (typeof document !== 'undefined') {
    const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#F6EDD8'; x.fillRect(0, 0, W, H);
    let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${r() < .6 ? '140,115,80' : '255,252,240'},${.025 + r() * .04})`; const h = r() < .5; x.fillRect(r() * W, r() * H, h ? 2 + r() * 4 : 1, h ? 1 : 2 + r() * 4); }   // soft weave slubs
    for (const sx of [W * .34, W * .67]) for (let y = 0; y < H; y += 5) { x.fillStyle = 'rgba(130,100,70,.16)'; x.fillRect(sx - 1, y, 1, 3); x.fillRect(sx + 1, y + 2, 1, 3); }   // soft stitched seams
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(110,85,55,.22)'); g.addColorStop(.4, 'rgba(255,250,235,.10)'); g.addColorStop(.62, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(110,85,55,.26)'); x.fillStyle = g; x.fillRect(0, 0, W, H);   // the belly: lit crown, shaded edges
    const v = x.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(110,85,55,.12)'); v.addColorStop(.15, 'rgba(0,0,0,0)'); v.addColorStop(.85, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(110,85,55,.14)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  }
  canvasTex.set(THREE, t); return t;
}

export default function (THREE, opts = {}) {
  const variant = opts.variant || 'sails';
  const M = (color, name, rough = .9, metal = 0, side) => Object.assign(new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, side: side || THREE.FrontSide}), {name});
  const ivory = M(0xF2E6C9, 'stone'), shade = M(0xCDBB95, 'stone'), plaster = M(0xF2E6C9, 'plaster'), dark = M(0x7A4E33, 'timber', .88), timber = M(0xC8894A, 'timber', .85);
  const verd = M(0x3E9C8C, 'metal', .5, .3), copper = M(0xB8733F, 'metal', .45, .4), coral = M(0xD96956, 'fabric', .95, 0, THREE.DoubleSide), cloth = M(0xF2E6C9, 'fabric', .95, 0, THREE.DoubleSide);
  const tex = sailCanvas(THREE), sailCloth = Object.assign(cloth.clone(), {map: tex, color: new THREE.Color(tex ? 0xFFF8EC : 0xF2E6C9)}), sailCoral = Object.assign(coral.clone(), {map: tex});
  if (tex) { sailCloth.userData.bhKey = 'clothSailCanvas'; sailCoral.userData.bhKey = 'clothSailCoral'; }
  const tileC = M(variant === 'pipes' ? 0xB8733F : variant === 'ladders' ? 0x3E9C8C : 0xD96956, 'tile', .8);
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, p = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); p.add(o); return o; };
  const box = (w, h, d, m, x, y, z, p = g) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, 0, 0, 0, p);
  const H = 8;
  // tower body: tapered octagon on a plinth
  add(new THREE.CylinderGeometry(2.3, 2.5, .5, 8), shade, 0, .25, 0, Math.PI / 8);
  const bodyMat = variant === 'ladders' ? plaster : ivory;
  add(new THREE.CylinderGeometry(1.55, 2.1, H - 2.2, 8), bodyMat, 0, .5 + (H - 2.2) / 2, 0, Math.PI / 8);
  for (let y = 1.6; y < H - 2.2; y += 1.6) add(new THREE.CylinderGeometry(2.1 - y * .075 + .06, 2.1 - y * .075 + .08, .12, 8), shade, 0, .5 + y, 0, Math.PI / 8);
  if (variant === 'ladders') for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; const b = add(new THREE.BoxGeometry(.16, H - 2.2, .16), dark, Math.sin(a) * 1.82, .5 + (H - 2.2) / 2, Math.cos(a) * 1.82, a); b.rotation.x = .07 * Math.cos(0); b.rotation.set(0, a, 0); b.rotateX(-.075); }
  // door, windows
  box(1, 1.9, .1, timber, 0, 1.45, 2.02); for (const x of [-.25, 0, .25]) box(.03, 1.85, .04, dark, x, 1.45, 2.07); for (const y of [.85, 1.95]) { box(1.04, .09, .05, dark, 0, y, 2.08); for (const x of [-.4, -.15, .15, .4]) box(.05, .05, .03, copper, x, y, 2.11); } for (const x of [-.58, .58]) box(.14, 1.95, .16, shade, x, 1.45, 2.02); add(new THREE.TorusGeometry(.08, .018, 4, 10), copper, .3, 1.4, 2.1); add(new THREE.CylinderGeometry(.5, .5, .1, 10, 1, false, -Math.PI / 2, Math.PI), timber, 0, 2.4, 2.02, 0, Math.PI / 2);
  for (const [a, y] of [[Math.PI / 2, 3.2], [-Math.PI / 2, 4], [Math.PI, 3.5], [Math.PI * .25, 4.8]]) { const r = 2.1 - y * .075; const w = add(new THREE.BoxGeometry(.5, .8, .12), dark, Math.sin(a) * r, y, Math.cos(a) * r, a); void w; add(new THREE.BoxGeometry(.36, .64, .1), M(0xF6D9B0, 'glass', .35), Math.sin(a) * (r + .03), y, Math.cos(a) * (r + .03), a); }
  // gallery ring under the cap
  const gy = H - 1.7;
  add(new THREE.CylinderGeometry(2.25, 2.1, .2, 16), timber, 0, gy, 0);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; box(.07, .7, .07, dark, Math.sin(a) * 2.15, gy + .4, Math.cos(a) * 2.15); }
  add(new THREE.TorusGeometry(2.15, .05, 4, 24), timber, 0, gy + .75, 0, 0, Math.PI / 2);
  // cap: bell-flared tiled dome, rotated so the hub faces +Z
  const capY = H - 1.6;
  const cap = new THREE.Group(); cap.name = 'cap'; cap.position.set(0, capY, 0); g.add(cap);
  const prof = [[1.95, 0], [1.9, .15], [1.7, .5], [1.45, 1.1], [1.0, 1.55], [.5, 1.8], [0, 1.9]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(prof, 12), tileC, 0, 0, 0, 0, 0, 0, cap);
  add(new THREE.CylinderGeometry(.08, .08, .9, 5), copper, 0, 2.3, 0, 0, 0, 0, cap); add(new THREE.SphereGeometry(.15, 8, 6), copper, 0, 2, 0, 0, 0, 0, cap);
  // hub housing
  const hubY = capY + .7;
  add(new THREE.CylinderGeometry(.55, .7, 1.4, 10), variant === 'pipes' ? copper : dark, 0, .7, 1.5, 0, Math.PI / 2, 0, cap);
  if (variant === 'sails') {
    // tail boom and tail sail at the back of the cap: pushing the tail turns the sails to the wind
    const boom = new THREE.Group(); cap.add(boom);
    // a light, low boom (no tall spar): it reads as part of the cap, not a foreground post
    add(new THREE.BoxGeometry(.12, .12, 3.2), dark, 0, -.55, -2.9, 0, -.2, 0, boom);
    add(new THREE.BoxGeometry(.07, .07, 2.4), timber, 0, -.95, -2.6, 0, -.55, 0, boom);
    const tail = new THREE.PlaneGeometry(1.5, 1.6, 2, 2); const tp = tail.attributes.position; for (let v = 0; v < tp.count; v++) tp.setX(v, tp.getX(v) + .1 * Math.cos(tp.getY(v) * 1.5)); tail.computeVertexNormals();
    add(tail, sailCoral, 0, -1.45, -4.4, 0, 0, 0, boom);
    add(new THREE.BoxGeometry(1.6, .06, .06), timber, 0, -.65, -4.4, 0, 0, 0, boom);
  }
  // rotor
  const rotor = new THREE.Group(); rotor.name = 'rotor'; rotor.position.set(0, .7, 2.3); cap.add(rotor);
  add(new THREE.CylinderGeometry(.35, .45, .5, 10), copper, 0, 0, 0, 0, Math.PI / 2, 0, rotor);
  // capped hub: a domed copper boss over the axle (never an open tube)
  add(new THREE.SphereGeometry(.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), copper, 0, 0, .25, 0, Math.PI / 2, 0, rotor);
  add(new THREE.CircleGeometry(.44, 12), copper, 0, 0, .24, 0, 0, 0, rotor);
  const span = 3.5;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2 + Math.PI / 4; rotor.add(arm);
    box(.16, span, .14, dark, 0, span / 2, 0, arm);
    if (variant === 'pipes') {
      // copper blade: curved sheet (a sliced cylinder) — reads as a turbine vane
      const blade = add(new THREE.CylinderGeometry(1.4, 1.4, span - .7, 8, 1, true, 0, Math.PI * .35), Object.assign(copper.clone(), {side: THREE.DoubleSide}), -.6, span / 2 + .3, -.9, 0, 0, 0, arm); blade.rotation.y = .2;
    } else {
      // lattice sail frame in FRONT of the cloth: bars + outer stile; the cloth is laced to the spar and stile (zero
      // billow at both long edges) and bellies back between them (up to ~0.3 m, a third of its width)
      for (let k = 1; k <= 5; k++) box(1.12, .06, .06, timber, .56, k * span / 6 + .3, .1, arm);
      box(.07, span - .6, .07, timber, 1.07, span / 2 + .3, .08, arm);
      const sail = new THREE.PlaneGeometry(1, span - .7, 6, 10);
      const sp = sail.attributes.position; for (let v = 0; v < sp.count; v++) { const fx = sp.getX(v) + .5, fy = sp.getY(v) / (span - .7) + .5; sp.setZ(v, -Math.sin(fx * Math.PI) * (.1 + .22 * Math.sin(fy * Math.PI))); }
      sail.computeVertexNormals();
      add(sail, (i % 2 && variant === 'sails') ? sailCoral : sailCloth, .55, span / 2 + .3, .04, 0, 0, 0, arm);
    }
  }
  if (variant === 'pipes') {
    // intake pipes spiralling down the tower into the base
    for (let k = 0; k < 2; k++) {
      const pts = []; for (let i = 0; i <= 16; i++) { const f = i / 16, a = f * Math.PI * 1.3 + k * Math.PI; const r = 2.2 - f * .5 * -1 - .45 * (1 - f); pts.push(new THREE.Vector3(Math.sin(a) * (1.75 + f * .45), .6 + (1 - f) * (H - 2.6), Math.cos(a) * (1.75 + f * .45))); void r; }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .16, 7), verd);
      for (let i = 2; i < 16; i += 4) add(new THREE.TorusGeometry(.2, .05, 5, 10), copper, pts[i].x, pts[i].y, pts[i].z, 0, Math.PI / 2);
    }
    add(new THREE.CylinderGeometry(.5, .5, .6, 10), copper, 0, .8, -2.3);
    add(new THREE.TorusGeometry(.55, .08, 5, 12), verd, 0, 1.1, -2.3, 0, Math.PI / 2);
  }
  if (variant === 'ladders') {
    // outside ladder up the east face to the gallery
    for (const sx of [-.3, .3]) box(.08, gy + .2, .08, dark, 2.25 + sx * 0 + .15, (gy + .2) / 2, sx);
    for (let y = .4; y < gy; y += .35) box(.08, .05, .6, timber, 2.4, y, 0);
    // bunting line
    for (let k = 0; k < 7; k++) { const tri = new THREE.Shape(); tri.moveTo(-.18, 0); tri.lineTo(.18, 0); tri.lineTo(0, -.35); tri.closePath(); const a = k / 7 * Math.PI * 2; add(new THREE.ShapeGeometry(tri), k % 2 ? coral : cloth, Math.sin(a) * 2.2, gy + .72, Math.cos(a) * 2.2, a); }
  }
  if (variant === 'sails') {
    // coral pennants on the cap + reefed spare canvas on the gallery
    for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(.15, .15, 1, 8), cloth, -1.2 + k * .3, gy + .3, -1.6, 0, 0, Math.PI / 2);
    const pen = new THREE.Shape(); pen.moveTo(0, 0); pen.lineTo(.8, -.12); pen.lineTo(0, -.3); pen.closePath();
    add(new THREE.ShapeGeometry(pen), coral, .08, 2.6, 0, 0, 0, 0, cap);
  }
  g.userData.rotor = rotor; g.userData.cap = cap;
  const box3 = new THREE.Box3(), v = new THREE.Vector3(); g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  g.userData.tower = {x: -c.x, z: -c.z, hubY: hubY - box3.min.y};
  return g;
}
