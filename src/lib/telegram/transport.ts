import { Agent, request } from 'node:https';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';

const agent = new Agent({keepAlive:true, maxSockets:4});
const responseLimit=65536;

// Unlike fetch, node:https does not decode Content-Encoding. Telegram's JWKS
// endpoint returns gzip even when Accept-Encoding was not explicitly requested.
export function decodeTelegramBody(body:Buffer,encoding?:string):string {
  if(body.length>responseLimit) throw new Error('Telegram response too large');
  const options={maxOutputLength:responseLimit};
  switch(encoding?.trim().toLowerCase()) {
    case undefined: case '': case 'identity': break;
    case 'gzip': body=gunzipSync(body,options); break;
    case 'deflate': body=inflateSync(body,options); break;
    case 'br': body=brotliDecompressSync(body,options); break;
    default: throw new Error('Unsupported Telegram content encoding');
  }
  return body.toString('utf8');
}

export async function retryTelegramConnection<T>(attempt: () => Promise<T>): Promise<T> {
  for(let n=0;;n++) {
    try { return await attempt(); }
    catch(error) {
      if(n>=3 || !(error instanceof Error) || !('beforeSecureConnection' in error) || error.beforeSecureConnection!==true) throw error;
    }
  }
}

/** Fixed Telegram origin; never follows redirects or retries a submitted code. */
export async function telegramRequest(path:'/token'|'/.well-known/jwks.json', body?:URLSearchParams, authorization?:string) {
  return retryTelegramConnection(() => new Promise<Response>((resolve,reject) => {
    let secure=false;
    const req=request(new URL(path,'https://oauth.telegram.org'),{agent,family:4,method:body?'POST':'GET',
      headers:{'Accept-Encoding':'gzip, deflate, br',...(body?{'Content-Type':'application/x-www-form-urlencoded',Authorization:authorization!}:{})}},res=>{
      const chunks:Buffer[]=[];let length=0;
      res.on('data',(chunk:Buffer)=>{ length+=chunk.length; if(length>responseLimit) req.destroy(new Error('Telegram response too large')); else chunks.push(chunk); });
      res.on('error',reject);
      res.on('end',()=>{
        try { resolve(new Response(decodeTelegramBody(Buffer.concat(chunks),res.headers['content-encoding']),{status:res.statusCode??502,
          headers:{'Content-Type':res.headers['content-type']??'application/json'}})); }
        catch(error) { reject(error); }
      });
    });
    const connectTimer=setTimeout(()=>req.destroy(Object.assign(new Error('Telegram connection timeout'),{code:'CONNECT_TIMEOUT'})),3000);
    let responseTimer:ReturnType<typeof setTimeout>|undefined;
    req.on('socket',socket=>{
      const connected=()=>{ secure=true;clearTimeout(connectTimer);responseTimer=setTimeout(()=>req.destroy(Object.assign(new Error('Telegram response timeout'),{code:'RESPONSE_TIMEOUT'})),10000); };
      if(req.reusedSocket) connected(); else socket.once('secureConnect',connected);
    });
    req.on('error',error=>reject(Object.assign(error,{beforeSecureConnection:!secure})));
    req.on('close',()=>{clearTimeout(connectTimer);clearTimeout(responseTimer);});
    req.end(body?.toString());
  }));
}
