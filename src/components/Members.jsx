import Pagination from './Pagination';
import { usePagination } from '../hooks/usePagination';
import PropTypes from 'prop-types';
import './Members.css';
import { isPlayed } from '../utils/schema.js';
import { localDate } from '../utils/dates.js';
import { useState, useMemo } from "react";
import { Users, Search, UserPlus, Edit2, Trash2, Calendar, Phone, Shield, Flame, UserCheck, UserX } from "lucide-react";
import Modal from "./Modal";
import { addMember, updateMember, deleteMember, restoreMember } from "../utils/db";

export default function Members({ data, setData, isAdmin }) {
  const { members, matches } = data;

  // Trạng thái tìm kiếm & phân trang/hiển thị
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemberState, setSelectedMember] = useState(null);
  const selectedMember = members.find(m=>m.id===selectedMemberState?.id) || null;
  const [showArchived, setShowArchived] = useState(false); // Thành viên đang xem chi tiết (Profile)

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
  const [isGuest, setIsGuest] = useState(false);
  const [joinDate, setJoinDate] = useState("");
  const [adjustInitialElo, setAdjustInitialElo] = useState(false);

  // Tìm kiếm và lọc thành viên
  const filteredMembers = useMemo(() => {
    return members.filter(m => showArchived || !m.archivedAt).filter(m =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone.includes(searchTerm)
    );
  }, [members, searchTerm, showArchived]);

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
      .filter(match => isPlayed(match) && (match.teamA.includes(mId) || match.teamB.includes(mId)))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

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
    setIsGuest(false);
    setJoinDate(localDate());
    setIsAddOpen(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedData = addMember({ name, phone, gender, eloSingles, eloDoubles, isGuest, joinDate });
    setData(updatedData);
    setIsAddOpen(false);
  };

  const handleOpenEdit = (member, e) => {
    e.stopPropagation(); // Ngăn mở Profile khi click nút sửa
    setAdjustInitialElo(false);
    setMemberId(member.id);
    setName(member.name);
    setPhone(member.phone);
    setGender(member.gender);
    setEloSingles((member.initialEloSingles ?? member.eloSingles ?? 1000).toString());
    setEloDoubles((member.initialEloDoubles ?? member.initialElo ?? member.eloDoubles ?? member.elo).toString());
    setIsGuest(!!member.isGuest);
    setJoinDate(member.joinDate);
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedData = updateMember({ id: memberId, name, phone, gender, adjustInitialElo, initialEloSingles: eloSingles, initialEloDoubles: eloDoubles, isGuest, joinDate });
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


  const pager = usePagination(filteredMembers, searchTerm);
  return (
    <div className="members-container animate-fade-in">
      <Pagination pager={pager} />
      <label className="form-label"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)} /> Hiện thành viên đã lưu trữ</label>


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
          <input aria-label="Tìm thành viên"
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
          pager.items.map((member) => (
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
                  {member.archivedAt && <button className="btn-secondary" onClick={e=>{ e.stopPropagation(); setData(restoreMember(member.id)); }}>Khôi phục</button>}
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
                    title="Lưu trữ thành viên"
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
              <h3 className="member-card-name" style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
                {member.name}
                {member.isGuest && (
                  <span style={{
                    padding: "2px 6px",
                    fontSize: "0.65rem",
                    fontWeight: "700",
                    borderRadius: "4px",
                    background: "rgba(255, 165, 2, 0.15)",
                    color: "var(--color-warning)",
                    border: "1px solid rgba(255, 165, 2, 0.25)"
                  }}>
                    Khách
                  </span>
                )}
              </h3>

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
                <h2 className="profile-name" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {selectedMember.name}
                  {selectedMember.isGuest && (
                    <span style={{
                      padding: "2px 6px",
                      fontSize: "0.65rem",
                      fontWeight: "700",
                      borderRadius: "4px",
                      background: "rgba(255, 165, 2, 0.15)",
                      color: "var(--color-warning)",
                      border: "1px solid rgba(255, 165, 2, 0.25)"
                    }}>
                      Khách mời
                    </span>
                  )}
                </h2>
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
            <input aria-label="Tên thành viên"
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
            <input aria-label="Số điện thoại"
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
              <select aria-label="Giới tính" className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div>
              <label className="form-label">Ngày gia nhập CLB</label>
              <input aria-label="Ngày tham gia"
                type="date"
                className="form-input"
                value={joinDate}
                onChange={e => setJoinDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isGuest}
                onChange={e => {
                  const checked = e.target.checked;
                  setIsGuest(checked);
                  if (checked) {
                    setEloSingles("1000");
                    setEloDoubles("1000");
                  }
                }}
                style={{ width: "auto", height: "auto", margin: 0, accentColor: "var(--accent-neon-green)" }}
              />
              <span style={{ fontSize: "0.9rem", color: "#fff", fontWeight: "600" }}>Khai báo là Khách mời (Mặc định 1000 Elo)</span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label className="form-label" style={{ opacity: isGuest ? 0.5 : 1 }}>Elo Đơn khởi điểm</label>
              <input aria-label="Elo đơn ban đầu"
                type="number"
                className="form-input"
                value={eloSingles}
                onChange={e => setEloSingles(e.target.value)}
                min="100"
                max="3000"
                disabled={isGuest}
                style={{ opacity: isGuest ? 0.6 : 1 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ opacity: isGuest ? 0.5 : 1 }}>Elo Đôi khởi điểm</label>
              <input aria-label="Elo đôi ban đầu"
                type="number"
                className="form-input"
                value={eloDoubles}
                onChange={e => setEloDoubles(e.target.value)}
                min="100"
                max="3000"
                disabled={isGuest}
                style={{ opacity: isGuest ? 0.6 : 1 }}
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
          <label className="form-label"><input type="checkbox" checked={adjustInitialElo} onChange={e=>setAdjustInitialElo(e.target.checked)} /> Điều chỉnh điểm khởi đầu và tính lại lịch sử Elo</label><p>Đổi tên, điện thoại và hồ sơ không thay đổi Elo. Điểm bên dưới chỉ áp dụng khi chọn điều chỉnh.</p>
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Họ và tên thành viên *</label>
            <input aria-label="Tên thành viên"
              type="text"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Số điện thoại</label>
            <input aria-label="Số điện thoại"
              type="tel"
              className="form-input"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label className="form-label">Giới tính</label>
              <select aria-label="Giới tính" className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div>
              <label className="form-label">Ngày gia nhập CLB</label>
              <input aria-label="Ngày tham gia"
                type="date"
                className="form-input"
                value={joinDate}
                onChange={e => setJoinDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isGuest}
                onChange={e => {
                  const checked = e.target.checked;
                  setIsGuest(checked);
                  if (checked) {
                    setEloSingles("1000");
                    setEloDoubles("1000");
                  }
                }}
                style={{ width: "auto", height: "auto", margin: 0, accentColor: "var(--accent-neon-green)" }}
              />
              <span style={{ fontSize: "0.9rem", color: "#fff", fontWeight: "600" }}>Khai báo là Khách mời (Mặc định 1000 Elo)</span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div>
              <label className="form-label" style={{ opacity: isGuest ? 0.5 : 1 }}>Điểm Elo Đơn</label>
              <input aria-label="Elo đơn ban đầu"
                type="number"
                className="form-input"
                value={eloSingles}
                onChange={e => setEloSingles(e.target.value)}
                min="100"
                max="3000"
                disabled={!adjustInitialElo}
                style={{ opacity: isGuest ? 0.6 : 1 }}
              />
            </div>
            <div>
              <label className="form-label" style={{ opacity: isGuest ? 0.5 : 1 }}>Điểm Elo Đôi</label>
              <input aria-label="Elo đôi ban đầu"
                type="number"
                className="form-input"
                value={eloDoubles}
                onChange={e => setEloDoubles(e.target.value)}
                min="100"
                max="3000"
                disabled={!adjustInitialElo}
                style={{ opacity: isGuest ? 0.6 : 1 }}
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
        title="Lưu Trữ Thành Viên"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Bạn có chắc chắn muốn lưu trữ thành viên <strong style={{ color: "#fff" }}>{name}</strong> ra khỏi CLB?
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

Members.propTypes = {
  data: PropTypes.object,
  setData: PropTypes.func,
  isAdmin: PropTypes.bool,
};
