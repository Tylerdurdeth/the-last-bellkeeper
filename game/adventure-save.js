// Versioned, bounded data only. Never restore transient actions or falling positions.
// v2 (Bellhollow) uses its own key; v1 woodland saves are ignored (main shows a friendly note).
export const SAVE_KEY = 'bellkeeper-adventure-v2', LEGACY_KEY = 'bellkeeper-adventure-v1';
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
export function readSave(storage = store()) {
  try {
    const d = JSON.parse(storage?.getItem(SAVE_KEY));
    if (d?.version !== 2 || !d.quest || typeof d.quest !== 'object' || !Array.isArray(d.checkpoint) || d.checkpoint.length !== 3 || !d.checkpoint.every(Number.isFinite)) return null;
    if (d.checkpoint.some(v => Math.abs(v) > 400)) return null;
    return d;
  } catch { return null; }
}
export function hasLegacySave(storage = store()) { try { return !!storage?.getItem(LEGACY_KEY); } catch { return false; } }
export function writeSave({ quest, checkpoint, map = null }, storage = store()) {
  if (!Array.isArray(checkpoint) || checkpoint.length !== 3 || !checkpoint.every(Number.isFinite)) return false;
  const data = { version: 2, quest: quest?.serialize() ?? {}, map: map?.serialize?.() ?? null, checkpoint: checkpoint.map(v => +v.toFixed(3)), savedAt: Date.now() };
  try { storage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}
export function clearSave(storage = store()) { try { storage?.removeItem(SAVE_KEY); } catch {} }
