import json,struct,hashlib,sys
from pathlib import Path
p=Path(sys.argv[1]);b=(p/'Unreal-Godot/UAL1_Standard.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:];keep=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land'];j['animations']=[a for a in j['animations'] if a['name'] in keep]
refs=[]
for m in j['meshes']:
 for q in m['primitives']:
  refs.extend((q['attributes'],k) for k in q['attributes']);refs.append((q,'indices'))
for s in j['skins']:refs.append((s,'inverseBindMatrices'))
for a in j['animations']:
 for s in a['samplers']:refs.extend([(s,'input'),(s,'output')])
ids=sorted({o[k] for o,k in refs});mapping={old:new for new,old in enumerate(ids)}
for o,k in refs:o[k]=mapping[o[k]]
j['accessors']=[j['accessors'][i] for i in ids];views=sorted({a['bufferView'] for a in j['accessors']});vm={old:new for new,old in enumerate(views)};out=bytearray()
newviews=[]
for i in views:
 v=j['bufferViews'][i].copy();start=v.get('byteOffset',0);out.extend(b'\0'*((-len(out))%4));v['byteOffset']=len(out);out.extend(binary[start:start+v['byteLength']]);newviews.append(v)
for a in j['accessors']:a['bufferView']=vm[a['bufferView']]
j['bufferViews']=newviews;j['buffers']=[{'byteLength':len(out)}];out.extend(b'\0'*((-len(out))%4));data=json.dumps(j,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
result=struct.pack('<III',0x46546c67,2,28+len(data)+len(out))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(out),0x004e4942)+out
Path('game/assets/quaternius/locomotion.glb').write_bytes(result);Path('game/assets/quaternius/LICENSE.txt').write_text((p/'License.txt').read_text());Path('game/assets/quaternius/PROVENANCE.md').write_text('Quaternius Universal Animation Library, free Standard edition, downloaded17September2026 from https://quaternius.itch.io/universal-animation-library . CC0; original license included. Authored by Quaternius with animation contributions credited to Gonzalo Furnier on the publisher page. Original UAL1_Standard.glb SHA256 '+hashlib.sha256(b).hexdigest()+'. This derivative retains the original mannequin and seven idle/locomotion/jump clips; other clips and unused buffer ranges removed. No paid assets.\n')
print(len(result),keep)
