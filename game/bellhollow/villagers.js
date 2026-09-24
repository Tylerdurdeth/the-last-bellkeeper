// Villagers of Bellhollow: 7 seeded folk with idle vignettes on the terrace and market, reacting to the
// silent bells (worried, looking up) and to each restored mill (a short cheer, then back to work, happier).
// No gameplay. createVillagers({THREE, scene, world, look}) -> {update(dt, t, {hero, restored, gentle}), list, telemetry()}
//   restored: quest.restoration ({terrace, sails, pipes, ladders, village ...} 0..1).
// Budget: each villager <= 6 draws with outlines (body + head hulls; arms/props no hull), ~4k tris; + one bench.
import buildVillager from '../assets/bh-villager.js';

const SPOTS = [
  // role, anchor (world.points key or [x,z]), offset [dx,dz], facing target (key or [x,z]), act, mill it watches
  { role: 'sweeper', at: 'morningBell', off: [2.6, 2.2], face: 'morningBell', act: 'sweep', mill: 'terrace', seed: 3 },
  { role: 'worried', at: 'morningBell', off: [-.6, 2.9], face: 'morningBellObject', act: 'worried', mill: 'terrace', seed: 11 },
  { role: 'sitter', at: 'start', off: [-3.4, -1.2], face: 'morningBell', act: 'sit', mill: 'ladders', seed: 5, bench: true },
  { role: 'chat', at: 'seedWheel', off: [4.2, 4.6], face: 'pairB', act: 'chat', mill: 'sails', seed: 21, id: 'pairA' },
  { role: 'chat', at: 'seedWheel', off: [5.4, 5.4], face: 'pairA', act: 'chat', mill: 'sails', seed: 34, id: 'pairB' },
  { role: 'child', at: 'start', off: [-1.6, -3.2], face: 'morningBell', act: 'pinwheel', mill: 'ladders', seed: 8 },
  { role: 'keeper', at: [-9.5, 24.9], off: [0, 0], face: [0, 0], act: 'keeper', mill: 'pipes', seed: 17 },   // behind the first market stall
];

export function createVillagers({ THREE: T, scene, world, look = null } = {}) {
  const P = world.points || {}, root = new T.Group(); root.name = 'villagers'; scene.add(root);
  const xz = a => Array.isArray(a) ? { x: a[0], z: a[1], y: 0 } : P[a] || null;
  const ground = (x, z, y = 2) => { const g = world.ground?.(x, z, y); return typeof g === 'number' ? g : null; };
  const free = (x, z, y) => ground(x, z, y + 1) !== null && Math.abs(ground(x, z, y + 1) - y) < .6 && !world.blocked?.(x, z, .35, y);
  const list = [];
  for (const s of SPOTS) {
    const a = xz(s.at); if (!a) continue;
    let x = a.x + s.off[0], z = a.z + s.off[1], y = ground(x, z, (a.y || 0) + 1) ?? a.y ?? 0;
    // Nudge onto open floor (spiral) if the authored spot is blocked or off the deck.
    if (!free(x, z, y)) { outer: for (let r = .5; r <= 3; r += .5) for (let k = 0; k < 12; k++) { const nx = x + Math.cos(k / 12 * Math.PI * 2) * r, nz = z + Math.sin(k / 12 * Math.PI * 2) * r, ny = ground(nx, nz, y + 1); if (ny !== null && free(nx, nz, ny)) { x = nx; z = nz; y = ny; break outer; } } }
    const v = buildVillager(T, { role: s.role, seed: s.seed }); v.name = 'villager-' + (s.id || s.role);
    v.position.set(x, y, z); root.add(v);
    let bench = null;
    if (s.bench) { // one merged timber mesh (seat + two legs): 1 draw
      const wood = new T.MeshStandardMaterial({ color: 0xC8894A, roughness: .85 }); wood.name = 'timber';
      const parts = [new T.BoxGeometry(1.3, .08, .42).translate(0, .43, 0), new T.BoxGeometry(.1, .4, .36).translate(-.55, .2, 0), new T.BoxGeometry(.1, .4, .36).translate(.55, .2, 0)].map(g => g.toNonIndexed());
      const g = new T.BufferGeometry(); for (const k of ['position', 'normal']) g.setAttribute(k, new T.Float32BufferAttribute(parts.flatMap(q => [...q.attributes[k].array]), 3));
      bench = new T.Mesh(g, wood); bench.castShadow = bench.receiveShadow = true;
      bench.position.set(x, y, z); root.add(bench); }
    look?.applyTo?.(v, 'character');
    list.push({ v, s, x, y, z, yaw: 0, baseYaw: 0, cheer: 0, seen: 0, headYaw: 0, headPitch: 0, look: 0, id: s.id || s.role });
  }
  // Facing: toward the authored target (partners face each other).
  for (const o of list) {
    const f = o.s.face, t = typeof f === 'string' && f.startsWith('pair') ? list.find(q => q.id === f) : null;
    const p = t ? { x: t.x, z: t.z } : xz(f) || { x: 0, z: 0 };
    o.baseYaw = o.yaw = Math.atan2(p.x - o.x, p.z - o.z); if (o.s.role === 'sitter') o.baseYaw = o.yaw = o.baseYaw; o.v.rotation.y = o.yaw;
    const bench = o.s.bench && root.children.find(c => c !== o.v && c.position.x === o.x && c.position.z === o.z); if (bench) bench.rotation.y = o.yaw;
    o.bellTarget = P.morningBellObject || P.morningBell || null;
  }
  const last = {};
  function update(dt, t, { hero = null, restored = {}, gentle = false } = {}) {
    for (const o of list) {
      // A mill (or area) this villager watches just got restored: cheer for ~3 s, then work happily.
      const r = restored[o.s.mill] ?? 0; if (r > (last[o.id] ?? r) + .2) o.cheer = 3.2; last[o.id] = r;
      const village = Math.max(r, restored.village ?? 0, restored.terrace ?? 0) > .45;
      let act = o.s.act;
      if (o.cheer > 0) { o.cheer -= dt; act = o.cheer > .9 ? 'cheer' : 'wave'; }
      else if (!village && o.s.role !== 'sitter' && o.s.role !== 'child' && Math.sin(t * .23 + o.s.seed) > .55) act = 'worried';   // glances up at the silent bells now and then
      if (village && o.s.act === 'worried') act = o.cheer > 0 ? act : 'chat';
      // Heads turn toward the hero when near (and the worried one looks up at the bell otherwise).
      let want = 0, yaw = 0, pitch = 0;
      if (hero) { const dx = hero.x - o.x, dz = hero.z - o.z, d = Math.hypot(dx, dz); if (d < 5.5) { want = 1; yaw = Math.atan2(Math.sin(Math.atan2(dx, dz) - o.yaw), Math.cos(Math.atan2(dx, dz) - o.yaw)); pitch = Math.atan2((hero.y ?? o.y) + 1.2 - (o.y + 1.5), d) ; } }
      if (Math.abs(yaw) > 1.4) yaw = Math.sign(yaw) * 1.4;
      o.look += (want - o.look) * (1 - Math.exp(-dt * 3)); o.headYaw += (yaw - o.headYaw) * (1 - Math.exp(-dt * 4)); o.headPitch += (pitch - o.headPitch) * (1 - Math.exp(-dt * 4));
      o.v.userData.setPose({ t: t + o.s.seed, act, yaw: o.headYaw, pitch: -o.headPitch, look: o.look * (act === 'cheer' ? .3 : 1), gentle });
      if (o.s.role === 'child' && o.v.userData.joints.prop) o.v.userData.joints.prop.rotation.z = -(t * (gentle ? 2 : 3 + 9 * Math.max(restored.ladders ?? 0, restored.village ?? 0)));
    }
  }
  return { root, list, update, telemetry: () => list.map(o => ({ id: o.id, role: o.s.role, at: [o.x, o.y, o.z].map(n => +n.toFixed(2)), cheer: +o.cheer.toFixed(2) })) };
}
