import {PATH, height, POINTS,TERRAIN} from './world-layout.js';

// Camera right = (cos yaw, -sin yaw); canvas down = (sin yaw, cos yaw).
// Thus camera-forward (-sin yaw, -cos yaw) always projects to (0, -1).
export function projectMap(x, z, yaw) {
  return [Math.cos(yaw) * x - Math.sin(yaw) * z,
    Math.sin(yaw) * x + Math.cos(yaw) * z];
}

let terrain;
function terrainChart() {
  if (terrain) return terrain;
  terrain = document.createElement('canvas');
  terrain.width = terrain.height = 280;
  const ctx = terrain.getContext('2d');
  // Cache real elevation shading and contour bands once, not every frame.
  for (let row = 0; row < 280; row++) for (let col = 0; col < 280; col++) {
    const x = -35 + col / 4, z = -35 + row / 4, y = height(x, z);
    const slope = height(x + .25, z) - height(x, z + .25);
    const contour = Math.floor(y * 2) !== Math.floor(height(x + .25, z + .25) * 2);
    ctx.fillStyle = y < -.35 ? '#789a96' : contour ? '#a6aa86' :
      `hsl(65 22% ${Math.max(57, Math.min(80, 76 - y * 3 + slope * 12))}%)`;
    ctx.fillRect(col, row, 1, 1);
  }
  return terrain;
}

export function drawWoodlandMap(ctx, canvas, state, movement, cameraYaw) {
  if (!ctx || !state.started) return;
  const ink = '#283f39', copper = '#965b38', paper = '#eee0bb';
  const cx = 150, cy = 151, radius = 105;
  const locations = [
    ['M', 'Morning bell', POINTS.morningBell], ['C', 'Mara’s bypass', POINTS.cottage],
    ['W', 'Seed wheel', POINTS.wheel], ['G', 'Listening garden', POINTS.garden],
    ['F', 'Far bell', POINTS.overlook],
  ];
  const all = [...PATH, ...Object.values(POINTS)];
  const xs = all.map(p => p[0]), zs = all.map(p => p[1]);
  const ox = (Math.min(...xs) + Math.max(...xs)) / 2;
  const oz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const p = movement.position;
  // A rotation-invariant fit prevents zoom breathing as the camera orbits.
  const extent = Math.max(...all.map(([x,z]) => Math.hypot(x-ox,z-oz)), Math.hypot(p.x-ox,p.z-oz)) + 3;
  const scale = (radius - 9) / extent;
  const project = (x,z) => {
    const [u,v] = projectMap(x-ox,z-oz,cameraYaw);
    return [cx+u*scale,cy+v*scale];
  };
  ctx.save();
  ctx.setTransform(canvas.width / 300, 0, 0, canvas.height / 354, 0, 0);
  ctx.clearRect(0,0,300,354);
  ctx.fillStyle = paper; ctx.fillRect(0,0,300,354);
  ctx.strokeStyle = '#b78a59'; ctx.lineWidth = 1; ctx.strokeRect(7.5,7.5,285,339);
  const text = (s,x,y,size=11,color=ink,align='left') => {
    ctx.fillStyle=color;ctx.font=`${size}px ${size>15?'Georgia':'system-ui'}`;
    ctx.textAlign=align;ctx.fillText(s,x,y);
  };
  text('THE WAKING BOUGH',150,29,17,ink,'center');
  text('FIELD CHART  /  CAMERA UP',150,45,9,copper,'center');
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#d7cba5';ctx.fillRect(0,46,300,212);
  ctx.save();ctx.translate(cx,cy);ctx.rotate(cameraYaw);ctx.scale(scale,scale);
  ctx.drawImage(terrainChart(),-35-ox,-35-oz,70,70);ctx.restore();
  const line = (points,color,width,dash=[]) => {
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();
    points.forEach(([x,z],i)=>{const [u,v]=project(x,z);i?ctx.lineTo(u,v):ctx.moveTo(u,v);});
    ctx.stroke();ctx.setLineDash([]);
  };
  ctx.lineJoin=ctx.lineCap='round';
  line(PATH,'#f8edcf',5);line(PATH,'#967347',1.6);
  // Crossing endpoints match the bridge in world.js; no route is invented.
  const {x:bridgeX,z:bridgeZ,length:bridgeLength}=TERRAIN.bridge;
  const crossing=[[bridgeX,bridgeZ+bridgeLength/2],[bridgeX,bridgeZ-bridgeLength/2]];
  line(crossing,paper,7);
  line(crossing,state.restored?'#315f50':copper,3,state.restored?[]:[3,3]);
  const [bx,by]=project(8,-3.35);
  if (!state.restored) {
    ctx.strokeStyle=copper;ctx.lineWidth=2;ctx.beginPath();
    ctx.moveTo(bx-4,by-4);ctx.lineTo(bx+4,by+4);ctx.moveTo(bx+4,by-4);ctx.lineTo(bx-4,by+4);ctx.stroke();
  }
  const badge = (label,x,y,muted=false) => {
    ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle=paper;ctx.fill();
    ctx.strokeStyle=muted?'#777768':copper;ctx.lineWidth=1.2;ctx.stroke();
    text(label,x,y+3,9,muted?'#777768':ink,'center');
  };
  // Mara's copper channel, drawn from her valve to the outlet beside the seed wheel.
  line([POINTS.bypass,[-1.15,9.4],POINTS.outlet],copper,1.4,[2,2]);
  // The listening garden is optional: a muted badge until its song is played.
  for (const [label,,[x,z]] of locations) badge(label,...project(x,z),label==='F'&&!state.restored||label==='G'&&!state.gardenSolved);
  const [px,py]=project(p.x,p.z);
  const [dx,dy]=projectMap(Math.sin(movement.yaw),Math.cos(movement.yaw),cameraYaw);
  ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
  ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,7);ctx.lineTo(0,4);ctx.lineTo(-6,7);ctx.closePath();
  ctx.fillStyle=ink;ctx.strokeStyle='#fff5d9';ctx.lineWidth=2.5;ctx.fill();ctx.stroke();ctx.restore();
  ctx.restore();
  ctx.strokeStyle='#9a744a';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,radius+3,0,Math.PI*2);ctx.stroke();
  // North follows the same projection, independently of the player heading.
  const [nx,ny]=projectMap(0,-1,cameraYaw);
  ctx.beginPath();ctx.arc(cx+nx*96,cy+ny*96,8,0,Math.PI*2);ctx.fillStyle=paper;ctx.fill();
  text('N',cx+nx*96,cy+ny*96+3,10,copper,'center');
  ctx.strokeStyle='#b78a5966';ctx.beginPath();ctx.moveTo(19,276);ctx.lineTo(281,276);ctx.stroke();
  for (let i=0;i<locations.length;i++) {
    const [label,name]=locations[i], x=27+(i%2)*137, y=291+Math.floor(i/2)*20;
    badge(label,x,y-3);text(name,x+12,y,10);
  }
  text('▲ You / facing',164,331,10);
  text(state.restored?'CROSSING RESTORED · OPEN':'CROSSING LOCKED · FIND WIND',150,266,10,state.restored?'#315f50':copper,'center');
  ctx.restore();
  const description=`Woodland map, camera-up. Directional marker shows your facing. Crossing ${state.restored?'restored and open':'locked; carry wind to the wheel'}. M morning bell, C Mara's cottage and bypass, W seed wheel, G optional listening garden, F far bell.`;
  if(canvas.getAttribute('aria-label')!==description)canvas.setAttribute('aria-label',description);
}
