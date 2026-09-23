import PropTypes from 'prop-types';
import './Dashboard.css';

import { useState } from "react";
import { Users, Swords, Calendar, Trophy, ChevronRight, UserPlus, Play } from "lucide-react";
import Modal from "./Modal";
import { addMember } from "../utils/db";

const CLUB_NAME = import.meta.env.VITE_CLUB_NAME || "Pickleball Phở";

export default function Dashboard({ data, setData, setActiveTab, setRecorderSubTab, isAdmin }) {
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberGender, setMemberGender] = useState("Nam");
  const [memberElo, setMemberElo] = useState("1200");

  const { matches, events } = data;
  const members = data.members.filter(m=>!m.archivedAt && !m.isGuest);

  // Sắp xếp thành viên theo Elo để tìm Top 3
  const sortedMembers = [...members].sort((a, b) => b.elo - a.elo);
  const top3 = sortedMembers.slice(0, 3);

  // Sắp xếp trận đấu theo thời gian gần nhất
  const recentMatches = [...matches]
    .filter(m => m.played !== false)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 2);

  const handleAddMemberSubmit = (e) => {
    e.preventDefault();
    if (!isAdmin || !memberName.trim()) return;

    const updatedData = addMember({
      name: memberName,
      phone: memberPhone,
      gender: memberGender,
      eloDoubles: memberElo
    });

    setData(updatedData);
    setIsAddMemberOpen(false);

    // Reset form
    setMemberName("");
    setMemberPhone("");
    setMemberGender("Nam");
    setMemberElo("1200");
  };

  // Định nghĩa thứ tự hiển thị bục Podium: Hạng 2 -> Hạng 1 -> Hạng 3
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push({ player: top3[1], rank: 2, label: "2nd", color: "#a0aec0", height: "95px" });
  if (top3[0]) podiumOrder.push({ player: top3[0], rank: 1, label: "1st", color: "var(--accent-neon-green)", height: "125px" });
  if (top3[2]) podiumOrder.push({ player: top3[2], rank: 3, label: "3rd", color: "#cd7f32", height: "70px" });

  const getPlayerName = (id) => {
    const player = members.find(m => m.id === id);
    return player ? player.name : "Cựu thành viên";
  };

  const getPlayerAvatarColor = (id) => {
    const player = members.find(m => m.id === id);
    return player ? player.avatarColor : "#718096";
  };

  const getEventName = (eventId) => {
    if (!eventId) return "Giao lưu tự do";
    const event = events.find(e => e.id === eventId);
    return event ? event.name : "Sự kiện khác";
  };

  // Định dạng ngày hiển thị đẹp mắt
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="dashboard-container animate-fade-in">


      <div className="dashboard-main">
        {/* Banner chào mừng */}
        <div className="welcome-banner">
          <h1 className="welcome-title">Xin chào, <span>{CLUB_NAME}!</span></h1>
          <p className="welcome-subtitle">
            Hệ thống theo dõi kết quả, ghi điểm thông minh và cập nhật bảng xếp hạng Elo cá nhân. Tự động tính toán điểm số cho từng sự kiện và khoảng thời gian lựa chọn.
          </p>
        </div>

        {/* Các chỉ số thống kê tổng quan */}
        <div className="stats-grid">
          <div className="glass-panel stat-card" onClick={() => setActiveTab("members")}>
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div>
              <div className="stat-value">{members.length}</div>
              <div className="stat-label">Thành viên CLB</div>
            </div>
          </div>

          <div className="glass-panel stat-card" onClick={() => {
            if (setRecorderSubTab) setRecorderSubTab("history");
            setActiveTab("recorder");
          }}>
            <div className="stat-icon">
              <Swords size={24} />
            </div>
            <div>
              <div className="stat-value">{matches.length}</div>
              <div className="stat-label">Trận đấu đã chơi</div>
            </div>
          </div>

          <div className="glass-panel stat-card" onClick={() => setActiveTab("events")}>
            <div className="stat-icon">
              <Calendar size={24} />
            </div>
            <div>
              <div className="stat-value">{events.length}</div>
              <div className="stat-label">Sự kiện đã tổ chức</div>
            </div>
          </div>
        </div>

        {/* Bục vinh danh Podium */}
        <div className="glass-panel podium-container glow-border-green" style={{ marginBottom: "28px" }}>
          <div className="podium-header">
            <h2 className="podium-header-title">
              <Trophy size={18} /> Top 3 Hiện Tại (Elo)
            </h2>
          </div>
          {top3.length === 0 ? (
            <p style={{ color: "var(--text-muted)", padding: "20px 0" }}>Chưa có BXH.</p>
          ) : (
            <div className="podium-stage">
              {podiumOrder.map(({ player, rank, label, color, height }) => (
                <div key={player.id} className="podium-column">
                  <div className="podium-avatar-wrapper">
                    {rank === 1 && <span className="podium-crown">👑</span>}
                    <div
                      className="player-avatar player-avatar-lg"
                      style={{
                        backgroundColor: player.avatarColor,
                        border: `3px solid ${color}`,
                        boxShadow: rank === 1 ? `0 0 20px ${varColorToGlow(color)}` : "none"
                      }}
                    >
                      {player.name.charAt(0)}
                    </div>
                    <span className="podium-rank-badge" style={{ backgroundColor: color, color: "#000" }}>{rank}</span>
                  </div>
                  <div className="podium-player-name">{player.name}</div>
                  <div className="podium-player-elo">{player.elo} Elo</div>
                  <div
                    className="podium-block"
                    style={{
                      height: height,
                      backgroundColor: "rgba(255,255,255,0.02)",
                      borderColor: color,
                      color: color
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lịch sử trận đấu gần đây */}
        <div className="glass-panel recent-matches-panel">
          <div className="panel-header">
            <h2 className="panel-title">Các trận đấu gần đây</h2>
            <div className="panel-link" onClick={() => setActiveTab("leaderboard")}>
              Xem chi tiết BXH <ChevronRight size={16} />
            </div>
          </div>
          <div className="match-list">
            {recentMatches.length === 0 ? (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>Chưa có trận đấu nào được ghi nhận.</p>
            ) : (
              recentMatches.map((match) => (
                <div key={match.id} className="match-row">
                  <div className="match-info-side">
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span className="match-event-tag">{getEventName(match.eventId)}</span>
                      <span className={`match-type-badge ${match.type === "singles" ? "match-type-singles" : "match-type-doubles"}`}>
                        {match.type === "singles" ? "Đơn" : "Đôi"}
                      </span>
                    </div>
                    <span className="match-date">{formatDate(match.date)}</span>
                  </div>

                  <div className="match-teams-score">
                    {/* Đội A */}
                    <div className="match-team">
                      <div className="match-team-players">
                        {match.teamA.map(id => (
                          <span key={id} className="match-player-name">{getPlayerName(id)}</span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "2px" }}>
                        {match.teamA.map(id => (
                          <div
                            key={id}
                            className="player-avatar player-avatar-sm"
                            style={{ backgroundColor: getPlayerAvatarColor(id) }}
                          >
                            {getPlayerName(id).charAt(0)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tỷ số */}
                    <div className="match-score-pill">
                      <span className={match.scoreA > match.scoreB ? "score-winner" : "score-loser"}>{match.scoreA}</span>
                      <span style={{ color: "var(--text-muted)" }}>:</span>
                      <span className={match.scoreB > match.scoreA ? "score-winner" : "score-loser"}>{match.scoreB}</span>
                    </div>

                    {/* Đội B */}
                    <div className="match-team" style={{ flexDirection: "row-reverse" }}>
                      <div className="match-team-players" style={{ alignItems: "flex-start" }}>
                        {match.teamB.map(id => (
                          <span key={id} className="match-player-name">{getPlayerName(id)}</span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "2px" }}>
                        {match.teamB.map(id => (
                          <div
                            key={id}
                            className="player-avatar player-avatar-sm"
                            style={{ backgroundColor: getPlayerAvatarColor(id) }}
                          >
                            {getPlayerName(id).charAt(0)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Biến động Elo */}
                  <div className="match-elo-exchanges">
                    {Object.entries(match.eloChanges).slice(0, 4).map(([playerId, change]) => (
                      <div key={playerId} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                          {getPlayerName(playerId).split(" ").pop()}:
                        </span>
                        <span className={`elo-change ${change > 0 ? "elo-up" : "elo-down"}`}>
                          {change > 0 ? `+${change}` : change}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-sidebar">
        {/* Lối tắt hành động nhanh */}
        <div className="glass-panel shortcuts-panel">
          <h2 className="panel-title" style={{ marginBottom: "20px" }}>Hành động nhanh</h2>
          <div className="shortcut-btn" onClick={() => setActiveTab("recorder")}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="shortcut-btn-icon">
                <Play size={16} fill="currentColor" />
              </div>
              <span>Ghi điểm trận đấu mới</span>
            </div>
            <ChevronRight size={16} />
          </div>

          <div className="shortcut-btn" role="button" tabIndex={0} aria-disabled={!isAdmin} onKeyDown={e=>{ if (isAdmin && (e.key === "Enter" || e.key === " ")) setIsAddMemberOpen(true); }} onClick={() => { if (isAdmin) setIsAddMemberOpen(true); }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="shortcut-btn-icon">
                <UserPlus size={16} />
              </div>
              <span>Thêm thành viên mới</span>
            </div>
            <ChevronRight size={16} />
          </div>

          <div className="shortcut-btn" onClick={() => setActiveTab("events")}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="shortcut-btn-icon">
                <Calendar size={16} />
              </div>
              <span>Tạo sự kiện / giải đấu</span>
            </div>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>

      {/* Modal thêm nhanh thành viên */}
      <Modal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        title="Thêm Thành Viên Mới"
      >
        <form onSubmit={handleAddMemberSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Họ và tên thành viên *</label>
            <input aria-label="Tên thành viên"
              type="text"
              className="form-input"
              placeholder="VD: Nguyễn Văn A"
              value={memberName}
              onChange={e => setMemberName(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Số điện thoại</label>
            <input aria-label="Số điện thoại"
              type="tel"
              className="form-input"
              placeholder="VD: 0912345678"
              value={memberPhone}
              onChange={e => setMemberPhone(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label className="form-label">Giới tính</label>
              <select aria-label="Giới tính" className="form-select" value={memberGender} onChange={e => setMemberGender(e.target.value)}>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div>
              <label className="form-label">Điểm Elo khởi điểm</label>
              <input aria-label="Elo ban đầu"
                type="number"
                className="form-input"
                value={memberElo}
                onChange={e => setMemberElo(e.target.value)}
                min="100"
                max="3000"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setIsAddMemberOpen(false)}>Hủy</button>
            <button type="submit" className="btn-neon-green">Xác nhận Thêm</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Hàm bổ trợ đổi màu viền sang dạng bóng mờ glow
function varColorToGlow(color) {
  if (color === "var(--accent-neon-green)") return "var(--accent-neon-green-glow)";
  if (color === "#a0aec0") return "rgba(160, 174, 192, 0.2)";
  if (color === "#cd7f32") return "rgba(205, 127, 50, 0.2)";
  return "rgba(255,255,255,0.1)";
}

Dashboard.propTypes = {
  data: PropTypes.object,
  setData: PropTypes.func,
  setActiveTab: PropTypes.func,
  setRecorderSubTab: PropTypes.func,
  isAdmin: PropTypes.bool,
};
