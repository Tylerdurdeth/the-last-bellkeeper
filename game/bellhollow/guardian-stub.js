// Placeholder guardian encounter until game/bellhollow/guardian.js exists. It honours the same
// interface quest.js delegates to, so the route is playable end to end:
//   createGuardian({THREE, scene, world, wind, movement, sound, caption, onEvent}) -> {
//     update(dt, t, {hero, active, gentle}), context(p, yaw, charged) -> ctx|null,
//     interact(ctx, {staffTip}) -> bool, phase (0..3; 3 = calm), done, subject() -> Box3|null,
//     objective() -> string|null, serialize(), restore(data), reset(), telemetry() }
//   onEvent({knock:{to:[x,y,z]}} | {checkpoint:[x,y,z]} | {phase:n} | {done:true})
// Encounter clock per cycle: 3 s inhale (floor lane + filling countdown), 1.2 s exhale (hits
// knock back to the ring's safe ledge, no progress loss), 4.8 s spent breath to catch at the
// lane end (its ring empties as the window closes). Vane k turns -> the next ring opens.
export function createGuardian({ THREE: T, scene, world, wind, movement, sound = () => {}, caption = () => {}, onEvent = () => {} }) {
  const pts = world.points, CORAL = new T.Color(0xd96956);
  const vents = Object.fromEntries(world.vents.map(v => [v.id, v]));
  const body = new T.Group(); body.name = 'guardian-stub'; scene.add(body);
  const shell = new T.Mesh(new T.CylinderGeometry(.9, 1.7, 3, 20, 1, true), new T.MeshStandardMaterial({ color: 0x3e9c8c, side: T.DoubleSide, roughness: .6 }));
  const heart = new T.Mesh(new T.SphereGeometry(.55, 16, 12), new T.MeshStandardMaterial({ color: 0xe9b949, emissive: 0xe9b949, emissiveIntensity: .4 }));
  shell.position.y = 1.5; heart.position.y = 1.2; body.add(shell, heart);
  for (let i = 0; i < 6; i++) { const petal = new T.Mesh(new T.BoxGeometry(.9, .12, 1.8), new T.MeshStandardMaterial({ color: 0xd96956 })); petal.position.set(Math.cos(i) * 1.1, 3.1, Math.sin(i) * 1.1); petal.rotation.y = -i; petal.rotation.x = .5; body.add(petal); }
  body.position.set(pts.guardian.x, pts.guardian.y, pts.guardian.z);
  const box = new T.Box3();
  const ring = k => pts['ring' + (k + 1)], vane = k => pts['vane' + (k + 1)];
  const cycle = 9;
  let phase = 0, clock = 0, cycleIndex = -1, hitThisCycle = false, warned = false, laneSide = 0, pulseOpened = false;
  const laneEnd = new T.Vector3(), laneStart = new T.Vector3();
  function lane(hero) {
    // Each lane aims where the hero stands as the inhale begins (standing still gets you hit, so the
    // player must reposition); phase 1 adds a second, alternating offset lane.
    const r = ring(phase), g = pts.guardian, onRing = hero && Math.abs(hero.y - r.y) < 1.5 && Math.hypot(hero.x - g.x, hero.z - g.z) > 2;
    const a = (onRing ? Math.atan2(hero.z - g.z, hero.x - g.x) : Math.atan2(r.z - g.z, r.x - g.x)) + (phase === 1 && laneSide ? .5 : 0);
    const len = Math.max(4, Math.hypot(r.x - g.x, r.z - g.z) + 1.5);
    laneStart.set(g.x + Math.cos(a) * 1.4, r.y, g.z + Math.sin(a) * 1.4);
    laneEnd.set(g.x + Math.cos(a) * len, r.y, g.z + Math.sin(a) * len);
  }
  const stage = () => { const f = clock % cycle; return f < 3 ? 'inhale' : f < 4.2 ? 'exhale' : 'spent'; };
  function inLane(p) {
    const ax = laneEnd.x - laneStart.x, az = laneEnd.z - laneStart.z, L = ax * ax + az * az;
    const f = Math.max(0, Math.min(1, ((p.x - laneStart.x) * ax + (p.z - laneStart.z) * az) / L));
    return Math.hypot(p.x - (laneStart.x + ax * f), p.z - (laneStart.z + az * f)) < 1.05 && Math.abs(p.y - laneStart.y) < 1.4;
  }
  function update(dt, t, { hero, active = true, gentle = false } = {}) {
    body.position.y = pts.guardian.y + Math.sin(t * 1.3) * .15;
    if (phase >= 3) { body.scale.setScalar(.8); heart.material.emissiveIntensity = .15; return; }
    const near = hero && Math.hypot(hero.x - pts.arena.x, hero.z - pts.arena.z) < 13 && hero.y < pts.arena.y + 12;
    if (!active || !near) { clock = 0; cycleIndex = -1; return; }
    if (!warned) { warned = true; caption('It breathes in. Watch the floor.', 4); }
    clock += dt; const c = Math.floor(clock / cycle);
    if (c !== cycleIndex) { cycleIndex = c; hitThisCycle = false; pulseOpened = false; laneSide = c % 2; lane(hero); }
    const s = stage(), f = clock % cycle;
    const swell = s === 'inhale' ? f / 3 : s === 'exhale' ? 1 - (f - 3) / 1.2 : 0;
    shell.scale.set(1 + swell * .35, 1 + swell * .15, 1 + swell * .35); heart.material.emissiveIntensity = .4 + swell * 1.6;
    body.lookAt(laneEnd.x, body.position.y, laneEnd.z);
    if (phase < 2) {
      // Telegraph lane on the floor: coral band whose fill sweeps toward the end as the inhale completes.
      const w = s === 'inhale' ? 1.9 : 2.2;
      wind.strip(24, (g, o) => o.lerpVectors(laneStart, laneEnd, g).setY(laneStart.y + .07), { width: w, alpha: s === 'spent' ? .0 : .7, flat: true, taper: false, color: CORAL });
      if (s === 'inhale') wind.strip(24, (g, o) => o.lerpVectors(laneStart, laneEnd, g).setY(laneStart.y + .09), { width: w * .75, alpha: 1, flat: true, taper: false, color: CORAL, to: Math.max(.02, f / 3) });
      if (s === 'exhale') for (let i = 0; i < 3; i++) wind.strip(24, (g, o) => { o.lerpVectors(laneStart, laneEnd, g); o.y += .5 + i * .45 + Math.sin(g * 8 + t * 20) * .12; }, { width: .35, alpha: .95, from: 0, to: Math.min(1, (f - 3) / .35) });
      if (s === 'exhale' && !hitThisCycle && hero && inLane(hero)) {
        hitThisCycle = true; const safe = ring(phase); sound('hazard');
        onEvent({ knock: { to: [safe.x, safe.y, safe.z] } }); caption('The breath throws you back to the ledge. Step aside from the lane next time.', 4);
      }
      if (s === 'spent' && !wind.sources.has('guardianBreath') && !wind.charged) wind.addSource('guardianBreath', { x: laneEnd.x, y: laneEnd.y, z: laneEnd.z, radius: 1.3, repeat: false, ttl: cycle - f, kind: 'guardian' });
    } else {
      // Phase 3: it exhales straight up through the ring-2 grille; ride the pulse to the high ring.
      const v = vents.ring2;
      if (s === 'inhale') wind.ring(v.x, v.y + .08, v.z, (v.radius || 1) + .4, { width: .22, alpha: .9, color: CORAL }, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f / 3);
      if (s === 'exhale' && !pulseOpened) { pulseOpened = true; wind.openVent(v, { duration: 4.2 }); }
      const hi = ring(2);
      if (s === 'spent' && hero && hero.y > hi.y - .5 && !wind.sources.has('guardianBreath') && !wind.charged) wind.addSource('guardianBreath', { x: hi.x, y: hi.y, z: hi.z - 1.5, radius: 1.3, repeat: false, ttl: cycle - f, kind: 'guardian' });
    }
  }
  function context(p, yaw, charged) {
    if (phase >= 3) return null;
    const v = vane(phase);
    if (!charged) {
      const src = wind.sourceAt(p); if (src?.id === 'guardianBreath') return { kind: 'catch', id: 'guardianBreath', label: 'Catch the spent breath', target: new T.Vector3(src.x, src.y, src.z), anim: 'capture', owner: 'guardian' };
      if (Math.hypot(p.x - v.x, p.z - v.z) < 2.6 && Math.abs(p.y - v.y) < 2) return { kind: 'info', id: 'vane', label: `Return vane ${phase + 1}/3 · needs breath`, target: new T.Vector3(v.x, v.y, v.z), owner: 'guardian', why: 'The vane only turns on the guardian’s own spent breath. Catch it at the end of the lane.' };
      return null;
    }
    if (Math.hypot(p.x - v.x, p.z - v.z) < 5 && Math.abs(p.y - v.y) < 2.5) return { kind: 'give', id: 'vane', label: `Give the breath to vane ${phase + 1}/3`, target: new T.Vector3(v.x, v.y + 1.2, v.z), anim: 'release', owner: 'guardian' };
    return null;
  }
  function interact(ctx, { staffTip } = {}) {
    if (ctx.kind === 'catch') return wind.catchFrom('guardianBreath', staffTip);
    if (ctx.kind === 'give') {
      if (wind.charge?.kind !== 'guardian') { wind.release('spill', staffTip, ctx.target); caption('The vane lets ordinary wind slip through. It needs the guardian’s own breath.', 4); return true; }
      const k = phase;
      wind.release('give', staffTip, ctx.target, { onArrive: () => {
        phase = k + 1; clock = 0; cycleIndex = -1; world.setRestored('vane' + (k + 1), 1); sound('vane');
        const r = ring(Math.min(2, phase));
        if (phase === 1) caption('Vane 1 turns. The grille by the wall breathes on its own now.', 5);
        if (phase === 2) caption('Vane 2 turns. The guardian lifts its hood toward the top of the well.', 5);
        if (phase === 3) { caption('The last vane turns. The guardian folds its petals and settles.', 6); onEvent({ done: true }); }
        onEvent({ phase, vane: { index: k + 1, at: [vane(k).x, vane(k).y, vane(k).z] }, checkpoint: [r.x, r.y, r.z] });
      } });
      return true;
    }
    if (ctx.kind === 'info') { caption(ctx.why, 5); return true; }
    return false;
  }
  // Opened ring-1 grille pulses by itself (4 s column, 2 s rest) once vane 1 turns.
  let pulse = 0;
  function tickVents(dt) { if (phase >= 1 && phase < 3 && (pulse -= dt) <= 0) { pulse = 6; wind.openVent(vents.ring1, { duration: 4 }); } }
  return {
    object: body, update(dt, t, o) { update(dt, t, o); tickVents(dt); }, context, interact,
    get phase() { return phase; }, get done() { return phase >= 3; }, get stage() { return phase >= 3 ? 'calm' : stage(); },
    subject() { return box.setFromCenterAndSize(body.position.clone().add(new T.Vector3(0, 1.6, 0)), new T.Vector3(3.4, 3.8, 3.4)); },
    objective() { return phase >= 3 ? null : ['Dodge the breath, catch it, turn vane 1/3', 'Ride the grille up; turn vane 2/3', 'Ride the upward breath; turn vane 3/3'][phase]; },
    target() { return phase >= 3 ? null : new T.Vector3().copy(vane(phase)); },
    serialize() { return { phase }; }, restore(d) { phase = Math.max(0, Math.min(3, d?.phase | 0)); for (let k = 1; k <= phase; k++) world.setRestored('vane' + k, 1); clock = 0; cycleIndex = -1; },
    reset() { phase = 0; clock = 0; cycleIndex = -1; warned = false; }, telemetry() { return { phase, stage: phase >= 3 ? 'calm' : stage(), clock: +clock.toFixed(2) }; },
  };
}
