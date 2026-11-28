import type {Line} from './StoreProvider';
export type SavedState={favorites:string[];cart:Line[];revision?:string};
export type SavedOperation={id:string;kind:'favorite'|'cart';key:string;value:string|Line|null};
type Envelope={state:SavedState;pending:SavedOperation[];claimedBy?:string;imports?:SavedOperation[]};
type Disk=Pick<Storage,'getItem'|'setItem'>;
export const emptySaved:SavedState={favorites:[],cart:[]};
const prefix='roomlet.saved.v2:';
const keyFor=(line:Line)=>[line.slug,line.mode,line.window??''].join(':');
export function validLine(value:unknown):value is Line {
  if(!value || typeof value!=='object')return false;
  const line=value as Line;
  return typeof line.slug==='string'&&line.slug.length>0&&line.slug.length<=200&&
    (line.mode==='ready'&&line.window===null || line.mode==='made'&&typeof line.window==='string'&&line.window.length<=150);
}
function apply(state:SavedState,operations:SavedOperation[]):SavedState {
  let {favorites,cart}=state;
  for(const op of operations) {
    if(op.kind==='favorite')favorites=op.value===null?favorites.filter(slug=>slug!==op.key):[...new Set([...favorites,op.key])];
    else {cart=cart.filter(line=>keyFor(line)!==op.key);if(validLine(op.value))cart=[...cart,op.value];}
  }
  return {...state,favorites,cart};
}
export function savedStorage(disk:Disk,accountId:string|null) {
  const pointer=prefix+'guest-pointer';
  function guestKey(){return disk.getItem(pointer)||prefix+'guest';}
  const accountKey=accountId?prefix+'account:'+accountId:null;
  let lastRaw:string|null|undefined,view=emptySaved;
  function read(key:string):Envelope {
    try {
      const data=JSON.parse(disk.getItem(key)||'null');
      if(!data)return {state:emptySaved,pending:[]};
      return {state:{revision:/^\d+$/.test(data.state?.revision)?data.state.revision:'0',favorites:Array.isArray(data.state?.favorites)?data.state.favorites.filter((v:unknown)=>typeof v==='string'):[],
        cart:Array.isArray(data.state?.cart)?data.state.cart.filter(validLine):[]},
        pending:Array.isArray(data.pending)?data.pending:[],claimedBy:data.claimedBy,imports:data.imports};
    } catch{return {state:emptySaved,pending:[]};}
  }
  function key(){return accountKey??guestKey();}
  function write(k:string,value:Envelope){disk.setItem(k,JSON.stringify(value));lastRaw=undefined;}
  function edit(operation:SavedOperation){const k=key(),data=read(k);if(data.claimedBy)return;write(k,{...data,state:apply(data.state,[operation]),pending:[...data.pending,operation]});}
  return {
    get(){
      let raw:string|null;let k:string;
      try{k=key();raw=disk.getItem(k);}catch{return view;}
      if(raw!==lastRaw){lastRaw=raw;const data=read(k);view=data.claimedBy?emptySaved:data.state;}
      return view;
    },
    pending(){return read(key()).pending.slice(0,100);},
    favorite(slug:string,selected:boolean){if(slug.length>0&&slug.length<=200)edit({id:crypto.randomUUID(),kind:'favorite',key:slug,value:selected?slug:null});},
    cart(line:Line,selected:boolean){if(validLine(line))edit({id:crypto.randomUUID(),kind:'cart',key:keyFor(line),value:selected?line:null});},
    ack(ids:string[],state:SavedState){
      const data=read(key());
      if(BigInt(state.revision??'0')<BigInt(data.state.revision??'0'))return;
      const remaining=data.pending.filter(op=>!ids.includes(op.id));write(key(),{state:apply(state,remaining),pending:remaining});
    },
    claimGuest(){
      if(!accountId||!accountKey)return;
      const transfer=prefix+'transfer:'+accountId;
      let source=disk.getItem(transfer)||guestKey(),guest=read(source);
      if(!guest.state.favorites.length&&!guest.state.cart.length&&disk.getItem(transfer)) {
        disk.setItem(transfer,'');source=guestKey();guest=read(source);
      }
      if(guest.claimedBy && guest.claimedBy!==accountId)return;
      if(!guest.state.favorites.length&&!guest.state.cart.length)return;
      // Journal ownership before changing the account. A failed write can be
      // retried by this account; a different account cannot inherit the data.
      disk.setItem(transfer,source);
      const imports=guest.imports??[
        ...guest.state.favorites.map(slug=>({id:crypto.randomUUID(),kind:'favorite' as const,key:slug,value:slug})),
        ...guest.state.cart.map(line=>({id:crypto.randomUUID(),kind:'cart' as const,key:keyFor(line),value:line})),
      ];
      write(source,{...guest,claimedBy:accountId,imports});
      const target=read(accountKey),known=new Set(target.pending.map(op=>op.id));
      const additions=imports.filter(op=>!known.has(op.id));
      write(accountKey,{state:apply(target.state,additions),pending:[...target.pending,...additions]});
      if(guestKey()===source)disk.setItem(pointer,prefix+'guest:'+crypto.randomUUID());
      write(source,{state:emptySaved,pending:[],claimedBy:accountId});
      disk.setItem(transfer,'');
    },
  };
}
