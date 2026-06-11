const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Events.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace the handleEditMatchSubmit logic to include played and sets properties
const oldSubmit = `    const updatedData = updateMatch({
      id: editingMatch.id,
      eventId: selectedEvent.id,
      type: editingMatch.type,
      teamA: editMatchTeamA,
      teamB: editMatchTeamB,
      scoreA: parseInt(editMatchScoreA) || 0,
      scoreB: parseInt(editMatchScoreB) || 0,
      date: new Date(editMatchDate).toISOString()
    });`;

const newSubmit = `    const scoreA = parseInt(editMatchScoreA) || 0;
    const scoreB = parseInt(editMatchScoreB) || 0;
    const isPlayed = (scoreA > 0 || scoreB > 0);

    const updatedData = updateMatch({
      id: editingMatch.id,
      eventId: selectedEvent.id,
      type: editingMatch.type,
      teamA: editMatchTeamA,
      teamB: editMatchTeamB,
      scoreA: scoreA,
      scoreB: scoreB,
      sets: isPlayed ? [{ a: scoreA, b: scoreB }] : [],
      played: isPlayed,
      date: editingMatch.date
    });`;

if (content.includes(oldSubmit)) {
  content = content.replace(oldSubmit, newSubmit);
  console.log('Successfully updated handleEditMatchSubmit!');
} else {
  console.log('Could not find oldSubmit in file!');
}

// 2. Inject custom scrollbar style inside <style> tag
const oldStyleAnchor = `        /* Responsive */
        @media (max-width: 900px) {`;

const newStyleSnippet = `        .event-matches-scroll {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 8px;
        }

        .event-matches-scroll::-webkit-scrollbar {
          width: 8px;
          display: block;
        }

        .event-matches-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }

        .event-matches-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.25);
          border-radius: 4px;
        }

        .event-matches-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--accent-neon-green);
        }

        /* Responsive */
        @media (max-width: 900px) {`;

if (content.includes(oldStyleAnchor) && !content.includes('.event-matches-scroll')) {
  content = content.replace(oldStyleAnchor, newStyleSnippet);
  console.log('Successfully injected scrollbar CSS!');
} else {
  console.log('CSS already injected or anchor not found!');
}

// 3. Replace the entire eventMatches container block
const oldContainerStart = `<div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "480px", overflowY: "auto", pr: "6px" }}>`;
const oldContainerEnd = `                  ))
                )}
              </div>`;

// Let's locate the entire block and replace it
const targetBlock = `<div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "480px", overflowY: "auto", pr: "6px" }}>
                {eventMatches.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "30px 0" }}>
                    Chưa có trận đấu nào được ghi nhận cho giải này.
                  </p>
                ) : (
                  eventMatches.map(match => (
                    <div 
                      key={match.id} 
                      className="glass-card" 
                      style={{ 
                        padding: "14px", 
                        background: "rgba(255,255,255,0.01)", 
                        borderRadius: "8px", 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "10px" 
                      }}
                    >
                      {/* Sub-header trận */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={\`match-type-badge \${match.type === "singles" ? "match-type-singles" : "match-type-doubles"}\`}>
                            {match.type === "singles" ? "Đơn" : "Đôi"}
                          </span>
                          <span className="match-date" style={{ fontSize: "0.7rem" }}>
                            {formatDateTime(match.date)}
                          </span>
                        </div>
                        {isAdmin && (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button 
                              className="event-action-btn-edit" 
                              onClick={() => handleOpenEditMatch(match)}
                              title="Sửa trận đấu"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              className="event-action-btn-delete" 
                              onClick={() => handleOpenDeleteMatch(match.id)}
                              title="Xóa trận đấu"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Tỷ số & Đội */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {/* Đội A */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {match.teamA.map(id => (
                            <span key={id} style={{ fontSize: "0.85rem", fontWeight: "600" }}>
                              {getPlayerName(id).split(" ").pop()}
                            </span>
                          ))}
                        </div>

                        {/* Điểm số */}
                        {match.played === false ? (
                          <div className="match-unplayed-badge" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>
                            Chưa đấu
                          </div>
                        ) : (
                          <div className="match-score-pill" style={{ padding: "4px 10px", fontSize: "0.95rem" }}>
                            <span className={match.scoreA > match.scoreB ? "score-winner" : "score-loser"}>{match.scoreA}</span>
                            <span style={{ color: "var(--text-muted)" }}>:</span>
                            <span className={match.scoreB > match.scoreA ? "score-winner" : "score-loser"}>{match.scoreB}</span>
                          </div>
                        )}

                        {/* Đội B */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                          {match.teamB.map(id => (
                            <span key={id} style={{ fontSize: "0.85rem", fontWeight: "600" }}>
                              {getPlayerName(id).split(" ").pop()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>`;

const newContainerBlock = `<div className="event-matches-scroll">
                {eventMatches.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "30px 0" }}>
                    Chưa có trận đấu nào được ghi nhận cho giải này.
                  </p>
                ) : (
                  eventMatches.map(match => (
                    <div 
                      key={match.id} 
                      className="glass-card" 
                      style={{ 
                        padding: "8px 12px", 
                        background: "rgba(255,255,255,0.015)", 
                        borderRadius: "8px", 
                        display: "flex", 
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px" 
                      }}
                    >
                      {/* Đội A */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: "55px" }}>
                        {match.teamA.map(id => (
                          <span key={id} style={{ fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {getPlayerName(id).split(" ").pop()}
                          </span>
                        ))}
                      </div>

                      {/* Điểm số hoặc Trạng thái chưa đấu */}
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
                        {match.played === false ? (
                          <div className="match-unplayed-badge" style={{ fontSize: "0.68rem", padding: "3px 6px" }}>
                            Chưa đấu
                          </div>
                        ) : (
                          <div className="match-score-pill" style={{ padding: "3px 8px", fontSize: "0.85rem" }}>
                            <span className={match.scoreA > match.scoreB ? "score-winner" : "score-loser"}>{match.scoreA}</span>
                            <span style={{ color: "var(--text-muted)" }}>:</span>
                            <span className={match.scoreB > match.scoreA ? "score-winner" : "score-loser"}>{match.scoreB}</span>
                          </div>
                        )}
                      </div>

                      {/* Đội B */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", minWidth: "55px" }}>
                        {match.teamB.map(id => (
                          <span key={id} style={{ fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {getPlayerName(id).split(" ").pop()}
                          </span>
                        ))}
                      </div>

                      {/* Nút hành động cho Admin */}
                      {isAdmin && (
                        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                          <button 
                            className="event-action-btn-edit" 
                            onClick={() => handleOpenEditMatch(match)}
                            title="Sửa trận đấu"
                            style={{ width: "28px", height: "28px", borderRadius: "5px" }}
                            type="button"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            className="event-action-btn-delete" 
                            onClick={() => handleOpenDeleteMatch(match.id)}
                            title="Xóa trận đấu"
                            style={{ width: "28px", height: "28px", borderRadius: "5px" }}
                            type="button"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>`;

// Standardize line endings before match
const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget = targetBlock.replace(/\r\n/g, '\n');
const cleanNew = newContainerBlock.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTarget)) {
  content = cleanContent.replace(cleanTarget, cleanNew);
  console.log('Successfully refactored match container block!');
} else {
  console.log('Target container block not found! Trying fallback replace...');
  // Fallback direct replace by targeting line anchors if exact block doesn't match perfectly due to spaces
  content = cleanContent.replace(oldContainerStart, '<div className="event-matches-scroll">');
  console.log('Fallback updated scroll container tag');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('All changes written to Events.jsx successfully!');
