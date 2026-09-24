// Maps the Bellhollow world module (world.js, its own naming) onto the contract quest.js,
// wind.js, guardian.js and main.js consume. A world that already satisfies the contract (the
// stub, or a future world.js that adopts the names) passes through untouched.
//   adaptWorld(world, {THREE}) -> world-shaped object with contract points/vents/wheels/sails,
//   area(p), update(dt,t,state) translating wind/quest state into world.js state keys.
import { validateWorld } from './quest.js';

const v3 = a => !a ? null : Array.isArray(a) ? { x: a[0], y: a[1], z: a[2] } : { x: a.x, y: a.y, z: a.z };

export function adaptWorld(world, { THREE: T } = {}) {
  // Data gaps other modules rely on (filled even for a world that meets the contract natively).
  const top = world?.points?.guardianWell?.rings?.top;
  if (top && !top.safe) { const v = world.vents?.find(x => x.id === 'ring3'); if (v?.ledge) top.safe = { x: v.ledge.x, y: v.ledge.y, z: v.ledge.z }; }
  if (!world || !validateWorld(world).length || !world.setState) return world;
  const wp = world.points, notes = [];
  const G = (x, z, y) => { const g = world.ground(x, z, y); return typeof g === 'number' && Number.isFinite(g) ? g : null; };
  // A catch spot: interior floor at height y, rMin..rMax from c, clear of `avoid` circles and
  // satisfying `ok`. Rings are sampled nearest-first so spots hug what they serve.
  function spot(c, y, rMin, rMax, { avoid = [], ok = () => true, name = '' } = {}) {
    c = v3(c);
    for (let r = rMin; r <= rMax + 1e-6; r += .25) for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2 + (r * 1.7), x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const g = G(x, z, y + .2); if (g === null || Math.abs(g - y) > .06) continue;
      if (world.blocked(x, z, .5, y)) continue;
      if (![[1.1, 0], [-1.1, 0], [0, 1.1], [0, -1.1], [.8, .8], [-.8, .8], [.8, -.8], [-.8, -.8]].every(([dx, dz]) => { const h = G(x + dx, z + dz, y + .2); return h !== null && Math.abs(h - y) < .06; })) continue;
      if (avoid.some(q => Math.hypot(x - q.x, z - q.z) < (q.r ?? 1.6))) continue;
      const p = { x, y, z }; if (ok(p)) return p;
    }
    notes.push('no catch spot for ' + name + '; using its anchor'); return { ...c, y };
  }
  const floorAt = (p, above = .6) => { p = v3(p); const g = G(p.x, p.z, p.y + above); return { x: p.x, y: g ?? p.y, z: p.z }; };
  const ms = wp.millSails, mp = wp.millPipes, ml = wp.millLadders, well = wp.guardianWell, rings = well.rings;
  const ledgeOf = id => v3(world.ledges.find(l => l.from === id));
  const wv = Object.fromEntries(world.vents.map(v => [v.id, v]));
  const vent = (id, src, ledge) => ({ id, x: src.x, y: src.y, z: src.z, top: src.top, radius: src.radius ?? .8, ledge, source: src.id });
  const avoidVent = (v, r = 2) => ({ x: v.x, z: v.z, r });
  const gate = v3(wp.terraceGate), inside = v3(wp.terraceGateInside);
  const points = {
    ...Object.fromEntries(Object.entries(wp).filter(([, v]) => v && (v.isVector3 || Array.isArray(v))).map(([k, v]) => [k, v3(v)])),
    start: v3(wp.start), mara: floorAt(wp.maraStand), morningBell: floorAt(wp.morningBell), maraOutlet: floorAt(wp.maraOutlet),
    seedWheel: floorAt(wp.seedWheel), terraceGate: gate,
    // The seed wheel's chained gust waits just inside the gate, beside (not on) the loft grille.
    seedOutlet: spot(wp.loftVent, 0, 1.9, 3.2, { avoid: [avoidVent(wv.loftVent, 1.9)], ok: p => (p.x - gate.x) * (inside.x - gate.x) + (p.z - gate.z) * (inside.z - gate.z) > .3, name: 'seedOutlet' }),
    loft: v3(wp.loftLedge),
    loftGust: spot(wp.loftView, 5, .8, 3.5, { avoid: [avoidVent(wv.loftVent, 2.2)], name: 'loftGust' }),
    sailsSource: floorAt(ms.source), pipesSource: floorAt(mp.source),
    sailsGust: spot(ms.restore, floorAt(ms.restore).y, 1.2, 3, { name: 'sailsGust' }),
    millSails: floorAt(ms.restore), millPipes: floorAt(mp.restore), millLadders: floorAt(ml.restore),
    laddersGust1: spot(ml.vent0, floorAt(ml.vent0).y, 1.8, 3.2, { avoid: [avoidVent(v3(ml.vent0))], name: 'laddersGust1' }),
    laddersGust2: spot(ml.vent1, floorAt(ml.vent1).y, 1.6, 3, { avoid: [avoidVent(v3(ml.vent1))], name: 'laddersGust2' }),
    laddersGust3: spot(ml.vent2, floorAt(ml.vent2).y, 1.6, 3.2, { avoid: [avoidVent(v3(ml.vent2)), { ...v3(ml.shutterLever), r: 1 }], name: 'laddersGust3' }),
    skyBridge: floorAt(wp.skyBridge.start), hollowGate: v3(wp.hollowGate),
    carvingOut: v3(wp.gallery.carvings[0].stand), carvingReturn: v3(wp.gallery.carvings[2].stand),
    arena: v3(well.centre), guardian: v3(well.hover),
    ring1: v3(rings.low.safe), ring2: v3(rings.mid.safe), ring3: v3(rings.high.safe),
    vane1: v3(rings.low.vane), vane2: v3(rings.mid.vane), vane3: v3(rings.high.vane),
    bellOut: v3(wp.pairedBells.stand), bellReturn: v3(wp.pairedBells.stand), pairedOut: v3(wp.pairedBells.outward), pairedReturn: v3(wp.pairedBells.return),
    finale: v3(wp.finaleRise.lookAt), finaleRise: { from: v3(wp.finaleRise.from), to: v3(wp.finaleRise.to), lookAt: v3(wp.finaleRise.lookAt) },
    finaleSpot: spot(wp.morningBell, floorAt(wp.morningBell).y, 1.4, 2.6, { name: 'finaleSpot' }),
    fragment1: floorAt(wp.fragment1), fragment2: floorAt(wp.fragment2), fragment3: floorAt(wp.fragment3), farBell: v3(wp.farBell),
    terraceView: { pos: v3(wp.terraceView.pos), target: v3(wp.terraceView.target), maraStand: v3(wp.terraceView.maraStand) },
    // guardian.js layout, in the shape its resolveWell() reads.
    guardianWell: { center: v3(well.centre), hover: v3(well.hover), roots: v3(wp.gallery.returnChannel.bottom), vents: { toMid: 'ring1', pulse: 'ring2' },
      rings: ['low', 'mid', 'high'].map(k => ({ y: rings[k].y, inner: rings[k].r0, outer: rings[k].r1, safe: v3(rings[k].safe), vane: v3(rings[k].vane), catchPoint: v3(rings[k].catchPoint), stand: v3(rings[k].vaneStand) })) },
  };
  const vents = [
    vent('loft', wv.loftVent, ledgeOf('loftVent')), vent('ladders1', wv.ladderVent0, ledgeOf('ladderVent0')),
    vent('ladders2', wv.ladderVent1, ledgeOf('ladderVent1')), vent('ladders3', wv.ladderVent2, ledgeOf('ladderVent2')),
    vent('ring1', rings.low.vent, v3(rings.mid.safe)), vent('ring2', rings.mid.vent, v3(rings.high.safe)),
  ];
  // The intake across the pipes gap: the second wheel's gust lands there and lowers the drawbridge.
  const intake = spot(mp.intake, floorAt(mp.gapTo).y, .6, 2.6, { name: 'pipesIntake' });
  const wheels = [
    { id: 'seed', ...points.seedWheel, hub: v3(wp.seedWheelObject), outlet: { ...points.seedOutlet, radius: 1.35 } },
    { id: 'pipesA', ...floorAt(mp.wheel1), hub: v3(mp.wheel1Object), outlet: { ...floorAt(mp.outlet1), radius: 1.2 } },
    { id: 'pipesB', ...floorAt(mp.wheel2), hub: v3(mp.wheel2Object), outlet: { ...intake, radius: 1.3 }, opens: 'pipesBridge' },
    { id: 'millSails', ...points.millSails, hub: v3(ms.mill) }, { id: 'millPipes', ...points.millPipes, hub: v3(mp.mill) }, { id: 'millLadders', ...points.millLadders, hub: v3(ml.mill) },
  ];
  const br = world.bridges.find(b => b.id === 'sailBridge');
  const sails = [
    { id: 'sailsBridge', kind: 'bridge', ...v3(br?.sailWorld || ms.bridgeSail), lever: floorAt(br?.leverWorld || ms.resetLever), stand: floorAt(ms.bridgePush) },
    { id: 'laddersShutter', kind: 'shutter', ...v3(ml.shutter), vent: 'ladders3', hold: 8 },
  ];
  const AREA = { terrace: 'terrace', loft: 'branches', sails: 'branches', pipes: 'branches', ladders: 'branches', skybridge: 'branches', hollow: 'hollow', well: 'hollow' };
  function area(p) { for (const z of world.zones || []) if (z.test?.(p.x, p.y, p.z)) return AREA[z.id] || 'terrace'; return p.y < -1 ? 'hollow' : p.y > 3.5 ? 'branches' : 'terrace'; }
  const restored = {};
  function setRestored(key, amount) { restored[key] = amount; }
  function update(dt, t, state = {}) {
    const push = state.wind?.push || {}, r = { ...restored, ...(state.restored || {}) };
    world.update(dt, t, {
      ...state,
      terraceGate: push.terraceGate ?? 0, sailBridge: Math.min(1, push.sailsBridge ?? 0), pipesBridge: Math.min(1, push.pipesBridge ?? 0),
      ladderShutter: Math.min(1, push.laddersShutter ?? 0), skyPlanks: 3 * (r.skyBridge ?? 0), hollowGate: (r.skyBridge ?? 0) >= 1 ? 1 : 0,
      restored: { terrace: r.terrace ?? 0, sails: r.sails ?? 0, pipes: r.pipes ?? 0, ladders: r.ladders ?? 0, hollow: r.hollow ?? 0, finale: (r.village ?? 0) >= .9 ? 1 : 0 },
    });
  }
  const adapted = Object.create(world);
  Object.assign(adapted, { points, vents, wheels, sails, bridges: world.bridges, area, update, setRestored, restored, adapted: true, adaptNotes: notes,
    ground: world.ground, blocked: world.blocked, cameraGround: world.cameraGround || ((x, z) => world.ground(x, z, 1e4)), setState: world.setState });
  const missing = validateWorld(adapted);
  if (missing.length) notes.push('still missing: ' + missing.join(', '));
  return adapted;
}
