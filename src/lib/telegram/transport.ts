import { Agent, request } from 'node:https';

const agent = new Agent({keepAlive:true, maxSockets:4});

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
      headers:body?{'Content-Type':'application/x-www-form-urlencoded',Authorization:authorization!}:{}},res=>{
      const chunks:Buffer[]=[];let length=0;
      res.on('data',(chunk:Buffer)=>{ length+=chunk.length; if(length>65536) req.destroy(new Error('Telegram response too large')); else chunks.push(chunk); });
      res.on('error',reject);
      res.on('end',()=>resolve(new Response(Buffer.concat(chunks).toString('utf8'),{status:res.statusCode??502,
        headers:{'Content-Type':res.headers['content-type']??'application/json'}})));
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
