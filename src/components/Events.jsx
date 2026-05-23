import React, { useState, useMemo } from "react";
import { Calendar, Plus, Trophy, Swords, Trash2, ChevronRight, ArrowLeft, Clock, Edit2, ArrowUpDown } from "lucide-react";
import Modal from "./Modal";
import { addEvent, deleteEvent, updateEvent, updateMatch, deleteMatch } from "../utils/db";

export default function Events({ data, setData, isAdmin }) {
  const { members, matches, events } = data;

  // Trạng thái sự kiện được chọn để xem chi tiết
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Trạng thái Sắp xếp BXH giải đấu
  const [eventSortBy, setEventSortBy] = useState("eloChange"); // eloChange, won
  const [eventSortOrder, setEventSortOrder] = useState("desc"); // desc, asc

  const toggleEventSort = (field) => {
    if (eventSortBy === field) {
      setEventSortOrder(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setEventSortBy(field);
      setEventSortOrder("desc");
    }
  };
  
  // Trạng thái Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form Fields
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventIdToDelete, setEventIdToDelete] = useState("");

  // Trạng thái Sửa Sự Kiện
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [editEventName, setEditEventName] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [editEventDesc, setEditEventDesc] = useState("");

  // Trạng thái Sửa Trận Đấu
  const [isEditMatchOpen, setIsEditMatchOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editMatchScoreA, setEditMatchScoreA] = useState(0);
  const [editMatchScoreB, setEditMatchScoreB] = useState(0);
  const [editMatchTeamA, setEditMatchTeamA] = useState([]);
  const [editMatchTeamB, setEditMatchTeamB] = useState([]);
  const [editMatchDate, setEditMatchDate] = useState("");

  // Trạng thái Xóa Trận Đấu
  const [isDeleteMatchOpen, setIsDeleteMatchOpen] = useState(false);
  const [matchIdToDelete, setMatchIdToDelete] = useState("");

  // --- XỬ LÝ CHỈNH SỬA SỰ KIỆN & TRẬN ĐẤU ---

  const handleOpenEditEvent = (event) => {
    setEditEventName(event.name);
    setEditEventDate(event.date);
    setEditEventDesc(event.description || "");
    setIsEditEventOpen(true);
  };

  const handleEditEventSubmit = (e) => {
    e.preventDefault();
    if (!editEventName.trim()) return;

    const updatedData = updateEvent({
      id: selectedEvent.id,
      name: editEventName,
      date: editEventDate,
      description: editEventDesc
    });
    setData(updatedData);
    
    // Cập nhật lại sự kiện đang chọn trong state
    const newSelected = updatedData.events.find(ev => ev.id === selectedEvent.id);
    setSelectedEvent(newSelected);
    setIsEditEventOpen(false);
  };

  const handleOpenEditMatch = (match) => {
    setEditingMatch(match);
    setEditMatchScoreA(match.scoreA);
    setEditMatchScoreB(match.scoreB);
    setEditMatchTeamA(match.teamA);
    setEditMatchTeamB(match.teamB);
    
    // convert date string to local datetime string (YYYY-MM-DDTHH:mm)
    const d = new Date(match.date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    setEditMatchDate(localISOTime);
    
    setIsEditMatchOpen(true);
  };

  const handleEditMatchSubmit = (e) => {
    e.preventDefault();
    if (!editingMatch) return;

    // Kiểm tra trùng lặp người chơi giữa 2 đội
    const hasDuplicate = editMatchTeamA.some(id => editMatchTeamB.includes(id));
    if (hasDuplicate) {
      alert("Lỗi: Người chơi không thể thuộc cả hai đội cùng một lúc!");
      return;
    }

    // Đối với đấu đôi, 2 người chơi trong cùng 1 đội không được trùng nhau
    if (editingMatch.type === "doubles") {
      if (editMatchTeamA[0] === editMatchTeamA[1] || editMatchTeamB[0] === editMatchTeamB[1]) {
        alert("Lỗi: Hai người chơi trong một đội phải khác nhau!");
        return;
      }
    }

    const updatedData = updateMatch({
      id: editingMatch.id,
      eventId: selectedEvent.id,
      type: editingMatch.type,
      teamA: editMatchTeamA,
      teamB: editMatchTeamB,
      scoreA: parseInt(editMatchScoreA) || 0,
      scoreB: parseInt(editMatchScoreB) || 0,
      date: new Date(editMatchDate).toISOString()
    });

    setData(updatedData);
    setIsEditMatchOpen(false);
  };

  const handleOpenDeleteMatch = (matchId) => {
    setMatchIdToDelete(matchId);
    setIsDeleteMatchOpen(true);
  };

  const handleDeleteMatchSubmit = () => {
    const updatedData = deleteMatch(matchIdToDelete);
    setData(updatedData);
    setIsDeleteMatchOpen(false);
  };


  // --- PHÂN TÍCH CHI TIẾT SỰ KIỆN ---
  
  // Lấy danh sách các trận đấu thuộc sự kiện hiện tại
  const eventMatches = useMemo(() => {
    if (!selectedEvent) return [];
    return matches
      .filter(m => m.eventId === selectedEvent.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Mới nhất lên đầu
  }, [selectedEvent, matches]);

  // Tính toán bảng xếp hạng riêng cho sự kiện (BXH Sự kiện)
  const eventLeaderboard = useMemo(() => {
    if (!selectedEvent) return [];
    
    // Tính toán thống kê từ các trận đấu thuộc sự kiện
    const statsMap = {};
    members.forEach(m => {
      statsMap[m.id] = {
        ...m,
        played: 0,
        won: 0,
        lost: 0,
        eloChange: 0,
        scoreDiff: 0,
      };
    });

    eventMatches.forEach(match => {
      if (match.played === false) return; // Bỏ qua trận chưa đấu
      const allPlayers = [...match.teamA, ...match.teamB];
      const aWon = match.scoreA > match.scoreB;

      allPlayers.forEach(pId => {
        if (!statsMap[pId]) return;

        statsMap[pId].played++;
        
        const change = match.eloChanges[pId] || 0;
        statsMap[pId].eloChange += change;

        const isTeamA = match.teamA.includes(pId);
        const isWin = (isTeamA && aWon) || (!isTeamA && !aWon);

        if (isWin) {
          statsMap[pId].won++;
        } else {
          statsMap[pId].lost++;
        }

        // Tính toán hiệu số điểm (Tổng điểm ghi được - Tổng điểm bị thua)
        if (isTeamA) {
          statsMap[pId].scoreDiff += (match.scoreA - match.scoreB);
        } else {
          statsMap[pId].scoreDiff += (match.scoreB - match.scoreA);
        }
      });
    });

    // Lọc ra những người chơi có tham gia ít nhất 1 trận trong sự kiện này
    return Object.values(statsMap)
      .filter(p => p.played > 0)
      .map(p => ({
        ...p,
        winRate: p.played > 0 ? Math.round((p.won / p.played) * 100) : 0
      }))
      .sort((a, b) => {
        let valA, valB;
        let tieBreakers = [];

        if (eventSortBy === "eloChange") {
          valA = a.eloChange;
          valB = b.eloChange;
          tieBreakers = [
            [a.won, b.won],
            [a.winRate, b.winRate],
            [a.scoreDiff, b.scoreDiff]
          ];
        } else if (eventSortBy === "won") {
          valA = a.won;
          valB = b.won;
          tieBreakers = [
            [a.eloChange, b.eloChange],
            [a.winRate, b.winRate],
            [a.scoreDiff, b.scoreDiff]
          ];
        } else {
          valA = a.eloChange;
          valB = b.eloChange;
        }

        if (valA !== valB) {
          return eventSortOrder === "desc" ? valB - valA : valA - valB;
        }

        // Áp dụng các tiêu chí phụ ưu tiên tiếp theo (tỷ lệ thắng, hiệu số, v.v.)
        for (let i = 0; i < tieBreakers.length; i++) {
          const [tbA, tbB] = tieBreakers[i];
          if (tbA !== tbB) {
            // Các tiêu chí phụ luôn ưu tiên sắp xếp giảm dần
            return eventSortOrder === "desc" ? tbB - tbA : tbA - tbB;
          }
        }

        return a.name.localeCompare(b.name);
      })
      .map((p, index) => ({
        ...p,
        eventRank: index + 1
      }));
  }, [selectedEvent, eventMatches, members, eventSortBy, eventSortOrder]);

  // --- XỬ LÝ SỰ KIỆN FORM ---

  const handleOpenAdd = () => {
    setEventName("");
    setEventDate(new Date().toISOString().split("T")[0]);
    setEventDesc("");
    setIsAddOpen(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!eventName.trim()) return;

    const updatedData = addEvent({ name: eventName, date: eventDate, description: eventDesc });
    setData(updatedData);
    setIsAddOpen(false);
  };

  const handleOpenDelete = (event, e) => {
    e.stopPropagation(); // Ngăn mở chi tiết khi bấm xóa
    setEventIdToDelete(event.id);
    setEventName(event.name);
    setIsDeleteOpen(true);
  };

  const handleDeleteSubmit = () => {
    const updatedData = deleteEvent(eventIdToDelete);
    setData(updatedData);
    setIsDeleteOpen(false);

    // Nếu đang xem chi tiết sự kiện bị xóa, quay về danh sách sự kiện
    if (selectedEvent && selectedEvent.id === eventIdToDelete) {
      setSelectedEvent(null);
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

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="events-container animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        .events-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .sort-header {
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          user-select: none;
          transition: color 0.15s;
        }

        .sort-header:hover {
          color: var(--accent-neon-green);
        }

        .sort-header.active {
          color: var(--accent-neon-green);
          font-weight: 700;
        }

        .events-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        .events-title {
          font-size: 1.75rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .events-title svg {
          color: var(--accent-neon-green);
        }

        /* Lưới danh sách sự kiện */
        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 20px;
        }

        .event-card {
          padding: 24px;
          cursor: pointer;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .event-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .event-card-date {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--accent-electric-blue);
          font-weight: 600;
        }

        .event-card-name {
          font-size: 1.2rem;
          font-weight: 700;
          color: #fff;
          line-height: 1.3;
          margin-top: 4px;
        }

        .event-card-desc {
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 42px;
        }

        .event-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--border-color);
          padding-top: 14px;
          margin-top: 6px;
        }

        .event-match-count {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .event-action-delete {
          color: var(--text-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .event-action-delete:hover {
          color: var(--color-danger);
          background: rgba(255, 71, 87, 0.1);
        }

        /* --- LAYOUT XEM CHI TIẾT SỰ KIỆN --- */
        .event-detail-layout {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .back-button-row {
          margin-bottom: -10px;
        }

        .btn-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          transition: color 0.15s;
        }

        .btn-back:hover {
          color: #fff;
        }

        .event-detail-header-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          overflow: hidden;
        }

        .event-detail-header-card::before {
          content: '';
          position: absolute;
          width: 300px;
          height: 300px;
          background: var(--accent-electric-blue);
          filter: blur(160px);
          top: -150px;
          right: -100px;
          opacity: 0.12;
          pointer-events: none;
        }

        .event-detail-grid {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 28px;
        }

        .event-section-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .event-section-title svg {
          color: var(--accent-neon-green);
        }

        .event-table-panel {
          padding: 24px;
        }

        /* Nút hành động sửa/xóa trận đấu */
        .event-action-btn-edit, .event-action-btn-delete {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .event-action-btn-edit:hover {
          color: var(--accent-electric-blue);
          background: rgba(0, 236, 255, 0.08);
          border-color: rgba(0, 236, 255, 0.2);
          box-shadow: 0 0 10px rgba(0, 236, 255, 0.15);
        }

        .event-action-btn-delete:hover {
          color: var(--color-danger);
          background: rgba(255, 71, 87, 0.08);
          border-color: rgba(255, 71, 87, 0.2);
          box-shadow: 0 0 10px rgba(255, 71, 87, 0.15);
        }

        /* Responsive */
        @media (max-width: 900px) {
          .event-detail-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .events-grid {
            grid-template-columns: 1fr;
          }
          .event-detail-header-card {
            padding: 20px;
          }
        }
      `}} />

      {/* --- XEM CHI TIẾT SỰ KIỆN --- */}
      {selectedEvent ? (
        <div className="event-detail-layout">
          <div className="back-button-row">
            <button className="btn-back" onClick={() => setSelectedEvent(null)}>
              <ArrowLeft size={16} /> Quay lại danh sách sự kiện
            </button>
          </div>

          {/* Banner thông tin sự kiện */}
          <div className="glass-panel event-detail-header-card glow-border-green" style={{ position: "relative" }}>
            <div className="event-card-date">
              <Calendar size={14} /> <span>Bắt đầu: {formatDate(selectedEvent.date)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <h1 className="welcome-title" style={{ margin: 0 }}>{selectedEvent.name}</h1>
                <p className="welcome-subtitle" style={{ margin: 0, color: "var(--text-primary)", marginTop: "8px" }}>
                  {selectedEvent.description || "Không có mô tả chi tiết."}
                </p>
              </div>
              {isAdmin && (
                <button 
                  className="btn-secondary" 
                  onClick={() => handleOpenEditEvent(selectedEvent)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "8px 14px", alignSelf: "flex-start", cursor: "pointer", border: "1px solid var(--border-color)" }}
                >
                  <Edit2 size={14} /> Chỉnh sửa thông tin
                </button>
              )}
            </div>
          </div>


          <div className="event-detail-grid">
            {/* CỘT TRÁI: BẢNG XẾP HẠNG CỦA GIẢI */}
            <div className="glass-panel event-table-panel">
              <h2 className="event-section-title">
                <Trophy size={18} /> Xếp hạng Giải đấu (Theo Elo Tích lũy)
              </h2>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60px", textAlign: "center" }}>Hạng</th>
                      <th>Thành viên</th>
                      <th style={{ width: "140px", textAlign: "center" }}>
                        <div 
                          className={`sort-header ${eventSortBy === "eloChange" ? "active" : ""}`}
                          onClick={() => toggleEventSort("eloChange")}
                        >
                          Điểm giải đấu <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th style={{ width: "90px", textAlign: "center" }} className="hide-on-mobile">Số trận</th>
                      <th style={{ width: "115px", textAlign: "center" }} className="hide-on-mobile">
                        <div 
                          className={`sort-header ${eventSortBy === "won" ? "active" : ""}`}
                          onClick={() => toggleEventSort("won")}
                        >
                          Thắng-Thua <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th style={{ width: "90px", textAlign: "center" }} className="hide-on-mobile">Hiệu số</th>
                      <th style={{ width: "110px", textAlign: "center" }}>Tỷ lệ thắng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventLeaderboard.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                          Giải đấu chưa bắt đầu hoặc chưa có trận đấu nào được ghi nhận.
                        </td>
                      </tr>
                    ) : (
                      eventLeaderboard.map((member, index) => (
                        <tr key={member.id}>
                          {/* Hạng giải đấu */}
                          <td className="rank-col">
                            {index === 0 ? (
                              <span className="rank-medal rank-1">🏆</span>
                            ) : index === 1 ? (
                              <span className="rank-medal rank-2">🥈</span>
                            ) : index === 2 ? (
                              <span className="rank-medal rank-3">🥉</span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>{index + 1}</span>
                            )}
                          </td>

                          {/* Người chơi */}
                          <td>
                            <div className="player-info-cell">
                              <div 
                                className="player-avatar player-avatar-sm" 
                                style={{ backgroundColor: member.avatarColor }}
                              >
                                {member.name.charAt(0)}
                              </div>
                              <span className="player-name-cell">{member.name}</span>
                            </div>
                          </td>

                          {/* Lượng Elo thay đổi tại giải này (Điểm giải đấu) */}
                          <td style={{ textAlign: "center" }}>
                            {member.eloChange > 0 ? (
                              <span className="elo-change-badge elo-change-up">
                                +{member.eloChange} Elo
                              </span>
                            ) : member.eloChange < 0 ? (
                              <span className="elo-change-badge elo-change-down">
                                {member.eloChange} Elo
                              </span>
                            ) : (
                              <span className="elo-change-badge elo-change-none">
                                0 Elo
                              </span>
                            )}
                          </td>

                          {/* Số trận đã chơi */}
                          <td style={{ textAlign: "center", fontWeight: "500" }} className="hide-on-mobile">{member.played}</td>

                          {/* Thắng-Thua */}
                          <td style={{ textAlign: "center", fontSize: "0.85rem" }} className="hide-on-mobile">
                            <span style={{ color: "var(--color-success)", fontWeight: "600" }}>{member.won}</span>
                            {" - "}
                            <span style={{ color: "var(--color-danger)", fontWeight: "600" }}>{member.lost}</span>
                          </td>

                          {/* Cột Hiệu số - Ẩn trên di động */}
                          <td style={{ textAlign: "center", fontWeight: "600" }} className="hide-on-mobile">
                            {member.scoreDiff > 0 ? (
                              <span style={{ color: "var(--accent-neon-green)" }}>+{member.scoreDiff}</span>
                            ) : member.scoreDiff < 0 ? (
                              <span style={{ color: "var(--color-danger)" }}>{member.scoreDiff}</span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>0</span>
                            )}
                          </td>

                          {/* Tỷ lệ thắng */}
                          <td style={{ textAlign: "center", fontWeight: "700", color: "var(--accent-electric-blue)" }}>
                            {member.winRate}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CỘT PHẢI: LỊCH SỬ TRẬN ĐẤU CỦA GIẢI */}
            <div className="glass-panel event-table-panel">
              <h2 className="event-section-title">
                <Swords size={18} /> Trận Đấu Đang Diễn Ra ({eventMatches.length})
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "480px", overflowY: "auto", pr: "6px" }}>
                {eventMatches.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "30px 0" }}>
                    Chưa có trận đấu nào được ghi nhận cho giải này.
                  </p>
                ) : (
                  eventMatches.map(match => (
                    <div 
                      key={match.id} 
                      className="glass-card" 
                      style={{ 
                        padding: "14px", 
                        background: "rgba(255,255,255,0.01)", 
                        borderRadius: "8px", 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "10px" 
                      }}
                    >
                      {/* Sub-header trận */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={`match-type-badge ${match.type === "singles" ? "match-type-singles" : "match-type-doubles"}`}>
                            {match.type === "singles" ? "Đơn" : "Đôi"}
                          </span>
                          <span className="match-date" style={{ fontSize: "0.7rem" }}>
                            {formatDateTime(match.date)}
                          </span>
                        </div>
                        {isAdmin && (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button 
                              className="event-action-btn-edit" 
                              onClick={() => handleOpenEditMatch(match)}
                              title="Sửa trận đấu"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              className="event-action-btn-delete" 
                              onClick={() => handleOpenDeleteMatch(match.id)}
                              title="Xóa trận đấu"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Tỷ số & Đội */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {/* Đội A */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {match.teamA.map(id => (
                            <span key={id} style={{ fontSize: "0.85rem", fontWeight: "600" }}>
                              {getPlayerName(id).split(" ").pop()}
                            </span>
                          ))}
                        </div>

                        {/* Điểm số */}
                        {match.played === false ? (
                          <div className="match-unplayed-badge" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>
                            Chưa đấu
                          </div>
                        ) : (
                          <div className="match-score-pill" style={{ padding: "4px 10px", fontSize: "0.95rem" }}>
                            <span className={match.scoreA > match.scoreB ? "score-winner" : "score-loser"}>{match.scoreA}</span>
                            <span style={{ color: "var(--text-muted)" }}>:</span>
                            <span className={match.scoreB > match.scoreA ? "score-winner" : "score-loser"}>{match.scoreB}</span>
                          </div>
                        )}

                        {/* Đội B */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                          {match.teamB.map(id => (
                            <span key={id} style={{ fontSize: "0.85rem", fontWeight: "600" }}>
                              {getPlayerName(id).split(" ").pop()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // --- DANH SÁCH TẤT CẢ SỰ KIỆN ---
        <>
          <div className="events-header">
            <h1 className="events-title">
              <Calendar size={28} /> Quản Lý Giải Đấu & Sự Kiện
            </h1>
            {isAdmin && (
              <button className="btn-neon-green" onClick={handleOpenAdd}>
                <Plus size={18} /> Tạo sự kiện mới
              </button>
            )}
          </div>

          <div className="events-grid">
            {events.length === 0 ? (
              <div className="glass-panel" style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                Chưa có giải đấu hoặc sự kiện nào được tổ chức. Nhấp vào "Tạo sự kiện mới" để bắt đầu!
              </div>
            ) : (
              events.map((event) => {
                // Đếm số trận đấu của sự kiện này
                const matchCount = matches.filter(m => m.eventId === event.id).length;

                return (
                  <div 
                    key={event.id} 
                    className="glass-panel event-card animate-slide-up"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="event-card-header">
                      <span className="event-card-date">
                        <Calendar size={12} /> {formatDate(event.date)}
                      </span>
                      {isAdmin && (
                        <button 
                          className="event-action-delete" 
                          onClick={(e) => handleOpenDelete(event, e)}
                          title="Xóa sự kiện"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div>
                      <h3 className="event-card-name">{event.name}</h3>
                      <p className="event-card-desc">{event.description || "Không có mô tả cho sự kiện này."}</p>
                    </div>

                    <div className="event-card-footer">
                      <span className="event-match-count">{matchCount} trận đấu đã chơi</span>
                      <span className="panel-link" style={{ fontSize: "0.8rem" }}>
                        Xem BXH chi tiết <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* --- MODAL THÊM SỰ KIỆN MỚI --- */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Tạo Sự Kiện / Giải Đấu Mới"
      >
        <form onSubmit={handleAddSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Tên giải đấu / Sự kiện *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="VD: Giải Pickleball Nội Bộ Tháng 5" 
              value={eventName} 
              onChange={e => setEventName(e.target.value)} 
              required
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Ngày bắt đầu sự kiện</label>
            <input 
              type="date" 
              className="form-input" 
              value={eventDate} 
              onChange={e => setEventDate(e.target.value)} 
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label className="form-label">Mô tả chi tiết giải đấu</label>
            <textarea 
              className="form-textarea" 
              placeholder="Nhập thông tin về thể thức thi đấu, giải thưởng..." 
              value={eventDesc} 
              onChange={e => setEventDesc(e.target.value)} 
              rows={4}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setIsAddOpen(false)}>Hủy</button>
            <button type="submit" className="btn-neon-green">Xác nhận Tạo</button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL BIỂU MẪU XÁC NHẬN XÓA --- */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Xác Nhận Xóa Sự Kiện"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Bạn có chắc chắn muốn xóa sự kiện <strong style={{ color: "#fff" }}>{eventName}</strong>?
            Thao tác này sẽ không xóa các trận đấu đã chơi trong sự kiện, tuy nhiên toàn bộ các trận đấu đó sẽ được chuyển thành thể thức **"Giao lưu tự do"** (không thuộc sự kiện nào).
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setIsDeleteOpen(false)}>Hủy</button>
            <button type="button" className="btn-neon-green" style={{ backgroundColor: "var(--color-danger)", color: "#fff" }} onClick={handleDeleteSubmit}>
              Xác nhận Xóa
            </button>
          </div>
        </div>
      </Modal>

      {/* --- MODAL CHỈNH SỬA SỰ KIỆN --- */}
      <Modal
        isOpen={isEditEventOpen}
        onClose={() => setIsEditEventOpen(false)}
        title="Chỉnh Sửa Sự Kiện / Giải Đấu"
      >
        <form onSubmit={handleEditEventSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Tên giải đấu / Sự kiện *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="VD: Giải Pickleball Nội Bộ Tháng 5" 
              value={editEventName} 
              onChange={e => setEditEventName(e.target.value)} 
              required
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label className="form-label">Ngày bắt đầu sự kiện</label>
            <input 
              type="date" 
              className="form-input" 
              value={editEventDate} 
              onChange={e => setEditEventDate(e.target.value)} 
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label className="form-label">Mô tả chi tiết giải đấu</label>
            <textarea 
              className="form-textarea" 
              placeholder="Nhập thông tin về thể thức thi đấu, giải thưởng..." 
              value={editEventDesc} 
              onChange={e => setEditEventDesc(e.target.value)} 
              rows={4}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setIsEditEventOpen(false)}>Hủy</button>
            <button type="submit" className="btn-neon-green">Lưu Thay Đổi</button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL CHỈNH SỬA TRẬN ĐẤU --- */}
      <Modal
        isOpen={isEditMatchOpen}
        onClose={() => setIsEditMatchOpen(false)}
        title={`Hiệu Chỉnh Trận Đấu #${editingMatch ? editingMatch.id.split("_")[1] : ""}`}
      >
        {editingMatch && (
          <form onSubmit={handleEditMatchSubmit}>
            {/* THÀNH VIÊN ĐỘI A */}
            <div style={{ marginBottom: "16px" }}>
              <label className="form-label" style={{ color: "var(--accent-electric-blue)", fontWeight: "700" }}>
                Đội A {editingMatch.type === "singles" ? "(Đơn)" : "(Đôi)"}
              </label>
              <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Người chơi 1</label>
                  <select 
                    className="form-input"
                    value={editMatchTeamA[0] || ""}
                    onChange={e => {
                      const newTeam = [...editMatchTeamA];
                      newTeam[0] = e.target.value;
                      setEditMatchTeamA(newTeam);
                    }}
                    required
                  >
                    <option value="" disabled>-- Chọn người chơi --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.elo} Elo)</option>
                    ))}
                  </select>
                </div>
                {editingMatch.type === "doubles" && (
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Người chơi 2</label>
                    <select 
                      className="form-input"
                      value={editMatchTeamA[1] || ""}
                      onChange={e => {
                        const newTeam = [...editMatchTeamA];
                        newTeam[1] = e.target.value;
                        setEditMatchTeamA(newTeam);
                      }}
                      required
                    >
                      <option value="" disabled>-- Chọn người chơi --</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.elo} Elo)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* THÀNH VIÊN ĐỘI B */}
            <div style={{ marginBottom: "16px" }}>
              <label className="form-label" style={{ color: "var(--accent-neon-green)", fontWeight: "700" }}>
                Đội B {editingMatch.type === "singles" ? "(Đơn)" : "(Đôi)"}
              </label>
              <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Người chơi 1</label>
                  <select 
                    className="form-input"
                    value={editMatchTeamB[0] || ""}
                    onChange={e => {
                      const newTeam = [...editMatchTeamB];
                      newTeam[0] = e.target.value;
                      setEditMatchTeamB(newTeam);
                    }}
                    required
                  >
                    <option value="" disabled>-- Chọn người chơi --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.elo} Elo)</option>
                    ))}
                  </select>
                </div>
                {editingMatch.type === "doubles" && (
                  <div>
                    <label className="form-label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Người chơi 2</label>
                    <select 
                      className="form-input"
                      value={editMatchTeamB[1] || ""}
                      onChange={e => {
                        const newTeam = [...editMatchTeamB];
                        newTeam[1] = e.target.value;
                        setEditMatchTeamB(newTeam);
                      }}
                      required
                    >
                      <option value="" disabled>-- Chọn người chơi --</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.elo} Elo)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* ĐIỂM SỐ */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Điểm Đội A *</label>
                <input 
                  type="number" 
                  min="0"
                  className="form-input" 
                  value={editMatchScoreA} 
                  onChange={e => setEditMatchScoreA(e.target.value)} 
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Điểm Đội B *</label>
                <input 
                  type="number" 
                  min="0"
                  className="form-input" 
                  value={editMatchScoreB} 
                  onChange={e => setEditMatchScoreB(e.target.value)} 
                  required
                />
              </div>
            </div>

            {/* THỜI GIAN */}
            <div style={{ marginBottom: "24px" }}>
              <label className="form-label">Ngày & Giờ đấu</label>
              <input 
                type="datetime-local" 
                className="form-input" 
                value={editMatchDate} 
                onChange={e => setEditMatchDate(e.target.value)} 
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button type="button" className="btn-secondary" onClick={() => setIsEditMatchOpen(false)}>Hủy</button>
              <button type="submit" className="btn-neon-green">Xác nhận Lưu</button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- MODAL XÁC NHẬN XÓA TRẬN ĐẤU --- */}
      <Modal
        isOpen={isDeleteMatchOpen}
        onClose={() => setIsDeleteMatchOpen(false)}
        title="Xác Nhận Xóa Trận Đấu"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Bạn có chắc chắn muốn xóa trận đấu này? Thao tác này sẽ xóa vĩnh viễn trận đấu khỏi hệ thống và **tự động tính toán lại điểm Elo** của các thành viên liên quan.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" className="btn-secondary" onClick={() => setIsDeleteMatchOpen(false)}>Hủy</button>
            <button type="button" className="btn-neon-green" style={{ backgroundColor: "var(--color-danger)", color: "#fff" }} onClick={handleDeleteMatchSubmit}>
              Xác nhận Xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
