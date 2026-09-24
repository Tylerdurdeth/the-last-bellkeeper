// Stand-in Bellhollow used until game/bellhollow/world.js lands (and forced with ?stub). It
// implements the exact world interface quest.js/main.js consume, with blunt blockout geometry,
// so every v2 beat and verb is reachable and testable. Not art: the world worker replaces it.
//
// Interface (the real world must match):
//   buildBellhollow({THREE, scene, loadAsset}) -> {
//     ground(x,z,y)        highest walkable top <= y+0.35 at (x,z), or null for void
//     blocked(x,z,r,y)     true when a hero of radius r at feet height y would intersect a solid
//     cameraGround(x,z)    optional: highest top of anything at (x,z), for the camera spring arm
//     points               named anchors {x,y,z} (see quest.js REQUIRED_POINTS)
//     vents                [{id,x,y,z,top,radius,ledge:{x,y,z}}]
//     wheels               [{id,x,y,z,outlet?:{x,y,z}}]   (seed wheel, chain wheels, mills)
//     sails                [{id,kind:'bridge'|'shutter'|'sail',x,y,z,lever?:{x,y,z},vent?,hold?}]
//     bridges, ledges, zones   optional descriptive lists
//     area(p)              optional: 'terrace'|'branches'|'hollow'
//     update(dt,t,state)   state = {wind:{push,wheels,vents}, restored:{area:amount}, intro, gentle, hero}
//     setRestored(area, amount)   areas: terrace, sails, pipes, ladders, skyBridge, hollow, village
//     root                 THREE.Group
//   }
export async function buildBellhollow({ THREE: T, scene }) {
  const root = new T.Group(); root.name = 'bellhollow-stub'; scene.add(root);
  const P = (x, y, z) => ({ x, y, z });
  const restored = {}; let live = { wind: { push: {}, wheels: {}, vents: {} } };
  const push = id => live.wind?.push?.[id] ?? 0;
  const mat = {};
  const m = (hex, extra = {}) => mat[hex] ||= new T.MeshStandardMaterial({ color: hex, roughness: .85, ...extra });
  const add = (geo, color, x, y, z, parent = root) => { const o = new T.Mesh(geo, typeof color === 'number' ? m(color) : color); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  // ---- walkable surfaces (axis boxes) and solids ----
  const surfaces = [], solids = [];
  function floor(x0, x1, z0, z1, top, { color = 0xf2e6c9, thick = .5, when = null, visual = true } = {}) {
    const s = { x0, x1, z0, z1, top, when }; surfaces.push(s);
    if (visual) s.mesh = add(new T.BoxGeometry(x1 - x0, thick, z1 - z0), color, (x0 + x1) / 2, top - thick / 2, (z0 + z1) / 2);
    return s;
  }
  function solid(x0, x1, z0, z1, bottom, top, { color = 0xcdbb95, when = null, visual = true } = {}) {
    const s = { x0, x1, z0, z1, bottom, top, when }; solids.push(s);
    if (visual) s.mesh = add(new T.BoxGeometry(x1 - x0, top - bottom, z1 - z0), color, (x0 + x1) / 2, (top + bottom) / 2, (z0 + z1) / 2);
    return s;
  }
  // Canopy terrace and the gated yard.
  floor(-14, 14, -4, 10, 0, { thick: 1.2 });
  floor(-8, 8, -12, -4, 0, { color: 0xe9dcbc, thick: 1.2 });
  solid(-8, -1.3, -4.3, -3.7, 0, 2.6); solid(1.3, 8, -4.3, -3.7, 0, 2.6);
  const gate = solid(-1.3, 1.3, -4.2, -3.8, 0, 2.4, { color: 0xc8894a, when: () => push('terraceGate') < .6, visual: false });
  const doors = [-1, 1].map(s => { const pivot = new T.Group(); pivot.position.set(s * 1.3, 0, -4); root.add(pivot); add(new T.BoxGeometry(1.3, 2.4, .25), 0xc8894a, -s * .65, 1.2, 0, pivot); return pivot; });
  // Loft (layered above the yard), branches, ladders, sky bridge, Hollow.
  floor(-8, 8, -18, -10, 4, { color: 0xc8894a, thick: .4 });
  floor(-10.5, -8, -14.5, -11.5, 4, { color: 0xc8894a, thick: .4 });
  floor(-16.5, -12.5, -15, -10.8, 4, { color: 0xc8894a, thick: .4 });
  const hanging = floor(-12.6, -10.4, -14, -12, 4, { when: () => push('sailsBridge') > .85, visual: false });
  const bridgePivot = new T.Group(); bridgePivot.position.set(-10.5, 4, -13); root.add(bridgePivot); add(new T.BoxGeometry(2.3, .18, 2), 0xc8894a, -1.15, -.09, 0, bridgePivot);
  add(new T.BoxGeometry(.12, 2.2, 1.6), m(0xd96956, { side: T.DoubleSide }), -1.2, 1.2, 0, bridgePivot);
  floor(8, 12, -14.5, -11.5, 4, { color: 0xc8894a, thick: .4 });
  floor(13.8, 19, -17.5, -10, 4, { color: 0xc8894a, thick: .4 });
  floor(3.5, 8, -19.6, -18, 4, { color: 0xc8894a, thick: .4 });
  floor(-3, 3, -23, -18, 8, { color: 0xf2e6c9, thick: .4 });
  floor(4, 9, -24.2, -19, 12, { color: 0xf2e6c9, thick: .4 });
  floor(3, 9.5, -28.5, -24.2, 16, { color: 0xf2e6c9, thick: .4 });
  const planks = [0, 1, 2].map(i => floor(-12 - i * 4, -8 - i * 4, -18.8, -16.2, 4, { color: 0xb8733f, thick: .3, when: () => (restored.skyBridge || 0) >= (i + 1) / 3 - .01 }));
  floor(-27, -20, -22, -14, 4, { color: 0xcdbb95, thick: .6 });
  // Gallery ramp (y 4 -> -8 over 18 m) and the arena well.
  const ramp = { x0: -25, x1: -21, z0: -40, z1: -22 }; surfaces.push({ ...ramp, ramp: true });
  { const g = new T.BoxGeometry(4, .3, Math.hypot(18, 12)); const o = add(g, 0xcdbb95, -23, -2, -31); o.rotation.x = -Math.atan2(12, 18); }
  const arena = { x: -23, z: -47, r: 7.5, top: -8 };
  add(new T.CylinderGeometry(arena.r, arena.r, .6, 40), 0xcdbb95, arena.x, arena.top - .3, arena.z);
  floor(-31, -26, -52, -43, -4, { color: 0xf2e6c9, thick: .4 });
  floor(-20, -15, -53, -43, 0, { color: 0xf2e6c9, thick: .4 });
  // Great trunk (visual + solid for the camera and body).
  const trunk = add(new T.CylinderGeometry(9, 10.5, 34, 28, 1, true), m(0x7a4e33, { side: T.DoubleSide }), 0, 7, -38);
  solids.push({ circle: true, x: 0, z: -38, r: 9, bottom: -20, top: 30 });
  // ---- gameplay descriptors ----
  const points = {
    start: P(0, 0, 6), morningBell: P(-5, 0, 3), mara: P(5, 0, 2.6), maraOutlet: P(6.6, 0, .2),
    seedWheel: P(0, 0, -2.3), seedOutlet: P(-2.6, 0, -7.2), terraceGate: P(0, 0, -4), loft: P(0, 4, -12.5),
    loftGust: P(3.2, 4, -13), sailsGust: P(-14.2, 4, -14), laddersGust1: P(-3.5, 4, -16.4), laddersGust2: P(-1.8, 8, -22),
    laddersGust3: P(8, 12, -20), millSails: P(-15.3, 4, -12.6), millPipes: P(17.5, 4, -16.2), millLadders: P(6.3, 16, -27),
    skyBridge: P(-8.5, 4, -17.5), hollowGate: P(-23.5, 4, -18), carvingOut: P(-21.6, 0.3, -28.5), carvingReturn: P(-24.4, -4.2, -34.5),
    arena: P(arena.x, arena.top, arena.z), guardian: P(arena.x, arena.top + 3, arena.z),
    vane1: P(-18.5, -8, -43), vane2: P(-29.5, -4, -49), vane3: P(-16, 0, -50.5),
    ring1: P(-23, -8, -41), ring2: P(-28, -4, -46), ring3: P(-18, 0, -45.5),
    bellOut: P(-19, 0, -52), bellReturn: P(-16.5, 0, -52), finale: P(-23, 6, -47), finaleSpot: P(-3.5, 0, 4.4), farBell: P(10, 8, 80),
    fragment1: P(2.3, 8, -18.7), fragment2: P(18.5, 4, -10.5), fragment3: P(5, 12, -19.6),
    pipesValve: P(18.4, 4, -13.4), pipesWrongOutlet: P(18.6, 5.2, -9.2),
    gallery: { source: P(-23, 2, -25), carvings: [{ stand: P(-21.6, .3, -28.5), intake: P(-20.9, 1.5, -28.5) }, { stand: P(-24.4, -4.2, -34.5), intake: P(-25.1, -3, -34.5) }, { stand: P(-21.8, -6, -37.5), panel: P(-21, -4.8, -37.5) }, { stand: P(-24.2, -7.5, -39.5), panel: P(-25, -6.3, -39.5) }] },
  };
  const vents = [
    { id: 'loft', x: 0, z: -8.2, y: 0, top: 4.9, radius: 1.05, ledge: P(0, 4, -11.2) },
    { id: 'ladders1', x: 0, y: 4, z: -17, top: 8.9, radius: 1, ledge: P(0, 8, -20.3) },
    { id: 'ladders2', x: 1.8, y: 8, z: -21, top: 12.9, radius: 1, ledge: P(5.4, 12, -21) },
    { id: 'ladders3', x: 6.5, y: 12, z: -22.2, top: 16.9, radius: 1, ledge: P(6.3, 16, -25.4) },
    { id: 'frag1', x: -4.6, y: 4, z: -16.6, top: 8.9, radius: .9, ledge: P(-2.3, 8, -19.4) },
    { id: 'ring1', x: -25, y: -8, z: -47.5, top: -3.1, radius: 1, ledge: P(-28, -4, -47.5) },
    { id: 'ring2', x: -21.2, y: -8, z: -47.5, top: .9, radius: 1, ledge: P(-18, 0, -47.5) },
  ];
  const wheels = [
    { id: 'seed', ...points.seedWheel, outlet: { ...points.seedOutlet, radius: 1.4 } },
    { id: 'pipesA', x: 10.5, y: 4, z: -14, outlet: { x: 15.2, y: 4, z: -11.4, radius: 1.3 } },
    { id: 'pipesB', x: 17.8, y: 4, z: -11.2, outlet: { x: 15.4, y: 4, z: -15.6, radius: 1.3 } },
    { id: 'millSails', ...points.millSails }, { id: 'millPipes', ...points.millPipes }, { id: 'millLadders', ...points.millLadders },
  ];
  const sails = [
    { id: 'sailsBridge', kind: 'bridge', x: -11.6, y: 4, z: -13, lever: P(-9, 4, -11.9) },
    { id: 'sailsCap', kind: 'sail', x: -16.6, y: 5, z: -16.2, lever: P(-13.2, 4, -14.4) },
    { id: 'frag2', kind: 'sail', x: 18.2, y: 5, z: -13.2 },
    { id: 'laddersShutter', kind: 'shutter', x: 6.5, y: 12, z: -22.2, vent: 'ladders3', hold: 8 },
  ];
  // ---- simple visuals for anchors ----
  const copper = 0x3e9c8c, brass = 0xb8733f;
  const grille = new T.CylinderGeometry(1, 1, .08, 24);
  for (const v of vents) { const o = add(grille, copper, v.x, v.y + .04, v.z); o.scale.set(v.radius, 1, v.radius); }
  const wheelMeshes = {};
  for (const w of wheels) {
    const mill = w.id.startsWith('mill'), g = new T.Group(); g.position.set(w.x, w.y + (mill ? 4 : 1.1), w.z); root.add(g);
    if (mill) { add(new T.CylinderGeometry(.9, 1.3, 8, 10), 0xf2e6c9, w.x, w.y + 3.5, w.z - .8); for (let i = 0; i < 4; i++) { const s = add(new T.BoxGeometry(.5, 3.4, .08), 0xd96956, 0, 1.7, 0, new T.Group()); s.parent.rotation.z = i * Math.PI / 2; g.add(s.parent); } g.position.z += .2; }
    else { add(new T.TorusGeometry(.85, .1, 8, 24), brass, 0, 0, 0, g); for (let i = 0; i < 4; i++) { const s = add(new T.BoxGeometry(.08, 1.6, .08), copper, 0, 0, 0, g); s.rotation.z = i * Math.PI / 4; } add(new T.BoxGeometry(.3, 1.1, .3), 0x7a4e33, w.x, w.y + .55, w.z); }
    wheelMeshes[w.id] = g;
  }
  const shutter = add(new T.BoxGeometry(2.4, .14, 2.4), 0xb8733f, 6.5, 12.12, -22.2);
  const bell = (p, color) => { const g = new T.Group(); g.position.set(p.x, p.y, p.z); root.add(g); add(new T.BoxGeometry(.18, 2.4, .18), 0x7a4e33, -.8, 1.2, 0, g); add(new T.BoxGeometry(.18, 2.4, .18), 0x7a4e33, .8, 1.2, 0, g); add(new T.BoxGeometry(1.8, .18, .18), 0x7a4e33, 0, 2.4, 0, g); const b = add(new T.CylinderGeometry(.25, .5, .7, 16, 1, true), m(color, { side: T.DoubleSide }), 0, 1.8, 0, g); return b; };
  const bells = { morning: bell(points.morningBell, brass), out: bell(points.bellOut, copper), ret: bell(points.bellReturn, copper) };
  const markers = {};
  for (const k of ['carvingOut', 'carvingReturn', 'fragment1', 'fragment2', 'fragment3']) markers[k] = add(k.startsWith('frag') ? new T.OctahedronGeometry(.22) : new T.BoxGeometry(1.6, 1.8, .2), k.startsWith('frag') ? m(0xe9b949, { emissive: 0x6a4a10 }) : 0xcdbb95, points[k].x, points[k].y + (k.startsWith('frag') ? .8 : 1.2), points[k].z);
  for (const k of ['vane1', 'vane2', 'vane3']) { const g = new T.Group(); g.position.set(points[k].x, points[k].y + 1.2, points[k].z); root.add(g); add(new T.BoxGeometry(1.8, .5, .08), copper, 0, 0, 0, g); add(new T.BoxGeometry(.2, 1.2, .2), 0x7a4e33, points[k].x, points[k].y + .6, points[k].z); markers[k] = g; }
  add(new T.CylinderGeometry(.12, .12, 2.2, 8), brass, points.maraOutlet.x + .8, 1.1, points.maraOutlet.z + .6);
  add(new T.CylinderGeometry(.35, .2, .5, 12), brass, points.maraOutlet.x + .8, 2.3, points.maraOutlet.z + .6);
  const lanterns = [];
  for (let i = 0; i < 8; i++) lanterns.push(add(new T.SphereGeometry(.22, 10, 8), m(0xe9b949, { emissive: 0x000000 }).clone(), -12 + i * 3.4, 2.4, 9.6));
  const gateArch = add(new T.BoxGeometry(3, .4, .6), 0x7a4e33, 0, 2.8, -4);
  // ---- queries ----
  const on = s => !s.when || s.when();
  const inBox = (s, x, z, pad = 0) => x >= s.x0 - pad && x <= s.x1 + pad && z >= s.z0 - pad && z <= s.z1 + pad;
  function topOf(s, x, z) { return s.ramp ? 4 - 12 * Math.min(1, Math.max(0, (s.z1 - z) / (s.z1 - s.z0))) : s.top; }
  function ground(x, z, y = Infinity) {
    let best = null;
    for (const s of surfaces) if (on(s) && inBox(s, x, z)) { const h = topOf(s, x, z); if (h <= y + .35 && (best === null || h > best)) best = h; }
    if (Math.hypot(x - arena.x, z - arena.z) <= arena.r && arena.top <= y + .35 && (best === null || arena.top > best)) best = arena.top;
    return best;
  }
  function blocked(x, z, r, y = 0) {
    for (const s of solids) {
      if (!on(s) || y >= s.top - .3 || y + 1.6 <= s.bottom) continue;
      if (s.circle ? Math.hypot(x - s.x, z - s.z) < s.r + r : inBox(s, x, z, r)) return true;
    }
    // Thin platform slabs block only when the body is level with them (rising past an edge).
    for (const s of surfaces) if (!s.ramp && on(s) && s.top - .45 > y + .35 && s.top - .45 < y + 1.6 && inBox(s, x, z, r) && !inBox(s, x, z)) return true;
    return false;
  }
  const cameraGround = (x, z) => ground(x, z, 1e4);
  const area = p => p.y < -1 || p.x < -19.5 ? 'hollow' : p.y > 3 || p.z < -9 ? 'branches' : 'terrace';
  function setRestored(key, amount) { restored[key] = Math.max(0, Math.min(1, amount)); }
  function update(dt, t, state = {}) {
    live = state;
    for (const [k, v] of Object.entries(state.restored || {})) if (Number.isFinite(v)) restored[k] = v;
    const pw = state.wind?.push || {}, sp = state.wind?.wheels || {};
    doors.forEach((d, i) => d.rotation.y = (i ? -1 : 1) * (pw.terraceGate || 0) * 1.7);
    bridgePivot.rotation.z = (1 - (pw.sailsBridge || 0)) * -1.45;
    shutter.position.x = 6.5 + (pw.laddersShutter || 0) * 2.3;
    for (const [id, g] of Object.entries(wheelMeshes)) g.rotation.z -= dt * (.15 + (sp[id] || 0) * 5.5);
    planks.forEach((p, i) => p.mesh.visible = on(p));
    const lit = restored.terrace || 0;
    lanterns.forEach((l, i) => { l.material.emissive.setHex(0xe9b949); l.material.emissiveIntensity = lit * (.8 + .2 * Math.sin(t * 3 + i)); l.position.y = 3.1 - (1 - lit) * .25; });
    for (let i = 1; i <= 3; i++) markers['vane' + i].rotation.y = (restored['vane' + i] || 0) * Math.PI / 2 + Math.sin(t) * .02;
    markers.fragment1.rotation.y = markers.fragment2.rotation.y = markers.fragment3.rotation.y = t;
  }
  return { root, ground, blocked, cameraGround, area, points, vents, wheels, sails, bridges: sails.filter(s => s.kind === 'bridge'), ledges: vents.map(v => v.ledge), zones: [], update, setRestored, restored, bells, markers, stub: true };
}
