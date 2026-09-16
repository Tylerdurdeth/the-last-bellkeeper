export default function(T){

 const root=new T.Group();
 const mat=(color,name='timber',roughness=.9)=>{const m=new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});m.name=name;return m;};
 const wood=mat(0x715140),woodLight=mat(0x9B7657),bark=mat(0x5A5040),ivory=mat(0xE7DDC2,'plaster'),stone=mat(0x929884,'stone'),copper=mat(0xB76F48,'metal',.55),patina=mat(0x629082,'metal',.7),dark=mat(0x253C38,'timber'),leaf=mat(0x3F7860,'foliage'),leafLight=mat(0x90AE68,'foliage'),leafDark=mat(0x285849,'foliage'),coral=mat(0xD96956,'foliage'),teal=mat(0x62C9BC,'foliage'),rope=mat(0xB49E77,'fabric');
 const mesh=(geo,m,x=0,y=0,z=0,parent=root)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
 const box=(m,x,y,z,w,h,d,parent=root)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);
 const ell=(m,x,y,z,a,b,c,parent=root)=>{const o=mesh(new T.SphereGeometry(1,8,6),m,x,y,z,parent);o.scale.set(a,b,c);return o;};
 const rod=(m,a,b,r1,r2=r1,parent=root,n=8)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const o=mesh(new T.CylinderGeometry(r2,r1,d.length(),n),m,0,0,0,parent);o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
 const curve=(m,points,r=.08,taper=.7,parent=root,segments=16,sides=7)=>{const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const g=new T.TubeGeometry(path,segments,r,sides,false),a=g.attributes.position,v=new T.Vector3();for(let i=0;i<=segments;i++){const center=path.getPointAt(i/segments);const scale=1-(1-taper)*i/segments;for(let j=0;j<=sides;j++){const k=i*(sides+1)+j;v.fromBufferAttribute(a,k).sub(center).multiplyScalar(scale).add(center);a.setXYZ(k,v.x,v.y,v.z);}}g.computeVertexNormals();return mesh(g,m,0,0,0,parent);};
 const shape=(m,points,depth,x=0,y=0,z=0,parent=root,bevel=.02)=>{const s=new T.Shape();points.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();return mesh(new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1}),m,x,y,z,parent);};
 const blade=(m,length=.3,width=.10,parent=root)=>{const s=new T.Shape();s.moveTo(0,0);s.quadraticCurveTo(width,.3*length,0,length);s.quadraticCurveTo(-width,.3*length,0,0);const g=new T.ShapeGeometry(s,3);const a=g.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i);a.setZ(i,Math.sin(y/length*Math.PI)*width*.5);}g.computeVertexNormals();return mesh(g,m,0,0,0,parent);};
 const ring=(m,x,y,z,r,t=.03,parent=root)=>mesh(new T.TorusGeometry(r,t,5,16),m,x,y,z,parent);
 const pot=(x,y,z,size=.3,m=copper)=>{const pts=[[.48,0],[.65,.15],[.70,.6],[.46,.85],[.45,1]].map(([r,h])=>new T.Vector2(r*size,h*size));const o=mesh(new T.LatheGeometry(pts,10),m,x,y,z);ring(m,x,y+size,z,size*.45,.025).rotation.x=Math.PI/2;return o;};
 const leafSpray=(x,y,z,angle,count=11,size=.4,parent=root)=>{const g=new T.Group();g.position.set(x,y,z);g.rotation.set(.25,angle,-.2);parent.add(g);for(let i=0;i<count;i++){const a=i*2.39996;const r=Math.sqrt(i/count)*size;const l=blade(i%3===0?leafLight:i%3===1?leaf:leafDark,size*(.65+(i%4)*.12),size*.22,g);l.position.set(Math.cos(a)*r,Math.sin(a)*r*.55,Math.sin(a*1.3)*r);l.rotation.set(-.6+(i%3)*.35,a,Math.sin(a)*.6);}return g;};


 shape(ivory,[[-1.9,0],[1.9,0],[1.85,2.7],[1.1,3.3],[.1,4.55],[-.7,4.15],[-1.8,2.7]],2.9,0,0,-1.45);
 const roof=new T.Shape();roof.moveTo(-2.5,2.7);roof.bezierCurveTo(-1.3,2.8,-1.1,4.8,.05,5.45);roof.bezierCurveTo(.75,5.55,1.25,3.05,2.5,2.65);roof.lineTo(2.5,2.84);roof.bezierCurveTo(1.4,3.2,.9,5.7,.05,5.65);roof.bezierCurveTo(-1.25,5,-1.5,3,-2.5,2.9);roof.closePath();mesh(new T.ExtrudeGeometry(roof,{depth:3.65,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:1,curveSegments:10}),copper,0,0,-1.8);
 for(const z of [-1.85,1.9])curve(wood, [[-2.48,2.82,z],[-1.5,3.4,z],[-.65,4.95,z],[.05,5.58,z],[.8,4.9,z],[1.6,3.25,z],[2.5,2.76,z]],.085,1,root,22);
 // Deep dark doorway, inset timber panels and arch carved from separate timbers.
 box(dark,-.35,1.1,1.48,1.2,2.2,.12);shape(woodLight,[[-.48,0],[.48,0],[.48,1.45],[.35,1.83],[0,2.04],[-.35,1.83],[-.48,1.45]],.12,-.35,.07,1.56);
 curve(wood,[[-1,0,1.7],[-1,1.5,1.7],[-.83,2.15,1.7],[-.35,2.43,1.7],[.15,2.15,1.7],[.3,1.5,1.7],[.3,0,1.7]],.11,1);
 for(let x=-.7;x<.1;x+=.19)box(wood,x,.83,1.7,.025,1.5,.025);ring(copper,-.05,1.1,1.76,.10,.025);ring(copper,-.35,1.65,1.72,.21,.04);mesh(new T.CircleGeometry(.17,16),dark,-.35,1.65,1.715);
 mesh(new T.CircleGeometry(.42,20),dark,0,3.48,1.49);ring(woodLight,0,3.48,1.62,.45,.095);box(woodLight,0,3.48,1.66,.07,.85,.06);box(woodLight,0,3.48,1.66,.85,.07,.06);
 for(const side of [-1,1]){box(wood,side*1.88,1.3,0,.13,2.6,.15);const win=box(dark,side*1.94,1.75,0,.07,.85,1.0);box(woodLight,side*2.01,1.75,0,.09,.09,1.1);box(woodLight,side*2.01,1.75,0,.09,.95,.08);box(woodLight,side*2.06,1.22,0,.38,.12,1.28);}
 box(wood,0,1.65,-1.52,2.5,.14,.12);box(dark,.6,1.8,-1.53,.7,.8,.04);box(woodLight,.6,1.8,-1.6,.055,.8,.06);
 box(stone,0,.12,1.9,3.6,.24,1.2);box(stone,-.4,.04,2.55,1.7,.08,.5);pot(1.0,.24,2,.65);pot(1.65,.24,1.75,.4);box(woodLight,-1.65,.85,1.85,.65,.10,.65);rod(wood,[-1.85,.2,1.8],[-1.85,.8,1.8],.05);rod(wood,[-1.45,.2,1.8],[-1.45,.8,1.8],.05);pot(-1.65,.9,1.85,.25);
 for(let i=0;i<3;i++){rod(wood,[.85+i*.22,1.6,1.63],[.85+i*.22,2.4,1.63],.025);ring(copper,.85+i*.22,1.65,1.67,.07,.018);}
 ring(copper,.04,5.60,1.97,.24,.055);curve(copper,[[.04,5.6,1.98],[-.02,5.88,1.98],[.2,5.96,1.98],[.32,5.73,1.98]],.04,.7);

 // Inhabited detail is attached to construction: windows, eaves, pegs and threshold.
 const amber=mat(0xDDB970,'plaster');amber.emissive=new T.Color(0x9B5C27);amber.emissiveIntensity=.22;
 mesh(new T.CircleGeometry(.395,20),amber,0,3.48,1.56);
 mesh(new T.CircleGeometry(.159,16),amber,-.35,1.65,1.73);
 for(const side of [-1,1]){
  box(amber,side*1.985,1.75,0,.022,.78,.94);
  // Deep timber window box with soil, uneven leafy stems and copper fastenings.
  box(wood,side*2.10,1.17,0,.42,.26,1.23);box(dark,side*2.10,1.31,0,.31,.025,1.10);
  for(const z of [-.5,.48]){box(copper,side*2.32,1.18,z,.02,.27,.06);rod(wood,[side*1.95,.87,z],[side*2.28,1.13,z],.045);}
  for(let i=0;i<13;i++){const z=-.49+i*.078,x=side*(2.06+.08*Math.sin(i*2.4)),h=.12+(i%3)*.055;rod(leafDark,[x,1.32,z],[x,1.32+h,z],.009,.005);for(const sign of [-1,1]){const l=blade(i%3?leaf:leafLight,.18,.07);l.position.set(x,1.33+h*.5,z);l.rotation.set(.5+i*.17,sign*.7,sign*.8);}if(i%4===0)ell(coral,x,1.37+h,z,.045,.035,.04);}
 }
 box(amber,.6,1.8,-1.57,.63,.73,.025);
 box(woodLight,.6,1.8,-1.62,.72,.06,.06);
 // Standing seams follow the actual roof curves, including irregular seam spacing.
 for(const z of [-1.15,-.32,.54,1.26]){
  const leftCurve=new T.CubicBezierCurve3(new T.Vector3(-2.5,2.92,z),new T.Vector3(-1.5,3.02,z),new T.Vector3(-1.25,5.02,z),new T.Vector3(.05,5.67,z));
  const rightCurve=new T.CubicBezierCurve3(new T.Vector3(.05,5.67,z),new T.Vector3(.9,5.72,z),new T.Vector3(1.4,3.22,z),new T.Vector3(2.5,2.86,z));
  mesh(new T.TubeGeometry(leftCurve,18,.024,5,false),z<0?patina:copper);mesh(new T.TubeGeometry(rightCurve,18,.024,5,false),z<0?patina:copper);
 }
 rod(copper,[.05,5.67,-1.8],[.05,5.67,1.86],.042);
 // Right-hand lean-to porch. The entrance and its arch stay unobscured.
 const canopy=box(wood,2.18,2.62,-.08,.94,.12,2.8);canopy.rotation.z=-.47;
 for(let i=0;i<9;i++){const plank=box(i%3?woodLight:wood,2.19,2.70,-1.33+i*.31,.95,.08,.285);plank.rotation.z=-.47;}
 for(const z of [-1.24,1.14]){rod(wood,[2.49,.05,z],[2.49,2.5,z],.062,.051);rod(wood,[2.49,1.94,z],[1.9,2.66,z],.045);rod(wood,[2.49,2.02,z],[2.49,2.48,z+(z>0?-.4:.4)],.043);}
 box(wood,2.16,.10,-.04,.85,.20,2.75);
 for(let i=0;i<8;i++)box(woodLight,2.17,.23,-1.27+i*.35,.78,.07,.31);
 // An exterior shelf with a mending basket, oil bottle and folded linen.
 box(woodLight,2.15,.82,-.93,.68,.09,.66);rod(wood,[2.43,.23,-.93],[2.43,.80,-.93],.04);pot(2.08,.87,-.98,.24,rope);pot(2.30,.87,-.90,.15,patina);box(ivory,2.13,.91,-.66,.29,.08,.14);
 // Firewood at rear wall: stacked staggered logs, cut ends and growth rings.
 for(let row=0;row<3;row++)for(let i=0;i<4-row;i++){const x=-1.50+i*.29+row*.145,y=.17+row*.23,z=-1.62;rod(bark,[x,y,z],[x+.018,y+.012,z-.52-(i%2)*.12],.13,.115);const endZ=z-.53-(i%2)*.12;const end=mesh(new T.CircleGeometry(.11,9),woodLight,x+.018,y+.012,endZ);end.rotation.y=Math.PI;for(const r of [.043,.078])mesh(new T.TorusGeometry(r,.006,3,10),wood,x+.018,y+.012,endZ-.006);}
 rod(wood,[-1.72,.12,-2.3],[-1.72,.8,-2.3],.035);rod(wood,[-.24,.12,-2.3],[-.24,.8,-2.3],.035);
 // Clothesline tucked above the front tools, with four uneven cloth ribbons.
 for(const x of [.55,1.63])rod(wood,[x,2.65,1.46],[x,2.65,1.74],.038);
 curve(rope,[[.55,2.67,1.74],[1.05,2.58,1.74],[1.63,2.67,1.74]],.013,1,root,10,4);
 for(let i=0;i<4;i++){const x=.66+i*.245,y=2.61,drop=.22+(i%3)*.06;const cloth=shape(i%2?ivory:teal,[[-.07,0],[.07,0],[.055,-drop],[-.045,-drop+.025]],.007,x,y,1.75,root,0);cloth.rotation.y=Math.sin(i*2)*.15;box(wood,x,y+.015,1.76,.035,.065,.025);}
 // Copper hook and hanging planter, with trailing leaves below the porch edge.
 curve(copper,[[2.43,2.51,1.15],[2.60,2.46,1.15],[2.59,2.31,1.15]],.024,1,root,8,5);
 for(const z of [.99,1.29])rod(rope,[2.58,2.32,1.15],[2.52,1.99,z],.01);
 pot(2.52,1.70,1.15,.29,copper);
 for(let i=0;i<9;i++){const a=i*2.4;const l=blade(i%3?leaf:leafLight,.22,.065);l.position.set(2.52+Math.sin(a)*.08,1.99,1.15+Math.cos(a)*.09);l.rotation.set(.7,a,Math.sin(a)*1.5);}
 // Threshold wear and substantial door latch; tiny details stay near contact points.
 shape(ivory,[[-.55,0],[.43,.01],[.64,.05],[.38,.12],[-.44,.1]],.014,-.32,.248,1.96).rotation.x=-Math.PI/2;
 box(copper,-.12,1.08,1.81,.28,.07,.05);rod(dark,[-.24,1.09,1.85],[.02,1.09,1.85],.022);for(const x of [-.24,.01])ell(copper,x,1.09,1.87,.028,.028,.012);
 for(const y of [.44,1.3]){box(dark,-.77,y,1.76,.20,.06,.025);ell(copper,-.72,y,1.79,.021,.021,.01);}

 root.name="Bellkeeper inhabited copper-roof cottage"; root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());for(const child of root.children){child.position.x-=center.x;child.position.y-=bounds.min.y;child.position.z-=center.z;}root.updateMatrixWorld(true);return root;
}
