import { clone, isPlayed } from './schema.js';
export const drawMatchId = id => id.startsWith('match_draw_') ? id : `match_draw_${id.startsWith('match_') ? id.slice(6) : id}`;
export const drawRounds = draw => Array.isArray(draw?.data) ? draw.data : draw?.data?.rounds || [];
export function drawNodes(draw) { return drawRounds(draw).flatMap(r => r.matches); }
export function syncDraws(data) {
  const matches = new Map(data.matches.map(m => [m.id, m]));
  for (const draw of Object.values(data.draws || {})) {
    const nodes = drawNodes(draw);
    const sources = new Map(nodes.map(m => [m.matchId, m]));
    for (const node of nodes) {
      for (const side of ['A','B']) {
        const source = node[`sourceMatch${side}`];
        if (!source) continue;
        const previous = sources.get(source);
        const players = previous?.winnerPlayers || [];
        if (JSON.stringify(node[`team${side}`]) !== JSON.stringify(players)) {
          const canonical = matches.get(drawMatchId(node.matchId));
          if (canonical && isPlayed(canonical)) throw new Error('Vòng sau đã có kết quả. Hãy xóa kết quả các vòng sau trước khi thay đổi trận nguồn.');
          node[`team${side}`] = clone(players);
          node[`team${side}Name`] = previous?.winner || 'Chờ kết quả';
          if (canonical) canonical[`team${side}`] = clone(players);
        }
      }
      const match = matches.get(drawMatchId(node.matchId));
      if (match) {
        Object.assign(node, { teamA: clone(match.teamA), teamB: clone(match.teamB), scoreA: match.scoreA, scoreB: match.scoreB, sets: clone(match.sets || []), date: match.date, played: isPlayed(match) });
      }
      if (node.played && node.scoreA !== node.scoreB) {
        const side = node.scoreA > node.scoreB ? 'A' : 'B';
        node.winnerPlayers = clone(node[`team${side}`]);
        node.winner = node[`team${side}Name`] || node.winnerPlayers.map(id => data.members.find(m => m.id === id)?.name || 'Cựu thành viên').join(' & ');
      } else { node.winnerPlayers = []; node.winner = null; }
    }
  }
}
export function removeDrawNodes(data, ids) {
  for (const draw of Object.values(data.draws || {})) {
    for (const round of drawRounds(draw)) round.matches = round.matches.filter(n => !ids.includes(drawMatchId(n.matchId)));
  }
  syncDraws(data);
}
