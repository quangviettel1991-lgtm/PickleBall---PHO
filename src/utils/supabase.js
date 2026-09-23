import { createClient } from '@supabase/supabase-js';
import { CLUB_ID, IS_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from './config.js';
export const supabase = IS_CONFIGURED ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
export async function remoteRead(publicOnly = false) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối CLB. Dữ liệu trên máy được giữ nguyên.');
  const { data, error } = await supabase.rpc(publicOnly ? 'club_public_read' : 'club_read', { p_club_id: Number(CLUB_ID) });
  if (error) throw new Error('Chưa kết nối được dữ liệu CLB hoặc máy chủ chưa được nâng cấp quyền truy cập.');
  if (!data) return { kind: 'missing' };
  return { kind: 'found', ...data };
}
export async function remoteWrite(data, revision, operationId) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối CLB.');
  const result = await supabase.rpc('club_save', { p_club_id: Number(CLUB_ID), p_expected_revision: revision, p_data: data, p_operation_id: operationId });
  if (result.error) throw new Error('Chưa lưu được lên máy chủ. Bản trên máy vẫn được giữ để thử lại.');
  return result.data;
}
export async function getRole() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('club_my_role', { p_club_id: Number(CLUB_ID) });
  if (error) throw new Error('Chưa xác minh được quyền quản trị. Cần cấu hình tài khoản và quyền trên máy chủ.');
  return data;
}
