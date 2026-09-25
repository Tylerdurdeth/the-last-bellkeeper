// Villagers of Bellhollow (rebuild): four bespoke people from references-v2/R-villagers.png, placed OFF every walkable
// route (never on the boardwalk ring, the bell-plaza steps or any gust/vent/anchor inlay), each against a wall or at the
// market, facing the street. They glance up worried at the silent bells before restoration, cheer when a mill they
// watch is restored, and turn their heads toward the hero when near. No benches, no gameplay.
// createVillagers({THREE, scene, world, look}) -> {update(dt, t, {hero, restored, gentle}), list, root, telemetry()}
import buildVillager from '../assets/bh-villager.js';
import { loadNpcMotion, createNpcMotion } from '../npc-motion.js';
// CC0 Quaternius idle per person (game/assets/quaternius/npc-motion.json); props' arms are posed over the clip.
export const VILLAGER_CLIPS = { baker: { clip: 'Idle_Talking_Loop', phase: .1 }, elder: { clip: 'Idle_Loop', phase: .55, rate: .8 }, girl: { clip: 'Idle_Loop', phase: .3, rate: 1.1 }, seller: { clip: 'Idle_Loop', phase: .8, rate: .95 } };

const DEG = Math.PI / 180, polar = (az, r) => [r * Math.sin(az * DEG), r * Math.cos(az * DEG)];
// who, preferred spot (terrace azimuth / radius from the trunk), the mill (area) they watch
const CAST = [
  { who: 'baker', az: -12, r: 23.4, mill: 'terrace' },       // on the outer rim near the start, in the open (seen from the street)
  { who: 'elder', az: -55, r: 24, mill: 'sails' },           // on the market rim beside the planters, watching the street
  { who: 'girl', az: -38.5, r: 23.6, mill: 'ladders' },      // between the market stalls, pinwheel up
  { who: 'seller', az: -27, r: 22.9, mill: 'pipes' },        // in front of the market stalls (street side, not under the awning)
];
const BOARDWALK = [18.5, 22.2];                               // the street ring (world.js 18.8..21.8, padded)

// Shipping switch. The 25 Sep rebuild (Mara-method heads, CC0 Quaternius idles) is ON; if an independent review says they
// are below the hero/Mara bar, set VILLAGERS_DEFAULT = false: nothing is then added (no people, no props, no colliders).
// URL override for comparisons: ?villagers=0 / ?villagers=1.
const VILLAGERS_DEFAULT = true;
const villagerParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('villagers') : null;
export const VILLAGERS_ENABLED = villagerParam === '1' ? true : villagerParam === '0' ? false : VILLAGERS_DEFAULT;
export function createVillagers({ THREE: T, scene, world, look = null } = {}) {
  if (!VILLAGERS_ENABLED) { const root = new T.Group(); root.name = 'villagers'; return { root, list: [], update() {}, telemetry: () => [] }; }
  const P = world.points || {}, root = new T.Group(); root.name = 'villagers'; scene.add(root);
  const ground = (x, z, y = 3) => { const g = world.ground?.(x, z, y); return typeof g === 'number' ? g : null; };
  // Everything a player walks to or through: anchors, gust/vent spots, wheels, sails (keep 2.5 m clear).
  const keepOut = [];
  const walk = (o, d = 0) => { if (!o || d > 2) return; if (Number.isFinite(o.x) && Number.isFinite(o.z)) keepOut.push({ x: o.x, z: o.z, y: o.y ?? 0, r: 2.5 }); else if (typeof o === 'object') for (const v of Object.values(o)) walk(v, d + 1); };
  walk(P); for (const v of world.vents || []) keepOut.push({ x: v.x, z: v.z, y: v.y, r: (v.radius || 1) + 2 }); for (const w of [...(world.wheels || []), ...(world.sails || [])]) keepOut.push({ x: w.x, z: w.z, y: w.y ?? 0, r: 2.5 });
  const ray = new T.Raycaster(), down = new T.Vector3(0, -1, 0);
  function surfaceOk(x, y, z) { // no standing on inlays/medallions (emissive inlay materials) or the timber deck
    if (!world.root) return true; ray.set(new T.Vector3(x, y + 1.5, z), down); ray.far = 2.5;
    const hit = ray.intersectObject(world.root, true)[0]; if (!hit) return true;
    const m = [].concat(hit.object.material)[0] || {}, k = m.userData?.bhKey || '';
    return !/inlay|deck/i.test(k) && !(m.emissive && m.emissiveIntensity > .1 && m.name === 'glass');
  }
  function spot(c) {
    const [tx, tz] = polar(c.az, c.r), cands = [];
    for (let dx = -3.5; dx <= 3.5; dx += .35) for (let dz = -3.5; dz <= 3.5; dz += .35) {
      const x = tx + dx, z = tz + dz, r = Math.hypot(x, z), az = Math.atan2(x, z) / DEG, y = ground(x, z);
      if (y === null || y < -.3 || y > 1.3 || az < -99 || az > -9) continue;
      if (r > BOARDWALK[0] && r < BOARDWALK[1]) continue;                                       // never on the street
      if (az > -72 && az < -39 && r < 20.5) continue;                                          // nor on the bell plaza or its steps
      if (keepOut.some(k => Math.abs(k.y - y) < 2 && Math.hypot(k.x - x, k.z - z) < k.r)) continue;
      if (world.blocked?.(x, z, .45, y)) continue;
      if ([.5, -.5].some(d => Math.abs((ground(x + d, z, y + .5) ?? -9) - y) > .3 || Math.abs((ground(x, z + d, y + .5) ?? -9) - y) > .3)) continue;   // not at a step/edge
      let wall = 0; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; if (world.blocked?.(x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2, .2, y)) wall++; }
      cands.push({ x, y, z, score: Math.hypot(dx, dz) - (wall ? 1.5 : 0) });                  // prefer backing onto a wall or prop
    }
    cands.sort((a, b) => a.score - b.score);
    return cands.find(q => surfaceOk(q.x, q.y, q.z)) || cands[0] || { x: tx, y: ground(tx, tz) ?? 0, z: tz };
  }
  const list = [];
  for (const c of CAST) {
    const s = spot(c), v = buildVillager(T, { who: c.who }); v.name = 'villager-' + c.who;
    v.position.set(s.x, s.y, s.z);
    const [fx, fz] = polar(Math.atan2(s.x, s.z) / DEG, 20.3); const yaw = Math.atan2(fx - s.x, fz - s.z);   // face the street
    v.rotation.y = yaw; root.add(v); look?.applyTo?.(v, 'character');
    list.push({ v, s: c, id: c.who, motion: null, x: s.x, y: s.y, z: s.z, yaw, cheer: 0, headYaw: 0, headPitch: 0, look: 0, seed: list.length * 1.7 });
  }
  loadNpcMotion().then(data => { for (const o of list) o.motion = createNpcMotion(T, o.v, data, VILLAGER_CLIPS[o.id]); }).catch(e => console.warn('villager motion unavailable', e));
  const last = {};
  function update(dt, t, { hero = null, restored = {}, gentle = false } = {}) {
    for (const o of list) {
      const r = restored[o.s.mill] ?? 0; if (r > (last[o.id] ?? r) + .2) o.cheer = 3.2; last[o.id] = r;
      const village = Math.max(r, restored.village ?? 0) > .45;
      let act = 'idle';
      if (o.cheer > 0) { o.cheer -= dt; act = o.cheer > .9 ? 'cheer' : 'wave'; }
      else if (!village && Math.sin(t * .21 + o.seed * 2.1) > .7) act = 'worried';                 // glances up at the silent bells now and then
      let want = 0, yaw = 0, pitch = 0;
      if (hero) { const dx = hero.x - o.x, dz = hero.z - o.z, d = Math.hypot(dx, dz); if (d < 6) { want = 1; yaw = Math.atan2(Math.sin(Math.atan2(dx, dz) - o.yaw), Math.cos(Math.atan2(dx, dz) - o.yaw)); pitch = Math.atan2((hero.y ?? o.y) + 1.2 - (o.y + 1.5), d); } }
      yaw = Math.max(-1.1, Math.min(1.1, yaw));
      o.look += (want - o.look) * (1 - Math.exp(-dt * 3)); o.headYaw += (yaw - o.headYaw) * (1 - Math.exp(-dt * 4)); o.headPitch += (pitch - o.headPitch) * (1 - Math.exp(-dt * 4));
      o.v.userData.setPose({ t: t + o.seed, motion: o.motion, act, yaw: o.headYaw, pitch: -o.headPitch, look: o.look * (act === 'cheer' ? .3 : 1), gentle });
    }
  }
  return { root, list, update, telemetry: () => list.map(o => ({ id: o.id, at: [o.x, o.y, o.z].map(n => +n.toFixed(2)), r: +Math.hypot(o.x, o.z).toFixed(2), cheer: +o.cheer.toFixed(2) })) };
}
