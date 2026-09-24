// Crafted form and baked material for the Rootway and Heartwood windworks.
// Everything here is procedural geometry with baked vertex colour (AO, grime, wear, moss,
// warm/cool pigment) plus one shared weathering shader patch. No textures are added, so load
// time is unchanged; all static output is merged by campaign-world's spatial bake.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// ---- Deterministic noise (same result on every machine; 0..1).
export function hash(x,z){const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);}
export function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf),a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
export function fbm(x,z,o=3){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vnoise(x*f+i*17.3,z*f-i*9.1);n+=a;a*=.5;f*=2.03;}return s/n;}
export const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const lerp3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const mul3=(a,b)=>[a[0]*b[0],a[1]*b[1],a[2]*b[2]];
const sc3=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
/** Linear-space RGB of an sRGB hex, for absolute vertex colours. */
export const lin=hex=>{const c=new T.Color(hex);return [c.r,c.g,c.b];};

// Multipliers applied over the ivory paving colour (the floor material's colour is animated
// by restoration, so paving colour is baked as a multiplier around 1).
const WARM=[1.035,1.0,.93],COOL=[.93,.965,1.03],GRIME=[.60,.55,.47],MOSS=[.50,.66,.34],WEAR=[1.05,1.045,1.02];

/** Pigment of ivory stone at a world point: broad warm/cool drift and a finer mottle. */
export function ivoryPigment(x,z,y=0){const a=fbm(x*.16+y*.1,z*.16,3),b=fbm(x*.9+3.1,z*.9-y*.4,2);return sc3(lerp3(COOL,WARM,sm(.3,.7,a)),.94+.12*b);}

/**
 * Walkable top of a deck: a planar grid at exactly the collision height (it is the ground
 * oracle, so heights are the same linear formula as ground()). Colour carries edge AO, corner
 * grime, moss creeping in from the lips, and a lighter worn line where feet go.
 */
export function deckTop(d,{step=.45,railX=[true,true],railZ=[false,false],wearX=null}={}){
  const nx=Math.max(1,Math.ceil((d.x2-d.x1)/step)),nz=Math.max(1,Math.ceil(Math.abs(d.z2-d.z1)/step)),pos=[],col=[],idx=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const t=j/nz,x=d.x1+(d.x2-d.x1)*i/nx,z=d.z1+(d.z2-d.z1)*t,y=d.y1+(d.y2-d.y1)*t;pos.push(x,y,z);
    const ex=Math.min(railX[0]?x-d.x1:9,railX[1]?d.x2-x:9),ez=Math.min(railZ[0]?d.z1-z:9,railZ[1]?z-d.z2:9),e=Math.min(ex,ez);
    let c=ivoryPigment(x,z,y);
    const ao=1-sm(0,.6,e);c=lerp3(c,mul3(c,[.8,.82,.86]),ao*.8);
    const corner=(1-sm(0,1.2,ex))*(1-sm(0,1.2,Math.min(d.z1-z,z-d.z2)));c=lerp3(c,mul3(c,GRIME),corner*.55);
    const moss=sm(.52,.72,fbm(x*.8+11,z*.8,3))*(1-sm(.15,.95,e));c=lerp3(c,mul3(c,MOSS),moss*.85);
    if(wearX!==null){const w=1-sm(.2,1.1,Math.abs(x-wearX));c=lerp3(c,mul3(c,WEAR),w*.9);}
    col.push(...c);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,e=c+1;idx.push(a,b,c,b,e,c);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

// Moulded slab profile below a walking edge: [outward, down] metres. Rounded nosing, fascia,
// a shadow groove, a thick corbelled lip, then a deep undercut into the root below.
export const SLAB_PROFILE=[[0,0],[.07,.045],[.07,.17],[.0,.23],[0,.42],[.13,.5],[.13,.68],[-.06,.8],[-.36,1.22],[-.58,1.6]];
function profileColour(k,s,x,y,z,depth){
  let c=ivoryPigment(x,z,y);
  if(k<=1)c=mul3(c,sc3(WEAR,1+.05*(fbm(s*3.1,y,2)-.5))); // worn nosing
  if(k===3)c=mul3(c,[.66,.69,.74]);                       // groove in shadow
  if(k===5||k===4){const m=sm(.48,.66,fbm(s*.7+5,1.3,3));c=lerp3(c,mul3(c,MOSS),m*.9);} // moss on the corbel
  const streak=sm(.5,.8,fbm(s*2.3,2.2,2))*sm(.2,1.,depth);c=lerp3(c,mul3(c,GRIME),streak*.7);
  c=mul3(c,lerp3([1,1,1],[.52,.55,.62],sm(.4,1.6,depth)));
  return c;
}

/** Closed moulded body under a (possibly sloped) rectangular deck top. Flat-faceted. */
export function deckBody(d,profile=SLAB_PROFILE,seg=.5){
  const zTop=z=>d.y1+(d.y2-d.y1)*(Math.min(d.z1,Math.max(d.z2,z))-d.z1)/(d.z2-d.z1);
  const hw=(d.x2-d.x1)/2,hd=Math.abs(d.z1-d.z2)/2,cx=(d.x1+d.x2)/2,cz=(d.z1+d.z2)/2;
  // Corners counter-clockwise seen from above (+x east, -z north).
  const nX=Math.max(1,Math.ceil((d.x2-d.x1)/seg)),nZ=Math.max(1,Math.ceil(Math.abs(d.z1-d.z2)/seg));
  const ring=(o,dy)=>{o=Math.max(o,-Math.min(hw,hd)*.8);const pts=[],C=[[d.x1-o,d.z1+o],[d.x2+o,d.z1+o],[d.x2+o,d.z2-o],[d.x1-o,d.z2-o]],N=[nX,nZ,nX,nZ];
    let s=0;for(let side=0;side<4;side++){const [ax,az]=C[side],[bx,bz]=C[(side+1)%4];for(let i=0;i<N[side];i++){const f=i/N[side],x=ax+(bx-ax)*f,z=az+(bz-az)*f;pts.push([x,zTop(z)-dy,z,s+f*Math.hypot(bx-ax,bz-az)]);}s+=Math.hypot(bx-ax,bz-az);}pts.push([...pts[0].slice(0,3),s]);return pts;};
  const rings=profile.map(([o,dy])=>ring(o,dy)),pos=[],col=[];
  const colour=(k,p)=>profileColour(k,p[3],p[0],p[1],p[2],profile[k][1]);
  const tri=(a,ka,b,kb,c,kc)=>{pos.push(...a.slice(0,3),...b.slice(0,3),...c.slice(0,3));col.push(...colour(ka,a),...colour(kb,b),...colour(kc,c));};
  for(let k=0;k<rings.length-1;k++){const A=rings[k],B=rings[k+1];for(let i=0;i<A.length-1;i++){
    // Outward winding: along the perimeter (CCW from above) then down.
    tri(A[i],k,B[i],k+1,A[i+1],k);tri(A[i+1],k,B[i],k+1,B[i+1],k+1);}}
  const last=rings.at(-1),K=rings.length-1,c=[cx,Math.min(...last.map(p=>p[1]))-.12,cz,0];
  for(let i=0;i<last.length-1;i++)tri(last[i],K,c,K,last[i+1],K);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeVertexNormals();
  // Guarantee outward normals whatever the corner order resolved to.
  const n=g.attributes.normal,p=g.attributes.position;let dot=0;for(let i=0;i<Math.min(n.count,60);i++)dot+=n.getX(i)*(p.getX(i)-cx)+n.getZ(i)*(p.getZ(i)-cz);
  if(dot<0){const a=p.array;for(let i=0;i<a.length;i+=9)for(let q=0;q<3;q++){const t=a[i+3+q];a[i+3+q]=a[i+6+q];a[i+6+q]=t;}const cc=g.attributes.color.array;for(let i=0;i<cc.length;i+=9)for(let q=0;q<3;q++){const t=cc[i+3+q];cc[i+3+q]=cc[i+6+q];cc[i+6+q]=t;}g.computeVertexNormals();}
  return g;
}

/**
 * The Heartwood terrace top: the exact 64-gon used by ground(), subdivided into rings so the
 * baked colour can hold contact shadow under props, a grimy rail edge, moss and worn routes.
 */
export function discTop(cx,cz,y,{R=11,sides=64,sub=2,rings=30,colourAt}){
  const n=sides*sub,pos=[cx,y,cz],col=[...colourAt(cx,cz,0)],idx=[],seg=2*Math.PI/sides;
  for(let j=1;j<=rings;j++){const t=j/rings;for(let k=0;k<n;k++){const a=k*2*Math.PI/n,local=((a%seg)+seg)%seg,Rp=R*Math.cos(seg/2)/Math.cos(local-seg/2),r=Rp*t,x=cx+r*Math.cos(a),z=cz+r*Math.sin(a);pos.push(x,y,z);col.push(...colourAt(x,z,r));}}
  const v=(j,k)=>1+(j-1)*n+((k%n)+n)%n;
  for(let k=0;k<n;k++)idx.push(0,v(1,k+1),v(1,k));
  for(let j=1;j<rings;j++)for(let k=0;k<n;k++)idx.push(v(j,k),v(j,k+1),v(j+1,k),v(j,k+1),v(j+1,k+1),v(j+1,k));
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

/** Lathed moulding and bowl under the terrace rim, baked darker and mossier with depth. */
export function discBody(cx,cy,cz,segments=128){
  const prof=[[10.99,-.002],[11.1,-.05],[11.12,-.2],[11.02,-.27],[11.02,-.5],[11.32,-.6],[11.32,-.86],[11.05,-.98],[10.55,-1.4],[9.5,-2.1],[8,-2.9],[5.6,-3.9],[2.8,-4.6],[.01,-4.9]];
  const g=new T.LatheGeometry(prof.map(([r,y])=>new T.Vector2(r,y)),segments).toNonIndexed();g.deleteAttribute('uv');g.translate(cx,cy,cz);g.computeVertexNormals();
  const p=g.attributes.position,col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i)-cy,z=p.getZ(i),a=Math.atan2(z-cz,x-cx),s=a*11.3,depth=-y;
    let k=0;for(let q=0;q<prof.length;q++)if(Math.abs(prof[q][1]-y)<1e-3){k=q;break;}
    col.set(profileColour(k<=1?k:k===3?3:(k===5||k===4)?5:6,s,x,y+cy,z,depth),i*3);}
  g.setAttribute('color',new T.BufferAttribute(col,3));return g;
}

// ---- Timber rails: planked, chamfered, capped posts; plank-to-plank tone variation.
const PLANKS=['#7a4a32','#8c5a3b','#6d4330','#936344','#80523a'].map(lin);
function octBeam(len,w,h){const g=new T.CylinderGeometry(1,1,len,8,1).toNonIndexed();g.rotateY(Math.PI/8);g.scale(w/1.848,1,h/1.848);g.rotateX(Math.PI/2);return g;}
function paint(g,fn){g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++)c.set(fn(p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)),i*3);g.setAttribute('color',new T.BufferAttribute(c,3));return g;}
/**
 * Visual rail from a to b ([x,y,z], y = handrail top line as the collider uses). Returns
 * geometries (timber, vertex-coloured) and copper collar geometries. `postKeys` dedupes posts
 * shared by consecutive segments. Colliders are NOT touched here.
 */
export function railKit(a,b,postKeys,{lower=true}={}){
  const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),len=d.length(),dir=d.clone().normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),dir);
  const seed=hash(a[0]*3.1+b[2],a[2]*1.7+b[0]),wood=[],copper=[];
  const nPlank=Math.max(1,Math.round(len/2.3));
  for(let i=0;i<nPlank;i++){const f0=i/nPlank,f1=(i+1)/nPlank,l=len*(f1-f0)-.012,tone=PLANKS[Math.floor(hash(seed*91+i,i*7.3)*PLANKS.length)];
    const place=(g,drop)=>{g.applyQuaternion(q);const m=A.clone().addScaledVector(d,(f0+f1)/2);g.translate(m.x,m.y-drop,m.z);return g;};
    const grain=(x,y,z,nx,ny)=>{let c=sc3(tone,.9+.2*fbm(x*1.7+z*1.7,y*9,2));if(ny>.5)c=sc3(c,1.22);else if(ny<-.5)c=sc3(c,.62);return c;};
    wood.push(paint(place(octBeam(l,.13,.1),.055),grain));
    if(lower&&len>.9)wood.push(paint(place(octBeam(l,.075,.07),.46),grain));}
  const nPost=Math.max(1,Math.ceil(len/1.95));
  for(let i=0;i<=nPost;i++){const p=A.clone().addScaledVector(d,i/nPost),key=`${p.x.toFixed(2)},${p.z.toFixed(2)}`;if(postKeys?.has(key))continue;postKeys?.add(key);
    const tone=PLANKS[Math.floor(hash(p.x*5.3,p.z*2.9)*PLANKS.length)],base=p.y-.86,top=p.y+.02;
    const post=new T.CylinderGeometry(.068,.08,top-base,8,1).toNonIndexed();post.rotateY(Math.PI/8);post.translate(p.x,(top+base)/2,p.z);
    const cap=new T.ConeGeometry(.098,.1,4,1).toNonIndexed();cap.rotateY(Math.PI/4);cap.translate(p.x,top+.05,p.z);
    const mossy=hash(p.x*1.3,p.z*.7)>.55;
    wood.push(paint(post,(x,y,z,nx,ny)=>{const h=sm(base,top,y);let c=sc3(tone,.62+.42*h);if(mossy)c=lerp3(c,lin('#56663a'),(1-sm(base,base+.3,y))*.8);return c;}));
    wood.push(paint(cap,(x,y,z,nx,ny)=>sc3(tone,ny>.3?1.1:.8)));
    if(i===0||i===nPost){const band=new T.CylinderGeometry(.087,.087,.045,8,1).toNonIndexed();band.rotateY(Math.PI/8);band.translate(p.x,top-.14,p.z);copper.push(band);}
  }
  return {wood,copper};
}

// ---- Carved channel troughs: low curbs, shadowed inner walls, dark verdigris bed.
const TROUGH=[[-.31,.004],[-.29,.03],[-.235,.036],[-.215,.012],[.215,.012],[.235,.036],[.29,.03],[.31,.004]];
export function trough(points,y){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p[0],y,p[1]))),len=curve.getLength(),n=Math.max(4,Math.ceil(len/.3)),pos=[],col=[],idx=[],W=TROUGH.length;
  const CURB=lin('#efe5cc'),WALL=lin('#8f8573'),BED=lin('#35514a'),SILT=lin('#5a4a3a');
  for(let i=0;i<=n;i++){const t=i/n,c=curve.getPointAt(t),tg=curve.getTangentAt(t),sx=-tg.z,sz=tg.x,l=Math.hypot(sx,sz)||1,s=t*len;
    for(let k=0;k<W;k++){const [u,v]=TROUGH[k];pos.push(c.x+sx/l*u,y+v,c.z+sz/l*u);
      const edge=k===0||k===W-1,wall=k===3||k===4,top=k===1||k===2||k===5||k===6;
      let cc=top?sc3(CURB,.95+.1*fbm(s*1.3,k,2)):edge?sc3(CURB,.78):wall?lerp3(BED,SILT,sm(.4,.7,fbm(s*.9,3.3,2))):WALL;
      if(top)cc=lerp3(cc,mul3(cc,MOSS),sm(.6,.8,fbm(s*.6+k,9,2))*.7);col.push(...cc);}}
  for(let i=0;i<n;i++)for(let k=0;k<W-1;k++){const a=i*W+k,b=a+W;idx.push(a,a+1,b,a+1,b+1,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
  // Winding check: the bed must face up.
  if(g.attributes.normal.getY(Math.floor(W/2))<0){const a=g.index.array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}g.computeVertexNormals();}
  return g.toNonIndexed();
}

/** Bark multiplier colours for a root/trunk geometry: moss on the upper side, lichen, dark underside. */
export function barkColours(g,{moss=.85,seed=0}={}){
  if(!g.attributes.normal)g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ny=n.getY(i);
    let cc=sc3([1,1,1],.9+.2*fbm(x*.7+seed,z*.7+y*.5,2));
    cc=lerp3(cc,[.62,.62,.66],sm(-.1,-.8,ny));
    const m=sm(.25,.75,ny)*sm(.42,.62,fbm(x*.9+seed*3,z*.9+y*.3,3));cc=lerp3(cc,[.62,1.05,.42],m*moss);
    const lichen=sm(.78,.84,fbm(x*3.1+7,z*3.1+y*2.3,2))*(1-m);cc=lerp3(cc,[1.45,1.5,1.3],lichen*.6);
    c.set(cc,i*3);}
  g.setAttribute('color',new T.BufferAttribute(c,3));return g;
}

// ---- Shared GLSL: cheap value noise.
const GLSL_NOISE=`float bkH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float bkN(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(bkH(i),bkH(i+vec2(1,0)),u.x),mix(bkH(i+vec2(0,1)),bkH(i+vec2(1,1)),u.x),u.y);}`;

/** Chain an onBeforeCompile patch after whatever the material already does. */
function chain(m,tag,patch){if(m.userData.bkCraft?.includes(tag))return m;const prior=m.onBeforeCompile,key=m.customProgramCacheKey();m.onBeforeCompile=(s,r)=>{prior?.call(m,s,r);patch(s);};m.customProgramCacheKey=()=>key+':'+tag;m.userData.bkCraft=(m.userData.bkCraft||'')+tag;m.needsUpdate=true;return m;}

/**
 * Weathered ivory for walls, arches, mouldings: warm/cool drift, rain streaks on vertical
 * faces, cooler undersides, moss on upward ledges. World-space so it never repeats per prop.
 */
export function weatherIvory(m){return chain(m,'bk-weather-v1',s=>{
  if(!s.fragmentShader.includes('varying vec3 vBkWorld'))return;
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+GLSL_NOISE).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  {vec3 wn=inverseTransformDirection(normal,viewMatrix);float up=wn.y;
   float drift=bkN(vBkWorld.xz*.21+vBkWorld.y*.13);diffuseColor.rgb*=mix(vec3(.91,.95,1.04),vec3(1.05,1.,.90),drift)*(.92+.16*bkN(vBkWorld.xz*1.7-vBkWorld.y*.9));
   float vert=1.-abs(up),st=bkN(vec2(dot(vBkWorld.xz,vec2(.71,.71))*4.3+vBkWorld.x*1.7,vBkWorld.y*.45))*.7+.3*bkN(vBkWorld.xz*9.+vBkWorld.y*2.);
   // Walking level of the windworks, falling from the bough (z=-19) to the terrace (z=-50).
   float floorY=clamp(.4+(vBkWorld.z+19.)*.09,-2.4,1.2),h=vBkWorld.y-floorY;
   float low=1.-smoothstep(0.,1.1,h);
   diffuseColor.rgb*=1.-vert*smoothstep(.45,.8,st)*vec3(.26,.29,.33)*(.55+.45*low);
   diffuseColor.rgb*=mix(vec3(1.),vec3(.66,.70,.80),smoothstep(.1,.9,-up));
   diffuseColor.rgb*=mix(vec3(1.),vec3(.74,.70,.60),low*low*(.6+.4*bkN(vBkWorld.xz*2.3))*step(-.05,h));
   float moss=smoothstep(.48,.7,bkN(vBkWorld.xz*1.1+vBkWorld.y*.7+11.))*max(smoothstep(.45,.9,up),low*low*.8*vert);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.50,.68,.38),moss*.8);
   float chip=smoothstep(.82,.9,bkN(vBkWorld.xz*6.1+vBkWorld.y*5.3));diffuseColor.rgb*=1.+chip*.08;}`);});}

/**
 * Carved paving on the walkable ivory: staggered flagstones on the Rootway, concentric
 * coursed stones on the Heartwood terrace, a single inlaid two-part (breath-out/breath-in)
 * medallion at its centre. Joints fade with distance so they never shimmer.
 */
export function carvedPaving(m){return chain(m,'bk-paving-v1',s=>{
  if(!s.fragmentShader.includes('varying vec3 vBkWorld'))return;
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+GLSL_NOISE).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  {vec3 wn=inverseTransformDirection(normal,viewMatrix);float top=smoothstep(.8,.95,wn.y);
   vec2 p=vBkWorld.xz;float j,tone;
   vec2 dc=p-vec2(8.,-59.);float r=length(dc);float heart=step(-47.8,-p.y)*step(r,11.2);
   if(heart>.5){float bw=1.45,bi=floor((r+.35)/bw),fr=fract((r+.35)/bw);float rm=(bi+.5)*bw-.35,ns=max(5.,floor(6.2832*max(rm,.6)/1.25));
     float aa=(atan(dc.y,dc.x)/6.2832+.5)*ns+bkH(vec2(bi,3.1)),ai=floor(aa),af=fract(aa);
     j=min(min(fr,1.-fr)*bw,min(af,1.-af)*6.2832*max(r,.6)/ns);tone=bkH(vec2(bi,ai));
     if(r<1.25){float sgn=dc.x<0.?-1.:1.;float sline=abs(length(dc-vec2(0.,.55*sgn))-.55);float rim=abs(r-1.15);j=min(sline,rim);tone=.5+.35*sgn*step(.02,sline);}}
   else{float row=floor(p.y/1.15),off=bkH(vec2(row,7.))*.9,col=floor((p.x+off)/.95);vec2 f=vec2(fract((p.x+off)/.95)*.95,fract(p.y/1.15)*1.15);
     j=min(min(f.x,.95-f.x),min(f.y,1.15-f.y));tone=bkH(vec2(row,col));}
   float px=fwidth(j)+1e-4;float joint=(1.-smoothstep(.016,.016+1.5*px,j))*(1.-smoothstep(.03,.09,px));
   float mossJ=smoothstep(.6,.78,bkN(p*.9+4.));
   vec3 jc=mix(vec3(.62,.58,.52),vec3(.50,.60,.38),mossJ);
   float bevel=(1.-smoothstep(.016,.05,j))*(1.-joint)*(1.-smoothstep(.02,.06,px));
   vec3 stone=vec3(1.+(tone-.5)*.13)*mix(vec3(1.),tone>.5?vec3(1.02,1.,.96):vec3(.97,.99,1.02),.8);
   diffuseColor.rgb*=mix(vec3(1.),stone*mix(vec3(1.),jc,joint)*(1.+bevel*.05),top);}`);});}

/**
 * Small life shared by both zones: drifting seed fluff riding the current toward the
 * windworks, a few turning leaves, and sap motes breathing round the heart trunk.
 * Two draw calls; CPU update of ~170 points / 34 leaf matrices.
 */
export function createCampaignLife(root){
  const N=150,pos=new Float32Array(N*3),col=new Float32Array(N*3),seeds=[];
  const box=i=>i<70?{x:[1,15],y:[-1.5,3.5],z:[-15,-48]}:i<120?{x:[-3,19],y:[-2,4],z:[-48,-70]}:{x:[4,12],y:[-2,6],z:[-70,-78]};
  for(let i=0;i<N;i++){const b=box(i),r=(k)=>hash(i*1.37+k,k*.71+i*.13);seeds.push({b,p:[b.x[0]+(b.x[1]-b.x[0])*r(1),b.y[0]+(b.y[1]-b.y[0])*r(2),b.z[0]+(b.z[1]-b.z[0])*r(3)],ph:r(4)*6.28,sp:.25+.35*r(5),mote:i>=120});
    col.set(i>=120?lin('#9ff5d8'):i%5===0?lin('#f6d58c'):lin('#fff3d6'),i*3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('color',new T.BufferAttribute(col,3));
  const S=16,alpha=new Uint8Array(S*S*4);for(let y=0;y<S;y++)for(let x=0;x<S;x++){const r=Math.hypot(x+.5-S/2,y+.5-S/2)/(S/2),a=Math.max(0,1-r*r)**1.5*255;alpha.set([255,255,255,a],(y*S+x)*4);}
  const dot=new T.DataTexture(alpha,S,S);dot.needsUpdate=true;
  const pts=new T.Points(g,new T.PointsMaterial({size:.08,map:dot,vertexColors:true,transparent:true,opacity:.9,depthWrite:false}));pts.name='campaign-life-seeds';pts.frustumCulled=false;root.add(pts);
  const L=34,leafGeo=new T.BufferGeometry();leafGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,-.07,.045,0,0,0,0,.08,-.045,0,0,0,.012,0],3));leafGeo.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);leafGeo.computeVertexNormals();
  const leaves=new T.InstancedMesh(leafGeo,new T.MeshBasicMaterial({side:T.DoubleSide}),L);leaves.name='campaign-life-leaves';leaves.frustumCulled=false;root.add(leaves);
  const leafData=[],palette=['#8fae4a','#c98f3c','#a7b85a','#d2a24a','#6f9a44'].map(c=>new T.Color(c));
  for(let i=0;i<L;i++){const r=k=>hash(i*2.9+k,k*1.3-i);leafData.push({x:1+r(1)*17,z:-16-r(2)*56,y0:r(3)*9,sp:.35+.3*r(4),ph:r(5)*6.28});leaves.setColorAt(i,palette[i%palette.length]);}
  const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),s=new T.Vector3(1,1,1);
  function update(t,gentle){const k=gentle?.35:1;
    for(let i=0;i<N;i++){const S=seeds[i],b=S.b;let x,y,z;
      if(S.mote){const a=S.ph+t*.25*S.sp*k;x=8+Math.cos(a)*(2.8+1.2*Math.sin(t*.3+S.ph));z=-72.5+Math.sin(a)*2.4;y=b.y[0]+((S.p[1]-b.y[0]+t*.12*S.sp*k)%(b.y[1]-b.y[0]));}
      else{const span=b.z[0]-b.z[1];z=b.z[0]-((b.z[0]-S.p[2]+t*S.sp*k)%span);x=S.p[0]+Math.sin(t*.6*k+S.ph)*.6;y=S.p[1]+Math.sin(t*.9*k+S.ph*1.3)*.35;
        if(i>=70){const a=Math.atan2(z+59,x-8)+t*.05*S.sp*k,r=Math.hypot(x-8,z+59);x=8+Math.cos(a)*r;z=-59+Math.sin(a)*r;}}
      pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;}
    g.attributes.position.needsUpdate=true;
    for(let i=0;i<L;i++){const D=leafData[i],fall=((D.y0+t*D.sp*k)%9);v.set(D.x+Math.sin(t*.8*k+D.ph)*.7,5-fall,D.z+Math.cos(t*.6*k+D.ph)*.5-fall*.25);e.set(t*1.3*k+D.ph,t*.9*k,Math.sin(t*2*k+D.ph)*.9);q.setFromEuler(e);leaves.setMatrixAt(i,m.compose(v,q,s));}
    leaves.instanceMatrix.needsUpdate=true;}
  update(0,false);
  return {update,objects:[pts,leaves]};
}

export {mergeGeometries};
