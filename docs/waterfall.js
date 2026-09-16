// Original animated water effect in the distant ravine; no imported geometry or media.
export function createWaterfall(T,scene){
 const root=new T.Group();root.name='Ravine water and spray';scene.add(root);
 const positions=[],uv=[],indices=[];for(let i=0;i<=28;i++){const f=i/28,w=.48+Math.sin(f*Math.PI)*.24;for(const side of [-1,1]){positions.push(2.8+Math.sin(f*Math.PI)*.20,1.1-f*6.8,-21+side*w);uv.push(side<0?0:1,f);}if(i<28){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{time:{value:0}}]);
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,fog:true,
 vertexShader:`varying vec2 vUv; #include <fog_pars_vertex>\nvoid main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;#include <fog_vertex>\n}`.replaceAll('; #include',';\n#include').replaceAll(';#include',';\n#include'),
 fragmentShader:`uniform float time;varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){float strand=.5+.5*sin(vUv.x*68.+sin(vUv.y*11.-time*3.)*1.2);float rush=.5+.5*sin(vUv.y*48.-time*13.+vUv.x*8.);float edge=pow(max(0.,1.-abs(vUv.x-.5)*2.),.7);vec3 colour=mix(vec3(.51,.78,.74),vec3(.94,.98,.85),.45+.35*strand);gl_FragColor=vec4(colour,edge*(.28+.25*strand+.10*rush));\n#include <fog_fragment>\n}`});
 root.add(new T.Mesh(geometry,material));
 const g=new T.BufferGeometry(),p=new Float32Array(30*3);g.setAttribute('position',new T.BufferAttribute(p,3));const spray=new T.Points(g,new T.PointsMaterial({color:0xc6e7d6,size:.18,transparent:true,opacity:.26,depthWrite:false}));root.add(spray);
 function update(t){uniforms.time.value=t;for(let i=0;i<30;i++){const f=(t*.23+i*.137)%1;p[i*3]=3.2+Math.sin(i*4.1+t*.3)*f*1.4;p[i*3+1]=-5.6+f*1.2;p[i*3+2]=-21+Math.cos(i*2.7)*f*1.8;}g.attributes.position.needsUpdate=true;}
 return {root,update};
}
