// Dữ liệu mẫu ban đầu cho CLB Pickleball
export const initialMembers = [
  {
    id: "m1",
    name: "Nguyễn Hải Đăng",
    phone: "0912345678",
    gender: "Nam",
    joinDate: "2026-01-10",
    elo: 1350,
    avatarColor: "#ff4757", // Đỏ nổi bật
  },
  {
    id: "m2",
    name: "Trần Minh Quân",
    phone: "0987654321",
    gender: "Nam",
    joinDate: "2026-01-15",
    elo: 1280,
    avatarColor: "#2ed573", // Xanh lá
  },
  {
    id: "m3",
    name: "Phạm Thùy Chi",
    phone: "0905556667",
    gender: "Nữ",
    joinDate: "2026-02-01",
    elo: 1220,
    avatarColor: "#1e90ff", // Xanh dương
  },
  {
    id: "m4",
    name: "Lê Hoàng Nam",
    phone: "0944332211",
    gender: "Nam",
    joinDate: "2026-02-10",
    elo: 1190,
    avatarColor: "#ffa502", // Cam
  },
  {
    id: "m5",
    name: "Vũ Phương Thảo",
    phone: "0933889900",
    gender: "Nữ",
    joinDate: "2026-03-05",
    elo: 1150,
    avatarColor: "#9b59b6", // Tím
  },
  {
    id: "m6",
    name: "Hoàng Đức Anh",
    phone: "0977112233",
    gender: "Nam",
    joinDate: "2026-03-20",
    elo: 1110,
    avatarColor: "#1abc9c", // Teal
  },
  {
    id: "m7",
    name: "Đỗ Gia Huy",
    phone: "0966447788",
    gender: "Nam",
    joinDate: "2026-04-01",
    elo: 1080,
    avatarColor: "#e67e22", // Cam đậm
  },
  {
    id: "m8",
    name: "Bùi Khánh Linh",
    phone: "0955998877",
    gender: "Nữ",
    joinDate: "2026-04-12",
    elo: 1020,
    avatarColor: "#fd79a8", // Hồng
  }
];

export const initialEvents = [
  {
    id: "e1",
    name: "Giải Vô Địch Mùa Xuân 2026",
    date: "2026-04-15",
    description: "Giải đấu nội bộ đầu xuân dành cho tất cả thành viên CLB Pickleball, tính điểm Elo hệ số thường."
  },
  {
    id: "e2",
    name: "Giao Hữu Cuối Tuần Tháng 5",
    date: "2026-05-10",
    description: "Buổi giao lưu cọ xát nâng cao trình độ, ghép đôi ngẫu nhiên thử thách bản thân."
  }
];

// Lịch sử trận đấu mẫu
// Lưu ý: Các trận đấu có trường date nằm rải rác từ tháng 4 đến tháng 5 năm 2026 để test lọc thời gian.
export const initialMatches = [
  // Giải Mùa Xuân (e1) - Các trận ngày 15-16/04/2026
  {
    id: "match1",
    eventId: "e1",
    type: "singles", // singles hoặc doubles
    date: "2026-04-15T09:30:00",
    teamA: ["m1"], // Nguyễn Hải Đăng
    teamB: ["m2"], // Trần Minh Quân
    scoreA: 11,
    scoreB: 8,
    sets: [{ a: 11, b: 8 }],
    eloChanges: {
      m1: 14,
      m2: -14
    }
  },
  {
    id: "match2",
    eventId: "e1",
    type: "singles",
    date: "2026-04-15T10:15:00",
    teamA: ["m3"], // Phạm Thùy Chi
    teamB: ["m4"], // Lê Hoàng Nam
    scoreA: 11,
    scoreB: 9,
    sets: [{ a: 11, b: 9 }],
    eloChanges: {
      m3: 16,
      m4: -16
    }
  },
  {
    id: "match3",
    eventId: "e1",
    type: "doubles",
    date: "2026-04-15T14:00:00",
    teamA: ["m1", "m3"], // Hải Đăng + Thùy Chi
    teamB: ["m2", "m4"], // Minh Quân + Hoàng Nam
    scoreA: 15,
    scoreB: 12,
    sets: [{ a: 15, b: 12 }],
    eloChanges: {
      m1: 12,
      m3: 12,
      m2: -12,
      m4: -12
    }
  },
  {
    id: "match4",
    eventId: "e1",
    type: "singles",
    date: "2026-04-16T08:30:00",
    teamA: ["m5"], // Vũ Phương Thảo
    teamB: ["m6"], // Hoàng Đức Anh
    scoreA: 11,
    scoreB: 5,
    sets: [{ a: 11, b: 5 }],
    eloChanges: {
      m5: 18,
      m6: -18
    }
  },
  {
    id: "match5",
    eventId: "e1",
    type: "doubles",
    date: "2026-04-16T10:00:00",
    teamA: ["m5", "m7"], // Phương Thảo + Gia Huy
    teamB: ["m6", "m8"], // Đức Anh + Khánh Linh
    scoreA: 2, // Best of 3 sets (thắng 2)
    scoreB: 1,
    sets: [{ a: 11, b: 7 }, { a: 9, b: 11 }, { a: 11, b: 8 }],
    eloChanges: {
      m5: 15,
      m7: 15,
      m6: -15,
      m8: -15
    }
  },

  // Trận giao lưu tự do (không có eventId) - Cuối tháng 4
  {
    id: "match6",
    eventId: "",
    type: "singles",
    date: "2026-04-28T17:30:00",
    teamA: ["m1"], // Hải Đăng
    teamB: ["m3"], // Thùy Chi
    scoreA: 11,
    scoreB: 7,
    sets: [{ a: 11, b: 7 }],
    eloChanges: {
      m1: 10,
      m3: -10
    }
  },

  // Sự kiện giao lưu tháng 5 (e2) - Các trận ngày 10/05/2026
  {
    id: "match7",
    eventId: "e2",
    type: "doubles",
    date: "2026-05-10T08:30:00",
    teamA: ["m1", "m2"], // Hải Đăng + Minh Quân
    teamB: ["m3", "m5"], // Thùy Chi + Phương Thảo
    scoreA: 11,
    scoreB: 9,
    sets: [{ a: 11, b: 9 }],
    eloChanges: {
      m1: 11,
      m2: 11,
      m3: -11,
      m5: -11
    }
  },
  {
    id: "match8",
    eventId: "e2",
    type: "doubles",
    date: "2026-05-10T09:45:00",
    teamA: ["m4", "m6"], // Hoàng Nam + Đức Anh
    teamB: ["m7", "m8"], // Gia Huy + Khánh Linh
    scoreA: 2,
    scoreB: 0,
    sets: [{ a: 11, b: 5 }, { a: 11, b: 9 }],
    eloChanges: {
      m4: 13,
      m6: 13,
      m7: -13,
      m8: -13
    }
  },
  {
    id: "match9",
    eventId: "e2",
    type: "singles",
    date: "2026-05-10T11:00:00",
    teamA: ["m2"], // Minh Quân
    teamB: ["m4"], // Hoàng Nam
    scoreA: 11,
    scoreB: 6,
    sets: [{ a: 11, b: 6 }],
    eloChanges: {
      m2: 12,
      m4: -12
    }
  },

  // Các trận giao lưu tự do trong tháng 5 (Gần đây nhất)
  {
    id: "match10",
    eventId: "",
    type: "doubles",
    date: "2026-05-18T18:00:00",
    teamA: ["m1", "m4"], // Hải Đăng + Hoàng Nam
    teamB: ["m2", "m3"], // Minh Quân + Thùy Chi
    scoreA: 11,
    scoreB: 13,
    sets: [{ a: 11, b: 13 }],
    eloChanges: {
      m1: -14,
      m4: -14,
      m2: 14,
      m3: 14
    }
  },
  {
    id: "match11",
    eventId: "",
    type: "singles",
    date: "2026-05-20T19:00:00",
    teamA: ["m5"], // Phương Thảo
    teamB: ["m7"], // Gia Huy
    scoreA: 11,
    scoreB: 8,
    sets: [{ a: 11, b: 8 }],
    eloChanges: {
      m5: 12,
      m7: -12
    }
  },
  {
    id: "match12",
    eventId: "",
    type: "doubles",
    date: "2026-05-21T17:00:00",
    teamA: ["m2", "m5"], // Minh Quân + Phương Thảo
    teamB: ["m3", "m6"], // Thùy Chi + Đức Anh
    scoreA: 2,
    scoreB: 1,
    sets: [{ a: 11, b: 9 }, { a: 8, b: 11 }, { a: 11, b: 6 }],
    eloChanges: {
      m2: 11,
      m5: 11,
      m3: -11,
      m6: -11
    }
  }
];
