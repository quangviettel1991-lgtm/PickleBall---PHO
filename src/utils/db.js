import { initialMembers, initialEvents, initialMatches, initialTransactions } from './mockData.js';
import { calculateSinglesElo, calculateDoublesElo } from './elo.js';
import { keys, LOCAL_MODE } from './config.js';
import { getAccess, requireWrite, requireOwner } from './access.js';
import { readState, commitState, readSnapshots, snapshot, newId } from './storage.js';
import { clone, emptyClub, normalizeClub, integer, requiredText, validateMatch, isPlayed, stableJson } from './schema.js';
import { localDate, toInstant } from './dates.js';
import { drawMatchId, drawNodes, syncDraws, removeDrawNodes } from './draws.js';

export function getClubData() { return readState().data; }
function unlocked(data, eventId) {
  if (eventId && data.events.find(e => e.id === eventId)?.isLocked) throw new Error('Sự kiện đã khóa. Hãy mở khóa trước khi thay đổi.');
}
function persist(state, data, action) {
  requireWrite();
  if (!LOCAL_MODE && !getAccess().local && !state.acknowledged) throw new Error('Cần kết nối và đối chiếu dữ liệu máy chủ trước khi chỉnh sửa. Bản cũ trên máy vẫn được giữ nguyên.');
  const clean = normalizeClub(data);
  for (const event of state.data.events.filter(e=>e.isLocked)) {
    const matchesFor = club => club.matches.filter(m=>m.eventId===event.id).sort((a,b)=>a.id.localeCompare(b.id));
    if (stableJson(matchesFor(state.data)) !== stableJson(matchesFor(clean))) throw new Error('Thay đổi này ảnh hưởng kết quả hoặc Elo của sự kiện đã khóa. Mở khóa sự kiện liên quan trước khi lưu.');
  }
  commitState({ ...state, data: clean, pending: !getAccess().local,
    operationId: newId('operation') }, state.generation, { label: action });
  return clean;
}
function change(action, mutate) {
  requireWrite();
  const state = readState(); const data = clone(state.data);
  mutate(data);
  return persist(state, data, action);
}
export function saveClubData(data) { return replaceClubData(data, 'before_import'); }
export function replaceClubData(input, action = 'before_restore') {
  requireOwner();
  const clean = normalizeClub(input, { strict: true });
  const state = readState();
  return persist(state, clean, action);
}
export const getSnapshots = readSnapshots;
export function createManualSnapshot(data, label = 'manual') { requireOwner(); return snapshot(data, label); }
export function restoreSnapshot(id) {
  requireOwner();
  const found = readSnapshots().find(s => s.id === id || s.timestamp === id);
  if (!found) throw new Error('Không tìm thấy bản sao lưu.');
  return replaceClubData(found.data, 'before_restore');
}
export function clearSnapshots() { requireOwner(); localStorage.setItem(keys.snapshots, '[]'); }
export function resetToDemoData() {
  const data = normalizeClub({ members: initialMembers, events: initialEvents, matches: initialMatches, transactions: initialTransactions });
  recalculateAllElos(data);
  return replaceClubData(data, 'before_demo');
}
export function clearAllData() { return replaceClubData(emptyClub(), 'before_clear'); }

export function addMember(input) {
  return change('before_add_member', data => {
    const singles = integer(input.eloSingles ?? 1000, 'Elo đơn', 100, 3000);
    const doubles = integer(input.eloDoubles ?? input.elo ?? (input.isGuest ? 1000 : 1200), 'Elo đôi', 100, 3000);
    data.members.push({ id: newId('m'), name: requiredText(input.name, 'Tên thành viên'), phone: input.phone || '',
      gender: input.gender || 'Nam', joinDate: input.joinDate || localDate(), isGuest: Boolean(input.isGuest),
      elo: doubles, eloSingles: singles, eloDoubles: doubles, initialElo: doubles, initialEloSingles: singles, initialEloDoubles: doubles,
      avatarColor: input.avatarColor || '#1e90ff' });
  });
}
export function updateMember(input) {
  return change('before_edit_member', data => {
    const member = data.members.find(m => m.id === input.id);
    if (!member) throw new Error('Thành viên không tồn tại.');
    Object.assign(member, { name: requiredText(input.name, 'Tên thành viên'), phone: input.phone || '', gender: input.gender || 'Nam', joinDate: input.joinDate, isGuest: Boolean(input.isGuest) });
    // Profile edits never alter current or starting ratings. Explicit initial rating adjustment only.
    if (input.adjustInitialElo === true) {
      if (data.matches.some(m => [...m.teamA, ...m.teamB].includes(member.id) && data.events.find(e=>e.id===m.eventId)?.isLocked)) throw new Error('Không sửa điểm xuất phát của thành viên đã có trận trong sự kiện khóa.');
      establishBaselines(data);
      member.initialEloSingles = integer(input.initialEloSingles, 'Elo đơn khởi điểm', 100, 3000);
      member.initialEloDoubles = integer(input.initialEloDoubles, 'Elo đôi khởi điểm', 100, 3000);
      member.initialElo = member.initialEloDoubles;
      recalculateAllElos(data);
    }
  });
}
export function deleteMember(id) {
  return change('before_archive_member', data => {
    const m = data.members.find(m => m.id === id);
    if (!m) throw new Error('Thành viên không tồn tại.');
    m.archivedAt = new Date().toISOString();
  });
}
export function restoreMember(id) {
  return change('before_restore_member', data => { const m = data.members.find(m=>m.id===id); if (m) delete m.archivedAt; });
}
export function addEvent(input) {
  return change('before_add_event', data => data.events.push({ id: newId('e'), name: requiredText(input.name, 'Tên sự kiện'), date: input.date || localDate(), description: input.description || '', isLocked: false }));
}
export function updateEvent(input) {
  return change('before_edit_event', data => {
    const e = data.events.find(e => e.id === input.id);
    if (!e) throw new Error('Sự kiện không tồn tại.');
    if (e.isLocked && Object.keys(input).some(k => !['id','isLocked'].includes(k))) throw new Error('Mở khóa sự kiện trước khi sửa.');
    Object.assign(e, input);
  });
}
export function deleteEvent(id) {
  return change('before_delete_event', data => {
    unlocked(data, id); data.events = data.events.filter(e => e.id !== id);
    data.matches = data.matches.map(m => m.eventId === id ? { ...m, eventId: '' } : m);
    // Preserve the detached bracket in backups; do not delete historical matches.
    delete data.draws[id];
  });
}
export function establishBaselines(data) {
  for (const m of data.members) {
    for (const [type, field, initial] of [['singles','eloSingles','initialEloSingles'], ['doubles','eloDoubles','initialEloDoubles']]) {
      if (m[initial] === undefined) {
        const changes = data.matches.filter(x => x.type === type && isPlayed(x)).reduce((sum,x) => sum + (x.eloChanges?.[m.id] || 0), 0);
        m[initial] = type === 'doubles' && m.initialElo !== undefined ? m.initialElo : Math.max(100, m[field] - changes);
      }
    }
    m.initialElo ??= m.initialEloDoubles;
  }
}
export function recalculateAllElos(data) {
  establishBaselines(data);
  const players = new Map(data.members.map(m => {
    m.eloSingles = m.initialEloSingles; m.eloDoubles = m.initialEloDoubles; m.elo = m.initialEloDoubles;
    return [m.id, m];
  }));
  const sorted = [...data.matches].sort((a,b) => new Date(a.date) - new Date(b.date));
  for (const match of sorted) {
    if (!isPlayed(match)) { match.eloChanges = {}; continue; }
    const field = match.type === 'singles' ? 'eloSingles' : 'eloDoubles';
    const ids = [...match.teamA, ...match.teamB];
    // Legacy deleted players have no reconstructible baseline: preserve recorded changes for that match.
    let changes = match.eloChanges || {};
    if (ids.every(id=>players.has(id))) {
      const ratings = team => team.map(id=>players.get(id)[field]);
      const result = match.type === 'singles'
        ? calculateSinglesElo(ratings(match.teamA)[0], ratings(match.teamB)[0], match.scoreA, match.scoreB)
        : calculateDoublesElo(ratings(match.teamA), ratings(match.teamB), match.scoreA, match.scoreB);
      changes = Object.fromEntries([...match.teamA.map(id=>[id,result.changeA]), ...match.teamB.map(id=>[id,result.changeB])]);
    }
    const applied = {};
    for (const id of ids) {
      const player = players.get(id);
      if (!player) { applied[id] = changes[id] || 0; continue; }
      const before = player[field]; player[field] = Math.max(100, before + (changes[id] || 0));
      const delta = player[field] - before; player.elo = Math.max(100, player.elo + delta); applied[id] = delta;
    }
    match.eloChanges = applied;
  }
  data.matches = sorted; return data;
}
export function recordMatch(input) {
  return change('before_record_match', data => {
    unlocked(data, input.eventId); establishBaselines(data);
    const match = { ...input, id: newId('match'), date: toInstant(input.date || new Date()), eventId: input.eventId || '', played: true, eloChanges: {} };
    validateMatch(match, data);
    if ([...match.teamA, ...match.teamB].some(id=>data.members.find(m=>m.id===id)?.archivedAt)) throw new Error('Không thêm trận mới cho thành viên đã lưu trữ.');
    data.matches.push(match); recalculateAllElos(data);
  });
}
export function updateMatch(input) {
  return change('before_update_match', data => {
    const index = data.matches.findIndex(m => m.id === input.id);
    if (index < 0) throw new Error('Trận đấu không còn tồn tại.');
    const old = data.matches[index]; unlocked(data, old.eventId); unlocked(data, input.eventId ?? old.eventId); establishBaselines(data);
    const match = { ...old, ...input, date: toInstant(input.date || old.date), played: input.played ?? true };
    if (input.sets === undefined && (input.scoreA !== undefined || input.scoreB !== undefined) && (old.sets?.length || 0) <= 1) match.sets = [{ a: match.scoreA, b: match.scoreB }];
    if (old.id.startsWith('match_draw_') && input.eventId !== undefined && input.eventId !== old.eventId) throw new Error('Không chuyển trận bốc thăm sang sự kiện khác.');
    validateMatch(match, data); data.matches[index] = match; syncDraws(data); recalculateAllElos(data);
  });
}
export function deleteMatch(id) { return deleteMatches([id]); }
export function deleteMatches(ids) {
  return change('before_delete_matches', data => {
    data.matches.filter(m=>ids.includes(m.id)).forEach(m=>unlocked(data,m.eventId)); establishBaselines(data);
    data.matches = data.matches.filter(m=>!ids.includes(m.id)); removeDrawNodes(data, ids); recalculateAllElos(data);
  });
}
export function saveDraw(eventId, scenario, drawData) {
  return change('before_generate_draw', data => {
    unlocked(data, eventId);
    if (!data.events.some(e=>e.id===eventId)) throw new Error('Chọn một sự kiện còn tồn tại.');
    if (data.draws[eventId]?.data) throw new Error('Lịch hiện tại đã được lưu. Hãy hủy lịch có xác nhận trước khi bốc lại.');
    data.draws[eventId] = { scenario, data: clone(drawData), generated: true };
    const nodes = drawNodes(data.draws[eventId]);
    const format = nodes.some(n => n.teamA.length === 2 || n.teamB.length === 2) ? 'doubles' : 'singles';
    for (const n of nodes) {
      if (n.isByeMatch) continue;
      data.matches.push({ id: drawMatchId(n.matchId), eventId, type: format, date: n.date || new Date().toISOString(), teamA: clone(n.teamA), teamB: clone(n.teamB), scoreA: n.scoreA ?? 0, scoreB: n.scoreB ?? 0, played: Boolean(n.played), sets: [], eloChanges: {} });
    }
    syncDraws(data);
  });
}
export function clearDraw(eventId) {
  return change('before_clear_draw', data => {
    unlocked(data,eventId); establishBaselines(data);
    const ids = new Set(drawNodes(data.draws[eventId]).map(m=>drawMatchId(m.matchId)));
    data.matches = data.matches.filter(m=>!ids.has(m.id)); delete data.draws[eventId]; recalculateAllElos(data);
  });
}
export function adoptLegacyDraw(eventId) {
  return change('before_adopt_legacy_draw', data => {
    unlocked(data, eventId); const draw = data.draws[eventId];
    if (!draw?.legacy) return;
    establishBaselines(data);
    const nodes = drawNodes(draw);
    const type = nodes.some(n=>n.teamA.length === 2 || n.teamB.length === 2) ? 'doubles' : 'singles';
    for (const n of nodes) {
      const id = drawMatchId(n.matchId);
      if (n.isByeMatch || data.matches.some(m=>m.id===id)) continue;
      const match = { id, eventId, type, date: n.date || new Date().toISOString(), teamA: clone(n.teamA), teamB: clone(n.teamB), scoreA: n.scoreA ?? 0, scoreB: n.scoreB ?? 0, played: Boolean(n.played), sets: n.sets || [], eloChanges: {} };
      if (match.played) validateMatch(match,data);
      data.matches.push(match);
    }
    delete draw.legacy; syncDraws(data); recalculateAllElos(data);
  });
}
function transaction(input) {
  if (!['income','expense'].includes(input.type)) throw new Error('Chọn thu hoặc chi.');
  return { type: input.type, amount: integer(input.amount, 'Số tiền', 1), category: requiredText(input.category || 'Khác','Danh mục'), description: input.description || '', date: input.date || localDate(), performedBy: input.performedBy || '' };
}
export function addTransaction(input) { requireOwner(); return change('before_add_transaction', data => data.transactions.push({ ...transaction(input), id: newId('tx') })); }
export function updateTransaction(input) {
  requireOwner();
  return change('before_update_transaction', data => {
    const t = data.transactions.find(t=>t.id===input.id); if (!t) throw new Error('Giao dịch không còn tồn tại.'); Object.assign(t, transaction(input));
  });
}
export function deleteTransaction(id) { requireOwner(); return change('before_delete_transaction', data => { data.transactions = data.transactions.filter(t=>t.id!==id); }); }
