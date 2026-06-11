import { initialMembers, initialEvents, initialMatches, initialTransactions } from "./mockData";
import { calculateSinglesElo, calculateDoublesElo } from "./elo";
import { updateRemoteData } from "./supabase";

const CLUB_ID = import.meta.env.VITE_CLUB_ID || "1";
const STORAGE_KEY = `pickleball_club_data_${CLUB_ID}`;
const UPDATED_AT_KEY = `pickleball_club_data_updated_at_${CLUB_ID}`;
const SNAPSHOTS_KEY = `pickleball_snapshots_${CLUB_ID}`;
const MAX_SNAPSHOTS = 14;          // Giữ tối đa 14 bản snapshot (~2 tuần)
const SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000; // Tối thiểu 5 phút giữa 2 snapshot liên tiếp
let _lastSnapshotTime = 0;

// Lấy toàn bộ dữ liệu từ localStorage
export function getClubData() {
  const dataStr = localStorage.getItem(STORAGE_KEY);
  if (!dataStr) {
    // Nếu chưa có dữ liệu, khởi tạo bằng dữ liệu mẫu cục bộ nhưng với nhãn thời gian cực kỳ cũ (epoch)
    // để dữ liệu đám mây Supabase (nếu có) luôn được ưu tiên tải về ghi đè lên dữ liệu cục bộ.
    const defaultData = {
      members: initialMembers,
      events: initialEvents,
      matches: initialMatches,
      transactions: initialTransactions
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    localStorage.setItem(UPDATED_AT_KEY, new Date(0).toISOString());
    return defaultData;
  }
  try {
    const data = JSON.parse(dataStr);
    // Tự động nâng cấp cấu trúc dữ liệu cũ (di trú) nếu thiếu trường initialEloSingles hoặc initialEloDoubles
    const needsMigration = data.members && data.members.some(m => m.initialEloSingles === undefined || m.initialEloDoubles === undefined);
    if (needsMigration) {
      console.log("Phát hiện dữ liệu định dạng cũ. Đang tự động tính toán lại Elo Đơn và Đôi...");
      recalculateAllElos(data);
      // Ghi lại dữ liệu mới vào localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // Tự động đồng bộ lên đám mây với nhãn thời gian hiện tại
      const timestamp = new Date().toISOString();
      localStorage.setItem(UPDATED_AT_KEY, timestamp);
      updateRemoteData(data, timestamp);
    }
    return data;
  } catch (e) {
    console.error("Lỗi parse dữ liệu từ localStorage, thiết lập lại dữ liệu mẫu cục bộ", e);
    const defaultData = {
      members: initialMembers,
      events: initialEvents,
      matches: initialMatches,
      transactions: initialTransactions
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    localStorage.setItem(UPDATED_AT_KEY, new Date(0).toISOString());
    return defaultData;
  }
}

// Lưu dữ liệu vào localStorage
export function saveClubData(data) {
  const timestamp = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(UPDATED_AT_KEY, timestamp);
  // Tự động tạo snapshot (có throttle 5 phút)
  _autoSaveSnapshot(data, timestamp);
  // Đồng bộ ngầm lên đám mây Supabase
  updateRemoteData(data, timestamp).then(success => {
    if (success) {
      console.log("Đồng bộ đám mây Supabase thành công!");
    }
  });
}

// ---------------------------------------------------------------------------
// HỆ THỐNG SNAPSHOT (Lưu lịch sử phiên bản để phòng tránh mất dữ liệu)
// ---------------------------------------------------------------------------

/**
 * [Nội bộ] Tự động lưu snapshot với throttle (tối thiểu 5 phút/lần).
 */
function _autoSaveSnapshot(data, timestamp) {
  const now = Date.now();
  if (now - _lastSnapshotTime < SNAPSHOT_THROTTLE_MS) return;
  _lastSnapshotTime = now;
  _writeSnapshot(data, timestamp, "auto");
}

/**
 * [Nội bộ] Ghi 1 bản snapshot vào danh sách, giữ tối đa MAX_SNAPSHOTS bản.
 */
function _writeSnapshot(data, timestamp, label = "auto") {
  try {
    const snapshots = getSnapshots();
    const snapshot = {
      timestamp,
      label,
      membersCount: data.members ? data.members.length : 0,
      eventsCount: data.events ? data.events.length : 0,
      matchesCount: data.matches ? data.matches.length : 0,
      data: JSON.parse(JSON.stringify(data)) // deep clone
    };
    snapshots.unshift(snapshot); // Thêm vào đầu (mới nhất trước)
    // Giữ tối đa MAX_SNAPSHOTS bản
    const trimmed = snapshots.slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(trimmed));
    console.log(`[Snapshot] Đã lưu snapshot lúc ${timestamp} (${trimmed.length}/${MAX_SNAPSHOTS} bản)`);
  } catch (e) {
    console.warn("[Snapshot] Không thể lưu snapshot:", e);
  }
}

/**
 * Lấy danh sách tất cả bản snapshot đang lưu trong localStorage.
 * @returns {Array} Mảng snapshot, mới nhất ở đầu.
 */
export function getSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (e) {
    console.warn("[Snapshot] Lỗi đọc snapshots:", e);
    return [];
  }
}

/**
 * Khôi phục dữ liệu về 1 bản snapshot cụ thể theo timestamp.
 * @param {string} snapshotTimestamp - Timestamp của bản snapshot cần khôi phục.
 * @returns {object|null} Dữ liệu đã khôi phục hoặc null nếu không tìm thấy.
 */
export function restoreSnapshot(snapshotTimestamp) {
  const snapshots = getSnapshots();
  const found = snapshots.find(s => s.timestamp === snapshotTimestamp);
  if (!found) {
    console.error("[Snapshot] Không tìm thấy snapshot:", snapshotTimestamp);
    return null;
  }
  // Trước khi restore, lưu snapshot của trạng thái hiện tại (để còn undo được)
  const currentData = getClubData();
  _writeSnapshot(currentData, new Date().toISOString(), "before_restore");
  // Ghi đè dữ liệu bằng bản snapshot được chọn
  saveClubData(found.data);
  return found.data;
}

/**
 * Tạo thủ công 1 bản snapshot ngay lập tức (bỏ qua throttle).
 * @param {object} data - Dữ liệu cần snapshot.
 * @param {string} [label] - Nhãn mô tả (vd: "manual").
 */
export function createManualSnapshot(data, label = "manual") {
  _writeSnapshot(data, new Date().toISOString(), label);
}

/**
 * Xóa toàn bộ lịch sử snapshot.
 */
export function clearSnapshots() {
  localStorage.removeItem(SNAPSHOTS_KEY);
  _lastSnapshotTime = 0;
}

// Khôi phục dữ liệu về trạng thái mẫu (Demo)
export function resetToDemoData() {
  const defaultData = {
    members: initialMembers,
    events: initialEvents,
    matches: initialMatches,
    transactions: initialTransactions
  };
  saveClubData(defaultData);
  return defaultData;
}

// Khôi phục hoàn toàn dữ liệu trống
export function clearAllData() {
  const emptyData = {
    members: [],
    events: [],
    matches: [],
    transactions: []
  };
  saveClubData(emptyData);
  return emptyData;
}

// --- THAO TÁC THÀNH VIÊN ---

export function addMember(newMember) {
  const data = getClubData();
  const id = "m_" + Date.now();
  const isGuest = !!newMember.isGuest;
  const baseEloSingles = isGuest ? 1000 : (parseInt(newMember.eloSingles) || 1000);
  const baseEloDoubles = isGuest ? 1000 : (parseInt(newMember.eloDoubles) || 1200);
  const member = {
    id,
    name: newMember.name,
    phone: newMember.phone || "",
    gender: newMember.gender || "Nam",
    joinDate: newMember.joinDate || new Date().toISOString().split("T")[0],
    elo: baseEloDoubles,
    eloSingles: baseEloSingles,
    eloDoubles: baseEloDoubles,
    initialElo: baseEloDoubles,
    initialEloSingles: baseEloSingles,
    initialEloDoubles: baseEloDoubles,
    isGuest,
    avatarColor: newMember.avatarColor || getRandomColor()
  };
  data.members.push(member);
  saveClubData(data);
  return data;
}

export function updateMember(updatedMember) {
  const data = getClubData();
  const isGuest = !!updatedMember.isGuest;
  const eloSingles = isGuest ? 1000 : (parseInt(updatedMember.eloSingles) || 1000);
  const eloDoubles = isGuest ? 1000 : (parseInt(updatedMember.eloDoubles) || 1200);

  data.members = data.members.map(m => 
    m.id === updatedMember.id 
      ? { 
          ...m, 
          ...updatedMember, 
          elo: eloDoubles, 
          eloSingles,
          eloDoubles,
          initialElo: eloDoubles,
          initialEloSingles: eloSingles,
          initialEloDoubles: eloDoubles,
          isGuest
        } 
      : m
  );
  recalculateAllElos(data);
  saveClubData(data);
  return data;
}

export function deleteMember(memberId) {
  const data = getClubData();
  // Xóa thành viên
  data.members = data.members.filter(m => m.id !== memberId);
  // Đồng thời, chúng ta vẫn giữ nguyên các trận đấu trong lịch sử để tránh hỏng dữ liệu,
  // nhưng khi hiển thị, các ID người chơi không tồn tại sẽ hiển thị là "Cựu thành viên".
  saveClubData(data);
  return data;
}

// --- THAO TÁC SỰ KIỆN ---

export function addEvent(newEvent) {
  const data = getClubData();
  const id = "e_" + Date.now();
  const event = {
    id,
    name: newEvent.name,
    date: newEvent.date || new Date().toISOString().split("T")[0],
    description: newEvent.description || "",
    isLocked: false
  };
  data.events.push(event);
  saveClubData(data);
  return data;
}

export function deleteEvent(eventId) {
  const data = getClubData();
  data.events = data.events.filter(e => e.id !== eventId);
  // Các trận đấu thuộc sự kiện bị xóa sẽ được cập nhật thành giao lưu tự do (eventId: "")
  data.matches = data.matches.map(m => 
    m.eventId === eventId ? { ...m, eventId: "" } : m
  );
  saveClubData(data);
  return data;
}

export function updateEvent(updatedEvent) {
  const data = getClubData();
  data.events = data.events.map(e => 
    e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e
  );
  saveClubData(data);
  return data;
}


// --- GHI NHẬN TRẬN ĐẤU & CẬP NHẬT ELO ---

/**
 * Ghi nhận trận đấu mới và tự động cập nhật Elo của các người chơi
 */
export function recordMatch(matchData) {
  const data = getClubData();
  const matchId = "match_" + Date.now();
  
  const { type, eventId, teamA, teamB, scoreA, scoreB, sets } = matchData;
  
  // Lấy Elo hiện tại của các người chơi
  const membersMapSingles = {};
  const membersMapDoubles = {};
  data.members.forEach(m => {
    membersMapSingles[m.id] = m.eloSingles !== undefined ? m.eloSingles : m.elo;
    membersMapDoubles[m.id] = m.eloDoubles !== undefined ? m.eloDoubles : m.elo;
  });

  // Khai báo Elo thay đổi
  let eloChanges = {};

  if (type === "singles") {
    const playerAId = teamA[0];
    const playerBId = teamB[0];
    
    const eloA = membersMapSingles[playerAId] || 1200;
    const eloB = membersMapSingles[playerBId] || 1200;

    const { changeA, changeB } = calculateSinglesElo(eloA, eloB, scoreA, scoreB);
    eloChanges[playerAId] = changeA;
    eloChanges[playerBId] = changeB;

    // Cập nhật Elo của người chơi trong danh sách thành viên
    data.members = data.members.map(m => {
      if (m.id === playerAId) return { 
        ...m, 
        eloSingles: Math.max(100, (m.eloSingles !== undefined ? m.eloSingles : m.elo) + changeA),
        elo: Math.max(100, m.elo + changeA) 
      };
      if (m.id === playerBId) return { 
        ...m, 
        eloSingles: Math.max(100, (m.eloSingles !== undefined ? m.eloSingles : m.elo) + changeB),
        elo: Math.max(100, m.elo + changeB) 
      };
      return m;
    });

  } else if (type === "doubles") {
    const pA1Id = teamA[0];
    const pA2Id = teamA[1];
    const pB1Id = teamB[0];
    const pB2Id = teamB[1];

    const eloA1 = membersMapDoubles[pA1Id] || 1200;
    const eloA2 = membersMapDoubles[pA2Id] || 1200;
    const eloB1 = membersMapDoubles[pB1Id] || 1200;
    const eloB2 = membersMapDoubles[pB2Id] || 1200;

    const { changeA, changeB } = calculateDoublesElo([eloA1, eloA2], [eloB1, eloB2], scoreA, scoreB);
    
    eloChanges[pA1Id] = changeA;
    eloChanges[pA2Id] = changeA;
    eloChanges[pB1Id] = changeB;
    eloChanges[pB2Id] = changeB;

    // Cập nhật Elo của 4 người chơi trong danh sách thành viên
    data.members = data.members.map(m => {
      if (m.id === pA1Id || m.id === pA2Id) return { 
        ...m, 
        eloDoubles: Math.max(100, (m.eloDoubles !== undefined ? m.eloDoubles : m.elo) + changeA),
        elo: Math.max(100, m.elo + changeA) 
      };
      if (m.id === pB1Id || m.id === pB2Id) return { 
        ...m, 
        eloDoubles: Math.max(100, (m.eloDoubles !== undefined ? m.eloDoubles : m.elo) + changeB),
        elo: Math.max(100, m.elo + changeB) 
      };
      return m;
    });
  }

  // Thêm trận đấu vào lịch sử
  const newMatch = {
    id: matchId,
    eventId: eventId || "",
    type,
    date: matchData.date || new Date().toISOString(),
    teamA,
    teamB,
    scoreA,
    scoreB,
    sets,
    eloChanges
  };

  data.matches.push(newMatch);
  recalculateAllElos(data); // Đảm bảo tính toán Elo được cập nhật nhất quán
  saveClubData(data);
  return data;
}

/**
 * Tự động tính toán lại toàn bộ lịch sử Elo của CLB từ điểm khởi đầu của các thành viên.
 * Đảm bảo tính nhất quán tuyệt đối về mặt toán học khi sửa hoặc xóa trận đấu cũ.
 */
export function recalculateAllElos(data) {
  // 1. Khôi phục điểm Elo của tất cả thành viên về điểm bắt đầu
  const demoElos = {
    m1: 1350,
    m2: 1280,
    m3: 1220,
    m4: 1190,
    m5: 1150,
    m6: 1110,
    m7: 1080,
    m8: 1020
  };

  data.members = data.members.map(m => {
    const baseDoublesElo = m.initialEloDoubles !== undefined 
      ? m.initialEloDoubles 
      : (m.initialElo !== undefined ? m.initialElo : (demoElos[m.id] || (m.isGuest ? 1000 : 1200)));
    const baseSinglesElo = m.initialEloSingles !== undefined 
      ? m.initialEloSingles 
      : (m.isGuest ? 1000 : 1000); // Reset all singles Elo to 1000 by default since no one has played singles before!

    return {
      ...m,
      elo: baseDoublesElo,
      eloSingles: baseSinglesElo,
      eloDoubles: baseDoublesElo,
      initialElo: baseDoublesElo,
      initialEloSingles: baseSinglesElo,
      initialEloDoubles: baseDoublesElo
    };
  });

  // 2. Sắp xếp toàn bộ trận đấu theo dòng thời gian tăng dần
  const sortedMatches = [...data.matches].sort((a, b) => new Date(a.date) - new Date(b.date));

  // 3. Giả lập phát lại từng trận đấu và cập nhật biến động Elo
  const calculatedMatches = sortedMatches.map(match => {
    const { type, teamA, teamB, scoreA, scoreB } = match;

    if (match.played === false) {
      return {
        ...match,
        eloChanges: {}
      };
    }

    // Bản đồ Elo của các người chơi ngay trước khi trận đấu này diễn ra
    const runningSinglesElos = {};
    const runningDoublesElos = {};
    data.members.forEach(m => {
      runningSinglesElos[m.id] = m.eloSingles;
      runningDoublesElos[m.id] = m.eloDoubles;
    });

    let eloChanges = {};

    if (type === "singles") {
      const pAId = teamA[0];
      const pBId = teamB[0];
      const eloA = runningSinglesElos[pAId] || 1200;
      const eloB = runningSinglesElos[pBId] || 1200;

      const { changeA, changeB } = calculateSinglesElo(eloA, eloB, scoreA, scoreB);
      eloChanges[pAId] = changeA;
      eloChanges[pBId] = changeB;

      // Cập nhật điểm Elo thực tế của hai người chơi
      data.members = data.members.map(m => {
        if (m.id === pAId) return { 
          ...m, 
          eloSingles: Math.max(100, m.eloSingles + changeA),
          elo: Math.max(100, m.elo + changeA) 
        };
        if (m.id === pBId) return { 
          ...m, 
          eloSingles: Math.max(100, m.eloSingles + changeB),
          elo: Math.max(100, m.elo + changeB) 
        };
        return m;
      });

    } else if (type === "doubles") {
      const pA1 = teamA[0];
      const pA2 = teamA[1];
      const pB1 = teamB[0];
      const pB2 = teamB[1];

      const eloA1 = runningDoublesElos[pA1] || 1200;
      const eloA2 = runningDoublesElos[pA2] || 1200;
      const eloB1 = runningDoublesElos[pB1] || 1200;
      const eloB2 = runningDoublesElos[pB2] || 1200;

      const { changeA, changeB } = calculateDoublesElo([eloA1, eloA2], [eloB1, eloB2], scoreA, scoreB);
      eloChanges[pA1] = changeA;
      eloChanges[pA2] = changeA;
      eloChanges[pB1] = changeB;
      eloChanges[pB2] = changeB;

      // Cập nhật điểm Elo thực tế của bốn người chơi
      data.members = data.members.map(m => {
        if (m.id === pA1 || m.id === pA2) return { 
          ...m, 
          eloDoubles: Math.max(100, m.eloDoubles + changeA),
          elo: Math.max(100, m.elo + changeA) 
        };
        if (m.id === pB1 || m.id === pB2) return { 
          ...m, 
          eloDoubles: Math.max(100, m.eloDoubles + changeB),
          elo: Math.max(100, m.elo + changeB) 
        };
        return m;
      });
    }

    return {
      ...match,
      eloChanges
    };
  });

  // Gán lại danh sách trận đấu đã được cập nhật Elo và sắp xếp lại theo thời gian
  data.matches = calculatedMatches;
  return data;
}

/**
 * Cập nhật một trận đấu hiện có và tính lại toàn bộ Elo
 */
export function updateMatch(updatedMatch) {
  const data = getClubData();
  data.matches = data.matches.map(m => 
    m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m
  );
  recalculateAllElos(data);
  saveClubData(data);
  return data;
}

/**
 * Xóa một trận đấu hiện có và tính lại toàn bộ Elo
 */
export function deleteMatch(matchId) {
  const data = getClubData();
  data.matches = data.matches.filter(m => m.id !== matchId);
  recalculateAllElos(data);
  saveClubData(data);
  return data;
}

/**
 * Xóa nhiều trận đấu cùng lúc và tính lại toàn bộ Elo
 */
export function deleteMatches(matchIds) {
  const data = getClubData();
  data.matches = data.matches.filter(m => !matchIds.includes(m.id));
  recalculateAllElos(data);
  saveClubData(data);
  return data;
}


// Hỗ trợ sinh màu avatar ngẫu nhiên
function getRandomColor() {
  const colors = [
    "#ff4757", // đỏ
    "#2ed573", // xanh lá
    "#1e90ff", // xanh dương
    "#ffa502", // cam
    "#9b59b6", // tím
    "#1abc9c", // teal
    "#e67e22", // cam đậm
    "#fd79a8", // hồng
    "#e84393", // hồng cánh sen
    "#00bec4"  // cyan
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// --- THAO TÁC THU CHI (QUỸ CLB) ---

export function addTransaction(newTx) {
  const data = getClubData();
  if (!data.transactions) data.transactions = [];
  const id = "tx_" + Date.now();
  const tx = {
    id,
    type: newTx.type, // "income" hoặc "expense"
    amount: parseInt(newTx.amount) || 0,
    category: newTx.category || "Khác",
    description: newTx.description || "",
    date: newTx.date || new Date().toISOString().split("T")[0],
    performedBy: newTx.performedBy || ""
  };
  data.transactions.push(tx);
  saveClubData(data);
  return data;
}

export function deleteTransaction(txId) {
  const data = getClubData();
  if (!data.transactions) data.transactions = [];
  data.transactions = data.transactions.filter(t => t.id !== txId);
  saveClubData(data);
  return data;
}

export function updateTransaction(updatedTx) {
  const data = getClubData();
  if (!data.transactions) data.transactions = [];
  data.transactions = data.transactions.map(t =>
    t.id === updatedTx.id 
      ? { 
          ...t, 
          ...updatedTx, 
          amount: parseInt(updatedTx.amount) || 0 
        } 
      : t
  );
  saveClubData(data);
  return data;
}
