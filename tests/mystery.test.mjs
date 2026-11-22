import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMysteryQualifiers, generateMysteryFinal, mysteryStandings } from '../src/utils/mystery.js';
import { drawMatchId } from '../src/utils/draws.js';

test('mystery qualifiers give every participant three matches without duplicate players in a round', () => {
  const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
  const rounds = generateMysteryQualifiers(ids);
  assert.equal(rounds.length, 3);
  for (const round of rounds) {
    assert.equal(round.matches.length, 2);
    const assigned = round.matches.flatMap(match => [...match.teamA, ...match.teamB]);
    assert.deepEqual(assigned.sort(), [...ids].sort());
  }
  const partnerPairs = rounds.flatMap(round => round.matches.flatMap(match => [match.teamA, match.teamB].map(team => [...team].sort().join('|'))));
  assert.equal(new Set(partnerPairs).size, partnerPairs.length);
});

test('final is unavailable until qualifiers are scored, then includes everyone and doubles only tournament points', () => {
  const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
  const rounds = generateMysteryQualifiers(ids);
  const matches = rounds.flatMap(round => round.matches.map(node => ({ id: drawMatchId(node.matchId), teamA: node.teamA, teamB: node.teamB, played: true, scoreA: 11, scoreB: 8 })));
  assert.throws(() => generateMysteryFinal(rounds, matches.slice(1)), /ghi điểm tất cả/);
  const final = generateMysteryFinal(rounds, matches);
  assert.equal(final.phase, 'final');
  assert.equal(final.matches.length, 2);
  const finalists = final.matches.flatMap(match => [...match.teamA, ...match.teamB]);
  assert.deepEqual(finalists.sort(), [...ids].sort());
  const before = mysteryStandings(rounds, matches);
  const finalMatch = final.matches[0];
  const scored = { id: drawMatchId(finalMatch.matchId), teamA: finalMatch.teamA, teamB: finalMatch.teamB, played: true, scoreA: 11, scoreB: 9 };
  const after = mysteryStandings([...rounds, final], [...matches, scored]);
  for (const id of finalMatch.teamA) assert.equal(after.find(row => row.id === id).points, before.find(row => row.id === id).points + 2);
  for (const id of finalMatch.teamB) assert.equal(after.find(row => row.id === id).points, before.find(row => row.id === id).points);
});

test('mystery draw rejects uneven participation', () => {
  assert.throws(() => generateMysteryQualifiers(['a','b','c','d','e']), /chia hết cho 4/);
  assert.throws(() => generateMysteryQualifiers(['a','b','c','a']), /trùng người/);
});
