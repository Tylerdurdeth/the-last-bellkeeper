import {cp,mkdir,readdir,rm} from 'node:fs/promises';
// Fail before changing docs if downloaded mesh assets enter the shipping tree.
for(const file of await readdir('game',{recursive:true}))if(/\.(glb|gltf|fbx|obj|ply|stl)$/i.test(file))throw Error('Jam build forbids mesh file: '+file);
// docs is generated solely from game; preserve the prior deployment in git history.
for(const name of await readdir('docs'))await rm('docs/'+name,{recursive:true,force:true});
await cp('game','docs',{recursive:true,filter:source=>!source.split('/').includes('_verify')});
await mkdir('docs/vendor',{recursive:true});
for(const file of ['three.module.js','three.core.js'])await cp('node_modules/three/build/'+file,'docs/vendor/'+file);
await cp('node_modules/three/examples/jsm/utils/BufferGeometryUtils.js','docs/vendor/BufferGeometryUtils.js');
await cp('node_modules/three/LICENSE','docs/vendor/THREE-LICENSE.txt');
console.log('Built self-contained docs/');

await mkdir("docs/vendor/loaders",{recursive:true});await mkdir("docs/vendor/utils",{recursive:true});
await cp("node_modules/three/examples/jsm/loaders/GLTFLoader.js","docs/vendor/loaders/GLTFLoader.js");
await cp("node_modules/three/examples/jsm/utils/BufferGeometryUtils.js","docs/vendor/utils/BufferGeometryUtils.js");
