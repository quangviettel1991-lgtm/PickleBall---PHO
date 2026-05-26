import { initialMembers, initialEvents, initialMatches, initialTransactions } from "./mockData";
import { calculateSinglesElo, calculateDoublesElo } from "./elo";
import { updateRemoteData } from "./supabase";

const STORAGE_KEY = "pickleball_club_data";

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
    localStorage.setItem("pickleball_club_data_updated_at", new Date(0).toISOString());
    return defaultData;
  }
  try {
    return JSON.parse(dataStr);
  } catch (e) {
    console.error("Lỗi parse dữ liệu từ localStorage, thiết lập lại dữ liệu mẫu cục bộ", e);
    const defaultData = {
      members: initialMembers,
      events: initialEvents,
      matches: initialMatches,
      transactions: initialTransactions
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    localStorage.setItem("pickleball_club_data_updated_at", new Date(0).toISOString());
    return defaultData;
  }
}

// Lưu dữ liệu vào localStorage
export function saveClubData(data) {
  const timestamp = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem("pickleball_club_data_updated_at", timestamp);
  // Đồng bộ ngầm lên đám mây Supabase
  updateRemoteData(data, timestamp).then(success => {
    if (success) {
      console.log("Đồng bộ đám mây Supabase thành công!");
    }
  });
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
  const member = {
    id,
    name: newMember.name,
    phone: newMember.phone || "",
    gender: newMember.gender || "Nam",
    joinDate: newMember.joinDate || new Date().toISOString().split("T")[0],
    elo: parseInt(newMember.elo) || 1200,
    initialElo: parseInt(newMember.elo) || 1200,
    avatarColor: newMember.avatarColor || getRandomColor()
  };
  data.members.push(member);
  saveClubData(data);
  return data;
}

export function updateMember(updatedMember) {
  const data = getClubData();
  data.members = data.members.map(m => 
    m.id === updatedMember.id 
      ? { 
          ...m, 
          ...updatedMember, 
          elo: parseInt(updatedMember.elo), 
          initialElo: parseInt(updatedMember.elo) 
        } 
      : m
  );
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
  const membersMap = {};
  data.members.forEach(m => {
    membersMap[m.id] = m.elo;
  });

  // Khai báo Elo thay đổi
  let eloChanges = {};

  if (type === "singles") {
    const playerAId = teamA[0];
    const playerBId = teamB[0];
    
    const eloA = membersMap[playerAId] || 1200;
    const eloB = membersMap[playerBId] || 1200;

    const { changeA, changeB } = calculateSinglesElo(eloA, eloB, scoreA, scoreB);
    eloChanges[playerAId] = changeA;
    eloChanges[playerBId] = changeB;

    // Cập nhật Elo của người chơi trong danh sách thành viên
    data.members = data.members.map(m => {
      if (m.id === playerAId) return { ...m, elo: Math.max(100, m.elo + changeA) };
      if (m.id === playerBId) return { ...m, elo: Math.max(100, m.elo + changeB) };
      return m;
    });

  } else if (type === "doubles") {
    const pA1Id = teamA[0];
    const pA2Id = teamA[1];
    const pB1Id = teamB[0];
    const pB2Id = teamB[1];

    const eloA1 = membersMap[pA1Id] || 1200;
    const eloA2 = membersMap[pA2Id] || 1200;
    const eloB1 = membersMap[pB1Id] || 1200;
    const eloB2 = membersMap[pB2Id] || 1200;

    const { changeA, changeB } = calculateDoublesElo([eloA1, eloA2], [eloB1, eloB2], scoreA, scoreB);
    
    eloChanges[pA1Id] = changeA;
    eloChanges[pA2Id] = changeA;
    eloChanges[pB1Id] = changeB;
    eloChanges[pB2Id] = changeB;

    // Cập nhật Elo của 4 người chơi trong danh sách thành viên
    data.members = data.members.map(m => {
      if (m.id === pA1Id || m.id === pA2Id) return { ...m, elo: Math.max(100, m.elo + changeA) };
      if (m.id === pB1Id || m.id === pB2Id) return { ...m, elo: Math.max(100, m.elo + changeB) };
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
    const baseElo = m.initialElo !== undefined ? m.initialElo : (demoElos[m.id] || 1200);
    return {
      ...m,
      elo: baseElo,
      initialElo: baseElo // Đảm bảo luôn lưu giữ trường này
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
    const runningElos = {};
    data.members.forEach(m => {
      runningElos[m.id] = m.elo;
    });

    let eloChanges = {};

    if (type === "singles") {
      const pAId = teamA[0];
      const pBId = teamB[0];
      const eloA = runningElos[pAId] || 1200;
      const eloB = runningElos[pBId] || 1200;

      const { changeA, changeB } = calculateSinglesElo(eloA, eloB, scoreA, scoreB);
      eloChanges[pAId] = changeA;
      eloChanges[pBId] = changeB;

      // Cập nhật điểm Elo thực tế của hai người chơi
      data.members = data.members.map(m => {
        if (m.id === pAId) return { ...m, elo: Math.max(100, m.elo + changeA) };
        if (m.id === pBId) return { ...m, elo: Math.max(100, m.elo + changeB) };
        return m;
      });

    } else if (type === "doubles") {
      const pA1 = teamA[0];
      const pA2 = teamA[1];
      const pB1 = teamB[0];
      const pB2 = teamB[1];

      const eloA1 = runningElos[pA1] || 1200;
      const eloA2 = runningElos[pA2] || 1200;
      const eloB1 = runningElos[pB1] || 1200;
      const eloB2 = runningElos[pB2] || 1200;

      const { changeA, changeB } = calculateDoublesElo([eloA1, eloA2], [eloB1, eloB2], scoreA, scoreB);
      eloChanges[pA1] = changeA;
      eloChanges[pA2] = changeA;
      eloChanges[pB1] = changeB;
      eloChanges[pB2] = changeB;

      // Cập nhật điểm Elo thực tế của bốn người chơi
      data.members = data.members.map(m => {
        if (m.id === pA1 || m.id === pA2) return { ...m, elo: Math.max(100, m.elo + changeA) };
        if (m.id === pB1 || m.id === pB2) return { ...m, elo: Math.max(100, m.elo + changeB) };
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
