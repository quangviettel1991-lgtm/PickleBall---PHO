import React, { useState, useEffect, useMemo } from "react";
import { Swords, Calendar, Award, AlertCircle, Plus, Minus, Check, Lock } from "lucide-react";
import { recordMatch } from "../utils/db";
import { calculateSinglesElo, calculateDoublesElo } from "../utils/elo";

export default function MatchRecorder({ data, setData, setActiveTab, isAdmin, setIsAdmin }) {
  const { members, events } = data;

  // Trạng thái Form
  const [matchType, setMatchType] = useState("singles"); // singles, doubles
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [eventId, setEventId] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");

  // Trạng thái Đấu 1 set hay 3 set
  const [scoringMode, setScoringMode] = useState("single"); // single (1 set), bestOf3 (3 sets)

  // Người chơi được chọn
  const [playerA1, setPlayerA1] = useState("");
  const [playerA2, setPlayerA2] = useState("");
  const [playerB1, setPlayerB1] = useState("");
  const [playerB2, setPlayerB2] = useState("");

  // Điểm số các Set
  // format: [{a: 11, b: 9}, {a: 0, b: 0}, {a: 0, b: 0}]
  const [setsScore, setSetsScore] = useState([
    { a: 11, b: 9 },
    { a: 0, b: 0 },
    { a: 0, b: 0 }
  ]);

  // Trạng thái thông báo thành công
  const [showSuccess, setShowSuccess] = useState(false);

  // Thiết lập ngày giờ mặc định khi render
  useEffect(() => {
    const now = new Date();
    setMatchDate(now.toISOString().split("T")[0]);
    
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setMatchTime(`${hours}:${minutes}`);
  }, []);

  // Reset form khi đổi thể thức Đơn / Đôi
  useEffect(() => {
    setPlayerA1("");
    setPlayerA2("");
    setPlayerB1("");
    setPlayerB2("");
  }, [matchType]);

  // --- TỰ ĐỘNG TÍNH TOÁN KẾT QUẢ TỪ CÁC SET ---

  const matchOutcome = useMemo(() => {
    // 1. Lọc danh sách người chơi hợp lệ
    const pA1 = members.find(m => m.id === playerA1);
    const pA2 = members.find(m => m.id === playerA2);
    const pB1 = members.find(m => m.id === playerB1);
    const pB2 = members.find(m => m.id === playerB2);

    const isSinglesValid = matchType === "singles" && playerA1 && playerB1 && playerA1 !== playerB1;
    const isDoublesValid = matchType === "doubles" && 
      playerA1 && playerA2 && playerB1 && playerB2 && 
      new Set([playerA1, playerA2, playerB1, playerB2]).size === 4;

    if (!isSinglesValid && !isDoublesValid) {
      return { isValid: false, reason: "Vui lòng chọn đầy đủ và phân biệt các người chơi." };
    }

    // 2. Tính toán điểm số tổng hợp
    let finalScoreA = 0;
    let finalScoreB = 0;
    let activeSets = [];

    if (scoringMode === "single") {
      finalScoreA = setsScore[0].a;
      finalScoreB = setsScore[0].b;
      activeSets = [setsScore[0]];
      
      if (finalScoreA === finalScoreB) {
        return { isValid: false, reason: "Trận đấu Pickleball không thể có kết quả hòa." };
      }
    } else {
      // Đấu 3 set thắng 2
      let setsWonA = 0;
      let setsWonB = 0;

      // Đánh giá Set 1
      if (setsScore[0].a === setsScore[0].b) return { isValid: false, reason: "Set 1 không được có kết quả hòa." };
      setsScore[0].a > setsScore[0].b ? setsWonA++ : setsWonB++;
      activeSets.push(setsScore[0]);

      // Đánh giá Set 2
      if (setsScore[1].a === setsScore[1].b) return { isValid: false, reason: "Set 2 không được có kết quả hòa." };
      setsScore[1].a > setsScore[1].b ? setsWonA++ : setsWonB++;
      activeSets.push(setsScore[1]);

      // Đánh giá xem có cần chơi Set 3 không
      const isSet3Needed = setsWonA === 1 && setsWonB === 1;
      
      if (isSet3Needed) {
        if (setsScore[2].a === setsScore[2].b) return { isValid: false, reason: "Set 3 quyết định không được có kết quả hòa." };
        setsScore[2].a > setsScore[2].b ? setsWonA++ : setsWonB++;
        activeSets.push(setsScore[2]);
      }

      finalScoreA = setsWonA;
      finalScoreB = setsWonB;
    }

    // 3. Tính toán trước biến động ELO (LIVE PREVIEW)
    const eloPreview = {};
    if (matchType === "singles") {
      const eloA = pA1.elo;
      const eloB = pB1.elo;
      const { changeA, changeB } = calculateSinglesElo(eloA, eloB, finalScoreA, finalScoreB);
      
      eloPreview[playerA1] = { name: pA1.name, before: eloA, after: Math.max(100, eloA + changeA), change: changeA };
      eloPreview[playerB1] = { name: pB1.name, before: eloB, after: Math.max(100, eloB + changeB), change: changeB };
    } else {
      const eloA1 = pA1.elo;
      const eloA2 = pA2.elo;
      const eloB1 = pB1.elo;
      const eloB2 = pB2.elo;

      const { changeA, changeB } = calculateDoublesElo([eloA1, eloA2], [eloB1, eloB2], finalScoreA, finalScoreB);

      eloPreview[playerA1] = { name: pA1.name, before: eloA1, after: Math.max(100, eloA1 + changeA), change: changeA };
      eloPreview[playerA2] = { name: pA2.name, before: eloA2, after: Math.max(100, eloA2 + changeA), change: changeA };
      eloPreview[playerB1] = { name: pB1.name, before: eloB1, after: Math.max(100, eloB1 + changeB), change: changeB };
      eloPreview[playerB2] = { name: pB2.name, before: eloB2, after: Math.max(100, eloB2 + changeB), change: changeB };
    }

    return {
      isValid: true,
      scoreA: finalScoreA,
      scoreB: finalScoreB,
      activeSets,
      eloPreview
    };
  }, [matchType, scoringMode, playerA1, playerA2, playerB1, playerB2, setsScore, members]);

  // --- XỬ LÝ ĐIỂM SỐ CÁC SET ---

  const handleScoreChange = (setIndex, team, value) => {
    const val = parseInt(value) || 0;
    setSetsScore(prev => {
      const newScores = [...prev];
      newScores[setIndex] = {
        ...newScores[setIndex],
        [team]: val
      };
      return newScores;
    });
  };

  const handleScoreAdjust = (setIndex, team, amount) => {
    setSetsScore(prev => {
      const newScores = [...prev];
      const currentVal = newScores[setIndex][team];
      newScores[setIndex] = {
        ...newScores[setIndex],
        [team]: Math.max(0, currentVal + amount)
      };
      return newScores;
    });
  };

  // --- SUBMIT FORM ---

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!matchOutcome.isValid) return;

    const teamA = matchType === "singles" ? [playerA1] : [playerA1, playerA2];
    const teamB = matchType === "singles" ? [playerB1] : [playerB1, playerB2];
    
    // Tạo ISO timestamp hoàn chỉnh từ ngày & giờ nhập
    const isoDateTime = `${matchDate}T${matchTime}:00`;

    const updatedData = recordMatch({
      type: matchType,
      eventId,
      teamA,
      teamB,
      scoreA: matchOutcome.scoreA,
      scoreB: matchOutcome.scoreB,
      sets: matchOutcome.activeSets,
      date: isoDateTime
    });

    setData(updatedData);
    setShowSuccess(true);

    // Tự động tắt thông báo sau 3 giây và chuyển về trang tổng quan
    setTimeout(() => {
      setShowSuccess(false);
      setActiveTab("dashboard");
    }, 2500);
  };

  const handleLocalUnlock = (e) => {
    e.preventDefault();
    if (pinInput === "1234") {
      setIsAdmin(true);
      setPinInput("");
      setPinError("");
    } else {
      setPinError("Mã PIN không chính xác!");
    }
  };

  return (
    <div className="recorder-container animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        .recorder-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .recorder-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }

        .recorder-title {
          font-size: 1.75rem;
          font-weight: 800;
        }

        .recorder-title svg {
          color: var(--accent-neon-green);
        }

        .recorder-panel {
          padding: 32px;
        }

        .recorder-meta-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        /* Toggle Thể thức */
        .type-toggle-container {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 24px;
        }

        .type-toggle-btn {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
          font-family: var(--font-primary);
        }

        .type-toggle-btn.active {
          background: rgba(255, 255, 255, 0.05);
          color: var(--accent-neon-green);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        /* Lựa chọn Người chơi */
        .team-selection-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin-bottom: 28px;
        }

        .team-side-panel {
          padding: 20px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 12px;
        }

        .team-side-title {
          font-weight: 700;
          font-size: 0.95rem;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .team-a-title { color: var(--accent-electric-blue); }
        .team-b-title { color: var(--accent-neon-green); }

        /* Chọn điểm các set */
        .sets-score-section {
          background: rgba(0,0,0,0.15);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 28px;
        }

        .set-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 14px;
        }

        .set-row:last-child {
          margin-bottom: 0;
        }

        .set-label {
          width: 60px;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .score-counter-container {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .score-input-mini {
          width: 54px;
          text-align: center;
          font-size: 1.15rem;
          font-weight: 800;
        }

        .btn-score-adjust {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.03);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .btn-score-adjust:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
        }

        /* ELO PREVIEW BOX */
        .elo-preview-panel {
          background: rgba(212, 252, 52, 0.03);
          border: 1px solid rgba(212, 252, 52, 0.12);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 28px;
        }

        .elo-preview-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--accent-neon-green);
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .elo-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }

        .elo-preview-card {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .preview-player-name {
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preview-elo-flow {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .preview-elo-diff {
          font-size: 0.95rem;
          font-weight: 800;
        }

        .preview-diff-up { color: var(--color-success); }
        .preview-diff-down { color: var(--color-danger); }

        .invalid-alert-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 16px;
          background: rgba(255, 71, 87, 0.08);
          border: 1px solid rgba(255, 71, 87, 0.15);
          color: var(--color-danger);
          border-radius: 8px;
          font-size: 0.88rem;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        /* Màn hình thông báo thành công */
        .success-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(8, 9, 13, 0.9);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .success-card {
          text-align: center;
          max-width: 400px;
          padding: 40px 32px;
          animation: slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .success-icon-circle {
          width: 72px;
          height: 72px;
          background: var(--accent-neon-green);
          color: #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px auto;
          box-shadow: 0 0 25px var(--accent-neon-green-glow-strong);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .team-selection-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .recorder-panel {
            padding: 16px;
          }
          .recorder-meta-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .btn-score-adjust {
            width: 38px !important;
            height: 38px !important;
            border-radius: 8px;
          }
          .score-input-mini {
            width: 60px !important;
            height: 38px !important;
            font-size: 1.3rem !important;
          }
          .set-row {
            gap: 12px;
          }
        }

        /* CSS MÀN HÌNH KHÓA GHI ĐIỂM */
        .recorder-lock-card {
          max-width: 450px;
          margin: 40px auto 0 auto;
          padding: 40px 32px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .recorder-lock-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(212, 252, 52, 0.08);
          border: 1px solid rgba(212, 252, 52, 0.15);
          color: var(--accent-neon-green);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(212, 252, 52, 0.15);
          animation: pulseGreen 2s infinite;
        }

        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(212, 252, 52, 0.3); }
          70% { box-shadow: 0 0 0 10px rgba(212, 252, 52, 0); }
          100% { box-shadow: 0 0 0 0 rgba(212, 252, 52, 0); }
        }

        .recorder-lock-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: #fff;
        }

        .recorder-lock-desc {
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .recorder-pin-input-group {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 8px;
        }

        .recorder-pin-input {
          text-align: center;
          font-size: 1.1rem;
          letter-spacing: 0.15em;
          height: 44px;
        }

        .recorder-pin-error {
          color: var(--color-danger);
          font-size: 0.8rem;
          font-weight: 600;
          margin-top: -4px;
        }
      `}} />

      {/* THÀNH CÔNG OVERLAY */}
      {showSuccess && (
        <div className="success-overlay">
          <div className="glass-panel success-card glow-border-green">
            <div className="success-icon-circle">
              <Check size={36} strokeWidth={3} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#fff", marginBottom: "10px" }}>Ghi Nhận Thành Công!</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Kết quả trận đấu đã được lưu. Bảng xếp hạng Elo của các người chơi đã tự động cập nhật ngay lập tức.
            </p>
          </div>
        </div>
      )}

      <div className="recorder-header">
        <Swords size={28} />
        <h1 className="recorder-title">Ghi Nhận Trận Đấu Mới</h1>
      </div>

      {!isAdmin ? (
        <div className="glass-panel recorder-lock-card glow-border-green animate-slide-up">
          <div className="recorder-lock-icon-wrapper">
            <Lock size={28} />
          </div>
          <div>
            <h2 className="recorder-lock-title">Tính Năng Hạn Chế</h2>
            <p className="recorder-lock-desc">
              Ghi điểm và cập nhật Elo chỉ dành cho Ban Tổ Chức (BTC) của CLB.
              Vui lòng nhập mã PIN bảo mật để tiếp tục.
            </p>
          </div>

          <form onSubmit={handleLocalUnlock} className="recorder-pin-input-group">
            <input 
              type="password" 
              maxLength={8}
              className="form-input recorder-pin-input" 
              placeholder="Mã PIN (Mặc định: 1234)" 
              value={pinInput}
              onChange={e => {
                setPinInput(e.target.value);
                setPinError("");
              }}
              autoFocus
            />
            {pinError && <div className="recorder-pin-error">{pinError}</div>}
            
            <button type="submit" className="btn-neon-green" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}>
              Mở khóa Ghi điểm
            </button>
          </form>
        </div>
      ) : (
        <div className="glass-panel recorder-panel">
          <form onSubmit={handleSubmit}>
            {/* Chọn thể thức Đơn hoặc Đôi */}
            <div className="type-toggle-container">
              <button 
                type="button" 
                className={`type-toggle-btn ${matchType === "singles" ? "active" : ""}`}
                onClick={() => setMatchType("singles")}
              >
                Đánh Đơn (1v1)
              </button>
              <button 
                type="button" 
                className={`type-toggle-btn ${matchType === "doubles" ? "active" : ""}`}
                onClick={() => setMatchType("doubles")}
              >
                Đánh Đôi (2v2)
              </button>
            </div>

            {/* Chọn Sự kiện & Ngày giờ */}
            <div className="recorder-meta-grid">
              <div>
                <label className="form-label">Sự kiện / Giải đấu</label>
                <select className="form-select" value={eventId} onChange={e => setEventId(e.target.value)}>
                  <option value="">Giao lưu tự do (Không tính giải)</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Ngày chơi</label>
                <input type="date" className="form-input" value={matchDate} onChange={e => setMatchDate(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">Giờ chơi</label>
                <input type="time" className="form-input" value={matchTime} onChange={e => setMatchTime(e.target.value)} required />
              </div>
            </div>

            {/* Chọn Đội / Người chơi */}
            <div className="team-selection-grid">
              {/* Đội A */}
              <div className="team-side-panel">
                <h3 className="team-side-title team-a-title">
                  🔵 Đội A {matchType === "doubles" && "(Cặp đôi A)"}
                </h3>
                
                <div style={{ marginBottom: matchType === "doubles" ? "12px" : 0 }}>
                  <label className="form-label">Người chơi A1 *</label>
                  <select className="form-select" value={playerA1} onChange={e => setPlayerA1(e.target.value)} required>
                    <option value="">-- Chọn thành viên --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.elo} Elo)</option>
                    ))}
                  </select>
                </div>

                {matchType === "doubles" && (
                  <div>
                    <label className="form-label">Người chơi A2 *</label>
                    <select className="form-select" value={playerA2} onChange={e => setPlayerA2(e.target.value)} required>
                      <option value="">-- Chọn thành viên --</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.elo} Elo)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Đội B */}
              <div className="team-side-panel">
                <h3 className="team-side-title team-b-title">
                  🟢 Đội B {matchType === "doubles" && "(Cặp đôi B)"}
                </h3>

                <div style={{ marginBottom: matchType === "doubles" ? "12px" : 0 }}>
                  <label className="form-label">Người chơi B1 *</label>
                  <select className="form-select" value={playerB1} onChange={e => setPlayerB1(e.target.value)} required>
                    <option value="">-- Chọn thành viên --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.elo} Elo)</option>
                    ))}
                  </select>
                </div>

                {matchType === "doubles" && (
                  <div>
                    <label className="form-label">Người chơi B2 *</label>
                    <select className="form-select" value={playerB2} onChange={e => setPlayerB2(e.target.value)} required>
                      <option value="">-- Chọn thành viên --</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.elo} Elo)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Thiết lập kiểu tính điểm Set */}
            <div style={{ marginBottom: "16px" }}>
              <label className="form-label">Phương thức chấm điểm</label>
              <div style={{ display: "flex", gap: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem" }}>
                  <input 
                    type="radio" 
                    name="scoringMode" 
                    value="single" 
                    checked={scoringMode === "single"} 
                    onChange={() => setScoringMode("single")} 
                  />
                  1 Set chạm điểm (VD: chạm 11 hoặc 15)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.9rem" }}>
                  <input 
                    type="radio" 
                    name="scoringMode" 
                    value="bestOf3" 
                    checked={scoringMode === "bestOf3"} 
                    onChange={() => setScoringMode("bestOf3")} 
                  />
                  Đấu 3 Set thắng 2 (Best of 3)
                </label>
              </div>
            </div>

            {/* NHẬP ĐIỂM SỐ CÁC SET */}
            <div className="sets-score-section">
              <h3 className="team-side-title" style={{ justifyContent: "center", color: "#fff", marginBottom: "16px" }}>
                Nhập Điểm Số Các Set Đấu
              </h3>

              {/* Set 1 */}
              <div className="set-row">
                <span className="set-label">Set 1</span>
                
                {/* Điểm đội A */}
                <div className="score-counter-container">
                  <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(0, "a", -1)}><Minus size={12} /></button>
                  <input 
                    type="number" 
                    className="form-input score-input-mini" 
                    value={setsScore[0].a} 
                    onChange={(e) => handleScoreChange(0, "a", e.target.value)} 
                    min="0"
                  />
                  <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(0, "a", 1)}><Plus size={12} /></button>
                </div>

                <span style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-muted)" }}>:</span>

                {/* Điểm đội B */}
                <div className="score-counter-container">
                  <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(0, "b", -1)}><Minus size={12} /></button>
                  <input 
                    type="number" 
                    className="form-input score-input-mini" 
                    value={setsScore[0].b} 
                    onChange={(e) => handleScoreChange(0, "b", e.target.value)} 
                    min="0"
                  />
                  <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(0, "b", 1)}><Plus size={12} /></button>
                </div>
              </div>

              {/* Set 2 (Hiển thị nếu chọn Đấu 3 Set) */}
              {scoringMode === "bestOf3" && (
                <div className="set-row">
                  <span className="set-label">Set 2</span>
                  <div className="score-counter-container">
                    <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(1, "a", -1)}><Minus size={12} /></button>
                    <input 
                      type="number" 
                      className="form-input score-input-mini" 
                      value={setsScore[1].a} 
                      onChange={(e) => handleScoreChange(1, "a", e.target.value)} 
                      min="0"
                    />
                    <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(1, "a", 1)}><Plus size={12} /></button>
                  </div>
                  <span style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-muted)" }}>:</span>
                  <div className="score-counter-container">
                    <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(1, "b", -1)}><Minus size={12} /></button>
                    <input 
                      type="number" 
                      className="form-input score-input-mini" 
                      value={setsScore[1].b} 
                      onChange={(e) => handleScoreChange(1, "b", e.target.value)} 
                      min="0"
                    />
                    <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(1, "b", 1)}><Plus size={12} /></button>
                  </div>
                </div>
              )}

              {/* Set 3 (Hiển thị nếu chọn Đấu 3 Set và hai set đầu hòa nhau 1-1) */}
              {scoringMode === "bestOf3" && (
                <div className="set-row">
                  <span className="set-label">Set 3 *</span>
                  <div className="score-counter-container">
                    <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(2, "a", -1)}><Minus size={12} /></button>
                    <input 
                      type="number" 
                      className="form-input score-input-mini" 
                      value={setsScore[2].a} 
                      onChange={(e) => handleScoreChange(2, "a", e.target.value)} 
                      min="0"
                    />
                    <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(2, "a", 1)}><Plus size={12} /></button>
                  </div>
                  <span style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-muted)" }}>:</span>
                  <div className="score-counter-container">
                    <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(2, "b", -1)}><Minus size={12} /></button>
                    <input 
                      type="number" 
                      className="form-input score-input-mini" 
                      value={setsScore[2].b} 
                      onChange={(e) => handleScoreChange(2, "b", e.target.value)} 
                      min="0"
                    />
                    <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(2, "b", 1)}><Plus size={12} /></button>
                  </div>
                </div>
              )}
              
              {scoringMode === "bestOf3" && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "12px" }}>
                  * Note: Set 3 chỉ tự động tính nếu kết quả Set 1 và Set 2 là hòa nhau 1 - 1.
                </div>
              )}
            </div>

            {/* DỮ LIỆU LIVE ELO PREVIEW HOẶC THÔNG BÁO LỖI */}
            {matchOutcome.isValid ? (
              <div className="elo-preview-panel glow-border-green animate-slide-up">
                <h4 className="elo-preview-title">
                  <Award size={16} /> Live Elo Preview (Ước lượng biến động Elo)
                </h4>
                <div className="elo-preview-grid">
                  {Object.entries(matchOutcome.eloPreview).map(([id, info]) => (
                    <div key={id} className="elo-preview-card">
                      <span className="preview-player-name">{info.name}</span>
                      <span className="preview-elo-flow">
                        {info.before} → <span style={{ color: "#fff", fontWeight: "600" }}>{info.after}</span>
                      </span>
                      <span className={`preview-elo-diff ${info.change > 0 ? "preview-diff-up" : "preview-diff-down"}`}>
                        {info.change > 0 ? `+${info.change}` : info.change} Elo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="invalid-alert-box animate-slide-up">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{matchOutcome.reason}</span>
              </div>
            )}

            {/* Nút hành động */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px" }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab("dashboard")}>Hủy bỏ</button>
              <button 
                type="submit" 
                className="btn-neon-green" 
                disabled={!matchOutcome.isValid}
                style={{ opacity: matchOutcome.isValid ? 1 : 0.4, cursor: matchOutcome.isValid ? "pointer" : "not-allowed" }}
              >
                <Swords size={18} /> Lưu trận đấu & Cập nhật ELO
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
