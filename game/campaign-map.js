// Camera-right/down projection matches movement and the woodland field chart.
export function drawCampaignMap(ctx,canvas,position,yaw,points,progress,facing=0){
 const chamber=position.z<-44,ink='#243e37',paper='#eee0bb',copper='#965b38';
 const center={x:8,z:chamber?-59:-30},scale=chamber?7.2:5.2,cx=150,cy=154;
 const project=p=>{const x=p.x-center.x,z=p.z-center.z;return [cx+(x*Math.cos(yaw)-z*Math.sin(yaw))*scale,cy+(x*Math.sin(yaw)+z*Math.cos(yaw))*scale];};
 ctx.save();ctx.setTransform(canvas.width/300,0,0,canvas.height/354,0,0);ctx.clearRect(0,0,300,354);ctx.fillStyle=paper;ctx.fillRect(0,0,300,354);ctx.strokeStyle='#b78a59';ctx.lineWidth=1;ctx.strokeRect(7.5,7.5,285,339);
 const text=(s,x,y,size=10,align='center',color=ink)=>{ctx.font=size+'px '+(size>14?'Georgia':'system-ui');ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,x,y);};
 text(chamber?'THE HEARTWOOD':'THE ROOTWAY',150,29,17);text('FIELD CHART / CAMERA UP',150,45,9,'center',copper);
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,106,0,Math.PI*2);ctx.clip();ctx.fillStyle='#8da8a0';ctx.fillRect(0,47,300,217);
 function route(coords,color,width,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(dash);ctx.beginPath();coords.forEach(([x,z],i)=>{const p=project({x,z});i?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.stroke();ctx.setLineDash([]);}
 if(chamber){ctx.beginPath();ctx.arc(cx,cy,11*scale,0,Math.PI*2);ctx.fillStyle='#d4d0ad';ctx.fill();ctx.strokeStyle='#a3946b';ctx.lineWidth=2;ctx.stroke();route([[8,-45],[8,-51]],paper,16);route([[15,-50],[15,-53],[12,-54]],paper,15);route([[5,-52],[4.4,-55],[5,-59],[8,-64.8]],'#689887',2);route([[11,-52],[10.4,-55],[11,-59],[8,-64.8]],copper,2);}
 else{route([[8,-13],[8,-19],[5,-22],[8,-24],[5,-28],[8,-29]],'#d4d0ad',18);route([[8,-34],[8,-38],[5,-41],[8,-45]],'#d4d0ad',18);route([[8,-29],[8,-34]],progress.bridge?paper:copper,8,progress.bridge?[]:[3,4]);}
 const keys=chamber?['chamberEntry','inspection','returnWheel','returnVane','outwardVane','finalBell','homeLift']:['entry','source','bridgeWheel','service','chamberEntry'];
 const symbols=chamber?['G','I','R','1','2','B','H']:['B','G','W','T','H'];
 keys.forEach((key,i)=>{if(!points[key])return;const [x,y]=project(points[key]);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=copper;ctx.lineWidth=1.2;ctx.stroke();text(symbols[i],x,y+3,9);});
 const [px,py]=project(position),dx=Math.sin(facing)*Math.cos(yaw)-Math.cos(facing)*Math.sin(yaw),dy=Math.sin(facing)*Math.sin(yaw)+Math.cos(facing)*Math.cos(yaw);
 ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fillStyle=ink;ctx.strokeStyle='#fff5d9';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();ctx.restore();
 ctx.beginPath();ctx.arc(cx,cy,109,0,Math.PI*2);ctx.strokeStyle='#9a744a';ctx.lineWidth=1;ctx.stroke();
 const labels=chamber?['G Inlet','I Inspection','R Root wheel','1 Return','2 Outward','B Heart bell','H Home lift']:['B The bough','G Gust inlet','W Bridge wheel','T Tender','H Windworks'];
 labels.forEach((label,i)=>text(label,24+(i%2)*137,289+Math.floor(i/2)*15,10,'left'));
 text(progress.restored?'BALANCE RESTORED':chamber?'OUTWARD · RETURN · BALANCE':progress.bridge?'SERVICE CROSSING OPEN':'SERVICE CROSSING LOCKED',150,269,9,'center',copper);ctx.restore();
 canvas.setAttribute('aria-label',(chamber?'Heartwood':'Rootway')+' camera-aligned chart. Directional player marker. '+labels.join(', ')+'.');
}
