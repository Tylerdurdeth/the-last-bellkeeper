/** A single painted water surface. Standard lighting retains fog, shadows and output transforms. */
export function createBrook(T, waterMesh) {
  if (!waterMesh?.isMesh) return { update() {} };
  const clock = { value: 0 }, motion = { value: 1 };
  const water = new T.MeshStandardMaterial({
    name: 'water', color: 0x3d9da5, roughness: .47, metalness: .04,
    emissive: 0x164c58, emissiveIntensity: .18, side: T.DoubleSide
  });
  water.onBeforeCompile = shader => {
    shader.uniforms.bkBrookTime = clock;
    shader.uniforms.bkBrookMotion = motion;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec2 vBkBrookUV;\nattribute float bankDistance;\nvarying float vBankDistance;\nuniform float bkBrookTime;\nuniform float bkBrookMotion;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvBkBrookUV = uv;\nvBankDistance = bankDistance;\nfloat bkFlow = bkBrookTime * bkBrookMotion;\ntransformed.y += sin(uv.x * 1.36 - bkFlow * 3.8 + sin(uv.y * 2.8)) * 0.032;\ntransformed.y += sin(uv.x * 3.25 - bkFlow * 6.2 + uv.y * 4.2) * 0.008;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec2 vBkBrookUV;\nvarying float vBankDistance;\nuniform float bkBrookTime;\nuniform float bkBrookMotion;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      // Long drifting strokes travel along the brook, never screen-space grain.
      float t = bkBrookTime * bkBrookMotion;
      // Asset UVs are world metres, continuous around every side of the island.
      vec2 p = vBkBrookUV;
      float bend = sin(p.x * .55 - t * 1.15) * .16 + sin(p.x * 1.3 - t * 1.8) * .035;
      float ribbons = sin((p.y + bend) * 9.0 - t * .55);
      float brokenStroke = smoothstep(.12, .72, sin(p.x * 2.2 - t * 2.1 + sin(p.y * 3.)));
      float streak = smoothstep(.72, .98, ribbons) * brokenStroke;
      float broad = .5 + .5 * sin(p.y * 2.6 + sin(p.x * .34 - t * .75) * .6);
      vec3 painted = mix(vec3(.035,.20,.25), vec3(.10,.46,.48), broad);
      painted = mix(painted, vec3(.52,.83,.78), streak * .80);
      // Interrupted pale banks establish contact; no continuous rectangular border.
      // Distances are baked from the exact authored shoreline vertices.
      float edge = 1. - smoothstep(.025,.13 + .03 * sin(p.x * 1.6 - t * .5),vBankDistance);
      float foam = edge * smoothstep(-.45,.65,sin(p.x * 2.4 - t * 1.1));
      diffuseColor.rgb = mix(painted, vec3(.65,.88,.82),foam * .85);
    `);
  };
  water.customProgramCacheKey = () => 'bellkeeper-brook-organic-v3';
  waterMesh.material = water;
  waterMesh.receiveShadow = true;
  waterMesh.castShadow = false;
  return { update(time, gentle = false) {
    clock.value = Number.isFinite(time) ? time : 0;
    motion.value = gentle ? .22 : 1;
  } };
}
