/** Shared painted light treatment. Keeps scene lights, real shadows and emissive state. */
export function createArtDirection(T, renderer) {
  const cache = new WeakMap();
  const owned = new WeakSet();
  const windTime = { value: 0 };
  const windMotion = { value: 1 };
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
  // World-scaled sampling below makes one painted tile span seven metres.

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
    if(wood&&source.name==='timber'){m.map=bark;m.color.copy(source.color).lerp(new T.Color(0x957654), .22);}
    const priorCompile = source.onBeforeCompile;
    m.onBeforeCompile = (shader, context) => {
      priorCompile?.call(m, shader, context);
      shader.uniforms.bkWindTime = windTime;
      shader.uniforms.bkWindMotion = windMotion;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBkWorld;\nuniform float bkWindTime;\nuniform float bkWindMotion;');
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
        ` : ''}
        #include <project_vertex>
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBkWorld;');
      if(source.name==='stone'){shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 vec3 bkNormal=abs(normalize(cross(dFdx(vBkWorld),dFdy(vBkWorld))));vec3 bkWeights=pow(bkNormal,vec3(4.));bkWeights/=max(.001,bkWeights.x+bkWeights.y+bkWeights.z);
 vec3 bkStone=texture2D(map,vBkWorld.zy/5.).rgb*bkWeights.x+texture2D(map,vBkWorld.xz/5.).rgb*bkWeights.y+texture2D(map,vBkWorld.xy/5.).rgb*bkWeights.z;
 diffuseColor.rgb*=mix(vec3(1.),.42+1.6*bkStone,.85);
#endif`);}
      if(wood&&source.name==='timber'){shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP\n diffuseColor.rgb *= mix(vec3(1.0), .78 + .70 * texture2D(map,vMapUv).rgb,.32);\n#endif`);}
      if (terrain) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 bkGround = texture2D(map, vBkWorld.xz / 7.0);
            float bkGroundValue = dot(bkGround.rgb, vec3(.2126, .7152, .0722));
            vec3 bkQuietGround = mix(vec3(bkGroundValue), bkGround.rgb, .30);
            // Retain brush detail without letting the generated grass/soil islands
            // overwrite the continuous pale authored path.
            float bkGroundStrength=.65;
            #if defined(USE_COLOR)
              bkGroundStrength=mix(.65,.22,smoothstep(.25,.50,vColor.r));
            #endif
            diffuseColor.rgb *= mix(vec3(1.0), .20 + 1.25 * bkQuietGround, bkGroundStrength);
            diffuseColor.a *= bkGround.a;
          #endif
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #if defined(USE_COLOR_ALPHA)
            diffuseColor.rgb *= vColor.rgb;
            diffuseColor.a *= vColor.a;
          #elif defined(USE_COLOR)
            diffuseColor.rgb *= vColor;
          #endif
        `);
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
        `vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
        // Measure light, not paint colour: dark hair must not become a light shadow band.
        vec3 bkIrradiance = totalDiffuse / max(diffuseColor.rgb, vec3(0.018));
        float bkLight = dot(bkIrradiance, vec3(0.2126, 0.7152, 0.0722));
        float bkDirect = dot(reflectedLight.directDiffuse / max(diffuseColor.rgb, vec3(.018)), vec3(.2126,.7152,.0722));
        float bkMiddle = smoothstep(${character ? '.30, .34' : '.23, .43'}, bkLight);
        float bkSun = smoothstep(${character ? '.68, .73' : '.59, .84'}, bkLight);
        vec3 bkPaintedLight = mix(vec3(.36, .58, .67), vec3(.87, .89, .70), smoothstep(.02,.48,bkDirect));
        bkPaintedLight = mix(bkPaintedLight, vec3(1.27, 1.13, .82), smoothstep(.45,.95,bkDirect));
        // Broad quiet pigment variation: no grain, bump or animated screen-space noise.
        float bkBrush = sin(vBkWorld.x * .65 + sin(vBkWorld.z * .43))
                      * sin(vBkWorld.y * .8 + vBkWorld.z * .35);
        float bkPigment = 1.0 + bkBrush * ${character ? '.012' : terrain ? '.025' : '.040'};
        vec3 bkCel = diffuseColor.rgb * bkPaintedLight * bkPigment;
        totalDiffuse = mix(totalDiffuse, bkCel, ${metal ? '.24' : character ? '.84' : terrain ? '.65' : '.80'});
        `
      );
    };
    const priorKey = source.customProgramCacheKey();
    m.customProgramCacheKey = () => `bellkeeper-material-study-B:${key}:${metal ? 1 : 0}:${foliage ? 1 : 0}:${priorKey}`;
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
  function update(time, gentle = false) {
    windTime.value = Number.isFinite(time) ? time : 0;
    windMotion.value = gentle ? .20 : 1;
  }
  return { style, ready:Promise.all([ready,barkReady,stoneReady]), update };
}
