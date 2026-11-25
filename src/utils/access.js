import { IS_ARCHIVED_SEASON } from './config.js';

let access = { userId: null, role: null, local: false };
export function setAccess(value) { access = { userId: null, role: null, local: false, ...value }; }
export function getAccess() { return { ...access }; }
export function requireWrite() {
  if (IS_ARCHIVED_SEASON) throw new Error('Mùa giải này đã lưu trữ. Chọn mùa mới nhất để chỉnh sửa.');
  if (!['admin','manager'].includes(access.role)) throw new Error('Vui lòng đăng nhập bằng tài khoản quản lý của CLB.');
  if (access.writable === false) throw new Error('Một tab khác đang quản lý CLB. Đóng tab đó rồi tải lại trang này để chỉnh sửa.');
}
export function requireOwner() {
  requireWrite();
  if (access.role !== 'admin') throw new Error('Chỉ quản trị viên toàn quyền được truy cập CSDL và Thu Chi.');
}
