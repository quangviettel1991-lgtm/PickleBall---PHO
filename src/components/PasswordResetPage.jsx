import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase.js';

export default function PasswordResetPage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setLoading(false); }
    });
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (active) { setSession(data?.session ?? null); setError(failure ? 'Không xác thực được liên kết. Vui lòng yêu cầu email mới.' : ''); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function updatePassword(event) {
    event.preventDefault(); setError('');
    if (password.length < 12) { setError('Mật khẩu cần có ít nhất 12 ký tự.'); return; }
    if (password !== confirmation) { setError('Hai lần nhập mật khẩu chưa khớp.'); return; }
    setBusy(true);
    try {
      const { error: failure } = await supabase.auth.updateUser({ password });
      if (failure) throw new Error('Chưa đặt được mật khẩu. Liên kết có thể đã hết hạn; hãy yêu cầu email mới.');
      setPassword(''); setConfirmation(''); setDone(true);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <div className="app-layout"><main className="app-main-content recovery-panel">
    <h1>Đặt mật khẩu quản trị</h1>
    {loading ? <p role="status">Đang xác thực liên kết…</p> : done ? <>
      <p role="status">Mật khẩu đã được đặt. Bạn có thể vào trang quản trị.</p>
      <a className="btn-neon-green" href="/">Vào website Phở</a>
    </> : !session ? <>
      <p role="alert">Liên kết chưa hợp lệ hoặc đã hết hạn. Hãy trở về website và chọn “Chưa có hoặc quên mật khẩu?” để yêu cầu email mới.</p>
      <a href="/">Trở về website Phở</a>
    </> : <form onSubmit={updatePassword}>
      <p>Bạn đang đặt mật khẩu cho {session.user.email}. Không chia sẻ mật khẩu hoặc liên kết trong email với người khác.</p>
      <label className="form-label" htmlFor="new-password">Mật khẩu mới (ít nhất 12 ký tự)</label>
      <input className="form-input" id="new-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} required />
      <label className="form-label" htmlFor="confirm-password">Nhập lại mật khẩu mới</label>
      <input className="form-input" id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
      {error && <p className="operation-error" role="alert">{error}</p>}
      <button className="btn-neon-green" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Đặt mật khẩu'}</button>
    </form>}
  </main></div>;
}
