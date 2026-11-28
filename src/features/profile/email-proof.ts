import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto';
export type EmailProof={source:string;flow:string;target:string;email:string;refresh_token:string;expires:number};
const key=(secret:string)=>createHash('sha256').update('roomlet-email-proof:'+secret).digest();
export function sealEmailProof(value:EmailProof,secret:string) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);
  cipher.setAAD(Buffer.from('roomlet-email-link-v1'));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');
}
export function openEmailProof(raw:string,secret:string,source:string,flow:string,now=Date.now()):EmailProof {
  if(raw.length>16000) throw Error('Invalid proof');
  const data=Buffer.from(raw,'base64url'),decipher=createDecipheriv('aes-256-gcm',key(secret),data.subarray(0,12));
  decipher.setAAD(Buffer.from('roomlet-email-link-v1'));decipher.setAuthTag(data.subarray(12,28));
  const proof=JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString()) as EmailProof;
  if(proof.source!==source||proof.flow!==flow||proof.expires<=now||proof.expires>now+300000) throw Error('Expired proof');
  return proof;
}
