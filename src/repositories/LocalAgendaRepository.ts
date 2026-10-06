import type {Entity} from '../models/entities';
/** Local transaction port: one write persists entities and durable outbox together. */
export class LocalAgendaRepository {
 private sync:{sync():Promise<void>}|null=null;
 constructor(private read:()=>Entity[],private writer:()=>string,private transaction:(changes:Entity[]|(()=>Entity[]))=>Promise<void>,private drained:()=>Promise<void>){}
 get entities(){return this.read()}
 get writerID(){return this.writer()}
 flush(){return this.drained()}
 connectSync(sync:{sync():Promise<void>}|null){this.sync=sync}
 async commit(changes:Entity[]|(()=>Entity[])){await this.transaction(changes);void this.sync?.sync().catch(()=>{})}
}
