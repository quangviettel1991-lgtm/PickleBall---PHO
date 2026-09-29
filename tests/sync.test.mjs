import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, fixture } from './fixtures.mjs';
import { keys } from '../src/utils/config.js';
import { readState, commitState } from '../src/utils/storage.js';
import { createSyncEngine } from '../src/utils/sync.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('failed read never triggers a write or changes local data',async()=>{
  setup();const before=localStorage.getItem(keys.state);let writes=0;
  const engine=createSyncEngine({read:async()=>{throw new Error('Offline');},write:async()=>{writes++;}});
  await engine.sync();assert.equal(writes,0);assert.equal(localStorage.getItem(keys.state),before);
});
test('an empty remote club is accepted rather than resurrecting old members',async()=>{
  setup();const empty={...fixture(),members:[],events:[]};let writes=0;
  const engine=createSyncEngine({read:async()=>({kind:'found',data:empty,revision:2}),write:async()=>{writes++;}});
  await engine.sync();assert.equal(readState().data.members.length,0);assert.equal(writes,0);
});
test('a slow read cannot erase an edit made after the request began',async()=>{
  setup();const gate=deferred();const engine=createSyncEngine({read:()=>gate.promise});const running=engine.sync();
  const current=readState();current.data.members[0].name='While loading';commitState({...current,pending:true},current.generation);
  gate.resolve({kind:'found',data:fixture(),revision:2});await running;
  assert.equal(readState().data.members[0].name,'While loading');assert.equal(readState().pending,true);
});
test('server conflict retains local pending state and both versions',async()=>{
  setup(fixture(),{pending:true,operationId:'op1'});const before=localStorage.getItem(keys.state);
  const engine=createSyncEngine({canWrite:()=>true,write:async()=>({conflict:true,current:{data:{...fixture(),members:[]},revision:2}})});
  await engine.sync();assert.equal(localStorage.getItem(keys.state),before);assert.ok(engine.getConflict().remote);
  engine.resolveRemote();assert.equal(readState().data.members.length,0);
  assert.ok(JSON.parse(localStorage.getItem(keys.snapshots)).some(s=>s.data.members.length===4));
});
test('lost reply retries exactly the same operation identifier',async()=>{
  setup(fixture(),{pending:true,operationId:'same-op'});const ids=[];
  const engine=createSyncEngine({canWrite:()=>true,write:async(_data,_revision,id)=>{ids.push(id);if(ids.length===1)throw new Error('Lost response');return {revision:2};}});
  await engine.sync();assert.equal(readState().pending,true);await engine.sync();
  assert.deepEqual(ids,['same-op','same-op']);assert.equal(readState().pending,false);
});
test('acknowledgement retains edits queued during an in-flight write',async()=>{
  setup(fixture(),{pending:true,operationId:'old-op'});const gate=deferred();const engine=createSyncEngine({canWrite:()=>true,write:()=>gate.promise});
  const running=engine.sync();const next=readState();next.data.members[0].name='New edit';commitState({...next,operationId:'new-op'},next.generation);
  gate.resolve({revision:2});await running;
  assert.equal(readState().data.members[0].name,'New edit');assert.equal(readState().pending,true);assert.equal(readState().baseRevision,2);
});
test('legacy differences require a choice; never auto-upload',async()=>{
  setup();localStorage.removeItem(keys.state);localStorage.setItem(keys.legacy,JSON.stringify(fixture()));let writes=0;
  const engine=createSyncEngine({read:async()=>({kind:'found',data:{...fixture(),members:[]},revision:1}),write:async()=>{writes++;}});
  await engine.sync();assert.ok(engine.getConflict());assert.equal(readState().data.members.length,4);assert.equal(writes,0);
});
test('a resolved legacy conflict is acknowledged after a fresh server read',async()=>{
  setup();localStorage.removeItem(keys.state);localStorage.setItem(keys.legacy,JSON.stringify(fixture()));
  let remote={...fixture(),members:[]}, reads=0, writes=0;
  const engine=createSyncEngine({read:async()=>{reads++;return {kind:'found',data:remote,revision:reads};},write:async()=>{writes++;}});
  await engine.sync();assert.ok(engine.getConflict());assert.equal(readState().acknowledged,false);
  remote=fixture();await engine.sync();
  assert.equal(engine.getConflict(),null);assert.equal(readState().acknowledged,true);
  assert.equal(readState().baseRevision,2);assert.equal(readState().data.members.length,4);assert.equal(writes,0);
});
test('an unresolved conflict refreshes its server version without replacing local data',async()=>{
  setup();localStorage.removeItem(keys.state);localStorage.setItem(keys.legacy,JSON.stringify(fixture()));
  let remote={...fixture(),members:[]};
  const engine=createSyncEngine({read:async()=>({kind:'found',data:remote,revision:remote.members.length ? 3 : 2})});
  await engine.sync();remote={...fixture(),members:[{...fixture().members[0],name:'Another server edit'}]};
  await engine.sync();assert.equal(engine.getConflict().remote.revision,3);
  assert.equal(readState().data.members.length,4);assert.equal(readState().acknowledged,false);
});
test('not-found response never initializes a club automatically',async()=>{
  setup();let writes=0;const engine=createSyncEngine({read:async()=>({kind:'missing'}),write:async()=>{writes++;}});
  await engine.sync();assert.equal(writes,0);
});
test('remote refresh is deferred while a form is open so its base version stays valid',async()=>{
  setup();let editing=true;const remote=fixture();remote.members[0].name='Changed remotely';
  const engine=createSyncEngine({read:async()=>({kind:'found',data:remote,revision:2}),canApplyRemote:()=>!editing});
  await engine.sync();assert.equal(readState().baseRevision,1);assert.equal(readState().data.members[0].name,'Player a');
  editing=false;await engine.sync();assert.equal(readState().baseRevision,2);assert.equal(readState().data.members[0].name,'Changed remotely');
});
