/** Shared painted light treatment. Keeps scene lights, real shadows and emissive state. */
// v2: game/render/look.js owns banding/shadow tint; it turns this module's cel ramp off so the two never stack.
let paintedCel = true;
export function setPaintedCel(on) { paintedCel = !!on; }
export function createArtDirection(T, renderer) {
  const cache = new WeakMap();
  const owned = new WeakSet();
  const windTime = { value: 0 };
  const windMotion = { value: 1 };
  const playerPosition={value:new T.Vector3(999,999,999)};
  const loader = new T.TextureLoader();let stoneResolve,stoneReject;const stoneReady=new Promise((r,j)=>{stoneResolve=r;stoneReject=j;});const stone=loader.load(new URL('./textures/stone.png',import.meta.url).href,stoneResolve,undefined,stoneReject);stone.colorSpace=T.SRGBColorSpace;stone.wrapS=stone.wrapT=T.RepeatWrapping;stone.anisotropy=4;
  let resolveTexture, rejectTexture;let barkResolve,barkReject;const barkReady=new Promise((r,j)=>{barkResolve=r;barkReject=j;});const bark=loader.load(new URL('./textures/bark.png',import.meta.url).href,barkResolve,undefined,barkReject);bark.colorSpace=T.SRGBColorSpace;bark.wrapS=bark.wrapT=T.RepeatWrapping;bark.anisotropy=4;
  const ready = new Promise((resolve, reject) => { resolveTexture = resolve; rejectTexture = reject; });
  const floor = loader.load(
    new URL('./textures/forest-floor.png', import.meta.url).href,
    () => resolveTexture(),
    undefined,
    () => rejectTexture(new Error('Could not load the painted forest floor texture.'))
  );
  floor.colorSpace = T.SRGBColorSpace;
  floor.wrapS = floor.wrapT = T.RepeatWrapping;
  floor.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  // World-scaled sampling below makes one painted tile span eleven metres.

  function material(source, character, terrain, vertexColors, wood=false) {
    if (!source || owned.has(source)) return source;
    const key = `${wood?'bark':character ? 'hero' : terrain ? 'ground' : 'scene'}:${vertexColors ? 1 : 0}`;
    let variants = cache.get(source);
    if (!variants) { variants = new Map(); cache.set(source, variants); }
    if (variants.has(key)) return variants.get(key);
    const m = source.clone();
    owned.add(m);
    variants.set(key, m);
    if (!m.isMeshStandardMaterial) return m;

    const metal = source.name === 'metal';
    const foliage = source.name === 'foliage';
    m.roughness = metal ? Math.max(.35, Math.min(.60, source.roughness ?? .46)) : .93;
    m.metalness = metal ? Math.max(.22, Math.min(.55, source.metalness ?? .32)) : 0;
    m.vertexColors = vertexColors || source.vertexColors;
    if (terrain) {
      m.map = floor;
      // Authored vertex colours carry the route design; the Atlas tile is surface detail.
      m.color.setRGB(1, 1, 1);
      m.roughness = 1;
      m.metalness = 0;
    }
    if(source.name==='stone')m.map=stone;
    if(wood&&source.name==='timber'){m.map=bark;m.color.setHex(0x8c7353);}
    const priorCompile = source.onBeforeCompile;
    m.onBeforeCompile = (shader, context) => {
      priorCompile?.call(m, shader, context);
      if (terrain) shader.uniforms.bkBankStone = { value: stone };
      shader.uniforms.bkPlayer = playerPosition;
      shader.uniforms.bkWindTime = windTime;
      shader.uniforms.bkWindMotion = windMotion;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBkWorld;\nuniform float bkWindTime;\nuniform float bkWindMotion;\nuniform vec3 bkPlayer;');
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
        vec4 bkWorldPosition = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          bkWorldPosition = batchingMatrix * bkWorldPosition;
        #endif
        #ifdef USE_INSTANCING
          bkWorldPosition = instanceMatrix * bkWorldPosition;
        #endif
        vBkWorld = (modelMatrix * bkWorldPosition).xyz;
        ${foliage ? `
          // Slow common gust direction, localized phase; trunks and architecture stay still.
          // Combined displacement is under .07m even with both oscillations aligned.
          float bkSway = sin(bkWindTime * 1.35 + vBkWorld.x * .42 + vBkWorld.z * .27) * .040
                       + sin(bkWindTime * 2.10 + vBkWorld.z * 1.13) * .014;
          float bkScale = max(length(modelMatrix[0].xyz), max(length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)));
          #ifdef USE_INSTANCING
            bkScale *= max(length(instanceMatrix[0].xyz), max(length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)));
          #endif
          transformed.x += bkSway * bkWindMotion / max(.001, bkScale);
          transformed.z += bkSway * .35 * bkWindMotion / max(.001, bkScale);
          vec2 bkAway=vBkWorld.xz-bkPlayer.xz;
          float bkPush=(1.-smoothstep(.15,1.25,length(bkAway)))*smoothstep(.03,.5,vBkWorld.y-bkPlayer.y)*(1.-smoothstep(1.4,2.,vBkWorld.y-bkPlayer.y));
          vec3 bkWorldPush=vec3(normalize(bkAway+vec2(.001))*.24*bkPush,0.).xzy;
          transformed += transpose(mat3(modelMatrix))*bkWorldPush / max(.001,bkScale*bkScale);

        ` : ''}
        #include <project_vertex>
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBkWorld;');
      if(wood){shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`
        // Continuous near-camera clearance covers motion between object ray checks.
        float bkNearCamera = smoothstep(2.5, 6.0, length(vViewPosition));
        diffuseColor.a *= bkNearCamera * bkNearCamera;
        if(diffuseColor.a < .002) discard;
        #include <alphatest_fragment>
      `);}
      if(source.name==='stone'){shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 vec3 bkNormal=abs(normalize(cross(dFdx(vBkWorld),dFdy(vBkWorld))));vec3 bkWeights=pow(bkNormal,vec3(4.));bkWeights/=max(.001,bkWeights.x+bkWeights.y+bkWeights.z);
 vec3 bkStone=texture2D(map,vBkWorld.zy/5.).rgb*bkWeights.x+texture2D(map,vBkWorld.xz/5.).rgb*bkWeights.y+texture2D(map,vBkWorld.xy/5.).rgb*bkWeights.z;
 diffuseColor.rgb*=mix(vec3(1.),.42+1.6*bkStone,.85);
#endif`);}
      if(wood&&source.name==='timber'){shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.025) + 1.7 * texture2D(map,vMapUv.yx).rgb,.38);\n#endif`);}
      if (terrain) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D bkBankStone;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 bkGround = texture2D(map, vBkWorld.xz / 11.0);
            float bkGroundValue = dot(bkGround.rgb, vec3(.2126, .7152, .0722));
            vec3 bkAuthored = vec3(.12,.22,.085);
            #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
              bkAuthored = vColor.rgb;
            #endif
            float bkPath = smoothstep(.23, .50, bkAuthored.r);
            // The painted tile supplies off-path albedo directly, rather than multiplying green.
            vec3 bkPaint = vec3(.025) + bkGround.rgb * 1.65;
            vec3 bkFaceNormal = normalize(cross(dFdx(vBkWorld),dFdy(vBkWorld)));
            float bkUp = smoothstep(.50,.85,abs(bkFaceNormal.y));
            vec3 bkBankWeights = pow(abs(bkFaceNormal), vec3(4.));
            bkBankWeights /= max(.001, bkBankWeights.x + bkBankWeights.y + bkBankWeights.z);
            vec3 bkBank = texture2D(bkBankStone, vBkWorld.zy / 5.).rgb * bkBankWeights.x
                        + texture2D(bkBankStone, vBkWorld.xz / 5.).rgb * bkBankWeights.y
                        + texture2D(bkBankStone, vBkWorld.xy / 5.).rgb * bkBankWeights.z;
            // Coloured exposed strata remain the authored earth tone, never white boulders.
            vec3 bkBankAlbedo = bkAuthored * (vec3(.45) + bkBank * 1.55);
            vec3 bkFloorAlbedo = mix(bkAuthored, bkPaint, .70 * (1.0-bkPath) * bkUp);
            bkFloorAlbedo = mix(bkBankAlbedo, bkFloorAlbedo, bkUp);
            // Keep the continuous authored cream path and quiet texture amplitude on it.
            bkFloorAlbedo *= mix(1.0, .95 + .12*bkGroundValue, bkPath);
            diffuseColor.rgb *= bkFloorAlbedo;
            diffuseColor.a *= bkGround.a;
          #endif
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #if defined(USE_COLOR_ALPHA)
            diffuseColor.a *= vColor.a;
          #endif
        `);
      }
      if (paintedCel) shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
        `vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
        // Measure light, not paint colour: dark hair must not become a light shadow band.
        vec3 bkIrradiance = totalDiffuse / max(diffuseColor.rgb, vec3(0.018));
        float bkLight = dot(bkIrradiance, vec3(0.2126, 0.7152, 0.0722));
        float bkMiddle = smoothstep(${character ? '.30, .34' : '.23, .43'}, bkLight);
        float bkSun = smoothstep(${character ? '.68, .73' : '.59, .84'}, bkLight);
        vec3 bkPaintedLight = mix(vec3(.40, .56, .58), vec3(.78, .83, .73), bkMiddle);
        bkPaintedLight = mix(bkPaintedLight, vec3(1.12, 1.055, .87), bkSun);
        // Broad quiet pigment variation: no grain, bump or animated screen-space noise.
        float bkBrush = sin(vBkWorld.x * 2.1 + sin(vBkWorld.z * 1.4))
                      * sin(vBkWorld.y * 2.8 + vBkWorld.z * .85);
        float bkPigment = 1.0 + bkBrush * ${character ? '.012' : terrain ? '.012' : '.038'};
        vec3 bkCel = diffuseColor.rgb * bkPaintedLight * bkPigment;
        totalDiffuse = mix(totalDiffuse, bkCel, ${metal ? '.24' : character ? '.84' : terrain ? '.48' : '.63'});
        `
      );
    };
    const priorKey = source.customProgramCacheKey();
    m.customProgramCacheKey = () => `bellkeeper-painted-v7:${paintedCel ? 1 : 0}:${key}:${metal ? 1 : 0}:${foliage ? 1 : 0}:${priorKey}`;
    return m;
  }

  function style(root, { character = false, terrain = false, wood = false } = {}) {
    root.traverse(object => {
      if (!object.isMesh) return;
      const isGround = terrain && (object.material?.name === 'ground' || root === object || object.userData.terrain);
      const hasColors = !!object.geometry?.getAttribute('color');
      object.receiveShadow = true;
      // Leave authored castShadow and hierarchy untouched, including transparent effects.
      if (Array.isArray(object.material)) {
        object.material = object.material.map(m => material(m, character, terrain && m.name === 'ground', hasColors, wood));
      } else {
        object.material = material(object.material, character, isGround, hasColors, wood);
      }
    });
    return root;
  }
  function update(time, gentle = false, player) {
    windTime.value = Number.isFinite(time) ? time : 0;
    windMotion.value = gentle ? .20 : 1;
    if(player)playerPosition.value.copy(player);
  }
  return { style, ready:Promise.all([ready,barkReady,stoneReady]), update };
}
