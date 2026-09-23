import PropTypes from 'prop-types';
import './Navbar.css';
import { useState } from "react";
import { LayoutDashboard, Trophy, Swords, Users, Calendar, Database, Lock, Unlock, Shuffle, MoreHorizontal, CreditCard } from "lucide-react";

const CLUB_NAME = import.meta.env.VITE_CLUB_NAME || "PICKLEBALL PHỞ";

export default function Navbar({ activeTab, setActiveTab, isAdmin, setIsAdmin, setIsModalOpen }) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleLogout = () => {
    setIsAdmin(false);
  };

  const mainNavItems = [
    { id: "dashboard", label: "Tổng Quan", icon: LayoutDashboard },
    { id: "leaderboard", label: "Xếp Hạng", icon: Trophy },
    { id: "h2h", label: "Đối Đầu", icon: Swords },
    { id: "recorder", label: "Ghi Điểm", icon: Calendar },
    { id: "events", label: "Sự Kiện", icon: Shuffle },
  ];

  const moreNavItems = [
    { id: "members", label: "Thành Viên", icon: Users },
    { id: "finance", label: "Thu Chi", icon: CreditCard },
    { id: "backup", label: "CSDL", icon: Database },
  ];

  const isMoreActive = ["members", "finance", "backup"].includes(activeTab);

  return (
    <nav className="navbar-container">


      {/* Tiêu đề phụ hiển thị ở đỉnh màn hình di động (Do thanh điều hướng chính đã xuống dưới) */}
      <div className="mobile-only-header">

        <div className="mobile-header-brand">
          <div className="mobile-header-logo">PB</div>
          <span className="mobile-header-text">{CLUB_NAME.toUpperCase()} PRO RANK</span>
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
          <span className="navbar-brand-text">{CLUB_NAME}</span>
          <span className="navbar-brand-tag">PRO RANK</span>
        </div>
        <div className="navbar-menu">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button" aria-current={activeTab === item.id ? "page" : undefined}
                key={item.id}
                className={`navbar-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMoreOpen(false);
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Tab Xem Thêm */}
          <div
            className={`navbar-item navbar-more-trigger ${isMoreActive ? "active" : ""} ${isMoreOpen ? "more-open" : ""}`}
            role="button" tabIndex={0} aria-expanded={isMoreOpen} onKeyDown={e=>{ if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setIsMoreOpen(!isMoreOpen); } if (e.key === "Escape") setIsMoreOpen(false); }}
            onClick={() => setIsMoreOpen(!isMoreOpen)}
          >
            <MoreHorizontal size={16} />
            <span>Xem Thêm</span>

            {isMoreOpen && (
              <div className="navbar-more-dropdown glass-panel animate-slide-up">
                {moreNavItems.map(item => {
                  const SubIcon = item.icon;
                  return (
                    <button type="button"
                      key={item.id}
                      className={`dropdown-item ${activeTab === item.id ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab(item.id);
                        setIsMoreOpen(false);
                      }}
                    >
                      <SubIcon size={16} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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

    </nav>
  );
}

Navbar.propTypes = {
  activeTab: PropTypes.string,
  setActiveTab: PropTypes.func,
  isAdmin: PropTypes.bool,
  setIsAdmin: PropTypes.func,
  setIsModalOpen: PropTypes.func,
};
