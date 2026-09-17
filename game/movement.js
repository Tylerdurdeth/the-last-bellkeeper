// Screen-relative locomotion. Position is the character's foot point, in metres.
export function createMovement(THREE, {
  start = [0, 0, 0], sampleGround = () => 0, blocked = () => false,
  stickElement, jumpButton, runButton,
  inputTarget = globalThis.window, jumpKey = 'KeyJ', walkSpeed = 2.2, runSpeed = 4.5,
} = {}) {
  const position = new THREE.Vector3(...start), velocity = new THREE.Vector3();
  const checkpoint = position.clone(), keys = new Set(), listeners = [];
  const radius = .23, stepHeight = .28, gravity = 19, jumpVelocity = 6.1;
  let yaw = 0, speed = 0, grounded = false, mode = 'idle', active = true;
  let coyote = 0, bufferedJump = 0, safeTime = 0, stickId = null;
  let stickX = 0, stickY = 0, runToggle = false, disposed = false, recovered = false;
  const knob = stickElement?.querySelector('[data-knob], #knob, .knob');
  const on = (target, type, fn, options) => {
    if (!target) return;
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const groundAt = (x, z) => {
    const h = sampleGround(x, z);
    return typeof h === 'number' && Number.isFinite(h) ? h : null;
  };
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
  function reset(next = start) {
    clearInput(); recovered = false; position.set(...next); checkpoint.copy(position); velocity.set(0, 0, 0);
    const g = groundAt(position.x, position.z);
    grounded = g !== null && Math.abs(position.y - g) <= stepHeight;
    if (grounded) position.y = g;
    speed = 0; mode = 'idle'; coyote = grounded ? .11 : 0; safeTime = 0;
  }
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', jumpKey]);
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

  function integrate(dt, actionSlow, faceTarget) {
    const x = stickX + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const y = -stickY + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const rawMagnitude = Math.hypot(x, y), magnitude = Math.min(1, rawMagnitude);
    const touch = stickId !== null, running = runToggle || keys.has('ShiftLeft') || keys.has('ShiftRight');
    const maxSpeed = actionSlow ? 1.1 : running || touch ? runSpeed : walkSpeed;
    const intent = magnitude > .1;
    const scale = intent ? maxSpeed * magnitude / rawMagnitude : 0;
    const tx = (.788 * x - .615 * y) * scale, tz = (-.615 * x - .788 * y) * scale;
    const blend = 1 - Math.exp(-(grounded ? intent ? 23 : 30 : 8) * dt);
    velocity.x += (tx - velocity.x) * blend; velocity.z += (tz - velocity.z) * blend;
    const facingX = faceTarget?.x - position.x, facingZ = faceTarget?.z - position.z;
    const facingAction = Number.isFinite(facingX) && Number.isFinite(facingZ) && Math.hypot(facingX, facingZ) > .03;
    if (facingAction || intent) {
      // Action anticipation faces its real subject without snapping, freezing
      // translation, or leaving a separate render yaw that pops on completion.
      const targetYaw = facingAction ? Math.atan2(facingX, facingZ) : Math.atan2(tx, tz);
      const delta = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
      yaw += delta * (1 - Math.exp(-(facingAction ? 14 : 20) * dt));
    }
    if (grounded) coyote = .11; else coyote = Math.max(0, coyote - dt);
    if (bufferedJump > 0 && coyote > 0 && !actionSlow) {
      velocity.y = jumpVelocity; grounded = false; coyote = 0; bufferedJump = 0;
    }
    bufferedJump = Math.max(0, bufferedJump - dt);
    const previousY = position.y;
    function canEnter(nx, nz) {
      if (blocked(nx, nz, radius)) return false;
      const h = groundAt(nx, nz);
      return h === null || h <= position.y + (grounded ? stepHeight : .03);
    }
    const dx = velocity.x * dt, dz = velocity.z * dt;
    if (canEnter(position.x + dx, position.z + dz)) { position.x += dx; position.z += dz; }
    else {
      if (canEnter(position.x + dx, position.z)) position.x += dx; else velocity.x = 0;
      if (canEnter(position.x, position.z + dz)) position.z += dz; else velocity.z = 0;
    }
    const ground = groundAt(position.x, position.z);
    if (grounded && ground !== null && Math.abs(ground - previousY) <= stepHeight) {
      position.y = ground; velocity.y = 0;
    } else {
      grounded = false;
      // Exact constant-gravity displacement avoids frame-rate-dependent jump height.
      position.y += velocity.y * dt - .5 * gravity * dt * dt;
      velocity.y -= gravity * dt;
      if (ground !== null && velocity.y <= 0 && previousY >= ground - .03 && position.y <= ground) {
        position.y = ground; velocity.y = 0; grounded = true;
      }
    }
    if (grounded) {
      safeTime += dt;
      // Only record an interior landing, not a sliver at an edge.
      if (safeTime > .25 && [[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([a,b]) => {
        const g = groundAt(position.x + a, position.z + b); return g !== null && Math.abs(g - position.y) < stepHeight;
      })) checkpoint.copy(position);
    } else safeTime = 0;
    // Void banks return quickly, before the camera follows below the scenery.
    // Real lower floors retain the wider fall budget for legitimate landings.
    if (position.y < checkpoint.y - (ground === null ? 1.25 : 4)) {
      recovered = true; clearInput(); position.copy(checkpoint); velocity.set(0, 0, 0); grounded = true; bufferedJump = 0; coyote = 0;
    }
  }
  function update(dt, { enabled = true, actionSlow = false, faceTarget = null } = {}) {
    if (disposed) return;
    recovered = false;
    active = enabled;
    if (!enabled) { clearInput(); velocity.x = velocity.z = 0; speed = 0; mode = 'idle'; return; }
    const elapsed = Math.max(0, Math.min(.05, Number.isFinite(dt) ? dt : 0));
    const oldX = position.x, oldZ = position.z;
    const steps = Math.ceil(elapsed / (1 / 120));
    for (let i = 0; i < steps; i++) integrate(elapsed / steps, actionSlow, faceTarget);
    speed = elapsed && !recovered ? Math.hypot(position.x - oldX, position.z - oldZ) / elapsed : 0;
    mode = !grounded ? velocity.y > .1 ? 'jump' : 'fall' : speed > 2.7 ? 'run' : speed > .08 ? 'walk' : 'idle';
  }
  function dispose() { clearInput(); listeners.splice(0).forEach(off => off()); disposed = true; }
  reset();
  return { position, velocity, get yaw() { return yaw; }, get speed() { return speed; }, get recovered() { return recovered; }, get grounded() { return grounded; }, get mode() { return mode; }, get verticalVelocity() { return velocity.y; }, update, reset, jump, dispose };
}
