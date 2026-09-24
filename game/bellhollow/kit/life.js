// Frozen-then-alive village motion, all instanced: lanterns (glow per area), bunting,
// laundry, pinwheels and flags. Motion amplitude and glow follow alive(area) in 0..1.
import {PAL, materials} from './core.js';

export function createLife(T, root) {
  const M = materials(T);
  const specs = {lantern: [], rope: [], pennant: [], cloth: [], pinwheel: [], flag: []};
  const dbl = (key) => { const m = M[key].clone(); m.side = T.DoubleSide; m.userData.bhKey = key + 'Double'; return m; };
  const lanternMats = {};
  const lanternMat = (area) => lanternMats[area] ??= Object.assign(new T.MeshStandardMaterial({color: 0xF6D9B0, roughness: .5, emissive: PAL.gold, emissiveIntensity: .05}), {name: 'glass'});
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const catenary = (p, q, sag, f) => V(p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f - sag * 4 * f * (1 - f), p.z + (q.z - p.z) * f);
  const ropeLine = (p, q, sag, segs = 8) => { for (let i = 0; i < segs; i++) specs.rope.push([catenary(p, q, sag, i / segs), catenary(p, q, sag, (i + 1) / segs)]); };

  const api = {
    lantern(area, x, y, z, s = 1) { specs.lantern.push({area, p: V(x, y, z), s}); },
    lanternString(area, p, q, sag = .8, n = 4) { ropeLine(p, q, sag); for (let i = 1; i <= n; i++) { const c = catenary(p, q, sag, i / (n + 1)); api.lantern(area, c.x, c.y - .3, c.z, .8); } },
    bunting(area, p, q, sag = .6, n = 8) {
      ropeLine(p, q, sag);
      const dir = q.clone().sub(p).setY(0).normalize();
      for (let i = 0; i < n; i++) { const f = (i + .5) / n, c = catenary(p, q, sag, f); specs.pennant.push({area, p: c, dir, alt: i % 2, ph: Math.random() * 6}); }
    },
    laundry(area, p, q, n = 5) {
      ropeLine(p, q, .35);
      const dir = q.clone().sub(p).setY(0).normalize();
      for (let i = 0; i < n; i++) { const f = (i + .7) / (n + .4), c = catenary(p, q, .35, f); specs.cloth.push({area, p: c, dir, alt: i % 3, w: .55 + (i % 2) * .25, h: .7 + (i % 3) * .15, ph: i * 1.7}); }
    },
    pinwheel(area, x, y, z, yaw, s = .4) { specs.pinwheel.push({area, p: V(x, y, z), yaw, s, ph: Math.random() * 6}); },
    flag(area, x, y, z, s = .8) { specs.flag.push({area, p: V(x, y, z), s, ph: Math.random() * 6}); },
  };
  const ims = [];
  const q = new T.Quaternion(), e = new T.Euler(), m = new T.Matrix4(), sc = new T.Vector3(), up = V(0, 1, 0);

  api.finish = function () {
    // --- lanterns: cage (shared) + glass per area
    const cageG = new T.CylinderGeometry(.2, .16, .08, 6); cageG.translate(0, -.2, 0);
    const capG = new T.ConeGeometry(.26, .2, 6); capG.translate(0, .26, 0);
    const cage = mergeTwo(cageG, capG);
    const glassG = new T.CylinderGeometry(.16, .13, .36, 6);
    if (specs.lantern.length) {
      const cm = new T.InstancedMesh(cage, M.verdigris, specs.lantern.length); cm.name = 'bh-lantern-cages';
      specs.lantern.forEach((l, i) => { m.compose(l.p, q.identity(), sc.setScalar(l.s)); cm.setMatrixAt(i, m); });
      root.add(cm);
      const byArea = {};
      for (const l of specs.lantern) (byArea[l.area] ??= []).push(l);
      for (const [area, list] of Object.entries(byArea)) {
        const im = new T.InstancedMesh(glassG, lanternMat(area), list.length); im.name = 'bh-lanterns-' + area;
        list.forEach((l, i) => { m.compose(l.p, q.identity(), sc.setScalar(l.s)); im.setMatrixAt(i, m); });
        root.add(im);
      }
    }
    // --- ropes: unit cylinders stretched between points
    if (specs.rope.length) {
      const g = new T.CylinderGeometry(.018, .018, 1, 4, 1, true); g.translate(0, .5, 0);
      const im = new T.InstancedMesh(g, M.timberDark, specs.rope.length); im.name = 'bh-ropes';
      specs.rope.forEach(([a, b], i) => { const d = b.clone().sub(a), L = d.length(); q.setFromUnitVectors(up, d.normalize()); m.compose(a, q, sc.set(1, L, 1)); im.setMatrixAt(i, m); });
      root.add(im);
    }
    // --- pennants (two colours)
    const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-.17, 0, 0, .17, 0, 0, 0, -.38, 0], 3)); tri.computeVertexNormals();
    for (const alt of [0, 1]) {
      const list = specs.pennant.filter((p) => p.alt === alt); if (!list.length) continue;
      const im = new T.InstancedMesh(tri, dbl(alt ? 'clothIvory' : 'cloth'), list.length); im.name = 'bh-pennants-' + alt;
      im.userData.list = list; im.userData.kind = 'pennant'; ims.push(im); root.add(im);
    }
    // --- laundry cloths
    const quad = new T.PlaneGeometry(1, 1, 1, 2); quad.translate(0, -.5, 0);
    for (const alt of [0, 1, 2]) {
      const list = specs.cloth.filter((c) => c.alt === alt); if (!list.length) continue;
      const im = new T.InstancedMesh(quad, dbl(['clothIvory', 'cloth', 'leafLight'][alt]), list.length); im.name = 'bh-laundry-' + alt;
      im.userData.list = list; im.userData.kind = 'cloth'; ims.push(im); root.add(im);
    }
    // --- pinwheels: 4 petal blades (coral) + hub
    if (specs.pinwheel.length) {
      const blades = [];
      for (let k = 0; k < 4; k++) { const b = new T.BufferGeometry(); b.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, .5, .05, .08, .45, .5, 0, 0, 0, 0, .45, .5, 0, .05, .45, -.06], 3)); b.rotateZ(k * Math.PI / 2); blades.push(b); }
      const g = mergeMany(blades); g.computeVertexNormals();
      const im = new T.InstancedMesh(g, dbl('cloth'), specs.pinwheel.length); im.name = 'bh-pinwheels';
      im.userData.list = specs.pinwheel; im.userData.kind = 'pinwheel'; ims.push(im); root.add(im);
    }
    // --- flags on poles (pole baked here as instanced too)
    if (specs.flag.length) {
      const pole = new T.CylinderGeometry(.04, .05, 2.4, 5); pole.translate(0, -1.2, 0);
      const pm = new T.InstancedMesh(pole, M.timberDark, specs.flag.length); pm.name = 'bh-flagpoles';
      specs.flag.forEach((f, i) => { m.compose(f.p, q.identity(), sc.setScalar(1)); pm.setMatrixAt(i, m); }); root.add(pm);
      const fg = new T.PlaneGeometry(1, .55, 3, 1); fg.translate(.5, -.28, 0);
      const im = new T.InstancedMesh(fg, dbl('cloth'), specs.flag.length); im.name = 'bh-flags';
      im.userData.list = specs.flag; im.userData.kind = 'flag'; ims.push(im); root.add(im);
    }
    for (const im of ims) { im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; }
  };

  const tmpM = new T.Matrix4(), tq = new T.Quaternion(), tq2 = new T.Quaternion(), ax = V(0, 0, 1);
  api.update = function (dt, t, alive) {
    for (const [area, mat] of Object.entries(lanternMats)) mat.emissiveIntensity = .05 + 1.5 * alive(area);
    for (const im of ims) {
      const {list, kind} = im.userData;
      for (let i = 0; i < list.length; i++) {
        const s = list[i], a = alive(s.area);
        if (kind === 'pennant') {
          // hang straight when frozen; flutter out along the wind (+x-ish) when alive
          const yaw = Math.atan2(s.dir.x, s.dir.z) + Math.PI / 2;
          const lift = a * (.9 + .35 * Math.sin(t * 7 + s.ph));
          e.set(lift, yaw, 0, 'YXZ'); tq.setFromEuler(e);
          m.compose(s.p, tq, sc.setScalar(1));
        } else if (kind === 'cloth') {
          const yaw = Math.atan2(s.dir.x, s.dir.z) + Math.PI / 2;
          const sway = a * (.35 + .25 * Math.sin(t * 3.1 + s.ph)) + .03 * Math.sin(t * .7 + s.ph);
          e.set(sway, yaw, 0, 'YXZ'); tq.setFromEuler(e);
          m.compose(s.p, tq, sc.set(s.w, s.h, 1));
        } else if (kind === 'pinwheel') {
          s.ang = (s.ang || s.ph) + dt * a * 9;
          tq.setFromAxisAngle(up, s.yaw); tq2.setFromAxisAngle(ax, s.ang); tq.multiply(tq2);
          m.compose(s.p, tq, sc.setScalar(s.s));
        } else if (kind === 'flag') {
          const yaw = .6 + a * .25 * Math.sin(t * 2.3 + s.ph);
          const droop = (1 - a) * 1.25;
          e.set(0, yaw, -droop, 'YXZ'); tq.setFromEuler(e);
          m.compose(s.p, tq, sc.set(s.s, s.s * (1 + .08 * a * Math.sin(t * 9 + s.ph)), 1));
        }
        im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    void tmpM;
  };

  function mergeTwo(a, b) { return mergeMany([a, b]); }
  function mergeMany(list) {
    const pos = [], nor = [];
    for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); return g;
  }
  return api;
}
