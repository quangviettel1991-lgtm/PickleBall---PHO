import { keys } from './config.js';
import { getAccess } from './access.js';
import { clone, emptyClub, normalizeClub } from './schema.js';
export const newId = prefix => `${prefix}_${Date.now()}_${crypto.randomUUID()}`;
export function announce() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('club-data-change')); }
export function activeKeys() {
  const { role, userId } = getAccess();
  if (role !== 'manager' || !userId) return keys;
  const suffix = `_manager_${userId}`;
  return { ...keys, state: keys.state + suffix, snapshots: keys.snapshots + suffix,
    recovery: keys.recovery + suffix, legacy: null, legacySnapshots: null };
}
export function readState() {
  const storage = activeKeys();
  const raw = localStorage.getItem(storage.state);
  if (raw) { const state = JSON.parse(raw); state.data = normalizeClub(state.data); if (getAccess().role === 'manager') state.data.transactions = []; return state; }
  const legacy = storage.legacy ? localStorage.getItem(storage.legacy) : null;
  const data = legacy ? normalizeClub(JSON.parse(legacy)) : emptyClub();
  if (legacy) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('draw_')) { data.legacyDrawStorage ??= {}; data.legacyDrawStorage[key] = localStorage.getItem(key); }
    }
  }
  for (const e of data.events) {
    const draw = localStorage.getItem(`draw_data_${e.id}`);
    if (draw && !data.draws[e.id]) {
      try { data.draws[e.id] = { scenario: localStorage.getItem(`draw_active_scenario_${e.id}`) || 'mixer', data: JSON.parse(draw), generated: true, legacy: true }; } catch { /* Original remains recoverable. */ }
    }
  }
  return { data, generation: 'legacy', baseRevision: null, pending: false, legacy: Boolean(legacy), acknowledged: false };
}
export function snapshot(data, label = 'before_change') {
  const snapshots = readSnapshots();
  const timestamp = new Date().toISOString();
  const entry = { id: newId('snapshot'), timestamp, label, data: clone(data), membersCount: data.members.length, eventsCount: data.events.length, matchesCount: data.matches.length };
  localStorage.setItem(activeKeys().snapshots, JSON.stringify([entry, ...snapshots].slice(0, 30)));
  return entry;
}
export function readSnapshots() {
  const storage = activeKeys();
  const raw = localStorage.getItem(storage.snapshots) || (storage.legacySnapshots && localStorage.getItem(storage.legacySnapshots));
  if (!raw) return [];
  const result = JSON.parse(raw);
  if (!Array.isArray(result)) throw new Error('Lịch sử sao lưu không đọc được. Dữ liệu gốc vẫn được giữ nguyên.');
  return result;
}
export function commitState(next, expectedGeneration, { label = 'before_change', backup = true } = {}) {
  const previous = readState();
  if (previous.generation !== expectedGeneration) throw new Error('Dữ liệu đã đổi ở tab khác. Vui lòng tải lại trước khi lưu.');
  if (backup) snapshot(previous.data, label);
  const storage = activeKeys();
  if (!localStorage.getItem(storage.recovery)) localStorage.setItem(storage.recovery, JSON.stringify({ createdAt: new Date().toISOString(), legacy: storage.legacy ? localStorage.getItem(storage.legacy) : null, state: previous }));
  const state = { ...next, generation: newId('generation') };
  localStorage.setItem(storage.state, JSON.stringify(state)); announce(); return state;
}
export function exportBackup(data, clubId) {
  return { format: 'pickleball-backup', version: 2, clubId, exportedAt: new Date().toISOString(), data: clone(data) };
}
export function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function recoveryBundle() {
  const storage = activeKeys();
  const raw = {};
  for (let i=0; i<localStorage.length; i++) {
    const key = localStorage.key(i);
    if (Object.values(storage).includes(key) || (getAccess().role !== 'manager' && key?.startsWith('draw_'))) raw[key] = localStorage.getItem(key);
  }
  return { format: 'pickleball-raw-recovery', createdAt: new Date().toISOString(), raw };
}
