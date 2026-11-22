import { drawMatchId } from './draws.js';
import { isPlayed } from './schema.js';

const shuffle = (items, random) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const pairKey = (a, b) => [a, b].sort().join('|');
const matchNode = (round, court, players, prefix) => ({
  matchId: `${prefix}_${round}_${court}_${crypto.randomUUID()}`,
  courtIndex: court + 1,
  teamA: players.slice(0, 2), teamB: players.slice(2, 4),
  scoreA: null, scoreB: null, played: false,
});

export function generateMysteryQualifiers(ids, random = Math.random) {
  if (!Array.isArray(ids) || ids.length < 4 || ids.length > 24 || ids.length % 4 !== 0 || new Set(ids).size !== ids.length) {
    throw new Error('Đấu Đôi Bí Ẩn cần 4–24 người, số lượng chia hết cho 4 và không trùng người.');
  }
  const partners = new Map();
  const opponents = new Map();
  const rounds = [];
  for (let round = 0; round < 3; round++) {
    let best = null;
    let bestPenalty = Infinity;
    for (let attempt = 0; attempt < 320; attempt++) {
      const candidate = shuffle(ids, random);
      let penalty = 0;
      for (let court = 0; court < candidate.length / 4; court++) {
        const [a, b, c, d] = candidate.slice(court * 4, court * 4 + 4);
        penalty += 100 * ((partners.get(pairKey(a, b)) || 0) + (partners.get(pairKey(c, d)) || 0));
        for (const [x, y] of [[a, c], [a, d], [b, c], [b, d]]) penalty += 8 * (opponents.get(pairKey(x, y)) || 0);
      }
      if (penalty < bestPenalty) { best = candidate; bestPenalty = penalty; }
      if (penalty === 0) break;
    }
    const matches = [];
    for (let court = 0; court < best.length / 4; court++) {
      const players = best.slice(court * 4, court * 4 + 4);
      matches.push(matchNode(round + 1, court, players, 'mystery_q'));
      const [a, b, c, d] = players;
      for (const [x, y] of [[a, b], [c, d]]) partners.set(pairKey(x, y), (partners.get(pairKey(x, y)) || 0) + 1);
      for (const [x, y] of [[a, c], [a, d], [b, c], [b, d]]) opponents.set(pairKey(x, y), (opponents.get(pairKey(x, y)) || 0) + 1);
    }
    rounds.push({ roundIndex: round + 1, phase: 'qualifier', matches, sittingOut: [] });
  }
  return rounds;
}

export function mysteryStandings(rounds, canonicalMatches) {
  const matchById = new Map(canonicalMatches.map(match => [match.id, match]));
  const ids = [...new Set(rounds.flatMap(round => round.matches.flatMap(match => [...match.teamA, ...match.teamB])))];
  const stats = new Map(ids.map(id => [id, { id, wins: 0, points: 0, difference: 0, played: 0 }]));
  for (const round of rounds) {
    for (const node of round.matches) {
      const match = matchById.get(drawMatchId(node.matchId));
      if (!match || !isPlayed(match)) continue;
      const winner = match.scoreA > match.scoreB ? 'A' : 'B';
      for (const side of ['A', 'B']) for (const id of match[`team${side}`]) {
        const entry = stats.get(id);
        if (!entry) continue;
        entry.played++;
        entry.difference += side === 'A' ? match.scoreA - match.scoreB : match.scoreB - match.scoreA;
        if (side === winner) { entry.wins++; entry.points += round.phase === 'final' ? 2 : 1; }
      }
    }
  }
  return [...stats.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.difference - a.difference || a.id.localeCompare(b.id));
}

export function generateMysteryFinal(qualifierRounds, canonicalMatches, random = Math.random) {
  if (qualifierRounds.length !== 3 || qualifierRounds.some(round => round.phase !== 'qualifier')) throw new Error('Cần đủ 3 vòng loại hợp lệ.');
  const byId = new Map(canonicalMatches.map(match => [match.id, match]));
  if (qualifierRounds.some(round => round.matches.some(node => !isPlayed(byId.get(drawMatchId(node.matchId)) || {})))) {
    throw new Error('Cần ghi điểm tất cả trận vòng loại trước khi bốc vòng lật kèo.');
  }
  const standings = mysteryStandings(qualifierRounds, canonicalMatches);
  if (standings.length < 4 || standings.length % 4 !== 0) throw new Error('Số người vòng cuối không hợp lệ.');
  const playedPartners = new Map();
  for (const round of qualifierRounds) for (const match of round.matches) {
    for (const side of ['A', 'B']) {
      const [a, b] = match[`team${side}`];
      playedPartners.set(pairKey(a, b), (playedPartners.get(pairKey(a, b)) || 0) + 1);
    }
  }
  const half = standings.length / 2;
  const top = standings.slice(0, half).map(row => row.id);
  const bottom = standings.slice(half).map(row => row.id);
  let best = null;
  let bestPenalty = Infinity;
  for (let attempt = 0; attempt < 320; attempt++) {
    const shuffledBottom = shuffle(bottom, random);
    const pairs = shuffle(top.map((id, index) => [id, shuffledBottom[index]]), random);
    const penalty = pairs.reduce((sum, [a, b]) => sum + (playedPartners.get(pairKey(a, b)) || 0), 0);
    if (penalty < bestPenalty) { best = pairs; bestPenalty = penalty; }
    if (penalty === 0) break;
  }
  const matches = [];
  for (let court = 0; court < best.length / 2; court++) {
    matches.push(matchNode(4, court, [...best[court * 2], ...best[court * 2 + 1]], 'mystery_final'));
  }
  return { roundIndex: 4, phase: 'final', matches, sittingOut: [] };
}
