import * as T from 'three';
// The JSON contains animation tracks/rest transforms only. Every visible mesh is code-built.
let motionPromise,faceTexturePromise;
export async function loadCodeCharacter(build){
 const data=await(motionPromise??=fetch(new URL('./assets/quaternius/motion.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Motion load '+r.status);return r.json();}));
 const model=build(T),root=new T.Group();root.add(model);const faceTexture=await(faceTexturePromise??=new T.TextureLoader().loadAsync(new URL('./textures/face-r07.png',import.meta.url).href));faceTexture.colorSpace=T.SRGBColorSpace;
 const source=new T.Group(),nodes=new Map();
 for(const n of data.nodes){const o=new T.Object3D();o.name=n.name;o.position.fromArray(n.position);o.quaternion.fromArray(n.quaternion);o.scale.fromArray(n.scale);nodes.set(n.name,o);}
 for(const n of data.nodes)(nodes.get(n.parent)||source).add(nodes.get(n.name));
 const map={hips:'pelvis',chest:'spine_03',head:'Head'};
 for(const [side,suffix]of [['left','r'],['right','l']])for(const [part,bone]of [['UpperArm','upperarm'],['LowerArm','lowerarm'],['Hand','hand'],['UpperLeg','thigh'],['LowerLeg','calf'],['Foot','foot']])map[side+part]=bone+'_'+suffix;
 source.updateMatrixWorld(true);root.updateMatrixWorld(true);
 const joints=model.userData.joints,links=Object.entries(map).map(([name,src])=>({dst:joints[name],src:nodes.get(src)}));
 const depth=o=>{let d=0;while(o.parent){d++;o=o.parent;}return d;};links.sort((a,b)=>depth(a.dst)-depth(b.dst));
 for(const l of links){l.inverse=l.src.getWorldQuaternion(new T.Quaternion()).invert();l.rest=l.dst.getWorldQuaternion(new T.Quaternion());if(/Arm|Hand/.test(l.dst.name)){const child=l.src.children[0];if(child){const direction=child.getWorldPosition(new T.Vector3()).sub(l.src.getWorldPosition(new T.Vector3())).normalize();const down=new T.Vector3(0,-1,0).applyQuaternion(l.rest);l.rest.premultiply(new T.Quaternion().setFromUnitVectors(down,direction));}}}
 const pelvisRest=nodes.get('pelvis').position.clone(),hipRest=joints.hips.position.clone();
 const eyeGaze={value:new T.Vector2()};
 // Narrow soft edges on facial light bands prevent a hard stripe through painted features.
 const faceRamp=new T.DataTexture(new Uint8Array([150,150,150,150,150,160,185,215,240,245,245,245,245,245,245,245]),16,1,T.RedFormat);faceRamp.needsUpdate=true;faceRamp.minFilter=faceRamp.magFilter=T.LinearFilter;
 const ramp=new T.DataTexture(new Uint8Array([140,185,245]),3,1,T.RedFormat);ramp.needsUpdate=true;ramp.minFilter=ramp.magFilter=T.NearestFilter;
 model.traverse(n=>{if(n.isMesh){if(n.userData.faceDetail)n.visible=false;const convert=m=>{const mat=new T.MeshToonMaterial({color:m.color,gradientMap:ramp,side:m.side,vertexColors:m.vertexColors});if(m.name==='irisSurface'){mat.color.set('#ffffff');mat.onBeforeCompile=shader=>{shader.uniforms.eyeGaze=eyeGaze;shader.uniforms.eyeSide={value:n.userData.eyeSide||1};shader.vertexShader='varying vec2 eyeUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\neyeUv=uv;');shader.fragmentShader='varying vec2 eyeUv; uniform vec2 eyeGaze; uniform float eyeSide;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float arch=pow(max(0.0,sin(eyeUv.x*3.14159265)),0.8);
 float top=.012*arch-.001+eyeUv.x*.004;
 float bottom=-.009*arch-.001+eyeUv.x*.004;
 vec2 eyePoint=vec2((eyeUv.x-.5)*.050,mix(bottom,top,eyeUv.y)-.002)-vec2(eyeGaze.x*eyeSide,eyeGaze.y);
 float r=length(eyePoint/vec2(.0128,.015));
 float angle=atan(eyePoint.y,eyePoint.x);
 vec3 iris=mix(vec3(.025,.13,.12),vec3(.10,.43,.34),smoothstep(.28,.7,r));
 iris*=.96+.04*sin(angle*15.0+r*8.0);
 iris=mix(iris,vec3(.014,.065,.060),smoothstep(.84,1.0,r));
 iris=mix(vec3(.008,.025,.025),iris,smoothstep(.35,.43,r));
 diffuseColor.rgb=mix(iris,vec3(.92,.89,.79),smoothstep(.97,1.02,r));
 float sparkle=1.0-smoothstep(.0016,.0024,length(eyePoint-vec2(-.004,.005)));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),sparkle);
 `);};} if(m.name==='faceSkin'){
 const g=n.geometry,p=g.attributes.position,uv=[],mask=[];const anchors=[[.027,.762],[.038,.75],[.069,.696],[.091,.629],[.124,.563],[.174,.432],[.203,.371],[.251,.265],[.3,.15]];
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);let v=.762;for(let j=1;j<anchors.length;j++)if(y>=anchors[j-1][0]&&y<=anchors[j][0])v=T.MathUtils.lerp(anchors[j-1][1],anchors[j][1],(y-anchors[j-1][0])/(anchors[j][0]-anchors[j-1][0]));const sx=T.MathUtils.lerp(1.75,1.98,T.MathUtils.smoothstep(y,.11,.174));uv.push(.5+x*sx*(1+.35*Math.exp(-(((y-.090)/.021)**2)-((x/.035)**4))),1-v);mask.push(T.MathUtils.smoothstep(z,.018,.06)*(1-T.MathUtils.smoothstep(Math.abs(x),.075,.104))*T.MathUtils.smoothstep(y,.028,.06)*(1-T.MathUtils.smoothstep(y,.225,.245)));}
 // Keep the cel light plane coherent across the painted sockets and cheeks.
 const normals=g.attributes.normal,normal=new T.Vector3(),plane=new T.Vector3();for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);normal.fromBufferAttribute(normals,i);plane.set(x/.102*.65-.25,(y-.17)/.14*.18,1).normalize();normal.lerp(plane,T.MathUtils.smoothstep(z,.018,.045)).normalize();normals.setXYZ(i,normal.x,normal.y,normal.z);}
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('paintMask',new T.Float32BufferAttribute(mask,1));const skin=new T.MeshToonMaterial({color:'#ffffff',map:faceTexture,gradientMap:faceRamp});skin.onBeforeCompile=shader=>{shader.vertexShader='attribute float paintMask; varying float faceMask; varying vec3 facePoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfaceMask=paintMask;facePoint=position;');shader.fragmentShader='varying float faceMask; varying vec3 facePoint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float eyeHole=1.0-smoothstep(.80,1.05,pow((abs(facePoint.x)-.055)/.027,2.0)+pow((facePoint.y-.176)/.019,2.0));
 vec3 baseSkin=texture2D(map,vec2(.50,.69)).rgb;
 diffuseColor.rgb=mix(baseSkin,diffuseColor.rgb,faceMask*(1.0-eyeHole)*(1.0-(1.0-smoothstep(.075,.105,facePoint.y))*smoothstep(.035,.066,abs(facePoint.x))));
 float noseSoft=exp(-pow(facePoint.x/.024,4.0)-pow((facePoint.y-.129)/.022,4.0));
 diffuseColor.rgb=mix(diffuseColor.rgb,baseSkin,.78*noseSoft);
 `);shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=diffuseColor.rgb*.10;');};return skin;}return mat;};n.material=Array.isArray(n.material)?n.material.map(convert):convert(n.material);}});

 // Preserve authored flight height while grounding the different-sized procedural boots.
 const sourceFeet=[nodes.get('foot_l'),nodes.get('foot_r')];
 const sourceSole=Math.min(...sourceFeet.map(f=>f.getWorldPosition(new T.Vector3()).y));
 const bootSamples=[];for(const name of ['leftFoot','rightFoot']){const foot=joints[name];foot.updateWorldMatrix(true,true);const inverse=foot.matrixWorld.clone().invert(),points=[];foot.traverse(n=>{if(!n.isMesh)return;const matrix=inverse.clone().multiply(n.matrixWorld),p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));});bootSamples.push({foot,points});}
 const sample=new T.Vector3();
 function groundBoots(){const flight=Math.max(0,Math.min(...sourceFeet.map(f=>f.getWorldPosition(sample).y))-sourceSole)*.85;let bottom=Infinity;for(const {foot,points}of bootSamples)for(const p of points)bottom=Math.min(bottom,sample.copy(p).applyMatrix4(foot.matrixWorld).y);model.position.y+=root.position.y+flight-bottom;model.updateMatrixWorld(true);}
 const mixer=new T.AnimationMixer(source),actions={};for(const c of data.clips){const clip=T.AnimationClip.parse(c);actions[clip.name]=mixer.clipAction(clip);}
 let current=null,elapsed=0;const nominal={Walk_Loop:.83,Jog_Fwd_Loop:4.55,Sprint_Loop:7.0};
 function play(name,{once=false}={}){const a=actions[name];if(!a||a===current)return;const old=current;a.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);a.clampWhenFinished=once;a.play();if(old){old.fadeOut(.16);a.fadeIn(.16);}current=a;}
 const q=new T.Quaternion(),parent=new T.Quaternion(),world=new T.Quaternion();
 function update(dt,speed){elapsed+=dt;const idle=current?.getClip().name==='Idle_Loop';eyeGaze.value.set(idle?Math.sin(elapsed*.85)*.0014:0,idle?Math.sin(elapsed*.51)*.0005:0);const blinkPhase=elapsed%4.3;const blink=blinkPhase>3.7&&blinkPhase<3.88?Math.sin((blinkPhase-3.7)/.18*Math.PI):0;for(const eye of model.userData.eyeGroups||[])eye.scale.y=1-.97*blink;if(current)current.timeScale=speed!==undefined&&nominal[current.getClip().name]?Math.max(.1,Math.min(2,speed/nominal[current.getClip().name])):1;mixer.update(dt);source.updateMatrixWorld(true);root.updateMatrixWorld(true);const rootQ=root.getWorldQuaternion(new T.Quaternion());for(const l of links){l.src.getWorldQuaternion(q);world.copy(rootQ).multiply(q).multiply(l.inverse).multiply(l.rest);l.dst.parent.getWorldQuaternion(parent).invert();l.dst.quaternion.copy(parent.multiply(world));l.dst.updateMatrixWorld(true);}joints.hips.position.copy(hipRest).addScaledVector(nodes.get('pelvis').position.clone().sub(pelvisRest),.85);if(joints.cape)joints.cape.rotation.x=Math.sin(elapsed*8)*.035;model.updateMatrixWorld(true);groundBoots();}
 function reset(){mixer.stopAllAction();current=null;elapsed=0;root.position.set(0,0,0);root.rotation.set(0,0,0);play('Idle_Loop');update(0);}
 reset();return{root,nominal,play,update,reset,get clip(){return current?.getClip().name;}};
}
