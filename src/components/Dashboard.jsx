import React, { useState } from "react";
import { Users, Swords, Calendar, Trophy, ChevronRight, UserPlus, Play } from "lucide-react";
import Modal from "./Modal";
import { addMember } from "../utils/db";

export default function Dashboard({ data, setData, setActiveTab, setRecorderSubTab }) {
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberGender, setMemberGender] = useState("Nam");
  const [memberElo, setMemberElo] = useState("1200");

  const { members, matches, events } = data;

  // Sắp xếp thành viên theo Elo để tìm Top 3
  const sortedMembers = [...members].sort((a, b) => b.elo - a.elo);
  const top3 = sortedMembers.slice(0, 3);
  
  // Sắp xếp trận đấu theo thời gian gần nhất
  const recentMatches = [...matches]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 2);

  const handleAddMemberSubmit = (e) => {
    e.preventDefault();
    if (!memberName.trim()) return;

    const updatedData = addMember({
      name: memberName,
      phone: memberPhone,
      gender: memberGender,
      elo: memberElo
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
      <style dangerouslySetInnerHTML={{__html: `
        .dashboard-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 24px;
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 28px;
        }

        .dashboard-main {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .dashboard-sidebar {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        /* Banner chào mừng */
        .welcome-banner {
          position: relative;
          padding: 32px;
          background: linear-gradient(135deg, rgba(212, 252, 52, 0.08) 0%, rgba(0, 236, 255, 0.05) 100%);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          overflow: hidden;
        }

        .welcome-banner::before {
          content: '';
          position: absolute;
          width: 250px;
          height: 250px;
          background: var(--accent-neon-green);
          filter: blur(140px);
          top: -120px;
          right: -80px;
          opacity: 0.15;
          pointer-events: none;
        }

        .welcome-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 8px;
        }

        .welcome-title span {
          background: linear-gradient(90deg, var(--accent-neon-green), var(--accent-electric-blue));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .welcome-subtitle {
          color: var(--text-secondary);
          max-width: 600px;
          font-size: 0.98rem;
        }

        /* Thống kê dạng lưới */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .stat-card {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .stat-card:hover {
          transform: translateY(-3px);
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .stat-card:nth-child(1) .stat-icon { color: var(--accent-electric-blue); background: rgba(0, 236, 255, 0.08); border-color: rgba(0, 236, 255, 0.15); }
        .stat-card:nth-child(2) .stat-icon { color: var(--accent-neon-green); background: rgba(212, 252, 52, 0.08); border-color: rgba(212, 252, 52, 0.15); }
        .stat-card:nth-child(3) .stat-icon { color: #e84393; background: rgba(232, 67, 147, 0.08); border-color: rgba(232, 67, 147, 0.15); }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 4px;
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
        }

        /* Bục vinh danh Podium */
        .podium-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .podium-header {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          margin-bottom: 24px;
        }

        .podium-header-title {
          font-size: 1.15rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .podium-header-title svg {
          color: var(--accent-neon-green);
        }

        .podium-stage {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          width: 100%;
          padding-top: 25px;
          min-height: 220px;
        }

        .podium-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 30%;
          position: relative;
        }

        .podium-avatar-wrapper {
          position: relative;
          margin-bottom: 12px;
          transition: transform var(--transition-normal);
        }

        .podium-column:hover .podium-avatar-wrapper {
          transform: translateY(-8px);
        }

        .podium-crown {
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%) rotate(-5deg);
          font-size: 1.5rem;
          z-index: 10;
        }

        .podium-rank-badge {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          color: #000;
          font-weight: 800;
          font-size: 0.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--bg-card);
        }

        .podium-player-name {
          font-weight: 700;
          font-size: 0.88rem;
          text-align: center;
          max-width: 100px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
        }

        .podium-player-elo {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--accent-neon-green);
          margin-bottom: 12px;
        }

        .podium-block {
          width: 100%;
          border-radius: 8px 8px 4px 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.5rem;
          color: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-bottom: none;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          position: relative;
        }

        .podium-block::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
          border-radius: inherit;
        }

        /* Lịch sử trận đấu gần đây */
        .recent-matches-panel {
          padding: 24px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .panel-title {
          font-size: 1.15rem;
          font-weight: 700;
        }

        .panel-link {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--accent-electric-blue);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: gap 0.2s;
        }

        .panel-link:hover {
          gap: 8px;
        }

        .match-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .match-row {
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s;
        }

        .match-row:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255,255,255,0.09);
        }

        .match-info-side {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .match-event-tag {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .match-type-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
        }

        .match-type-singles { background: rgba(0, 236, 255, 0.1); color: var(--accent-electric-blue); border: 1px solid rgba(0, 236, 255, 0.2); }
        .match-type-doubles { background: rgba(212, 252, 52, 0.1); color: var(--accent-neon-green); border: 1px solid rgba(212, 252, 52, 0.2); }

        .match-date {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .match-teams-score {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .match-team {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .match-team-players {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .match-player-name {
          font-size: 0.88rem;
          font-weight: 600;
        }

        .match-score-pill {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 800;
          font-size: 1.05rem;
          letter-spacing: 0.05em;
          display: flex;
          gap: 6px;
        }

        .score-winner { color: var(--accent-neon-green); }
        .score-loser { color: var(--text-secondary); }

        .match-elo-exchanges {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          min-width: 65px;
          font-size: 0.75rem;
          border-left: 1px solid var(--border-color);
          padding-left: 14px;
        }

        .elo-change {
          font-weight: 700;
        }
        .elo-up { color: var(--color-success); }
        .elo-down { color: var(--color-danger); }

        /* Lối tắt Sidebar */
        .shortcuts-panel {
          padding: 24px;
        }

        .shortcut-btn {
          width: 100%;
          padding: 16px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid var(--border-color);
          color: #fff;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 12px;
        }

        .shortcut-btn:last-child {
          margin-bottom: 0;
        }

        .shortcut-btn:hover {
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateX(4px);
        }

        .shortcut-btn-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-neon-green);
          transition: all 0.2s;
        }

        .shortcut-btn:hover .shortcut-btn-icon {
          background: var(--accent-neon-green);
          color: #000;
          box-shadow: 0 0 10px var(--accent-neon-green-glow);
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .dashboard-container {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .welcome-subtitle {
            display: none !important;
          }
          .stats-grid {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
          }
          .stat-card {
            padding: 10px 4px !important;
            gap: 6px !important;
            flex-direction: column;
            text-align: center;
            border-radius: 12px !important;
          }
          .stat-icon {
            width: 38px !important;
            height: 38px !important;
            border-radius: 8px !important;
            margin-bottom: 2px;
          }
          .stat-icon svg {
            width: 18px !important;
            height: 18px !important;
          }
          .stat-value {
            font-size: 1.15rem !important;
          }
          .stat-label {
            font-size: 0.65rem !important;
          }

          .welcome-banner {
            padding: 20px;
          }
          .welcome-title {
            font-size: 1.5rem;
          }

          .podium-container {
            padding: 16px 12px !important;
          }
          .podium-stage {
            min-height: 210px !important;
            padding-top: 28px !important;
          }
          .podium-avatar-wrapper {
            margin-bottom: 8px !important;
          }
          .podium-column {
            width: 32%;
          }
          .podium-player-name {
            font-size: 0.72rem;
            max-width: 80px;
          }
          .podium-player-elo {
            font-size: 0.7rem !important;
            margin-bottom: 6px !important;
          }
          .podium-crown {
            top: -20px !important;
            font-size: 1.2rem !important;
          }
          .podium-block {
            font-size: 1.1rem !important;
            height: 60px !important; /* Thu nhỏ bục trên di động để gọn */
          }
          /* Thay đổi cụ thể chiều cao bục di động */
          .podium-column:nth-child(1) .podium-block { height: 75px !important; } /* hạng 2 */
          .podium-column:nth-child(2) .podium-block { height: 100px !important; } /* hạng 1 */
          .podium-column:nth-child(3) .podium-block { height: 50px !important; } /* hạng 3 */

          .match-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            padding: 12px !important;
          }
          .match-teams-score {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr auto 1fr !important;
            align-items: center !important;
            gap: 6px !important;
          }
          .match-team {
            gap: 4px !important;
          }
          .match-player-name {
            font-size: 0.78rem !important;
            max-width: 75px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .match-score-pill {
            padding: 4px 8px !important;
            font-size: 0.92rem !important;
          }
          .match-elo-exchanges {
            border-left: none;
            padding-left: 0;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 8px;
            border-top: 1px solid var(--border-color);
            width: 100%;
            padding-top: 8px;
            justify-content: center;
          }
        }

      `}} />

      <div className="dashboard-main">
        {/* Banner chào mừng */}
        <div className="welcome-banner">
          <h1 className="welcome-title">Xin chào, <span>Pickleball Phở!</span></h1>
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

          <div className="shortcut-btn" onClick={() => setIsAddMemberOpen(true)}>
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
            <input 
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
            <input 
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
              <select className="form-select" value={memberGender} onChange={e => setMemberGender(e.target.value)}>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div>
              <label className="form-label">Điểm Elo khởi điểm</label>
              <input 
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
