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

const TAU = Math.PI * 2, HOVER = .8; // trail tip above the floor (4.8 m actor: hem ~2 m up)
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// Beat tables per phase (seconds). Every hazard has a >= 2 s painted telegraph.
// M3 escalation: phase 1 sweeps twice (second from the other side) before the breath settles; phase 2
// fires A/B twice and only then leaves the breath; phase 3 is a two-column climb (BEATS_TOP) when the
// world has a top perch + vent 'ring3', else the single-pulse version.
const BEATS = [
  [{ k: 'idle', d: 1.0 }, { k: 'inhale', d: 2.8, lane: 'sweep' }, { k: 'exhale', d: .9 }, { k: 'recoil', d: .5 }, { k: 'inhale', d: 2.2, lane: 'sweep2' }, { k: 'exhale', d: .9 }, { k: 'recoil', d: .5 }, { k: 'slump', d: 3.4 }],
  [{ k: 'inhale', d: 2.2, lane: 'A' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 }, { k: 'inhale', d: 2.2, lane: 'B' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 },
    { k: 'inhale', d: 1.9, lane: 'A2' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 }, { k: 'inhale', d: 1.9, lane: 'B2' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 }, { k: 'slump', d: 2.6 }],
  [{ k: 'inhale', d: 2.2, lane: 'up' }, { k: 'exhale', d: .55 }, { k: 'recoil', d: .45 }, { k: 'turn', d: .3 }, { k: 'inhale', d: 2.2, lane: 'L' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 }, { k: 'slump', d: 2.0 }],
];
const BEATS_TOP = [{ k: 'inhale', d: 2.2, lane: 'up' }, { k: 'exhale', d: .55 }, { k: 'recoil', d: .45 }, { k: 'turn', d: .3 }, { k: 'inhale', d: 2.2, lane: 'L' }, { k: 'exhale', d: .7 }, { k: 'recoil', d: .4 },
  { k: 'inhale', d: 2.2, lane: 'up2' }, { k: 'exhale', d: .55 }, { k: 'recoil', d: .45 }, { k: 'inhale', d: 2.0, lane: 'P' }, { k: 'exhale', d: .8 }, { k: 'recoil', d: .4 }, { k: 'slump', d: 1.6 }];
const RAGE = { windup: 1.8, speed: 6.5, settle: 1.1 };
// Breaths each vane needs (it visibly turns part-way per breath): the loop repeats with its volley, not padding.
const BREATHS_PER_VANE = [2, 2, 1];
const HOLD_AFTER_KNOCK = 2;

export function resolveWell(world) {
  const pts = world.points || {}, derived = [];
  const P = p => p && { x: p.x, y: p.y, z: p.z };
  const vents = Object.fromEntries((world.vents || []).map(v => [v.id, v]));
  let gw = pts.guardianWell;
  // Accept world.js's native shape too: {centre, rings:{low,mid,high:{y, r0, r1, safe, vane, catchPoint, vaneStand}}}.
  if (gw && !Array.isArray(gw.rings) && gw.rings?.low) gw = { center: gw.center || gw.centre, roots: gw.roots || pts.gallery?.returnChannel?.bottom, vents: gw.vents,
    rings: ['low', 'mid', 'high', 'top'].filter(k => gw.rings[k]).map(k => { const r = gw.rings[k]; return { y: r.y, inner: r.r0 ?? r.inner, outer: r.r1 ?? r.outer, safe: r.safe, vane: r.vane, catchPoint: r.catchPoint, stand: r.vaneStand || r.stand }; }) };
  if (gw?.center && gw.rings?.length >= 3) {
    const rings = gw.rings.map(r => r && ({ y: r.y, inner: r.inner ?? r.r0 ?? 0, outer: r.outer ?? r.r1 ?? 7.5, safe: P(r.safe), vane: P(r.vane), catchPoint: P(r.catchPoint) || null, stand: P(r.stand || r.vaneStand) || null }));
    const pulse2 = vents[gw.vents?.pulse2 || 'ring3'] || null;
    let top = rings[3] || (gw.top && { y: gw.top.y, safe: P(gw.top.safe), vane: P(gw.top.vane), catchPoint: P(gw.top.catchPoint) || null, inner: gw.top.inner ?? gw.top.r0, outer: gw.top.outer ?? gw.top.r1 }) || null;
    if (top && !pulse2) { derived.push('top perch without vent ring3: single-pulse phase 3'); top = null; }
    if (!top && pulse2) derived.push('vent ring3 without rings.top: single-pulse phase 3');
    if (top) { // perch extents default to a band around its anchors
      const c = gw.center, d = [top.safe, top.vane, top.catchPoint].filter(Boolean).map(p => Math.hypot(p.x - c.x, p.z - c.z));
      top.inner ??= Math.max(1, Math.min(...d) - 2.5); top.outer ??= Math.max(...d) + 2.5; top.vane ??= rings[2].vane;
    }
    return { center: P(gw.center), rings: rings.slice(0, 3), top, toMid: vents[gw.vents?.toMid || 'ring1'] || null, pulse: vents[gw.vents?.pulse || 'ring2'] || null, pulse2: top ? pulse2 : null, roots: P(gw.roots) || null, derived };
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
  return { center: P(c), rings, top: null, toMid: vents.ring1 || null, pulse: vents.ring2 || null, pulse2: null, roots: pts.roots ? P(pts.roots) : { x: c.x, y: c.y, z: c.z - 5 }, derived };
}

export function createGuardian({ THREE: T, scene, world, wind, movement = null, sound = () => {}, caption = () => {}, onEvent = () => {}, look = null } = {}) {
  const W = resolveWell(world), C = W.center;
  const LV = W.top ? [...W.rings, W.top] : W.rings;                 // levels: low, mid, high (+ top perch)
  const beatsOf = ph => ph === 2 && W.top ? BEATS_TOP : BEATS[ph];
  const cycleLength = ph => beatsOf(ph).reduce((s, b) => s + b.d, 0);
  const actor = buildGuardian(T, { height: 5.4 }); actor.name = 'bh-guardian-actor';
  const J = actor.userData.joints, setPose = actor.userData.setPose;
  scene.add(actor); look?.applyTo?.(actor, 'character');
  const bands = createBands(T, scene);
  const ground = (x, z, y) => { const g = world.ground?.(x, z, y + .4); return typeof g === 'number' && Math.abs(g - y) < .5 ? g : null; };
  const ang = p => Math.atan2(p.z - C.z, p.x - C.x), rad = p => Math.hypot(p.x - C.x, p.z - C.z);
  const at = (a, r, y) => ({ x: C.x + Math.cos(a) * r, y, z: C.z + Math.sin(a) * r });
  const ringOf = p => { let best = -1; for (let k = 0; k < LV.length; k++) if (p.y > LV[k].y - .6 && (best < 0 || LV[k].y > LV[best].y)) best = k; return Math.max(0, best); };
  // Radial extent of real floor along angle a on ring k (so lanes paint only where one can stand).
  function extent(k, a) {
    const R = LV[k]; let lo = null, hi = null;
    for (let r = Math.max(.8, R.inner - 1); r <= R.outer + 1.5; r += .25) { const p = at(a, r, R.y); if (ground(p.x, p.z, R.y) !== null) { lo ??= r; hi = r; } }
    return lo === null ? { lo: Math.max(1.2, R.inner), hi: R.outer } : { lo: k === 0 ? 1.3 : lo, hi };
  }

  // ---------------- state ----------------
  let phase = 0, clock = 0, cycle = -1, active = false, warned = false, doneT = -1, time = 0, gentle = false;
  let lanes = {}, hitThis = new Set(), loiterFrom = null, loiter = false, breath = null, stats = { hits: 0, cycles: 0, exhales: 0, pulses: 0, catches: 0 };
  const pose = { crouch: 0, bloom: 0, spread: 0, thrust: 0, slump: 0, lean: 0, swell: 0, fold: 0, rotorGlow: 0, eyes: 1, rage: 0, lx: 0, ly: 0 };
  let yaw = 0, rotorAngle = 0, hover = W.rings[0].y + HOVER, lastStage = '', stageStart = 0, beatInfo = null;
  const heroV = new T.Vector3(), mouth = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3();
  actor.position.set(C.x, hover, C.z);

  function beatAt(ph, c) {
    const beats = beatsOf(ph); let s = 0;
    for (let i = 0; i < beats.length; i++) { if (c < s + beats[i].d) return { i, b: beats[i], u: c - s, f: (c - s) / beats[i].d, start: s }; s += beats[i].d; }
    return { i: beats.length - 1, b: beats[beats.length - 1], u: beats[beats.length - 1].d, f: 1, start: s };
  }
  // The lane a telegraph beat will fire, planned when its inhale starts (then committed).
  function planLane(kind, hero) {
    const lane = planBase(kind, hero); lane.id = kind; return lane;
  }
  function planBase(kind, hero) {
    const heroRing = hero ? ringOf(hero) : 0, charged = !!wind?.charged;
    if (kind === 'up' || kind === 'up2') return { kind: 'up', vent: kind === 'up2' ? W.pulse2 : W.pulse };
    if (kind === 'P') { // vertical pulse on the top perch, between the last breath and vane 3
      const c = catchPoint(3), v = W.top.vane, T3 = W.top; const x = (c.x + v.x) / 2, z = (c.z + v.z) / 2;
      return { kind: 'pillar', ring: 3, x, z, y: ground(x, z, T3.y) ?? T3.y, r: 1.35, lo: 0, hi: 99 };
    }
    if (kind === 'A2') kind = 'A'; if (kind === 'B2') kind = 'B';
    if (kind === 'sweep' || kind === 'sweep2') {
      const R = W.rings[0], v = R.vane, onFloor = hero && heroRing === 0;
      let c0 = onFloor ? ang(hero) : ang(v);
      // Softened (route stall, 24 Sep): while a breath is waiting or carried, phase-1 sweeps never cover the
      // hero's direct path to it / to the vane; they sweep the far side of the floor instead. Before the breath
      // settles, the volley aims at the hero (standing still gets knocked).
      const goal = charged ? v : breathSrc();
      if (onFloor && goal) { const ga = Math.atan2(goal.z - hero.z, goal.x - hero.x), pa = ang(hero); c0 = pa + Math.PI + (wrap(ga - pa) > 0 ? -.9 : .9); }
      // The second sweep comes from the other side of the first.
      const s = kind === 'sweep2' ? -(lanes.sweep?.dir || 1) : (cycle % 2 ? 1 : -1), half = .5, e = extent(0, c0);   // ~57 deg wedge: only the swept danger, not the whole floor
      return { kind: 'sweep', dir: s, ring: 0, a0: c0 - half * s, a1: c0 + half * s, lo: e.lo, hi: Math.min(e.hi, R.outer), width: 1.7, end: at(c0 + half * s * .92, Math.min(e.hi, R.outer) - 2.0, R.y) };
    }
    // Ring lanes are stretches of ledge the breath runs along (a travelling front), painted end to end.
    const k = kind === 'L' ? 2 : 1, R = W.rings[k];
    if (loiter && hero && heroRing > 0) { const r = mid(heroRing), h = 2.6 / r, a = ang(hero), d = (cycle % 2 ? 1 : -1); return arcLane(kind, heroRing, a - d * h, a + d * h, true); }
    const av = ang(R.vane), ev = extent(k, av), r = Math.max(2, (ev.lo + ev.hi) / 2), m = x => x / r;
    if (kind === 'L') { // between the high-ring landing and the next target (vane 3, or the ring3 grille when climbing)
      const tgt = W.top ? W.pulse2 : R.vane, at2 = ang(tgt), ac = ang(catchPoint(2)), d = wrap(at2 - ac);
      return arcLane(kind, 2, ac + d * .18, ac + d * (W.top ? .66 : .8), false);
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
  const mid = k => { const R = LV[k]; return Math.max(2, (R.inner + R.outer) / 2); };
  function arcLane(id, k, a0, a1, aimed, rr = null) {
    const R = LV[k], e = extent(k, (a0 + a1) / 2), lo = Math.max(e.lo, R.inner), hi = Math.min(e.hi, R.outer), rm = rr ?? (lo + hi) / 2;
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
    if (k === 3) return W.top.catchPoint || (W.pulse2?.ledge && Math.abs(W.pulse2.ledge.y - W.top.y) < 1 ? W.pulse2.ledge : W.top.safe);
    if (k === 2 && W.top) { const l = W.pulse?.ledge; return l && Math.abs(l.y - W.rings[2].y) < 1 ? l : W.rings[2].safe; }
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
    const near = hero && rad(hero) < LV[LV.length - 1].outer + 4 && hero.y < LV[LV.length - 1].y + 8 && hero.y > C.y - 3;
    active = o.active !== false && phase < 3 && !!near;
    if (phase >= 3) { doneT += dt; actTend(dt, t); bands.flush(t); return; }
    if (!active) { clock = 0; cycle = -1; lanes = {}; actIdle(dt, t, 'idle'); bands.flush(t); return; }
    if (!warned) { warned = true; }
    if (rage) { runRage(dt, t, hero); tickVents(dt); bands.flush(t); return; }
    // After a knock the next telegraph waits HOLD_AFTER_KNOCK s (frozen at its start) before it counts down.
    if (hold > 0) { const Bh = beatAt(phase, clock % cycleLength(phase)); if (Bh.b.k === 'inhale' && Bh.f < .05 || Bh.b.k === 'idle') { hold -= dt; beatInfo = Bh; const kh = Bh.b.k + Bh.i; if (kh !== lastStage) { lastStage = kh; enterBeat(Bh, hero); } runBeat(Bh, dt, t, hero); tickVents(dt); bands.flush(t); return; } }
    clock += dt;
    const L = cycleLength(phase), c = Math.floor(clock / L), cc = clock - c * L;
    if (c !== cycle) { // new cycle: loiter check (standing still for one whole cycle gets targeted)
      if (cycle >= 0 && hero) {
        // Waiting on a grille for an updraft (or riding one) is play, not loitering.
        const atVent = [W.toMid, W.pulse, W.pulse2].some(v => v && Math.hypot(hero.x - v.x, hero.z - v.z) < (v.radius || 1) + 1.2 && Math.abs(hero.y - v.y) < 1);
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
  // ---------------- rage beat (between phases) ----------------
  let rage = null, hold = 0;
  const breathSrc = () => { const b = wind?.sources?.get?.('guardianBreath'); return b && b.active ? b : null; };
  const rageFront = () => rage.lo + (rage.t - RAGE.windup) * RAGE.speed;
  function runRage(dt, t, hero) {
    rage.t += dt; beatInfo = null;
    const R = W.rings[rage.ring], w = RAGE.windup, travel = (rage.hi - rage.lo) / RAGE.speed, end = w + travel + RAGE.settle, face = hero ? Math.atan2(hero.x - C.x, hero.z - C.z) : yaw;
    const gr = (x, z) => ground(x, z, R.y);
    hover += (R.y + HOVER + (rage.t < w ? 1.6 * ease(rage.t / w) : 1.6 * (1 - ease((rage.t - w) / .25))) - hover) * (1 - Math.exp(-dt * 6));
    if (rage.t < w) { // rise and flare; the whole ring floor is painted and fills as the timer
      const f = rage.t / w, e = ease(f);
      applyActor(dt, t, { crouch: 0, bloom: 1, spread: .6 * e, thrust: 0, slump: 0, lean: 0, swell: .7 * e, fold: 0, rotorGlow: .6 * f, rage: e }, 10, face, { x: .45 * e, y: 0 });   // rears up: petals flared, arms raised, heart red-gold
      bands.sector({ cx: C.x, cz: C.z, y: R.y, a0: 0, a1: TAU, lo: rage.lo, hi: rage.hi, fill: f, firing: false, alpha: .7, t, ground: gr });
      drawInhale(f, t);
      if (!rage.slammed && f > .98) { rage.slammed = true; }
    } else if (rage.t < w + travel) {
      if (!rage.boom) { rage.boom = true; sound('guardian-slam'); wind?.burst?.({ x: C.x, y: R.y, z: C.z }, { radius: 3.5, duration: .7, rays: 14 }); }
      const fr = rageFront();
      applyActor(dt, t, { crouch: 1, bloom: .6, spread: .5, thrust: .6, slump: 0, lean: .5, swell: .4, fold: 0, rotorGlow: .8, rage: .7 }, 30, face, { x: -.5, y: 0 });
      bands.sector({ cx: C.x, cz: C.z, y: R.y, a0: 0, a1: TAU, lo: Math.max(rage.lo, fr - .45), hi: Math.min(rage.hi, fr + .45), fill: 1, firing: true, alpha: 1, t, ground: gr });
      if (wind) { // a standing wall of wind rolling outward (not just a floor band)
        wind.ring(C.x, R.y + .3, C.z, fr, { width: .7, alpha: 1, taper: false, n: 64 }); wind.ring(C.x, R.y + .95, C.z, fr - .12, { width: .35, alpha: .9, taper: false, n: 64 }); wind.ring(C.x, R.y + 1.5, C.z, fr - .3, { width: .18, alpha: .6, taper: false, n: 64 });
        for (let i = 0; i < 28; i++) { const a = i / 28 * TAU + t * .7, h = 1.1 + .45 * Math.sin(i * 2.3 + t * 9); wind.strip(5, (g, o) => o.set(C.x + Math.cos(a) * (fr - g * .3), R.y + .1 + g * h, C.z + Math.sin(a) * (fr - g * .3)), { width: .2, alpha: .8 }); } }
      if (hero && !rage.hit && !movement?.knocked && Math.abs(hero.y - R.y) < 1.1 && Math.abs(rad(hero) - fr) < .45) {
        const why = safeReason(hero); if (why) spared = { reason: why + ' (shockwave)', at: +time.toFixed(2) }; else { rage.hit = true; beatInfo = { i: -1 }; knock(hero, ang(hero)); }
      }
    } else {
      applyActor(dt, t, { crouch: .2, bloom: .1, spread: 0, thrust: 0, slump: .4, lean: .2, swell: 0, fold: 0, rotorGlow: .3 }, 4, face, { x: -.2, y: 0 });
      if (rage.t >= end) { rage = null; lastStage = ''; }
    }
  }
  function enterBeat(B, hero) {
    B = { ...B };
    const k = B.b.k;
    if (k === 'inhale') { current = planLane(B.b.lane, hero); lanes[B.b.lane] = current; sound('guardian-inhale'); }
    if (k === 'exhale') {
      stats.exhales++; sound('guardian-exhale');
      if (current?.kind === 'up') firePulse(current);
    }
    if (k === 'recoil' && current && current.kind !== 'up' && current.kind !== 'pillar') spawnBreath(current, B);
  }
  function spawnBreath(lane, B) {
    // Phase 1: sweep end. Phase 2: only lane A leaves a catchable breath (B is the crossing lane). Phase 3: see firePulse.
    // The window stays open until the same lane is about to fire again (shown by the emptying ring).
    // M3: the breath settles only after the whole volley (sweep + sweep2; A, B, A2, B2), and stays until the
    // volley's last-but-one lane fires again next cycle (its countdown ring shows the window).
    const until = id => { const beats = beatsOf(phase); let s = 0; for (let i = 0; i < beats.length; i++) { if (beats[i].k === 'exhale' && beats[i - 1]?.lane === id) return s; s += beats[i].d; } return 0; };
    const L = cycleLength(phase);
    if (phase === 0 && lane.id === 'sweep2') offerBreath(lane.end, L - B.start + until('sweep2') - .3);
    if (phase === 1 && lane.id === 'B2') { const a = [lanes.A2, lanes.A].find(l => l && !l.aimed); offerBreath(a ? a.end : (W.rings[1].catchPoint || W.rings[1].safe), L - B.start + until('A2') - .3); }
  }
  function offerBreath(p, ttl) {
    if (!wind || wind.charged) return;
    const y = ground(p.x, p.z, p.y) ?? p.y;
    wind.addSource('guardianBreath', { x: p.x, y, z: p.z, radius: 1.3, repeat: false, ttl, kind: 'guardian' });
    breath = { x: p.x, y, z: p.z, opensAt: time, closesAt: time + ttl, ttl };
    onEvent({ breath: { x: p.x, y, z: p.z, radius: 1.3, opensAt: +time.toFixed(2), closesAt: +(time + ttl).toFixed(2), ttl: +ttl.toFixed(2), phase } });
  }
  function firePulse(lane) {
    const v = lane?.vent || W.pulse; if (!v) return;
    stats.pulses++;
    const duration = 4.4;
    wind?.openVent?.(v, { duration });
    onEvent({ updraft: { id: v.id, x: v.x, y: v.y, z: v.z, top: v.top, duration, pulse: true } });
    // The last breath waits where the (last) pulse lands until that pulse comes round again.
    if (!W.top) pendingBreath = { at: time + 1.0, p: catchPoint(2), ttl: cycleLength(2) - .3 };
    else if (v === W.pulse2) pendingBreath = { at: time + 1.0, p: catchPoint(3), ttl: cycleLength(2) - .3 };
  }
  let pendingBreath = null, ventTimer = 0;
  function tickVents(dt) {
    if (pendingBreath && time >= pendingBreath.at) { offerBreath(pendingBreath.p, pendingBreath.ttl); pendingBreath = null; }
    // After vane 1 the floor grille breathes on its own (4.2 s column, 2 s rest) so the mid ring is always reachable.
    if (phase >= 1 && W.toMid && (ventTimer -= dt) <= 0) { ventTimer = 6.2; wind?.openVent?.(W.toMid, { duration: 4.2 }); onEvent({ updraft: { id: W.toMid.id, x: W.toMid.x, y: W.toMid.y, z: W.toMid.z, top: W.toMid.top, duration: 4.2, pulse: false } }); }
  }

  // Beat behaviour: telegraph paint, acting targets, ribbons, hits.
  function runBeat(B, dt, t, hero) {
    const k = B.b.k, lane = current, R = lane && lane.ring !== undefined ? LV[lane.ring] : W.rings[Math.min(phase, 2)];
    // Phase 3 climbs with the hero so the hood stays in frame on every level.
    const hy = hero ? LV[ringOf(hero)].y : W.rings[1].y;
    const hoverTarget = (phase === 0 ? W.rings[0].y : phase === 1 ? W.rings[1].y - .6 : Math.max(W.rings[1].y - .4, Math.min(hy - .8, (W.top ? W.rings[2].y : W.rings[1].y) + .4))) + HOVER;
    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 1.2));
    // Facing: toward the lane (sweep follows its sweeping angle), else the hero.
    let face = hero ? Math.atan2(hero.x - C.x, hero.z - C.z) : yaw, look = { x: -.25, y: 0 };
    let target = { crouch: 0, bloom: .05, spread: 0, thrust: 0, slump: 0, lean: 0, swell: 0, fold: 0, rotorGlow: .1 }, rate = 6;
    const laneAngle = a => Math.atan2(Math.cos(a), Math.sin(a)); // world ring angle -> actor yaw (atan2(dx,dz))
    // Face the hero between breaths (audit: >= 50% of the cycle toward the camera/hero); turn onto the lane
    // only through the second half of the inhale and during the exhale itself.
    let laneFace = null;
    if (lane?.kind === 'sweep') laneFace = laneAngle(k === 'exhale' ? lane.a0 + (lane.a1 - lane.a0) * ease((B.u - .12) / (B.b.d - .12)) : lane.a0 + (lane.a1 - lane.a0) * .15);
    else if (lane?.kind === 'pillar') laneFace = Math.atan2(lane.x - C.x, lane.z - C.z);
    else if (lane?.kind === 'arc') laneFace = laneAngle(lane.a0 + (lane.a1 - lane.a0) * (k === 'exhale' ? ease(B.u / B.b.d) : .3));
    if (laneFace !== null && (k === 'exhale' || k === 'inhale')) { const w = k === 'exhale' ? 1 : ease((B.f - .45) / .4); face = face + wrap(laneFace - face) * w; }
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
      target = { crouch: .25 * s, bloom: -.2 * s, spread: 0, thrust: 0, lean: .35 * s, slump: s, swell: 0, rotorGlow: .05 + .1 * (1 - s), fold: 0, eyes: 1 - .6 * s };
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
    hover += ((W.rings[0].y + HOVER) - hover) * (1 - Math.exp(-dt));
    applyActor(dt, t, target, 3, yaw, { x: -.1, y: 0 });
  }
  function actTend(dt, t) {
    // Fold (3 s), turn to the roots, sink, then tend: slow breaths, hands brushing the roots.
    const R = W.roots || { x: C.x, y: C.y, z: C.z - 5 }, f = ease(doneT / 3), b = Math.sin(t * .8);
    const face = Math.atan2(R.x - C.x, R.z - C.z);
    hover += ((W.rings[0].y + .45) - hover) * (1 - Math.exp(-dt * .6));
    const toward = Math.min(1, doneT / 4);
    actor.position.x += ((C.x + (R.x - C.x) * .45 * toward) - actor.position.x) * (1 - Math.exp(-dt));
    actor.position.z += ((C.z + (R.z - C.z) * .45 * toward) - actor.position.z) * (1 - Math.exp(-dt));
    // The hood stays half open in the ending so the calm face (eyes peacefully closed) holds the shot.
    applyActor(dt, t, { crouch: .3 * f, bloom: .5 * f + .06 * b * f, spread: 0, thrust: 0, slump: 0, lean: .35 * f, swell: .05 * b, fold: f * (.85 + .15 * b), rotorGlow: .15 + .05 * b, eyes: 1 - .88 * ease((doneT - 1.5) / 2) }, 2.5, face, { x: -.35 * f, y: 0 }, true);
  }
  function applyActor(dt, t, target, rate, face, look, keepXZ = false) {
    if (target.eyes === undefined) target.eyes = 1; if (target.rage === undefined) target.rage = 0;
    const m = gentle ? .6 : 1, a = 1 - Math.exp(-rate * dt);
    for (const key of Object.keys(target)) pose[key] += (target[key] - pose[key]) * a;
    pose.lx += (look.x - pose.lx) * a; pose.ly += (look.y - pose.ly) * a;
    yaw += wrap(face - yaw) * (1 - Math.exp(-dt * (rate > 20 ? 14 : 4)));
    rotorAngle += dt * (.4 + 16 * pose.rotorGlow * pose.rotorGlow) * (gentle ? .5 : 1);
    const tremble = beatInfo?.b?.k === 'inhale' && beatInfo.f > .7 && !gentle ? Math.sin(t * 55) * .012 * (beatInfo.f - .7) / .3 : 0;
    setPose({ ...pose, look: { x: pose.lx, y: pose.ly }, rotor: rotorAngle, trail: Math.sin(t * 1.7) * .08 * m + tremble * 4, trailPitch: Math.sin(t * 1.1) * .05 * m });
    actor.rotation.y = yaw;
    if (!keepXZ) { actor.position.x += (C.x - actor.position.x) * (1 - Math.exp(-dt * 2)); actor.position.z += (C.z - actor.position.z) * (1 - Math.exp(-dt * 2)); }
    actor.position.y = hover + Math.sin(t * 1.3) * .12 * m + tremble;
    actor.updateMatrixWorld(true);
  }

  // ---------------- telegraph + ribbons ----------------
  function paintTelegraph(lane, f, t, firing = false, alpha = 1) {
    if (!lane) return;
    if (lane.kind === 'pillar') { bands.sector({ cx: lane.x, cz: lane.z, y: lane.y, a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU, lo: .12, hi: lane.r, fill: f, firing, alpha, t, ground: (x, z) => ground(x, z, lane.y) }); return; }
    if (lane.kind === 'up') { const v = lane.vent; if (v) bands.sector({ cx: v.x, cz: v.z, y: v.y, a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU, lo: (v.radius || 1) + .15, hi: (v.radius || 1) + .75, fill: f, firing, alpha, t, ground: null }); return; }
    const R = LV[lane.ring];
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
      const v = lane.vent, top = (v ? v.top : W.rings[2].y) + 4.5;
      if (wind) { for (let i = 0; i < 3; i++) wind.strip(28, (g, o) => { const a = g * 6 + i * 2.1 + t * 6; o.set(mouth.x + Math.cos(a) * .5 * (1 - g * .3), mouth.y + (top - mouth.y) * g, mouth.z + Math.sin(a) * .5); }, { width: i ? .35 : .9, alpha: 1, from: tail, to: Math.max(tail + .02, front) });
        if (v) wind.arc(mouth.clone(), new T.Vector3(v.x, v.y + .5, v.z), 1.2, { width: .5, alpha: .9, from: tail, to: front }); }
      return;
    }
    if (lane.kind === 'pillar') { // the breath slams down onto the perch and erupts straight up in a pillar
      if (wind) { if (B.u < .3) wind.arc(mouth.clone(), new T.Vector3(lane.x, lane.y + .4, lane.z), 1.5, { width: .7, alpha: 1, from: 0, to: B.u / .3 });
        const k = clamp01((B.u - .15) / .25), fade = 1 - clamp01((B.f - .8) / .2);
        for (let i = 0; i < 4; i++) wind.helix(lane.x, lane.y + .1, lane.z, lane.y + .2 + 5.5 * k, lane.r * (.45 + .12 * i), 1.8, t * 7 + i * 1.57, { width: .32, alpha: fade, n: 36 });
        wind.ring(lane.x, lane.y + .06, lane.z, lane.r, { width: .3, alpha: fade, taper: false }); }
      if (!hero || hitThis.has(B.i) || movement?.knocked || B.u < .2) return;
      if (safeReason(hero)) { spared = { reason: safeReason(hero), at: +time.toFixed(2) }; return; }
      if (Math.abs(hero.y - lane.y) < 1.1 && Math.hypot(hero.x - lane.x, hero.z - lane.z) < lane.r + .25) knock(hero, Math.atan2(hero.z - lane.z, hero.x - lane.x));
      return;
    }
    const R = LV[lane.ring], h = R.y + .95, sweep = lane.kind === 'sweep';
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
    const hr = rad(hero), guard = safeReason(hero);
    if (guard) { spared = { reason: guard, at: +time.toFixed(2) }; return; }
    if (Math.abs(hero.y - R.y) >= 1.1 || hr < lane.lo - .3 || hr > lane.hi + .4) return;
    const done = wrap(a - lane.a0), ha = wrap(ang(hero) - lane.a0), pad = .5 / Math.max(1, hr);
    const hit = (sweep ? snap >= 1 : true) && (done >= 0 ? ha >= -pad && ha <= done + pad : ha <= pad && ha >= done - pad);
    if (hit) knock(hero, sweep ? a : a + Math.PI / 2 * Math.sign(lane.a1 - lane.a0));
  }
  // Knock rules (M2): a knock clears the player's held input (movement.knockback), so the guardian never
  // knocks while the hero is (a) riding an updraft column (movement.lifting), (b) airborne above a ring
  // (jumping/falling), or (c) within 1.5 m of a grille rim (standing on it, or on the ledge approach to it).
  const KNOCK_RULES = ['not lifting (riding a column)', 'grounded (a jump clears lanes and the rage shockwave)', 'farther than grille radius + 1.5 m from every grille (waiting for a column is never punished)'];
  let spared = null;
  function safeReason(hero) {
    if (movement?.lifting) return 'lifting';
    if (movement && !movement.grounded) return 'airborne';
    for (const v of world.vents || []) if (Math.abs(hero.y - v.y) < 1.5 && Math.hypot(hero.x - v.x, hero.z - v.z) < (v.radius || 1) + 1.5) return 'near grille ' + v.id;
    return null;
  }
  // Map lane progress (0..1 along the lane) into the ribbon parameter (the dive takes the first 30%).
  const s2g = f => .3 + .7 * f;
  function knock(hero, a) {
    hitThis.add(beatInfo.i); stats.hits++; hold = HOLD_AFTER_KNOCK; // the next volley waits while the hero recovers
    const k = ringOf(hero), s = LV[k].safe, to = [s.x, (ground(s.x, s.z, LV[k].y) ?? LV[k].y), s.z];
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
    // Three-arm spiral, thick outer ring, countdown ring, rising glow column and twinkling sparkles.
    for (let i = 0; i < 3; i++) wind.strip(34, (g, o) => { const a = i * TAU / 3 + t * 2.2 * spin + g * 4.6, r = .2 + g * 1.7; o.set(s.x + Math.cos(a) * r, s.y + .08 + g * .04, s.z + Math.sin(a) * r); }, { width: .42, alpha: 1, flat: true });
    wind.ring(s.x, s.y + .06, s.z, 2.05, { width: .34, alpha: .9, taper: false });
    wind.ring(s.x, s.y + .09, s.z, 2.55, { width: .24, alpha: .95 * warn, taper: false }, -Math.PI / 2, -Math.PI / 2 + TAU * left);
    for (let i = 0; i < 2; i++) wind.helix(s.x, s.y + .2, s.z, s.y + 3.2, .55 + .15 * i, 1.4, t * 3 * spin + i * Math.PI, { width: .22, alpha: .75, n: 30 });
    for (let i = 0; i < 10; i++) { const ph = (t * (.7 + i * .07) + i * .37) % 1, a = i * 2.39 + t * .5, r = .6 + (i % 4) * .45, y = s.y + .3 + ph * 2.6, tw = Math.sin(ph * Math.PI);
      wind.strip(4, (g, o) => o.set(s.x + Math.cos(a) * r, y + (g - .5) * .28, s.z + Math.sin(a) * r), { width: .16 * tw + .04, alpha: .95 * tw, taper: false }); }
    bands.dot({ x: s.x, z: s.z, y: s.y, r: 2.1, t });
  }

  // ---------------- interaction ----------------
  const vaneOf = k => k === 2 && W.top ? W.top.vane : W.rings[k].vane;
  function context(p, yaw_, charged = wind?.charged) {
    if (phase >= 3) return null;
    const v = vaneOf(phase);
    if (!charged) {
      const src = wind?.sourceAt?.(p);
      if (src?.id === 'guardianBreath') return { kind: 'catch', id: 'guardianBreath', label: 'Catch the spent breath', target: new T.Vector3(src.x, src.y + .9, src.z), anim: 'capture', owner: 'guardian' };
      if (Math.hypot(p.x - v.x, p.z - v.z) < 2.6 && Math.abs(p.y - v.y) < 2) return { kind: 'info', id: 'vane', label: `Return vane ${phase + 1}/3 · ${vaneLeft()} · needs the guardian’s breath`, target: new T.Vector3(v.x, v.y + 1.2, v.z), owner: 'guardian', why: 'This vane turns only on the guardian’s own spent breath: the glowing swirl where its lane ends.' };
      return null;
    }
    if (Math.hypot(p.x - v.x, p.z - v.z) < 5 && Math.abs(p.y - v.y) < 2.5) return { kind: 'give', id: 'vane', label: `Give the breath to vane ${phase + 1}/3 · ${vaneLeft()}`, target: new T.Vector3(v.x, v.y + 1.2, v.z), anim: 'release', owner: 'guardian' };
    return null;
  }
  function interact(ctx, { staffTip } = {}) {
    if (!ctx) return false;
    if (ctx.kind === 'catch') { const ok = wind.catchFrom('guardianBreath', staffTip); if (ok) { stats.catches++; breath = null; } return ok; }
    if (ctx.kind === 'give') {
      if (wind.charge?.kind !== 'guardian') { wind.release('spill', staffTip, ctx.target); caption('Ordinary wind slips through the vane. It needs the guardian’s own breath.', 4); return true; }
      const k = phase;
      wind.release('give', staffTip, ctx.target, { onArrive: () => feedVane(k) });
      return true;
    }
    if (ctx.kind === 'info') { caption(ctx.why, 5); return true; }
    return false;
  }
  let fed = 0; // breaths given to the current vane
  const vaneLeft = () => `${fed}/${BREATHS_PER_VANE[Math.min(phase, 2)]} breaths`;
  function feedVane(k) {
    if (phase !== k) return;
    fed++;
    if (fed < BREATHS_PER_VANE[k]) { // part turn: the vane creaks round, the volley goes on
      world.setRestored?.('vane' + (k + 1), fed / BREATHS_PER_VANE[k]); sound('restore');
      const v = vaneOf(k); onEvent({ vane: { index: k + 1, at: [v.x, v.y, v.z], fed, of: BREATHS_PER_VANE[k] } }); return;
    }
    fed = 0; powerVane(k);
  }
  function powerVane(k) {
    if (phase !== k) return;
    phase = k + 1; clock = 0; cycle = -1; lanes = {}; current = null; lastStage = ''; loiter = false; pendingBreath = null;
    wind?.removeSource?.('guardianBreath'); breath = null;
    world.setRestored?.('vane' + (k + 1), 1); sound('restore');
    const v = vaneOf(k), safe = (k === 2 && W.top ? W.top : W.rings[k]).safe;
    // Between phases: a short rage beat (rise, flare, slam) with a floor shockwave to jump over.
    if (phase < 3) { const R = W.rings[k], e = extent(k, ang(v)); rage = { t: 0, ring: k, lo: k === 0 ? 1.4 : Math.max(R.inner, e.lo), hi: k === 0 ? R.outer : Math.min(R.outer, e.hi + .3), hit: false }; }
    if (phase === 3) { doneT = 0; sound('guardian-fold'); }
    onEvent({ vane: { index: k + 1, at: [v.x, v.y, v.z] }, phase, checkpoint: [safe.x, safe.y, safe.z], ...(phase === 3 ? { done: true } : {}) });
    if (phase === 1) ventTimer = .6;
  }

  function stage() { return phase >= 3 ? (doneT < 3 ? 'fold' : 'tend') : rage ? 'rage' : !active ? 'idle' : beatInfo?.b?.k || 'idle'; }
  const box = new T.Box3();
  return {
    actor, object: actor, layout: W, update, context, interact,
    get phase() { return phase; }, get done() { return phase >= 3; }, get stage() { return stage(); },
    get lane() { return current; }, get pose() { return { ...pose }; },
    subject() { actor.updateMatrixWorld(true); return box.setFromCenterAndSize(tmp.copy(actor.position).add(tmp2.set(0, 2.7, 0)), tmp2.set(3.8, 5.2, 3.8).clone()); },
    objective() { return phase >= 3 ? null : ['Dodge the breath, catch it, turn vane 1/3', 'Ride the grille up; catch after the volley; vane 2/3', W.top ? 'Ride two updrafts to the perch; turn vane 3/3' : 'Ride the upward breath; turn vane 3/3'][phase] + (BREATHS_PER_VANE[Math.min(phase, 2)] > 1 ? ` (${vaneLeft()})` : ''); },
    target() { if (phase >= 3) return null; const v = vaneOf(phase); return new T.Vector3(v.x, v.y, v.z); },
    serialize() { return { phase }; },
    restore(d) { rage = null; hold = 0; fed = 0; phase = Math.max(0, Math.min(3, d?.phase | 0)); for (let k = 1; k <= phase; k++) world.setRestored?.('vane' + k, 1); clock = 0; cycle = -1; lastStage = ''; doneT = phase >= 3 ? 10 : -1; },
    reset() { rage = null; hold = 0; fed = 0; phase = 0; clock = 0; cycle = -1; warned = false; lastStage = ''; lanes = {}; current = null; doneT = -1; loiter = false; pendingBreath = null; stats = { hits: 0, cycles: 0, exhales: 0, pulses: 0, catches: 0 }; },
    telemetry() {
      const B = beatInfo?.b ? beatInfo : null, L = phase < 3 ? cycleLength(phase) : 0;
      return { phase, stage: stage(), beat: B ? B.b.k + (B.b.lane ? ':' + B.b.lane : '') : null, beatLeft: B ? +(B.b.d - B.u).toFixed(2) : null, clock: +clock.toFixed(2), cycle: L ? +(clock % L).toFixed(2) : 0,
        lane: current ? { kind: current.kind, id: current.id || current.kind, ring: current.ring, aimed: !!current.aimed } : null, loiter, fed, need: BREATHS_PER_VANE[Math.min(phase, 2)], hold: +hold.toFixed(2), rage: rage ? { t: +rage.t.toFixed(2), ring: rage.ring, front: rage.t > RAGE.windup ? +rageFront().toFixed(2) : null, lo: rage.lo, hi: rage.hi } : null, climb: !!W.top, knockRules: KNOCK_RULES, spared, heroSafe: heroV ? safeReason(heroV) : null, breath: breath ? { ...breath, left: +(breath.closesAt - time).toFixed(2) } : null, ...stats, derived: W.derived };
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
  const uniforms = { uTime: { value: 0 }, uInk: col(0x2A1E1C), uDeep: col(0x9A4A3A), uHot: col(0xC0725A), uCream: col(0xFBE7C4), uHalo: col(0x2C4A45) };
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
        float fill=smoothstep(vL.w-.015,vL.w+.015,vL.z)<.5?1.:0.;   // the fill sweeps along the lane: it IS the timer
        float lead=(1.-smoothstep(0.,.05,abs(vL.z-vL.w)))*step(vL.w,.995)*step(.01,vL.w);
        float flash=vL.w>.8&&vS.y<.5 ? .5+.5*sin(uTime*22.) : 0.;
        float mid=1.-abs(ac-.5)*2.;                                   // painted gradient: deep at the rims, warm in the middle
        vec3 painted=mix(deep,hot,.25+.55*mid*mid);
        vec3 c=mix(mix(deep,cream,.35),painted,fill);                 // unfilled = pale coral wash
        float a=mix(.2,.6,fill);                                        // painterly: the floor mosaic shows through
        float spd=vS.y>.5?9.:1.2+vL.w*3.;
        float ch=fract((vL.x+abs(ac-.5)*min(w,2.2)*.9)/1.7-uTime*spd*.8);
        float chev=smoothstep(.0,.03,ch)*(1.-smoothstep(.17,.21,ch))*smoothstep(.3,.36,e)*step(abs(ac-.5)*w,.95);
        c=mix(c,cream,chev*mix(.35,.7,fill)); a=max(a,chev*mix(.3,.65,fill));
        c=mix(c,vec3(1.,.93,.7),lead*.9); a=max(a,lead*.95);              // bright leading edge of the fill
        c=mix(c,hot*1.25,flash*fill*.35);
        float border=1.-smoothstep(.07,.11,e), soft=smoothstep(0.,.03,e); // dark ink border, soft outer edge
        c=mix(c,uInk,border);
        a=mix(a,.92,border)*soft;                                        // the ink edge carries the >=3:1 contrast
        gl_FragColor=vec4(c,a*vS.x);
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
