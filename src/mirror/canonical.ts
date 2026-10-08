// Code-unit key ordering and UTF-8 JSON. Ordered arrays (subtasks, weekday/weekNumber
// pairs, event parts) retain order. Only recurrence number-set keys are sorted.
const sets = new Set(['monthDays','yearDays','yearWeeks','months','positions']);
export function canonicalJSON(value: unknown): string {
 const visit = (input: unknown, key = '', depth = 0): unknown => {
  if (depth > 64) throw Error('MIRROR_TOO_DEEP');
  if (input == null) return null;
  if (typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number') {if (!Number.isFinite(input)) throw Error('MIRROR_INVALID_NUMBER'); return Object.is(input, -0) ? 0 : input;}
  if (Array.isArray(input)) {
   const values = input.map(item => visit(item, '', depth + 1));
   if (sets.has(key)) {
    if (!values.every(item => typeof item === 'number')) throw Error('MIRROR_INVALID_SET');
    return [...new Set(values as number[])].sort((a,b) => a-b);
   }
   return values;
  }
  if (typeof input !== 'object' || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) throw Error('MIRROR_NOT_JSON');
  return Object.fromEntries(Object.keys(input).sort().map(k => [k, visit((input as Record<string,unknown>)[k], k, depth + 1)]));
 };
 return JSON.stringify(visit(value));
}
export async function sha256(value: unknown): Promise<string> {
 const bytes = new TextEncoder().encode(canonicalJSON(value));
 const digest = await crypto.subtle.digest('SHA-256', bytes);
 return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}
