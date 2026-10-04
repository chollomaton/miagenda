import {it,expect,vi} from 'vitest';
import {CloudKitWebTransport} from '../src/cloud/CloudKitWebTransport';
import {connectCloudKitDevelopment} from '../src/cloud/connectCloudKitDevelopment';
import {MemoryPersistence} from '../src/offline/Persistence';
import {encode} from '../src/cloud/CloudGateway';
import {createEntity} from '../src/models/entities';
const config={containerIdentifier:'iCloud.test.fixture',apiToken:'synthetic-api',environment:'development' as const};
const reply=(body:unknown)=>new Response(JSON.stringify(body));
it('serializes requests and rotates the in-memory token without switching database',async()=>{
 const urls:URL[]=[];const request=vi.fn(async(input:RequestInfo|URL)=>{urls.push(new URL(String(input)));return reply({userRecordName:'user',ckWebAuthToken:'rotated'})});
 const transport=new CloudKitWebTransport(config,'initial',request);await Promise.all([transport.currentUser(),transport.currentUser()]);
 expect(urls[0].pathname).toContain('/development/private/users/current');expect(urls[0].searchParams.get('ckWebAuthToken')).toBe('initial');expect(urls[1].searchParams.get('ckWebAuthToken')).toBe('rotated');
 transport.invalidate();await expect(transport.currentUser()).rejects.toMatchObject({code:'authentication'});expect(request).toHaveBeenCalledTimes(2);
});
it('passes nested change tokens and maps nested expiry',async()=>{
 const request=vi.fn(async()=>reply({zones:[{serverErrorCode:'CHANGE_TOKEN_EXPIRED'}]}));const transport=new CloudKitWebTransport(config,'session',request);
 await expect(transport.fetchRecordZoneChanges('MiAgendaWeb','cursor')).rejects.toMatchObject({code:'tokenExpired'});
});
it('uses conditional writes, numeric booleans, and nested conflict errors',async()=>{
 const bodies:Record<string,unknown>[]=[];const request=vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{bodies.push(JSON.parse(String(init?.body)));return reply({records:[{serverErrorCode:'CONFLICT'}]})});
 const transport=new CloudKitWebTransport(config,'session',request);const record=encode(createEntity('Task'),'tag');
 await expect(transport.saveRecords([record],{zone:'MiAgendaWeb',operationID:'op'})).rejects.toMatchObject({code:'conflict'});
 expect(bodies[0]).toMatchObject({zoneID:{zoneName:'MiAgendaWeb'},operations:[{operationType:'update',record:{recordChangeTag:'tag',fields:{completed:{value:0}}}}]});
});
it('fails closed on physical deletions instead of advancing past lost data',async()=>{
 const transport=new CloudKitWebTransport(config,'session',async()=>reply({zones:[{syncToken:'next',moreComing:false,records:[{recordName:'removed',deleted:true}]}]}));
 await expect(transport.fetchRecordZoneChanges('MiAgendaWeb')).rejects.toMatchObject({code:'invalidRecord'});
});
it('connects existing SyncEngine, pushes and fetches through HTTP boundary with scoped persistence',async()=>{
 let saved:unknown;const scopes:string[]=[];
 const request=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const path=new URL(String(input)).pathname;const body=init?.body?JSON.parse(String(init.body)):{};
  if(path.endsWith('users/current'))return reply({userRecordName:'fixture-user'});
  if(path.endsWith('zones/modify'))return reply({zones:[{zoneID:{zoneName:'MiAgendaWeb'}}]});
  if(path.endsWith('changes/zone'))return reply({zones:[{syncToken:'cursor',moreComing:false,records:[]}]});
  if(path.endsWith('records/modify')){saved={...body.operations[0].record,recordChangeTag:'server-tag'};return reply({records:[saved]})}
  if(path.endsWith('records/lookup'))return reply({records:[saved]});throw Error('unexpected endpoint');
 });
 const {session,repository}=await connectCloudKitDevelopment(config,'session',{request,persistence:scope=>{scopes.push(scope);return new MemoryPersistence()}});
 const entity=await session.store!.create('Task',{title:'Synthetic HTTP probe'});await session.sync!.sync();
 expect(session.store!.outbox).toHaveLength(0);expect(await repository.fetch(entity.id)).toEqual(entity);expect(scopes).toEqual(['iCloud.test.fixture:development:fixture-user']);await session.logout();expect(session.store).toBeNull();
});
