import PropTypes from 'prop-types';
import { useState } from 'react';
import Modal from './Modal';
import { supabase } from '../utils/supabase.js';
export default function AuthDialog({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestReset, setRequestReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (!supabase) throw new Error('Website chưa cấu hình đăng nhập.');
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw new Error('Không đăng nhập được. Kiểm tra email và mật khẩu tài khoản quản trị.');
      setPassword(''); onClose();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function sendReset(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (!supabase) throw new Error('Website chưa cấu hình đăng nhập.');
      const redirectTo = `${window.location.origin}/?auth=reset`;
      const { error: failure } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (failure) throw new Error('Chưa gửi được email đặt mật khẩu. Vui lòng thử lại sau.');
      setResetSent(true);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const backToLogin = () => { setRequestReset(false); setResetSent(false); setError(''); };
  return <Modal isOpen={isOpen} onClose={onClose} title={requestReset ? 'Đặt mật khẩu quản trị' : 'Đăng nhập quản trị'}>
    <form onSubmit={requestReset ? sendReset : submit}>
      <label className="form-label" htmlFor="login-email">Email</label>
      <input id="login-email" className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required />
      {!requestReset && <><label className="form-label" htmlFor="login-password">Mật khẩu</label>
        <input id="login-password" className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></>}
      {error && <p role="alert" className="operation-error">{error}</p>}
      {requestReset ? <>
        <p>Nhập email tài khoản quản trị. Liên kết đặt mật khẩu sẽ được gửi tới hộp thư của bạn.</p>
        {resetSent && <p role="status">Nếu email này có tài khoản, hãy kiểm tra hộp thư và thư rác để mở liên kết đặt mật khẩu.</p>}
        <div className="auth-actions"><button className="btn-neon-green" type="submit" disabled={busy || resetSent}>{busy ? 'Đang gửi…' : 'Gửi liên kết đặt mật khẩu'}</button>
          <button className="btn-secondary" type="button" onClick={backToLogin}>Quay lại đăng nhập</button></div>
      </> : <>
        <p>Chỉ tài khoản được cấp quyền cho CLB mới có thể thay đổi dữ liệu.</p>
        <div className="auth-actions"><button className="btn-neon-green" type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
          <button className="btn-secondary" type="button" onClick={() => { setPassword(''); setError(''); setRequestReset(true); }}>Chưa có hoặc quên mật khẩu?</button></div>
      </>}
    </form>
  </Modal>;
}

AuthDialog.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};
