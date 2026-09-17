// Phase-aware blending of the retained CC0 clips. No geometry or character styling.
export function createMotionBlend(T, source, clips, nominal) {
  const mixer = new T.AnimationMixer(source), actions = new Map(), weights = new Map();
  for (const json of clips) {
    const action = mixer.clipAction(T.AnimationClip.parse(json));
    actions.set(json.name, action); weights.set(json.name, 0);
  }
  let current = null, response = 16;
  function play(name, {once = false, rate = 1} = {}) {
    const action = actions.get(name);
    if (!action) return;
    if (action === current) {action.userData = {rate}; return;}
    const previous = current;
    const phase = previous && nominal[previous.getClip().name] && nominal[name]
      ? previous.time / previous.getClip().duration : 0;
    action.reset().setLoop(once ? T.LoopOnce : T.LoopRepeat, once ? 1 : Infinity);
    action.time = phase * action.getClip().duration;
    action.clampWhenFinished = once;
    action.userData = {rate};
    action.setEffectiveWeight(weights.get(name)).play();
    current = action;
    if(name==='Jump_Land') actions.get('Idle_Loop')?.play();
    response = name.startsWith('Jump') ? 35 : name === 'Idle_Loop' ? 18 : 16;
    if (!previous) weights.set(name, 1);
  }
  function update(dt, speed) {
    const blend = 1 - Math.exp(-response * dt);
    let total = 0;
    for (const [name, action] of actions) {
      const weight = weights.get(name) + ((action === current ? (current.getClip().name==='Jump_Land'?.78:1) : name==='Idle_Loop'&&current?.getClip().name==='Jump_Land'?.22:0) - weights.get(name)) * blend;
      weights.set(name, weight); total += weight;
    }
    for (const [name, action] of actions) {
      const weight = weights.get(name) / Math.max(total, 1e-9);
      action.setEffectiveWeight(weight);
      action.setEffectiveTimeScale(speed !== undefined && nominal[name]
        ? Math.max(.15, Math.min(2, speed / nominal[name])) : action.userData?.rate || 1);
      if (weight < .0001 && action !== current) action.stop();
    }
    mixer.update(dt);
  }
  function reset() {
    mixer.stopAllAction(); current = null;
    for (const name of weights.keys()) weights.set(name, 0);
    play('Idle_Loop');
  }
  return {play, update, reset, get clip() {return current?.getClip().name;},
    get state() {return {clip: current?.getClip().name, phase: current ? current.time / current.getClip().duration : 0,
      weights: Object.fromEntries([...actions].map(([name,a]) => [name,a.getEffectiveWeight()]))};}};
}
