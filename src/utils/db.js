import { initialMembers, initialEvents, initialMatches } from "./mockData";
import { calculateSinglesElo, calculateDoublesElo } from "./elo";
import { updateRemoteData } from "./supabase";

const STORAGE_KEY = "pickleball_club_data";

// Lấy toàn bộ dữ liệu từ localStorage
export function getClubData() {
  const dataStr = localStorage.getItem(STORAGE_KEY);
  if (!dataStr) {
    // Nếu chưa có dữ liệu, khởi tạo bằng dữ liệu mẫu
    const defaultData = {
      members: initialMembers,
      events: initialEvents,
      matches: initialMatches
    };
    saveClubData(defaultData);
    return defaultData;
  }
  try {
    return JSON.parse(dataStr);
  } catch (e) {
    console.error("Lỗi parse dữ liệu từ localStorage, thiết lập lại dữ liệu mẫu", e);
    const defaultData = {
      members: initialMembers,
      events: initialEvents,
      matches: initialMatches
    };
    saveClubData(defaultData);
    return defaultData;
  }
}

// Lưu dữ liệu vào localStorage
export function saveClubData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Đồng bộ ngầm lên đám mây Supabase
  updateRemoteData(data).then(success => {
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
    matches: initialMatches
  };
  saveClubData(defaultData);
  return defaultData;
}

// Khôi phục hoàn toàn dữ liệu trống
export function clearAllData() {
  const emptyData = {
    members: [],
    events: [],
    matches: []
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
      ? { ...m, ...updatedMember, elo: parseInt(updatedMember.elo) } 
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
    description: newEvent.description || ""
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
