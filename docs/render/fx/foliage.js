/**
 * Foliage mass normals (no world edits). World clumps are many small lobes split across leaf/leafLight/leafShade
 * meshes, so a clump cannot be recovered per mesh. Instead every foliage vertex gets the direction from the local
 * centroid of ALL foliage vertices around it (a density-field gradient on a world grid): lobes of one crown share one
 * smooth, spherical-ish normal → one soft two-tone light across the whole mass. The lobe's own normal is kept only as
 * 'aCrease' (1 - dot(lobe, mass)): crevices between lobes get the cool inner shadow and leaf pattern in toon.js.
 * The mesh's 'normal' attribute is replaced in place (a blend, mostly mass); cost is one pass at load.
 */
export function prepareFoliage(THREE, meshes, { cell = .9, reach = 2, blend = .82 } = {}) {
  const t0 = performance.now();
  const sums = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  const world = [], v = new THREE.Vector3();
  // pass 1: accumulate world-space positions into grid cells
  for (const m of meshes) {
    m.updateMatrixWorld(true);
    const p = m.geometry.attributes.position, wp = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z;
      const k = key(Math.floor(v.x / cell), Math.floor(v.y / cell), Math.floor(v.z / cell));
      let s = sums.get(k); if (!s) { s = [0, 0, 0, 0]; sums.set(k, s); }
      s[0] += v.x; s[1] += v.y; s[2] += v.z; s[3]++;
    }
    world.push(wp);
  }
  // pass 2: per vertex, centroid of the neighbourhood → mass normal (back to object space), crease from the lobe normal
  const inv = new THREE.Matrix3(), n = new THREE.Vector3(), mn = new THREE.Vector3();
  meshes.forEach((m, mi) => {
    const g = m.geometry, p = g.attributes.position, N = g.attributes.normal, wp = world[mi];
    if (!N) g.computeVertexNormals();
    const normal = g.attributes.normal, crease = new Float32Array(p.count);
    const toObj = inv.getNormalMatrix(new THREE.Matrix4().copy(m.matrixWorld).invert()), toWorld = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    const cache = new Map();
    for (let i = 0; i < p.count; i++) {
      const x = wp[i * 3], y = wp[i * 3 + 1], z = wp[i * 3 + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      const ck = key(cx, cy, cz); let c = cache.get(ck);
      if (!c) {
        let sx = 0, sy = 0, sz = 0, sn = 0;
        for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) for (let d = -reach; d <= reach; d++) {
          const s = sums.get(key(cx + a, cy + b, cz + d)); if (s) { sx += s[0]; sy += s[1]; sz += s[2]; sn += s[3]; }
        }
        c = [sx / sn, sy / sn, sz / sn]; cache.set(ck, c);
      }
      mn.set(x - c[0], y - c[1], z - c[2]);
      if (mn.lengthSq() < 1e-6) mn.set(0, 1, 0);
      mn.normalize();
      n.fromBufferAttribute(normal, i).applyMatrix3(toWorld).normalize();
      crease[i] = Math.max(0, Math.min(1, 1 - n.dot(mn)));
      n.lerp(mn, blend).normalize().applyMatrix3(toObj).normalize();
      normal.setXYZ(i, n.x, n.y, n.z);
    }
    normal.needsUpdate = true;
    g.setAttribute('aCrease', new THREE.BufferAttribute(crease, 1));
    m.userData.lookFoliage = true;
  });
  return { meshes: meshes.length, ms: Math.round(performance.now() - t0) };
}
