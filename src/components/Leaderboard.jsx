import React, { useState, useMemo } from "react";
import { Trophy, Calendar, Filter, ArrowUpDown, Clock } from "lucide-react";

export default function Leaderboard({ data }) {
  const { members, matches, events } = data;

  // Trạng thái bộ lọc
  const [filterType, setFilterType] = useState("all"); // all, singles, doubles
  const [filterEvent, setFilterEvent] = useState("all"); // all, eventId
  const [filterPeriod, setFilterPeriod] = useState("all"); // all, today, week, month, custom
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Trạng thái hiển thị bộ lọc trên di động (thu gọn mặc định)
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Sắp xếp
  const [sortBy, setSortBy] = useState("elo"); // elo, eloChange, winRate, matchesPlayed
  const [sortOrder, setSortOrder] = useState("desc"); // desc, asc

  // Xác định khoảng thời gian cho các bộ lọc có sẵn
  const dateRange = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Đầu tuần (thứ 2)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
    
    // Đầu tháng
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (filterPeriod) {
      case "today":
        return { start: startOfToday, end: new Date() };
      case "week":
        return { start: startOfWeek, end: new Date() };
      case "month":
        return { start: startOfMonth, end: new Date() };
      case "custom":
        return {
          start: customStart ? new Date(customStart + "T00:00:00") : null,
          end: customEnd ? new Date(customEnd + "T23:59:59") : null
        };
      default:
        return { start: null, end: null };
    }
  }, [filterPeriod, customStart, customEnd]);

  // Bộ lọc các trận đấu dựa trên điều kiện
  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      // 1. Lọc thể thức
      if (filterType !== "all" && match.type !== filterType) return false;

      // 2. Lọc sự kiện
      if (filterEvent !== "all" && match.eventId !== filterEvent) return false;

      // 3. Lọc khoảng thời gian
      if (dateRange.start || dateRange.end) {
        const matchDate = new Date(match.date);
        if (dateRange.start && matchDate < dateRange.start) return false;
        if (dateRange.end && matchDate > dateRange.end) return false;
      }

      return true;
    });
  }, [matches, filterType, filterEvent, dateRange]);

  // Tính toán thống kê xếp hạng của từng thành viên dựa trên các trận đấu đã lọc
  const leaderboardData = useMemo(() => {
    const list = members.map(member => {
      let played = 0;
      let won = 0;
      let lost = 0;
      let eloChange = 0;
      let scoreDiff = 0;

      // Quét qua các trận đấu đã lọc để tính toán
      filteredMatches.forEach(match => {
        const isTeamA = match.teamA.includes(member.id);
        const isTeamB = match.teamB.includes(member.id);

        if (isTeamA || isTeamB) {
          played++;
          const eloChangeVal = match.eloChanges[member.id] || 0;
          eloChange += eloChangeVal;

          const aWon = match.scoreA > match.scoreB;
          if ((isTeamA && aWon) || (isTeamB && !aWon)) {
            won++;
          } else {
            lost++;
          }

          // Tính toán hiệu số điểm (Tổng điểm ghi được - Tổng điểm bị thua)
          if (isTeamA) {
            scoreDiff += (match.scoreA - match.scoreB);
          } else if (isTeamB) {
            scoreDiff += (match.scoreB - match.scoreA);
          }
        }
      });

      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

      return {
        ...member,
        played,
        won,
        lost,
        winRate,
        eloChange,
        scoreDiff
      };
    });

    // Nếu đang lọc theo một giải đấu/sự kiện cụ thể, loại bỏ thành viên chưa đấu trận nào trong giải đấu đó
    if (filterEvent !== "all") {
      return list.filter(member => member.played > 0);
    }

    return list;
  }, [members, filteredMatches, filterEvent]);

  // Sắp xếp dữ liệu bảng xếp hạng
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardData].sort((a, b) => {
      let valA, valB;
      let tieBreakers = [];

      if (sortBy === "elo") {
        valA = a.elo;
        valB = b.elo;
        tieBreakers = [
          [a.won, b.won],
          [a.winRate, b.winRate],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else if (sortBy === "won") {
        valA = a.won;
        valB = b.won;
        tieBreakers = [
          [a.elo, b.elo],
          [a.winRate, b.winRate],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else if (sortBy === "eloChange") {
        valA = a.eloChange;
        valB = b.eloChange;
        tieBreakers = [
          [a.elo, b.elo],
          [a.won, b.won],
          [a.winRate, b.winRate],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else if (sortBy === "winRate") {
        valA = a.winRate;
        valB = b.winRate;
        tieBreakers = [
          [a.elo, b.elo],
          [a.won, b.won],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else if (sortBy === "matchesPlayed") {
        valA = a.played;
        valB = b.played;
        tieBreakers = [
          [a.elo, b.elo],
          [a.won, b.won],
          [a.winRate, b.winRate],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else {
        valA = a.elo;
        valB = b.elo;
      }

      if (valA !== valB) {
        return sortOrder === "desc" ? valB - valA : valA - valB;
      }

      // Áp dụng các tiêu chí phụ ưu tiên tiếp theo (tỷ lệ thắng, hiệu số, v.v.)
      for (let i = 0; i < tieBreakers.length; i++) {
        const [tbA, tbB] = tieBreakers[i];
        if (tbA !== tbB) {
          // Các tiêu chí phụ luôn ưu tiên sắp xếp giảm dần
          return sortOrder === "desc" ? tbB - tbA : tbA - tbB;
        }
      }

      return a.name.localeCompare(b.name);
    });
  }, [leaderboardData, sortBy, sortOrder]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const getEventName = (id) => {
    const ev = events.find(e => e.id === id);
    return ev ? ev.name : "";
  };

  return (
    <div className="leaderboard-container animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        .leaderboard-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 24px 16px;
        }

        .leaderboard-header-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .leaderboard-title {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .leaderboard-title svg {
          color: var(--accent-neon-green);
        }

        /* Thanh bộ lọc ngang cao cấp */
        .filters-panel {
          padding: 20px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          transition: all 0.3s ease;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .custom-range-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .custom-range-inputs input {
          width: 50%;
        }

        /* Nút toggle bộ lọc trên di động */
        .mobile-filter-toggle {
          display: none;
          width: 100%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: #fff;
          font-weight: 600;
          font-size: 0.9rem;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          margin-bottom: 16px;
          transition: all 0.2s;
        }

        .mobile-filter-toggle:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        /* Thiết kế bảng xếp hạng */
        .board-panel {
          padding: 20px;
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

        /* Hạng */
        .rank-col {
          font-weight: 700;
          font-size: 1.05rem;
          width: 50px;
          text-align: center;
        }

        .rank-medal {
          font-size: 1.25rem;
        }

        .rank-1 { color: var(--accent-neon-green); }
        .rank-2 { color: #cbd5e1; }
        .rank-3 { color: #b45309; }

        /* Cột người chơi */
        .player-info-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .player-info-details {
          display: flex;
          flex-direction: column;
        }

        .player-name-cell {
          font-weight: 700;
          color: #fff;
          font-size: 0.92rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px;
        }

        .player-gender-cell {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        /* Biến động Elo */
        .elo-change-badge {
          display: inline-flex;
          align-items: center;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.8rem;
        }

        .elo-change-up {
          background: rgba(46, 213, 115, 0.08);
          color: var(--color-success);
          border: 1px solid rgba(46, 213, 115, 0.15);
        }

        .elo-change-down {
          background: rgba(255, 71, 87, 0.08);
          color: var(--color-danger);
          border: 1px solid rgba(255, 71, 87, 0.15);
        }

        .elo-change-none {
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-muted);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .active-filter-desc {
          margin-top: -8px;
          margin-bottom: 16px;
          font-size: 0.8rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .show-on-mobile {
          display: none;
        }

        .player-mobile-stats-subtext {
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 2px;
          font-weight: 500;
        }

        /* Ẩn cột trên di động */
        .hide-on-mobile {
          display: table-cell;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hide-on-mobile {
            display: none !important;
          }

          .mobile-filter-toggle {
            display: flex;
          }

          .filters-panel {
            display: ${showMobileFilters ? "grid" : "none"};
            grid-template-columns: 1fr;
            padding: 16px;
            gap: 12px;
          }

          .leaderboard-title {
            font-size: 1.3rem;
          }

          .board-panel {
            padding: 8px !important;
          }

          .custom-table td, .custom-table th {
            padding: 10px 6px !important;
            font-size: 0.82rem !important;
          }

          .player-name-cell {
            max-width: 105px;
          }

          .rank-col {
            width: 36px !important;
          }

          .player-avatar-sm {
            width: 26px !important;
            height: 26px !important;
            font-size: 0.72rem !important;
          }

          .show-on-mobile {
            display: inline-block !important;
          }
        }

      `}} />

      <div className="leaderboard-header-section">
        <h1 className="leaderboard-title">
          <Trophy size={24} /> Bảng Xếp Hạng CLB
        </h1>
        <div style={{ display: "flex", gap: "8px" }} className="match-event-tag">
          <span>{filteredMatches.length} trận đấu được tính</span>
        </div>
      </div>

      {/* Nút bật tắt bộ lọc trên di động */}
      <button 
        className="mobile-filter-toggle"
        onClick={() => setShowMobileFilters(!showMobileFilters)}
      >
        <Filter size={16} /> 
        {showMobileFilters ? "Ẩn công cụ lọc" : "Lọc bảng xếp hạng..."}
      </button>

      {/* Thanh Bộ lọc */}
      <div className="glass-panel filters-panel">
        {/* Bộ lọc Thể thức */}
        <div className="filter-group">
          <label className="form-label">Thể thức đấu</label>
          <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">Tất cả thể thức</option>
            <option value="singles">Đánh Đơn (1v1)</option>
            <option value="doubles">Đánh Đôi (2v2)</option>
          </select>
        </div>

        {/* Bộ lọc Giải đấu / Sự kiện */}
        <div className="filter-group">
          <label className="form-label">Sự kiện / Giải đấu</label>
          <select className="form-select" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
            <option value="all">Tất cả sự kiện</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        {/* Bộ lọc Mốc thời gian */}
        <div className="filter-group">
          <label className="form-label">Khoảng thời gian</label>
          <select className="form-select" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="all">Tất cả thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="custom">Tùy chọn...</option>
          </select>
        </div>

        {/* Tùy chọn ngày cụ thể nếu chọn custom */}
        <div className="filter-group">
          {filterPeriod === "custom" ? (
            <>
              <label className="form-label">Chọn ngày bắt đầu & kết thúc</label>
              <div className="custom-range-inputs">
                <input 
                  type="date" 
                  className="form-input" 
                  value={customStart} 
                  onChange={e => setCustomStart(e.target.value)} 
                />
                <span style={{ color: "var(--text-muted)" }}>-</span>
                <input 
                  type="date" 
                  className="form-input" 
                  value={customEnd} 
                  onChange={e => setCustomEnd(e.target.value)} 
                />
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.3, pointerEvents: "none" }}>
              <label className="form-label">Chọn ngày (Không kích hoạt)</label>
              <div className="custom-range-inputs">
                <input type="date" className="form-input" disabled />
                <span style={{ color: "var(--text-muted)" }}>-</span>
                <input type="date" className="form-input" disabled />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mô tả bộ lọc đang hoạt động */}
      {(filterType !== "all" || filterEvent !== "all" || filterPeriod !== "all") && (
        <div className="active-filter-desc">
          <Clock size={12} />
          Đang lọc:{" "}
          <strong>{filterType === "singles" ? "Đánh đơn" : filterType === "doubles" ? "Đánh đôi" : "Đơn & Đôi"}</strong>
          {filterEvent !== "all" && <> tại giải <strong>"{getEventName(filterEvent)}"</strong></>}
          {filterPeriod !== "all" && (
            <>
              {" "}trong{" "}
              <strong>
                {filterPeriod === "today" && "Hôm nay"}
                {filterPeriod === "week" && "Tuần này"}
                {filterPeriod === "month" && "Tháng này"}
                {filterPeriod === "custom" && `${customStart || "đầu"} đến ${customEnd || "nay"}`}
              </strong>
            </>
          )}
        </div>
      )}

      {/* Bảng Xếp Hạng */}
      <div className="glass-panel board-panel">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: "60px", textAlign: "center" }}>Hạng</th>
                <th>Thành viên</th>
                <th style={{ width: "100px" }}>
                  <div 
                    className={`sort-header ${sortBy === "elo" ? "active" : ""}`}
                    onClick={() => toggleSort("elo")}
                  >
                    Elo <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "110px", textAlign: "center" }}>
                  <div 
                    className={`sort-header ${sortBy === "eloChange" ? "active" : ""}`}
                    onClick={() => toggleSort("eloChange")}
                  >
                    Biến động <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "90px", textAlign: "center" }} className="hide-on-mobile">
                  <div 
                    className={`sort-header ${sortBy === "matchesPlayed" ? "active" : ""}`}
                    onClick={() => toggleSort("matchesPlayed")}
                  >
                    Số trận <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "110px", textAlign: "center" }} className="hide-on-mobile">
                  <div 
                    className={`sort-header ${sortBy === "won" ? "active" : ""}`}
                    onClick={() => toggleSort("won")}
                  >
                    Thắng-Thua <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "90px", textAlign: "center" }} className="hide-on-mobile">Hiệu số</th>
                <th style={{ width: "100px", textAlign: "center" }}>
                  <div 
                    className={`sort-header ${sortBy === "winRate" ? "active" : ""}`}
                    onClick={() => toggleSort("winRate")}
                  >
                    % Thắng <ArrowUpDown size={12} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                    Không tìm thấy thành viên nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                sortedLeaderboard.map((member, index) => {
                  const rank = index + 1;
                  
                  return (
                    <tr key={member.id}>
                      {/* Cột thứ hạng */}
                      <td className="rank-col">
                        {rank === 1 ? (
                          <span className="rank-medal rank-1">🥇</span>
                        ) : rank === 2 ? (
                          <span className="rank-medal rank-2">🥈</span>
                        ) : rank === 3 ? (
                          <span className="rank-medal rank-3">🥉</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>{rank}</span>
                        )}
                      </td>

                      {/* Cột người chơi */}
                      <td>
                        <div className="player-info-cell">
                          <div 
                            className="player-avatar player-avatar-sm" 
                            style={{ backgroundColor: member.avatarColor }}
                          >
                            {member.name.charAt(0)}
                          </div>
                          <div className="player-info-details">
                            <span className="player-name-cell">{member.name}</span>
                            <span className="player-gender-cell hide-on-mobile">{member.gender}</span>
                            {/* Hiển thị tóm tắt thống kê trên di động để hiển thị đầy đủ thông tin */}
                            <span className="player-mobile-stats-subtext show-on-mobile">
                              {member.played} trận • {member.won}T-{member.lost}B • HS: {member.scoreDiff > 0 ? `+${member.scoreDiff}` : member.scoreDiff}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cột Elo */}
                      <td style={{ fontWeight: "700", color: "var(--accent-electric-blue)" }}>
                        {member.elo}
                      </td>

                      {/* Cột Biến động Elo */}
                      <td style={{ textAlign: "center" }}>
                        {member.eloChange > 0 ? (
                          <span className="elo-change-badge elo-change-up">
                            +{member.eloChange}
                          </span>
                        ) : member.eloChange < 0 ? (
                          <span className="elo-change-badge elo-change-down">
                            {member.eloChange}
                          </span>
                        ) : (
                          <span className="elo-change-badge elo-change-none">
                            0
                          </span>
                        )}
                      </td>

                      {/* Cột Số trận - Ẩn trên di động */}
                      <td style={{ textAlign: "center", fontWeight: "500" }} className="hide-on-mobile">
                        {member.played}
                      </td>

                      {/* Cột Thắng - Thua - Ẩn trên di động */}
                      <td style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }} className="hide-on-mobile">
                        <span style={{ color: "var(--color-success)", fontWeight: "600" }}>{member.won}</span>
                        {"-"}
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

                      {/* Cột Tỷ lệ thắng */}
                      <td style={{ textAlign: "center", fontWeight: "700" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span>{member.winRate}%</span>
                          {/* Thanh progress bar mini */}
                          <div style={{
                            width: "50px",
                            height: "3px",
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: "2px",
                            marginTop: "3px",
                            overflow: "hidden"
                          }}>
                            <div style={{
                              width: `${member.winRate}%`,
                              height: "100%",
                              background: member.winRate >= 50 ? "var(--accent-neon-green)" : "var(--color-danger)"
                            }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
