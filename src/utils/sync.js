import { readState, commitState, newId, snapshot } from './storage.js';
import { normalizeClub, stableJson } from './schema.js';
export function createSyncEngine({ read, write, status = () => {}, canWrite = () => false, canApplyRemote = () => true }) {
  let running = false, stopped = false, conflict = null;
  const notify = (kind, message) => status({ kind, message, conflict });
  async function sync() {
    if (running || stopped) return;
    running = true;
    try {
      let current = readState();
      if (conflict) {
        if (!canApplyRemote()) {
          notify('deferred', 'Hoàn tất hoặc đóng biểu mẫu để kiểm tra lại dữ liệu máy chủ.'); return;
        }
        const generation = current.generation;
        const latest = await read();
        if (stopped || readState().generation !== generation) return;
        if (latest.kind === 'missing') { notify('missing', 'Máy chủ chưa có dữ liệu CLB. Không tự khởi tạo hoặc ghi đè.'); return; }
        const incoming = normalizeClub(latest.data);
        if (stableJson(current.data) === stableJson(incoming)) {
          commitState({ data: incoming, baseRevision: latest.revision, pending: false,
            operationId: null, acknowledged: true, legacy: false }, generation, { backup: false });
          conflict = null; notify('saved', 'Đã đồng bộ với máy chủ.'); return;
        }
        conflict = { remote: latest, local: current.data };
        notify('conflict', 'Bản trên máy khác bản máy chủ. Cả hai bản được giữ để đối chiếu.'); return;
      }
      if (current.pending) {
        if (!canWrite()) return;
        notify('saving', 'Đang lưu lên máy chủ…');
        const sent = current;
        const result = await write(sent.data, sent.baseRevision, sent.operationId);
        if (stopped) return;
        if (result?.conflict) {
          conflict = { remote: result.current, local: readState().data };
          notify('conflict', 'Máy khác đã thay đổi dữ liệu. Cả hai bản được giữ để đối chiếu.'); return;
        }
        if (!Number.isSafeInteger(result?.revision)) throw new Error('Máy chủ trả phiên bản không hợp lệ.');
        current = readState();
        if (current.baseRevision !== sent.baseRevision) return;
        const unchanged = current.generation === sent.generation;
        commitState({ ...current, baseRevision: result.revision, pending: !unchanged,
          operationId: unchanged ? null : newId('operation'), acknowledged: true, legacy: false }, current.generation, { backup: false });
        notify(unchanged ? 'saved' : 'pending', unchanged ? 'Đã lưu trên máy chủ.' : 'Còn thay đổi trên máy đang chờ gửi.'); return;
      }
      const generation = current.generation;
      const remote = await read();
      if (stopped || readState().generation !== generation) return;
      if (remote.kind === 'missing') { notify('missing', 'Máy chủ chưa có dữ liệu CLB. Không tự khởi tạo hoặc ghi đè.'); return; }
      const incoming = normalizeClub(remote.data);
      if (current.acknowledged && current.baseRevision !== remote.revision && !canApplyRemote()) {
        notify('deferred', 'Máy chủ có bản mới. Hoàn tất hoặc đóng biểu mẫu để đối chiếu; bản đang nhập vẫn được giữ.'); return;
      }
      if (current.legacy && stableJson(current.data) !== stableJson(incoming)) {
        conflict = { remote, local: current.data };
        notify('conflict', 'Bản cũ trên máy khác bản máy chủ. Hãy sao lưu và đối chiếu trước khi chọn.'); return;
      }
      if (current.baseRevision !== remote.revision || !current.acknowledged) {
        commitState({ data: incoming, baseRevision: remote.revision, pending: false, operationId: null, acknowledged: true, legacy: false }, generation, { label: 'before_remote_update' });
      }
      notify('saved', 'Đã đồng bộ với máy chủ.');
    } catch (error) { notify('error', `${error.message} Dữ liệu trên máy chưa bị xóa.`); }
    finally { running = false; }
  }
  function resolveRemote() {
    if (!conflict?.remote) throw new Error('Chưa có bản máy chủ để đối chiếu.');
    const current = readState(); snapshot(current.data, 'before_conflict_resolution');
    commitState({ data: normalizeClub(conflict.remote.data), baseRevision: conflict.remote.revision,
      pending: false, operationId: null, acknowledged: true, legacy: false }, current.generation, { backup: false });
    conflict = null; notify('saved', 'Đã chọn bản máy chủ; bản trên máy vẫn nằm trong lịch sử sao lưu.');
  }
  return { sync, resolveRemote, stop: () => { stopped = true; }, getConflict: () => conflict };
}
