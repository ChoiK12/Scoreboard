import assert from 'node:assert/strict';import fs from 'node:fs';import {relay} from './worker/relay.mjs';
let revision=0;const data=new Map();const env={BUCKET:{async get(k){const v=data.get(k);return v?{etag:v.etag,json:async()=>JSON.parse(v.body)}:null},async put(k,body,{onlyIf}={}){const v=data.get(k);if(onlyIf?.etagDoesNotMatch==='*'&&v)return null;if(onlyIf?.etagMatches&&v?.etag!==onlyIf.etagMatches)return null;const etag=String(++revision);data.set(k,{body,etag});return {etag}}}};
if(process.env.TEST_D1==='1'){
 const {DatabaseSync}=await import('node:sqlite');const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('migrations/0001_rooms.sql','utf8'));
 delete env.BUCKET;
 env.DB={
  prepare(query){
   return {bind(...args){
    return {
     async first(){return sql.prepare(query).get(...args)||null},
     async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}
    };
   }};
  }
 };

}
async function api(path,body={},token){const r=await relay(new Request('https://test/api/remote/'+path,{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}),env);return {status:r.status,data:await r.json()}}
const h=(await api('create')).data;assert.match(h.code,/^\d{6}$/);const c=(await api(h.code+'/join',{name:'Test'})).data;assert.equal(c.status,'pending');assert.equal((await api(h.code+'/command',{id:'1',game:'g',action:'toggle'},c.token)).status,403);const pending=(await api(h.code+'/host',{state:{id:'g'}},h.token)).data.pending;await api(h.code+'/host',{approve:pending.id,state:{id:'g'}},h.token);assert.equal((await api(h.code+'/poll',{},c.token)).data.status,'connected');const ctrl=(await api(h.code+'/host',{},h.token)).data.controller;await api(h.code+'/host',{signal:{id:'signal-test',for:ctrl.id,offer:{type:'offer',sdp:'test-offer'}}},h.token);assert.equal((await api(h.code+'/poll',{},c.token)).data.signal.id,'signal-test');assert.equal((await api(h.code+'/answer',{id:'signal-test',answer:{type:'answer',sdp:'test-answer'}},'bad')).status,403);await api(h.code+'/answer',{id:'signal-test',answer:{type:'answer',sdp:'test-answer'}},c.token);assert.equal((await api(h.code+'/host',{},h.token)).data.signal.answer.sdp,'test-answer');assert.equal((await api(h.code+'/poll',{},'bad')).status,403);assert.equal((await api(h.code+'/join')).status,409);assert.equal((await api(h.code+'/command',{id:'1',game:'wrong',action:'toggle'},c.token)).status,400);assert.equal((await api(h.code+'/command',{id:'1',game:'g',action:'evil'},c.token)).status,400);
await api(h.code+'/command',{id:'1',game:'g',action:'score:0:1'},c.token);await api(h.code+'/command',{id:'1',game:'g',action:'score:0:1'},c.token);assert.equal((await api(h.code+'/host',{},h.token)).data.commands.length,1);await api(h.code+'/host',{ack:['1']},h.token);assert.equal((await api(h.code+'/host',{},h.token)).data.commands.length,0);await api(h.code+'/command',{id:'1',game:'g',action:'score:0:1'},c.token);assert.equal((await api(h.code+'/host',{},h.token)).data.commands.length,0);
await api(h.code+'/commands',{commands:[{id:'batch1',game:'g',action:'shot'},{id:'batch2',game:'g',action:'reset'},{id:'batch2',game:'g',action:'reset'}]},c.token);assert.deepEqual((await api(h.code+'/host',{},h.token)).data.commands.map(c=>c.id),['batch1','batch2']);await api(h.code+'/host',{ack:['batch1','batch2']},h.token);await api(h.code+'/buzz',{seq:2,active:false},c.token);await api(h.code+'/buzz',{seq:1,active:true},c.token);assert.equal((await api(h.code+'/host',{},h.token)).data.buzzUntil,0);await api(h.code+'/host',{disconnect:true},h.token);assert.equal((await api(h.code+'/poll',{},c.token)).status,403);await api(h.code+'/host',{close:true},h.token);assert.equal((await api(h.code+'/join')).status,410);console.log('PASS relay: pairing approval, authentication, single-controller limit, action validation, deduplication, acknowledgement, buzzer ordering, revocation');
