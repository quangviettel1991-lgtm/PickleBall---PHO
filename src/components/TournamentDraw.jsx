import PropTypes from 'prop-types';
import './TournamentDraw.css';
import Modal from './Modal';
import { useState, useEffect, useMemo } from "react";
import { Shuffle, Check, Plus, Minus, Trash2, Swords, Award } from "lucide-react";
import { saveDraw, clearDraw, updateMatch, deleteMatch, adoptLegacyDraw } from "../utils/db";
import { keys } from "../utils/config";
import { drawMatchId } from "../utils/draws";
import { scoreFromSets } from "../utils/schema";

export default function TournamentDraw({ data, setData, isAdmin }) {
  const { events } = data;
  const members = useMemo(()=>data.members.filter(m=>!m.archivedAt), [data.members]);
  const [selectedEventId, setSelectedEventId] = useState(() => localStorage.getItem(keys.drawEvent) || localStorage.getItem('draw_selected_event_id') || '');
  const selectedEventObj = events.find(e=>e.id===selectedEventId);
  const isEventLocked = selectedEventObj?.isLocked || false;
  const [scenario, setScenario] = useState('mixer');
  const savedDraw = data.draws?.[selectedEventId];
  const activeScenario = savedDraw?.scenario || scenario;
  const setActiveScenario = next => { if (savedDraw?.data) { alert('Hủy lịch hiện tại có xác nhận trước khi đổi thể thức.'); return; } setScenario(next); };
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const drawData = savedDraw?.data || null;
  const drawGenerated = Boolean(drawData);
  const setDrawData = next => setData(saveDraw(selectedEventId, activeScenario, next));
  useEffect(()=>{ localStorage.setItem(keys.drawEvent, selectedEventId); }, [selectedEventId]);
  // Trạng thái cấu hình phụ cho từng kịch bản
  // 1. Kịch bản Mixer
  const [mixerCourts, setMixerCourts] = useState(1);
  const [mixerRounds, setMixerRounds] = useState(4);

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
          // Dùng trọng số cực lớn để đảm bảo TRÁNH LẶP ĐỒNG ĐỘI/ĐỐI THỦ luôn là ưu tiên hàng đầu, cao hơn nhiều so với căn chỉnh Elo!
          const partnerPenalty = (Math.pow(partner12, 2) + Math.pow(partner34, 2)) * 2000; // 1 lần trùng phạt 2000đ (lớn hơn tối đa phạt Elo)
          const opponentPenalty = (Math.pow(opp13, 2) + Math.pow(opp14, 2) + Math.pow(opp23, 2) + Math.pow(opp24, 2)) * 300; // 1 lần trùng phạt 300đ

          let matchImbalancePenalty = partnerPenalty + opponentPenalty;

          // Phát hiện và loại bỏ TUYỆT ĐỐI trận đấu một chiều "Mạnh Mạnh vs Yếu Yếu"
          // (Một đội có cả 2 người đều mạnh hơn cả 2 người đội kia)
          const isOneSided = (Math.min(elo1, elo2) > Math.max(elo3, elo4)) || (Math.min(elo3, elo4) > Math.max(elo1, elo2));
          const oneSidedPenalty = isOneSided ? 20000 : 0;

          // Tính toán điểm phạt trình độ Elo theo nguyên tắc VÒNG XEN KẼ
          let eloPenalty = 0;
          if (r % 2 === 0) {
            // Các vòng lẻ (1, 3, 5...): Ưu tiên Trình độ ngang cơ trên cùng sân (Elo spread nhỏ nhất)
            const elos = [elo1, elo2, elo3, elo4];
            const spread = Math.max(...elos) - Math.min(...elos);
            eloPenalty = spread * 0.8;
          } else {
            // Các vòng chẵn (2, 4, 6...): Ưu tiên Cân bằng lực lượng (Mạnh + Yếu, chênh lệch Elo 2 đội ít nhất)
            const eloTeamA = (elo1 + elo2) / 2;
            const eloTeamB = (elo3 + elo4) / 2;
            eloPenalty = Math.abs(eloTeamA - eloTeamB) * 1.5;
          }

          // Phạt tránh trùng lặp cả cụm 4 người ở vòng liên tiếp
          let overlapPenalty = 0;
          if (r > 0 && rounds[r - 1]) {
            const currentPlayers = [p1, p2, p3, p4];
            rounds[r - 1].matches.forEach(prevMatch => {
              const prevPlayers = [...prevMatch.teamA, ...prevMatch.teamB];
              const commonCount = currentPlayers.filter(p => prevPlayers.includes(p)).length;
              if (commonCount === 4) {
                overlapPenalty += 15000; // Phạt cực nặng nếu cùng 4 người đổi vị trí
              } else if (commonCount === 3) {
                overlapPenalty += 200;   // Phạt vừa nếu trùng 3 người trên cùng sân
              }
            });
          }

          currentRoundScore += matchImbalancePenalty + oneSidedPenalty + eloPenalty + overlapPenalty;

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
    if (window.confirm('Hủy lịch đấu này và các kết quả thuộc lịch? Hệ thống sẽ lưu bản sao trước thao tác.')) setData(clearDraw(selectedEventId));
  };

  // --- XỬ LÝ NHẬP ĐIỂM SỐ CHO TRẬN BỐC THĂM ---
  const handleOpenScoring = (match) => {
    if (savedDraw?.legacy) { alert("Chọn chốt lịch để đối chiếu và tiếp tục lịch cũ trước khi ghi điểm."); return; }
    if (isEventLocked) {
      alert("Sự kiện này đã bị khóa. Không thể thay đổi hoặc ghi điểm số.");
      return;
    }

    if (!isAdmin) {
      alert("Vui lòng mở khóa tài khoản quản trị trên thanh menu để ghi kết quả thi đấu.");
      return;
    }
    setActiveScoringMatch(match);
    setSet1A(11);
    setSet1B(9);
    setScoringError("");
  };

  const handleSaveScore = () => {
    try {
      const outcome = scoreFromSets([{ a: set1A, b: set1B }]);
      setData(updateMatch({ id: drawMatchId(activeScoringMatch.matchId), ...outcome, date: new Date().toISOString() }));
      setActiveScoringMatch(null); setScoringError('');
    } catch (e) { setScoringError(e.message); }
  };
  const handleDeleteMatch = id => {
    if (window.confirm('Xóa trận khỏi lịch và lịch sử? Bản trước thay đổi sẽ được sao lưu.')) setData(deleteMatch(drawMatchId(id)));
  };
  const handleFinalizeDraw = () => {
    if (savedDraw?.legacy) {
      if (window.confirm('Đưa lịch cũ trên máy vào dữ liệu chung? Các trận chưa có trong lịch sử sẽ được thêm; kết quả đã có trong lịch sử được ưu tiên. Hệ thống sẽ lưu bản sao trước khi thực hiện.')) setData(adoptLegacyDraw(selectedEventId));
      return;
    }
    alert('Lịch và kết quả đã dùng chung dữ liệu. Xem trạng thái đồng bộ ở đầu trang để biết đã lưu trên máy chủ hay đang chờ.');
  };

  return (
    <div className="draw-container animate-fade-in">


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
              <select aria-label="Sự kiện liên kết" className="form-select" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
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
                      <button aria-label="Giảm số sân"
                        type="button"
                        className="stepper-btn"
                        onClick={() => setMixerCourts(prev => Math.max(1, prev - 1))}
                        disabled={mixerCourts <= 1}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="stepper-value">{mixerCourts}</span>
                      <button aria-label="Tăng số sân"
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
                    <input aria-label="Số vòng đấu"
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
                    <select aria-label="Thể thức vòng tròn" className="form-select" value={rrFormat} onChange={e => setRrFormat(e.target.value)}>
                      <option value="doubles">Đánh Đôi (2v2)</option>
                      <option value="singles">Đánh Đơn (1v1)</option>
                    </select>
                  </div>
                  {rrFormat === "doubles" && (
                    <div className="form-group">
                      <label className="form-label">Lập cặp đôi</label>
                      <select aria-label="Cách ghép đôi vòng tròn" className="form-select" value={rrDoublesMode} onChange={e => setRrDoublesMode(e.target.value)}>
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
                      <select aria-label="Thành viên thứ nhất" className="form-select" value={rrTempP1} onChange={e => setRrTempP1(e.target.value)}>
                        <option value="">-- Đấu thủ 1 --</option>
                        {selectedMemberIds.map(id => (
                          <option key={id} value={id}>{getPlayerName(id)}</option>
                        ))}
                      </select>
                      <select aria-label="Thành viên thứ hai" className="form-select" value={rrTempP2} onChange={e => setRrTempP2(e.target.value)}>
                        <option value="">-- Đấu thủ 2 --</option>
                        {selectedMemberIds.map(id => (
                          <option key={id} value={id}>{getPlayerName(id)}</option>
                        ))}
                      </select>
                    </div>
                    <input aria-label="Tên đội vòng tròn"
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
                              <button aria-label={`Xóa đội ${team.name || team.id}`} onClick={() => handleRemoveFixedTeam("rr", team.id)} style={{ background: "transparent", border: "none", color: "var(--color-danger)", cursor: "pointer" }}>
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
                    <select aria-label="Thể thức loại trực tiếp" className="form-select" value={elimFormat} onChange={e => setElimFormat(e.target.value)}>
                      <option value="doubles">Đánh Đôi (2v2)</option>
                      <option value="singles">Đánh Đơn (1v1)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Xếp lịch hạt giống</label>
                    <select aria-label="Cách xếp hạt giống" className="form-select" value={elimSeeding} onChange={e => setElimSeeding(e.target.value)}>
                      <option value="elo">Theo điểm xếp hạng ELO</option>
                      <option value="random">Bốc thăm ngẫu nhiên</option>
                    </select>
                  </div>
                </div>

                {elimFormat === "doubles" && (
                  <div className="form-group">
                    <label className="form-label">Lập cặp đôi</label>
                    <select aria-label="Cách ghép đôi loại trực tiếp" className="form-select" value={elimDoublesMode} onChange={e => setElimDoublesMode(e.target.value)}>
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
                      <select aria-label="Thành viên thứ nhất" className="form-select" value={elimTempP1} onChange={e => setElimTempP1(e.target.value)}>
                        <option value="">-- Đấu thủ 1 --</option>
                        {selectedMemberIds.map(id => (
                          <option key={id} value={id}>{getPlayerName(id)}</option>
                        ))}
                      </select>
                      <select aria-label="Thành viên thứ hai" className="form-select" value={elimTempP2} onChange={e => setElimTempP2(e.target.value)}>
                        <option value="">-- Đấu thủ 2 --</option>
                        {selectedMemberIds.map(id => (
                          <option key={id} value={id}>{getPlayerName(id)}</option>
                        ))}
                      </select>
                    </div>
                    <input aria-label="Tên đội loại trực tiếp"
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
                              <button aria-label={`Xóa đội ${team.name || team.id}`} onClick={() => handleRemoveFixedTeam("elim", team.id)} style={{ background: "transparent", border: "none", color: "var(--color-danger)", cursor: "pointer" }}>
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
                    <input aria-label={`Chọn ${member.name}`}
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
                <button className="btn-neon-green" onClick={() => alert("Vui lòng mở khóa tài khoản quản trị trên thanh menu để chốt kết quả bốc thăm.")} style={{ opacity: 0.55 }}>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "3px", marginBottom: "2px" }}>
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
                      <div className="draw-team-box" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div className="draw-team-members" style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {match.teamA.map((p, idx) => {
                            const player = members.find(m => m.id === p);
                            const name = player ? player.name : "Cựu thành viên";
                            const elo = player ? player.elo : 1200;
                            return (
                              <span key={p} style={{ display: "inline-flex", alignItems: "center" }}>
                                {idx > 0 && <span style={{ marginRight: "4px", marginLeft: "2px" }}>+</span>}
                                <span>{name}</span>
                                <span style={{ color: "var(--accent-electric-blue)", fontSize: "0.75rem", marginLeft: "2px", fontWeight: "700" }}>({elo})</span>
                              </span>
                            );
                          })}
                        </div>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "700" }}>
                          Tổng Elo: <span style={{ color: "var(--accent-neon-green)" }}>{match.teamA.reduce((sum, id) => sum + (members.find(m => m.id === id)?.elo || 1200), 0)}</span>
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
                      <div className="draw-team-box" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", textAlign: "right" }}>
                        <div className="draw-team-members" style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff", display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end" }}>
                          {match.teamB.map((p, idx) => {
                            const player = members.find(m => m.id === p);
                            const name = player ? player.name : "Cựu thành viên";
                            const elo = player ? player.elo : 1200;
                            return (
                              <span key={p} style={{ display: "inline-flex", alignItems: "center" }}>
                                {idx > 0 && <span style={{ marginRight: "4px", marginLeft: "2px" }}>+</span>}
                                <span>{name}</span>
                                <span style={{ color: "var(--accent-electric-blue)", fontSize: "0.75rem", marginLeft: "2px", fontWeight: "700" }}>({elo})</span>
                              </span>
                            );
                          })}
                        </div>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "700" }}>
                          Tổng Elo: <span style={{ color: "var(--accent-neon-green)" }}>{match.teamB.reduce((sum, id) => sum + (members.find(m => m.id === id)?.elo || 1200), 0)}</span>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "3px", marginBottom: "2px" }}>
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
        <Modal isOpen={!!activeScoringMatch} onClose={()=>setActiveScoringMatch(null)} title="Ghi kết quả trận đấu">
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
        </Modal>
      )}
    </div>
  );
}

TournamentDraw.propTypes = {
  data: PropTypes.object,
  setData: PropTypes.func,
  isAdmin: PropTypes.bool,
};
