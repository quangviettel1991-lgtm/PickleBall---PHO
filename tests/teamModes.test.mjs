import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTeamClash, generateTeamCup, generateKingCourt, advanceTeamRound, teamStandings } from '../src/utils/teamModes.js';
import { drawMatchId } from '../src/utils/draws.js';
import { fixture, setup } from './fixtures.mjs';
import { saveDraw, updateMatch, deleteMatch, advanceTeamDraw, getClubData } from '../src/utils/db.js';

const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
const scored = rounds => rounds.flatMap(round => round.matches.map(match => ({
  id: drawMatchId(match.matchId), teamA: match.teamA, teamB: match.teamB,
  scoreA: 11, scoreB: 9, played: true,
})));

test('Đại Chiến Team rotates partners, uses every player and doubles only final tournament points', () => {
  const members = ids.map(id => ({ id, eloDoubles: 1000 }));
  const rounds = generateTeamClash(ids, members);
  assert.equal(rounds.length, 3);
  const partners = [];
  for (const round of rounds) {
    assert.equal(round.matches.length, 2);
    assert.deepEqual(round.matches.flatMap(match => [...match.teamA, ...match.teamB]).sort(), [...ids].sort());
    partners.push(...round.matches.flatMap(match => [match.teamA, match.teamB].map(pair => [...pair].sort().join('|'))));
  }
  assert.equal(new Set(partners).size, partners.length);
  const rows = teamStandings(rounds, scored(rounds), 'teamclash');
  assert.equal(rows.find(row => row.id === 'neon').points, 8);
  assert.equal(rows.find(row => row.id === 'lua').points, 0);
  assert.throws(() => generateTeamClash(ids.slice(0, 7), members), /chia hết cho 4/);
});

test('Cúp Tứ Hùng plays six unique group matches before final and bronze', () => {
  const rounds = generateTeamCup(ids);
  const pairs = rounds.flatMap(round => round.matches.map(match => [match.teamIdA, match.teamIdB].sort().join('|')));
  assert.equal(new Set(pairs).size, 6);
  assert.throws(() => advanceTeamRound('teamcup', rounds, scored(rounds).slice(1)), /ghi đủ/);
  const results = scored(rounds);
  const topTwo = teamStandings(rounds, results, 'teamcup').slice(0, 2).map(row => row.id).sort();
  const final = advanceTeamRound('teamcup', rounds, results);
  assert.equal(final.matches.length, 2);
  assert.deepEqual([final.matches[0].teamIdA, final.matches[0].teamIdB].sort(), topTwo);
  assert.equal(final.matches[0].label, 'Chung kết');
  assert.equal(final.matches[1].label, 'Tranh hạng ba');
  assert.throws(() => generateTeamCup(ids.slice(0, 7)), /đúng 8/);
});

test('Vua Sân promotes winning pairs, relegates losing pairs and stops after three rounds', () => {
  const rounds = generateKingCourt(ids);
  assert.throws(() => advanceTeamRound('kingcourt', rounds, []), /ghi đủ/);
  const firstResults = scored(rounds);
  const second = advanceTeamRound('kingcourt', rounds, firstResults);
  assert.deepEqual([second.matches[0].teamIdA, second.matches[0].teamIdB], rounds[0].matches.map(match => match.teamIdA));
  assert.deepEqual([second.matches[1].teamIdA, second.matches[1].teamIdB], rounds[0].matches.map(match => match.teamIdB));
  const third = advanceTeamRound('kingcourt', [...rounds, second], [...firstResults, ...scored([second])]);
  assert.equal(third.roundIndex, 3);
  assert.throws(() => advanceTeamRound('kingcourt', [...rounds, second, third], scored([...rounds, second, third])), /ghi đủ/);
  assert.equal(teamStandings([...rounds, second], [...firstResults, ...scored([second])], 'kingcourt').reduce((sum, row) => sum + row.points, 0), 6);
});

test('advanced team rounds keep canonical matches and protect earlier scored rounds', () => {
  const data = fixture();
  data.members.push(...Array.from({ length: 4 }, (_, i) => ({ ...data.members[0], id: `extra-${i}`, name: `Extra ${i}` })));
  setup(data);
  const rounds = generateKingCourt(data.members.map(member => member.id));
  saveDraw('event', 'kingcourt', rounds);
  for (const match of rounds[0].matches) updateMatch({ id: drawMatchId(match.matchId), scoreA: 11, scoreB: 9 });
  advanceTeamDraw('event');
  assert.equal(getClubData().draws.event.data.length, 2);
  assert.equal(getClubData().matches.length, 4);
  const nextMatchId = drawMatchId(getClubData().draws.event.data[1].matches[0].matchId);
  assert.throws(() => updateMatch({ id: drawMatchId(rounds[0].matches[0].matchId), scoreA: 11, scoreB: 8 }), /Vòng tiếp theo đã bốc/);
  assert.throws(() => deleteMatch(nextMatchId), /Không xóa riêng trận/);
  assert.throws(() => updateMatch({ id: nextMatchId, teamA: ['a','b'] }), /Không đổi người chơi/);
});
