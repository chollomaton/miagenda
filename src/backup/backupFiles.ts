import {downloadBackup,parseBackup} from './backup';
import type {Backup} from './backup';
import {decodeBackupZIP,encodeBackupZIP,MAX_BACKUP_BYTES} from './zip';

export async function downloadBackupZIP(backup:Backup){
 // Use the existing validator and entity checksum before packaging any data.
 await parseBackup(JSON.stringify(backup));
 const bytes=await encodeBackupZIP(JSON.stringify(backup,null,2));
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
 try{
  const link=document.createElement('a');link.href=url;
  link.download='mi-agenda-backup-'+backup.createdAt.slice(0,10)+'.zip';link.click();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
}

function readFile(file:File):Promise<ArrayBuffer>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(Error('BACKUP_READ_FAILED'));
  reader.onabort=()=>reject(Error('BACKUP_READ_FAILED'));
  reader.onload=()=>reader.result instanceof ArrayBuffer?resolve(reader.result):reject(Error('BACKUP_READ_FAILED'));
  reader.readAsArrayBuffer(file);
 });
}

export async function parseBackupFile(file:File):Promise<Backup>{
 if(file.size>MAX_BACKUP_BYTES+1024)throw Error('BACKUP_TOO_LARGE');
 const bytes=new Uint8Array(await readFile(file));
 const isZIP=bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b;
 if(isZIP)return parseBackup(await decodeBackupZIP(bytes));
 if(bytes.length>MAX_BACKUP_BYTES)throw Error('BACKUP_TOO_LARGE');
 if(/\.zip$/i.test(file.name)||file.type==='application/zip')throw Error('INVALID_BACKUP_ZIP');
 let text:string;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw Error('INVALID_BACKUP')}
 return parseBackup(text);
}

export function backupFileError(error:unknown){
 const code=error instanceof Error?error.message:'';
 if(code==='BACKUP_TOO_LARGE')return 'El backup supera el límite de 20 MB. No se han importado datos.';
 if(code==='ZIP_DECOMPRESSION_UNAVAILABLE')return 'Este navegador no puede abrir el ZIP comprimido. Extrae backup.json e importa ese archivo.';
 if(code==='BACKUP_READ_FAILED')return 'No se pudo leer el archivo. Vuelve a seleccionarlo.';
 return 'El backup no es válido o está dañado. No se han importado datos.';
}

export {downloadBackup};
