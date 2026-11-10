const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const key=code=>'rooms/'+code+'.json';
const allowed=/^(toggle|shot|reset|14|pos|poss:[12]|period|periodPrev|undo|score:[01]:(-1|1|2|3)|foul:[01]:(-1|1)|timeout:[01]|toMinus:[01]|adjust:(clock:(-60000|60000|-1000|1000)|shot:(-1000|1000)))$/;
class Failure extends Error{constructor(status,message){super(message);this.status=status}}
function d1Store(db){return {
 async get(k){const row=await db.prepare('SELECT payload, etag FROM rooms WHERE room_key = ?').bind(k).first();return row?{etag:row.etag,json:async()=>JSON.parse(row.payload)}:null},
 async put(k,payload,{onlyIf}={}){const etag=crypto.randomUUID(),expires=JSON.parse(payload).expires;let result;if(onlyIf?.etagDoesNotMatch==='*')result=await db.prepare('INSERT OR IGNORE INTO rooms (room_key,payload,etag,expires_at) VALUES (?,?,?,?)').bind(k,payload,etag,expires).run();else if(onlyIf?.etagMatches)result=await db.prepare('UPDATE rooms SET payload=?,etag=? WHERE room_key=? AND etag=?').bind(payload,etag,k,onlyIf.etagMatches).run();else throw new Error('Conditional write required');return result.meta.changes?{etag}:null}
}}
async function load(env,code){const obj=await env.BUCKET.get(key(code));if(!obj)throw new Failure(404,'연결 코드가 없거나 만료되었습니다.');const room=await obj.json();if(room.expires<Date.now())throw new Failure(410,'연결 시간이 만료되었습니다. 새 코드를 만드세요.');return {room,etag:obj.etag}}
async function change(env,code,fn){for(let n=0;n<8;n++){const {room,etag}=await load(env,code);const result=fn(room);const saved=await env.BUCKET.put(key(code),JSON.stringify(room),{onlyIf:{etagMatches:etag}});if(saved)return result}throw new Failure(409,'통신이 혼잡합니다. 다시 연결해주세요.')}
function auth(room,secret,role){if(role==='host'&&room.host===secret)return;if(role==='controller'&&room.controller?.token===secret)return;throw new Failure(403,'연결 권한이 없습니다.')}
export async function relay(request,env){try{
 if(env.DB)env={...env,BUCKET:d1Store(env.DB)};
 if(!env.BUCKET)return json({error:'무선 서버의 DB 데이터베이스 설정이 필요합니다.'},503);
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean),code=parts[2],action=parts[3];
 if(request.method!=='POST')return json({error:'POST required'},405);
 const raw=await request.text();if(raw.length>35000)throw new Failure(413,'요청이 너무 큽니다.');let body;try{body=JSON.parse(raw)}catch{throw new Failure(400,'잘못된 요청입니다.')}
 const secret=request.headers.get('Authorization')?.replace(/^Bearer /,'');const now=Date.now();
 if(url.pathname==='/api/remote/create'){
  if(env.DB)await env.DB.prepare('DELETE FROM rooms WHERE expires_at < ?').bind(now).run();
  for(let n=0;n<10;n++){const a=new Uint32Array(1);crypto.getRandomValues(a);const code=String(100000+a[0]%900000),host=token();const room={host,expires:now+12*3600000,hostSeen:now,state:null,updatedAt:now,pending:null,controller:null,commands:[],ack:[],buzzUntil:0,buzzSeq:0};const saved=await env.BUCKET.put(key(code),JSON.stringify(room),{onlyIf:{etagDoesNotMatch:'*'}});if(saved)return json({code,token:host,expires:room.expires})}throw new Failure(503,'코드를 만들지 못했습니다.');
 }
 if(!/^\d{6}$/.test(code||''))throw new Failure(400,'6자리 코드를 입력하세요.');
 return await change(env,code,r=>{
  if(action==='join'){
   if(now-r.hostSeen>5000)throw new Failure(409,'메인 점수판이 연결되어 있지 않습니다.');
   if(r.controller)throw new Failure(409,'컨트롤러가 이미 연결되어 있습니다. 메인에서 연결 해제 후 시도하세요.');
   if(r.pending&&now-r.pending.created<60000)throw new Failure(409,'승인 대기 중인 기기가 있습니다.');
   const t=token();r.pending={token:t,id:crypto.randomUUID(),name:String(body.name||'컨트롤러').slice(0,30),created:now};return json({token:t,status:'pending'});
  }
  if(action==='host'){
   auth(r,secret,'host');r.hostSeen=now;
   if(body.approve&&r.pending?.id===body.approve){r.controller={...r.pending,seen:now};r.pending=null;r.signal=null;r.commands=[];r.ack=[];r.buzzUntil=0;r.buzzSeq=0}
   if(body.reject&&r.pending?.id===body.reject)r.pending=null;
   if(body.disconnect){r.controller=null;r.pending=null;r.commands=[];r.buzzUntil=0;r.signal=null}
   if(body.close){r.expires=now-1;r.controller=null;r.pending=null;r.commands=[];r.buzzUntil=0;r.signal=null}
   if(body.signal&&r.controller&&body.signal.for===r.controller.id&&typeof body.signal.id==='string'&&body.signal.offer?.type==='offer'&&typeof body.signal.offer.sdp==='string'){if(r.signal?.id!==body.signal.id)r.signal={...body.signal,answer:null}}
   if(body.state&&typeof body.state==='object'&&JSON.stringify(body.state).length<12000){r.state=body.state;r.updatedAt=now}
   const ack=Array.isArray(body.ack)?body.ack.filter(x=>typeof x==='string').slice(-30):[];
   r.ack=[...new Set([...r.ack,...ack])].slice(-100);r.commands=r.commands.filter(c=>!r.ack.includes(c.id)&&now-c.at<3000);
   if(r.pending&&now-r.pending.created>60000)r.pending=null;
   return json({pending:r.pending?{id:r.pending.id,name:r.pending.name}:null,controller:r.controller?{id:r.controller.id,name:r.controller.name,seen:r.controller.seen}:null,commands:r.commands,now,buzzUntil:r.buzzUntil,buzzSeq:r.buzzSeq,signal:r.signal||null});
  }
  if(action==='poll'){
   if(r.pending?.token===secret)return json({status:'pending',now});
   auth(r,secret,'controller');r.controller.seen=now;
   return json({status:'connected',state:r.state,updatedAt:r.updatedAt,hostSeen:r.hostSeen,now,ack:r.ack,signal:r.signal||null});
  }
  auth(r,secret,'controller');r.controller.seen=now;
  if(now-r.hostSeen>3000)throw new Failure(409,'메인 점수판 연결이 끊겼습니다. 조작을 중지합니다.');
  if(action==='answer'){if(r.signal?.id!==body.id||body.answer?.type!=='answer'||typeof body.answer.sdp!=='string')throw new Failure(400,'연결 설정이 올바르지 않습니다.');r.signal.answer=body.answer;return json({ok:true})}
  if(action==='command'||action==='commands'){
   const commands=action==='commands'?body.commands:[body];
   if(!Array.isArray(commands)||!commands.length||commands.length>20)throw new Failure(400,'잘못된 입력 묶음입니다.');
   for(const c of commands)if(!c||!allowed.test(c.action)||typeof c.id!=='string'||c.id.length>80||c.game!==r.state?.id)throw new Failure(400,'경기 또는 조작이 올바르지 않습니다.');
   r.commands=r.commands.filter(c=>now-c.at<3000);
   const additions=[];for(const c of commands)if(!r.ack.includes(c.id)&&!r.commands.some(x=>x.id===c.id)&&!additions.some(x=>x.id===c.id))additions.push({id:c.id,action:c.action,game:c.game,at:now});
   if(r.commands.length+additions.length>20)throw new Failure(429,'입력 처리 중입니다. 잠시 기다려주세요.');
   r.commands.push(...additions);return json({accepted:true,ids:commands.map(c=>c.id)});
  }
  if(action==='buzz'){
   if(!Number.isSafeInteger(body.seq)||body.seq<0)throw new Failure(400,'잘못된 버저 요청');
   if(body.seq>r.buzzSeq){r.buzzSeq=body.seq;r.buzzUntil=body.active?now+1400:0}return json({ok:true});
  }
  if(action==='leave'){r.controller=null;r.buzzUntil=0;r.commands=[];r.signal=null;return json({ok:true})}
  throw new Failure(404,'경로를 찾을 수 없습니다.');
 });
 }catch(e){return json({error:e.status?e.message:'무선 서버 오류가 발생했습니다.'},e.status||500)}}
