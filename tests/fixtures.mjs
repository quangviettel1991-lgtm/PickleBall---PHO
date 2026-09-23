import { keys } from '../src/utils/config.js';
import { setAccess } from '../src/utils/access.js';
export function fixture() {
  return { schemaVersion: 2, members: ['a','b','c','d'].map(id=>({ id, name: `Player ${id}`, phone: '0900000000', elo: 1200, eloSingles: 1000, eloDoubles: 1200, initialElo: 1200, initialEloSingles: 1000, initialEloDoubles: 1200 })),
    events: [{ id: 'event', name: 'Test event', date: '2026-09-23', description: '', isLocked: false }], matches: [], transactions: [], draws: {} };
}
export function setup(data = fixture(), extra = {}) {
  const store = new Map();
  globalThis.localStorage = { getItem: k=>store.get(k) ?? null, setItem: (k,v)=>store.set(k,String(v)), removeItem: k=>store.delete(k), clear: ()=>store.clear(), key: i=>[...store.keys()][i], get length(){return store.size;} };
  localStorage.setItem(keys.state, JSON.stringify({ data, generation: 'test-generation', baseRevision: 1, acknowledged: true, pending: false, ...extra }));
  setAccess({ role: 'admin', userId: 'test', local: true });
  return store;
}
export const matchInput = overrides => ({ type: 'singles', eventId: 'event', teamA: ['a'], teamB: ['b'], scoreA: 11, scoreB: 9, sets: [{ a: 11, b: 9 }], date: '2026-09-23T10:00:00+07:00', ...overrides });
