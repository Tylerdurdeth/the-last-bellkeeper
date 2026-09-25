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
const GOLD = { r: .91, g: .73, b: .29, isColor: true };
// Anchors the world must provide in world.points ({x,y,z}); fragment1..3 and farBell optional.
export const REQUIRED_POINTS = ['start', 'morningBell', 'mara', 'maraOutlet', 'seedWheel', 'seedOutlet', 'terraceGate', 'loft', 'loftGust',
  'sailsGust', 'laddersGust1', 'laddersGust2', 'laddersGust3', 'millSails', 'millPipes', 'millLadders', 'skyBridge', 'hollowGate',
  'carvingOut', 'carvingReturn', 'arena', 'guardian', 'vane1', 'vane2', 'vane3', 'ring1', 'ring2', 'ring3', 'bellOut', 'bellReturn', 'finale', 'finaleSpot'];
export const REQUIRED_VENTS = ['loft', 'ladders1', 'ladders2', 'ladders3', 'ring1', 'ring2'];
export const REQUIRED_WHEELS = ['seed', 'pipesA', 'pipesB', 'millSails', 'millPipes', 'millLadders'];
export const REQUIRED_SAILS = ['sailsBridge', 'laddersShutter'];
const FLAGS = ['bell', 'bypass', 'staff', 'seed', 'loft', 'sailsBridge', 'sailsCap', 'sails', 'pipesA', 'pipesValve', 'pipesB', 'pipes', 'ladders', 'skyBridge', 'hollow',
  'carvingOut', 'carvingReturn', 'guardian', 'bellOut', 'bellReturn', 'finale', 'complete', 'fragSail', 'keepsake'];
// The lost return phrase, one line per bell fragment (optional).
const PHRASE = ['“Ring out, and the wind goes walking…”', '“…through mill and lantern, as far as it will go…”', '“…then ring again, softer, and hold the door for it.”'];
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
  // M3 anchors (optional: a world without them simply skips that step).
  const P3 = v => v && (Array.isArray(v) ? { x: v[0], y: v[1], z: v[2] } : { x: v.x, y: v.y, z: v.z });
  const cap = sails.sailsCap || (pts.sails?.capSail && { ...P3(pts.sails.capSail), lever: P3(pts.sails.capLever) });
  const valve = P3(pts.pipes?.valve || pts.pipesValve);
  // The valve gates whichever chain wheel it stands beside.
  const valveWheel = valve ? (['pipesA', 'pipesB'].filter(k => wheels[k]).sort((a, b) => Math.hypot(valve.x - wheels[a].x, valve.z - wheels[a].z) - Math.hypot(valve.x - wheels[b].x, valve.z - wheels[b].z))[0]) : null;
  const wrongOutlet = P3(pts.pipes?.wrongOutlet || pts.pipesWrongOutlet) || (valve && valveWheel && { x: wheels[valveWheel].x + (wheels[valveWheel].x - valve.x) * 1.5, y: wheels[valveWheel].y + 1.2, z: wheels[valveWheel].z + (wheels[valveWheel].z - valve.z) * 1.5 });
  const fragSail = sails.frag2;
  const galleryCarvings = pts.gallery?.carvings || [];
  const gallerySource = P3(pts.gallery?.source || pts.gallerySource);
  const intake = i => P3(galleryCarvings[i]?.intake || galleryCarvings[i]?.panel) || V(pts[i ? 'carvingReturn' : 'carvingOut']).setY(pts[i ? 'carvingReturn' : 'carvingOut'].y + 1.2);
  const carvingsLive = () => !!gallerySource; // carvings need wind only when the world has a gallery source

  const progress = Object.fromEntries(FLAGS.map(k => [k, false]));
  const reached = {}; const fragments = new Set(); const seen = new Set(); const glints = {};
  let bypassAt = Infinity, time = 0, finaleT = -1, last = null, pendingCaption = null, farAnswered = false;
  const FINALE = 16; // s: 0-2 resonance, 2-9 rise over the village, 9-13 the far bell answers, 13-16 back to Mara
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
    restoration.carving0 = progress.carvingOut ? 1 : 0; restoration.carving1 = progress.carvingReturn ? 1 : 0;
    for (const [k, v] of Object.entries(restoration)) world.setRestored?.(k, v);
  }
  function syncSources() {
    const want = {
      mara: progress.bypass && pts.maraOutlet, loftGust: progress.loft && pts.loftGust,
      // Optional per-branch supplies (real world): at each branch's start until that branch needs no more.
      // Branch gusts stay while an optional fragment sail on that branch still needs pushing.
      sailsSource: progress.loft && (!progress.sails || fragSail && !progress.fragSail) && pts.sailsSource, pipesSource: progress.loft && !progress.pipesA && pts.pipesSource,
      sailsGust: progress.sailsBridge && (!progress.sails || fragSail && !progress.fragSail) && pts.sailsGust,
      // Ladder gusts stay after the mill: the ledges hold a fragment and are worth revisiting.
      laddersGust1: progress.loft && pts.laddersGust1, laddersGust2: reached.ladders1 && pts.laddersGust2,
      laddersGust3: reached.ladders2 && pts.laddersGust3,
      // The updraft spills a gust at the top ledge, so the mill never needs a trip back down.
      laddersTop: reached.ladders3 && !progress.ladders && vents.ladders3?.ledge,
      gallerySource: progress.hollow && !(progress.carvingOut && progress.carvingReturn) && gallerySource,
    };
    for (const [id, p] of Object.entries(want)) {
      if (p && !wind.sources.has(id)) wind.addSource(id, { ...p, radius: id === 'mara' ? 1.5 : 1.35 });
      if (!p && wind.sources.has(id)) wind.removeSource(id);
    }
  }
  function applyWind(instant = false) {
    if (progress.seed) { wind.setPush('terraceGate', 1, { instant }); wind.powerWheel('seed', { outlet: wheels.seed?.outlet, instant, delay: 1.2 }); wind.chainFrom('seed', wheels.seed.hub || { x: wheels.seed.x, y: wheels.seed.y + 1.1, z: wheels.seed.z }); }
    if (progress.sailsBridge) wind.setPush('sailsBridge', 1, { instant });
    if (progress.sailsCap) wind.setPush('sailsCap', 1, { instant, duration: 1.8 });
    if (valve) wind.setPush('pipesValve', progress.pipesValve ? 1 : 0, { instant, duration: .9 });
    if (progress.fragSail) wind.setPush('frag2', 1, { instant });
    for (const id of ['pipesA', 'pipesB']) if (progress[id]) {
      wind.powerWheel(id, { outlet: progress.pipes ? null : wheels[id]?.outlet, instant });
      if (!progress.pipes) wind.chainFrom(id, wheels[id].hub || { x: wheels[id].x, y: wheels[id].y + 1.1, z: wheels[id].z });
      if (wheels[id].opens) wind.setPush(wheels[id].opens, 1, { instant, duration: 2.4 }); // e.g. the pipes drawbridge lowers when the chained gust lands
    }
    for (const [k, id] of Object.entries(MILLS)) if (progress[k]) wind.powerWheel(id, { instant });
  }

  // ---- targets ----
  function targets() {
    const list = [], add = (o) => list.push(o);
    if (progress.staff && !progress.seed) add({ ...wheels.seed, id: 'seed', kind: 'give', range: 4.5, label: 'Give the gust to the seed wheel', need: 'The seed wheel needs wind. Catch the gust puffing from Mara’s copper outlet.' });
    const ventOk = { loft: progress.seed, ladders1: progress.loft, ladders2: reached.ladders1, ladders3: reached.ladders2, frag1: progress.loft && !fragments.has('fragment1') };
    for (const [id, ok] of Object.entries(ventOk)) if (ok && vents[id]) {
      const shut = id === 'ladders3' && wind.pushValue('laddersShutter') < .8;
      add({ id, kind: shut ? 'blocked' : 'vent', ...vents[id], range: 3.2, height: 2, label: 'Release the gust into the grille', shut, optional: id === 'frag1',
        need: shut ? 'The shutter covers this grille. Push it aside with a gust, then fill the grille before the ring empties.' : 'A copper grille. Release a held gust into it and it will lift you.' });
    }
    if (progress.loft && !progress.sailsBridge && sails.sailsBridge) add({ ...sails.sailsBridge, id: 'sailsBridge', kind: 'push', range: 7.5, label: 'Push the hanging bridge', need: 'The hanging bridge sways out of reach. A gust released at its sail would swing it across. Catch one at the branch’s copper pipe.' });
    if (reached.ladders2 && sails.laddersShutter && wind.pushValue('laddersShutter') < .8) add({ ...sails.laddersShutter, id: 'laddersShutter', kind: 'push', range: 6, label: 'Push the shutter open', need: 'A heavy shutter lies over the grille. Push it with a gust.' });
    if (progress.loft && !progress.pipesA) add({ ...wheels.pipesA, id: 'pipesA', kind: 'give', range: 4.5, label: 'Power the pipe wheel', need: 'This pipe wheel feeds the far platform. Give it a gust from the branch’s copper pipe.' });
    if (progress.pipesA && !progress.pipesB) add({ ...wheels.pipesB, id: 'pipesB', kind: 'give', range: 4.5, label: 'Power the second pipe wheel', need: 'The second wheel is still. The first wheel is puffing a gust across the gap for you.' });
    if (cap && progress.sailsBridge && !progress.sailsCap) add({ ...cap, id: 'sailsCap', kind: 'push', range: 5, height: 5, label: 'Push the tail sail to turn the cap', need: 'The mill’s sails face away from the wind. A gust at the tail sail would swing the cap round.' });
    if (progress.sailsBridge && !progress.sails) add({ ...wheels.millSails, id: 'millSails', kind: cap && !progress.sailsCap ? 'blocked' : 'give', range: 5, height: 4, label: 'Give the gust to the Mill of Sails',
      need: cap && !progress.sailsCap ? 'The sails face away from the wind — turn the cap first. Push the tail sail behind the mill.' : 'The Mill of Sails is still. A gust spills from the bridge sail beside it.' });
    if (fragSail && progress.loft && !progress.fragSail) add({ ...fragSail, id: 'frag2', kind: 'push', optional: true, range: 6.5, height: 4, label: 'Push the little sail', need: 'A small sail on a pivot. A gust would swing it round.' });
    if (progress.hollow && carvingsLive() && !progress.carvingOut) add({ ...intake(0), id: 'carvingOut', kind: 'give', range: 4.5, height: 3.5, label: 'Give the gust to the carving', need: 'A carved channel with a copper intake. It is waiting for wind — catch the gust in the gallery.' });
    if (progress.hollow && carvingsLive() && !progress.carvingReturn) add({ ...intake(1), id: 'carvingReturn', kind: progress.carvingOut ? 'give' : 'blocked', range: 4.5, height: 3.5, label: 'Give the gust to the second carving',
      need: progress.carvingOut ? 'The second channel waits for wind.' : 'This channel runs the other way. Wake the first carving, further up the gallery.' });
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
      // Mandatory targets always win over optional ones (an optional sail must never eat the only gust).
      const live = list.filter(c => c.kind !== 'blocked'), pick = wind.pickTarget(p, yaw, live.filter(c => !c.optional)) || wind.pickTarget(p, yaw, live.filter(c => c.optional));
      if (pick) push(0, { kind: pick.kind, id: pick.id, label: pick.label, target: V(pick).setY(pick.y + (pick.kind === 'vent' ? .2 : 1.2)), anim: 'release' });
      const shut = list.find(c => c.kind === 'blocked' && near(p, c, c.id === 'ladders3' ? 3.2 : 4.5, 4));
      if (shut && !pick) push(1, { kind: 'info', id: shut.id, label: shut.id === 'ladders3' ? 'Grille · shutter closed' : shut.id === 'millSails' ? 'Mill of Sails · facing away' : 'The carving · not yet', target: V(shut), why: shut.need });
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
    if (progress.sailsCap && !progress.sails && cap?.lever && near(p, cap.lever, 1.6)) push(2, { kind: 'lever', id: 'sailsCapReset', label: 'Reset the mill cap', target: V(cap.lever), anim: 'pull' });
    if (valve && progress.loft && !progress[valveWheel] && near(p, valve, 1.8, 2)) push(1, { kind: 'lever', id: 'pipesValve', label: progress.pipesValve ? 'Turn the valve back' : 'Turn the valve', target: V(valve).setY(valve.y + 1), anim: 'pull' });
    if (!carvingsLive()) for (const k of ['carvingOut', 'carvingReturn']) if (progress.hollow && near(p, pts[k], 2.4, 2.5)) push(1, { kind: 'read', id: k, label: progress[k] ? 'Look at the carving again' : 'Look at the carving', target: V(pts[k]).setY(pts[k].y + 1.2), anim: null });
    for (const i of [2, 3]) { const st = P3(galleryCarvings[i]?.stand); if (progress.hollow && st && near(p, st, 2.2, 2.5)) push(2, { kind: 'read', id: 'lore' + i, label: 'Look at the old carving', target: V(P3(galleryCarvings[i].panel) || st), anim: null }); }
    for (const k of ['fragment1', 'fragment2', 'fragment3']) if (pts[k] && !fragments.has(k) && near(p, pts[k], 1.6)) push(1, { kind: 'pick', id: k, label: 'Pick up the bell fragment', target: V(pts[k]).setY(pts[k].y + .8), anim: 'pull' });
    if (progress.guardian && !progress.bellReturn) {
      if (near(p, pts.bellOut, 2.2, 2.5)) push(1, { kind: 'ring', id: 'bellOut', label: progress.bellOut ? 'Ring the outward bell again' : 'Ring the outward bell', target: V(pts.bellOut).setY(pts.bellOut.y + 1.8), anim: 'pull' });
      if (near(p, pts.bellReturn, 2.2, 2.5)) push(progress.bellOut ? 0 : 2, progress.bellOut ? { kind: 'ring', id: 'bellReturn', label: 'Ring the return bell', target: V(pts.bellReturn).setY(pts.bellReturn.y + 1.8), anim: 'pull' } : { kind: 'info', id: 'bellReturnEarly', label: 'The return bell', target: V(pts.bellReturn), why: 'This bell is tuned to answer. The phrase starts with its partner, the outward bell.' });
    }
    // Guardian encounter contexts.
    if (progress.hollow && !progress.guardian && (!carvingsLive() || progress.carvingOut && progress.carvingReturn)) { const g = guardian.context(p, yaw, charged); if (g) push(g.kind === 'info' ? 2 : 0, g); }
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
        progress.staff = true; emit({ mara: 'gesture' }); say('Mara hands you her bell staff. “Catch the gust at my outlet. Give it to the seed wheel.”', 6); sound('chime');
        emit({ checkpoint: arr(pts.mara, 1.2) }); return true;
      case 'lever':
        if (current.id === 'pipesValve') { progress.pipesValve = !progress.pipesValve; wind.setPush('pipesValve', progress.pipesValve ? 1 : 0, { duration: .9 }); sound('push'); say(progress.pipesValve ? 'The valve clanks round. The pipe now leads to the mill.' : 'The valve clanks back to the old pipe.', 4); emit({}); return true; }
        if (current.id === 'sailsCapReset') { wind.setPush('sailsCap', 0, { duration: 1.6 }); progress.sailsCap = false; say('The cap creaks back, sails facing away. Push the tail sail again when you’re ready.', 4); sound('release'); emit({}); return true; }
        wind.setPush('sailsBridge', 0, { duration: 1.2 }); progress.sailsBridge = false; progress.sailsCap = false; wind.setPush('sailsCap', 0, { duration: 1.2 }); say('The bridge swings back on its rope. Push it again when you’re ready.', 4); sound('release'); emit({}); return true;
      case 'read': {
        if (current.id.startsWith('lore')) { say(current.id === 'lore2' ? 'A keeper at the far bell, head bowed, listening.' : 'Roots curled around a second, smaller bell. Its rope has been cut.', 6); sound('chime'); return true; }
        const first = !progress[current.id]; progress[current.id] = true;
        say(current.id === 'carvingOut' ? 'A carving: keepers ringing a bell, wind streaming up out of the tree to the village mills.' : 'A second channel is carved beside the first, running back down into the roots. It is choked with carved roots.', 7);
        sound('chime'); if (first) emit({}); return true;
      }
      case 'pick': {
        fragments.add(current.id); sound('chime'); later(.9, () => sound('bell-return'));
        say(`${PHRASE[Math.min(2, fragments.size - 1)]}  · fragment ${fragments.size}/3`, 6);
        if (fragments.size === 3) { progress.keepsake = true; later(6.5, () => say('The three fragments fit: a little keeper’s bell. You keep it. The phrase feels unfinished — as if it wants to be rung somewhere.', 7)); }
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
    if (id === 'sailsCap') { wind.setPush('sailsCap', 1, { duration: 1.8 }); progress.sailsCap = true; say('The tail sail catches the gust and the cap grinds round. The sails face the wind.', 5); sound('push'); return emit({}); }
    if (id === 'frag2') { wind.setPush('frag2', 1, { duration: 1.4 }); progress.fragSail = true; say('The little sail swings round into a walkway. Across it, on the small platform, a bell fragment glints.', 6); sound('push'); return emit({ look: pts.fragment2 && arr(pts.fragment2, .6) }); }
    if (id === 'carvingOut' || id === 'carvingReturn') {
      progress[id] = true; applyWorld(); sound(id === 'carvingOut' ? 'bell-out' : 'bell-return'); wind.petals(V(c.target), { count: 30, spread: 1 });
      say(id === 'carvingOut' ? 'The carving drinks the gust. Light runs up the channel, out toward the mills.' : 'The second channel lights — and runs back down, into the roots.', 6);
      if (progress.carvingOut && progress.carvingReturn) later(6.5, () => say('Below, in the well, something stirs.', 4));
      return emit({ restored: id === 'carvingOut' ? 'carving0' : 'carving1' });
    }
    if (id === valveWheel && valve && !progress.pipesValve) {
      // Wrong outlet: the gust bursts from the old pipe (pennant flaps) and drifts back to its source. No penalty.
      const W = wheels[valveWheel], from = V(W.hub || W).setY((W.hub || W).y + .4), out = V(wrongOutlet), back = valveWheel === 'pipesA' ? (pts.pipesSource || pts.pipes?.source || pts.loftGust) : wind.sources.get('chain:pipesA');
      wind.setPush('pipesWrongOutlet', 1, { duration: .3, hold: 2.2 }); sound('chain'); seen.add('wrongOutlet');
      wind.setCharge('pipesWrong'); wind.release('push', from, out, { onArrive: () => { if (back) { wind.setCharge('pipesWrong'); wind.release('give', out, V(back).setY(back.y + .9)); } } });
      say('The wheel spins, but the gust bursts out of the wrong pipe — the pennant flaps — and drifts back where it came from. There’s a valve by the wheel.', 6);
      return emit({});
    }
    if (id === 'sailsBridge') { wind.setPush('sailsBridge', 1, { duration: 1.4 }); progress.sailsBridge = true; say('The sail catches the gust and the bridge swings across. A little wind spills out by the mill.', 5); sound('restore'); return emit({}); }
    if (id === 'laddersShutter') { const s = sails.laddersShutter; wind.setPush('laddersShutter', 1, { duration: .8, hold: s.hold ?? 8, at: s }); say('The shutter slides open — it’s already creeping shut. Catch, and fill the grille before the ring empties.', 5); sound('release'); return emit({}); }
    if (id === 'seed') {
      progress.seed = true; wind.setPush('terraceGate', 1, { duration: 1.6 }); applyWind(); applyWorld(); sound('restore'); wind.petals(V(wheels.seed).setY(wheels.seed.y + .8), { count: 60 });
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
      progress[mill] = true; applyWind(); applyWorld(); sound('mill');
      wind.petals(V(wheels[id]).setY(wheels[id].y + 1), { count: 50 }); if (wheels[id].hub) wind.petals(V(wheels[id].hub), { count: 90, spread: 3, up: 3 });
      const n = millsDone();
      say(n < 3 ? `The ${MILL_NAMES[mill]} turns. A lantern chain lights on the trunk and the sky bridge grows a plank · ${n}/3` : `The ${MILL_NAMES[mill]} turns. The sky bridge is complete — the Hollow gate stands open.`, 6);
      return emit({ restored: mill, checkpoint: arr(wheels[id]) });
    }
    emit({});
  }
  function ring(c) {
    if (c.id === 'morningBell') {
      if (progress.finale && !progress.complete) {
        progress.complete = true; applyWorld(); sound('bell-clear'); world.setState?.('bellSwing', 1); wind.petals(V(pts.morningBell).setY(pts.morningBell.y + 2), { count: 120, spread: 4 });
        later(2.2, () => { sound('far-bell'); later(2.3, () => say('Mara: “I taught you how to call it. I forgot to teach you how to listen.”', 9)); });
        say('The morning bell rings clear, and the far bell answers again.', 5);
        return emit({ complete: true, mara: 'wave' });
      }
      progress.bell = true; sound('dull-bell'); bypassAt = time + 2.2; world.setState?.('bellSwing', 1);
      say('A dull, broken note. Mara: “That bell hasn’t sung properly in years.”', 5);
      later(2.3, () => { progress.bypass = true; syncSources(); sound('bypass'); emit({ mara: 'lever' }); say(progress.staff ? 'Mara throws her bypass lever. A gust puffs from her copper outlet.' : 'Mara throws her bypass lever. A gust puffs from her copper outlet. “Take my staff, apprentice.”', 6); emit({}); });
      return emit({ checkpoint: arr(pts.morningBell) }), true;
    }
    if (c.id === 'morningBellAgain') { sound('dull-bell'); say(progress.complete ? 'The bell rings clear, and the far bell answers again.' : 'Still only half a note.', 3); return true; }
    if (c.id === 'bellOut') { progress.bellOut = true; sound('bell-out'); emit({ bells: 'out' }); say('The outward note climbs the well toward the village… and nothing comes back.', 5); emit({}); return true; }
    if (c.id === 'bellReturn') {
      progress.bellReturn = true; applyWorld(); sound(progress.keepsake ? 'bell-return-full' : 'bell-return'); finaleT = 0; farAnswered = false; emit({ bells: 'return', echo: progress.keepsake });
      say(progress.keepsake ? 'The little keeper’s bell rings with it, and the whole phrase rolls down into the roots. The tree breathes in.' : 'The return note rolls down into the roots. The tree breathes in.', 5);
      emit({ finale: { duration: FINALE }, restored: 'hollow' }); return true;
    }
    return false;
  }
  function guardianEvent(e = {}) {
    if (e.vane || e.phase) { const at = e.vane?.at; if (at) wind.petals({ x: at[0], y: at[1] + 1, z: at[2] }, { count: 45 }); }
    if (e.done) { progress.guardian = true; applyWorld(); later(6.5, () => say('Two bells hang above the high ring: one faces the village, one faces the roots.', 6)); }
    // Only events main acts on are forwarded (breath/updraft notices are guardian-internal).
    const out = { ...(e.knock ? { knock: e.knock } : {}), ...(e.checkpoint ? { checkpoint: e.checkpoint } : {}), ...(e.done ? { restored: 'hollow' } : {}) };
    if (Object.keys(out).length) emit(out);
  }

  // ---- per frame ----
  function update(dt, t, p, { started = true, gentle = false, paused = false } = {}) {
    if (paused) return;
    time += dt;
    if (pendingCaption && time >= pendingCaption.at) { const q = pendingCaption; pendingCaption = null; q.fn(); }
    syncSources();
    // World-owned glint sprites (e.g. 'bh-frag2-glint') hide once their fragment is collected (pickup, restore, reset).
    for (const k of ['fragment1', 'fragment2', 'fragment3']) { const g = glints[k] ??= scene?.getObjectByName?.('bh-' + k.replace('ment', '') + '-glint') || false; if (g) g.visible = !fragments.has(k); }
    for (const k of ['fragment1', 'fragment2', 'fragment3']) if (pts[k] && !fragments.has(k)) { const f = pts[k]; for (let i = 0; i < 4; i++) { const a = t * 1.7 + i * Math.PI / 2, tw = .5 + .5 * Math.sin(t * 5 + i * 2); wind.strip(4, (g, o) => o.set(f.x + Math.cos(a) * .35, f.y + .8 + (g - .5) * .5 * tw, f.z + Math.sin(a) * .35), { width: .09 + .06 * tw, alpha: .9 * tw, taper: false, color: GOLD }); } }
    if (!started) return;
    // Reaching a ledge above a grille marks it (checkpoint + unlocks the next gust source).
    if (movement?.grounded) for (const v of Object.values(vents)) {
      if (!v.ledge || reached[v.id] || v.id.startsWith('ring')) continue;
      if (d2(p, v.ledge) < 3.6 && Math.abs(p.y - v.ledge.y) < .45) {
        reached[v.id] = true;
        if (v.id === 'loft') { progress.loft = true; say('The loft. The whole tree opens up: three still windmills on the branches, and the Hollow gate below.', 7); emit({ vista: 'mills' }); }
        else if (v.id === 'ladders3') say('The top ledge. The Mill of Ladders waits, still.', 4);
        emit({ checkpoint: arr(v.ledge) });
      }
    }
    if (millsDone() === 3 && !progress.skyBridge && near(p, pts.hollowGate, 3.5, 2.5)) {
      progress.skyBridge = progress.hollow = true;
      say('Inside the Hollow, an old gallery spirals down into the dark. The walls are carved.', 6);
      emit({ checkpoint: arr(pts.hollowGate) });
    }
    const carvingsDone = !carvingsLive() || progress.carvingOut && progress.carvingReturn;
    if (progress.hollow && !progress.guardian) guardian.update(dt, t, { hero: p, active: carvingsDone, gentle });
    else guardian.update(dt, t, { hero: p, active: false, gentle });
    if (finaleT >= 0 && !progress.finale) {
      const before = finaleT; finaleT += dt;
      if (before < 2 && finaleT >= 2) {
        // Wind floods back: the whole village animates alive while the camera rises.
        restoration.village = .95; restoration.terrace = 1; for (const [k, v] of Object.entries(restoration)) world.setRestored?.(k, v);
        for (const w of Object.values(wheels)) wind.petals(V(w.hub || w).setY((w.hub || w).y + 1), { count: 40, spread: 2.5, up: 3.5 });
        wind.petals(V(pts.morningBell).setY(pts.morningBell.y + 2), { count: 60, spread: 5 });
        say('Wind floods up through the tree. Every mill, lantern and pinwheel in Bellhollow wakes.', 5);
      }
      if (!farAnswered && finaleT >= 9.4) {
        farAnswered = true; sound('far-bell');
        if (pts.farBell) for (let i = 0; i < 3; i++) wind.burst(V(pts.farBell), { radius: 6 + i * 4, duration: 2.4 + i * .5, rays: 0, color: 0xe9b949 });
        say('Across the valley, faint and clear, the far bell answers.', 4.5);
      }
      if (finaleT >= FINALE) finishFinale();
    }
  }

  function finishFinale() {
    if (progress.finale || finaleT < 0) return;
    progress.finale = true; finaleT = -1; applyWorld(); say('Back on the terrace, Mara is waiting by the morning bell.', 5);
    emit({ teleport: arr(pts.finaleSpot), checkpoint: arr(pts.finaleSpot), mara: 'wave' });
  }
  function objective() {
    const pr = progress, inFlight = wind.busy && !wind.charged; // a gust in flight still counts as held
    if (pr.complete) return 'Bellhollow breathes again';
    if (pr.finale) return 'Ring the morning bell with Mara';
    if (finaleT >= 0) return 'Listen';
    if (pr.guardian) return !pr.bellOut ? 'Ring the outward bell' : 'Now ring the return bell';
    if (pr.hollow && carvingsLive() && !pr.carvingOut) return wind.charged ? 'Give the gust to the carving' : 'Catch the gust in the gallery';
    if (pr.hollow && carvingsLive() && !pr.carvingReturn) return wind.charged ? 'Give the gust to the second carving' : 'Catch the gallery gust again';
    if (pr.hollow) return guardian.objective?.() || 'Descend the carved gallery';
    if (millsDone() === 3) return 'Cross the sky bridge to the Hollow';
    if (!pr.bell) return 'Ring the morning bell';
    if (!pr.bypass) return 'Watch Mara’s bypass lever';
    if (!pr.staff) return 'Take the bell staff from Mara';
    if (!pr.seed) return wind.charged || inFlight ? 'Give the gust to the seed wheel' : 'Catch the gust at Mara’s copper outlet';
    // Released into the grille and riding (or about to): don't tell the player to catch again mid-rise.
    if (!pr.loft) return wind.charged ? 'Release the gust into the copper grille' : inFlight || movement?.column === 'vent:loft' ? 'Ride the updraft up to the loft' : 'Catch the seed wheel’s gust past the gate';
    const branch = branchNear(movement?.position);
    if (branch === 'sails') return !pr.sailsBridge ? (wind.charged ? 'Push the hanging bridge with the gust' : 'Catch the branch gust, then push the bridge') : cap && !pr.sailsCap ? (wind.charged ? 'Push the tail sail to turn the cap' : 'Catch the gust by the mill; turn its cap') : wind.charged ? 'Give the gust to the Mill of Sails' : 'Catch the gust spilling by the mill';
    if (branch === 'pipes') return seen.has('wrongOutlet') && !pr.pipesValve && !pr[valveWheel] ? 'Turn the valve by the wheel' : !pr.pipesA ? 'Power the pipe wheel with a gust' : !pr.pipesB ? 'Catch its gust over the gap; power wheel two' : wind.charged ? 'Give the gust to the Mill of Pipes' : 'Catch the gust at wheel two’s outlet';
    if (branch === 'ladders') return !reached.ladders1 || !reached.ladders2 ? 'Ride the grilles up the ledges' : !reached.ladders3 ? 'Push the shutter, then ride the grille' : wind.charged ? 'Give the gust to the Mill of Ladders' : 'Catch a gust for the Mill of Ladders';
    return `Wake the three windmills · ${millsDone()}/3`;
  }
  function branchNear(p) {
    if (!p || !progress.loft) return null;
    // Prefer the world's own branch zones when it has them.
    const zone = world.zones?.find(z => ['sails', 'pipes', 'ladders'].includes(z.id) && z.test?.(p.x, p.y, p.z))?.id;
    if (zone && !progress[zone]) return zone;
    let best = null, bd = 11;
    for (const k of ['sails', 'pipes', 'ladders']) { if (progress[k]) continue; const w = wheels[MILLS[k]]; const d = d2(p, w) - (k === 'ladders' ? 3 : 0); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  function objectiveTarget() {
    const pr = progress, c = wind.charged;
    if (pr.complete) return null;
    if (pr.finale) return V(pts.morningBell);
    if (pr.guardian) return V(pr.bellOut ? pts.bellReturn : pts.bellOut);
    if (pr.hollow && carvingsLive() && !(pr.carvingOut && pr.carvingReturn)) return c ? intake(pr.carvingOut ? 1 : 0) : V(gallerySource);
    if (pr.hollow) return guardian.target?.() || V(pts.arena);
    if (millsDone() === 3) return V(pts.hollowGate);
    if (!pr.bell) return V(pts.morningBell);
    if (!pr.staff) return V(pts.mara);
    if (!pr.seed) return V(c ? pts.seedWheel : pts.maraOutlet);
    if (!pr.loft) return c ? V(vents.loft) : V(wheels.seed.outlet);
    const b = branchNear(movement?.position);
    if (b === 'sails') return V(!pr.sailsBridge ? (c ? sails.sailsBridge : pts.sailsSource || pts.loftGust) : cap && !pr.sailsCap ? (c ? cap : pts.sailsGust) : c ? pts.millSails : pts.sailsGust);
    if (b === 'pipes') return V(seen.has('wrongOutlet') && valve && !pr.pipesValve && !pr[valveWheel] ? valve : !pr.pipesA ? (c ? wheels.pipesA : pts.pipesSource || pts.loftGust) : !pr.pipesB ? (c ? wheels.pipesB : wheels.pipesA.outlet) : c ? pts.millPipes : wheels.pipesB.outlet);
    if (b === 'ladders') return V(!reached.ladders1 ? vents.ladders1 : !reached.ladders2 ? vents.ladders2 : !reached.ladders3 ? vents.ladders3 : pts.millLadders);
    return V(pts.loft);
  }
  function skipFinale() { if (finaleT >= 0 && !progress.finale) { if (!farAnswered) { farAnswered = true; sound('far-bell'); } finishFinale(); } }
  // Safe fallback spots in story order, most advanced first (used to validate restores and 'return to safety').
  function safeAnchors() {
    const a = [], add = q => { q = P3(q); if (q && [q.x, q.y, q.z].every(Number.isFinite)) a.push(q); };
    if (progress.finale) add(pts.finaleSpot);
    if (progress.guardian) add(pts.ring3); if (progress.hollow) { add(pts.ring1); add(pts.hollowGateInside); add(pts.hollowGate); }
    for (const id of ['ladders3', 'ladders2', 'ladders1', 'loft']) if (reached[id]) add(vents[id]?.ledge);
    if (progress.seed) add(pts.seedWheel); add(pts.mara); add(pts.start);
    return a;
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
  function telemetry() { return { ...progress, reached: { ...reached }, fragments: fragments.size, keepsake: progress.keepsake, mills: millsDone(), carvingsLive: carvingsLive(), charge: wind.charge?.origin ?? null, guardian: guardian.telemetry?.() ?? null, finaleT: finaleT >= 0 ? +finaleT.toFixed(2) : null, context: last?.id ?? null }; }
  applyWorld(); syncSources();
  return {
    progress, reached, restoration, safeAnchors, context, interact, update, objective, objectiveTarget, hint, area, serialize, restore, reset, telemetry, guardian,
    get finaleShot() { return finaleT >= 0 ? Math.min(1, finaleT / FINALE) : progress.finale ? 1 : 0; }, get finaleTime() { return finaleT; }, get finaleActive() { return finaleT >= 0; }, skipFinale,
    subject() { return progress.hollow && !progress.guardian ? guardian.subject?.() ?? null : null; },
    get staff() { return progress.staff; },
  };
}
