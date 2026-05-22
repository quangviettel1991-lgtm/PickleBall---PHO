/**
 * Tính toán điểm kì vọng của người chơi/đội A
 * @param {number} ratingA Elo của người chơi/đội A
 * @param {number} ratingB Elo của người chơi/đội B
 * @returns {number} Điểm kì vọng (từ 0 đến 1)
 */
export function getExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Tính toán biến động Elo sau một trận đấu
 * @param {number} ratingA Elo của A
 * @param {number} ratingB Elo của B
 * @param {number} scoreA Điểm số trận đấu của A
 * @param {number} scoreB Điểm số trận đấu của B
 * @param {number} kFactor Hệ số biến động (mặc định 32)
 * @returns {object} { changeA, changeB } lượng Elo thay đổi cho mỗi bên
 */
export function calculateEloChange(ratingA, ratingB, scoreA, scoreB, kFactor = 32) {
  const expectedA = getExpectedScore(ratingA, ratingB);
  const expectedB = getExpectedScore(ratingB, ratingA);

  let actualA = 0.5;
  let actualB = 0.5;

  if (scoreA > scoreB) {
    actualA = 1;
    actualB = 0;
  } else if (scoreB > scoreA) {
    actualA = 0;
    actualB = 1;
  }

  // Tính lượng Elo thay đổi
  const changeA = Math.round(kFactor * (actualA - expectedA));
  // Bảo toàn tổng điểm Elo trong hệ thống bằng cách gán đối ứng (hoặc tính riêng biệt)
  // Trong hệ thống đóng, changeB thường bằng -changeA
  const changeB = -changeA;

  return { changeA, changeB };
}

/**
 * Tính Elo cho trận đấu Đơn (1v1)
 * @param {number} eloA Elo người chơi A
 * @param {number} eloB Elo người chơi B
 * @param {number} scoreA Tổng điểm/số set thắng của A
 * @param {number} scoreB Tổng điểm/số set thắng của B
 * @returns {object} { changeA, changeB }
 */
export function calculateSinglesElo(eloA, eloB, scoreA, scoreB) {
  return calculateEloChange(eloA, eloB, scoreA, scoreB, 32);
}

/**
 * Tính Elo cho trận đấu Đôi (2v2)
 * @param {number[]} elosTeamA Mảng Elo của 2 người chơi đội A [eloA1, eloA2]
 * @param {number[]} elosTeamB Mảng Elo của 2 người chơi đội B [eloB1, eloB2]
 * @param {number} scoreA Tổng điểm/số set thắng của đội A
 * @param {number} scoreB Tổng điểm/số set thắng của đội B
 * @returns {object} { changeA, changeB } Lượng Elo cộng/trừ áp dụng cho mỗi thành viên trong đội
 */
export function calculateDoublesElo(elosTeamA, elosTeamB, scoreA, scoreB) {
  const avgEloA = (elosTeamA[0] + elosTeamA[1]) / 2;
  const avgEloB = (elosTeamB[0] + elosTeamB[1]) / 2;

  // Lượng thay đổi Elo dựa trên Elo trung bình của đội
  const { changeA, changeB } = calculateEloChange(avgEloA, avgEloB, scoreA, scoreB, 32);

  return { changeA, changeB };
}
