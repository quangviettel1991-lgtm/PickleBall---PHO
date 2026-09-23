import PropTypes from 'prop-types';
import { useState } from 'react';
import Modal from './Modal';
import { supabase } from '../utils/supabase.js';
export default function AuthDialog({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  return <Modal isOpen={isOpen} onClose={onClose} title="Đăng nhập quản trị">
    <form onSubmit={submit}>
      <label className="form-label" htmlFor="login-email">Email</label>
      <input id="login-email" className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required />
      <label className="form-label" htmlFor="login-password">Mật khẩu</label>
      <input id="login-password" className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required />
      {error && <p role="alert" className="operation-error">{error}</p>}
      <p>Chỉ tài khoản được cấp quyền cho CLB mới có thể thay đổi dữ liệu.</p>
      <button className="btn-neon-green" type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
  </Modal>;
}

AuthDialog.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};
