import React, { useState } from "react";
import { LayoutDashboard, Trophy, Swords, Users, Calendar, Database, Lock, Unlock, X, Shuffle } from "lucide-react";

export default function Navbar({ activeTab, setActiveTab, isAdmin, setIsAdmin, isModalOpen, setIsModalOpen }) {
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");

  const handleAuth = (e) => {
    e.preventDefault();
    if (pinInput === "1234") {
      setIsAdmin(true);
      setIsModalOpen(false);
      setPinInput("");
      setError("");
    } else {
      setError("Mã PIN không chính xác!");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
  };

  const navItems = [
    { id: "dashboard", label: "Tổng Quan", icon: LayoutDashboard },
    { id: "leaderboard", label: "Xếp Hạng", icon: Trophy },
    { id: "recorder", label: "Ghi Điểm", icon: Swords },
    { id: "members", label: "Thành Viên", icon: Users },
    { id: "events", label: "Sự Kiện", icon: Calendar },
    { id: "draw", label: "Bốc Thăm", icon: Shuffle },
    { id: "backup", label: "CSDL", icon: Database },
  ];

  return (
    <nav className="navbar-container">
      <style dangerouslySetInnerHTML={{__html: `
        .navbar-container {
          background: rgba(13, 17, 23, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 90;
        }

        .navbar-content {
          max-width: 1280px;
          margin: 0 auto;
          height: 64px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .navbar-brand-logo {
          width: 34px;
          height: 34px;
          background: linear-gradient(135deg, var(--accent-neon-green), var(--accent-electric-blue));
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 800;
          box-shadow: 0 0 15px rgba(212, 252, 52, 0.2);
        }

        .navbar-brand-text {
          font-size: 1.15rem;
          font-weight: 800;
          background: linear-gradient(90deg, #fff 40%, var(--accent-neon-green) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.02em;
        }

        .navbar-brand-tag {
          font-size: 0.6rem;
          font-weight: 700;
          background: rgba(212, 252, 52, 0.1);
          color: var(--accent-neon-green);
          padding: 1px 5px;
          border-radius: 4px;
          border: 1px solid rgba(212, 252, 52, 0.15);
          text-transform: uppercase;
        }

        .navbar-menu {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 100%;
        }

        .navbar-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          transition: all var(--transition-fast);
          border: 1px solid transparent;
          user-select: none;
        }

        .navbar-item:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.03);
        }

        .navbar-item.active {
          color: var(--accent-neon-green);
          background: rgba(212, 252, 52, 0.06);
          border-color: rgba(212, 252, 52, 0.12);
          font-weight: 600;
        }

        /* --- MOBILE BOTTOM NAVIGATION BAR --- */
        @media (max-width: 768px) {
          .navbar-container {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            border-bottom: none;
            border-top: 1px solid var(--border-color);
            background: rgba(10, 11, 15, 0.92);
            padding: 0;
            z-index: 99;
            box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
          }

          .navbar-content {
            height: 64px;
            padding: 0;
            justify-content: center;
          }

          .navbar-brand {
            display: none; /* Ẩn logo ở thanh điều hướng dưới */
          }

          .navbar-menu {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 0;
            padding: 4px 6px;
          }

          .navbar-item {
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 6px 0;
            border-radius: 6px;
            font-size: 0.68rem;
            color: var(--text-muted);
            border: none;
            background: transparent !important; /* Bỏ nền màu */
          }

          .navbar-item svg {
            width: 20px;
            height: 20px;
            transition: transform 0.2s;
          }

          .navbar-item.active {
            color: var(--accent-neon-green);
            font-weight: 700;
          }

          .navbar-item.active svg {
            color: var(--accent-neon-green);
            transform: translateY(-2px);
          }
        }

        /* Nút Khóa Admin trên PC */
        .admin-lock-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 71, 87, 0.08);
          border: 1px solid rgba(255, 71, 87, 0.2);
          color: var(--color-danger);
          font-size: 0.9rem;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all var(--transition-fast);
          margin-left: 8px;
        }

        .admin-lock-btn:hover {
          background: rgba(255, 71, 87, 0.15);
          border-color: rgba(255, 71, 87, 0.3);
        }

        .admin-lock-btn.logged-admin {
          background: rgba(46, 213, 115, 0.08);
          border: 1px solid rgba(46, 213, 115, 0.2);
          color: var(--color-success);
        }

        .admin-lock-btn.logged-admin:hover {
          background: rgba(46, 213, 115, 0.15);
          border-color: rgba(46, 213, 115, 0.3);
        }

        /* Nút Khóa Admin trên Di động */
        .mobile-admin-lock-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 71, 87, 0.08);
          border: 1px solid rgba(255, 71, 87, 0.2);
          color: var(--color-danger);
          cursor: pointer;
        }

        .mobile-admin-lock-btn.logged-admin {
          background: rgba(46, 213, 115, 0.08);
          border: 1px solid rgba(46, 213, 115, 0.2);
          color: var(--color-success);
        }

        /* Modal Overlay & Card */
        .admin-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .admin-modal-card {
          width: 100%;
          max-width: 400px;
          padding: 28px;
          position: relative;
          margin: auto; /* Centering helper that works beautifully with scrolling when screen size/keyboard reduces space */
        }

        .admin-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .admin-modal-close:hover {
          color: #fff;
          background: rgba(255,255,255,0.05);
        }

        .admin-modal-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 24px;
          gap: 12px;
        }

        .admin-modal-icon-wrapper {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(0, 236, 255, 0.08);
          border: 1px solid rgba(0, 236, 255, 0.15);
          color: var(--accent-electric-blue);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(0, 236, 255, 0.1);
        }

        .admin-modal-title {
          font-size: 1.25rem;
          font-weight: 750;
          color: #fff;
        }

        .admin-modal-subtitle {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .admin-pin-input {
          text-align: center;
          font-size: 1.15rem;
          letter-spacing: 0.2em;
          height: 44px;
        }

        .admin-pin-error {
          color: var(--color-danger);
          font-size: 0.8rem;
          font-weight: 600;
          text-align: center;
          margin-top: 8px;
        }

        .admin-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .admin-modal-actions button {
          width: 50%;
          justify-content: center;
        }

        @media (max-width: 768px) {
          .pc-only-text {
            display: none;
          }
          .admin-lock-btn {
            display: none;
          }
          .admin-modal-overlay {
            padding: 12px;
          }
        }
      `}} />

      {/* Tiêu đề phụ hiển thị ở đỉnh màn hình di động (Do thanh điều hướng chính đã xuống dưới) */}
      <div className="mobile-only-header">
        <style dangerouslySetInnerHTML={{__html: `
          .mobile-only-header {
            display: none;
            height: 56px;
            background: rgba(13, 17, 23, 0.9);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            align-items: center;
            justify-content: center;
            position: sticky;
            top: 0;
            z-index: 80;
          }

          .mobile-header-brand {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .mobile-header-logo {
            width: 26px;
            height: 26px;
            background: linear-gradient(135deg, var(--accent-neon-green), var(--accent-electric-blue));
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #000;
            font-weight: 800;
            font-size: 0.75rem;
          }

          .mobile-header-text {
            font-size: 0.95rem;
            font-weight: 800;
            color: #fff;
            letter-spacing: -0.01em;
          }

          @media (max-width: 768px) {
            .mobile-only-header {
              display: flex;
            }
          }
        `}} />
        <div className="mobile-header-brand">
          <div className="mobile-header-logo">PB</div>
          <span className="mobile-header-text">PICKLEBALL PHỞ PRO RANK</span>
        </div>
        
        {/* Nút Admin Lock trên di động */}
        <button 
          className={`mobile-admin-lock-btn ${isAdmin ? "logged-admin" : ""}`}
          onClick={isAdmin ? handleLogout : () => setIsModalOpen(true)}
          title={isAdmin ? "Đăng xuất Admin" : "Đăng nhập Admin"}
        >
          {isAdmin ? <Unlock size={16} /> : <Lock size={16} />}
        </button>
      </div>
 
      <div className="navbar-content">
        <div className="navbar-brand" onClick={() => setActiveTab("dashboard")}>
          <div className="navbar-brand-logo">PB</div>
          <span className="navbar-brand-text">PICKLEBALL PHỞ</span>
          <span className="navbar-brand-tag">PRO RANK</span>
        </div>
        <div className="navbar-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`navbar-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </div>
            );
          })}
          
          {/* Nút Admin Lock trên PC */}
          <button 
            className={`admin-lock-btn ${isAdmin ? "logged-admin" : ""}`}
            onClick={isAdmin ? handleLogout : () => setIsModalOpen(true)}
            title={isAdmin ? "Đăng xuất Admin" : "Đăng nhập Admin"}
          >
            {isAdmin ? <Unlock size={16} /> : <Lock size={16} />}
            <span className="pc-only-text">{isAdmin ? "Đăng xuất" : "Mở khóa Admin"}</span>
          </button>
        </div>
      </div>

      {/* MODAL NHẬP MÃ PIN ADMIN */}
      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="glass-panel admin-modal-card glow-border-green animate-slide-up">
            <button className="admin-modal-close" onClick={() => { setIsModalOpen(false); setError(""); setPinInput(""); }}>
              <X size={18} />
            </button>
            <div className="admin-modal-header">
              <div className="admin-modal-icon-wrapper">
                <Lock size={24} />
              </div>
              <h3 className="admin-modal-title">Xác Minh Quyền Admin</h3>
              <p className="admin-modal-subtitle">Vui lòng nhập mã PIN bảo mật để mở khóa các tính năng quản trị câu lạc bộ.</p>
            </div>
            
            <form onSubmit={handleAuth} className="admin-modal-form">
              <input 
                type="password" 
                maxLength={8}
                className="form-input admin-pin-input" 
                placeholder="Mã PIN" 
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                autoFocus
              />
              
              {error && <div className="admin-pin-error">{error}</div>}
              
              <div className="admin-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setError(""); setPinInput(""); }}>Hủy</button>
                <button type="submit" className="btn-neon-green">Xác nhận</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
