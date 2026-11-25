import { createClient } from 'npm:@supabase/supabase-js@2.106.1';

const projectUrl = Deno.env.get('SUPABASE_URL') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const allowedOrigin = 'https://pickle-ball-pho.vercel.app';
const accountMailbox = 'vanquanghc@gmail.com';

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Vary': 'Origin',
});
const reply = (origin: string | null, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  if (origin && origin !== allowedOrigin) return reply(origin, 403, { error: 'Nguồn truy cập không được phép.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'POST') return reply(origin, 405, { error: 'Phương thức không được phép.' });
  if (!projectUrl || !publicKey || !serviceKey) return reply(origin, 503, { error: 'Máy chủ chưa cấu hình chức năng tài khoản.' });

  const bearer = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') || '');
  if (!bearer) return reply(origin, 401, { error: 'Hãy đăng nhập quản trị trước.' });

  try {
    const userClient = createClient(projectUrl, publicKey, {
      global: { headers: { Authorization: `Bearer ${bearer[1]}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser(bearer[1]);
    if (authError || !auth.user) return reply(origin, 401, { error: 'Phiên đăng nhập đã hết hạn.' });
    const { data: callerRole, error: roleError } = await userClient.rpc('club_my_role', { p_club_id: 3 });
    if (roleError || callerRole !== 'admin') return reply(origin, 403, { error: 'Chỉ quản trị viên toàn quyền được tạo tài khoản.' });

    if (Number(request.headers.get('Content-Length') || 0) > 2048) return reply(origin, 413, { error: 'Biểu mẫu quá dài.' });
    const input = await request.json();
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const role = input.role;
    if (!/^[a-z][a-z0-9]{2,19}$/.test(username) || username === 'quanly') {
      return reply(origin, 400, { error: 'Tên đăng nhập cần 3–20 chữ cái/số, bắt đầu bằng chữ và không dùng tên quanly.' });
    }
    if (password.length < 6 || password.length > 128) return reply(origin, 400, { error: 'Mật khẩu cần từ 6 đến 128 ký tự.' });
    if (role !== 'admin' && role !== 'manager') return reply(origin, 400, { error: 'Vai trò không hợp lệ.' });

    const email = accountMailbox.replace('@', `+${username}@`);
    const adminClient = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError) {
      const duplicate = /already|registered|exists/i.test(createError.message);
      return reply(origin, duplicate ? 409 : 422, { error: duplicate ? 'Tên đăng nhập này đã tồn tại.' : 'Supabase không chấp nhận mật khẩu hoặc tài khoản này. Hãy thử mật khẩu mạnh hơn.' });
    }
    if (!created.user) return reply(origin, 502, { error: 'Supabase chưa xác nhận tài khoản mới.' });

    const { error: grantError } = await adminClient.rpc('club_admin_create_memberships', { p_user_id: created.user.id, p_role: role });
    if (grantError) {
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(created.user.id);
      return reply(origin, 500, { error: rollbackError
        ? 'Tài khoản đã tạo nhưng chưa được cấp quyền. Hãy báo quản trị viên để kiểm tra.'
        : 'Chưa cấp được quyền; tài khoản vừa tạo đã được thu hồi. Vui lòng thử lại.' });
    }
    return reply(origin, 201, { username, role, recoveryEmail: accountMailbox });
  } catch {
    return reply(origin, 500, { error: 'Chưa tạo được tài khoản. Vui lòng thử lại.' });
  }
});
