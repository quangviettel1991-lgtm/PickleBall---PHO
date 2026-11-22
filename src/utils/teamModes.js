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
const requirePlayers = (ids, count) => {
  if (!Array.isArray(ids) || ids.length !== count || new Set(ids).size !== count) {
    throw new Error(`Thể thức này cần đúng ${count} người chơi khác nhau.`);
  }
};
const node = (prefix, round, court, teamA, teamB, teamIdA, teamIdB, label) => ({
  matchId: `${prefix}_${round}_${court}_${crypto.randomUUID()}`,
  courtIndex: court, teamA: [...teamA], teamB: [...teamB], teamIdA, teamIdB,
  label, scoreA: null, scoreB: null, played: false,
});
const pairRounds = players => {
  let order = [...players];
  return Array.from({ length: 3 }, () => {
    const pairs = Array.from({ length: order.length / 2 }, (_, i) => [order[i], order[order.length - 1 - i]]);
    order = [order[0], order.at(-1), ...order.slice(1, -1)];
    return pairs;
  });
};
const recorded = (matches, matchId) => matches.find(match => match.id === drawMatchId(matchId));
export const roundScored = (round, matches) => round.matches.length > 0 && round.matches.every(match => isPlayed(recorded(matches, match.matchId) || {}));

export function generateTeamClash(ids, members, random = Math.random) {
  if (!Array.isArray(ids) || ids.length < 8 || ids.length > 24 || ids.length % 4 !== 0 || new Set(ids).size !== ids.length) {
    throw new Error('Đại Chiến Team cần 8–24 người, số lượng chia hết cho 4 và không trùng người.');
  }
  const elo = new Map(members.map(member => [member.id, member.eloDoubles ?? member.elo ?? 1000]));
  const ranked = shuffle(ids, random).sort((a, b) => (elo.get(b) ?? 1000) - (elo.get(a) ?? 1000));
  const squads = [[], []], totals = [0, 0], capacity = ids.length / 2;
  for (const id of ranked) {
    const side = squads[0].length === capacity ? 1 : squads[1].length === capacity ? 0 : totals[0] <= totals[1] ? 0 : 1;
    squads[side].push(id); totals[side] += elo.get(id) ?? 1000;
  }
  const teams = [{ id: 'neon', name: 'Team Neon', players: squads[0] }, { id: 'lua', name: 'Team Lửa', players: squads[1] }];
  const pairsA = pairRounds(shuffle(squads[0], random));
  const pairsB = pairRounds(shuffle(squads[1], random));
  return Array.from({ length: 3 }, (_, round) => ({
    roundIndex: round + 1, phase: 'teamclash', ...(round === 0 ? { teams } : {}), sittingOut: [],
    matches: pairsA[round].map((pair, court) => node('team_clash', round + 1, court + 1,
      pair, pairsB[round][(court + round) % pairsB[round].length], 'neon', 'lua')),
  }));
}

export function generateTeamCup(ids, random = Math.random) {
  requirePlayers(ids, 8);
  const shuffled = shuffle(ids, random);
  const teams = Array.from({ length: 4 }, (_, i) => ({ id: `cup-${i + 1}`, name: `Đội ${i + 1}`, players: shuffled.slice(i * 2, i * 2 + 2) }));
  const schedule = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  return schedule.map((pairs, index) => ({ roundIndex: index + 1, phase: 'group', ...(index === 0 ? { teams } : {}), sittingOut: [],
    matches: pairs.map(([a, b], court) => node('team_cup', index + 1, court + 1, teams[a].players, teams[b].players, teams[a].id, teams[b].id)),
  }));
}

export function generateKingCourt(ids, random = Math.random) {
  requirePlayers(ids, 8);
  const shuffled = shuffle(ids, random);
  const teams = Array.from({ length: 4 }, (_, i) => ({ id: `king-${i + 1}`, name: `Đội ${i + 1}`, players: shuffled.slice(i * 2, i * 2 + 2) }));
  return [{ roundIndex: 1, phase: 'king', teams, sittingOut: [], matches: [
    node('king', 1, 1, teams[0].players, teams[1].players, teams[0].id, teams[1].id),
    node('king', 1, 2, teams[2].players, teams[3].players, teams[2].id, teams[3].id),
  ] }];
}

export function teamStandings(rounds, canonicalMatches, scenario) {
  const teams = rounds[0]?.teams || [];
  const rows = new Map(teams.map(team => [team.id, { ...team, wins: 0, played: 0, points: 0, difference: 0 }]));
  for (const round of rounds) {
    if (scenario === 'teamcup' && round.phase !== 'group') continue;
    for (const match of round.matches) {
      const result = recorded(canonicalMatches, match.matchId);
      if (!isPlayed(result || {})) continue;
      const weight = scenario === 'teamclash' && round.roundIndex === 3 ? 2 : scenario === 'kingcourt' && match.courtIndex === 1 ? 2 : 1;
      for (const [side, id] of [['A', match.teamIdA], ['B', match.teamIdB]]) {
        const row = rows.get(id);
        if (!row) continue;
        row.played++; row.difference += side === 'A' ? result.scoreA - result.scoreB : result.scoreB - result.scoreA;
        if ((side === 'A' && result.scoreA > result.scoreB) || (side === 'B' && result.scoreB > result.scoreA)) { row.wins++; row.points += weight; }
      }
    }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.difference - a.difference || a.id.localeCompare(b.id));
}

export function advanceTeamRound(scenario, rounds, canonicalMatches) {
  if (!Array.isArray(rounds) || !rounds[0]?.teams) throw new Error('Lịch đội không hợp lệ.');
  if (scenario === 'teamcup') {
    if (rounds.length !== 3 || rounds.some(round => round.phase !== 'group' || !roundScored(round, canonicalMatches))) {
      throw new Error('Cần ghi đủ 3 vòng bảng trước khi bốc chung kết.');
    }
    const ranked = teamStandings(rounds, canonicalMatches, scenario);
    if (ranked.length !== 4) throw new Error('Cần đúng 4 đội ở vòng bảng.');
    return { roundIndex: 4, phase: 'cup-final', sittingOut: [], matches: [
      node('team_cup_final', 4, 1, ranked[0].players, ranked[1].players, ranked[0].id, ranked[1].id, 'Chung kết'),
      node('team_cup_bronze', 4, 2, ranked[2].players, ranked[3].players, ranked[2].id, ranked[3].id, 'Tranh hạng ba'),
    ] };
  }
  if (scenario === 'kingcourt') {
    if (rounds.length < 1 || rounds.length >= 3 || rounds.some(round => round.phase !== 'king') || !roundScored(rounds.at(-1), canonicalMatches)) {
      throw new Error('Cần ghi đủ kết quả lượt hiện tại trước khi đổi sân.');
    }
    const teams = new Map(rounds[0].teams.map(team => [team.id, team]));
    const winners = [], losers = [];
    for (const match of rounds.at(-1).matches) {
      const result = recorded(canonicalMatches, match.matchId);
      const winner = result.scoreA > result.scoreB ? match.teamIdA : match.teamIdB;
      const loser = winner === match.teamIdA ? match.teamIdB : match.teamIdA;
      winners.push(teams.get(winner)); losers.push(teams.get(loser));
    }
    if (winners.length !== 2 || losers.length !== 2 || [...winners, ...losers].some(team => !team)) throw new Error('Cặp đội không hợp lệ.');
    const roundIndex = rounds.length + 1;
    return { roundIndex, phase: 'king', sittingOut: [], matches: [
      node('king', roundIndex, 1, winners[0].players, winners[1].players, winners[0].id, winners[1].id),
      node('king', roundIndex, 2, losers[0].players, losers[1].players, losers[0].id, losers[1].id),
    ] };
  }
  throw new Error('Thể thức này không có vòng tiếp theo.');
}
