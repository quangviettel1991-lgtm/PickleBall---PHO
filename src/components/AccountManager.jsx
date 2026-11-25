import PropTypes from 'prop-types';
import { useState } from 'react';
import { KeyRound, ShieldCheck, ShieldHalf, UserPlus } from 'lucide-react';
import { supabase } from '../utils/supabase.js';
import { ACCOUNT_AUTH_MAILBOX } from '../utils/config.js';
import './AccountManager.css';

export default function AccountManager({ isAdmin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('manager');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!isAdmin || !supabase) return;
    setBusy(true); setError(''); setCreated(null);
    try {
      const result = await supabase.functions.invoke('create-club-account', { body: { username: username.trim().toLowerCase(), password, role } });
      if (result.error) {
        let message = 'Chưa tạo được tài khoản. Vui lòng thử lại.';
        try { message = (await result.error.context?.json())?.error || message; } catch { /* Keep the safe message. */ }
        throw new Error(message);
      }
      setCreated(result.data);
      setUsername('');
    } catch (failure) { setError(failure.message); }
    finally { setPassword(''); setBusy(false); }
  }

  return <div className="account-manager animate-fade-in">
    <div className="account-header"><span className="season-eyebrow">QUẢN TRỊ CLB · 2027</span><h1>Tạo tài khoản phụ</h1><p>Người được cấp quyền đăng nhập bằng tên và mật khẩu riêng. Mật khẩu không hiện lại sau khi tạo.</p></div>
    <div className="account-layout">
      <form className="account-form glass-panel" onSubmit={submit}>
        <div className="account-form-title"><UserPlus size={21} /><h2>Thông tin tài khoản</h2></div>
        <label className="form-label" htmlFor="club-username">Tên đăng nhập</label>
        <input id="club-username" className="form-input" type="text" autoComplete="off" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} pattern="[a-z][a-z0-9]{2,19}" minLength={3} maxLength={20} placeholder="Ví dụ: pho" required />
        <p className="account-field-hint">3–20 chữ cái hoặc số, bắt đầu bằng chữ. Không dùng tên quanly.</p>

        <label className="form-label" htmlFor="club-password">Mật khẩu mới</label>
        <input id="club-password" className="form-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} maxLength={128} required />
        <p className="account-field-hint">Supabase có thể yêu cầu mật khẩu mạnh hơn. Không chia sẻ mật khẩu qua chat.</p>

        <fieldset className="account-roles"><legend>Quyền truy cập</legend>
          <label className={role === 'manager' ? 'account-role selected' : 'account-role'}><input type="radio" name="club-role" value="manager" checked={role === 'manager'} onChange={() => setRole('manager')} /><ShieldHalf size={20} /><span><strong>Quản lý thi đấu</strong><small>Thành viên, sự kiện, trận và Elo mùa 2027. Không xem Thu Chi hoặc CSDL.</small></span></label>
          <label className={role === 'admin' ? 'account-role selected' : 'account-role'}><input type="radio" name="club-role" value="admin" checked={role === 'admin'} onChange={() => setRole('admin')} /><ShieldCheck size={20} /><span><strong>Quản trị toàn quyền</strong><small>Toàn bộ chức năng, gồm Thu Chi và CSDL. Mùa 2026 vẫn chỉ đọc.</small></span></label>
        </fieldset>
        {error && <p className="account-feedback error" role="alert">{error}</p>}
        {created && <p className="account-feedback success" role="status">Đã tạo <strong>{created.username}</strong> với quyền {created.role === 'admin' ? 'quản trị toàn quyền' : 'quản lý thi đấu'}. Có thể đăng nhập ngay.</p>}
        <button className="btn-neon-green account-submit" type="submit" disabled={!isAdmin || busy}><UserPlus size={17} />{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
      </form>
      <aside className="account-aside"><div className="account-info glass-panel"><KeyRound size={25} /><h2>Khôi phục mật khẩu</h2><p>Tài khoản không cần email riêng. Thư khôi phục sẽ gửi tới <strong>{ACCOUNT_AUTH_MAILBOX}</strong>. Mỗi tên đăng nhập có một tài khoản Auth độc lập.</p></div><div className="account-info account-security glass-panel"><ShieldCheck size={25} /><h2>Quyền được kiểm tra trên máy chủ</h2><p>Chỉ tài khoản quản trị toàn quyền mới mở được trang này. Tạo tài khoản không sửa thành viên, trận, Elo hay sổ quỹ.</p></div></aside>
    </div>
  </div>;
}

AccountManager.propTypes = { isAdmin: PropTypes.bool };
