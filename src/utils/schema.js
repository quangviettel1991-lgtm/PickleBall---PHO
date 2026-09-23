export const SCHEMA_VERSION = 2;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const emptyClub = () => ({ schemaVersion: SCHEMA_VERSION, members: [], events: [], matches: [], transactions: [], draws: {} });
export const clone = value => JSON.parse(JSON.stringify(value));
export const stableJson = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
const fail = message => { throw new Error(message); };
const object = v => v && typeof v === 'object' && !Array.isArray(v);
export const isPlayed = match => match.played !== false && Number.isFinite(match.scoreA) && Number.isFinite(match.scoreB) && match.scoreA !== match.scoreB;
export function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < min || n > max) fail(`${label} phải là số nguyên từ ${min} đến ${max}.`);
  return n;
}
export function requiredText(value, label, max = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label} không hợp lệ (tối đa ${max} ký tự).`);
  return value.trim();
}
export function scoreFromSets(sets, mode = 'single') {
  if (!Array.isArray(sets) || !sets.length || sets.length > 3) fail('Cần nhập từ 1 đến 3 set.');
  const clean = sets.map(s => ({ a: integer(s.a, 'Điểm A', 0, 999), b: integer(s.b, 'Điểm B', 0, 999) }));
  if (mode === 'single') {
    if (clean[0].a === clean[0].b) fail('Trận đấu không thể có kết quả hòa.');
    return { scoreA: clean[0].a, scoreB: clean[0].b, sets: clean.slice(0, 1), played: true, scoringMode: 'single' };
  }
  let a = 0, b = 0;
  const active = [];
  for (const s of clean) {
    if (a === 2 || b === 2) break;
    if (s.a === s.b) fail('Các set đã đấu không được hòa.');
    s.a > s.b ? a++ : b++;
    active.push(s);
  }
  if (a !== 2 && b !== 2) fail('Trận ba set cần một đội thắng hai set.');
  return { scoreA: a, scoreB: b, sets: active, played: true, scoringMode: 'bestOf3' };
}
export function validateMatch(match, data, { historical = false } = {}) {
  if (!['singles', 'doubles'].includes(match.type)) fail('Thể thức trận đấu không hợp lệ.');
  const count = match.type === 'singles' ? 1 : 2;
  if (![match.teamA, match.teamB].every(t => Array.isArray(t) && t.length === count)) fail('Chọn đầy đủ người chơi ở hai đội.');
  const ids = [...match.teamA, ...match.teamB];
  if (new Set(ids).size !== count * 2) fail('Mỗi người chơi chỉ được xuất hiện một lần trong trận.');
  if (!historical && ids.some(id => !data.members.some(m => m.id === id))) fail('Có người chơi không còn trong danh sách.');
  if (!historical && match.eventId && !data.events.some(e => e.id === match.eventId)) fail('Sự kiện không tồn tại.');
  if (!Number.isFinite(new Date(match.date).getTime())) fail('Ngày giờ trận đấu không hợp lệ.');
  integer(match.scoreA, 'Điểm A', 0, 999); integer(match.scoreB, 'Điểm B', 0, 999);
  if (match.played !== false && match.scoreA === match.scoreB) fail('Trận đã đấu không được có kết quả hòa.');
  if (!historical && match.played !== false && match.sets?.length) {
    const result = scoreFromSets(match.sets, match.sets.length > 1 ? 'bestOf3' : 'single');
    if (result.scoreA !== match.scoreA || result.scoreB !== match.scoreB) fail('Tổng kết quả không khớp điểm từng set.');
  }
}
// Additive migration: retain unknown fields and historical rows; never replay Elo on load.
export function normalizeClub(input, { strict = false } = {}) {
  if (!object(input)) fail('Dữ liệu CLB phải là một đối tượng.');
  if (input.schemaVersion > SCHEMA_VERSION) fail('Bản sao lưu được tạo bởi phiên bản mới hơn.');
  const data = clone(input);
  for (const key of ['members', 'events', 'matches']) if (!Array.isArray(data[key])) fail(`Thiếu danh sách ${key}.`);
  data.transactions ??= [];
  data.draws ??= {};
  if (!Array.isArray(data.transactions) || !object(data.draws)) fail('Cấu trúc thu chi hoặc lịch đấu không hợp lệ.');
  for (const key of ['members', 'events', 'matches', 'transactions']) {
    const ids = new Set();
    for (const row of data[key]) {
      if (!object(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) fail(`${key}: ID thiếu hoặc bị trùng.`);
      ids.add(row.id);
    }
  }
  for (const m of data.members) {
    requiredText(m.name, 'Tên thành viên'); m.phone ??= '';
    if (typeof m.phone !== 'string') fail('Số điện thoại phải là chuỗi.');
    for (const k of ['elo','eloSingles','eloDoubles','initialElo','initialEloSingles','initialEloDoubles']) {
      if (m[k] !== undefined && (!Number.isFinite(m[k]) || m[k] < 0)) fail(`Điểm ${k} không hợp lệ.`);
    }
    m.elo ??= m.eloDoubles ?? 1200; m.eloDoubles ??= m.elo; m.eloSingles ??= 1000;
  }
  for (const e of data.events) {
    requiredText(e.name, 'Tên sự kiện');
    if (!Number.isFinite(new Date(e.date).getTime())) fail('Ngày sự kiện không hợp lệ.');
    e.description ??= ''; e.isLocked ??= false;
  }
  for (const m of data.matches) {
    if (!['singles','doubles'].includes(m.type) || ![m.teamA,m.teamB].every(t=>Array.isArray(t) && t.every(id=>typeof id === 'string'))) fail('Đội hoặc thể thức không hợp lệ.');
    if (!Number.isFinite(new Date(m.date).getTime())) fail('Ngày trận đấu không hợp lệ.');
    if (m.played !== false) { integer(m.scoreA, 'Điểm A', 0, 999); integer(m.scoreB, 'Điểm B', 0, 999); }
    m.played ??= isPlayed(m); m.eloChanges ??= {};
    if (!object(m.eloChanges) || Object.values(m.eloChanges).some(v=>!Number.isFinite(v))) fail('Biến động Elo không hợp lệ.');
    m.sets ??= [];
    if (!Array.isArray(m.sets) || m.sets.some(s=>!object(s) || !Number.isSafeInteger(s.a) || !Number.isSafeInteger(s.b) || s.a < 0 || s.b < 0)) fail('Chi tiết set không hợp lệ.');
    if (strict && m.played) validateMatch(m, data, { historical: true });
  }
  for (const t of data.transactions) {
    if (!['income', 'expense'].includes(t.type)) fail('Loại thu chi không hợp lệ.');
    t.amount = integer(t.amount, 'Số tiền', strict ? 1 : 0);
    if (!Number.isFinite(new Date(t.date).getTime())) fail('Ngày thu chi không hợp lệ.');
    t.description ??= ''; t.category ??= 'Khác'; t.performedBy ??= '';
    if (![t.description,t.category,t.performedBy].every(v=>typeof v === 'string')) fail('Nội dung giao dịch không hợp lệ.');
  }
  for (const [eventId, draw] of Object.entries(data.draws)) {
    if (!object(draw) || !['mixer','roundrobin','elimination'].includes(draw.scenario)) fail(`Lịch đấu ${eventId} không hợp lệ.`);
    const rounds = Array.isArray(draw.data) ? draw.data : draw.data?.rounds;
    if (draw.data && (!Array.isArray(rounds) || rounds.some(r=>!Array.isArray(r.matches) || r.matches.some(m=>!m.matchId || !Array.isArray(m.teamA) || !Array.isArray(m.teamB))))) fail(`Cấu trúc vòng đấu ${eventId} không hợp lệ.`);
  }
  data.schemaVersion = SCHEMA_VERSION; return data;
}
export function parseBackup(text, clubId) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) fail('File sao lưu vượt giới hạn 8 MB.');
  const parsed = JSON.parse(text);
  if (parsed.format === 'pickleball-backup') {
    if (String(parsed.clubId) !== String(clubId)) fail('Bản sao lưu thuộc CLB khác.');
    return normalizeClub(parsed.data, { strict: true });
  }
  return normalizeClub(parsed, { strict: true });
}
