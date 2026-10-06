import {afterEach,expect,it,vi} from 'vitest';
import {CompressionStream,DecompressionStream,ReadableStream} from 'node:stream/web';
import {inflateRawSync} from 'node:zlib';
import {createEntity,updateEntity} from '../src/models/entities';
import {exportBackup,importBackup,backupEntities} from '../src/backup/backup';
import {decodeBackupZIP,encodeBackupZIP,crc32,MAX_BACKUP_BYTES} from '../src/backup/zip';
import {downloadBackupZIP,parseBackupFile} from '../src/backup/backupFiles';
import {AgendaStore} from '../src/stores/AgendaStore';
import {MemoryPersistence} from '../src/offline/Persistence';

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});
function nativeCompression(){vi.stubGlobal('CompressionStream',CompressionStream);vi.stubGlobal('DecompressionStream',DecompressionStream);vi.stubGlobal('ReadableStream',ReadableStream)}
function file(bytes:Uint8Array,name='backup.zip'){return new File([new Uint8Array(bytes)],name,{type:name.endsWith('.zip')?'application/zip':'application/json'})}
async function sample(){
 const label=createEntity('Label',{title:'Personal'}),task=createEntity('Task',{title:'España 🗓',labelIDs:[label.id],scheduledStartAt:'2026-10-05T08:00:00.000Z',scheduledDurationMinutes:30,scheduledTimezone:'Europe/Madrid'});
 return exportBackup([
  task,createEntity('Subtask',{title:'Paso',parentTaskId:task.id}),
  createEntity('Reminder',{title:'Llamar',due:'2026-10-05T09:00:00.000Z'}),
  createEntity('Event',{title:'Reunión',start:'2026-10-05T10:00:00.000Z',end:'2026-10-05T11:00:00.000Z'}),
  updateEntity(createEntity('QuickNote',{text:'Nota eliminada'}),{},'writer','deleted'),label,createEntity('Preferences'),
  createEntity('Template',{name:'Rutina',definition:{targetKind:'Task',values:{title:'Preparar',labelIDs:[label.id]}}}),
 ]);
}
it('CRC32 matches the independent ZIP reference vector',()=>{expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)});
it.each([false,true])('ZIP roundtrip preserves every entity, templates, scheduling, tombstones and clocks; native compression=%s',async native=>{
 if(native)nativeCompression();else vi.stubGlobal('CompressionStream',undefined);
 const backup=await sample(),bytes=await encodeBackupZIP(JSON.stringify(backup,null,2));
 expect(await parseBackupFile(file(bytes))).toEqual(backup);
 const view=new DataView(bytes.buffer),method=view.getUint16(8,true),start=30+view.getUint16(26,true),length=view.getUint32(18,true);
 expect(method).toBe(native?8:0);
 // Independent zlib decoder confirms the encoded ZIP member is standard raw deflate.
 const data=bytes.subarray(start,start+length);
 const text=native?inflateRawSync(data).toString('utf8'):new TextDecoder().decode(data);
 expect(JSON.parse(text)).toEqual(backup);expect(backupEntities(backup)).toHaveLength(8);
 for(const key of ['outbox','cursor','quarantine','sessionToken','recordChangeTag'])expect(text).not.toContain('"'+key+'"');
});
it('accepts historical V1 JSON and V1 wrapped in ZIP without normalizing',async()=>{
 const backup=await exportBackup([createEntity('Task',{title:'  Histórico  '})]);const {templates,...rest}=backup;expect(templates).toHaveLength(0);
 const v1={...rest,format:'MiAgendaBackupV1',formatVersion:1};const text=JSON.stringify(v1);
 expect(await parseBackupFile(new File([text],'historic.json'))).toEqual(v1);
 expect(await parseBackupFile(file(await encodeBackupZIP(text)))).toEqual(v1);
});
it('detects ZIP by bytes rather than trusting an extension or MIME',async()=>{
 const backup=await sample(),bytes=await encodeBackupZIP(JSON.stringify(backup));expect(await parseBackupFile(file(bytes,'renamed.json'))).toEqual(backup);
 await expect(parseBackupFile(new File([JSON.stringify(backup)],'fake.zip'))).rejects.toThrow('INVALID_BACKUP_ZIP');
});
it('rejects corrupted ZIP bytes and embedded entity checksum before any mutation',async()=>{
 vi.stubGlobal('CompressionStream',undefined);
 const backup=await sample(),bytes=await encodeBackupZIP(JSON.stringify(backup));bytes[30+11+10]^=1;
 await expect(parseBackupFile(file(bytes))).rejects.toThrow('ZIP_CHECKSUM_FAILED');
 backup.tasks[0].fields.title='Tampered';const bad=await encodeBackupZIP(JSON.stringify(backup));
 const store=new AgendaStore(new MemoryPersistence());await store.boot();await store.create('Task',{title:'Keep'});const before=store.snapshot(),save=vi.spyOn(store.persistence,'save');
 await expect(parseBackupFile(file(bad)).then(value=>importBackup(store,value,'replace','REEMPLAZAR'))).rejects.toThrow('CHECKSUM_FAILED');
 expect(save).not.toHaveBeenCalled();expect(store.snapshot()).toEqual(before);expect(await store.persistence.load()).toEqual(before);
});
it.each(['truncated','offset','count','encrypted','name','local-name','method','symlink','size','local-crc','trailing'])('rejects malformed or unsupported ZIP: %s',async damage=>{
 vi.stubGlobal('CompressionStream',undefined);let bytes=await encodeBackupZIP('{}');const view=new DataView(bytes.buffer),end=bytes.length-22,central=view.getUint32(end+16,true);
 switch(damage){
  case 'truncated':bytes=bytes.slice(0,15);break;
  case 'offset':view.setUint32(end+16,0xffffffff,true);break;
  case 'count':view.setUint16(end+10,2,true);break;
  case 'encrypted':view.setUint16(central+8,1,true);break;
  case 'name':bytes[central+46]=46;break;
  case 'local-name':bytes[30]=46;break;
  case 'method':view.setUint16(central+10,99,true);break;
  case 'symlink':view.setUint32(central+38,0xa0000000,true);break;
  case 'size':view.setUint32(central+24,MAX_BACKUP_BYTES+1,true);break;
  case 'local-crc':view.setUint32(14,123,true);break;
  case 'trailing':bytes=new Uint8Array([...bytes,0]);break;
 }
 await expect(decodeBackupZIP(bytes)).rejects.toThrow();
});
it('bounds inflated data against the declared size, including forged matching local headers',async()=>{
 nativeCompression();const bytes=await encodeBackupZIP('x'.repeat(100_000));const view=new DataView(bytes.buffer),central=view.getUint32(bytes.length-6,true);
 view.setUint32(22,10,true);view.setUint32(central+24,10,true);
 await expect(decodeBackupZIP(bytes)).rejects.toThrow('BACKUP_TOO_LARGE');
});
it('bounds file size before reading and rejects oversized exports',async()=>{
 const oversized=new File(['x'],'big.zip');Object.defineProperty(oversized,'size',{value:MAX_BACKUP_BYTES+1025});const read=vi.spyOn(FileReader.prototype,'readAsArrayBuffer');
 await expect(parseBackupFile(oversized)).rejects.toThrow('BACKUP_TOO_LARGE');expect(read).not.toHaveBeenCalled();
 await expect(encodeBackupZIP('x'.repeat(MAX_BACKUP_BYTES+1))).rejects.toThrow('BACKUP_TOO_LARGE');
});
it('reports unavailable decompression and still supports stored ZIP',async()=>{
 nativeCompression();const compressed=await encodeBackupZIP('x'.repeat(100));vi.stubGlobal('DecompressionStream',undefined);
 await expect(decodeBackupZIP(compressed)).rejects.toThrow('ZIP_DECOMPRESSION_UNAVAILABLE');
 vi.stubGlobal('CompressionStream',undefined);expect(await decodeBackupZIP(await encodeBackupZIP('text'))).toBe('text');
});
it('downloads a dated ZIP with correct MIME, revokes its URL and rejects invalid data before download',async()=>{
 vi.useFakeTimers();
 const create=vi.fn<(blob:Blob)=>string>(()=> 'blob:test'),revoke=vi.fn(),click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 vi.stubGlobal('URL',class extends URL{static createObjectURL=create;static revokeObjectURL=revoke});
 try{
  const backup=await sample();await downloadBackupZIP(backup);
  expect(create).toHaveBeenCalledTimes(1);expect(create.mock.calls[0]).toHaveLength(1);
  const blob=create.mock.calls[0][0];expect(blob.type).toBe('application/zip');
  expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('mi-agenda-backup-'+backup.createdAt.slice(0,10)+'.zip');expect((click.mock.contexts[0] as HTMLAnchorElement).href).toBe('blob:test');
  expect(revoke).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1000);expect(revoke).toHaveBeenCalledWith('blob:test');
  backup.tasks[0].fields.title='tampered';await expect(downloadBackupZIP(backup)).rejects.toThrow('CHECKSUM_FAILED');expect(create).toHaveBeenCalledTimes(1);
 }finally{vi.useRealTimers()}
});
it('ZIP merge and replace keep the original confirmation and atomic rollback guarantees',async()=>{
 const store=new AgendaStore(new MemoryPersistence());await store.boot();const keep=await store.create('Task',{title:'Keep'});
 const parsed=await parseBackupFile(file(await encodeBackupZIP(JSON.stringify(await sample()))));
 const before=store.snapshot();await expect(importBackup(store,parsed,'replace')).rejects.toThrow('CONFIRMATION_REQUIRED');expect(store.snapshot()).toEqual(before);
 const save=vi.spyOn(store.persistence,'save').mockRejectedValueOnce(Error('disk'));
 await expect(importBackup(store,parsed,'replace','REEMPLAZAR')).rejects.toThrow('STORAGE_WRITE_FAILED');expect(store.snapshot()).toEqual(before);expect(await store.persistence.load()).toEqual(before);save.mockRestore();
 await importBackup(store,parsed,'merge');expect(store.entities.find(e=>e.id===keep.id)?.lifecycle).toBe('active');
 const safety=await importBackup(store,parsed,'replace','REEMPLAZAR');expect(safety.tasks.some(e=>e.id===keep.id)).toBe(true);expect(store.entities.find(e=>e.id===keep.id)?.lifecycle).toBe('deleted');
});
