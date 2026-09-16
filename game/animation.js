// Original procedural acting. All poses remain local to the articulated hero.
export function createAnimator(THREE, hero, movement) {
  const joints = hero.userData.joints || {};
  const bind = new Map(Object.values(joints).map(j => [j, {position:j.position.clone(), quaternion:j.quaternion.clone(), scale:j.scale.clone()}]));
  const hips = joints.hips, head = joints.head;
  const footfalls=[];
  let phase=0, previousYaw=movement.yaw, previousGrounded=movement.grounded;
  let landing=0, launch=0, pace=0, turn=0, previousSpeed=0, acceleration=0;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
  const add=(name,x=0,y=0,z=0)=>{const j=joints[name];if(j){j.rotation.x+=x;j.rotation.y+=y;j.rotation.z+=z;}};
  const groundHipYaw=new THREE.Quaternion(), upAxis=new THREE.Vector3(0,1,0);
  const cloth={pitch:0,pitchVelocity:0,yaw:0,yawVelocity:0};
  function settleCloth(dt,pitch,yaw){
    // Damped secondary motion reacts to acceleration/turning and continues after stopping.
    const count=Math.max(1,Math.ceil(dt*120)),h=dt/count;
    for(let i=0;i<count;i++)for(const [axis,target] of [['pitch',pitch],['yaw',yaw]]){
      const v=axis+'Velocity';cloth[v]+=(190*(target-cloth[axis])-19*cloth[v])*h;cloth[axis]+=cloth[v]*h;
    }
  }
  const lengths={};
  for(const side of ['left','right']) {
    const shin=joints[side+'LowerLeg'], foot=joints[side+'Foot'];
    lengths[side]={upper:shin?.position.length()||.25, lower:foot?.position.length()||.23};
  }
  function bindPose(){for(const [j,b] of bind){j.position.copy(b.position);j.quaternion.copy(b.quaternion);j.scale.copy(b.scale);}}
  function reset(){cloth.pitch=cloth.pitchVelocity=cloth.yaw=cloth.yawVelocity=0;footfalls.length=0;bindPose();phase=0;landing=launch=pace=turn=acceleration=previousSpeed=0;previousYaw=movement.yaw;previousGrounded=movement.grounded;}
  function update(dt, {time=0,action=null,actionProgress=0,charged=false,impact=0}={}) {
    footfalls.length=0;dt=clamp(Number.isFinite(dt)?dt:0,0,.05);bindPose();if(!hips)return;
    const speed=Math.max(0,movement.speed||0), grounded=movement.grounded;
    const running=clamp((speed-2.1)/1.7,0,1);
    pace=damp(pace,clamp(speed/.9,0,1),18,dt);
    acceleration=damp(acceleration,dt?clamp((speed-previousSpeed)/dt,-20,20):0,9,dt);previousSpeed=speed;
    const angle=Math.atan2(Math.sin(movement.yaw-previousYaw),Math.cos(movement.yaw-previousYaw));
    turn=damp(turn,dt?clamp(angle/dt,-8,8):0,12,dt);previousYaw=movement.yaw;
    const justLanded=!previousGrounded&&grounded;
    if(justLanded)landing=1;
    if(previousGrounded&&!grounded&&movement.verticalVelocity>0)launch=1;
    previousGrounded=grounded;landing=Math.max(0,landing-dt/ .16);launch=Math.max(0,launch-dt/.10);
    // Cycle length is a travelled stride, so changing speed cannot make feet skate
    // from a fixed-time loop. Stance is longer when walking, shorter when running.
    const localLeg=(lengths.left.upper+lengths.left.lower+lengths.right.upper+lengths.right.lower)/2;
    hero.updateWorldMatrix(true,false);
    const scale=hips.parent.getWorldScale(new THREE.Vector3()).y || 1;
    const strideWorld=localLeg*scale*(1.7+running*.65);
    if(grounded){
      const next=phase+speed*dt/Math.max(.3,strideWorld);
      // Emit on each foot's swing-to-stance boundary. Landing has its own cue.
      if(speed>.2&&!justLanded)for(let beat=Math.floor(phase*2)+1;beat<=Math.floor(next*2);beat++)footfalls.push(beat%2?'right':'left');
      phase=next%1;
    }
    const theta=phase*Math.PI*2, stance=.62-running*.14;
    const idle=1-pace;
    const crouch=(landing*.12+launch*.035+idle*.018)*localLeg;
    const bob=(Math.cos(theta*2)*(.013+running*.008)-.016)*pace;
    // A stance foot travels backward by exactly the distance the body covers
    // during stance; matching only cycle timing still leaves visible skating.
    const reach=strideWorld*stance/(2*scale)*pace;
    // Lower the pelvis enough to reach the longest ground contact; otherwise an
    // almost straight leg target plus a long stride exceeds the chain length.
    const strideDrop=grounded?Math.max(0,localLeg*.975-Math.sqrt(Math.max(.001,(localLeg*.985)**2-reach**2))):0;
    hips.position.y+=grounded?bob-crouch-strideDrop:-localLeg*.035;
    add('hips',grounded?(.035*pace+running*.035+acceleration*.001):- .035,clamp(turn*.023,-.16,.16)+Math.sin(theta)*running*.035,clamp(-turn*.022,-.14,.14));
    add('chest',grounded?(.07*pace+running*.25+acceleration*.004):.10,-Math.sin(theta)*running*.15-clamp(turn*.018,-.12,.12),-.045*idle+Math.sin(theta)*running*.026);
    add('head',-.02-.04*pace-.13*running,clamp(turn*.025,-.22,.22),clamp(turn*.014,-.08,.08)+.03*idle);
    settleCloth(dt,-.065*pace-acceleration*.004-landing*.13-(!grounded?.09:0),-clamp(turn*.035,-.25,.25));
    for(const [side,offset,sign] of [['left',0,-1],['right',.5,1]]) {
      const l=lengths[side], p=(phase+offset)%1;
      if(grounded) {
        let z,lift;
        if(p<stance){z=reach*(1-2*p/stance);lift=0;}
        else {const t=(p-stance)/(1-stance);z=reach*(-1+2*(t*t*(3-2*t)));lift=Math.sin(t*Math.PI)*localLeg*(.19+running*.18)*pace;}
        // Lower both hips and target ankle together at landing, then bend knees.
        z+=(side==='left'?.026:-.020)*idle;
        const y=-(l.upper+l.lower)*.975+lift+crouch+strideDrop-bob;
        const distance=clamp(Math.hypot(y,z),Math.abs(l.upper-l.lower)+.001,l.upper+l.lower-.001);
        const beta=Math.acos(clamp((l.upper*l.upper+distance*distance-l.lower*l.lower)/(2*l.upper*distance),-1,1));
        const knee=Math.PI-Math.acos(clamp((l.upper*l.upper+l.lower*l.lower-distance*distance)/(2*l.upper*l.lower),-1,1));
        const thigh=-Math.atan2(z,-y)-beta;
        add(side+'UpperLeg',thigh-hips.rotation.x,0,sign*.025*pace);
        // Pelvis twist expresses the run without dragging planted feet sideways.
        groundHipYaw.setFromAxisAngle(upAxis,-hips.rotation.y);
        joints[side+'UpperLeg']?.quaternion.premultiply(groundHipYaw);
        add(side+'LowerLeg',knee);
        add(side+'Foot',-thigh-knee-(p>stance?.12*running:0));
      } else {
        const rising=clamp(movement.verticalVelocity/6,0,1);
        const falling=clamp(-movement.verticalVelocity/5,0,1);
        const tuck=.30+rising*.48-falling*.20+(side==='left'?.15:0);
        add(side+'UpperLeg',-tuck,0,sign*.075);
        add(side+'LowerLeg',.60+rising*.70-falling*.42);
        add(side+'Foot',-.12-rising*.20+falling*.12);
      }
      const armSwing=Math.sin(theta+offset*Math.PI*2)*(.33+running*(side==='left'?.57:.16))*pace;
      add(side+'UpperArm',grounded?armSwing:-.40,side==='left'?-running*.10:0,sign*(.07+running*.09+(!grounded?.13:0)));
      add(side+'LowerArm',-(.20+running*(side==='left'?.81+.16*Math.sin(theta-.65):.39))*pace-(!grounded?.65:0));
      add(side+'Hand',-.04+(side==='left'?.10*Math.sin(theta-.4)*running*pace:0),0,sign*.04);
      add('coat'+(side==='left'?'Left':'Right'),-.05+cloth.pitch+Math.sin(theta+offset*Math.PI*2-.45)*.14*pace,cloth.yaw*.55,sign*(.015+running*.04));
    }
    // Tool side remains controlled; free arm does most of the athletic swing.
    add('rightUpperArm',-.16-(charged?.12:0));
    add('rightLowerArm',-.20-(charged?.13:0));
    hips.position.y+=Math.sin(time*2.1)*.003*idle;
    const glance=Math.sin(time*.47)*Math.sin(time*.19);
    add('head',Math.sin(time*1.2)*.014*idle,glance*.15*idle);
    add('chest',.025*idle,-.075*idle);
    add('leftLowerArm',-.62*idle);
    add('leftUpperArm',.09*idle,-.11*idle,-.16*idle);
    add('leftHand',0,.16*idle,-.08*idle);
    add('cape',Math.sin(time*1.8)*.012+cloth.pitch,Math.sin(theta-.6)*.024*pace+cloth.yaw,Math.sin(time*1.3)*.012);
    if(!grounded)add('head',clamp(-movement.verticalVelocity/5,0,1)*.10);
    // Intent precedes the contact beat. No root translation or physics lock.
    const p=clamp(actionProgress,0,1);
    if(action==='capture') {
      const reach=Math.sin(Math.PI*Math.pow(p,.72));
      const intent=Math.sin(Math.PI*clamp(p/.36,0,1));
      add('chest',reach*.18+intent*.06,-reach*.19-intent*.10);
      add('head',reach*.06+intent*.08,reach*.12+intent*.23);
      add('leftUpperArm',-reach*1.12,-reach*.16,-reach*.23);
      add('leftLowerArm',-reach*.34);
      add('leftHand',-reach*.22,reach*.23);
      add('rightUpperArm',-reach*.63,reach*.12);
      add('rightLowerArm',-reach*.31);
    } else if(action==='release') {
      const windup=p<.28?Math.sin(p/.28*Math.PI/2):Math.max(0,1-(p-.28)/.16);
      const strike=p<.28?0:p<.48?(p-.28)/.20:Math.pow(1-(p-.48)/.52,1.6);
      add('chest',-.13*windup+.26*strike,-.28*windup+.18*strike);
      add('head',-.04*windup+.09*strike,.17*windup-.10*strike);
      add('rightUpperArm',.30*windup-1.0*strike,-.12*windup);
      add('rightLowerArm',-.45*windup+.13*strike);
      add('leftUpperArm',-.35*windup-.65*strike,0,-.30*strike);
      add('leftLowerArm',-.35*windup-.25*strike);
      add('coatLeft',-.17*strike);add('coatRight',-.17*strike);
    }
    const recoil=clamp(impact,0,1);
    add('chest',-recoil*.23);add('head',recoil*.13);add('leftUpperArm',-recoil*.7,0,-recoil*.22);
  }
  return {update,reset,footfalls};
}
