// v2 progression for Bellhollow (REDESIGN.md beat sheet). Owns beats, contexts, objectives, gust
// sources and save data. Never owns locomotion or rendering: it asks wind.js for verbs/visuals,
// tells the world how restored each area is (world.setRestored), and reports checkpoints,
// knock-backs, the finale and completion to main through onChange(progress, event).
//
// Contexts: context(p, yaw) -> {kind, id, label, target, anim} | null
//   kind: catch | give | vent | push | ring | talk | pick | read | lever | info
//   anim (for main's staff/arm action): capture | release | pull | null (info resolves at once)
// Events (second onChange argument, at most one of each per call):
//   {checkpoint:[x,y,z]}  {restored:area}  {knock:{to:[x,y,z]}|{x,z,power}}
//   {finale:{duration}}  {teleport:[x,y,z]}  {complete:true}  {cue:'far-bell'}
import { createGuardian as createGuardianStub } from './guardian-stub.js';

export const QUEST_VERSION = 2;
// Anchors the world must provide in world.points ({x,y,z}); fragment1..3 and farBell optional.
export const REQUIRED_POINTS = ['start', 'morningBell', 'mara', 'maraOutlet', 'seedWheel', 'seedOutlet', 'terraceGate', 'loft', 'loftGust',
  'sailsGust', 'laddersGust1', 'laddersGust2', 'laddersGust3', 'millSails', 'millPipes', 'millLadders', 'skyBridge', 'hollowGate',
  'carvingOut', 'carvingReturn', 'arena', 'guardian', 'vane1', 'vane2', 'vane3', 'ring1', 'ring2', 'ring3', 'bellOut', 'bellReturn', 'finale', 'finaleSpot'];
export const REQUIRED_VENTS = ['loft', 'ladders1', 'ladders2', 'ladders3', 'ring1', 'ring2'];
export const REQUIRED_WHEELS = ['seed', 'pipesA', 'pipesB', 'millSails', 'millPipes', 'millLadders'];
export const REQUIRED_SAILS = ['sailsBridge', 'laddersShutter'];
const FLAGS = ['bell', 'bypass', 'staff', 'seed', 'loft', 'sailsBridge', 'sails', 'pipesA', 'pipesB', 'pipes', 'ladders', 'skyBridge', 'hollow',
  'carvingOut', 'carvingReturn', 'guardian', 'bellOut', 'bellReturn', 'finale', 'complete'];
const MILLS = { sails: 'millSails', pipes: 'millPipes', ladders: 'millLadders' };
const MILL_NAMES = { sails: 'Mill of Sails', pipes: 'Mill of Pipes', ladders: 'Mill of Ladders' };

export function validateWorld(world) {
  const missing = [];
  for (const k of REQUIRED_POINTS) if (!['x', 'y', 'z'].every(a => Number.isFinite(world.points?.[k]?.[a]))) missing.push('points.' + k);
  for (const k of REQUIRED_VENTS) if (!world.vents?.some(v => v.id === k)) missing.push('vents.' + k);
  for (const k of REQUIRED_WHEELS) if (!world.wheels?.some(v => v.id === k)) missing.push('wheels.' + k);
  for (const k of REQUIRED_SAILS) if (!world.sails?.some(v => v.id === k)) missing.push('sails.' + k);
  return missing;
}

export function createQuest({ THREE: T, scene, world, wind, movement, caption = () => {}, sound = () => {}, onChange = () => {}, createGuardian = createGuardianStub }) {
  const missing = validateWorld(world);
  if (missing.length) console.warn('Bellhollow world is missing quest anchors:', missing.join(', '));
  const pts = world.points, V = p => new T.Vector3(p.x, p.y, p.z);
  const vents = Object.fromEntries((world.vents || []).map(v => [v.id, v]));
  const wheels = Object.fromEntries((world.wheels || []).map(v => [v.id, v]));
  const sails = Object.fromEntries((world.sails || []).map(v => [v.id, v]));
  const progress = Object.fromEntries(FLAGS.map(k => [k, false]));
  const reached = {}; const fragments = new Set(); const seen = new Set();
  let bypassAt = Infinity, time = 0, finaleT = -1, last = null, pendingCaption = null;
  const guardian = createGuardian({ THREE: T, scene, world, wind, movement, sound, caption, onEvent: e => guardianEvent(e) });
  const d2 = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  const near = (p, q, r = 2.2, h = 2) => q && d2(p, q) <= r && Math.abs(p.y - q.y) <= h;
  const millsDone = () => ['sails', 'pipes', 'ladders'].filter(k => progress[k]).length;
  const emit = (event = {}) => (onChange({ ...progress }, event), true);
  const say = (text, seconds = 5) => caption(text, seconds);
  function later(delay, fn) { pendingCaption = { at: time + delay, fn }; }

  // ---- world + wind state that follows from progress (idempotent; used live and on restore) ----
  const restoration = {};
  function applyWorld() {
    const m = millsDone();
    restoration.terrace = progress.complete ? 1 : progress.seed ? .5 + m * .1 : 0;
    for (const k of ['sails', 'pipes', 'ladders']) restoration[k] = progress[k] ? 1 : 0;
    restoration.skyBridge = m / 3;
    restoration.hollow = progress.bellReturn ? 1 : progress.guardian ? .5 : 0;
    restoration.village = progress.complete ? 1 : progress.finale ? .9 : m / 3 * .6;
    for (const [k, v] of Object.entries(restoration)) world.setRestored?.(k, v);
  }
  function syncSources() {
    const want = {
      mara: progress.bypass && pts.maraOutlet, loftGust: progress.loft && pts.loftGust,
      sailsGust: progress.sailsBridge && !progress.sails && pts.sailsGust,
      laddersGust1: progress.loft && !progress.ladders && pts.laddersGust1, laddersGust2: reached.ladders1 && !progress.ladders && pts.laddersGust2,
      laddersGust3: reached.ladders2 && !progress.ladders && pts.laddersGust3,
      // The updraft spills a gust at the top ledge, so the mill never needs a trip back down.
      laddersTop: reached.ladders3 && !progress.ladders && vents.ladders3?.ledge,
    };
    for (const [id, p] of Object.entries(want)) {
      if (p && !wind.sources.has(id)) wind.addSource(id, { ...p, radius: id === 'mara' ? 1.5 : 1.35 });
      if (!p && wind.sources.has(id)) wind.removeSource(id);
    }
  }
  function applyWind(instant = false) {
    if (progress.seed) { wind.setPush('terraceGate', 1, { instant }); wind.powerWheel('seed', { outlet: wheels.seed?.outlet, instant, delay: 1.2 }); wind.chainFrom('seed', { x: wheels.seed.x, y: wheels.seed.y + 1.1, z: wheels.seed.z }); }
    if (progress.sailsBridge) wind.setPush('sailsBridge', 1, { instant });
    for (const id of ['pipesA', 'pipesB']) if (progress[id]) { wind.powerWheel(id, { outlet: progress.pipes ? null : wheels[id]?.outlet, instant }); if (!progress.pipes) wind.chainFrom(id, { x: wheels[id].x, y: wheels[id].y + 1.1, z: wheels[id].z }); }
    for (const [k, id] of Object.entries(MILLS)) if (progress[k]) wind.powerWheel(id, { instant });
  }

  // ---- targets ----
  function targets() {
    const list = [], add = (o) => list.push(o);
    if (progress.staff && !progress.seed) add({ ...wheels.seed, id: 'seed', kind: 'give', range: 4.5, label: 'Give the gust to the seed wheel', need: 'The seed wheel needs wind. Catch the gust puffing from Mara’s copper outlet.' });
    const ventOk = { loft: progress.seed, ladders1: progress.loft && !progress.ladders, ladders2: reached.ladders1 && !progress.ladders, ladders3: reached.ladders2 && !progress.ladders, };
    for (const [id, ok] of Object.entries(ventOk)) if (ok && vents[id]) {
      const shut = id === 'ladders3' && wind.pushValue('laddersShutter') < .8;
      add({ id, kind: shut ? 'blocked' : 'vent', ...vents[id], range: 3.2, height: 2, label: 'Release the gust into the grille', shut,
        need: shut ? 'The shutter covers this grille. Push it aside with a gust, then fill the grille before the ring empties.' : 'A copper grille. Release a held gust into it and it will lift you.' });
    }
    if (progress.loft && !progress.sailsBridge && sails.sailsBridge) add({ ...sails.sailsBridge, id: 'sailsBridge', kind: 'push', range: 7.5, label: 'Push the hanging bridge', need: 'The hanging bridge sways out of reach. A gust released at its sail would swing it across. Catch one from the pipe on the loft.' });
    if (reached.ladders2 && !progress.ladders && sails.laddersShutter && wind.pushValue('laddersShutter') < .8) add({ ...sails.laddersShutter, id: 'laddersShutter', kind: 'push', range: 6, label: 'Push the shutter open', need: 'A heavy shutter lies over the grille. Push it with a gust.' });
    if (progress.loft && !progress.pipesA) add({ ...wheels.pipesA, id: 'pipesA', kind: 'give', range: 4.5, label: 'Power the pipe wheel', need: 'This pipe wheel feeds the far platform. Give it a gust from the loft pipe.' });
    if (progress.pipesA && !progress.pipesB) add({ ...wheels.pipesB, id: 'pipesB', kind: 'give', range: 4.5, label: 'Power the second pipe wheel', need: 'The second wheel is still. The first wheel is puffing a gust across the gap for you.' });
    if (progress.sailsBridge && !progress.sails) add({ ...wheels.millSails, id: 'millSails', kind: 'give', range: 5, height: 4, label: 'Give the gust to the Mill of Sails', need: 'The Mill of Sails is still. A gust spills from the bridge sail beside it.' });
    if (progress.pipesB && !progress.pipes) add({ ...wheels.millPipes, id: 'millPipes', kind: 'give', range: 5, height: 4, label: 'Give the gust to the Mill of Pipes', need: 'The Mill of Pipes is still. The second wheel is puffing a gust at its outlet.' });
    if (reached.ladders3 && !progress.ladders) add({ ...wheels.millLadders, id: 'millLadders', kind: 'give', range: 5, height: 4, label: 'Give the gust to the Mill of Ladders', need: 'The Mill of Ladders is still. The updraft left a gust swirling at the top of the ledge.' });
    return list;
  }
  function contexts(p, yaw) {
    const charged = wind.charged, out = [];
    const push = (priority, c) => out.push({ priority, d: c.target ? d2(p, c.target) : 0, ...c });
    // Catch: standing in a live gust ring.
    if (!charged && progress.staff) { const s = wind.sourceAt(p); if (s && s.kind !== 'guardian') push(0, { kind: 'catch', id: s.id, label: 'Catch the gust', target: V(s).setY(s.y + .9), anim: 'capture' }); }
    if (!charged && !progress.staff && progress.bypass) { const s = wind.sourceAt(p); if (s) push(1, { kind: 'info', id: 'nostaff', label: 'Reach for the gust', target: V(s), why: 'The gust slips through your fingers. Mara is holding out her bell staff — take it first.' }); }
    const list = targets();
    if (charged) {
      const pick = wind.pickTarget(p, yaw, list.filter(c => c.kind !== 'blocked'));
      if (pick) push(0, { kind: pick.kind, id: pick.id, label: pick.label, target: V(pick).setY(pick.y + (pick.kind === 'vent' ? .2 : 1.2)), anim: 'release' });
      const shut = list.find(c => c.kind === 'blocked' && near(p, c, 3.2));
      if (shut && !pick) push(1, { kind: 'info', id: shut.id, label: 'Grille · shutter closed', target: V(shut), why: shut.need });
    } else {
      const info = list.filter(c => near(p, c, Math.min(c.range, 3.2), 3)).sort((a, b) => d2(p, a) - d2(p, b))[0];
      if (info) push(2, { kind: 'info', id: info.id, label: `${info.kind === 'vent' || info.kind === 'blocked' ? 'Copper grille' : info.label.replace(/^(Give the gust to|Power|Push|Release the gust into) (the )?/, '').replace(/^./, c => c.toUpperCase())} · needs a gust`, target: V(info), why: info.need });
    }
    // Bells, Mara, carvings, fragments, lever.
    if (near(p, pts.morningBell, 2.4)) {
      if (!progress.bell) push(1, { kind: 'ring', id: 'morningBell', label: 'Ring the morning bell', target: V(pts.morningBell).setY(pts.morningBell.y + 1.8), anim: 'pull' });
      else if (progress.finale && !progress.complete) push(0, { kind: 'ring', id: 'morningBell', label: 'Ring the morning bell with Mara', target: V(pts.morningBell).setY(pts.morningBell.y + 1.8), anim: 'pull' });
      else push(3, { kind: 'ring', id: 'morningBellAgain', label: 'Ring the bell again', target: V(pts.morningBell).setY(pts.morningBell.y + 1.8), anim: 'pull' });
    }
    if (near(p, pts.mara, 2.4)) {
      if (progress.bypass && !progress.staff) push(0, { kind: 'talk', id: 'staff', label: 'Take the bell staff from Mara', target: V(pts.mara).setY(pts.mara.y + 1.2), anim: 'pull' });
      else if (!progress.bell) push(2, { kind: 'info', id: 'maraWait', label: 'Talk to Mara', target: V(pts.mara), why: 'Mara: “Morning round first, apprentice. Ring the bell by the path, and I’ll open the bypass.”' });
      else if (progress.staff) push(3, { kind: 'info', id: 'maraTalk', label: 'Talk to Mara', target: V(pts.mara), why: progress.finale ? 'Mara: “Ring it with me. Let’s hear if anyone answers.”' : 'Mara: “I’ll hold the bypass as long as I can. Breath goes up before it goes anywhere.”' });
    }
    if (progress.sailsBridge && !progress.sails && sails.sailsBridge?.lever && near(p, sails.sailsBridge.lever, 1.6)) push(2, { kind: 'lever', id: 'sailsBridgeReset', label: 'Reset the hanging bridge', target: V(sails.sailsBridge.lever), anim: 'pull' });
    for (const k of ['carvingOut', 'carvingReturn']) if (progress.hollow && near(p, pts[k], 2.4, 2.5)) push(1, { kind: 'read', id: k, label: progress[k] ? 'Look at the carving again' : 'Look at the carving', target: V(pts[k]).setY(pts[k].y + 1.2), anim: null });
    for (const k of ['fragment1', 'fragment2', 'fragment3']) if (pts[k] && !fragments.has(k) && near(p, pts[k], 1.6)) push(1, { kind: 'pick', id: k, label: 'Pick up the bell fragment', target: V(pts[k]).setY(pts[k].y + .8), anim: 'pull' });
    if (progress.guardian && !progress.bellReturn) {
      if (near(p, pts.bellOut, 2.2, 2.5)) push(1, { kind: 'ring', id: 'bellOut', label: progress.bellOut ? 'Ring the outward bell again' : 'Ring the outward bell', target: V(pts.bellOut).setY(pts.bellOut.y + 1.8), anim: 'pull' });
      if (near(p, pts.bellReturn, 2.2, 2.5)) push(progress.bellOut ? 0 : 2, progress.bellOut ? { kind: 'ring', id: 'bellReturn', label: 'Ring the return bell', target: V(pts.bellReturn).setY(pts.bellReturn.y + 1.8), anim: 'pull' } : { kind: 'info', id: 'bellReturnEarly', label: 'The return bell', target: V(pts.bellReturn), why: 'This bell is tuned to answer. The phrase starts with its partner, the outward bell.' });
    }
    // Guardian encounter contexts.
    if (progress.hollow && !progress.guardian) { const g = guardian.context(p, yaw, charged); if (g) push(g.kind === 'info' ? 2 : 0, g); }
    out.sort((a, b) => a.priority - b.priority || a.d - b.d);
    return out;
  }
  function context(p, yaw = 0) { const c = contexts(p, yaw)[0]; last = c || null; return c ? { kind: c.kind, id: c.id, label: c.label, target: c.target, anim: c.anim ?? null, why: c.why, owner: c.owner } : null; }

  // ---- interaction ----
  function interact(ctx, { position = movement?.position, yaw = movement?.yaw ?? 0, staffTip = null } = {}) {
    if (!ctx || progress.complete && ctx.id !== 'morningBell') return false;
    const current = contexts(position, yaw).find(c => c.id === ctx.id && c.kind === ctx.kind);
    if (!current) return false;
    const tip = staffTip || V(position).setY(position.y + 1.5);
    if (current.owner === 'guardian') return guardian.interact(current, { staffTip: tip });
    switch (current.kind) {
      case 'info': say(current.why, 5); return true;
      case 'catch': {
        if (!wind.catchFrom(current.id, tip)) return false;
        const next = !progress.seed ? 'Give it to the seed wheel by the gate.' : !progress.loft ? 'Release it into the copper grille.' : null;
        if (!seen.has('firstCatch')) { seen.add('firstCatch'); say('The gust curls into your bell. ' + (next || ''), 4); } else if (next) say(next, 3);
        emit({}); return true;
      }
      case 'give': case 'vent': case 'push': return release(current, tip);
      case 'ring': return ring(current);
      case 'talk':
        progress.staff = true; say('Mara hands you her bell staff. “Catch the gust at my outlet. Give it to the seed wheel.”', 6); sound('chime');
        emit({ checkpoint: arr(pts.mara, 1.2) }); return true;
      case 'lever': wind.setPush('sailsBridge', 0, { duration: 1.2 }); progress.sailsBridge = false; say('The bridge swings back on its rope. Push it again when you’re ready.', 4); sound('release'); emit({}); return true;
      case 'read': {
        const first = !progress[current.id]; progress[current.id] = true;
        say(current.id === 'carvingOut' ? 'A carving: keepers ringing a bell, wind streaming up out of the tree to the village mills.' : 'A second channel is carved beside the first, running back down into the roots. It is choked with carved roots.', 7);
        sound('chime'); if (first) emit({}); return true;
      }
      case 'pick': {
        fragments.add(current.id); sound('chime');
        say(fragments.size < 3 ? `A bell fragment, green with age · ${fragments.size}/3` : 'The third fragment fits the others: a small bell, rung only once — facing the roots.', 6);
        emit({}); return true;
      }
    }
    return false;
  }
  const arr = (p, dy = 0) => [p.x, p.y + dy, p.z];
  function release(c, tip) {
    const target = c.target.clone();
    const ok = wind.release(c.kind === 'vent' ? 'vent' : c.kind === 'push' ? 'push' : 'give', tip, target, { onArrive: () => arrive(c) });
    return ok;
  }
  function arrive(c) {
    const id = c.id;
    if (c.kind === 'vent') {
      wind.openVent(vents[id], { duration: 4 });
      if (!seen.has('vent')) { seen.add('vent'); say('The grille roars. Step into the column — jump inside to rise higher.', 5); }
      return emit({});
    }
    if (id === 'sailsBridge') { wind.setPush('sailsBridge', 1, { duration: 1.4 }); progress.sailsBridge = true; say('The sail catches the gust and the bridge swings across. A little wind spills out by the mill.', 5); sound('restore'); return emit({}); }
    if (id === 'laddersShutter') { const s = sails.laddersShutter; wind.setPush('laddersShutter', 1, { duration: .8, hold: s.hold ?? 8, at: s }); say('The shutter slides open — it’s already creeping shut. Catch, and fill the grille before the ring empties.', 5); sound('release'); return emit({}); }
    if (id === 'seed') {
      progress.seed = true; wind.setPush('terraceGate', 1, { duration: 1.6 }); applyWind(); applyWorld(); sound('restore');
      say('The seed wheel spins. The gate swings open, laundry lifts, pinwheels turn. The wheel puffs a gust beyond the gate.', 6);
      later(6.2, () => say('Mara: “Breath goes up before it goes anywhere. Try the grille under the loft.”', 5));
      return emit({ restored: 'terrace', checkpoint: arr(pts.seedWheel) });
    }
    if (id === 'pipesA' || id === 'pipesB') {
      progress[id] = true; applyWind(); sound('restore');
      say(id === 'pipesA' ? 'The wheel spins and hurls a gust across the gap. Jump after it.' : 'The second wheel spins. Its outlet puffs a gust right beside the Mill of Pipes.', 5);
      return emit({ checkpoint: arr(wheels[id]) });
    }
    const mill = Object.entries(MILLS).find(([, w]) => w === id)?.[0];
    if (mill) {
      progress[mill] = true; applyWind(); applyWorld(); sound('restore');
      const n = millsDone();
      say(n < 3 ? `The ${MILL_NAMES[mill]} turns. A lantern chain lights on the trunk and the sky bridge grows a plank · ${n}/3` : `The ${MILL_NAMES[mill]} turns. The sky bridge is complete — the Hollow gate stands open.`, 6);
      return emit({ restored: mill, checkpoint: arr(wheels[id]) });
    }
    emit({});
  }
  function ring(c) {
    if (c.id === 'morningBell') {
      if (progress.finale && !progress.complete) {
        progress.complete = true; applyWorld(); sound('restore');
        say('The morning bell rings clear. Far across the valley, another bell answers.', 6);
        later(4.5, () => say('Mara: “I taught you how to call it. I forgot to teach you how to listen.”', 9));
        return emit({ complete: true, cue: 'far-bell' });
      }
      progress.bell = true; sound('dull-bell'); bypassAt = time + 2.2;
      say('A dull, broken note. Mara: “That bell hasn’t sung properly in years.”', 5);
      later(2.3, () => { progress.bypass = true; syncSources(); sound('bypass'); say(progress.staff ? 'Mara throws her bypass lever. A gust puffs from her copper outlet.' : 'Mara throws her bypass lever. A gust puffs from her copper outlet. “Take my staff, apprentice.”', 6); emit({}); });
      return emit({ checkpoint: arr(pts.morningBell) }), true;
    }
    if (c.id === 'morningBellAgain') { sound('dull-bell'); say(progress.complete ? 'The bell rings clear, and the far bell answers again.' : 'Still only half a note.', 3); return true; }
    if (c.id === 'bellOut') { progress.bellOut = true; sound('dull-bell'); say('The outward note climbs the well toward the village… and nothing comes back.', 5); emit({}); return true; }
    if (c.id === 'bellReturn') {
      progress.bellReturn = true; applyWorld(); sound('restore'); finaleT = 0;
      say('The return note rolls down into the roots. The tree breathes in.', 6);
      emit({ finale: { duration: 7 }, restored: 'hollow' }); return true;
    }
    return false;
  }
  function guardianEvent(e = {}) {
    if (e.done) { progress.guardian = true; applyWorld(); later(6.5, () => say('Two bells hang above the high ring: one faces the village, one faces the roots.', 6)); }
    emit({ ...(e.knock ? { knock: e.knock } : {}), ...(e.checkpoint ? { checkpoint: e.checkpoint } : {}), ...(e.done ? { restored: 'hollow' } : {}) });
  }

  // ---- per frame ----
  function update(dt, t, p, { started = true, gentle = false, paused = false } = {}) {
    if (paused) return;
    time += dt;
    if (pendingCaption && time >= pendingCaption.at) { const q = pendingCaption; pendingCaption = null; q.fn(); }
    syncSources();
    if (!started) return;
    // Reaching a ledge above a grille marks it (checkpoint + unlocks the next gust source).
    if (movement?.grounded) for (const v of Object.values(vents)) {
      if (!v.ledge || reached[v.id] || v.id.startsWith('ring')) continue;
      if (d2(p, v.ledge) < 3.6 && Math.abs(p.y - v.ledge.y) < .45) {
        reached[v.id] = true;
        if (v.id === 'loft') { progress.loft = true; say('The loft. The whole tree opens up: three still windmills on the branches, and the Hollow gate below.', 7); }
        else if (v.id === 'ladders3') say('The top ledge. The Mill of Ladders waits, still.', 4);
        emit({ checkpoint: arr(v.ledge) });
      }
    }
    if (millsDone() === 3 && !progress.skyBridge && near(p, pts.hollowGate, 3.5, 2.5)) {
      progress.skyBridge = progress.hollow = true;
      say('Inside the Hollow, an old gallery spirals down into the dark. The walls are carved.', 6);
      emit({ checkpoint: arr(pts.hollowGate) });
    }
    if (progress.hollow && !progress.guardian) guardian.update(dt, t, { hero: p, active: true, gentle });
    else guardian.update(dt, t, { hero: p, active: false, gentle });
    if (finaleT >= 0 && !progress.finale) {
      finaleT += dt;
      if (finaleT >= 7) { progress.finale = true; finaleT = -1; applyWorld(); say('Back on the terrace, Mara is waiting by the morning bell.', 5); emit({ teleport: arr(pts.finaleSpot), checkpoint: arr(pts.finaleSpot) }); }
    }
  }

  function objective() {
    const pr = progress, inFlight = wind.busy && !wind.charged; // a gust in flight still counts as held
    if (pr.complete) return 'Bellhollow breathes again';
    if (pr.finale) return 'Ring the morning bell with Mara';
    if (finaleT >= 0) return 'Listen';
    if (pr.guardian) return !pr.bellOut ? 'Ring the outward bell' : 'Now ring the return bell';
    if (pr.hollow) return guardian.objective?.() || 'Descend the carved gallery';
    if (millsDone() === 3) return 'Cross the sky bridge to the Hollow';
    if (!pr.bell) return 'Ring the morning bell';
    if (!pr.bypass) return 'Watch Mara’s bypass lever';
    if (!pr.staff) return 'Take the bell staff from Mara';
    if (!pr.seed) return wind.charged || inFlight ? 'Give the gust to the seed wheel' : 'Catch the gust at Mara’s copper outlet';
    if (!pr.loft) return wind.charged ? 'Release the gust into the copper grille' : 'Catch the seed wheel’s gust past the gate';
    const branch = branchNear(movement?.position);
    if (branch === 'sails') return !pr.sailsBridge ? (wind.charged ? 'Push the hanging bridge with the gust' : 'Catch the loft gust, then push the bridge') : wind.charged ? 'Give the gust to the Mill of Sails' : 'Catch the gust spilling by the mill';
    if (branch === 'pipes') return !pr.pipesA ? 'Power the pipe wheel with a gust' : !pr.pipesB ? 'Catch its gust over the gap; power wheel two' : wind.charged ? 'Give the gust to the Mill of Pipes' : 'Catch the gust at wheel two’s outlet';
    if (branch === 'ladders') return !reached.ladders1 || !reached.ladders2 ? 'Ride the grilles up the ledges' : !reached.ladders3 ? 'Push the shutter, then ride the grille' : wind.charged ? 'Give the gust to the Mill of Ladders' : 'Catch a gust for the Mill of Ladders';
    return `Wake the three windmills · ${millsDone()}/3`;
  }
  function branchNear(p) {
    if (!p || !progress.loft) return null;
    let best = null, bd = 11;
    for (const k of ['sails', 'pipes', 'ladders']) { if (progress[k]) continue; const w = wheels[MILLS[k]]; const d = d2(p, w) - (k === 'ladders' ? 3 : 0); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  function objectiveTarget() {
    const pr = progress, c = wind.charged;
    if (pr.complete) return null;
    if (pr.finale) return V(pts.morningBell);
    if (pr.guardian) return V(pr.bellOut ? pts.bellReturn : pts.bellOut);
    if (pr.hollow) return guardian.target?.() || V(pts.arena);
    if (millsDone() === 3) return V(pts.hollowGate);
    if (!pr.bell) return V(pts.morningBell);
    if (!pr.staff) return V(pts.mara);
    if (!pr.seed) return V(c ? pts.seedWheel : pts.maraOutlet);
    if (!pr.loft) return c ? V(vents.loft) : V(wheels.seed.outlet);
    const b = branchNear(movement?.position);
    if (b === 'sails') return V(!pr.sailsBridge ? (c ? sails.sailsBridge : pts.loftGust) : c ? pts.millSails : pts.sailsGust);
    if (b === 'pipes') return V(!pr.pipesA ? (c ? wheels.pipesA : pts.loftGust) : !pr.pipesB ? (c ? wheels.pipesB : wheels.pipesA.outlet) : c ? pts.millPipes : wheels.pipesB.outlet);
    if (b === 'ladders') return V(!reached.ladders1 ? vents.ladders1 : !reached.ladders2 ? vents.ladders2 : !reached.ladders3 ? vents.ladders3 : pts.millLadders);
    return V(pts.loft);
  }
  function hint() { return `Nothing to use right here. Next: ${objective().replace(/^./, c => c.toLowerCase())}.`; }
  function area(p) { return world.area?.(p) || (p.y < -1 ? 'hollow' : p.y > 3 ? 'branches' : 'terrace'); }

  // ---- save / restore ----
  function serialize() {
    return { version: QUEST_VERSION, progress: { ...progress }, reached: { ...reached }, fragments: [...fragments], seen: [...seen], charge: wind.charge ? { origin: wind.charge.origin, kind: wind.charge.kind } : null, guardian: guardian.serialize?.() ?? null };
  }
  function restore(d) {
    reset(false);
    if (!d || d.version !== QUEST_VERSION) return false;
    for (const k of FLAGS) progress[k] = !!d.progress?.[k];
    for (const [k, v] of Object.entries(d.reached || {})) if (vents[k]) reached[k] = !!v;
    for (const f of d.fragments || []) if (/^fragment[123]$/.test(f)) fragments.add(f);
    for (const s of d.seen || []) seen.add(String(s));
    // A finale in progress resumes at its end: Mara on the terrace.
    if (progress.bellReturn) progress.finale = true;
    if (progress.bell) progress.bypass = true;
    if (progress.hollow) guardian.restore?.(d.guardian);
    if (progress.guardian) guardian.restore?.({ phase: 3 });
    if (d.charge?.origin) wind.setCharge(String(d.charge.origin), d.charge.kind === 'guardian' && !progress.guardian ? 'guardian' : 'gust');
    applyWind(true); applyWorld(); syncSources();
    return true;
  }
  function reset(apply = true) {
    for (const k of FLAGS) progress[k] = false;
    for (const k of Object.keys(reached)) delete reached[k];
    fragments.clear(); seen.clear(); bypassAt = Infinity; finaleT = -1; pendingCaption = null;
    wind.reset(); guardian.reset?.();
    if (apply) { applyWorld(); syncSources(); }
  }
  function telemetry() { return { ...progress, reached: { ...reached }, fragments: fragments.size, mills: millsDone(), charge: wind.charge?.origin ?? null, guardian: guardian.telemetry?.() ?? null, finaleT: finaleT >= 0 ? +finaleT.toFixed(2) : null, context: last?.id ?? null }; }
  applyWorld(); syncSources();
  return {
    progress, reached, restoration, context, interact, update, objective, objectiveTarget, hint, area, serialize, restore, reset, telemetry, guardian,
    get finaleShot() { return finaleT >= 0 ? Math.min(1, finaleT / 7) : progress.finale ? 1 : 0; }, get finaleActive() { return finaleT >= 0; },
    subject() { return progress.hollow && !progress.guardian ? guardian.subject?.() ?? null : null; },
    get staff() { return progress.staff; },
  };
}
