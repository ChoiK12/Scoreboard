/* Optional low-latency WebRTC data channel. HTTP relay remains the fallback. */
class CourtDirectLink {
 constructor({onMessage,onClose}){this.onMessage=onMessage;this.onClose=onClose;this.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});this.pc.ondatachannel=e=>this.attach(e.channel);this.pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(this.pc.connectionState))this.onClose?.()}}
 attach(channel){this.channel=channel;channel.onmessage=e=>{if(typeof e.data!=='string'||e.data.length>24000)return;try{this.onMessage(JSON.parse(e.data))}catch{}};channel.onclose=()=>this.onClose?.();channel.onerror=()=>this.onClose?.()}
 async gather(){if(this.pc.iceGatheringState==='complete')return;await new Promise(resolve=>{const done=()=>{clearTimeout(timer);this.pc.removeEventListener('icegatheringstatechange',changed);resolve()};const changed=()=>{if(this.pc.iceGatheringState==='complete')done()};const timer=setTimeout(done,4000);this.pc.addEventListener('icegatheringstatechange',changed)})}
 async offer(){this.attach(this.pc.createDataChannel('courtboard',{ordered:true,maxPacketLifeTime:1000}));await this.pc.setLocalDescription(await this.pc.createOffer());await this.gather();return {type:this.pc.localDescription.type,sdp:this.pc.localDescription.sdp}}
 async answer(offer){await this.pc.setRemoteDescription(offer);await this.pc.setLocalDescription(await this.pc.createAnswer());await this.gather();return {type:this.pc.localDescription.type,sdp:this.pc.localDescription.sdp}}
 async accept(answer){if(this.pc.signalingState==='have-local-offer')await this.pc.setRemoteDescription(answer)}
 send(data){if(this.channel?.readyState!=='open'||this.channel.bufferedAmount>24000)return false;try{this.channel.send(JSON.stringify(data));return true}catch{return false}}
 get open(){return this.channel?.readyState==='open'}
 close(){this.onClose=null;this.pc.close()}
}
