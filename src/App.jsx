import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import AuthDialog from './components/AuthDialog';
import PasswordResetPage from './components/PasswordResetPage';
import { useClub } from './hooks/useClub';
import { CLUB_NAME } from './utils/config';
import { readState } from './utils/storage';
const screens = {
  dashboard: lazy(() => import('./components/Dashboard')),
  leaderboard: lazy(() => import('./components/Leaderboard')),
  recorder: lazy(() => import('./components/MatchRecorder')),
  members: lazy(() => import('./components/Members')),
  events: lazy(() => import('./components/Events')),
  draw: lazy(() => import('./components/TournamentDraw')),
  finance: lazy(() => import('./components/Finance')),
  backup: lazy(() => import('./components/BackupRestore')),
  h2h: lazy(() => import('./components/HeadToHead')),
};
const tabFromHash = () => Object.hasOwn(screens, location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
export default function App() {
  if (new URLSearchParams(window.location.search).get('auth') === 'reset') return <PasswordResetPage />;
  return <ClubApp />;
}
function ClubApp() {
  const club = useClub();
  const [activeTab, setActiveTab] = useState(tabFromHash);
  const [recorderSubTab, setRecorderSubTab] = useState('record');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const dirty = useRef(false);
  const main = useRef(null);
  useEffect(() => {
    const hash = () => {
      if (dirty.current && !window.confirm('Biểu mẫu có nội dung chưa lưu. Rời màn hình này?')) { history.replaceState(null, '', `#${activeTab}`); return; }
      dirty.current = false; setActiveTab(tabFromHash()); main.current?.focus();
    };
    const unload = event => {
      let pending = false; try { pending = club.isAdmin && readState().pending; } catch { /* Do not mask recovery UI. */ }
      if (dirty.current || pending) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('hashchange', hash); window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('hashchange', hash); window.removeEventListener('beforeunload', unload); };
  }, [activeTab, club.isAdmin]);
  const navigate = tab => { location.hash = tab; };
  const Screen = screens[activeTab];
  const locked = !club.isAdmin && !['dashboard','leaderboard','h2h'].includes(activeTab);
  return <div className="app-layout">
    <a className="skip-link" href="#main-content" onClick={event=>{ event.preventDefault(); main.current?.focus(); }}>Đến nội dung chính</a>
    <Navbar activeTab={activeTab} setActiveTab={navigate} isAdmin={club.isAdmin} setIsAdmin={value=>value ? setIsAuthModalOpen(true) : club.logout()} isModalOpen={false} setIsModalOpen={setIsAuthModalOpen} />
    {club.status.kind !== 'saved' && <div className={`sync-status sync-${club.status.kind}`} role="status" aria-live="polite">
      <span>{club.status.message}</span>
      {club.status.kind === 'error' && <button onClick={club.exportRecovery}>Tải bản cứu hộ trên thiết bị này</button>}
      {club.isAdmin && <><button onClick={club.exportLocal}>Tải bản sao lưu</button><button onClick={club.retry}>Kiểm tra đồng bộ</button></>}
      {club.isAdmin && club.status.kind === 'conflict' && <><button onClick={club.exportRemote}>Tải bản máy chủ</button><button onClick={club.useRemote}>Chọn bản máy chủ</button></>}
      {club.session && !club.isAdmin && <button onClick={club.logout}>Đăng xuất tài khoản</button>}
    </div>}
    {club.error && <div className="operation-error" role="alert">{club.error}<button onClick={club.clearError}>Đóng thông báo</button></div>}
    <main id="main-content" ref={main} tabIndex={-1} className="app-main-content"
      onChangeCapture={e=>{ if (e.target.closest('form')) dirty.current = true; }}
      onSubmitCapture={()=>{ let generation; try { generation = readState().generation; } catch { return; } queueMicrotask(()=>{ if (readState().generation !== generation) dirty.current = false; }); }}>
      {locked ? <div className="recovery-panel"><h1>Đăng nhập để quản lý CLB</h1><p>Bạn có thể xem Tổng Quan, Xếp Hạng và Đối Đầu mà không cần đăng nhập.</p><button className="btn-neon-green" onClick={()=>setIsAuthModalOpen(true)}>Đăng nhập quản trị</button></div>
        : <Suspense fallback={<p className="recovery-panel" role="status">Đang mở màn hình…</p>}><Screen data={club.data} setData={club.setData} isAdmin={club.isAdmin} setIsAdmin={()=>setIsAuthModalOpen(true)} setActiveTab={navigate} setRecorderSubTab={setRecorderSubTab} subTab={recorderSubTab} setSubTab={setRecorderSubTab} /></Suspense>}
    </main>
    <AuthDialog isOpen={isAuthModalOpen} onClose={()=>setIsAuthModalOpen(false)} />
    <footer className="app-footer"><strong>{CLUB_NAME} PRO RANK</strong><p>Quản lý và xếp hạng CLB Pickleball</p></footer>
  </div>;
}
