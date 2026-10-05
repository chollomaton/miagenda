import {clone,validate,schedulingKeys} from './entities';
import type {Entity,Fields,EditableFields} from './entities';
export function normalizeFields(fields:Partial<Fields>):Partial<Fields>{return {...fields,...(fields.title!==undefined?{title:fields.title.trim()}:{}),...(fields.labelIDs?{labelIDs:[...new Set(fields.labelIDs)]}:{})}}
export function migrate(value:unknown):Entity {validate(value);return clone(value)}
export function deserialize(text:string):Entity{return migrate(JSON.parse(text))}
export function serialize(entity:Entity):string{validate(entity);return JSON.stringify(entity)}
export function diffFields(before:EditableFields,after:EditableFields):Partial<EditableFields>{return Object.fromEntries((Object.keys(after) as (keyof EditableFields)[]).filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])&&!(schedulingKeys.includes(key as typeof schedulingKeys[number])&&before.scheduledStartAt==null&&after.scheduledStartAt==null&&before[key]==null&&after[key]==null)).map(key=>[key,after[key]]))}
