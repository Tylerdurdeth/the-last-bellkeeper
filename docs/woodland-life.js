import {PATH, POINTS, pathDistance} from './world-layout.js';

// Call before static chunk baking. Load the six selected life prototypes first;
// rabbit, kingfisher and luna-moth need keepHierarchy:true for their named pivots.
// Maximum population: 4 brambles, 8 hostas, 3 stumps, 3 rabbits, 2 birds, 4 moths.
// Selected meshes total 71,676 triangles even with every instance in view.
export function createWoodlandLife(T, {place, height, shoreClearance}) {
  const TAU = Math.PI * 2, occupied = [], beds = [], stumps = [];
  const rabbits = [], birds = [], moths = [];
  const landmarkRadii = {cottage:3.2, porch:2, garden:2.4, quietGarden:2, chime:2.2, wheel:2.2, overlook:3, keepsake:2};
  // Keep the authored return shortcut and eastbound approach clear as well as PATH.
  const extraRoutes = [
    [[-10,-9],[-3,2]],
    [PATH[2], [0,5], POINTS.wheel, [POINTS.overlook[0],1.4], POINTS.overlook],
  ];
  const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
  const segmentDistance = (x,z,a,b) => {
    const dx=b[0]-a[0], dz=b[1]-a[1];
    const u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    return Math.hypot(x-a[0]-dx*u,z-a[1]-dz*u);
  };
  function dry(x,z,r) {
    if(Math.max(Math.abs(x),Math.abs(z))+r>25 || !shoreClearance(x,z,r+.15))return false;
    if(pathDistance(x,z)<1.65+r)return false;
    for(const route of extraRoutes)for(let i=1;i<route.length;i++) {
      if(segmentDistance(x,z,route[i-1],route[i])<1.3+r)return false;
    }
    for(const [name,[lx,lz]] of Object.entries(POINTS)) {
      if(Math.hypot(x-lx,z-lz)<(landmarkRadii[name]??2)+r)return false;
    }
    const y=height(x,z);
    if(!Number.isFinite(y))return false;
    // Whole footprints, not just roots: no bank overhang or steep-slope floating.
    for(let i=0;i<8;i++) {
      const a=i*TAU/8, sx=x+Math.cos(a)*r, sz=z+Math.sin(a)*r, sy=height(sx,sz);
      if(!shoreClearance(sx,sz,.15)||!Number.isFinite(sy)||Math.abs(sy-y)>.22)return false;
    }
    return true;
  }
  function free(x,z,r) {
    return dry(x,z,r)&&occupied.every(p=>Math.hypot(x-p.x,z-p.z)>r+p.r+.12);
  }
  function find(cx,cz,r,reach=3) {
    // Deterministic bounded search: shrinking valid land reduces population.
    for(let i=0;i<65;i++) {
      const a=i*2.399963, d=i?reach*Math.sqrt(i/64):0;
      const x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d;
      if(free(x,z,r))return {x,z,r};
    }
    return null;
  }
  function spawn(name,p,scale,yaw,dynamic=false,y=height(p.x,p.z)) {
    const o=place(name,p.x,p.z,scale,yaw,{dynamic,y});
    // world.place deliberately returns an empty Group for rejected shores.
    if(!o?.getObjectByProperty('isMesh',true))return null;
    return o;
  }
  for(const [i,[x,z]] of [[-7,18],[-13,5],[-20,-2],[-19,-12]].entries()) {
    const scale=.72+i*.035, p=find(x,z,1.42*scale);
    if(!p)continue;
    const o=spawn('bramble',p,scale,i*1.7);
    if(!o)continue;
    occupied.push(p);beds.push(p);
    for(let j=0;j<2;j++) {
      const a=i*1.7+j*2.3, s=.78+j*.08;
      const q=find(p.x+Math.cos(a)*1.9,p.z+Math.sin(a)*1.9,.78*s,1.2);
      if(q&&spawn('hosta',q,s,a))occupied.push(q);
    }
    if(stumps.length<3) {
      const q=find(p.x-1.8,p.z+1.5,.48*.9,1.5);
      if(q) {
        const stump=spawn('shelf-stump',q,.9,i*.8);
        if(stump){occupied.push(q);stumps.push({o:stump,p:q});}
      }
    }
  }
  for(let i=0;i<3;i++) {
    const bed=beds[i]??{x:-9-i*4,z:18-i*9};
    // A reserved metre covers the rabbit's complete short out-and-back hop.
    const p=find(bed.x+2,bed.z+1,1,4);
    if(!p)continue;
    const o=spawn('rabbit',p,.9,i*2.1,true);
    if(!o)continue;
    occupied.push(p);
    const head=o.getObjectByName('head'), ears=['leftEar','rightEar'].map(n=>o.getObjectByName(n));
    rabbits.push({o,home:o.position.clone(),yaw:o.rotation.y,head,headY:head?.rotation.y??0,
      ears,earX:ears.map(e=>e?.rotation.x??0),phase:i*2.1,age:-1,cooldown:0,armed:true,
      dx:0,dz:0,amp:1});
  }
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
  for(const {o:stump,p} of stumps.slice(0,2)) {
    // Perch on actual shelf/wood triangles, not an assumed top of a hollow stump.
    stump.updateMatrixWorld(true);
    ray.ray.origin.set(p.x+.07,height(p.x,p.z)+3,p.z+.07);
    const hit=ray.intersectObject(stump,true)[0];
    if(!hit)continue;
    const o=spawn('kingfisher',{x:hit.point.x,z:hit.point.z},.9,birds.length*2.4,true,hit.point.y+.006);
    if(!o)continue;
    const home=o.position.clone(),head=o.getObjectByName('head');
    birds.push({o,home,yaw:o.rotation.y,age:-1,cooldown:0,armed:true,
      head,headY:head?.rotation.y??0,phase:birds.length*2.7});
  }
  for(let i=0;i<4;i++) {
    const bed=beds[i%Math.max(1,beds.length)]??{x:-12,z:14};
    const p=find(bed.x+.8,bed.z-1.4,.55,4);
    if(!p)continue;
    const o=spawn('luna-moth',p,.85,i*1.9,true,height(p.x,p.z)+.8);
    if(!o)continue;
    occupied.push(p);
    const wings=['leftWing','rightWing'].map(n=>o.getObjectByName(n));
    moths.push({o,home:o.position.clone(),yaw:o.rotation.y,wings,rest:wings.map(w=>w?.rotation.z??0),phase:i*1.9});
  }
  let motion=1, clock=0, lastTime=-Infinity;
  const facing=(o,target,dt)=>{o.rotation.y+=Math.atan2(Math.sin(target-o.rotation.y),Math.cos(target-o.rotation.y))*(1-Math.exp(-dt*9));};
  function update(dt,t,pos,gentle=false) {
    if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(t))return;
    const step=Math.min(dt,.1);
    motion+=( (gentle?.2:1)-motion)*(1-Math.exp(-step*4));
    if(t<lastTime) {
      clock=0;
      for(const a of [...rabbits,...birds]){a.age=-1;a.cooldown=0;a.armed=true;a.o.position.copy(a.home);a.o.rotation.y=a.yaw;}
    }
    lastTime=t;clock+=step*(gentle?.5:1);
    const near=(a,r)=>pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.z)&&dist(pos,a.home)<r&&(!Number.isFinite(pos.y)||Math.abs(pos.y-a.home.y)<2.5);
    for(const r of rabbits) {
      r.cooldown=Math.max(0,r.cooldown-step);
      if(!near(r,4))r.armed=true;
      if(r.age<0&&r.armed&&r.cooldown===0&&near(r,2.7)) {
        const a=Math.atan2(r.home.x-pos.x,r.home.z-pos.z);
        r.dx=Math.sin(a)*.58;r.dz=Math.cos(a)*.58;r.amp=gentle?.35:1;
        r.age=0;r.armed=false;r.cooldown=10;
      }
      if(r.age>=0) {
        r.age+=step*(gentle?.6:1);
        const outbound=r.age<.65, waiting=r.age>=.65&&r.age<1.25;
        const u=outbound?Math.min(1,r.age/.65):waiting?1:Math.min(1,(r.age-1.25)/.65);
        const smooth=u*u*(3-2*u), f=outbound?smooth:waiting?1:1-smooth;
        const x=r.home.x+r.dx*f,z=r.home.z+r.dz*f;
        r.o.position.set(x,height(x,z)+(waiting?0:Math.sin(Math.PI*u)*.13*r.amp),z);
        if(!waiting)facing(r.o,Math.atan2(r.dx,r.dz)+(outbound?0:Math.PI),step);
        if(r.age>=1.9){r.age=-1;r.o.position.copy(r.home);}
      }else facing(r.o,r.yaw,step);
      if(r.head)r.head.rotation.y=r.headY+Math.sin(clock*.8+r.phase)*.10*motion;
      r.ears.forEach((ear,i)=>{if(ear)ear.rotation.x=r.earX[i]+Math.max(0,Math.sin(clock*1.3+r.phase+i*.7))**12*.20*motion;});
    }
    for(const b of birds) {
      b.cooldown=Math.max(0,b.cooldown-step);
      if(!near(b,4.5))b.armed=true;
      if(b.age<0&&b.armed&&b.cooldown===0&&near(b,3)) {b.age=0;b.armed=false;b.cooldown=15;}
      if(b.age>=0) {
        b.age+=step*(gentle?.55:1);
        // The selected bird has folded, rigid wings: a tiny perch hop, no flight.
        const u=Math.min(1,b.age/.5);
        b.o.position.set(b.home.x,b.home.y+Math.sin(Math.PI*u)*.045*motion,b.home.z);
        if(u===1){b.age=-1;b.o.position.copy(b.home);}
      }else facing(b.o,b.yaw,step);
      if(b.head)b.head.rotation.y=b.headY+Math.sin(clock*.7+b.phase)*.14*motion;
    }
    for(const m of moths) {
      const a=clock*.6+m.phase;
      m.o.position.set(m.home.x+Math.cos(a)*.18,m.home.y+Math.sin(a*1.7)*.06*motion,m.home.z+Math.sin(a)*.18);
      m.o.rotation.y=m.yaw+Math.sin(a)*.3*motion;
      m.wings.forEach((wing,i)=>{if(wing)wing.rotation.z=m.rest[i]+(i?1:-1)*Math.sin(clock*9+m.phase)*.42*motion;});
    }
  }
  return {update};
}
