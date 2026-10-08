import {createHash} from 'node:crypto';
export function shellVersion(files:Uint8Array[],worker:string){
 const hash=createHash('sha256').update(worker);
 for(const file of files)hash.update(String(file.byteLength)+':').update(file);
 return hash.digest('hex').slice(0,12);
}
