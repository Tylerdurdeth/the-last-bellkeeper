// Quest logic with the stub world, real movement and real wind (no browser). Positions are set
// directly: this proves progression, contexts, events, saves and restore; tools/test-v2-route.mjs
// is the ordinary-input end-to-end proof.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMovement } from '../game/movement.js';
import { createWind } from '../game/bellhollow/wind.js';
import { createQuest, validateWorld, QUEST_VERSION } from '../game/bellhollow/quest.js';
import { buildBellhollow } from '../game/bellhollow/stub-world.js';
import { readSave, writeSave, SAVE_KEY, LEGACY_KEY, hasLegacySave } from '../game/adventure-save.js';

const scene = new THREE.Scene();
const world = await buildBellhollow({ THREE, scene });
assert.deepEqual(validateWorld(world), [], 'stub world satisfies the quest contract');
const P = world.points;
const movement = createMovement(THREE, { inputTarget: new EventTarget(), start: [P.start.x, P.start.y, P.start.z], sampleGround: world.ground, blocked: world.blocked, maxDrop: 14 });
const wind = createWind({ THREE, scene, movement });
const captions = [], events = [];
let quest;
function build() {
  quest = createQuest({ THREE, scene, world, wind, movement, caption: t => captions.push(t), sound: () => {}, onChange: (pr, e) => { events.push(e); if (e.knock?.to) movement.knockback({ to: e.knock.to }); if (e.teleport) movement.reset(e.teleport); } });
}
build();
let t = 0;
function tick(seconds, hz = 60) { for (let i = 0; i < Math.round(seconds * hz); i++) { t += 1 / hz; movement.update(1 / hz); world.update(1 / hz, t, { wind: wind.state(), restored: world.restored }); wind.update(1 / hz, t, { hero: movement.position, staffTip: movement.position.clone().setY(movement.position.y + 1.5) }); quest.update(1 / hz, t, movement.position, { started: true }); wind.flush(); } }
function at(p, dy = 0) { movement.reset([p.x, p.y + dy, p.z]); tick(.05); }
function ctx() { return quest.context(movement.position, movement.yaw); }
function act(expectKind, expectId) {
  const c = ctx(); assert(c, `expected a context (${expectKind}/${expectId}) at ${movement.position.toArray().map(v => v.toFixed(1))}`);
  if (expectKind) assert.equal(c.kind, expectKind, `kind for ${expectId}: got ${c.kind}/${c.id} "${c.label}"`);
  if (expectId) assert.equal(c.id, expectId);
  assert(quest.interact(c, { position: movement.position, yaw: movement.yaw }), 'interaction accepted: ' + c.label);
  tick(.7); return c;
}
function catchAt(p) { at(p); act('catch'); assert(wind.charged, 'charged after catch'); }
function face(p) { movement.yaw = Math.atan2(p.x - movement.position.x, p.z - movement.position.z); }

// --- terrace intro beats ---
assert.equal(quest.objective(), 'Ring the morning bell');
at(P.mara); let c = ctx(); assert.equal(c.kind, 'info'); quest.interact(c); assert.match(captions.at(-1), /Ring the bell/);
at(P.maraOutlet); assert.equal(ctx()?.kind ?? null, null, 'no gust before the bypass');
at(P.morningBell, 0); act('ring', 'morningBell'); assert(quest.progress.bell);
tick(2.6); assert(quest.progress.bypass, 'bypass opens a beat after the bell');
at(P.maraOutlet); c = ctx(); assert.equal(c.kind, 'info'); assert.equal(c.id, 'nostaff');
at(P.mara); act('talk', 'staff'); assert(quest.progress.staff);
// Space near the seed wheel without wind explains exactly where to get it.
at(P.seedWheel, 0); movement.position.z += 1.5; c = ctx(); assert.equal(c.kind, 'info'); assert.match(c.why, /Mara’s copper outlet/);
catchAt(P.maraOutlet); assert.equal(quest.objective(), 'Give the gust to the seed wheel');
at({ x: P.seedWheel.x, y: 0, z: P.seedWheel.z + 2.5 }); face(P.seedWheel); act('give', 'seed'); assert(quest.progress.seed); assert(!wind.charged);
tick(1.8); assert(wind.pushValue('terraceGate') > .95, 'gate swung open');
assert(!world.blocked(0, -4, .23, 0), 'gate no longer blocks');
assert(events.some(e => e.restored === 'terrace'), 'terrace restoration event'); assert(world.restored.terrace >= .5);
// Chain: the seed wheel puffs a gust at its outlet, right by the grille.
assert(wind.sources.has('chain:seed'), 'seed wheel emits a chained gust');
catchAt(world.wheels.find(w => w.id === 'seed').outlet);
const loftVent = world.vents.find(v => v.id === 'loft');
at({ x: loftVent.x + .8, y: 0, z: loftVent.z + .8 }); face(loftVent); act('vent', 'loft');
// Physically ride the column and steer onto the loft ledge.
movement.reset([loftVent.x, 0, loftVent.z]); tick(1.6); assert(movement.position.y > 4.2, 'column lifts to the loft: ' + movement.position.y);
assert(movement.lifting);
movement.velocity.z = -3; for (let i = 0; i < 60 && movement.position.z > -10.6; i++) { movement.velocity.z = -3; tick(1 / 60); }
tick(1.2); assert(movement.grounded && Math.abs(movement.position.y - 4) < .01, 'landed on the loft at ' + movement.position.toArray());
assert(quest.progress.loft, 'loft reached'); assert(events.some(e => e.checkpoint && e.checkpoint[1] === 4));

// --- Mill of Sails: push the hanging bridge, cross, give ---
catchAt(P.loftGust);
at({ x: -6, y: 4, z: -13 }); face(world.sails[0]); act('push', 'sailsBridge'); tick(1.6);
assert(quest.progress.sailsBridge && wind.pushValue('sailsBridge') > .95); assert.equal(world.ground(-11.5, -13, 4), 4, 'bridge is walkable');
// The lever resets it (visible reset), and a push restores it.
at(world.sails[0].lever); act('lever'); tick(1.4); assert(!quest.progress.sailsBridge); assert.equal(world.ground(-11.5, -13, 4), null);
catchAt(P.loftGust); at({ x: -6, y: 4, z: -13 }); face(world.sails[0]); act('push', 'sailsBridge'); tick(1.6);
catchAt(P.sailsGust); assert.match(quest.objective(), /cap/i, 'objective names the cap');
at({ x: -12.8, y: 4, z: -11.2 }); face(P.millSails); c = ctx(); assert.equal(c.kind, 'info', 'wrong order: the mill refuses'); assert.match(c.why, /face away.*turn the cap/i);
at({ x: -15, y: 4, z: -14.2 }); face(world.sails.find(x => x.id === 'sailsCap')); act('push', 'sailsCap'); tick(1.9); assert(quest.progress.sailsCap && wind.pushValue('sailsCap') > .95);
tick(1); catchAt(P.sailsGust); at({ x: -13, y: 4, z: -12.5 }); face(P.millSails); act('give', 'millSails'); assert(quest.progress.sails);
assert.equal(world.restored.skyBridge, 1 / 3);

// --- Mill of Pipes: chain two wheels across a gap ---
catchAt(P.loftGust); at({ x: 8.5, y: 4, z: -13 }); face(world.wheels[1]); act('give', 'pipesA'); tick(1.2);
assert(wind.sources.has('chain:pipesA'), 'wheel A spits a gust across the gap');
catchAt(world.wheels[1].outlet); at({ x: 17.9, y: 4, z: -12.4 }); c = ctx(); assert.equal(c.id, 'pipesB', 'a held gust prefers the mandatory wheel over the optional frag2 sail beside it');
at({ x: 16.5, y: 4, z: -11.5 }); face(world.wheels[2]); act('give', 'pipesB'); tick(1.5);
assert(!quest.progress.pipesB, 'valve closed: the gust leaves by the wrong outlet'); assert(!wind.charged); assert.match(quest.objective(), /valve/i);
at(P.pipesValve); act('lever', 'pipesValve'); assert(quest.progress.pipesValve); tick(1);
catchAt(world.wheels[1].outlet); at({ x: 16.5, y: 4, z: -11.5 }); face(world.wheels[2]); act('give', 'pipesB'); tick(1.2); assert(quest.progress.pipesB);
catchAt(world.wheels[2].outlet); at({ x: 16, y: 4, z: -15.5 }); face(P.millPipes); act('give', 'millPipes'); assert(quest.progress.pipes);

// --- Mill of Ladders: three updrafts, the timed shutter ---
const vent = id => world.vents.find(v => v.id === id);
function ride(id) { const v = vent(id); catchAt(id === 'ladders1' ? P.laddersGust1 : id === 'ladders2' ? P.laddersGust2 : P.laddersGust3); at({ x: v.x + .6, y: v.y, z: v.z + .6 }); face(v); act('vent', id); movement.reset([v.x, v.y, v.z]); tick(1.8); assert(movement.position.y > v.ledge.y, id + ' lifts'); at(v.ledge); tick(.2); assert(quest.reached[id], id + ' reached'); }
ride('ladders1'); ride('ladders2');
// Shutter closed: a held gust at the grille explains itself, instead of a generic caption.
catchAt(P.laddersGust3); at({ x: vent('ladders3').x + .5, y: 12, z: vent('ladders3').z + 1.5 }); face(vent('ladders3'));
c = ctx(); assert.equal(c.kind, 'push', 'with a gust near the shut grille, the push target is offered'); quest.interact(c); tick(1);
assert(wind.pushValue('laddersShutter') > .9 && wind.pushHoldLeft('laddersShutter') > 5, 'shutter open with a visible countdown');
catchAt(P.laddersGust3); tick(1.4); if (!wind.charged) catchAt(P.laddersGust3);
at({ x: vent('ladders3').x + .5, y: 12, z: vent('ladders3').z + 1.5 }); face(vent('ladders3')); act('vent', 'ladders3');
movement.reset([vent('ladders3').x, 12, vent('ladders3').z]); tick(1.8); assert(movement.position.y > 16); at(vent('ladders3').ledge); tick(.3); assert(quest.reached.ladders3);
tick(9); assert(wind.pushValue('laddersShutter') < .05, 'shutter closes itself again');
catchAt(vent('ladders3').ledge); at({ x: 6.3, y: 16, z: -25.6 }); face(P.millLadders); act('give', 'millLadders'); assert(quest.progress.ladders);
assert.equal(world.restored.skyBridge, 1); assert.equal(quest.objective(), 'Cross the sky bridge to the Hollow');
assert.equal(world.ground(-18, -17.5, 4), 4, 'sky bridge complete');

// --- Hollow gallery, guardian (stub) and the paired bells ---
at(P.hollowGate); assert(quest.progress.hollow);
assert.equal(quest.objective(), 'Catch the gust in the gallery');
catchAt(P.gallery.source); at(P.carvingReturn); face(P.gallery.carvings[1].intake); c = ctx(); assert.equal(c.kind, 'info', 'second carving waits for the first');
at(P.carvingOut); face(P.gallery.carvings[0].intake); act('give', 'carvingOut'); assert(quest.progress.carvingOut); assert.equal(world.restored.carving0, 1);
catchAt(P.gallery.source); at(P.carvingReturn); face(P.gallery.carvings[1].intake); act('give', 'carvingReturn'); assert(quest.progress.carvingReturn); assert.equal(world.restored.carving1, 1);
at(P.gallery.carvings[2].stand); act('read', 'lore2');
for (const k of ['fragment1', 'fragment2', 'fragment3']) { at(P[k]); act('pick', k); }
assert(quest.progress.keepsake, 'three fragments make the keepsake'); assert(captions.some(t => /hold the door/.test(t)));
assert(!captions.some(t => /exhausted|only ever|villain|protecting the tree/i.test(t)), 'captions never state the twist');
at(P.ring1); for (let phase = 0; phase < 3; phase++) {
  // Wait for a spent breath; stand in it, catch, give to the vane.
  const ringP = P['ring' + (phase + 1)]; at(ringP);
  let src = null; for (let i = 0; i < 12 * 60 && !src; i++) { tick(1 / 60); if (movement.knocked) tick(1); src = wind.sources.get('guardianBreath'); }
  assert(src, 'guardian leaves a spent breath in phase ' + phase);
  at(src); act('catch', 'guardianBreath'); const vane = P['vane' + (phase + 1)]; at({ x: vane.x + 1.5, y: vane.y, z: vane.z + 1.5 }); face(vane); act('give', 'vane');
  assert.equal(quest.guardian.phase, phase + 1);
}
assert(quest.progress.guardian);
at(P.bellReturn); c = ctx(); assert.equal(c.kind, 'info', 'return bell first explains the order');
at(P.bellOut); act('ring', 'bellOut'); at(P.bellReturn); act('ring', 'bellReturn'); assert(quest.finaleActive);
assert(events.some(e => e.finale));
tick(16.3); assert(quest.progress.finale); assert(captions.some(t => /far bell answers/.test(t)), 'far bell answers in the finale'); assert(movement.position.distanceTo(new THREE.Vector3(P.finaleSpot.x, P.finaleSpot.y, P.finaleSpot.z)) < .6, 'finale returns the hero to the terrace');
assert.equal(quest.objective(), 'Ring the morning bell with Mara');
at(P.morningBell); act('ring', 'morningBell'); assert(quest.progress.complete); assert(events.some(e => e.complete));
tick(6); assert.match(captions.at(-1), /I taught you how to call it/);
assert.equal(world.restored.village, 1);

// --- save/restore v2; v1 ignored ---
const store = new Map(); const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
storage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, state: {}, checkpoint: [0, 0, 0] }));
assert.equal(readSave(storage), null); assert(hasLegacySave(storage));
// Mid-route save: rebuild a quest after two mills and a held charge.
quest.reset(); movement.reset([P.start.x, 0, P.start.z]);
Object.assign(quest.progress, { bell: true, bypass: true, staff: true, seed: true, loft: true, sailsBridge: true, sails: true, pipesA: true, pipesB: true, pipes: true });
quest.reached.loft = true; wind.setCharge('loftGust');
assert(writeSave({ quest, checkpoint: [0, 4, -12.5], settings: {} }, storage));
const saved = readSave(storage); assert.equal(saved.version, 2); assert.equal(saved.quest.version, QUEST_VERSION);
wind.reset(); build(); assert(quest.restore(saved.quest));
assert(quest.progress.pipes && quest.progress.sails && !quest.progress.ladders); assert(wind.charged, 'held charge survives a save');
assert(wind.pushValue('sailsBridge') === 1 && wind.pushValue('terraceGate') === 1, 'pushed states persist instantly');
assert.equal(world.restored.skyBridge, 2 / 3);
assert(!readSave({ getItem: () => '{"version":2,"quest":{},"checkpoint":[0,0,1e9]}' }), 'rejects out-of-range checkpoint');
console.log(`PASS: v2 quest route with stub world — terrace beats, chain, updraft, push+reset lever, sails cap (wrong-order hint), pipes valve (wrong outlet, no penalty), timed shutter, gallery carvings by wind, fragments + keepsake, three mills in order, sky bridge, gallery, guardian stub 3 phases, paired bells, finale, Mara ending; saves v2 (v1 ignored). ${captions.length} captions.`);
