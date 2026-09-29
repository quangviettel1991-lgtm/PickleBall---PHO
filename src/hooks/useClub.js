import { useEffect, useRef, useState } from 'react';
import { CLUB_ID, LOCAL_MODE, keys } from '../utils/config.js';
import { supabase, remoteRead, remoteWrite, getRole } from '../utils/supabase.js';
import { setAccess } from '../utils/access.js';
import { emptyClub, normalizeClub } from '../utils/schema.js';
import { readState, downloadJson, exportBackup, recoveryBundle } from '../utils/storage.js';
import { createSyncEngine } from '../utils/sync.js';

export function useClub() {
  const [data, setData] = useState(emptyClub);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(LOCAL_MODE ? 'admin' : null);
  const [status, setStatus] = useState({ kind: 'loading', message: 'Đang tải dữ liệu…' });
  const [error, setError] = useState('');
  const engine = useRef(null);
  useEffect(() => {
    if (LOCAL_MODE) { setAccess({ role: 'admin', local: true, userId: 'local', writable: false }); return; }
    if (!supabase) { setStatus({ kind: 'error', message: 'Chưa cấu hình kết nối CLB. Dữ liệu cũ trên máy vẫn được giữ nguyên.' }); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data: result, error: failure }) => {
      if (!alive) return;
      if (failure) setError('Không đọc được phiên đăng nhập.');
      setSession(result.session);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => { if (alive) setSession(next); });
    return () => { alive = false; subscription.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let alive = true, timeout, channel, releaseLease, leaseAbort, adminSession = false;
    const claimLease = () => new Promise(resolve => {
      if (!navigator.locks) { resolve(false); return; }
      leaseAbort = new AbortController();
      const deadline = setTimeout(() => leaseAbort.abort(), 500);
      navigator.locks.request(`pickleball-writer-${CLUB_ID}`, { signal: leaseAbort.signal }, async lock => {
        clearTimeout(deadline);
        if (!lock || !alive) { resolve(false); return; }
        await new Promise(release => { releaseLease = release; resolve(true); });
      }).catch(() => { clearTimeout(deadline); resolve(false); });
    });
    const loadLocal = () => { try { setData(readState().data); } catch (e) { setError(`Không đọc được dữ liệu trên máy: ${e.message} Bản gốc chưa bị thay thế.`); } };
    let failures = 0;
    const tick = async () => {
      clearTimeout(timeout);
      if (!alive) return;
      if (!document.hidden && navigator.onLine !== false) {
        if (engine.current) await engine.current.sync();
        else if (!LOCAL_MODE && !adminSession) {
          try {
            const remote = await remoteRead(true);
            if (alive) { setData(remote.kind === 'found' ? normalizeClub(remote.data) : emptyClub()); setStatus({ kind: 'public', message: 'Chế độ xem công khai.' }); failures = 0; }
          } catch (e) { if (alive) { failures++; setStatus({ kind: 'error', message: e.message }); } }
        }
      }
      if (alive && !LOCAL_MODE) timeout = setTimeout(tick, Math.min(300000, 60000 * 2 ** failures));
    };
    const schedule = () => { clearTimeout(timeout); timeout = setTimeout(tick, 400); };
    const changed = () => { if (adminSession || LOCAL_MODE) loadLocal(); schedule(); };
    const storageChanged = e => { if (e.key === keys.state) changed(); };
    setAccess(LOCAL_MODE ? { role: 'admin', local: true, userId: 'local', writable: false } : {});
    setRole(LOCAL_MODE ? 'admin' : null); setData(emptyClub());
    async function start() {
      if (LOCAL_MODE) {
        const writable = await claimLease(); if (!alive) return;
        setAccess({ role: 'admin', local: true, userId: 'local', writable });
        loadLocal(); setStatus({ kind: 'local', message: writable ? 'Chế độ thử trên máy — không kết nối dữ liệu CLB.' : 'Tab chỉ đọc: đóng tab quản lý khác rồi tải lại để chỉnh sửa.' }); return;
      }
      if (session) {
        try {
          const nextRole = await getRole();
          if (!alive) return;
          setRole(nextRole); setAccess({ role: nextRole, userId: session.user.id, writable: false });
          if (nextRole === 'admin') {
            adminSession = true;
            const writable = await claimLease(); if (!alive) return;
            setAccess({ role: nextRole, userId: session.user.id, writable });
            loadLocal();
            if (!writable) { setStatus({ kind: 'readonly', message: 'Tab chỉ đọc: đóng tab quản lý khác rồi tải lại để chỉnh sửa.' }); return; }
            engine.current = createSyncEngine({ read: () => remoteRead(false), write: remoteWrite, canWrite: () => alive,
              canApplyRemote: () => !document.querySelector('main form'),
              status: next => {
                if (alive) {
                  setStatus(next);
                  if (next.kind === 'saved') setError(previous => previous.startsWith('Cần kết nối và đối chiếu dữ liệu máy chủ trước khi chỉnh sửa.') ? '' : previous);
                  failures = next.kind === 'error' ? failures + 1 : 0;
                }
              } });
            if (supabase) channel = supabase.channel(`club-${CLUB_ID}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pickleball_club', filter: `id=eq.${CLUB_ID}` }, schedule).subscribe();
          }
        } catch (e) { if (alive) setError(e.message); }
      }
      if (alive) tick();
    }
    start();
    window.addEventListener('club-data-change', changed);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('online', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      alive = false; clearTimeout(timeout); engine.current?.stop(); engine.current = null;
      releaseLease?.();
      leaseAbort?.abort();
      setAccess({});
      window.removeEventListener('club-data-change', changed); window.removeEventListener('storage', storageChanged);
      window.removeEventListener('online', schedule); document.removeEventListener('visibilitychange', schedule);
      if (channel) supabase.removeChannel(channel);
    };
  }, [session]);
  useEffect(() => {
    const onError = event => { setError(event.error?.message || 'Thao tác chưa hoàn tất. Dữ liệu cũ được giữ lại.'); event.preventDefault(); };
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, []);
  return { data, setData, isAdmin: role === 'admin', session, status, error, clearError: () => setError(''),
    retry: () => engine.current?.sync(),
    exportLocal: () => downloadJson(exportBackup(readState().data, CLUB_ID), 'pickleball-local-backup.json'),
    exportRecovery: () => downloadJson(recoveryBundle(), 'pickleball-device-recovery.json'),
    exportRemote: () => { const remote = engine.current?.getConflict()?.remote; if (remote) downloadJson(exportBackup(remote.data, CLUB_ID), 'pickleball-server-backup.json'); },
    useRemote: () => { if (window.confirm('Chọn bản máy chủ? Bản trên máy sẽ được giữ trong lịch sử sao lưu để đối chiếu.')) engine.current?.resolveRemote(); },
    logout: async () => {
      if (LOCAL_MODE) { setError('Đây là chế độ thử trên localhost; không có phiên đăng nhập máy chủ.'); return; }
      const { error: failure } = await supabase.auth.signOut(); if (failure) setError('Chưa đăng xuất được. Vui lòng thử lại.');
    },
  };
}
