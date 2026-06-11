import React, { useState, useRef, useEffect } from "react";
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
      const uri  = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const name = `pickleball_backup_${new Date().toISOString().split("T")[0]}.json`;
      const a    = document.createElement("a");
      a.setAttribute("href", uri);
      a.setAttribute("download", name);
      a.click();
      showSuccess("Xuất sao lưu dữ liệu thành công! File JSON đã được tải về.");
    } catch { showError("Gặp lỗi trong quá trình xuất dữ liệu."); }
  };

  // ── Import ───────────────────────────────────────────────
  const handleImportClick = () => fileInputRef.current.click();

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed && Array.isArray(parsed.members) && Array.isArray(parsed.events) && Array.isArray(parsed.matches)) {
          if (!Array.isArray(parsed.transactions)) parsed.transactions = [];
          saveClubData(parsed);
          setData(parsed);
          refreshSnapshots();
          showSuccess("Khôi phục cơ sở dữ liệu thành công! Ứng dụng đã đồng bộ.");
        } else {
          showError("Cấu trúc file sao lưu không hợp lệ.");
        }
      } catch { showError("Lỗi đọc file JSON. Đảm bảo định dạng file chuẩn."); }
    };
    reader.readAsText(file);
    e.target.value = "";
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
    const restored = restoreSnapshot(restoreConfirmSnapshot.timestamp);
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
      const uri  = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snap.data, null, 2));
      const ts   = snap.timestamp.replace(/[:.]/g, "-");
      const name = `snapshot_${ts}.json`;
      const a    = document.createElement("a");
      a.setAttribute("href", uri);
      a.setAttribute("download", name);
      a.click();
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
      <style dangerouslySetInnerHTML={{ __html: `
        .backup-container { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
        .backup-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .backup-title { font-size: 1.75rem; font-weight: 800; }
        .backup-title svg { color: var(--accent-neon-green); }
        .backup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
        .db-action-card { padding: 24px; display: flex; flex-direction: column; gap: 14px; height: 100%; }
        .db-card-icon-title { display: flex; align-items: center; gap: 12px; }
        .db-card-icon-wrapper { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .db-card-title { font-size: 1.1rem; font-weight: 700; color: #fff; }
        .db-card-desc { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; flex-grow: 1; }

        .export-card .db-card-icon-wrapper { background: rgba(0,236,255,0.08); color: var(--accent-electric-blue); border: 1px solid rgba(0,236,255,0.15); }
        .import-card .db-card-icon-wrapper { background: rgba(212,252,52,0.08); color: var(--accent-neon-green); border: 1px solid rgba(212,252,52,0.15); }
        .snapshot-card .db-card-icon-wrapper { background: rgba(155,89,182,0.1); color: #b388ff; border: 1px solid rgba(155,89,182,0.2); }
        .reset-card .db-card-icon-wrapper { background: rgba(255,165,2,0.08); color: var(--color-warning); border: 1px solid rgba(255,165,2,0.15); }
        .clear-card .db-card-icon-wrapper { background: rgba(255,71,87,0.08); color: var(--color-danger); border: 1px solid rgba(255,71,87,0.15); }

        /* ── Snapshot Section ── */
        .snapshot-section { margin-top: 4px; }
        .snapshot-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
        .snapshot-section-title { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; font-weight: 700; color: #fff; }
        .snapshot-section-title svg { color: #9b59b6; }
        .snapshot-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        .snapshot-empty { text-align: center; padding: 48px 24px; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 12px; }
        .snapshot-empty svg { display: block; margin: 0 auto 12px; opacity: 0.35; }

        .snapshot-table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border-color); }
        .snapshot-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .snapshot-table th { background: rgba(255,255,255,0.04); padding: 12px 16px; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; border-bottom: 1px solid var(--border-color); }
        .snapshot-table td { padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .snapshot-table tr:last-child td { border-bottom: none; }
        .snapshot-table tr:hover td { background: rgba(255,255,255,0.025); }

        .snap-label { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
        .snap-stat { font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap; }
        .snap-idx { width: 26px; height: 26px; border-radius: 50%; background: rgba(155,89,182,0.15); border: 1px solid rgba(155,89,182,0.3); color: #b388ff; font-weight: 700; font-size: 0.76rem; display: flex; align-items: center; justify-content: center; }
        .snap-btn-group { display: flex; gap: 7px; align-items: center; justify-content: flex-end; }

        .btn-sm-snap { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 7px; font-size: 0.78rem; font-weight: 600; cursor: pointer; border: 1px solid; transition: all 0.15s ease; white-space: nowrap; }
        .btn-sm-restore { background: rgba(212,252,52,0.08); border-color: rgba(212,252,52,0.25); color: var(--accent-neon-green); }
        .btn-sm-restore:hover { background: rgba(212,252,52,0.16); border-color: rgba(212,252,52,0.5); }
        .btn-sm-dl { background: rgba(0,236,255,0.06); border-color: rgba(0,236,255,0.2); color: var(--accent-electric-blue); }
        .btn-sm-dl:hover { background: rgba(0,236,255,0.12); border-color: rgba(0,236,255,0.4); }
        .btn-sm-danger { background: rgba(255,71,87,0.07); border-color: rgba(255,71,87,0.25); color: var(--color-danger); }
        .btn-sm-refresh { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); color: var(--text-secondary); }
        .btn-sm-refresh:hover { background: rgba(255,255,255,0.08); color: #fff; }

        /* Alert */
        .alert-floating { position: fixed; top: 24px; right: 24px; z-index: 9999; padding: 14px 20px; border-radius: 10px; display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 0.88rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: sIA 0.3s cubic-bezier(0.16,1,0.3,1) forwards; max-width: 400px; }
        .alert-success { background: #121824; border: 1px solid var(--accent-neon-green); color: var(--accent-neon-green); }
        .alert-error   { background: #121824; border: 1px solid var(--color-danger);      color: var(--color-danger);      }
        @keyframes sIA { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        @media (max-width: 640px) {
          .backup-grid { grid-template-columns: 1fr; }
          .snapshot-section-header { flex-direction: column; align-items: flex-start; }
        }
      ` }} />

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

      <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportFile} style={{ display: "none" }} />

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
              Lưu ngay "ảnh chụp" trạng thái dữ liệu hiện tại vào danh sách lịch sử bên dưới. Nên làm trước các thao tác quan trọng.
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
              Xóa vĩnh viễn toàn bộ dữ liệu CLB trên trình duyệt này. Nên sao lưu hoặc chụp snapshot trước khi thực hiện.
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
              Các tính năng Khôi phục, Snapshot và Xóa dữ liệu đã bị khóa. Vui lòng sử dụng mã PIN Admin để mở khóa.
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
              ({snapshots.length}/14 bản)
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
              Snapshot sẽ tự động được tạo sau mỗi lần bạn thêm thành viên, ghi nhận trận đấu, tạo sự kiện… (tối thiểu cách nhau 5 phút). Bạn cũng có thể chụp thủ công ở trên.
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
                    <tr key={snap.timestamp}>
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
          💡 Hệ thống tự động giữ tối đa <strong>14 bản snapshot</strong> gần nhất (~2 tuần). Khi đủ 14 bản, bản cũ nhất bị xóa tự động.
          Trước khi khôi phục, hệ thống lưu trạng thái hiện tại như bản <em>"Trước Restore"</em> để bạn có thể undo nếu cần.
        </p>
      </div>

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
              ⚠️ Dữ liệu hiện tại sẽ bị ghi đè. Tuy nhiên hệ thống sẽ tự động lưu trạng thái hiện tại như snapshot <em>"Trước Restore"</em> để bạn undo lại nếu cần.
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
          <input
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
