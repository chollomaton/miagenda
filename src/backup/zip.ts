// A deliberately narrow ZIP container: exactly one backup.json, no extraction to disk.
export const MAX_BACKUP_BYTES=20_000_000;
const name=new TextEncoder().encode('backup.json');
const MAX_ZIP_BYTES=MAX_BACKUP_BYTES+1024;

export function crc32(bytes:Uint8Array){
 let crc=0xffffffff;
 for(const byte of bytes){
  crc^=byte;
  for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}

async function collect(stream:ReadableStream<Uint8Array>,limit:number){
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>limit){await reader.cancel();throw Error('BACKUP_TOO_LARGE')}
   chunks.push(value);
  }
 }finally{reader.releaseLock()}
 const output=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length}
 return output;
}

function stream(bytes:Uint8Array){return new ReadableStream<BufferSource>({start(controller){controller.enqueue(new Uint8Array(bytes));controller.close()}})}

export async function encodeBackupZIP(text:string):Promise<Uint8Array<ArrayBuffer>>{
 const raw=new TextEncoder().encode(text);
 if(raw.length>MAX_BACKUP_BYTES)throw Error('BACKUP_TOO_LARGE');
 let data:Uint8Array=raw,method=0;
 // Stored ZIP remains available on browsers without native raw-deflate support.
 if(typeof CompressionStream!=='undefined'){
  let compressor:CompressionStream|undefined;
  try{compressor=new CompressionStream('deflate-raw')}catch{ /* Use stored ZIP. */ }
  if(compressor){
   const compressed=await collect(stream(raw).pipeThrough(compressor),MAX_ZIP_BYTES);
   if(compressed.length<raw.length){data=compressed;method=8}
  }
 }
 const localSize=30+name.length,centralOffset=localSize+data.length,centralSize=46+name.length;
 const bytes=new Uint8Array(centralOffset+centralSize+22),view=new DataView(bytes.buffer),crc=crc32(raw);
 const u16=(offset:number,value:number)=>view.setUint16(offset,value,true);
 const u32=(offset:number,value:number)=>view.setUint32(offset,value,true);
 u32(0,0x04034b50);u16(4,20);u16(6,0x800);u16(8,method);u16(12,33);
 u32(14,crc);u32(18,data.length);u32(22,raw.length);u16(26,name.length);
 bytes.set(name,30);bytes.set(data,localSize);
 u32(centralOffset,0x02014b50);u16(centralOffset+4,20);u16(centralOffset+6,20);
 u16(centralOffset+8,0x800);u16(centralOffset+10,method);u16(centralOffset+14,33);
 u32(centralOffset+16,crc);u32(centralOffset+20,data.length);u32(centralOffset+24,raw.length);
 u16(centralOffset+28,name.length);bytes.set(name,centralOffset+46);
 const end=centralOffset+centralSize;
 u32(end,0x06054b50);u16(end+8,1);u16(end+10,1);u32(end+12,centralSize);u32(end+16,centralOffset);
 return bytes;
}

export async function decodeBackupZIP(bytes:Uint8Array):Promise<string>{
 if(bytes.length>MAX_ZIP_BYTES)throw Error('BACKUP_TOO_LARGE');
 if(bytes.length<22)throw Error('INVALID_BACKUP_ZIP');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const u16=(offset:number)=>view.getUint16(offset,true),u32=(offset:number)=>view.getUint32(offset,true);
 // Our container has no ZIP comment, multiple disks, ZIP64 or extra entries.
 const end=bytes.length-22;
 if(u32(end)!==0x06054b50||u16(end+4)!==0||u16(end+6)!==0||u16(end+8)!==1||u16(end+10)!==1||u16(end+20)!==0)throw Error('INVALID_BACKUP_ZIP');
 const central=u32(end+16),centralSize=u32(end+12);
 if(central<30||centralSize<46||central+centralSize!==end)throw Error('INVALID_BACKUP_ZIP');
 if(u32(central)!==0x02014b50||u16(central+34)!==0||u32(central+42)!==0)throw Error('INVALID_BACKUP_ZIP');
 const flags=u16(central+8),method=u16(central+10),crc=u32(central+16),packed=u32(central+20),size=u32(central+24);
 if(size>MAX_BACKUP_BYTES||packed>MAX_ZIP_BYTES)throw Error('BACKUP_TOO_LARGE');
 if((flags&~0x800)!==0||![0,8].includes(method)||u16(central+6)>20)throw Error('UNSUPPORTED_BACKUP_ZIP');
 const nameSize=u16(central+28),extra=u16(central+30),comment=u16(central+32);
 if(46+nameSize+extra+comment!==centralSize||nameSize!==name.length||!name.every((byte,index)=>bytes[central+46+index]===byte))throw Error('INVALID_BACKUP_ZIP');
 // Reject symlinks, devices and directories even when their name looks correct.
 const attributes=u32(central+38),fileType=(attributes>>>16)&0xf000;
 if((attributes&0x10)!==0||(fileType!==0&&fileType!==0x8000))throw Error('INVALID_BACKUP_ZIP');
 if(u32(0)!==0x04034b50||u16(4)>20||u16(6)!==flags||u16(8)!==method||u32(14)!==crc||u32(18)!==packed||u32(22)!==size||u16(26)!==name.length)throw Error('INVALID_BACKUP_ZIP');
 const start=30+u16(26)+u16(28);
 if(start+packed!==central||!name.every((byte,index)=>bytes[30+index]===byte))throw Error('INVALID_BACKUP_ZIP');
 const data=bytes.subarray(start,central);let raw:Uint8Array=data;
 if(method===8){
  if(typeof DecompressionStream==='undefined')throw Error('ZIP_DECOMPRESSION_UNAVAILABLE');
  let decompressor:DecompressionStream;
  try{decompressor=new DecompressionStream('deflate-raw')}catch{throw Error('ZIP_DECOMPRESSION_UNAVAILABLE')}
  try{raw=await collect(stream(data).pipeThrough(decompressor),Math.min(size,MAX_BACKUP_BYTES))}
  catch(error){if(error instanceof Error&&error.message==='BACKUP_TOO_LARGE')throw error;throw Error('INVALID_BACKUP_ZIP',{cause:error})}
 }
 if(raw.length!==size||crc32(raw)!==crc)throw Error('ZIP_CHECKSUM_FAILED');
 try{return new TextDecoder('utf-8',{fatal:true}).decode(raw)}catch{throw Error('INVALID_BACKUP_ZIP')}
}
