from pathlib import Path
import json,struct,sys
out=Path('game/assets/character');out.mkdir(exist_ok=True)
# Usage: python3 tools/pack-character.py /path/to/extracted/base /path/to/extracted/outfits
base,outfits=sys.argv[1:3]
items=[(base,'Superhero_Male_FullBody.gltf','head'),(base,'Hair_Long.gltf','hair-long'),(outfits,'Male_Peasant.gltf','outfit')]
for root,name,dest in items:
 paths=list(Path(root).rglob(name));p=next((p for p in paths if 'Rigged to Head' in str(p)),paths[0]);j=json.loads(p.read_text());data=bytearray((p.parent/j['buffers'][0]['uri']).read_bytes())
 for m in j['materials']:
  for key in ['normalTexture','occlusionTexture','emissiveTexture']:m.pop(key,None)
  m.get('pbrMetallicRoughness',{}).pop('metallicRoughnessTexture',None)
 used=sorted({m['pbrMetallicRoughness']['baseColorTexture']['index'] for m in j['materials'] if 'baseColorTexture' in m.get('pbrMetallicRoughness',{})}); tm={v:i for i,v in enumerate(used)}
 for m in j['materials']:
  if 'baseColorTexture' in m.get('pbrMetallicRoughness',{}):m['pbrMetallicRoughness']['baseColorTexture']['index']=tm[m['pbrMetallicRoughness']['baseColorTexture']['index']]
 j['textures']=[j['textures'][i] for i in used];ims=sorted({t['source'] for t in j['textures']});immap={v:i for i,v in enumerate(ims)}
 for t in j['textures']:t['source']=immap[t['source']]
 j['images']=[j['images'][i] for i in ims]
 for im in j.get('images',[]):
  f=p.parent/im.pop('uri');f=f if f.exists() else f.with_name(f.name.replace('_png.png','.png'));data.extend(b'\0'*((-len(data))%4));im['bufferView']=len(j['bufferViews']);im['mimeType']='image/png';blob=f.read_bytes();j['bufferViews'].append({'buffer':0,'byteOffset':len(data),'byteLength':len(blob)});data.extend(blob)
 j['buffers']=[{'byteLength':len(data)}];data.extend(b'\0'*((-len(data))%4));s=json.dumps(j,separators=(',',':')).encode();s+=b' '*((-len(s))%4);b=struct.pack('<III',0x46546c67,2,28+len(s)+len(data))+struct.pack('<II',len(s),0x4e4f534a)+s+struct.pack('<II',len(data),0x004e4942)+data;(out/(dest+'.glb')).write_bytes(b);print(dest,len(b))
for root,label in [(base,'base'),(outfits,'outfit')]:
 p=next(Path(root).rglob('License_Standard.txt'));(out/(label+'-LICENSE.txt')).write_bytes(p.read_bytes())
