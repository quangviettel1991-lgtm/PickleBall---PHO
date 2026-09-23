import PropTypes from 'prop-types';
import './BackupRestore.css';
import { CLUB_ID } from '../utils/config.js';
import { parseBackup, MAX_IMPORT_BYTES } from '../utils/schema.js';
import { exportBackup, downloadJson } from '../utils/storage.js';
import { useState, useRef, useEffect } from "react";
import {
  Database, Download, Upload, RotateCcw, Trash2,
  CheckCircle2, AlertTriangle, FileJson, Camera,
  Clock, History, RefreshCw
} from "lucide-react";
import {
  resetToDemoData, clearAllData, saveClubData,
  getSnapshots, restoreSnapshot, createManualSnapshot, clearSnapshots
} from "../utils/db";
import Modal from "./Modal";

export default function BackupRestore({ data, setData, isAdmin }) {
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage]     = useState("");
  const [isResetOpen, setIsResetOpen]       = useState(false);
  const [isClearOpen, setIsClearOpen]       = useState(false);
  const [confirmClearText, setConfirmClearText] = useState("");

  // Snapshot state
  const [snapshots, setSnapshots]                       = useState([]);
  const [restoreConfirmSnapshot, setRestoreConfirmSnapshot] = useState(null);
  const [isClearSnapshotsOpen, setIsClearSnapshotsOpen] = useState(false);

  // Load snapshots on mount
  useEffect(() => {
    setSnapshots(getSnapshots());
  }, []);

  const refreshSnapshots = () => setSnapshots(getSnapshots());

  // ── Helpers ──────────────────────────────────────────────
  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4500);
  };
  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 4500);
  };

  const formatDateTime = (iso) => {
    try {
      return new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch { return iso; }
  };

  const getLabelBadge = (label) => {
    if (label === "manual")
      return { text: "Thủ công", color: "var(--accent-neon-green)", bg: "rgba(212,252,52,0.1)" };
    if (label === "before_restore")
      return { text: "Trước Restore", color: "var(--color-warning)", bg: "rgba(255,165,2,0.1)" };
    return { text: "Tự động", color: "var(--accent-electric-blue)", bg: "rgba(0,236,255,0.1)" };
  };

  // ── Export ───────────────────────────────────────────────
  const handleExport = () => {
    try {
      downloadJson(exportBackup(data, CLUB_ID), `pickleball_backup_${new Date().toISOString().slice(0,10)}.json`);
      showSuccess("Xuất sao lưu dữ liệu thành công! File JSON đã được tải về.");
    } catch { showError("Gặp lỗi trong quá trình xuất dữ liệu."); }
  };

  // ── Import ───────────────────────────────────────────────
  const handleImportClick = () => fileInputRef.current.click();

  const handleImportFile = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('File vượt giới hạn 8 MB.');
      setImportPreview(parseBackup(await file.text(), CLUB_ID));
    } catch (failure) { showError(failure.message); }
  };
  const confirmImport = () => {
    try {
      const restored = saveClubData(importPreview);
      setData(restored); setImportPreview(null); refreshSnapshots();
      showSuccess('Đã phục hồi trên máy. Xem trạng thái đồng bộ ở đầu trang.');
    } catch (failure) { showError(failure.message); }
  };

  // ── Manual Snapshot ──────────────────────────────────────
  const handleCreateSnapshot = () => {
    createManualSnapshot(data, "manual");
    refreshSnapshots();
    showSuccess("✅ Đã chụp snapshot thủ công thành công!");
  };

  // ── Restore Snapshot ─────────────────────────────────────
  const handleRestoreSnapshot = () => {
    if (!restoreConfirmSnapshot) return;
    const restored = restoreSnapshot(restoreConfirmSnapshot.id || restoreConfirmSnapshot.timestamp);
    if (restored) {
      setData(restored);
      setRestoreConfirmSnapshot(null);
      refreshSnapshots();
      showSuccess(`✅ Đã khôi phục dữ liệu về bản snapshot lúc ${formatDateTime(restoreConfirmSnapshot.timestamp)}.`);
    } else {
      showError("Không tìm thấy snapshot. Có thể đã bị xóa.");
      setRestoreConfirmSnapshot(null);
    }
  };

  // ── Download Snapshot ────────────────────────────────────
  const handleDownloadSnapshot = (snap) => {
    try {
      downloadJson(exportBackup(snap.data, CLUB_ID), `snapshot_${snap.timestamp.replace(/[:.]/g, '-')}.json`);
      showSuccess("Đã tải xuống file JSON snapshot thành công!");
    } catch { showError("Không thể tải xuống snapshot này."); }
  };

  // ── Reset Demo ───────────────────────────────────────────
  const handleResetDemo = () => {
    const d = resetToDemoData();
    setData(d);
    setIsResetOpen(false);
    refreshSnapshots();
    showSuccess("Đã tải lại bộ dữ liệu mẫu thành công!");
  };

  // ── Clear All Data ───────────────────────────────────────
  const handleClearAll = () => {
    if (confirmClearText.trim().toUpperCase() !== "XÓA") {
      showError("Mã xác nhận chưa chính xác.");
      return;
    }
    const empty = clearAllData();
    setData(empty);
    setIsClearOpen(false);
    setConfirmClearText("");
    refreshSnapshots();
    showSuccess("Đã xóa sạch cơ sở dữ liệu CLB.");
  };

  // ── Clear Snapshots ──────────────────────────────────────
  const handleClearSnapshots = () => {
    clearSnapshots();
    setSnapshots([]);
    setIsClearSnapshotsOpen(false);
    showSuccess("Đã xóa toàn bộ lịch sử snapshot.");
  };

  // ═══════════════════════════════════════════════════════
  return (
    <div className="backup-container animate-fade-in">


      {/* ── Toast Alerts ─────────────────────────────── */}
      {successMessage && (
        <div className="alert-floating alert-success">
          <CheckCircle2 size={17} /><span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="alert-floating alert-error">
          <AlertTriangle size={17} /><span>{errorMessage}</span>
        </div>
      )}

      <input aria-label="Chọn bản sao lưu JSON" type="file" accept=".json" ref={fileInputRef} onChange={handleImportFile} style={{ display: "none" }} />

      {/* ── Header ───────────────────────────────────── */}
      <div className="backup-header">
        <Database size={28} color="var(--accent-neon-green)" />
        <h1 className="backup-title">Quản Trị Cơ Sở Dữ Liệu</h1>
      </div>

      {/* ── Action Cards ─────────────────────────────── */}
      <div className="backup-grid">
        {/* Xuất sao lưu */}
        <div className="glass-panel db-action-card export-card">
          <div className="db-card-icon-title">
            <div className="db-card-icon-wrapper"><Download size={20} /></div>
            <h3 className="db-card-title">Sao Lưu Dữ Liệu</h3>
          </div>
          <p className="db-card-desc">
            Tải toàn bộ dữ liệu hiện tại của CLB (thành viên, sự kiện, lịch sử trận đấu) về máy tính dưới dạng file JSON an toàn.
          </p>
          <button className="btn-neon-green" onClick={handleExport} style={{ width: "100%", justifyContent: "center" }}>
            <Download size={15} /> Tải File Sao Lưu (.json)
          </button>
        </div>

        {/* Khôi phục từ file */}
        {isAdmin && (
          <div className="glass-panel db-action-card import-card">
            <div className="db-card-icon-title">
              <div className="db-card-icon-wrapper"><Upload size={20} /></div>
              <h3 className="db-card-title">Phục Hồi Từ File</h3>
            </div>
            <p className="db-card-desc">
              Chọn file JSON đã xuất trước đó để khôi phục toàn bộ dữ liệu CLB. Thao tác này ghi đè dữ liệu hiện tại!
            </p>
            <button className="btn-electric-blue" onClick={handleImportClick} style={{ width: "100%", justifyContent: "center" }}>
              <Upload size={15} /> Chọn File Khôi Phục (.json)
            </button>
          </div>
        )}

        {/* Snapshot thủ công */}
        {isAdmin && (
          <div className="glass-panel db-action-card snapshot-card">
            <div className="db-card-icon-title">
              <div className="db-card-icon-wrapper"><Camera size={20} /></div>
              <h3 className="db-card-title">Chụp Snapshot Ngay</h3>
            </div>
            <p className="db-card-desc">
              Lưu ngay &quot;ảnh chụp&quot; trạng thái dữ liệu hiện tại vào danh sách lịch sử bên dưới. Nên làm trước các thao tác quan trọng.
            </p>
            <button
              onClick={handleCreateSnapshot}
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(155,89,182,0.35)", background: "rgba(155,89,182,0.1)", color: "#b388ff", fontWeight: 600, cursor: "pointer" }}
            >
              <Camera size={15} /> Chụp Snapshot Thủ Công
            </button>
          </div>
        )}

        {/* Nạp demo */}
        {isAdmin && (
          <div className="glass-panel db-action-card reset-card">
            <div className="db-card-icon-title">
              <div className="db-card-icon-wrapper"><RotateCcw size={20} /></div>
              <h3 className="db-card-title">Tải Lại Dữ Liệu Mẫu</h3>
            </div>
            <p className="db-card-desc">
              Điền nhanh dữ liệu mô phỏng (8 thành viên, 2 giải đấu, 12 trận đấu). Hữu ích để trải nghiệm thử tính năng.
            </p>
            <button className="btn-secondary" onClick={() => setIsResetOpen(true)}
              style={{ width: "100%", justifyContent: "center", borderColor: "rgba(255,165,2,0.2)", color: "var(--color-warning)" }}>
              <RotateCcw size={15} /> Nạp Dữ Liệu Demo
            </button>
          </div>
        )}

        {/* Xóa sạch */}
        {isAdmin && (
          <div className="glass-panel db-action-card clear-card">
            <div className="db-card-icon-title">
              <div className="db-card-icon-wrapper"><Trash2 size={20} /></div>
              <h3 className="db-card-title">Xóa Sạch Dữ Liệu</h3>
            </div>
            <p className="db-card-desc">
              Thay dữ liệu CLB bằng bản rỗng, bao gồm dữ liệu đồng bộ lên máy chủ. Nên sao lưu hoặc chụp snapshot trước khi thực hiện.
            </p>
            <button className="btn-secondary" onClick={() => setIsClearOpen(true)}
              style={{ width: "100%", justifyContent: "center", borderColor: "rgba(255,71,87,0.2)", color: "var(--color-danger)" }}>
              <Trash2 size={15} /> Xóa Cơ Sở Dữ Liệu
            </button>
          </div>
        )}

        {/* Chỉ đọc */}
        {!isAdmin && (
          <div className="glass-panel db-action-card" style={{ border: "1px dashed var(--border-color)", background: "rgba(255,255,255,0.01)", justifyContent: "center", alignItems: "center", padding: "32px", textAlign: "center" }}>
            <FileJson size={40} style={{ color: "var(--accent-electric-blue)", marginBottom: 16, opacity: 0.7 }} />
            <h3 className="db-card-title" style={{ marginBottom: 8 }}>Chế Độ Chỉ Đọc</h3>
            <p className="db-card-desc" style={{ maxWidth: 280, margin: "0 auto", fontSize: "0.82rem" }}>
              Các tính năng Khôi phục, Snapshot và Xóa dữ liệu đã bị khóa. Vui lòng sử dụng tài khoản quản trị để mở khóa.
            </p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* ── Snapshot History Section ───────────────── */}
      {/* ══════════════════════════════════════════════ */}
      <div className="snapshot-section">
        <div className="snapshot-section-header">
          <div className="snapshot-section-title">
            <History size={22} />
            <span>Lịch Sử Snapshot Tự Động</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 400, color: "var(--text-muted)" }}>
              ({snapshots.length}/30 bản)
            </span>
          </div>
          <div className="snapshot-actions">
            <button className="btn-sm-snap btn-sm-refresh" onClick={refreshSnapshots}>
              <RefreshCw size={13} /> Làm mới
            </button>
            {isAdmin && snapshots.length > 0 && (
              <button className="btn-sm-snap btn-sm-danger" onClick={() => setIsClearSnapshotsOpen(true)}>
                <Trash2 size={13} /> Xóa lịch sử
              </button>
            )}
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div className="snapshot-empty">
            <Clock size={44} />
            <p style={{ marginBottom: 6, fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Chưa có snapshot nào
            </p>
            <p style={{ fontSize: "0.83rem", maxWidth: 420, margin: "0 auto" }}>
              Snapshot sẽ tự động được tạo trước mỗi lần bạn thêm thành viên, ghi nhận trận đấu, tạo sự kiện… trước mỗi thay đổi. Bạn cũng có thể chụp thủ công ở trên.
            </p>
          </div>
        ) : (
          <div className="snapshot-table-wrap">
            <table className="snapshot-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Thời gian tạo</th>
                  <th>Loại</th>
                  <th>Thành viên</th>
                  <th>Sự kiện</th>
                  <th>Trận đấu</th>
                  {isAdmin && <th style={{ textAlign: "right" }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap, idx) => {
                  const badge = getLabelBadge(snap.label);
                  return (
                    <tr key={snap.id || snap.timestamp}>
                      <td><div className="snap-idx">{idx + 1}</div></td>
                      <td>
                        <span style={{ color: "#fff", fontWeight: 500, fontSize: "0.87rem" }}>
                          {formatDateTime(snap.timestamp)}
                        </span>
                      </td>
                      <td>
                        <span className="snap-label" style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.color}40` }}>
                          {badge.text}
                        </span>
                      </td>
                      <td><span className="snap-stat">👤 {snap.membersCount}</span></td>
                      <td><span className="snap-stat">🏆 {snap.eventsCount}</span></td>
                      <td><span className="snap-stat">⚡ {snap.matchesCount}</span></td>
                      {isAdmin && (
                        <td>
                          <div className="snap-btn-group">
                            <button className="btn-sm-snap btn-sm-restore" onClick={() => setRestoreConfirmSnapshot(snap)}>
                              <RotateCcw size={12} /> Khôi phục
                            </button>
                            <button className="btn-sm-snap btn-sm-dl" onClick={() => handleDownloadSnapshot(snap)}>
                              <Download size={12} /> Tải xuống
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ marginTop: 12, fontSize: "0.77rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
          💡 Hệ thống tự động giữ tối đa <strong>30 bản snapshot</strong> gần nhất trên trình duyệt này. Khi đủ 30 bản, bản cũ nhất bị xóa tự động.
          Trước khi khôi phục, hệ thống lưu trạng thái hiện tại như bản <em>&quot;Trước Restore&quot;</em> để bạn có thể undo nếu cần.
        </p>
      </div>

      <Modal isOpen={!!importPreview} onClose={()=>setImportPreview(null)} title="Kiểm tra trước khi phục hồi">
        {importPreview && <><p>Bản nhập có {importPreview.members.length} thành viên, {importPreview.events.length} sự kiện, {importPreview.matches.length} trận, {importPreview.transactions.length} giao dịch và {Object.keys(importPreview.draws).length} lịch đấu.</p><p>Dữ liệu hiện tại sẽ được sao lưu trước khi thay thế. Thay đổi sẽ được đồng bộ lên máy chủ khi không có xung đột.</p><button className="btn-secondary" onClick={()=>setImportPreview(null)}>Hủy</button><button className="btn-neon-green" onClick={confirmImport}>Sao lưu và phục hồi</button></>}
      </Modal>
      {/* ── Modal: Xác nhận Khôi phục Snapshot ────── */}
      <Modal isOpen={!!restoreConfirmSnapshot} onClose={() => setRestoreConfirmSnapshot(null)} title="Xác Nhận Khôi Phục Snapshot">
        {restoreConfirmSnapshot && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Bạn sắp khôi phục dữ liệu về bản snapshot:
            </p>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--border-color)" }}>
              <div style={{ fontWeight: 700, color: "#fff", marginBottom: 8 }}>
                🕐 {formatDateTime(restoreConfirmSnapshot.timestamp)}
              </div>
              <div style={{ display: "flex", gap: 20, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <span>👤 {restoreConfirmSnapshot.membersCount} thành viên</span>
                <span>🏆 {restoreConfirmSnapshot.eventsCount} sự kiện</span>
                <span>⚡ {restoreConfirmSnapshot.matchesCount} trận</span>
              </div>
            </div>
            <div style={{ background: "rgba(255,165,2,0.08)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(255,165,2,0.2)", fontSize: "0.84rem", color: "var(--color-warning)" }}>
              ⚠️ Dữ liệu hiện tại sẽ bị ghi đè. Tuy nhiên hệ thống sẽ tự động lưu trạng thái hiện tại như snapshot <em>&quot;Trước Restore&quot;</em> để bạn undo lại nếu cần.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="btn-secondary" onClick={() => setRestoreConfirmSnapshot(null)}>Hủy</button>
              <button className="btn-neon-green" onClick={handleRestoreSnapshot}>
                <RotateCcw size={14} /> Xác nhận khôi phục
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Nạp Demo ──────────────────────────── */}
      <Modal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} title="Xác Nhận Nạp Dữ Liệu Demo">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Hành động này sẽ ghi đè và thay thế hoàn toàn dữ liệu hiện tại bằng tập dữ liệu mẫu. Bạn có chắc chắn muốn thực hiện?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button className="btn-secondary" onClick={() => setIsResetOpen(false)}>Hủy</button>
            <button className="btn-neon-green" onClick={handleResetDemo}>Đồng ý nạp Demo</button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Xóa sạch dữ liệu ─────────────────── */}
      <Modal isOpen={isClearOpen} onClose={() => setIsClearOpen(false)} title="CẢNH BÁO: XÓA SẠCH CƠ SỞ DỮ LIỆU">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Hành động này xóa vĩnh viễn toàn bộ dữ liệu thành viên, giải đấu và lịch sử trận đấu. Nhập chữ{" "}
            <strong style={{ color: "var(--color-danger)" }}>XÓA</strong> để xác nhận:
          </p>
          <input aria-label="Nhập XÓA để xác nhận"
            type="text"
            className="form-input"
            placeholder="Nhập XÓA để xác nhận"
            value={confirmClearText}
            onChange={e => setConfirmClearText(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button className="btn-secondary" onClick={() => setIsClearOpen(false)}>Hủy</button>
            <button
              className="btn-neon-green"
              style={{ backgroundColor: "var(--color-danger)", color: "#fff" }}
              onClick={handleClearAll}
              disabled={confirmClearText.trim().toUpperCase() !== "XÓA"}
            >
              Tôi Hiểu, Xác Nhận Xóa
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Xóa lịch sử snapshot ─────────────── */}
      <Modal isOpen={isClearSnapshotsOpen} onClose={() => setIsClearSnapshotsOpen(false)} title="Xóa Toàn Bộ Lịch Sử Snapshot">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Hành động này xóa toàn bộ <strong>{snapshots.length}</strong> bản snapshot đang lưu. Bạn sẽ không thể khôi phục lại lịch sử này.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button className="btn-secondary" onClick={() => setIsClearSnapshotsOpen(false)}>Hủy</button>
            <button
              className="btn-neon-green"
              style={{ backgroundColor: "var(--color-danger)", color: "#fff" }}
              onClick={handleClearSnapshots}
            >
              Xóa toàn bộ snapshot
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

BackupRestore.propTypes = {
  data: PropTypes.object,
  setData: PropTypes.func,
  isAdmin: PropTypes.bool,
};
