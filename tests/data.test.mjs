import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, setup, matchInput } from './fixtures.mjs';
import { keys } from '../src/utils/config.js';
import { setAccess } from '../src/utils/access.js';
import * as db from '../src/utils/db.js';
import { readState, commitState, exportBackup } from '../src/utils/storage.js';
import { parseBackup, isPlayed, scoreFromSets } from '../src/utils/schema.js';
import { drawMatchId } from '../src/utils/draws.js';
import { localDate, toInstant } from '../src/utils/dates.js';

test('renaming a player preserves both ratings and historical deltas',()=>{
  setup(); const played=db.recordMatch(matchInput()); const before=played.members[0];
  const after=db.updateMember({...before,name:'Renamed'});
  assert.equal(before.eloSingles,1016); assert.equal(after.members[0].eloSingles,1016);
  assert.deepEqual(after.matches,played.matches);
});
test('manual and previously pending matches are consistently completed',()=>{
  setup(); const played=db.recordMatch(matchInput()); assert.equal(isPlayed(played.matches[0]),true);
  const data=fixture(); data.matches=[{...matchInput(),id:'pending',played:false,scoreA:0,scoreB:0,eloChanges:{}}];setup(data);
  const saved=db.updateMatch({id:'pending',scoreA:11,scoreB:9});
  assert.equal(saved.matches[0].played,true);assert.equal(saved.members[0].eloSingles,1016);
});
test('soft deletion preserves historical Elo on subsequent replay',()=>{
  setup();db.recordMatch(matchInput()); const before=db.getClubData(); db.deleteMember('a');
  const after=db.getClubData();db.recalculateAllElos(after);
  assert.ok(after.members.find(m=>m.id==='a').archivedAt);
  assert.deepEqual(after.members.map(m=>m.eloSingles),before.members.map(m=>m.eloSingles));
});
test('dashboard initial doubles rating is respected',()=>{
  setup();const data=db.addMember({name:'New',eloDoubles:'1600'});assert.equal(data.members.at(-1).eloDoubles,1600);
});
test('a raw invalid import leaves the previous state byte-for-byte intact',()=>{
  setup();const before=localStorage.getItem(keys.state);
  assert.throws(()=>parseBackup('{"members":[{}],"events":[],"matches":[]}', '1'));
  assert.throws(()=>db.replaceClubData({members:[{}],events:[],matches:[]}));
  assert.equal(localStorage.getItem(keys.state),before);
});
test('backup roundtrip preserves all rows, brackets and extension fields',()=>{
  const original=fixture(); original.futureField={keep:true};setup(original);
  const parsed=parseBackup(JSON.stringify(exportBackup(original,'1')),'1');
  assert.deepEqual(parsed,db.getClubData());assert.throws(()=>parseBackup(JSON.stringify(exportBackup(original,'2')),'1'));
});
test('clear and restore retain a snapshot taken BEFORE replacement',()=>{
  setup();const before=db.getClubData();db.clearAllData();assert.equal(db.getClubData().members.length,0);
  const backup=db.getSnapshots().find(s=>s.label==='before_clear');assert.deepEqual(backup.data,before);
  db.restoreSnapshot(backup.id);assert.deepEqual(db.getClubData(),before);
});
test('local quota failure aborts a mutation without deleting original state',()=>{
  setup();const before=localStorage.getItem(keys.state);
  localStorage.setItem=()=>{throw new Error('QuotaExceededError');};
  assert.throws(()=>db.addMember({name:'No room'}),/Quota/);
  assert.equal(localStorage.getItem(keys.state),before);
});
test('corrupt legacy JSON is never replaced by demo data',()=>{
  setup();localStorage.removeItem(keys.state);localStorage.setItem(keys.legacy,'{broken');
  assert.throws(()=>db.getClubData());assert.equal(localStorage.getItem(keys.legacy),'{broken');assert.equal(localStorage.getItem(keys.state),null);
});
test('loading old data performs no persistence and no Elo replay',()=>{
  setup();localStorage.removeItem(keys.state);const original=fixture();delete original.schemaVersion;delete original.members[0].initialEloSingles;
  const raw=JSON.stringify(original);localStorage.setItem(keys.legacy,raw);
  db.getClubData();assert.equal(localStorage.getItem(keys.legacy),raw);assert.equal(localStorage.getItem(keys.state),null);
});
test('unauthenticated writes and locked event writes fail closed',()=>{
  setup();setAccess({});assert.throws(()=>db.addMember({name:'No access'}),/đăng nhập/);
  const data=fixture();data.events[0].isLocked=true;setup(data);
  assert.throws(()=>db.recordMatch(matchInput()),/khóa/);assert.throws(()=>db.deleteEvent('event'),/khóa/);
});
test('invalid and duplicate teams, fractional money and tied scores are rejected',()=>{
  setup();assert.throws(()=>db.recordMatch(matchInput({teamB:['a']})));
  assert.throws(()=>db.recordMatch(matchInput({scoreA:9})));
  assert.throws(()=>db.addTransaction({type:'income',amount:'1.5'}));
  assert.throws(()=>db.addTransaction({type:'income',amount:'-1'}));
});
test('multi-set score keeps all sets and counts wins instead of total points',()=>{
  const score=scoreFromSets([{a:11,b:5},{a:6,b:11},{a:12,b:10}],'bestOf3');
  assert.equal(score.scoreA,2);assert.equal(score.scoreB,1);assert.equal(score.sets.length,3);
  assert.throws(()=>scoreFromSets([{a:11,b:5},{a:5,b:11}],'bestOf3'));
});
test('date helper uses calendar date and stored instants include timezone',()=>{
  assert.equal(localDate(new Date(2026,8,23,1)), '2026-09-23');
  assert.equal(toInstant('2026-09-23T01:00:00+07:00'),'2026-09-22T18:00:00.000Z');
});
test('stale local state cannot overwrite a later generation',()=>{
  setup();const before=readState();db.addMember({name:'Other tab'});
  assert.throws(()=>commitState(before,before.generation),/tab khác/);
  assert.equal(db.getClubData().members.at(-1).name,'Other tab');
});
test('generated draw scores and deletion update canonical history and backup',()=>{
  setup();db.saveDraw('event','mixer',[{matches:[{matchId:'m1',teamA:['a'],teamB:['b'],played:false,scoreA:null,scoreB:null}]}]);
  db.updateMatch({id:drawMatchId('m1'),scoreA:11,scoreB:9,sets:[{a:11,b:9}]});
  assert.equal(db.getClubData().draws.event.data[0].matches[0].scoreA,11);
  db.deleteMatch(drawMatchId('m1'));
  assert.equal(db.getClubData().draws.event.data[0].matches.length,0);assert.equal(db.getClubData().matches.length,0);
});
test('regeneration cannot overwrite a saved draw without explicit clear',()=>{
  setup();const draw=[{matches:[]}];db.saveDraw('event','mixer',draw);
  assert.throws(()=>db.saveDraw('event','mixer',draw),/hủy lịch/);
});
test('completed downstream round prevents silently changing tournament entrants',()=>{
  setup();db.saveDraw('event','elimination',{rounds:[{matches:[{matchId:'semi',teamA:['a'],teamB:['b'],played:false}]},{matches:[{matchId:'final',teamA:[],teamB:['c'],sourceMatchA:'semi',played:false}]}]});
  db.updateMatch({id:drawMatchId('semi'),scoreA:11,scoreB:9});
  db.updateMatch({id:drawMatchId('final'),type:'singles',scoreA:11,scoreB:8});
  const before=localStorage.getItem(keys.state);
  assert.throws(()=>db.updateMatch({id:drawMatchId('semi'),scoreA:8,scoreB:11}),/Vòng sau/);
  assert.equal(localStorage.getItem(keys.state),before);
});
test('legacy draw is retained and imported only after explicit adoption',()=>{
  setup();localStorage.removeItem(keys.state);localStorage.setItem(keys.legacy,JSON.stringify(fixture()));
  const raw=JSON.stringify([{matches:[{matchId:'old-draw',teamA:['a'],teamB:['b'],played:false}]}]);
  localStorage.setItem('draw_data_event',raw);localStorage.setItem('draw_active_scenario_event','mixer');
  assert.equal(db.getClubData().draws.event.legacy,true);assert.equal(db.getClubData().matches.length,0);
  db.adoptLegacyDraw('event');assert.equal(db.getClubData().matches.length,1);
  assert.equal(localStorage.getItem('draw_data_event'),raw);assert.ok(db.getClubData().legacyDrawStorage.draw_data_event);
});
test('historical orphaned member references survive export and restore',()=>{
  const data=fixture();data.matches=[{...matchInput({teamB:['previously-deleted']}),id:'historic',played:true,eloChanges:{a:16,'previously-deleted':-16}}];setup(data);
  const roundtrip=parseBackup(JSON.stringify(exportBackup(db.getClubData(),'1')),'1');
  assert.deepEqual(roundtrip.matches[0].teamB,['previously-deleted']);
});

test('editing an earlier match cannot indirectly change Elo in a locked event',()=>{
  setup();db.recordMatch(matchInput({eventId:'',date:'2026-09-22T10:00:00+07:00'}));
  const early=db.getClubData().matches[0].id;
  db.recordMatch(matchInput());db.updateEvent({id:'event',isLocked:true});
  const before=localStorage.getItem(keys.state);
  assert.throws(()=>db.updateMatch({id:early,scoreA:9,scoreB:11}),/đã khóa/);
  assert.equal(localStorage.getItem(keys.state),before);
});
