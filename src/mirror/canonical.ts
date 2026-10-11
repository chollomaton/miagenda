// Code-unit key ordering and UTF-8 JSON. Ordered arrays (subtasks, weekday/weekNumber
// pairs, event parts) retain order. Only recurrence number-set keys are sorted.
const sets = new Set(['monthDays','yearDays','yearWeeks','months','positions']);
function quoted(value:string):string {
 for(let i=0;i<value.length;i++){const unit=value.charCodeAt(i);if(unit>=0xd800&&unit<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('MIRROR_INVALID_UNICODE');}else if(unit>=0xdc00&&unit<=0xdfff)throw Error('MIRROR_INVALID_UNICODE');}
 return JSON.stringify(value);
}
export function canonicalJSON(value: unknown): string {
 const encode = (input: unknown, key = '', depth = 0): string => {
  if (depth > 64) throw Error('MIRROR_TOO_DEEP');
  if (input == null) return 'null';
  if (typeof input === 'string') return quoted(input);
  if (typeof input === 'boolean') return String(input);
  if (typeof input === 'number') {if (!Number.isSafeInteger(input)) throw Error('MIRROR_INVALID_NUMBER'); return String(Object.is(input,-0)?0:input);}
  if (Array.isArray(input)) {
   let values=input;
   if (sets.has(key)) {if(!Array.from(values).every(item=>typeof item==='number'&&Number.isSafeInteger(item)))throw Error('MIRROR_INVALID_SET');values=[...new Set(values as number[])].sort((a,b)=>a-b);}
   return '['+Array.from(values,item=>encode(item,'',depth+1)).join(',')+']';
  }
  if (typeof input !== 'object' || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) throw Error('MIRROR_NOT_JSON');
  // Writing keys directly avoids JSON.stringify's reordering of numeric object keys.
  return '{'+Object.keys(input).sort().map(k=>quoted(k)+':'+encode((input as Record<string,unknown>)[k],k,depth+1)).join(',')+'}';
 };
 return encode(value);
}
export async function sha256(value: unknown): Promise<string> {
 const bytes = new TextEncoder().encode(canonicalJSON(value));
 const digest = await crypto.subtle.digest('SHA-256', bytes);
 return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}
