import React, { useState, useEffect, useMemo } from "react";
import { Shuffle, Users, Calendar, Trophy, Play, Check, HelpCircle, Plus, Minus, Trash2, Swords, Award, Lock, Unlock } from "lucide-react";
import { recordMatch, recalculateAllElos, saveClubData } from "../utils/db";

export default function TournamentDraw({ data, setData, isAdmin }) {
  const { members, events } = data;

  // --- TRẠNG THÁI CHÍNH ---
  const [selectedEventId, setSelectedEventId] = useState(() => {
    return localStorage.getItem("draw_selected_event_id") || "";
  });

  const selectedEventObj = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const isEventLocked = selectedEventObj?.isLocked || false;

  // Hàm helper dùng để lấy giá trị từ localStorage với cơ chế phân vùng và fallback thông minh
  const getLocalStorageFallback = (key, defaultVal, isJson = false) => {
    const defaultEventId = localStorage.getItem("draw_selected_event_id") || "";
    if (defaultEventId) {
      const val = localStorage.getItem(`${key}_${defaultEventId}`);
      if (val !== null) {
        if (isJson) {
          try { return JSON.parse(val) || defaultVal; } catch (e) { return defaultVal; }
        }
        return val;
      }
      
      // Nếu đã có bất kỳ sự kiện nào có dữ liệu phân vùng, chứng tỏ ta đang ở chế độ nhiều sự kiện
      // Lúc này, một sự kiện mới không có key riêng thì KHÔNG được lấy key global (vì key global thuộc về sự kiện khác cũ)
      const keys = Object.keys(localStorage);
      const hasAnySpecific = keys.some(k => k.startsWith("draw_data_e_") || k.startsWith("draw_generated_e_"));
      if (!hasAnySpecific) {
        const globalVal = localStorage.getItem(key);
        if (globalVal !== null) {
          if (isJson) {
            try { return JSON.parse(globalVal) || defaultVal; } catch (e) { return defaultVal; }
          }
          return globalVal;
        }
      }
    } else {
      // Chưa chọn sự kiện nào, dùng global
      const globalVal = localStorage.getItem(key);
      if (globalVal !== null) {
        if (isJson) {
          try { return JSON.parse(globalVal) || defaultVal; } catch (e) { return defaultVal; }
        }
        return globalVal;
      }
    }
    return defaultVal;
  };

  const [activeScenario, setActiveScenario] = useState(() => {
    return getLocalStorageFallback("draw_active_scenario", "mixer");
  });

  const [selectedMemberIds, setSelectedMemberIds] = useState(() => {
    return getLocalStorageFallback("draw_selected_member_ids", [], true);
  });
  
  // Trạng thái bốc thăm
  const [drawGenerated, setDrawGenerated] = useState(() => {
    return getLocalStorageFallback("draw_generated", "false") === "true";
  });

  const [drawData, setDrawData] = useState(() => {
    return getLocalStorageFallback("draw_data", null, true);
  });

  const [loadedEventId, setLoadedEventId] = useState(() => {
    return localStorage.getItem("draw_selected_event_id") || "";
  });

  // --- LƯU TRỮ BỀN BỈ & CÔ LẬP TRÊN MOBILE (LOCALSTORAGE) ---
  useEffect(() => {
    if (selectedEventId && selectedEventId === loadedEventId) {
      localStorage.setItem(`draw_active_scenario_${selectedEventId}`, activeScenario);
      localStorage.setItem("draw_active_scenario", activeScenario);
    }
  }, [activeScenario, selectedEventId, loadedEventId]);

  useEffect(() => {
    localStorage.setItem("draw_selected_event_id", selectedEventId);
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedEventId && selectedEventId === loadedEventId) {
      localStorage.setItem(`draw_selected_member_ids_${selectedEventId}`, JSON.stringify(selectedMemberIds));
      localStorage.setItem("draw_selected_member_ids", JSON.stringify(selectedMemberIds));
    }
  }, [selectedMemberIds, selectedEventId, loadedEventId]);

  useEffect(() => {
    if (selectedEventId && selectedEventId === loadedEventId) {
      localStorage.setItem(`draw_generated_${selectedEventId}`, drawGenerated ? "true" : "false");
      localStorage.setItem("draw_generated", drawGenerated ? "true" : "false");
    }
  }, [drawGenerated, selectedEventId, loadedEventId]);

  useEffect(() => {
    if (selectedEventId && selectedEventId === loadedEventId) {
      localStorage.setItem(`draw_data_${selectedEventId}`, JSON.stringify(drawData));
      localStorage.setItem("draw_data", JSON.stringify(drawData));
    }
  }, [drawData, selectedEventId, loadedEventId]);

  // --- TẢI DỮ LIỆU RIÊNG CHO SỰ KIỆN KHI ĐỔI SỰ KIỆN ---
  useEffect(() => {
    if (!selectedEventId) {
      setLoadedEventId("");
      return;
    }

    const getValWithFallback = (key, defaultVal, isJson = false) => {
      const val = localStorage.getItem(`${key}_${selectedEventId}`);
      if (val !== null) {
        if (isJson) {
          try { return JSON.parse(val) || defaultVal; } catch (e) { return defaultVal; }
        }
        return val;
      }
      
      const keys = Object.keys(localStorage);
      const hasAnySpecific = keys.some(k => k.startsWith("draw_data_e_") || k.startsWith("draw_generated_e_"));
      if (!hasAnySpecific) {
        const globalVal = localStorage.getItem(key);
        if (globalVal !== null) {
          if (isJson) {
            try { return JSON.parse(globalVal) || defaultVal; } catch (e) { return defaultVal; }
          }
          return globalVal;
        }
      }
      return defaultVal;
    };

    setActiveScenario(getValWithFallback("draw_active_scenario", "mixer"));
    setSelectedMemberIds(getValWithFallback("draw_selected_member_ids", [], true));
    setDrawGenerated(getValWithFallback("draw_generated", "false") === "true");
    setDrawData(getValWithFallback("draw_data", null, true));

    setLoadedEventId(selectedEventId);
  }, [selectedEventId]);
  
  // Trạng thái cấu hình phụ cho từng kịch bản
  // 1. Kịch bản Mixer
  const [mixerCourts, setMixerCourts] = useState(1);
  const [mixerRounds, setMixerRounds] = useState(4);
  const [mixerMatchmaking, setMixerMatchmaking] = useState("rotation"); // rotation, balanced, similar
  const [mixerPrioritizeSimilarEarly, setMixerPrioritizeSimilarEarly] = useState(true);
  
  // 2. Kịch bản Vòng tròn (Round Robin)
  const [rrFormat, setRrFormat] = useState("doubles"); // singles, doubles
  const [rrDoublesMode, setRrDoublesMode] = useState("auto"); // auto (tự ghép cặp ngẫu nhiên), fixed (cặp đấu cố định)
  const [rrFixedTeams, setRrFixedTeams] = useState([]); // Array of { id, players: [p1, p2], name }
  const [rrTempP1, setRrTempP1] = useState("");
  const [rrTempP2, setRrTempP2] = useState("");
  const [rrTempTeamName, setRrTempTeamName] = useState("");

  // 3. Kịch bản Loại trực tiếp (Elimination)
  const [elimFormat, setElimFormat] = useState("doubles"); // singles, doubles
  const [elimDoublesMode, setElimDoublesMode] = useState("auto"); // auto, fixed
  const [elimFixedTeams, setElimFixedTeams] = useState([]); // Cặp đấu cố định cho loại trực tiếp
  const [elimSeeding, setElimSeeding] = useState("elo"); // elo (hạt giống theo Elo), random (ngẫu nhiên)
  const [elimTempP1, setElimTempP1] = useState("");
  const [elimTempP2, setElimTempP2] = useState("");
  const [elimTempTeamName, setElimTempTeamName] = useState("");

  // Trạng thái nhập điểm trực tiếp tại trận bốc thăm
  const [activeScoringMatch, setActiveScoringMatch] = useState(null); // Lưu match object đang nhập điểm
  const [set1A, setSet1A] = useState(0);
  const [set1B, setSet1B] = useState(0);
  const [scoringError, setScoringError] = useState("");

  // --- THIẾT LẬP MẶC ĐỊNH SỰ KIỆN GẦN NHẤT ---
  useEffect(() => {
    if (events && events.length > 0 && !selectedEventId) {
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
      setSelectedEventId(sorted[0]?.id || "");
    }
  }, [events, selectedEventId]);

  // --- TRỢ GIÚP DỮ LIỆU ---
  const getPlayerName = (id) => {
    const player = members.find(m => m.id === id);
    return player ? player.name : "Cựu thành viên";
  };

  const getPlayerNameShort = (id) => {
    const name = getPlayerName(id);
    return name.split(" ").pop();
  };

  // --- HÀM XỬ LÝ LỰA CHỌN THÀNH VIÊN ---
  const handleToggleMember = (id) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const handleSelectAllMembers = () => {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(members.map(m => m.id));
    }
  };

  // --- THÊM ĐỘI CỐ ĐỊNH (ROUND ROBIN & ELIMINATION) ---
  const handleAddFixedTeam = (type) => {
    const p1 = type === "rr" ? rrTempP1 : elimTempP1;
    const p2 = type === "rr" ? rrTempP2 : elimTempP2;
    const customName = type === "rr" ? rrTempTeamName : elimTempTeamName;

    if (!p1 || !p2 || p1 === p2) {
      alert("Vui lòng chọn 2 người chơi khác nhau để lập đội.");
      return;
    }

    const teamName = customName.trim() || `${getPlayerNameShort(p1)} + ${getPlayerNameShort(p2)}`;
    const newTeam = {
      id: `team_fixed_${Date.now()}`,
      players: [p1, p2],
      name: teamName
    };

    if (type === "rr") {
      setRrFixedTeams(prev => [...prev, newTeam]);
      setRrTempP1("");
      setRrTempP2("");
      setRrTempTeamName("");
    } else {
      setElimFixedTeams(prev => [...prev, newTeam]);
      setElimTempP1("");
      setElimTempP2("");
      setElimTempTeamName("");
    }
  };

  const handleRemoveFixedTeam = (type, teamId) => {
    if (type === "rr") {
      setRrFixedTeams(prev => prev.filter(t => t.id !== teamId));
    } else {
      setElimFixedTeams(prev => prev.filter(t => t.id !== teamId));
    }
  };

  // --- 1. THUẬT TOÁN KỊCH BẢN 2: SOCIAL MIXER ---
  const generateMixerDraw = () => {
    const players = [...selectedMemberIds];
    if (players.length < 4) {
      alert("Cần tối thiểu 4 người chơi để bốc thăm Giao lưu Xoay tua.");
      return;
    }

    const playCounts = {};
    const partnerCounts = {};
    const opponentCounts = {};
    const sitoutHistory = {};

    players.forEach(p => {
      playCounts[p] = 0;
      partnerCounts[p] = {};
      opponentCounts[p] = {};
      sitoutHistory[p] = [];
      players.forEach(other => {
        if (p !== other) {
          partnerCounts[p][other] = 0;
          opponentCounts[p][other] = 0;
        }
      });
    });

    const rounds = [];
    const actualRounds = parseInt(mixerRounds) || 4;
    const actualCourts = parseInt(mixerCourts) || 1;

    // Thuật toán xáo trộn Fisher-Yates helper
    const shuffleArray = (arr) => {
      const newArr = [...arr];
      for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = newArr[i];
        newArr[i] = newArr[j];
        newArr[j] = temp;
      }
      return newArr;
    };

    for (let r = 0; r < actualRounds; r++) {
      // Sắp xếp người chơi theo số lần đã đấu (tăng dần), ưu tiên người vừa nghỉ ở lượt trước
      const sortedPlayers = [...players].sort((a, b) => {
        if (playCounts[a] !== playCounts[b]) {
          return playCounts[a] - playCounts[b];
        }
        const satA = r > 0 && sitoutHistory[a][r - 1] === true;
        const satB = r > 0 && sitoutHistory[b][r - 1] === true;
        if (satA !== satB) return satA ? -1 : 1;
        return 0;
      });

      const numPlayersNeeded = Math.min(players.length - (players.length % 4), actualCourts * 4);
      if (numPlayersNeeded < 4) break;

      const activePlayers = sortedPlayers.slice(0, numPlayersNeeded);
      const sittingPlayers = sortedPlayers.slice(numPlayersNeeded);

      players.forEach(p => {
        sitoutHistory[p].push(sittingPlayers.includes(p));
      });

      // Chạy nhiều vòng xáo trộn để tìm ra cách chia cặp có ít lượt trùng lặp nhất toàn cục
      let bestRoundMatches = null;
      let bestRoundScore = Infinity;
      const iterations = 1000;

      for (let iter = 0; iter < iterations; iter++) {
        const shuffledActive = shuffleArray(activePlayers);
        let currentRoundScore = 0;
        const currentMatches = [];

        for (let c = 0; c < numPlayersNeeded / 4; c++) {
          const p1 = shuffledActive[c * 4];
          const p2 = shuffledActive[c * 4 + 1];
          const p3 = shuffledActive[c * 4 + 2];
          const p4 = shuffledActive[c * 4 + 3];

          const partner12 = partnerCounts[p1][p2] || 0;
          const partner34 = partnerCounts[p3][p4] || 0;

          const opp13 = opponentCounts[p1][p3] || 0;
          const opp14 = opponentCounts[p1][p4] || 0;
          const opp23 = opponentCounts[p2][p3] || 0;
          const opp24 = opponentCounts[p2][p4] || 0;

          const elo1 = members.find(m => m.id === p1)?.elo || 1200;
          const elo2 = members.find(m => m.id === p2)?.elo || 1200;
          const elo3 = members.find(m => m.id === p3)?.elo || 1200;
          const elo4 = members.find(m => m.id === p4)?.elo || 1200;

          // Phạt lũy tiến theo bình phương số lần trùng lắp
          const partnerPenalty = Math.pow(partner12, 2) + Math.pow(partner34, 2);
          const opponentPenalty = Math.pow(opp13, 2) + Math.pow(opp14, 2) + Math.pow(opp23, 2) + Math.pow(opp24, 2);

          // Phạt trùng lặp đồng đội nặng hơn phạt trùng lặp đối thủ (đồng đội là hệ số 5)
          let matchImbalancePenalty = partnerPenalty * 5 + opponentPenalty;

          // Tính toán điểm phạt trình độ Elo
          let eloPenalty = 0;
          const isEarlyRoundSimilar = mixerPrioritizeSimilarEarly && r < Math.ceil(actualRounds / 2);

          if (mixerMatchmaking === "balanced") {
            // Cân bằng sức mạnh 2 đội: |Elo_A - Elo_B| nhỏ nhất
            const eloTeamA = (elo1 + elo2) / 2;
            const eloTeamB = (elo3 + elo4) / 2;
            eloPenalty = Math.abs(eloTeamA - eloTeamB) * 0.25;
          } else if (mixerMatchmaking === "similar" || isEarlyRoundSimilar) {
            // Trình độ ngang tài ngang sức trên cùng sân: max - min Elo nhỏ nhất
            const elos = [elo1, elo2, elo3, elo4];
            const spread = Math.max(...elos) - Math.min(...elos);
            const spreadWeight = isEarlyRoundSimilar ? 0.6 : 0.3;
            eloPenalty = spread * spreadWeight;
          }

          currentRoundScore += matchImbalancePenalty + eloPenalty;

          currentMatches.push({
            courtIndex: c + 1,
            teamA: [p1, p2],
            teamB: [p3, p4],
            scoreA: null,
            scoreB: null,
            played: false
          });
        }

        if (currentRoundScore < bestRoundScore) {
          bestRoundScore = currentRoundScore;
          bestRoundMatches = currentMatches;
          if (bestRoundScore === 0) {
            // Đã đạt kết quả hoàn hảo (không trùng đồng đội/đối thủ nào trong vòng này)
            break;
          }
        }
      }

      // Lưu kết quả ghép cặp tốt nhất và gán ID trận đấu
      bestRoundMatches.forEach((m, c) => {
        m.matchId = `mixer_m_${r}_${c}_${Date.now()}`;

        const [p1, p2] = m.teamA;
        const [p3, p4] = m.teamB;

        playCounts[p1]++; playCounts[p2]++; playCounts[p3]++; playCounts[p4]++;
        partnerCounts[p1][p2]++; partnerCounts[p2][p1]++;
        partnerCounts[p3][p4]++; partnerCounts[p4][p3]++;

        const updateOpp = (pa, pb) => {
          opponentCounts[pa][pb]++; opponentCounts[pb][pa]++;
        };
        updateOpp(p1, p3); updateOpp(p1, p4);
        updateOpp(p2, p3); updateOpp(p2, p4);
      });

      rounds.push({
        roundIndex: r + 1,
        matches: bestRoundMatches,
        sittingOut: sittingPlayers
      });
    }

    setDrawData(rounds);
    setDrawGenerated(true);
  };

  // --- 2. THUẬT TOÁN KỊCH BẢN 1: VÒNG TRÒN (ROUND ROBIN) ---
  const generateRoundRobinDraw = () => {
    let teams = [];

    if (rrFormat === "singles") {
      const players = [...selectedMemberIds];
      if (players.length < 2) {
        alert("Cần tối thiểu 2 người chơi để bốc thăm đấu Đơn.");
        return;
      }
      teams = players.map(pId => ({
        id: pId,
        players: [pId],
        name: getPlayerName(pId),
        isBye: false
      }));
    } else {
      // Đấu Đôi
      if (rrDoublesMode === "auto") {
        const players = [...selectedMemberIds];
        if (players.length < 4) {
          alert("Cần tối thiểu 4 người chơi để tự động ghép cặp đấu Đôi.");
          return;
        }
        // Tráo ngẫu nhiên để ghép đôi
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        let idx = 1;
        while (shuffled.length >= 2) {
          const p1 = shuffled.shift();
          const p2 = shuffled.shift();
          teams.push({
            id: `team_rr_auto_${idx}_${Date.now()}`,
            players: [p1, p2],
            name: `${getPlayerNameShort(p1)} + ${getPlayerNameShort(p2)}`,
            isBye: false
          });
          idx++;
        }
      } else {
        // Cặp đấu cố định đã nhập
        if (rrFixedTeams.length < 2) {
          alert("Vui lòng tạo tối thiểu 2 đội cố định để bốc thăm lịch thi đấu.");
          return;
        }
        teams = rrFixedTeams.map(t => ({ ...t, isBye: false }));
      }
    }

    // Berger tables / Circle method
    const list = [...teams];
    const isOdd = list.length % 2 !== 0;
    if (isOdd) {
      list.push({ id: "bye", name: "MIỄN ĐẤU (BYE)", isBye: true, players: [] });
    }

    const numTeams = list.length;
    const numRounds = numTeams - 1;
    const rounds = [];

    for (let r = 0; r < numRounds; r++) {
      const matches = [];
      for (let i = 0; i < numTeams / 2; i++) {
        const home = list[i];
        const away = list[numTeams - 1 - i];

        if (!home.isBye && !away.isBye) {
          matches.push({
            matchId: `rr_m_${r}_${i}_${Date.now()}`,
            teamA: home.players,
            teamB: away.players,
            teamAName: home.name,
            teamBName: away.name,
            scoreA: null,
            scoreB: null,
            played: false
          });
        }
      }
      rounds.push({
        roundIndex: r + 1,
        matches
      });

      // Xoay vòng (giữ phần tử đầu tiên cố định)
      const first = list[0];
      const last = list[numTeams - 1];
      for (let k = numTeams - 1; k > 1; k--) {
        list[k] = list[k - 1];
      }
      list[1] = last;
      list[0] = first;
    }

    setDrawData({ rounds, teams });
    setDrawGenerated(true);
  };

  // --- 3. THUẬT TOÁN KỊCH BẢN 3: LOẠI TRỰC TIẾP (SINGLE ELIMINATION) ---
  const generateEliminationDraw = () => {
    let teams = [];

    if (elimFormat === "singles") {
      const players = [...selectedMemberIds];
      if (players.length < 2) {
        alert("Cần tối thiểu 2 người chơi để đấu loại trực tiếp Đơn.");
        return;
      }
      teams = players.map(pId => ({
        id: pId,
        players: [pId],
        name: getPlayerName(pId),
        elo: members.find(m => m.id === pId)?.elo || 1200,
        isBye: false
      }));
    } else {
      // Đôi
      if (elimDoublesMode === "auto") {
        const players = [...selectedMemberIds];
        if (players.length < 4) {
          alert("Cần tối thiểu 4 người chơi để tự động ghép cặp đấu Đôi.");
          return;
        }
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        let idx = 1;
        while (shuffled.length >= 2) {
          const p1 = shuffled.shift();
          const p2 = shuffled.shift();
          const elo = Math.round(((members.find(m => m.id === p1)?.elo || 1200) + (members.find(m => m.id === p2)?.elo || 1200)) / 2);
          teams.push({
            id: `team_elim_auto_${idx}_${Date.now()}`,
            players: [p1, p2],
            name: `${getPlayerNameShort(p1)} + ${getPlayerNameShort(p2)}`,
            elo,
            isBye: false
          });
          idx++;
        }
      } else {
        // Cặp đấu cố định đã nhập
        if (elimFixedTeams.length < 2) {
          alert("Vui lòng tạo tối thiểu 2 đội cố định để bốc thăm loại trực tiếp.");
          return;
        }
        teams = elimFixedTeams.map(t => ({
          ...t,
          elo: Math.round(t.players.reduce((sum, pId) => sum + (members.find(m => m.id === pId)?.elo || 1200), 0) / t.players.length),
          isBye: false
        }));
      }
    }

    // Sắp xếp hạt giống
    if (elimSeeding === "elo") {
      teams.sort((a, b) => b.elo - a.elo);
    } else {
      teams.sort(() => Math.random() - 0.5);
    }

    const N = teams.length;
    let P = 2;
    while (P < N) {
      P *= 2;
    }

    // Đệ quy thứ tự hạt giống tiêu chuẩn (ví dụ 8 đội: [1, 8, 5, 4, 3, 6, 7, 2])
    const getSeedOrder = (size) => {
      if (size === 2) return [1, 2];
      const prev = getSeedOrder(size / 2);
      const result = [];
      for (let i = 0; i < prev.length; i++) {
        result.push(prev[i]);
        result.push(size + 1 - prev[i]);
      }
      return result;
    };

    const seedOrder = getSeedOrder(P);
    const bracketSlots = Array(P).fill(null);

    for (let i = 0; i < P; i++) {
      const seed = seedOrder[i];
      if (seed <= N) {
        bracketSlots[i] = teams[seed - 1];
      } else {
        bracketSlots[i] = { id: "bye", name: "MIỄN ĐẤU (BYE)", isBye: true, players: [] };
      }
    }

    const r1Matches = [];
    const totalMatchesR1 = P / 2;

    for (let i = 0; i < totalMatchesR1; i++) {
      const tA = bracketSlots[i * 2];
      const tB = bracketSlots[i * 2 + 1];
      const mId = `elim_m_1_${i}_${Date.now()}`;

      let played = false;
      let scoreA = null;
      let scoreB = null;
      let winner = null;

      if (tA.isBye) {
        winner = tB;
        played = true;
        scoreA = 0;
        scoreB = 1;
      } else if (tB.isBye) {
        winner = tA;
        played = true;
        scoreA = 1;
        scoreB = 0;
      }

      r1Matches.push({
        matchId: mId,
        teamA: tA.players,
        teamB: tB.players,
        teamAName: tA.name,
        teamBName: tB.name,
        scoreA,
        scoreB,
        played,
        winner: winner ? winner.name : null,
        winnerPlayers: winner ? winner.players : null,
        isByeMatch: tA.isBye || tB.isBye
      });
    }

    const rounds = [];
    rounds.push({
      roundName: getRoundName(P, 1),
      matches: r1Matches
    });

    let currentRoundSize = P / 4;
    let roundIdx = 2;

    while (currentRoundSize >= 1) {
      const rMatches = [];
      const prevRound = rounds[roundIdx - 2];

      for (let i = 0; i < currentRoundSize; i++) {
        const prevA = prevRound.matches[i * 2];
        const prevB = prevRound.matches[i * 2 + 1];

        const tA = prevA.winner ? { players: prevA.winnerPlayers, name: prevA.winner } : null;
        const tB = prevB.winner ? { players: prevB.winnerPlayers, name: prevB.winner } : null;

        rMatches.push({
          matchId: `elim_m_${roundIdx}_${i}_${Date.now()}`,
          teamA: tA ? tA.players : null,
          teamB: tB ? tB.players : null,
          teamAName: tA ? tA.name : `Thắng trận ${i * 2 + 1} Vòng trước`,
          teamBName: tB ? tB.name : `Thắng trận ${i * 2 + 2} Vòng trước`,
          sourceMatchA: prevA.matchId,
          sourceMatchB: prevB.matchId,
          scoreA: null,
          scoreB: null,
          played: false,
          winner: null,
          winnerPlayers: null
        });
      }

      rounds.push({
        roundName: getRoundName(P * 2, roundIdx),
        matches: rMatches
      });

      currentRoundSize /= 2;
      roundIdx++;
    }

    setDrawData({ rounds, teams });
    setDrawGenerated(true);
  };

  const getRoundName = (totalSlots, roundIdx) => {
    const totalRounds = Math.log2(totalSlots);
    const remainingRounds = totalRounds - roundIdx + 1;
    if (remainingRounds === 1) return "Chung Kết";
    if (remainingRounds === 2) return "Bán Kết";
    if (remainingRounds === 3) return "Tứ Kết";
    return `Vòng Loại ${Math.pow(2, remainingRounds)} Đội`;
  };

  // --- KÍCH HOẠT BỐC THĂM CHUNG ---
  const handleGenerateDraw = () => {
    if (isEventLocked) {
      alert("Sự kiện này đã bị khóa. Không thể bốc thăm hoặc lập lịch đấu mới.");
      return;
    }

    if (!selectedEventId) {
      alert("Vui lòng tạo hoặc chọn một Sự kiện / Giải đấu trước khi bốc thăm.");
      return;
    }

    if (activeScenario === "mixer") {
      generateMixerDraw();
    } else if (activeScenario === "roundrobin") {
      generateRoundRobinDraw();
    } else if (activeScenario === "elimination") {
      generateEliminationDraw();
    }
  };

  const handleClearDraw = () => {
    if (isEventLocked) {
      alert("Sự kiện này đã bị khóa. Không thể hủy lịch đấu.");
      return;
    }

    if (window.confirm("Bạn có chắc muốn hủy lịch đấu vừa bốc thăm? Tất cả các trận đấu đã ghi nhận điểm từ lịch đấu này cũng sẽ bị xóa khỏi hệ thống và tính lại Elo.")) {
      setDrawGenerated(false);
      setDrawData(null);
      setActiveScoringMatch(null);

      // --- ĐỒNG BỘ XÓA TẤT CẢ TRẬN ĐẤU BỐC THĂM CỦA SỰ KIỆN NÀY ---
      if (selectedEventId) {
        const updatedData = { ...data };
        if (updatedData.matches) {
          const initialLength = updatedData.matches.length;
          updatedData.matches = updatedData.matches.filter(
            m => !(m.eventId === selectedEventId && m.id.startsWith("match_draw_"))
          );

          if (updatedData.matches.length !== initialLength) {
            const finalData = recalculateAllElos(updatedData);
            saveClubData(finalData);
            setData(finalData);
          }
        }
      }
    }
  };

  // --- XỬ LÝ NHẬP ĐIỂM SỐ CHO TRẬN BỐC THĂM ---
  const handleOpenScoring = (match) => {
    if (isEventLocked) {
      alert("Sự kiện này đã bị khóa. Không thể thay đổi hoặc ghi điểm số.");
      return;
    }

    if (!isAdmin) {
      alert("Vui lòng mở khóa quyền Admin (PIN) trên thanh menu để ghi kết quả thi đấu.");
      return;
    }
    setActiveScoringMatch(match);
    setSet1A(11);
    setSet1B(9);
    setScoringError("");
  };

  const handleSaveScore = () => {
    const scoreA = parseInt(set1A) || 0;
    const scoreB = parseInt(set1B) || 0;

    if (scoreA === scoreB) {
      setScoringError("Trận đấu Pickleball không thể có kết quả hòa.");
      return;
    }

    const { matchId, teamA, teamB, teamAName, teamBName } = activeScoringMatch;
    const playedDate = new Date().toISOString();
    
    // Cập nhật trạng thái trận đấu trong Draw dữ liệu nội bộ
    if (activeScenario === "mixer") {
      setDrawData(prev => 
        prev.map(round => ({
          ...round,
          matches: round.matches.map(m => 
            m.matchId === matchId ? { ...m, scoreA, scoreB, played: true, date: playedDate } : m
          )
        }))
      );
    } else if (activeScenario === "roundrobin") {
      setDrawData(prev => ({
        ...prev,
        rounds: prev.rounds.map(round => ({
          ...round,
          matches: round.matches.map(m => 
            m.matchId === matchId ? { ...m, scoreA, scoreB, played: true, date: playedDate } : m
          )
        }))
      }));
    } else if (activeScenario === "elimination") {
      // Vừa cập nhật tỉ số, vừa tự động tiến cử đội thắng lên vòng sau
      const winnerName = scoreA > scoreB ? teamAName : teamBName;
      const winnerPlayers = scoreA > scoreB ? teamA : teamB;

      setDrawData(prev => {
        const nextRounds = prev.rounds.map((round, rIdx) => {
          // 1. Cập nhật trận vừa đấu ở vòng này
          const nextMatches = round.matches.map(m => {
            if (m.matchId === matchId) {
              return { ...m, scoreA, scoreB, played: true, date: playedDate, winner: winnerName, winnerPlayers };
            }
            return m;
          });

          // 2. Tự động chuyển tiếp kết quả lên trận nguồn của vòng tiếp theo
          const updatedMatches = nextMatches.map(m => m);
          return { ...round, matches: updatedMatches };
        });

        // Tìm trận đấu ở vòng sau sử dụng sourceMatchA hoặc sourceMatchB trùng với matchId này để điền tên đội thắng
        const finalRounds = nextRounds.map((round, rIdx) => {
          if (rIdx === 0) return round;
          const nextMatches = round.matches.map(m => {
            let updatedM = { ...m };
            if (m.sourceMatchA === matchId) {
              updatedM.teamA = winnerPlayers;
              updatedM.teamAName = winnerName;
            }
            if (m.sourceMatchB === matchId) {
              updatedM.teamB = winnerPlayers;
              updatedM.teamBName = winnerName;
            }
            return updatedM;
          });
          return { ...round, matches: nextMatches };
        });

        return { ...prev, rounds: finalRounds };
      });
    }

    // --- ĐỒNG BỘ TỨC THÌ VÀO DATABASE TOÀN CỤC CỦA CLB ---
    if (selectedEventId && teamA && teamB && teamA.length > 0 && teamB.length > 0) {
      const syncId = matchId.startsWith("match_") ? `match_draw_${matchId.substring(6)}` : `match_draw_${matchId}`;
      const formattedMatch = {
        id: syncId,
        eventId: selectedEventId,
        type: teamA.length === 1 ? "singles" : "doubles",
        date: playedDate,
        teamA,
        teamB,
        scoreA,
        scoreB,
        sets: [{ a: scoreA, b: scoreB }],
        played: true
      };

      const updatedData = { ...data };
      if (!updatedData.matches) updatedData.matches = [];

      const idx = updatedData.matches.findIndex(m => m.id === syncId);
      if (idx !== -1) {
        updatedData.matches[idx] = {
          ...updatedData.matches[idx],
          ...formattedMatch
        };
      } else {
        updatedData.matches.push(formattedMatch);
      }

      // Tính toán lại Elo và lưu dữ liệu toàn cục
      const finalData = recalculateAllElos(updatedData);
      saveClubData(finalData);
      setData(finalData);
    }

    // Đóng giao diện nhập điểm
    setActiveScoringMatch(null);
    setScoringError("");
  };

  const handleDeleteMatch = (matchId) => {
    if (isEventLocked) {
      alert("Sự kiện này đã bị khóa. Không thể xóa trận đấu.");
      return;
    }

    if (!isAdmin) {
      alert("Vui lòng mở khóa quyền Admin (PIN) trên thanh menu để xóa trận đấu.");
      return;
    }
    if (!window.confirm("Bạn có chắc muốn xóa trận đấu này khỏi lịch thi đấu bốc thăm?")) return;
    
    if (activeScenario === "mixer") {
      setDrawData(prev => {
        if (!prev) return null;
        return prev.map(round => ({
          ...round,
          matches: round.matches.filter(m => m.matchId !== matchId)
        }));
      });
    } else if (activeScenario === "roundrobin") {
      setDrawData(prev => {
        if (!prev || !prev.rounds) return null;
        return {
          ...prev,
          rounds: prev.rounds.map(round => ({
            ...round,
            matches: round.matches.filter(m => m.matchId !== matchId)
          }))
        };
      });
    } else if (activeScenario === "elimination") {
      setDrawData(prev => {
        if (!prev || !prev.rounds) return null;
        return {
          ...prev,
          rounds: prev.rounds.map(round => ({
            ...round,
            matches: round.matches.filter(m => m.matchId !== matchId)
          }))
        };
      });
    }

    // --- ĐỒNG BỘ XÓA TỨC THÌ VÀO DATABASE TOÀN CỤC CỦA CLB ---
    if (selectedEventId) {
      const syncId = matchId.startsWith("match_") ? `match_draw_${matchId.substring(6)}` : `match_draw_${matchId}`;
      const updatedData = { ...data };
      if (updatedData.matches) {
        const initialLength = updatedData.matches.length;
        updatedData.matches = updatedData.matches.filter(m => m.id !== syncId);
        
        if (updatedData.matches.length !== initialLength) {
          const finalData = recalculateAllElos(updatedData);
          saveClubData(finalData);
          setData(finalData);
        }
      }
    }
  };

  const handleFinalizeDraw = () => {
    if (isEventLocked) {
      alert("Sự kiện này đã bị khóa. Không thể chốt kết quả lịch đấu.");
      return;
    }

    if (!isAdmin) {
      alert("Vui lòng mở khóa quyền Admin (PIN) trên thanh menu để chốt kết quả bốc thăm.");
      return;
    }

    if (!selectedEventId) {
      alert("Vui lòng liên kết với một Sự kiện / Giải đấu trước khi chốt kết quả.");
      return;
    }

    let allDrawMatches = [];
    
    if (activeScenario === "mixer") {
      if (drawData) {
        drawData.forEach(round => {
          round.matches.forEach(m => {
            allDrawMatches.push(m);
          });
        });
      }
    } else if (activeScenario === "roundrobin") {
      if (drawData && drawData.rounds) {
        drawData.rounds.forEach(round => {
          round.matches.forEach(m => {
            allDrawMatches.push(m);
          });
        });
      }
    } else if (activeScenario === "elimination") {
      if (drawData && drawData.rounds) {
        drawData.rounds.forEach(round => {
          round.matches.forEach(m => {
            if (!m.isByeMatch) allDrawMatches.push(m);
          });
        });
      }
    }

    if (allDrawMatches.length === 0) {
      alert("Không tìm thấy lịch đấu nào để đồng bộ. Vui lòng phát sinh lịch đấu trước.");
      return;
    }

    const eventName = events.find(ev => ev.id === selectedEventId)?.name || "sự kiện đã chọn";
    const playedCount = allDrawMatches.filter(m => m.played).length;
    const unplayedCount = allDrawMatches.length - playedCount;

    if (!window.confirm(`Bạn có chắc chắn muốn chốt lịch thi đấu này vào sự kiện "${eventName}"?\n- Tổng số: ${allDrawMatches.length} trận (${playedCount} trận đã đấu, ${unplayedCount} trận chưa đấu).\n- Các trận chưa đấu sẽ hiển thị "Chưa đấu" và có thể cập nhật kết quả sau.\n- Điểm Elo sẽ chỉ tính toán cho các trận đấu đã ghi nhận điểm.`)) {
      return;
    }

    // Định dạng các trận đấu theo chuẩn của database
    const formattedMatches = allDrawMatches.map(m => {
      const syncId = m.matchId.startsWith("match_") ? `match_draw_${m.matchId.substring(6)}` : `match_draw_${m.matchId}`;
      const isPlayed = m.played || false;
      return {
        id: syncId,
        eventId: selectedEventId,
        type: m.teamA.length === 1 ? "singles" : "doubles",
        date: m.date || new Date().toISOString(),
        teamA: m.teamA,
        teamB: m.teamB,
        scoreA: isPlayed ? (parseInt(m.scoreA) || 0) : 0,
        scoreB: isPlayed ? (parseInt(m.scoreB) || 0) : 0,
        sets: isPlayed ? [{ a: parseInt(m.scoreA) || 0, b: parseInt(m.scoreB) || 0 }] : [],
        played: isPlayed
      };
    });

    // Sao chép dữ liệu hiện tại
    const updatedData = { ...data };
    if (!updatedData.matches) updatedData.matches = [];

    // Nhập các trận đấu vào danh sách chung, cập nhật nếu đã tồn tại
    let newCount = 0;
    let updateCount = 0;

    formattedMatches.forEach(newMatch => {
      const idx = updatedData.matches.findIndex(m => m.id === newMatch.id);
      if (idx !== -1) {
        updatedData.matches[idx] = {
          ...updatedData.matches[idx],
          ...newMatch
        };
        updateCount++;
      } else {
        updatedData.matches.push(newMatch);
        newCount++;
      }
    });

    // Tính toán lại Elo và lưu dữ liệu toàn cục
    const finalData = recalculateAllElos(updatedData);
    saveClubData(finalData);
    setData(finalData);

    alert(`🎉 Đồng bộ thành công!\n- Đã ghi nhận ${newCount} trận đấu mới.\n- Cập nhật ${updateCount} trận đấu cũ.\nVào sự kiện "${eventName}". Điểm Elo đã được cập nhật chính xác!`);
  };

  return (
    <div className="draw-container animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        .draw-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .draw-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .draw-title {
          font-size: 1.75rem;
          font-weight: 800;
        }

        .draw-title svg {
          color: var(--accent-neon-green);
        }

        /* Toggle Kịch bản bốc thăm */
        .scenario-toggle {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 6px;
          margin-bottom: 28px;
          gap: 8px;
        }

        .scenario-btn {
          padding: 14px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-weight: 700;
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
          font-family: var(--font-primary);
          font-size: 0.95rem;
        }

        .scenario-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.02);
        }

        .scenario-btn.active {
          background: rgba(212, 252, 52, 0.06);
          color: var(--accent-neon-green);
          border: 1px solid rgba(212, 252, 52, 0.15);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        /* Lưới thiết lập cấu hình bốc thăm */
        .setup-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 28px;
          margin-bottom: 32px;
        }

        .config-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .member-selector-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          max-height: 480px;
        }

        .member-checkbox-list {
          overflow-y: auto;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-right: 6px;
          margin-top: 12px;
        }

        .member-check-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.01);
          border: 1px solid rgba(255,255,255,0.02);
          cursor: pointer;
          transition: all 0.15s;
          user-select: none;
        }

        .member-check-item:hover {
          background: rgba(255,255,255,0.03);
          border-color: rgba(255,255,255,0.05);
        }

        .member-check-item.selected {
          background: rgba(0, 236, 255, 0.04);
          border-color: rgba(0, 236, 255, 0.15);
        }

        .member-check-item input {
          width: 16px;
          height: 16px;
          accent-color: var(--accent-electric-blue);
          cursor: pointer;
        }

        .fixed-team-creator {
          background: rgba(0,0,0,0.2);
          padding: 16px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Giao diện kết quả lịch bốc thăm */
        .draw-results-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .draw-actions-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .round-box {
          padding: 16px;
          margin-bottom: 16px;
        }

        .round-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--accent-neon-green);
          margin-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mixer-sitout-badge {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .round-matches-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 12px;
        }

        .match-draw-card {
          padding: 12px 14px;
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          position: relative;
        }

        .match-court-header {
          font-size: 0.72rem;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 750;
          letter-spacing: 0.05em;
        }

        .match-teams-score-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .draw-team-box {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .draw-team-name {
          font-weight: 700;
          font-size: 0.85rem;
          color: #fff;
        }

        .draw-team-members {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .draw-score-box {
          font-size: 1.35rem;
          font-weight: 850;
          width: 36px;
          text-align: center;
          color: var(--accent-neon-green);
        }

        .btn-draw-record {
          align-self: flex-end;
          padding: 4px 10px;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .match-badge-played {
          font-size: 0.72rem;
          padding: 3px 6px;
          background: rgba(46, 213, 115, 0.08);
          border: 1px solid rgba(46, 213, 115, 0.2);
          color: var(--color-success);
          font-weight: 700;
          border-radius: 6px;
          align-self: flex-end;
        }

        /* Bracket Sơ đồ loại trực tiếp (Kịch bản 3) */
        .bracket-scroll-container {
          overflow-x: auto;
          display: flex;
          gap: 40px;
          padding: 20px 0;
          min-height: 480px;
        }

        .bracket-round-column {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          min-width: 280px;
        }

        .bracket-match-wrapper {
          padding: 10px 0;
        }

        /* Giao diện Nhập điểm Popup */
        .scoring-popup-overlay {
          position: fixed;
          inset: 0;
          z-index: 1100;
          background: rgba(4, 5, 8, 0.8);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .scoring-popup-card {
          width: 100%;
          max-width: 440px;
          padding: 28px;
        }

        .score-adjust-flex {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          margin: 24px 0;
        }

        .score-team-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .score-adjust-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: rgba(255,255,255,0.03);
          color: #fff;
          cursor: pointer;
          font-weight: 700;
        }

        .score-adjust-btn:hover {
          background: rgba(255,255,255,0.08);
        }

        .score-num-display {
          font-size: 2.25rem;
          font-weight: 800;
          color: #fff;
        }

        /* Stepper Control */
        .stepper-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 4px;
          width: 100%;
          height: 42px;
          box-sizing: border-box;
        }

        .stepper-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          border-radius: 6px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .stepper-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--accent-electric-blue);
        }

        .stepper-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .stepper-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .stepper-value {
          font-family: var(--font-primary);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          user-select: none;
        }

        /* Responsive */
        @media (max-width: 860px) {
          .setup-grid {
            grid-template-columns: 1fr;
          }
          .scenario-btn {
            font-size: 0.82rem;
            padding: 10px 4px;
          }
        }
      `}} />

      <div className="draw-header">
        <Shuffle size={28} />
        <h1 className="draw-title">Bốc Thăm & Xếp Lịch Thi Đấu</h1>
      </div>

      {/* CHỌN KỊCH BẢN ĐẤU */}
      <div className="scenario-toggle">
        <button 
          className={`scenario-btn ${activeScenario === "mixer" ? "active" : ""}`}
          onClick={() => { if (!drawGenerated) { setActiveScenario("mixer"); } else { alert("Vui lòng hủy lịch đấu hiện tại trước khi đổi thể thức."); } }}
        >
          Kịch bản 1: Xoay Tua
        </button>
        <button 
          className={`scenario-btn ${activeScenario === "roundrobin" ? "active" : ""}`}
          onClick={() => { if (!drawGenerated) { setActiveScenario("roundrobin"); } else { alert("Vui lòng hủy lịch đấu hiện tại trước khi đổi thể thức."); } }}
        >
          Kịch bản 2: Vòng Tròn
        </button>
        <button 
          className={`scenario-btn ${activeScenario === "elimination" ? "active" : ""}`}
          onClick={() => { if (!drawGenerated) { setActiveScenario("elimination"); } else { alert("Vui lòng hủy lịch đấu hiện tại trước khi đổi thể thức."); } }}
        >
          Kịch bản 3: Loại Trực Tiếp
        </button>
      </div>

      {/* --- GIAO DIỆN THIẾT LẬP (KHI CHƯA PHÁT SINH LỊCH ĐẤU) --- */}
      {!drawGenerated && (
        <div className="setup-grid">
          {/* CỘT 1: CẤU HÌNH KỊCH BẢN */}
          <div className="glass-panel config-card animate-fade-in">
            <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>Cấu Hình Thể Thức</h3>

            {/* Chọn Giải đấu / Sự kiện */}
            <div className="form-group">
              <label className="form-label">Sự kiện / Giải đấu liên kết</label>
              <select className="form-select" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
                <option value="">-- Chọn sự kiện liên kết --</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>

            {/* --- Cấu hình Mixer (Kịch bản 1) --- */}
            {activeScenario === "mixer" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade-in">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">Số lượng sân thi đấu</label>
                    <div className="stepper-container">
                      <button 
                        type="button" 
                        className="stepper-btn" 
                        onClick={() => setMixerCourts(prev => Math.max(1, prev - 1))}
                        disabled={mixerCourts <= 1}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="stepper-value">{mixerCourts}</span>
                      <button 
                        type="button" 
                        className="stepper-btn" 
                        onClick={() => setMixerCourts(prev => prev + 1)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {selectedMemberIds.length < mixerCourts * 4 && (
                      <div style={{ fontSize: "0.75rem", color: "var(--accent-electric-blue)", marginTop: "4px", lineHeight: "1.4" }}>
                        ⚠️ Cần chọn ít nhất {mixerCourts * 4} người chơi để đấu đủ {mixerCourts} sân (hiện đang chọn {selectedMemberIds.length} người).
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số lượt trận muốn sinh</label>
                    <input 
                      type="number" 
                      min={1} 
                      max={12} 
                      className="form-input" 
                      value={mixerRounds} 
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setMixerRounds('');
                        } else {
                          const parsed = parseInt(val);
                          if (!isNaN(parsed)) {
                            setMixerRounds(parsed);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (mixerRounds === '' || mixerRounds < 1) {
                          setMixerRounds(1);
                        }
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px", alignItems: "center" }}>
                  <div className="form-group">
                    <label className="form-label">Chế độ ghép cặp (Elo)</label>
                    <select 
                      className="form-select" 
                      value={mixerMatchmaking} 
                      onChange={e => setMixerMatchmaking(e.target.value)}
                    >
                      <option value="rotation">Xoay vòng đa dạng (Mặc định)</option>
                      <option value="balanced">Cân bằng sức mạnh (Mạnh + Yếu)</option>
                      <option value="similar">Trình độ ngang tài ngang sức</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "16px" }}>
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
                      <input 
                        type="checkbox" 
                        checked={mixerPrioritizeSimilarEarly} 
                        onChange={e => setMixerPrioritizeSimilarEarly(e.target.checked)}
                        style={{ width: "16px", height: "16px", accentColor: "var(--accent-neon-green)", cursor: "pointer" }}
                      />
                      <span>Ngang cơ đầu giải</span>
                    </label>
                  </div>
                </div>

                <div style={{ padding: "14px", background: "rgba(0,236,255,0.03)", border: "1px solid rgba(0,236,255,0.1)", borderRadius: "8px", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                  💡 <strong>Kịch bản Xoay Tua:</strong> Thích hợp cho sinh hoạt CLB. Thuật toán tự động xếp lịch sao cho <strong>mọi người ra sân công bằng</strong>, hạn chế ngồi ngoài trùng nhau và hỗ trợ <strong>cân đối trình độ dựa trên điểm Elo</strong> của từng thành viên.
                </div>
              </div>
            )}

            {/* --- Cấu hình Vòng tròn (Kịch bản 2) --- */}
            {activeScenario === "roundrobin" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade-in">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">Thể thức thi đấu</label>
                    <select className="form-select" value={rrFormat} onChange={e => setRrFormat(e.target.value)}>
                      <option value="doubles">Đánh Đôi (2v2)</option>
                      <option value="singles">Đánh Đơn (1v1)</option>
                    </select>
                  </div>
                  {rrFormat === "doubles" && (
                    <div className="form-group">
                      <label className="form-label">Lập cặp đôi</label>
                      <select className="form-select" value={rrDoublesMode} onChange={e => setRrDoublesMode(e.target.value)}>
                        <option value="auto">Tự động ghép ngẫu nhiên</option>
                        <option value="fixed">Ghép cặp cố định thủ công</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Nếu chọn ghép cặp đôi cố định thủ công */}
                {rrFormat === "doubles" && rrDoublesMode === "fixed" && (
                  <div className="fixed-team-creator">
                    <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--accent-electric-blue)" }}>Thêm Cặp Đôi Cố Định</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <select className="form-select" value={rrTempP1} onChange={e => setRrTempP1(e.target.value)}>
                        <option value="">-- Đấu thủ 1 --</option>
                        {selectedMemberIds.map(id => (
                          <option key={id} value={id}>{getPlayerName(id)}</option>
                        ))}
                      </select>
                      <select className="form-select" value={rrTempP2} onChange={e => setRrTempP2(e.target.value)}>
                        <option value="">-- Đấu thủ 2 --</option>
                        {selectedMemberIds.map(id => (
                          <option key={id} value={id}>{getPlayerName(id)}</option>
                        ))}
                      </select>
                    </div>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Tên đội (Mặc định: Tên hai người)"
                      value={rrTempTeamName}
                      onChange={e => setRrTempTeamName(e.target.value)}
                    />
                    <button className="btn-electric-blue" onClick={() => handleAddFixedTeam("rr")} style={{ padding: "8px" }}>
                      Thêm vào danh sách đấu
                    </button>

                    {/* Danh sách cặp đấu cố định hiện tại */}
                    {rrFixedTeams.length > 0 && (
                      <div style={{ marginTop: "8px", borderTop: "1px dashed rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Danh sách cặp đấu ({rrFixedTeams.length}):</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                          {rrFixedTeams.map(team => (
                            <div key={team.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}>
                              <span style={{ fontSize: "0.82rem", fontWeight: "600" }}>{team.name}</span>
                              <button onClick={() => handleRemoveFixedTeam("rr", team.id)} style={{ background: "transparent", border: "none", color: "var(--color-danger)", cursor: "pointer" }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* --- Cấu hình Loại trực tiếp (Kịch bản 3) --- */}
            {activeScenario === "elimination" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade-in">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">Thể thức thi đấu</label>
                    <select className="form-select" value={elimFormat} onChange={e => setElimFormat(e.target.value)}>
                      <option value="doubles">Đánh Đôi (2v2)</option>
                      <option value="singles">Đánh Đơn (1v1)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Xếp lịch hạt giống</label>
                    <select className="form-select" value={elimSeeding} onChange={e => setElimSeeding(e.target.value)}>
                      <option value="elo">Theo điểm xếp hạng ELO</option>
                      <option value="random">Bốc thăm ngẫu nhiên</option>
                    </select>
                  </div>
                </div>

                {elimFormat === "doubles" && (
                  <div className="form-group">
                    <label className="form-label">Lập cặp đôi</label>
                    <select className="form-select" value={elimDoublesMode} onChange={e => setElimDoublesMode(e.target.value)}>
                      <option value="auto">Tự động ghép ngẫu nhiên</option>
                      <option value="fixed">Ghép cặp cố định thủ công</option>
                    </select>
                  </div>
                )}

                {/* Nếu chọn ghép cặp đôi cố định thủ công ở loại trực tiếp */}
                {elimFormat === "doubles" && elimDoublesMode === "fixed" && (
                  <div className="fixed-team-creator">
                    <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--accent-electric-blue)" }}>Thêm Cặp Đôi Loại Trực Tiếp</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <select className="form-select" value={elimTempP1} onChange={e => setElimTempP1(e.target.value)}>
                        <option value="">-- Đấu thủ 1 --</option>
                        {selectedMemberIds.map(id => (
                          <option key={id} value={id}>{getPlayerName(id)}</option>
                        ))}
                      </select>
                      <select className="form-select" value={elimTempP2} onChange={e => setElimTempP2(e.target.value)}>
                        <option value="">-- Đấu thủ 2 --</option>
                        {selectedMemberIds.map(id => (
                          <option key={id} value={id}>{getPlayerName(id)}</option>
                        ))}
                      </select>
                    </div>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Tên đội (Mặc định: Tên hai người)"
                      value={elimTempTeamName}
                      onChange={e => setElimTempTeamName(e.target.value)}
                    />
                    <button className="btn-electric-blue" onClick={() => handleAddFixedTeam("elim")} style={{ padding: "8px" }}>
                      Thêm vào danh sách đấu
                    </button>

                    {/* Danh sách cặp đấu loại trực tiếp cố định */}
                    {elimFixedTeams.length > 0 && (
                      <div style={{ marginTop: "8px", borderTop: "1px dashed rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Danh sách cặp đấu ({elimFixedTeams.length}):</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                          {elimFixedTeams.map(team => (
                            <div key={team.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "4px" }}>
                              <span style={{ fontSize: "0.82rem", fontWeight: "600" }}>{team.name}</span>
                              <button onClick={() => handleRemoveFixedTeam("elim", team.id)} style={{ background: "transparent", border: "none", color: "var(--color-danger)", cursor: "pointer" }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Nút hành động */}
            <button 
              className="btn-neon-green" 
              onClick={handleGenerateDraw} 
              style={{ marginTop: "12px", width: "100%", justifyContent: "center" }}
              disabled={selectedMemberIds.length === 0}
            >
              <Shuffle size={16} /> Bắt Đầu Bốc Thăm Lịch Đấu
            </button>
          </div>

          {/* CỘT 2: CHỌN ĐẤU THỦ THAM GIA */}
          <div className="glass-panel member-selector-card animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>Đấu Thủ Tham Gia ({selectedMemberIds.length})</h3>
              <button className="btn-secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={handleSelectAllMembers}>
                {selectedMemberIds.length === members.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>
            
            <div className="member-checkbox-list">
              {members.map(member => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <div 
                    key={member.id} 
                    className={`member-check-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleToggleMember(member.id)}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => {}} // Đã được xử lý bởi onClick cha
                    />
                    <div className="player-avatar player-avatar-sm" style={{ backgroundColor: member.avatarColor, width: "24px", height: "24px", fontSize: "0.72rem" }}>
                      {member.name.charAt(0)}
                    </div>
                    <span style={{ fontSize: "0.88rem", fontWeight: "600", color: isSelected ? "#fff" : "var(--text-secondary)" }}>
                      {member.name}
                    </span>
                    <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                      {member.elo} Elo
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- GIAO DIỆN HIỂN THỊ LỊCH ĐẤU SAU KHI ĐÃ BỐC THĂM --- */}
      {drawGenerated && drawData && (
        <div className="draw-results-container animate-fade-in">
          <div className="draw-actions-top" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontStyle: "italic", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Thể thức: <strong>
                  {activeScenario === "mixer" && "Kịch bản 1 - Xoay Tua"}
                  {activeScenario === "roundrobin" && "Kịch bản 2 - Vòng Tròn"}
                  {activeScenario === "elimination" && "Kịch bản 3 - Loại Trực Tiếp"}
                </strong>
              </span>
              <span style={{ fontStyle: "italic", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Sự kiện: <strong>{events.find(ev => ev.id === selectedEventId)?.name || "Chưa gắn kết"}</strong>
              </span>
            </div>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {isAdmin ? (
                <button 
                  className="btn-neon-green" 
                  onClick={handleFinalizeDraw} 
                  style={{ boxShadow: "0 0 15px rgba(212, 252, 52, 0.25)", opacity: isEventLocked ? 0.4 : 1, cursor: isEventLocked ? "not-allowed" : "pointer" }}
                  disabled={isEventLocked}
                >
                  <Check size={16} /> Chốt Kết Quả Lịch Đấu
                </button>
              ) : (
                <button className="btn-neon-green" onClick={() => alert("Vui lòng mở khóa quyền Admin (PIN) trên thanh menu để chốt kết quả bốc thăm.")} style={{ opacity: 0.55 }}>
                  <Check size={16} /> Chốt Kết Quả Lịch Đấu (Yêu cầu Admin)
                </button>
              )}
              
              <button 
                className="btn-secondary" 
                onClick={handleClearDraw} 
                style={{ borderColor: "rgba(255, 71, 87, 0.2)", color: "var(--color-danger)", opacity: isEventLocked ? 0.4 : 1, cursor: isEventLocked ? "not-allowed" : "pointer" }}
                disabled={isEventLocked}
              >
                <Trash2 size={16} /> Hủy Lịch Đấu / Bốc Thăm Lại
              </button>
            </div>
          </div>

          {/* =======================================================
              HIỂN THỊ KỊCH BẢN 1: XOAY TUA (DANH SÁCH CÁC LƯỢT ĐẤU) 
              ======================================================= */}
          {activeScenario === "mixer" && drawData.map((round) => (
            <div key={round.roundIndex} className="glass-panel round-box animate-fade-in">
              <div className="round-title">
                <span>Lượt Trận Thứ {round.roundIndex}</span>
                {round.sittingOut.length > 0 && (
                  <span className="mixer-sitout-badge">
                    Nghỉ lượt này: {round.sittingOut.map(p => getPlayerNameShort(p)).join(", ")}
                  </span>
                )}
              </div>
              
              <div className="round-matches-list">
                {round.matches.map((match) => (
                  <div key={match.matchId} className="match-draw-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px", marginBottom: "4px" }}>
                      <div className="match-court-header" style={{ marginBottom: 0 }}>Sân thi đấu {match.courtIndex}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {match.played ? (
                          <span className="match-badge-played" style={{ alignSelf: "auto", margin: 0, padding: "2px 6px", fontSize: "0.68rem" }}><Check size={10} /> Đã ghi điểm</span>
                        ) : (
                          <button 
                            className="btn-neon-green btn-draw-record" 
                            onClick={() => handleOpenScoring(match)} 
                            style={{ alignSelf: "auto", margin: 0, padding: "4px 8px", fontSize: "0.72rem", opacity: isEventLocked ? 0.4 : 1, cursor: isEventLocked ? "not-allowed" : "pointer" }}
                            disabled={isEventLocked}
                          >
                            <Swords size={10} /> Nhập kết quả
                          </button>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteMatch(match.matchId)} 
                            style={{ 
                              background: "transparent", 
                              border: "none", 
                              color: "var(--color-danger)", 
                              cursor: isEventLocked ? "not-allowed" : "pointer", 
                              display: "flex", 
                              alignItems: "center", 
                              padding: "4px",
                              transition: "transform 0.15s ease",
                              borderRadius: "4px",
                              opacity: isEventLocked ? 0.3 : 1
                            }}
                            title={isEventLocked ? "Sự kiện đã bị khóa" : "Xóa trận đấu"}
                            disabled={isEventLocked}
                            onMouseEnter={(e) => { if (!isEventLocked) e.currentTarget.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={(e) => { if (!isEventLocked) e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="match-teams-score-row">
                      {/* Đội A */}
                      <div className="draw-team-box">
                        <span className="draw-team-members" style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff" }}>
                          {match.teamA.map(p => getPlayerName(p)).join(" + ")}
                        </span>
                      </div>
                      
                      {/* Điểm số */}
                      {match.played ? (
                        <div className="draw-score-box">
                          {match.scoreA} : {match.scoreB}
                        </div>
                      ) : (
                        <div className="draw-score-box" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>VS</div>
                      )}

                      {/* Đội B */}
                      <div className="draw-team-box" style={{ textAlign: "right" }}>
                        <span className="draw-team-members" style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff" }}>
                          {match.teamB.map(p => getPlayerName(p)).join(" + ")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* =======================================================
              HIỂN THỊ KỊCH BẢN 2: VÒNG TRÒN (ĐẤU VÒNG TRÒN) 
              ======================================================= */}
          {activeScenario === "roundrobin" && drawData.rounds.map((round) => (
            <div key={round.roundIndex} className="glass-panel round-box animate-fade-in">
              <div className="round-title">Vòng Đấu Thứ {round.roundIndex}</div>
              
              <div className="round-matches-list">
                {round.matches.map((match) => (
                  <div key={match.matchId} className="match-draw-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px", marginBottom: "4px" }}>
                      <div className="match-court-header" style={{ marginBottom: 0 }}>Trận đấu</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {match.played ? (
                          <span className="match-badge-played" style={{ alignSelf: "auto", margin: 0, padding: "2px 6px", fontSize: "0.68rem" }}><Check size={10} /> Đã ghi điểm</span>
                        ) : (
                          <button 
                            className="btn-neon-green btn-draw-record" 
                            onClick={() => handleOpenScoring(match)} 
                            style={{ alignSelf: "auto", margin: 0, padding: "4px 8px", fontSize: "0.72rem", opacity: isEventLocked ? 0.4 : 1, cursor: isEventLocked ? "not-allowed" : "pointer" }}
                            disabled={isEventLocked}
                          >
                            <Swords size={10} /> Nhập kết quả
                          </button>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteMatch(match.matchId)} 
                            style={{ 
                              background: "transparent", 
                              border: "none", 
                              color: "var(--color-danger)", 
                              cursor: isEventLocked ? "not-allowed" : "pointer", 
                              display: "flex", 
                              alignItems: "center", 
                              padding: "4px",
                              transition: "transform 0.15s ease",
                              borderRadius: "4px",
                              opacity: isEventLocked ? 0.3 : 1
                            }}
                            title={isEventLocked ? "Sự kiện đã bị khóa" : "Xóa trận đấu"}
                            disabled={isEventLocked}
                            onMouseEnter={(e) => { if (!isEventLocked) e.currentTarget.style.transform = 'scale(1.15)'; }}
                            onMouseLeave={(e) => { if (!isEventLocked) e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="match-teams-score-row">
                      {/* Đội A */}
                      <div className="draw-team-box">
                        <span className="draw-team-name" style={{ fontSize: "0.85rem", color: "#fff" }}>{match.teamAName}</span>
                        {match.teamA && match.teamA.length > 0 && (
                          <span className="draw-team-members" style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            ({match.teamA.map(p => getPlayerNameShort(p)).join(" + ")})
                          </span>
                        )}
                      </div>
                      
                      {/* Điểm số */}
                      {match.played ? (
                        <div className="draw-score-box">
                          {match.scoreA} : {match.scoreB}
                        </div>
                      ) : (
                        <div className="draw-score-box" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>VS</div>
                      )}

                      {/* Đội B */}
                      <div className="draw-team-box" style={{ textAlign: "right" }}>
                        <span className="draw-team-name" style={{ fontSize: "0.85rem", color: "#fff" }}>{match.teamBName}</span>
                        {match.teamB && match.teamB.length > 0 && (
                          <span className="draw-team-members" style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            ({match.teamB.map(p => getPlayerNameShort(p)).join(" + ")})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* =======================================================
              HIỂN THỊ KỊCH BẢN 3: ELIMINATION (SƠ ĐỒ CÂY LOẠI TRỰC TIẾP) 
              ======================================================= */}
          {activeScenario === "elimination" && (
            <div className="glass-panel round-box bracket-scroll-container animate-fade-in">
              {drawData.rounds.map((round, rIdx) => (
                <div key={rIdx} className="bracket-round-column">
                  <div style={{ textAlign: "center", fontWeight: "800", color: "var(--accent-neon-green)", marginBottom: "20px", textTransform: "uppercase", fontSize: "0.9rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                    {round.roundName}
                  </div>
                  
                  {round.matches.map((match) => {
                    const isAEmpty = !match.teamA || match.teamA.length === 0;
                    const isBEmpty = !match.teamB || match.teamB.length === 0;
                    
                    return (
                      <div key={match.matchId} className="bracket-match-wrapper">
                        <div 
                          className="match-draw-card" 
                          style={{ 
                            minWidth: "250px", 
                            padding: "14px", 
                            opacity: (isAEmpty || isBEmpty) ? 0.4 : 1,
                            borderColor: match.winner ? "rgba(46, 213, 115, 0.2)" : "rgba(255,255,255,0.03)"
                          }}
                        >
                          {isAdmin && !match.isByeMatch && (
                            <button 
                              onClick={() => handleDeleteMatch(match.matchId)} 
                              style={{ 
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                background: "transparent", 
                                border: "none", 
                                color: "var(--color-danger)", 
                                cursor: isEventLocked ? "not-allowed" : "pointer", 
                                display: "flex", 
                                alignItems: "center", 
                                padding: "4px",
                                transition: "transform 0.15s ease",
                                zIndex: 10,
                                opacity: isEventLocked ? 0.3 : 1
                              }}
                              title={isEventLocked ? "Sự kiện đã bị khóa" : "Xóa trận đấu"}
                              disabled={isEventLocked}
                              onMouseEnter={(e) => { if (!isEventLocked) e.currentTarget.style.transform = 'scale(1.15)'; }}
                              onMouseLeave={(e) => { if (!isEventLocked) e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingRight: (isAdmin && !match.isByeMatch) ? "14px" : "0" }}>
                            {/* Team A */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: match.winner === match.teamAName ? "var(--accent-neon-green)" : "#fff" }}>
                                  {match.teamAName}
                                </span>
                              </div>
                              {match.played && <span style={{ fontWeight: "850", color: "var(--accent-electric-blue)", fontSize: "1.1rem" }}>{match.scoreA}</span>}
                            </div>
                            
                            <div style={{ height: "1px", background: "rgba(255,255,255,0.04)" }} />

                            {/* Team B */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: match.winner === match.teamBName ? "var(--accent-neon-green)" : "#fff" }}>
                                  {match.teamBName}
                                </span>
                              </div>
                              {match.played && <span style={{ fontWeight: "850", color: "var(--accent-electric-blue)", fontSize: "1.1rem" }}>{match.scoreB}</span>}
                            </div>
                          </div>

                          {/* Nhập điểm (nếu có đủ 2 đội và chưa đấu, và không phải trận đấu tự động Bye) */}
                          {!match.played && !isAEmpty && !isBEmpty && !match.isByeMatch && (
                            <button 
                              className="btn-neon-green btn-draw-record" 
                              onClick={() => handleOpenScoring(match)} 
                              style={{ marginTop: "8px", opacity: isEventLocked ? 0.4 : 1, cursor: isEventLocked ? "not-allowed" : "pointer" }}
                              disabled={isEventLocked}
                            >
                              <Swords size={12} /> Ghi điểm
                            </button>
                          )}

                          {match.isByeMatch && (
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", marginTop: "4px" }}>
                              Được miễn đấu vòng này
                            </span>
                          )}

                          {match.winner && !match.isByeMatch && (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--accent-neon-green)", fontSize: "0.74rem", fontWeight: "700", marginTop: "6px", alignSelf: "center" }}>
                              <Award size={14} /> {match.winner} thắng!
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =======================================================
          POPUP NHẬP ĐIỂM SỐ TRỰC TIẾP
          ======================================================= */}
      {activeScoringMatch && (
        <div className="scoring-popup-overlay">
          <div className="glass-panel scoring-popup-card glow-border-green animate-slide-up">
            <h3 style={{ fontSize: "1.25rem", fontWeight: "800", textOrigin: "center", textAlign: "center" }}>
              Ghi Kết Quả Trận Đấu
            </h3>
            
            <div style={{ textAlign: "center", marginTop: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Sự kiện: {events.find(ev => ev.id === selectedEventId)?.name}
            </div>

            <div className="score-adjust-flex">
              {/* Đội A */}
              <div className="score-team-panel">
                <span style={{ fontSize: "0.9rem", fontWeight: "700", textAlign: "center", color: "var(--accent-electric-blue)", display: "block", maxHeight: "40px", overflow: "hidden" }}>
                  {activeScoringMatch.teamAName}
                </span>
                <span className="score-num-display">{set1A}</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="score-adjust-btn" onClick={() => setSet1A(Math.max(0, set1A - 1))}>-</button>
                  <button className="score-adjust-btn" onClick={() => setSet1A(set1A + 1)}>+</button>
                </div>
              </div>

              <span style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--text-muted)" }}>:</span>

              {/* Đội B */}
              <div className="score-team-panel">
                <span style={{ fontSize: "0.9rem", fontWeight: "700", textAlign: "center", color: "var(--accent-neon-green)", display: "block", maxHeight: "40px", overflow: "hidden" }}>
                  {activeScoringMatch.teamBName}
                </span>
                <span className="score-num-display">{set1B}</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="score-adjust-btn" onClick={() => setSet1B(Math.max(0, set1B - 1))}>-</button>
                  <button className="score-adjust-btn" onClick={() => setSet1B(set1B + 1)}>+</button>
                </div>
              </div>
            </div>

            {scoringError && (
              <div style={{ color: "var(--color-danger)", fontSize: "0.8rem", textAlign: "center", fontWeight: "600", marginBottom: "16px" }}>
                {scoringError}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button className="btn-secondary" style={{ width: "50%" }} onClick={() => setActiveScoringMatch(null)}>
                Hủy
              </button>
              <button className="btn-neon-green" style={{ width: "50%" }} onClick={handleSaveScore}>
                Lưu Kết Quả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
