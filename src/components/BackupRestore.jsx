import React, { useState, useRef } from "react";
import { Database, Download, Upload, RotateCcw, Trash2, CheckCircle2, AlertTriangle, FileJson } from "lucide-react";
import { resetToDemoData, clearAllData, saveClubData } from "../utils/db";
import Modal from "./Modal";

export default function BackupRestore({ data, setData, isAdmin }) {
  const fileInputRef = useRef(null);
  
  // Trạng thái thông báo thành công
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Trạng thái các Modals xác nhận
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [confirmClearText, setConfirmClearText] = useState("");

  // --- 1. XUẤT DỮ LIỆU (EXPORT) ---
  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `pickleball_club_backup_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      showSuccess("Xuất sao lưu dữ liệu thành công! File JSON đã được tải về.");
    } catch (e) {
      showError("Gặp lỗi trong quá trình xuất dữ liệu sao lưu.");
    }
  };

  // --- 2. NHẬP DỮ LIỆU (IMPORT) ---
  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleImportFile = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        
        // Kiểm tra tính hợp lệ cơ bản của cấu trúc dữ liệu Pickleball
        if (
          parsedData &&
          Array.isArray(parsedData.members) &&
          Array.isArray(parsedData.events) &&
          Array.isArray(parsedData.matches)
        ) {
          if (!Array.isArray(parsedData.transactions)) {
            parsedData.transactions = [];
          }
          saveClubData(parsedData);
          setData(parsedData);
          showSuccess("Khôi phục cơ sở dữ liệu thành công! Ứng dụng đã đồng bộ.");
        } else {
          showError("Cấu trúc file sao lưu không hợp lệ. Vui lòng chọn file do ứng dụng này xuất ra.");
        }
      } catch (err) {
        showError("Lỗi đọc file JSON. Vui lòng đảm bảo định dạng file chuẩn.");
      }
    };
    fileReader.readAsText(file);
    // Reset file input để có thể chọn lại cùng 1 file
    e.target.value = "";
  };

  // --- 3. ĐẶT LẠI DỮ LIỆU MẪU (RESET DEMO) ---
  const handleResetDemo = () => {
    const defaultData = resetToDemoData();
    setData(defaultData);
    setIsResetOpen(false);
    showSuccess("Đã tải lại bộ dữ liệu mẫu thành công để trải nghiệm thử.");
  };

  // --- 4. XÓA SẠCH DỮ LIỆU (CLEAR) ---
  const handleClearAll = () => {
    if (confirmClearText.trim().toUpperCase() !== "XÓA") {
      showError("Mã xác nhận xóa chưa chính xác.");
      return;
    }

    const emptyData = clearAllData();
    setData(emptyData);
    setIsClearOpen(false);
    setConfirmClearText("");
    showSuccess("Đã xóa sạch cơ sở dữ liệu CLB. Bạn có thể bắt đầu thêm dữ liệu từ đầu.");
  };

  // --- THÔNG BÁO ---
  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 4000);
  };

  return (
    <div className="backup-container animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        .backup-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .backup-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }

        .backup-title {
          font-size: 1.75rem;
          font-weight: 800;
        }

        .backup-title svg {
          color: var(--accent-neon-green);
        }

        .backup-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        .db-action-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          height: 100%;
        }

        .db-card-icon-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .db-card-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .export-card .db-card-icon-wrapper { background: rgba(0, 236, 255, 0.08); color: var(--accent-electric-blue); border: 1px solid rgba(0, 236, 255, 0.15); }
        .import-card .db-card-icon-wrapper { background: rgba(212, 252, 52, 0.08); color: var(--accent-neon-green); border: 1px solid rgba(212, 252, 52, 0.15); }
        .reset-card .db-card-icon-wrapper { background: rgba(255, 165, 2, 0.08); color: var(--color-warning); border: 1px solid rgba(255, 165, 2, 0.15); }
        .clear-card .db-card-icon-wrapper { background: rgba(255, 71, 87, 0.08); color: var(--color-danger); border: 1px solid rgba(255, 71, 87, 0.15); }

        .db-card-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #fff;
        }

        .db-card-desc {
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.5;
          flex-grow: 1;
        }

        .alert-floating {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 1000;
          padding: 16px 20px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          animation: slideInAlert 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .alert-success {
          background: #121824;
          border: 1px solid var(--accent-neon-green);
          color: var(--accent-neon-green);
        }

        .alert-error {
          background: #121824;
          border: 1px solid var(--color-danger);
          color: var(--color-danger);
        }

        @keyframes slideInAlert {
          from { transform: translateX(50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .hidden-file-input {
          display: none;
        }

        /* Responsive */
        @media (max-width: 600px) {
          .backup-grid {
            grid-template-columns: 1fr;
          }
        }
      `}} />

      {/* THÔNG BÁO POPUP NỔI */}
      {successMessage && (
        <div className="alert-floating alert-success">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert-floating alert-error">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* FILE INPUT ẨN */}
      <input 
        type="file" 
        accept=".json" 
        className="hidden-file-input" 
        ref={fileInputRef} 
        onChange={handleImportFile}
      />

      <div className="backup-header">
        <Database size={28} />
        <h1 className="backup-title">Quản Trị Cơ Sở Dữ Liệu</h1>
      </div>

      {/* Lưới các hành động CSDL */}
      <div className="backup-grid">
        {/* Xuất sao lưu */}
        <div className="glass-panel db-action-card export-card">
          <div className="db-card-icon-title">
            <div className="db-card-icon-wrapper">
              <Download size={20} />
            </div>
            <h3 className="db-card-title">Sao Lưu Dữ Liệu</h3>
          </div>
          <p className="db-card-desc">
            Tải toàn bộ cấu trúc dữ liệu hiện tại của CLB (bao gồm danh sách thành viên, các sự kiện giải đấu và lịch sử tất cả các trận đấu) về máy tính của bạn dưới định dạng tệp tin JSON an toàn.
          </p>
          <button className="btn-neon-green" onClick={handleExport} style={{ alignSelf: "flex-start", width: "100%", justifyContent: "center" }}>
            <Download size={16} /> Tải File Sao Lưu (.json)
          </button>
        </div>

        {/* Khôi phục */}
        {isAdmin && (
          <div className="glass-panel db-action-card import-card">
            <div className="db-card-icon-title">
              <div className="db-card-icon-wrapper">
                <Upload size={20} />
              </div>
              <h3 className="db-card-title">Phục Hồi Dữ Liệu</h3>
            </div>
            <p className="db-card-desc">
              Chọn tệp tin sao lưu cấu trúc JSON đã tải về trước đó từ máy tính của bạn để khôi phục lại toàn bộ dữ liệu CLB. Cảnh báo: Thao tác này sẽ ghi đè lên dữ liệu hiện tại trên trình duyệt này!
            </p>
            <button className="btn-electric-blue" onClick={handleImportClick} style={{ alignSelf: "flex-start", width: "100%", justifyContent: "center" }}>
              <Upload size={16} /> Chọn File Khôi Phục (.json)
            </button>
          </div>
        )}

        {/* Đặt lại dữ liệu mẫu */}
        {isAdmin && (
          <div className="glass-panel db-action-card reset-card">
            <div className="db-card-icon-title">
              <div className="db-card-icon-wrapper">
                <RotateCcw size={20} />
              </div>
              <h3 className="db-card-title">Tải Lại Dữ Liệu Mẫu (Demo)</h3>
            </div>
            <p className="db-card-desc">
              Tự động điền nhanh dữ liệu mô phỏng phong phú cho CLB của bạn (gồm 8 thành viên hoạt bát, 2 giải đấu và 12 trận đấu đơn/đôi thực tế). Rất hữu ích để trải nghiệm thử các tính năng biểu đồ, lọc BXH.
            </p>
            <button className="btn-secondary" onClick={() => setIsResetOpen(true)} style={{ alignSelf: "flex-start", width: "100%", justifyContent: "center", borderColor: "rgba(255, 165, 2, 0.2)", color: "var(--color-warning)" }}>
              <RotateCcw size={16} /> Nạp Dữ Liệu Demo
            </button>
          </div>
        )}

        {/* Xóa sạch CSDL */}
        {isAdmin && (
          <div className="glass-panel db-action-card clear-card">
            <div className="db-card-icon-title">
              <div className="db-card-icon-wrapper">
                <Trash2 size={20} />
              </div>
              <h3 className="db-card-title">Xóa Sạch Dữ Liệu</h3>
            </div>
            <p className="db-card-desc">
              Xóa vĩnh viễn toàn bộ dữ liệu của CLB trên trình duyệt này để chuẩn bị hệ thống sạch hoàn toàn cho một mùa giải hoặc một CLB Pickleball mới. Bạn nên sao lưu dữ liệu trước khi thực hiện.
            </p>
            <button className="btn-secondary" onClick={() => setIsClearOpen(true)} style={{ alignSelf: "flex-start", width: "100%", justifyContent: "center", borderColor: "rgba(255, 71, 87, 0.2)", color: "var(--color-danger)" }}>
              <Trash2 size={16} /> Xóa Cơ Sở Dữ Liệu
            </button>
          </div>
        )}

        {/* Giao diện khóa dành cho người dùng thường */}
        {!isAdmin && (
          <div className="glass-panel db-action-card" style={{ border: "1px dashed var(--border-color)", background: "rgba(255,255,255,0.01)", justifyContent: "center", alignItems: "center", padding: "32px", textAlign: "center" }}>
            <FileJson size={40} style={{ color: "var(--accent-electric-blue)", marginBottom: "16px", opacity: 0.7 }} />
            <h3 className="db-card-title" style={{ marginBottom: "8px" }}>Chế Độ Chỉ Đọc</h3>
            <p className="db-card-desc" style={{ maxWidth: "280px", margin: "0 auto", fontSize: "0.82rem" }}>
              Các tính năng Khôi phục, Cài đặt lại và Xóa dữ liệu đã bị khóa. Vui lòng sử dụng mã PIN Admin trên thanh menu để mở khóa.
            </p>
          </div>
        )}
      </div>

      {/* --- MODAL XÁC NHẬN NẠP DEMO --- */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="Xác Nhận Nạp Dữ Liệu Demo"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Hành động này sẽ ghi đè và thay thế hoàn toàn dữ liệu hiện tại bằng tập dữ liệu giả lập mẫu của ứng dụng. Bạn có chắc chắn muốn thực hiện?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button className="btn-secondary" onClick={() => setIsResetOpen(false)}>Hủy</button>
            <button className="btn-neon-green" onClick={handleResetDemo}>Đồng ý nạp Demo</button>
          </div>
        </div>
      </Modal>

      {/* --- MODAL XÁC NHẬN XÓA SẠCH --- */}
      <Modal
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        title="CẢNH BÁO: XÓA SẠCH CƠ SỞ DỮ LIỆU"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu thành viên, giải đấu và lịch sử trận đấu của CLB. Để tránh vô ý, vui lòng nhập chữ <strong style={{ color: "var(--color-danger)" }}>XÓA</strong> vào ô dưới đây để xác nhận:
          </p>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Nhập XÓA để xác nhận" 
            value={confirmClearText}
            onChange={e => setConfirmClearText(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
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
    </div>
  );
}
