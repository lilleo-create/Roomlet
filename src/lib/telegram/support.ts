export function normalizeSupportUsername(value:string):string|null {
  const trimmed=value.trim();
  if(trimmed==='') return '';
  const username=trimmed.replace(/^@/,'');
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)?username:null;
}
export function resolveSupportUsername(saved:string|null,fallback?:string):string|null {
  return normalizeSupportUsername(saved===null?fallback??'':saved) || null;
}
export function supportLink(username:string|null):string|null {
  const normalized=normalizeSupportUsername(username??'');
  return normalized?'https://t.me/'+normalized:null;
}
