// Wind runtime for v2: gust sources (Catch), released charges (Give), updraft vents, Push and
// Chain, plus every wind visual. No progression here: quest.js decides what a release means.
// Visuals are one batched ribbon mesh (a single draw call) of thick camera-facing or floor-flat
// strips in the wind colour #8FD3E0 with a white core and a darker rim, so they read against
// ivory stone and pale sky on a phone.
export const WIND = 0x8fd3e0;
const FLOOD_TINT = { r: 1, g: .9, b: .72, isColor: true }; // warm late-light air for the finale flood
const SHADE = { r: .025, g: .045, b: .05, isColor: true }; // soft dark band under catch rings: strong on sunlit ivory, invisible on dark planks (no teal smoke)
const TAU = Math.PI * 2;
const ease = f => f * f * (3 - 2 * f);
const clamp01 = v => Math.max(0, Math.min(1, v));

// fx: optional getter for the look's natural wind FX (game/render/fx/wind-fx.js); when present the strip mesh gets
// its soft stream material and vent columns become rising mist instead of drawn helices.
export function createWind({ THREE: T, scene, movement = null, sound = () => {}, capacity = 14000, fx = () => null } = {}) {
  // ---------- batched ribbon renderer ----------
  const pos = new Float32Array(capacity * 3), uv = new Float32Array(capacity * 2), col = new Float32Array(capacity * 4);
  const index = new Uint16Array(Math.min(65535, capacity) * 3);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('color', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
  geo.setIndex(new T.BufferAttribute(index, 1).setUsage(T.DynamicDrawUsage));
  const uniforms = { uTime: { value: 0 } };
  const material = new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: `attribute vec4 color;varying vec2 vUv;varying vec4 vCol;
      void main(){vUv=uv;vCol=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime;varying vec2 vUv;varying vec4 vCol;
      void main(){float across=abs((vUv.y>1.5?vUv.y-2.:vUv.y)-.5)*2.;float core=1.-smoothstep(.0,.42,across);float rim=smoothstep(.5,.82,across);
       float flow=.8+.2*sin(vUv.x*5.5-uTime*9.);
       vec3 c=mix(vCol.rgb*1.05,vec3(1.),core*.78);c=mix(c,vCol.rgb*.34,rim);
       float a=vCol.a*(1.-smoothstep(.88,1.,across))*mix(1.,flow,.5);if(a<.01)discard;gl_FragColor=vec4(c,min(1.,a*1.1));}`,
  });
  material.name = 'bk-wind-ribbons';
  const mesh = new T.Mesh(geo, material);
  mesh.name = 'bellhollow-wind'; mesh.frustumCulled = false; mesh.renderOrder = 5;
  scene.add(mesh);
  let vCount = 0, iCount = 0, eye = new T.Vector3(0, 10, 10);
  const scratch = new Float32Array(3 * 96), P = new T.Vector3(), Q = new T.Vector3(), tan = new T.Vector3(), side = new T.Vector3(), view = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
  const base = new T.Color(WIND);
  // Emit one strip. sample(f, out) fills out (Vector3) for f in [from,to]. width in metres.
  // flat=true lays the strip on the horizontal plane (floor rings); otherwise it faces the camera.
  function strip(n, sample, { width = .2, alpha = .9, from = 0, to = 1, taper = true, flat = false, color = null, flow = 1, billow = false } = {}) {
    n = Math.max(2, Math.min(96, n | 0));
    if (vCount + n * 2 > capacity || iCount + (n - 1) * 6 > index.length || to <= from || alpha <= .01) return;
    for (let i = 0; i < n; i++) { sample(from + (to - from) * i / (n - 1), P); scratch[i * 3] = P.x; scratch[i * 3 + 1] = P.y; scratch[i * 3 + 2] = P.z; }
    const c = color || base; let length = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      tan.set(scratch[b * 3] - scratch[a * 3], scratch[b * 3 + 1] - scratch[a * 3 + 1], scratch[b * 3 + 2] - scratch[a * 3 + 2]);
      P.set(scratch[i * 3], scratch[i * 3 + 1], scratch[i * 3 + 2]);
      if (i) length += Math.hypot(P.x - scratch[i * 3 - 3], P.y - scratch[i * 3 - 2], P.z - scratch[i * 3 - 1]);
      if (flat) side.crossVectors(tan, UP); else side.crossVectors(tan, view.subVectors(eye, P));
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      const f = i / (n - 1), w = width * (taper ? Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, f))) || 0, .45) * .92 + .08 : 1) / 2;
      side.normalize().multiplyScalar(w);
      const v = vCount + i * 2;
      pos[v * 3] = P.x - side.x; pos[v * 3 + 1] = P.y - side.y; pos[v * 3 + 2] = P.z - side.z;
      pos[v * 3 + 3] = P.x + side.x; pos[v * 3 + 4] = P.y + side.y; pos[v * 3 + 5] = P.z + side.z;
      const vb = billow ? 4 : flat ? 2 : 0; uv[v * 2] = length * flow; uv[v * 2 + 1] = vb; uv[v * 2 + 2] = length * flow; uv[v * 2 + 3] = vb + 1; // flat bands uv.y 2..3, billows 4..5 (both outside the shimmer pass's 0..1 band)
      const va = billow ? alpha * Math.pow(Math.sin(Math.PI * f), .8) : alpha; // billows fade to nothing at both ends (no sheet edge)
      for (const k of [v, v + 1]) { col[k * 4] = c.r; col[k * 4 + 1] = c.g; col[k * 4 + 2] = c.b; col[k * 4 + 3] = va; }
      if (i < n - 1) { index[iCount++] = v; index[iCount++] = v + 1; index[iCount++] = v + 2; index[iCount++] = v + 1; index[iCount++] = v + 3; index[iCount++] = v + 2; }
    }
    vCount += n * 2;
  }
  const ring = (x, y, z, r, opts = {}, a0 = 0, a1 = TAU) => strip(opts.n || 40, (f, o) => { const a = a0 + (a1 - a0) * f; o.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r); }, { flat: true, taper: a1 - a0 < TAU - .01, ...opts });
  const helix = (x, y0, z, y1, r, turns, phase, opts = {}) => strip(opts.n || 40, (f, o) => { const a = phase + f * turns * TAU; o.set(x + Math.cos(a) * r, y0 + (y1 - y0) * f, z + Math.sin(a) * r); }, opts);
  const arc = (a, b, lift, opts = {}) => strip(opts.n || 32, (f, o) => { o.lerpVectors(a, b, f); o.y += Math.sin(Math.PI * f) * lift; }, opts);

  // ---------- petals and leaves (restoration bursts; not wind, so palette coral/leaf/gold) ----------
  const PMAX = 700, pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX), pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pSpin = new Float32Array(PMAX);
  const pGeo = new T.BufferGeometry();
  pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3).setUsage(T.DynamicDrawUsage));
  pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3)); pGeo.setAttribute('size', new T.BufferAttribute(pSize, 1).setUsage(T.DynamicDrawUsage));
  pGeo.setAttribute('spin', new T.BufferAttribute(pSpin, 1).setUsage(T.DynamicDrawUsage));
  const petalMat = new T.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 color;attribute float size;attribute float spin;varying vec3 vC;varying float vS;
      void main(){vC=color;vS=spin;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*420./max(1.,-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vC;varying float vS;void main(){vec2 p=gl_PointCoord-.5;float c=cos(vS),s=sin(vS);p=vec2(c*p.x-s*p.y,s*p.x+c*p.y);
      float d=length(p*vec2(1.,2.1));if(d>.5)discard;vec3 col=mix(vC*.55,vC,smoothstep(.5,.25,d));gl_FragColor=vec4(col,1.);}` });
  const petalsMesh = new T.Points(pGeo, petalMat); petalsMesh.name = 'bellhollow-petals'; petalsMesh.frustumCulled = false; scene.add(petalsMesh);
  const PAL = [0xd96956, 0xa6c46a, 0xe9b949, 0x5e8f4e, 0xf2e6c9].map(h => new T.Color(h)); let pNext = 0, pAlive = 0;
  function petals(at, { count = 40, spread = 1.2, up = 4, colors = PAL } = {}) {
    for (let i = 0; i < count; i++) {
      const k = pNext; pNext = (pNext + 1) % PMAX; const a = Math.random() * TAU, r = Math.random() * spread;
      pPos[k * 3] = at.x + Math.cos(a) * r; pPos[k * 3 + 1] = at.y + Math.random() * .6; pPos[k * 3 + 2] = at.z + Math.sin(a) * r;
      pVel[k * 3] = Math.cos(a) * (1 + Math.random() * 2.2); pVel[k * 3 + 1] = up * (.5 + Math.random() * .7); pVel[k * 3 + 2] = Math.sin(a) * (1 + Math.random() * 2.2);
      const c = colors[(Math.random() * colors.length) | 0]; pCol[k * 3] = c.r; pCol[k * 3 + 1] = c.g; pCol[k * 3 + 2] = c.b;
      pLife[k] = 2.4 + Math.random() * 1.6; pSize[k] = .16 + Math.random() * .12; pSpin[k] = Math.random() * TAU;
    }
    pGeo.attributes.color.needsUpdate = true; pAlive = PMAX;
  }
  function updatePetals(dt, t) {
    if (!pAlive) { petalsMesh.visible = false; return; }
    let alive = 0;
    for (let k = 0; k < PMAX; k++) {
      if (pLife[k] <= 0) { pSize[k] = 0; continue; }
      pLife[k] -= dt; alive++;
      pVel[k * 3 + 1] -= 2.6 * dt; pVel[k * 3 + 1] = Math.max(pVel[k * 3 + 1], -1.1); // drift down like paper
      const damp = Math.exp(-dt * 1.3); pVel[k * 3] *= damp; pVel[k * 3 + 2] *= damp;
      pPos[k * 3] += (pVel[k * 3] + Math.sin(t * 3 + k) * .5) * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += (pVel[k * 3 + 2] + Math.cos(t * 2.3 + k) * .5) * dt;
      pSpin[k] += dt * (2 + (k % 5)); if (pLife[k] < .6) pSize[k] *= Math.exp(-dt * 4);
    }
    pAlive = alive; petalsMesh.visible = alive > 0;
    for (const n of ['position', 'size', 'spin']) pGeo.attributes[n].needsUpdate = true;
  }

  // ---------- gameplay-facing state ----------
  const sources = new Map();   // id -> {x,y,z,radius,active,repeat,ttl,cool,label,kind}
  const flights = [];          // capture/release flourishes in flight
  const bursts = [];           // expanding impact rings
  const vents = new Map();     // id -> {x,y,z,top,radius,age,duration}
  const push = new Map();      // id -> {value,from,to,t,duration,hold,holdLeft,wobble}
  const wheels = new Map();    // id -> {spin,target,outlet,delay,chain,flowAge}
  let charge = null;           // {origin, since}
  let flood = null;            // finale wind flood {age, duration, at[]}
  let time = 0;

  function addSource(id, { x, y, z, radius = 1.6, active = true, repeat = true, ttl = Infinity, kind = 'gust', label = null } = {}) {
    if (![x, y, z].every(Number.isFinite)) throw new TypeError('wind source needs x,y,z: ' + id);
    const s = { id, x, y, z, radius, active, repeat, ttl, kind, label, cool: 0, age: 0, spawn: 0 };
    sources.set(id, s); return s;
  }
  function setSource(id, patch = {}) { const s = sources.get(id); if (s) Object.assign(s, patch); return s; }
  function removeSource(id) { sources.delete(id); }
  const catchable = s => s && s.active && s.cool <= 0;
  // Catch zone = the painted floor ring plus the hero's radius, generous in height.
  function sourceAt(p, extra = .6) { // catch zone reaches .6 m past the painted ring (playtest: arrivals missed the prompt)
    let best = null, bestD = Infinity;
    for (const s of sources.values()) {
      if (!catchable(s)) continue;
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d <= s.radius + extra && Math.abs(p.y - s.y) < 2.2 && d < bestD) { best = s; bestD = d; }
    }
    return best;
  }
  // Assisted aim: nearest target inside range, preferring what the hero faces. Facing only weights
  // the choice (the release turns the hero toward its target), so nothing in range is refused.
  function pickTarget(p, yaw, candidates, { range = 5, height = 3.5 } = {}) {
    let best = null, score = Infinity;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const c of candidates || []) {
      if (!c) continue;
      const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz), r = c.range ?? range;
      if (d > r || Math.abs((c.y ?? p.y) - p.y) > (c.height ?? height)) continue;
      const facing = d < .01 ? 1 : (dx * fx + dz * fz) / d;
      const s = d + (1 - facing) * 1.2;
      if (s < score) { score = s; best = c; }
    }
    return best;
  }
  function burst(at, { radius = 1.8, duration = .7, rays = 10, color = null } = {}) { bursts.push({ x: at.x, y: at.y, z: at.z, radius, duration, rays, age: 0, color: color == null ? null : color.isColor ? color : new T.Color(color) }); }
  // Catch: ribbons spiral from the source into the staff bell. Returns true when caught.
  function catchFrom(id, staffTip) {
    const s = typeof id === 'string' ? sources.get(id) : id;
    if (!catchable(s) || charge) return false;
    charge = { origin: s.id, kind: s.kind, since: time };
    flights.push({ type: 'capture', from: new T.Vector3(s.x, s.y + .9, s.z), to: staffTip?.clone?.() || new T.Vector3(s.x, s.y + 1.4, s.z), age: 0, duration: .6, radius: s.radius });
    if (s.repeat) s.cool = 1.4; else { s.active = false; sources.delete(s.id); }
    sound('capture');
    return true;
  }
  // Finale: wind floods up through the tree for `duration` s — soft wisps spiralling up around the trunk and rising
  // out of every mill and wheel (the `at` anchors), with motes and leaves carried up and out over the village.
  function startFlood({ duration = 7, at = [] } = {}) { flood = { age: 0, duration, at: at.map(p => ({ x: p.x, y: p.y, z: p.z })) }; }
  function setCharge(origin, kind = 'gust') { charge = origin ? { origin, kind, since: time } : null; }
  // Release the held charge toward a target. kind: 'give' | 'vent' | 'push' | 'chain' | 'spill'.
  // onArrive fires once the ribbon reaches the target (about 0.45 s), with an impact burst.
  function release(kind, from, target, { onArrive = null, lift = 1.2, keepCharge = false } = {}) {
    if (!charge && !keepCharge) return false;
    const origin = charge?.origin ?? null;
    if (!keepCharge) charge = null;
    const to = target.isVector3 ? target.clone() : new T.Vector3(target.x, target.y, target.z);
    flights.push({ type: kind, from: from.clone(), to, age: 0, duration: kind === 'push' ? .38 : .46, lift: kind === 'vent' ? .5 : lift, onArrive, origin });
    sound(kind === 'push' ? 'push' : 'release');
    return true;
  }
  // Updraft: a visible column over a floor vent for `duration` s; the physics lives in movement.lift.
  function openVent(v, { duration = 4 } = {}) {
    const radius = v.radius ?? 1.1, rec = { id: v.id, x: v.x, y: v.y, z: v.z, top: v.top, radius, age: 0, duration };
    vents.set(v.id, rec);
    const handle = movement?.lift({ id: 'vent:' + v.id, x: v.x, z: v.z, radius: radius + .25, top: v.top, base: v.y, duration, ledge: v.ledge || null });
    burst({ x: v.x, y: v.y + .05, z: v.z }, { radius: radius * 1.8, duration: .6 });
    sound('vent');
    return handle;
  }
  // Push: animate a sail/bridge/shutter state toward `to` (0..1) with a damped settle. It stays
  // there (persistent puzzle state) unless `hold` is set, which returns it to 0 after hold s.
  // `at` ({x,y,z}) draws the hold countdown ring in the world so a timed window is always visible.
  function setPush(id, to = 1, { duration = 1.1, hold = 0, instant = false, at = null } = {}) {
    const cur = push.get(id)?.value ?? 0;
    push.set(id, { value: instant ? to : cur, from: instant ? to : cur, to, t: instant ? duration : 0, duration, hold, holdLeft: hold, wobble: instant ? 0 : 1, at });
  }
  const pushHoldLeft = id => { const p = push.get(id); return p && p.hold > 0 && p.to > 0 ? Math.max(0, p.holdLeft) : 0; };
  const pushValue = id => push.get(id)?.value ?? 0;
  // Chain: power a wheel; after `delay` s its outlet spits a new repeatable gust source.
  function powerWheel(id, { outlet = null, delay = .9, instant = false, chainId = 'chain:' + id } = {}) {
    const w = wheels.get(id) || { spin: 0 }; Object.assign(w, { target: 1, outlet, delay: instant ? 0 : delay, chainId, flowAge: 0 });
    if (instant) w.spin = 1; else if (outlet) sound('chain');
    wheels.set(id, w);
  }
  const wheelSpin = id => wheels.get(id)?.spin ?? 0;

  function state() {
    return { push: Object.fromEntries([...push].map(([k, v]) => [k, v.value])), wheels: Object.fromEntries([...wheels].map(([k, v]) => [k, v.spin])), vents: Object.fromEntries([...vents].map(([k, v]) => [k, clamp01(Math.min(v.age / .25, (v.duration - v.age) / .6))])) };
  }

  // ---------- per-frame ----------
  const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3();
  function update(dt, t, { hero = null, staffTip = null, camera = null, gentle = false } = {}) {
    time = t; uniforms.uTime.value = gentle ? t * .35 : t; updatePetals(dt, t);
    if (camera) eye.copy(camera.position);
    vCount = 0; iCount = 0;
    const spin = gentle ? .45 : 1;
    // Sources: floor ring (the catch zone) over a soft dark underlay, a pulsing inner arc, and soft air: thin wisps
    // that rise and dissolve in a loose spiral (the look renders them as feathered filaments) plus carried motes.
    const FX = fx?.();
    for (const s of [...sources.values()]) {
      s.age += dt; s.cool = Math.max(0, s.cool - dt); s.spawn = Math.min(1, s.spawn + dt * 2.5);
      if (Number.isFinite(s.ttl) && (s.ttl -= dt) <= 0) { sources.delete(s.id); continue; }
      if (!s.active) continue;
      const ready = s.cool <= 0 ? 1 : .35, k = s.spawn * ready, pulse = .5 + .5 * Math.sin(t * 4 + s.x);
      ring(s.x, s.y + .03, s.z, s.radius, { width: .9, alpha: .9 * k, color: SHADE }); // soft dark underlay: reads on sunlit pale cobbles
      ring(s.x, s.y + .04, s.z, s.radius, { width: .42, alpha: .9 * k });
      ring(s.x, s.y + .05, s.z, s.radius * (.55 + .12 * pulse), { width: .24, alpha: .3 * k }, t * 1.3 * spin, t * 1.3 * spin + TAU * .72);
      for (let i = 0; i < 6; i++) {
        // Each wisp is a short window sliding up its own spiral: born low, rising, thinning out on top.
        const cyc = (t * .42 * spin + i / 6 + s.x * .13) % 1, ph = i * TAU / 6 + t * 1.5 * spin + s.z;
        const r = s.radius * (.3 + .28 * ((i * 5) % 6) / 5) + .08 * Math.sin(t * 1.7 + i), top = s.y + 1.7 + .35 * (i % 3);
        helix(s.x, s.y + .1, s.z, top, r, .9 + .15 * (i % 2), ph, { width: .46, alpha: .8 * k * Math.sin(Math.PI * cyc), n: 26, from: Math.max(0, cyc * 1.5 - .5), to: Math.min(1, cyc * 1.5 + .05) });
      }
      if (FX?.swirl && Math.hypot(s.x - eye.x, s.y - eye.y, s.z - eye.z) < 32) FX.swirl(s.id, s.x, s.y, s.z, s.radius, dt * k, gentle ? 4 : 9);
      if (Number.isFinite(s.ttl) && s.ttl < 1.5) ring(s.x, s.y + .06, s.z, s.radius * .9, { width: .09, alpha: .8 }, 0, TAU * s.ttl / 1.5);
    }
    if (flood) {
      // A big warm gust rising through the tree: billowing soft air (billow: true = the look's additive "billow" mode, off the shimmer pass: broad glowing
      // haze with filaments inside, never a ribbon), curling plumes out of every mill, wheel and square, and a lot of
      // carried motes and fluff. Envelope: swells in ~.6 s, full for most of the beat, dissolves over the last 1.5 s.
      flood.age += dt; const fa = flood.age, env = Math.min(1, fa / .6) * Math.min(1, (flood.duration - fa) / 1.5);
      if (fa >= flood.duration) flood = null;
      else {
        const warm = FLOOD_TINT;
        // Around the trunk (axis x=z=0): short, broad, curling billows at every height, so any camera sees some.
        for (let i = 0; i < 30; i++) {
          const cyc = (fa * .45 + i * .173) % 1, r = 13.5 + 4.5 * Math.sin(i * 2.3), y0 = -3 + (i % 6) * 4.2 + cyc * 3;
          helix(0, y0, 0, y0 + 7, r, .55, i * TAU / 30 + fa * .5, { width: 3.2, alpha: .9 * env * Math.sin(Math.PI * cyc), billow: true, color: warm, n: 30, from: Math.max(0, cyc * 1.5 - .5), to: Math.min(1, cyc * 1.5) });
        }
        // Out of each spot: a dense curling plume.
        flood.at.forEach((q, j) => {
          for (let i = 0; i < 9; i++) {
            const cyc = (fa * .6 + i / 9 + j * .31) % 1, r = 1 + .45 * i;
            helix(q.x, q.y - .3, q.z, q.y + 4.5 + .6 * i, r, .9, i * TAU / 9 + fa * 1.4 + j, { width: 1.6, alpha: .9 * env * Math.sin(Math.PI * cyc), billow: true, color: warm, n: 26, from: Math.max(0, cyc * 1.4 - .4), to: Math.min(1, cyc * 1.4) });
          }
          if (FX?.swirl && Math.hypot(q.x - eye.x, q.y - eye.y, q.z - eye.z) < 50) FX.swirl('flood' + j, q.x, q.y, q.z, 3, dt * env, 50);
        });
      }
    }
    // Held charge: two ribbons orbit the staff bell, one trails back to the hero's shoulders.
    if (charge && staffTip) {
      for (let i = 0; i < 2; i++) {
        const ph = t * 5 * spin + i * Math.PI;
        strip(22, (f, o) => { const a = ph + f * TAU * .8; o.set(staffTip.x + Math.cos(a) * (.28 + .06 * i), staffTip.y - .1 + f * .35 + .06 * Math.sin(a * 2), staffTip.z + Math.sin(a) * (.28 + .06 * i)); }, { width: .26, alpha: .6 });
      }
      if (hero) ring(hero.x, hero.y + .05, hero.z, .62 + .05 * Math.sin(t * 5), { width: .12, alpha: .8 }, t * 2 * spin, t * 2 * spin + TAU * .8);
      if (hero) strip(16, (f, o) => { const a = t * 3 * spin + f * 5; o.set(staffTip.x + (hero.x - staffTip.x) * f + Math.cos(a) * .25 * f, staffTip.y + (hero.y + 1.1 - staffTip.y) * f, staffTip.z + (hero.z - staffTip.z) * f + Math.sin(a) * .25 * f); }, { width: .2, alpha: .45 });
    }
    // Flights: captures spiral in; releases arc out with a thick head and a long tail.
    for (let i = flights.length - 1; i >= 0; i--) {
      const fl = flights[i]; fl.age += dt;
      const f = clamp01(fl.age / fl.duration);
      if (staffTip && fl.type === 'capture') fl.to.copy(staffTip);
      if (fl.type === 'capture') {
        for (let k = 0; k < 4; k++) {
          const ph = k * TAU / 4;
          strip(28, (g, o) => { const e = ease(g), r = (fl.radius || 1.4) * (1 - e) * .9; o.lerpVectors(fl.from, fl.to, e); o.x += Math.cos(ph + g * 5) * r; o.z += Math.sin(ph + g * 5) * r; o.y += Math.sin(Math.PI * g) * .5; }, { width: .36, alpha: .55, from: Math.max(0, f * 1.35 - .55), to: Math.min(1, f * 1.35 + .02) });
        }
      } else {
        const from = fl.from, to = fl.to, lift = fl.lift ?? 1.2, w = fl.type === 'push' ? .85 : .6;
        const tail = Math.max(0, f * 1.5 - .75), head = Math.min(1, f * 1.5);
        arc(from, to, lift, { width: w, alpha: .62, from: tail, to: head, n: 34 });
        for (const off of fl.type === 'push' ? [-.7, 0, .7] : [-.3, .3]) {
          strip(24, (g, o) => { o.lerpVectors(from, to, g); o.y += Math.sin(Math.PI * g) * lift + off * .5; const s2 = Math.sin(g * 9 + t * 8) * .12; o.x += s2 * (off > 0 ? 1 : -1); }, { width: w * .6, alpha: .45, from: Math.max(0, tail - .05), to: Math.max(0, head - .08) });
        }
      }
      if (f >= 1) {
        flights.splice(i, 1);
        if (fl.type !== 'capture') { burst(fl.to, { radius: fl.type === 'push' ? 2.8 : 2.1, rays: 12 }); try { fl.onArrive?.(fl); } catch (e) { console.error(e); } }
        else burst(fl.to, { radius: .9, duration: .45, rays: 6 });
      }
    }
    // Bursts: an expanding camera-facing ring plus radial streaks.
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.age += dt; const f = clamp01(b.age / b.duration), r = b.radius * ease(f), a = (1 - f) * .6;
      if (f >= 1) { bursts.splice(i, 1); continue; }
      strip(36, (g, o) => { const q = g * TAU; o.set(b.x + Math.cos(q) * r, b.y + .9 + Math.sin(q) * r * .55, b.z + Math.sin(q) * r * .45); }, { width: (.32 * (1 - f) + .08) * (b.radius > 4 ? b.radius / 3 : 1), alpha: a, taper: false, color: b.color });
      for (let k = 0; k < b.rays; k++) {
        const q = k * TAU / b.rays + .3; A.set(Math.cos(q), .35 + .5 * Math.sin(q * 3), Math.sin(q)).normalize();
        strip(6, (g, o) => { const d = r * (.55 + g * .75); o.set(b.x + A.x * d, b.y + .9 + A.y * d, b.z + A.z * d); }, { width: .2 * (1 - f) + .05, alpha: a, color: b.color });
      }
    }
    // Vent columns: grille ring with a countdown arc, four rising helices, vertical streaks, top ring.
    if (FX && !FX.attached?.has?.(mesh)) FX.attach(mesh);
    for (const [id, v] of vents) {
      v.age += dt; if (v.age >= v.duration) { vents.delete(id); FX?.removeUpdraft(id); continue; }
      const k = clamp01(Math.min(v.age / .25, (v.duration - v.age) / .6)), h = v.top - v.y, left = 1 - v.age / v.duration;
      ring(v.x, v.y + .06, v.z, v.radius, { width: .36, alpha: .9 * k });
      ring(v.x, v.y + .08, v.z, v.radius + .4, { width: .2, alpha: .95 * k }, -Math.PI / 2, -Math.PI / 2 + TAU * left);
      if (FX) { FX.setUpdraft(id, { x: v.x, y: v.y, z: v.z, top: v.top, radius: v.radius, strength: k }); continue; } // the look draws the mist column
      for (let i = 0; i < 4; i++) {
        const ph = i * TAU / 4 - t * 3.2 * spin, r = v.radius * (.62 + .1 * Math.sin(t * 2 + i));
        helix(v.x, v.y + .1, v.z, v.y + h * Math.min(1, v.age / .35) + .4, r, 1.6 + h * .12, ph, { width: .34, alpha: .9 * k, n: 44, taper: true });
      }
      for (let i = 0; i < 8; i++) {
        const q = i * TAU / 8 + i, r = v.radius * (.25 + .5 * ((i * 37) % 10) / 10), c = ((t * (1.2 + .1 * i) + i * .37) % 1);
        const y0 = v.y + c * h, y1 = Math.min(v.top + .6, y0 + 1.1);
        strip(6, (g, o) => o.set(v.x + Math.cos(q) * r, y0 + (y1 - y0) * g, v.z + Math.sin(q) * r), { width: .14, alpha: .9 * k * Math.sin(Math.PI * c) });
      }
      ring(v.x, v.top + .45, v.z, v.radius * .9, { width: .12, alpha: .7 * k }, t * 2, t * 2 + TAU * .8);
    }
    // Push animation (damped settle) and timed returns.
    for (const [id, p] of push) {
      if (p.t < p.duration) { p.t = Math.min(p.duration, p.t + dt); const f = p.t / p.duration; p.value = p.from + (p.to - p.from) * (ease(f) + Math.sin(f * Math.PI * 3) * (1 - f) * .12 * p.wobble); }
      else if (p.hold > 0 && p.to > 0 && (p.holdLeft -= dt) <= 0) setPush(id, 0, { duration: 1.2 });
      else p.value = p.to;
      if (p.at && p.hold > 0 && p.to > 0 && p.holdLeft > 0) {
        // Countdown: a thick vertical ring that empties as the window closes, plus a floor ring.
        const left = p.holdLeft / p.hold, r = 1.25, warn = left < .3 ? .55 + .45 * Math.sin(t * 18) : 1;
        strip(40, (g, o) => { const q = -Math.PI / 2 + g * TAU * left; o.set(p.at.x + Math.cos(q) * r, p.at.y + 1.6 + Math.sin(q) * r, p.at.z + .05); }, { width: .2, alpha: .95 * warn, taper: false });
        ring(p.at.x, p.at.y + .06, p.at.z, 1.5, { width: .12, alpha: .8 * warn }, -Math.PI / 2, -Math.PI / 2 + TAU * left);
      }
    }
    // Wheels: spin ramps up; a chain wheel draws its flow to the outlet and then keeps a gust there.
    for (const [id, w] of wheels) {
      w.spin += (w.target - w.spin) * (1 - Math.exp(-dt * 2.2));
      if (!w.outlet) continue;
      w.flowAge += dt;
      const src = w.origin || w.outlet;
      if (w.flowAge >= w.delay && !sources.has(w.chainId)) addSource(w.chainId, { ...w.outlet, radius: w.outlet.radius ?? 1.5, kind: 'chain' });
      if (w.from) {
        // A visible stream from hub to outlet: grows in, then keeps pulsing along the route.
        const f = Math.min(1, w.flowAge / Math.max(.2, w.delay)), to = C.set(src.x, src.y + .9, src.z);
        arc(w.from, to, 1.4, { width: .4, alpha: .55, from: 0, to: f, n: 34 });
        for (let i = 0; i < 3; i++) { const h = ((t * .9 + i / 3) % 1); if (h < f) arc(w.from, to, 1.4, { width: .55, alpha: .5, from: Math.max(0, h - .12), to: h, n: 10 }); }
      }
    }
  }
  // Upload this frame's strips. Call once per frame after every drawer (wind, quest, guardian).
  function flush() {
    geo.setDrawRange(0, iCount);
    for (const name of ['position', 'uv', 'color']) { const at = geo.attributes[name]; at.clearUpdateRanges?.(); at.addUpdateRange?.(0, Math.max(1, vCount) * at.itemSize); at.needsUpdate = true; }
    geo.index.clearUpdateRanges?.(); geo.index.addUpdateRange?.(0, Math.max(1, iCount)); geo.index.needsUpdate = true;
    mesh.visible = iCount > 0;
  }
  // A chain wheel's flow is drawn from its hub to the outlet; set `from` when powering.
  function chainFrom(id, from) { const w = wheels.get(id); if (w) w.from = from.isVector3 ? from.clone() : new T.Vector3(from.x, from.y, from.z); }
  function reset() { flood = null; for (const id of vents.keys()) fx?.()?.removeUpdraft(id); pLife.fill(0); sources.clear(); flights.length = 0; bursts.length = 0; vents.clear(); push.clear(); wheels.clear(); charge = null; }
  function telemetry() { return { charge: charge?.origin ?? null, sources: [...sources.values()].filter(catchable).map(s => ({ id: s.id, x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2) })), vents: [...vents.keys()], push: Object.fromEntries([...push].map(([k, v]) => [k, +v.value.toFixed(2)])), wheels: Object.fromEntries([...wheels].map(([k, v]) => [k, +v.spin.toFixed(2)])), flights: flights.length, strips: iCount / 6 }; }
  return {
    mesh, strip, ring, helix, arc, burst, petals,
    addSource, setSource, removeSource, sourceAt, sources, pickTarget,
    catchFrom, setCharge, release, get charge() { return charge; }, get charged() { return !!charge; },
    openVent, flood: startFlood, setPush, pushValue, pushHoldLeft, powerWheel, chainFrom, wheelSpin, state, update, flush, reset, telemetry,
    get busy() { return flights.length > 0; },
  };
}
