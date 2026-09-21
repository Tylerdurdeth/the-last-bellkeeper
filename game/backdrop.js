import {bakeStatic} from './assetlib.js';

/** Composed, non-traversable depth using only the reviewed tree and rock recipes. */
export function buildBackdrop(T, scene, {prototypes, art, height}) {
  const root = new T.Group();
  root.name = 'Woodland valley backdrop';
  const bands = [new T.Group(), new T.Group(), new T.Group()];
  const materialCaches = bands.map(() => new Map());
  const colours = [
    {foliage:0x426f65, timber:0x46665c, stone:0x597d77},
    {foliage:0x608c85, timber:0x5e7d76, stone:0x71968e},
    {foliage:0x7eaaa4, timber:0x7b9c94, stone:0x8db0a6}
  ];
  function recolour(o, band) {
    o.traverse(n => {
      if (!n.isMesh) return;
      const convert = source => {
        const family = source.name === 'foliage' ? 'foliage' : source.name === 'stone' ? 'stone' : 'timber';
        // Keep three quiet values in foliage, but remove near-field bark/leaf texture noise.
        const oldLuma = source.color ? (source.color.r+source.color.g+source.color.b)/3 : .3;
        const value = oldLuma < .10 ? -.035 : oldLuma > .32 ? .035 : 0;
        const key = family+':'+value;
        if (!materialCaches[band].has(key)) {
          const color = new T.Color(colours[band][family]);
          color.offsetHSL(0, 0, value);
          const m = band===2
            ? new T.MeshBasicMaterial({color,side:source.side,fog:true})
            : new T.MeshStandardMaterial({color,side:source.side,fog:true,roughness:1,metalness:0});
          m.name = source.name;
          materialCaches[band].set(key, m);
        }
        return materialCaches[band].get(key);
      };
      n.material = Array.isArray(n.material) ? n.material.map(convert) : convert(n.material);
      n.castShadow = n.receiveShadow = band===0;
    });
  }
  function place(name, band, x, y, z, sx, sy, sz, yaw=0) {
    // The old painted valley is now traversable. Keep its large non-colliding
    // silhouettes entirely outside the rootway and Heartwood action window.
    if(x>-10&&x<28&&z-16<-25)return;
    const o=prototypes[name].clone(true);
    // The reviewed small rock includes tiny moss leaves. At cliff scale those
    // become metre-wide spikes; reuse its rock masses without those attachments.
    if(name==='rock'){
      const moss=[];o.traverse(n=>{if(n.isMesh&&n.material?.name==='foliage')moss.push(n);});
      for(const n of moss)n.parent.remove(n);
    }
    o.position.set(x,y,z);o.scale.multiply(new T.Vector3(sx,sy,sz));o.rotation.y=yaw;
    recolour(o,band);bands[band].add(o);
  }

  // Garden backdrop: a staggered stand, not an evenly spaced wall. A lower gap
  // east of the listening garden opens onto the valley beyond the finish ledge.
  const nearTrees=[
    [-31,-27,.93,.86,.88,.2],[-24,-30,.86,1.05,.83,1.7],
    [-17,-27,.84,.82,.85,2.8],[-7,-30,1.04,.96,.92,.8],
    [3,-28,.96,.86,.86,2.4],[20,-29,1.03,.88,.88,1.1]
  ];
  for(const [x,z,sx,sy,sz,yaw] of nearTrees) {
    const base=x>2?-6.6:height(x,z)-.35;
    place('tree',0,x,base,z,sx,sy,sz,yaw);
  }
  const middleTrees=[
    [-34,-37,1.1,.88,1.05,.5],[-25,-39,1.25,1.02,1.04,2.1],
    [-13,-35,1.0,.81,.9,1.2],[-2,-38,1.1,.95,.91,2.9],
    [10,-35,1.08,.84,1.03,.1],[29,-36,1.14,1.10,1.00,1.7]
  ];
  for(const [x,z,sx,sy,sz,yaw] of middleTrees)place('tree',1,x,x>2?-6.8:-.3,z,sx,sy,sz,yaw);
  const farTrees=[
    [-32,-47,1.2,1.13,1.08,2],[-18,-46,1.25,1.24,1.1,.4],
    [-5,-49,1.3,1.16,1.1,1.9],[7,-46,1.26,1.17,1.07,2.5],
    [21,-48,1.20,1.35,1.1,.8],[35,-44,1.1,1.04,1.0,1.5]
  ];
  for(const [x,z,sx,sy,sz,yaw] of farTrees)place('tree',2,x,-5.8,z,sx,sy,sz,yaw);

  // Broken mineral banks conceal the straight engineered terrain descent.
  // Their tops sit below the playable ledge; none enter the standing pocket.
  for(const [x,z,sx,sy,sz,yaw] of [
    [3,-16,4.8,15.0,5.4,.4],[9,-21.5,5.5,5.6,5.2,1.0],
    [17,-19.8,6.8,8.8,5.8,2.1],[25,-20.5,5.6,10.0,6.3,2.8],
    [31,-20,7.0,9.8,6.8,.7]
  ])place('rock',0,x,-6.8,z,sx,sy,sz,yaw);
  // Upright fractured masses cover the west-facing return of the valley bank,
  // whose near-vertical height-field face would otherwise read as a cut rectangle.
  for(const [x,z,sx,sy,sz,yaw] of [
    [1.2,-18.5,4.2,15.5,6.0,.35],
    [.5,-25.5,4.6,17.8,7.0,1.7],
    [1.8,-33.5,5.0,16.0,7.8,2.7]
  ])place('rock',0,x,-6.9,z,sx,sy,sz,yaw);
  for(const [x,z,sx,sy,sz,yaw] of [
    [0,-27,7.8,7.5,8.0,1.3],[10,-29,7.5,10.0,8.2,.4],
    [21,-26,8.0,8.4,8.0,2.0],[33,-31,8.2,12.0,9.0,1.8],
    [-21,-30,6.0,4.6,5.0,.5],[-30,-32,5.2,5.0,5.8,2.5]
  ])place('rock',1,x,x<0?-1.4:-8.0,z,sx,sy,sz,yaw);
  for(const [x,z,sx,sy,sz,yaw] of [
    [-10,-42,13,10,10,1.1],[6,-43,14,14,11,2.1],
    [24,-42,14,11,12,.3],[40,-47,15,16,13,1.7]
  ])place('rock',2,x,-10,z,sx,sy,sz,yaw);

  let triangles=0,draws=0;
  for(let i=0;i<bands.length;i++) {
    const baked=bakeStatic(bands[i]);baked.name=`Valley depth ${i+1}`;
    baked.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=i===0;
      triangles+=(n.geometry.index?n.geometry.index.count:n.geometry.attributes.position.count)/3;
      draws+=Array.isArray(n.material)?n.material.length:1;
    }});
    root.add(baked);
  }
  // These are whole-backdrop upper bounds, before normal frustum/fog visibility.
  root.userData.budget={triangles,draws,treeCopies:18,rockCopies:18};
  if(triangles>300000||draws>80)throw new Error(`Backdrop exceeds allocation: ${triangles} triangles, ${draws} draws`);
  scene.add(root);
  art.style(root);
  return {root,update(){}};
}
