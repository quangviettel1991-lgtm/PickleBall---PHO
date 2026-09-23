import './Leaderboard.css';
import PropTypes from 'prop-types';
import { useState, useMemo } from "react";
import { Trophy, Filter, ArrowUpDown, Clock } from "lucide-react";

export default function Leaderboard({ data }) {
  const { members, matches, events } = data;

  // Trạng thái bộ lọc
  const [filterType, setFilterType] = useState("all"); // all, singles, doubles
  const [filterEvent, setFilterEvent] = useState("all"); // all, eventId
  const [filterPeriod, setFilterPeriod] = useState("all"); // all, today, week, month, custom
  const [showGuests, setShowGuests] = useState(false);
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
      // Bỏ qua các trận đấu chưa diễn ra
      if (match.played === false) return false;

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
    const list = members.filter(m=>!m.archivedAt).map(member => {
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

      const displayedElo = filterType === "singles"
        ? (member.eloSingles !== undefined ? member.eloSingles : member.elo)
        : filterType === "doubles"
          ? (member.eloDoubles !== undefined ? member.eloDoubles : member.elo)
          : member.elo;

      return {
        ...member,
        displayedElo,
        played,
        won,
        lost,
        winRate,
        eloChange,
        scoreDiff
      };
    });

    // Nếu đang lọc theo một giải đấu/sự kiện cụ thể, loại bỏ thành viên chưa đấu trận nào trong giải đấu đó
    let filteredList = list;
    if (filterEvent !== "all") {
      filteredList = filteredList.filter(member => member.played > 0);
    }

    // Lọc khách mời
    if (!showGuests) {
      filteredList = filteredList.filter(member => !member.isGuest);
    }

    return filteredList;
  }, [members, filteredMatches, filterEvent, showGuests, filterType]);

  // Sắp xếp dữ liệu bảng xếp hạng
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardData].sort((a, b) => {
      let valA, valB;
      let tieBreakers = [];

      if (sortBy === "elo") {
        valA = a.displayedElo;
        valB = b.displayedElo;
        tieBreakers = [
          [a.won, b.won],
          [a.winRate, b.winRate],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else if (sortBy === "won") {
        valA = a.won;
        valB = b.won;
        tieBreakers = [
          [a.displayedElo, b.displayedElo],
          [a.winRate, b.winRate],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else if (sortBy === "eloChange") {
        valA = a.eloChange;
        valB = b.eloChange;
        tieBreakers = [
          [a.displayedElo, b.displayedElo],
          [a.won, b.won],
          [a.winRate, b.winRate],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else if (sortBy === "winRate") {
        valA = a.winRate;
        valB = b.winRate;
        tieBreakers = [
          [a.displayedElo, b.displayedElo],
          [a.won, b.won],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else if (sortBy === "matchesPlayed") {
        valA = a.played;
        valB = b.played;
        tieBreakers = [
          [a.displayedElo, b.displayedElo],
          [a.won, b.won],
          [a.winRate, b.winRate],
          [a.scoreDiff, b.scoreDiff]
        ];
      } else {
        valA = a.displayedElo;
        valB = b.displayedElo;
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


      <div className="leaderboard-header-section">
        <h1 className="leaderboard-title">
          <Trophy size={24} /> Bảng Xếp Hạng CLB
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }} className="match-event-tag">
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={showGuests}
              onChange={e => setShowGuests(e.target.checked)}
              style={{ accentColor: "var(--accent-neon-green)", cursor: "pointer" }}
            />
            Hiển thị khách mời
          </label>
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
      <div className={`glass-panel filters-panel ${showMobileFilters ? "mobile-filters-open" : ""}`}>
        {/* Bộ lọc Thể thức */}
        <div className="filter-group">
          <label className="form-label">Thể thức đấu</label>
          <select aria-label="Lọc theo thể thức" className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">Tất cả thể thức</option>
            <option value="singles">Đánh Đơn (1v1)</option>
            <option value="doubles">Đánh Đôi (2v2)</option>
          </select>
        </div>

        {/* Bộ lọc Giải đấu / Sự kiện */}
        <div className="filter-group">
          <label className="form-label">Sự kiện / Giải đấu</label>
          <select aria-label="Lọc theo sự kiện" className="form-select" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
            <option value="all">Tất cả sự kiện</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        {/* Bộ lọc Mốc thời gian */}
        <div className="filter-group">
          <label className="form-label">Khoảng thời gian</label>
          <select aria-label="Lọc theo thời gian" className="form-select" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
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
                <input aria-label="Từ ngày"
                  type="date"
                  className="form-input"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
                <span style={{ color: "var(--text-muted)" }}>-</span>
                <input aria-label="Đến ngày"
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
                <input aria-label="Từ ngày" type="date" className="form-input" disabled />
                <span style={{ color: "var(--text-muted)" }}>-</span>
                <input aria-label="Đến ngày" type="date" className="form-input" disabled />
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
          {filterEvent !== "all" && <> tại giải <strong>&quot;{getEventName(filterEvent)}&quot;</strong></>}
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
                <th style={{ width: "40px", textAlign: "center" }}>Hạng</th>
                <th>
                  <span className="hide-text-on-mobile">Thành viên</span>
                  <span className="show-text-on-mobile">Tên</span>
                </th>
                <th style={{ width: "60px" }}>
                  <div
                    className={`sort-header ${sortBy === "elo" ? "active" : ""}`}
                    onClick={() => toggleSort("elo")}
                  >
                    Elo <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "65px", textAlign: "center" }}>
                  <div
                    className={`sort-header ${sortBy === "eloChange" ? "active" : ""}`}
                    onClick={() => toggleSort("eloChange")}
                  >
                    <span className="hide-text-on-mobile">Biến động</span>
                    <span className="show-text-on-mobile">+/-</span> <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "55px", textAlign: "center" }}>
                  <div
                    className={`sort-header ${sortBy === "matchesPlayed" ? "active" : ""}`}
                    onClick={() => toggleSort("matchesPlayed")}
                  >
                    <span className="hide-text-on-mobile">Số trận</span>
                    <span className="show-text-on-mobile">Trận</span> <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "65px", textAlign: "center" }}>
                  <div
                    className={`sort-header ${sortBy === "won" ? "active" : ""}`}
                    onClick={() => toggleSort("won")}
                  >
                    <span className="hide-text-on-mobile">Thắng-Thua</span>
                    <span className="show-text-on-mobile">W-L</span> <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ width: "55px", textAlign: "center" }}>
                  <span className="hide-text-on-mobile">Hiệu số</span>
                  <span className="show-text-on-mobile">HS</span>
                </th>
                <th style={{ width: "70px", textAlign: "center" }}>
                  <div
                    className={`sort-header ${sortBy === "winRate" ? "active" : ""}`}
                    onClick={() => toggleSort("winRate")}
                  >
                    <span className="hide-text-on-mobile">% Thắng</span>
                    <span className="show-text-on-mobile">%Win</span> <ArrowUpDown size={12} />
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
                            <span className="player-name-cell" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {member.name}
                              {member.isGuest && (
                                <span style={{
                                  padding: "2px 6px",
                                  fontSize: "0.65rem",
                                  fontWeight: "700",
                                  borderRadius: "4px",
                                  background: "rgba(255, 165, 2, 0.15)",
                                  color: "var(--color-warning)",
                                  border: "1px solid rgba(255, 165, 2, 0.25)",
                                  lineHeight: 1
                                }}>
                                  Khách
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cột Elo */}
                      <td style={{ fontWeight: "700", color: "var(--accent-electric-blue)" }}>
                        {member.displayedElo}
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

                      {/* Cột Số trận */}
                      <td style={{ textAlign: "center", fontWeight: "500" }}>
                        {member.played}
                      </td>

                      {/* Cột Thắng - Thua */}
                      <td style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--color-success)", fontWeight: "600" }}>{member.won}</span>
                        {"-"}
                        <span style={{ color: "var(--color-danger)", fontWeight: "600" }}>{member.lost}</span>
                      </td>

                      {/* Cột Hiệu số */}
                      <td style={{ textAlign: "center", fontWeight: "600" }}>
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

Leaderboard.propTypes = {
  data: PropTypes.object,
};
