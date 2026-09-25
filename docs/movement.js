// Screen-relative locomotion. Position is the character's foot point, in metres.
// Layered ground: sampleGround(x,z,y) returns the highest walkable surface at (x,z) that is
// <= y + step, or null for void; blocked(x,z,r,y) likewise uses y. Old 2-argument functions
// ignore the extra argument, so single-height worlds behave exactly as before.
export function createMovement(THREE, {
  start = [0, 0, 0], sampleGround = () => 0, blocked = () => false,
  stickElement, jumpButton, runButton,
  inputTarget = globalThis.window, jumpKey = 'KeyA', walkSpeed = 2.2, runSpeed = 4.5,
  acceleration = 23, deceleration = 30, turnResponse = 20, cameraYaw = null,
  // A fall onto a real floor further than maxDrop below the last safe landing is treated as lost
  // and recovered. Void (null ground) always recovers after 1.25 m.
  maxDrop = 4,
} = {}) {
  const position = new THREE.Vector3(...start), velocity = new THREE.Vector3();
  const checkpoint = position.clone(), keys = new Set(), listeners = [];
  const radius = .23, stepHeight = .28, gravity = 19, jumpVelocity = 6.1;
  let yaw = 0, speed = 0, grounded = false, mode = 'idle', active = true;
  let coyote = 0, bufferedJump = 0, safeTime = 0, stickId = null;
  let gapAssist = null;
  // Scan ahead along the jump direction: ground, then a gap (no floor within 1 m below), then a landing at about the
  // same height. Returns the horizontal speed needed to land ~0.5 m past the far lip, or null when it is not a gap jump.
  function gapJump(dx, dz) {
    const L = Math.hypot(dx, dz); if (L < .01) return null; dx /= L; dz /= L;
    const air = 2 * jumpVelocity / gravity, y = position.y; let gapAt = null;
    for (let s = .15; s <= 3.4; s += .1) {
      const x = position.x + dx * s, z = position.z + dz * s, g = sampleGround(x, z, y + .5), floor = Number.isFinite(g) && g > y - 1;
      if (gapAt === null) { if (!floor) { if (s > 1.6) return null; gapAt = s; } else if (Math.abs(g - y) > stepHeight || isBlocked(x, z, y)) return null; continue; }
      if (floor) { if (Math.abs(g - y) > .35 || s - gapAt > 2.6) return null; const speed = Math.min(runSpeed, (s + .5) / air); return speed > L ? { dx, dz, speed, t: air + .15 } : null; }
    }
    return null;
  }
  let stickX = 0, stickY = 0, runToggle = false, disposed = false, recovered = false;
  // Updraft columns (physics only; visuals belong to wind.js) and scripted knock-back hops.
  const columns = []; let columnSerial = 0, inColumn = null, hop = null, stun = 0, landed = false;
  // Anti-stuck: held input that goes nowhere while blocked (or with no valid step) returns the hero to safety.
  let stuckT = 0, freed = 0; const stuckAnchor = new THREE.Vector3();
  const knob = stickElement?.querySelector('[data-knob], #knob, .knob');
  const on = (target, type, fn, options) => {
    if (!target) return;
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const groundAt = (x, z, y = position.y) => {
    const h = sampleGround(x, z, y);
    return typeof h === 'number' && Number.isFinite(h) ? h : null;
  };
  const isBlocked = (x, z, y = position.y) => !!blocked(x, z, radius, y);
  function releaseStick() {
    const id = stickId; stickId = null; stickX = stickY = 0;
    if (id !== null && stickElement?.hasPointerCapture?.(id)) stickElement.releasePointerCapture(id);
    if (knob) knob.style.transform = '';
  }
  function clearInput() {
    keys.clear(); releaseStick(); bufferedJump = 0; runToggle = false;
    runButton?.setAttribute('aria-pressed', 'false');
  }
  function jump() { if (active && !disposed) bufferedJump = .14; }
  function reset(next = start) { gapAssist = null;
    clearInput(); recovered = false; position.set(...(next?.isVector3 ? next.toArray() : next)); checkpoint.copy(position); velocity.set(0, 0, 0);
    inColumn = null; hop = null; stun = 0; // columns are world physics: they persist until they expire
    const g = groundAt(position.x, position.z, position.y + .5);
    grounded = g !== null && Math.abs(position.y - g) <= stepHeight + .5;
    if (grounded) position.y = g;
    speed = 0; mode = 'idle'; coyote = grounded ? .11 : 0; safeTime = 0;
  }
  const movementKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', jumpKey]);
  on(inputTarget, 'keydown', e => {
    if (!active || e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    if (!movementKeys.has(e.code)) return;
    e.preventDefault(); keys.add(e.code);
    if (e.code === jumpKey && !e.repeat) jump();
  });
  on(inputTarget, 'keyup', e => keys.delete(e.code));
  on(inputTarget, 'blur', clearInput);
  on(globalThis.document, 'visibilitychange', () => { if (document.hidden) clearInput(); });
  function moveStick(e) {
    const r = stickElement.getBoundingClientRect(), range = Math.max(1, Math.min(r.width, r.height) * .36);
    stickX = (e.clientX - r.left - r.width / 2) / range;
    stickY = (e.clientY - r.top - r.height / 2) / range;
    const n = Math.max(1, Math.hypot(stickX, stickY)); stickX /= n; stickY /= n;
    if (knob) knob.style.transform = `translate(${stickX * range}px,${stickY * range}px)`;
  }
  on(stickElement, 'pointerdown', e => {
    if (!active || stickId !== null) return;
    e.preventDefault(); stickId = e.pointerId; stickElement.setPointerCapture(e.pointerId); moveStick(e);
  });
  on(stickElement, 'pointermove', e => { if (e.pointerId === stickId) { e.preventDefault(); moveStick(e); } });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(stickElement, type, e => { if (e.pointerId === stickId) releaseStick(); });
  on(jumpButton, 'pointerdown', e => { e.preventDefault(); jump(); });
  // Keyboard/assistive activation dispatches a detail=0 click; pointer already fired above.
  on(jumpButton, 'click', e => { if (e.detail === 0) jump(); });
  on(runButton, 'click', () => { if (active) { runToggle = !runToggle; runButton.setAttribute('aria-pressed', String(runToggle)); } });

  // The column the hero is inside: horizontally within radius, vertically from just below its base
  // to a little above its (jump-boosted) top. Newest wins.
  function columnAt(x, z, y) {
    for (let i = columns.length - 1; i >= 0; i--) {
      const c = columns[i];
      if (Math.hypot(x - c.x, z - c.z) <= c.radius && y >= c.base - .6 && y <= c.top + c.bonus + .9) { c.inCorridor = false; return c; }
      // Exit corridor: near the top, a 1.3 m-wide lane from the grille to its named ledge keeps holding the
      // hero up (then lowers him onto the ledge), so steering toward the ledge never drops him back down.
      if (c.ledge && y >= c.ledge.y - .25 && y <= c.top + c.bonus + .9 && c.fade > 0) {
        const ax = c.ledge.x - c.x, az = c.ledge.z - c.z, L2 = ax * ax + az * az || 1, f = ((x - c.x) * ax + (z - c.z) * az) / L2;
        if (f > 0 && f < 1.35 && Math.hypot(x - (c.x + ax * f), z - (c.z + az * f)) <= Math.max(1.3, c.radius)) { c.inCorridor = true; return c; }
      }
    }
    return null;
  }
  // Depenetration: if the body overlaps a collider (e.g. a barrier that appeared around it), move to the
  // nearest spot within 1.2 m that is free and has floor at about this height.
  function depenetrate() {
    if (!isBlocked(position.x, position.z, position.y)) return false;
    for (let r = .1; r <= 1.2001; r += .1) for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, nx = position.x + Math.cos(a) * r, nz = position.z + Math.sin(a) * r;
      if (isBlocked(nx, nz, position.y)) continue;
      const g = groundAt(nx, nz, position.y);
      if (grounded ? g === null || Math.abs(g - position.y) > stepHeight + .1 : g !== null && g > position.y + .03) continue;
      position.x = nx; position.z = nz; if (grounded) position.y = g; freed++; return true;
    }
    return false;
  }
  function hasValidStep() {
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, nx = position.x + Math.cos(a) * .15, nz = position.z + Math.sin(a) * .15; if (isBlocked(nx, nz, position.y)) continue; const g = groundAt(nx, nz, position.y); if (g === null || g <= position.y + stepHeight) return true; }
    return false;
  }
  function recover() {
    recovered = true; clearInput(); position.copy(checkpoint); velocity.set(0, 0, 0); grounded = true; bufferedJump = 0; coyote = 0;
    inColumn = null; hop = null; stun = 0;
  }
  function integrateHop(dt) {
    hop.t = Math.min(hop.duration, hop.t + dt);
    const f = hop.t / hop.duration, e = f * f * (3 - 2 * f);
    const y = hop.from.y + (hop.to.y - hop.from.y) * e + Math.sin(Math.PI * f) * hop.height;
    position.set(hop.from.x + (hop.to.x - hop.from.x) * e, y, hop.from.z + (hop.to.z - hop.from.z) * e);
    velocity.set(0, Math.cos(Math.PI * f) * hop.height * Math.PI / hop.duration, 0);
    grounded = false; coyote = 0; safeTime = 0;
    if (f >= 1) {
      position.copy(hop.to); velocity.set(0, 0, 0); grounded = true; hop = null; landed = true;
      const g = groundAt(position.x, position.z, position.y + .3);
      if (g !== null && Math.abs(g - position.y) < .6) position.y = g;
      checkpoint.copy(position);
    }
  }

  function integrate(dt, actionSlow, faceTarget) {
    if (hop) return integrateHop(dt);
    stun = Math.max(0, stun - dt);
    depenetrate();
    // A is reserved for jump; keyboard strafe-left remains on ArrowLeft.
    const stunned = stun > 0;
    const x = stunned ? 0 : stickX + (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    const y = stunned ? 0 : -stickY + (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
    const rawMagnitude = Math.hypot(x, y), magnitude = Math.min(1, rawMagnitude);
    const touch = stickId !== null, running = runToggle || keys.has('ShiftLeft') || keys.has('ShiftRight');
    const maxSpeed = actionSlow ? 1.1 : running || touch ? runSpeed : walkSpeed;
    const intent = magnitude > .1;
    const scale = intent ? maxSpeed * magnitude / rawMagnitude : 0;
    const angle=cameraYaw?.(),cx=angle===undefined?.788:Math.cos(angle),cz=angle===undefined?.615:Math.sin(angle);
    const tx = (cx * x - cz * y) * scale, tz = (-cz * x - cx * y) * scale;
    const column = columnAt(position.x, position.z, position.y);
    // A late entrant still gets the whole rise plus ~1.2 s of hover at the top before the column fades.
    if (column && !column.entered && !column.inCorridor) { column.entered = true; if (column.ledge) column.duration = Math.max(column.duration, column.age + Math.max(0, column.top - position.y) / Math.max(1, column.rise) * 1.4 + 3.2); }
    // Air control is firmer inside a column so the player can steer out onto a ledge.
    const blend = 1 - Math.exp(-(grounded ? intent ? acceleration : deceleration : stunned ? 1.5 : column ? 10 : 8) * dt);
    velocity.x += (tx - velocity.x) * blend; velocity.z += (tz - velocity.z) * blend;
    // Updraft exit assist: at or above the ledge, any input roughly toward the named ledge is pulled onto it.
    if (column?.ledge && intent && position.y >= column.ledge.y - .25) {
      const lx = column.ledge.x - position.x, lz = column.ledge.z - position.z, ld = Math.hypot(lx, lz), tv = Math.hypot(tx, tz) || 1;
      if (ld > .2 && (tx * lx + tz * lz) / (tv * ld) > .15) {
        const sp = Math.max(2.2, Math.hypot(velocity.x, velocity.z)), k = 1 - Math.exp(-9 * dt);
        velocity.x += (lx / ld * sp - velocity.x) * k; velocity.z += (lz / ld * sp - velocity.z) * k;
      }
    }
    const facingX = faceTarget?.x - position.x, facingZ = faceTarget?.z - position.z;
    const facingAction = Number.isFinite(facingX) && Number.isFinite(facingZ) && Math.hypot(facingX, facingZ) > .03;
    if (facingAction || intent) {
      // Action anticipation faces its real subject without snapping, freezing
      // translation, or leaving a separate render yaw that pops on completion.
      const targetYaw = facingAction ? Math.atan2(facingX, facingZ) : Math.atan2(tx, tz);
      const delta = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
      yaw += delta * (1 - Math.exp(-(facingAction ? 14 : turnResponse) * dt));
    }
    if (grounded) coyote = .11; else coyote = Math.max(0, coyote - dt);
    if (bufferedJump > 0 && column && !actionSlow) {
      // Jumping inside a column is an extra kick and raises the hover ceiling for a moment.
      velocity.y = Math.max(velocity.y, 0) + 4.2; column.bonus = Math.min(2.4, column.bonus + 1.4); column.bonusTime = 1.2;
      grounded = false; coyote = 0; bufferedJump = 0;
    } else if (bufferedJump > 0 && coyote > 0 && !actionSlow) {
      velocity.y = jumpVelocity; grounded = false; coyote = 0; bufferedJump = 0;
      gapAssist = intent ? gapJump(tx, tz) : null;
    }
    // Gap-jump assist (playtest: walking jumps fell short of the 1.8 m gaps). A jump toward a short gap with a
    // same-height landing beyond it carries enough speed to clear it, unless the player steers away mid-air.
    if (gapAssist) {
      gapAssist.t -= dt;
      const along = velocity.x * gapAssist.dx + velocity.z * gapAssist.dz, steer = intent ? (tx * gapAssist.dx + tz * gapAssist.dz) / (Math.hypot(tx, tz) || 1) : 1;
      if (grounded || gapAssist.t <= 0 || steer < .3) gapAssist = null;
      else if (along < gapAssist.speed) { velocity.x += gapAssist.dx * (gapAssist.speed - along); velocity.z += gapAssist.dz * (gapAssist.speed - along); }
    }
    bufferedJump = Math.max(0, bufferedJump - dt);
    const previousY = position.y;
    function canEnter(nx, nz) {
      // Never refuse a step that gets the body out of an overlap.
      if (isBlocked(nx, nz, position.y)) return false; // depenetrate() already moved the body clear of any overlap
      const h = groundAt(nx, nz, position.y);
      return h === null || h <= position.y + (grounded ? stepHeight : .03);
    }
    const dx = velocity.x * dt, dz = velocity.z * dt;
    if (canEnter(position.x + dx, position.z + dz)) { position.x += dx; position.z += dz; }
    else {
      if (canEnter(position.x + dx, position.z)) position.x += dx; else velocity.x = 0;
      if (canEnter(position.x, position.z + dz)) position.z += dz; else velocity.z = 0;
    }
    const ground = groundAt(position.x, position.z, previousY);
    const lifting = column && column.fade > 0 && position.y < column.top + column.bonus - .02;
    if (column && column.fade > 0) {
      // Gravity is countered: ease vertical speed toward a rise that settles at the hover ceiling.
      const overLedge = column.inCorridor || (column.ledge && ground !== null && Math.abs(ground - column.ledge.y) < .3 && Math.hypot(position.x - column.x, position.z - column.z) > column.radius * .6);
      const ceiling = overLedge ? column.ledge.y - .3 : column.top + column.bonus, rise = column.rise * column.fade;
      const want = Math.max(-1.4, Math.min(rise, (ceiling - position.y) * 2.4 + Math.sin(column.age * 3.1) * .25));
      velocity.y += (want - velocity.y) * (1 - Math.exp(-(velocity.y > want ? 3.5 : 6) * dt));
      if (lifting || grounded && (ground === null || Math.abs(ground - previousY) > stepHeight)) grounded = false;
      if (!grounded) {
        position.y += velocity.y * dt;
        if (ground !== null && velocity.y <= 0 && previousY >= ground - .03 && position.y <= ground) { position.y = ground; velocity.y = 0; grounded = true; landed = true; }
      } else if (ground !== null) position.y = ground;
    } else if (grounded && ground !== null && Math.abs(ground - previousY) <= stepHeight) {
      position.y = ground; velocity.y = 0;
    } else {
      grounded = false;
      // Exact constant-gravity displacement avoids frame-rate-dependent jump height.
      position.y += velocity.y * dt - .5 * gravity * dt * dt;
      velocity.y -= gravity * dt;
      if (ground !== null && velocity.y <= 0 && previousY >= ground - .03 && position.y <= ground) {
        position.y = ground; velocity.y = 0; grounded = true; landed = true;
      }
    }
    inColumn = column;
    // Held input for 2 s with < 5 cm travel while blocked or boxed in: carry the hero back to safety.
    if (intent && !stunned && !column && !actionSlow) {
      if (Math.hypot(position.x - stuckAnchor.x, position.z - stuckAnchor.z) > .05) { stuckAnchor.copy(position); stuckT = 0; }
      else if ((stuckT += dt) >= 2 && (isBlocked(position.x, position.z, position.y) || !hasValidStep())) { stuckT = 0; recover(); return; }
    } else { stuckT = 0; stuckAnchor.copy(position); }
    if (grounded && !stunned && !column) {
      safeTime += dt;
      // Only record an interior landing, not a sliver at an edge.
      if (safeTime > .25 && !isBlocked(position.x, position.z, position.y) && [[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([a,b]) => {
        const g = groundAt(position.x + a, position.z + b); return g !== null && Math.abs(g - position.y) < stepHeight;
      })) checkpoint.copy(position);
    } else safeTime = 0;
    // Void banks return quickly, before the camera follows below the scenery.
    // Real lower floors retain the wider fall budget for legitimate landings.
    // A drop that crosses a sliver of void on its way to a real floor is not a loss: look ahead
    // along the horizontal velocity for floor below before treating the void as bottomless.
    if (position.y < checkpoint.y - (ground === null ? 1.25 : maxDrop) && !column) {
      const v = Math.hypot(velocity.x, velocity.z), floorAhead = ground === null && v > .5 && [.4, .8, 1.3, 1.9].some(d => { const g = groundAt(position.x + velocity.x / v * d, position.z + velocity.z / v * d); return g !== null && g > checkpoint.y - maxDrop; });
      if (!floorAhead) recover();
    }
  }
  function update(dt, { enabled = true, actionSlow = false, faceTarget = null } = {}) {
    if (disposed) return;
    recovered = false; landed = false;
    active = enabled;
    if (!enabled) { clearInput(); velocity.x = velocity.z = 0; speed = 0; mode = 'idle'; return; }
    const elapsed = Math.max(0, Math.min(.05, Number.isFinite(dt) ? dt : 0));
    const oldX = position.x, oldZ = position.z;
    const steps = Math.ceil(elapsed / (1 / 120));
    for (let i = 0; i < steps; i++) {
      const h = elapsed / steps;
      for (const c of columns) {
        if (c === inColumn && c.inCorridor) c.duration = Math.max(c.duration, c.age + .8); // never fade under a hero crossing to the ledge
        c.age += h; c.bonusTime = Math.max(0, c.bonusTime - h); if (!c.bonusTime) c.bonus = Math.max(0, c.bonus - h * 1.5);
        c.fade = Math.max(0, Math.min(1, (c.duration - c.age) / .6));
      }
      for (let k = columns.length - 1; k >= 0; k--) if (columns[k].age >= columns[k].duration) columns.splice(k, 1);
      integrate(h, actionSlow, faceTarget);
      if (recovered) break;
    }
    speed = elapsed && !recovered && !hop ? Math.hypot(position.x - oldX, position.z - oldZ) / elapsed : 0;
    mode = hop ? 'knock' : inColumn && !grounded ? 'lift' : !grounded ? velocity.y > .1 ? 'jump' : 'fall' : speed > 2.7 ? 'run' : speed > .08 ? 'walk' : 'idle';
  }
  function dispose() { clearInput(); listeners.splice(0).forEach(off => off()); disposed = true; }
  function impulse(x,z){if(!active||disposed||!Number.isFinite(x)||!Number.isFinite(z))return;velocity.x+=Math.max(-3,Math.min(3,x));velocity.z+=Math.max(-3,Math.min(3,z));velocity.y=Math.max(velocity.y,2.2);grounded=false;coyote=0;}
  // Updraft column. While inside (horizontal radius, from base up to top) gravity is countered and
  // the hero rises smoothly to `top`, hovering there so they can steer out onto a ledge. Jumping
  // inside adds lift. The column lasts `duration` seconds (fading over the last 0.6 s).
  function lift({ x, z, radius = 1.3, top, base = null, duration = 4, rise = 5.2, id = null, ledge = null } = {}) {
    if (disposed || ![x, z, top].every(Number.isFinite)) return null;
    const c = { id: id ?? 'column-' + (++columnSerial), x, z, radius, top, base: Number.isFinite(base) ? base : Math.min(top, position.y) - .5, duration, rise, age: 0, fade: 1, bonus: 0, bonusTime: 0, ledge: ledge && [ledge.x, ledge.y, ledge.z].every(Number.isFinite) ? { x: ledge.x, y: ledge.y, z: ledge.z } : null };
    const old = columns.findIndex(o => o.id === c.id); if (old >= 0) columns.splice(old, 1);
    columns.push(c);
    return { id: c.id, get remaining() { return Math.max(0, c.duration - c.age); }, get active() { return columns.includes(c); }, cancel() { const i = columns.indexOf(c); if (i >= 0) columns.splice(i, 1); } };
  }
  // Knock-back. With `to` ([x,y,z] or Vector3, a known safe ledge) the hero is carried along a
  // readable arc and lands exactly there. Without it, a bounded ballistic shove with a short loss
  // of control; any landing in the void is caught by the normal recovery to the last safe ground.
  function knockback({ x = 0, z = 0, power = 1, to = null, duration = .8, height = 1.6 } = {}) {
    if (disposed) return;
    // Held keys survive a knock (the hop/stun ignore them meanwhile), so a player still holding an
    // arrow keeps moving on landing instead of having to release and press again.
    bufferedJump = 0; inColumn = null;
    if (to) {
      const target = to.isVector3 ? to.clone() : new THREE.Vector3(...to);
      if (![target.x, target.y, target.z].every(Number.isFinite)) return;
      hop = { from: position.clone(), to: target, t: 0, duration: Math.max(.2, duration), height: Math.max(.3, height + Math.max(0, target.y - position.y) * .5) };
      grounded = false; return;
    }
    const n = Math.hypot(x, z) || 1, p = Math.max(0, Math.min(2, power));
    velocity.x = x / n * 6 * p; velocity.z = z / n * 6 * p; velocity.y = 4.5 * Math.max(.6, p);
    grounded = false; coyote = 0; stun = .4;
  }
  // A spot is safe when it has floor right there, the body fits, and it is not a sliver at an edge.
  function isSafe(p) { const v = p?.isVector3 ? p : Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p; if (!v || ![v.x, v.y, v.z].every(Number.isFinite)) return false; const g = groundAt(v.x, v.z, v.y + .3); return g !== null && Math.abs(g - v.y) < .35 && !isBlocked(v.x, v.z, g); }
  function setCheckpoint(p) { const v = p?.isVector3 ? p : Array.isArray(p) ? new THREE.Vector3(...p) : null; if (v && [v.x, v.y, v.z].every(Number.isFinite)) checkpoint.copy(v); }
  reset();
  return { position, velocity, checkpoint, get yaw() { return yaw; }, set yaw(v) { if (Number.isFinite(v)) yaw = v; }, get speed() { return speed; }, get recovered() { return recovered; }, get landed() { return landed; }, get grounded() { return grounded; }, get mode() { return mode; }, get verticalVelocity() { return velocity.y; },
    get lifting() { return !!inColumn && !grounded; }, get column() { return inColumn ? inColumn.id : null; }, get columns() { return columns.map(c => ({ id: c.id, x: c.x, z: c.z, radius: c.radius, top: c.top, base: c.base, remaining: c.duration - c.age, fade: c.fade })); },
    get knocked() { return !!hop || stun > 0; }, get stickHeld() { return stickId !== null; },
    get freed() { return freed; }, isSafe, returnToSafety() { recover(); },
    update, reset, jump, impulse, lift, knockback, setCheckpoint, dispose };
}
