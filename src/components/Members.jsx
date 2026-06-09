import React, { useState, useMemo } from "react";
import { Users, Search, UserPlus, Edit2, Trash2, Calendar, Phone, Shield, Swords, Award, Flame, UserCheck, UserX } from "lucide-react";
import Modal from "./Modal";
import { addMember, updateMember, deleteMember } from "../utils/db";

export default function Members({ data, setData, isAdmin }) {
  const { members, matches } = data;

  // Trạng thái tìm kiếm & phân trang/hiển thị
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState(null); // Thành viên đang xem chi tiết (Profile)
  
  // Trạng thái Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form Fields
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Nam");
  const [eloSingles, setEloSingles] = useState("1000");
  const [eloDoubles, setEloDoubles] = useState("1200");
  const [joinDate, setJoinDate] = useState("");

  // Tìm kiếm và lọc thành viên
  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.phone.includes(searchTerm)
    );
  }, [members, searchTerm]);

  // Tìm xếp hạng CLB của thành viên (dựa trên Elo)
  const getClubRank = (memberId) => {
    const sorted = [...members].sort((a, b) => b.elo - a.elo);
    return sorted.findIndex(m => m.id === memberId) + 1;
  };

  // --- PHÂN TÍCH CHỈ SỐ HỒ SƠ CHI TIẾT ---
  const memberProfileStats = useMemo(() => {
    if (!selectedMember) return null;
    const mId = selectedMember.id;

    let singlesPlayed = 0, singlesWon = 0, singlesLost = 0;
    let doublesPlayed = 0, doublesWon = 0, doublesLost = 0;
    
    const partnerWinsCount = {}; // Lưu số trận thắng với mỗi đồng đội
    const opponentLossesCount = {}; // Lưu số trận thua trước đối thủ

    // Sắp xếp các trận đấu của người này theo thời gian từ cũ đến mới để tính chuỗi phong độ
    const personalMatches = [...matches]
      .filter(match => match.teamA.includes(mId) || match.teamB.includes(mId))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let winStreak = 0;
    let currentStreak = 0;
    let isStreakWinning = true;

    personalMatches.forEach(match => {
      const isTeamA = match.teamA.includes(mId);
      const isTeamB = match.teamB.includes(mId);
      const aWon = match.scoreA > match.scoreB;
      const isWin = (isTeamA && aWon) || (isTeamB && !aWon);

      // 1. Phân chia Đơn/Đôi
      if (match.type === "singles") {
        singlesPlayed++;
        if (isWin) singlesWon++;
        else singlesLost++;
      } else {
        doublesPlayed++;
        if (isWin) {
          doublesWon++;
          // Tính đồng đội ăn ý nhất (Partner trong đội)
          const team = isTeamA ? match.teamA : match.teamB;
          const partnerId = team.find(id => id !== mId);
          if (partnerId) {
            partnerWinsCount[partnerId] = (partnerWinsCount[partnerId] || 0) + 1;
          }
        } else {
          doublesLost++;
          // Tính đối thủ kỵ giơ nhất (Các thành viên của đội thắng)
          const winningTeam = isTeamA ? match.teamB : match.teamA;
          winningTeam.forEach(oppId => {
            opponentLossesCount[oppId] = (opponentLossesCount[oppId] || 0) + 1;
          });
        }
      }

      // 2. Tính chuỗi thắng/thua hiện tại
      if (isWin) {
        if (isStreakWinning) {
          currentStreak++;
        } else {
          currentStreak = 1;
          isStreakWinning = true;
        }
      } else {
        if (!isStreakWinning) {
          currentStreak++;
        } else {
          currentStreak = 1;
          isStreakWinning = false;
        }
      }
    });

    // Đồng đội ăn ý nhất (Số trận thắng cùng nhau nhiều nhất)
    let bestPartnerId = null;
    let maxPartnerWins = 0;
    Object.entries(partnerWinsCount).forEach(([pId, wins]) => {
      if (wins > maxPartnerWins) {
        maxPartnerWins = wins;
        bestPartnerId = pId;
      }
    });

    // Đối thủ kỵ giơ nhất (Số trận thua trước đối thủ này nhiều nhất)
    let toughOpponentId = null;
    let maxOpponentLosses = 0;
    Object.entries(opponentLossesCount).forEach(([oId, losses]) => {
      if (losses > maxOpponentLosses) {
        maxOpponentLosses = losses;
        toughOpponentId = oId;
      }
    });

    const totalPlayed = singlesPlayed + doublesPlayed;
    const totalWon = singlesWon + doublesWon;
    const totalLost = singlesLost + doublesLost;
    const totalWinRate = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;

    return {
      totalPlayed,
      totalWon,
      totalLost,
      totalWinRate,
      singlesPlayed,
      singlesWon,
      singlesLost,
      singlesWinRate: singlesPlayed > 0 ? Math.round((singlesWon / singlesPlayed) * 100) : 0,
      doublesPlayed,
      doublesWon,
      doublesLost,
      doublesWinRate: doublesPlayed > 0 ? Math.round((doublesWon / doublesPlayed) * 100) : 0,
      bestPartnerId,
      maxPartnerWins,
      toughOpponentId,
      maxOpponentLosses,
      currentStreak,
      isStreakWinning,
      // Lịch sử trận đấu cá nhân xếp từ mới nhất xuống
      history: [...personalMatches].reverse()
    };
  }, [selectedMember, matches]);

  // --- XỬ LÝ SỰ KIỆN FORM ---

  const handleOpenAdd = () => {
    setName("");
    setPhone("");
    setGender("Nam");
    setEloSingles("1000");
    setEloDoubles("1200");
    setJoinDate(new Date().toISOString().split("T")[0]);
    setIsAddOpen(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedData = addMember({ name, phone, gender, eloSingles, eloDoubles, joinDate });
    setData(updatedData);
    setIsAddOpen(false);
  };

  const handleOpenEdit = (member, e) => {
    e.stopPropagation(); // Ngăn mở Profile khi click nút sửa
    setMemberId(member.id);
    setName(member.name);
    setPhone(member.phone);
    setGender(member.gender);
    setEloSingles((member.eloSingles !== undefined ? member.eloSingles : 1000).toString());
    setEloDoubles((member.eloDoubles !== undefined ? member.eloDoubles : member.elo).toString());
    setJoinDate(member.joinDate);
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedData = updateMember({ id: memberId, name, phone, gender, eloSingles, eloDoubles, joinDate });
    setData(updatedData);
    
    // Nếu đang mở hồ sơ của người này, cập nhật lại dữ liệu hiển thị hồ sơ
    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember(updatedData.members.find(m => m.id === memberId));
    }
    
    setIsEditOpen(false);
  };

  const handleOpenDelete = (member, e) => {
    e.stopPropagation(); // Ngăn mở Profile khi click nút xóa
    setMemberId(member.id);
    setName(member.name);
    setIsDeleteOpen(true);
  };

  const handleDeleteSubmit = () => {
    const updatedData = deleteMember(memberId);
    setData(updatedData);
    setIsDeleteOpen(false);
    
    // Đóng hồ sơ nếu vừa xóa người đang xem
    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember(null);
    }
  };

  const getPlayerName = (id) => {
    const player = members.find(m => m.id === id);
    return player ? player.name : "Cựu thành viên";
  };

  const getPlayerAvatarColor = (id) => {
    const player = members.find(m => m.id === id);
    return player ? player.avatarColor : "#718096";
  };

  return (
    <div className="members-container animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        .members-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .members-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        .members-title {
          font-size: 1.75rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .members-title svg {
          color: var(--accent-neon-green);
        }

        /* Thanh Tìm kiếm & Nút thêm */
        .action-row {
          display: flex;
          gap: 16px;
          margin-bottom: 28px;
        }

        .search-wrapper {
          position: relative;
          flex-grow: 1;
        }

        .search-icon-inside {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .search-input {
          padding-left: 44px;
        }

        /* Danh sách thành viên dạng Card Grid */
        .members-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .member-card {
          padding: 24px;
          cursor: pointer;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .member-card-actions {
          position: absolute;
          top: 16px;
          right: 16px;
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 10;
        }

        .member-card:hover .member-card-actions {
          opacity: 1;
        }

        .action-icon-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          border-radius: 6px;
          padding: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-icon-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .action-icon-btn.btn-delete:hover {
          background: rgba(255, 71, 87, 0.15);
          color: var(--color-danger);
          border-color: rgba(255, 71, 87, 0.3);
        }

        .member-card-avatar {
          margin-bottom: 16px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }

        .member-card-name {
          font-size: 1.1rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }

        .member-card-info {
          font-size: 0.8rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 14px;
        }

        .member-card-elo {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--accent-neon-green);
          letter-spacing: -0.02em;
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1.1;
        }

        .member-card-elo-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .member-card-rank-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          background: rgba(0, 236, 255, 0.1);
          color: var(--accent-electric-blue);
          border: 1px solid rgba(0, 236, 255, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
        }

        /* CSS TRANG CÁ NHÂN (PROFILE MODAL) */
        .profile-layout {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .profile-header-card {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-color);
          border-radius: 12px;
        }

        .profile-header-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .profile-name {
          font-size: 1.5rem;
          font-weight: 800;
          color: #fff;
        }

        .profile-meta-list {
          display: flex;
          gap: 16px;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .profile-meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Chỉ số phân tích (Stats Panel) */
        .profile-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .profile-stat-box {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 16px;
          text-align: center;
        }

        .profile-stat-box-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .profile-stat-box-val {
          font-size: 1.5rem;
          font-weight: 800;
          color: #fff;
        }

        .profile-stat-box-sub {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        /* Phân tích sâu (Partner & Opponent) */
        .analysis-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .analysis-card {
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid var(--border-color);
          border-radius: 10px;
        }

        .analysis-card-icon {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .partner-card .analysis-card-icon { background: rgba(46, 213, 115, 0.08); color: var(--color-success); border: 1px solid rgba(46, 213, 115, 0.15); }
        .opponent-card .analysis-card-icon { background: rgba(255, 71, 87, 0.08); color: var(--color-danger); border: 1px solid rgba(255, 71, 87, 0.15); }

        .analysis-card-info {
          display: flex;
          flex-direction: column;
        }

        .analysis-card-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .analysis-card-name {
          font-weight: 700;
          color: #fff;
          font-size: 0.95rem;
          margin-top: 2px;
        }

        .analysis-card-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        /* Phong độ Streak */
        .streak-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.85rem;
        }

        .streak-win { background: rgba(255, 165, 2, 0.1); color: var(--color-warning); border: 1px solid rgba(255, 165, 2, 0.2); }
        .streak-loss { background: rgba(255, 255, 255, 0.04); color: var(--text-muted); border: 1px solid rgba(255, 255, 255, 0.06); }

        /* Lịch sử cá nhân */
        .history-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-title {
          font-size: 1rem;
          font-weight: 700;
        }

        .history-list-mini {
          max-height: 240px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-row-mini {
          background: rgba(255,255,255,0.01);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.88rem;
        }

        .result-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .result-win { background: rgba(46, 213, 115, 0.15); color: var(--color-success); }
        .result-loss { background: rgba(255, 71, 87, 0.15); color: var(--color-danger); }

        /* Responsive */
        @media (max-width: 768px) {
          .member-card-actions {
            opacity: 1 !important;
            top: 10px;
            right: 10px;
          }

          .action-icon-btn {
            padding: 9px;
            background: rgba(18, 22, 32, 0.85);
            border-color: rgba(255, 255, 255, 0.15);
            color: #fff;
          }

          .action-row {
            flex-direction: column;
          }
          .profile-header-card {
            flex-direction: column;
            text-align: center;
            padding: 16px;
          }
          .profile-meta-list {
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .profile-stats-grid {
            grid-template-columns: 1fr;
          }
          .analysis-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .history-row-mini {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }

      `}} />

      <div className="members-header">
        <h1 className="members-title">
          <Users size={28} /> Danh Sách Thành Viên
        </h1>
        {isAdmin && (
          <button className="btn-neon-green" onClick={handleOpenAdd}>
            <UserPlus size={18} /> Thêm thành viên
          </button>
        )}
      </div>

      {/* Hành động */}
      <div className="action-row">
        <div className="search-wrapper">
          <Search size={18} className="search-icon-inside" />
          <input 
            type="text" 
            className="form-input search-input" 
            placeholder="Tìm kiếm thành viên theo tên hoặc số điện thoại..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Lưới thành viên */}
      <div className="members-grid">
        {filteredMembers.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
            Không tìm thấy thành viên nào.
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div 
              key={member.id} 
              className="glass-panel member-card animate-slide-up"
              onClick={() => setSelectedMember(member)}
            >
              {/* Huy hiệu thứ hạng */}
              <span className="member-card-rank-badge">
                Hạng #{getClubRank(member.id)}
              </span>

              {/* Nút sửa/xóa nhanh */}
              {isAdmin && (
                <div className="member-card-actions">
                  <button 
                    className="action-icon-btn" 
                    onClick={(e) => handleOpenEdit(member, e)}
                    title="Sửa thành viên"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    className="action-icon-btn btn-delete" 
                    onClick={(e) => handleOpenDelete(member, e)}
                    title="Xóa thành viên"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {/* Ảnh đại diện */}
              <div 
                className="player-avatar player-avatar-lg member-card-avatar" 
                style={{ backgroundColor: member.avatarColor }}
              >
                {member.name.charAt(0)}
              </div>

              {/* Tên */}
              <h3 className="member-card-name">{member.name}</h3>

              {/* SĐT */}
              <div className="member-card-info">
                {member.phone ? (
                  <>
                    <Phone size={12} /> {member.phone}
                  </>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>Không có số điện thoại</span>
                )}
              </div>

              {/* Elo */}
              <div className="member-card-elo">
                <span>{member.elo}</span>
                <span className="member-card-elo-label">Elo Rating</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL HỒ SƠ CHI TIẾT (PROFILE) --- */}
      <Modal
        isOpen={selectedMember !== null}
        onClose={() => setSelectedMember(null)}
        title={`Hồ Sơ Cá Nhân: ${selectedMember ? selectedMember.name : ""}`}
      >
        {selectedMember && memberProfileStats && (
          <div className="profile-layout">
            {/* Header hồ sơ */}
            <div className="profile-header-card">
              <div 
                className="player-avatar player-avatar-lg" 
                style={{ backgroundColor: selectedMember.avatarColor, width: "72px", height: "72px", fontSize: "1.75rem" }}
              >
                {selectedMember.name.charAt(0)}
              </div>
              <div className="profile-header-info">
                <h2 className="profile-name">{selectedMember.name}</h2>
                <div className="profile-meta-list">
                  <div className="profile-meta-item">
                    <Phone size={14} /> <span>{selectedMember.phone || "Chưa cập nhật"}</span>
                  </div>
                  <div className="profile-meta-item">
                    <Shield size={14} /> <span>{selectedMember.gender}</span>
                  </div>
                  <div className="profile-meta-item">
                    <Calendar size={14} /> <span>Gia nhập: {selectedMember.joinDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Thống kê dạng lưới */}
            <div className="profile-stats-grid">
              <div className="profile-stat-box">
                <div className="profile-stat-box-title">Đơn & Đôi (Tất cả)</div>
                <div className="profile-stat-box-val">{selectedMember.elo}</div>
                <div className="profile-stat-box-sub">Club Rank: #{getClubRank(selectedMember.id)}</div>
              </div>

              <div className="profile-stat-box">
                <div className="profile-stat-box-title">Tổng trận đấu</div>
                <div className="profile-stat-box-val">{memberProfileStats.totalPlayed}</div>
                <div className="profile-stat-box-sub">
                  <span style={{ color: "var(--color-success)" }}>{memberProfileStats.totalWon} Thắng</span>
                  {" - "}
                  <span style={{ color: "var(--color-danger)" }}>{memberProfileStats.totalLost} Thua</span>
                </div>
              </div>

              <div className="profile-stat-box" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <div className="profile-stat-box-title">Tỷ lệ thắng</div>
                <div className="profile-stat-box-val" style={{ color: "var(--accent-neon-green)" }}>
                  {memberProfileStats.totalWinRate}%
                </div>
                {memberProfileStats.totalPlayed > 0 && (
                  <div className="profile-stat-box-sub">
                    {memberProfileStats.currentStreak > 0 && (
                      <span className={`streak-badge ${memberProfileStats.isStreakWinning ? "streak-win" : "streak-loss"}`}>
                        <Flame size={12} fill={memberProfileStats.isStreakWinning ? "currentColor" : "none"} /> 
                        Chuỗi {memberProfileStats.isStreakWinning ? "thắng" : "thua"}: {memberProfileStats.currentStreak}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Chi tiết Đơn vs Đôi */}
            <div className="profile-stats-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="profile-stat-box">
                <div className="profile-stat-box-title">Thể thức Đơn (1v1)</div>
                <div className="profile-stat-box-val" style={{ fontSize: "1.2rem" }}>
                  {selectedMember.eloSingles !== undefined ? selectedMember.eloSingles : 1000} Elo
                </div>
                <div className="profile-stat-box-sub">{memberProfileStats.singlesWon}T - {memberProfileStats.singlesLost}B ({memberProfileStats.singlesWinRate}%)</div>
              </div>
              <div className="profile-stat-box">
                <div className="profile-stat-box-title">Thể thức Đôi (2v2)</div>
                <div className="profile-stat-box-val" style={{ fontSize: "1.2rem" }}>
                  {selectedMember.eloDoubles !== undefined ? selectedMember.eloDoubles : selectedMember.elo} Elo
                </div>
                <div className="profile-stat-box-sub">{memberProfileStats.doublesWon}T - {memberProfileStats.doublesLost}B ({memberProfileStats.doublesWinRate}%)</div>
              </div>
            </div>

            {/* Phân tích sâu Đôi (Best Partner & Tough Opponent) */}
            <div className="analysis-row">
              {/* Đồng đội ăn ý nhất */}
              <div className="analysis-card partner-card">
                <div className="analysis-card-icon">
                  <UserCheck size={20} />
                </div>
                <div className="analysis-card-info">
                  <span className="analysis-card-title">Đồng đội ăn ý nhất</span>
                  {memberProfileStats.bestPartnerId ? (
                    <>
                      <span className="analysis-card-name">{getPlayerName(memberProfileStats.bestPartnerId)}</span>
                      <span className="analysis-card-desc">Cùng thắng {memberProfileStats.maxPartnerWins} trận đấu</span>
                    </>
                  ) : (
                    <span className="analysis-card-name" style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "normal" }}>
                      Chưa đủ dữ liệu đấu đôi
                    </span>
                  )}
                </div>
              </div>

              {/* Đối thủ kỵ giơ nhất */}
              <div className="analysis-card opponent-card">
                <div className="analysis-card-icon">
                  <UserX size={20} />
                </div>
                <div className="analysis-card-info">
                  <span className="analysis-card-title">Đối thủ kỵ giơ nhất</span>
                  {memberProfileStats.toughOpponentId ? (
                    <>
                      <span className="analysis-card-name">{getPlayerName(memberProfileStats.toughOpponentId)}</span>
                      <span className="analysis-card-desc">Thua {memberProfileStats.maxOpponentLosses} trận đấu</span>
                    </>
                  ) : (
                    <span className="analysis-card-name" style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "normal" }}>
                      Chưa có trận thua
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Lịch sử trận đấu gần đây của cá nhân */}
            <div className="history-section">
              <h3 className="history-title">Lịch sử các trận đấu cá nhân</h3>
              <div className="history-list-mini">
                {memberProfileStats.history.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "10px" }}>
                    Chưa tham gia trận đấu nào.
                  </p>
                ) : (
                  memberProfileStats.history.map(match => {
                    const isTeamA = match.teamA.includes(selectedMember.id);
                    const aWon = match.scoreA > match.scoreB;
                    const isWin = (isTeamA && aWon) || (!isTeamA && !aWon);
                    const myTeamPlayers = isTeamA ? match.teamA : match.teamB;
                    const oppTeamPlayers = isTeamA ? match.teamB : match.teamA;
                    
                    const eloChange = match.eloChanges[selectedMember.id] || 0;

                    return (
                      <div key={match.id} className="history-row-mini">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span className={`result-badge ${isWin ? "result-win" : "result-loss"}`}>
                            {isWin ? "Thắng" : "Thua"}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                            {match.type === "singles" ? "Đơn" : "Đôi"}
                          </span>
                        </div>

                        {/* Điểm số trận đấu */}
                        <div style={{ fontWeight: "700" }}>
                          {isWin ? (
                            <span>
                              {isTeamA ? match.scoreA : match.scoreB} - {isTeamA ? match.scoreB : match.scoreA}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-secondary)" }}>
                              {isTeamA ? match.scoreA : match.scoreB} - {isTeamA ? match.scoreB : match.scoreA}
                            </span>
                          )}
                        </div>

                        {/* Đối thủ */}
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={oppTeamPlayers.map(id => getPlayerName(id)).join(" + ")}>
                          vs {oppTeamPlayers.map(id => getPlayerName(id).split(" ").pop()).join(" + ")}
                        </div>

                        {/* Biến động Elo */}
                        <div style={{ fontWeight: "800" }} className={eloChange > 0 ? "elo-up" : "elo-down"}>
                          {eloChange > 0 ? `+${eloChange}` : eloChange} Elo
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button className="btn-secondary" onClick={() => setSelectedMember(null)}>Đóng hồ sơ</button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- MODAL THÊM THÀNH VIÊN --- */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Thêm Thành Viên Mới"
      >
        <form onSubmit={handleAddSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Họ và tên thành viên *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="VD: Nguyễn Hải Đăng" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>
          
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Số điện thoại</label>
            <input 
              type="tel" 
              className="form-input" 
              placeholder="VD: 0912345678" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label className="form-label">Giới tính</label>
              <select className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div>
              <label className="form-label">Ngày gia nhập CLB</label>
              <input 
                type="date" 
                className="form-input" 
                value={joinDate} 
                onChange={e => setJoinDate(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label className="form-label">Elo Đơn khởi điểm</label>
              <input 
                type="number" 
                className="form-input" 
                value={eloSingles} 
                onChange={e => setEloSingles(e.target.value)} 
                min="100" 
                max="3000"
              />
            </div>
            <div>
              <label className="form-label">Elo Đôi khởi điểm</label>
              <input 
                type="number" 
                className="form-input" 
                value={eloDoubles} 
                onChange={e => setEloDoubles(e.target.value)} 
                min="100" 
                max="3000"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setIsAddOpen(false)}>Hủy</button>
            <button type="submit" className="btn-neon-green">Xác nhận Thêm</button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL SỬA THÀNH VIÊN --- */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Chỉnh Sửa Thông Tin Thành Viên"
      >
        <form onSubmit={handleEditSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Họ và tên thành viên *</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>
          
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Số điện thoại</label>
            <input 
              type="tel" 
              className="form-input" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label className="form-label">Giới tính</label>
              <select className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div>
              <label className="form-label">Ngày gia nhập CLB</label>
              <input 
                type="date" 
                className="form-input" 
                value={joinDate} 
                onChange={e => setJoinDate(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label className="form-label">Điểm Elo Đơn</label>
              <input 
                type="number" 
                className="form-input" 
                value={eloSingles} 
                onChange={e => setEloSingles(e.target.value)} 
                min="100" 
                max="3000"
              />
            </div>
            <div>
              <label className="form-label">Điểm Elo Đôi</label>
              <input 
                type="number" 
                className="form-input" 
                value={eloDoubles} 
                onChange={e => setEloDoubles(e.target.value)} 
                min="100" 
                max="3000"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setIsEditOpen(false)}>Hủy</button>
            <button type="submit" className="btn-neon-green">Lưu thay đổi</button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL XÁC NHẬN XÓA --- */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Xác Nhận Xóa Thành Viên"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Bạn có chắc chắn muốn xóa thành viên <strong style={{ color: "#fff" }}>{name}</strong> ra khỏi CLB? 
            Thao tác này không thể hoàn tác. Lịch sử các trận đấu của người chơi này vẫn sẽ được giữ lại để đảm bảo tính trọn vẹn điểm số Elo cho các đối thủ/đồng đội khác.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setIsDeleteOpen(false)}>Hủy</button>
            <button type="button" className="btn-neon-green" style={{ backgroundColor: "var(--color-danger)", color: "#fff" }} onClick={handleDeleteSubmit}>
              Đồng ý Xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
