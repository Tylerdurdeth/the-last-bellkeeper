// Original procedural boss score + guardian SFX: Web Audio synthesis only, no recordings or files.
// It borrows the soundscape's context, master and reverb (soundscape.bus()), so mute, volume and pause
// apply automatically, and nothing exists until the soundscape was started from a user gesture.
//   createBossAudio(soundscape, {listener: () => camera}) -> {update(dt, {fight, phase, rage, x, y, z}), event(name, data), dispose()}
// Events: inhale {d} (telegraph fills + suction), exhale (breath fires), pulse (grille column), rage {d} (rears/roars),
// wall (slam + rolling wind wall), hit (hero knocked: bell-body clang), vane {full} (vane turns), phase {phase} (sting), calm.
export function createBossAudio(soundscape, { listener = () => null, now: clock = null } = {}) {
  let ctx = null, B = null, out, music, fade, sfxPan, sfxGain, hum = null, disposed = false;
  let fight = false, phase = 0, rage = false, playing = false, stopAt = 0, nextT = 0, step = 0, resolveAt = -1, handed = true;
  let drops = 0; const voices = new Map(), nodes = [], MAX = 56;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), hz = n => 440 * 2 ** ((n - 69) / 12);
  const now = () => clock ? clock() : ctx.currentTime;
  const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
  function ensure() {
    if (ctx) return true; if (disposed) return false;
    const b = soundscape?.bus?.(); if (!b) return false;
    B = b; ctx = b.context;
    out = g(1); out.connect(B.master); const send = g(.22); out.connect(send); send.connect(B.wet);
    music = g(.85); fade = g(0); music.connect(fade); fade.connect(out);
    sfxPan = ctx.createStereoPanner(); sfxGain = g(1); sfxPan.connect(sfxGain); sfxGain.connect(out);
    nodes.push(out, send, music, fade, sfxPan, sfxGain); return true;
  }
  function full() { if (voices.size < MAX) return false; const t = now(); for (const [v, end] of voices) if (end < t) voices.delete(v); if (voices.size >= MAX) { drops++; return true; } return false; }
  function track(src, parts, end) { voices.set(src, end); src.onended = () => { voices.delete(src); src.disconnect(); parts.forEach(p => p.disconnect()); }; }
  // Envelope: exponential attack to peak, then decay (or 'hold' = rise over the whole duration then cut).
  function env(e, at, dur, peak, attack, hold, pad) {
    const p = e.gain; p.setValueAtTime(.0001, at);
    if (pad) { p.exponentialRampToValueAtTime(peak, at + attack); p.setValueAtTime(peak, at + Math.max(attack, dur * .6)); p.exponentialRampToValueAtTime(.0001, at + dur); return; }
    if (hold) { p.exponentialRampToValueAtTime(peak, at + dur * .92); p.linearRampToValueAtTime(0, at + dur + .06); }
    else { p.exponentialRampToValueAtTime(peak, at + Math.min(attack, dur * .5)); p.exponentialRampToValueAtTime(.0001, at + dur); }
  }
  function tone(dest, at, dur, peak, { type = 'sine', f = 220, to = 0, glide = dur, attack = .01, cut = 0, cutTo = 0, q = .7, detune = 0, hold = false, pad = false } = {}) {
    if (full()) return;
    const o = ctx.createOscillator(), e = g(0), parts = [e]; o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f, at); if (to) o.frequency.exponentialRampToValueAtTime(to, at + glide);
    let head = o; if (cut) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = q; fl.frequency.setValueAtTime(cut, at); if (cutTo) fl.frequency.exponentialRampToValueAtTime(cutTo, at + dur * .8); o.connect(fl); head = fl; parts.push(fl); }
    head.connect(e); e.connect(dest); env(e, at, dur, peak, attack, hold, pad); track(o, parts, at + dur + .1); o.start(at); o.stop(at + dur + .1);
  }
  function noise(dest, at, dur, peak, { color = 'pink', type = 'bandpass', f = 1000, to = 0, q = .8, attack = .02, hold = false, rate = 1 } = {}) {
    if (full()) return;
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), e = g(0);
    s.buffer = B.noise(2, color); s.loop = dur > 1.9; s.playbackRate.value = rate; fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, at); if (to) fl.frequency.exponentialRampToValueAtTime(to, at + dur);
    s.connect(fl); fl.connect(e); e.connect(dest); env(e, at, dur, peak, attack, hold); track(s, [fl, e], at + dur + .1); s.start(at, Math.random() * .5); s.stop(at + dur + .1);
  }
  // Struck ivory/bronze: inharmonic partials, the heavier the lower.
  function clang(dest, at, base, peak, decay, ratios = [1, 2.32, 3.9, 5.4, 6.8]) {
    ratios.forEach((r, i) => tone(dest, at, decay / (1 + i * .5), peak / (1 + i * 1.6), { f: base * r * (1 + (Math.random() - .5) * .004), attack: .004 }));
  }
  // ---------------- music ----------------
  const ROOTS = [50, 46, 48, 45], CHORDS = [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 61, 64]]; // Dm Bb C A
  const MEL = [[69, 74], [77, 74], [76, 79], [73, 76]];
  const DRUMS = [[1, 0, 0, 0, .6, 0, 0, 0], [1, 0, 0, .5, .8, 0, .4, 0], [1, 0, .4, .6, .9, 0, .6, .5], [1, .5, .7, .5, 1, .5, .8, .9]];
  const bpm = () => rage ? 106 : [84, 92, 100][clamp(phase, 0, 2)];
  function taiko(at, s) { tone(music, at, .9, .42 * s, { f: 150, to: 66, glide: .3, attack: .006 }); noise(music, at, .14, .2 * s, { color: 'brown', type: 'lowpass', f: 420, attack: .003 }); }
  function brass(at, notes, dur, s, cut = 1300) { for (const n of notes) for (const d of s >= 1 ? [-9, 9] : [0]) tone(music, at, dur, (s >= 1 ? .022 : .03) * s, { type: 'sawtooth', f: hz(n), detune: d, attack: .14, pad: true, cut: 320, cutTo: cut * (.7 + s * .4), q: 1.2 }); }
  function bell(at, n, s) { clang(music, at, hz(n), .05 * s, 2.6, [1, 2.0, 2.76, 5.4]); }
  function playStep(at, sd) {
    const i = step % 8, bar = Math.floor(step / 8) % 4, lvl = rage ? 3 : clamp(phase, 0, 2), root = ROOTS[bar];
    const d = DRUMS[lvl][i]; if (d) taiko(at, d * (i === 0 ? 1.1 : .8));
    if (lvl === 3 && i % 2 === 1) noise(music, at, .08, .05, { type: 'highpass', f: 4000, attack: .002 });
    const ost = [0, 12, 7, 12, 0, 12, 7, 12][i];
    if (lvl > 0 || i % 2 === 0) tone(music, at, sd * 1.6, lvl ? .05 : .035, { type: 'sawtooth', f: hz(root + ost), attack: .008, cut: 500 + lvl * 350, cutTo: 260, q: 2 });
    if (lvl === 3) tone(music, at + sd / 2, sd * .8, .03, { type: 'sawtooth', f: hz(root + 12), attack: .008, cut: 1200, cutTo: 400, q: 2 });
    if (i === 0) {
      const bd = sd * 8, s = .5 + lvl * .22; brass(at, lvl ? CHORDS[bar] : [CHORDS[bar][0]], bd * .98, s, lvl === 3 ? 2200 : 1300);
      tone(music, at, bd, .07, { f: hz(root - 12), attack: .2 }); // low drone keeps the floor warm
      if (lvl === 3) noise(music, at, bd, .07, { f: 400, to: 3200, q: 1.5, hold: true }); // riser under the rage
    }
    if (i === 0 || (i === 4 && lvl > 0)) { const n = MEL[bar][i ? 1 : 0]; bell(at, n + (lvl >= 2 ? 12 : 0), .8 + lvl * .1); if (lvl >= 2) tone(music, at, sd * 3.6, .03, { type: 'sawtooth', f: hz(n), attack: .06, cut: 700, cutTo: 1800, q: 1 }); }
    if (lvl === 3 && (i === 3 || i === 6)) brass(at, [CHORDS[bar][0] + 12], sd * .9, 1.1, 2600);
    step++;
  }
  function resolve(at) { // the calm-down: D major swell, bell cascade, one soft drum
    taiko(at, 1.2); brass(at, [50, 57, 62, 66, 69], 5.5, 1, 1600);
    [74, 78, 81, 86, 90].forEach((n, i) => bell(at + .35 + i * .28, n, 1 - i * .1));
    tone(music, at, 6, .08, { f: hz(38), attack: .4 });
    fade.gain.setTargetAtTime(0, at + 4.5, 1.1); stopAt = at + 9; resolveAt = at; handed = false;
  }
  // ---------------- rotor heart hum ----------------
  function makeHum() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), amp = g(.5), lvl = g(0), lfo = ctx.createOscillator(), depth = g(.45);
    o1.type = 'triangle'; o1.frequency.value = 98; o2.type = 'sine'; o2.frequency.value = 147.5; fl.type = 'lowpass'; fl.frequency.value = 520;
    lfo.frequency.value = 2; lfo.connect(depth); depth.connect(amp.gain); o1.connect(fl); o2.connect(fl); fl.connect(amp); amp.connect(lvl); lvl.connect(sfxPan);
    const t = now(); o1.start(t); o2.start(t); lfo.start(t); nodes.push(o1, o2, lfo, fl, amp, lvl, depth); hum = { o1, o2, lfo, lvl, fl };
  }
  // ---------------- per-frame ----------------
  const rightV = { x: 1, y: 0, z: 0 };
  function update(dt, o = {}) {
    if (!ensure()) return; const t = now(), wasFight = fight;
    fight = !!o.fight; phase = o.phase | 0; rage = !!o.rage;
    // Position the boss relative to the camera (pan by its right vector, soft distance roll-off).
    const cam = listener?.(); let gainL = 1, pan = 0;
    if (cam && Number.isFinite(o.x)) {
      const p = cam.position, dx = o.x - p.x, dy = (o.y ?? p.y) - p.y, dz = o.z - p.z, dist = Math.hypot(dx, dy, dz) || 1, m = cam.matrixWorld?.elements;
      if (m) { rightV.x = m[0]; rightV.y = m[1]; rightV.z = m[2]; }
      pan = clamp((dx * rightV.x + dy * rightV.y + dz * rightV.z) / dist, -1, 1) * .75; gainL = clamp(1.4 / (1 + dist / 14), .25, 1);
    }
    sfxPan.pan.setTargetAtTime(pan, t, .1); sfxGain.gain.setTargetAtTime(gainL, t, .15);
    if (fight && !hum) makeHum();
    if (hum) {
      const rate = rage ? 9 : [2.2, 3.6, 5.4][clamp(phase, 0, 2)];
      hum.lfo.frequency.setTargetAtTime(fight ? rate : .6, t, .6); hum.o1.frequency.setTargetAtTime(fight ? 98 * (1 + phase * .06 + (rage ? .1 : 0)) : 82, t, .8);
      hum.lvl.gain.setTargetAtTime(fight ? .075 : 0, t, fight ? .8 : 1.5);
    }
    if (fight && !wasFight) { resolveAt = -1; handed = true; // fade in on engage; duck the ambience
      if (!playing) { playing = true; step = 0; nextT = t + .1; }
      fade.gain.cancelScheduledValues(t); fade.gain.setTargetAtTime(1, t, 1.2); stopAt = Infinity; soundscape.duck?.(.8, 1.2, now());
    } else if (!fight && wasFight && resolveAt < 0) { fade.gain.cancelScheduledValues(t); fade.gain.setTargetAtTime(0, t, .7); stopAt = t + 3.5; soundscape.duck?.(0, 3, now()); }
    if (!handed && t > resolveAt + 4.5) { handed = true; soundscape.duck?.(0, 5, now()); } // gentle hand-back to the ambience
    if (!playing) return;
    if (t >= stopAt) { playing = false; resolveAt = -1; return; }
    if (resolveAt >= 0) return; // resolve scheduled; let it ring
    if (nextT < t - .15) nextT = t + .05; // resync after a pause or hidden tab
    const sd = 60 / bpm() / 2;
    while (nextT < t + .2) { if (!B.silent()) playStep(nextT, sd); else step++; nextT += sd; }
  }
  function event(name, d = {}) {
    if (!ensure() || B.silent()) return; const t = now() + .01, S = sfxPan;
    if (name === 'inhale') { // the lane telegraph fills: rising charge + suction toward the mouth
      const dur = clamp(d.d || 2, .6, 4);
      noise(S, t, dur, .16, { f: 2600, to: 500, q: .9, hold: true });
      tone(S, t, dur, .05, { type: 'sawtooth', f: 92, to: 196, cut: 300, cutTo: 1700, q: 3, hold: true });
      tone(S, t + dur * .4, dur * .6, .025, { type: 'triangle', f: 392, to: 784, hold: true });
    } else if (name === 'exhale') { // breath fires: big wind blast, a low thump and a breathy tail
      noise(S, t, 1.5, .5, { color: 'brown', type: 'lowpass', f: 2600, to: 260, attack: .015 });
      noise(S, t, 1.1, .2, { f: 1900, to: 420, q: .7, attack: .02 });
      tone(S, t, .5, .32, { f: 130, to: 62, glide: .25, attack: .005 });
      noise(S, t + .5, 1.1, .06, { f: 900, to: 300, q: .6, attack: .3 });
    } else if (name === 'pulse') { // a grille column bursts upward
      noise(S, t, 1.6, .16, { f: 280, to: 2600, q: .8, attack: .25 }); tone(S, t, .9, .12, { f: 90, to: 180, attack: .05 });
    } else if (name === 'rage') { // rears up: two-voice roar growing through the windup
      const dur = clamp(d.d || 1.8, .8, 3);
      for (const [f, dt] of [[62, -12], [93, 10], [124, 0]]) tone(S, t, dur + .4, f > 100 ? .03 : .07, { type: 'sawtooth', f, to: f * 1.12, glide: dur, detune: dt, cut: 180, cutTo: 1100, q: 4, hold: true });
      noise(S, t, dur + .3, .18, { color: 'brown', type: 'lowpass', f: 300, to: 1200, hold: true });
      if (playing) { taiko(t + dur * .5, .6); taiko(t + dur * .75, .8); }
    } else if (name === 'wall') { // the slam, then the wind wall rolling outward
      taiko(t, 1.5); clang(S, t, 73, .22, 1.8);
      noise(S, t, 1.7, .36, { color: 'brown', type: 'lowpass', f: 500, to: 1500, attack: .05 });
      noise(S, t + .1, 1.5, .12, { f: 700, to: 2600, q: 1.2, attack: .2 });
    } else if (name === 'hit') { // hero knocked: heavy ivory-bell body clang + thud
      clang(S, t, 87, .26, 2.6); noise(S, t, .25, .3, { color: 'brown', type: 'lowpass', f: 380, attack: .004 });
    } else if (name === 'vane') { // a vane turns: the bell body answers (fuller on the last breath)
      clang(S, t, d.full ? 110 : 131, d.full ? .22 : .12, d.full ? 3 : 1.8); noise(S, t, .6, .06, { f: 600, to: 1500, q: 2 });
    } else if (name === 'phase') { // phase-change sting: brass stab, double drum, cymbal wash
      const lift = (d.phase | 0) * 2; taiko(t, 1.3); taiko(t + .17, 1);
      brass(t, [50 + lift, 57 + lift, 62 + lift, 65 + lift], 1.6, 1.2, 2400);
      noise(music, t, 2.2, .07, { color: 'white', type: 'highpass', f: 5200, attack: .01 });
    } else if (name === 'calm') { // the calm-down chime, then the score resolves and hands back
      [81, 86, 88, 93].forEach((n, i) => clang(S, t + .5 + i * .3, hz(n), .05, 3.2, [1, 2.0, 3.0]));
      if (playing) { fade.gain.cancelScheduledValues(t); fade.gain.setTargetAtTime(1, t, .3); resolve(Math.max(t + .1, nextT)); }
      else soundscape.duck?.(0, 4, now());
      if (hum) { hum.lfo.frequency.setTargetAtTime(.3, t, 1); hum.lvl.gain.setTargetAtTime(0, t, 1.4); }
    }
  }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const v of voices.keys()) { try { v.stop(); } catch {} } voices.clear();
    for (const n of nodes) { try { n.stop?.(); } catch {} n.disconnect(); } nodes.length = 0; hum = null;
    soundscape?.duck?.(0, .5);
  }
  return { update, event, dispose, get telemetry() { return { ready: !!ctx, playing, fight, phase, rage, voices: voices.size, drops }; } };
}
