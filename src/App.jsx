import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import AuthDialog from './components/AuthDialog';
import PasswordResetPage from './components/PasswordResetPage';
import './season2027.css';
import { useClub } from './hooks/useClub';
import { ACTIVE_SEASON, CLUB_NAME, IS_ARCHIVED_SEASON, SEASONS } from './utils/config';
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
  accounts: lazy(() => import('./components/AccountManager')),
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
  const restricted = club.isAdmin && !club.isOwner && ['finance','backup','accounts'].includes(activeTab);
  const archivePage = IS_ARCHIVED_SEASON && !['dashboard','leaderboard','h2h','finance'].includes(activeTab);
  const accountPageUnavailable = activeTab === 'accounts' && ACTIVE_SEASON.year !== '2027';
  const locked = restricted || archivePage || accountPageUnavailable || !club.isAdmin && !['dashboard','leaderboard','h2h'].includes(activeTab);
  const selectSeason = year => {
    const url = new URL(window.location.href);
    url.searchParams.set('season', year);
    window.location.assign(url.toString());
  };
  return <div className={`app-layout season-${ACTIVE_SEASON.year}`}>
    <a className="skip-link" href="#main-content" onClick={event=>{ event.preventDefault(); main.current?.focus(); }}>Đến nội dung chính</a>
    <Navbar activeTab={activeTab} setActiveTab={navigate} isAdmin={club.isAdmin} isOwner={club.isOwner} setIsAdmin={value=>value ? setIsAuthModalOpen(true) : club.logout()} isModalOpen={false} setIsModalOpen={setIsAuthModalOpen} />
    {SEASONS.length > 1 && <div className="season-switcher">
      <div className="season-switcher-copy"><span className="season-eyebrow">PICKLEBALL PHỞ · SEASON HUB</span><strong>Mùa giải {ACTIVE_SEASON.year}</strong><span>{ACTIVE_SEASON.year === '2027' ? 'Elo mới · Câu chuyện mới' : 'Dữ liệu mùa giải trước được giữ riêng'}</span></div>
      <div className="season-options" role="group" aria-label="Chọn mùa giải">
        {SEASONS.map(season=><button key={season.year} type="button" aria-pressed={season.year === ACTIVE_SEASON.year} className={season.year === ACTIVE_SEASON.year ? 'selected' : ''} onClick={()=>selectSeason(season.year)}>{season.year}</button>)}
      </div>
    </div>}
    {IS_ARCHIVED_SEASON && <div className="season-archive-note" role="status">Mùa {ACTIVE_SEASON.year} đã lưu trữ · chỉ xem dữ liệu và xếp hạng. Thu Chi chỉ quản trị viên toàn quyền được xem. {club.isOwner && club.status.kind === 'archive' && <button type="button" onClick={club.exportArchive}>Tải dữ liệu mùa này</button>}</div>}
    {club.status.kind !== 'saved' && <div className={`sync-status sync-${club.status.kind}`} role="status" aria-live="polite">
      <span>{club.status.message}</span>
      {club.status.kind === 'error' && !IS_ARCHIVED_SEASON && <button onClick={club.exportRecovery}>Tải bản cứu hộ trên thiết bị này</button>}
      {club.isOwner && !IS_ARCHIVED_SEASON && <button onClick={club.exportLocal}>Tải bản sao lưu</button>}{club.isAdmin && !IS_ARCHIVED_SEASON && <button onClick={club.retry}>Kiểm tra đồng bộ</button>}
      {club.isAdmin && club.status.kind === 'conflict' && <><button onClick={club.exportRemote}>Tải bản máy chủ</button><button onClick={club.useRemote}>Chọn bản máy chủ</button></>}
      {club.session && !club.isAdmin && <button onClick={club.logout}>Đăng xuất tài khoản</button>}
    </div>}
    {club.error && <div className="operation-error" role="alert">{club.error}<button onClick={club.clearError}>Đóng thông báo</button></div>}
    <main id="main-content" ref={main} tabIndex={-1} className="app-main-content"
      onChangeCapture={e=>{ if (e.target.closest('form')) dirty.current = true; }}
      onSubmitCapture={()=>{ let generation; try { generation = readState().generation; } catch { return; } queueMicrotask(()=>{ if (readState().generation !== generation) dirty.current = false; }); }}>
      {locked ? restricted ? <div className="recovery-panel"><h1>Không có quyền truy cập</h1><p>Chỉ quản trị viên toàn quyền được xem Thu Chi, CSDL và Tài Khoản.</p></div>
        : archivePage ? <div className="recovery-panel"><h1>Mùa giải đã lưu trữ</h1><p>Chọn mùa mới nhất để ghi điểm hoặc thay đổi dữ liệu.</p></div>
        : accountPageUnavailable ? <div className="recovery-panel"><h1>Chọn mùa 2027</h1><p>Quản lý tài khoản CLB được thực hiện trong mùa 2027.</p></div>
        : club.status.kind === 'readonly' ? <div className="recovery-panel"><h1>Đang chờ quyền chỉnh sửa</h1><p>Trang sẽ tự mở quyền khi tab quản lý khác đóng.</p></div>
        : <div className="recovery-panel"><h1>Đăng nhập để quản lý CLB</h1><p>Bạn có thể xem Tổng Quan, Xếp Hạng và Đối Đầu mà không cần đăng nhập.</p><button className="btn-neon-green" onClick={()=>setIsAuthModalOpen(true)}>Đăng nhập quản trị</button></div>
        : <Suspense fallback={<p className="recovery-panel" role="status">Đang mở màn hình…</p>}><Screen data={club.data} setData={club.setData} isAdmin={club.isAdmin && !IS_ARCHIVED_SEASON} setIsAdmin={()=>setIsAuthModalOpen(true)} setActiveTab={navigate} setRecorderSubTab={setRecorderSubTab} subTab={recorderSubTab} setSubTab={setRecorderSubTab} /></Suspense>}
    </main>
    <AuthDialog isOpen={isAuthModalOpen} onClose={()=>setIsAuthModalOpen(false)} />
    <footer className="app-footer"><strong>{CLUB_NAME} PRO RANK</strong><p>Quản lý và xếp hạng CLB Pickleball</p></footer>
  </div>;
}
