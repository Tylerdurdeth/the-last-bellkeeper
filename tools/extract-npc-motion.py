# NPC idle clips from the CC0 Quaternius UAL Standard GLB (experiments/, never shipped): animation tracks + rest
# transforms only (no mesh/vertex/index/image data). Same skeleton and JSON shape as game/assets/quaternius/motion.json.
# Usage: python3 tools/extract-npc-motion.py [clip ...]   -> game/assets/quaternius/npc-motion.json
import json, struct, sys, base64
SRC = 'experiments/ual-full/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
CLIPS = sys.argv[1:] or ['Idle_Talking_Loop', 'Idle_Loop', 'Interact']
KEEP = {'root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'}
FPS = 15
f = open(SRC, 'rb').read(); L = struct.unpack('<I', f[12:16])[0]; j = json.loads(f[20:20 + L]); binoff = 20 + L + 8
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    o = binoff + bv.get('byteOffset', 0) + a.get('byteOffset', 0); s = bv.get('byteStride', 4 * n)
    return [struct.unpack_from('<' + 'f' * n, f, o + k * s) for k in range(a['count'])]
nodes, parent = j['nodes'], {}
for i, n in enumerate(nodes):
    for c in n.get('children', []): parent[c] = i
out_nodes = []
for i, n in enumerate(nodes):
    if n.get('mesh') is not None: continue
    out_nodes.append({'name': n['name'], 'parent': nodes[parent[i]]['name'] if i in parent else 'Scene', 'position': n.get('translation', [0, 0, 0]), 'quaternion': n.get('rotation', [0, 0, 0, 1]), 'scale': n.get('scale', [1, 1, 1]), 'bone': True})
clips = []
for a in j['animations']:
    if a['name'] not in CLIPS: continue
    tracks, dur = [], 0
    for ch in a['channels']:
        name = nodes[ch['target']['node']]['name']; path = ch['target']['path']
        if name not in KEEP or path not in ('rotation', 'translation') or (path == 'translation' and name not in ('pelvis', 'root')): continue
        s = a['samplers'][ch['sampler']]; t = [x[0] for x in acc(s['input'])]; v = acc(s['output']); dur = max(dur, t[-1])
        keep, last = [], -1
        for k, tt in enumerate(t):
            if k == 0 or k == len(t) - 1 or tt - last >= 1 / FPS - 1e-4: keep.append(k); last = tt
        tracks.append({'name': f"{name}.{'quaternion' if path == 'rotation' else 'position'}", 'times': [round(t[k], 4) for k in keep],
                       'values': [round(x, 5) for k in keep for x in v[k]], 'type': 'quaternion' if path == 'rotation' else 'vector'})
    clips.append({'name': a['name'], 'duration': round(dur, 4), 'tracks': tracks, 'blendMode': 2500})
json.dump({'nodes': out_nodes, 'clips': clips}, open('game/assets/quaternius/npc-motion.json', 'w'), separators=(',', ':'))
print([ (c['name'], c['duration'], len(c['tracks'])) for c in clips ], len(out_nodes))
