from pathlib import Path
base=Path('game/assets/hero.js').read_text()
a=base.index(' // One continuous cheek/jaw surface')
b=base.index('\n for(const side of [-1,1]){\n  const pre=',a)
snippet=Path('tools/head-study-template.txt').read_text()
variants={
 'a':"(()=>{const g=new THREE.SphereGeometry(1,48,40),p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),jaw=y<0?1-.20*(-y):1;p.setXYZ(i,p.getX(i)*.115*jaw,.15+y*.145,p.getZ(i)*.10);}return g;})()",
 'b':"(()=>{const points=[];for(let i=0;i<=40;i++){const t=i/40*Math.PI,y=-Math.cos(t),r=Math.sin(t)*.115*(y<0?1-.22*(-y):1);points.push(new THREE.Vector2(r,.15+y*.145));}const g=new THREE.LatheGeometry(points,56),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)*.84);return g;})()",
 'c':"(()=>{const g=new THREE.SphereGeometry(1,48,40),p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),jaw=y<0?1-.34*(-y):1;let z=p.getZ(i)*.098;if(z>0)z=Math.pow(z/.098,.68)*.098;p.setXYZ(i,p.getX(i)*.116*jaw,.15+y*.142,z);}return g;})()"
}
for name,geom in variants.items():
 chosen=snippet if name=='a' else Path('tools/head-previous-template.txt').read_text()
 s=base[:a]+chosen.replace('HEAD_GEOMETRY',geom)+base[b:]
 s=s.replace('0x402b3f','0x543321').replace('0x5a3b50','0x72472f')
 s=s.replace('taper(hips,lining,0,.391', 'taper(hips,skin,0,.391').replace('taper(fore,coral,0,-.083','taper(fore,skin,0,-.083').replace('taper(fore,lining,0,-.170','taper(fore,cream,0,-.170')
 s=s.replace("const cape=pivot('cape',hips,0,.325,-.007);", "const cape=pivot('cape',hips,0,.325,-.007);cape.scale.set(.89,.80,.94);")
 s=s.replace(' // Separate chest articulation', " lathe(hips,copper,[[.019,0],[.017,.007],[.011,.027],[0,.034]],.028,.185,.132);stroke(hips,leather,[[.028,.225,.131],[.028,.245,.126]],.0025);\n // Separate chest articulation")
 if name=='a':s=s.replace('taper(hips,skin,0,.391,-.003,.065,.068,.070','taper(hips,skin,0,.391,-.003,.045,.068,.070')
 Path('game/assets/hero-study-'+name+'.js').write_text(s)
