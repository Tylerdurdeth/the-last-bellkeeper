// v2 guardian set-piece (REDESIGN.md "Guardian set-piece"): actor acting, encounter clock, floor
// telegraph lanes, hits/knock-back, spent-breath catch windows and the three return vanes.
// Drop-in for guardian-stub.js (same interface quest.js delegates to):
//   createGuardian({THREE, scene, world, wind, movement, sound, caption, onEvent, look}) -> {
//     update(dt, t, {hero, active, gentle} | heroVector3), context(p, yaw, charged) -> ctx|null,
//     interact(ctx, {staffTip}) -> bool, phase (0..3; 3 = calm), done, stage, subject() -> Box3,
//     objective(), target(), serialize(), restore(d), reset(), telemetry(), actor, layout }
// Events through onEvent (one object per call; keys can combine):
//   {knock:{to:[x,y,z], x, z, power}, knockback:{x, z, dy, to:[x,y,z]}}  hit: carry the hero to the ring's safe ledge
//   {breath:{x, y, z, radius, opensAt, closesAt, ttl, phase}}          spent breath catchable (wind source 'guardianBreath')
//   {vane:{index:1..3, at:[x,y,z]}, phase:n, checkpoint:[x,y,z]}         a vane turned (phase advanced)
//   {updraft:{id, x, y, z, top, duration, pulse:bool}}                    a vent column opened (phase-3 pulses: pulse:true)
//   {done:true}                                                            last vane: the guardian folds and tends the roots
// Layout: world.points.guardianWell = {center:{x,y,z}, rings:[{y, inner, outer, safe, vane}] x3,
//   vents:{toMid:'ring1', pulse:'ring2'}, roots:{x,y,z}}. Missing -> derived from the stub anchors
//   (arena, ring1..3, vane1..3, vents ring1/ring2) and reported in layout.derived.
import buildGuardian from '../assets/bh-guardian.js';

const TAU = Math.PI * 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// Beat tables per phase (seconds). Every hazard has a >= 2 s painted telegraph.
const BEATS = [
  [{ k: 'idle', d: 1.2 }, { k: 'inhale', d: 3.0, lane: 'sweep' }, { k: 'exhale', d: .9 }, { k: 'recoil', d: .5 }, { k: 'slump', d: 3.2 }],
  [{ k: 'inhale', d: 2.3, lane: 'A' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 }, { k: 'inhale', d: 2.3, lane: 'B' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 }, { k: 'slump', d: 1.6 }],
  [{ k: 'inhale', d: 2.2, lane: 'up' }, { k: 'exhale', d: .55 }, { k: 'recoil', d: .45 }, { k: 'turn', d: .3 }, { k: 'inhale', d: 2.2, lane: 'L' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 }, { k: 'slump', d: 2.0 }],
];
const cycleLength = ph => BEATS[ph].reduce((s, b) => s + b.d, 0);

export function resolveWell(world) {
  const pts = world.points || {}, derived = [];
  const P = p => p && { x: p.x, y: p.y, z: p.z };
  const vents = Object.fromEntries((world.vents || []).map(v => [v.id, v]));
  let gw = pts.guardianWell;
  // Accept world.js's native shape too: {centre, rings:{low,mid,high:{y, r0, r1, safe, vane, catchPoint, vaneStand}}}.
  if (gw && !Array.isArray(gw.rings) && gw.rings?.low) gw = { center: gw.center || gw.centre, roots: gw.roots || pts.gallery?.returnChannel?.bottom, vents: gw.vents,
    rings: ['low', 'mid', 'high'].map(k => { const r = gw.rings[k]; return { y: r.y, inner: r.r0 ?? r.inner, outer: r.r1 ?? r.outer, safe: r.safe, vane: r.vane, catchPoint: r.catchPoint, stand: r.vaneStand || r.stand }; }) };
  if (gw?.center && gw.rings?.length >= 3) {
    return { center: P(gw.center), rings: gw.rings.map(r => ({ y: r.y, inner: r.inner ?? 0, outer: r.outer ?? 7.5, safe: P(r.safe), vane: P(r.vane), catchPoint: P(r.catchPoint) || null, stand: P(r.stand) || null })),
      toMid: vents[gw.vents?.toMid || 'ring1'] || null, pulse: vents[gw.vents?.pulse || 'ring2'] || null, roots: P(gw.roots) || null, derived };
  }
  derived.push('guardianWell missing: derived from arena/ring1..3/vane1..3/vents');
  const c = pts.arena || { x: 0, y: 0, z: 0 };
  const ringPt = k => pts['ring' + (k + 1)] || { x: c.x + 5, y: c.y + k * 4, z: c.z };
  const vanePt = k => pts['vane' + (k + 1)] || { x: c.x - 5, y: c.y + k * 4, z: c.z };
  const rings = [0, 1, 2].map(k => {
    const s = ringPt(k), v = vanePt(k), y = k === 0 ? c.y : s.y;
    const far = Math.max(Math.hypot(s.x - c.x, s.z - c.z), Math.hypot(v.x - c.x, v.z - c.z));
    return { y, inner: k === 0 ? 0 : Math.max(1.5, far - 4), outer: k === 0 ? 7.5 : far + 2, safe: P(s), vane: P(v) };
  });
  return { center: P(c), rings, toMid: vents.ring1 || null, pulse: vents.ring2 || null, roots: pts.roots ? P(pts.roots) : { x: c.x, y: c.y, z: c.z - 5 }, derived };
}

export function createGuardian({ THREE: T, scene, world, wind, movement = null, sound = () => {}, caption = () => {}, onEvent = () => {}, look = null } = {}) {
  const W = resolveWell(world), C = W.center;
  const actor = buildGuardian(T); actor.name = 'bh-guardian-actor';
  const J = actor.userData.joints, setPose = actor.userData.setPose;
  scene.add(actor); look?.applyTo?.(actor, 'character');
  const bands = createBands(T, scene);
  const ground = (x, z, y) => { const g = world.ground?.(x, z, y + .4); return typeof g === 'number' && Math.abs(g - y) < .5 ? g : null; };
  const ang = p => Math.atan2(p.z - C.z, p.x - C.x), rad = p => Math.hypot(p.x - C.x, p.z - C.z);
  const at = (a, r, y) => ({ x: C.x + Math.cos(a) * r, y, z: C.z + Math.sin(a) * r });
  const ringOf = p => { let best = -1; for (let k = 0; k < 3; k++) if (p.y > W.rings[k].y - .6 && (best < 0 || W.rings[k].y > W.rings[best].y)) best = k; return Math.max(0, best); };
  // Radial extent of real floor along angle a on ring k (so lanes paint only where one can stand).
  function extent(k, a) {
    const R = W.rings[k]; let lo = null, hi = null;
    for (let r = Math.max(.8, R.inner - 1); r <= R.outer + 1.5; r += .25) { const p = at(a, r, R.y); if (ground(p.x, p.z, R.y) !== null) { lo ??= r; hi = r; } }
    return lo === null ? { lo: Math.max(1.2, R.inner), hi: R.outer } : { lo: k === 0 ? 1.3 : lo, hi };
  }

  // ---------------- state ----------------
  let phase = 0, clock = 0, cycle = -1, active = false, warned = false, doneT = -1, time = 0, gentle = false;
  let lanes = {}, hitThis = new Set(), loiterFrom = null, loiter = false, breath = null, stats = { hits: 0, cycles: 0, exhales: 0, pulses: 0, catches: 0 };
  const pose = { crouch: 0, bloom: 0, spread: 0, thrust: 0, slump: 0, lean: 0, swell: 0, fold: 0, rotorGlow: 0, lx: 0, ly: 0 };
  let yaw = 0, rotorAngle = 0, hover = W.rings[0].y + .6, lastStage = '', stageStart = 0, beatInfo = null;
  const heroV = new T.Vector3(), mouth = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3();
  actor.position.set(C.x, hover, C.z);

  function beatAt(ph, c) {
    const beats = BEATS[ph]; let s = 0;
    for (let i = 0; i < beats.length; i++) { if (c < s + beats[i].d) return { i, b: beats[i], u: c - s, f: (c - s) / beats[i].d, start: s }; s += beats[i].d; }
    return { i: beats.length - 1, b: beats[beats.length - 1], u: beats[beats.length - 1].d, f: 1, start: s };
  }
  // The lane a telegraph beat will fire, planned when its inhale starts (then committed).
  function planLane(kind, hero) {
    const heroRing = hero ? ringOf(hero) : 0, charged = !!wind?.charged;
    if (kind === 'sweep') {
      const R = W.rings[0], v = R.vane, onFloor = hero && heroRing === 0;
      let c0 = onFloor ? ang(hero) : ang(v);
      // Carrying the breath: centre the sweep on the path to the vane so it crosses catch -> vane.
      if (onFloor && charged) { const mid = { x: (hero.x + v.x) / 2, z: (hero.z + v.z) / 2 }; c0 = ang(hero) + Math.max(-.6, Math.min(.6, wrap(ang(mid) - ang(hero)))); }
      const s = cycle % 2 ? 1 : -1, half = .78, e = extent(0, c0);
      return { kind: 'sweep', ring: 0, a0: c0 - half * s, a1: c0 + half * s, lo: e.lo, hi: Math.min(e.hi, R.outer), width: 1.7, end: at(c0 + half * s * .92, Math.min(e.hi, R.outer) - 2.0, R.y) };
    }
    // Ring lanes are stretches of ledge the breath runs along (a travelling front), painted end to end.
    const k = kind === 'L' ? 2 : 1, R = W.rings[k];
    if (loiter && hero && heroRing > 0) { const r = mid(heroRing), h = 2.6 / r, a = ang(hero), d = (cycle % 2 ? 1 : -1); return arcLane(kind, heroRing, a - d * h, a + d * h, true); }
    const av = ang(R.vane), ev = extent(k, av), r = Math.max(2, (ev.lo + ev.hi) / 2), m = x => x / r;
    if (kind === 'L') { // between the high-ring catch point and vane 3: the crossing is unavoidable
      const ac = ang(catchPoint(2)), d = wrap(av - ac); return arcLane(kind, 2, ac + d * .22, ac + d * .8, false);
    }
    if (R.catchPoint && k === 1) { // world-authored catch point: A ends on it, B lies between it and the vane
      const ac = ang(R.catchPoint), d = wrap(av - ac), rc = Math.max(2, rad(R.catchPoint)), mc = x => x / rc;
      return kind === 'B' ? arcLane(kind, k, ac + d * .22, ac + d * .78, false, rc) : arcLane(kind, k, ac - Math.sign(d) * mc(5.4), ac - Math.sign(d) * mc(.9), false, rc);
    }
    const s = sideOf(k, av); // arcs lie on the approach side (toward the ring's landing/safe point)
    // Fit the A-gap-B layout (13.4 m of ledge) into the contiguous ledge actually available there.
    let avail = 0; for (let d = .25; d <= 16; d += .25) { const p = at(av + s * m(d), r, R.y); if (ground(p.x, p.z, R.y) === null) break; avail = d; }
    const f = Math.max(.35, Math.min(1, (avail - .5) / 13.4));
    return kind === 'B' ? arcLane(kind, k, av + s * m(6.4 * f), av + s * m(1.3 * f), false, r) : arcLane(kind, k, av + s * m(13.4 * f), av + s * m(8.9 * f), false, r);
  }
  const mid = k => { const R = W.rings[k]; return Math.max(2, (R.inner + R.outer) / 2); };
  function arcLane(id, k, a0, a1, aimed, rr = null) {
    const R = W.rings[k], e = extent(k, (a0 + a1) / 2), lo = Math.max(e.lo, R.inner), hi = Math.min(e.hi, R.outer), rm = rr ?? (lo + hi) / 2;
    return { kind: 'arc', id, ring: k, a0, a1, lo, hi, width: hi - lo, aimed, end: at(a1 + Math.sign(a1 - a0) * .9 / rm, rm, R.y) };
  }
  const sides = {};
  function sideOf(k, av) { // toward the ring's safe landing when it is off to one side, else toward more floor (cached)
    if (sides[k]) return sides[k];
    const toSafe = wrap(ang(W.rings[k].safe) - av); if (Math.abs(toSafe) > .3) return (sides[k] = Math.sign(toSafe));
    let s = 0; for (const d of [-1, 1]) for (let i = 1; i <= 8; i++) { const R = W.rings[k], p = at(av + d * i * .12, (R.inner + R.outer) / 2, R.y); if (ground(p.x, p.z, R.y) !== null) s += d; }
    return (sides[k] = s >= 0 ? 1 : -1);
  }
  function catchPoint(k) {
    if (k === 2 && W.rings[2].catchPoint) return W.rings[2].catchPoint;
    if (k === 2) { const v = W.pulse; const l = v?.ledge; if (l && Math.abs(l.y - W.rings[2].y) < 1) return l; const s = W.rings[2].safe; return { x: s.x, y: W.rings[2].y, z: s.z }; }
    return lanes[k === 0 ? 'sweep' : 'A']?.end || W.rings[k].safe;
  }

  // ---------------- per frame ----------------
  function update(dt, t, o = {}) {
    if (o && o.isVector3) o = { hero: o };
    const hero = o.hero || null; gentle = !!o.gentle; time = t;
    dt = Math.min(.1, Math.max(0, dt || 0));
    if (hero) heroV.set(hero.x, hero.y, hero.z);
    const near = hero && rad(hero) < W.rings[2].outer + 4 && hero.y < W.rings[2].y + 8 && hero.y > C.y - 3;
    active = o.active !== false && phase < 3 && !!near;
    if (phase >= 3) { doneT += dt; actTend(dt, t); bands.flush(t); return; }
    if (!active) { clock = 0; cycle = -1; lanes = {}; actIdle(dt, t, 'idle'); bands.flush(t); return; }
    if (!warned) { warned = true; }
    clock += dt;
    const L = cycleLength(phase), c = Math.floor(clock / L), cc = clock - c * L;
    if (c !== cycle) { // new cycle: loiter check (standing still for one whole cycle gets targeted)
      if (cycle >= 0 && hero) {
        // Waiting on a grille for an updraft (or riding one) is play, not loitering.
        const atVent = [W.toMid, W.pulse].some(v => v && Math.hypot(hero.x - v.x, hero.z - v.z) < (v.radius || 1) + 1.2 && Math.abs(hero.y - v.y) < 1);
        loiter = !!loiterFrom && !atVent && !movement?.lifting && Math.hypot(hero.x - loiterFrom.x, hero.z - loiterFrom.z) < 1.5 && Math.abs(hero.y - loiterFrom.y) < .5; stats.cycles++;
      }
      loiterFrom = hero ? { x: hero.x, y: hero.y, z: hero.z } : null; cycle = c; hitThis.clear();
    }
    const B = beatAt(phase, cc); beatInfo = B;
    const key = B.b.k + B.i;
    if (key !== lastStage) { lastStage = key; stageStart = t; enterBeat(B, hero); }
    runBeat(B, dt, t, hero);
    tickVents(dt);
    bands.flush(t);
  }
  let current = null; // lane of the current telegraph/exhale pair
  function enterBeat(B, hero) {
    B = { ...B };
    const k = B.b.k;
    if (k === 'inhale') { current = B.b.lane === 'up' ? { kind: 'up' } : planLane(B.b.lane, hero); if (current.kind === 'sweep') current.id = 'sweep'; lanes[B.b.lane] = current; sound('guardian-inhale'); }
    if (k === 'exhale') {
      stats.exhales++; sound('guardian-exhale');
      if (current?.kind === 'up') firePulse();
    }
    if (k === 'recoil' && current && current.kind !== 'up') spawnBreath(current, B);
  }
  function spawnBreath(lane, B) {
    // Phase 1: sweep end. Phase 2: only lane A leaves a catchable breath (B is the crossing lane). Phase 3: see firePulse.
    // The window stays open until the same lane is about to fire again (shown by the emptying ring).
    const beats = BEATS[phase], L = cycleLength(phase); let s = 0, exhaleAt = 0;
    for (let i = 0; i < beats.length; i++) { if (beats[i].k === 'exhale' && i > 0 && beats[i - 1].lane === (lane.id || lane.kind)) { exhaleAt = s; break; } s += beats[i].d; }
    const ttl = L - B.start + exhaleAt - .3;
    if (phase === 0 && lane.kind === 'sweep') offerBreath(lane.end, ttl);
    if (phase === 1 && lane.id === 'A' && !lane.aimed) offerBreath(lane.end, ttl);
  }
  function offerBreath(p, ttl) {
    if (!wind || wind.charged) return;
    const y = ground(p.x, p.z, p.y) ?? p.y;
    wind.addSource('guardianBreath', { x: p.x, y, z: p.z, radius: 1.3, repeat: false, ttl, kind: 'guardian' });
    breath = { x: p.x, y, z: p.z, opensAt: time, closesAt: time + ttl, ttl };
    onEvent({ breath: { x: p.x, y, z: p.z, radius: 1.3, opensAt: +time.toFixed(2), closesAt: +(time + ttl).toFixed(2), ttl: +ttl.toFixed(2), phase } });
  }
  function firePulse() {
    const v = W.pulse; if (!v) return;
    stats.pulses++;
    const duration = 4.4;
    wind?.openVent?.(v, { duration });
    onEvent({ updraft: { id: v.id, x: v.x, y: v.y, z: v.z, top: v.top, duration, pulse: true } });
    // The last breath waits where the pulse lands on the high ring until the next pulse.
    pendingBreath = { at: time + 1.0, p: catchPoint(2), ttl: cycleLength(2) - .3 };
  }
  let pendingBreath = null, ventTimer = 0;
  function tickVents(dt) {
    if (pendingBreath && time >= pendingBreath.at) { offerBreath(pendingBreath.p, pendingBreath.ttl); pendingBreath = null; }
    // After vane 1 the floor grille breathes on its own (4.2 s column, 2 s rest) so the mid ring is always reachable.
    if (phase >= 1 && W.toMid && (ventTimer -= dt) <= 0) { ventTimer = 6.2; wind?.openVent?.(W.toMid, { duration: 4.2 }); onEvent({ updraft: { id: W.toMid.id, x: W.toMid.x, y: W.toMid.y, z: W.toMid.z, top: W.toMid.top, duration: 4.2, pulse: false } }); }
  }

  // Beat behaviour: telegraph paint, acting targets, ribbons, hits.
  function runBeat(B, dt, t, hero) {
    const k = B.b.k, lane = current, R = lane && lane.ring !== undefined ? W.rings[lane.ring] : W.rings[Math.min(phase, 2)];
    const hoverTarget = (phase === 0 ? W.rings[0].y : phase === 1 ? W.rings[1].y - .4 : W.rings[1].y + .6) + .6;
    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 1.2));
    // Facing: toward the lane (sweep follows its sweeping angle), else the hero.
    let face = hero ? Math.atan2(hero.x - C.x, hero.z - C.z) : yaw, look = { x: -.25, y: 0 };
    let target = { crouch: 0, bloom: .05, spread: 0, thrust: 0, slump: 0, lean: 0, swell: 0, fold: 0, rotorGlow: .1 }, rate = 6;
    const laneAngle = a => Math.atan2(Math.cos(a), Math.sin(a)); // world ring angle -> actor yaw (atan2(dx,dz))
    if (lane?.kind === 'sweep') face = laneAngle(k === 'exhale' ? lane.a0 + (lane.a1 - lane.a0) * ease((B.u - .12) / (B.b.d - .12)) : lane.a0 + (lane.a1 - lane.a0) * (k === 'inhale' ? .15 : 1));
    else if (lane?.kind === 'arc') face = laneAngle(lane.a0 + (lane.a1 - lane.a0) * (k === 'exhale' ? ease(B.u / B.b.d) : .3));
    if (k === 'inhale') {
      const f = B.f, e = ease(f);
      target = { crouch: e, bloom: ease(f * 1.5), spread: ease(f * 1.25), lean: -.12 * e, swell: e, rotorGlow: Math.pow(f, 1.2), thrust: 0, slump: 0, fold: 0 };
      rate = 9; look = lane?.kind === 'up' ? { x: .95 * e, y: 0 } : { x: -.45 * e, y: 0 };
      if (lane?.kind === 'up') target.spread = e; // arms raised to the top of the well
      paintTelegraph(lane, f, t);
      drawInhale(f, t);
    } else if (k === 'exhale') {
      const snap = ease(B.u / .12);
      target = { crouch: .55 * (1 - snap), bloom: 1 - .75 * snap, spread: lane?.kind === 'up' ? 1 : 1 - snap, thrust: lane?.kind === 'up' ? .2 : snap, lean: lane?.kind === 'up' ? -.35 * snap : .55 * snap, swell: .3, rotorGlow: 1, slump: 0, fold: 0 };
      rate = 34; look = lane?.kind === 'up' ? { x: 1.1, y: 0 } : { x: -.55, y: 0 };
      paintTelegraph(lane, 1, t, true);
      drawExhale(lane, B, t, hero);
    } else if (k === 'recoil') {
      const r = Math.sin(B.f * Math.PI);
      target = { crouch: -.1 * r, bloom: .2, spread: .15, thrust: -.35 * r, lean: -.35 * r, swell: .1, rotorGlow: .7 * (1 - B.f), slump: .3 * B.f, fold: 0 };
      rate = 14; look = { x: .15 * r, y: 0 };
      if (lane && lane.kind !== 'up') paintTelegraph(lane, 1, t, true, 1 - B.f);
    } else if (k === 'slump') {
      const s = ease(B.f / .25) * (1 - ease((B.f - .75) / .25));
      target = { crouch: .25 * s, bloom: -.2 * s, spread: 0, thrust: 0, lean: .35 * s, slump: s, swell: 0, rotorGlow: .05 + .1 * (1 - s), fold: 0 };
      rate = 4; look = { x: -.2 * s, y: 0 };
    } else if (k === 'turn') { rate = 6; }
    else actIdleTargets(target, t);
    // Next-lane preview: during a phase-2 slump/recoil keep the committed lane faintly visible.
    drawBreathFx(t);
    applyActor(dt, t, target, rate, face, look);
  }
  function actIdleTargets(target, t) { const b = Math.sin(t * 1.1); target.bloom = .08 + .06 * b; target.swell = .08 * b; target.rotorGlow = .12 + .05 * b; }
  function actIdle(dt, t, why) {
    const target = { crouch: 0, bloom: 0, spread: 0, thrust: 0, slump: 0, lean: 0, swell: 0, fold: 0, rotorGlow: .1 }; actIdleTargets(target, t);
    hover += ((W.rings[0].y + .6) - hover) * (1 - Math.exp(-dt));
    applyActor(dt, t, target, 3, yaw, { x: -.1, y: 0 });
  }
  function actTend(dt, t) {
    // Fold (3 s), turn to the roots, sink, then tend: slow breaths, hands brushing the roots.
    const R = W.roots || { x: C.x, y: C.y, z: C.z - 5 }, f = ease(doneT / 3), b = Math.sin(t * .8);
    const face = Math.atan2(R.x - C.x, R.z - C.z);
    hover += ((W.rings[0].y + .35) - hover) * (1 - Math.exp(-dt * .6));
    const toward = Math.min(1, doneT / 4);
    actor.position.x += ((C.x + (R.x - C.x) * .45 * toward) - actor.position.x) * (1 - Math.exp(-dt));
    actor.position.z += ((C.z + (R.z - C.z) * .45 * toward) - actor.position.z) * (1 - Math.exp(-dt));
    applyActor(dt, t, { crouch: .3 * f, bloom: .12 + .08 * b * f, spread: 0, thrust: 0, slump: 0, lean: .45 * f, swell: .05 * b, fold: f * (.85 + .15 * b), rotorGlow: .15 + .05 * b }, 2.5, face, { x: -.55 * f, y: 0 }, true);
  }
  function applyActor(dt, t, target, rate, face, look, keepXZ = false) {
    const m = gentle ? .6 : 1, a = 1 - Math.exp(-rate * dt);
    for (const key of Object.keys(target)) pose[key] += (target[key] - pose[key]) * a;
    pose.lx += (look.x - pose.lx) * a; pose.ly += (look.y - pose.ly) * a;
    yaw += wrap(face - yaw) * (1 - Math.exp(-dt * (rate > 20 ? 14 : 4)));
    rotorAngle += dt * (.4 + 16 * pose.rotorGlow * pose.rotorGlow) * (gentle ? .5 : 1);
    const tremble = beatInfo?.b.k === 'inhale' && beatInfo.f > .7 && !gentle ? Math.sin(t * 55) * .012 * (beatInfo.f - .7) / .3 : 0;
    setPose({ ...pose, look: { x: pose.lx, y: pose.ly }, rotor: rotorAngle, trail: Math.sin(t * 1.7) * .08 * m + tremble * 4, trailPitch: Math.sin(t * 1.1) * .05 * m });
    actor.rotation.y = yaw;
    if (!keepXZ) { actor.position.x += (C.x - actor.position.x) * (1 - Math.exp(-dt * 2)); actor.position.z += (C.z - actor.position.z) * (1 - Math.exp(-dt * 2)); }
    actor.position.y = hover + Math.sin(t * 1.3) * .12 * m + tremble;
    actor.updateMatrixWorld(true);
  }

  // ---------------- telegraph + ribbons ----------------
  function paintTelegraph(lane, f, t, firing = false, alpha = 1) {
    if (!lane) return;
    if (lane.kind === 'up') { const v = W.pulse; if (v) bands.sector({ cx: v.x, cz: v.z, y: v.y, a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU, lo: (v.radius || 1) + .15, hi: (v.radius || 1) + .75, fill: f, firing, alpha, t, ground: null }); return; }
    const R = W.rings[lane.ring];
    bands.sector({ cx: C.x, cz: C.z, y: R.y, a0: lane.a0, a1: lane.a1, lo: lane.lo, hi: lane.hi, fill: f, firing, alpha, t, ground: (x, z) => ground(x, z, R.y) });
  }
  function hoodPoint(out) { J.hood.getWorldPosition(out); return out.setY(out.y + .35); }
  function drawInhale(f, t) {
    if (!wind) return; hoodPoint(mouth);
    // Air pulled in from all around the well into the blooming hood: converging spirals.
    const n = 7, spin = gentle ? .5 : 1;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU + t * .4 * spin, r0 = 5.5, y0 = mouth.y - 2.5 + (i % 3) * 1.6;
      const head = ((t * .9 + i / n) % 1);
      wind.strip(22, (g, o) => { const r = r0 * (1 - g), a = a0 + g * 2.2; o.set(mouth.x + Math.cos(a) * r, y0 + (mouth.y - y0) * g * g, mouth.z + Math.sin(a) * r); }, { width: .16 + .14 * f, alpha: .35 + .5 * f, from: Math.max(0, head - .35), to: head });
    }
  }
  function drawExhale(lane, B, t, hero) {
    hoodPoint(mouth);
    const snap = clamp01(B.u / .12), front = clamp01((B.u - .05) / (B.b.d * .55)), tail = clamp01((B.u - B.b.d * .45) / (B.b.d * .55));
    if (lane.kind === 'up') {
      const top = (W.rings[2].y + 5);
      if (wind) { for (let i = 0; i < 3; i++) wind.strip(28, (g, o) => { const a = g * 6 + i * 2.1 + t * 6; o.set(mouth.x + Math.cos(a) * .5 * (1 - g * .3), mouth.y + (top - mouth.y) * g, mouth.z + Math.sin(a) * .5); }, { width: i ? .35 : .9, alpha: 1, from: tail, to: Math.max(tail + .02, front) });
        const v = W.pulse; if (v) wind.arc(mouth.clone(), new T.Vector3(v.x, v.y + .5, v.z), 1.2, { width: .5, alpha: .9, from: tail, to: front }); }
      return;
    }
    const R = W.rings[lane.ring], h = R.y + .95, sweep = lane.kind === 'sweep';
    const sw = ease((B.u - .12) / (B.b.d - .12)), a = sweep ? lane.a0 + (lane.a1 - lane.a0) * sw : lane.a0 + (lane.a1 - lane.a0) * front;
    const rm = (lane.lo + lane.hi) / 2;
    // sweep: a radial beam from the hood that rotates across the wedge. arc: the breath dives onto the
    // ledge at a0 and runs along it to a1 (front), hugging the ring.
    const path = (g, o, off = 0, wob = 0) => {
      const s = sweep ? .22 : .3;
      const p0 = sweep ? at(a, lane.lo, h) : at(lane.a0, rm, h);
      if (g < s) { const q = g / s; o.set(mouth.x + (p0.x - mouth.x) * q, mouth.y + (h - mouth.y) * Math.sin(q * Math.PI / 2), mouth.z + (p0.z - mouth.z) * q); return; }
      const q = (g - s) / (1 - s), wy = wob * Math.sin(q * 14 - t * 22) * .18;
      if (sweep) { const r = lane.lo + (lane.hi - lane.lo + .6) * q, p = at(a + off / Math.max(1, r), r, h + wy); o.set(p.x, p.y, p.z); }
      else { const aa = lane.a0 + (lane.a1 - lane.a0) * q, p = at(aa, rm + off, h + wy); o.set(p.x, p.y, p.z); }
    };
    if (wind) {
      const to = sweep ? 1 : Math.max(.02, s2g(front)), from = sweep ? 0 : s2g(tail) * .95;
      const alpha = sweep ? Math.min(1, snap * 1.5) * (1 - clamp01((B.f - .85) / .15)) : 1;
      wind.strip(48, (g, o) => path(g, o), { width: 1.1, alpha, from, to, taper: true });
      for (const off of [-.55, .55]) wind.strip(40, (g, o) => path(g, o, off, 1), { width: .36, alpha: alpha * .85, from, to });
      wind.strip(36, (g, o) => { path(g, o); o.y = R.y + .06; }, { width: 1.5, alpha: .45 * alpha, from: Math.max(from, sweep ? .22 : .3), to, flat: true, taper: false });
      if (sweep) { // wake of the sweep: arcs trailing the beam
        for (const rr of [lane.lo + 1.5, rm + .5, lane.hi - .6]) wind.strip(24, (g, o) => { const q = lane.a0 + (a - lane.a0) * g; o.set(C.x + Math.cos(q) * rr, R.y + .5, C.z + Math.sin(q) * rr); }, { width: .22, alpha: .6 * alpha });
      }
    }
    // Hit test at body height: the swept wedge so far (sweep) or the ledge behind the travelling front (arc).
    if (!hero || hitThis.has(B.i) || movement?.knocked) return;
    const hr = rad(hero), onRing = Math.abs(hero.y - R.y) < 1.1 && !movement?.lifting; // riding a column is safe
    if (!onRing || hr < lane.lo - .3 || hr > lane.hi + .4) return;
    const done = wrap(a - lane.a0), ha = wrap(ang(hero) - lane.a0), pad = .5 / Math.max(1, hr);
    const hit = (sweep ? snap >= 1 : true) && (done >= 0 ? ha >= -pad && ha <= done + pad : ha <= pad && ha >= done - pad);
    if (hit) knock(hero, sweep ? a : a + Math.PI / 2 * Math.sign(lane.a1 - lane.a0));
  }
  // Map lane progress (0..1 along the lane) into the ribbon parameter (the dive takes the first 30%).
  const s2g = f => .3 + .7 * f;
  function knock(hero, a) {
    hitThis.add(beatInfo.i); stats.hits++;
    const k = ringOf(hero), s = W.rings[k].safe, to = [s.x, (ground(s.x, s.z, W.rings[k].y) ?? W.rings[k].y), s.z];
    const dx = Math.cos(a), dz = Math.sin(a);
    sound('hazard');
    wind?.burst?.({ x: hero.x, y: hero.y, z: hero.z }, { radius: 2.2, duration: .6 });
    onEvent({ knock: { to, x: dx, z: dz, power: 1 }, knockback: { x: dx, z: dz, dy: 1.6, to } });
  }
  function drawBreathFx(t) {
    // The catchable spent breath: a big flat glowing swirl + a countdown ring that empties as the window closes.
    const s = wind?.sources?.get?.('guardianBreath');
    if (!s || !s.active) { breath = null; return; }
    const left = breath ? clamp01((breath.closesAt - time) / breath.ttl) : 1, spin = gentle ? .4 : 1, warn = left < .25 ? .6 + .4 * Math.sin(t * 16) : 1;
    for (let i = 0; i < 2; i++) wind.strip(30, (g, o) => { const a = i * Math.PI + t * 2.2 * spin + g * 4.2, r = .25 + g * 1.25; o.set(s.x + Math.cos(a) * r, s.y + .08 + g * .05, s.z + Math.sin(a) * r); }, { width: .3, alpha: .95, flat: true });
    wind.ring(s.x, s.y + .07, s.z, 1.85, { width: .2, alpha: .95 * warn, taper: false }, -Math.PI / 2, -Math.PI / 2 + TAU * left);
    bands.dot({ x: s.x, z: s.z, y: s.y, r: 2.1, t });
  }

  // ---------------- interaction ----------------
  const vaneOf = k => W.rings[k].vane;
  function context(p, yaw_, charged = wind?.charged) {
    if (phase >= 3) return null;
    const v = vaneOf(phase);
    if (!charged) {
      const src = wind?.sourceAt?.(p);
      if (src?.id === 'guardianBreath') return { kind: 'catch', id: 'guardianBreath', label: 'Catch the spent breath', target: new T.Vector3(src.x, src.y + .9, src.z), anim: 'capture', owner: 'guardian' };
      if (Math.hypot(p.x - v.x, p.z - v.z) < 2.6 && Math.abs(p.y - v.y) < 2) return { kind: 'info', id: 'vane', label: `Return vane ${phase + 1}/3 · needs the guardian’s breath`, target: new T.Vector3(v.x, v.y + 1.2, v.z), owner: 'guardian', why: 'This vane turns only on the guardian’s own spent breath: the glowing swirl where its lane ends.' };
      return null;
    }
    if (Math.hypot(p.x - v.x, p.z - v.z) < 5 && Math.abs(p.y - v.y) < 2.5) return { kind: 'give', id: 'vane', label: `Give the breath to vane ${phase + 1}/3`, target: new T.Vector3(v.x, v.y + 1.2, v.z), anim: 'release', owner: 'guardian' };
    return null;
  }
  function interact(ctx, { staffTip } = {}) {
    if (!ctx) return false;
    if (ctx.kind === 'catch') { const ok = wind.catchFrom('guardianBreath', staffTip); if (ok) { stats.catches++; breath = null; } return ok; }
    if (ctx.kind === 'give') {
      if (wind.charge?.kind !== 'guardian') { wind.release('spill', staffTip, ctx.target); caption('Ordinary wind slips through the vane. It needs the guardian’s own breath.', 4); return true; }
      const k = phase;
      wind.release('give', staffTip, ctx.target, { onArrive: () => powerVane(k) });
      return true;
    }
    if (ctx.kind === 'info') { caption(ctx.why, 5); return true; }
    return false;
  }
  function powerVane(k) {
    if (phase !== k) return;
    phase = k + 1; clock = 0; cycle = -1; lanes = {}; current = null; lastStage = ''; loiter = false; pendingBreath = null;
    wind?.removeSource?.('guardianBreath'); breath = null;
    world.setRestored?.('vane' + (k + 1), 1); sound('restore');
    const v = vaneOf(k), safe = W.rings[k].safe;
    if (phase === 3) { doneT = 0; sound('guardian-fold'); }
    onEvent({ vane: { index: k + 1, at: [v.x, v.y, v.z] }, phase, checkpoint: [safe.x, safe.y, safe.z], ...(phase === 3 ? { done: true } : {}) });
    if (phase === 1) ventTimer = .6;
  }

  function stage() { return phase >= 3 ? (doneT < 3 ? 'fold' : 'tend') : !active ? 'idle' : beatInfo?.b.k || 'idle'; }
  const box = new T.Box3();
  return {
    actor, object: actor, layout: W, update, context, interact,
    get phase() { return phase; }, get done() { return phase >= 3; }, get stage() { return stage(); },
    get lane() { return current; }, get pose() { return { ...pose }; },
    subject() { actor.updateMatrixWorld(true); return box.setFromCenterAndSize(tmp.copy(actor.position).add(tmp2.set(0, 2.1, 0)), tmp2.set(3.6, 4.4, 3.6).clone()); },
    objective() { return phase >= 3 ? null : ['Dodge the breath, catch it, turn vane 1/3', 'Ride the grille up; catch between the two breaths; vane 2/3', 'Ride the upward breath; turn vane 3/3'][phase]; },
    target() { if (phase >= 3) return null; const v = vaneOf(phase); return new T.Vector3(v.x, v.y, v.z); },
    serialize() { return { phase }; },
    restore(d) { phase = Math.max(0, Math.min(3, d?.phase | 0)); for (let k = 1; k <= phase; k++) world.setRestored?.('vane' + k, 1); clock = 0; cycle = -1; lastStage = ''; doneT = phase >= 3 ? 10 : -1; },
    reset() { phase = 0; clock = 0; cycle = -1; warned = false; lastStage = ''; lanes = {}; current = null; doneT = -1; loiter = false; pendingBreath = null; stats = { hits: 0, cycles: 0, exhales: 0, pulses: 0, catches: 0 }; },
    telemetry() {
      const B = beatInfo, L = phase < 3 ? cycleLength(phase) : 0;
      return { phase, stage: stage(), beat: B ? B.b.k + (B.b.lane ? ':' + B.b.lane : '') : null, beatLeft: B ? +(B.b.d - B.u).toFixed(2) : null, clock: +clock.toFixed(2), cycle: L ? +(clock % L).toFixed(2) : 0,
        lane: current ? { kind: current.kind, id: current.id || current.kind, ring: current.ring, aimed: !!current.aimed } : null, loiter, breath: breath ? { ...breath, left: +(breath.closesAt - time).toFixed(2) } : null, ...stats, derived: W.derived };
    },
    dispose() { scene.remove(actor); bands.dispose(); },
  };
}

// ---------------- floor telegraph bands (one draw call) ----------------
// Deep coral fill with ink edges and a cream pinstripe, cream chevrons flowing in the direction the
// breath will travel, a hot fill that grows from the guardian as the inhale completes, and a flash
// in the last 20%. Unlit so it keeps its contrast in the dark Hollow.
function createBands(T, scene) {
  const MAXV = 6000, len = new Float32Array(MAXV), pos = new Float32Array(MAXV * 3), a1 = new Float32Array(MAXV * 4), a2 = new Float32Array(MAXV * 4), idx = new Uint16Array(MAXV * 3);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('aLane', new T.BufferAttribute(a1, 4).setUsage(T.DynamicDrawUsage));   // along (m), across 0..1, u01, fill
  geo.setAttribute('aStyle', new T.BufferAttribute(a2, 4).setUsage(T.DynamicDrawUsage));  // alpha, firing, width (m), kind (0 lane, 1 dot)
  geo.setAttribute('aLen', new T.BufferAttribute(len, 1).setUsage(T.DynamicDrawUsage));
  geo.setIndex(new T.BufferAttribute(idx, 1).setUsage(T.DynamicDrawUsage));
  const col = h => ({ value: new T.Color(h) }); // sRGB hex -> linear; output converted by three/look like any material
  const uniforms = { uTime: { value: 0 }, uInk: col(0x2A1E1C), uDeep: col(0x7E2519), uHot: col(0xA93624), uCream: col(0xFBE7C4), uHalo: col(0x2C4A45) };
  const mat = new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: `attribute vec4 aLane; attribute vec4 aStyle; attribute float aLen; varying vec4 vL; varying vec4 vS; varying float vLen;
      void main(){ vL=aLane; vS=aStyle; vLen=aLen; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uInk, uDeep, uHot, uCream, uHalo; varying vec4 vL; varying vec4 vS; varying float vLen;
      void main(){
        vec3 ink=uInk, deep=uDeep, hot=uHot, cream=uCream;
        if(vS.w>.5){ // soft dark halo under the spent-breath swirl (lifts cyan off ivory)
          float r=length(vL.xy*2.-1.); if(r>1.)discard; float a=(1.-smoothstep(.55,1.,r))*.55*vS.x; gl_FragColor=vec4(uHalo,a);
          #include <colorspace_fragment>
          return; }
        float ac=vL.y, w=vS.z, e=min(min(ac,1.-ac)*w, min(vL.x, vLen-vL.x)); // metres from the nearest edge
        float edge=1.-smoothstep(.13,.17,e), pin=smoothstep(.2,.23,e)*(1.-smoothstep(.27,.3,e));
        float fill=step(vL.z,vL.w);
        float flash=vL.w>.8&&vS.y<.5 ? .5+.5*sin(uTime*26.) : 0.;
        vec3 c=mix(deep,hot,fill*.85+flash*.15);
        float spd=vS.y>.5?9.:1.2+vL.w*3.;
        float ch=fract((vL.x+abs(ac-.5)*min(w,2.2)*.9)/1.7-uTime*spd*.8);
        float chev=step(ch,.2)*step(.34,e)*step(abs(ac-.5)*w,.95);
        c=mix(c,cream,chev*(.55+.4*fill));
        c=mix(c,cream,pin*.9); c=mix(c,ink,edge);
        gl_FragColor=vec4(c,vS.x*(edge>.5?1.:.93));
        #include <colorspace_fragment>
      }`,
  });
  mat.userData.look = false;
  const mesh = new T.Mesh(geo, mat); mesh.name = 'guardian-lane-bands'; mesh.frustumCulled = false; mesh.renderOrder = 3; scene.add(mesh);
  let v = 0, n = 0;
  function quad(p, lane, style, L) { if (v + 1 >= MAXV) return -1; const i = v++; pos.set(p, i * 3); a1.set(lane, i * 4); a2.set(style, i * 4); len[i] = L; return i; }
  function stripGrid(N, sample, style, L = 1e3) {
    // sample(i, side) -> [x, y, z, along, across, u01, fill, alphaMul]
    const start = v;
    for (let i = 0; i <= N; i++) for (let s = 0; s < 2; s++) { const q = sample(i, s); if (quad([q[0], q[1], q[2]], [q[3], q[4], q[5], q[6]], [style[0] * q[7], style[1], style[2], style[3]], L) < 0) return; }
    for (let i = 0; i < N; i++) { const a = start + i * 2; if (n + 6 > idx.length) return; idx[n++] = a; idx[n++] = a + 1; idx[n++] = a + 2; idx[n++] = a + 1; idx[n++] = a + 3; idx[n++] = a + 2; }
  }
  function line({ x0, z0, x1, z1, y, width, fill, firing, alpha = 1, ground }) {
    const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L, N = Math.max(4, Math.ceil(L / .5));
    stripGrid(N, (i, s) => { const f = i / N, cx = x0 + dx * L * f, cz = z0 + dz * L * f, side = (s ? 1 : -1) * width / 2, x = cx - dz * side, z = cz + dx * side;
      const g = ground ? ground(x, z) : y; return [x, (g ?? y) + .035, z, L * f, s, f, fill, g === null ? 0 : 1]; }, [alpha, firing ? 1 : 0, width, 0], L);
  }
  function sector({ cx, cz, y, a0, a1: A1, lo, hi, fill, firing, alpha = 1, ground }) {
    const mid = (lo + hi) / 2, arc = Math.abs(A1 - a0) * mid, N = Math.max(8, Math.ceil(arc / .45)), w = hi - lo;
    // along = arc length (sweep direction); across = radial. Emitted as radial rows so the grid bends.
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const r0 = lo + w * r / rows, r1 = lo + w * (r + 1) / rows;
      stripGrid(N, (i, s) => { const f = i / N, a = a0 + (A1 - a0) * f, rr = s ? r1 : r0, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr, g = ground ? ground(x, z) : y;
        return [x, (g ?? y) + .035, z, arc * f, (rr - lo) / w, f, fill, g === null ? 0 : 1]; }, [alpha, firing ? 1 : 0, w, 0], arc);
    }
  }
  function dot({ x, z, y, r }) {
    stripGrid(1, (i, s) => [x + (i ? r : -r), y + .03, z + (s ? r : -r), i, s, 0, 0, 1], [1, 0, 1, 1]);
  }
  function flush(t) {
    uniforms.uTime.value = t;
    geo.setDrawRange(0, n);
    for (const k of ['position', 'aLane', 'aStyle', 'aLen']) geo.attributes[k].needsUpdate = true; geo.index.needsUpdate = true;
    mesh.visible = n > 0; v = 0; n = 0;
  }
  return { line, sector, dot, flush, dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); }, mesh };
}
