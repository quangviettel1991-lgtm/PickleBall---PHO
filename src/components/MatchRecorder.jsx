import React, { useState, useEffect, useMemo } from "react";
import { Swords, Calendar, Award, AlertCircle, Plus, Minus, Check, Lock, Search, Trash2, Edit2, X } from "lucide-react";
import { recordMatch, updateMatch, deleteMatch, deleteMatches } from "../utils/db";
import { calculateSinglesElo, calculateDoublesElo } from "../utils/elo";

const CLUB_NAME = import.meta.env.VITE_CLUB_NAME || "PICKLEBALL PHỞ";

export default function MatchRecorder({ data, setData, setActiveTab, isAdmin, setIsAdmin, subTab: externalSubTab, setSubTab: externalSetSubTab }) {
  const { members, events } = data;

  // Điều hướng sub-tabs: record (Ghi trận mới), history (Lịch sử đấu)
  const [localSubTab, setLocalSubTab] = useState("record");
  const subTab = externalSubTab !== undefined ? externalSubTab : localSubTab;
  const setSubTab = externalSetSubTab !== undefined ? externalSetSubTab : setLocalSubTab;

  // Trạng thái hiệu chỉnh trận đấu
  const [editingMatchId, setEditingMatchId] = useState(null);

  // Trạng thái Bộ lọc & Tìm kiếm Lịch sử đấu
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [filterType, setFilterType] = useState("");

  // Trạng thái Form Ghi điểm
  const [matchType, setMatchType] = useState("doubles"); // singles, doubles
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [eventId, setEventId] = useState("");
  const [hasUserSelectedEvent, setHasUserSelectedEvent] = useState(false);
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
  const [setsScore, setSetsScore] = useState([
    { a: 0, b: 0 },
    { a: 0, b: 0 },
    { a: 0, b: 0 }
  ]);

  // Trạng thái thông báo thành công
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Trạng thái chọn nhiều trận để xóa
  const [selectedMatchIds, setSelectedMatchIds] = useState([]);

  // Reset việc chọn trận khi đổi tab hoặc đổi bộ lọc
  useEffect(() => {
    setSelectedMatchIds([]);
  }, [subTab, filterEvent, filterType, searchQuery]);

  // Thiết lập ngày giờ mặc định khi render
  useEffect(() => {
    const now = new Date();
    setMatchDate(now.toISOString().split("T")[0]);
    
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setMatchTime(`${hours}:${minutes}`);
  }, []);

  // Tự động chọn sự kiện mới nhất khi danh sách sự kiện được tải hoặc thay đổi,
  // chỉ khi người dùng chưa chủ động chọn thủ công sự kiện khác.
  useEffect(() => {
    if (events && events.length > 0 && !hasUserSelectedEvent && !editingMatchId) {
      const getVal = (item) => {
        if (item.id && item.id.includes("_")) {
          return parseInt(item.id.split("_")[1]) || 0;
        }
        return parseInt(item?.id?.replace(/\D/g, "")) || 0;
      };
      const sorted = [...events].sort((a, b) => {
        const valA = getVal(a);
        const valB = getVal(b);
        if (valB !== valA) return valB - valA;
        return new Date(b.date || 0) - new Date(a.date || 0);
      });
      const latestId = sorted[0]?.id || "";
      if (latestId && eventId !== latestId) {
        setEventId(latestId);
      }
    }
  }, [events, hasUserSelectedEvent, editingMatchId, eventId]);

  // Reset form khi đổi thể thức Đơn / Đôi
  useEffect(() => {
    if (!editingMatchId) {
      setPlayerA1("");
      setPlayerA2("");
      setPlayerB1("");
      setPlayerB2("");
    }
  }, [matchType, editingMatchId]);

  // --- HÀM TRỢ GIÚP DỮ LIỆU ---

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

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // --- LỌC VÀ TÌM KIẾM TRẬN ĐẤU ---

  const filteredMatches = useMemo(() => {
    if (!data.matches) return [];
    
    let result = [...data.matches].sort((a, b) => new Date(b.date) - new Date(a.date));

    // 1. Lọc theo Sự kiện
    if (filterEvent !== "") {
      result = result.filter(m => m.eventId === filterEvent);
    }

    // 2. Lọc theo Thể thức
    if (filterType !== "") {
      result = result.filter(m => m.type === filterType);
    }

    // 3. Tìm kiếm theo tên người chơi (Không dấu & case-insensitive)
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      
      const getMemberNameLower = (id) => {
        const m = members.find(member => member.id === id);
        return m ? m.name.toLowerCase() : "";
      };

      result = result.filter(m => {
        const teamANames = m.teamA.map(id => getMemberNameLower(id));
        const teamBNames = m.teamB.map(id => getMemberNameLower(id));
        
        return teamANames.some(name => name.includes(q)) || 
               teamBNames.some(name => name.includes(q));
      });
    }

    return result;
  }, [data.matches, filterEvent, filterType, searchQuery, members]);

  // --- DỌN SẠCH FORM ---

  const clearForm = () => {
    setMatchType("doubles");
    setHasUserSelectedEvent(false);
    
    // Tìm sự kiện mới nhất để làm mặc định
    let latestId = "";
    if (events && events.length > 0) {
      const getVal = (item) => {
        if (item.id && item.id.includes("_")) {
          return parseInt(item.id.split("_")[1]) || 0;
        }
        return parseInt(item?.id?.replace(/\D/g, "")) || 0;
      };
      const sorted = [...events].sort((a, b) => {
        const valA = getVal(a);
        const valB = getVal(b);
        if (valB !== valA) return valB - valA;
        return new Date(b.date || 0) - new Date(a.date || 0);
      });
      latestId = sorted[0]?.id || "";
    }
    setEventId(latestId);
    
    const now = new Date();
    setMatchDate(now.toISOString().split("T")[0]);
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setMatchTime(`${hours}:${minutes}`);
    setScoringMode("single");
    setPlayerA1("");
    setPlayerA2("");
    setPlayerB1("");
    setPlayerB2("");
    setSetsScore([
      { a: 0, b: 0 },
      { a: 0, b: 0 },
      { a: 0, b: 0 }
    ]);
    setEditingMatchId(null);
  };

  const isMatchEventLocked = (match) => {
    if (!match.eventId) return false;
    const event = events.find(e => e.id === match.eventId);
    return event?.isLocked || false;
  };

  // --- XỬ LÝ SỬA & XÓA ---

  const handleEditClick = (match) => {
    if (isMatchEventLocked(match)) {
      alert("Trận đấu này thuộc sự kiện đã bị khóa. Không thể chỉnh sửa.");
      return;
    }
    setEditingMatchId(match.id);
    setMatchType(match.type);
    setEventId(match.eventId || "");
    setHasUserSelectedEvent(true);
    
    if (match.date) {
      const parts = match.date.split("T");
      setMatchDate(parts[0]);
      if (parts[1]) {
        setMatchTime(parts[1].slice(0, 5));
      }
    }
    
    if (match.sets && match.sets.length > 1) {
      setScoringMode("bestOf3");
    } else {
      setScoringMode("single");
    }

    if (match.type === "singles") {
      setPlayerA1(match.teamA[0] || "");
      setPlayerB1(match.teamB[0] || "");
      setPlayerA2("");
      setPlayerB2("");
    } else {
      setPlayerA1(match.teamA[0] || "");
      setPlayerA2(match.teamA[1] || "");
      setPlayerB1(match.teamB[0] || "");
      setPlayerB2(match.teamB[1] || "");
    }

    const tempScores = [
      { a: 0, b: 0 },
      { a: 0, b: 0 },
      { a: 0, b: 0 }
    ];
    if (match.sets) {
      match.sets.forEach((set, idx) => {
        if (idx < 3) {
          tempScores[idx] = { a: set.a, b: set.b };
        }
      });
    }
    setSetsScore(tempScores);

    setSubTab("record");
  };

  const handleDeleteClick = (matchId) => {
    const match = data.matches?.find(m => m.id === matchId);
    if (match && isMatchEventLocked(match)) {
      alert("Trận đấu này thuộc sự kiện đã bị khóa. Không thể xóa.");
      return;
    }

    if (window.confirm("Bạn có chắc chắn muốn xóa trận đấu này không? Hệ thống sẽ tự động tính toán lại toàn bộ lịch sử điểm Elo của tất cả thành viên liên quan để đảm bảo tính nhất quán tuyệt đối.")) {
      const updatedData = deleteMatch(matchId);
      setData(updatedData);
      
      setSuccessMessage("Đã Xóa Trận Đấu!");
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage("");
      }, 2000);
    }
  };

  const handleSelectMatch = (matchId, checked) => {
    setSelectedMatchIds(prev => {
      if (checked) {
        return [...prev, matchId];
      } else {
        return prev.filter(id => id !== matchId);
      }
    });
  };

  const handleSelectAllMatches = (checked) => {
    if (checked) {
      const filteredIds = filteredMatches.map(m => m.id);
      setSelectedMatchIds(filteredIds);
    } else {
      setSelectedMatchIds([]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedMatchIds.length === 0) return;
    
    // Kiểm tra xem có trận nào thuộc sự kiện bị khóa không
    const hasLockedMatch = selectedMatchIds.some(id => {
      const match = data.matches?.find(m => m.id === id);
      return match && isMatchEventLocked(match);
    });

    if (hasLockedMatch) {
      alert("Một hoặc nhiều trận đấu đã chọn thuộc sự kiện đã bị khóa. Không thể xóa hàng loạt.");
      return;
    }
    
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedMatchIds.length} trận đấu đã chọn không? Hệ thống sẽ tự động tính toán lại toàn bộ lịch sử Elo của tất cả thành viên liên quan từ ban đầu để bảo đảm sự nhất quán toán học tuyệt đối.`)) {
      const updatedData = deleteMatches(selectedMatchIds);
      setData(updatedData);
      setSelectedMatchIds([]);
      
      setSuccessMessage(`Đã Xóa ${selectedMatchIds.length} Trận Đấu!`);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage("");
      }, 2500);
    }
  };

  const handleCancelEdit = () => {
    clearForm();
    setSubTab("history");
  };

  // --- TỰ ĐỘNG TÍNH TOÁN KẾT QUẢ TỪ CÁC SET ---

  const matchOutcome = useMemo(() => {
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

    const sanitizedSetsScore = setsScore.map(s => ({
      a: s.a === "" ? 0 : (parseInt(s.a, 10) || 0),
      b: s.b === "" ? 0 : (parseInt(s.b, 10) || 0)
    }));

    let finalScoreA = 0;
    let finalScoreB = 0;
    let activeSets = [];

    if (scoringMode === "single") {
      finalScoreA = sanitizedSetsScore[0].a;
      finalScoreB = sanitizedSetsScore[0].b;
      activeSets = [sanitizedSetsScore[0]];
      
      if (finalScoreA === finalScoreB) {
        return { isValid: false, reason: "Trận đấu Pickleball không thể có kết quả hòa." };
      }
    } else {
      let setsWonA = 0;
      let setsWonB = 0;

      // Set 1
      if (sanitizedSetsScore[0].a === sanitizedSetsScore[0].b) return { isValid: false, reason: "Set 1 không được có kết quả hòa." };
      sanitizedSetsScore[0].a > sanitizedSetsScore[0].b ? setsWonA++ : setsWonB++;
      activeSets.push(sanitizedSetsScore[0]);

      // Set 2
      if (sanitizedSetsScore[1].a === sanitizedSetsScore[1].b) return { isValid: false, reason: "Set 2 không được có kết quả hòa." };
      sanitizedSetsScore[1].a > sanitizedSetsScore[1].b ? setsWonA++ : setsWonB++;
      activeSets.push(sanitizedSetsScore[1]);

      // Có cần Set 3 không
      const isSet3Needed = setsWonA === 1 && setsWonB === 1;
      
      if (isSet3Needed) {
        if (sanitizedSetsScore[2].a === sanitizedSetsScore[2].b) return { isValid: false, reason: "Set 3 quyết định không được có kết quả hòa." };
        sanitizedSetsScore[2].a > sanitizedSetsScore[2].b ? setsWonA++ : setsWonB++;
        activeSets.push(sanitizedSetsScore[2]);
      }

      finalScoreA = setsWonA;
      finalScoreB = setsWonB;
    }

    const eloPreview = {};
    if (matchType === "singles") {
      const eloA = pA1.eloSingles !== undefined ? pA1.eloSingles : pA1.elo;
      const eloB = pB1.eloSingles !== undefined ? pB1.eloSingles : pB1.elo;
      const { changeA, changeB } = calculateSinglesElo(eloA, eloB, finalScoreA, finalScoreB);
      
      eloPreview[playerA1] = { name: pA1.name, before: eloA, after: Math.max(100, eloA + changeA), change: changeA };
      eloPreview[playerB1] = { name: pB1.name, before: eloB, after: Math.max(100, eloB + changeB), change: changeB };
    } else {
      const eloA1 = pA1.eloDoubles !== undefined ? pA1.eloDoubles : pA1.elo;
      const eloA2 = pA2.eloDoubles !== undefined ? pA2.eloDoubles : pA2.elo;
      const eloB1 = pB1.eloDoubles !== undefined ? pB1.eloDoubles : pB1.elo;
      const eloB2 = pB2.eloDoubles !== undefined ? pB2.eloDoubles : pB2.elo;

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

  // --- XỬ LÝ ĐIỂM SỐ ---

  const handleScoreChange = (setIndex, team, value) => {
    if (value === "") {
      setSetsScore(prev => {
        const newScores = [...prev];
        newScores[setIndex] = {
          ...newScores[setIndex],
          [team]: ""
        };
        return newScores;
      });
      return;
    }

    const val = parseInt(value, 10);
    if (!isNaN(val)) {
      setSetsScore(prev => {
        const newScores = [...prev];
        newScores[setIndex] = {
          ...newScores[setIndex],
          [team]: val
        };
        return newScores;
      });
    }
  };

  const handleScoreAdjust = (setIndex, team, amount) => {
    setSetsScore(prev => {
      const newScores = [...prev];
      const val = prev[setIndex][team];
      const currentVal = val === "" ? 0 : (parseInt(val, 10) || 0);
      newScores[setIndex] = {
        ...newScores[setIndex],
        [team]: Math.max(0, currentVal + amount)
      };
      return newScores;
    });
  };

  const handleInputFocus = (e) => {
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  };

  // --- SUBMIT FORM ---

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!matchOutcome.isValid) return;

    // Kiểm tra xem sự kiện có bị khóa không
    const targetEventId = eventId || "";
    const targetEvent = events.find(ev => ev.id === targetEventId);
    if (targetEvent?.isLocked) {
      alert("Sự kiện này đã bị khóa. Không thể tạo mới hoặc cập nhật trận đấu.");
      return;
    }

    // Nếu đang sửa trận đấu, kiểm tra xem trận cũ có thuộc sự kiện bị khóa không
    if (editingMatchId) {
      const oldMatch = data.matches?.find(m => m.id === editingMatchId);
      if (oldMatch && isMatchEventLocked(oldMatch)) {
        alert("Trận đấu này thuộc sự kiện đã bị khóa. Không thể chỉnh sửa.");
        return;
      }
    }

    const teamA = matchType === "singles" ? [playerA1] : [playerA1, playerA2];
    const teamB = matchType === "singles" ? [playerB1] : [playerB1, playerB2];
    
    const isoDateTime = `${matchDate}T${matchTime}:00`;

    let updatedData;
    if (editingMatchId) {
      updatedData = updateMatch({
        id: editingMatchId,
        type: matchType,
        eventId,
        teamA,
        teamB,
        scoreA: matchOutcome.scoreA,
        scoreB: matchOutcome.scoreB,
        sets: matchOutcome.activeSets,
        date: isoDateTime
      });
      setSuccessMessage("Đã Cập Nhật Trận Đấu!");
    } else {
      updatedData = recordMatch({
        type: matchType,
        eventId,
        teamA,
        teamB,
        scoreA: matchOutcome.scoreA,
        scoreB: matchOutcome.scoreB,
        sets: matchOutcome.activeSets,
        date: isoDateTime
      });
      setSuccessMessage("Ghi Nhận Thành Công!");
    }

    setData(updatedData);
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
      setSuccessMessage("");
      clearForm();
      setSubTab("history"); // Quay lại tab lịch sử đấu
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
          max-width: 860px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .recorder-header-main {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .recorder-title {
          font-size: 1.75rem;
          font-weight: 800;
        }

        .recorder-title svg {
          color: var(--accent-neon-green);
        }

        /* Sub tabs */
        .subtabs-container {
          display: flex;
          gap: 10px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 10px;
        }

        .subtab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-primary);
          font-size: 0.92rem;
        }

        .subtab-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.02);
        }

        .subtab-btn.active {
          color: var(--accent-neon-green);
          background: rgba(212, 252, 52, 0.05);
          border-color: rgba(212, 252, 52, 0.15);
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
          margin-bottom: 16px;
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
          gap: 8px;
        }

        .score-input-mini {
          width: 80px;
          height: 48px;
          text-align: center;
          font-size: 1.5rem;
          font-weight: 800;
          border-radius: 8px;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          color: #fff;
          font-family: var(--font-primary);
        }

        .score-input-mini:focus {
          border-color: var(--accent-neon-green);
          outline: none;
          box-shadow: 0 0 10px rgba(212, 252, 52, 0.2);
        }

        .btn-score-adjust {
          width: 38px;
          height: 38px;
          border-radius: 8px;
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

        /* Success Overlay */
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

        /* --- STYLES CHO PHẦN LỊCH SỬ ĐẤU --- */
        .history-filters {
          display: grid;
          grid-template-columns: 2fr 1.2fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
        }

        .form-input-search {
          padding-left: 42px !important;
        }

        .match-list-history {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .match-row-item {
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .match-row-item:hover {
          background: rgba(255, 255, 255, 0.035);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .match-info-side {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 150px;
        }

        .match-event-tag {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          display: inline-block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 170px;
        }

        .match-type-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
          white-space: nowrap;
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
          gap: 20px;
          flex-grow: 1;
          justify-content: center;
        }

        .match-team {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 40%;
        }

        .match-team-a {
          justify-content: flex-end;
          text-align: right;
        }

        .match-team-b {
          justify-content: flex-start;
          text-align: left;
        }

        .match-team-players {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .match-player-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
        }

        .player-avatars-group {
          display: flex;
          gap: 4px;
        }

        .player-avatar-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: #000;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .match-score-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .match-score-pill {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 6px 16px;
          font-weight: 800;
          font-size: 1.15rem;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }

        .score-winner { color: var(--accent-neon-green); text-shadow: 0 0 10px rgba(212, 252, 52, 0.2); }
        .score-loser { color: var(--text-secondary); }

        .match-sets-detail {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .match-elo-exchanges {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
          min-width: 120px;
          font-size: 0.75rem;
          border-left: 1px solid var(--border-color);
          padding-left: 16px;
        }

        .elo-change-row {
          display: flex;
          justify-content: space-between;
          width: 100%;
          gap: 8px;
        }

        .elo-change-name {
          color: var(--text-muted);
          max-width: 70px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .elo-change-value {
          font-weight: 700;
        }
        .elo-up { color: var(--color-success); }
        .elo-down { color: var(--color-danger); }

        .match-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          border-left: 1px solid var(--border-color);
          padding-left: 16px;
        }

        .btn-action-edit, .btn-action-delete {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .btn-action-edit:hover {
          color: var(--accent-electric-blue);
          background: rgba(0, 236, 255, 0.08);
          border-color: rgba(0, 236, 255, 0.2);
          box-shadow: 0 0 10px rgba(0, 236, 255, 0.15);
        }

        .btn-action-delete:hover {
          color: var(--color-danger);
          background: rgba(255, 71, 87, 0.08);
          border-color: rgba(255, 71, 87, 0.2);
          box-shadow: 0 0 10px rgba(255, 71, 87, 0.15);
        }

        /* Banner đang chỉnh sửa */
        .editing-banner {
          background: linear-gradient(90deg, rgba(0, 236, 255, 0.08) 0%, rgba(212, 252, 52, 0.02) 100%);
          border: 1px dashed var(--accent-electric-blue);
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .editing-banner-text {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: var(--accent-electric-blue);
          font-size: 0.95rem;
        }

        .btn-cancel-edit {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel-edit:hover {
          background: rgba(255, 71, 87, 0.1);
          border-color: rgba(255, 71, 87, 0.2);
          color: var(--color-danger);
        }

        /* Styles cho Checkbox tự chọn và Xoá nhiều trận */
        .match-checkbox-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding-right: 12px;
          border-right: 1px solid var(--border-color);
          margin-right: -4px;
          height: 38px;
        }

        .custom-checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
          position: relative;
        }

        .custom-checkbox-input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        .custom-checkbox-box {
          height: 20px;
          width: 20px;
          background-color: rgba(255, 255, 255, 0.03);
          border: 1.5px solid var(--border-color);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }

        .custom-checkbox-label:hover .custom-checkbox-input ~ .custom-checkbox-box {
          border-color: var(--accent-neon-green);
          background-color: rgba(212, 252, 52, 0.05);
        }

        .custom-checkbox-input:checked ~ .custom-checkbox-box {
          background-color: var(--accent-neon-green);
          border-color: var(--accent-neon-green);
          box-shadow: 0 0 10px var(--accent-neon-green-glow);
        }

        .custom-checkbox-box::after {
          content: "";
          display: none;
          width: 5px;
          height: 10px;
          border: solid #000;
          border-width: 0 2.5px 2.5px 0;
          transform: rotate(45deg);
          margin-bottom: 2px;
        }

        .custom-checkbox-input:checked ~ .custom-checkbox-box::after {
          display: block;
        }

        .bulk-delete-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(18, 22, 32, 0.5);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 14px 20px;
          margin-bottom: 20px;
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
        }

        .bulk-delete-bar-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .bulk-delete-info {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-secondary);
          border-left: 1px solid var(--border-color);
          padding-left: 16px;
        }

        .bulk-delete-info span {
          color: var(--accent-neon-green);
          font-weight: 800;
          font-size: 1.05rem;
          text-shadow: 0 0 10px var(--accent-neon-green-glow);
        }

        .btn-bulk-delete {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          background: rgba(255, 71, 87, 0.1);
          border: 1px solid rgba(255, 71, 87, 0.25);
          border-radius: 8px;
          color: var(--color-danger);
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-primary);
        }

        .btn-bulk-delete:hover {
          background: var(--color-danger);
          color: #fff;
          box-shadow: 0 0 15px rgba(255, 71, 87, 0.4);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .recorder-container {
            padding-bottom: 250px !important;
          }
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
            width: 44px !important;
            height: 44px !important;
            border-radius: 10px;
          }
          .score-input-mini {
            width: 84px !important;
            height: 44px !important;
            font-size: 1.6rem !important;
          }
          .set-row {
            gap: 12px;
          }

          /* Mobile History */
          .match-checkbox-container {
            border-right: none;
            padding-right: 0;
            margin-right: 0;
            justify-content: flex-start;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            height: auto;
          }

          .history-filters {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .match-row-item {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
            padding: 16px;
          }

          .match-info-side {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            padding-bottom: 10px;
            min-width: 100%;
          }

          .match-teams-score {
            justify-content: space-between;
            width: 100%;
            gap: 8px;
          }

          .match-team {
            width: 38%;
            gap: 6px;
          }

          .match-team-a {
            flex-direction: column-reverse;
            align-items: flex-end;
          }

          .match-team-b {
            flex-direction: column;
            align-items: flex-start;
          }

          .match-player-name {
            font-size: 0.8rem;
          }

          .match-score-pill {
            padding: 4px 12px;
            font-size: 0.95rem;
          }

          .match-elo-exchanges {
            border-left: none;
            border-top: 1px solid rgba(255,255,255,0.05);
            padding-left: 0;
            padding-top: 10px;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 8px 12px;
            min-width: 100%;
          }

          .elo-change-row {
            width: auto;
          }

          .match-actions {
            border-left: none;
            border-top: 1px solid rgba(255,255,255,0.05);
            padding-left: 0;
            padding-top: 10px;
            justify-content: flex-end;
            min-width: 100%;
          }
        }
      `}} />

      {/* THÀNH CÔNG OVERLAY */}
      {showSuccess && (
        <div className="success-overlay">
          <div className="glass-panel success-card glow-border-green">
            <div className="success-icon-circle">
              <Check size={36} strokeWidth={3} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#fff", marginBottom: "10px" }}>
              {successMessage || "Thao Tác Thành Công!"}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Hệ thống đã tự động tính toán lại toàn bộ lịch sử Elo của thành viên CLB để bảo đảm tính nhất quán tuyệt đối.
            </p>
          </div>
        </div>
      )}

      {/* Tiêu đề chính */}
      <div className="recorder-header-main">
        <Swords size={28} style={{ color: "var(--accent-neon-green)" }} />
        <h1 className="recorder-title">{CLUB_NAME.toUpperCase()} RECORD</h1>
      </div>

      {/* Thanh sub-tabs */}
      <div className="subtabs-container">
        <button 
          className={`subtab-btn ${subTab === "history" ? "active" : ""}`}
          onClick={() => setSubTab("history")}
        >
          <Calendar size={16} /> Lịch Sử Trận Đấu
        </button>
        <button 
          className={`subtab-btn ${subTab === "record" ? "active" : ""}`}
          onClick={() => setSubTab("record")}
        >
          <Plus size={16} /> {editingMatchId ? "Hiệu Chỉnh Trận Đấu" : "Ghi Trận Mới"}
        </button>
      </div>

      {/* NỘI DUNG TỪNG SUB-TAB */}
      {subTab === "history" ? (
        <div className="history-container animate-fade-in">
          {/* Bộ lọc */}
          <div className="glass-panel" style={{ padding: "20px", marginBottom: "20px" }}>
            <div className="history-filters">
              <div className="search-input-wrapper">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  className="form-input form-input-search" 
                  placeholder="Tìm theo tên thành viên..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <select className="form-select" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
                  <option value="">Tất cả sự kiện</option>
                  <option value="free">Giao lưu tự do</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">Cả hai thể thức</option>
                  <option value="singles">Đánh Đơn</option>
                  <option value="doubles">Đánh Đôi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Thanh xoá nhiều trận cùng lúc (Chỉ hiện cho Admin khi có trận đấu) */}
          {isAdmin && filteredMatches.length > 0 && (
            <div className="bulk-delete-bar glass-panel glow-border-green animate-slide-up">
              <div className="bulk-delete-bar-left">
                <label className="custom-checkbox-label">
                  <input 
                    type="checkbox" 
                    className="custom-checkbox-input"
                    checked={filteredMatches.length > 0 && selectedMatchIds.length === filteredMatches.length}
                    onChange={(e) => handleSelectAllMatches(e.target.checked)}
                  />
                  <span className="custom-checkbox-box"></span>
                  <span style={{ marginLeft: "10px", fontSize: "0.9rem", fontWeight: "600", color: "#fff" }}>
                    Chọn tất cả
                  </span>
                </label>
                <div className="bulk-delete-info">
                  Đang chọn <span>{selectedMatchIds.length}</span> trận đấu
                </div>
              </div>
              
              {selectedMatchIds.length > 0 && (
                <button 
                  className="btn-bulk-delete animate-fade-in"
                  onClick={handleBulkDelete}
                >
                  <Trash2 size={15} /> Xoá các trận đã chọn
                </button>
              )}
            </div>
          )}

          {/* Danh sách trận đấu */}
          <div className="match-list-history">
            {filteredMatches.length === 0 ? (
              <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                Không tìm thấy trận đấu nào khớp với điều kiện lọc.
              </div>
            ) : (
              filteredMatches.map(match => {
                const teamAWin = match.scoreA > match.scoreB;
                const teamBWin = match.scoreB > match.scoreA;

                return (
                  <div key={match.id} className="match-row-item glass-panel animate-fade-in">
                    {/* Hộp chọn nhiều để xóa cho Admin */}
                    {isAdmin && (
                      <div className="match-checkbox-container">
                        <label className="custom-checkbox-label" style={{ opacity: isMatchEventLocked(match) ? 0.3 : 1, cursor: isMatchEventLocked(match) ? "not-allowed" : "pointer" }}>
                          <input 
                            type="checkbox" 
                            className="custom-checkbox-input"
                            checked={selectedMatchIds.includes(match.id)}
                            disabled={isMatchEventLocked(match)}
                            onChange={(e) => handleSelectMatch(match.id, e.target.checked)}
                          />
                          <span className="custom-checkbox-box"></span>
                        </label>
                      </div>
                    )}

                    {/* Bên trái: Thông tin chung */}
                    <div className="match-info-side">
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span className="match-event-tag">{getEventName(match.eventId)}</span>
                        <span className={`match-type-badge ${match.type === "singles" ? "match-type-singles" : "match-type-doubles"}`}>
                          {match.type === "singles" ? "Đơn" : "Đôi"}
                        </span>
                      </div>
                      <span className="match-date">{formatDate(match.date)}</span>
                    </div>

                    {/* Giữa: Người chơi & Điểm số */}
                    <div className="match-teams-score">
                      {/* Đội A */}
                      <div className="match-team match-team-a">
                        <div className="match-team-players">
                          {match.teamA.map(id => (
                            <span key={id} className="match-player-name">{getPlayerName(id)}</span>
                          ))}
                        </div>
                        <div className="player-avatars-group">
                          {match.teamA.map(id => (
                            <div 
                              key={id} 
                              className="player-avatar-circle"
                              style={{ backgroundColor: getPlayerAvatarColor(id) }}
                            >
                              {getPlayerName(id).charAt(0)}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tỷ số lớn & Sets chi tiết */}
                      <div className="match-score-section">
                        {match.played === false ? (
                          <div className="match-unplayed-badge">
                            Chưa đấu
                          </div>
                        ) : (
                          <>
                            <div className="match-score-pill">
                              <span className={teamAWin ? "score-winner" : "score-loser"}>{match.scoreA}</span>
                              <span style={{ color: "var(--text-muted)" }}>:</span>
                              <span className={teamBWin ? "score-winner" : "score-loser"}>{match.scoreB}</span>
                            </div>
                            <div className="match-sets-detail">
                              {match.sets && match.sets.map((s, idx) => (
                                <span key={idx}>
                                  {s.a}-{s.b}{idx < match.sets.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Đội B */}
                      <div className="match-team match-team-b">
                        <div className="player-avatars-group">
                          {match.teamB.map(id => (
                            <div 
                              key={id} 
                              className="player-avatar-circle"
                              style={{ backgroundColor: getPlayerAvatarColor(id) }}
                            >
                              {getPlayerName(id).charAt(0)}
                            </div>
                          ))}
                        </div>
                        <div className="match-team-players" style={{ alignItems: "flex-start" }}>
                          {match.teamB.map(id => (
                            <span key={id} className="match-player-name">{getPlayerName(id)}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Biến động Elo */}
                    <div className="match-elo-exchanges">
                      {Object.entries(match.eloChanges).map(([playerId, change]) => (
                        <div key={playerId} className="elo-change-row">
                          <span className="elo-change-name">{getPlayerName(playerId).split(" ").pop()}</span>
                          <span className={`elo-change-value ${change > 0 ? "elo-up" : "elo-down"}`}>
                            {change > 0 ? `+${change}` : change}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Hành động sửa / xóa cho Admin */}
                    {isAdmin && (
                      <div className="match-actions">
                        <button 
                          className="btn-action-edit" 
                          title={isMatchEventLocked(match) ? "Sự kiện đã bị khóa" : "Sửa trận đấu"}
                          onClick={() => handleEditClick(match)}
                          style={{ opacity: isMatchEventLocked(match) ? 0.4 : 1, cursor: isMatchEventLocked(match) ? "not-allowed" : "pointer" }}
                          disabled={isMatchEventLocked(match)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="btn-action-delete" 
                          title={isMatchEventLocked(match) ? "Sự kiện đã bị khóa" : "Xóa trận đấu"}
                          onClick={() => handleDeleteClick(match.id)}
                          style={{ opacity: isMatchEventLocked(match) ? 0.4 : 1, cursor: isMatchEventLocked(match) ? "not-allowed" : "pointer" }}
                          disabled={isMatchEventLocked(match)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* TAB GHI ĐIỂM / HIỆU CHỈNH TRẬN ĐẤU */
        <div className="recorder-content-wrapper animate-fade-in">
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  className="form-input recorder-pin-input" 
                  placeholder="Mã PIN" 
                  value={pinInput}
                  onChange={e => {
                    setPinInput(e.target.value.replace(/\D/g, ""));
                    setPinError("");
                  }}
                  onFocus={handleInputFocus}
                  autoFocus
                />
                {pinError && <div className="recorder-pin-error">{pinError}</div>}
                
                <button type="submit" className="btn-neon-green" style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}>
                  Mở khóa Ghi điểm
                </button>
              </form>
            </div>
          ) : (
            <div className="glass-panel recorder-panel animate-slide-up">
              {/* Banner khi ở chế độ sửa */}
              {editingMatchId && (
                <div className="editing-banner">
                  <div className="editing-banner-text">
                    <Edit2 size={18} /> Đang hiệu chỉnh trận đấu #{editingMatchId.split("_")[1] || editingMatchId}
                  </div>
                  <button className="btn-cancel-edit" onClick={handleCancelEdit}>
                    <X size={14} /> Hủy sửa
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Chọn thể thức Đơn hoặc Đôi */}
                <div className="type-toggle-container">
                  <button 
                    type="button" 
                    className={`type-toggle-btn ${matchType === "singles" ? "active" : ""}`}
                    disabled={!!editingMatchId} // Khóa đổi thể thức khi đang sửa để tránh sai lệch cấu trúc
                    onClick={() => setMatchType("singles")}
                    style={{ opacity: editingMatchId ? 0.6 : 1 }}
                  >
                    Đánh Đơn (1v1)
                  </button>
                  <button 
                    type="button" 
                    className={`type-toggle-btn ${matchType === "doubles" ? "active" : ""}`}
                    disabled={!!editingMatchId} // Khóa đổi thể thức khi đang sửa
                    onClick={() => setMatchType("doubles")}
                    style={{ opacity: editingMatchId ? 0.6 : 1 }}
                  >
                    Đánh Đôi (2v2)
                  </button>
                </div>

                {/* Chọn Sự kiện & Ngày giờ */}
                <div className="recorder-meta-grid">
                  <div>
                    <label className="form-label">Sự kiện / Giải đấu</label>
                    <select className="form-select" value={eventId} onChange={e => { setEventId(e.target.value); setHasUserSelectedEvent(true); }}>
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
                <div style={{ marginBottom: "20px" }}>
                  <label className="form-label">Phương thức chấm điểm</label>
                  <div style={{ display: "flex", gap: "24px" }}>
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
                  <h3 className="team-side-title" style={{ justifyContent: "center", color: "#fff", marginBottom: "20px" }}>
                    Nhập Điểm Số Các Set Đấu (Siêu To Dễ Bấm)
                  </h3>

                  {/* Set 1 */}
                  <div className="set-row">
                    <span className="set-label">Set 1</span>
                    
                    {/* Điểm đội A */}
                    <div className="score-counter-container">
                      <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(0, "a", -1)}><Minus size={16} /></button>
                      <input 
                        type="number" 
                        className="score-input-mini" 
                        value={setsScore[0].a} 
                        onChange={(e) => handleScoreChange(0, "a", e.target.value)} 
                        onFocus={handleInputFocus}
                        min="0"
                      />
                      <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(0, "a", 1)}><Plus size={16} /></button>
                    </div>

                    <span style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--text-muted)" }}>:</span>

                    {/* Điểm đội B */}
                    <div className="score-counter-container">
                      <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(0, "b", -1)}><Minus size={16} /></button>
                      <input 
                        type="number" 
                        className="score-input-mini" 
                        value={setsScore[0].b} 
                        onChange={(e) => handleScoreChange(0, "b", e.target.value)} 
                        onFocus={handleInputFocus}
                        min="0"
                      />
                      <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(0, "b", 1)}><Plus size={16} /></button>
                    </div>
                  </div>

                  {/* Set 2 (Best of 3) */}
                  {scoringMode === "bestOf3" && (
                    <div className="set-row animate-fade-in">
                      <span className="set-label">Set 2</span>
                      <div className="score-counter-container">
                        <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(1, "a", -1)}><Minus size={16} /></button>
                        <input 
                          type="number" 
                          className="score-input-mini" 
                          value={setsScore[1].a} 
                          onChange={(e) => handleScoreChange(1, "a", e.target.value)} 
                          onFocus={handleInputFocus}
                          min="0"
                        />
                        <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(1, "a", 1)}><Plus size={16} /></button>
                      </div>
                      <span style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--text-muted)" }}>:</span>
                      <div className="score-counter-container">
                        <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(1, "b", -1)}><Minus size={16} /></button>
                        <input 
                          type="number" 
                          className="score-input-mini" 
                          value={setsScore[1].b} 
                          onChange={(e) => handleScoreChange(1, "b", e.target.value)} 
                          onFocus={handleInputFocus}
                          min="0"
                        />
                        <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(1, "b", 1)}><Plus size={16} /></button>
                      </div>
                    </div>
                  )}

                  {/* Set 3 (Best of 3 - Chỉ chơi nếu tỷ số 1-1) */}
                  {scoringMode === "bestOf3" && (
                    <div className="set-row animate-fade-in">
                      <span className="set-label">Set 3 *</span>
                      <div className="score-counter-container">
                        <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(2, "a", -1)}><Minus size={16} /></button>
                        <input 
                          type="number" 
                          className="score-input-mini" 
                          value={setsScore[2].a} 
                          onChange={(e) => handleScoreChange(2, "a", e.target.value)} 
                          onFocus={handleInputFocus}
                          min="0"
                        />
                        <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(2, "a", 1)}><Plus size={16} /></button>
                      </div>
                      <span style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--text-muted)" }}>:</span>
                      <div className="score-counter-container">
                        <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(2, "b", -1)}><Minus size={16} /></button>
                        <input 
                          type="number" 
                          className="score-input-mini" 
                          value={setsScore[2].b} 
                          onChange={(e) => handleScoreChange(2, "b", e.target.value)} 
                          onFocus={handleInputFocus}
                          min="0"
                        />
                        <button type="button" className="btn-score-adjust" onClick={() => handleScoreAdjust(2, "b", 1)}><Plus size={16} /></button>
                      </div>
                    </div>
                  )}
                  
                  {scoringMode === "bestOf3" && (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "12px" }}>
                      * Lưu ý: Set 3 chỉ tự động tính nếu kết quả Set 1 và Set 2 là hòa nhau 1 - 1.
                    </div>
                  )}
                </div>

                {/* ELO PREVIEW HOẶC THÔNG BÁO LỖI */}
                {matchOutcome.isValid ? (
                  <div className="elo-preview-panel glow-border-green animate-slide-up">
                    <h4 className="elo-preview-title">
                      <Award size={16} /> Live Elo Preview (Tính toán biến động Elo ước tính)
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
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={editingMatchId ? handleCancelEdit : () => setSubTab("history")}
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit" 
                    className="btn-neon-green" 
                    disabled={!matchOutcome.isValid}
                    style={{ opacity: matchOutcome.isValid ? 1 : 0.4, cursor: matchOutcome.isValid ? "pointer" : "not-allowed" }}
                  >
                    <Swords size={18} /> {editingMatchId ? "Cập nhật trận đấu & recalculate Elo" : "Lưu trận đấu & Cập nhật ELO"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
