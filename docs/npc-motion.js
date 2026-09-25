// NPC motion: CC0 Quaternius idle clips (assets/quaternius/npc-motion.json, animation tracks + rest transforms only)
// retargeted onto a procedural character whose userData.joints use the hero's joint names (same math as
// code-character.js). No meshes are loaded.
//   const data = await loadNpcMotion();  const drive = createNpcMotion(THREE, character, data, {clip, phase, rate});
//   drive(dt)   // advances the clip and writes joint rotations (call before any procedural overrides)
let dataPromise = null;
export function loadNpcMotion() {
  return dataPromise ??= fetch(new URL('./assets/quaternius/npc-motion.json', import.meta.url)).then(r => { if (!r.ok) throw Error('npc motion ' + r.status); return r.json(); });
}
export function createNpcMotion(T, character, data, { clip = 'Idle_Loop', phase = 0, rate = 1, bob = .7 } = {}) {
  const joints = character.userData.joints, source = new T.Group(), nodes = new Map();
  for (const n of data.nodes) { const o = new T.Object3D(); o.name = n.name; o.position.fromArray(n.position); o.quaternion.fromArray(n.quaternion); o.scale.fromArray(n.scale); nodes.set(n.name, o); }
  for (const n of data.nodes) (nodes.get(n.parent) || source).add(nodes.get(n.name));
  const map = { hips: 'pelvis', chest: 'spine_03', head: 'Head' };
  for (const [side, suffix] of [['left', 'r'], ['right', 'l']]) for (const [part, bone] of [['UpperArm', 'upperarm'], ['LowerArm', 'lowerarm'], ['Hand', 'hand'], ['UpperLeg', 'thigh'], ['LowerLeg', 'calf'], ['Foot', 'foot']]) map[side + part] = bone + '_' + suffix;
  // rest: character at identity, facing +Z
  const saved = { p: character.position.clone(), q: character.quaternion.clone() }; character.position.set(0, 0, 0); character.quaternion.identity(); character.userData.restPose?.();
  source.updateMatrixWorld(true); character.updateMatrixWorld(true);
  const links = Object.entries(map).filter(([d, s]) => joints[d] && nodes.get(s)).map(([d, s]) => ({ dst: joints[d], src: nodes.get(s) }));
  const depth = o => { let k = 0; while (o.parent) { k++; o = o.parent; } return k; }; links.sort((a, b) => depth(a.dst) - depth(b.dst));
  for (const l of links) {
    l.inverse = l.src.getWorldQuaternion(new T.Quaternion()).invert(); l.rest = l.dst.getWorldQuaternion(new T.Quaternion());
    if (/Arm|Hand/.test(l.dst.name)) { const child = l.src.children[0]; if (child) { const dir = child.getWorldPosition(new T.Vector3()).sub(l.src.getWorldPosition(new T.Vector3())).normalize(), down = new T.Vector3(0, -1, 0).applyQuaternion(l.rest); l.rest.premultiply(new T.Quaternion().setFromUnitVectors(down, dir)); } }
  }
  character.position.copy(saved.p); character.quaternion.copy(saved.q); character.updateMatrixWorld(true);
  const pelvis = nodes.get('pelvis'), pelvisRest = pelvis.position.clone(), hipRest = joints.hips.position.clone();
  const mixer = new T.AnimationMixer(source), json = data.clips.find(c => c.name === clip) || data.clips[0];
  const action = mixer.clipAction(T.AnimationClip.parse(json)); action.play(); action.time = phase * json.duration; action.timeScale = rate; mixer.update(0);
  const q = new T.Quaternion(), parent = new T.Quaternion(), world = new T.Quaternion(), rootQ = new T.Quaternion();
  return function drive(dt = 0) {
    mixer.update(dt); source.updateMatrixWorld(true); character.updateMatrixWorld(true); character.getWorldQuaternion(rootQ);
    for (const l of links) { l.src.getWorldQuaternion(q); world.copy(rootQ).multiply(q).multiply(l.inverse).multiply(l.rest); l.dst.parent.getWorldQuaternion(parent).invert(); l.dst.quaternion.copy(parent.multiply(world)); l.dst.updateMatrixWorld(true); }
    // pelvis delta from the Z-up armature to Y-up, scaled by leg length (keeps feet planted when the knees soften)
    const d = pelvis.position, k = hipRest.y / pelvisRest.z;
    joints.hips.position.set(hipRest.x + (d.x - pelvisRest.x) * k * bob, hipRest.y + (d.z - pelvisRest.z) * k, hipRest.z - (d.y - pelvisRest.y) * k * bob);
  };
}
