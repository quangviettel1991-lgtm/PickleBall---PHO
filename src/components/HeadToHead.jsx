import PropTypes from 'prop-types';
import './HeadToHead.css';
import { isPlayed } from '../utils/schema.js';
import { useState, useMemo } from "react";
import { Users, Swords, TrendingUp, Calendar, AlertCircle } from "lucide-react";

export default function HeadToHead({ data }) {
  const { members = [], matches = [] } = data;

  const [playerAId, setPlayerAId] = useState("");
  const [playerBId, setPlayerBId] = useState("");

  // Clean and filter members list, order alphabetically
  const playerOptions = useMemo(() => {
    return [...members].sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  // Compute Head-to-Head matches and stats
  const h2hStats = useMemo(() => {
    if (!playerAId || !playerBId || playerAId === playerBId) return null;

    const pA = members.find(m => m.id === playerAId);
    const pB = members.find(m => m.id === playerBId);

    if (!pA || !pB) return null;

    // Filter matches where BOTH players participated
    const mutualMatches = matches.filter(match => {
      if (!isPlayed(match)) return false;
      const teamAMembers = match.teamA || [];
      const teamBMembers = match.teamB || [];

      const pAInA = teamAMembers.includes(playerAId);
      const pAInB = teamBMembers.includes(playerAId);
      const pBInA = teamAMembers.includes(playerBId);
      const pBInB = teamBMembers.includes(playerBId);

      return (pAInA || pAInB) && (pBInA || pBInB);
    });

    let pAWins = 0;
    let pBWins = 0;
    let singlesPlayed = 0;
    let doublesPlayed = 0;
    let singlesAWins = 0;
    let singlesBWins = 0;
    let doublesAWins = 0;
    let doublesBWins = 0;

    let totalPointsA = 0;
    let totalPointsB = 0;

    // Co-op (playing together on the same team in doubles) vs Against (opponents)
    let asTeammatesCount = 0;
    let asTeammatesWins = 0;

    const matchHistory = mutualMatches.map(match => {
      const teamAMembers = match.teamA || [];
      const teamBMembers = match.teamB || [];
      const isTeamA = teamAMembers.includes(playerAId);
      const isTeamB = teamBMembers.includes(playerAId);
      const isOpponent = (isTeamA && teamBMembers.includes(playerBId)) || (isTeamB && teamAMembers.includes(playerBId));

      const scoreA = match.scoreA || 0;
      const scoreB = match.scoreB || 0;
      const aWon = scoreA > scoreB;

      // Track score A/B relative to Player A vs Player B
      let scoreOfA = 0;
      let scoreOfB = 0;
      let isAWin = false;
      let isBWin = false;

      if (isOpponent) {
        if (isTeamA) {
          scoreOfA = scoreA;
          scoreOfB = scoreB;
          isAWin = aWon;
          isBWin = !aWon;
        } else {
          scoreOfA = scoreB;
          scoreOfB = scoreA;
          isAWin = !aWon;
          isBWin = aWon;
        }
        totalPointsA += scoreOfA;
        totalPointsB += scoreOfB;
        if (isAWin) pAWins++;
        if (isBWin) pBWins++;

        if (match.type === "singles") {
          singlesPlayed++;
          if (isAWin) singlesAWins++;
          if (isBWin) singlesBWins++;
        } else {
          doublesPlayed++;
          if (isAWin) doublesAWins++;
          if (isBWin) doublesBWins++;
        }
      } else {
        // Teammates in doubles
        asTeammatesCount++;
        scoreOfA = isTeamA ? scoreA : scoreB;
        scoreOfB = isTeamA ? scoreA : scoreB;
        isAWin = aWon; // Both win or both lose
        if (isTeamA && aWon) asTeammatesWins++;
        if (isTeamB && !aWon) asTeammatesWins++;
      }

      return {
        id: match.id,
        date: match.date,
        type: match.type,
        isOpponent, // true if they faced each other, false if teammates
        teamANames: teamAMembers.map(id => members.find(m => m.id === id)?.name || "Ẩn danh"),
        teamBNames: teamBMembers.map(id => members.find(m => m.id === id)?.name || "Ẩn danh"),
        scoreA,
        scoreB,
        pAWon: isOpponent ? isAWin : (isTeamA ? aWon : !aWon),
        pBWon: isOpponent ? isBWin : (isTeamB ? !aWon : aWon),
        scoreOfA,
        scoreOfB,
        eloChangeA: teamAMembers.reduce((acc, id) => acc + (match.eloChanges?.[id] || 0), 0),
        eloChangeB: teamBMembers.reduce((acc, id) => acc + (match.eloChanges?.[id] || 0), 0),
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first

    const totalAgainst = singlesPlayed + doublesPlayed;
    const winRateA = totalAgainst > 0 ? Math.round((pAWins / totalAgainst) * 100) : 0;
    const winRateB = totalAgainst > 0 ? Math.round((pBWins / totalAgainst) * 100) : 0;

    return {
      playerA: pA,
      playerB: pB,
      totalAgainst,
      pAWins,
      pBWins,
      winRateA,
      winRateB,
      singlesPlayed,
      singlesAWins,
      singlesBWins,
      doublesPlayed,
      doublesAWins,
      doublesBWins,
      totalPointsA,
      totalPointsB,
      avgPointsA: totalAgainst > 0 ? (totalPointsA / totalAgainst).toFixed(1) : "0.0",
      avgPointsB: totalAgainst > 0 ? (totalPointsB / totalAgainst).toFixed(1) : "0.0",
      asTeammatesCount,
      asTeammatesWins,
      asTeammatesWinRate: asTeammatesCount > 0 ? Math.round((asTeammatesWins / asTeammatesCount) * 100) : 0,
      matchHistory
    };
  }, [playerAId, playerBId, members, matches]);

  // Player assessments
  const playerAAssessment = useMemo(() => {
    if (!h2hStats) return null;
    const { winRateA, totalAgainst, singlesPlayed, singlesAWins, doublesPlayed, doublesAWins } = h2hStats;
    if (totalAgainst === 0) return "Chưa đủ dữ liệu đối đầu để đánh giá.";

    let text = "";
    if (winRateA > 65) {
      text = "Khắc tinh hoàn toàn! Áp đảo đối thủ ở hầu hết các ván đấu.";
    } else if (winRateA >= 50) {
      text = "Nhỉnh hơn một chút. Chiếm ưu thế trong các trận đấu cân tài cân sức.";
    } else if (winRateA >= 35) {
      text = "Kém thế hơn một chút. Có khả năng chiến thắng nhưng cần chuẩn bị chiến thuật tốt hơn.";
    } else {
      text = "Gặp dớp đối đầu! Thường gặp rất nhiều khó khăn trước lối đánh của đối phương.";
    }

    if (singlesPlayed > 0 && singlesAWins / singlesPlayed > 0.6) {
      text += " Có ưu thế vượt trội ở nội dung Đơn.";
    }
    if (doublesPlayed > 0 && doublesAWins / doublesPlayed > 0.6) {
      text += " Phối hợp đồng đội tốt hơn khi đối đầu.";
    }
    return text;
  }, [h2hStats]);

  const playerBAssessment = useMemo(() => {
    if (!h2hStats) return null;
    const { winRateB, totalAgainst, singlesPlayed, singlesBWins, doublesPlayed, doublesBWins } = h2hStats;
    if (totalAgainst === 0) return "Chưa đủ dữ liệu đối đầu để đánh giá.";

    let text = "";
    if (winRateB > 65) {
      text = "Khắc tinh hoàn toàn! Áp đảo đối thủ ở hầu hết các ván đấu.";
    } else if (winRateB >= 50) {
      text = "Nhỉnh hơn một chút. Chiếm ưu thế trong các trận đấu cân tài cân sức.";
    } else if (winRateB >= 35) {
      text = "Kém thế hơn một chút. Có khả năng chiến thắng nhưng cần chuẩn bị chiến thuật tốt hơn.";
    } else {
      text = "Gặp dớp đối đầu! Thường gặp rất nhiều khó khăn trước lối đánh của đối phương.";
    }

    if (singlesPlayed > 0 && singlesBWins / singlesPlayed > 0.6) {
      text += " Có ưu thế vượt trội ở nội dung Đơn.";
    }
    if (doublesPlayed > 0 && doublesBWins / doublesPlayed > 0.6) {
      text += " Phối hợp đồng đội tốt hơn khi đối đầu.";
    }
    return text;
  }, [h2hStats]);

  return (
    <div className="h2h-container animate-fade-in">


      <div className="h2h-title-section">
        <div className="tab-icon-wrapper" style={{ background: "rgba(0, 236, 255, 0.1)", border: "1px solid rgba(0, 236, 255, 0.2)" }}>
          <Swords size={20} className="text-electric-blue" />
        </div>
        <div>
          <h2 className="tab-title">Lịch Sử Đối Đầu</h2>
          <p className="tab-subtitle">Phân tích kết quả, so sánh năng lực và lịch sử thi đấu trực tiếp giữa 2 kỳ phùng địch thủ.</p>
        </div>
      </div>

      {/* Select Players Grid */}
      <div className="glass-panel h2h-card" style={{ marginBottom: "24px", padding: "20px" }}>
        <div className="h2h-select-grid">
          <div>
            <label className="form-label">Chọn Người chơi A</label>
            <select aria-label="Người chơi A"
              className="form-input"
              value={playerAId}
              onChange={(e) => setPlayerAId(e.target.value)}
            >
              <option value="">-- Chọn thành viên --</option>
              {playerOptions.map(m => (
                <option key={m.id} value={m.id} disabled={m.id === playerBId}>
                  {m.name} {m.isGuest ? "(Khách)" : ""} - {m.elo} Elo
                </option>
              ))}
            </select>
          </div>

          <div className="vs-badge">VS</div>

          <div>
            <label className="form-label">Chọn Người chơi B</label>
            <select aria-label="Người chơi B"
              className="form-input"
              value={playerBId}
              onChange={(e) => setPlayerBId(e.target.value)}
            >
              <option value="">-- Chọn thành viên --</option>
              {playerOptions.map(m => (
                <option key={m.id} value={m.id} disabled={m.id === playerAId}>
                  {m.name} {m.isGuest ? "(Khách)" : ""} - {m.elo} Elo
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Display */}
      {h2hStats ? (
        <>
          <div className="glass-panel h2h-card glow-border-blue">
            <div className="h2h-stats-summary">
              {/* Player A Stats Block */}
              <div className="h2h-player-stat-block">
                <div className="h2h-player-name">{h2hStats.playerA.name}</div>
                <div className="h2h-player-elo">
                  Singles: {h2hStats.playerA.eloSingles || h2hStats.playerA.elo} | Doubles: {h2hStats.playerA.eloDoubles || h2hStats.playerA.elo}
                </div>
                <div className={`h2h-winrate-circle ${h2hStats.winRateA >= h2hStats.winRateB ? "winner" : ""}`}>
                  <span className="h2h-winrate-pct">{h2hStats.winRateA}%</span>
                  <span className="h2h-winrate-label">Thắng</span>
                </div>
                <div className="val-a font-semibold" style={{ fontSize: "1.1rem" }}>
                  {h2hStats.pAWins} trận thắng
                </div>
              </div>

              {/* Middle VS and Totals Info */}
              <div style={{ textAlignment: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span className="text-muted text-xs uppercase font-bold tracking-wider">Đối đầu</span>
                <span className="text-2xl font-black text-white" style={{ margin: "4px 0" }}>
                  {h2hStats.totalAgainst}
                </span>
                <span className="text-muted text-xs">Trận đấu</span>
              </div>

              {/* Player B Stats Block */}
              <div className="h2h-player-stat-block">
                <div className="h2h-player-name">{h2hStats.playerB.name}</div>
                <div className="h2h-player-elo">
                  Singles: {h2hStats.playerB.eloSingles || h2hStats.playerB.elo} | Doubles: {h2hStats.playerB.eloDoubles || h2hStats.playerB.elo}
                </div>
                <div className={`h2h-winrate-circle ${h2hStats.winRateB >= h2hStats.winRateA ? "winner" : ""}`}>
                  <span className="h2h-winrate-pct">{h2hStats.winRateB}%</span>
                  <span className="h2h-winrate-label">Thắng</span>
                </div>
                <div className="val-b font-semibold" style={{ fontSize: "1.1rem" }}>
                  {h2hStats.pBWins} trận thắng
                </div>
              </div>

              {/* Progress bar visualizer */}
              {h2hStats.totalAgainst > 0 && (
                <div className="h2h-progress-container">
                  <div className="h2h-progress-bar-a" style={{ width: `${h2hStats.winRateA}%` }}></div>
                  <div className="h2h-progress-bar-b" style={{ width: `${h2hStats.winRateB}%` }}></div>
                </div>
              )}
            </div>

            {/* Assessment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginTop: "20px" }}>
              <div className="h2h-assessment-box" style={{ background: "rgba(212, 252, 52, 0.02)", borderColor: "rgba(212, 252, 52, 0.15)" }}>
                <div className="h2h-assessment-header" style={{ color: "var(--accent-neon-green)" }}>
                  <TrendingUp size={16} />
                  <span>Đánh giá {h2hStats.playerA.name}</span>
                </div>
                <p className="h2h-assessment-text">{playerAAssessment}</p>
              </div>

              <div className="h2h-assessment-box">
                <div className="h2h-assessment-header">
                  <TrendingUp size={16} />
                  <span>Đánh giá {h2hStats.playerB.name}</span>
                </div>
                <p className="h2h-assessment-text">{playerBAssessment}</p>
              </div>
            </div>

            {/* Detail stats grid */}
            <div className="h2h-detail-stats-grid">
              <div className="h2h-detail-stat-row">
                <div className="h2h-detail-stat-title">Đấu Đơn (Singles)</div>
                <div className="h2h-detail-stat-values">
                  <span className="val-a">{h2hStats.singlesAWins}</span>
                  <span className="val-mid">/ {h2hStats.singlesPlayed} trận /</span>
                  <span className="val-b">{h2hStats.singlesBWins}</span>
                </div>
              </div>

              <div className="h2h-detail-stat-row">
                <div className="h2h-detail-stat-title">Đấu Đôi (Doubles)</div>
                <div className="h2h-detail-stat-values">
                  <span className="val-a">{h2hStats.doublesAWins}</span>
                  <span className="val-mid">/ {h2hStats.doublesPlayed} trận /</span>
                  <span className="val-b">{h2hStats.doublesBWins}</span>
                </div>
              </div>

              <div className="h2h-detail-stat-row">
                <div className="h2h-detail-stat-title">Điểm số trung bình</div>
                <div className="h2h-detail-stat-values">
                  <span className="val-a">{h2hStats.avgPointsA} pt</span>
                  <span className="val-mid">vs</span>
                  <span className="val-b">{h2hStats.avgPointsB} pt</span>
                </div>
              </div>
            </div>

            {/* Teammates section if any */}
            {h2hStats.asTeammatesCount > 0 && (
              <div className="h2h-assessment-box" style={{ marginTop: "16px", background: "rgba(46, 213, 115, 0.04)", borderColor: "rgba(46, 213, 115, 0.15)" }}>
                <div className="h2h-assessment-header" style={{ color: "var(--color-success)" }}>
                  <Users size={16} />
                  <span>Khi đồng hành cùng đội (Đồng đội đấu đôi)</span>
                </div>
                <p className="h2h-assessment-text">
                  Hai người chơi đã cùng chiến tuyến trong <strong>{h2hStats.asTeammatesCount}</strong> trận đôi,
                  với tỉ lệ giành chiến thắng đồng hành là <strong>{h2hStats.asTeammatesWinRate}%</strong> ({h2hStats.asTeammatesWins} trận thắng).
                </p>
              </div>
            )}
          </div>

          {/* Matches History list */}
          <div className="h2h-history-section">
            <h3 className="h2h-history-title">
              <Calendar size={18} className="text-electric-blue" />
              <span>Lịch Sử Gặp Nhau ({h2hStats.matchHistory.length} Trận)</span>
            </h3>

            {h2hStats.matchHistory.length === 0 ? (
              <div className="select-prompt-box">Không tìm thấy lịch sử trận đấu nào giữa 2 kỳ thủ.</div>
            ) : (
              h2hStats.matchHistory.map(m => {
                let borderClass = "";
                let badgeText = "ĐỐI ĐẦU";
                let badgeClass = "badge-opponent";

                if (m.isOpponent) {
                  borderClass = m.scoreA > m.scoreB ? "win-a" : "win-b";
                } else {
                  badgeText = "ĐỒNG ĐỘI";
                  badgeClass = "badge-teammate";
                  borderClass = m.scoreA > m.scoreB ? "teammates-win" : "teammates-loss";
                }

                return (
                  <div key={m.id} className={`glass-panel match-history-card ${borderClass}`}>
                    <div className="match-history-grid">
                      <div className="match-history-date">
                        {new Date(m.date).toLocaleDateString("vi-VN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>

                      <div className={`match-history-team ${m.scoreA > m.scoreB ? "winner text-white" : "text-muted"}`}>
                        {m.teamANames.join(" - ")}
                        {m.eloChangeA !== 0 && m.isOpponent && (
                          <div className={`elo-change-indicator ${m.eloChangeA > 0 ? "elo-up" : "elo-down"}`}>
                            {m.eloChangeA > 0 ? `+${m.eloChangeA}` : m.eloChangeA} Elo (A)
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span className={`match-history-badge ${badgeClass}`}>{badgeText}</span>
                        <div className="match-history-score">
                          {m.scoreA} - {m.scoreB}
                        </div>
                        <span className="text-muted text-xs capitalize">{m.type === "singles" ? "Đơn" : "Đôi"}</span>
                      </div>

                      <div className={`match-history-team ${m.scoreB > m.scoreA ? "winner text-white" : "text-muted"}`} style={{ textAlign: "right" }}>
                        {m.teamBNames.join(" - ")}
                        {m.eloChangeB !== 0 && m.isOpponent && (
                          <div className={`elo-change-indicator ${m.eloChangeB > 0 ? "elo-up" : "elo-down"}`}>
                            {m.eloChangeB > 0 ? `+${m.eloChangeB}` : m.eloChangeB} Elo (B)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="select-prompt-box">
          <AlertCircle size={40} style={{ margin: "0 auto 12px", color: "var(--accent-electric-blue)" }} />
          <h3>Vui lòng chọn 2 người chơi khác nhau</h3>
          <p style={{ marginTop: "6px" }}>Chọn người chơi A và người chơi B từ các ô chọn phía trên để phân tích lịch sử đối đầu của họ.</p>
        </div>
      )}
    </div>
  );
}

HeadToHead.propTypes = {
  data: PropTypes.object,
};
