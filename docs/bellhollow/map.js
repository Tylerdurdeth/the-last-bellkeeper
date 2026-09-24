// Bellhollow chart: an illustrated, multi-level parchment map baked from the real world, with fog of war,
// painted landmark pictograms, the objective, a camera-aligned player arrow, compass, level tabs and an
// elevation strip. Draws into the HUD's #map canvas (main owns show/tuck/expand; see wiring notes).
//
//   const map = createMap({THREE, renderer, scene, world, canvas, look, hide:[hero, mara, guardian.object]});
//   map.bake();                               // once after the world + look are ready (~one frame; <150 ms)
//   map.update(dt, {hero, heroYaw, camYaw, objective, progress, fragments});   // each HUD tick
//   map.draw();                               // when the chart is visible
//   map.setExpanded(bool); map.serialize() / map.restore(data); map.telemetry()
//
// Bake: for each level (terrace / loft & branches / Hollow & well) an orthographic top-down camera renders a
// height slice of the live scene (near/far planes do the slicing, so no material recompiles) into a render
// target with depth; a stylise pass turns it into a watercolour wash on paper with ink edges (colour + ledge
// height edges). On low tiers (or failure) it falls back to a vector chart sampled from world.ground().
const TAU = Math.PI * 2;
export const MAP_LEVELS = [
  { id: 'terrace', name: 'Canopy Terrace', short: 'Terrace', y0: -2.6, y1: 3.2, tint: [0.93, 0.80, 0.55] },
  { id: 'branches', name: 'Loft & Branches', short: 'Branches', y0: 3.0, y1: 24, tint: [0.72, 0.82, 0.55] },
  { id: 'hollow', name: 'The Hollow & Well', short: 'Hollow', y0: -18, y1: 7.6, tint: [0.62, 0.78, 0.76], clipR: 14 },
];
const ZONE_NAMES = { terrace: 'Canopy Terrace', loft: 'The Lantern Loft', sails: 'Mill of Sails', pipes: 'Mill of Pipes', ladders: 'Mill of Ladders', skybridge: 'The Sky Bridge', hollow: 'The Hollow', well: 'The Guardian Well' };
const INK = '#2A1E1C', PAPER = '#F1E4C4', PAPER_D = '#E2CFA3', CORAL = '#D96956', GOLD = '#E9B949', VERD = '#3E9C8C', COPPER = '#B8733F', TIMBER = '#7A4E33', WIND = '#8FD3E0';

export function createMap({ THREE: T, renderer, scene, world, canvas, look = null, hide = [], size = 896, lowTier = null, fogCells = 80, revealRadius = 14 } = {}) {
  const ctx = canvas.getContext('2d');
  const pts = world.points || {};
  // ---- world bounds from every anchor we know (square, padded) ----
  const all = []; const collect = (o, d = 0) => { if (!o || d > 3) return; if (Number.isFinite(o.x) && Number.isFinite(o.z)) all.push(o); else if (typeof o === 'object') for (const v of Object.values(o)) collect(v, d + 1); };
  collect(pts); for (const v of world.vents || []) all.push(v);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of all) { if (Math.hypot(p.x, p.z) > 70 || p.y > 40 || p.y < -30) continue; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  if (!Number.isFinite(minX)) { minX = minZ = -45; maxX = maxZ = 45; }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, half = Math.max(maxX - minX, maxZ - minZ) / 2 + 8;
  const B = { x0: cx - half, z0: cz - half, L: half * 2 };
  const levelIndex = a => a === 'hollow' || a === 'well' ? 2 : a === 'branches' || a === 'loft' || a === 'sails' || a === 'pipes' || a === 'ladders' || a === 'skybridge' ? 1 : 0;
  const areaOf = p => world.area?.(p) || (p.y < -1 ? 'hollow' : p.y > 3.5 ? 'branches' : 'terrace');
  const levelOf = p => levelIndex(areaOf(p));
  const zoneOf = p => world.zones?.find?.(z => z.test?.(p.x, p.y, p.z))?.id || null;

  // ---- state ----
  const fog = MAP_LEVELS.map(() => new Uint8Array(fogCells * fogCells));
  const fogCanvas = MAP_LEVELS.map(() => { const c = document.createElement('canvas'); c.width = c.height = fogCells; return c; });
  let fogDirty = [true, true, true];
  const levelImg = [null, null, null];
  let baked = false, bakeMs = 0, mode = 'none', expanded = false, manualLevel = null, lastAutoLevel = 0, time = 0;
  let view = { hero: null, heroYaw: 0, camYaw: 0, objective: null, progress: {}, fragments: [] };
  let tabs = [];

  // ---------------- bake ----------------
  function bake() {
    const t0 = performance.now();
    const tier = lowTier ?? (look?.tier === 'min');
    try { if (!tier && renderer && scene) { bakeGPU(); mode = 'painted'; } else { bakeVector(); mode = 'vector'; } }
    catch (e) { console.warn('[map] painted bake failed; vector chart', e); bakeVector(); mode = 'vector'; }
    baked = true; bakeMs = performance.now() - t0; return bakeMs;
  }
  function bakeGPU() {
    const S = size, dt = new T.DepthTexture(S, S); dt.type = T.UnsignedIntType;
    const rt = new T.WebGLRenderTarget(S, S, { type: T.HalfFloatType, depthTexture: dt, samples: 0 });
    const out = new T.WebGLRenderTarget(S, S, { type: T.UnsignedByteType });
    const H = 400, cam = new T.OrthographicCamera(-half, half, half, -half, 1, 1000);
    cam.position.set(cx, H, cz); cam.up.set(0, 0, -1); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld(true);
    const mat = new T.ShaderMaterial({
      uniforms: { tColor: { value: rt.texture }, tDepth: { value: dt }, uTexel: { value: new T.Vector2(1 / S, 1 / S) }, uY0: { value: 0 }, uY1: { value: 1 },
        uTint: { value: new T.Vector3() }, uClipR: { value: 0 }, uB: { value: new T.Vector3(B.x0, B.z0, B.L) }, uSeed: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tColor, tDepth; uniform vec2 uTexel; uniform float uY0,uY1,uClipR,uSeed; uniform vec3 uTint,uB;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y); }
        vec3 tone(vec3 c){ c=max(c,0.)*1.7; c=c/(1.+c)*1.35; return pow(clamp(c,0.,1.),vec3(1./2.2)); }
        float hgt(vec2 uv){ float d=texture2D(tDepth,uv).r; return uY1-d*(uY1-uY0); }
        float lum(vec2 uv){ return dot(tone(texture2D(tColor,uv).rgb),vec3(.3,.59,.11)); }
        void main(){
          vec4 s=texture2D(tColor,vUv); float a=s.a>0.001?1.:0.;
          vec2 w=vec2(uB.x+vUv.x*uB.z, uB.y+(1.-vUv.y)*uB.z);                       // world x,z (image top = north = -z)
          if(uClipR>0. && length(w)>uClipR) a=0.;
          vec3 c=tone(s.rgb); float l=dot(c,vec3(.3,.59,.11)); float h=hgt(vUv);
          // watercolour wash: desaturate, lift, tint by level, soft 4-step value banding, pigment mottling
          vec3 wash=mix(c*vec3(1.1,1.0,.82),uTint*(.5+.75*l),.5); wash*=vec3(1.04,1.0,.94);
          float band=floor(l*4.+.5)/4.; wash*=mix(1.,.85+.3*band,.5);
          float m=noise(w*.9)*.6+noise(w*3.1)*.4; wash*=.9+.16*m;
          wash*=.78+.22*clamp((h-uY0)/max(1.,uY1-uY0)*1.6,0.,1.);                   // lower floors read a touch deeper
          // ink: colour edges + ledge (height) edges + silhouette edges
          vec2 e=uTexel*1.9; float le=0.,he=0.,ae=0.;
          for(int i=0;i<4;i++){ vec2 o=i==0?vec2(e.x,0.):i==1?vec2(-e.x,0.):i==2?vec2(0.,e.y):vec2(0.,-e.y);
            vec2 q=vUv+o; float aq=texture2D(tColor,q).a>0.001?1.:0.; vec2 wq=vec2(uB.x+q.x*uB.z,uB.y+(1.-q.y)*uB.z); if(uClipR>0.&&length(wq)>uClipR) aq=0.;
            ae=max(ae,abs(aq-a)); if(aq*a>0.){ le=max(le,abs(lum(q)-l)); he=max(he,abs(hgt(q)-h)); } }
          float ink=smoothstep(.05,.15,le)*.75+smoothstep(.2,.5,he)*1.1+ae*1.2;
          ink*=.75+.25*noise(w*6.);
          vec3 inkC=vec3(.165,.118,.110);
          vec3 col=mix(wash,inkC,clamp(ink,0.,1.)*.95);
          gl_FragColor=vec4(col,max(a,clamp(ae,0.,1.)));
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    const qScene = new T.Scene(); qScene.add(quad);
    const qCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // Temporarily strip what should not be on a chart: sky, wind ribbons, characters, fx; no fog.
    const hidden = [], hideSet = new Set(hide.filter(Boolean));
    scene.traverse(o => {
      if (!o.visible) return;
      let drop = hideSet.has(o) || /sky|wind|lane-bands|guardian|hero|mara/i.test(o.name || '');
      if (!drop && o.isMesh && o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere?.radius || 0; drop = r * Math.max(o.scale.x, o.scale.y, o.scale.z) > 400 || o.frustumCulled === false && r > 60; }
      if (drop) { hidden.push(o); o.visible = false; }
    });
    const prev = { target: renderer.getRenderTarget(), clear: renderer.getClearColor(new T.Color()), alpha: renderer.getClearAlpha(), bg: scene.background, fogD: scene.fog?.density, fogFar: scene.fog?.far, auto: renderer.info.autoReset, shadow: renderer.shadowMap.autoUpdate };
    // No cast shadows on a chart (the canopy would shade the terrace grey); shadow.intensity avoids recompiles.
    const shadowed = []; scene.traverse(o => { if (o.isLight && o.shadow && 'intensity' in o.shadow) { shadowed.push([o, o.shadow.intensity]); o.shadow.intensity = 0; } });
    scene.background = null; if (scene.fog) { if ('density' in scene.fog) scene.fog.density = 0; else scene.fog.far = 1e6; }
    renderer.info.autoReset = false;
    const buf = new Uint8Array(S * S * 4);
    try {
      MAP_LEVELS.forEach((lv, i) => {
        cam.near = H - lv.y1; cam.far = H - lv.y0; cam.updateProjectionMatrix();
        renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
        const U = mat.uniforms; U.uY0.value = lv.y0; U.uY1.value = lv.y1; U.uTint.value.set(...lv.tint); U.uClipR.value = lv.clipR || 0; U.uSeed.value = i * 7.1;
        renderer.setRenderTarget(out); renderer.clear(); renderer.render(qScene, qCam);
        renderer.readRenderTargetPixels(out, 0, 0, S, S, buf);
        const c = document.createElement('canvas'); c.width = c.height = S; const cx2 = c.getContext('2d'), img = cx2.createImageData(S, S);
        for (let y = 0; y < S; y++) img.data.set(buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);   // GL rows are bottom-up
        cx2.putImageData(img, 0, 0); levelImg[i] = c;
      });
    } finally {
      renderer.setRenderTarget(prev.target); renderer.setClearColor(prev.clear, prev.alpha); scene.background = prev.bg;
      if (scene.fog) { if ('density' in scene.fog) scene.fog.density = prev.fogD; else scene.fog.far = prev.fogFar; }
      renderer.info.autoReset = prev.auto; hidden.forEach(o => o.visible = true); shadowed.forEach(([o, v]) => o.shadow.intensity = v);
      rt.dispose(); out.dispose(); dt.dispose(); mat.dispose(); quad.geometry.dispose();
    }
  }
  // Vector fallback: floors sampled from world.ground per level, painted as soft washes with ink outlines.
  function bakeVector() {
    const S = 384, G = 120, cell = B.L / G;
    MAP_LEVELS.forEach((lv, i) => {
      const occ = new Uint8Array(G * G);
      for (let gz = 0; gz < G; gz++) for (let gx = 0; gx < G; gx++) {
        const x = B.x0 + (gx + .5) * cell, z = B.z0 + (gz + .5) * cell;
        if (lv.clipR && Math.hypot(x, z) > lv.clipR) continue;
        const g = world.ground?.(x, z, lv.y1); if (typeof g === 'number' && g >= lv.y0 && g <= lv.y1) occ[gz * G + gx] = 1 + Math.min(3, Math.floor((g - lv.y0) / Math.max(1, (lv.y1 - lv.y0) / 4)));
      }
      const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), k = S / G;
      const [r, gg, b] = lv.tint.map(v => Math.round(v * 255));
      for (let gz = 0; gz < G; gz++) for (let gx = 0; gx < G; gx++) { const o = occ[gz * G + gx]; if (!o) continue; const s = .8 + o * .06; g.fillStyle = `rgba(${r * s | 0},${gg * s | 0},${b * s | 0},.9)`; g.fillRect(gx * k, gz * k, k + .6, k + .6); }
      g.strokeStyle = 'rgba(42,30,28,.8)'; g.lineWidth = 1.6; g.beginPath();
      for (let gz = 0; gz < G; gz++) for (let gx = 0; gx < G; gx++) { const o = occ[gz * G + gx]; if (!o) continue;
        if (!occ[gz * G + gx + 1] || gx === G - 1) { g.moveTo((gx + 1) * k, gz * k); g.lineTo((gx + 1) * k, (gz + 1) * k); }
        if (!occ[gz * G + gx - 1] || gx === 0) { g.moveTo(gx * k, gz * k); g.lineTo(gx * k, (gz + 1) * k); }
        if (!occ[(gz + 1) * G + gx] || gz === G - 1) { g.moveTo(gx * k, (gz + 1) * k); g.lineTo((gx + 1) * k, (gz + 1) * k); }
        if (!occ[(gz - 1) * G + gx] || gz === 0) { g.moveTo(gx * k, gz * k); g.lineTo((gx + 1) * k, gz * k); } }
      g.stroke(); levelImg[i] = c;
    });
  }

  // ---------------- fog of war ----------------
  const cellOf = (x, z) => [Math.floor((x - B.x0) / B.L * fogCells), Math.floor((z - B.z0) / B.L * fogCells)];
  const revealedAt = (lvl, p) => { const [gx, gz] = cellOf(p.x, p.z); return gx >= 0 && gz >= 0 && gx < fogCells && gz < fogCells && fog[lvl][gz * fogCells + gx] > 0; };
  function reveal(lvl, p, r = revealRadius) {
    const cs = B.L / fogCells, [hx, hz] = cellOf(p.x, p.z), n = Math.ceil(r / cs);
    for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
      const gx = hx + dx, gz = hz + dz; if (gx < 0 || gz < 0 || gx >= fogCells || gz >= fogCells) continue;
      const d = Math.hypot(dx, dz) * cs; if (d > r) continue;
      const i = gz * fogCells + gx, v = d < r * .7 ? 255 : Math.round(255 * (1 - (d - r * .7) / (r * .3)));
      if (v > fog[lvl][i]) { fog[lvl][i] = v; fogDirty[lvl] = true; }
    }
  }
  function refreshFog(lvl) {
    if (!fogDirty[lvl]) return; fogDirty[lvl] = false;
    const c = fogCanvas[lvl], g = c.getContext('2d'), img = g.createImageData(fogCells, fogCells), f = fog[lvl];
    for (let i = 0; i < f.length; i++) { const a = 255 - f[i]; img.data[i * 4] = 236; img.data[i * 4 + 1] = 223; img.data[i * 4 + 2] = 190; img.data[i * 4 + 3] = Math.round(a * .8); }
    g.putImageData(img, 0, 0);
  }

  // ---------------- landmarks ----------------
  function landmarks() {
    const P = pts, pr = view.progress || {}, L = [];
    const add = (p, kind, label, extra = {}) => { if (p && Number.isFinite(p.x)) L.push({ p, kind, label, lvl: levelOf(p), ...extra }); };
    add(P.mara || P.maraStand, 'house', 'Mara’s workshop');
    add(P.morningBell, 'bell', 'Morning bell', { lit: pr.complete });
    add(P.seedWheel, 'wheel', 'Seed wheel', { on: pr.seed });
    add(P.loft, 'loft', 'Lantern loft');
    for (const [k, id, name] of [['millSails', 'sails', 'Mill of Sails'], ['millPipes', 'pipes', 'Mill of Pipes'], ['millLadders', 'ladders', 'Mill of Ladders']]) add(P[k], 'mill', name, { on: !!pr[id] });
    const mills = ['sails', 'pipes', 'ladders'].filter(k => pr[k]).length;
    add(P.skyBridge, 'bridge', 'Sky Bridge', { planks: mills });
    add(P.hollowGate, 'gate', 'Hollow gate', { on: !!pr.skyBridge });
    add(P.carvingOut, 'carving', 'Carving', { on: !!pr.carvingOut }); add(P.carvingReturn, 'carving', 'Carving', { on: !!pr.carvingReturn });
    add(P.arena, 'well', 'Guardian well', { on: !!pr.guardian });
    add(P.pairedOut || P.bellOut, 'bells', 'Paired bells', { on: !!pr.bellReturn });
    for (const v of world.vents || []) add(v, 'grille', null, { r: v.radius || 1 });
    const got = new Set(view.fragments || []);
    for (const k of ['fragment1', 'fragment2', 'fragment3']) if (P[k] && !got.has(k)) add(P[k], 'fragment', null);
    return L;
  }
  // Pictograms, drawn upright in screen space. s = icon size in canvas px.
  function icon(g, kind, x, y, s, o = {}) {
    g.save(); g.translate(x, y); g.lineJoin = g.lineCap = 'round'; g.lineWidth = Math.max(1.5, s * .1); g.strokeStyle = INK;
    const fillStroke = f => { g.fillStyle = f; g.fill(); g.stroke(); };
    // soft paper halo so icons read on any wash
    g.beginPath(); g.arc(0, 0, s * .72, 0, TAU); g.fillStyle = 'rgba(241,228,196,.78)'; g.fill();
    if (kind === 'bell' || kind === 'bells') {
      const one = (dx, sc, col) => { g.beginPath(); g.moveTo(dx - s * .32 * sc, s * .28 * sc); g.quadraticCurveTo(dx - s * .3 * sc, -s * .34 * sc, dx, -s * .36 * sc); g.quadraticCurveTo(dx + s * .3 * sc, -s * .34 * sc, dx + s * .32 * sc, s * .28 * sc); g.closePath(); fillStroke(col); g.beginPath(); g.arc(dx, s * .34 * sc, s * .07 * sc, 0, TAU); fillStroke(COPPER); };
      if (kind === 'bells') { g.beginPath(); g.moveTo(-s * .5, -s * .42); g.quadraticCurveTo(0, -s * .62, s * .5, -s * .4); g.strokeStyle = TIMBER; g.stroke(); g.strokeStyle = INK; one(-s * .2, .8, VERD); one(s * .26, .6, o.on ? GOLD : COPPER); }
      else one(0, 1, o.lit ? GOLD : COPPER);
    } else if (kind === 'mill') {
      g.beginPath(); g.moveTo(-s * .18, s * .5); g.lineTo(-s * .1, -s * .1); g.lineTo(s * .1, -s * .1); g.lineTo(s * .18, s * .5); g.closePath(); fillStroke('#F2E6C9');
      g.translate(0, -s * .12); const a = o.on ? time * 2.2 : .35;
      for (let i = 0; i < 4; i++) { g.save(); g.rotate(a + i * TAU / 4); g.beginPath(); g.moveTo(-s * .07, -s * .05); g.lineTo(-s * .09, -s * .55); g.lineTo(s * .09, -s * .55); g.lineTo(s * .05, -s * .05); g.closePath(); fillStroke(o.on ? CORAL : '#B9AE98'); g.restore(); }
      g.beginPath(); g.arc(0, 0, s * .08, 0, TAU); fillStroke(o.on ? GOLD : COPPER);
    } else if (kind === 'wheel') {
      g.beginPath(); g.arc(0, 0, s * .42, 0, TAU); fillStroke(o.on ? '#E8D8A8' : '#D8CBAE');
      const a = o.on ? time * 1.6 : 0; for (let i = 0; i < 6; i++) { const q = a + i * TAU / 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(q) * s * .42, Math.sin(q) * s * .42); g.stroke(); }
      g.beginPath(); g.arc(0, 0, s * .1, 0, TAU); fillStroke(COPPER);
    } else if (kind === 'house' || kind === 'loft') {
      g.beginPath(); g.rect(-s * .34, -s * .08, s * .68, s * .46); fillStroke('#F2E6C9');
      g.beginPath(); g.moveTo(-s * .44, -s * .06); g.lineTo(0, -s * .48); g.lineTo(s * .44, -s * .06); g.closePath(); fillStroke(kind === 'loft' ? TIMBER : CORAL);
      g.beginPath(); g.rect(-s * .08, s * .12, s * .16, s * .26); fillStroke(kind === 'loft' ? GOLD : TIMBER);
    } else if (kind === 'bridge') {
      for (let i = 0; i < 3; i++) { g.beginPath(); g.rect(-s * .5 + i * s * .34, -s * .12, s * .3, s * .24); fillStroke(i < (o.planks || 0) ? '#C8894A' : 'rgba(200,137,74,.15)'); }
      if ((o.planks || 0) < 3) { g.setLineDash([s * .08, s * .08]); g.beginPath(); g.moveTo(-s * .5, s * .22); g.lineTo(s * .5, s * .22); g.stroke(); g.setLineDash([]); }
    } else if (kind === 'gate') {
      g.beginPath(); g.moveTo(-s * .38, s * .42); g.lineTo(-s * .38, -s * .06); g.arc(0, -s * .06, s * .38, Math.PI, 0); g.lineTo(s * .38, s * .42); g.closePath(); fillStroke('#CDBB95');
      g.beginPath(); g.moveTo(-s * .2, s * .42); g.lineTo(-s * .2, 0); g.arc(0, 0, s * .2, Math.PI, 0); g.lineTo(s * .2, s * .42); g.closePath(); fillStroke(o.on ? '#2C4A45' : TIMBER);
    } else if (kind === 'carving') {
      g.beginPath(); g.rect(-s * .3, -s * .4, s * .6, s * .8); fillStroke('#E8DCC0');
      g.beginPath(); g.moveTo(-s * .16, s * .15); g.quadraticCurveTo(0, -s * .3, s * .16, s * .15); g.strokeStyle = o.on ? VERD : TIMBER; g.stroke();
    } else if (kind === 'well') {
      for (const [r, c] of [[.48, '#CDBB95'], [.33, '#E0D2B0'], [.18, '#2C4A45']]) { g.beginPath(); g.arc(0, 0, s * r, 0, TAU); fillStroke(c); }
      g.beginPath(); for (let i = 0; i < 5; i++) { const q = i * TAU / 5 - Math.PI / 2; g.lineTo(Math.cos(q) * s * .12, Math.sin(q) * s * .12); } g.closePath(); g.fillStyle = o.on ? GOLD : CORAL; g.fill();
    } else if (kind === 'grille') {
      g.beginPath(); g.arc(0, 0, s * .36, 0, TAU); fillStroke(VERD);
      g.strokeStyle = '#F2E6C9'; g.lineWidth = Math.max(1, s * .06); for (const k of [-.18, 0, .18]) { g.beginPath(); g.moveTo(-s * .28, k * s); g.lineTo(s * .28, k * s); g.stroke(); }
      g.strokeStyle = COPPER; g.lineWidth = Math.max(1.2, s * .08); g.beginPath(); g.arc(0, 0, s * .36, 0, TAU); g.stroke();
    } else if (kind === 'fragment') {
      const k = .45 + .35 * Math.sin(time * 3.1 + x * .01);
      g.globalAlpha = k; g.font = `700 ${Math.round(s * .9)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = COPPER; g.fillText('?', 0, s * .04);
      for (let i = 0; i < 3; i++) { const q = time * 1.3 + i * 2.1; g.beginPath(); g.arc(Math.cos(q) * s * .45, Math.sin(q) * s * .45, s * .05, 0, TAU); g.fillStyle = GOLD; g.fill(); }
    }
    g.restore();
  }

  // First look is inviting: the workshop yard and the start are already sketched in.
  for (const p of [pts.mara || pts.maraStand, pts.start, pts.morningBell]) if (p) reveal(levelOf(p), p, 20);
  // ---------------- per tick ----------------
  function update(dt = 0, o = {}) {
    time += dt || 0;
    Object.assign(view, o);
    const h = view.hero; if (!h) return;
    const lvl = levelOf(h); if (lvl !== lastAutoLevel) { lastAutoLevel = lvl; manualLevel = null; }
    reveal(lvl, h);
  }
  function currentLevel() { return manualLevel ?? lastAutoLevel; }

  // ---------------- draw ----------------
  function draw() {
    if (!baked) bake();
    const W = canvas.width, H = canvas.height, g = ctx, h = view.hero || { x: cx, y: 0, z: cz };
    const css = canvas.getBoundingClientRect?.().width || W, u = Math.max(1, W / Math.max(60, css));  // canvas px per CSS px
    const lvl = currentLevel(), yaw = view.camYaw || 0;
    // Corner: a local view (~45 m) centred on the hero. Enlarged: the whole level, centred on its footprint.
    const metres = expanded ? B.L * .78 : 45, s = W / metres;
    const focus = expanded ? { x: cx, z: cz } : h;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), sy = Math.sin(yaw), cy = Math.cos(yaw);
    const ox = W / 2, oy = H * .54;
    const a = s * rx, c = s * rz, b = s * sy, d = s * cy, e = ox - (a * focus.x + c * focus.z), f = oy - (b * focus.x + d * focus.z);
    const toScreen = p => [a * p.x + c * p.z + e, b * p.x + d * p.z + f];
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    // paper
    const pg = g.createRadialGradient(W / 2, H / 2, W * .2, W / 2, H / 2, W * .8); pg.addColorStop(0, PAPER); pg.addColorStop(1, PAPER_D);
    g.fillStyle = pg; g.fillRect(0, 0, W, H);
    // chart (world transform)
    g.save(); g.setTransform(a, b, c, d, e, f); g.imageSmoothingEnabled = true;
    MAP_LEVELS.forEach((_, i) => { if (i === lvl || !levelImg[i]) return; if (lvl === 1 && i === 2 || lvl === 2 && i === 1) return; g.globalAlpha = .16; g.drawImage(levelImg[i], B.x0, B.z0, B.L, B.L); });
    g.globalAlpha = 1; if (levelImg[lvl]) g.drawImage(levelImg[lvl], B.x0, B.z0, B.L, B.L);
    refreshFog(lvl); g.drawImage(fogCanvas[lvl], B.x0, B.z0, B.L, B.L);
    g.fillStyle = 'rgba(236,223,190,.8)'; const F = 400, x1 = B.x0 + B.L, z1 = B.z0 + B.L;             // beyond the charted square: same fog
    g.fillRect(B.x0 - F, B.z0 - F, B.L + 2 * F, F); g.fillRect(B.x0 - F, z1, B.L + 2 * F, F); g.fillRect(B.x0 - F, B.z0, F, B.L); g.fillRect(x1, B.z0, F, B.L);
    // the great trunk as a ring (every level); the Hollow shows its inside
    g.lineWidth = 1.1; g.strokeStyle = 'rgba(122,78,51,.85)'; g.beginPath(); g.arc(0, 0, 9.4, 0, TAU); g.stroke();
    g.lineWidth = .45; g.setLineDash([.9, .7]); g.strokeStyle = 'rgba(42,30,28,.55)'; g.beginPath(); g.arc(0, 0, 10.4, 0, TAU); g.stroke(); g.setLineDash([]);
    g.restore();
    // landmarks (upright), only once their spot is discovered; other levels' landmarks are ghosted
    const small = !expanded && (canvas.getBoundingClientRect?.().width || 300) < 200, iconS = (small ? 25 : 17) * u, placed = [];
    const KEY = new Set(['house', 'mill', 'bridge', 'gate', 'well', 'bells', 'loft', 'wheel']);
    for (const m of landmarks()) {
      const seen = revealedAt(m.lvl, m.p); if (!seen) continue;
      const [x, y] = toScreen(m.p); if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      const other = m.lvl !== lvl; if (m.kind === 'fragment' && other) continue; if (small && (other || m.kind === 'carving' || m.kind === 'grille' && Math.hypot(m.p.x - h.x, m.p.z - h.z) > 12)) continue;
      g.globalAlpha = other ? .32 : 1;
      icon(g, m.kind, x, y, m.kind === 'grille' ? iconS * .75 : m.kind === 'mill' || m.kind === 'well' ? iconS * 1.25 : iconS, m);
      if (expanded && m.label && !other && KEY.has(m.kind)) {
        g.font = `600 ${Math.round(9.5 * u)}px Georgia, serif`; const tw = g.measureText(m.label).width, box = [x - tw / 2 - 2 * u, y + iconS * .62, tw + 4 * u, 12 * u];
        if (!placed.some(r => r[0] < box[0] + box[2] && box[0] < r[0] + r[2] && r[1] < box[1] + box[3] && box[1] < r[1] + r[3]) && Math.hypot(x - toScreen(h)[0], y - toScreen(h)[1]) > 18 * u) {
          placed.push(box); g.textAlign = 'center'; g.lineWidth = 3 * u; g.strokeStyle = 'rgba(241,228,196,.92)'; g.strokeText(m.label, x, y + iconS * 1.02); g.fillStyle = INK; g.fillText(m.label, x, y + iconS * 1.02); } }
      g.globalAlpha = 1;
    }
    // objective: pulsing ring, arrow when off the chart edge, up/down chevron when on another level
    const obj = view.objective;
    if (obj && Number.isFinite(obj.x)) {
      let [x, y] = toScreen(obj); const pad = 26 * u, inside = x > pad && y > pad + 18 * u && x < W - pad && y < H - pad - 16 * u;
      const k = .5 + .5 * Math.sin(time * 4);
      if (inside) { g.beginPath(); g.arc(x, y, (11 + k * 5) * u, 0, TAU); g.strokeStyle = CORAL; g.lineWidth = 3 * u; g.stroke(); g.beginPath(); g.arc(x, y, 4 * u, 0, TAU); g.fillStyle = CORAL; g.fill(); }
      else {
        const [px0, py0] = toScreen(h), ang = Math.atan2(y - py0, x - px0), t = Math.min(Math.abs((W / 2 - pad) / (Math.cos(ang) || 1e-6)), Math.abs((H * .4 - pad) / (Math.sin(ang) || 1e-6)));
        x = W / 2 + Math.cos(ang) * t; y = H * .54 + Math.sin(ang) * t;
        g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(12 * u, 0); g.lineTo(-7 * u, -8 * u); g.lineTo(-3 * u, 0); g.lineTo(-7 * u, 8 * u); g.closePath();
        g.fillStyle = CORAL; g.globalAlpha = .75 + .25 * k; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5 * u; g.stroke(); g.restore(); g.globalAlpha = 1;
      }
      const ol = levelOf(obj); if (ol !== lvl) { g.font = `700 ${Math.round(11 * u)}px system-ui`; g.textAlign = 'center'; g.fillStyle = CORAL; g.fillText(ol < lvl && !(ol === 0 && lvl === 2) || ol === 2 ? '▼' : '▲', x, y - 14 * u); }
    }
    // player arrow (facing, camera-relative)
    const hy = view.heroYaw || 0, fa = Math.atan2(Math.sin(hy) * rx + Math.cos(hy) * rz, -(Math.sin(hy) * sy + Math.cos(hy) * cy));
    const [hx, hy2] = toScreen(h); g.save(); g.translate(hx, hy2); g.rotate(fa); g.beginPath(); g.moveTo(0, -11 * u); g.lineTo(7.5 * u, 8 * u); g.lineTo(0, 4 * u); g.lineTo(-7.5 * u, 8 * u); g.closePath();
    g.fillStyle = CORAL; g.fill(); g.strokeStyle = '#FFF4DE'; g.lineWidth = 3.4 * u; g.stroke(); g.strokeStyle = INK; g.lineWidth = 1.4 * u; g.stroke(); g.restore();
    drawFrame(g, W, H, u, lvl, yaw, h);
  }
  function drawFrame(g, W, H, u, lvl, yaw, h) {
    // level tabs (top) — auto-switch by area; tappable when the chart is enlarged
    const tabH = 20 * u, tw = (W - 16 * u) / 3; tabs = [];
    g.fillStyle = 'rgba(42,30,28,.86)'; g.fillRect(0, 0, W, tabH + 8 * u);
    MAP_LEVELS.forEach((lv, i) => {
      const x = 8 * u + i * tw, y = 4 * u, on = i === lvl, disc = fog[i].some(v => v > 0);
      g.fillStyle = on ? '#F1E4C4' : 'rgba(241,228,196,.12)'; roundRect(g, x + 2 * u, y, tw - 4 * u, tabH, 5 * u); g.fill();
      g.font = `${on ? 700 : 500} ${Math.round(10 * u)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = on ? INK : disc ? '#F1E4C4' : 'rgba(241,228,196,.45)'; g.fillText(lv.short, x + tw / 2, y + tabH / 2 + .5 * u);
      tabs.push({ x, y, w: tw, h: tabH, i });
    });
    g.textBaseline = 'alphabetic';
    // elevation strip (left): Branches / Terrace / Hollow bands with the hero's height
    const sx = 6 * u, sw = 10 * u, sy0 = tabH + 18 * u, sh = Math.min(H * .42, 150 * u);
    const bands = [[1, 0, .38], [0, .38, .62], [2, .62, 1]];
    for (const [i, t0, t1] of bands) { g.fillStyle = i === lvl ? `rgba(${MAP_LEVELS[i].tint.map(v => v * 255 | 0).join(',')},.95)` : 'rgba(42,30,28,.18)'; roundRect(g, sx, sy0 + t0 * sh + 1.5 * u, sw, (t1 - t0) * sh - 3 * u, 3 * u); g.fill(); }
    g.strokeStyle = INK; g.lineWidth = 1 * u; roundRect(g, sx, sy0, sw, sh, 3 * u); g.stroke();
    const yy = h.y ?? 0, ty = yy >= 3 ? .38 * (1 - Math.min(1, (yy - 3) / 20)) : yy >= -2 ? .38 + .24 * (1 - (yy + 2) / 5) : .62 + .38 * Math.min(1, (-2 - yy) / 14);
    g.beginPath(); g.arc(sx + sw / 2, sy0 + ty * sh, 4.2 * u, 0, TAU); g.fillStyle = CORAL; g.fill(); g.strokeStyle = '#FFF4DE'; g.lineWidth = 1.6 * u; g.stroke();
    // compass rose (north = -z), turns with the camera
    const rX = W - 22 * u, rY = tabH + 26 * u, R = 12 * u, ang = yaw; // world north (-z) on screen
    g.save(); g.translate(rX, rY); g.beginPath(); g.arc(0, 0, R + 3 * u, 0, TAU); g.fillStyle = 'rgba(241,228,196,.85)'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1 * u; g.stroke(); g.rotate(ang);
    for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(0, -R); g.lineTo(3 * u, 0); g.lineTo(-3 * u, 0); g.closePath(); g.fillStyle = i ? '#CDBB95' : CORAL; g.fill(); g.stroke(); g.restore(); }
    g.font = `700 ${Math.round(8 * u)}px Georgia, serif`; g.textAlign = 'center'; g.fillStyle = INK; g.fillText('N', 0, -R - 4 * u); g.restore();
    // area name (bottom band)
    const zone = zoneOf(h), name = ZONE_NAMES[zone] || MAP_LEVELS[lvl].name;
    const bh = (expanded ? 44 : 22) * u;
    g.fillStyle = 'rgba(42,30,28,.86)'; g.fillRect(0, H - bh, W, bh);
    g.font = `600 ${Math.round(11 * u)}px Georgia, serif`; g.textAlign = 'left'; g.fillStyle = '#F1E4C4'; g.fillText(name, 10 * u, H - bh + 15 * u);
    if (expanded) { // legend
      const items = [['bell', 'bell'], ['mill', 'mill'], ['grille', 'updraft'], ['fragment', 'fragment']]; let x = 14 * u; const y = H - 13 * u;
      g.font = `500 ${Math.round(8.5 * u)}px system-ui`;
      for (const [k, t] of items) { icon(g, k, x, y, 11 * u, { on: true }); g.fillStyle = '#F1E4C4'; g.textAlign = 'left'; g.fillText(t, x + 9 * u, y + 3 * u); x += (g.measureText(t).width + 22 * u); }
      g.beginPath(); g.arc(x, y, 5 * u, 0, TAU); g.strokeStyle = CORAL; g.lineWidth = 2 * u; g.stroke(); g.fillStyle = '#F1E4C4'; g.fillText('goal', x + 9 * u, y + 3 * u);
    }
    // ink frame
    g.strokeStyle = INK; g.lineWidth = 2 * u; g.strokeRect(1 * u, 1 * u, W - 2 * u, H - 2 * u);
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  // Tabs are tappable while the chart is enlarged (main gives the canvas pointer events then).
  const onPointer = ev => { if (!expanded) return; const r = canvas.getBoundingClientRect(), x = (ev.clientX - r.left) * canvas.width / r.width, y = (ev.clientY - r.top) * canvas.height / r.height;
    const t = tabs.find(t => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h); if (t) { manualLevel = t.i === lastAutoLevel ? null : t.i; ev.preventDefault?.(); draw(); } };
  canvas.addEventListener?.('pointerdown', onPointer);

  // ---------------- save ----------------
  function pack(a) { const bits = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i] > 128) bits[i >> 3] |= 1 << (i & 7); let s = ''; for (const b of bits) s += String.fromCharCode(b); return btoa(s); }
  function unpack(str, a) { try { const s = atob(str); for (let i = 0; i < a.length; i++) a[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1 ? 255 : 0; } catch {} }
  return {
    bake, update, draw,
    setExpanded(b) { expanded = !!b; if (!expanded) manualLevel = null; },
    setLevel(i) { manualLevel = i == null ? null : Math.max(0, Math.min(2, i)); },
    serialize() { return { v: 1, n: fogCells, b: [B.x0, B.z0, B.L].map(v => +v.toFixed(2)), fog: fog.map(pack) }; },
    restore(s) { if (!s || s.v !== 1 || s.n !== fogCells) return false; s.fog?.forEach((str, i) => { if (fog[i]) { const t = new Uint8Array(fog[i].length); unpack(str, t); for (let k = 0; k < t.length; k++) fog[i][k] = Math.max(fog[i][k], t[k]); fogDirty[i] = true; } }); return true; },
    revealAll() { fog.forEach((f, i) => { f.fill(255); fogDirty[i] = true; }); },
    telemetry() { return { mode, bakeMs: +bakeMs.toFixed(1), level: MAP_LEVELS[currentLevel()].id, manual: manualLevel != null, bounds: B, discovered: fog.map(f => +(f.reduce((s, v) => s + (v > 128), 0) / f.length).toFixed(3)) }; },
    get levelImages() { return levelImg; },
    dispose() { canvas.removeEventListener?.('pointerdown', onPointer); },
  };
}
