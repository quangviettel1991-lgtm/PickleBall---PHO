const env = import.meta.env || {};
export const SEASONS = [
  { year: '2026', clubId: String(env.VITE_CLUB_ID || '1') },
  ...(env.VITE_CLUB_ID_2027 ? [{ year: '2027', clubId: String(env.VITE_CLUB_ID_2027) }] : []),
];
const requestedSeason = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('season');
export const ACTIVE_SEASON = SEASONS.find(season => season.year === requestedSeason) || SEASONS.at(-1);
export const IS_ARCHIVED_SEASON = SEASONS.length > 1 && ACTIVE_SEASON.year !== SEASONS.at(-1).year;
export const CLUB_ID = ACTIVE_SEASON.clubId;
export const CLUB_NAME = env.VITE_CLUB_NAME || 'PICKLEBALL PHỞ';
export const MANAGER_USERNAME = 'quanly';
export const MANAGER_AUTH_EMAIL = 'amaquangvp+phoquanly@gmail.com';
export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || '';
export const IS_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY && env.VITE_CLUB_ID &&
  (!env.VITE_CLUB_ID_2027 || env.VITE_CLUB_ID_2027 !== env.VITE_CLUB_ID));
export const LOCAL_MODE = env.VITE_LOCAL_MODE === 'true' &&
  (typeof location === 'undefined' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
export const keys = {
  legacy: `pickleball_club_data_${CLUB_ID}`,
  legacyTime: `pickleball_club_data_updated_at_${CLUB_ID}`,
  state: `pickleball_state_v2_${CLUB_ID}`,
  snapshots: `pickleball_snapshots_v2_${CLUB_ID}`,
  legacySnapshots: `pickleball_snapshots_${CLUB_ID}`,
  recovery: `pickleball_recovery_v2_${CLUB_ID}`,
  drawEvent: `draw_selected_event_id_${CLUB_ID}`,
};
